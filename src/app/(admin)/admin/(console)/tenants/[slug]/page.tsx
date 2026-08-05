import { notFound } from 'next/navigation';
import { getBillingSnapshot } from '@/lib/billing/client';
import { getModuleCatalogue, resolveLicenses } from '@/lib/licensing/queries';
import { TenantDetail } from '@/components/admin/BillingTables';
import { LicenseModulesPanel } from '@/components/admin/PackScreens';
import { BillingFixtureNotice } from '@/components/admin/shared';

/**
 * One tenant: its licences (uq_licenses_scope), invoices and API access — then
 * what those licences actually open (§21) and the derogations in force.
 *
 * The billing service owns the licences; the modules they resolve to are ours.
 * The two are joined here rather than in either database.
 */
export default async function TenantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBillingSnapshot();
  const tenant = b.tenants.find((t) => t.slug === slug);
  if (!tenant) notFound();

  const licenses = b.licenses.filter((l) => l.tenant === tenant.name);
  const [resolved, catalogue] = await Promise.all([resolveLicenses(licenses), getModuleCatalogue()]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <BillingFixtureNotice fixture={b.fixture} />
      <TenantDetail
        tenant={tenant}
        licenses={licenses}
        invoices={b.invoices.filter((i) => i.tenant === tenant.name)}
        fixture={b.fixture}
      />
      <LicenseModulesPanel rows={resolved} catalogue={catalogue} fixture={b.fixture} />
    </div>
  );
}
