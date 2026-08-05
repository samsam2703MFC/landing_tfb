import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest, notFound, intParam } from '@/lib/api';
import { normaliseTiers, type TierInput } from '@/lib/commercial/plans';

type Ctx = { params: Promise<{ id: string }> };

/**
 * One commission plan (§17).
 *
 * Editing the tiers changes **future** calculations. Commissions already settled
 * keep the rate that was applied — which is why settling snapshots the amount
 * instead of recomputing it from the plan of the day. Without that, renegotiating
 * a split would silently rewrite what was paid last year.
 */

/** PATCH /api/admin/commission-plans/:id — label, activation, and/or the whole tier set. */
export async function PATCH(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const id = intParam((await c.params).id);
    if (!id) return badRequest('Identifiant invalide.');

    const body = await readJson<{ label?: string; isActive?: boolean; tiers?: TierInput[] }>(request);
    if (!body) return badRequest('Corps de requête invalide.');

    const existing = await prisma.commissionPlan.findUnique({ where: { id } });
    if (!existing) return notFound('Plan introuvable.');

    // Tiers are replaced wholesale rather than patched row by row: a plan is read
    // as one ladder, and a half-applied edit is a rate nobody agreed to.
    let replace: { fromMonth: number; percentBp: number }[] | null = null;
    if (body.tiers !== undefined) {
      const result = normaliseTiers(body.tiers);
      if ('error' in result) return badRequest(result.error);
      replace = result.tiers;
    }

    const plan = await prisma.$transaction(async (tx) => {
      if (replace) {
        await tx.commissionTier.deleteMany({ where: { planId: id } });
        if (replace.length > 0) {
          await tx.commissionTier.createMany({ data: replace.map((t) => ({ ...t, planId: id })) });
        }
      }
      return tx.commissionPlan.update({
        where: { id },
        data: {
          ...(body.label !== undefined ? { label: body.label.trim() || existing.label } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
        include: { tiers: { orderBy: { fromMonth: 'asc' } } },
      });
    });

    return NextResponse.json({ plan });
  })(request, ctx);
}

/**
 * DELETE /api/admin/commission-plans/:id
 *
 * Refused while assignments point at it. The foreign key is ON DELETE SET NULL,
 * so deleting would not fail — it would quietly leave those assignments plan-less
 * and stop paying their agents. Deactivate instead: an inactive plan keeps
 * honouring the assignments already on it and stops being offered for new ones.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const id = intParam((await c.params).id);
    if (!id) return badRequest('Identifiant invalide.');

    const plan = await prisma.commissionPlan.findUnique({
      where: { id },
      include: { _count: { select: { assignments: true } } },
    });
    if (!plan) return notFound('Plan introuvable.');
    if (plan._count.assignments > 0) {
      return badRequest(
        `${plan._count.assignments} attribution(s) utilisent ce plan. Désactivez-le au lieu de le supprimer : `
        + 'la suppression les laisserait sans plan, et sans commission.',
      );
    }

    await prisma.commissionPlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  })(request, ctx);
}
