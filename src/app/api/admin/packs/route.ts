import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest } from '@/lib/api';
import { getBillingSnapshot } from '@/lib/billing/client';
import { getPacks, countLicensesByPackage } from '@/lib/licensing/queries';

/**
 * Packs — the Stripe products the SaaS sells, and the modules each one opens (§21).
 *
 * Note the two neighbouring namespaces: `/api/admin/billing/*` delegates to the
 * billing service, which owns licences. `/api/admin/packs/*` and
 * `/api/admin/licenses/*` are ours — the catalogue and its derogations.
 */

const KEY_RE = /^[a-z0-9][a-z0-9_-]*$/;
const KINDS = ['subscription', 'one_time', 'addon', 'free'] as const;

/** GET /api/admin/packs — packs, prices, composition, and their licence counts. */
export const GET = withAdmin(async () => {
  const billing = await getBillingSnapshot();
  const packs = await getPacks(countLicensesByPackage(billing.licenses));
  return NextResponse.json({ packs, fixture: billing.fixture });
});

/**
 * POST /api/admin/packs
 *
 * Created inactive, with no modules. A pack that opened something the moment it
 * was created would be a pack nobody reviewed.
 *
 * `key` must equal the billing service's package `code` — that equality is the
 * only join between a licence and the modules it opens.
 */
export async function POST(request: Request) {
  return withAdmin(async () => {
    const body = await readJson<{
      key?: string; stripeProductId?: string | null; kind?: string; icon?: string; sortOrder?: number;
    }>(request);

    const key = body?.key?.trim() ?? '';
    if (!key) return badRequest('key est obligatoire.');
    if (!KEY_RE.test(key)) return badRequest('key doit être en minuscules ([a-z0-9_-]).');

    const kind = body?.kind ?? 'subscription';
    if (!(KINDS as readonly string[]).includes(kind)) {
      return badRequest(`kind doit être : ${KINDS.join(', ')}.`);
    }

    const clash = await prisma.pack.findUnique({ where: { key } });
    if (clash) return badRequest(`Le pack « ${key} » existe déjà.`);

    if (body?.stripeProductId) {
      const productClash = await prisma.pack.findUnique({ where: { stripeProductId: body.stripeProductId } });
      if (productClash) {
        return badRequest(`Le produit Stripe ${body.stripeProductId} est déjà rattaché à « ${productClash.key} ».`);
      }
    }

    const pack = await prisma.pack.create({
      data: {
        key,
        stripeProductId: body?.stripeProductId || null,
        kind,
        icon: body?.icon || 'tag',
        isActive: false,
        sortOrder: body?.sortOrder ?? 0,
      },
    });
    return NextResponse.json({ pack }, { status: 201 });
  })(request, undefined);
}
