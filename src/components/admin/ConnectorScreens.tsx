'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Icon, StatTile, Toast } from '@/design-system';
import type { ConnectorState, Check } from '@/lib/connectors/probe';
import type { Outcome } from '@/lib/connectors/registry';
import { OUTCOME_LABEL, OUTCOME_MEANING } from '@/lib/connectors/registry';
import { SourceNote } from './shared';

/**
 * §19 — Système → Connexions → Connecteurs.
 *
 * The screen is built around a distinction the rest of the console keeps making
 * and no page had yet stated: **not configured is a decision, down is an
 * accident.** Merged into one red dot they cost either a week hunting a fault that
 * does not exist, or a real outage nobody looked at. Hence four counters, four
 * colours, and two different buttons.
 *
 * The second idea is the « Sans lui » line. A lamp says a service is dead; it does
 * not say a customer can be charged without a subscription row being written. That
 * sentence is what makes someone act, so it sits on every row rather than behind a
 * click.
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

const TONE: Record<Outcome, { bg: string; fg: string; dot: string }> = {
  ok: { bg: 'var(--surface-success-subtle)', fg: 'var(--text-success)', dot: 'var(--text-success)' },
  degraded: { bg: 'var(--surface-warning-subtle)', fg: 'var(--text-warning)', dot: 'var(--amber-500)' },
  down: { bg: 'var(--surface-danger-subtle)', fg: 'var(--text-danger)', dot: 'var(--text-danger)' },
  unconfigured: { bg: 'var(--surface-sunken)', fg: 'var(--text-secondary)', dot: 'var(--slate-400)' },
};

function Lamp({ outcome, label }: { outcome: Outcome; label?: string }) {
  const tone = TONE[outcome];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none',
      font: 'var(--weight-medium) var(--text-xs)/1 var(--font-sans)',
      padding: label ? '5px 10px' : 5, borderRadius: 'var(--radius-pill)',
      background: tone.bg, color: tone.fg,
    }}>
      <span style={{ width: 7, height: 7, flex: 'none', borderRadius: '50%', background: tone.dot }} />
      {label}
    </span>
  );
}

function since(date: Date | string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `il y a ${seconds} s`;
  if (seconds < 3600) return `il y a ${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `il y a ${Math.round(seconds / 3600)} h`;
  return new Date(date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

const mono: React.CSSProperties = { font: 'var(--type-caption)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' };

async function runTest(key: string): Promise<{ ok: boolean; message: string; outcome?: Outcome }> {
  const response = await fetch(`/api/admin/connectors/${key}/test`, { method: 'POST' });
  const body = (await response.json().catch(() => ({}))) as { error?: string; connector?: ConnectorState };
  if (!response.ok) return { ok: false, message: body.error ?? 'Test impossible.' };
  return { ok: true, message: body.connector?.summary ?? 'Testé.', outcome: body.connector?.outcome };
}

const TOAST_TONE: Record<Outcome, 'success' | 'warning' | 'danger' | 'info'> = {
  ok: 'success', degraded: 'warning', down: 'danger', unconfigured: 'info',
};

/* ------------------------------------------------------------------ Liste ---- */

export function ConnectorsScreen({ connectors }: { connectors: ConnectorState[] }) {
  const router = useRouter();
  const { flash, slot } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  const count = (o: Outcome) => connectors.filter((c) => c.outcome === o).length;
  const degradedScreens = connectors
    .filter((c) => c.outcome !== 'ok')
    .reduce((sum, c) => sum + c.dependents.length, 0);

  const test = async (key: string) => {
    setBusy(key);
    const result = await runTest(key);
    setBusy(null);
    flash({
      tone: result.ok ? TOAST_TONE[result.outcome ?? 'unconfigured'] : 'danger',
      title: result.ok ? OUTCOME_LABEL[result.outcome ?? 'unconfigured'] : 'Test impossible',
      message: result.message,
    });
    router.refresh();
  };

  const testAll = async () => {
    setBusy('*');
    await Promise.all(connectors.map((c) => runTest(c.key)));
    setBusy(null);
    flash({ tone: 'info', title: 'Tous testés', message: `${connectors.length} connecteurs sondés.` });
    router.refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 1240 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
        <StatTile label="Opérationnels" value={count('ok')} unit={`/ ${connectors.length}`} icon="circle-check" />
        <StatTile label="Dégradés" value={count('degraded')} unit={OUTCOME_MEANING.degraded} icon="triangle-alert" />
        <StatTile label="En échec" value={count('down')} unit={OUTCOME_MEANING.down} icon="circle-alert" />
        <StatTile label="Non configurés" value={count('unconfigured')} unit={OUTCOME_MEANING.unconfigured} icon="pause" />
      </div>

      <Card tone="sunken" padding="md">
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <Icon name="info" size={18} style={{ color: 'var(--text-brand)', marginTop: 2 }} />
          <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
            <b style={{ color: 'var(--text-primary)' }}>« Non configuré » et « en échec » ne sont pas la même chose.</b>{' '}
            Le premier est une décision : personne n’a branché Stripe, et l’application le dit au lieu de faire
            semblant. Le second est un accident : la clé est là, le service répond mal. Les confondre sur un
            tableau de bord, c’est passer une semaine à chercher une panne qui n’existe pas — ou en ignorer une vraie.
            <b style={{ color: 'var(--text-primary)' }}> « Dégradé »</b> est le troisième cas, le plus discret : le
            connecteur répond, mais une pièce manque.
          </div>
        </div>
      </Card>

      <Card padding="none">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', padding: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 style={{ font: 'var(--type-title)' }}>Connecteurs</h2>
            <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
              Chaque dépendance externe, son état réel, et ce qui s’arrête quand elle s’arrête.
            </p>
          </div>
          <div style={{ marginInlineStart: 'auto' }}>
            <Button variant="secondary" iconLeft="arrow-up-down" onClick={testAll} disabled={busy !== null}>
              Tout tester
            </Button>
          </div>
        </div>

        {connectors.map((c) => (
          <div key={c.key} style={{
            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)',
            padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38,
              flex: 'none', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)',
              color: 'var(--text-secondary)',
            }}>
              <Icon name={c.icon} size={19} />
            </span>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                type="button"
                onClick={() => router.push(`/admin/system/connectors/${c.key}`)}
                style={{
                  font: 'var(--weight-semibold) var(--text-base)/1.3 var(--font-sans)', textAlign: 'start',
                  background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--text-primary)',
                }}
              >
                {c.name}
              </button>
              <span style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{c.what}</span>
              <span style={mono}>{c.env.join(' · ')}</span>
              <div style={{
                font: 'var(--type-caption)', marginTop: 4, paddingInlineStart: 'var(--space-3)',
                borderInlineStart: `2px solid ${c.outcome === 'ok' ? 'var(--border-default)' : 'var(--amber-500)'}`,
                color: c.outcome === 'ok' ? 'var(--text-secondary)' : 'var(--text-warning)',
              }}>
                <b>Sans lui :</b> {c.breaks}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flex: 'none' }}>
              <Lamp outcome={c.outcome} label={OUTCOME_LABEL[c.outcome]} />
              <span style={{ ...mono, textAlign: 'end', maxWidth: 280 }}>{c.summary}</span>
              <span style={mono}>
                vérifié {since(c.checkedAt)}{c.durationMs != null ? ` · ${c.durationMs} ms` : ''}
              </span>
              <Button
                variant="secondary"
                size="sm"
                iconLeft="arrow-up-down"
                onClick={() => test(c.key)}
                disabled={busy !== null}
              >
                {busy === c.key ? 'Test…' : 'Tester'}
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <SourceNote>
        Les secrets ne sont jamais affichés, jamais renvoyés par l’API, et jamais modifiables depuis cet écran :
        ils vivent dans <span className="fb-num">/etc/tfb-landing.env</span> sur le serveur. Cette page dit si une
        valeur est présente et si elle fonctionne — pas ce qu’elle vaut. {degradedScreens} route(s) ou écran(s)
        changent de comportement du fait des connecteurs non opérationnels.
      </SourceNote>

      {slot}
    </div>
  );
}

/* ------------------------------------------------------------------ Fiche ---- */

export interface HistoryRow {
  id: number;
  outcome: string;
  detail: string | null;
  durationMs: number | null;
  trigger: string;
  checkedAt: Date;
}

export function ConnectorScreen({ connector, history }: { connector: ConnectorState; history: HistoryRow[] }) {
  const router = useRouter();
  const { flash, slot } = useToast();
  const [busy, setBusy] = React.useState(false);

  const test = async () => {
    setBusy(true);
    const result = await runTest(connector.key);
    setBusy(false);
    flash({
      tone: result.ok ? TOAST_TONE[result.outcome ?? 'unconfigured'] : 'danger',
      title: result.ok ? OUTCOME_LABEL[result.outcome ?? 'unconfigured'] : 'Test impossible',
      message: result.message,
    });
    router.refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 1240 }}>
      <Card padding="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44,
            flex: 'none', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)',
            color: 'var(--text-secondary)',
          }}>
            <Icon name={connector.icon} size={21} />
          </span>
          <div>
            <div style={{ font: 'var(--type-heading-3)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--tracking-tight)' }}>
              {connector.name}
            </div>
            <div style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>{connector.what}</div>
          </div>
          <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Lamp outcome={connector.outcome} label={OUTCOME_LABEL[connector.outcome]} />
            <Button variant="secondary" iconLeft="arrow-up-down" onClick={test} disabled={busy}>
              {busy ? 'Test…' : 'Tester maintenant'}
            </Button>
          </div>
        </div>
      </Card>

      {connector.outcome !== 'ok' && (
        <Card tone="sunken" padding="md">
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <Icon
              name={connector.outcome === 'unconfigured' ? 'info' : 'triangle-alert'}
              size={18}
              style={{ color: TONE[connector.outcome].fg, marginTop: 2 }}
            />
            <div style={{ font: 'var(--type-body-sm)' }}>
              <b>{connector.summary}</b>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{connector.breaks}</div>
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 'var(--space-4)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card padding="none">
            <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ font: 'var(--type-title)' }}>Contrôles</h2>
              <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
                Exécutés à l’ouverture de l’écran (résultat mis en cache 30 secondes) et sur demande. Aucun n’écrit
                quoi que ce soit : lire un compte, compter une table, se voir refuser une clé volontairement invalide.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-5)' }}>
              {connector.checks.length === 0 && (
                <span style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>Aucun contrôle.</span>
              )}
              {connector.checks.map((check: Check) => (
                <div key={check.name} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-control)',
                  background: 'var(--surface-sunken)',
                }}>
                  <Lamp outcome={check.outcome} />
                  <span style={{ flex: 1, font: 'var(--type-body-sm)' }}>{check.name}</span>
                  <span style={{ ...mono, color: 'var(--text-secondary)', textAlign: 'end' }}>{check.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="none">
            <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ font: 'var(--type-title)' }}>Journal</h2>
              <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
                Les tests demandés. « Depuis quand » et « est-ce que ça clignote » sont les vraies questions, et un
                écran qui ne lit que le présent n’y répond pas.
              </p>
            </div>
            {history.length === 0 ? (
              <div style={{ padding: 'var(--space-5)', font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
                Aucun test enregistré. Les vérifications automatiques à l’ouverture ne sont pas journalisées — elles
                enterreraient les tests demandés sous du bruit.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id}>
                      <td style={{ ...mono, width: 160, padding: 'var(--space-2) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
                        {new Date(row.checkedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <Lamp outcome={row.outcome as Outcome} label={OUTCOME_LABEL[row.outcome as Outcome] ?? row.outcome} />
                      </td>
                      <td style={{ font: 'var(--type-caption)', padding: 'var(--space-2) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
                        {row.detail ?? '—'}
                        {row.durationMs != null && <span style={{ color: 'var(--text-tertiary)' }}> · {row.durationMs} ms</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <SourceNote>
                tfb_connector_checks. Ni charge utile, ni corps de réponse : ils portent des données client et des
                identifiants, et cette page est de celles qu’on ouvre en partageant son écran.
              </SourceNote>
            </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card padding="none">
            <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ font: 'var(--type-title)' }}>Configuration</h2>
              <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>Lecture seule.</p>
            </div>
            <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {connector.env.map((name) => (
                <div key={name} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'baseline' }}>
                  <span style={{ ...mono, color: 'var(--text-secondary)', flex: 1, minWidth: 0, wordBreak: 'break-all' }}>{name}</span>
                </div>
              ))}
              <p style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)', marginTop: 'var(--space-3)' }}>
                Ces valeurs vivent dans <span className="fb-num">/etc/tfb-landing.env</span> sur le serveur. Elles ne
                sont ni affichées en entier, ni renvoyées par l’API, ni modifiables ici — un back office qui édite ses
                propres secrets est un back office qui les expose. L’état de chacune se lit dans les contrôles.
              </p>
            </div>
          </Card>

          <Card padding="none">
            <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ font: 'var(--type-title)' }}>Ce qui en dépend</h2>
              <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
                Les écrans et les routes qui changent de comportement.
              </p>
            </div>
            <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {connector.dependents.map((d) => (
                <div key={d.name} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-control)',
                  background: 'var(--surface-sunken)',
                }}>
                  <span style={{ flex: 1, font: 'var(--type-body-sm)' }}>{d.name}</span>
                  <span style={{
                    font: 'var(--type-caption)',
                    color: connector.outcome === 'ok' ? 'var(--text-tertiary)' : 'var(--text-warning)',
                    textAlign: 'end',
                  }}>
                    {connector.outcome === 'ok' ? 'nominal' : d.whenBroken}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {slot}
    </div>
  );
}
