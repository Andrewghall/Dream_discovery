'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import type { TraceEntry, TraceResponse, TraceOutcome } from '@/lib/debug/trace-types';

// ── Colour helpers ────────────────────────────────────────────────────────────

const OUTCOME_CONFIG: Record<TraceOutcome, { label: string; dot: string; badge: string }> = {
  rendered:               { label: 'Rendered',              dot: 'bg-emerald-500', badge: 'bg-emerald-900 text-emerald-300' },
  blocked_at_commit:      { label: 'Blocked at commit',     dot: 'bg-red-500',     badge: 'bg-red-900 text-red-300' },
  rejected_in_extraction: { label: 'Rejected in extractor', dot: 'bg-amber-500',   badge: 'bg-amber-900 text-amber-300' },
  persisted_not_emitted:  { label: 'Persisted, not emitted',dot: 'bg-amber-500',   badge: 'bg-amber-900 text-amber-300' },
  emitted_not_rendered:   { label: 'Emitted, not rendered', dot: 'bg-amber-500',   badge: 'bg-amber-900 text-amber-300' },
};

const SPEAKER_PALETTE = ['#60a5fa','#34d399','#f59e0b','#c084fc','#fb7185','#22d3ee'];
const speakerColourCache: Record<string, string> = {};
function speakerColour(id: string | null): string {
  if (!id) return '#71717a';
  if (!speakerColourCache[id]) {
    speakerColourCache[id] = SPEAKER_PALETTE[Object.keys(speakerColourCache).length % SPEAKER_PALETTE.length];
  }
  return speakerColourCache[id];
}

// ── Timing helpers ────────────────────────────────────────────────────────────

function relMs(ts: string | null, sessionStartMs: string | null): string {
  if (!ts || !sessionStartMs) return '—';
  const diff = Number(ts) - Number(sessionStartMs);
  if (diff < 0) return '0:00.0';
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const ms = Math.floor((diff % 1000) / 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

function fmtDelta(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Stage card ────────────────────────────────────────────────────────────────

function StageCard({
  index, label, status, children,
}: {
  index: number;
  label: string;
  status: 'pass' | 'blocked' | 'partial' | 'skip' | 'unknown';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const statusColour = {
    pass:    'border-l-emerald-600 text-emerald-400',
    blocked: 'border-l-red-600 text-red-400',
    partial: 'border-l-amber-500 text-amber-400',
    skip:    'border-l-zinc-600 text-zinc-500',
    unknown: 'border-l-zinc-700 text-zinc-600',
  }[status];
  const dot = {
    pass: 'bg-emerald-500', blocked: 'bg-red-500',
    partial: 'bg-amber-500', skip: 'bg-zinc-600', unknown: 'bg-zinc-700',
  }[status];

  return (
    <div className={`border-l-2 pl-4 ${statusColour.split(' ')[0]}`}>
      <button
        className="w-full flex items-center gap-3 py-1.5 text-left group"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="text-xs text-zinc-500 w-4 shrink-0">{index}</span>
        <span className="text-xs font-mono font-semibold text-zinc-300 flex-1">{label}</span>
        <span className={`text-xs font-mono uppercase ${statusColour.split(' ')[1]}`}>
          {status}
        </span>
        <span className="text-zinc-700 text-xs ml-2 group-hover:text-zinc-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-1 mb-3 ml-5 space-y-1 text-xs font-mono">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Timing summary ────────────────────────────────────────────────────────────

function TimingSummary({ t, sessionStartMs }: { t: TraceEntry['timing']; sessionStartMs: string | null }) {
  const rows = [
    ['First chunk',        relMs(t.firstChunkTs, sessionStartMs)],
    ['Last chunk',         relMs(t.lastChunkTs, sessionStartMs)],
    ['Window open',        relMs(t.windowOpenTs, sessionStartMs)],
    ['Window close',       relMs(t.windowCloseTs, sessionStartMs)],
    ['DataPoint created',  t.dataPointCreateTs ? relMs(new Date(t.dataPointCreateTs).getTime().toString(), sessionStartMs) : '—'],
    ['Event emitted',      t.eventEmitTs ? relMs(new Date(t.eventEmitTs).getTime().toString(), sessionStartMs) : '—'],
  ];
  const deltas = [
    ['First chunk → commit',    fmtDelta(t.firstChunkToCommitMs)],
    ['Last chunk → commit',     fmtDelta(t.lastChunkToCommitMs)],
    ['Commit → DataPoint',      fmtDelta(t.commitToDataPointMs)],
    ['DataPoint → emit',        fmtDelta(t.dataPointToEmitMs)],
    ['Total end-to-end',        fmtDelta(t.totalEndToEndMs)],
  ];

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs font-mono py-2">
      <div className="space-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <span className="text-zinc-600">{k}</span>
            <span className="text-zinc-300">{v}</span>
          </div>
        ))}
      </div>
      <div className="space-y-0.5">
        {deltas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <span className="text-zinc-600">{k}</span>
            <span className={v === '—' ? 'text-zinc-700' : 'text-amber-300'}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Full trace card ───────────────────────────────────────────────────────────

function TraceCard({ trace, sessionStartMs }: { trace: TraceEntry; sessionStartMs: string | null }) {
  const [open, setOpen] = useState(false);
  const cfg = OUTCOME_CONFIG[trace.outcome];
  const colour = speakerColour(trace.speakerId);

  return (
    <div className="border border-zinc-800 rounded overflow-hidden bg-zinc-950">
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-900/60 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xs font-mono text-zinc-600 w-14 shrink-0">
          {relMs(trace.windowOpenTs, sessionStartMs)}
        </span>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colour }} />
        <span className="text-xs text-zinc-400 w-20 shrink-0 truncate">{trace.speakerId ?? 'unknown'}</span>
        <span className="flex-1 text-xs text-zinc-300 truncate font-mono">
          {trace.committedText ?? trace.windowFullText}
        </span>
        <span className="text-xs text-zinc-600 shrink-0">{trace.rawChunks.length}c</span>
        <span className={`px-2 py-0.5 rounded text-xs font-mono shrink-0 ${cfg.badge}`}>{cfg.label}</span>
        <span className="text-zinc-700 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-zinc-800 bg-zinc-900/40 px-5 py-4 space-y-4">

          {/* One-line summary */}
          <p className="text-xs font-mono text-zinc-400 bg-zinc-800 rounded px-3 py-2">
            {trace.summary}
          </p>

          {/* Timing */}
          <div className="border border-zinc-800 rounded p-3">
            <p className="text-xs font-mono text-zinc-500 uppercase mb-2">Timing</p>
            <TimingSummary t={trace.timing} sessionStartMs={sessionStartMs} />
          </div>

          {/* Stage pipeline */}
          <div className="space-y-2">

            {/* Stage 1 — Raw Capture */}
            <StageCard index={1} label="Raw Capture" status={trace.rawChunks.length > 0 ? 'pass' : 'unknown'}>
              <div className="text-zinc-500">{trace.rawChunks.length} entries matched to this window</div>
              {trace.rawChunks.map((c) => (
                <div key={c.id} className="flex gap-3 py-0.5 border-b border-zinc-800/50">
                  <span className="text-zinc-700 w-8 shrink-0">#{c.sequence}</span>
                  <span className="text-zinc-600 w-12 shrink-0">{relMs(c.startTimeMs, sessionStartMs)}</span>
                  <span className="text-zinc-400 flex-1">{c.text}</span>
                  {c.speechFinal && <span className="text-emerald-500 shrink-0">FINAL</span>}
                  {c.confidence !== null && <span className="text-zinc-600 shrink-0">{Math.round(c.confidence * 100)}%</span>}
                </div>
              ))}
            </StageCard>

            {/* Stage 2 — TSM Window */}
            <StageCard index={2} label="TSM Window" status="pass">
              <div className="flex gap-4">
                <span className="text-zinc-500">id</span>
                <span className="text-zinc-300">{trace.windowId}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-zinc-500">state</span>
                <span className={trace.windowState === 'RESOLVED' ? 'text-emerald-400' : trace.windowState === 'EXPIRED' ? 'text-red-400' : 'text-amber-400'}>
                  {trace.windowState}
                </span>
              </div>
              <div className="flex gap-4">
                <span className="text-zinc-500">open</span>
                <span className="text-zinc-300">{relMs(trace.windowOpenTs, sessionStartMs)}</span>
                <span className="text-zinc-500">close</span>
                <span className="text-zinc-300">{relMs(trace.windowCloseTs, sessionStartMs)}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-zinc-500">chunks</span>
                <span className="text-zinc-300">{trace.windowChunkCount}</span>
              </div>
              <div className="mt-1 text-zinc-400 border border-zinc-800 rounded p-2 leading-relaxed">
                {trace.windowFullText}
              </div>
            </StageCard>

            {/* Stage 3 — Commit Evaluation */}
            <StageCard
              index={3}
              label="Commit Evaluation"
              status={trace.commitPass ? 'pass' : 'blocked'}
            >
              <div className="flex gap-4">
                <span className="text-zinc-500">result</span>
                <span className={trace.commitPass ? 'text-emerald-400' : 'text-red-400'}>
                  {trace.commitPass ? 'PASS' : 'BLOCKED'}
                </span>
              </div>
              {trace.commitBlockReason && (
                <div className="flex gap-4">
                  <span className="text-zinc-500">reason</span>
                  <span className="text-red-300">{trace.commitBlockReason}</span>
                </div>
              )}
              <div className="flex gap-4">
                <span className="text-zinc-500">words</span>
                <span className="text-zinc-300">{trace.commitWordCount}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-zinc-500">trigger</span>
                <span className="text-zinc-400">{trace.commitTrigger}</span>
              </div>
              <div className="text-zinc-600 italic mt-1">
                Guard + validity scores not persisted — check WINDOW_RESOLVE logs for detail
              </div>
            </StageCard>

            {/* Stage 4 — Commit Result */}
            <StageCard
              index={4}
              label="Commit Result"
              status={trace.committedText ? 'pass' : 'skip'}
            >
              {trace.committedText ? (
                <>
                  <div className="flex gap-4">
                    <span className="text-zinc-500">ts</span>
                    <span className="text-zinc-300">{relMs(trace.commitTs, sessionStartMs)}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-zinc-500">words</span>
                    <span className="text-zinc-300">{trace.commitWordCount}</span>
                  </div>
                  <div className="mt-1 text-zinc-300 border border-zinc-800 rounded p-2 leading-relaxed">
                    {trace.committedText}
                  </div>
                </>
              ) : (
                <span className="text-zinc-600">No committed text — window expired</span>
              )}
            </StageCard>

            {/* Stage 5 — Extraction */}
            <StageCard
              index={5}
              label="Meaning Extraction"
              status={
                !trace.committedText ? 'skip' :
                trace.extractionUnitsProduced === 0 ? 'blocked' : 'pass'
              }
            >
              {!trace.committedText ? (
                <span className="text-zinc-600">Skipped — no committed text</span>
              ) : (
                <>
                  <div className="flex gap-4">
                    <span className="text-zinc-500">units produced</span>
                    <span className={trace.extractionUnitsProduced > 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      {trace.extractionUnitsProduced}
                    </span>
                  </div>
                  {trace.extractionUnitsProduced === 0 && (
                    <div className="text-amber-400">No meaning units found — passage discarded</div>
                  )}
                  {trace.extractionNote && (
                    <div className="mt-1 text-red-300 border border-red-900 rounded px-2 py-1">
                      {trace.extractionNote}
                    </div>
                  )}
                  {trace.extractionUnits.map((u, i) => (
                    <div key={u.id} className="border border-zinc-800 rounded p-2 mt-1 space-y-1">
                      <div className="flex gap-2">
                        <span className="text-zinc-600">unit {i + 1}</span>
                        {u.primaryType && <span className="text-zinc-400">[{u.primaryType}]</span>}
                        {u.primaryDomain && <span className="text-blue-400">[{u.primaryDomain}]</span>}
                        {u.confidence !== null && <span className="text-zinc-600 ml-auto">{Math.round(u.confidence * 100)}%</span>}
                      </div>
                      <div className="text-zinc-200">&ldquo;{u.rawText}&rdquo;</div>
                    </div>
                  ))}
                </>
              )}
            </StageCard>

            {/* Stage 6 — Persistence */}
            <StageCard
              index={6}
              label="Persistence"
              status={
                trace.persistenceSkipped ? 'skip' :
                trace.dataPoints.length > 0 ? 'pass' : 'blocked'
              }
            >
              <div className="flex gap-4">
                <span className="text-zinc-500">thoughtWindow</span>
                <span className="text-zinc-400">{trace.windowId.slice(-10)}</span>
              </div>
              {trace.persistenceSkipped ? (
                <div className="text-amber-400">{trace.persistenceSkippedReason ?? 'skipped'}</div>
              ) : (
                trace.dataPoints.map((dp) => (
                  <div key={dp.id} className="flex gap-3 py-0.5">
                    <span className="text-zinc-500">dp</span>
                    <span className="text-zinc-400">{dp.id.slice(-10)}</span>
                    <span className="text-zinc-600">{dp.createdAt.slice(11, 23)}</span>
                  </div>
                ))
              )}
            </StageCard>

            {/* Stage 7 — Emit */}
            <StageCard
              index={7}
              label="Event Emit"
              status={
                trace.dataPoints.length === 0 ? 'skip' :
                trace.emitted ? 'pass' : 'blocked'
              }
            >
              {trace.dataPoints.length === 0 ? (
                <span className="text-zinc-600">No DataPoints to emit</span>
              ) : trace.emitEvents.length === 0 ? (
                <span className="text-red-400">No datapoint.created event found in outbox</span>
              ) : (
                trace.emitEvents.map((ev) => (
                  <div key={ev.id} className="flex gap-3 py-0.5">
                    <span className="text-emerald-500">✓</span>
                    <span className="text-zinc-400">{ev.type}</span>
                    <span className="text-zinc-600">{ev.createdAt.slice(11, 23)}</span>
                    <span className="text-zinc-700">{ev.dataPointId.slice(-8)}</span>
                  </div>
                ))
              )}
            </StageCard>

            {/* Stage 8 — Hemisphere */}
            <StageCard
              index={8}
              label="Hemisphere"
              status={
                trace.hemisphereRendered ? 'pass' :
                trace.dataPoints.length === 0 ? 'skip' : 'blocked'
              }
            >
              {trace.hemisphereRendered ? (
                <>
                  <div className="text-emerald-400">Node(s) emitted to hemisphere</div>
                  {trace.hemisphereNodeIds.map((id) => (
                    <div key={id} className="text-zinc-400 flex gap-2">
                      <span className="text-zinc-600">node</span>
                      <span>{id.slice(-10)}</span>
                    </div>
                  ))}
                  <div className="text-zinc-600 italic">
                    Client-side render not tracked — if node missing from UI, check SSE connection
                  </div>
                </>
              ) : (
                <div className="text-amber-400">{trace.hemisphereNote ?? 'Not rendered'}</div>
              )}
            </StageCard>

          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Filter = 'all' | 'rendered' | 'blocked' | 'rejected' | 'missing';

export default function DebugTracePage() {
  const params = useParams<{ id: string }>();
  const workshopId = params.id;

  const [data, setData] = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  function load() {
    fetch(`/api/admin/workshops/${workshopId}/debug/trace`)
      .then((r) => r.json() as Promise<TraceResponse>)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [workshopId]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [autoRefresh, workshopId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.traces;
    if (filter === 'rendered') list = list.filter((t) => t.outcome === 'rendered');
    if (filter === 'blocked')  list = list.filter((t) => t.outcome === 'blocked_at_commit');
    if (filter === 'rejected') list = list.filter((t) => t.outcome === 'rejected_in_extraction');
    if (filter === 'missing')  list = list.filter((t) => t.outcome !== 'rendered');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.windowFullText.toLowerCase().includes(q) ||
          (t.committedText ?? '').toLowerCase().includes(q) ||
          t.dataPoints.some((dp) => dp.rawText.toLowerCase().includes(q)) ||
          (t.speakerId ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, filter, search]);

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 font-mono text-sm">
      Loading trace…
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-400 font-mono text-sm">
      {error}
    </div>
  );
  if (!data) return null;

  const FILTERS: [Filter, string, number | string][] = [
    ['all',      'All',      data.totalTraces],
    ['rendered', 'Rendered', data.totalRendered],
    ['blocked',  'Blocked',  data.totalBlocked],
    ['rejected', 'Rejected', data.totalRejected],
    ['missing',  'Missing',  data.totalTraces - data.totalRendered],
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-mono text-sm">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950 border-b border-zinc-800 px-6 py-3 flex items-center gap-4">
        <div className="flex-1">
          <span className="text-zinc-300 font-semibold">{data.workshopName}</span>
          <span className="text-zinc-600 mx-2">·</span>
          <span className="text-zinc-500 text-xs">Pipeline Debug Trace</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-600">{data.totalTraces} windows</span>
          <span className="text-emerald-400">{data.totalRendered} rendered</span>
          <span className="text-red-400">{data.totalBlocked} blocked</span>
          <span className="text-amber-400">{data.totalRejected} rejected</span>
        </div>
        <button
          onClick={load}
          className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded px-2 py-1"
        >
          Refresh
        </button>
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className={`text-xs border rounded px-2 py-1 ${autoRefresh ? 'border-emerald-700 text-emerald-400' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
        >
          {autoRefresh ? '⏺ Live' : 'Live off'}
        </button>
        <a href={`/admin/workshops/${workshopId}/transcript`} className="text-xs text-zinc-600 hover:text-zinc-400">
          Raw transcript →
        </a>
      </div>

      {/* Filter + search bar */}
      <div className="px-6 py-2 border-b border-zinc-800 flex items-center gap-3">
        <div className="flex gap-1">
          {FILTERS.map(([f, label, count]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                filter === f
                  ? 'bg-zinc-200 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label} <span className="opacity-60 ml-1">{count}</span>
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search text, speaker…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto bg-zinc-900 border border-zinc-700 rounded px-3 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-64"
        />
      </div>

      {/* Trace list */}
      <div className="px-6 py-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-zinc-600 text-xs py-8 text-center">No traces match this filter.</p>
        ) : (
          filtered.map((t) => (
            <TraceCard key={t.windowId} trace={t} sessionStartMs={data.sessionStartMs} />
          ))
        )}
      </div>
    </div>
  );
}
