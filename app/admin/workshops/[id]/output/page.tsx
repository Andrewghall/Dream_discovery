'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Target, Search, Lightbulb, AlertTriangle, Rocket,
  Map, Brain, ArrowLeft, ChevronRight,
} from 'lucide-react';

// ── Diagnostic components (hemisphere) ──────────────────────
import { SentimentIndexCard } from '@/components/hemisphere/sentiment-index-card';
import { BiasDetectionCard } from '@/components/hemisphere/bias-detection-card';
import { BalanceSafeguardCard } from '@/components/hemisphere/balance-safeguard-card';
import { MultiLensCard } from '@/components/hemisphere/multi-lens-card';
import { DiagnosticComparison } from '@/components/hemisphere/diagnostic-comparison';
import { DashboardHemisphereCanvas } from '@/components/hemisphere/dashboard-hemisphere-canvas';
import type { DashboardHemisphereNode, DashboardHemisphereEdge } from '@/components/hemisphere/dashboard-hemisphere-canvas';

// ── Diagnostic types + demo data ────────────────────────────
import type {
  HemisphereDiagnostic,
  DiagnosticDelta,
  SentimentIndex,
  BalanceSafeguard,
  MultiLensAnalysis,
} from '@/lib/types/hemisphere-diagnostic';
import {
  DEMO_DIAGNOSTIC_BEFORE,
  DEMO_DIAGNOSTIC_AFTER,
  DEMO_DIAGNOSTIC_DELTA,
} from '@/lib/hemisphere-diagnostic/demo-diagnostic';

// ── Discovery analysis components ───────────────────────────
import { AlignmentHeatmap } from '@/components/discover-analysis/alignment-heatmap';
import { TensionSurface } from '@/components/discover-analysis/tension-surface';
import { NarrativeDivergence } from '@/components/discover-analysis/narrative-divergence';
import { ConstraintMap } from '@/components/discover-analysis/constraint-map';
import { ConfidenceIndex } from '@/components/discover-analysis/confidence-index';
import { GptInquiryBar } from '@/components/discover-analysis/gpt-inquiry-bar';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';

// ── Journey ─────────────────────────────────────────────────
import LiveJourneyMap from '@/components/cognitive-guidance/live-journey-map';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

type View = 'overview' | 'discovery' | 'reimagine' | 'constraints' | 'approach' | 'journey' | 'diagnostic';

type HemisphereGraph = {
  nodes: DashboardHemisphereNode[];
  edges: DashboardHemisphereEdge[];
  coreTruthNodeId: string;
};

type HemisphereResponse = {
  ok: boolean;
  workshopId: string;
  hemisphereGraph: HemisphereGraph;
  sessionCount: number;
  participantCount: number;
  snapshotId?: string;
};

type Snapshot = { id: string; name: string; dialoguePhase: string; createdAt: string };

type PageProps = { params: Promise<{ id: string }> };

const MENU_ITEMS: { key: View; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'overview', label: 'Workshop Overview', icon: Target, color: 'text-amber-400' },
  { key: 'discovery', label: 'Discovery Insights', icon: Search, color: 'text-blue-400' },
  { key: 'reimagine', label: 'Reimagine', icon: Lightbulb, color: 'text-purple-400' },
  { key: 'constraints', label: 'Constraints & Risks', icon: AlertTriangle, color: 'text-red-400' },
  { key: 'approach', label: 'Approach & Solutions', icon: Rocket, color: 'text-emerald-400' },
  { key: 'journey', label: 'Customer Journey', icon: Map, color: 'text-cyan-400' },
  { key: 'diagnostic', label: 'Organisational Psyche', icon: Brain, color: 'text-pink-400' },
];

const RETAIL_WORKSHOP_ID = 'retail-cx-workshop';

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════

export default function OutputDashboardPage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [activeView, setActiveView] = useState<View>('overview');

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
      // Demo data — instant
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

  // Fetch journey data from scratchpad
  useEffect(() => {
    const fetchJourney = async () => {
      try {
        const r = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/scratchpad`);
        const json = await r.json().catch(() => null);
        if (json?.scratchpad?.customerJourney?.journeyData) {
          setJourneyData(json.scratchpad.customerJourney.journeyData);
        }
      } catch (e) {
        console.warn('[Output] Journey fetch failed:', e);
      }
    };
    void fetchJourney();
  }, [workshopId]);

  // ── Derived values ───────────────────────────────────────

  const diag = diagAfter || diagBefore;
  const hasGenuineShift = diagDelta != null && Math.abs(diagDelta.overallCreativeDelta) >= 3;

  // Phase-filtered node counts from the "after" graph
  const phaseNodes = afterGraph?.nodes || [];
  const reimagineNodes = phaseNodes.filter(n =>
    (n.type === 'VISION' || n.type === 'BELIEF') && n.phaseTags?.some(t =>
      t.toLowerCase().includes('reimagine') || t.toLowerCase().includes('h1')
    )
  );
  const constraintNodes = phaseNodes.filter(n =>
    (n.type === 'CONSTRAINT' || n.type === 'FRICTION' || n.type === 'CHALLENGE')
  );
  const enablerNodes = phaseNodes.filter(n => n.type === 'ENABLER');

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-slate-50">
      {/* ═══ SIDEBAR ═══ */}
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

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {activeView === 'overview' && (
            <OverviewView
              workshopName={workshopName}
              diagBefore={diagBefore}
              diagAfter={diagAfter}
              diagDelta={diagDelta}
              diagLoading={diagLoading}
              beforeGraph={beforeGraph}
              afterGraph={afterGraph}
              graphLoading={graphLoading}
              hasGenuineShift={hasGenuineShift}
              participantCount={beforeParticipants}
            />
          )}
          {activeView === 'discovery' && (
            <DiscoveryView
              workshopId={workshopId}
              discoverAnalysis={discoverAnalysis}
              beforeGraph={beforeGraph}
              participantCount={beforeParticipants}
            />
          )}
          {activeView === 'reimagine' && (
            <ReimagineView
              diag={diag}
              reimagineNodes={reimagineNodes}
              totalNodes={phaseNodes.length}
            />
          )}
          {activeView === 'constraints' && (
            <ConstraintsView
              diag={diag}
              constraintNodes={constraintNodes}
            />
          )}
          {activeView === 'approach' && (
            <ApproachView
              diag={diag}
              enablerNodes={enablerNodes}
              reimagineCount={reimagineNodes.length}
            />
          )}
          {activeView === 'journey' && (
            <JourneyView journeyData={journeyData} />
          )}
          {activeView === 'diagnostic' && (
            <DiagnosticView
              diagBefore={diagBefore}
              diagAfter={diagAfter}
              diagDelta={diagDelta}
              diagLoading={diagLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: OVERVIEW
// ══════════════════════════════════════════════════════════════

function OverviewView({
  workshopName,
  diagBefore,
  diagAfter,
  diagDelta,
  diagLoading,
  beforeGraph,
  afterGraph,
  graphLoading,
  hasGenuineShift,
  participantCount,
}: {
  workshopName: string;
  diagBefore: HemisphereDiagnostic | null;
  diagAfter: HemisphereDiagnostic | null;
  diagDelta: DiagnosticDelta | null;
  diagLoading: boolean;
  beforeGraph: HemisphereGraph | null;
  afterGraph: HemisphereGraph | null;
  graphLoading: boolean;
  hasGenuineShift: boolean;
  participantCount: number;
}) {
  const diag = diagAfter || diagBefore;

  if (diagLoading) {
    return <LoadingState label="Loading workshop overview..." />;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Workshop Overview"
        subtitle={workshopName || 'Post-session analytical summary'}
      />

      {/* Key Stats Row */}
      {diag && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KeyStatCard
            label="Total Insights"
            value={diag.nodeCount}
            previousValue={diagBefore?.nodeCount}
            suffix="nodes"
          />
          <KeyStatCard
            label="Creative Density"
            value={diag.sentimentIndex.overallCreative}
            previousValue={diagBefore?.sentimentIndex.overallCreative}
            suffix="%"
            positiveIsGood
          />
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
        </div>
      )}

      {/* Domain Energy Bars */}
      {diag && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Energy by Domain</h3>
          <div className="space-y-3">
            {diag.sentimentIndex.domains.map((d) => (
              <div key={d.domain} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-24 text-right font-medium">{d.domain}</span>
                <div className="flex-1 flex gap-1 h-5">
                  <div
                    className="bg-emerald-400 rounded-l"
                    style={{ width: `${d.creativeDensity}%` }}
                    title={`Creative: ${d.creativeDensity}%`}
                  />
                  <div
                    className="bg-red-400 rounded-r"
                    style={{ width: `${d.constraintDensity}%` }}
                    title={`Constraint: ${d.constraintDensity}%`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 w-20">
                  {d.nodeCount} nodes
                </span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  d.sentimentLabel === 'innovation-led' || d.sentimentLabel === 'vision-rich'
                    ? 'bg-emerald-50 text-emerald-600'
                    : d.sentimentLabel === 'constraint-heavy' || d.sentimentLabel === 'risk-aware'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-slate-50 text-slate-600'
                }`}>
                  {d.sentimentLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mindset Shift — only if genuine */}
      {hasGenuineShift && diagBefore && diagAfter && diagDelta && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Mindset Shift</h3>
          <p className="text-xs text-slate-500 mb-5">How the organisational psyche moved during the workshop</p>

          {/* Shift gauge */}
          <div className="flex items-center gap-4 mb-6">
            <div className="text-center">
              <div className="text-xs font-medium text-slate-500">Before</div>
              <div className="text-lg font-bold text-red-500">{diagBefore.balanceSafeguard.overallBalance}</div>
              <div className="text-[10px] text-slate-400 capitalize">{diagBefore.sentimentIndex.balanceLabel}</div>
            </div>
            <div className="flex-1 h-3 rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-400 relative">
              {/* Before marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-5 w-1.5 bg-red-600 rounded-full border border-white shadow"
                style={{ left: `${diagBefore.balanceSafeguard.overallBalance}%` }}
              />
              {/* After marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-5 w-1.5 bg-emerald-600 rounded-full border border-white shadow"
                style={{ left: `${diagAfter.balanceSafeguard.overallBalance}%` }}
              />
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-slate-500">After</div>
              <div className="text-lg font-bold text-emerald-500">{diagAfter.balanceSafeguard.overallBalance}</div>
              <div className="text-[10px] text-slate-400 capitalize">{diagAfter.sentimentIndex.balanceLabel}</div>
            </div>
          </div>

          {/* Narrative */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-slate-700 leading-relaxed">{diagDelta.balanceShift}</p>
            <p className="text-sm text-slate-600 leading-relaxed">{diagDelta.biasChange}</p>
          </div>
        </div>
      )}

      {/* Side-by-side hemispheres */}
      {!graphLoading && (beforeGraph || afterGraph) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {beforeGraph && (
            <DashboardHemisphereCanvas
              nodes={beforeGraph.nodes}
              edges={beforeGraph.edges}
              coreTruthNodeId={beforeGraph.coreTruthNodeId}
              label="Discovery Baseline"
              nodeCount={beforeGraph.nodes.length}
              edgeCount={beforeGraph.edges.length}
              balanceLabel={diagBefore?.sentimentIndex.balanceLabel}
            />
          )}
          {afterGraph && (
            <DashboardHemisphereCanvas
              nodes={afterGraph.nodes}
              edges={afterGraph.edges}
              coreTruthNodeId={afterGraph.coreTruthNodeId}
              label="Live Session"
              nodeCount={afterGraph.nodes.length}
              edgeCount={afterGraph.edges.length}
              balanceLabel={diagAfter?.sentimentIndex.balanceLabel}
            />
          )}
        </div>
      )}

      {/* Balance Diagnosis */}
      {diag && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Balance Diagnosis</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            {diag.balanceSafeguard.diagnosis}
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: DISCOVERY
// ══════════════════════════════════════════════════════════════

function DiscoveryView({
  workshopId,
  discoverAnalysis,
  beforeGraph,
  participantCount,
}: {
  workshopId: string;
  discoverAnalysis: DiscoverAnalysis | null;
  beforeGraph: HemisphereGraph | null;
  participantCount: number;
}) {
  const [activeTab, setActiveTab] = useState<'alignment' | 'tensions' | 'narrative' | 'constraints' | 'confidence'>('alignment');

  if (!discoverAnalysis) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Discovery Insights"
          subtitle="What the organisation revealed during discovery interviews"
        />
        <EmptyState message="Discovery analysis has not been generated for this workshop. Run the analysis from the Discovery page first." />
      </div>
    );
  }

  const tabs = [
    { key: 'alignment' as const, label: 'Alignment' },
    { key: 'tensions' as const, label: 'Tensions' },
    { key: 'narrative' as const, label: 'Narrative' },
    { key: 'constraints' as const, label: 'Constraints' },
    { key: 'confidence' as const, label: 'Confidence' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Discovery Insights"
        subtitle={`What ${participantCount || discoverAnalysis.participantCount} participants revealed about the organisation`}
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Participants" value={discoverAnalysis.participantCount} />
        <MiniStat label="Data Points" value={beforeGraph?.nodes.length || 0} />
        <MiniStat label="Tensions Found" value={discoverAnalysis.tensions.tensions.length} />
        <MiniStat label="Constraints" value={discoverAnalysis.constraints.constraints.length} />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.key
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {activeTab === 'alignment' && <AlignmentHeatmap data={discoverAnalysis.alignment} />}
        {activeTab === 'tensions' && <TensionSurface data={discoverAnalysis.tensions} />}
        {activeTab === 'narrative' && <NarrativeDivergence data={discoverAnalysis.narrative} />}
        {activeTab === 'constraints' && <ConstraintMap data={discoverAnalysis.constraints} />}
        {activeTab === 'confidence' && <ConfidenceIndex data={discoverAnalysis.confidence} />}
      </div>

      {/* Inquiry bar */}
      <GptInquiryBar
        workshopId={workshopId}
        hasAnalysis={true}
        analysis={discoverAnalysis}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: REIMAGINE
// ══════════════════════════════════════════════════════════════

function ReimagineView({
  diag,
  reimagineNodes,
  totalNodes,
}: {
  diag: HemisphereDiagnostic | null;
  reimagineNodes: DashboardHemisphereNode[];
  totalNodes: number;
}) {
  if (!diag) return <LoadingState label="Loading reimagine data..." />;

  // Sort domains by creative density
  const sortedDomains = [...diag.sentimentIndex.domains].sort((a, b) => b.creativeDensity - a.creativeDensity);

  // Group vision nodes by domain
  const visionCount = reimagineNodes.filter(n => n.type === 'VISION').length;
  const beliefCount = reimagineNodes.filter(n => n.type === 'BELIEF').length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reimagine Phase"
        subtitle="Creative energy, visions, and innovation potential"
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Vision Nodes" value={visionCount} color="text-blue-600" />
        <MiniStat label="Belief Nodes" value={beliefCount} color="text-purple-600" />
        <MiniStat label="Creative Density" value={`${diag.sentimentIndex.overallCreative}%`} color="text-emerald-600" />
        <MiniStat label="Top Domain" value={sortedDomains[0]?.domain || '—'} />
      </div>

      {/* Creative Energy by Domain */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Creative Energy by Domain</h3>
        <div className="space-y-4">
          {sortedDomains.map((d) => (
            <div key={d.domain}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">{d.domain}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-600 font-medium">{d.creativeDensity}% creative</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    d.sentimentLabel === 'innovation-led' || d.sentimentLabel === 'vision-rich'
                      ? 'bg-emerald-50 text-emerald-600'
                      : d.sentimentLabel === 'balanced'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-amber-50 text-amber-600'
                  }`}>
                    {d.sentimentLabel}
                  </span>
                </div>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${d.creativeDensity}%` }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-slate-400">{d.nodeCount} nodes · {d.redesignEnergy} redesign energy</span>
                <span className="text-[10px] text-slate-400">Dominant: {d.dominantType}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sentiment Index Card — full width */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Detailed Sentiment Index</h3>
        <SentimentIndexCard sentimentIndex={diag.sentimentIndex} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: CONSTRAINTS
// ══════════════════════════════════════════════════════════════

function ConstraintsView({
  diag,
  constraintNodes,
}: {
  diag: HemisphereDiagnostic | null;
  constraintNodes: DashboardHemisphereNode[];
}) {
  if (!diag) return <LoadingState label="Loading constraint data..." />;

  const criticalFlags = diag.balanceSafeguard.flags.filter(f => f.severity === 'critical');
  const warningFlags = diag.balanceSafeguard.flags.filter(f => f.severity === 'warning');

  // Find most constrained domain
  const sortedByConstraint = [...diag.sentimentIndex.domains].sort((a, b) => b.constraintDensity - a.constraintDensity);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Constraints & Risks"
        subtitle="Blockers, safeguard flags, and risk assessment"
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Constraint Nodes" value={constraintNodes.length} color="text-red-600" />
        <MiniStat label="Critical Flags" value={criticalFlags.length} color="text-red-600" />
        <MiniStat label="Warnings" value={warningFlags.length} color="text-amber-600" />
        <MiniStat label="Most Constrained" value={sortedByConstraint[0]?.domain || '—'} />
      </div>

      {/* Balance Safeguard — full width */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Balance Safeguards</h3>
        <BalanceSafeguardCard balanceSafeguard={diag.balanceSafeguard} />
      </div>

      {/* Constraint Density by Domain */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Constraint Density by Domain</h3>
        <div className="space-y-4">
          {sortedByConstraint.map((d) => (
            <div key={d.domain}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">{d.domain}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 font-medium">{d.constraintDensity}% constrained</span>
                  <span className="text-xs text-slate-500">Risk: {(d.riskWeight * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full"
                  style={{ width: `${d.constraintDensity}%` }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-slate-400">Challenge intensity: {(d.challengeIntensity * 100).toFixed(0)}%</span>
                <span className="text-[10px] text-slate-400">{d.nodeCount} nodes</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: APPROACH
// ══════════════════════════════════════════════════════════════

function ApproachView({
  diag,
  enablerNodes,
  reimagineCount,
}: {
  diag: HemisphereDiagnostic | null;
  enablerNodes: DashboardHemisphereNode[];
  reimagineCount: number;
}) {
  if (!diag) return <LoadingState label="Loading approach data..." />;

  const avgLensScore = diag.multiLens.lenses.length > 0
    ? Math.round(diag.multiLens.lenses.reduce((s, l) => s + l.score, 0) / diag.multiLens.lenses.length)
    : 0;

  const totalRedesignEnergy = diag.sentimentIndex.domains.reduce((s, d) => s + d.redesignEnergy, 0);

  // Top concern from multi-lens
  const topConcern = diag.multiLens.lenses.find(l => l.concern)?.concern || 'None identified';

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Approach & Solutions"
        subtitle="Confidence scoring, enabler analysis, and implementation readiness"
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Enabler Nodes" value={enablerNodes.length} color="text-emerald-600" />
        <MiniStat label="Avg Lens Score" value={`${avgLensScore}/100`} />
        <MiniStat label="Redesign Energy" value={totalRedesignEnergy} color="text-purple-600" />
        <MiniStat label="Vision/Enabler Ratio" value={reimagineCount > 0 ? `${(reimagineCount / Math.max(1, enablerNodes.length)).toFixed(1)}:1` : '—'} />
      </div>

      {/* Multi-Lens Confidence — full width */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Multi-Lens Confidence Assessment</h3>
        <MultiLensCard multiLens={diag.multiLens} />
      </div>

      {/* Gap Analysis */}
      {reimagineCount > 0 && enablerNodes.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Vision–Enabler Gap</h3>
          <p className="text-xs text-slate-500 mb-4">Ratio of creative vision nodes to enabling mechanism nodes</p>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded bg-blue-400" />
                <span className="text-sm text-slate-600">Visions & Beliefs</span>
                <span className="text-sm font-bold text-slate-900 ml-auto">{reimagineCount}</span>
              </div>
              <div className="h-4 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(reimagineCount / (reimagineCount + enablerNodes.length)) * 100}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded bg-emerald-400" />
                <span className="text-sm text-slate-600">Enablers</span>
                <span className="text-sm font-bold text-slate-900 ml-auto">{enablerNodes.length}</span>
              </div>
              <div className="h-4 bg-emerald-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(enablerNodes.length / (reimagineCount + enablerNodes.length)) * 100}%` }} />
              </div>
            </div>
          </div>
          {reimagineCount / Math.max(1, enablerNodes.length) > 3 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">
                High vision-to-enabler ratio ({(reimagineCount / Math.max(1, enablerNodes.length)).toFixed(1)}:1) suggests strong creative ambition but underdeveloped enabling mechanisms. Consider focusing the next session on bridging this gap.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Top concern */}
      {topConcern !== 'None identified' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-amber-800 mb-1">Top Concern</h4>
          <p className="text-sm text-amber-700">{topConcern}</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: JOURNEY
// ══════════════════════════════════════════════════════════════

function JourneyView({ journeyData }: { journeyData: LiveJourneyData | null }) {
  if (!journeyData) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Customer Journey"
          subtitle="Interactions, pain points, and AI agency boundaries"
        />
        <EmptyState message="No journey data available. The customer journey map is populated during the live workshop session." />
      </div>
    );
  }

  const painPoints = journeyData.interactions.filter(i => i.isPainPoint).length;
  const momentsOfTruth = journeyData.interactions.filter(i => i.isMomentOfTruth).length;
  const enrichedCount = journeyData.interactions.filter(i =>
    i.aiAgencyNow !== 'human' || i.aiAgencyFuture !== 'human' ||
    i.businessIntensity !== 0.5 || i.customerIntensity !== 0.5
  ).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Customer Journey"
        subtitle="Interactions, pain points, and AI agency boundaries"
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MiniStat label="Stages" value={journeyData.stages.length} />
        <MiniStat label="Actors" value={journeyData.actors.length} />
        <MiniStat label="Interactions" value={journeyData.interactions.length} />
        <MiniStat label="Pain Points" value={painPoints} color="text-red-600" />
        <MiniStat label="Enriched" value={`${Math.round((enrichedCount / Math.max(1, journeyData.interactions.length)) * 100)}%`} color="text-emerald-600" />
      </div>

      {/* Journey Map */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <LiveJourneyMap
          data={journeyData}
          expanded={true}
          mode="output"
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW: DIAGNOSTIC
// ══════════════════════════════════════════════════════════════

function DiagnosticView({
  diagBefore,
  diagAfter,
  diagDelta,
  diagLoading,
}: {
  diagBefore: HemisphereDiagnostic | null;
  diagAfter: HemisphereDiagnostic | null;
  diagDelta: DiagnosticDelta | null;
  diagLoading: boolean;
}) {
  if (diagLoading) return <LoadingState label="Loading diagnostic data..." />;

  if (!diagBefore && !diagAfter) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Organisational Psyche"
          subtitle="Deep diagnostic — sentiment, bias, balance, and multi-lens analysis"
        />
        <EmptyState message="No diagnostic data available. Diagnostic computation requires hemisphere graph data." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Organisational Psyche"
        subtitle="Deep diagnostic — before and after comparison"
      />

      {/* Before/After Comparison */}
      {diagBefore && diagAfter && diagDelta && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <DiagnosticComparison before={diagBefore} after={diagAfter} delta={diagDelta} />
        </div>
      )}

      {/* Side-by-side diagnostic panels */}
      {diagBefore && diagAfter ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Before — Discovery Baseline</h3>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <SentimentIndexCard sentimentIndex={diagBefore.sentimentIndex} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <BiasDetectionCard biasDetection={diagBefore.biasDetection} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <BalanceSafeguardCard balanceSafeguard={diagBefore.balanceSafeguard} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <MultiLensCard multiLens={diagBefore.multiLens} />
            </div>
          </div>
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">After — Live Session</h3>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <SentimentIndexCard sentimentIndex={diagAfter.sentimentIndex} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <BiasDetectionCard biasDetection={diagAfter.biasDetection} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <BalanceSafeguardCard balanceSafeguard={diagAfter.balanceSafeguard} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <MultiLensCard multiLens={diagAfter.multiLens} />
            </div>
          </div>
        </div>
      ) : (
        /* Single diagnostic (no comparison) */
        <div className="space-y-6">
          {(diagAfter || diagBefore) && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <SentimentIndexCard sentimentIndex={(diagAfter || diagBefore)!.sentimentIndex} />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <BiasDetectionCard biasDetection={(diagAfter || diagBefore)!.biasDetection} />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <BalanceSafeguardCard balanceSafeguard={(diagAfter || diagBefore)!.balanceSafeguard} />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <MultiLensCard multiLens={(diagAfter || diagBefore)!.multiLens} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}

function KeyStatCard({
  label,
  value,
  previousValue,
  suffix,
  positiveIsGood,
}: {
  label: string;
  value: number;
  previousValue?: number;
  suffix?: string;
  positiveIsGood?: boolean;
}) {
  const delta = previousValue != null ? value - previousValue : null;
  const isPositive = delta != null && delta > 0;
  const isDeltaGood = positiveIsGood ? isPositive : !isPositive;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix && <span className="text-sm font-normal text-slate-400 ml-1">{suffix}</span>}
      </div>
      {delta != null && delta !== 0 && (
        <div className={`text-xs font-medium mt-1 ${isDeltaGood ? 'text-emerald-600' : 'text-red-500'}`}>
          {delta > 0 ? '+' : ''}{delta}{suffix === '%' ? 'pp' : ''} from baseline
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
      <div className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${color || 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
      <p className="text-sm text-slate-400 italic max-w-md text-center">{message}</p>
    </div>
  );
}
