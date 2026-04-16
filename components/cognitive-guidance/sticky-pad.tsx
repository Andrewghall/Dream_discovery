'use client';

import { X, Clock } from 'lucide-react';
import type { StickyPad as StickyPadType, StickyPadType as PadType } from '@/lib/cognitive-guidance/pipeline';

// ── Lens-based colours — sub-post-its coloured by which lens they explore ──
export const LENS_COLORS: Record<string, { bg: string; text: string; accent: string; label: string }> = {
  People:           { bg: '#bfdbfe', text: '#1e3a5f', accent: '#93c5fd', label: 'People' },
  Operations:       { bg: '#a7f3d0', text: '#064e3b', accent: '#6ee7b7', label: 'Operations' },
  Technology:       { bg: '#fed7aa', text: '#7c2d12', accent: '#fdba74', label: 'Technology' },
  Customer:         { bg: '#ddd6fe', text: '#3b0764', accent: '#c4b5fd', label: 'Customer' },
  Commercial:       { bg: '#fef9c3', text: '#713f12', accent: '#fde68a', label: 'Commercial' },
  'Risk/Compliance':{ bg: '#fecaca', text: '#7f1d1d', accent: '#fca5a5', label: 'Risk/Compliance' },
  Partners:         { bg: '#e0e7ff', text: '#3730a3', accent: '#c7d2fe', label: 'Partners' },
  General:          { bg: '#e2e8f0', text: '#1e293b', accent: '#cbd5e1', label: 'Explore' },
};

// ── Fallback: legacy pad-type colours for seed/signal pads without a lens ──
const PAD_TYPE_COLORS: Record<PadType, { bg: string; text: string; accent: string; label: string }> = {
  CLARIFICATION:       { bg: '#bfdbfe', text: '#1e3a5f', accent: '#93c5fd', label: 'Clarify' },
  GAP_PROBE:           { bg: '#fef08a', text: '#713f12', accent: '#fde047', label: 'Gap' },
  CONTRADICTION_PROBE: { bg: '#fecaca', text: '#7f1d1d', accent: '#fca5a5', label: 'Contradiction' },
  RISK_PROBE:          { bg: '#fed7aa', text: '#7c2d12', accent: '#fdba74', label: 'Risk' },
  ENABLER_PROBE:       { bg: '#a7f3d0', text: '#064e3b', accent: '#6ee7b7', label: 'Enabler' },
  CUSTOMER_IMPACT:     { bg: '#ddd6fe', text: '#3b0764', accent: '#c4b5fd', label: 'Customer' },
  OWNERSHIP_ACTION:    { bg: '#e2e8f0', text: '#1e293b', accent: '#cbd5e1', label: 'Action' },
  METRIC_CHALLENGE:    { bg: '#fef3c7', text: '#92400e', accent: '#fcd34d', label: 'Metric Check' },
};

/** Get colour scheme for a pad — prefer custom lens colors, then default lens, then type-based */
function getPadColors(pad: StickyPadType, customLensColors?: Record<string, { bg: string; text: string; accent: string; label: string }>) {
  if (pad.lens) {
    if (customLensColors?.[pad.lens]) return customLensColors[pad.lens];
    if (LENS_COLORS[pad.lens]) return LENS_COLORS[pad.lens];
  }
  return PAD_TYPE_COLORS[pad.type];
}

// ── Progress bar colour based on coverage percentage ─────────
function coverageBarColor(percent: number): string {
  if (percent >= 70) return '#22c55e'; // green-500
  if (percent >= 40) return '#3b82f6'; // blue-500
  return '#6366f1';                     // indigo-500
}

// Subtle rotation for each pad index so they look like real post-its on a board
const ROTATIONS = [-1.5, 0.8, -0.5, 1.2, -1, 0.3, 1.5, -0.8];

interface StickyPadProps {
  pad: StickyPadType;
  index: number;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
  isSelected: boolean;
  onClick: (id: string) => void;
  customLensColors?: Record<string, { bg: string; text: string; accent: string; label: string }>;
}

export function StickyPad({ pad, index, onDismiss, onSnooze, isSelected, onClick, customLensColors }: StickyPadProps) {
  const colors = getPadColors(pad, customLensColors);
  const isSnoozed = pad.status === 'snoozed';
  const rotation = ROTATIONS[index % ROTATIONS.length];
  const hasCoverage = pad.coveragePercent > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(pad.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(pad.id);
        }
      }}
      className={`
        relative aspect-square p-4 cursor-pointer transition-all duration-200
        ${isSelected ? 'scale-105 z-10' : 'hover:scale-[1.03] hover:z-10'}
        ${isSnoozed ? 'opacity-40' : ''}
      `}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        transform: `rotate(${isSelected ? 0 : rotation}deg)`,
        boxShadow: isSelected
          ? '0 8px 25px rgba(0,0,0,0.2), 0 0 0 3px rgba(59,130,246,0.5)'
          : '2px 3px 8px rgba(0,0,0,0.12), 1px 1px 3px rgba(0,0,0,0.08)',
        borderRadius: '2px',
      }}
    >
      {/* Folded corner effect */}
      <div
        className="absolute top-0 right-0 w-6 h-6"
        style={{
          background: `linear-gradient(135deg, transparent 50%, ${colors.accent} 50%)`,
          opacity: 0.6,
        }}
      />

      {/* Lens/type label — small tag at top */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <div
          className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm"
          style={{ backgroundColor: colors.accent, color: colors.text }}
        >
          {colors.label}
        </div>
        {/* Journey Mapping label — shown when pad targets a journey gap */}
        {pad.padLabel && (
          <div
            className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm"
            style={{ backgroundColor: '#ccfbf1', color: '#134e4a' }}
          >
            {pad.padLabel}
          </div>
        )}
      </div>

      {/* Prompt text — the main content, large and readable */}
      <p className="text-sm font-medium leading-snug mb-auto" style={{ color: colors.text }}>
        {pad.prompt}
      </p>

      {/* Bottom: provenance hint + actions + coverage/signal bar */}
      <div className="absolute bottom-3 left-4 right-4">
        <div className="flex items-end justify-between gap-2">
          <p className="text-[10px] leading-tight opacity-60 flex-1 min-w-0 line-clamp-2">
            {pad.grounding || pad.provenance.description}
          </p>

          {/* Actions — snooze / dismiss */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              className="p-1 rounded-full opacity-40 hover:opacity-100 transition-opacity"
              style={{ color: colors.text }}
              onClick={(e) => { e.stopPropagation(); onSnooze(pad.id); }}
              title="Snooze 60s"
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
            <button
              className="p-1 rounded-full opacity-40 hover:opacity-100 transition-opacity"
              style={{ color: colors.text }}
              onClick={(e) => { e.stopPropagation(); onDismiss(pad.id); }}
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Coverage bar (for prep/agent sub-pads) or signal strength bar (for signal/seed pads) */}
        {hasCoverage ? (
          <div className="mt-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] font-medium uppercase tracking-wider opacity-40">Coverage</span>
              <span className="text-[9px] font-bold tabular-nums" style={{ color: coverageBarColor(pad.coveragePercent) }}>
                {pad.coveragePercent}%
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: colors.accent }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pad.coveragePercent}%`, backgroundColor: coverageBarColor(pad.coveragePercent) }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: colors.accent }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pad.signalStrength * 100}%`, backgroundColor: colors.text, opacity: 0.3 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
