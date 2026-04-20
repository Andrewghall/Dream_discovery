'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type RawEntry = {
  id: string;
  sequence: number;
  speakerId: string | null;
  text: string;
  startTimeMs: string;
  endTimeMs: string;
  speechFinal: boolean;
  confidence: number | null;
};

function relTime(startMs: string, sessionStartMs: string): string {
  const elapsed = Number(startMs) - Number(sessionStartMs);
  if (elapsed < 0) return '0:00';
  const m = Math.floor(elapsed / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SPEAKER_COLOURS: Record<string, string> = {};
const PALETTE = [
  'text-blue-600',
  'text-emerald-600',
  'text-violet-600',
  'text-orange-600',
  'text-rose-600',
  'text-cyan-600',
];
function speakerColour(id: string): string {
  if (!SPEAKER_COLOURS[id]) {
    const idx = Object.keys(SPEAKER_COLOURS).length % PALETTE.length;
    SPEAKER_COLOURS[id] = PALETTE[idx];
  }
  return SPEAKER_COLOURS[id];
}

export default function RawTranscriptPage() {
  const params = useParams<{ id: string }>();
  const workshopId = params.id;

  const [entries, setEntries] = useState<RawEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const maxSequenceRef = useRef(-1);
  const sessionStartRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const url = `/api/admin/workshops/${workshopId}/raw-transcript?since=${maxSequenceRef.current}`;
        const res = await fetch(url);
        if (!res.ok) { setError(`API error ${res.status}`); return; }
        const data = await res.json() as { entries: RawEntry[] };
        if (cancelled) return;
        if (data.entries.length > 0) {
          setEntries((prev) => {
            const next = [...prev, ...data.entries];
            if (!sessionStartRef.current && next.length > 0) {
              sessionStartRef.current = next[0].startTimeMs;
            }
            return next;
          });
          maxSequenceRef.current = data.entries[data.entries.length - 1].sequence;
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [workshopId]);

  useEffect(() => {
    if (live) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, live]);

  const sessionStart = sessionStartRef.current ?? '0';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mono text-sm">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-xs uppercase tracking-widest">Raw Transcript</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 text-xs">{entries.length} entries</span>
          {error && <span className="text-red-400 text-xs ml-2">{error}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs ${live ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {live ? 'Live' : 'Paused'}
          </span>
          <button
            onClick={() => setLive((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 rounded px-2 py-0.5"
          >
            {live ? 'Pause scroll' : 'Resume scroll'}
          </button>
        </div>
      </div>

      {/* Entries */}
      <div className="px-6 py-4 space-y-0">
        {entries.length === 0 && (
          <div className="text-slate-600 text-xs pt-8 text-center">Waiting for transcript entries…</div>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex gap-4 py-1.5 border-b border-slate-900 hover:bg-slate-900/40 group"
          >
            {/* Sequence + time */}
            <div className="w-28 shrink-0 text-right text-slate-600 group-hover:text-slate-500 leading-snug pt-0.5">
              <div className="text-xs">{relTime(e.startTimeMs, sessionStart)}</div>
              <div className="text-xs opacity-50">#{e.sequence}</div>
            </div>

            {/* Speaker */}
            <div className="w-24 shrink-0 pt-0.5">
              {e.speakerId ? (
                <span className={`text-xs font-semibold ${speakerColour(e.speakerId)}`}>
                  {e.speakerId}
                </span>
              ) : (
                <span className="text-xs text-slate-700">—</span>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 leading-snug text-slate-200">
              {e.text}
            </div>

            {/* Flags */}
            <div className="w-20 shrink-0 text-right pt-0.5 space-x-1">
              {e.speechFinal && (
                <span className="text-xs text-emerald-500 font-semibold">FINAL</span>
              )}
              {e.confidence !== null && (
                <span className="text-xs text-slate-600">
                  {Math.round(e.confidence * 100)}%
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
