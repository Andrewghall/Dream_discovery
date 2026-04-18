import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isPlatformAdmin = session.role === 'PLATFORM_ADMIN';
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20', 10), 100);

  // Audit logs: scoped to org for tenants, all for platform admin
  const auditWhere = isPlatformAdmin ? {} : { organizationId: session.organizationId! };

  // Login attempts: scoped by looking up users in org for tenants
  let loginOrgUserEmails: string[] | null = null;
  if (!isPlatformAdmin && session.organizationId) {
    const orgUsers = await prisma.user.findMany({
      where: { organizationId: session.organizationId },
      select: { email: true },
    });
    loginOrgUserEmails = orgUsers.map(u => u.email);
  }

  const loginWhere = loginOrgUserEmails
    ? { email: { in: loginOrgUserEmails } }
    : {};

  const [auditLogs, loginAttempts] = await Promise.all([
    prisma.auditLog.findMany({
      where: auditWhere,
      take: limit,
      orderBy: { timestamp: 'desc' },
    }),
    prisma.loginAttempt.findMany({
      where: loginWhere,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, name: true } },
      },
    }),
  ]);

  const combined = [
    ...auditLogs.map(log => ({
      id: log.id,
      type: 'AUDIT',
      action: log.action,
      resource: log.resourceType
        ? `${log.resourceType}${log.resourceId ? `:${log.resourceId}` : ''}`
        : '—',
      success: log.success,
      email: log.userEmail || 'System',
      details: log.metadata as Record<string, unknown> | null,
      ipAddress: log.ipAddress || null,
      timestamp: log.timestamp.toISOString(),
    })),
    ...loginAttempts.map(attempt => ({
      id: attempt.id,
      type: 'LOGIN',
      action: attempt.success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      resource: 'Authentication',
      success: attempt.success,
      email: attempt.email,
      details: attempt.failureReason ? { failureReason: attempt.failureReason } : null,
      ipAddress: attempt.ipAddress || null,
      timestamp: attempt.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  return NextResponse.json({ logs: combined });
}

/**
 * DELETE is intentionally not implemented.
 *
 * Audit logs are append-only. Deletion would compromise the integrity of the
 * audit trail required by ISO 27001 A.8.15, SOC 2 CC7, and GDPR Art.5(1)(f).
 *
 * If log pruning is required for retention compliance, it must be performed via
 * the scheduled data-retention cron job (app/api/cron/retention/route.ts) which
 * applies the approved retention schedule and writes its own audit entry.
 */
export async function DELETE() {
  return NextResponse.json(
    { error: 'Audit logs are append-only and cannot be deleted via API.' },
    { status: 405 }
  );
}
