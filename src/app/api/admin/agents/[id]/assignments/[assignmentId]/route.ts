import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest, notFound, intParam } from '@/lib/api';

type Ctx = { params: Promise<{ id: string; assignmentId: string }> };

/**
 * PATCH /api/admin/agents/:id/assignments/:assignmentId
 *
 * Changing the plan changes **future** calculations. Commissions already settled
 * keep the rate that was applied — which is why settling takes a snapshot rather
 * than recomputing from the plan of the day.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const { id, assignmentId: rawId } = await c.params;
    const agentId = intParam(id);
    const assignmentId = intParam(rawId);
    if (!agentId || !assignmentId) return badRequest('Identifiant invalide.');

    const body = await readJson<{ planId?: number | null; packKey?: string | null; endedAt?: string | null; note?: string }>(request);
    if (!body) return badRequest('Corps de requête invalide.');

    // Matched on both ids, so an assignment cannot be edited through another agent.
    const existing = await prisma.agentAssignment.findFirst({ where: { id: assignmentId, agentId } });
    if (!existing) return notFound('Attribution introuvable.');

    let endedAt: Date | null | undefined;
    if (body.endedAt !== undefined) {
      if (body.endedAt === null) endedAt = null;
      else {
        const parsed = new Date(body.endedAt);
        if (Number.isNaN(parsed.getTime())) return badRequest('endedAt doit être une date valide.');
        if (parsed < existing.startedAt) return badRequest('endedAt ne peut pas précéder le début de l’attribution.');
        endedAt = parsed;
      }
    }

    if (body.planId != null) {
      const plan = await prisma.commissionPlan.findUnique({ where: { id: body.planId } });
      if (!plan) return notFound('Plan de commission introuvable.');
    }

    const assignment = await prisma.agentAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(body.planId !== undefined ? { planId: body.planId } : {}),
        ...(body.packKey !== undefined ? { packKey: body.packKey } : {}),
        ...(endedAt !== undefined ? { endedAt } : {}),
        ...(body.note !== undefined ? { note: body.note?.slice(0, 255) ?? null } : {}),
      },
    });
    return NextResponse.json({ assignment });
  })(request, ctx);
}

/**
 * DELETE — only an assignment that never earned anything.
 *
 * An assignment that has run is closed with `endedAt`, never removed: it is the
 * only record of why an agent was paid.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const { id, assignmentId: rawId } = await c.params;
    const agentId = intParam(id);
    const assignmentId = intParam(rawId);
    if (!agentId || !assignmentId) return badRequest('Identifiant invalide.');

    const existing = await prisma.agentAssignment.findFirst({ where: { id: assignmentId, agentId } });
    if (!existing) return notFound('Attribution introuvable.');

    await prisma.agentAssignment.delete({ where: { id: assignmentId } });
    return NextResponse.json({ ok: true });
  })(request, ctx);
}
