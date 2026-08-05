import { listAgents, listPlans } from '@/lib/commercial/queries';
import { AgentsTable } from '@/components/admin/AgentScreens';
import { BillingFixtureNotice } from '@/components/admin/shared';

/** tfb_agents — who brings and supports clients, and on what split (§17). */
export default async function AgentsPage() {
  const [{ agents, fixture }, plans] = await Promise.all([listAgents(), listPlans()]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <BillingFixtureNotice fixture={fixture} />
      <AgentsTable agents={agents} plans={plans} fixture={fixture} />
    </div>
  );
}
