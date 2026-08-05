import { prisma } from '@/lib/prisma';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';
import type { License } from '@/lib/billing/types';
import { resolveLicenseModules, type ModuleRef, type OverrideRow, type ResolvedModule } from './resolve';

/**
 * Reads for the packs / licences screens (§7, §21).
 *
 * **The seam between the two systems**: the billing service names a licence's
 * package by its `code` (`sklep`, `admin`, `core`); we name a pack by its `key`.
 * Those two strings are the same value, and that equality is the whole join.
 * Nothing enforces it across the boundary, so a pack whose key matches no package
 * code simply opens nothing, and the console says so rather than guessing.
 */

export interface ModuleLabel extends ModuleRef {
  /** French label from tfb_translations, or the key when nothing is written yet. */
  name: string;
  icon: string | null;
  group: string | null;
  isActive: boolean;
}

export interface PackPriceView {
  id: number;
  stripePriceId: string;
  amount: number | null;
  currency: string;
  interval: string;
  isDefault: boolean;
}

export interface PackView {
  id: number;
  key: string;
  stripeProductId: string | null;
  kind: string;
  icon: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  prices: PackPriceView[];
  modules: ModuleLabel[];
  /** Licences the billing service reports against this pack's key. */
  licenseCount: number;
  /** True when the pack can actually be sold — §21.2. */
  sellable: boolean;
}

/** Every module in the catalogue, with its French label resolved. */
export async function getModuleCatalogue(): Promise<ModuleLabel[]> {
  const [modules, names] = await Promise.all([
    prisma.module.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.translation.findMany({
      where: { entityType: 'module', field: 'name', languageCode: DEFAULT_LOCALE },
      select: { entityId: true, value: true },
    }),
  ]);
  const byId = new Map(names.map((n) => [n.entityId, n.value]));
  return modules.map((m) => ({
    id: m.id,
    key: m.key,
    name: byId.get(m.id) ?? m.key,
    icon: m.icon,
    group: m.moduleGroup,
    isActive: m.isActive,
  }));
}

/**
 * The packs, with their prices and composition.
 *
 * `licenseCounts` comes from the caller because it belongs to the billing
 * service — this function does not reach across the boundary on its own.
 */
export async function getPacks(licenseCounts: Map<string, number> = new Map()): Promise<PackView[]> {
  const [packs, catalogue] = await Promise.all([
    prisma.pack.findMany({
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      include: {
        prices: { orderBy: [{ isDefault: 'desc' }, { amount: 'asc' }] },
        modules: { select: { moduleId: true } },
      },
    }),
    getModuleCatalogue(),
  ]);

  const byId = new Map(catalogue.map((m) => [m.id, m]));

  return packs.map((p) => ({
    id: p.id,
    key: p.key,
    stripeProductId: p.stripeProductId,
    kind: p.kind,
    icon: p.icon,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    sortOrder: p.sortOrder,
    prices: p.prices.map((price) => ({
      id: price.id,
      stripePriceId: price.stripePriceId,
      amount: price.amount,
      currency: price.currency,
      interval: price.interval,
      isDefault: price.isDefault,
    })),
    modules: p.modules.map((m) => byId.get(m.moduleId)).filter((m): m is ModuleLabel => Boolean(m)),
    licenseCount: licenseCounts.get(p.key) ?? 0,
    // A pack with no Stripe product cannot be paid for, so it cannot be sold —
    // whatever its is_active flag says. A free pack is the one exception: it
    // bills nothing, so it has nothing to attach.
    sellable: p.isActive && (p.kind === 'free' || (Boolean(p.stripeProductId) && p.prices.length > 0)),
  }));
}

export interface LicenseModules {
  license: License;
  /** The pack matching `license.package`, or null when no pack carries that key. */
  packKey: string;
  packFound: boolean;
  resolved: ResolvedModule[];
  open: ModuleLabel[];
  closed: ModuleLabel[];
  overrides: (OverrideRow & { module: ModuleLabel | null })[];
}

/**
 * Resolves a set of licences into the modules they open, applying the pack
 * composition and then the derogations in force.
 */
export async function resolveLicenses(licenses: License[]): Promise<LicenseModules[]> {
  if (licenses.length === 0) return [];

  const [catalogue, packs, overrideRows] = await Promise.all([
    getModuleCatalogue(),
    prisma.pack.findMany({ include: { modules: { select: { moduleId: true } } } }),
    prisma.licenseOverride.findMany({
      where: { licenseId: { in: licenses.map((l) => l.id) } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const byId = new Map(catalogue.map((m) => [m.id, m]));
  const packByKey = new Map(packs.map((p) => [p.key, p]));
  const overridesByLicense = new Map<string, OverrideRow[]>();
  for (const row of overrideRows) {
    const list = overridesByLicense.get(row.licenseId) ?? [];
    list.push(row);
    overridesByLicense.set(row.licenseId, list);
  }

  return licenses.map((license) => {
    const pack = packByKey.get(license.package);
    const packModules = (pack?.modules ?? [])
      .map((m) => byId.get(m.moduleId))
      .filter((m): m is ModuleLabel => Boolean(m));
    const overrides = overridesByLicense.get(license.id) ?? [];

    const resolved = resolveLicenseModules({
      status: license.status,
      packModules,
      overrides,
      catalogue,
    });

    return {
      license,
      packKey: license.package,
      packFound: Boolean(pack),
      resolved,
      open: resolved.filter((r) => r.open).map((r) => byId.get(r.moduleId)!).filter(Boolean),
      closed: resolved.filter((r) => !r.open).map((r) => byId.get(r.moduleId)!).filter(Boolean),
      overrides: overrides.map((o) => ({ ...o, module: byId.get(o.moduleId) ?? null })),
    };
  });
}

/** How many licences the billing service reports per package code. */
export function countLicensesByPackage(licenses: License[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const l of licenses) counts.set(l.package, (counts.get(l.package) ?? 0) + 1);
  return counts;
}
