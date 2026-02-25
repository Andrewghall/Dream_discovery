'use client';

import { CheckCircle2, Circle, RotateCcw } from 'lucide-react';
import type { StickyPad, StickyPadType } from '@/lib/cognitive-guidance/pipeline';

// ── Colours matching the sticky-pad component ────────────────

const PAD_COLORS: Record<StickyPadType, { bg: string; text: string; accent: string; label: string }> = {
  CLARIFICATION:       { bg: '#bfdbfe', text: '#1e3a5f', accent: '#93c5fd', label: 'Clarify' },
  GAP_PROBE:           { bg: '#fef08a', text: '#713f12', accent: '#fde047', label: 'Gap' },
  CONTRADICTION_PROBE: { bg: '#fecaca', text: '#7f1d1d', accent: '#fca5a5', label: 'Contradiction' },
  RISK_PROBE:          { bg: '#fed7aa', text: '#7c2d12', accent: '#fdba74', label: 'Risk' },
  ENABLER_PROBE:       { bg: '#a7f3d0', text: '#064e3b', accent: '#6ee7b7', label: 'Enabler' },
  CUSTOMER_IMPACT:     { bg: '#ddd6fe', text: '#3b0764', accent: '#c4b5fd', label: 'Customer' },
  OWNERSHIP_ACTION:    { bg: '#e2e8f0', text: '#1e293b', accent: '#cbd5e1', label: 'Action' },
};

// ══════════════════════════════════════════════════════════════
// QUESTION TRAY — Sidebar with covered + queued questions
// ══════════════════════════════════════════════════════════════

interface QuestionTrayProps {
  coveredPads: StickyPad[];
  queuedPads: StickyPad[];
  onRevisit: (padId: string) => void;
}

export function QuestionTray({ coveredPads, queuedPads, onRevisit }: QuestionTrayProps) {
  const hasCovered = coveredPads.length > 0;
  const hasQueued = queuedPads.length > 0;

  if (!hasCovered && !hasQueued) {
    return (
      <div className="text-xs text-muted-foreground/50 text-center py-6">
        Questions will appear here as the session progresses
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Covered Questions ── */}
      {hasCovered && (
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 px-1">
            Covered ({coveredPads.length})
          </h4>
          <div className="space-y-1.5">
            {coveredPads.map((pad) => {
              const colors = PAD_COLORS[pad.type];
              return (
                <button
                  key={pad.id}
                  onClick={() => onRevisit(pad.id)}
                  className="w-full text-left group rounded-md px-2.5 py-2 transition-all hover:scale-[1.02]"
                  style={{
                    backgroundColor: colors.bg,
                    color: colors.text,
                    opacity: 0.7,
                  }}
                  title="Click to revisit this question"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 mt-0.5"
                      style={{ color: '#22c55e' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] leading-tight line-clamp-2 font-medium">
                        {pad.prompt}
                      </p>
                      {/* Coverage percentage */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <div
                          className="h-0.5 flex-1 rounded-full overflow-hidden"
                          style={{ backgroundColor: colors.accent }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pad.coveragePercent}%`,
                              backgroundColor: '#22c55e',
                            }}
                          />
                        </div>
                        <span className="text-[9px] font-medium opacity-60 tabular-nums">
                          {pad.coveragePercent}%
                        </span>
                      </div>
                    </div>
                    <RotateCcw className="h-3 w-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Queued Questions ── */}
      {hasQueued && (
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 px-1">
            Coming Up ({queuedPads.length})
          </h4>
          <div className="space-y-1.5">
            {queuedPads.map((pad) => {
              const colors = PAD_COLORS[pad.type];
              return (
                <div
                  key={pad.id}
                  className="rounded-md px-2.5 py-2"
                  style={{
                    backgroundColor: colors.bg,
                    color: colors.text,
                    opacity: 0.4,
                  }}
                >
                  <div className="flex items-start gap-2">
                    <Circle className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-50" />
                    <p className="text-[11px] leading-tight line-clamp-2 font-medium">
                      {pad.prompt}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
