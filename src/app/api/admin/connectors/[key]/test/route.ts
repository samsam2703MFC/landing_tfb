import { NextResponse } from 'next/server';
import { withAdmin, notFound, badRequest } from '@/lib/api';
import { probeConnector, connectorHistory } from '@/lib/connectors/probe';
import { connectorMeta } from '@/lib/connectors/registry';

type Ctx = { params: Promise<{ key: string }> };

/**
 * POST /api/admin/connectors/:key/test — run the probe now (§19).
 *
 * POST rather than GET because it bypasses the cache and writes a history row —
 * it is not safe to prefetch, and a browser must not fire it on hover.
 *
 * The probe itself still has no side effect on the connector: reading a Stripe
 * account, counting a table, refusing a deliberately invalid tenant key. Nothing
 * here creates, charges or deletes.
 */
export async function POST(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const { key } = await c.params;
    if (!connectorMeta(key)) return notFound(`Aucun connecteur « ${key} ».`);

    const connector = await probeConnector(key, { force: true });
    if (!connector) return badRequest('Sonde indisponible pour ce connecteur.');

    return NextResponse.json({ connector, history: await connectorHistory(key) });
  })(request, ctx);
}
