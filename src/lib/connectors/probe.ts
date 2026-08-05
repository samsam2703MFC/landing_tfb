import { access, constants } from 'node:fs/promises';
import { prisma } from '@/lib/prisma';
import { STORAGE_ROOT } from '@/lib/storage';
import {
  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, getStripeAccount, stripeConfigured, stripeMode,
} from '@/lib/stripe';
import { CONNECTORS, connectorMeta, type ConnectorMeta, type Outcome } from './registry';

/**
 * §19 — the live probes.
 *
 * Three rules, and the first one is the reason this file is not just six try/catch
 * blocks:
 *
 *  1. **A probe never writes and never has a side effect.** Reading a Stripe
 *     account, counting a table, stat-ing a directory. A status page that changes
 *     state is a status page nobody dares open.
 *  2. **A probe never returns a secret.** `check.value` is a masked hint or a
 *     count, and it is rendered in a browser by someone who is often screen
 *     sharing while they debug.
 *  3. **A missing configuration is reported as missing, not as broken.** The whole
 *     screen exists to keep those two apart.
 *
 * Results are cached for 30 seconds. Without it, opening the page fires a live
 * Stripe call on every render and every refresh — a read-only one, but a real
 * network round trip against a rate-limited API.
 */

const CACHE_MS = 30_000;

export interface Check {
  name: string;
  outcome: Outcome;
  /** Masked hint, count or short status. Never a secret, never a payload. */
  value: string;
}

export interface ConnectorState extends ConnectorMeta {
  outcome: Outcome;
  /** One line summarising the probe, for the list. */
  summary: string;
  checks: Check[];
  durationMs: number | null;
  checkedAt: Date;
}

/** First eight characters and the last four — enough to tell two keys apart. */
function hint(value: string): string {
  if (!value) return 'absente';
  return value.length <= 14 ? `présente · ${'•'.repeat(value.length)}` : `présente · ${value.slice(0, 8)}…${value.slice(-4)}`;
}

/** The worst state among the checks — that is what the connector is worth. */
function worst(checks: Check[]): Outcome {
  const order: Outcome[] = ['ok', 'degraded', 'unconfigured', 'down'];
  return checks.reduce<Outcome>((acc, c) => (order.indexOf(c.outcome) > order.indexOf(acc) ? c.outcome : acc), 'ok');
}

/** Turns a thrown value into one short line. Never the stack, never the body. */
function reason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 200);
}

/* ---------------------------------------------------------------- probes ---- */

async function probeDatabase(): Promise<{ outcome: Outcome; summary: string; checks: Check[] }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const modules = await prisma.module.count();
    return {
      outcome: 'ok',
      summary: 'joignable',
      checks: [
        { name: 'Connexion', outcome: 'ok', value: 'établie' },
        { name: 'Schéma lisible', outcome: 'ok', value: `${modules} module(s) au catalogue` },
      ],
    };
  } catch (error) {
    return {
      outcome: 'down',
      summary: reason(error),
      checks: [{ name: 'Connexion', outcome: 'down', value: reason(error) }],
    };
  }
}

function probeSessions(): { outcome: Outcome; summary: string; checks: Check[] } {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  const insecure = (process.env.ALLOW_INSECURE_COOKIES || '').toLowerCase() === 'true';
  const production = process.env.NODE_ENV === 'production';

  const checks: Check[] = [
    {
      name: 'Secret de session',
      // Under 32 bytes HS256 still signs, and the signature is simply weaker —
      // reported as degraded rather than down, because sessions do work.
      outcome: secret.length === 0 ? 'down' : secret.length < 32 ? 'degraded' : 'ok',
      value: secret.length === 0 ? 'absent' : `${secret.length} caractères`,
    },
    {
      name: 'Cookie Secure',
      // In production this is the silent one: the cookie is set, the browser
      // never sends it back, and the login page simply reloads.
      outcome: insecure && production ? 'degraded' : 'ok',
      value: insecure ? 'désactivé — ALLOW_INSECURE_COOKIES=true' : 'exigé',
    },
  ];

  const summary = secret.length === 0
    ? 'aucun secret — la connexion est impossible'
    : insecure && production
      ? 'cookie non sécurisé en production'
      : `secret de ${secret.length} caractères`;

  return { outcome: worst(checks), summary, checks };
}

async function probeStorage(): Promise<{ outcome: Outcome; summary: string; checks: Check[] }> {
  try {
    await access(STORAGE_ROOT, constants.W_OK);
    return {
      outcome: 'ok',
      summary: 'accessible en écriture',
      checks: [{ name: 'Répertoire accessible en écriture', outcome: 'ok', value: STORAGE_ROOT }],
    };
  } catch {
    return {
      outcome: 'down',
      summary: `${STORAGE_ROOT} inaccessible en écriture`,
      checks: [{ name: 'Répertoire accessible en écriture', outcome: 'down', value: `${STORAGE_ROOT} — refusé` }],
    };
  }
}

async function probeBilling(): Promise<{ outcome: Outcome; summary: string; checks: Check[] }> {
  const base = process.env.BILLING_SERVICE_URL || '';
  const token = process.env.BILLING_SERVICE_TOKEN || '';

  if (!base) {
    return {
      outcome: 'unconfigured',
      summary: 'non configuré — repli sur les fixtures',
      checks: [{ name: 'BILLING_SERVICE_URL', outcome: 'unconfigured', value: 'absente' }],
    };
  }

  const checks: Check[] = [
    { name: 'BILLING_SERVICE_URL', outcome: 'ok', value: base },
    // No token is a plausible deployment (a service behind a private network),
    // so it is a remark, not a fault.
    { name: 'BILLING_SERVICE_TOKEN', outcome: token ? 'ok' : 'degraded', value: token ? hint(token) : 'absent — appels non authentifiés' },
  ];

  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/admin/tenants`, {
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      checks.push({ name: 'GET /admin/tenants', outcome: 'down', value: `HTTP ${response.status}` });
      return { outcome: 'down', summary: `/admin/tenants → HTTP ${response.status}`, checks };
    }
    const body = (await response.json()) as unknown[];
    const count = Array.isArray(body) ? body.length : 0;
    checks.push({ name: 'GET /admin/tenants', outcome: 'ok', value: `${count} tenant(s)` });
    return { outcome: worst(checks), summary: `${count} tenant(s) lus`, checks };
  } catch (error) {
    checks.push({ name: 'GET /admin/tenants', outcome: 'down', value: reason(error) });
    return { outcome: 'down', summary: reason(error), checks };
  }
}

async function probeStripe(): Promise<{ outcome: Outcome; summary: string; checks: Check[] }> {
  if (!stripeConfigured()) {
    return {
      outcome: 'unconfigured',
      summary: 'aucune clé — mode bouchon',
      checks: [
        { name: 'STRIPE_SECRET_KEY', outcome: 'unconfigured', value: 'absente' },
        { name: 'STRIPE_WEBHOOK_SECRET', outcome: 'unconfigured', value: hint(STRIPE_WEBHOOK_SECRET) },
      ],
    };
  }

  const checks: Check[] = [
    { name: 'STRIPE_SECRET_KEY', outcome: 'ok', value: hint(STRIPE_SECRET_KEY) },
    // The dangerous one. Everything else works without it, and no payment is
    // ever recorded — so it is degraded, never ok.
    {
      name: 'STRIPE_WEBHOOK_SECRET',
      outcome: STRIPE_WEBHOOK_SECRET ? 'ok' : 'degraded',
      value: STRIPE_WEBHOOK_SECRET ? hint(STRIPE_WEBHOOK_SECRET) : 'absent — aucun paiement n’est enregistré',
    },
    { name: 'Mode', outcome: stripeMode() === 'unknown' ? 'degraded' : 'ok', value: stripeMode() },
  ];

  const account = await getStripeAccount();
  if (!account) {
    checks.push({ name: 'Compte joignable', outcome: 'unconfigured', value: 'non interrogé' });
  } else if ('error' in account) {
    checks.push({ name: 'Compte joignable', outcome: 'down', value: account.error });
  } else {
    checks.push({
      name: 'Compte joignable',
      outcome: account.chargesEnabled ? 'ok' : 'degraded',
      value: `${account.id}${account.name ? ` · ${account.name}` : ''}${account.chargesEnabled ? '' : ' · encaissement désactivé'}`,
    });
  }

  const outcome = worst(checks);
  const summary = !STRIPE_WEBHOOK_SECRET
    ? 'secret de webhook absent — aucun abonnement n’est écrit'
    : outcome === 'ok' ? `compte lu · mode ${stripeMode()}` : 'voir les contrôles';

  return { outcome, summary, checks };
}

async function probeTenantKeys(): Promise<{ outcome: Outcome; summary: string; checks: Check[] }> {
  const base = process.env.BILLING_SERVICE_URL || '';
  if (!base) {
    return {
      outcome: 'unconfigured',
      summary: 'le service de facturation n’est pas configuré',
      checks: [{ name: 'Service de facturation', outcome: 'unconfigured', value: 'BILLING_SERVICE_URL absente' }],
    };
  }

  const token = process.env.BILLING_SERVICE_TOKEN || '';
  try {
    // A deliberately invalid key: the endpoint should answer "not valid", which
    // proves it exists. A 404 proves it does not — the case in production today.
    const response = await fetch(`${base.replace(/\/$/, '')}/admin/api-keys/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ key: 'tfb-connector-probe-invalid' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 404) {
      return {
        outcome: 'down',
        summary: '404 — l’endpoint n’existe pas côté service de facturation',
        checks: [{ name: 'POST /admin/api-keys/verify', outcome: 'down', value: '404 Not Found' }],
      };
    }
    if (!response.ok && response.status !== 401 && response.status !== 422) {
      return {
        outcome: 'down',
        summary: `HTTP ${response.status}`,
        checks: [{ name: 'POST /admin/api-keys/verify', outcome: 'down', value: `HTTP ${response.status}` }],
      };
    }
    // 200, 401 and 422 all mean the endpoint is there and answered about a key
    // it correctly refused.
    return {
      outcome: 'ok',
      summary: 'l’endpoint répond et refuse une clé invalide',
      checks: [{ name: 'POST /admin/api-keys/verify', outcome: 'ok', value: `HTTP ${response.status} sur une clé invalide` }],
    };
  } catch (error) {
    return {
      outcome: 'down',
      summary: reason(error),
      checks: [{ name: 'POST /admin/api-keys/verify', outcome: 'down', value: reason(error) }],
    };
  }
}

const PROBES: Record<string, () => Promise<{ outcome: Outcome; summary: string; checks: Check[] }>> = {
  database: probeDatabase,
  sessions: async () => probeSessions(),
  storage: probeStorage,
  billing: probeBilling,
  stripe: probeStripe,
  'tenant-keys': probeTenantKeys,
};

/* ----------------------------------------------------------------- cache ---- */

const cache = new Map<string, { at: number; state: ConnectorState }>();

/**
 * Runs one connector's probe and records the result.
 *
 * `force` skips the cache — that is the "Tester" button. Only a forced probe is
 * written to the history: recording every page render would bury the manual checks
 * under noise, and the interesting rows are the ones someone asked for.
 */
export async function probeConnector(key: string, { force = false } = {}): Promise<ConnectorState | null> {
  const meta = connectorMeta(key);
  if (!meta) return null;

  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.state;

  const started = Date.now();
  const run = PROBES[key];
  const result = run
    ? await run()
    : { outcome: 'down' as Outcome, summary: 'aucune sonde définie', checks: [] };
  const durationMs = Date.now() - started;

  const state: ConnectorState = { ...meta, ...result, durationMs, checkedAt: new Date() };
  cache.set(key, { at: Date.now(), state });

  if (force) {
    // Best effort: a status page that fails because it could not write its own
    // log is a status page that lies about the thing it was checking.
    await prisma.connectorCheck
      .create({
        data: {
          connector: key,
          outcome: result.outcome,
          detail: result.summary.slice(0, 255),
          durationMs,
          trigger: 'manual',
        },
      })
      .catch(() => undefined);
  }

  return state;
}

export async function probeAll({ force = false } = {}): Promise<ConnectorState[]> {
  return Promise.all(CONNECTORS.map((c) => probeConnector(c.key, { force }) as Promise<ConnectorState>));
}

export async function connectorHistory(key: string, take = 20) {
  return prisma.connectorCheck.findMany({
    where: { connector: key },
    orderBy: { checkedAt: 'desc' },
    take,
  });
}
