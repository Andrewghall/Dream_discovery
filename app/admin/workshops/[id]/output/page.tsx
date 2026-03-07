'use client';

/**
 * Output Dashboard
 *
 * Top-level workshop output page. Navigation is a horizontal pill-style tab bar
 * at the top — no left sidebar.
 *
 * Sub-sections:
 *   1. Journey Maps          — 4-phase actor journey (Discovery → Reimagined → Constrained → Defined)
 *   2. Executive Summary     — AI-generated exec summary + hemisphere before/after
 *   3. Mindset Shift         — Cognitive shift delta + hemisphere graphs
 *   4. Strategic Decisions   — Pillars, end-state, 30/60 day direction
 *   5. Constraints & Friction — Constraint impact ranking + tensions
 */

import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Map as MapIcon,
  Target,
  Brain,
  Rocket,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';

// ── Diagnostic types + demo data ─────────────────────────────────────────────
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
import type {
  OutputSection,
  StrategicDecisionsData,
  ConstraintImpactEntry,
  ActorAlignmentEntry,
  NormalizationResult,
  ComputedConfidenceScore,
  CognitiveShiftDelta,
} from '@/lib/types/output-dashboard';

// ── Normalization pipeline ────────────────────────────────────────────────────
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

// ── Section components ────────────────────────────────────────────────────────
import { CompletedJourneyMaps } from '@/components/output/CompletedJourneyMaps';
import { ExecutiveSummarySection } from '@/components/output/ExecutiveSummarySection';
import { MindsetShiftSection } from '@/components/output/MindsetShiftSection';
import { StrategicDecisionsSection } from '@/components/output/StrategicDecisionsSection';
import { ConstraintsFrictionSection } from '@/components/output/ConstraintsFrictionSection';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

type HemisphereGraph = {
  nodes: DashboardHemisphereNode[];
  edges: DashboardHemisphereEdge[];
  coreTruthNodeId: string;
};

type Snapshot = { id: string; name: string; dialoguePhase: string; createdAt: string };
type PageProps = { params: Promise<{ id: string }> };

// ── Top-nav tab config ────────────────────────────────────────────────────────

type TabKey = 'journey-maps' | OutputSection;

const TABS: { key: TabKey; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'journey-maps',        label: 'Journey Maps',         icon: MapIcon,        color: 'text-cyan-600' },
  { key: 'executive-summary',   label: 'Executive Summary',    icon: Target,         color: 'text-amber-600' },
  { key: 'mindset-shift',       label: 'Mindset Shift',        icon: Brain,          color: 'text-purple-600' },
  { key: 'strategic-decisions', label: 'Strategic Decisions',  icon: Rocket,         color: 'text-emerald-600' },
  { key: 'constraints-friction',label: 'Constraints & Friction',icon: AlertTriangle, color: 'text-red-600' },
];

const RETAIL_WORKSHOP_ID = 'retail-cx-workshop';

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function OutputDashboardPage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [activeTab, setActiveTab] = useState<TabKey>('journey-maps');

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

  // ── Data fetching ─────────────────────────────────────────────────────────

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
      } catch (e) { console.warn('[Output] Workshop fetch failed:', e); }
    };
    void fetchWorkshop();
  }, [workshopId]);

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
      } catch (e) { console.warn('[Output] Snapshots fetch failed:', e); }
    };
    void fetchSnapshots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]);

  useEffect(() => {
    const fetchGraphs = async () => {
      setGraphLoading(true);
      try {
        const beforeUrl = `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?runType=BASELINE&bust=${Date.now()}`;
        const beforeR = await fetch(beforeUrl);
        const beforeJson = await beforeR.json().catch(() => null);
        if (beforeJson?.ok && beforeJson.hemisphereGraph) {
          setBeforeGraph(beforeJson.hemisphereGraph);
          setBeforeParticipants(beforeJson.participantCount || 0);
        }
        if (selectedSnapshotId) {
          const afterUrl = `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?source=snapshot&snapshotId=${encodeURIComponent(selectedSnapshotId)}&bust=${Date.now()}`;
          const afterR = await fetch(afterUrl);
          const afterJson = await afterR.json().catch(() => null);
          if (afterJson?.ok && afterJson.hemisphereGraph) setAfterGraph(afterJson.hemisphereGraph);
        }
      } catch (e) { console.warn('[Output] Graph fetch failed:', e); }
      finally { setGraphLoading(false); }
    };
    void fetchGraphs();
  }, [workshopId, selectedSnapshotId]);

  useEffect(() => {
    const fetchDiagnostic = async () => {
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
      } catch (e) { console.warn('[Output] Diagnostic fetch failed:', e); }
      finally { setDiagLoading(false); }
    };
    void fetchDiagnostic();
  }, [workshopId, selectedSnapshotId, isRetailDemo]);

  useEffect(() => {
    const fetchScratchpad = async () => {
      try {
        const r = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/scratchpad`);
        const json = await r.json().catch(() => null);
        if (json?.scratchpad) {
          if (json.scratchpad.customerJourney?.journeyData) {
            setJourneyData(json.scratchpad.customerJourney.journeyData);
          }
          if (json.scratchpad.execSummary) setExecSummary(json.scratchpad.execSummary);
          if (json.scratchpad.potentialSolution) setPotentialSolution(json.scratchpad.potentialSolution);
          if (json.scratchpad.summaryContent) setSummaryContent(json.scratchpad.summaryContent);
        }
      } catch (e) { console.warn('[Output] Scratchpad fetch failed:', e); }
    };
    void fetchScratchpad();
  }, [workshopId]);

  // ── Normalization pipeline ────────────────────────────────────────────────

  const normalizedAlignment = useMemo(() => {
    if (!discoverAnalysis?.alignment) return null;
    return normalizeThemeDensity(normalizeActorGroups(discoverAnalysis.alignment));
  }, [discoverAnalysis]);

  const participationResult = useMemo<NormalizationResult | null>(() => {
    if (!discoverAnalysis?.alignment) return null;
    const actorCounts = new Map<string, number>();
    for (const cell of discoverAnalysis.alignment.cells) {
      actorCounts.set(cell.actor, (actorCounts.get(cell.actor) || 0) + cell.utteranceCount);
    }
    return computeParticipationImbalance(actorCounts);
  }, [discoverAnalysis]);

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

  const constraintImpactEntries = useMemo<ConstraintImpactEntry[]>(() => {
    if (!discoverAnalysis?.constraints) return [];
    const actors = discoverAnalysis.alignment?.actors || [];
    return computeConstraintImpactScores(discoverAnalysis.constraints, actors);
  }, [discoverAnalysis]);

  const cognitiveShift = useMemo<CognitiveShiftDelta | null>(() => {
    if (!diagBefore || !diagAfter) return null;
    return computeCognitiveShiftDelta(diagBefore, diagAfter);
  }, [diagBefore, diagAfter]);

  const actorAlignmentMatrix = useMemo<ActorAlignmentEntry[]>(() => {
    if (!discoverAnalysis?.alignment || !discoverAnalysis?.tensions) return [];
    return computeActorAlignmentMatrix(
      discoverAnalysis.alignment,
      discoverAnalysis.tensions,
      journeyData,
    );
  }, [discoverAnalysis, journeyData]);

  const strategicDecisions = useMemo<StrategicDecisionsData | null>(() => {
    if (!potentialSolution && !summaryContent) return null;
    const declaredEndState = {
      whatWeAreBuilding: potentialSolution?.overview || potentialSolution?._aiSummary || 'Not yet defined',
      whyItMatters: potentialSolution?.context || 'Synthesised from workshop insights',
      successLooksLike: potentialSolution?.expectedOutcomes || 'To be defined based on strategic pillars',
    };
    const enablers = potentialSolution?.enablers || [];
    const tensions = discoverAnalysis?.tensions?.tensions || [];
    const pillars = enablers.slice(0, 5).map((enabler: any, i: number) => {
      const relatedTension = tensions[i % tensions.length];
      return {
        title: enabler.title || enabler.name || `Pillar ${i + 1}`,
        outcomeStatement: enabler.description || enabler.detail || '',
        journeyImpact: enabler.journeyImpact || 'Impacts multiple journey stages',
        actorImpact: enabler.actorImpact || `Affects ${enabler.domain || 'multiple'} domain`,
        keyTensionToResolve: relatedTension?.topic || 'No specific tension mapped',
      };
    });
    const nextSteps = summaryContent?.recommendedNextSteps || [];
    const direction = nextSteps.map((step: any, i: number) => ({
      action: step.step || step.action || step.description || '',
      owner: step.owner || 'TBD',
      riskExposure: step.risk || step.riskExposure || 'Not assessed',
      timeframe: (i < Math.ceil(nextSteps.length / 2) ? '30-day' : '60-day') as '30-day' | '60-day',
    }));
    return { declaredEndState, pillars, direction };
  }, [potentialSolution, summaryContent, discoverAnalysis]);

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto">
          {/* Breadcrumb */}
          <Link
            href={`/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Hemisphere
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                {workshopName || 'Workshop Output'}
              </h1>
              {orgName && (
                <p className="text-sm text-slate-500 mt-0.5">{orgName}</p>
              )}
            </div>

            {/* Quality warnings badge */}
            {qualityControl.warnings.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mt-1">
                <AlertTriangle className="h-3 w-3" />
                {qualityControl.warnings.length} quality warning{qualityControl.warnings.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── Top-nav tab bar ───────────────────────────────────────────── */}
          <div className="flex gap-0 mt-4 border-b border-slate-200 -mb-4">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? `border-slate-900 text-slate-900`
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? tab.color : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <main className="max-w-screen-xl mx-auto px-6 py-8">

        {activeTab === 'journey-maps' && (
          <CompletedJourneyMaps
            journeyData={journeyData}
            normalizedAlignment={normalizedAlignment}
            actorAlignmentMatrix={actorAlignmentMatrix}
            participationResult={participationResult}
          />
        )}

        {activeTab === 'executive-summary' && (
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

        {activeTab === 'mindset-shift' && (
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

        {activeTab === 'strategic-decisions' && (
          <StrategicDecisionsSection
            strategicData={strategicDecisions}
            diagAfter={diagAfter}
            participantCount={beforeParticipants || discoverAnalysis?.participantCount || 0}
          />
        )}

        {activeTab === 'constraints-friction' && (
          <ConstraintsFrictionSection
            constraintImpactEntries={constraintImpactEntries}
            constraintData={discoverAnalysis?.constraints || null}
            tensions={discoverAnalysis?.tensions || null}
            balanceSafeguard={diagAfter?.balanceSafeguard || diagBefore?.balanceSafeguard || null}
            participationResult={participationResult}
          />
        )}
      </main>
    </div>
  );
}
