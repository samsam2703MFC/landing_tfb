import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest } from '@/lib/api';
import { normaliseTiers, type TierInput } from '@/lib/commercial/plans';

/**
 * Commission plans — a negotiated split, named and reusable (§17).
 *
 * "30 %" and "90 % the first year then 20 %" are both plans; they differ only in
 * how many tiers they hold. Naming the deal instead of typing a percentage on
 * each client is what makes a renegotiation one edit rather than a search across
 * rows — and what lets anyone say later which deal an agent was actually on.
 */

const KEY_RE = /^[a-z0-9][a-z0-9_-]*$/;

/** GET /api/admin/commission-plans — plans, their tiers, and how many agents use them. */
export const GET = withAdmin(async () => {
  const rows = await prisma.commissionPlan.findMany({
    orderBy: [{ isActive: 'desc' }, { key: 'asc' }],
    include: {
      tiers: { orderBy: { fromMonth: 'asc' } },
      _count: { select: { assignments: true } },
    },
  });

  const plans = rows.map((p) => ({
    id: p.id,
    key: p.key,
    label: p.label,
    isActive: p.isActive,
    tiers: p.tiers.map((t) => ({ id: t.id, fromMonth: t.fromMonth, percentBp: t.percentBp })),
    assignments: p._count.assignments,
    // A plan whose first tier starts after month 0 computes nothing for a new
    // client, and does so silently. Named here so it is visible before payout.
    coversMonthZero: p.tiers.some((t) => t.fromMonth === 0),
  }));

  return NextResponse.json({ plans });
});

/** POST /api/admin/commission-plans — the plan and its tiers, in one write. */
export async function POST(request: Request) {
  return withAdmin(async () => {
    const body = await readJson<{ key?: string; label?: string; tiers?: TierInput[] }>(request);

    const key = body?.key?.trim() ?? '';
    if (!key) return badRequest('key est obligatoire.');
    if (!KEY_RE.test(key)) return badRequest('key doit être en minuscules ([a-z0-9_-]).');

    const label = body?.label?.trim() || key;

    const result = normaliseTiers(body?.tiers ?? []);
    if ('error' in result) return badRequest(result.error);

    const clash = await prisma.commissionPlan.findUnique({ where: { key } });
    if (clash) return badRequest(`Le plan « ${key} » existe déjà.`);

    const plan = await prisma.commissionPlan.create({
      data: { key, label, tiers: { create: result.tiers } },
      include: { tiers: { orderBy: { fromMonth: 'asc' } } },
    });
    return NextResponse.json({ plan }, { status: 201 });
  })(request, undefined);
}
