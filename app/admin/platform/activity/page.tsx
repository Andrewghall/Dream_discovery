'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Users,
  LogIn,
  BookOpen,
  Clock,
  Activity,
  CheckCircle2,
  Circle,
  RefreshCw,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserActivity {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
  isActive: boolean;
  loginCount30d: number;
}

interface WorkshopActivity {
  id: string;
  name: string;
  workshopType: string;
  status: string;
  createdAt: string;
  discoverySessionCount: number;
  completedDiscoveryCount: number;
  totalDurationMs: number;
  durationFormatted: string;
  hasLiveSession: boolean;
  lastLiveSessionAt: string | null;
}

interface OrgSummary {
  totalUsers: number;
  activeUsers30d: number;
  totalLogins30d: number;
  lastLoginAt: string | null;
  totalWorkshops: number;
  totalDiscoverySessions: number;
  completedDiscoverySessions: number;
  liveSessionsRun: number;
  totalDurationMs: number;
  durationFormatted: string;
}

interface OrgActivity {
  id: string;
  name: string;
  users: UserActivity[];
  workshops: WorkshopActivity[];
  summary: OrgSummary;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function formatAbsDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ROLE_LABELS: Record<string, string> = {
  TENANT_ADMIN: 'Admin',
  TENANT_USER: 'User',
  PLATFORM_ADMIN: 'Platform',
};

const WS_TYPE_LABELS: Record<string, string> = {
  STRATEGY: 'Strategy',
  PROCESS: 'Process',
  CHANGE: 'Change',
  TEAM: 'Team',
  CUSTOMER: 'Customer',
  INNOVATION: 'Innovation',
  CULTURE: 'Culture',
  CUSTOM: 'Custom',
  SALES: 'Sales',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  DISCOVERY_SENT: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatBadge({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg ${highlight ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-muted/40'}`}>
      <span className={`text-sm font-semibold tabular-nums ${highlight ? 'text-blue-700 dark:text-blue-300' : ''}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  );
}

function UserRow({ user }: { user: UserActivity }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${user.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
        <Badge variant="outline" className="text-[10px] py-0 h-5">
          {ROLE_LABELS[user.role] ?? user.role}
        </Badge>
        <div className="text-right">
          <p className="text-xs font-medium">{formatRelativeDate(user.lastLoginAt)}</p>
          <p className="text-[10px] text-muted-foreground">
            {user.loginCount30d > 0 ? `${user.loginCount30d} login${user.loginCount30d !== 1 ? 's' : ''} (30d)` : 'No logins (30d)'}
          </p>
        </div>
      </div>
    </div>
  );
}

function WorkshopRow({ ws }: { ws: WorkshopActivity }) {
  return (
    <div className="flex items-start justify-between py-2 px-3 rounded-md hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-2 min-w-0">
        <div className="flex-shrink-0 mt-0.5">
          {ws.hasLiveSession
            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
          }
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{ws.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground">
              {WS_TYPE_LABELS[ws.workshopType] ?? ws.workshopType}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[ws.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {ws.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 ml-4 text-right">
        {ws.discoverySessionCount > 0 ? (
          <p className="text-xs font-medium">
            {ws.completedDiscoveryCount}/{ws.discoverySessionCount} discovery
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No discovery sessions</p>
        )}
        {ws.totalDurationMs > 0 && (
          <p className="text-[10px] text-muted-foreground">{ws.durationFormatted} total</p>
        )}
        {ws.hasLiveSession && ws.lastLiveSessionAt && (
          <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
            Live run {formatRelativeDate(ws.lastLiveSessionAt)}
          </p>
        )}
      </div>
    </div>
  );
}

function OrgRow({ org }: { org: OrgActivity }) {
  const [expanded, setExpanded] = useState(false);
  const { summary } = org;

  const isActive = !!summary.lastLoginAt && (
    // eslint-disable-next-line react-hooks/purity
    Date.now() - new Date(summary.lastLoginAt).getTime() < 30 * 24 * 60 * 60 * 1000
  );

  return (
    <Card className={`border-border/60 transition-shadow ${expanded ? 'shadow-md' : 'hover:shadow-sm'}`}>
      {/* Summary row — click to expand */}
      <button
        className="w-full text-left"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              {expanded
                ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              }
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{org.name}</CardTitle>
                  {isActive
                    ? <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Active
                      </span>
                    : <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                        Quiet
                      </span>
                  }
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last login: {formatRelativeDate(summary.lastLoginAt)}
                  {summary.lastLoginAt && (
                    <span className="ml-1 opacity-60">({formatAbsDate(summary.lastLoginAt)})</span>
                  )}
                </p>
              </div>
            </div>

            {/* Stats pills */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatBadge label="Users" value={`${summary.activeUsers30d}/${summary.totalUsers}`} highlight={summary.activeUsers30d > 0} />
              <StatBadge label="Logins (30d)" value={summary.totalLogins30d} highlight={summary.totalLogins30d > 0} />
              <StatBadge label="Workshops" value={summary.totalWorkshops} />
              <StatBadge label="Live Runs" value={summary.liveSessionsRun} highlight={summary.liveSessionsRun > 0} />
              <StatBadge label="Time Spent" value={summary.durationFormatted} highlight={summary.totalDurationMs > 0} />
            </div>
          </div>
        </CardHeader>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <CardContent className="pt-0">
          <div className="border-t border-border/50 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Users */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Users ({org.users.length})
              </h4>
              {org.users.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-2">No users.</p>
              ) : (
                <div className="space-y-0.5">
                  {org.users.map(u => <UserRow key={u.id} user={u} />)}
                </div>
              )}
            </div>

            {/* Workshops */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BookOpen className="h-3 w-3" /> Workshops ({org.workshops.length})
              </h4>
              {org.workshops.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-2">No workshops created yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {org.workshops.map(w => <WorkshopRow key={w.id} ws={w} />)}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PlatformActivityPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/platform/org-activity', { cache: 'no-store' });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { setError('Failed to load activity data'); return; }
      const data = await res.json();
      // Sort: most recently active first
      const sorted = (data.organizations as OrgActivity[]).sort((a, b) => {
        const aTime = a.summary.lastLoginAt ? new Date(a.summary.lastLoginAt).getTime() : 0;
        const bTime = b.summary.lastLoginAt ? new Date(b.summary.lastLoginAt).getTime() : 0;
        return bTime - aTime;
      });
      setOrgs(sorted);
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Platform-wide summary totals
  const totals = orgs.reduce(
    (acc, org) => {
      acc.totalOrgs++;
      acc.activeOrgs += org.summary.activeUsers30d > 0 ? 1 : 0;
      acc.totalUsers += org.summary.totalUsers;
      acc.activeUsers += org.summary.activeUsers30d;
      acc.totalLogins30d += org.summary.totalLogins30d;
      acc.totalWorkshops += org.summary.totalWorkshops;
      acc.liveSessionsRun += org.summary.liveSessionsRun;
      acc.totalDiscoverySessions += org.summary.totalDiscoverySessions;
      acc.totalDurationMs += org.summary.totalDurationMs;
      return acc;
    },
    {
      totalOrgs: 0, activeOrgs: 0, totalUsers: 0, activeUsers: 0,
      totalLogins30d: 0, totalWorkshops: 0, liveSessionsRun: 0,
      totalDiscoverySessions: 0, totalDurationMs: 0,
    }
  );

  function formatTotalDuration(ms: number): string {
    if (ms <= 0) return '—';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${totalMinutes}m`;
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link href="/admin/platform" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Platform Admin
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Client Activity</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold tracking-tight">Client Activity</h1>
                <Badge variant="outline" className="text-xs">Platform Admin</Badge>
              </div>
              <p className="text-muted-foreground">
                Login frequency, workshop usage, and time spent — last 30 days.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex-shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Platform-wide summary cards */}
        {!loading && orgs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">{totals.activeOrgs}/{totals.totalOrgs}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Active orgs</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">{totals.activeUsers}/{totals.totalUsers}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Active users</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold tabular-nums text-blue-600">{totals.totalLogins30d}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Logins (30d)</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">{totals.totalWorkshops}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total workshops</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold tabular-nums text-green-600">{totals.liveSessionsRun}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Live runs</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold tabular-nums text-violet-600">{formatTotalDuration(totals.totalDurationMs)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Time spent</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="border-border/60">
                <CardHeader>
                  <div className="animate-pulse flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted rounded" />
                    <div className="h-5 w-48 bg-muted rounded" />
                    <div className="ml-auto flex gap-2">
                      {[1, 2, 3, 4, 5].map(j => (
                        <div key={j} className="h-10 w-16 bg-muted rounded-lg" />
                      ))}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive/30">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchData()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : orgs.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-12 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No organisations found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground px-1">
              {orgs.length} organisation{orgs.length !== 1 ? 's' : ''} · sorted by most recent activity · click a row to expand
            </p>
            {orgs.map(org => <OrgRow key={org.id} org={org} />)}
          </div>
        )}
      </div>
    </div>
  );
}
