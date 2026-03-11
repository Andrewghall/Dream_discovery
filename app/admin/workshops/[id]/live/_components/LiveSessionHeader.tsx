'use client';

import { Button } from '@/components/ui/button';
import type { HemisphereDialoguePhase } from '@/components/live/hemisphere-nodes';

type ViewMode = 'room' | 'facilitator' | 'split';

type LiveSessionHeaderProps = {
  dialoguePhase: HemisphereDialoguePhase;
  onPhaseChange: (phase: HemisphereDialoguePhase) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /** Current phase label for mobile narrow view */
  phaseLabel: string;
};

export function LiveSessionHeader({
  dialoguePhase,
  onPhaseChange,
  viewMode,
  onViewModeChange,
  phaseLabel,
}: LiveSessionHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Workshop Live (MVP)</h1>
          <p className="text-sm text-muted-foreground">
            Captures room audio and transcribes live → DataPoints
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 rounded-md border bg-muted/20 p-1">
            <Button
              type="button"
              variant={dialoguePhase === 'REIMAGINE' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPhaseChange('REIMAGINE')}
            >
              Reimagine
            </Button>
            <Button
              type="button"
              variant={dialoguePhase === 'CONSTRAINTS' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPhaseChange('CONSTRAINTS')}
            >
              Constraints
            </Button>
            <Button
              type="button"
              variant={dialoguePhase === 'DEFINE_APPROACH' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPhaseChange('DEFINE_APPROACH')}
            >
              Define approach
            </Button>
          </div>
          <div className="flex items-center gap-1 rounded-md border bg-muted/20 p-1">
            <Button
              type="button"
              variant={viewMode === 'room' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('room')}
            >
              Room
            </Button>
            <Button
              type="button"
              variant={viewMode === 'facilitator' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('facilitator')}
            >
              Facilitator
            </Button>
            <Button
              type="button"
              variant={viewMode === 'split' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('split')}
            >
              Split
            </Button>
          </div>
          {/* Navigation handled by sidebar */}
        </div>
      </div>

      <div className="sm:hidden">
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
          Phase: <span className="font-medium">{phaseLabel}</span>
        </div>
      </div>
    </>
  );
}
