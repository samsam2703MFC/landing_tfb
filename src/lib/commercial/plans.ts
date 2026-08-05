/**
 * Validation shared by the two commission-plan routes (§17).
 *
 * It lives here rather than in the route file because a route module may only
 * export HTTP handlers — and because this is the rule, not the transport.
 */

export interface TierInput {
  fromMonth?: number;
  percentBp?: number;
}

export interface Tier {
  fromMonth: number;
  percentBp: number;
}

/**
 * Validates and orders the tiers of a plan.
 *
 * Rates are basis points capped at 100 %: a plan paying more than the invoice is
 * a data-entry slip, and the place it would otherwise be discovered is a payout.
 * Two tiers on the same month are refused rather than deduplicated — the ladder
 * would otherwise depend on row order.
 */
export function normaliseTiers(input: TierInput[]): { tiers: Tier[] } | { error: string } {
  const tiers: Tier[] = [];
  for (const raw of input) {
    const fromMonth = Number(raw?.fromMonth);
    const percentBp = Number(raw?.percentBp);
    if (!Number.isInteger(fromMonth) || fromMonth < 0) {
      return { error: 'fromMonth doit être un entier positif ou nul (0 = première année).' };
    }
    if (!Number.isInteger(percentBp) || percentBp < 0 || percentBp > 10_000) {
      return { error: 'percentBp doit être un entier entre 0 et 10000 (points de base, 9000 = 90 %).' };
    }
    if (tiers.some((t) => t.fromMonth === fromMonth)) {
      return { error: `Deux paliers commencent au mois ${fromMonth} — le calcul dépendrait de l’ordre des lignes.` };
    }
    tiers.push({ fromMonth, percentBp });
  }
  return { tiers: tiers.sort((a, b) => a.fromMonth - b.fromMonth) };
}
