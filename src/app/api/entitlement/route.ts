import { NextResponse } from 'next/server';
import { verifyTenantKey } from '@/lib/billing/client';
import { openModulesForTenant } from '@/lib/licensing/queries';
import { rateLimit, clientIp } from '@/lib/rate-limit';

/**
 * GET /api/entitlement — what a product PWA is allowed to open (§21).
 *
 * Each PWA is a row in tfb_modules, a pack opens it, and this is where the PWA
 * asks whether the client in front of it has paid for the app it is about to
 * render. Hiding a launcher tile is a convenience; this endpoint is the control.
 *
 * **Server-to-server only.** The key identifies the tenant, so it must live on the
 * PWA's server and never reach a browser — which is also why no CORS header is
 * sent: a call from page JavaScript would mean the key is already exposed, and
 * answering it would make that leak comfortable.
 *
 *   GET /api/entitlement                       → every module this tenant may open
 *   GET /api/entitlement?module=pwa_consultant → one answer, for one app
 *   GET /api/entitlement?store=Liège Centre    → narrowed to a single shop's licence
 *
 *   Authorization: Bearer <clé API du tenant>
 *
 * Answers, and what a PWA should do with each:
 *
 *   200 { open: true }   render
 *   200 { open: false }  lock, and show `reason`
 *   401                  the key is wrong — lock, and do not retry in a loop
 *   503                  we could not decide. **Do not lock on this.** A billing
 *                        outage must not shut every shop's tablet; keep the last
 *                        known answer and retry.
 *
 * That last distinction is the whole reason this route separates "no" from
 * "unknown" instead of returning a bare boolean.
 */

export const dynamic = 'force-dynamic';

function bearer(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]!.trim() : '';
}

export async function GET(request: Request) {
  // Per-IP, because the tenant is unknown until the key is verified — and
  // verification is a call to another service, which is what we are protecting.
  const limit = rateLimit(`entitlement:${clientIp(request)}`, 120, 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de requêtes.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  const key = bearer(request);
  if (!key) {
    return NextResponse.json(
      { error: 'En-tête Authorization: Bearer <clé API du tenant> requis.' },
      { status: 401 },
    );
  }

  const auth = await verifyTenantKey(key);
  if (!auth.ok) {
    // 401 says "this key is not valid"; 503 says "we could not tell". A PWA that
    // treats the second as the first locks a paying shop out during an outage.
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const params = new URL(request.url).searchParams;
  const store = params.get('store');
  const moduleKey = params.get('module');

  const entitlement = await openModulesForTenant(auth.tenant, {
    ...(store ? { store } : {}),
  });

  const modules = entitlement.open.map((m) => ({ key: m.key, name: m.name, icon: m.icon }));

  if (moduleKey) {
    const found = entitlement.open.find((m) => m.key === moduleKey);
    return NextResponse.json({
      tenant: auth.tenant,
      store,
      module: moduleKey,
      open: Boolean(found),
      // Why it is closed, in the words the console uses. A PWA can show this as-is.
      reason: found
        ? undefined
        : entitlement.licenses.length === 0
          ? 'Aucune licence pour ce tenant.'
          : entitlement.unmatchedPackKeys.length > 0
            ? `Aucun pack ne porte la clé ${entitlement.unmatchedPackKeys.join(', ')}.`
            : 'Ce module n’est ouvert par aucune licence en cours.',
      licenses: entitlement.licenses,
    });
  }

  return NextResponse.json({
    tenant: auth.tenant,
    store,
    modules,
    licenses: entitlement.licenses,
    // Named rather than swallowed: a pack key with no pack grants nothing, and an
    // empty `modules` looks identical to a client who bought nothing.
    unmatchedPackKeys: entitlement.unmatchedPackKeys,
  });
}
