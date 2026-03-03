'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, RefreshCcw, Loader2, AlertCircle } from 'lucide-react';
import { CaptureSessionForm } from '@/components/field-discovery/capture-session-form';
import type { DomainPack, SessionFormData } from '@/components/field-discovery/capture-session-form';
import { DesktopCaptureControls } from '@/components/field-discovery/desktop-capture-controls';
import { CaptureInbox } from '@/components/field-discovery/capture-inbox';
import type { CaptureSessionItem } from '@/components/field-discovery/capture-inbox';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionProgress {
  totalSessions: number;
  byStatus: Record<string, number>;
  byCaptureType: Record<string, number>;
  byActorRole: Record<string, number>;
  totalSegments: number;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FieldDiscoveryPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [showForm, setShowForm] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<CaptureSessionItem[]>([]);
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [domainPackConfig, setDomainPackConfig] = useState<DomainPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Fetch workshop data (for domainPackConfig) ----
  const fetchWorkshop = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}`);
      if (!res.ok) throw new Error('Failed to load workshop');
      const data = await res.json();
      setDomainPackConfig(data.workshop?.domainPackConfig ?? null);
    } catch (err) {
      console.error('Error loading workshop:', err);
      setError('Could not load workshop data.');
    }
  }, [workshopId]);

  // ---- Fetch capture sessions + progress ----
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/capture-sessions`);
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json();
      setSessions(data.sessions ?? []);
      setProgress(data.progress ?? null);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError('Could not load capture sessions.');
    }
  }, [workshopId]);

  // ---- Initial load ----
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      await Promise.all([fetchWorkshop(), fetchSessions()]);
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [fetchWorkshop, fetchSessions]);

  // ---- Create session handler ----
  const handleCreateSession = useCallback(
    async (formData: SessionFormData) => {
      try {
        const res = await fetch(`/api/admin/workshops/${workshopId}/capture-sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, deviceType: 'desktop' }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(err.error ?? 'Failed to create session');
        }

        const data = await res.json();
        setActiveSessionId(data.session.id);
        setShowForm(false);

        // Refresh session list
        await fetchSessions();
      } catch (err) {
        console.error('Error creating session:', err);
        setError(err instanceof Error ? err.message : 'Failed to create session');
      }
    },
    [workshopId, fetchSessions],
  );

  // ---- Refresh handler ----
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await fetchSessions();
    setLoading(false);
  }, [fetchSessions]);

  // ---- Derived progress values ----
  const totalSessions = progress?.totalSessions ?? 0;
  const analysedCount = progress?.byStatus?.ANALYSED ?? 0;
  const progressPercent = totalSessions > 0 ? Math.round((analysedCount / totalSessions) * 100) : 0;

  // ---- Render ----

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Discovery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capture interviews and walkarounds on-site, then synthesise findings.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* Section A - Start Interview Session                              */}
      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Start Interview Session</CardTitle>
              <CardDescription>
                Set up a new capture session for an interview or walkaround.
              </CardDescription>
            </div>
            {!showForm && !activeSessionId && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Mic className="h-4 w-4 mr-2" />
                New Session
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showForm && !activeSessionId && (
            <CaptureSessionForm
              domainPackConfig={domainPackConfig}
              onSubmit={handleCreateSession}
              onCancel={() => setShowForm(false)}
            />
          )}

          {activeSessionId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Session Active</Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  {activeSessionId}
                </span>
              </div>
              <DesktopCaptureControls
                workshopId={workshopId}
                sessionId={activeSessionId}
                onSessionComplete={() => {
                  setActiveSessionId(null);
                  fetchSessions();
                }}
              />
            </div>
          )}

          {!showForm && !activeSessionId && (
            <p className="text-sm text-muted-foreground">
              Click &quot;New Session&quot; to begin capturing an interview or walkaround.
            </p>
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------------------------- */}
      {/* Section B - Capture Inbox                                        */}
      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Capture Inbox</CardTitle>
          <CardDescription>
            Review recorded sessions, transcripts, and extracted findings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CaptureInbox
            workshopId={workshopId}
            sessions={sessions}
          />
        </CardContent>
      </Card>

      {/* --------------------------------------------------------------- */}
      {/* Section C - Synthesis Progress                                   */}
      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Synthesis Progress</CardTitle>
          <CardDescription>
            Track how many sessions have been fully analysed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{totalSessions}</p>
              <p className="text-xs text-muted-foreground">Total Sessions</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{analysedCount}</p>
              <p className="text-xs text-muted-foreground">Analysed</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{progress?.totalSegments ?? 0}</p>
              <p className="text-xs text-muted-foreground">Segments</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Analysis progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {analysedCount} of {totalSessions} sessions analysed
            </p>
          </div>

          {/* Status breakdown */}
          {progress && Object.keys(progress.byStatus).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {Object.entries(progress.byStatus).map(([status, count]) => (
                <Badge key={status} variant="outline" className="text-xs">
                  {status.replace(/_/g, ' ')}: {count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
