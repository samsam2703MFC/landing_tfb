'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge, Button, Card, DataTable, Dialog, Icon, IconButton, Input, Select, StatTile, Toast,
} from '@/design-system';
import type { AgentRow, AgentDetail, PlanOption } from '@/lib/commercial/queries';
import { REASON_LABEL, formatBp } from '@/lib/commercial/commission';
import { SourceNote } from './shared';

/**
 * Agents B2B and what they are owed (§17).
 *
 * The screens are built around one thing that is easy to get wrong and expensive
 * to discover late: **a commission that is not calculated must look different
 * from a commission of zero.** An unpaid invoice, an assignment with no plan and
 * a plan with a gap in its ladder all produce "no amount" — and each says why, on
 * its own line, rather than contributing a silent 0 to a total.
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

/** Cents → French euros. */
function euros(cents: number, currency = 'EUR'): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency });
}

function frDate(value: Date | string): string {
  return new Date(value).toLocaleDateString('fr-FR');
}

/** Reads an error message out of a failed admin API response. */
async function errorOf(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? 'Opération impossible.';
}

/* ----------------------------------------------------------------- Liste ---- */

export function AgentsTable({
  agents, plans, fixture,
}: {
  agents: AgentRow[];
  plans: PlanOption[];
  fixture: boolean;
}) {
  const router = useRouter();
  const { flash, slot } = useToast();
  const [q, setQ] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [kind, setKind] = React.useState('commercial');
  const [busy, setBusy] = React.useState(false);
  const [showPlans, setShowPlans] = React.useState(false);

  const rows = agents.filter((a) => `${a.name} ${a.email}`.toLowerCase().includes(q.toLowerCase()));
  const active = agents.filter((a) => a.isActive);
  const orphans = agents.filter((a) => a.withoutPlan > 0);
  const clients = agents.reduce((sum, a) => sum + a.clients, 0);
  const total = agents.reduce((sum, a) => sum + a.totalCents, 0);

  const create = async () => {
    setBusy(true);
    const response = await fetch('/api/admin/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), kind }),
    });
    setBusy(false);
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Création refusée', message: await errorOf(response) });
      return;
    }
    const body = (await response.json()) as { agent: { id: number } };
    setCreating(false);
    setName(''); setEmail('');
    router.push(`/admin/agents/${body.agent.id}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 1240 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
        <StatTile label="Agents actifs" value={active.length} unit={`/ ${agents.length}`} icon="users" />
        <StatTile label="Clients attribués" value={clients} unit="attributions ouvertes" icon="building-2" />
        <StatTile label="Commissions calculables" value={euros(total)} unit={fixture ? 'sur fixtures' : 'à ce jour'} icon="percent" />
        <StatTile label="Sans plan" value={orphans.reduce((s, a) => s + a.withoutPlan, 0)} unit="attributions" icon="triangle-alert" />
      </div>

      {orphans.length > 0 && (
        <Card tone="sunken" padding="md">
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <Icon name="triangle-alert" size={18} style={{ color: 'var(--text-warning)', marginTop: 2 }} />
            <div style={{ font: 'var(--type-body-sm)' }}>
              <b>
                {orphans.map((a) => `${a.name} (${a.withoutPlan})`).join(', ')} — attribution(s) sans plan de commission.
              </b>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                Rien ne se calcule pour ces clients : ni zéro, ni erreur. Leurs factures sortent du calcul en le
                disant, ligne par ligne, sur la fiche de l’agent. Rattachez un plan, ou fermez l’attribution.
              </div>
            </div>
          </div>
        </Card>
      )}

      <DataTable<AgentRow & Record<string, unknown>>
        columns={[
          {
            key: 'name', label: 'Agent', sortable: true,
            render: (r) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ font: 'var(--weight-medium) var(--text-base)/1.3 var(--font-sans)' }}>{r.name}</span>
                <span style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>{r.email}</span>
              </div>
            ),
          },
          {
            key: 'kind', label: 'Type',
            render: (r) => <Badge tone={r.kind === 'commercial' ? 'brand' : 'info'} size="sm">{r.kind}</Badge>,
          },
          { key: 'clients', label: 'Clients', align: 'right', sortable: true, render: (r) => <span className="fb-num">{r.clients}</span> },
          {
            key: 'planKeys', label: 'Plans',
            render: (r) => (r.planKeys.length === 0
              ? <Badge tone="warning" size="sm">aucun plan</Badge>
              : (
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {r.planKeys.map((k) => (
                    <span key={k} style={{
                      font: 'var(--type-caption)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-xs)',
                      background: 'var(--surface-brand-subtle)', color: 'var(--text-brand)',
                    }}>{k}</span>
                  ))}
                </span>
              )),
          },
          {
            key: 'totalCents', label: 'Calculé', align: 'right', sortable: true,
            render: (r) => <span className="fb-num" style={{ font: 'var(--weight-medium) var(--text-base)/1.3 var(--font-sans)' }}>
              {r.totalCents > 0 ? euros(r.totalCents) : '—'}
            </span>,
          },
          {
            key: 'isActive', label: 'État',
            render: (r) => (r.isActive
              ? <Badge tone="success" size="sm" dot>actif</Badge>
              : <Badge tone="neutral" size="sm" dot>inactif</Badge>),
          },
          {
            key: 'actions', label: '', align: 'right', width: 72,
            render: (r) => <IconButton icon="chevron-right" label="Ouvrir" size="sm" onClick={() => router.push(`/admin/agents/${r.id}`)} />,
          },
        ]}
        rows={rows as (AgentRow & Record<string, unknown>)[]}
        keyField="id"
        total={agents.length}
        searchValue={q}
        onSearch={setQ}
        searchPlaceholder="Rechercher un agent"
        emptyLabel="Aucun agent. Créez-en un, puis attribuez-lui des clients."
        onRowClick={(r) => router.push(`/admin/agents/${r.id}`)}
        toolbar={
          <>
            <Button variant="secondary" iconLeft="percent" onClick={() => setShowPlans(true)}>Plans de commission</Button>
            <Button iconLeft="plus" onClick={() => setCreating(true)}>Nouvel agent</Button>
          </>
        }
      />

      <SourceNote>
        tfb_agents · tfb_agent_assignments · tfb_commission_plans. La colonne « Calculé » additionne uniquement
        les factures encaissées{fixture ? ' des fixtures' : ''} : une facture émise et non payée n’y figure pas.
      </SourceNote>

      {creating && (
        <Dialog
          title="Nouvel agent"
          description="Un agent est créé sans client et sans plan. Le plan se rattache à l’attribution, pas à l’agent : le même agent peut être sur deux deals différents."
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreating(false)}>Annuler</Button>
              <Button onClick={create} disabled={busy || !name.trim() || !email.trim()}>Créer</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Claire Vasseur" />
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="claire@tfb.eu" hint="Unique — c’est l’identifiant de l’agent." />
            <Select
              label="Type"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              options={[
                { value: 'commercial', label: 'Commercial' },
                { value: 'technique', label: 'Technique' },
              ]}
            />
          </div>
        </Dialog>
      )}

      {showPlans && <PlansDialog plans={plans} onClose={() => setShowPlans(false)} flash={flash} />}
      {slot}
    </div>
  );
}

/* ------------------------------------------------------------------ Plans ---- */

function PlansDialog({
  plans, onClose, flash,
}: {
  plans: PlanOption[];
  onClose: () => void;
  flash: (t: NonNullable<ToastState>) => void;
}) {
  const router = useRouter();
  const [key, setKey] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [ladder, setLadder] = React.useState('0:90, 12:20');
  const [busy, setBusy] = React.useState(false);

  /** "0:90, 12:20" → tiers in basis points. A free-text ladder beats six inputs. */
  const parse = (text: string): { fromMonth: number; percentBp: number }[] | null => {
    const tiers: { fromMonth: number; percentBp: number }[] = [];
    for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
      const match = /^(\d+)\s*:\s*(\d+(?:[.,]\d+)?)$/.exec(part);
      if (!match) return null;
      const percent = Number(match[2]!.replace(',', '.'));
      if (percent > 100) return null;
      tiers.push({ fromMonth: Number(match[1]), percentBp: Math.round(percent * 100) });
    }
    return tiers;
  };

  const tiers = parse(ladder);

  const create = async () => {
    if (!tiers) return;
    setBusy(true);
    const response = await fetch('/api/admin/commission-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim(), label: label.trim() || key.trim(), tiers }),
    });
    setBusy(false);
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Plan refusé', message: await errorOf(response) });
      return;
    }
    setKey(''); setLabel('');
    flash({ tone: 'success', title: 'Plan créé', message: 'Il peut maintenant être rattaché à une attribution.' });
    router.refresh();
  };

  const remove = async (plan: PlanOption) => {
    const response = await fetch(`/api/admin/commission-plans/${plan.id}`, { method: 'DELETE' });
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Suppression refusée', message: await errorOf(response) });
      return;
    }
    flash({ tone: 'success', title: 'Plan supprimé', message: `« ${plan.key} » n’était utilisé par aucune attribution.` });
    router.refresh();
  };

  return (
    <Dialog
      title="Plans de commission"
      description="Un plan est nommé et réutilisable. Modifier un palier change les calculs à venir ; les commissions déjà arrêtées gardent le taux appliqué."
      onClose={onClose}
      footer={<Button variant="ghost" onClick={onClose}>Fermer</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 520 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {plans.length === 0 && (
            <span style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
              Aucun plan. Sans plan, une attribution ne calcule rien.
            </span>
          )}
          {plans.map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-control)',
              background: 'var(--surface-sunken)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ font: 'var(--weight-medium) var(--text-base)/1.25 var(--font-sans)' }}>{p.label}</span>
                <span style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>
                  <span className="fb-num">{p.key}</span> · {p.assignments} attribution(s)
                </span>
              </div>
              <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {p.tiers.map((t) => (
                  <span key={t.fromMonth} className="fb-num" style={{
                    font: 'var(--weight-semibold) var(--text-sm)/1 var(--font-mono)',
                    padding: '4px var(--space-3)', borderRadius: 'var(--radius-chip)',
                    background: 'var(--surface-brand-subtle)', color: 'var(--text-brand)',
                  }}>
                    m{t.fromMonth}+ · {formatBp(t.percentBp)}
                  </span>
                ))}
              </span>
              {!p.coversMonthZero && <Badge tone="warning" size="sm">pas de palier au mois 0</Badge>}
              <IconButton icon="trash-2" label="Supprimer" size="sm" onClick={() => remove(p)} />
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Input label="Clé" value={key} onChange={(e) => setKey(e.target.value)} placeholder="90-20" hint="Minuscules, chiffres, tiret ou souligné." />
          <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="90 % la première année, puis 20 %" />
          <Input
            label="Paliers"
            value={ladder}
            onChange={(e) => setLadder(e.target.value)}
            placeholder="0:90, 12:20"
            hint="mois:pourcentage, séparés par des virgules. « 0:90, 12:20 » = 90 % du mois 0 au mois 11, puis 20 %."
            error={ladder.trim() !== '' && !tiers ? 'Format attendu : mois:pourcentage (0–100), séparés par des virgules.' : undefined}
          />
          <div>
            <Button onClick={create} disabled={busy || !key.trim() || !tiers || tiers.length === 0}>Ajouter le plan</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Fiche ---- */

export function AgentScreen({
  detail, plans, tenants,
}: {
  detail: AgentDetail;
  plans: PlanOption[];
  tenants: { slug: string; name: string; heldBy: string | null }[];
}) {
  const router = useRouter();
  const { flash, slot } = useToast();
  const [assigning, setAssigning] = React.useState(false);
  const [slug, setSlug] = React.useState('');
  const [planId, setPlanId] = React.useState('');
  const [startedAt, setStartedAt] = React.useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = React.useState(false);

  const { agent, assignments, lines, totalCents, settleable, fixture } = detail;
  const open = assignments.filter((a) => a.endedAt == null);
  const paid = lines.filter((l) => l.reason === 'ok');
  const initials = agent.name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();

  const assign = async () => {
    setBusy(true);
    const response = await fetch(`/api/admin/agents/${agent.id}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: slug,
        planId: planId ? Number(planId) : null,
        startedAt: new Date(`${startedAt}T00:00:00Z`).toISOString(),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Attribution refusée', message: await errorOf(response) });
      return;
    }
    setAssigning(false);
    setSlug('');
    flash({ tone: 'success', title: 'Client attribué', message: 'L’ancienneté part de la date choisie, pas d’aujourd’hui.' });
    router.refresh();
  };

  const close = async (assignmentId: number) => {
    const response = await fetch(`/api/admin/agents/${agent.id}/assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endedAt: new Date().toISOString() }),
    });
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Clôture refusée', message: await errorOf(response) });
      return;
    }
    flash({ tone: 'info', title: 'Attribution close', message: 'Les commissions déjà calculées restent lisibles.' });
    router.refresh();
  };

  const setPlan = async (assignmentId: number, value: string) => {
    const response = await fetch(`/api/admin/agents/${agent.id}/assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: value ? Number(value) : null }),
    });
    if (!response.ok) {
      flash({ tone: 'danger', title: 'Modification refusée', message: await errorOf(response) });
      return;
    }
    router.refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 1240 }}>
      <Card padding="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46,
            borderRadius: 'var(--radius-circle)', background: 'var(--surface-brand-subtle)',
            color: 'var(--text-brand)', font: 'var(--weight-semibold) var(--text-base)/1 var(--font-sans)',
          }}>{initials}</span>
          <div>
            <div style={{ font: 'var(--type-heading-3)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--tracking-tight)' }}>
              {agent.name}
            </div>
            <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>
              Agent {agent.kind} · {agent.email} · depuis le {frDate(agent.createdAt)}
            </div>
          </div>
          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            {agent.isActive ? <Badge tone="success" size="sm" dot>actif</Badge> : <Badge tone="neutral" size="sm" dot>inactif</Badge>}
            <Badge tone="brand" size="sm">{open.length} client(s)</Badge>
            <Button iconLeft="plus" onClick={() => setAssigning(true)}>Attribuer un client</Button>
          </div>
        </div>
      </Card>

      {!settleable && (
        <Card tone="sunken" padding="md">
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <Icon name="triangle-alert" size={18} style={{ color: 'var(--text-warning)', marginTop: 2 }} />
            <div style={{ font: 'var(--type-body-sm)' }}>
              <b>Ces montants ne peuvent pas être arrêtés.</b>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                {fixture
                  ? 'Les factures viennent des fixtures, pas du service de facturation. Arrêter une commission sur des chiffres inventés, c’est payer quelqu’un sur une facture que personne n’a émise — l’export est donc refusé.'
                  : 'Le service de facturation n’est pas joignable. L’export attend des chiffres qu’il a confirmés.'}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 'var(--space-4)', alignItems: 'start' }}>
        <Card padding="none">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', padding: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <h2 style={{ font: 'var(--type-title)' }}>Commissions calculées</h2>
              <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
                Une ligne par facture. Le taux vient de l’ancienneté de l’attribution, pas de la date du jour.
              </p>
            </div>
            <div style={{ marginInlineStart: 'auto' }}>
              <Button variant="secondary" iconLeft="download" disabled={!settleable}>Exporter</Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
              Aucune facture sur les clients de cet agent.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Client et facture', 'Ancienneté', 'Taux', 'Facturé', 'Commission'].map((h, i) => (
                    <th key={h} style={{
                      font: 'var(--type-caption)', color: 'var(--text-tertiary)', textTransform: 'uppercase',
                      letterSpacing: '0.04em', textAlign: i > 0 ? 'end' : 'start',
                      padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={`${line.invoiceId}-${line.tenantSlug}`}>
                    <td style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ font: 'var(--weight-medium) var(--text-base)/1.3 var(--font-sans)' }}>{line.invoice.tenant}</div>
                      <div style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>
                        {line.packKey ? `${line.packKey} · ` : ''}{line.invoice.period}
                      </div>
                      {line.reason !== 'ok' && (
                        <div style={{ font: 'var(--type-caption)', color: 'var(--text-warning)', marginTop: 2 }}>
                          {REASON_LABEL[line.reason]}
                        </div>
                      )}
                    </td>
                    <td className="fb-num" style={{ textAlign: 'end', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {line.months == null ? '—' : `mois ${line.months}`}
                    </td>
                    <td style={{ textAlign: 'end', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {line.percentBp == null ? <span style={{ color: 'var(--text-tertiary)' }}>—</span> : (
                        <span className="fb-num" style={{
                          font: 'var(--weight-semibold) var(--text-sm)/1 var(--font-mono)',
                          padding: '4px var(--space-3)', borderRadius: 'var(--radius-chip)',
                          background: 'var(--surface-brand-subtle)', color: 'var(--text-brand)',
                        }}>{formatBp(line.percentBp)}</span>
                      )}
                    </td>
                    <td className="fb-num" style={{ textAlign: 'end', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {euros(Math.round(line.invoice.amount_due * 100), line.invoice.currency)}
                    </td>
                    <td className="fb-num" style={{
                      textAlign: 'end', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)',
                      font: 'var(--weight-medium) var(--text-base)/1.3 var(--font-sans)',
                      color: line.amount == null ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    }}>
                      {line.amount == null ? '—' : euros(line.amount, line.invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
              {paid.length} facture(s) commissionnées sur {lines.length}
            </span>
            <span style={{ marginInlineStart: 'auto', font: 'var(--weight-semibold) var(--text-lg)/1.2 var(--font-sans)' }} className="fb-num">
              {euros(totalCents)}
            </span>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card padding="none">
            <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ font: 'var(--type-title)' }}>Attributions</h2>
              <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
                Un client, un plan, une date de départ. C’est cette date qui décide du palier.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {assignments.length === 0 && (
                <div style={{ padding: 'var(--space-5)', font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
                  Aucun client attribué.
                </div>
              )}
              {assignments.map((a) => (
                <div key={a.id} style={{
                  display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                  padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)',
                  opacity: a.endedAt ? 0.6 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ font: 'var(--weight-medium) var(--text-base)/1.25 var(--font-sans)', flex: 1, minWidth: 0 }}>{a.tenantName}</span>
                    {a.endedAt
                      ? <Badge tone="neutral" size="sm">close le {frDate(a.endedAt)}</Badge>
                      : <IconButton icon="x" label="Clore l’attribution" size="sm" onClick={() => close(a.id)} />}
                  </div>
                  <span style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>
                    depuis le {frDate(a.startedAt)}{a.packKey ? ` · limitée au pack ${a.packKey}` : ''}
                  </span>
                  <Select
                    value={String(plans.find((p) => p.key === a.planKey)?.id ?? '')}
                    onChange={(e) => setPlan(a.id, e.target.value)}
                    options={[
                      { value: '', label: 'Aucun plan — rien n’est calculé' },
                      ...plans.map((p) => ({ value: String(p.id), label: p.label })),
                    ]}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card tone="sunken" padding="md">
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              <Icon name="info" size={18} style={{ color: 'var(--text-brand)', marginTop: 2 }} />
              <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
                <b style={{ color: 'var(--text-primary)' }}>L’ancienneté se compte depuis l’attribution, pas depuis la facture.</b>{' '}
                Un client repris par un autre agent redémarre au premier palier chez lui, et l’ancienne attribution
                se ferme à la date de reprise — sans quoi deux agents toucheraient sur la même facture.
              </div>
            </div>
          </Card>
        </div>
      </div>

      <SourceNote>
        tfb_agent_assignments · tfb_commission_plans · tfb_commission_tiers. Les factures viennent du service de
        facturation{fixture ? ' (fixtures)' : ''} ; les taux sont stockés en points de base, jamais en flottants.
      </SourceNote>

      {assigning && (
        <Dialog
          title="Attribuer un client"
          description="Si un autre agent détient déjà ce client, son attribution se ferme à la date choisie : deux attributions ouvertes paieraient deux agents sur la même facture."
          onClose={() => setAssigning(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setAssigning(false)}>Annuler</Button>
              <Button onClick={assign} disabled={busy || !slug}>Attribuer</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 460 }}>
            <Select
              label="Client"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              options={[
                { value: '', label: 'Choisir un client…' },
                ...tenants.map((t) => ({
                  value: t.slug,
                  label: t.heldBy ? `${t.name} — détenu par ${t.heldBy}` : t.name,
                })),
              ]}
            />
            <Select
              label="Plan de commission"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              options={[
                { value: '', label: 'Aucun — rien ne sera calculé' },
                ...plans.filter((p) => p.isActive).map((p) => ({ value: String(p.id), label: p.label })),
              ]}
            />
            <Input
              label="Début de l’attribution"
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              hint="C’est de cette date que part l’ancienneté, donc le palier. Une antidate se choisit, elle ne se devine pas."
            />
          </div>
        </Dialog>
      )}
      {slot}
    </div>
  );
}
