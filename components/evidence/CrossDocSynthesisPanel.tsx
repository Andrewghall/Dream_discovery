'use client';

import { useState } from 'react';
import { Loader2, Sparkles, FileStack, AlertTriangle, Shuffle, RefreshCw } from 'lucide-react';
import type { CrossDocSynthesis } from '@/lib/evidence/types';

const SIGNAL_COLOURS: Record<string, string> = {
  red: 'bg-red-100 text-red-800 border-red-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  mixed: 'bg-slate-100 text-slate-700 border-slate-200',
};

interface CrossDocSynthesisPanelProps {
  workshopId: string;
  synthesis: CrossDocSynthesis | null;
  readyDocCount: number;
  onSynthesisComplete: (synthesis: CrossDocSynthesis) => void;
}

export function CrossDocSynthesisPanel({
  workshopId,
  synthesis,
  readyDocCount,
  onSynthesisComplete,
}: CrossDocSynthesisPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRun = readyDocCount >= 2;

  const handleRun = async () => {
    if (!canRun || isRunning) return;
    setIsRunning(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/evidence/synthesise`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Synthesis failed');
      onSynthesisComplete(body.synthesis as CrossDocSynthesis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileStack className="h-5 w-5 text-violet-600 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-violet-900">Cross-Document Synthesis</h3>
            <p className="text-xs text-violet-600 mt-0.5">
              {canRun
                ? `Analyse ${readyDocCount} documents for shared themes, outliers and contradictions`
                : 'Upload at least 2 documents to enable synthesis'}
            </p>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={!canRun || isRunning}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Synthesising…
            </>
          ) : synthesis ? (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Re-run Synthesis
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Synthesise Evidence
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Results */}
      {synthesis && !isRunning && (
        <div className="space-y-5">
          {/* Workshop summary */}
          {synthesis.workshopLevelSummary && (
            <div className="rounded-lg bg-white border border-violet-200 px-4 py-3">
              <p className="text-xs font-semibold text-violet-700 mb-1 uppercase tracking-wide">
                Evidence Summary
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {synthesis.workshopLevelSummary}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Based on {synthesis.documentCount} document{synthesis.documentCount !== 1 ? 's' : ''} ·{' '}
                {new Date(synthesis.generatedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}

          {/* Shared themes */}
          {synthesis.sharedThemes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Shared Themes ({synthesis.sharedThemes.length})
              </h4>
              <div className="space-y-2">
                {synthesis.sharedThemes.map((theme, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-white border border-slate-200 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-slate-800 font-medium">{theme.theme}</p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          SIGNAL_COLOURS[theme.signalDirection] ?? SIGNAL_COLOURS.mixed
                        }`}
                      >
                        {theme.signalDirection}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {theme.appearsInDocNames.map((name, j) => (
                        <span
                          key={j}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-mono truncate max-w-[180px]"
                          title={name}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outliers */}
          {synthesis.outliers.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Single-Source Signals ({synthesis.outliers.length})
              </h4>
              <div className="space-y-2">
                {synthesis.outliers.map((outlier, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-white border border-amber-200 px-3 py-2.5"
                  >
                    <p className="text-sm text-slate-800">{outlier.finding}</p>
                    <p className="text-xs text-amber-700 mt-1">{outlier.note}</p>
                    <span
                      className="mt-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-mono truncate max-w-[220px]"
                      title={outlier.documentName}
                    >
                      {outlier.documentName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contradictions */}
          {synthesis.crossDocContradictions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Shuffle className="h-3.5 w-3.5" />
                Contradictions ({synthesis.crossDocContradictions.length})
              </h4>
              <div className="space-y-2">
                {synthesis.crossDocContradictions.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-white border border-red-200 px-3 py-2.5"
                  >
                    <p className="text-sm font-medium text-red-800 mb-2">{c.topic}</p>
                    <div className="space-y-1.5">
                      {c.positions.map((pos, j) => (
                        <div key={j} className="flex gap-2">
                          <span
                            className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-mono truncate max-w-[120px]"
                            title={pos.documentName}
                          >
                            {pos.documentName}
                          </span>
                          <p className="text-xs text-slate-700">{pos.position}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
