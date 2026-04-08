'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Sparkles, CheckCircle2, XCircle, Loader2, SkipForward, AlertTriangle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'complete' | 'error' | 'skipped';

interface Step {
  step: number;
  label: string;
  status: StepStatus;
  error?: string;
  skipReason?: string;
}

interface SSEEvent {
  type: 'step_start' | 'step_complete' | 'step_error' | 'step_skipped' | 'done';
  step?: number;
  total?: number;
  label?: string;
  error?: string;
  reason?: string;
  stepsCompleted?: number;
  stepsFailed?: number;
  stepsSkipped?: number;
}

// ── Step icon ──────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-5 w-5 text-purple-500 animate-spin" />;
    case 'complete':
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'skipped':
      return <SkipForward className="h-5 w-5 text-muted-foreground" />;
    default:
      return (
        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
      );
  }
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  workshopId: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Discovery Synthesis',
  'Output Intelligence',
  'Evidence Cross-Validation',
  'Evidence Synthesis',
];

function buildInitialSteps(): Step[] {
  return STEP_LABELS.map((label, i) => ({
    step: i + 1,
    label,
    status: 'pending',
  }));
}

export function GenerateAnalysisClient({ workshopId }: Props) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [steps, setSteps] = useState<Step[]>(buildInitialSteps());
  const [summary, setSummary] = useState<{
    stepsCompleted: number;
    stepsFailed: number;
    stepsSkipped: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function updateStep(stepNum: number, patch: Partial<Step>) {
    setSteps(prev =>
      prev.map(s => (s.step === stepNum ? { ...s, ...patch } : s)),
    );
  }

  async function handleGenerate() {
    if (running) return;

    // Reset state
    setSteps(buildInitialSteps());
    setSummary(null);
    setDone(false);
    setRunning(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const resp = await fetch(
        `/api/admin/workshops/${workshopId}/generate-analysis`,
        { method: 'POST', signal: abort.signal },
      );

      if (!resp.ok || !resp.body) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as SSEEvent;

            switch (event.type) {
              case 'step_start':
                if (event.step != null) {
                  updateStep(event.step, { status: 'running' });
                }
                break;
              case 'step_complete':
                if (event.step != null) {
                  updateStep(event.step, { status: 'complete' });
                }
                break;
              case 'step_error':
                if (event.step != null) {
                  updateStep(event.step, {
                    status: 'error',
                    error: event.error,
                  });
                }
                break;
              case 'step_skipped':
                if (event.step != null) {
                  updateStep(event.step, {
                    status: 'skipped',
                    skipReason: event.reason,
                  });
                }
                break;
              case 'done':
                setSummary({
                  stepsCompleted: event.stepsCompleted ?? 0,
                  stepsFailed: event.stepsFailed ?? 0,
                  stepsSkipped: event.stepsSkipped ?? 0,
                });
                setDone(true);
                break;
            }
          } catch {
            // non-JSON line — skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // Mark any still-running step as errored
        setSteps(prev =>
          prev.map(s =>
            s.status === 'running'
              ? { ...s, status: 'error', error: (err as Error).message }
              : s,
          ),
        );
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  const hasFailed = steps.some(s => s.status === 'error');

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Trigger button */}
      <div className="flex flex-col items-start gap-3">
        <button
          onClick={handleGenerate}
          disabled={running}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all
            ${running
              ? 'bg-purple-400 text-white cursor-not-allowed opacity-70'
              : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow-md'
            }`}
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {running ? 'Generating…' : 'Generate Full Analysis'}
        </button>
        <p className="text-xs text-muted-foreground">
          Runs Discovery Synthesis, Output Intelligence, and Evidence pipelines in sequence.
          This may take 2–4 minutes.
        </p>
      </div>

      {/* Step progress */}
      <div className="rounded-xl border bg-card divide-y">
        {steps.map(step => (
          <div key={step.step} className="flex items-start gap-4 px-5 py-4">
            <StepIcon status={step.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    step.status === 'pending'
                      ? 'text-muted-foreground'
                      : step.status === 'running'
                      ? 'text-foreground'
                      : step.status === 'complete'
                      ? 'text-foreground'
                      : step.status === 'skipped'
                      ? 'text-muted-foreground'
                      : 'text-red-600'
                  }`}
                >
                  {step.label}
                </span>
                {step.status === 'running' && (
                  <span className="text-xs text-purple-500 font-medium">Running…</span>
                )}
                {step.status === 'complete' && (
                  <span className="text-xs text-emerald-600 font-medium">Done</span>
                )}
                {step.status === 'skipped' && (
                  <span className="text-xs text-muted-foreground">Skipped</span>
                )}
              </div>
              {step.status === 'skipped' && step.skipReason && (
                <p className="mt-0.5 text-xs text-muted-foreground">{step.skipReason}</p>
              )}
              {step.status === 'error' && step.error && (
                <p className="mt-0.5 text-xs text-red-500 flex items-start gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {step.error}
                </p>
              )}
            </div>
            <span className="text-xs text-muted-foreground/50 shrink-0 pt-0.5">
              Step {step.step} / {STEP_LABELS.length}
            </span>
          </div>
        ))}
      </div>

      {/* Completion summary */}
      {done && summary && (
        <div
          className={`rounded-xl border p-5 ${
            hasFailed
              ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
              : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            {hasFailed ? (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
            <span
              className={`font-semibold ${
                hasFailed ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'
              }`}
            >
              {hasFailed ? 'Analysis complete with errors' : 'Analysis complete'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {summary.stepsCompleted} step{summary.stepsCompleted !== 1 ? 's' : ''} completed
            {summary.stepsSkipped > 0 &&
              `, ${summary.stepsSkipped} skipped`}
            {summary.stepsFailed > 0 &&
              `, ${summary.stepsFailed} failed`}.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/workshops/${workshopId}/scratchpad`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-card border text-sm font-medium hover:bg-accent/50 transition-colors"
            >
              View Report
            </Link>
            <Link
              href={`/admin/workshops/${workshopId}/intelligence`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-card border text-sm font-medium hover:bg-accent/50 transition-colors"
            >
              Brain Scan
            </Link>
            <Link
              href={`/admin/workshops/${workshopId}/evidence`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-card border text-sm font-medium hover:bg-accent/50 transition-colors"
            >
              Evidence
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
