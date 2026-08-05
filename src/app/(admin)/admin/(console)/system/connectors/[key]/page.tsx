import { notFound } from 'next/navigation';
import { probeConnector, connectorHistory } from '@/lib/connectors/probe';
import { connectorMeta } from '@/lib/connectors/registry';
import { ConnectorScreen } from '@/components/admin/ConnectorScreens';

/** One connector: its checks, its history, and what depends on it (§19). */
export default async function ConnectorPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!connectorMeta(key)) notFound();

  const [connector, history] = await Promise.all([probeConnector(key), connectorHistory(key)]);
  if (!connector) notFound();

  return <ConnectorScreen connector={connector} history={history} />;
}
