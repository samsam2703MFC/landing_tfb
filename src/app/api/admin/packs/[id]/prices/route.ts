import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest, notFound, intParam } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

const INTERVALS = ['month', 'year', 'one_time'] as const;

interface PriceInput {
  stripePriceId?: string;
  amount?: number | null;
  currency?: string;
  interval?: string;
  isDefault?: boolean;
}

/**
 * PUT /api/admin/packs/:id/prices — the pack's billing variants (§21.2).
 *
 * Monthly, yearly and one-off are three prices of one Stripe product, not three
 * packs. The list replaces what is stored.
 *
 * `amount` is in cents; NULL means "sur devis", which routes to the contact form
 * and never to Checkout.
 */
export async function PUT(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const id = intParam((await c.params).id);
    if (!id) return badRequest('Identifiant invalide.');

    const body = await readJson<{ prices?: unknown }>(request);
    if (!Array.isArray(body?.prices)) return badRequest('prices doit être un tableau.');
    const input = body.prices as PriceInput[];

    const pack = await prisma.pack.findUnique({ where: { id } });
    if (!pack) return notFound('Pack introuvable.');

    const seen = new Set<string>();
    for (const [i, p] of input.entries()) {
      const priceId = p.stripePriceId?.trim() ?? '';
      if (!priceId) return badRequest(`prices[${i}].stripePriceId est obligatoire.`);
      if (seen.has(priceId)) return badRequest(`prices[${i}].stripePriceId « ${priceId} » est en double.`);
      seen.add(priceId);
      if (!(INTERVALS as readonly string[]).includes(p.interval ?? '')) {
        return badRequest(`prices[${i}].interval doit être : ${INTERVALS.join(', ')}.`);
      }
      if (p.amount != null && (!Number.isInteger(p.amount) || p.amount < 0)) {
        return badRequest(`prices[${i}].amount doit être un entier de centimes, ou null pour « sur devis ».`);
      }
    }

    // A Stripe price belongs to exactly one product, so it belongs to exactly one
    // pack. Claiming another pack's price would make the two disagree about what
    // a payment bought.
    const taken = await prisma.packPrice.findMany({
      where: { stripePriceId: { in: [...seen] }, packId: { not: id } },
      select: { stripePriceId: true, pack: { select: { key: true } } },
    });
    if (taken.length > 0) {
      const list = taken.map((t) => `${t.stripePriceId} → « ${t.pack.key} »`).join(', ');
      return badRequest(`Prix Stripe déjà rattaché(s) à un autre pack : ${list}.`);
    }

    const defaults = input.filter((p) => p.isDefault).length;
    if (defaults > 1) return badRequest('Un seul prix peut être marqué par défaut.');

    await prisma.$transaction([
      prisma.packPrice.deleteMany({ where: { packId: id, stripePriceId: { notIn: [...seen] } } }),
      ...input.map((p) =>
        prisma.packPrice.upsert({
          where: { stripePriceId: p.stripePriceId!.trim() },
          create: {
            packId: id,
            stripePriceId: p.stripePriceId!.trim(),
            amount: p.amount ?? null,
            currency: p.currency || 'EUR',
            interval: p.interval!,
            isDefault: Boolean(p.isDefault),
          },
          update: {
            amount: p.amount ?? null,
            currency: p.currency || 'EUR',
            interval: p.interval!,
            isDefault: Boolean(p.isDefault),
          },
        }),
      ),
    ]);

    const prices = await prisma.packPrice.findMany({
      where: { packId: id },
      orderBy: [{ isDefault: 'desc' }, { amount: 'asc' }],
    });
    return NextResponse.json({ prices });
  })(request, ctx);
}
