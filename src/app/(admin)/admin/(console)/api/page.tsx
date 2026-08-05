import { Badge, Card, Icon } from '@/design-system';
import { byTag, getSpec, type Operation } from '@/lib/openapi';
import { NotDesigned } from '@/components/admin/shared';

/**
 * /admin/api — the contract, readable.
 *
 * Rendered from docs/openapi.yaml with the design system rather than by embedding
 * Swagger UI: that package is tens of megabytes, this server has 1 GB of RAM, and
 * the build is already bounded at 1536 MB after the 02/08 outage. The raw document
 * is served at /api/admin/openapi.yaml for anyone who wants Swagger UI locally.
 */

const METHOD_TONE: Record<string, 'success' | 'brand' | 'warning' | 'danger' | 'info'> = {
  GET: 'info',
  POST: 'success',
  PUT: 'brand',
  PATCH: 'warning',
  DELETE: 'danger',
};

const SECURITY_LABEL: Record<Operation['security'], { label: string; tone: 'neutral' | 'brand' | 'warning' }> = {
  admin: { label: 'session admin', tone: 'brand' },
  tenant: { label: 'clé tenant', tone: 'warning' },
  public: { label: 'public', tone: 'neutral' },
};

/** The first paragraph only — the full prose belongs in the file, not on a list. */
function lede(description: string): string {
  const first = description.trim().split(/\n\s*\n/)[0] ?? '';
  return first.replace(/\s+/g, ' ').trim();
}

export default async function ApiPage() {
  const spec = await getSpec();

  if (!spec) {
    return (
      <NotDesigned
        what="Contrat indisponible"
        why="docs/openapi.yaml est introuvable ou illisible sur ce serveur. Le fichier est versionné avec l’application — un déploiement partiel est la cause la plus probable."
      />
    );
  }

  const groups = byTag(spec);
  const counts = {
    total: spec.operations.length,
    admin: spec.operations.filter((o) => o.security === 'admin').length,
    tenant: spec.operations.filter((o) => o.security === 'tenant').length,
    public: spec.operations.filter((o) => o.security === 'public').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 1240 }}>
      <Card padding="lg">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h2 style={{ font: 'var(--type-heading-3)' }}>{spec.title}</h2>
            <div className="fb-num" style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>
              version {spec.version} · {counts.total} opérations · docs/openapi.yaml
            </div>
          </div>
          {/* A plain link rather than a Button: the browser already carries the
              session cookie, so the download needs no client component. */}
          <a
            href="/api/admin/openapi.yaml"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-control)',
              border: '1px solid var(--border-default)', background: 'var(--surface-card)',
              font: 'var(--type-label)', color: 'var(--text-secondary)', textDecoration: 'none',
            }}
          >
            <Icon name="download" size={16} />
            openapi.yaml
          </a>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
          <Badge tone="brand" size="sm">{counts.admin} session admin</Badge>
          <Badge tone="warning" size="sm">{counts.tenant} clé tenant</Badge>
          <Badge tone="neutral" size="sm">{counts.public} public</Badge>
        </div>

        <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-4)', maxWidth: '66ch' }}>
          Ce contrat décrit ce qui est implémenté, et rien d’autre. Chaque opération porte le
          fichier de route dont elle est tirée, et l’intégration continue échoue si l’un de ces
          fichiers disparaît — sans quoi le contrat se mettrait à décrire ce qui existait, ce qui
          est pire que pas de contrat, parce qu’on le croit.
        </p>
      </Card>

      {groups.map((group) => (
        <Card key={group.tag} title={group.tag} subtitle={lede(group.description)} padding="none">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {group.operations.map((operation) => (
              <div
                key={`${operation.method} ${operation.path}`}
                style={{
                  display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start',
                  padding: 'var(--space-4) var(--space-5)',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <Badge tone={METHOD_TONE[operation.method] ?? 'neutral'} size="sm" style={{ minWidth: 62, justifyContent: 'center' }}>
                  {operation.method}
                </Badge>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className="fb-num" style={{ font: 'var(--weight-medium) var(--text-sm)/1.3 var(--font-mono)' }}>
                    {operation.path}
                  </span>
                  <span style={{ font: 'var(--type-body-sm)' }}>{operation.summary}</span>
                  {lede(operation.description) && (
                    <span style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)', maxWidth: '78ch' }}>
                      {lede(operation.description)}
                    </span>
                  )}
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                    {operation.responses.map((r) => (
                      <span
                        key={r.code}
                        title={r.description}
                        className="fb-num"
                        style={{
                          font: 'var(--type-caption)', padding: '1px var(--space-2)',
                          borderRadius: 'var(--radius-xs)', background: 'var(--surface-sunken)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {r.code}
                      </span>
                    ))}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: 'none' }}>
                  <Badge tone={SECURITY_LABEL[operation.security].tone} size="sm">
                    {SECURITY_LABEL[operation.security].label}
                  </Badge>
                  {operation.source && (
                    <span className="fb-num" style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>
                      {operation.source.replace(/^src\/app\/api\//, '').replace(/\/route\.ts$/, '')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
