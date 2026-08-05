import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest, notFound, intParam } from '@/lib/api';
import { getBillingSnapshot } from '@/lib/billing/client';
import { getModuleCatalogue } from '@/lib/licensing/queries';

type Ctx = { params: Promise<{ id: string }> };

const KINDS = ['subscription', 'one_time', 'addon', 'free'] as const;

/** GET /api/admin/packs/:id — the pack, its prices, its composition, its licences. */
export async function GET(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const id = intParam((await c.params).id);
    if (!id) return badRequest('Identifiant invalide.');

    const pack = await prisma.pack.findUnique({
      where: { id },
      include: {
        prices: { orderBy: [{ isDefault: 'desc' }, { amount: 'asc' }] },
        modules: { select: { moduleId: true } },
      },
    });
    if (!pack) return notFound('Pack introuvable.');

    const [catalogue, billing] = await Promise.all([getModuleCatalogue(), getBillingSnapshot()]);
    const selected = new Set(pack.modules.map((m) => m.moduleId));

    return NextResponse.json({
      pack: {
        id: pack.id,
        key: pack.key,
        stripeProductId: pack.stripeProductId,
        kind: pack.kind,
        icon: pack.icon,
        isActive: pack.isActive,
        isFeatured: pack.isFeatured,
        sortOrder: pack.sortOrder,
        prices: pack.prices,
        moduleIds: [...selected],
      },
      catalogue,
      licenseCount: billing.licenses.filter((l) => l.package === pack.key).length,
      fixture: billing.fixture,
    });
  })(request, ctx);
}

/**
 * PATCH /api/admin/packs/:id
 *
 * `key` is absent from the body on purpose: it is what a licence's package code
 * matches on, so renaming it would silently detach every licence from its modules.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const id = intParam((await c.params).id);
    if (!id) return badRequest('Identifiant invalide.');

    const body = await readJson<{
      stripeProductId?: string | null; kind?: string; icon?: string | null;
      isActive?: boolean; isFeatured?: boolean; sortOrder?: number;
    }>(request);
    if (!body) return badRequest('Corps de requête invalide.');

    if (body.kind !== undefined && !(KINDS as readonly string[]).includes(body.kind)) {
      return badRequest(`kind doit être : ${KINDS.join(', ')}.`);
    }

    const pack = await prisma.pack.findUnique({ where: { id }, include: { prices: true } });
    if (!pack) return notFound('Pack introuvable.');

    if (body.stripeProductId) {
      const clash = await prisma.pack.findUnique({ where: { stripeProductId: body.stripeProductId } });
      if (clash && clash.id !== id) {
        return badRequest(`Le produit Stripe ${body.stripeProductId} est déjà rattaché à « ${clash.key} ».`);
      }
    }

    // Activating a pack that cannot be paid for would put an unsellable offer on
    // the landing. Refuse it here rather than let the pricing grid discover it.
    // A free pack bills nothing, so it needs no product; every other kind does.
    if (body.isActive === true && (body.kind ?? pack.kind) !== 'free') {
      const productId = body.stripeProductId === undefined ? pack.stripeProductId : body.stripeProductId;
      if (!productId) return badRequest('Rattachez un produit Stripe avant d’activer ce pack.');
      if (pack.prices.length === 0) return badRequest('Ce pack n’a aucun prix Stripe — il ne peut pas être activé.');
    }

    const updated = await prisma.pack.update({
      where: { id },
      data: {
        ...(body.stripeProductId !== undefined ? { stripeProductId: body.stripeProductId } : {}),
        ...(body.kind !== undefined ? { kind: body.kind } : {}),
        ...(body.icon !== undefined ? { icon: body.icon } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });
    return NextResponse.json({ pack: updated });
  })(request, ctx);
}

/**
 * DELETE /api/admin/packs/:id
 *
 * Refused while the billing service reports licences on this pack's key. Deleting
 * it would drop the composition those licences resolve through, and every store on
 * it would lose its modules with nothing left to explain why.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const id = intParam((await c.params).id);
    if (!id) return badRequest('Identifiant invalide.');

    const pack = await prisma.pack.findUnique({ where: { id } });
    if (!pack) return notFound('Pack introuvable.');

    const billing = await getBillingSnapshot();
    const inUse = billing.licenses.filter((l) => l.package === pack.key).length;
    if (inUse > 0) {
      return badRequest(
        `${inUse} licence(s) utilisent « ${pack.key} ». Désactivez le pack au lieu de le supprimer.`,
      );
    }

    // Prices and composition cascade on the FK; the derogations do not point here.
    await prisma.pack.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  })(request, ctx);
}
