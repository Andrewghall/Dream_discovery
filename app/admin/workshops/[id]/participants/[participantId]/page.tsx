'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConversationReport as ConversationReportView, PhaseInsight } from '@/components/report/conversation-report';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type PageProps = {
  params: Promise<{ id: string; participantId: string }>;
};

type AnswersSession = {
  sessionId: string;
  status: string;
  runType: string | null;
  questionSetVersion: string | null;
  createdAt: string;
  completedAt: string | null;
  participant: {
    id: string;
    name: string;
    email: string;
    role: string | null;
    department: string | null;
  };
  qaPairs: Array<{
    phase: string | null;
    question: string;
    questionKey: string;
    answer: string;
    createdAt: string;
  }>;
};

type AnswersResponse = {
  workshopId: string;
  sessions: AnswersSession[];
};

type StoredReport = {
  sessionId: string;
  executiveSummary: string;
  tone: string | null;
  feedback: string;
  inputQuality: unknown | null;
  keyInsights: unknown | null;
  phaseInsights: unknown | null;
  wordCloudThemes: unknown | null;
  modelVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

type AssessmentResponse = {
  ok: boolean;
  report: StoredReport | null;
  insights: unknown[];
  error?: string;
};

function formatRunLabel(runType: string | null): string {
  if (!runType) return 'Run';
  const v = runType.toUpperCase();
  if (v === 'BASELINE') return 'Baseline';
  if (v === 'FOLLOWUP') return 'Follow-up';
  return runType;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function ParticipantResponsesPage({ params }: PageProps) {
  const { id: workshopId, participantId } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AnswersSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [report, setReport] = useState<StoredReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [backfillInfo, setBackfillInfo] = useState<null | {
    counts?: {
      expectedKeys?: number;
      existingQuestionKeys?: number;
      missingQuestionKeys?: number;
      assignable?: number;
    };
    preview?: Array<{ dataPointId: string; createdAt: string; questionKey: string | null; rawText: string }>;
    updated?: number;
    skipped?: number;
  }>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError(null);

        const r = await fetch(
          `/api/admin/workshops/${encodeURIComponent(workshopId)}/answers?participantId=${encodeURIComponent(
            participantId
          )}&includeIncomplete=1&bust=${Date.now()}`,
          { cache: 'no-store' }
        );

        const data = (await r.json().catch(() => null)) as AnswersResponse | null;
        if (!r.ok || !data) {
          setSessions([]);
          setSelectedSessionId('');
          setError('Failed to load participant responses');
          return;
        }

        const nextSessions = Array.isArray(data.sessions) ? data.sessions : [];
        setSessions(nextSessions);
        setSelectedSessionId((prev) => {
          const prevStillExists = prev && nextSessions.some((s) => s.sessionId === prev);
          if (prevStillExists) return prev;
          const withAnswers = nextSessions.find((s) => (s.qaPairs || []).length > 0);
          if (withAnswers) return withAnswers.sessionId;
          const completed = nextSessions.find((s) => !!s.completedAt);
          if (completed) return completed.sessionId;
          return nextSessions[0]?.sessionId ?? '';
        });
      } catch (e) {
        setSessions([]);
        setSelectedSessionId('');
        setError(e instanceof Error ? e.message : 'Failed to load participant responses');
      } finally {
        setLoading(false);
      }
    };

    void fetchSessions();
  }, [workshopId, participantId]);

  const refreshSessions = async () => {
    try {
      setLoading(true);
      setError(null);

      const r = await fetch(
        `/api/admin/workshops/${encodeURIComponent(workshopId)}/answers?participantId=${encodeURIComponent(
          participantId
        )}&includeIncomplete=1&bust=${Date.now()}`,
        { cache: 'no-store' }
      );

      const data = (await r.json().catch(() => null)) as AnswersResponse | null;
      if (!r.ok || !data) {
        setSessions([]);
        setSelectedSessionId('');
        setError('Failed to load participant responses');
        return;
      }

      const nextSessions = Array.isArray(data.sessions) ? data.sessions : [];
      setSessions(nextSessions);
      setSelectedSessionId((prev) => {
        const prevStillExists = prev && nextSessions.some((s) => s.sessionId === prev);
        if (prevStillExists) return prev;
        const withAnswers = nextSessions.find((s) => (s.qaPairs || []).length > 0);
        if (withAnswers) return withAnswers.sessionId;
        const completed = nextSessions.find((s) => !!s.completedAt);
        if (completed) return completed.sessionId;
        return nextSessions[0]?.sessionId ?? '';
      });
    } catch (e) {
      setSessions([]);
      setSelectedSessionId('');
      setError(e instanceof Error ? e.message : 'Failed to load participant responses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchReport = async () => {
      if (!selectedSessionId) {
        setReport(null);
        setReportError(null);
        return;
      }

      try {
        setReportLoading(true);
        setReportError(null);

        const r = await fetch(
          `/api/admin/sessions/${encodeURIComponent(selectedSessionId)}/assessment?bust=${Date.now()}`,
          { cache: 'no-store' }
        );

        const data = (await r.json().catch(() => null)) as AssessmentResponse | null;
        if (!r.ok || !data || !data.ok) {
          const msg = data && typeof data.error === 'string' ? data.error : 'Failed to load report';
          setReport(null);
          setReportError(msg);
          return;
        }

        setReport(data.report);
      } catch (e) {
        setReport(null);
        setReportError(e instanceof Error ? e.message : 'Failed to load report');
      } finally {
        setReportLoading(false);
      }
    };

    void fetchReport();
  }, [selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.sessionId === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const participant = selectedSession?.participant ?? sessions[0]?.participant ?? null;

  const phaseInsights = useMemo(() => {
    const raw = report?.phaseInsights;
    return Array.isArray(raw) ? (raw as PhaseInsight[]) : [];
  }, [report?.phaseInsights]);

  const wordCloudThemes = useMemo(() => {
    const raw = report?.wordCloudThemes;
    return Array.isArray(raw) ? (raw as Array<{ text: string; value: number }>) : [];
  }, [report?.wordCloudThemes]);

  const inputQuality = useMemo(() => {
    const raw = report?.inputQuality;
    if (!raw || typeof raw !== 'object') return undefined;
    return raw as { score: number; label: 'high' | 'medium' | 'low'; rationale: string };
  }, [report?.inputQuality]);

  const keyInsights = useMemo(() => {
    const raw = report?.keyInsights;
    return Array.isArray(raw)
      ? (raw as Array<{ title: string; insight: string; confidence: 'high' | 'medium' | 'low'; evidence: string[] }>)
      : undefined;
  }, [report?.keyInsights]);

  const handleGenerateReport = async (force: boolean) => {
    if (!selectedSessionId) return;
    if (isGeneratingReport) return;

    try {
      setIsGeneratingReport(true);
      setReportError(null);

      const url = `/api/admin/sessions/${encodeURIComponent(selectedSessionId)}/assessment${force ? '?force=1' : ''}`;
      const r = await fetch(url, { method: 'POST' });
      const data = (await r.json().catch(() => null)) as AssessmentResponse | null;

      if (!r.ok || !data || !data.ok) {
        const msg = data && typeof data.error === 'string' ? data.error : 'Failed to generate report';
        setReportError(msg);
        return;
      }

      setReport(data.report);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handlePreviewBackfill = async () => {
    if (!selectedSessionId) return;
    if (backfillLoading) return;

    try {
      setBackfillLoading(true);
      setBackfillError(null);
      setBackfillInfo(null);

      const r = await fetch(
        `/api/admin/sessions/${encodeURIComponent(selectedSessionId)}/backfill-question-keys?bust=${Date.now()}`,
        { cache: 'no-store' }
      );

      const data = (await r.json().catch(() => null)) as unknown as {
        ok?: boolean;
        error?: string;
        counts?: {
          expectedKeys?: number;
          existingQuestionKeys?: number;
          missingQuestionKeys?: number;
          assignable?: number;
        };
        preview?: Array<{ dataPointId: string; createdAt: string; questionKey: string | null; rawText: string }>;
      } | null;

      if (!r.ok || !data || !data.ok) {
        const msg = data && typeof data.error === 'string' ? data.error : 'Failed to preview backfill';
        setBackfillError(msg);
        return;
      }

      setBackfillInfo({ counts: data.counts, preview: data.preview });
    } catch (e) {
      setBackfillError(e instanceof Error ? e.message : 'Failed to preview backfill');
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleApplyBackfill = async () => {
    if (!selectedSessionId) return;
    if (backfillLoading) return;

    try {
      setBackfillLoading(true);
      setBackfillError(null);

      const r = await fetch(
        `/api/admin/sessions/${encodeURIComponent(selectedSessionId)}/backfill-question-keys`,
        { method: 'POST' }
      );

      const data = (await r.json().catch(() => null)) as unknown as {
        ok?: boolean;
        error?: string;
        updated?: number;
        skipped?: number;
      } | null;

      if (!r.ok || !data || !data.ok) {
        const msg = data && typeof data.error === 'string' ? data.error : 'Failed to apply backfill';
        setBackfillError(msg);
        return;
      }

      setBackfillInfo((prev: typeof backfillInfo) => ({
        ...(prev || {}),
        updated: typeof data.updated === 'number' ? data.updated : undefined,
        skipped: typeof data.skipped === 'number' ? data.skipped : undefined,
      }));

      await refreshSessions();
    } catch (e) {
      setBackfillError(e instanceof Error ? e.message : 'Failed to apply backfill');
    } finally {
      setBackfillLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href={`/admin/workshops/${encodeURIComponent(workshopId)}`}>
            <Button variant="ghost">Back</Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {participant ? participant.name : 'Participant'}
            </CardTitle>
            <CardDescription>
              {participant ? participant.email : `Participant ${participantId}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : sessions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No completed sessions found.</div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm font-medium">Session</div>
                  <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                    <SelectTrigger className="w-[320px]">
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((s) => {
                        const label = `${formatRunLabel(s.runType)} • ${s.questionSetVersion || 'v1'} • ${formatDate(
                          s.createdAt
                        )}`;
                        return (
                          <SelectItem key={s.sessionId} value={s.sessionId}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {selectedSession?.runType ? <Badge variant="outline">{formatRunLabel(selectedSession.runType)}</Badge> : null}
                  {selectedSession?.questionSetVersion ? (
                    <Badge variant="outline">{selectedSession.questionSetVersion}</Badge>
                  ) : null}
                  {selectedSession?.status ? <Badge>{selectedSession.status}</Badge> : null}
                </div>

                {selectedSessionId ? (
                  <div className="text-xs text-muted-foreground">
                    SessionId: <span className="font-mono text-foreground">{selectedSessionId}</span>
                  </div>
                ) : null}

                {selectedSession ? (
                  <div className="grid grid-cols-1 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Responses</CardTitle>
                        <CardDescription>
                          Created: {formatDate(selectedSession.createdAt)}
                          {selectedSession.completedAt ? ` • Completed: ${formatDate(selectedSession.completedAt)}` : ''}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm text-muted-foreground">
                            If synthetic answers are present but not recognized, run the backfill to attach question keys.
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => void handlePreviewBackfill()}
                              disabled={!selectedSessionId || backfillLoading}
                            >
                              {backfillLoading ? 'Working…' : 'Preview backfill'}
                            </Button>
                            <Button
                              onClick={() => void handleApplyBackfill()}
                              disabled={!selectedSessionId || backfillLoading}
                            >
                              {backfillLoading ? 'Applying…' : 'Apply backfill'}
                            </Button>
                          </div>
                        </div>

                        {backfillError ? (
                          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {backfillError}
                          </div>
                        ) : null}

                        {backfillInfo?.counts ? (
                          <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>Expected keys: {backfillInfo.counts.expectedKeys ?? '—'}</div>
                            <div>Existing keys: {backfillInfo.counts.existingQuestionKeys ?? '—'}</div>
                            <div>Missing keys: {backfillInfo.counts.missingQuestionKeys ?? '—'}</div>
                            <div>Assignable: {backfillInfo.counts.assignable ?? '—'}</div>
                          </div>
                        ) : null}

                        {typeof backfillInfo?.updated === 'number' ? (
                          <div className="mb-3 text-xs text-muted-foreground">
                            Backfill applied: updated {backfillInfo.updated}
                            {typeof backfillInfo.skipped === 'number' ? `, skipped ${backfillInfo.skipped}` : ''}
                          </div>
                        ) : null}

                        {selectedSession.qaPairs.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No answers recorded.</div>
                        ) : (
                          <div className="space-y-4">
                            {selectedSession.qaPairs.map((qa) => (
                              <div key={`${qa.questionKey}:${qa.createdAt}`} className="rounded-md border p-3">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  {qa.phase ? <Badge variant="outline">{qa.phase}</Badge> : null}
                                  <div className="text-xs text-muted-foreground">{formatDate(qa.createdAt)}</div>
                                </div>
                                <div className="text-sm font-medium">{qa.question}</div>
                                <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{qa.answer}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Report</CardTitle>
                        <CardDescription>
                          This will show the stored end-of-discovery report once we generate and attach ConversationReports.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm text-muted-foreground">
                            {reportLoading ? 'Loading report…' : report ? 'Stored report found.' : 'Not generated yet.'}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => void handleGenerateReport(false)}
                              disabled={!selectedSessionId || isGeneratingReport}
                            >
                              {isGeneratingReport ? 'Generating…' : 'Generate'}
                            </Button>
                            <Button
                              onClick={() => void handleGenerateReport(true)}
                              disabled={!selectedSessionId || isGeneratingReport}
                            >
                              {isGeneratingReport ? 'Refreshing…' : 'Refresh'}
                            </Button>
                          </div>
                        </div>

                        {reportError ? (
                          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {reportError}
                          </div>
                        ) : null}

                        {report && phaseInsights.length > 0 && wordCloudThemes.length > 0 ? (
                          <div className="mt-4">
                            <ConversationReportView
                              executiveSummary={report.executiveSummary}
                              tone={report.tone}
                              feedback={report.feedback}
                              inputQuality={inputQuality}
                              keyInsights={keyInsights}
                              phaseInsights={phaseInsights}
                              wordCloudThemes={wordCloudThemes}
                            />
                          </div>
                        ) : report && !reportLoading ? (
                          <div className="mt-3 text-sm text-muted-foreground">
                            Report stored, but missing required chart data.
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
