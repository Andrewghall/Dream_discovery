'use client';

import { useEffect, useState } from 'react';
import { subscribeDebug, type DebugLogEntry, type DebugStage } from '@/lib/debug/pipeline-debug-bus';

const MAX_ENTRIES = 100;

const STAGE_BG: Record<DebugStage, string> = {
  tsm:        'bg-purple-700',
  ingest:     'bg-blue-700',
  split:      'bg-orange-600',
  sse:        'bg-green-700',
  hemisphere: 'bg-amber-600',
  quality:    'bg-rose-700',
};

const STAGE_LABEL: Record<DebugStage, string> = {
  tsm:        'TSM',
  ingest:     'INGEST',
  split:      'SPLIT',
  sse:        'SSE',
  hemisphere: 'HEMI',
  quality:    'QUAL',
};

function shortId(id?: string): string {
  if (!id) return '—';
  return '…' + id.slice(-8);
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return (
    d.toTimeString().slice(0, 8) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  );
}

function EntryRow({ entry }: { entry: DebugLogEntry }) {
  const stageBg = STAGE_BG[entry.stage];
  const statusCls =
    entry.status === 'pass'    ? 'text-green-400' :
    entry.status === 'blocked' ? 'text-red-400'   :
    entry.status === 'error'   ? 'text-red-400'   : 'text-gray-400';
  const statusIcon =
    entry.status === 'pass'    ? '✓' :
    entry.status === 'blocked' ? '✗' :
    entry.status === 'error'   ? '⚠' : '●';

  // Build detail lines specific to each stage
  const details: string[] = [];

  if (entry.thoughtWindowId)
    details.push(`win: ${shortId(entry.thoughtWindowId)}`);

  if (entry.stage === 'tsm') {
    if (entry.text)        details.push(`text: "${entry.text.substring(0, 70)}"`);
    if (entry.chunks !== undefined) details.push(`chunks: ${entry.chunks}`);
    if (entry.guardReason) details.push(`guard: ${entry.guardReason}`);
  }

  if (entry.stage === 'ingest') {
    if (entry.requestText) details.push(`req: "${entry.requestText.substring(0, 50)}"`);
    if (entry.httpStatus !== undefined) details.push(`HTTP ${entry.httpStatus}`);
    if (entry.dataPointIds?.length) {
      details.push(
        `dps [${entry.dataPointIds.length}]: ${entry.dataPointIds.map(shortId).join('  ')}`
      );
    }
  }

  if (entry.stage === 'split') {
    if (entry.originalText)
      details.push(`src: "${entry.originalText.substring(0, 60)}"`);
    if (entry.wasSplit !== undefined)
      details.push(`split: ${entry.wasSplit ? `YES → ${entry.unitCount} units` : 'NO'}`);
    entry.units?.forEach((u, i) => {
      const intent = entry.unitIntents?.[i];
      const badge = intent ? `[${intent}] ` : '';
      details.push(`  [✓] ${badge}"${u.substring(0, 60)}"`);
    });
    entry.filteredUnits?.forEach(fu => {
      details.push(`  [✗] "${fu.text.substring(0, 55)}" — ${fu.reason}`);
    });
  }

  if (entry.stage === 'sse') {
    if (entry.dataPointId)    details.push(`dp: ${shortId(entry.dataPointId)}`);
    if (entry.reasoningRole)  details.push(`role: ${entry.reasoningRole}`);
    if (entry.sequenceIndex !== undefined) details.push(`seq: ${entry.sequenceIndex}`);
    if (entry.sourceWindowId) details.push(`src-win: ${shortId(entry.sourceWindowId)}`);
  }

  if (entry.stage === 'quality') {
    if (entry.text) details.push(`passage: "${entry.text.substring(0, 70)}"`);
    if (entry.guardReason) details.push(`reason: ${entry.guardReason}`);
    if (entry.chunks !== undefined) details.push(`score: ${entry.chunks}`);
  }

  if (entry.stage === 'hemisphere') {
    if (entry.hemisphereAction) details.push(`action: ${entry.hemisphereAction}`);
    if (entry.nodeId)            details.push(`node: ${shortId(entry.nodeId)}`);
    if (entry.nodeCount !== undefined) details.push(`total nodes: ${entry.nodeCount}`);
    if (entry.text)              details.push(`text: "${entry.text.substring(0, 60)}"`);
  }

  return (
    <div className="border-b border-gray-800 py-1.5 px-2.5 font-mono text-[11px] leading-snug">
      <div className="flex items-center gap-1.5">
        <span className={`${stageBg} text-white text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0`}>
          {STAGE_LABEL[entry.stage]}
        </span>
        <span className="text-gray-100 font-semibold tracking-wide">{entry.event}</span>
        <span className={`ml-auto shrink-0 font-bold ${statusCls}`}>{statusIcon}</span>
        <span className="text-gray-600 shrink-0 text-[10px]">{fmtTime(entry.ts)}</span>
      </div>
      {details.length > 0 && (
        <div className="mt-1 text-gray-400 text-[10px] pl-1 space-y-0.5">
          {details.map((d, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">{d}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DebugOverlay() {
  const [visible,   setVisible]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [entries,   setEntries]   = useState<DebugLogEntry[]>([]);

  // Ctrl+Shift+D — toggle overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setVisible(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Subscribe to pipeline debug events
  useEffect(() => {
    const unsub = subscribeDebug(entry => {
      setEntries(prev => {
        const next = [entry, ...prev];
        return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
      });
    });
    return unsub;
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] w-[500px] bg-gray-950 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
      style={{ maxHeight: '70vh' }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-gray-900 cursor-pointer select-none shrink-0"
        onClick={() => setCollapsed(c => !c)}
      >
        <span className="text-gray-400 text-xs">⚙</span>
        <span className="text-gray-100 text-xs font-semibold flex-1">DREAM Pipeline Debug</span>
        <span className="text-gray-400 text-[10px] bg-gray-800 px-1.5 py-0.5 rounded tabular-nums">
          {entries.length}
        </span>
        <button
          onClick={e => { e.stopPropagation(); setEntries([]); }}
          className="text-gray-600 hover:text-gray-200 text-xs px-1"
          title="Clear log"
        >↺</button>
        <button
          onClick={e => { e.stopPropagation(); setVisible(false); }}
          className="text-gray-600 hover:text-gray-200 text-xs px-1"
          title="Close  (Ctrl+Shift+D)"
        >✕</button>
        <span className="text-gray-600 text-[10px]">{collapsed ? '▲' : '▼'}</span>
      </div>

      {/* ── Stage legend ── */}
      {!collapsed && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-950 border-b border-gray-800 shrink-0 flex-wrap">
          {(Object.keys(STAGE_LABEL) as DebugStage[]).map(stage => (
            <span
              key={stage}
              className={`${STAGE_BG[stage]} text-white text-[9px] font-bold px-1.5 py-0.5 rounded`}
            >
              {STAGE_LABEL[stage]}
            </span>
          ))}
          <span className="text-gray-700 text-[9px] ml-auto">Ctrl+Shift+D</span>
        </div>
      )}

      {/* ── Log ── */}
      {!collapsed && (
        <div className="overflow-y-auto flex-1">
          {entries.length === 0 ? (
            <div className="px-4 py-6 text-gray-600 text-[11px] text-center font-mono">
              No events yet — start recording to see the pipeline.
            </div>
          ) : (
            entries.map(entry => <EntryRow key={entry.id} entry={entry} />)
          )}
        </div>
      )}
    </div>
  );
}
