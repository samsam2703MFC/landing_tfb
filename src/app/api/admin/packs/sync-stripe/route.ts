import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/api';
import { listStripeProducts, stripeConfigured } from '@/lib/stripe';

/**
 * POST /api/admin/packs/sync-stripe — refreshes prices from Stripe (§21.2).
 *
 * What it touches: the price rows of packs already attached to a Stripe product.
 * What it never touches: the composition. Stripe says what is paid; which modules
 * that opens is ours, and no external read may rewrite it.
 *
 * Answers `200 { status: 'stub' }` while Stripe is unconfigured, the same way
 * `/api/checkout` does, so the console can say why instead of implying a sync ran.
 */
export const POST = withAdmin(async () => {
  const result = await listStripeProducts();

  if (result.status === 'stub') {
    return NextResponse.json({ status: 'stub', reason: result.reason, configured: stripeConfigured() });
  }

  const packs = await prisma.pack.findMany({
    where: { stripeProductId: { not: null } },
    include: { prices: true },
  });
  const byProduct = new Map(result.products.map((p) => [p.id, p]));

  let updated = 0;
  const orphans: string[] = [];

  for (const pack of packs) {
    const product = byProduct.get(pack.stripeProductId!);
    if (!product) {
      // The product vanished from Stripe. Say so; do not deactivate the pack on
      // the strength of one read that may simply have been filtered.
      orphans.push(pack.key);
      continue;
    }

    for (const price of product.prices) {
      await prisma.packPrice.upsert({
        where: { stripePriceId: price.id },
        create: {
          packId: pack.id,
          stripePriceId: price.id,
          amount: price.amount,
          currency: price.currency.toUpperCase().slice(0, 3),
          interval: price.interval,
          isDefault: false,
        },
        update: {
          amount: price.amount,
          currency: price.currency.toUpperCase().slice(0, 3),
          interval: price.interval,
        },
      });
      updated += 1;
    }
  }

  return NextResponse.json({ status: 'ok', packs: packs.length, prices: updated, orphans });
});
