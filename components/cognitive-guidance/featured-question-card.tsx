'use client';

import { SkipForward, X } from 'lucide-react';
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

// ── Progress bar colour based on percentage ─────────────────

function progressColor(percent: number): string {
  if (percent >= 70) return '#22c55e'; // green-500
  if (percent >= 40) return '#3b82f6'; // blue-500
  return '#6366f1';                     // indigo-500
}

// ══════════════════════════════════════════════════════════════
// FEATURED QUESTION CARD
// ══════════════════════════════════════════════════════════════

interface FeaturedQuestionCardProps {
  pad: StickyPad;
  questionIndex: number;   // 1-based: which question we're on
  totalQuestions: number;   // total in this phase
  onDismiss: () => void;
  onSkip: () => void;       // Manually advance to next question
}

export function FeaturedQuestionCard({
  pad,
  questionIndex,
  totalQuestions,
  onDismiss,
  onSkip,
}: FeaturedQuestionCardProps) {
  const colors = PAD_COLORS[pad.type];
  const coverage = pad.coveragePercent;
  const barColor = progressColor(coverage);

  return (
    <div
      className="relative rounded-lg p-6 transition-all duration-300"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        boxShadow: '0 4px 15px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header row: type badge + counter + actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Type badge */}
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-sm"
            style={{ backgroundColor: colors.accent, color: colors.text }}
          >
            {colors.label}
          </span>

          {/* Source badge */}
          {pad.source === 'prep' && (
            <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/40 font-medium">
              Prep
            </span>
          )}
          {pad.source === 'agent' && (
            <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/40 font-medium">
              Agent
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Counter */}
          <span className="text-xs font-medium opacity-60">
            {questionIndex} / {totalQuestions}
          </span>

          {/* Skip button */}
          <button
            onClick={onSkip}
            className="p-1.5 rounded-md opacity-40 hover:opacity-100 transition-opacity"
            style={{ color: colors.text }}
            title="Skip to next question"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-md opacity-40 hover:opacity-100 transition-opacity"
            style={{ color: colors.text }}
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Question text — large and prominent */}
      <p className="text-lg font-semibold leading-relaxed mb-3" style={{ color: colors.text }}>
        {pad.prompt}
      </p>

      {/* Purpose / Grounding — smaller context */}
      {(pad.grounding || pad.provenance.description) && (
        <p className="text-xs leading-relaxed opacity-60 mb-4">
          {pad.grounding || pad.provenance.description}
        </p>
      )}

      {/* ── Coverage progress bar ── */}
      <div className="mt-auto">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider opacity-50">
            Coverage
          </span>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: barColor }}
          >
            {coverage}%
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: colors.accent }}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${coverage}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}
