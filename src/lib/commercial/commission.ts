/**
 * What an agent is owed on an invoice (§17).
 *
 * Pure and dependency-free on purpose: this is the one place in the application
 * that turns someone's work into money, and it has to be readable and testable
 * without a database in the way.
 *
 * Four rules, and each exists because its opposite has a cost:
 *
 *  1. **Seniority is counted from the assignment**, not from the invoice or the
 *     client's own start date. A client handed to another agent restarts at the
 *     first tier with them and the previous assignment ends the same day —
 *     otherwise two agents earn on the same invoice.
 *  2. **Only a paid invoice earns anything.** Commission on an invoice that is
 *     never collected is a debt to the agent for money nobody received.
 *  3. **An unparsable period earns nothing, and says so.** The billing service
 *     reports a period as display text; a guessed date is wrong money.
 *  4. **No plan means no calculation, reported.** Not zero — zero looks like a
 *     decision, and this is an omission.
 */

/** Basis points, so nothing here is ever a float. 9000 = 90,00 %. */
export type BasisPoints = number;

export interface Tier {
  fromMonth: number;
  percentBp: BasisPoints;
}

export interface Assignment {
  id: number;
  agentId: number;
  tenantSlug: string;
  packKey: string | null;
  startedAt: Date;
  endedAt: Date | null;
  planKey: string | null;
  tiers: Tier[];
}

export interface InvoiceLike {
  id: string;
  tenant: string;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: string;
  /** Display text from the billing service, e.g. "01.07 — 31.07.2026". */
  period: string;
}

export type CommissionReason =
  | 'ok'
  | 'unpaid'
  | 'no_plan'
  | 'empty_plan'
  | 'no_tier'
  | 'unparsable_period'
  | 'outside_assignment';

export interface Commission {
  invoiceId: string;
  /** Null whenever `reason` is not 'ok'. Never 0 as a stand-in for "unknown". */
  amount: number | null;
  percentBp: BasisPoints | null;
  months: number | null;
  reason: CommissionReason;
}

/**
 * The end of an invoicing period, from the display text the billing service sends.
 *
 * Matches a trailing `DD.MM.YYYY` and nothing else. Anything looser would happily
 * read `01.07` as a date and compute a commission against a year that is not there.
 */
export function periodEnd(period: string): Date | null {
  const match = /(\d{2})\.(\d{2})\.(\d{4})\s*$/.exec(period.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  // Rejects 31.02: the constructor rolls over rather than failing.
  return date.getUTCMonth() === Number(month) - 1 ? date : null;
}

/** Whole months from `from` to `to`, never negative. */
export function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  const beforeAnniversary = to.getUTCDate() < from.getUTCDate();
  return Math.max(0, months - (beforeAnniversary ? 1 : 0));
}

/**
 * The tier in force at `months` — the highest `fromMonth` not above it.
 *
 * A plan whose first tier starts after month 0 leaves a gap, and a gap is
 * reported as `no_tier` rather than filled with the nearest rate: guessing here
 * pays someone a percentage nobody agreed to.
 */
export function tierFor(tiers: Tier[], months: number): Tier | null {
  return tiers
    .filter((t) => t.fromMonth <= months)
    .sort((a, b) => b.fromMonth - a.fromMonth)[0] ?? null;
}

/** Cents × basis points, rounded once, at the end. */
function apply(amountCents: number, percentBp: BasisPoints): number {
  return Math.round((amountCents * percentBp) / 10_000);
}

export function commissionFor(assignment: Assignment, invoice: InvoiceLike): Commission {
  const base = { invoiceId: invoice.id, amount: null, percentBp: null, months: null };

  if (invoice.status !== 'paid' || invoice.amount_paid <= 0) {
    return { ...base, reason: 'unpaid' };
  }

  const end = periodEnd(invoice.period);
  if (!end) return { ...base, reason: 'unparsable_period' };

  // An invoice for a period the agent did not hold is not theirs, even if the
  // client is theirs today.
  if (end < assignment.startedAt) return { ...base, reason: 'outside_assignment' };
  if (assignment.endedAt && end > assignment.endedAt) return { ...base, reason: 'outside_assignment' };

  if (!assignment.planKey) return { ...base, reason: 'no_plan' };
  if (assignment.tiers.length === 0) return { ...base, reason: 'empty_plan' };

  const months = monthsBetween(assignment.startedAt, end);
  const tier = tierFor(assignment.tiers, months);
  if (!tier) return { ...base, months, reason: 'no_tier' };

  // amount_paid is in units in the billing service's read model; cents here.
  const cents = Math.round(invoice.amount_paid * 100);
  return {
    invoiceId: invoice.id,
    amount: apply(cents, tier.percentBp),
    percentBp: tier.percentBp,
    months,
    reason: 'ok',
  };
}

/** French one-liners, so the screen and any export say the same thing. */
export const REASON_LABEL: Record<CommissionReason, string> = {
  ok: 'calculée',
  unpaid: 'facture non encaissée — la commission suit l’encaissement',
  no_plan: 'aucun plan sur cette attribution — rien n’est calculé',
  empty_plan: 'plan sans palier — rien n’est calculé',
  no_tier: 'aucun palier ne couvre cette ancienneté',
  unparsable_period: 'période illisible — aucune date fiable à comparer',
  outside_assignment: 'période hors de l’attribution',
};

/** 9000 → « 90 % », 1550 → « 15,5 % ». */
export function formatBp(percentBp: BasisPoints): string {
  const percent = percentBp / 100;
  return `${percent.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
}
