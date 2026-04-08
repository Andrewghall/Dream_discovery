'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Zap } from 'lucide-react';
import type {
  BehaviouralInterventionsOutput,
  BehaviouralIntervention,
  LensInterventions,
} from '@/lib/behavioural-interventions/types';
import { ComBWheel } from './ComBWheel';

interface Props {
  workshopId: string;
  workshopName: string;
  initialData: BehaviouralInterventionsOutput | null;
}

const PRIORITY_COLOURS: Record<string, string> = {
  High: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  Low: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400',
};

const INTERVENTION_COLOURS: Record<string, string> = {
  Training: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
  'Environmental Restructuring': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400',
  Incentivisation: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400',
  Enablement: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400',
  Persuasion: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400',
  Modelling: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400',
};

/** Dot indicator for COM-B component strength */
function ComBDot({ label, active }: { label: string; active?: boolean }) {
  const colours: Record<string, string> = {
    C: active ? 'bg-red-500' : 'bg-red-200 dark:bg-red-900/40',
    M: active ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-900/40',
    O: active ? 'bg-green-500' : 'bg-green-200 dark:bg-green-900/40',
  };
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-[9px] font-bold text-white w-5 h-5 ${colours[label] ?? 'bg-gray-300'}`}
      title={label === 'C' ? 'Capability' : label === 'M' ? 'Motivation' : 'Opportunity'}
    >
      {label}
    </span>
  );
}

/** Single COM-B component block */
function ComBBlock({
  label,
  fullLabel,
  subType,
  description,
  colourClass,
  subColourClass,
  dotLabel,
}: {
  label: string;
  fullLabel: string;
  subType?: string;
  description: string;
  colourClass: string;
  subColourClass: string;
  dotLabel: string;
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-1.5 ${colourClass}`}>
      <div className="flex items-center gap-2">
        <ComBDot label={dotLabel} active />
        <span className="text-xs font-bold tracking-wide uppercase">{fullLabel}</span>
        {subType && subType !== 'Both' && (
          <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${subColourClass}`}>
            {subType}
          </span>
        )}
        {subType === 'Both' && (
          <>
            <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${subColourClass}`}>
              {label === 'C' ? 'Physical' : label === 'M' ? 'Reflective' : 'Physical'}
            </span>
            <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${subColourClass}`}>
              {label === 'C' ? 'Psychological' : label === 'M' ? 'Automatic' : 'Social'}
            </span>
          </>
        )}
      </div>
      <p className="text-xs leading-relaxed opacity-90">{description}</p>
    </div>
  );
}

function InterventionCard({ item }: { item: BehaviouralIntervention }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <ComBDot label="C" active={!!item.capability_gap} />
          <ComBDot label="M" active={!!item.motivation_gap} />
          <ComBDot label="O" active={!!item.opportunity_gap} />
        </div>
        <p className="flex-1 text-sm font-semibold leading-snug">{item.target_behaviour}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.empirically_grounded && (
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5">
              Evidence
            </span>
          )}
          <span
            className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${
              PRIORITY_COLOURS[item.priority] ?? 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {item.priority}
          </span>
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          {/* COM-B triad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <ComBBlock
              label="C"
              fullLabel="Capability"
              subType={item.capability_type}
              description={item.capability_gap}
              dotLabel="C"
              colourClass="bg-red-50 border-red-200 text-red-900 dark:bg-red-900/15 dark:border-red-800/50 dark:text-red-100"
              subColourClass="bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
            />
            <ComBBlock
              label="M"
              fullLabel="Motivation"
              subType={item.motivation_type}
              description={item.motivation_gap}
              dotLabel="M"
              colourClass="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/15 dark:border-amber-800/50 dark:text-amber-100"
              subColourClass="bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
            />
            <ComBBlock
              label="O"
              fullLabel="Opportunity"
              subType={item.opportunity_type}
              description={item.opportunity_gap}
              dotLabel="O"
              colourClass="bg-green-50 border-green-200 text-green-900 dark:bg-green-900/15 dark:border-green-800/50 dark:text-green-100"
              subColourClass="bg-green-100 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
            />
          </div>

          {/* Action */}
          {item.action && (
            <div className="rounded-lg bg-slate-900 dark:bg-slate-800 px-4 py-3">
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-1">
                Recommended Action
              </p>
              <p className="text-sm text-white leading-relaxed">{item.action}</p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${
                    INTERVENTION_COLOURS[item.intervention_type] ?? 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {item.intervention_type}
                </span>
                {item.supporting_lenses.length > 0 && (
                  <span className="text-[10px] text-slate-400">
                    Also affects: {item.supporting_lenses.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Evidence basis */}
          {item.evidence_basis && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2">
              <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400 mb-0.5">
                Grounded in
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed italic">
                &ldquo;{item.evidence_basis}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LensSection({
  lensData,
  itemOverride,
}: {
  lensData: LensInterventions;
  itemOverride?: BehaviouralIntervention[];
}) {
  const [open, setOpen] = useState(true);
  const items = itemOverride ?? lensData.items;
  const highCount = items.filter((i) => i.priority === 'High').length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          {open
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
          <span className="font-semibold text-base">{lensData.lens}</span>
          <span className="text-xs text-muted-foreground">
            {items.length} intervention{items.length !== 1 ? 's' : ''}
          </span>
          {highCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 text-xs font-medium border border-red-200 dark:border-red-800">
              {highCount} High
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t pt-4">
          {items.map((item, idx) => (
            <InterventionCard key={idx} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function itemMatchesFilter(item: BehaviouralIntervention, filter: string): boolean {
  switch (filter) {
    case 'physical_capability':
      return item.capability_type === 'Physical' || item.capability_type === 'Both';
    case 'psychological_capability':
      return item.capability_type === 'Psychological' || item.capability_type === 'Both';
    case 'reflective_motivation':
      return item.motivation_type === 'Reflective' || item.motivation_type === 'Both';
    case 'automatic_motivation':
      return item.motivation_type === 'Automatic' || item.motivation_type === 'Both';
    case 'social_opportunity':
      return item.opportunity_type === 'Social' || item.opportunity_type === 'Both';
    case 'physical_opportunity':
      return item.opportunity_type === 'Physical' || item.opportunity_type === 'Both';
    default:
      return true;
  }
}

// ── Plain-English COM-B Summary ───────────────────────────────────────────────

const SUBTYPE_PLAIN: Record<string, { headline: string; what: string; action: string; colour: string }> = {
  psychological_capability: {
    headline: 'People lack confidence or mental frameworks to change',
    what: 'Staff understand the change is needed but don\'t feel equipped to think or act differently. This is about belief and self-efficacy, not skills.',
    action: 'Prioritise coaching, safe-to-fail pilots, and visible role models who demonstrate the new way of working.',
    colour: 'border-red-200 bg-red-50 text-red-900',
  },
  physical_capability: {
    headline: 'People lack the practical skills to perform the new behaviour',
    what: 'The change requires doing something people haven\'t done before — they need training or hands-on practice to build the ability.',
    action: 'Invest in structured skills development, job aids at point of need, and supervised practice environments.',
    colour: 'border-orange-200 bg-orange-50 text-orange-900',
  },
  reflective_motivation: {
    headline: 'People aren\'t convinced the change is worth making',
    what: 'Staff are consciously weighing up the change and deciding it\'s not worth the effort, risk, or disruption. Attitudes and goals aren\'t aligned.',
    action: 'Make the "why" compelling and personal. Show evidence of benefit, address fears directly, and involve people in shaping the solution.',
    colour: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  automatic_motivation: {
    headline: 'Ingrained habits are working against the change',
    what: 'The old way of doing things is deeply automatic — people revert without thinking. This is about rewiring default behaviour, not persuasion.',
    action: 'Redesign environments to make the old habit harder and the new habit easier. Use prompts, nudges, and workflow redesign.',
    colour: 'border-yellow-200 bg-yellow-50 text-yellow-900',
  },
  physical_opportunity: {
    headline: 'The systems and environment don\'t support the change',
    what: 'Even motivated people can\'t change if the processes, tools, or structures around them work against the new behaviour.',
    action: 'Fix the environment first — redesign processes, remove friction, and ensure the right resources and tools are in place before asking people to change.',
    colour: 'border-green-200 bg-green-50 text-green-900',
  },
  social_opportunity: {
    headline: 'Culture or peer norms are blocking change',
    what: 'The social environment — what colleagues do, what leadership models, what\'s seen as normal — is pulling people back to old behaviours.',
    action: 'Identify peer champions, make new norms visible and celebrated, and ensure leadership visibly models the change.',
    colour: 'border-teal-200 bg-teal-50 text-teal-900',
  },
};

function ComBPlainEnglishSummary({ interventions }: { interventions: BehaviouralIntervention[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      psychological_capability: 0,
      physical_capability: 0,
      reflective_motivation: 0,
      automatic_motivation: 0,
      social_opportunity: 0,
      physical_opportunity: 0,
    };
    for (const item of interventions) {
      if (item.capability_type === 'Psychological' || item.capability_type === 'Both') c.psychological_capability++;
      if (item.capability_type === 'Physical' || item.capability_type === 'Both') c.physical_capability++;
      if (item.motivation_type === 'Reflective' || item.motivation_type === 'Both') c.reflective_motivation++;
      if (item.motivation_type === 'Automatic' || item.motivation_type === 'Both') c.automatic_motivation++;
      if (item.opportunity_type === 'Social' || item.opportunity_type === 'Both') c.social_opportunity++;
      if (item.opportunity_type === 'Physical' || item.opportunity_type === 'Both') c.physical_opportunity++;
    }
    return c;
  }, [interventions]);

  const total = interventions.length;

  const ranked = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a);

  if (ranked.length === 0) return null;

  const dominant = ranked.slice(0, 3);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-800">What this means in plain English</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          The top behavioural blockers across {total} intervention{total !== 1 ? 's' : ''} — and what to do about them
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {dominant.map(([key, count]) => {
          const info = SUBTYPE_PLAIN[key];
          if (!info) return null;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className="px-5 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{info.headline}</p>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${info.colour}`}>
                  {count} intervention{count !== 1 ? 's' : ''} · {pct}%
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{info.what}</p>
              <div className="flex items-start gap-2 rounded-lg bg-slate-900 px-3 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0 mt-0.5">→ Action</span>
                <p className="text-xs text-white leading-relaxed">{info.action}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BehaviouralInterventionsClient({ workshopId, workshopName, initialData }: Props) {
  const [data, setData] = useState<BehaviouralInterventionsOutput | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/behavioural-interventions`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
      } else {
        setData(body.behaviouralInterventions as BehaviouralInterventionsOutput);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const allInterventions = data?.behavioural_interventions.flatMap((l) => l.items) ?? [];

  const totalInterventions = allInterventions.length;

  const highPriorityCount = allInterventions.filter((i) => i.priority === 'High').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Behavioural Interventions</h1>
          <p className="text-sm text-muted-foreground mt-1">COM-B framework — {workshopName}</p>
        </div>
        {data && (
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Regenerating…' : 'Regenerate'}
          </button>
        )}
      </div>

      {/* COM-B legend */}
      <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3 text-xs">
        <span className="text-muted-foreground font-medium">COM-B</span>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center rounded-full text-[9px] font-bold text-white w-5 h-5 bg-red-500">C</span>
          <span className="text-muted-foreground">Capability <span className="opacity-60">(Physical · Psychological)</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center rounded-full text-[9px] font-bold text-white w-5 h-5 bg-amber-500">M</span>
          <span className="text-muted-foreground">Motivation <span className="opacity-60">(Reflective · Automatic)</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center rounded-full text-[9px] font-bold text-white w-5 h-5 bg-green-500">O</span>
          <span className="text-muted-foreground">Opportunity <span className="opacity-60">(Physical · Social)</span></span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center space-y-4">
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center rounded-full font-bold text-white w-10 h-10 bg-red-500 text-sm">C</span>
            <span className="inline-flex items-center justify-center rounded-full font-bold text-white w-10 h-10 bg-amber-500 text-sm">M</span>
            <span className="inline-flex items-center justify-center rounded-full font-bold text-white w-10 h-10 bg-green-500 text-sm">O</span>
          </div>
          <div>
            <h3 className="font-semibold text-lg">No interventions generated yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Generate COM-B behavioural interventions from your workshop discovery data.
              Requires Output Intelligence to be run first.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            Generate Behavioural Interventions
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
          <p className="text-sm text-muted-foreground">Generating COM-B interventions…</p>
        </div>
      )}

      {/* Summary bar */}
      {data && !loading && (
        <div className="flex items-center gap-6 rounded-lg bg-muted/50 px-5 py-3 text-sm">
          <div>
            <span className="font-semibold">{data.lensesUsed.length}</span>
            <span className="text-muted-foreground ml-1">lenses</span>
          </div>
          <div>
            <span className="font-semibold">{totalInterventions}</span>
            <span className="text-muted-foreground ml-1">interventions</span>
          </div>
          <div>
            <span className="font-semibold text-red-600 dark:text-red-400">{highPriorityCount}</span>
            <span className="text-muted-foreground ml-1">high priority</span>
          </div>
          {data.evidenceGrounded && (
            <div className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              Evidence-grounded
            </div>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            Generated {new Date(data.generatedAtMs).toLocaleString()}
          </div>
        </div>
      )}

      {/* COM-B wheel */}
      {data && !loading && (
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
            COM-B Profile — click a segment to filter interventions
          </h2>
          <ComBWheel
            interventions={allInterventions}
            activeFilter={activeFilter}
            onFilter={setActiveFilter}
          />
        </div>
      )}

      {/* Plain-English summary */}
      {data && !loading && (
        <ComBPlainEnglishSummary interventions={allInterventions} />
      )}

      {/* Lens sections */}
      {data && !loading && (
        <div className="space-y-4">
          {data.behavioural_interventions.map((lensData, idx) => {
            const filteredItems = activeFilter
              ? lensData.items.filter((item) => itemMatchesFilter(item, activeFilter))
              : lensData.items;
            if (filteredItems.length === 0) return null;
            return (
              <LensSection
                key={`${lensData.lens}-${idx}`}
                lensData={lensData}
                itemOverride={activeFilter ? filteredItems : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
