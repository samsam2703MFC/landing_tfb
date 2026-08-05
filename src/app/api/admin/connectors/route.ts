import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/api';
import { probeAll } from '@/lib/connectors/probe';

/**
 * GET /api/admin/connectors — every external dependency and its live state (§19).
 *
 * Read-only, and deliberately so: a status endpoint that changes anything is one
 * nobody dares call. Results are cached 30 seconds inside `probeAll`; the "Tester"
 * button goes through `POST /api/admin/connectors/{key}/test`, which forces.
 *
 * No secret ever crosses this boundary — values are masked hints and counts.
 */
export const GET = withAdmin(async () => {
  const connectors = await probeAll();
  return NextResponse.json({
    connectors,
    counts: {
      ok: connectors.filter((c) => c.outcome === 'ok').length,
      degraded: connectors.filter((c) => c.outcome === 'degraded').length,
      down: connectors.filter((c) => c.outcome === 'down').length,
      unconfigured: connectors.filter((c) => c.outcome === 'unconfigured').length,
    },
  });
});
