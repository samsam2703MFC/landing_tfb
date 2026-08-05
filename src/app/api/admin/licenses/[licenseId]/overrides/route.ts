import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest, notFound } from '@/lib/api';
import { getBillingSnapshot } from '@/lib/billing/client';

type Ctx = { params: Promise<{ licenseId: string }> };

/**
 * Derogations — a module opened or closed outside the pack, for one licence (§21.2).
 *
 * They exist so that a decision someone made in writing survives the next Stripe
 * webhook. Nothing else in the chain can be overruled by hand, and nothing else
 * needs to be.
 *
 * Every derogation carries a reason and an author. An untraceable one is how
 * access quietly drifts away from what anybody agreed to.
 */

/** GET /api/admin/licenses/:licenseId/overrides — in force and revoked alike. */
export async function GET(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const { licenseId } = await c.params;
    if (!licenseId) return badRequest('Identifiant de licence manquant.');

    const overrides = await prisma.licenseOverride.findMany({
      where: { licenseId },
      orderBy: { createdAt: 'desc' },
      include: { module: { select: { id: true, key: true, icon: true } } },
    });
    return NextResponse.json({ overrides });
  })(request, ctx);
}

/**
 * POST /api/admin/licenses/:licenseId/overrides
 *
 * Body: { moduleId, grant, reason, expiresAt? }
 *
 * A new derogation on a module that already has one supersedes it — the older
 * row is revoked rather than deleted, so the trail survives the correction.
 */
export async function POST(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (session, c) => {
    const { licenseId } = await c.params;
    if (!licenseId) return badRequest('Identifiant de licence manquant.');

    const body = await readJson<{
      moduleId?: number; grant?: boolean; reason?: string; expiresAt?: string | null;
    }>(request);

    if (!Number.isInteger(body?.moduleId) || (body!.moduleId as number) <= 0) {
      return badRequest('moduleId est obligatoire.');
    }
    if (typeof body?.grant !== 'boolean') {
      return badRequest('grant est obligatoire : true ouvre le module, false le ferme.');
    }
    const reason = body?.reason?.trim() ?? '';
    if (!reason) return badRequest('reason est obligatoire — une dérogation sans motif est intraçable.');

    let expiresAt: Date | null = null;
    if (body?.expiresAt) {
      const parsed = new Date(body.expiresAt);
      if (Number.isNaN(parsed.getTime())) return badRequest('expiresAt doit être une date valide.');
      if (parsed.getTime() <= Date.now()) return badRequest('expiresAt doit être dans le futur.');
      expiresAt = parsed;
    }

    const billing = await getBillingSnapshot();
    const license = billing.licenses.find((l) => l.id === licenseId);
    if (!license) return notFound('Licence introuvable.');

    const moduleRow = await prisma.module.findUnique({ where: { id: body!.moduleId as number } });
    if (!moduleRow) return notFound('Module introuvable.');

    const now = new Date();
    const [, override] = await prisma.$transaction([
      prisma.licenseOverride.updateMany({
        where: { licenseId, moduleId: moduleRow.id, revokedAt: null },
        data: { revokedAt: now, revokedBy: session.email },
      }),
      prisma.licenseOverride.create({
        data: {
          licenseId,
          moduleId: moduleRow.id,
          grant: body!.grant as boolean,
          reason,
          expiresAt,
          createdBy: session.email,
        },
      }),
    ]);

    return NextResponse.json({ override }, { status: 201 });
  })(request, ctx);
}
