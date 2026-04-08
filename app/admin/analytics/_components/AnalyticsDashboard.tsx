'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Users, Eye, Clock, TrendingUp, Monitor, Smartphone, Tablet, ExternalLink } from 'lucide-react'

type Summary = {
  uniqueVisitors: number
  totalPageviews: number
  totalSessions: number
  avgSessionDurationMs: number
}
type DashboardData = {
  period: string
  summary: Summary
  prevSummary: { uniqueVisitors: number; totalPageviews: number }
  dailyStats: Array<{ date: string; pageviews: number; visitors: number }>
  topPages: Array<{ pagePath: string; views: number; avgDurationMs: number }>
  deviceBreakdown: Array<{ deviceType: string; count: number }>
  recentSessions: Array<{
    sessionId: string
    firstPage: string
    pageCount: number
    totalDurationMs: number
    deviceType: string
    startedAt: string
  }>
}

function formatDuration(ms: number) {
  if (ms < 1000) return '<1s'
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function pctChange(curr: number, prev: number) {
  if (prev === 0) return null
  const pct = Math.round(((curr - prev) / prev) * 100)
  return pct
}

function MetricCard({ label, value, sub, icon: Icon, change }: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  change?: number | null
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="flex items-center gap-2">
        {change !== null && change !== undefined && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  )
}

const DEVICE_ICONS: Record<string, React.ElementType> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: Monitor,
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('7d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/admin/analytics/summary?period=${period}`)
      .then((r) => r.json())
      .then((d: DashboardData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Website Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Public marketing site · /dream, /experience</p>
        </div>
        <div className="flex gap-2">
          {(['today', '7d', '30d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                period === p
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p === 'today' ? 'Today' : p === '7d' ? 'Last 7 days' : 'Last 30 days'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-700 animate-spin" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              label="Unique Visitors"
              value={data.summary.uniqueVisitors.toLocaleString()}
              icon={Users}
              change={pctChange(data.summary.uniqueVisitors, data.prevSummary.uniqueVisitors)}
              sub="vs prev period"
            />
            <MetricCard
              label="Page Views"
              value={data.summary.totalPageviews.toLocaleString()}
              icon={Eye}
              change={pctChange(data.summary.totalPageviews, data.prevSummary.totalPageviews)}
              sub="vs prev period"
            />
            <MetricCard
              label="Sessions"
              value={data.summary.totalSessions.toLocaleString()}
              icon={TrendingUp}
              sub="unique browsing sessions"
            />
            <MetricCard
              label="Avg. Session Time"
              value={formatDuration(data.summary.avgSessionDurationMs)}
              icon={Clock}
              sub="time on site"
            />
          </div>

          {/* Charts row */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Daily trend — 2/3 width */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Traffic Trend</h2>
              {data.dailyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.dailyStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                      labelFormatter={(label) => typeof label === 'string' ? formatDate(label) : label}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="visitors" name="Visitors" fill="#5cf28e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pageviews" name="Pageviews" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
                  No data for this period yet
                </div>
              )}
            </div>

            {/* Device breakdown — 1/3 width */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Devices</h2>
              {data.deviceBreakdown.length > 0 ? (
                <div className="space-y-4 mt-2">
                  {(() => {
                    const total = data.deviceBreakdown.reduce((s, d) => s + d.count, 0)
                    return data.deviceBreakdown.map((d) => {
                      const Icon = DEVICE_ICONS[d.deviceType] ?? Monitor
                      const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
                      return (
                        <div key={d.deviceType}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-sm text-slate-700 capitalize">{d.deviceType}</span>
                            </div>
                            <span className="text-sm font-semibold text-slate-900">{pct}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#5cf28e]"
                              style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
                            />
                          </div>
                          <div className="text-xs text-slate-400 mt-1">{d.count.toLocaleString()} views</div>
                        </div>
                      )
                    })
                  })()}
                </div>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
              )}
            </div>
          </div>

          {/* Bottom row: top pages + recent sessions */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top pages */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700">Top Pages</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {data.topPages.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">No data yet</div>
                )}
                {data.topPages.map((p) => (
                  <div key={p.pagePath} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{p.pagePath}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        avg. {formatDuration(p.avgDurationMs)} on page
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-slate-900">{p.views.toLocaleString()}</div>
                      <div className="text-xs text-slate-400">views</div>
                    </div>
                    <a
                      href={p.pagePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent sessions */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700">Recent Sessions</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {data.recentSessions.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">No sessions yet</div>
                )}
                {data.recentSessions.slice(0, 15).map((s) => {
                  const DevIcon = DEVICE_ICONS[s.deviceType] ?? Monitor
                  return (
                    <div key={s.sessionId} className="px-5 py-3 flex items-center gap-3">
                      <DevIcon className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-700 truncate">{s.firstPage}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {new Date(s.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {new Date(s.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-0.5">
                        <div className="text-xs font-medium text-slate-700">{s.pageCount} {s.pageCount === 1 ? 'page' : 'pages'}</div>
                        <div className="text-xs text-slate-400">{formatDuration(s.totalDurationMs)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !data && (
        <div className="text-center py-20">
          <p className="text-slate-500">Failed to load analytics data</p>
        </div>
      )}
    </div>
  )
}
