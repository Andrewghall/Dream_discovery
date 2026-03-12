/**
 * POST /api/admin/platform/exit-org
 *
 * Restores the original PLATFORM_ADMIN session from the `dream-admin-session`
 * backup cookie, ending the support access session.
 *
 * Does NOT require a specific role — works from any session state,
 * so Andrew can call this even while holding a TENANT_ADMIN scoped session.
 *
 * Returns: { ok: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/session';
import { auditLog, getClientIp } from '@/lib/audit/log-action';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    const backupJwt = cookieStore.get('dream-admin-session')?.value;

    if (!backupJwt) {
      // No active support session — nothing to do
      return NextResponse.json({ ok: true, noop: true });
    }

    // Verify the backup is a valid PLATFORM_ADMIN JWT before restoring
    const backupPayload = await verifySessionToken(backupJwt);
    if (!backupPayload || backupPayload.role !== 'PLATFORM_ADMIN') {
      // Backup is invalid — clear it and return
      const response = NextResponse.json({ ok: true, noop: true });
      response.cookies.delete('dream-admin-session');
      return response;
    }

    // Audit log the exit
    const currentJwt = cookieStore.get('session')?.value;
    const currentPayload = currentJwt ? await verifySessionToken(currentJwt) : null;
    auditLog({
      organizationId: 'platform',
      userId: backupPayload.userId,
      userEmail: backupPayload.email,
      action: 'support.exit_org',
      resourceType: 'organization',
      resourceId: currentPayload?.organizationId ?? undefined,
      method: 'POST',
      path: '/api/admin/platform/exit-org',
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
      metadata: { exitedOrgId: currentPayload?.organizationId ?? null },
    });

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 60 * 60 * 24,
    };

    const response = NextResponse.json({ ok: true });
    // Restore original PLATFORM_ADMIN session
    response.cookies.set('session', backupJwt, cookieOpts);
    // Delete the backup cookie
    response.cookies.delete('dream-admin-session');

    return response;
  } catch (error) {
    console.error('[exit-org]', error);
    return NextResponse.json({ error: 'Failed to exit organisation workspace' }, { status: 500 });
  }
}
