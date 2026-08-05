import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, badRequest, notFound, intParam } from '@/lib/api';

type Ctx = { params: Promise<{ licenseId: string; overrideId: string }> };

/**
 * DELETE /api/admin/licenses/:licenseId/overrides/:overrideId — revokes a derogation.
 *
 * Revoked, not deleted: the row stays with its date and its author, and the
 * licence falls back to what its pack says. A derogation that could be erased
 * would leave an access change with no explanation behind it.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (session, c) => {
    const { licenseId, overrideId: rawOverrideId } = await c.params;
    const overrideId = intParam(rawOverrideId);
    if (!licenseId || !overrideId) return badRequest('Identifiant invalide.');

    // Matched on both ids, so a derogation cannot be revoked through another licence.
    const existing = await prisma.licenseOverride.findFirst({ where: { id: overrideId, licenseId } });
    if (!existing) return notFound('Dérogation introuvable.');
    if (existing.revokedAt) return badRequest('Cette dérogation est déjà révoquée.');

    const override = await prisma.licenseOverride.update({
      where: { id: overrideId },
      data: { revokedAt: new Date(), revokedBy: session.email },
    });
    return NextResponse.json({ override });
  })(request, ctx);
}
