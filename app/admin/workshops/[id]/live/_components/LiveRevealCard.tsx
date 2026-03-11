'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RevealDialog } from './LiveSessionModals';

type RevealReadinessChecks = {
  intentExtractionReady: boolean;
  dependencyInferenceReady: boolean;
  domainSynthesisReady: boolean;
  dependencyLinesVisible: boolean;
  pressurePointsDetected: boolean;
  visionNarrativeReady: boolean;
};

type DomainNarrative = {
  domain: string;
  narrative: string;
  hasAny: boolean;
};

type PressurePoint = {
  id: string;
  fromDomain: string;
  toDomain: string;
  score: number;
  constraintCount: number;
  aspirationCount: number;
  count: number;
};

type KeyDependency = {
  id: string;
  fromDomain: string;
  toDomain: string;
  count: number;
  aspirationCount: number;
  constraintCount: number;
};

type LiveRevealCardProps = {
  revealReadiness: {
    revealReady: boolean;
    checks: RevealReadinessChecks;
  };
  dialoguePhase: string;
  liveReportDownloading: boolean;
  utteranceCount: number;
  visionNarrative: string | null | undefined;
  domainNarratives: DomainNarrative[];
  pressurePoints: PressurePoint[];
  keyDependencies: KeyDependency[];
  revealOpen: boolean;
  onRevealOpenChange: (open: boolean) => void;
  onDownloadLiveReport: () => void;
};

export function LiveRevealCard({
  revealReadiness,
  dialoguePhase,
  liveReportDownloading,
  utteranceCount,
  visionNarrative,
  domainNarratives,
  pressurePoints,
  keyDependencies,
  revealOpen,
  onRevealOpenChange,
  onDownloadLiveReport,
}: LiveRevealCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reveal readiness</CardTitle>
        <CardDescription>
          Reveal stays locked until synthesis and relationships are populated
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm">
          <div
            className={
              revealReadiness.checks.intentExtractionReady
                ? 'text-foreground'
                : 'text-muted-foreground'
            }
          >
            Intent extraction
          </div>
          <div
            className={
              revealReadiness.checks.dependencyInferenceReady
                ? 'text-foreground'
                : 'text-muted-foreground'
            }
          >
            Dependency inference
          </div>
          <div
            className={
              revealReadiness.checks.domainSynthesisReady
                ? 'text-foreground'
                : 'text-muted-foreground'
            }
          >
            Domain synthesis cards
          </div>
          <div
            className={
              revealReadiness.checks.dependencyLinesVisible
                ? 'text-foreground'
                : 'text-muted-foreground'
            }
          >
            Dependency lines visible
          </div>
          <div
            className={
              revealReadiness.checks.pressurePointsDetected
                ? 'text-foreground'
                : 'text-muted-foreground'
            }
          >
            Pressure points detected
          </div>
          <div
            className={
              revealReadiness.checks.visionNarrativeReady
                ? 'text-foreground'
                : 'text-muted-foreground'
            }
          >
            Vision narrative generated
          </div>
        </div>

        <Button
          type="button"
          disabled={!revealReadiness.revealReady}
          onClick={() => {
            if (!revealReadiness.revealReady) return;
            onRevealOpenChange(true);
          }}
        >
          Open Reveal
        </Button>

        {dialoguePhase === 'REIMAGINE' ? (
          <Button
            type="button"
            variant="outline"
            onClick={onDownloadLiveReport}
            disabled={liveReportDownloading || utteranceCount === 0}
          >
            {liveReportDownloading ? 'Generating PDF…' : 'Save Reimagine Summary (PDF)'}
          </Button>
        ) : null}

        {visionNarrative ? (
          <div className="rounded-md border p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">
            {visionNarrative}
          </div>
        ) : null}

        <RevealDialog
          open={revealOpen}
          onOpenChange={onRevealOpenChange}
          visionNarrative={visionNarrative ?? null}
          domainNarratives={domainNarratives}
          pressurePoints={pressurePoints}
          keyDependencies={keyDependencies}
        />
      </CardContent>
    </Card>
  );
}
