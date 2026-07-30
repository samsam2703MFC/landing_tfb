import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/health — is the app up, and is it actually talking to the database?
 *
 * The first thing to curl after a deploy. Deliberately says almost nothing: this
 * route is public, so it reports reachability and whether the seed has run, and
 * no schema details, versions or row contents.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // A real query, not just a connection check — a reachable server with a
    // missing schema is still a broken deploy.
    const locales = await prisma.language.count();
    return NextResponse.json({ ok: true, db: 'up', seeded: locales > 0 });
  } catch (error) {
    console.error('Health check failed', error);
    return NextResponse.json({ ok: false, db: 'down' }, { status: 503 });
  }
}
