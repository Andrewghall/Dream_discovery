import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const url = new URL(req.url)
  const period = url.searchParams.get('period') ?? '7d'
  const days = period === '30d' ? 30 : period === 'today' ? 1 : 7

  const start = new Date()
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)

  const prevStart = new Date(start)
  prevStart.setDate(prevStart.getDate() - days)

  // Use raw SQL for aggregations
  const [summary, prevSummary, dailyRaw, topPages, deviceRaw, recentRaw] = await Promise.all([
    // Current period summary
    prisma.$queryRaw<Array<{ unique_visitors: bigint; total_pageviews: bigint; total_sessions: bigint; avg_duration: number }>>`
      SELECT
        COUNT(DISTINCT visitor_id)::bigint AS unique_visitors,
        COUNT(*)::bigint AS total_pageviews,
        COUNT(DISTINCT session_id)::bigint AS total_sessions,
        COALESCE(AVG(sub.s_dur), 0)::float AS avg_duration
      FROM analytics_events,
        LATERAL (
          SELECT SUM(duration_ms) AS s_dur
          FROM analytics_events ae2
          WHERE ae2.session_id = analytics_events.session_id
        ) sub
      WHERE created_at >= ${start}
    `,
    // Previous period for comparison
    prisma.$queryRaw<Array<{ unique_visitors: bigint; total_pageviews: bigint }>>`
      SELECT
        COUNT(DISTINCT visitor_id)::bigint AS unique_visitors,
        COUNT(*)::bigint AS total_pageviews
      FROM analytics_events
      WHERE created_at >= ${prevStart} AND created_at < ${start}
    `,
    // Daily breakdown
    prisma.$queryRaw<Array<{ day: Date; pageviews: bigint; visitors: bigint }>>`
      SELECT
        DATE_TRUNC('day', created_at) AS day,
        COUNT(*)::bigint AS pageviews,
        COUNT(DISTINCT visitor_id)::bigint AS visitors
      FROM analytics_events
      WHERE created_at >= ${start}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day ASC
    `,
    // Top pages
    prisma.$queryRaw<Array<{ page_path: string; views: bigint; avg_duration: number }>>`
      SELECT
        page_path,
        COUNT(*)::bigint AS views,
        COALESCE(AVG(duration_ms), 0)::float AS avg_duration
      FROM analytics_events
      WHERE created_at >= ${start}
      GROUP BY page_path
      ORDER BY views DESC
      LIMIT 15
    `,
    // Device breakdown
    prisma.$queryRaw<Array<{ device_type: string; count: bigint }>>`
      SELECT
        COALESCE(device_type, 'unknown') AS device_type,
        COUNT(*)::bigint AS count
      FROM analytics_events
      WHERE created_at >= ${start}
      GROUP BY device_type
      ORDER BY count DESC
    `,
    // Recent sessions
    prisma.$queryRaw<Array<{ session_id: string; first_page: string; page_count: bigint; total_duration: bigint; device_type: string; started_at: Date }>>`
      SELECT
        session_id,
        MIN(page_path) AS first_page,
        COUNT(*)::bigint AS page_count,
        COALESCE(SUM(duration_ms), 0)::bigint AS total_duration,
        MAX(device_type) AS device_type,
        MIN(created_at) AS started_at
      FROM analytics_events
      WHERE created_at >= ${start}
      GROUP BY session_id
      ORDER BY started_at DESC
      LIMIT 25
    `,
  ])

  function num(v: bigint | number) { return typeof v === 'bigint' ? Number(v) : v }

  return NextResponse.json({
    period,
    summary: {
      uniqueVisitors: num(summary[0]?.unique_visitors ?? 0),
      totalPageviews: num(summary[0]?.total_pageviews ?? 0),
      totalSessions: num(summary[0]?.total_sessions ?? 0),
      avgSessionDurationMs: Math.round(summary[0]?.avg_duration ?? 0),
    },
    prevSummary: {
      uniqueVisitors: num(prevSummary[0]?.unique_visitors ?? 0),
      totalPageviews: num(prevSummary[0]?.total_pageviews ?? 0),
    },
    dailyStats: dailyRaw.map((r) => ({
      date: r.day.toISOString().split('T')[0],
      pageviews: num(r.pageviews),
      visitors: num(r.visitors),
    })),
    topPages: topPages.map((r) => ({
      pagePath: r.page_path,
      views: num(r.views),
      avgDurationMs: Math.round(r.avg_duration),
    })),
    deviceBreakdown: deviceRaw.map((r) => ({
      deviceType: r.device_type,
      count: num(r.count),
    })),
    recentSessions: recentRaw.map((r) => ({
      sessionId: r.session_id,
      firstPage: r.first_page,
      pageCount: num(r.page_count),
      totalDurationMs: num(r.total_duration),
      deviceType: r.device_type,
      startedAt: r.started_at.toISOString(),
    })),
  })
}
