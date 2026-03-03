'use client';

/**
 * Executive Summary Section (Section 1)
 *
 * Default landing view. Readable in under two minutes.
 * Sub-sections:
 *   A. Workshop Intent
 *   B. Strategic Outcome Snapshot (3-5 decisions, not themes)
 *   C. State Shift Overview (pre/post mindset, measured cognitive shift)
 *   D. Major Tensions (top 3 structural)
 *   E. Alignment & Confidence
 */

import { SectionHeader, KeyStatCard, MiniStat } from './shared';
import { SampleSizeIndicator } from './SampleSizeIndicator';
import { ParticipationImbalanceWarning } from './ParticipationImbalanceWarning';
import type { HemisphereDiagnostic, DiagnosticDelta } from '@/lib/types/hemisphere-diagnostic';
import type { TensionSurfaceData, ConfidenceIndexData } from '@/lib/types/discover-analysis';
import type { ComputedConfidenceScore, CognitiveShiftDelta, NormalizationResult } from '@/lib/types/output-dashboard';

interface ExecutiveSummarySectionProps {
  workshopName: string;
  execSummary: any;
  diagBefore: HemisphereDiagnostic | null;
  diagAfter: HemisphereDiagnostic | null;
  diagDelta: DiagnosticDelta | null;
  tensions: TensionSurfaceData | null;
  confidenceData: ConfidenceIndexData | null;
  normalizedConfidence: ComputedConfidenceScore | null;
  cognitiveShift: CognitiveShiftDelta | null;
  participationResult: NormalizationResult | null;
  participantCount: number;
}

export function ExecutiveSummarySection({
  workshopName,
  execSummary,
  diagBefore,
  diagAfter,
  diagDelta,
  tensions,
  confidenceData,
  normalizedConfidence,
  cognitiveShift,
  participationResult,
  participantCount,
}: ExecutiveSummarySectionProps) {
  const diag = diagAfter || diagBefore;
  const hasGenuineShift = diagDelta != null && Math.abs(diagDelta.overallCreativeDelta) >= 3;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Executive Summary"
        subtitle={workshopName || 'Workshop intelligence summary'}
      />

      {/* Participation imbalance warning */}
      {participationResult?.imbalanceWarning && (
        <ParticipationImbalanceWarning message={participationResult.imbalanceWarning} />
      )}

      {/* A. Workshop Intent */}
      {execSummary?.overview && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 text-white">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Workshop Intent
          </h3>
          <p className="text-base leading-relaxed text-slate-100">
            {execSummary.overview}
          </p>
        </div>
      )}

      {/* B. Strategic Outcome Snapshot (max 5 decision cards) */}
      {execSummary?.keyFindings && execSummary.keyFindings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Strategic Outcomes</h3>
          <div className="space-y-3">
            {execSummary.keyFindings.slice(0, 5).map((finding: any, i: number) => (
              <div
                key={i}
                className="bg-white rounded-xl border-l-4 border-blue-500 border border-slate-200 p-5"
              >
                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  {finding.title || `Decision ${i + 1}`}
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {finding.description || finding.detail || ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* C. State Shift Overview */}
      {hasGenuineShift && diagBefore && diagAfter && diagDelta && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Cognitive Shift</h3>
          <p className="text-xs text-slate-500 mb-5">How organisational thinking moved during the workshop</p>

          {/* Shift gauge */}
          <div className="flex items-center gap-4 mb-4">
            <div className="text-center">
              <div className="text-xs font-medium text-slate-500">Before</div>
              <div className="text-lg font-bold text-red-500">{diagBefore.balanceSafeguard.overallBalance}</div>
            </div>
            <div className="flex-1 h-3 rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-400 relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 h-5 w-1.5 bg-red-600 rounded-full border border-white shadow"
                style={{ left: `${diagBefore.balanceSafeguard.overallBalance}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-5 w-1.5 bg-emerald-600 rounded-full border border-white shadow"
                style={{ left: `${diagAfter.balanceSafeguard.overallBalance}%` }}
              />
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-slate-500">After</div>
              <div className="text-lg font-bold text-emerald-500">{diagAfter.balanceSafeguard.overallBalance}</div>
            </div>
          </div>

          {/* Shift narrative */}
          {cognitiveShift && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-700 leading-relaxed">{cognitiveShift.shiftDescription}</p>
            </div>
          )}
        </div>
      )}

      {/* D. Major Tensions (top 3) */}
      {tensions && tensions.tensions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Major Tensions</h3>
          <div className="space-y-3">
            {tensions.tensions.slice(0, 3).map((tension) => (
              <div key={tension.id} className="flex items-start gap-3">
                <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  tension.severity === 'critical'
                    ? 'bg-red-50 text-red-700'
                    : tension.severity === 'significant'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-50 text-slate-600'
                }`}>
                  {tension.severity}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{tension.topic}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {tension.affectedActors.join(', ')}
                    <SampleSizeIndicator count={tension.viewpoints.length} className="ml-2" />
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  TI: {tension.tensionIndex}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* E. Alignment & Confidence */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {diag && (
          <>
            <KeyStatCard
              label="Balance Score"
              value={diag.balanceSafeguard.overallBalance}
              previousValue={diagBefore?.balanceSafeguard.overallBalance}
              suffix="/100"
              positiveIsGood
            />
            <KeyStatCard
              label="Voice Equity"
              value={Math.round((1 - diag.biasDetection.giniCoefficient) * 100)}
              previousValue={diagBefore ? Math.round((1 - diagBefore.biasDetection.giniCoefficient) * 100) : undefined}
              suffix="%"
              positiveIsGood
            />
          </>
        )}
        {normalizedConfidence && (
          <MiniStat
            label="Confidence Score"
            value={`${Math.round(normalizedConfidence.adjusted * 100)}%`}
            color={normalizedConfidence.adjusted > 0.3 ? 'text-emerald-600' : normalizedConfidence.adjusted > 0 ? 'text-amber-600' : 'text-red-600'}
          />
        )}
        <MiniStat
          label="Participants"
          value={participantCount}
        />
      </div>
    </div>
  );
}
