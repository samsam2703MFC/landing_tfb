import { probeAll } from '@/lib/connectors/probe';
import { ConnectorsScreen } from '@/components/admin/ConnectorScreens';

/**
 * §19 — Système → Connexions → Connecteurs.
 *
 * Probes run on render, cached 30 seconds inside `probeAll` so a refresh does not
 * fire six network calls. None of them writes anything.
 */
export default async function ConnectorsPage() {
  return <ConnectorsScreen connectors={await probeAll()} />;
}
