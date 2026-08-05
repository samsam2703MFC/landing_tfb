import { Badge, Card, Icon, StatTile } from '@/design-system';
import { getStripeHealth } from '@/lib/stripe-health';

/**
 * /admin/stripe — does Stripe work?
 *
 * Every way this integration fails is silent. A missing webhook secret means no
 * payment ever creates a subscription: Checkout still redirects, the customer is
 * still charged, and the row is simply never written. Nothing in the application
 * looks wrong. This screen is where that becomes visible.
 */

const OUTCOME: Record<string, { tone: 'success' | 'neutral' | 'warning' | 'danger'; label: string }> = {
  applied: { tone: 'success', label: 'appliqué' },
  ignored: { tone: 'neutral', label: 'non traité' },
  skipped: { tone: 'neutral', label: 'déjà appliqué' },
  failed: { tone: 'danger', label: 'échec' },
  pending: { tone: 'warning', label: 'en cours' },
};

function amount(cents: number | null, currency: string): string {
  if (cents == null) return 'sur devis';
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

const INTERVAL: Record<string, string> = { month: 'mois', year: 'an', one_time: 'unique', week: 'semaine', day: 'jour' };

const cell: React.CSSProperties = {
  padding: 'var(--space-4) var(--space-5)',
  borderBottom: '1px solid var(--border-subtle)',
  font: 'var(--type-body-sm)',
  verticalAlign: 'middle',
};

const head: React.CSSProperties = {
  textAlign: 'start', font: 'var(--type-caption)', color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
  padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-default)',
  background: 'var(--surface-sunken)',
};

export default async function StripePage() {
  const health = await getStripeHealth();
  const matched = health.products?.filter((p) => p.packKey).length ?? 0;
  const totalProducts = health.products?.length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 1240 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
        <StatTile
          label="Mode"
          value={health.mode === 'unknown' ? '—' : health.mode === 'test' ? 'Test' : 'Live'}
          unit={health.configured ? undefined : 'clé absente'}
          icon="credit-card"
        />
        <StatTile
          label="Produits appariés"
          value={health.products ? matched : '—'}
          unit={health.products ? `/ ${totalProducts}` : 'Stripe illisible'}
          icon="tag"
        />
        <StatTile
          label="Événements 24 h"
          value={health.eventCounts.total24h}
          unit={`${health.eventCounts.duplicates24h} rejoués, ${health.eventCounts.failed24h} en échec`}
          icon="arrow-up-down"
        />
        <StatTile label="Abonnements actifs" value={health.activeSubscriptions} unit="tfb_subscriptions" icon="users" />
      </div>

      {!health.keys[1]!.present && (
        <Card tone="sunken" padding="md">
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <Icon name="triangle-alert" size={18} style={{ color: 'var(--text-warning)', marginTop: 2 }} />
            <div style={{ font: 'var(--type-body-sm)' }}>
              <b>STRIPE_WEBHOOK_SECRET est absent.</b>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                Chaque appel entrant est refusé — un webhook non vérifié ne doit jamais écrire en base.
                Tant qu’il manque, un paiement aboutit chez Stripe sans jamais créer d’abonnement ici,
                et rien d’autre ne le signale.
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card title="Configuration" subtitle="Lue à chaud. Les clés vivent sur le serveur, jamais dans le dépôt." padding="none">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {health.keys.map((key) => (
              <tr key={key.name}>
                <td style={{ ...cell, width: 300 }}>
                  <div className="fb-num" style={{ font: 'var(--weight-medium) var(--text-sm)/1.3 var(--font-mono)' }}>{key.name}</div>
                  <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{key.purpose}</div>
                </td>
                <td style={{ ...cell }}>
                  <span className="fb-num" style={{ color: key.hint ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {key.hint ?? '—'}
                  </span>
                </td>
                <td style={{ ...cell, textAlign: 'end' }}>
                  <Badge tone={key.present ? 'success' : 'danger'} size="sm" dot>
                    {key.present ? 'présente' : 'absente'}
                  </Badge>
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ ...cell, borderBottom: 0 }}>
                <div style={{ font: 'var(--weight-medium) var(--text-base)/1.3 var(--font-sans)' }}>Compte</div>
                <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>Renvoyé par Stripe à la connexion</div>
              </td>
              <td style={{ ...cell, borderBottom: 0 }}>
                <span className="fb-num" style={{ color: health.account ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                  {health.account ? `${health.account.id}${health.account.name ? ` · ${health.account.name}` : ''}` : health.accountError ?? '—'}
                </span>
              </td>
              <td style={{ ...cell, borderBottom: 0, textAlign: 'end' }}>
                {health.account
                  ? <Badge tone={health.account.chargesEnabled ? 'success' : 'warning'} size="sm">
                      {health.account.chargesEnabled ? 'encaissements actifs' : 'encaissements désactivés'}
                    </Badge>
                  : <Badge tone="neutral" size="sm">non joint</Badge>}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card
        title="Produits Stripe et packs"
        subtitle="Ce que Stripe facture, en face de ce que nous ouvrons. L’appariement se fait sur stripe_product_id."
        padding="none"
      >
        {!health.products ? (
          <div style={{ padding: 'var(--space-5)', font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
            {health.productsReason ?? 'Stripe n’a pas pu être lu.'} Aucun produit n’est affiché — ce qui n’est
            pas la même chose qu’un catalogue vide.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Produit Stripe', 'Prix', 'Pack', 'État'].map((h) => <th key={h} style={head}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {health.products.map(({ product, packKey }) => (
                <tr key={product.id}>
                  <td style={cell}>
                    <div style={{ font: 'var(--weight-medium) var(--text-base)/1.3 var(--font-sans)' }}>{product.name}</div>
                    <div className="fb-num" style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>{product.id}</div>
                  </td>
                  <td style={cell}>
                    {product.prices.length === 0
                      ? <span style={{ color: 'var(--text-tertiary)' }}>aucun prix actif</span>
                      : product.prices.map((p) => (
                        <div key={p.id} className="fb-num">
                          {amount(p.amount, p.currency)}{' '}
                          <span style={{ color: 'var(--text-tertiary)' }}>/ {INTERVAL[p.interval] ?? p.interval}</span>
                        </div>
                      ))}
                  </td>
                  <td style={cell}>
                    {packKey
                      ? <Badge tone="brand" size="sm">{packKey}</Badge>
                      : <span style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>aucun</span>}
                  </td>
                  <td style={cell}>
                    <Badge tone={packKey ? 'success' : 'warning'} size="sm">{packKey ? 'apparié' : 'aucun pack'}</Badge>
                  </td>
                </tr>
              ))}
              {health.products.length === 0 && (
                <tr><td style={{ ...cell, color: 'var(--text-secondary)' }} colSpan={4}>
                  Stripe répond, et ne renvoie aucun produit actif.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
        {health.orphanPacks.length > 0 && (
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-subtle)', font: 'var(--type-body-sm)' }}>
            <b>{health.orphanPacks.length} pack(s) pointent sur un produit que Stripe ne renvoie pas</b> —{' '}
            <span className="fb-num">{health.orphanPacks.map((p) => `${p.key} → ${p.stripeProductId}`).join(', ')}</span>.
            <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
              Signalé, jamais désactivé d’office : un produit archivé côté Stripe et un produit filtré par
              cette lecture se ressemblent, et se tromper ferme un pack qui se vend.
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Événements reçus"
        subtitle="tfb_stripe_events — l’identifiant est unique, donc un renvoi de Stripe ne s’applique pas deux fois."
        padding="none"
      >
        {health.events.length === 0 ? (
          <div style={{ padding: 'var(--space-5)', font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
            Aucun événement reçu. Si des paiements ont lieu, c’est que le webhook n’est pas branché côté
            Stripe, ou qu’il est refusé faute de secret de signature.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Type', 'Identifiant', 'Reçu', 'Résultat'].map((h) => <th key={h} style={head}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {health.events.map((event) => {
                const outcome = OUTCOME[event.outcome] ?? { tone: 'neutral' as const, label: event.outcome };
                return (
                  <tr key={event.id}>
                    <td style={cell}><span className="fb-num">{event.type}</span></td>
                    <td style={{ ...cell, color: 'var(--text-tertiary)' }}><span className="fb-num">{event.stripeEventId}</span></td>
                    <td style={{ ...cell, color: 'var(--text-secondary)' }}>
                      <span className="fb-num">{event.receivedAt.toLocaleString('fr-FR')}</span>
                    </td>
                    <td style={cell}>
                      <Badge tone={outcome.tone} size="sm">{outcome.label}</Badge>
                      {event.detail && (
                        <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>{event.detail}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
