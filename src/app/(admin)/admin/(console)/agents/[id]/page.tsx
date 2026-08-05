import { notFound } from 'next/navigation';
import { getAgent, listPlans, listAssignableTenants } from '@/lib/commercial/queries';
import { AgentScreen } from '@/components/admin/AgentScreens';

/** One agent: their clients, their plan, and what each invoice owes them (§17). */
export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = Number(id);
  if (!Number.isInteger(agentId) || agentId <= 0) notFound();

  const [detail, plans, tenants] = await Promise.all([
    getAgent(agentId),
    listPlans(),
    listAssignableTenants(),
  ]);
  if (!detail) notFound();

  return <AgentScreen detail={detail} plans={plans} tenants={tenants} />;
}
