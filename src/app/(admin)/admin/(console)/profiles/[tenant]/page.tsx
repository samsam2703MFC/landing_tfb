import { notFound } from 'next/navigation';
import { getBillingSnapshot } from '@/lib/billing/client';
import { REGISTRY, validate } from '@/lib/config/registry';
import { draftOverlay, globalOverlay, publishedOverlay, isSlug } from '@/lib/config/store';
import { resolveAll, grantsFor } from '@/lib/config/resolve';
import { ProfileEditor, type ProfileData } from '@/components/admin/ProfileEditor';

/** One tenant's configuration profile. Everything is resolved server-side. */
export default async function ProfilePage({ params }: { params: Promise<{ tenant: string }> }) {
  const slug = (await params).tenant;
  if (!isSlug(slug)) notFound();

  const [snapshot, draft, global, published, entitlement] = await Promise.all([
    getBillingSnapshot(),
    draftOverlay(slug),
    globalOverlay(),
    publishedOverlay(slug),
    grantsFor(slug),
  ]);

  const tenant = snapshot.tenants.find((t) => t.slug === slug);
  if (!tenant) notFound();

  // The licence that decides the header badge: the tenant-scope one when there is
  // one, otherwise whatever the tenant's first licence says.
  const licences = snapshot.licenses.filter((l) => l.tenant === tenant.name);
  const licenceStatus = licences.find((l) => l.store === null)?.status ?? licences[0]?.status ?? null;

  const errors: Record<string, string> = {};
  for (const [key, value] of Object.entries(draft.values)) {
    const message = validate(key, value);
    if (message) errors[key] = message;
  }

  const data: ProfileData = {
    tenant: {
      slug: tenant.slug,
      name: tenant.name,
      internalApiUrl: tenant.internal_api_url,
      stores: tenant.stores,
      licenseStatus: licenceStatus,
    },
    variables: [...REGISTRY],
    resolutions: resolveAll(draft, global),
    errors,
    dirty: draft.updatedAt !== null,
    publishedVersion: published.version,
    publishedAt: published.updatedAt,
    grants: entitlement.grants,
    packages: snapshot.packages
      .filter((p) => p.is_active)
      .map((p) => ({
        code: p.code,
        name: p.name,
        granted: entitlement.grants.includes(p.code),
        status: licences.find((l) => l.package === p.code)?.status ?? (p.is_free ? 'core' : null),
      })),
    fixture: snapshot.fixture,
  };

  return <ProfileEditor data={data} />;
}
