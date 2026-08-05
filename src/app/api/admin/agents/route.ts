import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest } from '@/lib/api';
import { listAgents } from '@/lib/commercial/queries';

/** Agents B2B — who brings and supports clients, and on what split (§17). */

const KINDS = ['commercial', 'technique'] as const;

/** GET /api/admin/agents — agents with their client count and computable total. */
export const GET = withAdmin(async () => {
  const { agents, fixture } = await listAgents();
  return NextResponse.json({ agents, fixture });
});

/** POST /api/admin/agents */
export async function POST(request: Request) {
  return withAdmin(async () => {
    const body = await readJson<{ name?: string; email?: string; kind?: string }>(request);
    const name = body?.name?.trim() ?? '';
    const email = body?.email?.trim().toLowerCase() ?? '';
    if (!name || !email) return badRequest('name et email sont obligatoires.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return badRequest('Adresse e-mail invalide.');

    const kind = body?.kind ?? 'commercial';
    if (!(KINDS as readonly string[]).includes(kind)) return badRequest(`kind doit être : ${KINDS.join(', ')}.`);

    const clash = await prisma.agent.findUnique({ where: { email } });
    if (clash) return badRequest(`Un agent utilise déjà ${email}.`);

    const agent = await prisma.agent.create({ data: { name, email, kind } });
    return NextResponse.json({ agent }, { status: 201 });
  })(request, undefined);
}
