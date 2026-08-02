import Link from 'next/link';
import { Badge, Card, Icon } from '@/design-system';
import { getBillingSnapshot } from '@/lib/billing/client';
import { overrideCounts } from '@/lib/config/store';
import { REGISTRY } from '@/lib/config/registry';
import { BillingFixtureNotice } from '@/components/admin/shared';

/**
 * Profils clients — one row per tenant, with how much of its configuration is
 * overridden and whether a draft is waiting.
 *
 * Tenants come from the billing service, not from a table here: duplicating another
 * service's tenant list is how the two drift apart. The overlay is the only thing
 * this app owns.
 */
export default async function ProfilesPage() {
  const [snapshot, counts] = await Promise.all([getBillingSnapshot(), overrideCounts()]);
  const tenants = snapshot.tenants.filter((t) => t.archived_at === null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 1100 }}>
      <BillingFixtureNotice fixture={snapshot.fixture} />

      <Card
        padding="none"
        title="Profils clients"
        subtitle="La surcouche par tenant — tfb_settings, aucune table par client"
        footer="Un profil sans surcharge sert exactement la configuration par défaut. C'est le cas sain, pas un profil vide."
      >
        <div>
          {tenants.map((t) => {
            const entry = counts.get(t.slug) ?? { overrides: 0, version: 0, dirty: false };
            return (
              <Link
                key={t.slug}
                href={`/admin/profiles/${t.slug}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-5)', borderTop: '1px solid var(--border-subtle)',
                  color: 'inherit', textDecoration: 'none',
                }}
              >
                <Icon name="building" size={15} color="var(--text-tertiary)" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ font: 'var(--type-label)' }}>{t.name}</div>
                  <div className="fb-num" style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>{t.slug}</div>
                </div>

                <span className="fb-num" style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>
                  {t.stores} PDV
                </span>
                <Badge tone={entry.overrides > 0 ? 'brand' : 'neutral'} size="sm">
                  {entry.overrides} / {REGISTRY.length} surchargées
                </Badge>
                <Badge tone="neutral" size="sm">
                  <span className="fb-num">v{entry.version}</span>
                </Badge>
                {entry.dirty ? (
                  <Badge tone="warning" dot size="sm">brouillon</Badge>
                ) : (
                  <Badge tone="success" dot size="sm">à jour</Badge>
                )}
                <Icon name="chevron-right" size={14} className="fb-flip" color="var(--text-tertiary)" />
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
