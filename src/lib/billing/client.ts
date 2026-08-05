import { BILLING_FIXTURE } from './fixtures';
import type { BillingSnapshot } from './types';

/**
 * Client for the billing service (uploads/billing_service_db.sql — a separate
 * Laravel / MySQL service).
 *
 * That service owns tenants, stores, licenses, invoices, packages, pricing_tiers,
 * license_events and sync_queue, so those tables are deliberately NOT modelled in
 * this app's Prisma schema. Duplicating another service's database is how the two
 * drift apart.
 *
 * With BILLING_SERVICE_URL unset, every read returns the fixture snapshot and
 * `fixture: true`, which the console surfaces in a banner. Set the env var and the
 * same functions hit the real endpoints — no screen changes.
 */

const BASE = process.env.BILLING_SERVICE_URL || '';
const TOKEN = process.env.BILLING_SERVICE_TOKEN || '';

export function billingConfigured(): boolean {
  return BASE.length > 0;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE.replace(/\/$/, '')}${path}`, {
    headers: {
      Accept: 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    // Billing figures change on every Stripe webhook; a stale console is worse
    // than a slightly slower one.
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Billing service ${path} → HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * One snapshot for the whole billing half of the console. Falls back to the
 * fixture set — and says so — when the service is unset or unreachable, so a
 * billing outage degrades the screens instead of erroring the page.
 */
export async function getBillingSnapshot(): Promise<BillingSnapshot> {
  if (!billingConfigured()) return BILLING_FIXTURE;

  try {
    const [tenants, packages, tiers, licenses, invoices, events, sync] = await Promise.all([
      get<BillingSnapshot['tenants']>('/admin/tenants'),
      get<BillingSnapshot['packages']>('/admin/packages'),
      get<BillingSnapshot['tiers']>('/admin/pricing-tiers'),
      get<BillingSnapshot['licenses']>('/admin/licenses'),
      get<BillingSnapshot['invoices']>('/admin/invoices'),
      get<BillingSnapshot['events']>('/admin/license-events'),
      get<BillingSnapshot['sync']>('/admin/sync-queue'),
    ]);
    return { tenants, packages, tiers, licenses, invoices, events, sync, fixture: false };
  } catch (error) {
    console.error('Billing service unreachable — falling back to the fixture snapshot.', error);
    return BILLING_FIXTURE;
  }
}

/**
 * Blocks a licence: status = blocked, an internal row in license_events, and a
 * sync_queue entry for /internal/license-sync. Refused while the service is unset —
 * a destructive action must never look like it succeeded against fixtures.
 */
export async function blockLicense(licenseId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!billingConfigured()) {
    return { ok: false, reason: 'BILLING_SERVICE_URL absent — aucune licence n’a été bloquée.' };
  }
  const response = await fetch(`${BASE.replace(/\/$/, '')}/admin/licenses/${encodeURIComponent(licenseId)}/block`, {
    method: 'POST',
    headers: { ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
  });
  if (!response.ok) return { ok: false, reason: `Billing service → HTTP ${response.status}` };
  return { ok: true };
}

/**
 * Resolves a tenant API key to the tenant that owns it (§21).
 *
 * The billing service holds the keys — it only ever exposes `api_key_hint`, so
 * there is nothing here to compare against and verification has to be delegated.
 * That is the point: one service owns the credential, and this app never sees it
 * stored.
 *
 * **Refused while BILLING_SERVICE_URL is unset.** Authenticating against the
 * fixture snapshot would hand a caller the entitlements of a tenant nobody
 * verified — an open door dressed as a demo.
 *
 * Requires `POST /admin/api-keys/verify { key } → { tenant: "<name>" }` on the
 * billing service. It answers 401 for an unknown key.
 */
export async function verifyTenantKey(
  key: string,
): Promise<{ ok: true; tenant: string } | { ok: false; reason: string; status: number }> {
  if (!billingConfigured()) {
    return {
      ok: false,
      status: 503,
      reason: 'BILLING_SERVICE_URL absent — aucune clé ne peut être vérifiée, donc aucun droit accordé.',
    };
  }

  let response: Response;
  try {
    response = await fetch(`${BASE.replace(/\/$/, '')}/admin/api-keys/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
      body: JSON.stringify({ key }),
      cache: 'no-store',
    });
  } catch (error) {
    // Unreachable is not "unauthorised": say so, and let the caller decide. A PWA
    // that locks itself on a network blip is worse than one that retries.
    console.error('Billing service unreachable while verifying a tenant key.', error);
    return { ok: false, status: 503, reason: 'Service de facturation injoignable.' };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, status: 401, reason: 'Clé inconnue ou révoquée.' };
  }
  if (!response.ok) {
    return { ok: false, status: 503, reason: `Service de facturation → HTTP ${response.status}` };
  }

  const body = (await response.json().catch(() => ({}))) as { tenant?: unknown };
  if (typeof body.tenant !== 'string' || body.tenant === '') {
    return { ok: false, status: 503, reason: 'Réponse de vérification inexploitable.' };
  }
  return { ok: true, tenant: body.tenant };
}

/** Replays one sync_queue row, or every failed row when no id is given. */
export async function replaySync(queueId?: number): Promise<{ ok: boolean; reason?: string }> {
  if (!billingConfigured()) {
    return { ok: false, reason: 'BILLING_SERVICE_URL absent — aucune synchronisation rejouée.' };
  }
  const path = queueId != null ? `/admin/sync-queue/${queueId}/replay` : '/admin/sync-queue/replay';
  const response = await fetch(`${BASE.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
  });
  if (!response.ok) return { ok: false, reason: `Billing service → HTTP ${response.status}` };
  return { ok: true };
}
