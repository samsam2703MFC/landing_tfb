'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Icon, IconButton, Input, Switch, Toast } from '@/design-system';
import type { CommercialSettings, Collection } from '@/lib/commercial/settings';
import { SourceNote } from './shared';

/**
 * §16 — the three reference lists behind a commercial offer.
 *
 * They are edited on one screen because they are read as one configuration: a
 * stage list without its services is half a setup. Each list deactivates rather
 * than deletes by default — a stage that vanishes takes the reading of past deals
 * with it.
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

async function errorOf(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? 'Opération impossible.';
}

function euros(cents: number | null, currency: string): string {
  if (cents == null) return 'Sur devis';
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

interface Row {
  id: number;
  key: string;
  title: string;
  detail: string;
  isActive: boolean;
  badge?: React.ReactNode;
}

function ListCard({
  title, description, rows, collection, fields, flash, footnote,
}: {
  title: string;
  description: string;
  rows: Row[];
  collection: Collection;
  /** The extra input beyond key + label, if the list has one. */
  fields?: { label: string; placeholder: string; hint?: string; name: 'amount' | 'vatNumber' };
  flash: (t: NonNullable<ToastState>) => void;
  footnote: string;
}) {
  const router = useRouter();
  const [key, setKey] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [extra, setExtra] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const create = async () => {
    setBusy(true);
    const payload: Record<string, unknown> = { collection, key: key.trim(), label: label.trim() };
    if (fields?.name === 'amount') {
      // Blank means "quoted case by case", which is not zero.
      payload.amount = extra.trim() === '' ? null : Math.round(Number(extra.replace(',', '.')) * 100);
    }
    if (fields?.name === 'vatNumber') payload.vatNumber = extra.trim() || null;

    const response = await fetch('/api/admin/commercial/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Ajout refusé', message: await errorOf(response) });
      return;
    }
    setKey(''); setLabel(''); setExtra('');
    router.refresh();
  };

  const toggle = async (row: Row, isActive: boolean) => {
    const response = await fetch(`/api/admin/commercial/settings/${collection}/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Modification refusée', message: await errorOf(response) });
      return;
    }
    router.refresh();
  };

  const remove = async (row: Row) => {
    const response = await fetch(`/api/admin/commercial/settings/${collection}/${row.id}`, { method: 'DELETE' });
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Suppression refusée', message: await errorOf(response) });
      return;
    }
    flash({ tone: 'info', title: 'Supprimé', message: `« ${row.key} » n’était référencé nulle part.` });
    router.refresh();
  };

  const amountInvalid = fields?.name === 'amount' && extra.trim() !== '' && Number.isNaN(Number(extra.replace(',', '.')));

  return (
    <Card padding="none">
      <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ font: 'var(--type-title)' }}>{title}</h2>
        <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>{description}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.length === 0 && (
          <div style={{ padding: 'var(--space-5)', font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
            Liste vide.
          </div>
        )}
        {rows.map((row) => (
          <div key={row.id} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)',
            opacity: row.isActive ? 1 : 0.55,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <span style={{ font: 'var(--weight-medium) var(--text-base)/1.25 var(--font-sans)' }}>{row.title}</span>
              <span style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>
                <span className="fb-num">{row.key}</span>{row.detail ? ` · ${row.detail}` : ''}
              </span>
            </div>
            {row.badge}
            <Switch checked={row.isActive} onChange={(checked) => toggle(row, checked)} size="sm" />
            <IconButton icon="trash-2" label="Supprimer" size="sm" onClick={() => remove(row)} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', padding: 'var(--space-4) var(--space-5)' }}>
        <Input label="Clé" value={key} onChange={(e) => setKey(e.target.value)} placeholder="prospection" style={{ flex: 1 }} />
        <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Prospection" style={{ flex: 2 }} />
        {fields && (
          <Input
            label={fields.label}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={fields.placeholder}
            hint={fields.hint}
            error={amountInvalid ? 'Montant invalide.' : undefined}
            style={{ flex: 1 }}
          />
        )}
        <Button onClick={create} disabled={busy || !key.trim() || !label.trim() || amountInvalid}>Ajouter</Button>
      </div>

      <div style={{ padding: '0 var(--space-5) var(--space-5)' }}>
        <SourceNote>{footnote}</SourceNote>
      </div>
    </Card>
  );
}

export function CommercialSettingsScreen({ settings }: { settings: CommercialSettings }) {
  const { flash, slot } = useToast();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 1240 }}>
      <Card tone="sunken" padding="md">
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <Icon name="info" size={18} style={{ color: 'var(--text-brand)', marginTop: 2 }} />
          <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
            <b style={{ color: 'var(--text-primary)' }}>Les offres ne sont pas ici : une offre est un pack.</b>{' '}
            Ce qu’un client achète, ce qu’il paie et ce que ça lui ouvre se règlent sur{' '}
            <Link href="/admin/packs" style={{ color: 'var(--text-brand)' }}>Packs &amp; modules</Link>. Cet écran ne tient
            que le vocabulaire autour : les étapes du cycle, les prestations vendues à côté, et qui facture.
          </div>
        </div>
      </Card>

      <ListCard
        title="Étapes du cycle commercial"
        description="L’ordre dans lequel un deal avance. Désactiver une étape la retire des choix sans réécrire les deals passés."
        collection="stages"
        rows={settings.stages.map((s) => ({
          id: s.id, key: s.key, title: s.label, detail: `rang ${s.sortOrder}`, isActive: s.isActive,
        }))}
        flash={flash}
        footnote="tfb_sales_stages."
      />

      <ListCard
        title="Prestations"
        description="Ce qui se vend avec une offre — installation, formation, reprise de données."
        collection="services"
        fields={{ label: 'Montant (€)', placeholder: '490', hint: 'Vide = sur devis, ce qui n’est pas la même chose que gratuit.', name: 'amount' }}
        rows={settings.services.map((s) => ({
          id: s.id, key: s.key, title: s.label, detail: euros(s.amount, s.currency), isActive: s.isActive,
          badge: s.amount == null ? <Badge tone="info" size="sm">sur devis</Badge> : undefined,
        }))}
        flash={flash}
        footnote="tfb_services. Les montants sont stockés en centimes."
      />

      <ListCard
        title="Sociétés de facturation"
        description="L’entité légale qui émet la facture. Une seule peut être celle par défaut."
        collection="billing-entities"
        fields={{ label: 'N° de TVA', placeholder: 'BE0123456789', name: 'vatNumber' }}
        rows={settings.billingEntities.map((e) => ({
          id: e.id, key: e.key, title: e.name, detail: e.vatNumber ?? 'TVA non renseignée', isActive: e.isActive,
          badge: e.isDefault ? <Badge tone="brand" size="sm">par défaut</Badge> : undefined,
        }))}
        flash={flash}
        footnote="tfb_billing_entities. La société par défaut ne peut pas être supprimée avant qu’une autre la remplace."
      />

      {slot}
    </div>
  );
}
