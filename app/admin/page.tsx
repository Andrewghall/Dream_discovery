'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, MessageSquare, TrendingUp, ShieldCheck, Trash2, Share2, Sparkles } from 'lucide-react';
import { WelcomeSplash } from '@/components/admin/WelcomeSplash';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  isExample?: boolean;
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
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgPrimaryColor, setOrgPrimaryColor] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [workshopDebug, setWorkshopDebug] = useState<{ globalWorkshopCount?: number; userRole?: string; userOrgId?: string } | null>(null);
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

  // Selection + bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Share dialog
  const [shareWorkshopId, setShareWorkshopId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [shares, setShares] = useState<Array<{ id: string; userName: string; userEmail: string; createdAt: string }>>([]);
  const [sharesLoading, setSharesLoading] = useState(false);

  useEffect(() => {
    fetchWorkshops();
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        const role = data.role || null;
        setUserRole(role);
        setUserName(data.name || null);
        setOrgLogoUrl(data.orgLogoUrl || null);
        setOrgName(data.orgName || null);
        setOrgPrimaryColor(data.orgPrimaryColor || null);
        setUserEmail(data.email || null);
        // PLATFORM_ADMIN has no access to workshop content — redirect to platform console.
        // Also the only role that can read /api/debug/env, so only fetch it for them.
        if (role === 'PLATFORM_ADMIN') {
          fetchDbDebug();
          router.replace('/admin/platform');
        }
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
      const response = await fetch(`/api/admin/workshops?limit=100&bust=${Date.now()}`, { cache: 'no-store' });
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
      // Capture debug info from API when workshops are empty
      if (data && typeof data === 'object' && (data as Record<string, unknown>)._debug) {
        setWorkshopDebug((data as Record<string, unknown>)._debug as typeof workshopDebug);
      } else {
        setWorkshopDebug(null);
      }
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableWorkshops = workshops.filter((w) => !w.isExample);

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableWorkshops.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableWorkshops.map((w) => w.id)));
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    let failed = 0;
    for (const wid of ids) {
      try {
        const res = await fetch(`/api/admin/workshops/${wid}`, { method: 'DELETE' });
        if (!res.ok) {
          failed++;
          const data = await res.json().catch(() => null);
          const message = data?.details?.message || data?.error || 'Failed to delete workshop';
          console.error(`[bulk-delete] ${wid}: ${message}`);
        }
      } catch {
        failed++;
      }
    }
    setShowDeleteConfirm(false);
    setBulkDeleting(false);
    setSelectedIds(new Set());
    fetchWorkshops();
    if (failed > 0) {
      alert(`Deleted ${ids.length - failed} workshop(s). ${failed} failed.`);
    }
  };

  const openShareDialog = async (workshopId: string) => {
    setShareWorkshopId(workshopId);
    setShareEmail('');
    setShareError(null);
    setShareSuccess(null);
    setShares([]);
    setSharesLoading(true);
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/shares`);
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares || []);
      }
    } catch { /* ignore */ } finally {
      setSharesLoading(false);
    }
  };

  const handleShare = async () => {
    if (!shareWorkshopId || !shareEmail.trim()) return;
    setShareLoading(true);
    setShareError(null);
    setShareSuccess(null);
    try {
      const res = await fetch(`/api/admin/workshops/${shareWorkshopId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shareEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setShareError(data.error || 'Failed to share');
      } else {
        setShareSuccess(`Shared with ${shareEmail.trim()}`);
        setShareEmail('');
        // Refresh shares list
        const listRes = await fetch(`/api/admin/workshops/${shareWorkshopId}/shares`);
        if (listRes.ok) {
          const listData = await listRes.json();
          setShares(listData.shares || []);
        }
      }
    } catch {
      setShareError('Network error');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!shareWorkshopId) return;
    try {
      const res = await fetch(`/api/admin/workshops/${shareWorkshopId}/shares`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId }),
      });
      if (res.ok) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
      }
    } catch { /* ignore */ }
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
      {/* Welcome splash — shown on first visit */}
      <WelcomeSplash
        userName={userName}
        orgLogoUrl={orgLogoUrl}
        orgPrimaryColor={orgPrimaryColor}
        orgName={orgName}
      />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="no-print flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">DREAM Discovery</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">
                {userName ? `Welcome, ${userName}` : 'Manage workshops and discovery conversations'}
              </p>
              {userRole && (
                <Badge variant="outline" className="text-xs">
                  {userRole === 'PLATFORM_ADMIN' ? 'Platform Admin' : userRole === 'TENANT_ADMIN' ? 'Org Admin' : 'User'}
                </Badge>
              )}
              {orgName && (
                <Badge variant="secondary" className="text-xs">
                  {orgName}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/workshops/new">
              <Button size="lg" style={{ backgroundColor: 'var(--org-primary)', color: 'white' }} className="hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                New Workshop
              </Button>
            </Link>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workshops</CardTitle>
                <CardDescription>View and manage your discovery workshops</CardDescription>
              </div>
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedIds.size})
                </Button>
              )}
            </div>
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
                {userRole === 'PLATFORM_ADMIN' && workshopDebug && typeof workshopDebug.globalWorkshopCount === 'number' && workshopDebug.globalWorkshopCount > 0 && (
                  <div className="text-xs text-red-600 mb-4">
                    <p className="font-semibold">
                      {workshopDebug.globalWorkshopCount} workshop{workshopDebug.globalWorkshopCount !== 1 ? 's' : ''} exist
                      {' '}in the database but are not visible with current filters.
                    </p>
                  </div>
                )}
                <Link href="/admin/workshops/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workshop
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Select All — only counts non-example workshops */}
                {selectableWorkshops.length > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={selectedIds.size === selectableWorkshops.length && selectableWorkshops.length > 0}
                      onChange={toggleSelectAll}
                    />
                    <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}</span>
                  </div>
                )}

                {workshops.map((workshop) => (
                  <div
                    key={workshop.id}
                    className={`border rounded-lg p-4 hover:bg-muted/50 transition-colors flex items-center gap-3 ${
                      workshop.isExample
                        ? 'border-amber-200 bg-amber-50/40 dark:border-amber-800/40 dark:bg-amber-950/10'
                        : selectedIds.has(workshop.id)
                          ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                          : ''
                    }`}
                  >
                    {/* Checkbox — hidden for example workshops */}
                    {!workshop.isExample ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 flex-shrink-0"
                        checked={selectedIds.has(workshop.id)}
                        onChange={() => toggleSelect(workshop.id)}
                      />
                    ) : (
                      <div className="h-4 w-4 flex-shrink-0" />
                    )}

                    {/* Workshop content — clickable */}
                    <Link
                      href={workshop.workshopType === 'SALES' ? `/sales/${workshop.id}` : `/admin/workshops/${workshop.id}`}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{workshop.name}</h3>
                            {workshop.isExample ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 gap-1">
                                <Sparkles className="h-3 w-3" />
                                Example
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="capitalize">
                                {workshop.workshopType.toLowerCase()}
                              </Badge>
                            )}
                            {!workshop.isExample && (
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
                            )}
                          </div>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            {workshop.isExample ? (
                              <span className="text-amber-700 text-xs">
                                Browse the full platform output — fork to run your own agents
                              </span>
                            ) : (
                              <>
                                <span>{formatDate(workshop.scheduledDate)}</span>
                                <span>
                                  {workshop.completedResponses}/{workshop.participantCount}{' '}
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
                              </>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" tabIndex={-1}>
                          View
                        </Button>
                      </div>
                    </Link>

                    {/* Share button — hidden for example workshops */}
                    {!workshop.isExample && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0"
                        onClick={(e) => {
                          e.preventDefault();
                          openShareDialog(workshop.id);
                        }}
                        title="Share workshop"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Delete {selectedIds.size} Workshop{selectedIds.size !== 1 ? 's' : ''}?</DialogTitle>
              <DialogDescription>
                This will permanently delete the selected workshop{selectedIds.size !== 1 ? 's' : ''} and all associated
                participants, sessions, and data. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
              {workshops
                .filter((w) => selectedIds.has(w.id) && !w.isExample)
                .map((w) => (
                  <div key={w.id} className="text-muted-foreground">&bull; {w.name}</div>
                ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={bulkDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Workshop${selectedIds.size !== 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Share Dialog */}
        <Dialog open={!!shareWorkshopId} onOpenChange={(open) => { if (!open) setShareWorkshopId(null); }}>
          <DialogContent className="bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Share Workshop</DialogTitle>
              <DialogDescription>
                Share this workshop with another user in your organisation. They&apos;ll be able to see and access it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="email"
                  className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="colleague@company.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleShare(); }}
                />
                <Button onClick={handleShare} disabled={shareLoading || !shareEmail.trim()} size="sm">
                  {shareLoading ? 'Sharing...' : 'Share'}
                </Button>
              </div>

              {shareError && (
                <div className="text-sm text-red-600">{shareError}</div>
              )}
              {shareSuccess && (
                <div className="text-sm text-green-600">{shareSuccess}</div>
              )}

              {/* Current shares */}
              <div>
                <h4 className="text-sm font-medium mb-2">Shared with</h4>
                {sharesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : shares.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Not shared with anyone yet</div>
                ) : (
                  <div className="space-y-2">
                    {shares.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                        <div>
                          <span className="font-medium">{s.userName}</span>
                          <span className="text-muted-foreground ml-2">{s.userEmail}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveShare(s.id)}
                          className="text-red-500 hover:text-red-700 h-7 px-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

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

        {/* Footer */}
        <div className="mt-16 pb-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Ethenta Ltd. All rights reserved.</span>
          <Link href="/terms" className="hover:text-foreground transition-colors underline underline-offset-2">
            Terms &amp; Conditions
          </Link>
        </div>
      </div>
    </div>
  );
}
