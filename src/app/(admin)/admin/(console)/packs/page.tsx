import { getBillingSnapshot } from '@/lib/billing/client';
import { getPacks, countLicensesByPackage } from '@/lib/licensing/queries';
import { PacksTable } from '@/components/admin/PackScreens';
import { BillingFixtureNotice } from '@/components/admin/shared';

/** tfb_packs — the Stripe products the SaaS sells, and what each one opens (§21). */
export default async function PacksPage() {
  const billing = await getBillingSnapshot();
  const packs = await getPacks(countLicensesByPackage(billing.licenses));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <BillingFixtureNotice fixture={billing.fixture} />
      <PacksTable packs={packs} fixture={billing.fixture} />
    </div>
  );
}
