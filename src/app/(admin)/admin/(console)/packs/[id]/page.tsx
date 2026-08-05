import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getBillingSnapshot } from '@/lib/billing/client';
import { getModuleCatalogue } from '@/lib/licensing/queries';
import { PackComposer } from '@/components/admin/PackScreens';

/** The composition of one pack: which modules its Stripe product opens (§21.1). */
export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const packId = Number(id);
  if (!Number.isInteger(packId) || packId <= 0) notFound();

  const pack = await prisma.pack.findUnique({
    where: { id: packId },
    include: {
      prices: { orderBy: [{ isDefault: 'desc' }, { amount: 'asc' }] },
      modules: { select: { moduleId: true } },
    },
  });
  if (!pack) notFound();

  const [catalogue, billing] = await Promise.all([getModuleCatalogue(), getBillingSnapshot()]);

  return (
    <PackComposer
      pack={{
        id: pack.id,
        key: pack.key,
        stripeProductId: pack.stripeProductId,
        kind: pack.kind,
        isActive: pack.isActive,
        prices: pack.prices.map((p) => ({
          id: p.id,
          stripePriceId: p.stripePriceId,
          amount: p.amount,
          currency: p.currency,
          interval: p.interval,
          isDefault: p.isDefault,
        })),
        moduleIds: pack.modules.map((m) => m.moduleId),
      }}
      catalogue={catalogue}
      licenseCount={billing.licenses.filter((l) => l.package === pack.key).length}
    />
  );
}
