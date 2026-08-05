import { prisma } from '@/lib/prisma';
import { getBillingSnapshot, billingConfigured } from '@/lib/billing/client';
import type { Invoice, Tenant } from '@/lib/billing/types';
import { commissionFor, type Assignment, type Commission } from './commission';

/**
 * Reads for the agents screens (§17).
 *
 * Invoices come from the billing service, which owns them. When that service is
 * unreachable the console falls back to the fixture snapshot and says so — and
 * `fixture` travels all the way to the screen for one reason: **no commission may
 * be settled against invented figures.** Displaying them is a demo; exporting them
 * is a payment someone is owed on numbers nobody issued.
 */

export interface AgentRow {
  id: number;
  name: string;
  email: string;
  kind: string;
  isActive: boolean;
  clients: number;
  planKeys: string[];
  /** Assignments with no plan: they compute nothing, silently, unless named. */
  withoutPlan: number;
  /** Sum of what is computable right now, in cents. */
  totalCents: number;
}

export interface CommissionLine extends Commission {
  invoice: Invoice;
  tenantSlug: string;
  packKey: string | null;
}

export interface AgentDetail {
  agent: { id: number; name: string; email: string; kind: string; isActive: boolean; createdAt: Date };
  assignments: {
    id: number;
    tenantSlug: string;
    tenantName: string;
    packKey: string | null;
    planKey: string | null;
    planLabel: string | null;
    tiers: { fromMonth: number; percentBp: number }[];
    startedAt: Date;
    endedAt: Date | null;
  }[];
  lines: CommissionLine[];
  totalCents: number;
  fixture: boolean;
  /** True when figures may be settled — never on fixtures. */
  settleable: boolean;
}

export interface PlanOption {
  id: number;
  key: string;
  label: string;
  isActive: boolean;
  tiers: { fromMonth: number; percentBp: number }[];
  assignments: number;
  /** A plan whose ladder starts after month 0 pays nothing to a new client. */
  coversMonthZero: boolean;
}

export async function listPlans(): Promise<PlanOption[]> {
  const rows = await prisma.commissionPlan.findMany({
    orderBy: [{ isActive: 'desc' }, { key: 'asc' }],
    include: { tiers: { orderBy: { fromMonth: 'asc' } }, _count: { select: { assignments: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    key: p.key,
    label: p.label,
    isActive: p.isActive,
    tiers: p.tiers.map((t) => ({ fromMonth: t.fromMonth, percentBp: t.percentBp })),
    assignments: p._count.assignments,
    coversMonthZero: p.tiers.some((t) => t.fromMonth === 0),
  }));
}

/** Tenants offered when handing a client to an agent, with who holds them today. */
export async function listAssignableTenants(): Promise<{ slug: string; name: string; heldBy: string | null }[]> {
  const [billing, open] = await Promise.all([
    getBillingSnapshot(),
    prisma.agentAssignment.findMany({ where: { endedAt: null }, include: { agent: { select: { name: true } } } }),
  ]);
  const holder = new Map(open.map((a) => [a.tenantSlug, a.agent.name]));
  return billing.tenants
    .filter((t) => !t.archived_at)
    .map((t) => ({ slug: t.slug, name: t.name, heldBy: holder.get(t.slug) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function toAssignment(row: {
  id: number; agentId: number; tenantSlug: string; packKey: string | null;
  startedAt: Date; endedAt: Date | null;
  plan: { key: string; tiers: { fromMonth: number; percentBp: number }[] } | null;
}): Assignment {
  return {
    id: row.id,
    agentId: row.agentId,
    tenantSlug: row.tenantSlug,
    packKey: row.packKey,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    planKey: row.plan?.key ?? null,
    tiers: row.plan?.tiers ?? [],
  };
}

/** Invoices for a tenant, matched by the billing service's display name. */
function invoicesFor(invoices: Invoice[], tenant: Tenant | undefined): Invoice[] {
  if (!tenant) return [];
  return invoices.filter((i) => i.tenant === tenant.name);
}

export async function listAgents(): Promise<{ agents: AgentRow[]; fixture: boolean }> {
  const [rows, billing] = await Promise.all([
    prisma.agent.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { assignments: { include: { plan: { include: { tiers: true } } } } },
    }),
    getBillingSnapshot(),
  ]);

  const bySlug = new Map(billing.tenants.map((t) => [t.slug, t]));

  const agents = rows.map((agent) => {
    let totalCents = 0;
    for (const raw of agent.assignments) {
      const assignment = toAssignment({ ...raw, agentId: agent.id });
      for (const invoice of invoicesFor(billing.invoices, bySlug.get(raw.tenantSlug))) {
        const line = commissionFor(assignment, invoice);
        if (line.reason === 'ok' && line.amount != null) totalCents += line.amount;
      }
    }

    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      kind: agent.kind,
      isActive: agent.isActive,
      clients: new Set(agent.assignments.filter((a) => a.endedAt == null).map((a) => a.tenantSlug)).size,
      planKeys: [...new Set(agent.assignments.map((a) => a.plan?.key).filter((k): k is string => Boolean(k)))],
      withoutPlan: agent.assignments.filter((a) => a.endedAt == null && a.planId == null).length,
      totalCents,
    };
  });

  return { agents, fixture: billing.fixture };
}

export async function getAgent(id: number): Promise<AgentDetail | null> {
  const [agent, billing] = await Promise.all([
    prisma.agent.findUnique({
      where: { id },
      include: {
        assignments: {
          orderBy: { startedAt: 'desc' },
          include: { plan: { include: { tiers: { orderBy: { fromMonth: 'asc' } } } } },
        },
      },
    }),
    getBillingSnapshot(),
  ]);
  if (!agent) return null;

  const bySlug = new Map(billing.tenants.map((t) => [t.slug, t]));
  const lines: CommissionLine[] = [];
  let totalCents = 0;

  for (const raw of agent.assignments) {
    const assignment = toAssignment({ ...raw, agentId: agent.id });
    const tenant = bySlug.get(raw.tenantSlug);
    for (const invoice of invoicesFor(billing.invoices, tenant)) {
      // A pack-scoped assignment only earns on that pack. The billing service's
      // invoices do not carry a pack, so the restriction cannot be honoured yet:
      // reported here rather than applied wrongly.
      const line = commissionFor(assignment, invoice);
      lines.push({ ...line, invoice, tenantSlug: raw.tenantSlug, packKey: raw.packKey });
      if (line.reason === 'ok' && line.amount != null) totalCents += line.amount;
    }
  }

  return {
    agent: {
      id: agent.id, name: agent.name, email: agent.email,
      kind: agent.kind, isActive: agent.isActive, createdAt: agent.createdAt,
    },
    assignments: agent.assignments.map((a) => ({
      id: a.id,
      tenantSlug: a.tenantSlug,
      tenantName: bySlug.get(a.tenantSlug)?.name ?? a.tenantSlug,
      packKey: a.packKey,
      planKey: a.plan?.key ?? null,
      planLabel: a.plan?.label ?? null,
      tiers: a.plan?.tiers.map((t) => ({ fromMonth: t.fromMonth, percentBp: t.percentBp })) ?? [],
      startedAt: a.startedAt,
      endedAt: a.endedAt,
    })),
    lines: lines.sort((a, b) => a.invoice.tenant.localeCompare(b.invoice.tenant)),
    totalCents,
    fixture: billing.fixture,
    settleable: billingConfigured() && !billing.fixture,
  };
}
