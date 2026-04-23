'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type CompareRow = {
  id: string;
  speakerId: string | null;
  searchText: string;
  capture: {
    rows: Array<{
      id: string;
      sequence: number;
      timestampMs: string;
      speakerId: string | null;
      rawText: string;
      isFinal: boolean;
      speechFinal: boolean;
      confidence: number | null;
    }>;
  };
  stored: {
    rows: Array<{
      id: string;
      workshopId: string;
      linkedSourceChunkId: string;
      writeTimestamp: string;
      speakerId: string | null;
      rawText: string;
    }>;
  };
  processed: {
    thoughtWindowId: string | null;
    commitId: string | null;
    commitTimeMs: number | null;
    committedText: string | null;
    extractedUnits: Array<{
      id: string;
      text: string;
      sequenceIndex: number | null;
      reasoningRole: string | null;
    }>;
    accepted: boolean | null;
    rejectionReason: string | null;
    dataPointIds: string[];
    hemisphereText: string[];
    hemisphereTimeMs: number | null;
    emitEvents: Array<{
      id: string;
      dataPointId: string;
      createdAt: string;
    }>;
    sourceChunkIds: string[];
  };
  timing: {
    captureTimeMs: number | null;
    storedTimeMs: number | null;
    commitTimeMs: number | null;
    hemisphereTimeMs: number | null;
    captureToStoredMs: number | null;
    storedToCommitMs: number | null;
    commitToHemisphereMs: number | null;
    totalMs: number | null;
  };
};

type CompareResponse = {
  workshopId: string;
  workshopName: string;
  rows: CompareRow[];
  generatedAt: string;
};

function fmtAbs(ts: number | string | null): string {
  if (ts === null) return '—';
  const ms = typeof ts === 'string' ? Number(ts) : ts;
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleTimeString();
}

function fmtIso(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}

function fmtDelta(ms: number | null): string {
  if (ms === null) return '—';
  if (Math.abs(ms) < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function SpeakerBadge({ speakerId }: { speakerId: string | null }) {
  return (
    <span className="inline-flex rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
      {speakerId ?? 'unknown'}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{children}</div>;
}

function ValueBlock({ children }: { children: React.ReactNode }) {
  return <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950/70 p-2 text-xs text-zinc-200">{children}</pre>;
}

export default function DebugComparePage() {
  const params = useParams<{ id: string }>();
  const workshopId = params.id;
  const [data, setData] = useState<CompareResponse | null>(null);
  const [query, setQuery] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/admin/workshops/${workshopId}/debug/compare`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const json = await res.json() as CompareResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };

    void load();
    const interval = setInterval(() => {
      if (live) void load();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workshopId, live]);

  const speakerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of data?.rows ?? []) {
      if (row.speakerId) set.add(row.speakerId);
    }
    return ['all', ...Array.from(set.values()).sort()];
  }, [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.rows ?? []).filter((row) => {
      if (speakerFilter !== 'all' && row.speakerId !== speakerFilter) return false;
      if (q && !row.searchText.includes(q)) return false;
      return true;
    });
  }, [data, query, speakerFilter]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">Pipeline Compare</h1>
              <p className="text-sm text-zinc-500">
                {data?.workshopName ?? 'Loading…'} · {workshopId}
              </p>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <div>{rows.length} linked rows</div>
              <div>updated {data?.generatedAt ? fmtIso(data.generatedAt) : '—'}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search raw text / committed text / extracted units"
              className="min-w-[340px] flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none ring-0 placeholder:text-zinc-600"
            />
            <select
              value={speakerFilter}
              onChange={(e) => setSpeakerFilter(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              {speakerOptions.map((speaker) => (
                <option key={speaker} value={speaker}>
                  {speaker === 'all' ? 'All speakers' : speaker}
                </option>
              ))}
            </select>
            <button
              onClick={() => setLive((v) => !v)}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              {live ? 'Pause live' : 'Resume live'}
            </button>
          </div>
          {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
        </div>
        <div className="grid grid-cols-3 gap-0 border-t border-zinc-800">
          <div className="border-r border-zinc-800 px-4 py-3 text-sm font-semibold">CaptureAPI In</div>
          <div className="border-r border-zinc-800 px-4 py-3 text-sm font-semibold">Stored in Supabase</div>
          <div className="px-4 py-3 text-sm font-semibold">Processed / Hemisphere</div>
        </div>
      </div>

      <div ref={scrollRef} className="px-0">
        {rows.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-zinc-500">No linked rows yet.</div>
        )}

        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-3 gap-0 border-b border-zinc-900">
            <div className="border-r border-zinc-800 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <SpeakerBadge speakerId={row.speakerId} />
                <div className="text-[11px] text-zinc-500">capture {fmtAbs(row.timing.captureTimeMs)}</div>
              </div>
              <SectionTitle>Incoming Rows</SectionTitle>
              <div className="space-y-3">
                {row.capture.rows.map((capture) => (
                  <div key={capture.id} className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500">
                      <div>timestamp: <span className="text-zinc-300">{fmtAbs(capture.timestampMs)}</span></div>
                      <div>sequence: <span className="text-zinc-300">#{capture.sequence}</span></div>
                      <div>speaker: <span className="text-zinc-300">{capture.speakerId ?? 'unknown'}</span></div>
                      <div>confidence: <span className="text-zinc-300">{capture.confidence === null ? '—' : `${Math.round(capture.confidence * 100)}%`}</span></div>
                      <div>isFinal: <span className="text-zinc-300">{String(capture.isFinal)}</span></div>
                      <div>speechFinal: <span className="text-zinc-300">{String(capture.speechFinal)}</span></div>
                      <div className="col-span-2">chunk id: <span className="text-zinc-300">{capture.id}</span></div>
                    </div>
                    <div className="mt-2">
                      <ValueBlock>{capture.rawText}</ValueBlock>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-r border-zinc-800 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <SpeakerBadge speakerId={row.speakerId} />
                <div className="text-[11px] text-zinc-500">stored {fmtAbs(row.timing.storedTimeMs)}</div>
              </div>
              <SectionTitle>Raw Truth Rows</SectionTitle>
              <div className="space-y-3">
                {row.stored.rows.map((stored) => (
                  <div key={stored.id} className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="grid grid-cols-1 gap-1 text-[11px] text-zinc-500">
                      <div>DB write timestamp: <span className="text-zinc-300">{fmtIso(stored.writeTimestamp)}</span></div>
                      <div>raw transcript row id: <span className="text-zinc-300">{stored.id}</span></div>
                      <div>workshop id: <span className="text-zinc-300">{stored.workshopId}</span></div>
                      <div>speaker: <span className="text-zinc-300">{stored.speakerId ?? 'unknown'}</span></div>
                      <div>linked source chunk id: <span className="text-zinc-300">{stored.linkedSourceChunkId}</span></div>
                    </div>
                    <div className="mt-2">
                      <ValueBlock>{stored.rawText}</ValueBlock>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <SpeakerBadge speakerId={row.speakerId} />
                <div className="text-[11px] text-zinc-500">hemisphere {fmtAbs(row.timing.hemisphereTimeMs)}</div>
              </div>
              <SectionTitle>Processed Passage</SectionTitle>
              <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="grid grid-cols-1 gap-1 text-[11px] text-zinc-500">
                  <div>thought window / commit id: <span className="text-zinc-300">{row.processed.commitId ?? '—'}</span></div>
                  <div>commit time: <span className="text-zinc-300">{fmtAbs(row.timing.commitTimeMs)}</span></div>
                  <div>accepted: <span className="text-zinc-300">{row.processed.accepted === null ? 'pending' : String(row.processed.accepted)}</span></div>
                  <div>rejection reason: <span className="text-zinc-300">{row.processed.rejectionReason ?? '—'}</span></div>
                  <div>datapoint id(s): <span className="text-zinc-300">{row.processed.dataPointIds.length > 0 ? row.processed.dataPointIds.join(', ') : '—'}</span></div>
                  <div>source chunk id(s): <span className="text-zinc-300">{row.processed.sourceChunkIds.length > 0 ? row.processed.sourceChunkIds.join(', ') : '—'}</span></div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Committed text</div>
                  <ValueBlock>{row.processed.committedText ?? '—'}</ValueBlock>
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Extracted unit(s)</div>
                  {row.processed.extractedUnits.length === 0 ? (
                    <ValueBlock>—</ValueBlock>
                  ) : (
                    <div className="space-y-2">
                      {row.processed.extractedUnits.map((unit) => (
                        <div key={unit.id} className="rounded border border-zinc-800 bg-zinc-950/70 p-2">
                          <div className="mb-1 text-[11px] text-zinc-500">
                            {unit.id} · seq {unit.sequenceIndex ?? '—'} · role {unit.reasoningRole ?? '—'}
                          </div>
                          <ValueBlock>{unit.text}</ValueBlock>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Hemisphere text</div>
                  {row.processed.hemisphereText.length === 0 ? (
                    <ValueBlock>—</ValueBlock>
                  ) : (
                    <div className="space-y-2">
                      {row.processed.hemisphereText.map((text, index) => (
                        <ValueBlock key={`${row.id}:hemisphere:${index}`}>{text}</ValueBlock>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-zinc-500">
                  <div>capture → stored: <span className="text-zinc-300">{fmtDelta(row.timing.captureToStoredMs)}</span></div>
                  <div>stored → commit: <span className="text-zinc-300">{fmtDelta(row.timing.storedToCommitMs)}</span></div>
                  <div>commit → hemisphere: <span className="text-zinc-300">{fmtDelta(row.timing.commitToHemisphereMs)}</span></div>
                  <div>total end-to-end: <span className="text-zinc-300">{fmtDelta(row.timing.totalMs)}</span></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
