'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import type { SessionConfidence } from '@/lib/cognitive-guidance/pipeline';

type Props = {
  hasResearch: boolean;
  hasDiscoveryBriefing: boolean;
  hasBlueprint: boolean;
  hasHistoricalMetrics: boolean;
  metricsCount: number;
  sessionConfidence: SessionConfidence;
};

function StatusDot({
  label,
  active,
  detail,
}: {
  label: string;
  active: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {active ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
      )}
      <span className={`text-xs ${active ? 'text-gray-700' : 'text-gray-400'}`}>
        {label}
        {detail && <span className="text-[10px] ml-0.5 text-muted-foreground">{detail}</span>}
      </span>
    </div>
  );
}

function getConfidenceColor(value: number): string {
  if (value >= 0.7) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (value >= 0.4) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

export default function DataSufficiencyBar({
  hasResearch,
  hasDiscoveryBriefing,
  hasBlueprint,
  hasHistoricalMetrics,
  metricsCount,
  sessionConfidence,
}: Props) {
  const confidencePercent = Math.round(sessionConfidence.overallConfidence * 100);
  const colorClass = getConfidenceColor(sessionConfidence.overallConfidence);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card/50 px-4 py-2">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
          Data Sources
        </span>
        <StatusDot label="Research" active={hasResearch} />
        <StatusDot label="Discovery" active={hasDiscoveryBriefing} />
        <StatusDot label="Blueprint" active={hasBlueprint} />
        <StatusDot
          label="Metrics"
          active={hasHistoricalMetrics}
          detail={hasHistoricalMetrics ? `(${metricsCount})` : undefined}
        />
      </div>

      <div
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold tabular-nums shrink-0 ${colorClass}`}
      >
        {confidencePercent}% confidence
      </div>
    </div>
  );
}
