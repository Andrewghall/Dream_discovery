'use client';

import { useState } from 'react';
import type { DiagnosticTrace, DiagnosticStats } from '@/lib/diagnostics/types';

function ms(v: number | undefined): string {
  if (v === undefined || v === null) return '--';
  if (v < 1000) return `${Math.round(v)}ms`;
  return `${(v / 1000).toFixed(1)}s`;
}

function SegmentBar({ trace }: { trace: DiagnosticTrace }) {
  const total = trace.totalE2eMs || 1;
  const segments = [
    { label: 'Queue', value: trace.queueWaitMs || 0, color: 'bg-slate-400' },
    { label: 'CaptureAPI', value: trace.captureApiMs || 0, color: 'bg-amber-500' },
    { label: 'Server', value: trace.serverProcessingMs || 0, color: 'bg-blue-500' },
    {
      label: 'Delivery',
      value: Math.max(0, (trace.totalE2eMs || 0) - (trace.queueWaitMs || 0) - (trace.captureApiMs || 0) - (trace.serverProcessingMs || 0)),
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="flex h-2 w-full rounded overflow-hidden bg-gray-800" title="Timeline">
      {segments.map((seg) => {
        const pct = (seg.value / total) * 100;
        if (pct < 0.5) return null;
        return (
          <div
            key={seg.label}
            className={`${seg.color} h-full`}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: ${ms(seg.value)}`}
          />
        );
      })}
    </div>
  );
}

export function PipelineSniffer({
  traces,
  stats,
  paused,
  onTogglePause,
  onClear,
  onExport,
}: {
  traces: DiagnosticTrace[];
  stats: DiagnosticStats;
  paused: boolean;
  onTogglePause: () => void;
  onClear: () => void;
  onExport: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="pointer-events-auto">
        {/* Collapsed pill */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="fixed bottom-4 right-4 bg-gray-900 text-gray-200 border border-gray-700 rounded-full px-4 py-2 text-xs font-mono shadow-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <span className="text-amber-400">&#x1f52c;</span>
            <span>
              Sniffer ({stats.count} traces{stats.count > 0 ? ` | avg ${ms(stats.avgE2eMs)} E2E` : ''})
            </span>
            {paused && <span className="text-yellow-500 font-bold">PAUSED</span>}
          </button>
        )}

        {/* Expanded panel */}
        {expanded && (
          <div className="bg-gray-950 border-t border-gray-700 text-gray-200 max-h-[45vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-amber-400 text-sm">&#x1f52c;</span>
                <span className="text-sm font-semibold">Pipeline Sniffer</span>
                {paused && <span className="text-yellow-500 text-xs font-bold">PAUSED</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onTogglePause}
                  className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 border border-gray-700"
                >
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={onExport}
                  className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 border border-gray-700"
                >
                  Export JSON
                </button>
                <button
                  onClick={onClear}
                  className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-red-400"
                >
                  Clear
                </button>
                <button
                  onClick={() => setExpanded(false)}
                  className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 border border-gray-700"
                >
                  Minimize
                </button>
              </div>
            </div>

            {/* Stats bar */}
            {stats.count > 0 && (
              <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800 text-xs font-mono flex-shrink-0 bg-gray-900/50">
                <span className="text-gray-400">
                  Traces: <span className="text-white">{stats.count}</span>
                </span>
                <span className="text-gray-400">
                  Avg E2E: <span className="text-green-400">{ms(stats.avgE2eMs)}</span>
                </span>
                <span className="text-gray-400">
                  P95: <span className="text-yellow-400">{ms(stats.p95E2eMs)}</span>
                </span>
                <span className="text-gray-400">
                  Min: <span className="text-gray-300">{ms(stats.minE2eMs)}</span>
                </span>
                <span className="text-gray-400">
                  Max: <span className="text-red-400">{ms(stats.maxE2eMs)}</span>
                </span>
                <span className="border-l border-gray-700 pl-4 text-gray-400">
                  CaptureAPI: <span className="text-amber-300">{ms(stats.avgCaptureApiMs)}</span>
                </span>
                <span className="text-gray-400">
                  Server: <span className="text-blue-300">{ms(stats.avgServerProcessingMs)}</span>
                </span>
                <span className="text-gray-400">
                  DB: <span className="text-blue-200">{ms(stats.avgDbWriteMs)}</span>
                </span>
                <span className="text-gray-400">
                  Queue: <span className="text-slate-300">{ms(stats.avgQueueWaitMs)}</span>
                </span>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-1 text-[10px] text-gray-500 flex-shrink-0">
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-slate-400" /> Queue</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-500" /> CaptureAPI</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-500" /> Server</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-purple-500" /> Delivery+Render</span>
            </div>

            {/* Trace table */}
            <div className="overflow-y-auto flex-1 min-h-0">
              {traces.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  Waiting for utterances...
                </div>
              ) : (
                <table className="w-full text-xs font-mono">
                  <thead className="sticky top-0 bg-gray-950">
                    <tr className="text-gray-500 text-left">
                      <th className="px-3 py-1.5 font-medium w-[200px]">Text</th>
                      <th className="px-2 py-1.5 font-medium w-[200px]">Timeline</th>
                      <th className="px-2 py-1.5 font-medium text-right">Queue</th>
                      <th className="px-2 py-1.5 font-medium text-right">CaptureAPI</th>
                      <th className="px-2 py-1.5 font-medium text-right">Server</th>
                      <th className="px-2 py-1.5 font-medium text-right">DB</th>
                      <th className="px-2 py-1.5 font-medium text-right font-bold">E2E</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {traces.map((t) => (
                      <tr key={t.traceId} className="hover:bg-gray-900/50">
                        <td className="px-3 py-1.5 text-gray-300 truncate max-w-[200px]" title={t.textPreview}>
                          {t.textPreview || '...'}
                        </td>
                        <td className="px-2 py-1.5 w-[200px]">
                          <SegmentBar trace={t} />
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-400">{ms(t.queueWaitMs)}</td>
                        <td className="px-2 py-1.5 text-right text-amber-300">{ms(t.captureApiMs)}</td>
                        <td className="px-2 py-1.5 text-right text-blue-300">{ms(t.serverProcessingMs)}</td>
                        <td className="px-2 py-1.5 text-right text-blue-200">{ms(t.dbWriteMs)}</td>
                        <td className="px-2 py-1.5 text-right font-bold text-green-400">{ms(t.totalE2eMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
