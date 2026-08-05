import type { LicenseStatus } from '@/lib/billing/types';

/**
 * Which modules a licence actually opens (§21).
 *
 * The chain is: Stripe product (the pack) → price → subscription → licence →
 * modules. This file is the last link, and the only one that decides. Every
 * server route that guards a module must go through `isModuleOpen`, because
 * hiding a menu protects nothing — the check has to happen where the data is.
 *
 * Three inputs, in order of authority:
 *
 *   1. the licence status, which Stripe owns through the webhook;
 *   2. the pack composition, which we own;
 *   3. the derogations, which a human wrote and which the webhook must not undo.
 */

/**
 * The only two states that open anything.
 *
 * `past_due` is deliberately absent: an unpaid licence closes its modules. There
 * is no grace period here, and adding one is a product decision that belongs in
 * this constant, not scattered across call sites.
 */
export const OPEN_STATUSES: readonly LicenseStatus[] = ['active', 'trialing'];

export interface OverrideRow {
  id: number;
  moduleId: number;
  grant: boolean;
  reason: string;
  expiresAt: Date | string | null;
  createdBy: string;
  createdAt: Date | string;
  revokedAt: Date | string | null;
}

export interface ModuleRef {
  id: number;
  key: string;
}

/** Why a module ended up open or closed. Rendered as-is in the console. */
export type ModuleSource = 'pack' | 'override' | 'status';

export interface ResolvedModule {
  moduleId: number;
  key: string;
  open: boolean;
  source: ModuleSource;
  /** Present when an override or the licence status decided it. */
  reason?: string;
  overrideId?: number;
}

export interface ResolveInput {
  status: LicenseStatus;
  /** Modules the pack opens. */
  packModules: ModuleRef[];
  /** Every override row for this licence, revoked ones included. */
  overrides: OverrideRow[];
  /** Modules an override can name that the pack does not include. */
  catalogue: ModuleRef[];
  /** Injected so a resolution is reproducible in tests. */
  now?: Date;
}

function asDate(value: Date | string | null): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

/**
 * The derogations in force, one per module: the most recent row that is neither
 * revoked nor expired.
 *
 * MySQL cannot express "at most one live row per (licence, module)" as a partial
 * unique index, so the rule lives here instead — and the older rows stay in the
 * table as the audit trail rather than being overwritten.
 */
export function effectiveOverrides(overrides: OverrideRow[], now: Date): Map<number, OverrideRow> {
  const live = overrides
    .filter((o) => asDate(o.revokedAt) == null)
    .filter((o) => {
      const expires = asDate(o.expiresAt);
      return expires == null || expires.getTime() > now.getTime();
    })
    .sort((a, b) => {
      const delta = asDate(a.createdAt)!.getTime() - asDate(b.createdAt)!.getTime();
      return delta !== 0 ? delta : a.id - b.id;
    });

  // Sorted oldest-first, so the last write for a module wins.
  const byModule = new Map<number, OverrideRow>();
  for (const o of live) byModule.set(o.moduleId, o);
  return byModule;
}

/**
 * Resolves one licence into the modules it opens and the ones it does not.
 *
 * A licence outside OPEN_STATUSES closes everything the pack gave it — but a
 * derogation that opens a module still applies. That is the point of a
 * derogation: someone decided, in writing, that this module stays open, and an
 * unpaid invoice does not silently overrule them. The console shows both facts
 * side by side so the situation is legible rather than surprising.
 */
export function resolveLicenseModules(input: ResolveInput): ResolvedModule[] {
  const now = input.now ?? new Date();
  const live = effectiveOverrides(input.overrides, now);
  const statusOpens = OPEN_STATUSES.includes(input.status);

  const byId = new Map<number, ModuleRef>();
  for (const m of input.catalogue) byId.set(m.id, m);
  for (const m of input.packModules) byId.set(m.id, m);

  const inPack = new Set(input.packModules.map((m) => m.id));
  const touched = new Set<number>([...inPack, ...live.keys()]);

  const resolved: ResolvedModule[] = [];
  for (const moduleId of touched) {
    const ref = byId.get(moduleId);
    if (!ref) continue; // A module deleted from the catalogue opens nothing.

    const override = live.get(moduleId);
    if (override) {
      resolved.push({
        moduleId,
        key: ref.key,
        open: override.grant,
        source: 'override',
        reason: override.reason,
        overrideId: override.id,
      });
      continue;
    }

    resolved.push({
      moduleId,
      key: ref.key,
      open: statusOpens,
      source: statusOpens ? 'pack' : 'status',
      ...(statusOpens ? {} : { reason: `Licence ${input.status}` }),
    });
  }

  return resolved.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * The guard every protected route calls. Defaults to closed: an unknown module,
 * an unknown licence or a resolution that produced nothing are all "no".
 */
export function isModuleOpen(resolved: ResolvedModule[], moduleKey: string): boolean {
  return resolved.some((r) => r.key === moduleKey && r.open);
}
