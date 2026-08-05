import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest, notFound, intParam } from '@/lib/api';
import { getBillingSnapshot } from '@/lib/billing/client';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/admin/packs/:id/modules — the composition (§21.1).
 *
 * Body: { moduleIds: number[] } — the complete list, applied in one transaction.
 * A half-written composition would open a set of modules nobody chose.
 *
 * This is the authorisation model, and it lives here rather than in Stripe
 * metadata: Stripe says what is paid, we say what that grants.
 *
 * The response reports how many licences the change reaches, and which modules
 * were removed — closing a module hides it and blocks its endpoints, but destroys
 * no data, and a reopened pack finds everything as it was.
 */
export async function PUT(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const id = intParam((await c.params).id);
    if (!id) return badRequest('Identifiant invalide.');

    const body = await readJson<{ moduleIds?: unknown }>(request);
    const raw = body?.moduleIds;
    if (!Array.isArray(raw)) return badRequest('moduleIds doit être un tableau.');
    if (!raw.every((v) => Number.isInteger(v) && (v as number) > 0)) {
      return badRequest('moduleIds ne doit contenir que des identifiants entiers positifs.');
    }
    const wanted = [...new Set(raw as number[])];

    const pack = await prisma.pack.findUnique({ where: { id }, include: { modules: true } });
    if (!pack) return notFound('Pack introuvable.');

    // Refuse the whole call on one unknown id rather than silently composing a
    // pack out of the subset that happened to exist.
    const found = await prisma.module.findMany({ where: { id: { in: wanted } }, select: { id: true } });
    if (found.length !== wanted.length) {
      const known = new Set(found.map((m) => m.id));
      const missing = wanted.filter((v) => !known.has(v));
      return badRequest(`Module(s) inconnu(s) : ${missing.join(', ')}.`);
    }

    const before = new Set(pack.modules.map((m) => m.moduleId));
    const after = new Set(wanted);
    const added = wanted.filter((v) => !before.has(v));
    const removed = [...before].filter((v) => !after.has(v));

    await prisma.$transaction([
      prisma.packModule.deleteMany({ where: { packId: id, moduleId: { in: removed } } }),
      prisma.packModule.createMany({
        data: added.map((moduleId) => ({ packId: id, moduleId })),
        skipDuplicates: true,
      }),
    ]);

    const billing = await getBillingSnapshot();
    const licenseCount = billing.licenses.filter((l) => l.package === pack.key).length;

    return NextResponse.json({
      ok: true,
      moduleIds: wanted,
      added: added.length,
      removed: removed.length,
      licenseCount,
    });
  })(request, ctx);
}
