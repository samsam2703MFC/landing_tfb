import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest, notFound, intParam } from '@/lib/api';
import { isCollection, COLLECTIONS } from '@/lib/commercial/settings';

type Ctx = { params: Promise<{ collection: string; id: string }> };

/**
 * One entry of one §16 list.
 *
 * Deletion is allowed here, unlike on packs or plans, for one reason: these lists
 * are not referenced by any row yet — no table carries a stage id or a service
 * id. The day an offer does, this handler has to start refusing, and the comment
 * on the DELETE says where.
 */

interface Body {
  label?: string;
  name?: string;
  amount?: number | null;
  currency?: string;
  vatNumber?: string | null;
  address?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

export async function PATCH(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const { collection, id: rawId } = await c.params;
    if (!isCollection(collection)) return badRequest(`collection doit être : ${COLLECTIONS.join(', ')}.`);
    const id = intParam(rawId);
    if (!id) return badRequest('Identifiant invalide.');

    const body = await readJson<Body>(request);
    if (!body) return badRequest('Corps de requête invalide.');

    const common = {
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    };

    if (collection === 'stages') {
      if (!(await prisma.salesStage.findUnique({ where: { id } }))) return notFound('Étape introuvable.');
      const entry = await prisma.salesStage.update({
        where: { id },
        data: { ...common, ...(body.label !== undefined ? { label: body.label.trim() } : {}) },
      });
      return NextResponse.json({ entry });
    }

    if (collection === 'services') {
      if (!(await prisma.service.findUnique({ where: { id } }))) return notFound('Prestation introuvable.');
      if (body.amount != null && (!Number.isInteger(body.amount) || body.amount < 0)) {
        return badRequest('amount doit être un entier de centimes, ou nul pour « sur devis ».');
      }
      const entry = await prisma.service.update({
        where: { id },
        data: {
          ...common,
          ...(body.label !== undefined ? { label: body.label.trim() } : {}),
          ...(body.amount !== undefined ? { amount: body.amount } : {}),
          ...(body.currency !== undefined ? { currency: body.currency.toUpperCase() } : {}),
        },
      });
      return NextResponse.json({ entry });
    }

    if (!(await prisma.billingEntity.findUnique({ where: { id } }))) return notFound('Société introuvable.');
    const entry = await prisma.$transaction(async (tx) => {
      if (body.isDefault) await tx.billingEntity.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return tx.billingEntity.update({
        where: { id },
        data: {
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.vatNumber !== undefined ? { vatNumber: body.vatNumber } : {}),
          ...(body.address !== undefined ? { address: body.address } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        },
      });
    });
    return NextResponse.json({ entry });
  })(request, ctx);
}

/**
 * DELETE — safe today because nothing references these lists yet.
 *
 * When an offer or a deal starts carrying a stage or a service, this must refuse
 * on a reference count, the way plans and packs already do: removing the row
 * would leave past deals unreadable rather than merely out of date.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return withAdmin<Ctx>(async (_session, c) => {
    const { collection, id: rawId } = await c.params;
    if (!isCollection(collection)) return badRequest(`collection doit être : ${COLLECTIONS.join(', ')}.`);
    const id = intParam(rawId);
    if (!id) return badRequest('Identifiant invalide.');

    if (collection === 'stages') {
      if (!(await prisma.salesStage.findUnique({ where: { id } }))) return notFound('Étape introuvable.');
      await prisma.salesStage.delete({ where: { id } });
    } else if (collection === 'services') {
      if (!(await prisma.service.findUnique({ where: { id } }))) return notFound('Prestation introuvable.');
      await prisma.service.delete({ where: { id } });
    } else {
      const entity = await prisma.billingEntity.findUnique({ where: { id } });
      if (!entity) return notFound('Société introuvable.');
      if (entity.isDefault) {
        return badRequest('Cette société est celle par défaut. Désignez-en une autre avant de la supprimer.');
      }
      await prisma.billingEntity.delete({ where: { id } });
    }

    return NextResponse.json({ ok: true });
  })(request, ctx);
}
