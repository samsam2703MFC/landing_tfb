import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest, notFound, intParam } from '@/lib/api';
import { getBillingSnapshot } from '@/lib/billing/client';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/agents/:id/assignments — hand a client to an agent (§17).
 *
 * `startedAt` is what seniority is counted from, so it decides the rate for
 * years. It defaults to today and can be back-dated deliberately, never
 * silently.
 *
 * Handing over a client that another agent still holds **ends the previous
 * assignment on the same day** rather than refusing or overlapping: two open
 * assignments on one client would pay two agents for the same invoice.
 */
export async function POST(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const agentId = intParam((await c.params).id);
    if (!agentId) return badRequest('Identifiant invalide.');

    const body = await readJson<{
      tenantSlug?: string; packKey?: string | null; planId?: number | null;
      startedAt?: string; note?: string;
    }>(request);

    const tenantSlug = body?.tenantSlug?.trim() ?? '';
    if (!tenantSlug) return badRequest('tenantSlug est obligatoire.');

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return notFound('Agent introuvable.');

    // The tenant belongs to the billing service; we check it exists rather than
    // storing a slug nobody can resolve.
    const billing = await getBillingSnapshot();
    if (!billing.tenants.some((t) => t.slug === tenantSlug)) {
      return badRequest(`Aucun tenant « ${tenantSlug} » côté service de facturation.`);
    }

    let startedAt = new Date();
    if (body?.startedAt) {
      const parsed = new Date(body.startedAt);
      if (Number.isNaN(parsed.getTime())) return badRequest('startedAt doit être une date valide.');
      startedAt = parsed;
    }

    if (body?.planId != null) {
      const plan = await prisma.commissionPlan.findUnique({ where: { id: body.planId } });
      if (!plan) return notFound('Plan de commission introuvable.');
    }

    const [, assignment] = await prisma.$transaction([
      prisma.agentAssignment.updateMany({
        where: { tenantSlug, endedAt: null, agentId: { not: agentId } },
        data: { endedAt: startedAt },
      }),
      prisma.agentAssignment.create({
        data: {
          agentId,
          tenantSlug,
          packKey: body?.packKey || null,
          planId: body?.planId ?? null,
          startedAt,
          note: body?.note?.slice(0, 255) || null,
        },
      }),
    ]);

    return NextResponse.json({ assignment }, { status: 201 });
  })(request, ctx);
}
