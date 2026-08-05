import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/api';
import { readSpecFile } from '@/lib/openapi';

/**
 * GET /api/admin/openapi.yaml — the contract itself, for tooling.
 *
 * Point Swagger UI, Postman, Insomnia or Scalar at this URL. The console renders a
 * readable version at /admin/api; this is the machine-readable one.
 *
 * **Behind the admin session, on purpose.** The document describes the whole
 * `/api/admin/*` surface: every route, every body, every refusal. Those endpoints
 * are gated anyway, so publishing the spec is not a hole by itself — it is a map,
 * and there is no reason to hand one to a stranger. Making it public is deleting
 * the `withAdmin` wrapper, if that is ever the intent.
 */
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  const body = await readSpecFile();
  if (!body) {
    // Reported rather than served empty: an empty spec looks like an API with no
    // endpoints, which is a far more confusing thing to hand a client developer.
    return NextResponse.json({ error: 'docs/openapi.yaml est introuvable sur ce serveur.' }, { status: 404 });
  }

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/yaml; charset=utf-8',
      'Content-Disposition': 'inline; filename="tfb-openapi.yaml"',
      'Cache-Control': 'private, no-store',
    },
  });
});
