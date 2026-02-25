'use client';

import { MessageSquarePlus } from 'lucide-react';
import { StickyPad } from '@/components/cognitive-guidance/sticky-pad';
import type { StickyPad as StickyPadType } from '@/lib/cognitive-guidance/pipeline';

interface StickyPadCanvasProps {
  pads: StickyPadType[];
  selectedPadId: string | null;
  onSelectPad: (id: string | null) => void;
  onDismissPad: (id: string) => void;
  onSnoozePad: (id: string) => void;
}

export function StickyPadCanvas({
  pads,
  selectedPadId,
  onSelectPad,
  onDismissPad,
  onSnoozePad,
}: StickyPadCanvasProps) {
  const visiblePads = pads
    .filter((pad) => pad.status === 'active')
    .sort((a, b) => b.signalStrength - a.signalStrength);

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
          />
        ))}
      </div>
    </div>
  );
}
