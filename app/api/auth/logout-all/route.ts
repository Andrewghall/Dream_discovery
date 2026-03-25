import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifySessionWithDB } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // DB-backed verification: rejects revoked/expired sessions
    const payload = await verifySessionWithDB(sessionCookie.value);

    if (!payload) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { userId, sessionId } = payload;

    // PLATFORM_ADMIN sessions are stored with userId: null in the DB
    // (the JWT carries userId='admin' but that is not a DB user row).
    // For PLATFORM_ADMIN, revoke ALL null-userId sessions — this covers:
    //   - the admin's own sessions from any browser
    //   - derived impersonation/support sessions (also stored with userId: null)
    // For tenant users, revoke all sessions by their real userId.
    const isAdminPrincipal = userId === 'admin';

    if (isAdminPrincipal) {
      await prisma.session.updateMany({
        where: { userId: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    // Clear the session cookie (and backup cookie if present)
    cookieStore.delete('session');
    cookieStore.delete('dream-admin-session');

    return NextResponse.json({ success: true, message: 'All sessions revoked successfully' });
  } catch (error) {
    console.error('Logout all error:', error);
    return NextResponse.json(
      { error: 'Failed to logout from all devices' },
      { status: 500 }
    );
  }
}
