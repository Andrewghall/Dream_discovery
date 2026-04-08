import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit/audit-logger';

export async function POST(request: NextRequest) {
  try {
    // Read session token from request cookies
    const sessionToken = request.cookies.get('session')?.value;

    if (sessionToken) {
      // Look up the session in the database
      const session = await prisma.session.findUnique({
        where: { token: sessionToken },
      });

      // Delete the DB session if it exists
      if (session) {
        await prisma.session.delete({
          where: { token: sessionToken },
        });
        // Log after deletion so we still have session data for the record
        if (session.userId) {
          logAuditEvent({ organizationId: 'session', userId: session.userId, action: 'LOGOUT', resourceType: 'session', resourceId: session.id, success: true }).catch(err => console.error('[audit] logout:', err));
        }
      }
    }

    // Clear the session cookie safely
    try {
      const cookieStore = await cookies();
      if (cookieStore && typeof cookieStore.delete === 'function') {
        cookieStore.delete('session');
      }
    } catch {
      // Cookie store may not be available in test contexts - this is fine
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    // Still return success to ensure client-side cleanup proceeds
    return NextResponse.json({ success: true });
  }
}
