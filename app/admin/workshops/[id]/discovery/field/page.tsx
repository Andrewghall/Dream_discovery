'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, RefreshCcw, Loader2, AlertCircle, Smartphone, Link2, Copy, Check, Sparkles, CheckCircle2, XCircle, Download } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { CaptureSessionForm } from '@/components/field-discovery/capture-session-form';
import type { DomainPack, SessionFormData } from '@/components/field-discovery/capture-session-form';
import { DesktopCaptureControls } from '@/components/field-discovery/desktop-capture-controls';
import { CaptureInbox } from '@/components/field-discovery/capture-inbox';
import type { CaptureSessionItem } from '@/components/field-discovery/capture-inbox';
import { FieldInsightsView } from '@/components/field-discovery/field-insights-view';
import { HistoricalEvidenceUploader, HISTORICAL_UPLOAD_ACCEPT } from '@/components/evidence/HistoricalEvidenceUploader';
import QRCode from 'react-qr-code';

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

  const [activeTab, setActiveTab] = useState<'capture' | 'insights'>('capture');
  const [showForm, setShowForm] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<CaptureSessionItem[]>([]);
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [domainPackConfig, setDomainPackConfig] = useState<DomainPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContext, setCsvContext] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    findingsCreated: number;
    fileName: string;
    findings: Array<{ lens: string; type: string; title: string }>;
  } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Capture token state — persisted to sessionStorage so page refresh doesn't lose the QR code
  const STORAGE_KEY = `capture-link-${workshopId}`;
  const [captureToken, setCaptureToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return sessionStorage.getItem(`${STORAGE_KEY}-token`); } catch { return null; }
  });
  const [captureLink, setCaptureLink] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [generatingToken, setGeneratingToken] = useState(false);
  const [copied, setCopied] = useState(false);

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
      if (res.status === 403) {
        setError('Access denied: you do not have permission to view sessions for this workshop.');
        return;
      }
      if (!res.ok) {
        let detail = `Server error (${res.status})`;
        try {
          const body = await res.json();
          if (body.detail) detail = body.detail;
          else if (body.error) detail = body.error;
        } catch { /* ignore JSON parse errors */ }
        setError(`Could not load sessions: ${detail}`);
        return;
      }
      setError(null);
      const data = await res.json();
      setSessions(data.sessions ?? []);
      setProgress(data.progress ?? null);
    } catch (err) {
      console.error('Error loading sessions:', err);
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

  // ---- Background poll ----
  // When a capture link is active (phone may be recording) we poll every 3 s so new
  // sessions appear almost immediately. Otherwise 15 s is fine for terminal cleanup.
  // Polls whenever:
  //   • a capture link is active (fast: 3 s)
  //   • any session is non-terminal (fast: 3 s)
  //   • the session list is still empty (fast: 3 s)
  // Stops when ALL sessions are terminal AND no capture link is active, OR when there
  // is an error (e.g. 500 from the server) — user must hit Refresh to re-enable.
  useEffect(() => {
    const TERMINAL = ['ANALYSED', 'FAILED', 'CANCELLED'];
    const hasActive = sessions.some((s) => !TERMINAL.includes((s as { status?: string }).status ?? ''));
    const shouldPoll = !error && (hasActive || sessions.length === 0 || !!captureLink);

    if (!shouldPoll) return;

    // Fast poll when capture is live; slower once everything is terminal
    const intervalMs = captureLink || hasActive || sessions.length === 0 ? 3_000 : 15_000;

    const interval = setInterval(() => {
      fetchSessions(); // silent — fetchSessions never sets loading
    }, intervalMs);

    return () => clearInterval(interval);
  }, [sessions, fetchSessions, captureLink, error]);

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

  // ---- Bulk delete sessions handler ----
  const handleDeleteSessions = useCallback(async (sessionIds: string[]) => {
    await fetch(`/api/admin/workshops/${workshopId}/capture-sessions/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds }),
    });
    await fetchSessions();
  }, [workshopId, fetchSessions]);

  // ---- Generate capture token handler ----
  async function handleGenerateToken() {
    setGeneratingToken(true);
    try {
      const res = await fetch('/api/capture-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId }),
      });
      if (!res.ok) throw new Error('Failed to generate token');
      const data = await res.json();
      const link = `${window.location.origin}/capture/${data.token}`;
      setCaptureToken(data.token);
      setCaptureLink(link);
      // Persist so page refresh doesn't lose the QR code
      try {
        sessionStorage.setItem(STORAGE_KEY, link);
        sessionStorage.setItem(`${STORAGE_KEY}-token`, data.token);
      } catch { /* sessionStorage unavailable */ }
    } catch (err) {
      console.error('Error generating capture link:', err);
    } finally {
      setGeneratingToken(false);
    }
  }

  // ---- CSV import handler ----
  async function handleCsvImport() {
    if (!csvFile) return;
    setCsvImporting(true);
    setCsvError(null);
    setCsvResult(null);

    try {
      const form = new FormData();
      form.append('file', csvFile);
      if (csvContext.trim()) form.append('context', csvContext.trim());

      const res = await fetch(`/api/admin/workshops/${workshopId}/findings/import-csv`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Import failed');
      }

      const data = await res.json();
      setCsvResult({
        findingsCreated: data.findingsCreated,
        fileName: data.fileName,
        findings: data.findings ?? [],
      });
      setCsvFile(null);
      setCsvContext('');
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setCsvImporting(false);
    }
  }

  // ---- Copy capture link handler ----
  async function handleCopyLink() {
    if (!captureLink) return;
    await navigator.clipboard.writeText(captureLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ---- Download QR code as PNG ----
  function handleDownloadQR() {
    const svgEl = document.querySelector('#capture-qr svg') as SVGSVGElement | null;
    if (!svgEl) return;

    const serialised = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([serialised], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const SIZE = 600;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(pngBlob);
        a.download = `capture-qr-${workshopId.slice(0, 8)}.png`;
        a.click();
      }, 'image/png');
    };
    img.src = url;
  }

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
        {activeTab === 'capture' && (
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['capture', 'insights'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize rounded-t-md transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Insights tab */}
      {activeTab === 'insights' && (
        <FieldInsightsView workshopId={workshopId} />
      )}

      {activeTab === 'capture' && error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {activeTab === 'capture' && (
      <>
      {/* --------------------------------------------------------------- */}
      {/* Import Data File                                                 */}
      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Import Data File</CardTitle>
          </div>
          <CardDescription>
            Drop any CSV — performance reports, survey data, operational stats. The AI reads it,
            understands the context, and extracts diagnostic findings automatically.
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-4">
            <HistoricalEvidenceUploader
              accept={HISTORICAL_UPLOAD_ACCEPT}
              helperText="CSV is preferred, but you can also drop PDF, DOCX, Excel, or text-based files."
              label={csvFile ? csvFile.name : 'Drop a CSV or document file here or click to browse'}
              onFilesSelected={(files) => {
                const file = files[0] ?? null;
                setCsvFile(file);
                setCsvResult(null);
                setCsvError(null);
              }}
            />
            {csvFile && (
              <div className="text-xs text-muted-foreground">
                {(csvFile.size / 1024).toFixed(0)} KB selected — click Upload to import
              </div>
            )}

          {/* Optional context */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Context (optional) — help the AI understand what this data represents
            </label>
            <Textarea
              placeholder="e.g. BA Customer Contact Centre performance data, 6 months to Feb 2026, across 2 internal sites and 2 Allorica outsourced centres in Manila and Krakow"
              value={csvContext}
              onChange={(e) => setCsvContext(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Import button */}
          <Button
            size="sm"
            onClick={handleCsvImport}
            disabled={!csvFile || csvImporting}
          >
            {csvImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analysing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyse &amp; Extract Findings
              </>
            )}
          </Button>

          {/* Error */}
          {csvError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              <XCircle className="h-4 w-4 shrink-0" />
              {csvError}
            </div>
          )}

          {/* Success result */}
          {csvResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  <span className="font-semibold">{csvResult.findingsCreated} findings</span> extracted
                  from <span className="font-mono text-xs">{csvResult.fileName}</span> and added to
                  discovery.
                </span>
              </div>

              {/* Mini breakdown */}
              {csvResult.findings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Extracted findings:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {csvResult.findings.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-background"
                      >
                        <span className="font-medium">{f.lens}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{f.type.replace('_', ' ').toLowerCase()}</span>
                        <span className="text-muted-foreground">·</span>
                        {f.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------------------------- */}
      {/* Mobile Capture Link                                              */}
      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Mobile Capture Link</CardTitle>
          </div>
          <CardDescription>
            Generate a secure link for mobile field capture. Share with team
            members to record deskside interviews on their phone or laptop.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!captureLink && (
            <Button
              size="sm"
              onClick={handleGenerateToken}
              disabled={generatingToken}
            >
              {generatingToken ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Generate Capture Link
            </Button>
          )}

          {captureLink && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs break-all select-all">
                  {captureLink}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  Link expires in 7 days
                </p>
                {copied && (
                  <span className="text-xs font-medium text-green-600">
                    Copied!
                  </span>
                )}
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3 pt-2">
                <div
                  id="capture-qr"
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <QRCode value={captureLink} size={180} />
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
            onDeleteSessions={handleDeleteSessions}
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
      </>
      )}
    </div>
  );
}
