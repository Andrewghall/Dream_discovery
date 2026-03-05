'use client';

/**
 * Mindset Shift Section (Section 2)
 *
 * Dual hemisphere comparison: Discovery State (Pre) vs Reimagined State (Post).
 * Only normalized cognitive indices. No raw dot comparisons.
 */

import { SectionHeader, MiniStat, LoadingState } from './shared';
import { SampleSizeIndicator } from './SampleSizeIndicator';
import { NormalizedScoreBar } from './NormalizedScoreBar';
import { DashboardHemisphereCanvas } from '@/components/hemisphere/dashboard-hemisphere-canvas';
import type { DashboardHemisphereNode, DashboardHemisphereEdge } from '@/components/hemisphere/dashboard-hemisphere-canvas';
import { DiagnosticComparison } from '@/components/hemisphere/diagnostic-comparison';
import type { HemisphereDiagnostic, DiagnosticDelta, DomainDelta } from '@/lib/types/hemisphere-diagnostic';
import type { CognitiveShiftDelta } from '@/lib/types/output-dashboard';

type HemisphereGraph = {
  nodes: DashboardHemisphereNode[];
  edges: DashboardHemisphereEdge[];
  coreTruthNodeId: string;
};

interface MindsetShiftSectionProps {
  diagBefore: HemisphereDiagnostic | null;
  diagAfter: HemisphereDiagnostic | null;
  diagDelta: DiagnosticDelta | null;
  cognitiveShift: CognitiveShiftDelta | null;
  beforeGraph: HemisphereGraph | null;
  afterGraph: HemisphereGraph | null;
  graphLoading: boolean;
}

export function MindsetShiftSection({
  diagBefore,
  diagAfter,
  diagDelta,
  cognitiveShift,
  beforeGraph,
  afterGraph,
  graphLoading,
}: MindsetShiftSectionProps) {
  if (graphLoading) return <LoadingState label="Loading mindset shift data..." />;

  if (!diagBefore && !diagAfter) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Mindset Shift" subtitle="Cognitive movement through the workshop" />
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-400 italic">No diagnostic data available for comparison.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Mindset Shift"
        subtitle="How organisational thinking moved from discovery to reimagination"
      />

      {/* Side-by-side hemispheres */}
      {!graphLoading && (beforeGraph || afterGraph) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {beforeGraph && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Discovery State (Pre)
              </h3>
              <DashboardHemisphereCanvas
                nodes={beforeGraph.nodes}
                edges={beforeGraph.edges}
                coreTruthNodeId={beforeGraph.coreTruthNodeId}
                label="Discovery Baseline"
                nodeCount={beforeGraph.nodes.length}
                edgeCount={beforeGraph.edges.length}
                balanceLabel={diagBefore?.sentimentIndex.balanceLabel}
              />
            </div>
          )}
          {afterGraph && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Reimagined State (Post)
              </h3>
              <DashboardHemisphereCanvas
                nodes={afterGraph.nodes}
                edges={afterGraph.edges}
                coreTruthNodeId={afterGraph.coreTruthNodeId}
                label="Live Session"
                nodeCount={afterGraph.nodes.length}
                edgeCount={afterGraph.edges.length}
                balanceLabel={diagAfter?.sentimentIndex.balanceLabel}
              />
            </div>
          )}
        </div>
      )}

      {/* Normalized cognitive indices comparison */}
      {diagBefore && diagAfter && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pre metrics */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              Discovery State
              <SampleSizeIndicator count={diagBefore.nodeCount} className="ml-2" />
            </h3>
            <div className="space-y-4">
              <NormalizedScoreBar
                label="Creative Energy"
                score={diagBefore.sentimentIndex.overallCreative}
                max={100}
                fillColor="bg-emerald-400"
                suffix="%"
              />
              <NormalizedScoreBar
                label="Constraint Density"
                score={diagBefore.sentimentIndex.overallConstraint}
                max={100}
                fillColor="bg-red-400"
                suffix="%"
              />
              <div className="pt-2">
                <span className="text-xs text-slate-500">Dominant narrative: </span>
                <span className="text-xs font-medium text-slate-700 capitalize">
                  {diagBefore.sentimentIndex.balanceLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Post metrics */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              Reimagined State
              <SampleSizeIndicator count={diagAfter.nodeCount} className="ml-2" />
            </h3>
            <div className="space-y-4">
              <NormalizedScoreBar
                label="Creative Energy"
                score={diagAfter.sentimentIndex.overallCreative}
                max={100}
                fillColor="bg-emerald-400"
                suffix="%"
                tag={cognitiveShift && cognitiveShift.creativeDelta > 0 ? `+${cognitiveShift.creativeDelta}pp` : undefined}
                tagColor={cognitiveShift && cognitiveShift.creativeDelta > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
              />
              <NormalizedScoreBar
                label="Constraint Density"
                score={diagAfter.sentimentIndex.overallConstraint}
                max={100}
                fillColor="bg-red-400"
                suffix="%"
                tag={cognitiveShift && cognitiveShift.constraintDelta < 0 ? `${cognitiveShift.constraintDelta}pp` : undefined}
                tagColor={cognitiveShift && cognitiveShift.constraintDelta < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
              />
              <div className="pt-2">
                <span className="text-xs text-slate-500">Dominant narrative: </span>
                <span className="text-xs font-medium text-slate-700 capitalize">
                  {diagAfter.sentimentIndex.balanceLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Required layer: What moved? What didn't? Where resistance? Balance healthy? */}
      {diagDelta && cognitiveShift && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Movement Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* What moved */}
            {cognitiveShift.domainsMoreCreative.length > 0 && (
              <div className="bg-emerald-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">
                  What moved toward innovation
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {cognitiveShift.domainsMoreCreative.map((d) => (
                    <span key={d} className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* What didn't move */}
            {cognitiveShift.domainsStable.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  What did not move
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {cognitiveShift.domainsStable.map((d) => (
                    <span key={d} className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Resistance */}
            {cognitiveShift.domainsMoreConstrained.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">
                  Where resistance remains
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {cognitiveShift.domainsMoreConstrained.map((d) => (
                    <span key={d} className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Balance assessment */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
                Is the balance healthy?
              </h4>
              <p className="text-sm text-blue-800">
                {diagDelta.balanceShift}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed before/after comparison */}
      {diagBefore && diagAfter && diagDelta && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Detailed Comparison</h3>
          <DiagnosticComparison before={diagBefore} after={diagAfter} delta={diagDelta} />
        </div>
      )}
    </div>
  );
}
