/**
 * POST /api/admin/platform/enter-org
 *
 * Allows a PLATFORM_ADMIN to enter a tenant organisation's workspace
 * as a scoped TENANT_ADMIN session. The original PLATFORM_ADMIN JWT is
 * preserved in a backup cookie `dream-admin-session` so it can be
 * restored later.
 *
 * Zero client footprint: no banner is shown inside the tenant workspace.
 * The client's audit log is NOT written to during the support session.
 * To exit, Andrew navigates to /admin/platform — middleware auto-restores.
 *
 * Body: { organizationId: string }
 * Returns: { ok: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, createSessionToken } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { auditLog, getClientIp } from '@/lib/audit/log-action';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Only platform administrators can enter tenant workspaces' }, { status: 403 });
    }

    const body = await request.json();
    const { organizationId } = body as { organizationId?: string };

    if (!organizationId || typeof organizationId !== 'string') {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Load target org to validate it exists
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    // Read the original PLATFORM_ADMIN JWT from the session cookie
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const originalJwt = cookieStore.get('session')?.value;

    if (!originalJwt) {
      return NextResponse.json({ error: 'Session cookie not found' }, { status: 400 });
    }

    // Build the scoped JWT — looks like a TENANT_ADMIN for the target org
    const scopedJwt = await createSessionToken({
      sessionId: nanoid(),
      userId: session.userId,
      email: session.email,
      role: 'TENANT_ADMIN',
      organizationId: org.id,
      createdAt: Date.now(),
      impersonatedBy: session.userId,
    });

    // Audit log — recorded under the PLATFORM_ADMIN's org (null orgId → use a sentinel)
    // We do NOT log to the target org's audit log to keep the session invisible to the tenant.
    auditLog({
      organizationId: 'platform',          // platform-level log, not tenant-visible
      userId: session.userId,
      userEmail: session.email,
      action: 'support.enter_org',
      resourceType: 'organization',
      resourceId: org.id,
      method: 'POST',
      path: '/api/admin/platform/enter-org',
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
      metadata: { targetOrgId: org.id, targetOrgName: org.name },
    });

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    };

    const response = NextResponse.json({ ok: true });
    // Preserve the original PLATFORM_ADMIN session in a backup cookie
    response.cookies.set('dream-admin-session', originalJwt, cookieOpts);
    // Replace the active session with the scoped TENANT_ADMIN session
    response.cookies.set('session', scopedJwt, cookieOpts);

    return response;
  } catch (error) {
    console.error('[enter-org]', error);
    return NextResponse.json({ error: 'Failed to enter organisation workspace' }, { status: 500 });
  }
}
