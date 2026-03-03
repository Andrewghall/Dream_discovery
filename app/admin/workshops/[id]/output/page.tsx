'use client';

import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Target, AlertTriangle, Rocket,
  Map as MapIcon, Brain, ArrowLeft, ChevronRight,
} from 'lucide-react';

// ── Diagnostic types + demo data ────────────────────────────
import type {
  HemisphereDiagnostic,
  DiagnosticDelta,
} from '@/lib/types/hemisphere-diagnostic';
import {
  DEMO_DIAGNOSTIC_BEFORE,
  DEMO_DIAGNOSTIC_AFTER,
  DEMO_DIAGNOSTIC_DELTA,
} from '@/lib/hemisphere-diagnostic/demo-diagnostic';
import type { DashboardHemisphereNode, DashboardHemisphereEdge } from '@/components/hemisphere/dashboard-hemisphere-canvas';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import type { OutputSection, StrategicDecisionsData, ConstraintImpactEntry, ActorAlignmentEntry, NormalizationResult, ComputedConfidenceScore, CognitiveShiftDelta } from '@/lib/types/output-dashboard';

// ── Normalization pipeline ──────────────────────────────────
import {
  normalizeActorGroups,
  normalizeThemeDensity,
  computeParticipationImbalance,
  computeConfidenceScore,
  computeConstraintImpactScores,
  computeCognitiveShiftDelta,
  computeActorAlignmentMatrix,
  runQualityControl,
} from '@/lib/output/normalize';

// ── Section components ──────────────────────────────────────
import { ExecutiveSummarySection } from '@/components/output/ExecutiveSummarySection';
import { MindsetShiftSection } from '@/components/output/MindsetShiftSection';
import { JourneyIntelligenceSection } from '@/components/output/JourneyIntelligenceSection';
import { StrategicDecisionsSection } from '@/components/output/StrategicDecisionsSection';
import { ConstraintsFrictionSection } from '@/components/output/ConstraintsFrictionSection';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

type HemisphereGraph = {
  nodes: DashboardHemisphereNode[];
  edges: DashboardHemisphereEdge[];
  coreTruthNodeId: string;
};

type Snapshot = { id: string; name: string; dialoguePhase: string; createdAt: string };

type PageProps = { params: Promise<{ id: string }> };

const MENU_ITEMS: { key: OutputSection; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'executive-summary', label: 'Executive Summary', icon: Target, color: 'text-amber-400' },
  { key: 'mindset-shift', label: 'Mindset Shift', icon: Brain, color: 'text-purple-400' },
  { key: 'journey-intelligence', label: 'Journey & Actors', icon: MapIcon, color: 'text-cyan-400' },
  { key: 'strategic-decisions', label: 'Strategic Decisions', icon: Rocket, color: 'text-emerald-400' },
  { key: 'constraints-friction', label: 'Constraints & Friction', icon: AlertTriangle, color: 'text-red-400' },
];

const RETAIL_WORKSHOP_ID = 'retail-cx-workshop';

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════

export default function OutputDashboardPage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [activeView, setActiveView] = useState<OutputSection>('executive-summary');

  // Workshop metadata
  const [workshopName, setWorkshopName] = useState('');
  const [orgName, setOrgName] = useState('');

  // Hemisphere graph data (before/after)
  const [beforeGraph, setBeforeGraph] = useState<HemisphereGraph | null>(null);
  const [afterGraph, setAfterGraph] = useState<HemisphereGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(true);
  const [beforeParticipants, setBeforeParticipants] = useState(0);

  // Diagnostic data
  const [diagBefore, setDiagBefore] = useState<HemisphereDiagnostic | null>(null);
  const [diagAfter, setDiagAfter] = useState<HemisphereDiagnostic | null>(null);
  const [diagDelta, setDiagDelta] = useState<DiagnosticDelta | null>(null);
  const [diagLoading, setDiagLoading] = useState(true);

  // Discovery analysis
  const [discoverAnalysis, setDiscoverAnalysis] = useState<DiscoverAnalysis | null>(null);

  // Journey data
  const [journeyData, setJourneyData] = useState<LiveJourneyData | null>(null);

  // Scratchpad data (exec summary, potential solution, summary)
  const [execSummary, setExecSummary] = useState<any>(null);
  const [potentialSolution, setPotentialSolution] = useState<any>(null);
  const [summaryContent, setSummaryContent] = useState<any>(null);

  // Snapshots
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const isRetailDemo = workshopId === RETAIL_WORKSHOP_ID;

  // ── Data fetching ────────────────────────────────────────

  // Fetch workshop metadata + discovery analysis
  useEffect(() => {
    const fetchWorkshop = async () => {
      try {
        const r = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}`);
        const json = await r.json().catch(() => null);
        if (json?.workshop) {
          setWorkshopName(json.workshop.name || '');
          setOrgName(json.workshop.organization?.name || '');
          if (json.workshop.discoverAnalysis) {
            setDiscoverAnalysis(json.workshop.discoverAnalysis as DiscoverAnalysis);
          }
        }
      } catch (e) {
        console.warn('[Output] Workshop fetch failed:', e);
      }
    };
    void fetchWorkshop();
  }, [workshopId]);

  // Fetch snapshots
  useEffect(() => {
    const fetchSnapshots = async () => {
      try {
        const r = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?listSnapshots=true`);
        const json = await r.json().catch(() => null);
        if (json?.snapshots) {
          setSnapshots(json.snapshots);
          if (json.snapshots.length > 0 && !selectedSnapshotId) {
            setSelectedSnapshotId(json.snapshots[0].id);
          }
        }
      } catch (e) {
        console.warn('[Output] Snapshots fetch failed:', e);
      }
    };
    void fetchSnapshots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]);

  // Fetch hemisphere graphs (before + after)
  useEffect(() => {
    const fetchGraphs = async () => {
      setGraphLoading(true);
      try {
        // Before: BASELINE sessions
        const beforeUrl = `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?runType=BASELINE&bust=${Date.now()}`;
        const beforeR = await fetch(beforeUrl);
        const beforeJson = await beforeR.json().catch(() => null);
        if (beforeJson?.ok && beforeJson.hemisphereGraph) {
          setBeforeGraph(beforeJson.hemisphereGraph);
          setBeforeParticipants(beforeJson.participantCount || 0);
        }

        // After: snapshot (if available)
        if (selectedSnapshotId) {
          const afterUrl = `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?source=snapshot&snapshotId=${encodeURIComponent(selectedSnapshotId)}&bust=${Date.now()}`;
          const afterR = await fetch(afterUrl);
          const afterJson = await afterR.json().catch(() => null);
          if (afterJson?.ok && afterJson.hemisphereGraph) {
            setAfterGraph(afterJson.hemisphereGraph);
          }
        }
      } catch (e) {
        console.warn('[Output] Graph fetch failed:', e);
      } finally {
        setGraphLoading(false);
      }
    };
    void fetchGraphs();
  }, [workshopId, selectedSnapshotId]);

  // Fetch diagnostic data
  useEffect(() => {
    const fetchDiagnostic = async () => {
      // Demo data
      if (isRetailDemo) {
        setDiagBefore(DEMO_DIAGNOSTIC_BEFORE);
        setDiagAfter(DEMO_DIAGNOSTIC_AFTER);
        setDiagDelta(DEMO_DIAGNOSTIC_DELTA);
        setDiagLoading(false);
        return;
      }

      setDiagLoading(true);
      try {
        let url = `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere/diagnostic`;
        if (selectedSnapshotId) url += `?snapshotId=${encodeURIComponent(selectedSnapshotId)}`;
        const r = await fetch(url, { cache: 'no-store' });
        const json = await r.json().catch(() => null);
        if (json?.ok) {
          setDiagBefore(json.before || null);
          setDiagAfter(json.after || null);
          setDiagDelta(json.delta || null);
        }
      } catch (e) {
        console.warn('[Output] Diagnostic fetch failed:', e);
      } finally {
        setDiagLoading(false);
      }
    };
    void fetchDiagnostic();
  }, [workshopId, selectedSnapshotId, isRetailDemo]);

  // Fetch scratchpad data (journey + exec summary + solution + summary)
  useEffect(() => {
    const fetchScratchpad = async () => {
      try {
        const r = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/scratchpad`);
        const json = await r.json().catch(() => null);
        if (json?.scratchpad) {
          if (json.scratchpad.customerJourney?.journeyData) {
            setJourneyData(json.scratchpad.customerJourney.journeyData);
          }
          if (json.scratchpad.execSummary) {
            setExecSummary(json.scratchpad.execSummary);
          }
          if (json.scratchpad.potentialSolution) {
            setPotentialSolution(json.scratchpad.potentialSolution);
          }
          if (json.scratchpad.summaryContent) {
            setSummaryContent(json.scratchpad.summaryContent);
          }
        }
      } catch (e) {
        console.warn('[Output] Scratchpad fetch failed:', e);
      }
    };
    void fetchScratchpad();
  }, [workshopId]);

  // ── Normalization pipeline (useMemo) ──────────────────────

  // Normalized alignment
  const normalizedAlignment = useMemo(() => {
    if (!discoverAnalysis?.alignment) return null;
    return normalizeThemeDensity(normalizeActorGroups(discoverAnalysis.alignment));
  }, [discoverAnalysis]);

  // Participation imbalance
  const participationResult = useMemo<NormalizationResult | null>(() => {
    if (!discoverAnalysis?.alignment) return null;
    const actorCounts = new Map<string, number>();
    for (const cell of discoverAnalysis.alignment.cells) {
      actorCounts.set(cell.actor, (actorCounts.get(cell.actor) || 0) + cell.utteranceCount);
    }
    return computeParticipationImbalance(actorCounts);
  }, [discoverAnalysis]);

  // Normalized confidence score
  const normalizedConfidence = useMemo<ComputedConfidenceScore | null>(() => {
    if (!discoverAnalysis?.confidence) return null;
    const actorCounts = new Map<string, number>();
    if (discoverAnalysis.alignment) {
      for (const cell of discoverAnalysis.alignment.cells) {
        actorCounts.set(cell.actor, (actorCounts.get(cell.actor) || 0) + cell.utteranceCount);
      }
    }
    return computeConfidenceScore(discoverAnalysis.confidence, actorCounts);
  }, [discoverAnalysis]);

  // Constraint impact scores
  const constraintImpactEntries = useMemo<ConstraintImpactEntry[]>(() => {
    if (!discoverAnalysis?.constraints) return [];
    const actors = discoverAnalysis.alignment?.actors || [];
    return computeConstraintImpactScores(discoverAnalysis.constraints, actors);
  }, [discoverAnalysis]);

  // Cognitive shift delta
  const cognitiveShift = useMemo<CognitiveShiftDelta | null>(() => {
    if (!diagBefore || !diagAfter) return null;
    return computeCognitiveShiftDelta(diagBefore, diagAfter);
  }, [diagBefore, diagAfter]);

  // Actor alignment matrix
  const actorAlignmentMatrix = useMemo<ActorAlignmentEntry[]>(() => {
    if (!discoverAnalysis?.alignment || !discoverAnalysis?.tensions) return [];
    return computeActorAlignmentMatrix(
      discoverAnalysis.alignment,
      discoverAnalysis.tensions,
      journeyData,
    );
  }, [discoverAnalysis, journeyData]);

  // Strategic decisions (assembled from scratchpad sources)
  const strategicDecisions = useMemo<StrategicDecisionsData | null>(() => {
    if (!potentialSolution && !summaryContent) return null;

    // Declared end-state from potential solution
    const declaredEndState = {
      whatWeAreBuilding: potentialSolution?.overview || potentialSolution?._aiSummary || 'Not yet defined',
      whyItMatters: potentialSolution?.context || 'Synthesised from workshop insights',
      successLooksLike: potentialSolution?.expectedOutcomes || 'To be defined based on strategic pillars',
    };

    // Strategic pillars from enablers (top 5)
    const enablers = potentialSolution?.enablers || [];
    const tensions = discoverAnalysis?.tensions?.tensions || [];
    const pillars = enablers.slice(0, 5).map((enabler: any, i: number) => {
      // Find a related tension
      const relatedTension = tensions[i % tensions.length];

      return {
        title: enabler.title || enabler.name || `Pillar ${i + 1}`,
        outcomeStatement: enabler.description || enabler.detail || '',
        journeyImpact: enabler.journeyImpact || 'Impacts multiple journey stages',
        actorImpact: enabler.actorImpact || `Affects ${enabler.domain || 'multiple'} domain`,
        keyTensionToResolve: relatedTension?.topic || 'No specific tension mapped',
      };
    });

    // 30-60 day direction from summary next steps
    const nextSteps = summaryContent?.recommendedNextSteps || [];
    const direction = nextSteps.map((step: any, i: number) => ({
      action: step.step || step.action || step.description || '',
      owner: step.owner || 'TBD',
      riskExposure: step.risk || step.riskExposure || 'Not assessed',
      timeframe: (i < Math.ceil(nextSteps.length / 2) ? '30-day' : '60-day') as '30-day' | '60-day',
    }));

    return { declaredEndState, pillars, direction };
  }, [potentialSolution, summaryContent, discoverAnalysis]);

  // Quality control
  const qualityControl = useMemo(() => {
    return runQualityControl(
      discoverAnalysis?.alignment || null,
      discoverAnalysis?.tensions || null,
      discoverAnalysis?.constraints || null,
      discoverAnalysis?.confidence || null,
      diagBefore,
      diagAfter,
    );
  }, [discoverAnalysis, diagBefore, diagAfter]);

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-slate-50">
      {/* === SIDEBAR === */}
      <nav className="w-[280px] border-r border-slate-200 bg-white flex flex-col shrink-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100">
          <Link
            href={`/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Hemisphere
          </Link>
          <h1 className="text-base font-bold text-slate-900 leading-tight">
            {workshopName || 'Workshop Output'}
          </h1>
          {orgName && (
            <p className="text-xs text-slate-500 mt-0.5">{orgName}</p>
          )}
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto py-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-all ${
                  isActive
                    ? 'bg-slate-100 border-r-2 border-slate-900'
                    : 'hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? item.color : 'text-slate-400'}`} />
                <span className={`text-sm ${isActive ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                  {item.label}
                </span>
                {isActive && <ChevronRight className="h-3 w-3 ml-auto text-slate-400" />}
              </button>
            );
          })}
        </div>

        {/* Quality warnings */}
        {qualityControl.warnings.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100">
            <div className="text-[10px] text-amber-600 font-medium">
              {qualityControl.warnings.length} quality warning{qualityControl.warnings.length > 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Footer links */}
        <div className="px-5 py-3 border-t border-slate-100 space-y-1.5">
          <Link
            href={`/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere`}
            className="block text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Hemisphere View &rarr;
          </Link>
          <Link
            href={`/admin/workshops/${encodeURIComponent(workshopId)}/scratchpad`}
            className="block text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Scratchpad &rarr;
          </Link>
        </div>
      </nav>

      {/* === MAIN CONTENT === */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {activeView === 'executive-summary' && (
            <ExecutiveSummarySection
              workshopName={workshopName}
              execSummary={execSummary}
              diagBefore={diagBefore}
              diagAfter={diagAfter}
              diagDelta={diagDelta}
              tensions={discoverAnalysis?.tensions || null}
              confidenceData={discoverAnalysis?.confidence || null}
              normalizedConfidence={normalizedConfidence}
              cognitiveShift={cognitiveShift}
              participationResult={participationResult}
              participantCount={beforeParticipants || discoverAnalysis?.participantCount || 0}
            />
          )}
          {activeView === 'mindset-shift' && (
            <MindsetShiftSection
              diagBefore={diagBefore}
              diagAfter={diagAfter}
              diagDelta={diagDelta}
              cognitiveShift={cognitiveShift}
              beforeGraph={beforeGraph}
              afterGraph={afterGraph}
              graphLoading={graphLoading}
            />
          )}
          {activeView === 'journey-intelligence' && (
            <JourneyIntelligenceSection
              journeyData={journeyData}
              normalizedAlignment={normalizedAlignment}
              actorAlignmentMatrix={actorAlignmentMatrix}
              participationResult={participationResult}
            />
          )}
          {activeView === 'strategic-decisions' && (
            <StrategicDecisionsSection
              strategicData={strategicDecisions}
              diagAfter={diagAfter}
              participantCount={beforeParticipants || discoverAnalysis?.participantCount || 0}
            />
          )}
          {activeView === 'constraints-friction' && (
            <ConstraintsFrictionSection
              constraintImpactEntries={constraintImpactEntries}
              constraintData={discoverAnalysis?.constraints || null}
              tensions={discoverAnalysis?.tensions || null}
              balanceSafeguard={diagAfter?.balanceSafeguard || diagBefore?.balanceSafeguard || null}
              participationResult={participationResult}
            />
          )}
        </div>
      </main>
    </div>
  );
}
