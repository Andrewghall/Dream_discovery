/**
 * GET /api/admin/platform/org-activity
 *
 * Returns per-organisation activity data for the platform admin dashboard:
 * - Users: name, email, role, last login, login count (30d)
 * - Workshops: name, type, status, discovery sessions, live sessions, duration
 * - Summary: active users, total logins, time spent
 *
 * PLATFORM_ADMIN only.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function thirtyDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

function formatDurationMs(ms: number): string {
  if (ms <= 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '< 1m';
}

export async function GET() {
  const session = await getSession();

  if (!session?.userId || session.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = thirtyDaysAgo();

  // 1. Fetch all orgs with users and workshops (no loginAttempts — queried separately)
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      users: {
        where: { role: { not: 'PLATFORM_ADMIN' } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lastLoginAt: true,
          isActive: true,
        },
        orderBy: [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
      },
      workshops: {
        select: {
          id: true,
          name: true,
          workshopType: true,
          status: true,
          createdAt: true,
          sessions: {
            select: {
              id: true,
              startedAt: true,
              completedAt: true,
              totalDurationMs: true,
              status: true,
            },
          },
          liveSnapshots: {
            select: { id: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
    },
    orderBy: { name: 'asc' },
  });

  // 2. Collect all user IDs across orgs for login count query
  const allUserIds = orgs.flatMap(o => o.users.map(u => u.id));

  // 3. Batch-query login counts (last 30 days) — one DB round-trip for all orgs
  const loginGroups = allUserIds.length > 0
    ? await prisma.loginAttempt.groupBy({
        by: ['userId'],
        where: {
          userId: { in: allUserIds },
          success: true,
          createdAt: { gte: cutoff },
        },
        _count: { id: true },
      })
    : [];

  const loginCountMap = new Map(loginGroups.map(r => [r.userId, r._count.id]));

  // 4. Shape the response
  const organizations = orgs.map(org => {
    const users = org.users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      isActive: user.isActive,
      loginCount30d: loginCountMap.get(user.id) ?? 0,
    }));

    const workshops = org.workshops.map(ws => {
      const completedSessions = ws.sessions.filter(s => s.status === 'COMPLETED');
      const totalDurationMs = completedSessions.reduce(
        (sum, s) => sum + (s.totalDurationMs ?? 0),
        0
      );
      return {
        id: ws.id,
        name: ws.name,
        workshopType: ws.workshopType,
        status: ws.status,
        createdAt: ws.createdAt.toISOString(),
        discoverySessionCount: ws.sessions.length,
        completedDiscoveryCount: completedSessions.length,
        totalDurationMs,
        durationFormatted: formatDurationMs(totalDurationMs),
        hasLiveSession: ws.liveSnapshots.length > 0,
        lastLiveSessionAt: ws.liveSnapshots[0]?.createdAt?.toISOString() ?? null,
      };
    });

    // Summary rollups
    const lastLoginAt = users.reduce((latest, u) => {
      if (!u.lastLoginAt) return latest;
      if (!latest) return u.lastLoginAt;
      return u.lastLoginAt > latest ? u.lastLoginAt : latest;
    }, null as string | null);

    const totalDurationMs = workshops.reduce((sum, w) => sum + w.totalDurationMs, 0);

    return {
      id: org.id,
      name: org.name,
      users,
      workshops,
      summary: {
        totalUsers: users.length,
        activeUsers30d: users.filter(u => u.loginCount30d > 0).length,
        totalLogins30d: users.reduce((sum, u) => sum + u.loginCount30d, 0),
        lastLoginAt,
        totalWorkshops: workshops.length,
        totalDiscoverySessions: workshops.reduce((sum, w) => sum + w.discoverySessionCount, 0),
        completedDiscoverySessions: workshops.reduce((sum, w) => sum + w.completedDiscoveryCount, 0),
        liveSessionsRun: workshops.filter(w => w.hasLiveSession).length,
        totalDurationMs,
        durationFormatted: formatDurationMs(totalDurationMs),
      },
    };
  });

  return NextResponse.json({ organizations });
}
