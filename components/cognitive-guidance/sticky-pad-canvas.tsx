'use client';

import { AlertTriangle } from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Listening... guidance will appear as patterns emerge
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {visiblePads.map((pad) => (
        <StickyPad
          key={pad.id}
          pad={pad}
          isSelected={selectedPadId === pad.id}
          onClick={(id) => onSelectPad(selectedPadId === id ? null : id)}
          onDismiss={onDismissPad}
          onSnooze={onSnoozePad}
        />
      ))}
    </div>
  );
}
