import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyWebhook } from '@/lib/stripe';

/**
 * POST /api/stripe/webhook (§3.2, §18)
 *
 * Listens for checkout.session.completed and customer.subscription.updated/deleted
 * and keeps tfb_subscriptions in step.
 *
 * Three properties this route has to hold, and none of them is obvious:
 *
 * **The signature is verified before anything is read.** While
 * STRIPE_WEBHOOK_SECRET is unset every call is rejected — an unverified webhook is
 * an unauthenticated write from anyone who knows the URL.
 *
 * **The same event may arrive many times.** Stripe redelivers until it gets a 2xx,
 * so a duplicate is the normal case, not an anomaly. `tfb_stripe_events.stripe_event_id`
 * is unique: the insert is the lock, and losing that race means someone else is
 * already applying this event.
 *
 * **Events may arrive out of order.** A `customer.subscription.updated` delayed by
 * a retry can land after a newer one and roll the status backwards — from
 * `canceled` to `active`, which is the expensive direction. Every write compares
 * Stripe's own `created` against `last_event_created` and refuses to go back.
 */

// The raw body is required for signature verification, so no parsing middleware.
export const dynamic = 'force-dynamic';

interface StripeSubscriptionLike {
  id?: string;
  customer?: string;
  status?: string;
  current_period_end?: number;
  metadata?: { plan_key?: string };
}

type Outcome = { outcome: 'applied' | 'ignored' | 'skipped'; detail?: string };

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  let verification;
  try {
    verification = await verifyWebhook(rawBody, signature);
  } catch (error) {
    console.error('Stripe webhook verification threw', error);
    return NextResponse.json({ error: 'Vérification impossible.' }, { status: 500 });
  }

  if (!verification.ok) {
    // 400, not 401: Stripe retries on 4xx/5xx either way, and the reason is logged.
    console.warn('Stripe webhook rejected:', verification.reason);
    return NextResponse.json({ error: verification.reason }, { status: 400 });
  }

  const event = verification.event;

  // The insert IS the deduplication. Checking first and inserting after would leave
  // a window in which two concurrent deliveries both find nothing and both apply.
  try {
    await prisma.stripeEvent.create({
      data: { stripeEventId: event.id, type: event.type, created: event.created, outcome: 'pending' },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      console.error('Stripe webhook could not be recorded', error);
      return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
    }

    // Seen before. A previous attempt that FAILED must not be mistaken for work
    // already done — that is precisely the delivery Stripe is retrying, and
    // answering 200 would strand the subscription in a stale state for good.
    const previous = await prisma.stripeEvent.findUnique({ where: { stripeEventId: event.id } });
    if (previous?.outcome !== 'failed') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    await prisma.stripeEvent.update({
      where: { stripeEventId: event.id },
      data: { outcome: 'pending', detail: null, receivedAt: new Date() },
    });
  }

  let result: Outcome;
  try {
    result = await apply(event);
  } catch (error) {
    console.error(`Stripe webhook ${event.type} failed`, error);
    // Marked failed rather than deleted: the console needs to show that this event
    // arrived and did not land, and the duplicate branch above reads this outcome
    // to let Stripe's retry try again.
    await prisma.stripeEvent.update({
      where: { stripeEventId: event.id },
      data: { outcome: 'failed', detail: error instanceof Error ? error.message.slice(0, 255) : null },
    }).catch(() => undefined);
    // 500 so Stripe retries — the event has not been applied.
    return NextResponse.json({ error: 'Traitement impossible.' }, { status: 500 });
  }

  await prisma.stripeEvent.update({
    where: { stripeEventId: event.id },
    data: { outcome: result.outcome, detail: result.detail ?? null },
  }).catch(() => undefined);

  return NextResponse.json({ received: true });
}

async function apply(event: { type: string; data: unknown; created: number }): Promise<Outcome> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data as {
        customer?: string; subscription?: string; customer_email?: string; metadata?: { plan_key?: string };
      };
      const planKey = session.metadata?.plan_key;
      if (!planKey || !session.subscription) {
        return { outcome: 'ignored', detail: 'Session sans plan_key ou sans abonnement.' };
      }
      const plan = await prisma.plan.findUnique({ where: { key: planKey } });
      if (!plan) return { outcome: 'ignored', detail: `Plan « ${planKey} » inconnu.` };

      await prisma.subscription.upsert({
        where: { stripeSubscriptionId: session.subscription },
        create: {
          email: session.customer_email ?? '',
          stripeCustomerId: session.customer ?? null,
          stripeSubscriptionId: session.subscription,
          planId: plan.id,
          status: 'active',
          lastEventCreated: event.created,
        },
        update: { status: 'active', stripeCustomerId: session.customer ?? null, lastEventCreated: event.created },
      });
      return { outcome: 'applied', detail: `abonnement ${session.subscription} actif` };
    }

    case 'customer.subscription.updated': {
      const sub = event.data as StripeSubscriptionLike;
      if (!sub.id) return { outcome: 'ignored', detail: 'Abonnement sans identifiant.' };
      return writeSubscription(sub.id, event.created, {
        status: sub.status ?? 'active',
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      }, `statut → ${sub.status ?? 'active'}`);
    }

    case 'customer.subscription.deleted': {
      const sub = event.data as StripeSubscriptionLike;
      if (!sub.id) return { outcome: 'ignored', detail: 'Abonnement sans identifiant.' };
      return writeSubscription(sub.id, event.created, { status: 'canceled' }, 'statut → canceled');
    }

    default:
      // Acknowledged so Stripe stops retrying a type we do not act on.
      return { outcome: 'ignored', detail: 'Type non traité.' };
  }
}

/**
 * Writes a subscription only if this event is not older than the last one applied.
 *
 * The comparison is in the WHERE clause rather than in a read-then-write, so two
 * deliveries racing each other cannot both pass the check.
 */
async function writeSubscription(
  stripeSubscriptionId: string,
  created: number,
  data: Prisma.SubscriptionUpdateManyMutationInput,
  detail: string,
): Promise<Outcome> {
  const written = await prisma.subscription.updateMany({
    where: {
      stripeSubscriptionId,
      OR: [{ lastEventCreated: null }, { lastEventCreated: { lte: created } }],
    },
    data: { ...data, lastEventCreated: created },
  });

  if (written.count > 0) return { outcome: 'applied', detail };

  const exists = await prisma.subscription.findUnique({ where: { stripeSubscriptionId } });
  return exists
    ? { outcome: 'skipped', detail: 'Événement plus ancien que le dernier appliqué.' }
    : { outcome: 'ignored', detail: 'Abonnement inconnu en base.' };
}
