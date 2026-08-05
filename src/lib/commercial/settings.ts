import { prisma } from '@/lib/prisma';

/**
 * §16 — the three reference lists behind a commercial offer: the stages of the
 * sales cycle, the services that can be sold with an offer, and the legal
 * entities that issue the invoice.
 *
 * They share a shape (key, label, order, activation) but not a meaning, so they
 * stay three tables. What they do share is one rule: **nothing is deleted while
 * it is referenced** — a stage or a service that disappears takes the reading of
 * past deals with it. Deactivation removes it from the pickers and leaves the
 * history legible.
 */

export const COLLECTIONS = ['stages', 'services', 'billing-entities'] as const;
export type Collection = (typeof COLLECTIONS)[number];

export function isCollection(value: string): value is Collection {
  return (COLLECTIONS as readonly string[]).includes(value);
}

export const KEY_RE = /^[a-z0-9][a-z0-9_-]*$/;

export interface CommercialSettings {
  stages: { id: number; key: string; label: string; isActive: boolean; sortOrder: number }[];
  services: { id: number; key: string; label: string; amount: number | null; currency: string; isActive: boolean; sortOrder: number }[];
  billingEntities: { id: number; key: string; name: string; vatNumber: string | null; address: string | null; isDefault: boolean; isActive: boolean }[];
}

export async function getCommercialSettings(): Promise<CommercialSettings> {
  const [stages, services, billingEntities] = await Promise.all([
    prisma.salesStage.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
    prisma.service.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
    prisma.billingEntity.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
  ]);

  return {
    stages: stages.map((s) => ({ id: s.id, key: s.key, label: s.label, isActive: s.isActive, sortOrder: s.sortOrder })),
    services: services.map((s) => ({
      id: s.id, key: s.key, label: s.label, amount: s.amount,
      currency: s.currency, isActive: s.isActive, sortOrder: s.sortOrder,
    })),
    billingEntities: billingEntities.map((e) => ({
      id: e.id, key: e.key, name: e.name, vatNumber: e.vatNumber,
      address: e.address, isDefault: e.isDefault, isActive: e.isActive,
    })),
  };
}
