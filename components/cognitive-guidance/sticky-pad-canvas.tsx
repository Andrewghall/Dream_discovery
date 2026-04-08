'use client';

import { useEffect } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { StickyPad } from '@/components/cognitive-guidance/sticky-pad';
import type { StickyPad as StickyPadType } from '@/lib/cognitive-guidance/pipeline';

interface StickyPadCanvasProps {
  pads: StickyPadType[];
  selectedPadId: string | null;
  onSelectPad: (id: string | null) => void;
  onDismissPad: (id: string) => void;
  onSnoozePad: (id: string) => void;
  maxVisible?: number;              // Limit visible pads (e.g. 4)
  onOverflow?: (padIds: string[]) => void;  // Called with IDs of pads that exceed maxVisible
  customLensColors?: Record<string, { bg: string; text: string; accent: string; label: string }>;
}

export function StickyPadCanvas({
  pads,
  selectedPadId,
  onSelectPad,
  onDismissPad,
  onSnoozePad,
  maxVisible,
  onOverflow,
  customLensColors,
}: StickyPadCanvasProps) {
  const allActivePads = pads
    .filter((pad) => pad.status === 'active')
    .sort((a, b) => b.signalStrength - a.signalStrength);

  // When maxVisible is set, only show the top N pads.
  // Overflow pads (those beyond maxVisible) are reported via onOverflow callback
  // so the parent can auto-move them to the covered strip.
  const visiblePads = maxVisible ? allActivePads.slice(0, maxVisible) : allActivePads;

  // Report overflow pads to parent (sorted by highest coverage first — most "done").
  // Must run in useEffect — calling setState during render causes React hydration error #418.
  const overflowPadIds =
    maxVisible && allActivePads.length > maxVisible
      ? allActivePads
          .slice(maxVisible)
          .sort((a, b) => b.coveragePercent - a.coveragePercent)
          .map((p) => p.id)
      : null;

  useEffect(() => {
    if (overflowPadIds && overflowPadIds.length > 0 && onOverflow) {
      onOverflow(overflowPadIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overflowPadIds?.join(',')]); // stable string dep avoids infinite loop

  if (visiblePads.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-32 text-center rounded-lg"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(148,163,184,0.1) 30px)',
          minHeight: '400px',
        }}
      >
        <MessageSquarePlus className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-lg text-muted-foreground/50 font-medium">
          Listening for patterns...
        </p>
        <p className="text-sm text-muted-foreground/30 mt-1">
          Guidance post-its will appear as the conversation develops
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-6"
      style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(148,163,184,0.06) 30px)',
        minHeight: '400px',
      }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {visiblePads.map((pad, i) => (
          <StickyPad
            key={pad.id}
            pad={pad}
            index={i}
            isSelected={selectedPadId === pad.id}
            onClick={(id) => onSelectPad(selectedPadId === id ? null : id)}
            onDismiss={onDismissPad}
            onSnooze={onSnoozePad}
            customLensColors={customLensColors}
          />
        ))}
      </div>
    </div>
  );
}
