'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// ── Types ────────────────────────────────────────────────────────────────────

interface RawChunk {
  id: string;
  text: string;
  startTimeMs: string;
  speakerId: string | null;
  source: string;
}

interface SplitSibling {
  id: string;
  rawText: string;
  sequenceIndex: number | null;
  reasoningRole: string | null;
}

interface TraceDataPoint {
  id: string;
  rawText: string;
  sequenceIndex: number | null;
  reasoningRole: string | null;
  sourceWindowId: string | null;
  primaryType: string | null;
  primaryDomain: string | null;
  confidence: number | null;
  siblings: SplitSibling[];
}

interface TraceWindow {
  id: string;
  speakerId: string | null;
  state: string;
  fullText: string;
  resolvedText: string | null;
  openedAtMs: string;
  spokenRecordCount: number;
  chunks: RawChunk[];
  dataPoint: TraceDataPoint | null;
  blocked: boolean;
  blockReason: string | null;
}

interface TraceResponse {
  workshopName: string;
  windows: TraceWindow[];
  totalWindows: number;
  totalDataPoints: number;
  totalBlocked: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function msToTime(ms: string): string {
  const secs = Math.floor(Number(ms) / 1000);
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const SPEAKER_COLOURS: Record<string, string> = {
  speaker_0: '#60a5fa',
  speaker_1: '#34d399',
  speaker_2: '#f59e0b',
  speaker_3: '#c084fc',
  speaker_4: '#fb7185',
};

function speakerColour(id: string | null): string {
  return id ? (SPEAKER_COLOURS[id] ?? '#94a3b8') : '#94a3b8';
}

// ── Components ───────────────────────────────────────────────────────────────

function StatusBadge({ window: w }: { window: TraceWindow }) {
  if (w.dataPoint) {
    const split = w.dataPoint.siblings.length > 0;
    return (
      <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-900 text-emerald-300">
        {split ? `SPLIT ×${w.dataPoint.siblings.length + 1}` : 'NODE'}
      </span>
    );
  }
  if (w.blocked) {
    return <span className="px-2 py-0.5 rounded text-xs font-mono bg-red-900 text-red-300">BLOCKED</span>;
  }
  return <span className="px-2 py-0.5 rounded text-xs font-mono bg-zinc-700 text-zinc-400">RAW ONLY</span>;
}

function ChunkList({ chunks }: { chunks: RawChunk[] }) {
  return (
    <div className="space-y-1">
      {chunks.map((c) => (
        <div key={c.id} className="flex gap-2 text-xs font-mono">
          <span className="text-zinc-500 w-12 shrink-0">{msToTime(c.startTimeMs)}</span>
          <span className="text-zinc-300">{c.text}</span>
        </div>
      ))}
    </div>
  );
}

function DataPointCard({ dp }: { dp: TraceDataPoint }) {
  return (
    <div className="border border-emerald-800 rounded p-3 space-y-2">
      <div className="flex gap-2 items-center">
        <span className="text-xs font-mono text-zinc-500">{dp.id.slice(-8)}</span>
        {dp.primaryType && (
          <span className="px-1.5 py-0.5 rounded text-xs bg-zinc-700 text-zinc-300">{dp.primaryType}</span>
        )}
        {dp.primaryDomain && (
          <span className="px-1.5 py-0.5 rounded text-xs bg-blue-900 text-blue-300">{dp.primaryDomain}</span>
        )}
        {dp.reasoningRole && (
          <span className="px-1.5 py-0.5 rounded text-xs bg-purple-900 text-purple-300">{dp.reasoningRole}</span>
        )}
        {dp.confidence !== null && (
          <span className="text-xs text-zinc-400 ml-auto">{Math.round(dp.confidence * 100)}% conf</span>
        )}
      </div>
      <p className="text-sm text-white">&ldquo;{dp.rawText}&rdquo;</p>
      {dp.siblings.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-zinc-700 pt-2">
          <p className="text-xs text-zinc-500 font-mono">SPLIT SIBLINGS</p>
          {dp.siblings.map((s) => (
            <div key={s.id} className="text-xs text-zinc-300 flex gap-2">
              <span className="text-zinc-500 w-4 shrink-0">{s.sequenceIndex ?? '?'}</span>
              <span>{s.rawText}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TraceRow({ window: w }: { window: TraceWindow }) {
  const [open, setOpen] = useState(false);
  const colour = speakerColour(w.speakerId);

  return (
    <div className="border border-zinc-800 rounded overflow-hidden">
      {/* Summary row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xs font-mono text-zinc-500 w-12 shrink-0">{msToTime(w.openedAtMs)}</span>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colour }} />
        <span className="text-xs text-zinc-400 w-20 shrink-0">{w.speakerId ?? 'unknown'}</span>
        <span className="text-xs text-zinc-300 flex-1 truncate font-mono">
          {w.resolvedText ?? w.fullText}
        </span>
        <span className="text-xs text-zinc-500 shrink-0">{w.spokenRecordCount} chunks</span>
        <StatusBadge window={w} />
        <span className="text-zinc-600 text-xs ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded trace */}
      {open && (
        <div className="border-t border-zinc-800 bg-zinc-900/50 p-4 space-y-4">

          {/* Raw ASR chunks */}
          <section>
            <h4 className="text-xs font-mono text-zinc-500 uppercase mb-2">Raw ASR Chunks ({w.chunks.length})</h4>
            {w.chunks.length > 0 ? <ChunkList chunks={w.chunks} /> : (
              <p className="text-xs text-zinc-600 italic">No linked chunks (rawCaptureOnly path)</p>
            )}
          </section>

          {/* Committed passage */}
          <section>
            <h4 className="text-xs font-mono text-zinc-500 uppercase mb-2">Committed Passage</h4>
            <p className="text-sm text-zinc-200 font-mono bg-zinc-800 rounded p-2">
              {w.resolvedText ?? w.fullText}
            </p>
          </section>

          {/* Result */}
          <section>
            <h4 className="text-xs font-mono text-zinc-500 uppercase mb-2">Ingest Result</h4>
            {w.dataPoint ? (
              <DataPointCard dp={w.dataPoint} />
            ) : w.blocked ? (
              <div className="rounded p-2 bg-red-950 border border-red-800 text-sm text-red-300 font-mono">
                BLOCKED — {w.blockReason ?? 'unknown reason'}
              </div>
            ) : (
              <div className="rounded p-2 bg-zinc-800 text-sm text-zinc-400 font-mono">
                rawCaptureOnly — no DataPoint created
              </div>
            )}
          </section>

          {/* ThoughtWindow ID */}
          <p className="text-xs text-zinc-700 font-mono">window: {w.id}</p>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TracePage() {
  const params = useParams<{ id: string }>();
  const workshopId = params.id;

  const [data, setData] = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'node' | 'blocked' | 'raw'>('all');

  useEffect(() => {
    fetch(`/api/admin/workshops/${workshopId}/debug/trace`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [workshopId]);

  if (loading) return <div className="p-8 text-zinc-400">Loading trace…</div>;
  if (error) return <div className="p-8 text-red-400">Error: {error}</div>;
  if (!data) return null;

  const filtered = data.windows.filter((w) => {
    if (filter === 'node') return !!w.dataPoint;
    if (filter === 'blocked') return w.blocked;
    if (filter === 'raw') return !w.dataPoint && !w.blocked;
    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{data.workshopName} — Trace Replay</h1>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            {data.totalWindows} windows · {data.totalDataPoints} nodes · {data.totalBlocked} blocked
          </p>
        </div>
        <a href={`/admin/workshops/${workshopId}/hemisphere`} className="text-xs text-zinc-400 hover:text-white">
          ← Hemisphere
        </a>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-3 border-b border-zinc-800 flex gap-2">
        {(['all', 'node', 'blocked', 'raw'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              filter === f ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Trace list */}
      <div className="px-6 py-4 space-y-2">
        {filtered.length === 0 && (
          <p className="text-zinc-500 text-sm py-8 text-center">No entries match this filter.</p>
        )}
        {filtered.map((w) => <TraceRow key={w.id} window={w} />)}
      </div>
    </div>
  );
}
