import Stripe from 'stripe';

/**
 * Stripe — live.
 *
 * Every Stripe call in the application goes through this module, so there is one
 * place that decides what happens when the keys are absent. That is the whole
 * point of the shape below: **an unconfigured Stripe is a reported state, never a
 * pretended success.** `/api/checkout` answers `{ status: 'stub' }` and the pricing
 * grid says so; the webhook refuses outright; the packs screen says it could not
 * read anything. Nothing silently behaves as though a payment had happened.
 *
 * The API version is left to the SDK's own pinned default. Overriding it here
 * would let a `npm update` change the wire format under code written against a
 * different one.
 */

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

/** True once keys are present. Every caller branches on this, never on NODE_ENV. */
export function stripeConfigured(): boolean {
  return STRIPE_SECRET_KEY.length > 0;
}

/** `sk_test_…` and `sk_live_…` are the only honest way to name the mode. */
export function stripeMode(): 'test' | 'live' | 'unknown' {
  if (STRIPE_SECRET_KEY.startsWith('sk_test_') || STRIPE_SECRET_KEY.startsWith('rk_test_')) return 'test';
  if (STRIPE_SECRET_KEY.startsWith('sk_live_') || STRIPE_SECRET_KEY.startsWith('rk_live_')) return 'live';
  return 'unknown';
}

let client: Stripe | null = null;

/** The SDK instance, created once. Throws when unconfigured — callers guard first. */
function stripe(): Stripe {
  if (!stripeConfigured()) throw new Error('STRIPE_SECRET_KEY absent.');
  client ??= new Stripe(STRIPE_SECRET_KEY, {
    // Named so a Stripe-side log or support ticket can tell which app called.
    appInfo: { name: 'TFB Landing', url: 'https://www.franchisebuddy.eu' },
    // Two attempts: a transient 5xx should not lose a checkout, and more than
    // two makes a user wait on a page that already looks broken.
    maxNetworkRetries: 2,
  });
  return client;
}

export interface CheckoutRequest {
  priceId: string;
  planKey: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
}

export type CheckoutResult =
  | { status: 'redirect'; url: string }
  | { status: 'stub'; reason: string };

/**
 * Opens a Checkout session for a plan.
 *
 * `plan_key` travels in the session metadata **and** in the subscription's, because
 * the webhook reads it off both: `checkout.session.completed` carries the session,
 * later `customer.subscription.*` events carry only the subscription. Without the
 * second copy an update six months later cannot say which plan it belongs to.
 */
export async function createCheckoutSession(req: CheckoutRequest): Promise<CheckoutResult> {
  if (!stripeConfigured()) {
    return { status: 'stub', reason: 'STRIPE_SECRET_KEY absent — aucune session Checkout créée.' };
  }

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: req.priceId, quantity: 1 }],
    success_url: req.successUrl,
    cancel_url: req.cancelUrl,
    ...(req.email ? { customer_email: req.email } : {}),
    metadata: { plan_key: req.planKey },
    subscription_data: { metadata: { plan_key: req.planKey } },
    // Stripe collects the address it needs for VAT; asking twice is how a checkout
    // loses people.
    automatic_tax: { enabled: false },
  });

  if (!session.url) {
    // A session with no URL cannot be followed. Reported rather than returned as a
    // redirect to nowhere.
    return { status: 'stub', reason: 'Stripe a créé une session sans URL de redirection.' };
  }
  return { status: 'redirect', url: session.url };
}

export type WebhookVerification =
  | { ok: true; event: { type: string; data: unknown; id: string; created: number } }
  | { ok: false; reason: string };

/**
 * Verifies the `stripe-signature` header against the raw body.
 *
 * Refuses everything while STRIPE_WEBHOOK_SECRET is unset. An unverified webhook is
 * an unauthenticated write to tfb_subscriptions from anyone who knows the URL.
 */
export async function verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookVerification> {
  if (!STRIPE_WEBHOOK_SECRET) {
    return { ok: false, reason: 'STRIPE_WEBHOOK_SECRET absent — webhook refusé.' };
  }
  if (!signature) {
    return { ok: false, reason: 'En-tête stripe-signature manquant.' };
  }

  try {
    // constructEventAsync, not constructEvent: the synchronous form uses Node's
    // crypto directly and throws on the Edge runtime.
    const event = await stripe().webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    return {
      ok: true,
      event: { type: event.type, data: event.data.object, id: event.id, created: event.created },
    };
  } catch (error) {
    // Includes an expired timestamp, which is a replay attempt, not a bug.
    return { ok: false, reason: error instanceof Error ? error.message : 'Signature invalide.' };
  }
}

export async function createBillingPortalSession(customerId: string, returnUrl: string): Promise<CheckoutResult> {
  if (!stripeConfigured()) {
    return { status: 'stub', reason: 'STRIPE_SECRET_KEY absent — portail client indisponible.' };
  }
  const session = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return { status: 'redirect', url: session.url };
}

/** One Stripe product and its prices, as the packs screen needs them (§21). */
export interface StripeProduct {
  id: string;
  name: string;
  active: boolean;
  prices: { id: string; amount: number | null; currency: string; interval: string }[];
}

export type ProductListResult =
  | { status: 'ok'; products: StripeProduct[] }
  | { status: 'stub'; reason: string };

/**
 * Lists the active products and their prices, so a pack can be matched to the
 * product that bills it.
 *
 * Reading Stripe never writes a composition: which modules a pack opens is ours,
 * and no external read may rewrite it. A resync only refreshes names and amounts.
 */
export async function listStripeProducts(): Promise<ProductListResult> {
  if (!stripeConfigured()) {
    return { status: 'stub', reason: 'STRIPE_SECRET_KEY absent — aucun produit lu depuis Stripe.' };
  }

  const client = stripe();
  // 100 is the page maximum. autoPagingToArray needs a bound, and a catalogue past
  // 100 products means someone should be filtering, not scrolling.
  const products = await client.products.list({ active: true, limit: 100 });
  const prices = await client.prices.list({ active: true, limit: 100 });

  const byProduct = new Map<string, StripeProduct['prices']>();
  for (const price of prices.data) {
    const productId = typeof price.product === 'string' ? price.product : price.product.id;
    const list = byProduct.get(productId) ?? [];
    list.push({
      id: price.id,
      amount: price.unit_amount,
      currency: price.currency,
      // A one-off price has no recurrence; naming it `one_time` keeps the same
      // vocabulary as tfb_pack_prices.interval instead of leaving a null to read.
      interval: price.recurring?.interval ?? 'one_time',
    });
    byProduct.set(productId, list);
  }

  return {
    status: 'ok',
    products: products.data.map((p) => ({
      id: p.id,
      name: p.name,
      active: p.active,
      prices: byProduct.get(p.id) ?? [],
    })),
  };
}

export interface AccountInfo {
  id: string;
  name: string | null;
  chargesEnabled: boolean;
}

/** Who the key belongs to — the only way to be sure which account is being billed. */
export async function getStripeAccount(): Promise<AccountInfo | { error: string } | null> {
  if (!stripeConfigured()) return null;
  try {
    // `null`, not an id: the SDK reads that as "the account this key belongs to",
    // which is exactly the question. Passing an id would query a Connect account.
    const account = await stripe().accounts.retrieve(null);
    return {
      id: account.id,
      name: account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null,
      chargesEnabled: account.charges_enabled === true,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Compte injoignable.' };
  }
}

/** Stripe subscription statuses mapped onto tfb_subscriptions.status. */
export const SUBSCRIPTION_STATUSES = [
  'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused',
] as const;
