'use client';

import { use, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Send, UserPlus, Copy, Check, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  const [newParticipant, setNewParticipant] = useState({
    name: '',
    email: '',
    role: '',
    department: '',
  });
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
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

  const handleRemoveParticipant = async (participantId: string, email: string) => {
    if (!confirm(`Remove ${email} from this workshop? This will delete their discovery session data.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/workshops/${id}/participants`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });

      if (response.ok) {
        fetchWorkshop();
      } else {
        const data = await response.json().catch(() => null);
        alert(data?.error || 'Failed to remove participant');
      }
    } catch (error) {
      console.error('Failed to remove participant:', error);
      alert('Failed to remove participant');
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

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/admin/workshops/${id}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newParticipant),
      });

      if (response.ok) {
        setNewParticipant({ name: '', email: '', role: '', department: '' });
        fetchWorkshop();
      }
    } catch (error) {
      console.error('Failed to add participant:', error);
    }
  };

  const handleClearEmailStatus = async () => {
    if (!confirm('Clear email sent status for all participants? This will allow you to resend emails.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/workshops/${id}/clear-email-status`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Cleared email status for ${data.clearedCount} participant(s)`);
        fetchWorkshop();
      }
    } catch (error) {
      console.error('Failed to clear email status:', error);
      alert('Failed to clear email status');
    }
  };

  const handleSendInvitations = async () => {
    alert('Button clicked! Sending emails...');
    console.log('🚀 Send Invitations clicked');
    
    try {
      // Simple, direct fetch call
      const response = await fetch(`/api/admin/workshops/${id}/send-invitations`, {
        method: 'POST',
      });

      console.log('📥 Response received:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Response data:', data);

        if (data.errors?.length) {
          const errors: unknown = data.errors;
          const list = Array.isArray(errors) ? errors : [];
          const errorText = list
            .map((e) => {
              const rec = e && typeof e === 'object' ? (e as Record<string, unknown>) : {};
              const email = typeof rec.email === 'string' ? rec.email : 'unknown';
              const err = typeof rec.error === 'string' ? rec.error : '';
              return `${email}: ${err}`;
            })
            .join('\n');
          alert(`Some emails failed to send:\n\n${errorText}`);
        }

        if (data.emailsSent === 0 && data.message) {
          alert(data.message);
          fetchWorkshop();
          return;
        }

        setSuccessMessage(`Invitations sent successfully to ${data.emailsSent} participant(s)!`);
        setShowSuccessDialog(true);
        fetchWorkshop();
      } else {
        const data = await response.json().catch(() => null);
        const message = data?.details?.message || data?.error || 'Failed to send invitations';
        alert(message);
      }
    } catch (error) {
      console.error('Failed to send invitations:', error);
      alert('Failed to send invitations');
    }
  };

  const handleDeleteWorkshop = async () => {
    if (!workshop) return;
    if (!confirm(`Delete workshop "${workshop.name}"? This will permanently delete participants and all discovery data.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/workshops/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/admin');
      } else {
        const data = await response.json().catch(() => null);
        alert(data?.error || 'Failed to delete workshop');
      }
    } catch (error) {
      console.error('Failed to delete workshop:', error);
      alert('Failed to delete workshop');
    }
  };

  const copyDiscoveryLink = (token: string) => {
    const link = `${window.location.origin}/discovery/${id}/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
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
        <Link href="/admin">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

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
            <div className="flex gap-2">
              <Link href={`/admin/workshops/${id}/live`}>
                <Button variant="outline" size="lg">
                  Live
                </Button>
              </Link>
              <Button onClick={handleClearEmailStatus} variant="outline" size="lg">
                Clear Email Status
              </Button>
              <Button onClick={handleSendInvitations} size="lg">
                <Send className="h-4 w-4 mr-2" />
                Send Invitations
              </Button>
              <Button onClick={handleDeleteWorkshop} variant="destructive" size="lg">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workshop
              </Button>
            </div>
          </div>
          {workshop.description && (
            <p className="text-muted-foreground">{workshop.description}</p>
          )}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workshop Settings</CardTitle>
                <CardDescription>Configure which sections are included in participant discovery</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Optional Sections</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeRegulation}
                      onChange={(e) => handleUpdateIncludeRegulation(e.target.checked)}
                    />
                    Include Regulation / Risk questions
                  </label>
                </div>
              </CardContent>
            </Card>

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

            <Card>
              <CardHeader>
                <CardTitle>Participants</CardTitle>
                <CardDescription>
                  Manage workshop participants and send discovery invitations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workshop.participants.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No participants yet. Add participants to get started.
                    </p>
                  ) : (
                    workshop.participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">{participant.name}</h4>
                              {participant.emailSentAt && (
                                <Badge variant="outline" className="text-xs">
                                  Email Sent
                                </Badge>
                              )}
                              {participant.responseCompletedAt && (
                                <Badge variant="secondary" className="text-xs">
                                  ✓ Completed
                                </Badge>
                              )}
                              {participant.responseStartedAt && !participant.responseCompletedAt && (
                                <Badge variant="outline" className="text-xs">
                                  In Progress
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{participant.email}</p>
                            {(participant.role || participant.department) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {participant.role}
                                {participant.role && participant.department && ' • '}
                                {participant.department}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/admin/workshops/${encodeURIComponent(id)}/participants/${encodeURIComponent(
                                participant.id
                              )}`}
                            >
                              <Button variant="ghost" size="sm">
                                Review
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyDiscoveryLink(participant.discoveryToken)}
                            >
                              {copiedToken === participant.discoveryToken ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveParticipant(participant.id, participant.email)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add Participant Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Add Participant</CardTitle>
                <CardDescription>Invite someone to the discovery session</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddParticipant} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={newParticipant.name}
                      onChange={(e) =>
                        setNewParticipant({ ...newParticipant, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@company.com"
                      value={newParticipant.email}
                      onChange={(e) =>
                        setNewParticipant({ ...newParticipant, email: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input
                      id="role"
                      placeholder="Product Manager"
                      value={newParticipant.role}
                      onChange={(e) =>
                        setNewParticipant({ ...newParticipant, role: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      placeholder="Engineering"
                      value={newParticipant.department}
                      onChange={(e) =>
                        setNewParticipant({ ...newParticipant, department: e.target.value })
                      }
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Participant
                  </Button>
                </form>
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
    </div>
  );
}
