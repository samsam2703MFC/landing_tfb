import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getBillingSnapshot } from '@/lib/billing/client';
import { AdminShell } from '@/components/admin/AdminShell';

/**
 * The authenticated console. Every screen under here is gated: no session, no
 * render — the redirect happens on the server before any query runs.
 *
 * The rail counts are loaded once here rather than per screen.
 */

/**
 * Never prerender or cache the console. Two reasons: its pages are
 * per-session, and without this Next probes each one at build time and runs its
 * queries against whatever DATABASE_URL the build host happens to have.
 */
export const dynamic = 'force-dynamic';
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const [billing, moduleCount, unread] = await Promise.all([
    getBillingSnapshot(),
    prisma.module.count(),
    prisma.contactMessage.count({ where: { status: 'new' } }),
  ]);

  const counts = {
    tenants: billing.tenants.length,
    licenses: billing.licenses.length,
    sync: billing.sync.length,
    modules: moduleCount,
    messages: unread,
  };

  return (
    <AdminShell user={{ email: session.email, role: session.role }} counts={counts}>
      {children}
    </AdminShell>
  );
}
