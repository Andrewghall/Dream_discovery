'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, MessageSquare, TrendingUp, ShieldCheck, LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ConversationReport, PhaseInsight } from '@/components/report/conversation-report';

interface Workshop {
  id: string;
  name: string;
  workshopType: string;
  status: string;
  scheduledDate: string | null;
  participantCount: number;
  completedResponses: number;
}

interface DbUrlInfo {
  protocol: string | null;
  user: string | null;
  host: string | null;
  port: string | null;
  database: string | null;
  schema: string | null;
}

interface DebugEnvResponse {
  databaseUrlInfo?: DbUrlInfo;
  db?: {
    ok: boolean;
    currentSchema: string | null;
    workshopCount: number | null;
    error: string | null;
  };
  nodeEnv?: string | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [workshopsError, setWorkshopsError] = useState<string | null>(null);
  const [dbDebug, setDbDebug] = useState<DebugEnvResponse | null>(null);
  const [dbDebugError, setDbDebugError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string; type: string; action: string; resource: string;
    success: boolean; email: string; timestamp: string;
    details: Record<string, unknown> | null;
  }>>([]);
  const [demoReport, setDemoReport] = useState<null | {
    executiveSummary: string;
    tone: string | null;
    feedback: string;
    inputQuality?: {
      score: number;
      label: 'high' | 'medium' | 'low';
      rationale: string;
      missingInfoSuggestions: string[];
    };
    keyInsights?: Array<{
      title: string;
      insight: string;
      confidence: 'high' | 'medium' | 'low';
      evidence: string[];
    }>;
    phaseInsights: PhaseInsight[];
    wordCloudThemes: Array<{ text: string; value: number }>;
  }>(null);
  const [demoReportLoading, setDemoReportLoading] = useState(false);

  useEffect(() => {
    fetchWorkshops();
    fetchDbDebug();
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        setUserRole(data.role || null);
        setUserName(data.name || null);
        setOrgLogoUrl(data.orgLogoUrl || null);
      })
      .catch(() => null);
    fetch('/api/admin/audit-logs?limit=10', { cache: 'no-store' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null; }
        return r.json();
      })
      .then(data => { if (data) setAuditLogs(data.logs || []); })
      .catch(() => null);
  }, []);

  const fetchWorkshops = async () => {
    try {
      const response = await fetch(`/api/admin/workshops?bust=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const details = data && typeof data === 'object' ? (data as Record<string, unknown>).details : null;
        const detailsMessage =
          details && typeof details === 'object' && typeof (details as Record<string, unknown>).message === 'string'
            ? String((details as Record<string, unknown>).message)
            : null;
        const fallback = data && typeof data === 'object' && typeof (data as Record<string, unknown>).error === 'string'
          ? String((data as Record<string, unknown>).error)
          : 'Failed to fetch workshops';
        setWorkshopsError(detailsMessage || fallback);
        setWorkshops([]);
        return;
      }

      setWorkshopsError(null);
      setWorkshops((data && typeof data === 'object' ? (data as Record<string, unknown>).workshops : null) as Workshop[] || []);
    } catch (error) {
      console.error('Failed to fetch workshops:', error);
      setWorkshopsError(error instanceof Error ? error.message : 'Failed to fetch workshops');
    } finally {
      setLoading(false);
    }
  };

  const fetchDbDebug = async () => {
    try {
      const response = await fetch(`/api/debug/env?bust=${Date.now()}`, { cache: 'no-store' });
      if (response.status === 401 || response.status === 403) {
        // Non-admin user — silently hide debug panel (endpoint is PLATFORM_ADMIN only)
        setDbDebug(null);
        setDbDebugError(null);
        return;
      }
      const data = (await response.json().catch(() => null)) as DebugEnvResponse | null;
      if (!response.ok) {
        setDbDebug(null);
        setDbDebugError('Failed to fetch db debug');
        return;
      }
      setDbDebug(data);
      setDbDebugError(null);
    } catch (error) {
      setDbDebug(null);
      setDbDebugError(error instanceof Error ? error.message : 'Failed to fetch db debug');
    }
  };

  const fetchDemoReport = async () => {
    setDemoReportLoading(true);
    try {
      const r = await fetch('/api/conversation/report?demo=1&includeRegulation=1', { cache: 'no-store' });
      if (!r.ok) return;
      const reportData = await r.json();
      setDemoReport({
        executiveSummary: reportData.executiveSummary,
        tone: reportData.tone,
        feedback: reportData.feedback,
        inputQuality: reportData.inputQuality,
        keyInsights: reportData.keyInsights,
        phaseInsights: reportData.phaseInsights,
        wordCloudThemes: reportData.wordCloudThemes,
      });
    } catch {
      // ignore
    } finally {
      setDemoReportLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500';
      case 'IN_PROGRESS':
        return 'bg-blue-500';
      case 'DISCOVERY_SENT':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Not scheduled';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="no-print flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Image src={orgLogoUrl || process.env.NEXT_PUBLIC_PLATFORM_LOGO || '/upstreamworks-logo.png'} alt="Logo" width={128} height={37} priority />
              <h1 className="text-3xl font-bold tracking-tight">DREAM Discovery</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              {userName ? `Welcome, ${userName}` : 'Manage workshops and discovery conversations'}
            </p>
          </div>
          <div className="flex gap-2">
            {userRole === 'PLATFORM_ADMIN' && (
              <Link href="/admin/organizations">
                <Button size="lg" variant="outline">
                  Organizations
                </Button>
              </Link>
            )}
            {userRole === 'TENANT_ADMIN' && (
              <Link href="/admin/users">
                <Button size="lg" variant="outline">
                  Users
                </Button>
              </Link>
            )}
            <Link href="/admin/workshops/new">
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                New Workshop
              </Button>
            </Link>
            <Button size="lg" variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="no-print mb-6">
          {dbDebugError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {dbDebugError}
            </div>
          ) : dbDebug ? (
            <div className="space-y-2">
              {(() => {
                const schemaParam = dbDebug.databaseUrlInfo?.schema || null;
                const expected = (schemaParam || 'public').trim();
                const current = (dbDebug.db?.currentSchema || '').trim();
                const mismatch = Boolean(expected && current && expected !== current);
                return mismatch ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    Schema mismatch: DATABASE_URL expects <span className="font-mono">{expected}</span> but the DB connection is using{' '}
                    <span className="font-mono">{current}</span>. Admin data may appear missing.
                  </div>
                ) : null;
              })()}

              <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                <div className="font-medium">Database Connection</div>
                <div className="text-muted-foreground">
                  {dbDebug.databaseUrlInfo?.user ? `${dbDebug.databaseUrlInfo.user}@` : ''}
                  {dbDebug.databaseUrlInfo?.host || 'unknown'}
                  {dbDebug.databaseUrlInfo?.port ? `:${dbDebug.databaseUrlInfo.port}` : ''}
                  {dbDebug.databaseUrlInfo?.database ? `/${dbDebug.databaseUrlInfo.database}` : ''}
                  {dbDebug.databaseUrlInfo?.schema ? ` (schema param: ${dbDebug.databaseUrlInfo.schema})` : ''}
                  {typeof dbDebug.db?.currentSchema === 'string' ? ` | current_schema(): ${dbDebug.db.currentSchema}` : ''}
                  {typeof dbDebug.nodeEnv === 'string' ? ` | NODE_ENV: ${dbDebug.nodeEnv}` : ''}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Stats Cards */}
        <div className="no-print grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Workshops</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workshops.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {workshops.filter((w) => w.status === 'IN_PROGRESS').length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workshops.reduce((sum, w) => sum + w.participantCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {workshops.reduce((sum, w) => sum + w.completedResponses, 0)} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workshops.reduce((sum, w) => sum + w.participantCount, 0) > 0
                  ? Math.round(
                      (workshops.reduce((sum, w) => sum + w.completedResponses, 0) /
                        workshops.reduce((sum, w) => sum + w.participantCount, 0)) *
                        100
                    )
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground mt-1">Across all workshops</p>
            </CardContent>
          </Card>
        </div>

        {/* Workshops List */}
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Workshops</CardTitle>
            <CardDescription>View and manage your discovery workshops</CardDescription>
          </CardHeader>
          <CardContent>
            {workshopsError ? (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {workshopsError}
              </div>
            ) : null}
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading workshops...</div>
            ) : workshops.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No workshops yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first workshop to start gathering insights
                </p>
                <Link href="/admin/workshops/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workshop
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {workshops.map((workshop) => (
                  <Link
                    key={workshop.id}
                    href={workshop.workshopType === 'SALES' ? `/sales/${workshop.id}` : `/admin/workshops/${workshop.id}`}
                    className="block"
                  >
                    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{workshop.name}</h3>
                            <Badge variant="outline" className="capitalize">
                              {workshop.workshopType.toLowerCase()}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${getStatusColor(
                                  workshop.status
                                )}`}
                              />
                              <span className="text-sm text-muted-foreground capitalize">
                                {workshop.status.toLowerCase().replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <span>📅 {formatDate(workshop.scheduledDate)}</span>
                            <span>
                              👥 {workshop.completedResponses}/{workshop.participantCount}{' '}
                              completed
                            </span>
                            <span>
                              {workshop.participantCount > 0
                                ? Math.round(
                                    (workshop.completedResponses / workshop.participantCount) *
                                      100
                                  )
                                : 0}
                              % completion
                            </span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View →
                        </Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="no-print mt-8">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest security events and user actions</CardDescription>
              </div>
              <Link href="/admin/audit-logs">
                <Button variant="outline" size="sm">View All Logs</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="pb-2 pr-4 font-medium">Time</th>
                      <th className="pb-2 pr-4 font-medium">Action</th>
                      <th className="pb-2 pr-4 font-medium">User</th>
                      <th className="pb-2 pr-4 font-medium">Resource</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map(log => (
                      <tr key={`${log.type}-${log.id}`} className="hover:bg-muted/30">
                        <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs">{log.action}</td>
                        <td className="py-2 pr-4 text-muted-foreground max-w-[160px] truncate">{log.email}</td>
                        <td className="py-2 pr-4 text-muted-foreground text-xs max-w-[120px] truncate">{log.resource}</td>
                        <td className="py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                            log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {log.success ? 'OK' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Example Report</CardTitle>
                <CardDescription>Preview a sample report (demo data) from the report generator</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {!demoReport && (
                  <LoadingButton variant="outline" onClick={fetchDemoReport} loading={demoReportLoading} loadingText="Loading Report…">
                    Preview Example Report
                  </LoadingButton>
                )}
                {demoReport && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDemoReport(null);
                    }}
                  >
                    Hide Example Report
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {demoReport ? (
              <ConversationReport
                executiveSummary={demoReport.executiveSummary}
                tone={demoReport.tone}
                feedback={demoReport.feedback}
                inputQuality={demoReport.inputQuality}
                keyInsights={demoReport.keyInsights}
                phaseInsights={demoReport.phaseInsights}
                wordCloudThemes={demoReport.wordCloudThemes}
              />
            ) : (
              <div className="text-sm text-muted-foreground">Click “Preview Example Report” to load a demo report.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
