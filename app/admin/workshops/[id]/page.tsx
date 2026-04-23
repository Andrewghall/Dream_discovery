'use client';

import { use, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  role: string | null;
  department: string | null;
  discoveryToken: string;
  emailSentAt: Date | null;
  doNotSendAgain?: boolean;
  responseStartedAt: Date | null;
  responseCompletedAt: Date | null;
}

interface Workshop {
  id: string;
  name: string;
  description: string | null;
  businessContext: string | null;
  includeRegulation?: boolean;
  workshopType: string;
  status: string;
  scheduledDate: Date | null;
  responseDeadline: Date | null;
  participants: Participant[];
  engagementType?: string | null;
  domainPack?: string | null;
  domainPackConfig?: Record<string, unknown> | null;
}

export default function WorkshopDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeRegulation, setIncludeRegulation] = useState(true);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillForce, setBackfillForce] = useState(false);
  const [backfillIncludeInsights, setBackfillIncludeInsights] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<null | {
    total: number;
    done: number;
    ok: number;
    failed: number;
    currentSessionId: string | null;
  }>(null);
  const [backfillErrors, setBackfillErrors] = useState<Array<{ sessionId: string; error: string }>>([]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchWorkshop();
  }, [id]);

  const fetchWorkshop = async () => {
    try {
      const response = await fetch(`/api/admin/workshops/${id}?bust=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setWorkshop(data.workshop);
        setIncludeRegulation(data.workshop?.includeRegulation ?? true);
      }
    } catch (error) {
      console.error('Failed to fetch workshop:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateIncludeRegulation = async (value: boolean) => {
    try {
      setIncludeRegulation(value);
      await fetch(`/api/admin/workshops/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeRegulation: value }),
      });
      fetchWorkshop();
    } catch (error) {
      console.error('Failed to update workshop setting:', error);
    }
  };

  const handleDeleteWorkshop = () => {
    if (!workshop) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteWorkshop = async () => {
    setShowDeleteConfirm(false);
    try {
      const response = await fetch(`/api/admin/workshops/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/admin');
      } else {
        const data = await response.json().catch(() => null);
        const message =
          data?.details?.message ||
          data?.error ||
          'Failed to delete workshop';
        alert(message);
      }
    } catch (error) {
      console.error('Failed to delete workshop:', error);
      alert('Failed to delete workshop');
    }
  };

  const downloadJson = (filename: string, payload: unknown) => {
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
    } catch {
      // ignore
    }
  };


const handleBackfillReports = async () => {
    if (backfillRunning) return;

    if (
      !confirm(
        `Generate stored reports for all completed sessions in this workshop?\n\nThis will run sequentially and may take a minute.\n\nForce overwrite: ${backfillForce ? 'YES' : 'NO'}\nInclude insights: ${backfillIncludeInsights ? 'YES (slower)' : 'NO (faster)'}`
      )
    ) {
      return;
    }

    type WorkshopSessionRow = {
      sessionId: string;
      status: string;
      createdAt: string;
      completedAt: string | null;
      participant: { id: string; name: string; email: string };
      hasReport: boolean;
    };

    type SessionsResponse = {
      ok: boolean;
      workshopId: string;
      sessions: WorkshopSessionRow[];
      error?: string;
    };

    setBackfillRunning(true);
    setBackfillErrors([]);

    try {
      const listUrl = `/api/admin/workshops/${encodeURIComponent(id)}/sessions?status=COMPLETED&bust=${Date.now()}`;
      const listRes = await fetch(listUrl, { cache: 'no-store' });
      const listData = (await listRes.json().catch(() => null)) as SessionsResponse | null;

      if (!listRes.ok || !listData || !listData.ok || !Array.isArray(listData.sessions)) {
        const msg = listData && typeof listData.error === 'string' ? listData.error : 'Failed to list sessions';
        alert(msg);
        return;
      }

      const candidates = listData.sessions.filter((s) => backfillForce || !s.hasReport);
      setBackfillProgress({
        total: candidates.length,
        done: 0,
        ok: 0,
        failed: 0,
        currentSessionId: null,
      });

      let okCount = 0;
      let failCount = 0;
      const errors: Array<{ sessionId: string; error: string }> = [];

      for (const s of candidates) {
        setBackfillProgress((prev) =>
          prev
            ? {
                ...prev,
                currentSessionId: s.sessionId,
              }
            : prev
        );

        try {
          const reportUrl = `/api/conversation/report?sessionId=${encodeURIComponent(s.sessionId)}&skipEmail=1&bust=${Date.now()}`;
          const reportRes = await fetch(reportUrl, { cache: 'no-store' });
          const reportPayload = (await reportRes.json().catch(() => null)) as unknown;
          if (!reportRes.ok || !reportPayload || typeof reportPayload !== 'object') {
            throw new Error('Failed to generate report payload');
          }

          const assessmentUrl = `/api/admin/sessions/${encodeURIComponent(s.sessionId)}/assessment?force=1${
            backfillIncludeInsights ? '&insights=1' : ''
          }&bust=${Date.now()}`;
          const persistRes = await fetch(assessmentUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportPayload }),
          });
          const persistData = (await persistRes.json().catch(() => null)) as unknown;
          const ok =
            persistRes.ok &&
            persistData &&
            typeof persistData === 'object' &&
            'ok' in persistData &&
            (persistData as { ok?: unknown }).ok === true;
          if (!ok) {
            const errMsg =
              persistData &&
              typeof persistData === 'object' &&
              'error' in persistData &&
              typeof (persistData as { error?: unknown }).error === 'string'
                ? String((persistData as { error?: unknown }).error)
                : `Failed to persist report (HTTP ${persistRes.status})`;
            throw new Error(errMsg);
          }

          okCount += 1;
        } catch (e) {
          failCount += 1;
          const message = e instanceof Error ? e.message : 'Unknown error';
          errors.push({ sessionId: s.sessionId, error: message });
          setBackfillErrors([...errors]);
        } finally {
          setBackfillProgress((prev) =>
            prev
              ? {
                  ...prev,
                  done: prev.done + 1,
                  ok: okCount,
                  failed: failCount,
                }
              : prev
          );
        }
      }

      setBackfillProgress((prev) =>
        prev
          ? {
              ...prev,
              currentSessionId: null,
            }
          : prev
      );

      await fetchWorkshop();
      alert(
        `Backfill complete.\n\nProcessed: ${candidates.length}\nSucceeded: ${okCount}\nFailed: ${failCount}${failCount ? '\n\nSee errors list below.' : ''}`
      );
    } finally {
      setBackfillRunning(false);
    }
  };

  const getCompletionRate = () => {
    if (!workshop || workshop.participants.length === 0) return 0;
    const completed = workshop.participants.filter((p) => p.responseCompletedAt).length;
    return Math.round((completed / workshop.participants.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading workshop...</p>
        </div>
      </div>
    );
  }

  if (!workshop) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-muted-foreground">Workshop not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-8">
        {/* Workshop Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">{workshop.name}</h1>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="capitalize">
                  {workshop.workshopType.toLowerCase()}
                </Badge>
                <Badge>{workshop.status.replace('_', ' ')}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/workshops/${id}/invite`}>
                <Button variant="outline" size="sm">
                  <Send className="h-4 w-4 mr-2" />
                  Manage Invitations
                </Button>
              </Link>
              <Button onClick={handleDeleteWorkshop} variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workshop
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Participants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workshop.participants.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workshop.participants.filter((p) => p.responseCompletedAt).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  workshop.participants.filter(
                    (p) => p.responseStartedAt && !p.responseCompletedAt
                  ).length
                }
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getCompletionRate()}%</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workshop Settings</CardTitle>
                <CardDescription>Configure which sections are included in participant discovery</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Canonical workshop lenses are fixed platform-wide. Optional per-workshop lens toggles are no longer supported.
                </p>
              </CardContent>
            </Card>

            {/* Diagnostic Configuration -- shown when engagement type or domain pack is set */}
            {(workshop.engagementType || workshop.domainPack) && (
              <Card>
                <CardHeader>
                  <CardTitle>Diagnostic Configuration</CardTitle>
                  <CardDescription>Field discovery and diagnostic mode settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {workshop.engagementType && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Engagement Type</p>
                        <p className="text-sm font-medium">
                          {workshop.engagementType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </p>
                      </div>
                    )}
                    {workshop.domainPack && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Domain Pack</p>
                        <p className="text-sm font-medium">
                          {(workshop.domainPackConfig as Record<string, unknown>)?.label as string || workshop.domainPack.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </p>
                      </div>
                    )}
                  </div>
                  {workshop.domainPackConfig && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Domain pack loaded with {((workshop.domainPackConfig as Record<string, unknown>)?.actorTaxonomy as unknown[])?.length || 0} actor roles
                        {' and '}
                        {((workshop.domainPackConfig as Record<string, unknown>)?.questionTemplates as unknown[])?.length || 0} question templates
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Workshop Tools</CardTitle>
                <CardDescription>Admin-only maintenance actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={backfillForce}
                        onChange={(e) => setBackfillForce(e.target.checked)}
                        disabled={backfillRunning}
                      />
                      Force overwrite existing stored reports
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={backfillIncludeInsights}
                        onChange={(e) => setBackfillIncludeInsights(e.target.checked)}
                        disabled={backfillRunning}
                      />
                      Also generate insights (slower)
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleBackfillReports()}
                      disabled={backfillRunning}
                    >
                      {backfillRunning ? 'Backfilling…' : 'Backfill Reports for Completed Sessions'}
                    </Button>
                  </div>

                  {backfillProgress ? (
                    <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                      <div>
                        Progress: {backfillProgress.done}/{backfillProgress.total} | ok: {backfillProgress.ok} | failed:{' '}
                        {backfillProgress.failed}
                      </div>
                      {backfillProgress.currentSessionId ? (
                        <div className="text-muted-foreground">Current session: {backfillProgress.currentSessionId}</div>
                      ) : null}
                    </div>
                  ) : null}

                  {backfillErrors.length ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <div className="font-medium">Errors ({backfillErrors.length})</div>
                      <div className="mt-2 space-y-1">
                        {backfillErrors.slice(0, 10).map((e) => (
                          <div key={`${e.sessionId}:${e.error}`}>
                            {e.sessionId}: {e.error}
                          </div>
                        ))}
                        {backfillErrors.length > 10 ? <div>…and {backfillErrors.length - 10} more</div> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Invite link card */}
            <Card>
              <CardHeader>
                <CardTitle>Participants &amp; Invitations</CardTitle>
                <CardDescription>
                  {workshop.participants.length > 0
                    ? `${workshop.participants.length} participant${workshop.participants.length !== 1 ? 's' : ''} added — manage invitations on the Invite page.`
                    : 'Add participants and send discovery invitations from the Invite page.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/admin/workshops/${id}/invite`}>
                  <Button variant="outline" className="gap-2">
                    <Send className="h-4 w-4" />
                    {workshop.participants.length > 0
                      ? 'Manage Participants & Send Invitations'
                      : 'Add Participants & Send Invitations'}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Success!</DialogTitle>
            <DialogDescription>{successMessage}</DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowSuccessDialog(false)}>Close</Button>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Delete Workshop</DialogTitle>
            <DialogDescription>
              Delete workshop &ldquo;{workshop?.name}&rdquo;? This will permanently delete
              participants and all discovery data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteWorkshop}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
