'use client';

import { useState } from 'react';
import { Search, Sparkles, Shield, ArrowRight, Target, Image as ImageIcon, Loader2, Check } from 'lucide-react';
import { AiInsightCard } from '@/components/scratchpad/AiInsightCard';
import { ThreeHousesFramework } from '@/components/scratchpad/ThreeHousesFramework';
import { SectionHeader } from './SectionHeader';
import { ArtifactRenderer } from './ArtifactRenderer';
import { TruthCard } from './TruthCard';
import { ConstraintCluster } from './ConstraintCluster';
import { NowNextLaterBoard } from './NowNextLaterBoard';
import { OutcomeRow } from './OutcomeRow';
import { V2InquiryBar, type V2ReportBlock } from './V2InquiryBar';
import type { V2Output } from '@/lib/output/v2-synthesis-agent';

// ── Tab config ─────────────────────────────────────────────────────────────

type V2Tab = 'discover' | 'reimagine' | 'constraints' | 'pathForward' | 'outcomes';

const V2_TABS: { key: V2Tab; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'discover',     label: 'Discover',      icon: Search,     color: 'text-blue-600'    },
  { key: 'reimagine',    label: 'Reimagine',     icon: Sparkles,   color: 'text-pink-600'    },
  { key: 'constraints',  label: 'Constraints',   icon: Shield,     color: 'text-amber-600'   },
  { key: 'pathForward',  label: 'Path Forward',  icon: ArrowRight, color: 'text-emerald-600' },
  { key: 'outcomes',     label: 'Outcomes',      icon: Target,     color: 'text-purple-600'  },
];

// ── Empty state ────────────────────────────────────────────────────────────

function V2EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
        <Sparkles className="h-8 w-8 text-indigo-300" />
      </div>
      <h3 className="text-slate-700 font-semibold mb-2">V2 Output not yet generated</h3>
      <p className="text-slate-400 text-sm max-w-sm">
        Run Synthesise from the Hemisphere page. The V2 agent runs automatically after the V1 synthesis completes.
      </p>
    </div>
  );
}

// ── Image generation button ────────────────────────────────────────────────

function GenerateWorldImageButton({
  workshopId,
  onImageGenerated,
}: {
  workshopId: string;
  onImageGenerated: (url: string) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const handleGenerate = async () => {
    setStatus('loading');
    try {
      const r = await fetch(`/api/admin/workshops/${workshopId}/generate-reimagine-image`, {
        method: 'POST',
      });
      const json = await r.json().catch(() => null);
      if (json?.url) {
        onImageGenerated(json.url);
        setStatus('done');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={status === 'loading' || status === 'done'}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
    >
      {status === 'loading' ? (
        <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
      ) : status === 'done' ? (
        <><Check className="h-4 w-4" />Generated</>
      ) : (
        <><ImageIcon className="h-4 w-4" /><Sparkles className="h-4 w-4" />Generate world image</>
      )}
    </button>
  );
}

// ── Main V2 output view ────────────────────────────────────────────────────

interface V2OutputViewProps {
  v2Output: V2Output | null;
  workshopId: string;
  onAddToReport?: (block: V2ReportBlock) => void;
}

export function V2OutputView({ v2Output, workshopId, onAddToReport }: V2OutputViewProps) {
  const [activeTab, setActiveTab] = useState<V2Tab>('discover');
  const [worldImageUrl, setWorldImageUrl] = useState<string | null>(null);

  if (!v2Output) return <V2EmptyState />;

  // Build section context string for each tab's inquiry bar
  const sectionContexts: Record<V2Tab, string> = {
    discover: v2Output.discover
      ? `DISCOVER section. Exec: ${v2Output.discover.execSummary}. Key truths: ${v2Output.discover.truths?.map(t => t.statement).join('; ')}. Pain concentration: ${v2Output.discover.painConcentration}. Gaps: ${v2Output.discover.gaps?.join('; ')}`
      : '',
    reimagine: v2Output.reimagine
      ? `REIMAGINE section. Exec: ${v2Output.reimagine.execSummary}. Future states: ${v2Output.reimagine.futureStates?.map(f => f.title).join('; ')}. Actor shifts: ${v2Output.reimagine.actorJourneyShifts?.map(s => `${s.actor}: ${s.from} → ${s.to}`).join('; ')}`
      : '',
    constraints: v2Output.constraints
      ? `CONSTRAINTS section. Exec: ${v2Output.constraints.execSummary}. Clusters: ${v2Output.constraints.clusters?.map(c => `${c.name} (${c.count}, ${c.severity})`).join('; ')}. Total: ${v2Output.constraints.totals?.total}, Solvable: ${v2Output.constraints.totals?.solvable}`
      : '',
    pathForward: v2Output.pathForward
      ? `PATH FORWARD section. Exec: ${v2Output.pathForward.execSummary}. Steps: ${v2Output.pathForward.steps?.map(s => `[${s.horizon}] ${s.action} (${s.owner})`).join('; ')}`
      : '',
    outcomes: v2Output.outcomes
      ? `OUTCOMES section. Exec: ${v2Output.outcomes.execSummary}. Outcomes: ${v2Output.outcomes.items?.map(o => `${o.outcome} — metric: ${o.metric}`).join('; ')}`
      : '',
  };

  return (
    <div>
      {/* V2 inner tab bar */}
      <div className="flex gap-0 border-b border-slate-200 mb-8 overflow-x-auto">
        {V2_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? tab.color : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── DISCOVER ── */}
      {activeTab === 'discover' && v2Output.discover && (
        <div className="space-y-6">
          <SectionHeader
            section="Discover"
            purpose="What is true today — mapped to where it happens and who it affects."
            interpretation="Each truth is anchored to an actor, journey stage, and lens. Evidence strength indicates signal reliability."
          />
          <AiInsightCard summary={v2Output.discover.execSummary} />

          {/* Top 5 truths */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Top 5 Truths</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {v2Output.discover.truths?.map((truth, i) => (
                <TruthCard key={i} truth={truth} index={i} />
              ))}
            </div>
          </div>

          {/* Artifact (usually heatmap) */}
          {v2Output.discover.artifact && v2Output.discover.artifact.type !== 'none' && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Pain Distribution — Actors × Journey Stages
              </h3>
              {v2Output.discover.artifact.type === 'heatmap' && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 mb-3 text-xs text-slate-600 leading-relaxed">
                  <span className="font-semibold text-blue-700">How to read this: </span>
                  Each cell shows the number of friction or pain signals captured for that actor at that journey stage during the workshop. Darker cells = higher concentration of pain. Hover a cell to see what drives that score. Use this to prioritise where intervention will have the most impact.
                </div>
              )}
              <ArtifactRenderer artifact={v2Output.discover.artifact} />
            </div>
          )}

          {/* Pain concentration + gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {v2Output.discover.painConcentration && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-2">Pain Concentration</h4>
                <p className="text-sm text-slate-700 leading-relaxed">{v2Output.discover.painConcentration}</p>
              </div>
            )}
            {v2Output.discover.gaps?.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Evidence Gaps</h4>
                <ul className="space-y-1.5">
                  {v2Output.discover.gaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <V2InquiryBar
            workshopId={workshopId}
            sectionContext={sectionContexts.discover}
            sectionLabel="Discover"
            onAddToReport={onAddToReport}
          />
        </div>
      )}

      {/* ── REIMAGINE ── */}
      {activeTab === 'reimagine' && v2Output.reimagine && (
        <div className="space-y-6">
          <SectionHeader
            section="Reimagine"
            purpose="The ideal future — what changes for each actor across each journey stage."
            interpretation="Future states show value unlocked and what the organisation leaves behind. Actor shifts track the transformation journey."
          />
          <AiInsightCard summary={v2Output.reimagine.execSummary} />

          {/* Three houses visual */}
          <ThreeHousesFramework />

          {/* World image */}
          {worldImageUrl ? (
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={worldImageUrl} alt="Reimagined world" className="w-full object-cover" />
              <div className="p-3 bg-white text-xs text-slate-500 text-center">
                AI-generated concept: the reimagined future
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <GenerateWorldImageButton workshopId={workshopId} onImageGenerated={setWorldImageUrl} />
            </div>
          )}

          {/* Future states grid */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Future States</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {v2Output.reimagine.futureStates?.map((fs, i) => (
                <div key={i} className="rounded-xl border border-pink-200 bg-pink-50 p-5">
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">{fs.title}</h4>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-xs font-medium">👤 {fs.actor}</span>
                    <span className="rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 text-xs font-medium">📍 {fs.journeyStage}</span>
                    <span className="rounded-full bg-pink-100 text-pink-700 border border-pink-200 px-2.5 py-0.5 text-xs font-medium">🔍 {fs.lens}</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-semibold text-emerald-600">Value unlocked: </span>
                      <span className="text-xs text-slate-600">{fs.valueUnlocked}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-red-600">What disappears: </span>
                      <span className="text-xs text-slate-600">{fs.whatDisappears}</span>
                    </div>
                    {fs.howWeKnow && (
                      <div className="rounded bg-white/70 border border-pink-100 px-2.5 py-2 mt-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-pink-500 mb-1">Workshop signal</div>
                        <p className="text-xs italic text-slate-600 leading-relaxed">"{fs.howWeKnow}"</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actor journey shifts */}
          {v2Output.reimagine.actorJourneyShifts?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Actor Journey Shifts</h3>
              <div className="space-y-2">
                {v2Output.reimagine.actorJourneyShifts.map((shift, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-3">
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-full px-2.5 py-0.5 flex-shrink-0">
                      {shift.actor}
                    </span>
                    <span className="text-xs text-slate-500">{shift.from}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-emerald-700">{shift.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artifact */}
          {v2Output.reimagine.artifact && v2Output.reimagine.artifact.type !== 'none' && (
            <ArtifactRenderer artifact={v2Output.reimagine.artifact} />
          )}

          <V2InquiryBar
            workshopId={workshopId}
            sectionContext={sectionContexts.reimagine}
            sectionLabel="Reimagine"
            onAddToReport={onAddToReport}
          />
        </div>
      )}

      {/* ── CONSTRAINTS ── */}
      {activeTab === 'constraints' && v2Output.constraints && (
        <div className="space-y-6">
          <SectionHeader
            section="Constraints"
            purpose="What blocks progress — clustered, quantified, and mapped to where they bite."
            interpretation="Severity = impact if unaddressed. Effort = difficulty to resolve. Solvable = addressable within 12 months."
          />
          <AiInsightCard summary={v2Output.constraints.execSummary} />

          {/* Totals strip */}
          {v2Output.constraints.totals && (
            <div className="flex gap-4">
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-center">
                <div className="text-3xl font-bold text-slate-900">{v2Output.constraints.totals.total}</div>
                <div className="text-xs text-slate-500 mt-1">Total constraints</div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-center">
                <div className="text-3xl font-bold text-emerald-700">{v2Output.constraints.totals.solvable}</div>
                <div className="text-xs text-emerald-600 mt-1">Solvable (&lt;12m)</div>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-center">
                <div className="text-3xl font-bold text-red-600">
                  {v2Output.constraints.totals.total - v2Output.constraints.totals.solvable}
                </div>
                <div className="text-xs text-red-500 mt-1">Structural</div>
              </div>
            </div>
          )}

          {/* Artifact (usually bar chart) */}
          {v2Output.constraints.artifact && v2Output.constraints.artifact.type !== 'none' && (
            <ArtifactRenderer artifact={v2Output.constraints.artifact} />
          )}

          {/* Clusters */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Constraint Clusters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {v2Output.constraints.clusters?.map((cluster, i) => (
                <ConstraintCluster key={i} cluster={cluster} />
              ))}
            </div>
          </div>

          <V2InquiryBar
            workshopId={workshopId}
            sectionContext={sectionContexts.constraints}
            sectionLabel="Constraints"
            onAddToReport={onAddToReport}
          />
        </div>
      )}

      {/* ── PATH FORWARD ── */}
      {activeTab === 'pathForward' && v2Output.pathForward && (
        <div className="space-y-6">
          <SectionHeader
            section="Path Forward"
            purpose="How we move — each action linked to the constraint it addresses, the journey stage it improves, and who owns it."
            interpretation="Now = immediate. Next = near-term. Later = strategic horizon. Each card connects action to constraint to stage."
          />
          <AiInsightCard summary={v2Output.pathForward.execSummary} />

          <NowNextLaterBoard steps={v2Output.pathForward.steps || []} />

          {/* Artifact (usually gantt) */}
          {v2Output.pathForward.artifact && v2Output.pathForward.artifact.type !== 'none' && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Delivery Timeline</h3>
              <ArtifactRenderer artifact={v2Output.pathForward.artifact} />
            </div>
          )}

          <V2InquiryBar
            workshopId={workshopId}
            sectionContext={sectionContexts.pathForward}
            sectionLabel="Path Forward"
            onAddToReport={onAddToReport}
          />
        </div>
      )}

      {/* ── OUTCOMES ── */}
      {activeTab === 'outcomes' && v2Output.outcomes && (
        <div className="space-y-6">
          <SectionHeader
            section="Outcomes"
            purpose="What we get — measurable results linked to the insight that reveals the need and the action that delivers it."
            interpretation="Each outcome has a specific metric, linked insight, and a named actor + journey stage. These are the KPIs of transformation."
          />
          <AiInsightCard summary={v2Output.outcomes.execSummary} />

          {/* Artifact (usually bar chart) */}
          {v2Output.outcomes.artifact && v2Output.outcomes.artifact.type !== 'none' && (
            <ArtifactRenderer artifact={v2Output.outcomes.artifact} />
          )}

          <div className="space-y-3">
            {v2Output.outcomes.items?.map((outcome, i) => (
              <OutcomeRow key={i} outcome={outcome} index={i} />
            ))}
          </div>

          <V2InquiryBar
            workshopId={workshopId}
            sectionContext={sectionContexts.outcomes}
            sectionLabel="Outcomes"
            onAddToReport={onAddToReport}
          />
        </div>
      )}
    </div>
  );
}
