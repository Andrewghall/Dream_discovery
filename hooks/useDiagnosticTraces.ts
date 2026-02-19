'use client';

import { useState, useCallback, useRef } from 'react';
import type { DiagnosticTrace, DiagnosticStats, ServerTimings } from '@/lib/diagnostics/types';

type PartialTrace = Partial<DiagnosticTrace> & { traceId: string };

function computeSegments(t: PartialTrace): Partial<DiagnosticTrace> {
  const segments: Partial<DiagnosticTrace> = {};

  if (t.t_captureApiSent && t.t_audioCaptured) {
    segments.queueWaitMs = t.t_captureApiSent - t.t_audioCaptured;
  }
  if (t.t_captureApiReceived && t.t_captureApiSent) {
    segments.captureApiMs = t.t_captureApiReceived - t.t_captureApiSent;
  }
  if (t.t_sseEmitted && t.t_serverReceived) {
    segments.serverProcessingMs = t.t_sseEmitted - t.t_serverReceived;
  }
  if (t.t_dbWriteComplete && t.t_serverReceived) {
    segments.dbWriteMs = t.t_dbWriteComplete - t.t_serverReceived;
  }
  if (t.t_uiRendered && t.t_audioCaptured) {
    segments.totalE2eMs = t.t_uiRendered - t.t_audioCaptured;
  }

  return segments;
}

function computeStats(traces: DiagnosticTrace[]): DiagnosticStats {
  const complete = traces.filter((t) => t.totalE2eMs > 0);
  if (complete.length === 0) {
    return {
      count: 0,
      avgE2eMs: 0,
      p95E2eMs: 0,
      minE2eMs: 0,
      maxE2eMs: 0,
      avgCaptureApiMs: 0,
      avgServerProcessingMs: 0,
      avgDbWriteMs: 0,
      avgQueueWaitMs: 0,
    };
  }

  const e2es = complete.map((t) => t.totalE2eMs).sort((a, b) => a - b);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const p95Idx = Math.floor(e2es.length * 0.95);

  return {
    count: complete.length,
    avgE2eMs: Math.round(avg(e2es)),
    p95E2eMs: Math.round(e2es[Math.min(p95Idx, e2es.length - 1)]),
    minE2eMs: Math.round(e2es[0]),
    maxE2eMs: Math.round(e2es[e2es.length - 1]),
    avgCaptureApiMs: Math.round(avg(complete.map((t) => t.captureApiMs || 0))),
    avgServerProcessingMs: Math.round(avg(complete.map((t) => t.serverProcessingMs || 0))),
    avgDbWriteMs: Math.round(avg(complete.map((t) => t.dbWriteMs || 0))),
    avgQueueWaitMs: Math.round(avg(complete.map((t) => t.queueWaitMs || 0))),
  };
}

export function useDiagnosticTraces() {
  const mapRef = useRef<Map<string, PartialTrace>>(new Map());
  const [traces, setTraces] = useState<DiagnosticTrace[]>([]);
  const [stats, setStats] = useState<DiagnosticStats>({
    count: 0,
    avgE2eMs: 0,
    p95E2eMs: 0,
    minE2eMs: 0,
    maxE2eMs: 0,
    avgCaptureApiMs: 0,
    avgServerProcessingMs: 0,
    avgDbWriteMs: 0,
    avgQueueWaitMs: 0,
  });
  const [paused, setPaused] = useState(false);

  const flush = useCallback(() => {
    const all = Array.from(mapRef.current.values());
    const complete = all
      .filter((t) => t.totalE2eMs && t.totalE2eMs > 0)
      .map((t) => t as DiagnosticTrace);
    // Sort newest first
    complete.sort((a, b) => (b.t_audioCaptured || 0) - (a.t_audioCaptured || 0));
    setTraces(complete);
    setStats(computeStats(complete));
  }, []);

  const recordTimestamp = useCallback(
    (traceId: string, stage: keyof DiagnosticTrace, value: number) => {
      if (paused) return;
      const existing = mapRef.current.get(traceId) || { traceId };
      (existing as any)[stage] = value;
      const segments = computeSegments(existing);
      Object.assign(existing, segments);
      mapRef.current.set(traceId, existing);
      // Flush on render-complete timestamp (final stage)
      if (stage === 't_uiRendered') {
        flush();
      }
    },
    [paused, flush]
  );

  const setTextPreview = useCallback(
    (traceId: string, text: string) => {
      if (paused) return;
      const existing = mapRef.current.get(traceId) || { traceId };
      existing.textPreview = text.slice(0, 40);
      mapRef.current.set(traceId, existing);
    },
    [paused]
  );

  const setCaptureApiReportedMs = useCallback(
    (traceId: string, ms: number) => {
      if (paused) return;
      const existing = mapRef.current.get(traceId) || { traceId };
      existing.captureApiReportedMs = ms;
      mapRef.current.set(traceId, existing);
    },
    [paused]
  );

  const mergeServerTimestamps = useCallback(
    (serverTimings: ServerTimings) => {
      if (paused) return;
      const existing = mapRef.current.get(serverTimings.traceId);
      if (!existing) return;
      existing.t_serverReceived = serverTimings.t_serverReceived;
      existing.t_dbWriteComplete = serverTimings.t_dbWriteComplete;
      existing.t_sseEmitted = serverTimings.t_sseEmitted;
      const segments = computeSegments(existing);
      Object.assign(existing, segments);
      mapRef.current.set(serverTimings.traceId, existing);
    },
    [paused]
  );

  const clear = useCallback(() => {
    mapRef.current.clear();
    setTraces([]);
    setStats({
      count: 0,
      avgE2eMs: 0,
      p95E2eMs: 0,
      minE2eMs: 0,
      maxE2eMs: 0,
      avgCaptureApiMs: 0,
      avgServerProcessingMs: 0,
      avgDbWriteMs: 0,
      avgQueueWaitMs: 0,
    });
  }, []);

  const exportTraces = useCallback(() => {
    const all = Array.from(mapRef.current.values());
    const json = JSON.stringify(all, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-traces-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    traces,
    stats,
    paused,
    setPaused,
    recordTimestamp,
    setTextPreview,
    setCaptureApiReportedMs,
    mergeServerTimestamps,
    clear,
    exportTraces,
  };
}
