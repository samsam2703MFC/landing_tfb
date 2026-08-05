import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest, notFound, intParam } from '@/lib/api';
import { getAgent } from '@/lib/commercial/queries';

type Ctx = { params: Promise<{ id: string }> };

const KINDS = ['commercial', 'technique'] as const;

/** GET /api/admin/agents/:id — the agent, their assignments, their commissions. */
export async function GET(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const id = intParam((await c.params).id);
    if (!id) return badRequest('Identifiant invalide.');
    const detail = await getAgent(id);
    if (!detail) return notFound('Agent introuvable.');
    return NextResponse.json(detail);
  })(request, ctx);
}

/** PATCH /api/admin/agents/:id */
export async function PATCH(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const id = intParam((await c.params).id);
    if (!id) return badRequest('Identifiant invalide.');

    const body = await readJson<{ name?: string; kind?: string; isActive?: boolean }>(request);
    if (!body) return badRequest('Corps de requête invalide.');
    if (body.kind !== undefined && !(KINDS as readonly string[]).includes(body.kind)) {
      return badRequest(`kind doit être : ${KINDS.join(', ')}.`);
    }

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) return notFound('Agent introuvable.');

    const updated = await prisma.agent.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.kind !== undefined ? { kind: body.kind } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
    return NextResponse.json({ agent: updated });
  })(request, ctx);
}

/**
 * DELETE /api/admin/agents/:id
 *
 * Refused while assignments exist. Deleting would take the assignments with it —
 * and with them the only record of why commissions were paid.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const id = intParam((await c.params).id);
    if (!id) return badRequest('Identifiant invalide.');

    const agent = await prisma.agent.findUnique({ where: { id }, include: { _count: { select: { assignments: true } } } });
    if (!agent) return notFound('Agent introuvable.');
    if (agent._count.assignments > 0) {
      return badRequest(
        `${agent._count.assignments} attribution(s) sont rattachées à cet agent. Désactivez-le au lieu de le supprimer.`,
      );
    }

    await prisma.agent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  })(request, ctx);
}
