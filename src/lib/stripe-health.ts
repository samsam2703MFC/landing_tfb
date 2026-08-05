import { prisma } from '@/lib/prisma';
import {
  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
  getStripeAccount, listStripeProducts, stripeConfigured, stripeMode,
  type StripeProduct,
} from '@/lib/stripe';

/**
 * Everything /admin/stripe needs to answer one question: does Stripe work?
 *
 * The screen exists because the failure modes are all silent. A missing webhook
 * secret means no payment ever creates a subscription, and nothing anywhere says
 * so — the checkout still redirects, the customer still pays, and the row is never
 * written. Reading a config file does not tell you that; this does.
 */

export interface KeyState {
  name: string;
  purpose: string;
  /** Masked, never the value: this renders in a browser. */
  hint: string | null;
  present: boolean;
}

export interface ProductMatch {
  product: StripeProduct;
  /** The pack carrying this product's id, if any. */
  packKey: string | null;
}

export interface StripeHealth {
  configured: boolean;
  mode: 'test' | 'live' | 'unknown';
  keys: KeyState[];
  account: { id: string; name: string | null; chargesEnabled: boolean } | null;
  accountError: string | null;
  /** Null when Stripe could not be read at all — distinct from "no products". */
  products: ProductMatch[] | null;
  productsReason: string | null;
  /** Packs holding a product id that Stripe did not return. */
  orphanPacks: { key: string; stripeProductId: string }[];
  events: {
    id: number;
    stripeEventId: string;
    type: string;
    outcome: string;
    detail: string | null;
    receivedAt: Date;
  }[];
  eventCounts: { total24h: number; failed24h: number; duplicates24h: number };
  activeSubscriptions: number;
}

/** First eight characters and the last four — enough to tell two keys apart. */
function hint(value: string): string | null {
  if (!value) return null;
  return value.length <= 14 ? '•'.repeat(value.length) : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export async function getStripeHealth(): Promise<StripeHealth> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [account, productList, packs, events, total24h, failed24h, duplicates24h, activeSubscriptions] =
    await Promise.all([
      getStripeAccount(),
      listStripeProducts(),
      prisma.pack.findMany({
        where: { stripeProductId: { not: null } },
        select: { key: true, stripeProductId: true },
      }),
      prisma.stripeEvent.findMany({ orderBy: { receivedAt: 'desc' }, take: 25 }),
      prisma.stripeEvent.count({ where: { receivedAt: { gte: since } } }),
      prisma.stripeEvent.count({ where: { receivedAt: { gte: since }, outcome: 'failed' } }),
      prisma.stripeEvent.count({ where: { receivedAt: { gte: since }, outcome: 'skipped' } }),
      prisma.subscription.count({ where: { status: { in: ['active', 'trialing'] } } }),
    ]);

  const packByProduct = new Map(packs.map((p) => [p.stripeProductId!, p.key]));

  const products = productList.status === 'ok'
    ? productList.products.map((product) => ({ product, packKey: packByProduct.get(product.id) ?? null }))
    : null;

  // A pack pointing at a product Stripe does not return: reported, never
  // deactivated on the strength of one read that may simply have been filtered.
  const returned = new Set(productList.status === 'ok' ? productList.products.map((p) => p.id) : []);
  const orphanPacks = productList.status === 'ok'
    ? packs.filter((p) => !returned.has(p.stripeProductId!)).map((p) => ({ key: p.key, stripeProductId: p.stripeProductId! }))
    : [];

  return {
    configured: stripeConfigured(),
    mode: stripeMode(),
    keys: [
      {
        name: 'STRIPE_SECRET_KEY',
        purpose: 'Checkout, portail client, lecture des produits',
        hint: hint(STRIPE_SECRET_KEY),
        present: STRIPE_SECRET_KEY.length > 0,
      },
      {
        name: 'STRIPE_WEBHOOK_SECRET',
        purpose: 'Vérification de signature des appels entrants',
        hint: hint(STRIPE_WEBHOOK_SECRET),
        present: STRIPE_WEBHOOK_SECRET.length > 0,
      },
    ],
    account: account && !('error' in account) ? account : null,
    accountError: account && 'error' in account ? account.error : null,
    products,
    productsReason: productList.status === 'stub' ? productList.reason : null,
    orphanPacks,
    events,
    eventCounts: { total24h, failed24h, duplicates24h },
    activeSubscriptions,
  };
}
