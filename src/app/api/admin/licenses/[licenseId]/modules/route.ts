import { NextResponse } from 'next/server';
import { withAdmin, badRequest, notFound } from '@/lib/api';
import { getBillingSnapshot } from '@/lib/billing/client';
import { resolveLicenses } from '@/lib/licensing/queries';

type Ctx = { params: Promise<{ licenseId: string }> };

/**
 * GET /api/admin/licenses/:licenseId/modules — what this licence actually opens.
 *
 * This is the resolution the whole chain exists for: pack composition, then the
 * licence status Stripe owns, then the derogations a human wrote. Each module
 * comes back with the reason it is open or closed, so the console never has to
 * guess and neither does anyone reading it.
 *
 * `/api/admin/billing/*` delegates to the billing service, which owns licences.
 * This route is ours: it reads that service and joins our catalogue onto it.
 */
export async function GET(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const { licenseId } = await c.params;
    if (!licenseId) return badRequest('Identifiant de licence manquant.');

    const billing = await getBillingSnapshot();
    const license = billing.licenses.find((l) => l.id === licenseId);
    if (!license) return notFound('Licence introuvable.');

    const [resolved] = await resolveLicenses([license]);
    return NextResponse.json({
      license,
      packKey: resolved!.packKey,
      // A licence whose package code matches no pack opens nothing. Reporting it
      // is the point: silence here looks exactly like an empty pack.
      packFound: resolved!.packFound,
      modules: resolved!.resolved,
      fixture: billing.fixture,
    });
  })(request, ctx);
}
