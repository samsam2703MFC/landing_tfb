import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, readJson, badRequest } from '@/lib/api';
import { getCommercialSettings, isCollection, COLLECTIONS, KEY_RE } from '@/lib/commercial/settings';

/**
 * §16 — sales stages, services, and billing entities.
 *
 * The three live behind one endpoint because they are read together (one screen)
 * and never independently: a stage list without its services is half a
 * configuration. `collection` is a closed enum, so the dispatch below can never
 * be pointed at another table.
 */

/** GET /api/admin/commercial/settings */
export const GET = withAdmin(async () => {
  return NextResponse.json(await getCommercialSettings());
});

interface Body {
  collection?: string;
  key?: string;
  label?: string;
  name?: string;
  amount?: number | null;
  currency?: string;
  vatNumber?: string | null;
  address?: string | null;
  sortOrder?: number;
  isDefault?: boolean;
}

/** POST /api/admin/commercial/settings — one entry in one of the three lists. */
export async function POST(request: Request) {
  return withAdmin(async () => {
    const body = await readJson<Body>(request);

    const collection = body?.collection ?? '';
    if (!isCollection(collection)) return badRequest(`collection doit être : ${COLLECTIONS.join(', ')}.`);

    const key = body?.key?.trim() ?? '';
    if (!key) return badRequest('key est obligatoire.');
    if (!KEY_RE.test(key)) return badRequest('key doit être en minuscules ([a-z0-9_-]).');

    const label = body?.label?.trim() || body?.name?.trim() || '';
    if (!label) return badRequest('label est obligatoire.');

    if (collection === 'stages') {
      if (await prisma.salesStage.findUnique({ where: { key } })) return badRequest(`L’étape « ${key} » existe déjà.`);
      const stage = await prisma.salesStage.create({ data: { key, label, sortOrder: body?.sortOrder ?? 0 } });
      return NextResponse.json({ entry: stage }, { status: 201 });
    }

    if (collection === 'services') {
      if (await prisma.service.findUnique({ where: { key } })) return badRequest(`La prestation « ${key} » existe déjà.`);
      // NULL is "quoted case by case", which is not the same as free — 0 would
      // read as a decision to charge nothing.
      const amount = body?.amount == null ? null : Number(body.amount);
      if (amount != null && (!Number.isInteger(amount) || amount < 0)) {
        return badRequest('amount doit être un entier de centimes, ou nul pour « sur devis ».');
      }
      const service = await prisma.service.create({
        data: { key, label, amount, currency: body?.currency?.toUpperCase() || 'EUR', sortOrder: body?.sortOrder ?? 0 },
      });
      return NextResponse.json({ entry: service }, { status: 201 });
    }

    if (await prisma.billingEntity.findUnique({ where: { key } })) return badRequest(`La société « ${key} » existe déjà.`);
    const entity = await prisma.$transaction(async (tx) => {
      // Exactly one default, or none. Two would make "which entity invoices this
      // client" a question of row order.
      if (body?.isDefault) await tx.billingEntity.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return tx.billingEntity.create({
        data: {
          key, name: label,
          vatNumber: body?.vatNumber?.trim() || null,
          address: body?.address?.trim() || null,
          isDefault: body?.isDefault ?? false,
        },
      });
    });
    return NextResponse.json({ entry: entity }, { status: 201 });
  })(request, undefined);
}
