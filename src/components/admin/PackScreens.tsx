'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge, Button, Card, Checkbox, DataTable, Dialog, Icon, IconButton, Input, Select, StatTile, Textarea, Toast,
} from '@/design-system';
import type { LicenseModules, ModuleLabel, PackView } from '@/lib/licensing/queries';
import { LicenseStatusBadge } from './shared';

/**
 * Packs, their composition, and what a licence really opens (§7, §21).
 *
 * One rule shows up in three places on these screens, because it is the one that
 * surprises people: a pack is a Stripe product, but what it *grants* is written
 * here. Stripe says what is paid; we say what that opens.
 */

type ToastState = { tone: 'info' | 'success' | 'warning' | 'danger'; title: string; message: string } | null;

function useToast() {
  const [toast, setToast] = React.useState<ToastState>(null);
  const timer = React.useRef<number | undefined>(undefined);
  const flash = React.useCallback((next: NonNullable<ToastState>) => {
    setToast(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  const slot = toast ? (
    <div style={{ position: 'fixed', insetInlineEnd: 24, bottom: 24, zIndex: 80 }}>
      <Toast {...toast} onDismiss={() => setToast(null)} />
    </div>
  ) : null;
  return { flash, slot };
}

const INTERVAL_LABEL: Record<string, string> = { month: 'mois', year: 'an', one_time: 'unique' };

/** Cents → French euros. NULL is "sur devis", not zero. */
function price(amount: number | null, currency: string): string {
  if (amount == null) return 'Sur devis';
  return (amount / 100).toLocaleString('fr-FR', {
    style: 'currency', currency, minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  });
}

function priceLine(p: PackView['prices'][number]): string {
  return `${price(p.amount, p.currency)} / ${INTERVAL_LABEL[p.interval] ?? p.interval}`;
}

function ModuleChips({ modules, tone = 'on' }: { modules: ModuleLabel[]; tone?: 'on' | 'off' }) {
  if (modules.length === 0) return <span style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>—</span>;
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {modules.map((m) => (
        <span
          key={m.id}
          style={{
            font: 'var(--type-caption)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-xs)',
            ...(tone === 'on'
              ? { background: 'var(--surface-brand-subtle)', color: 'var(--text-brand)' }
              : { color: 'var(--text-tertiary)', border: '1px dashed var(--border-default)' }),
          }}
        >
          {m.name}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ Packs ---- */

export function PacksTable({ packs, fixture }: { packs: PackView[]; fixture: boolean }) {
  const router = useRouter();
  const { flash, slot } = useToast();
  const [q, setQ] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [key, setKey] = React.useState('');
  const [productId, setProductId] = React.useState('');
  const [kind, setKind] = React.useState('subscription');
  const [busy, setBusy] = React.useState(false);

  const rows = packs.filter((p) => `${p.key}${p.stripeProductId ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const unsellable = packs.filter((p) => !p.sellable);
  const licences = packs.reduce((sum, p) => sum + p.licenseCount, 0);

  const create = async () => {
    setBusy(true);
    const response = await fetch('/api/admin/packs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim(), stripeProductId: productId.trim() || null, kind }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; pack?: { id: number } };
    setBusy(false);
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Création refusée', message: body.error ?? 'Opération impossible.' });
      return;
    }
    setCreating(false);
    setKey(''); setProductId('');
    flash({ tone: 'success', title: 'Pack créé', message: 'Inactif et sans module — composez-le, puis activez-le.' });
    router.push(`/admin/packs/${body.pack!.id}`);
  };

  const resync = async () => {
    const response = await fetch('/api/admin/packs/sync-stripe', { method: 'POST' });
    const body = (await response.json().catch(() => ({}))) as {
      status?: string; reason?: string; prices?: number; orphans?: string[];
    };
    if (body.status === 'stub') {
      flash({ tone: 'warning', title: 'Stripe non configuré', message: body.reason ?? 'Aucun produit lu.' });
      return;
    }
    flash({
      tone: 'success',
      title: 'Prix resynchronisés',
      message: `${body.prices ?? 0} prix mis à jour${body.orphans?.length ? ` · ${body.orphans.length} produit(s) introuvable(s)` : ''}.`,
    });
    router.refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 1240 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
        <StatTile label="Packs vendables" value={packs.length - unsellable.length} unit={`/ ${packs.length}`} icon="tag" />
        <StatTile label="Licences" value={licences} unit="toutes marques" icon="lock" />
        <StatTile label="Modules au catalogue" value={new Set(packs.flatMap((p) => p.modules.map((m) => m.id))).size} unit="ouverts par un pack" icon="layers" />
        <StatTile label="Prix Stripe" value={packs.reduce((s, p) => s + p.prices.length, 0)} unit="variantes" icon="credit-card" />
      </div>

      {unsellable.length > 0 && (
        <Card tone="sunken" padding="md">
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <Icon name="triangle-alert" size={18} style={{ color: 'var(--text-warning)', marginTop: 2 }} />
            <div style={{ font: 'var(--type-body-sm)' }}>
              <b>{unsellable.length} pack(s) non vendable(s)</b> — {unsellable.map((p) => p.key).join(', ')}.
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                Un pack sans produit Stripe, sans prix, ou inactif ne peut pas être souscrit et n’apparaît pas
                sur la landing. Rattachez un produit et un prix, puis activez-le.
              </div>
            </div>
          </div>
        </Card>
      )}

      <DataTable<PackView & Record<string, unknown>>
        columns={[
          {
            key: 'key', label: 'Pack', sortable: true,
            render: (r) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ font: 'var(--weight-medium) var(--text-base)/1.3 var(--font-sans)' }}>{r.key}</span>
                <span className="fb-num" style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>
                  {r.kind}
                </span>
              </div>
            ),
          },
          {
            key: 'stripeProductId', label: 'Produit Stripe',
            render: (r) => (r.stripeProductId
              ? <span className="fb-num" style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>{r.stripeProductId}</span>
              : <Badge tone="warning" size="sm">aucun produit</Badge>),
          },
          {
            key: 'prices', label: 'Prix',
            render: (r) => (r.prices.length === 0
              ? <Badge tone="warning" size="sm">aucun prix</Badge>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {r.prices.map((p) => (
                    <span key={p.id} className="fb-num" style={{ font: 'var(--type-body-sm)' }}>{priceLine(p)}</span>
                  ))}
                </div>
              )),
          },
          { key: 'modules', label: 'Modules ouverts', width: '28%', render: (r) => <ModuleChips modules={r.modules} /> },
          { key: 'licenseCount', label: 'Licences', align: 'right', sortable: true, render: (r) => <span className="fb-num">{r.licenseCount}</span> },
          {
            key: 'isActive', label: 'État',
            render: (r) => (r.sellable
              ? <Badge tone="success" size="sm" dot>vendable</Badge>
              : <Badge tone="warning" size="sm" dot>non vendable</Badge>),
          },
          {
            key: 'actions', label: '', align: 'right', width: 72,
            render: (r) => <IconButton icon="chevron-right" label="Composer" size="sm" onClick={() => router.push(`/admin/packs/${r.id}`)} />,
          },
        ]}
        rows={rows as (PackView & Record<string, unknown>)[]}
        keyField="id"
        total={packs.length}
        searchValue={q}
        onSearch={setQ}
        searchPlaceholder="Rechercher un pack"
        emptyLabel="Aucun pack. Créez-en un, puis composez-le."
        onRowClick={(r) => router.push(`/admin/packs/${r.id}`)}
        toolbar={
          <>
            <Button variant="secondary" iconLeft="arrow-up-down" onClick={resync}>Resynchroniser Stripe</Button>
            <Button iconLeft="plus" onClick={() => setCreating(true)}>Nouveau pack</Button>
          </>
        }
      />

      <span style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>
        tfb_packs · tfb_pack_prices · tfb_pack_modules. La colonne « Licences » vient du service de facturation
        {fixture ? ' (fixtures)' : ''} : un pack se joint à une licence par sa clé, égale au code du package.
      </span>

      {creating && (
        <Dialog
          title="Nouveau pack"
          description="Créé inactif et sans module. La clé doit être identique au code du package côté service de facturation — c’est elle qui relie une licence aux modules qu’elle ouvre."
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreating(false)}>Annuler</Button>
              <Button onClick={create} disabled={busy || key.trim() === ''}>Créer</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input label="Clé" value={key} onChange={(e) => setKey(e.target.value)} placeholder="business" hint="Minuscules, chiffres, tiret ou souligné." />
            <Input label="Produit Stripe" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="prod_…" hint="Facultatif ici, obligatoire pour activer le pack." />
            <Select
              label="Facturation"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              options={[
                { value: 'subscription', label: 'Abonnement' },
                { value: 'one_time', label: 'Paiement unique' },
                { value: 'addon', label: 'Option (add-on)' },
              ]}
            />
          </div>
        </Dialog>
      )}
      {slot}
    </div>
  );
}

/* ------------------------------------------------------------ Composition ---- */

export interface PackDetail {
  id: number;
  key: string;
  stripeProductId: string | null;
  kind: string;
  isActive: boolean;
  prices: { id: number; stripePriceId: string; amount: number | null; currency: string; interval: string; isDefault: boolean }[];
  moduleIds: number[];
}

export function PackComposer({
  pack, catalogue, licenseCount,
}: {
  pack: PackDetail;
  catalogue: ModuleLabel[];
  licenseCount: number;
}) {
  const router = useRouter();
  const { flash, slot } = useToast();
  const [selected, setSelected] = React.useState<Set<number>>(new Set(pack.moduleIds));
  const [busy, setBusy] = React.useState(false);

  const initial = React.useMemo(() => new Set(pack.moduleIds), [pack.moduleIds]);
  const dirty = selected.size !== initial.size || [...selected].some((id) => !initial.has(id));
  const removed = [...initial].filter((id) => !selected.has(id));

  // "Métier" modules are the verticals — they are sold on top, so they read as a
  // separate list rather than being lost among the ten SaaS ones.
  const metier = catalogue.filter((m) => (m.group ?? '').toLowerCase() === 'métier');
  const saas = catalogue.filter((m) => !metier.includes(m));

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    const response = await fetch(`/api/admin/packs/${pack.id}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleIds: [...selected] }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; added?: number; removed?: number };
    setBusy(false);
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Enregistrement refusé', message: body.error ?? 'Opération impossible.' });
      return;
    }
    flash({
      tone: 'success',
      title: 'Composition enregistrée',
      message: `${body.added ?? 0} ajouté(s), ${body.removed ?? 0} retiré(s) · ${licenseCount} licence(s) concernée(s).`,
    });
    router.refresh();
  };

  const list = (modules: ModuleLabel[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {modules.map((m) => (
        <label
          key={m.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3)', borderRadius: 'var(--radius-control)',
            border: '1px solid transparent', cursor: 'pointer',
            ...(selected.has(m.id)
              ? { background: 'var(--surface-brand-subtle)', borderColor: 'var(--plum-200)' }
              : {}),
          }}
        >
          <Checkbox checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
          <Icon name={m.icon ?? 'layers'} size={18} style={{ color: selected.has(m.id) ? 'var(--text-brand)' : 'var(--text-secondary)' }} />
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ font: 'var(--weight-medium) var(--text-base)/1.3 var(--font-sans)' }}>{m.name}</span>
            <span className="fb-num" style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>{m.key}</span>
          </span>
          {!m.isActive && <Badge tone="neutral" size="sm" style={{ marginInlineStart: 'auto' }}>hors ligne</Badge>}
        </label>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 1240 }}>
      <Card padding="lg">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ font: 'var(--type-heading-3)' }}>{pack.key}</h2>
            <div className="fb-num" style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>
              {pack.stripeProductId ?? 'aucun produit Stripe'} · {pack.kind}
            </div>
          </div>
          <div style={{ marginInlineStart: 'auto', textAlign: 'end' }}>
            {pack.prices.length === 0
              ? <Badge tone="warning" size="sm">aucun prix Stripe</Badge>
              : pack.prices.map((p) => (
                <div key={p.id} className="fb-num" style={{ font: 'var(--type-body-sm)' }}>
                  {price(p.amount, p.currency)} <span style={{ color: 'var(--text-tertiary)' }}>/ {INTERVAL_LABEL[p.interval] ?? p.interval}</span>
                </div>
              ))}
          </div>
          <Badge tone={pack.isActive ? 'success' : 'neutral'} dot>
            {licenseCount} licence{licenseCount > 1 ? 's' : ''}
          </Badge>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>
        <Card
          title="Modules SaaS"
          subtitle="Cochez ce que ce pack ouvre."
          actions={<Badge tone="brand" size="sm">{saas.filter((m) => selected.has(m.id)).length} sur {saas.length}</Badge>}
          padding="sm"
        >
          {list(saas)}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {metier.length > 0 && (
            <Card title="Modules métier" subtitle="Verticaux, vendus en supplément." padding="sm">
              {list(metier)}
            </Card>
          )}

          <Card tone="sunken" padding="md">
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              <Icon name="info" size={18} style={{ color: 'var(--blue-700)', marginTop: 2 }} />
              <div style={{ font: 'var(--type-body-sm)' }}>
                <b>Stripe dit ce qui est payé, nous disons ce que ça ouvre.</b>
                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                  Cette composition vit dans <span className="fb-num">tfb_pack_modules</span>. Les métadonnées
                  Stripe ne portent que la clé du pack, jamais la liste des droits.
                </div>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <Button variant="ghost" onClick={() => setSelected(new Set(pack.moduleIds))} disabled={!dirty}>Annuler</Button>
              <span style={{ marginInlineStart: 'auto' }} />
              <Button iconLeft="save" onClick={save} disabled={!dirty || busy}>Enregistrer</Button>
            </div>
            <p style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)', marginTop: 'var(--space-3)' }}>
              {removed.length > 0
                ? `Retirer ${removed.length} module(s) ferme leur accès chez ${licenseCount} client(s) au prochain cycle. Aucune donnée n’est supprimée : un réabonnement les retrouve intactes.`
                : `Toute modification s’applique aux ${licenseCount} licence(s) sur ce pack. Fermer un module masque l’écran et bloque ses endpoints, sans rien supprimer.`}
            </p>
          </Card>
        </div>
      </div>
      {slot}
    </div>
  );
}

/* -------------------------------------------------------------- Licences ---- */

const SOURCE_LABEL: Record<string, string> = {
  pack: 'ouvert par le pack',
  override: 'dérogation',
  status: 'fermé par le statut',
};

export function LicenseModulesPanel({
  rows, catalogue, fixture,
}: {
  rows: LicenseModules[];
  catalogue: ModuleLabel[];
  fixture: boolean;
}) {
  const router = useRouter();
  const { flash, slot } = useToast();
  const [target, setTarget] = React.useState<LicenseModules | null>(null);
  const [moduleId, setModuleId] = React.useState('');
  const [grant, setGrant] = React.useState('true');
  const [reason, setReason] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const liveOverrides = rows.flatMap((r) =>
    r.overrides.filter((o) => o.revokedAt == null).map((o) => ({ licence: r, override: o })),
  );

  const close = () => { setTarget(null); setModuleId(''); setReason(''); setExpiresAt(''); setGrant('true'); };

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    const response = await fetch(`/api/admin/licenses/${encodeURIComponent(target.license.id)}/overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleId: Number(moduleId),
        grant: grant === 'true',
        reason: reason.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Dérogation refusée', message: body.error ?? 'Opération impossible.' });
      return;
    }
    close();
    flash({ tone: 'success', title: 'Dérogation posée', message: 'Elle survivra au prochain webhook Stripe.' });
    router.refresh();
  };

  const revoke = async (licenseId: string, overrideId: number) => {
    const response = await fetch(
      `/api/admin/licenses/${encodeURIComponent(licenseId)}/overrides/${overrideId}`,
      { method: 'DELETE' },
    );
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Révocation refusée', message: body.error ?? 'Opération impossible.' });
      return;
    }
    flash({ tone: 'info', title: 'Dérogation révoquée', message: 'La licence retombe sur ce que dit son pack.' });
    router.refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 1240 }}>
      <Card
        title="Modules par licence"
        subtitle="Un magasin, une licence, un pack. Les modules ouverts en découlent."
        padding="none"
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Licence', 'Pack', 'Statut', 'Modules ouverts / fermés', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'start', font: 'var(--type-caption)', color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
                    padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-default)',
                    background: 'var(--surface-sunken)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.license.id}>
                <td style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ font: 'var(--weight-medium) var(--text-base)/1.3 var(--font-sans)' }}>
                    {r.license.store ?? 'Licence tenant'}
                  </div>
                  <div className="fb-num" style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>{r.license.id}</div>
                </td>
                <td style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {r.packFound
                    ? <Badge tone="neutral" size="sm">{r.packKey}</Badge>
                    : <Badge tone="warning" size="sm">{r.packKey} — aucun pack</Badge>}
                </td>
                <td style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <LicenseStatusBadge value={r.license.status} />
                </td>
                <td style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)', maxWidth: 360 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <ModuleChips modules={r.open} />
                    {r.closed.length > 0 && <ModuleChips modules={r.closed} tone="off" />}
                  </div>
                  {!r.packFound && (
                    <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)', marginTop: 4 }}>
                      Aucun pack ne porte la clé « {r.packKey} » — cette licence n’ouvre rien.
                    </div>
                  )}
                </td>
                <td style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'end' }}>
                  <Button variant="secondary" size="sm" iconLeft="plus" onClick={() => setTarget(r)}>Dérogation</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>
        <Card
          title="Dérogations"
          subtitle="Modules ouverts ou fermés hors pack. Le webhook Stripe ne les écrase pas."
          padding="md"
        >
          {liveOverrides.length === 0 ? (
            <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
              Aucune dérogation en cours. Les modules de ce client suivent exactement ce que disent ses packs.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {liveOverrides.map(({ licence, override }) => (
                <div
                  key={override.id}
                  style={{
                    display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
                    padding: 'var(--space-3)', borderRadius: 'var(--radius-control)',
                    background: 'var(--surface-sunken)', font: 'var(--type-body-sm)',
                  }}
                >
                  <Badge tone={override.grant ? 'brand' : 'danger'} size="sm">
                    {override.module?.name ?? `module ${override.moduleId}`} {override.grant ? 'ouvert' : 'fermé'}
                  </Badge>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{licence.license.store ?? 'Licence tenant'}</b> — {override.reason}
                    <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>
                      Posée le {new Date(override.createdAt).toLocaleDateString('fr-FR')} par {override.createdBy}
                      {override.expiresAt
                        ? ` · expire le ${new Date(override.expiresAt).toLocaleDateString('fr-FR')}`
                        : ' · sans échéance'}
                    </div>
                  </div>
                  <IconButton
                    icon="x"
                    label="Révoquer"
                    size="sm"
                    onClick={() => revoke(licence.license.id, override.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card tone="sunken" padding="md">
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <Icon name="lock" size={18} style={{ color: 'var(--blue-700)', marginTop: 2 }} />
            <div style={{ font: 'var(--type-body-sm)' }}>
              <b>Fermer un module ne supprime rien.</b>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                Les données restent en place et un réabonnement les retrouve intactes. Le masquage de
                l’interface n’est qu’un confort — chaque appel serveur revérifie la licence.
                {fixture && ' Les licences affichées viennent des fixtures.'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {target && (
        <Dialog
          title="Nouvelle dérogation"
          description={`${target.license.store ?? 'Licence tenant'} · ${target.license.id} · pack « ${target.packKey} »`}
          onClose={close}
          footer={
            <>
              <Button variant="ghost" onClick={close}>Annuler</Button>
              <Button onClick={submit} disabled={busy || !moduleId || reason.trim() === ''}>Poser la dérogation</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Select
              label="Module"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              options={[
                { value: '', label: 'Choisir un module' },
                ...catalogue.map((m) => ({ value: String(m.id), label: m.name })),
              ]}
            />
            <Select
              label="Effet"
              value={grant}
              onChange={(e) => setGrant(e.target.value)}
              options={[
                { value: 'true', label: 'Ouvrir ce module malgré le pack' },
                { value: 'false', label: 'Fermer ce module malgré le pack' },
              ]}
            />
            <Textarea
              label="Motif"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Pilote e-commerce, gratuit jusqu’au 31/12."
              hint="Obligatoire. Une dérogation sans motif est intraçable six mois plus tard."
            />
            <Input
              label="Échéance"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              hint="Facultative. Sans échéance, la dérogation reste jusqu’à sa révocation."
            />
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>
              Une dérogation existante sur le même module sera révoquée et remplacée ; l’ancienne ligne reste
              dans l’historique. Source : {SOURCE_LABEL.override}.
            </span>
          </div>
        </Dialog>
      )}
      {slot}
    </div>
  );
}
