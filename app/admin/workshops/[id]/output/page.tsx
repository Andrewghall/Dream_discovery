'use client';

/**
 * Output Dashboard — redesigned with 6 tabs backed entirely by real session data.
 *
 * Tabs:
 *   1. Exec Summary     — blueprint desired outcomes + AI exec summary
 *   2. Hemispheres      — 4-phase hemisphere views (Discovery, Reimagine, Constrained, Define)
 *   3. Insights         — domain-by-domain discovery analysis (discoveryOutput)
 *   4. Reimagine        — vision statement from reimagineContent
 *   5. Transformation   — constraints + potential solution from real data
 *   6. Define Approach  — final output, how it meets desired session outcomes
 *
 * NO hardcoded template data anywhere. Every section shows an empty state
 * if synthesis hasn't been run yet.
 */

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Target,
  Globe2,
  Lightbulb,
  Sparkles,
  Rocket,
  CheckSquare,
  ArrowLeft,
  TrendingUp,
  Users,
  Zap,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  CheckCircle2,
  Calendar,
  Shield,
  Cpu,
  DollarSign,
  Building2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DashboardHemisphereNode, DashboardHemisphereEdge } from '@/components/hemisphere/dashboard-hemisphere-canvas';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

type PageProps = { params: Promise<{ id: string }> };

type HemisphereGraph = {
  nodes: DashboardHemisphereNode[];
  edges: DashboardHemisphereEdge[];
  coreTruthNodeId: string;
};

type PhaseSnapshot = { id: string; name: string; dialoguePhase: string; createdAt: string };

type ScratchpadData = {
  execSummary?: any;
  discoveryOutput?: any;
  reimagineContent?: any;
  constraintsContent?: any;
  potentialSolution?: any;
  summaryContent?: any;
  customerJourney?: any;
};

type TabKey = 'exec-summary' | 'hemisphere' | 'insights' | 'reimagine' | 'transformation' | 'define-approach';

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'exec-summary',    label: 'Exec Summary',    icon: Target,      color: 'text-amber-600'   },
  { key: 'hemisphere',      label: 'Hemispheres',     icon: Globe2,      color: 'text-blue-600'    },
  { key: 'insights',        label: 'Insights',        icon: Lightbulb,   color: 'text-purple-600'  },
  { key: 'reimagine',       label: 'Reimagine',       icon: Sparkles,    color: 'text-pink-600'    },
  { key: 'transformation',  label: 'Transformation',  icon: Rocket,      color: 'text-emerald-600' },
  { key: 'define-approach', label: 'Define Approach', icon: CheckSquare, color: 'text-slate-700'   },
];

// Dialogue phase → display config
const PHASE_CONFIG = [
  { phase: 'DISCOVERY',       label: 'Discovery',      color: 'bg-sky-100 text-sky-800 border-sky-200',     dot: 'bg-sky-500'     },
  { phase: 'REIMAGINE',       label: 'Reimagine',      color: 'bg-pink-100 text-pink-800 border-pink-200',  dot: 'bg-pink-500'    },
  { phase: 'CONSTRAINTS',     label: 'Constrained',    color: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  { phase: 'DEFINE_APPROACH', label: 'Define Approach',color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
] as const;

// ── Impact/priority colour helpers ────────────────────────────────────────────

const IMPACT_COLORS: Record<string, string> = {
  Critical:      'bg-red-100 text-red-700 border-red-200',
  High:          'bg-amber-100 text-amber-700 border-amber-200',
  Transformational: 'bg-purple-100 text-purple-700 border-purple-200',
  Medium:        'bg-blue-100 text-blue-700 border-blue-200',
  Low:           'bg-slate-100 text-slate-600 border-slate-200',
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH:   'bg-red-100 text-red-700 border-red-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW:    'bg-green-100 text-green-700 border-green-200',
};

const CONSTRAINT_ICONS: Record<string, React.ElementType> = {
  regulatory:     Shield,
  technical:      Cpu,
  commercial:     DollarSign,
  organizational: Building2,
};

// ══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════════════════════════════════════

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Zap className="h-8 w-8 text-slate-300" />
      </div>
      <p className="text-slate-400 text-sm max-w-sm">{message}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: EXEC SUMMARY
// ══════════════════════════════════════════════════════════════════════════════

function ExecSummarySection({
  workshopName,
  outcomes,
  execSummary,
  journeyData,
}: {
  workshopName: string;
  outcomes: string | null;
  execSummary: any;
  journeyData: LiveJourneyData | null;
}) {
  const hasData = execSummary && typeof execSummary === 'object';

  return (
    <div className="space-y-8">

      {/* Desired Outcomes from blueprint */}
      {outcomes && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-600 font-medium mb-2">Desired Session Outcomes</p>
          <p className="text-slate-800 leading-relaxed">{outcomes}</p>
        </div>
      )}

      {!hasData ? (
        <EmptyState message="No synthesis data yet. Run 'Generate Report' from the Hemisphere page to populate this section." />
      ) : (
        <>
          {/* Hero overview */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-2xl p-8 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Executive Summary</p>
            <h2 className="text-2xl font-bold mb-4">{workshopName}</h2>
            <p className="text-white/90 leading-relaxed text-lg">{execSummary.overview}</p>
          </div>

          {/* Metrics grid */}
          {execSummary.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Users,      label: 'Participants',         value: execSummary.metrics.participantsEngaged },
                { icon: Globe2,     label: 'Domains Explored',     value: execSummary.metrics.domainsExplored },
                { icon: Lightbulb,  label: 'Insights Generated',   value: execSummary.metrics.insightsGenerated },
                { icon: TrendingUp, label: 'Transformational Ideas',value: execSummary.metrics.transformationalIdeas },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                  <Icon className="h-5 w-5 text-slate-400 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-slate-900">{value ?? '—'}</div>
                  <div className="text-xs text-slate-500 mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Key findings */}
          {Array.isArray(execSummary.keyFindings) && execSummary.keyFindings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Key Findings</h3>
              <div className="space-y-3">
                {execSummary.keyFindings.map((f: any, i: number) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex-shrink-0 flex items-center justify-center">
                      <span className="text-amber-700 font-bold text-sm">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-900">{f.title}</h4>
                        {f.impact && (
                          <span className={`text-[10px] font-semibold uppercase border rounded-full px-2 py-0.5 ${IMPACT_COLORS[f.impact] || IMPACT_COLORS.Medium}`}>
                            {f.impact}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{f.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Journey snapshot */}
          {journeyData && journeyData.interactions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Journey at a Glance</h3>
              <div className="flex flex-wrap gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">{journeyData.stages.length}</div>
                  <div className="text-xs text-slate-500">Stages</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">{journeyData.actors.length}</div>
                  <div className="text-xs text-slate-500">Actors</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">{journeyData.interactions.length}</div>
                  <div className="text-xs text-slate-500">Interactions</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {journeyData.interactions.filter((i: any) => i.isPainPoint).length}
                  </div>
                  <div className="text-xs text-slate-500">Pain Points</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: HEMISPHERES (4-phase)
// ══════════════════════════════════════════════════════════════════════════════

function HemispheresSection({
  workshopId,
  snapshots,
}: {
  workshopId: string;
  snapshots: PhaseSnapshot[];
}) {
  const [activePhase, setActivePhase] = useState<string>('DISCOVERY');
  const [graphs, setGraphs] = useState<Record<string, HemisphereGraph | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const fetchPhaseGraph = useCallback(async (phase: string) => {
    if (graphs[phase] !== undefined) return; // already fetched or attempted
    setLoading(prev => ({ ...prev, [phase]: true }));
    try {
      if (phase === 'DISCOVERY') {
        // Discovery = baseline (all nodes, no phase filter)
        const r = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?runType=BASELINE&bust=${Date.now()}`);
        const json = await r.json().catch(() => null);
        setGraphs(prev => ({ ...prev, DISCOVERY: json?.hemisphereGraph || null }));
      } else {
        // Find snapshot matching this phase
        const match = snapshots.find(s => s.dialoguePhase === phase);
        if (!match) {
          setGraphs(prev => ({ ...prev, [phase]: null }));
        } else {
          const r = await fetch(
            `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?source=snapshot&snapshotId=${encodeURIComponent(match.id)}&bust=${Date.now()}`,
          );
          const json = await r.json().catch(() => null);
          setGraphs(prev => ({ ...prev, [phase]: json?.hemisphereGraph || null }));
        }
      }
    } catch {
      setGraphs(prev => ({ ...prev, [phase]: null }));
    } finally {
      setLoading(prev => ({ ...prev, [phase]: false }));
    }
  }, [workshopId, snapshots, graphs]);

  // Fetch on phase change
  useEffect(() => {
    void fetchPhaseGraph(activePhase);
  }, [activePhase, fetchPhaseGraph]);

  const currentGraph = graphs[activePhase];
  const isLoading = loading[activePhase];

  // Derive lens distribution from phaseTags
  const lensStats = currentGraph
    ? (() => {
        const counts = new Map<string, number>();
        for (const n of currentGraph.nodes) {
          for (const tag of n.phaseTags) {
            const lensKey = tag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            counts.set(lensKey, (counts.get(lensKey) || 0) + 1);
          }
        }
        return Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);
      })()
    : [];

  const totalNodes = currentGraph?.nodes.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Phase pills */}
      <div className="flex flex-wrap gap-2">
        {PHASE_CONFIG.map(pc => {
          const isActive = activePhase === pc.phase;
          const hasSnapshot = pc.phase === 'DISCOVERY' || snapshots.some(s => s.dialoguePhase === pc.phase);
          return (
            <button
              key={pc.phase}
              onClick={() => setActivePhase(pc.phase)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                isActive
                  ? pc.color
                  : hasSnapshot
                    ? 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                    : 'border-dashed border-slate-200 text-slate-300 cursor-default bg-white/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? pc.dot : hasSnapshot ? 'bg-slate-300' : 'bg-slate-200'}`} />
              {pc.label}
              {!hasSnapshot && <span className="text-[10px] opacity-60">(no data)</span>}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="text-center py-20 text-slate-400 text-sm">Loading hemisphere data…</div>
      )}

      {!isLoading && !currentGraph && (
        <EmptyState
          message={
            activePhase === 'DISCOVERY'
              ? 'No baseline hemisphere data found. Run the hemisphere analysis to populate.'
              : `No snapshot found for the ${PHASE_CONFIG.find(p => p.phase === activePhase)?.label} phase. Run a live session through this phase to generate data.`
          }
        />
      )}

      {!isLoading && currentGraph && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                {PHASE_CONFIG.find(p => p.phase === activePhase)?.label} Phase
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total nodes</span>
                  <span className="font-bold text-slate-900">{totalNodes}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Connections</span>
                  <span className="font-bold text-slate-900">{currentGraph.edges.length}</span>
                </div>
              </div>
            </div>

            {/* Node type breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Node Types</h4>
              {(() => {
                const typeCounts = new Map<string, number>();
                for (const n of currentGraph.nodes) {
                  typeCounts.set(n.type, (typeCounts.get(n.type) || 0) + 1);
                }
                const TYPE_COLORS: Record<string, string> = {
                  VISION: 'bg-purple-400', BELIEF: 'bg-blue-400', CHALLENGE: 'bg-red-400',
                  FRICTION: 'bg-orange-400', CONSTRAINT: 'bg-amber-400', ENABLER: 'bg-emerald-400', EVIDENCE: 'bg-slate-400',
                };
                return Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_COLORS[type] || 'bg-slate-400'}`} />
                    <span className="text-xs text-slate-600 flex-1">{type.charAt(0) + type.slice(1).toLowerCase()}</span>
                    <span className="text-xs font-semibold text-slate-700">{count}</span>
                    <div className="w-16 bg-slate-100 rounded-full h-1 overflow-hidden">
                      <div
                        className={`h-1 rounded-full ${TYPE_COLORS[type] || 'bg-slate-400'}`}
                        style={{ width: `${Math.round((count / totalNodes) * 100)}%` }}
                      />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Lens distribution — main content */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Lens Coverage</h4>
            {lensStats.length === 0 ? (
              <p className="text-slate-400 text-sm">No lens data in this phase.</p>
            ) : (
              <div className="space-y-3">
                {lensStats.map(([lens, count]) => (
                  <div key={lens} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700 font-medium">{lens}</span>
                      <span className="text-slate-400 text-xs">{count} nodes</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500"
                        style={{ width: `${Math.round((count / totalNodes) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Top nodes list */}
            {currentGraph.nodes.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Top Nodes</h4>
                <div className="space-y-2">
                  {currentGraph.nodes
                    .sort((a, b) => b.weight - a.weight)
                    .slice(0, 6)
                    .map(n => (
                      <div key={n.id} className="flex items-start gap-2">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 ${
                          n.type === 'VISION' ? 'bg-purple-100 text-purple-700' :
                          n.type === 'ENABLER' ? 'bg-emerald-100 text-emerald-700' :
                          n.type === 'CHALLENGE' || n.type === 'FRICTION' ? 'bg-red-100 text-red-700' :
                          n.type === 'CONSTRAINT' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{n.type.slice(0, 3)}</span>
                        <p className="text-sm text-slate-700 leading-snug line-clamp-2">{n.label}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link to full hemisphere page */}
      <div className="flex justify-end">
        <Link
          href={`/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere`}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          Open full hemisphere explorer
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: INSIGHTS (discoveryOutput)
// ══════════════════════════════════════════════════════════════════════════════

const SENTIMENT_COLORS = {
  concerned:  { bar: 'bg-red-400',    label: 'Concerned'  },
  neutral:    { bar: 'bg-slate-300',  label: 'Neutral'    },
  optimistic: { bar: 'bg-emerald-400',label: 'Optimistic' },
};

function InsightsSection({ discoveryOutput }: { discoveryOutput: any }) {
  const sections: any[] = Array.isArray(discoveryOutput?.sections) ? discoveryOutput.sections : [];

  if (sections.length === 0) {
    return <EmptyState message="No insight data yet. Run 'Generate Report' from the Hemisphere page to populate this section." />;
  }

  return (
    <div className="space-y-8">
      {discoveryOutput._aiSummary && (
        <div className="bg-gradient-to-br from-purple-900 to-indigo-900 text-white rounded-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Agentic Synthesis</p>
          <p className="text-white/95 leading-relaxed text-lg">{discoveryOutput._aiSummary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section: any, i: number) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            {/* Domain header */}
            <div className="flex items-center gap-3">
              {section.icon && <span className="text-2xl">{section.icon}</span>}
              <div>
                <h3 className="font-bold text-slate-900">{section.domain}</h3>
                <p className="text-xs text-slate-400">{section.utteranceCount ?? 0} data points</p>
              </div>
            </div>

            {/* Top themes */}
            {Array.isArray(section.topThemes) && section.topThemes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {section.topThemes.map((t: string, j: number) => (
                  <span key={j} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Sentiment bar */}
            {section.sentiment && (
              <div className="space-y-1">
                <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                  {Object.entries(SENTIMENT_COLORS).map(([key, cfg]) => {
                    const val = section.sentiment[key] || 0;
                    return val > 0 ? (
                      <div key={key} className={`${cfg.bar} transition-all`} style={{ width: `${val}%` }} />
                    ) : null;
                  })}
                </div>
                <div className="flex gap-3">
                  {Object.entries(SENTIMENT_COLORS).map(([key, cfg]) => {
                    const val = section.sentiment[key];
                    return val ? (
                      <span key={key} className="text-[10px] text-slate-400">
                        {val}% {cfg.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Representative quote */}
            {Array.isArray(section.quotes) && section.quotes[0] && (
              <blockquote className="border-l-2 border-slate-200 pl-3">
                <p className="text-sm text-slate-600 italic">"{section.quotes[0].text}"</p>
                {section.quotes[0].author && (
                  <p className="text-xs text-slate-400 mt-1">— {section.quotes[0].author}</p>
                )}
              </blockquote>
            )}

            {/* Word cloud tags */}
            {Array.isArray(section.wordCloud) && section.wordCloud.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {section.wordCloud.slice(0, 12).map((w: { word: string; size: number }, j: number) => (
                  <span
                    key={j}
                    className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100"
                    style={{ fontSize: `${10 + (w.size - 1) * 2}px` }}
                  >
                    {w.word}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: REIMAGINE
// ══════════════════════════════════════════════════════════════════════════════

function ReimagineSection({ reimagineContent }: { reimagineContent: any }) {
  const data = reimagineContent?.reimagineContent ?? reimagineContent;

  if (!data || typeof data !== 'object') {
    return <EmptyState message="No reimagine vision yet. Run 'Generate Report' from the Hemisphere page to populate this section." />;
  }

  const primaryThemes: any[] = Array.isArray(data.primaryThemes) ? data.primaryThemes : [];
  const supportingThemes: any[] = Array.isArray(data.supportingThemes) ? data.supportingThemes : [];

  return (
    <div className="space-y-8">
      {/* AI synthesis */}
      {reimagineContent?._aiSummary && (
        <div className="bg-gradient-to-br from-pink-900 to-rose-800 text-white rounded-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Vision Synthesis</p>
          <p className="text-white/95 leading-relaxed text-lg">{reimagineContent._aiSummary}</p>
        </div>
      )}

      {/* Title & description */}
      {(data.title || data.description) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          {data.title && <h2 className="text-3xl font-bold text-slate-900 mb-3" style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}>{data.title}</h2>}
          {data.description && <p className="text-slate-600 leading-relaxed text-lg">{data.description}</p>}
          {data.subtitle && <p className="text-slate-400 mt-2">{data.subtitle}</p>}
        </div>
      )}

      {/* Primary themes */}
      {primaryThemes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Primary Themes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {primaryThemes.map((theme: any, i: number) => (
              <div key={i} className="bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 rounded-xl p-6">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-slate-900">{theme.title}</h4>
                  {theme.badge && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200 ml-2 flex-shrink-0">
                      {theme.badge}
                    </span>
                  )}
                </div>
                {theme.weighting && <p className="text-xs text-pink-600 mb-2">{theme.weighting}</p>}
                <p className="text-sm text-slate-600 leading-relaxed">{theme.description}</p>
                {Array.isArray(theme.details) && theme.details.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {theme.details.map((d: string, j: number) => (
                      <li key={j} className="text-xs text-slate-500 flex gap-1.5">
                        <ChevronRight className="h-3 w-3 text-pink-400 flex-shrink-0 mt-0.5" />
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategic shifts */}
      {(data.shiftOne || data.shiftTwo) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[data.shiftOne, data.shiftTwo].filter(Boolean).map((shift: any, i: number) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6">
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 mb-2">Strategic Shift {i + 1}</p>
              <h4 className="font-bold text-slate-900 mb-2">{shift.title}</h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">{shift.description}</p>
              {Array.isArray(shift.details) && (
                <ul className="space-y-1">
                  {shift.details.map((d: string, j: number) => (
                    <li key={j} className="text-xs text-slate-500 flex gap-1.5">
                      <span className="text-pink-400 flex-shrink-0">→</span>
                      {d}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Horizon vision */}
      {data.horizonVision?.columns && (
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">{data.horizonVision.title || 'Horizon Vision'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.horizonVision.columns.map((col: any, i: number) => (
              <div key={i}>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">{col.title}</h4>
                <ul className="space-y-1">
                  {Array.isArray(col.points) && col.points.map((p: string, j: number) => (
                    <li key={j} className="text-xs text-slate-600 flex gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supporting themes */}
      {supportingThemes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Supporting Themes</h3>
          <div className="space-y-3">
            {supportingThemes.map((theme: any, i: number) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 flex gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-900">{theme.title}</span>
                    {theme.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        {theme.badge}
                      </span>
                    )}
                  </div>
                  {theme.weighting && <p className="text-xs text-slate-400 mb-1">{theme.weighting}</p>}
                  <p className="text-sm text-slate-600">{theme.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: TRANSFORMATION PLAN (constraints + solution)
// ══════════════════════════════════════════════════════════════════════════════

function TransformationSection({
  constraintsContent,
  potentialSolution,
}: {
  constraintsContent: any;
  potentialSolution: any;
}) {
  const hasConstraints = constraintsContent && typeof constraintsContent === 'object';
  const hasSolution = potentialSolution && typeof potentialSolution === 'object';

  if (!hasConstraints && !hasSolution) {
    return <EmptyState message="No transformation data yet. Run 'Generate Report' from the Hemisphere page to populate this section." />;
  }

  const CONSTRAINT_CATS = ['regulatory', 'technical', 'commercial', 'organizational'] as const;
  const enablers: any[] = Array.isArray(potentialSolution?.enablers) ? potentialSolution.enablers : [];
  const implPath: any[] = Array.isArray(potentialSolution?.implementationPath) ? potentialSolution.implementationPath : [];

  return (
    <div className="space-y-8">

      {/* Constraint AI synthesis */}
      {constraintsContent?._aiSummary && (
        <div className="bg-gradient-to-br from-amber-900 to-orange-800 text-white rounded-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Constraint Intelligence</p>
          <p className="text-white/95 leading-relaxed">{constraintsContent._aiSummary}</p>
        </div>
      )}

      {/* Constraints grid */}
      {hasConstraints && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Constraint Landscape</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CONSTRAINT_CATS.map(cat => {
              const items: any[] = Array.isArray(constraintsContent[cat]) ? constraintsContent[cat] : [];
              if (items.length === 0) return null;
              const Icon = CONSTRAINT_ICONS[cat] || Shield;
              return (
                <div key={cat} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon className="h-4 w-4 text-slate-400" />
                    <h4 className="font-semibold text-slate-700 capitalize">{cat}</h4>
                  </div>
                  <div className="space-y-3">
                    {items.map((item: any, i: number) => (
                      <div key={i} className="border-l-2 border-slate-200 pl-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-slate-900">{item.title}</span>
                          {item.impact && (
                            <span className={`text-[10px] font-bold uppercase border rounded-full px-1.5 py-0.5 ${IMPACT_COLORS[item.impact] || IMPACT_COLORS.Medium}`}>
                              {item.impact}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mb-1">{item.description}</p>
                        {item.mitigation && (
                          <p className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1">
                            Mitigation: {item.mitigation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Solution synthesis */}
      {potentialSolution?._aiSummary && (
        <div className="bg-gradient-to-br from-emerald-900 to-teal-800 text-white rounded-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Solution Thesis</p>
          <p className="text-white/95 leading-relaxed">{potentialSolution._aiSummary}</p>
        </div>
      )}

      {/* Solution overview */}
      {potentialSolution?.overview && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-3">Solution Overview</h3>
          <p className="text-slate-600 leading-relaxed">{potentialSolution.overview}</p>
        </div>
      )}

      {/* Enablers */}
      {enablers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Key Enablers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enablers.map((enabler: any, i: number) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-slate-900 flex-1">{enabler.title}</h4>
                  {enabler.priority && (
                    <span className={`text-[10px] font-bold uppercase border rounded-full px-2 py-0.5 ml-2 flex-shrink-0 ${PRIORITY_COLORS[enabler.priority] || PRIORITY_COLORS.MEDIUM}`}>
                      {enabler.priority}
                    </span>
                  )}
                </div>
                {enabler.domain && <p className="text-xs text-slate-400 mb-2">{enabler.domain}</p>}
                <p className="text-sm text-slate-600">{enabler.description}</p>
                {Array.isArray(enabler.dependencies) && enabler.dependencies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {enabler.dependencies.map((dep: string, j: number) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500">{dep}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Implementation path */}
      {implPath.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Implementation Path</h3>
          <div className="space-y-4">
            {implPath.map((phase: any, i: number) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-bold text-sm">{i + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{phase.phase}</h4>
                    {phase.timeframe && <p className="text-xs text-slate-400">{phase.timeframe}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-11">
                  {Array.isArray(phase.actions) && phase.actions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Actions</p>
                      <ul className="space-y-1">
                        {phase.actions.map((a: string, j: number) => (
                          <li key={j} className="text-sm text-slate-600 flex gap-1.5">
                            <ChevronRight className="h-3 w-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(phase.outcomes) && phase.outcomes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Outcomes</p>
                      <ul className="space-y-1">
                        {phase.outcomes.map((o: string, j: number) => (
                          <li key={j} className="text-sm text-slate-600 flex gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: DEFINE APPROACH
// ══════════════════════════════════════════════════════════════════════════════

function DefineApproachSection({
  summaryContent,
  outcomes,
  workshopName,
}: {
  summaryContent: any;
  outcomes: string | null;
  workshopName: string;
}) {
  const hasData = summaryContent && typeof summaryContent === 'object';

  if (!hasData) {
    return <EmptyState message="No define approach data yet. Run 'Generate Report' from the Hemisphere page to populate this section." />;
  }

  const keyFindings: any[] = Array.isArray(summaryContent.keyFindings) ? summaryContent.keyFindings : [];
  const nextSteps: any[] = Array.isArray(summaryContent.recommendedNextSteps) ? summaryContent.recommendedNextSteps : [];
  const successMetrics: any[] = Array.isArray(summaryContent.successMetrics) ? summaryContent.successMetrics : [];

  return (
    <div className="space-y-8">

      {/* How this meets desired outcomes */}
      {outcomes && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 text-white rounded-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Desired Session Outcomes</p>
          <p className="text-white/90 text-lg leading-relaxed">{outcomes}</p>
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-white/60 text-sm">The approach defined below is grounded in this goal.</p>
          </div>
        </div>
      )}

      {/* AI synthesis */}
      {summaryContent._aiSummary && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Synthesis</p>
          <p className="text-slate-700 leading-relaxed">{summaryContent._aiSummary}</p>
        </div>
      )}

      {/* Key findings */}
      {keyFindings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Key Findings</h3>
          <div className="space-y-3">
            {keyFindings.map((cat: any, i: number) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
                <h4 className="font-bold text-slate-900 mb-2">{cat.category}</h4>
                <ul className="space-y-1">
                  {Array.isArray(cat.findings) && cat.findings.map((f: string, j: number) => (
                    <li key={j} className="text-sm text-slate-600 flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended next steps */}
      {nextSteps.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Recommended Next Steps</h3>
          <div className="space-y-3">
            {nextSteps.map((step: any, i: number) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 flex gap-4">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {step.timeframe && (
                    <span className="text-xs text-slate-400 whitespace-nowrap">{step.timeframe}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900 mb-1">{step.step || step.action}</h4>
                  {step.owner && <p className="text-xs text-slate-400 mb-1">Owner: {step.owner}</p>}
                  {step.riskExposure && step.riskExposure !== 'Not assessed' && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-0.5 inline-block">
                      Risk: {step.riskExposure}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success metrics */}
      {successMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Success Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {successMetrics.map((metric: any, i: number) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-slate-300 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900 text-sm">{metric.metric}</div>
                  {metric.target && <div className="text-xs text-emerald-700 mt-0.5">Target: {metric.target}</div>}
                  {metric.measurement && <div className="text-xs text-slate-400 mt-0.5">{metric.measurement}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function OutputDashboardPage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [activeTab, setActiveTab] = useState<TabKey>('exec-summary');

  // Workshop metadata
  const [workshopName, setWorkshopName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [blueprintOutcomes, setBlueprintOutcomes] = useState<string | null>(null);

  // Scratchpad
  const [scratchpad, setScratchpad] = useState<ScratchpadData>({});
  const [journeyData, setJourneyData] = useState<LiveJourneyData | null>(null);

  // Hemisphere snapshots
  const [snapshots, setSnapshots] = useState<PhaseSnapshot[]>([]);

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchWorkshop = async () => {
      try {
        const r = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}`);
        const json = await r.json().catch(() => null);
        if (json?.workshop) {
          setWorkshopName(json.workshop.name || '');
          setOrgName(json.workshop.organization?.name || '');
          const bp = json.workshop.blueprint;
          if (bp && typeof bp === 'object' && bp.outcomes) {
            setBlueprintOutcomes(typeof bp.outcomes === 'string' ? bp.outcomes : null);
          }
        }
      } catch (e) { console.warn('[Output] Workshop fetch failed:', e); }
    };
    void fetchWorkshop();
  }, [workshopId]);

  useEffect(() => {
    const fetchScratchpad = async () => {
      try {
        const r = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/scratchpad`);
        const json = await r.json().catch(() => null);
        if (json?.scratchpad) {
          const sp = json.scratchpad;
          setScratchpad({
            execSummary: sp.execSummary || null,
            discoveryOutput: sp.discoveryOutput || null,
            reimagineContent: sp.reimagineContent || null,
            constraintsContent: sp.constraintsContent || null,
            potentialSolution: sp.potentialSolution || null,
            summaryContent: sp.summaryContent || null,
            customerJourney: sp.customerJourney || null,
          });
          if (sp.customerJourney?.journeyData) {
            setJourneyData(sp.customerJourney.journeyData);
          }
        }
      } catch (e) { console.warn('[Output] Scratchpad fetch failed:', e); }
    };
    void fetchScratchpad();
  }, [workshopId]);

  useEffect(() => {
    const fetchSnapshots = async () => {
      try {
        const r = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?listSnapshots=true`);
        const json = await r.json().catch(() => null);
        if (json?.snapshots) setSnapshots(json.snapshots);
      } catch (e) { console.warn('[Output] Snapshots fetch failed:', e); }
    };
    void fetchSnapshots();
  }, [workshopId]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto">
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

            {/* Synthesis prompt if no data */}
            {!scratchpad.execSummary && (
              <Link
                href={`/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 hover:bg-amber-100 transition-colors"
              >
                <Zap className="h-3 w-3" />
                Run synthesis to populate output
              </Link>
            )}
          </div>

          {/* ── Top-nav tab bar ───────────────────────────────────────────── */}
          <div className="flex gap-0 mt-4 border-b border-slate-200 -mb-4 overflow-x-auto">
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

        {activeTab === 'exec-summary' && (
          <ExecSummarySection
            workshopName={workshopName}
            outcomes={blueprintOutcomes}
            execSummary={scratchpad.execSummary}
            journeyData={journeyData}
          />
        )}

        {activeTab === 'hemisphere' && (
          <HemispheresSection
            workshopId={workshopId}
            snapshots={snapshots}
          />
        )}

        {activeTab === 'insights' && (
          <InsightsSection discoveryOutput={scratchpad.discoveryOutput} />
        )}

        {activeTab === 'reimagine' && (
          <ReimagineSection reimagineContent={scratchpad.reimagineContent} />
        )}

        {activeTab === 'transformation' && (
          <TransformationSection
            constraintsContent={scratchpad.constraintsContent}
            potentialSolution={scratchpad.potentialSolution}
          />
        )}

        {activeTab === 'define-approach' && (
          <DefineApproachSection
            summaryContent={scratchpad.summaryContent}
            outcomes={blueprintOutcomes}
            workshopName={workshopName}
          />
        )}

      </main>
    </div>
  );
}
