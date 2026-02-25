'use client';

import { X, Clock } from 'lucide-react';
import type { StickyPad as StickyPadType, StickyPadType as PadType } from '@/lib/cognitive-guidance/pipeline';

// ── Post-it note colours — each type gets its own distinct sticky note ──
const PAD_COLORS: Record<PadType, { bg: string; text: string; accent: string; label: string }> = {
  CLARIFICATION:       { bg: '#bfdbfe', text: '#1e3a5f', accent: '#93c5fd', label: 'Clarify' },
  GAP_PROBE:           { bg: '#fef08a', text: '#713f12', accent: '#fde047', label: 'Gap' },
  CONTRADICTION_PROBE: { bg: '#fecaca', text: '#7f1d1d', accent: '#fca5a5', label: 'Contradiction' },
  RISK_PROBE:          { bg: '#fed7aa', text: '#7c2d12', accent: '#fdba74', label: 'Risk' },
  ENABLER_PROBE:       { bg: '#a7f3d0', text: '#064e3b', accent: '#6ee7b7', label: 'Enabler' },
  CUSTOMER_IMPACT:     { bg: '#ddd6fe', text: '#3b0764', accent: '#c4b5fd', label: 'Customer' },
  OWNERSHIP_ACTION:    { bg: '#e2e8f0', text: '#1e293b', accent: '#cbd5e1', label: 'Action' },
};

// Subtle rotation for each pad index so they look like real post-its on a board
const ROTATIONS = [-1.5, 0.8, -0.5, 1.2, -1, 0.3, 1.5, -0.8];

interface StickyPadProps {
  pad: StickyPadType;
  index: number;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
  isSelected: boolean;
  onClick: (id: string) => void;
}

export function StickyPad({ pad, index, onDismiss, onSnooze, isSelected, onClick }: StickyPadProps) {
  const colors = PAD_COLORS[pad.type];
  const isSnoozed = pad.status === 'snoozed';
  const rotation = ROTATIONS[index % ROTATIONS.length];

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

      {/* Type label — small tag at top */}
      <div
        className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm mb-2"
        style={{ backgroundColor: colors.accent, color: colors.text }}
      >
        {colors.label}
      </div>

      {/* Prompt text — the main content, large and readable */}
      <p className="text-sm font-medium leading-snug mb-auto" style={{ color: colors.text }}>
        {pad.prompt}
      </p>

      {/* Bottom: signal strength dot + provenance hint */}
      <div className="absolute bottom-3 left-4 right-4">
        <div className="flex items-end justify-between gap-2">
          <p className="text-[10px] leading-tight opacity-60 flex-1 min-w-0 line-clamp-2">
            {pad.provenance.description}
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

        {/* Signal strength as a thin bar along the bottom */}
        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: colors.accent }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pad.signalStrength * 100}%`, backgroundColor: colors.text, opacity: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}
