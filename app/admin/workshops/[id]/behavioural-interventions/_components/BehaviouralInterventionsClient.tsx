'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Circle, RefreshCw, Zap } from 'lucide-react';
import type {
  BehaviouralInterventionsOutput,
  BehaviouralIntervention,
  LensInterventions,
} from '@/lib/behavioural-interventions/types';

interface Props {
  workshopId: string;
  workshopName: string;
  initialData: BehaviouralInterventionsOutput | null;
}

const PRIORITY_COLOURS: Record<string, string> = {
  High: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const INTERVENTION_COLOURS: Record<string, string> = {
  Training: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Environmental Restructuring': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Incentivisation: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Enablement: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  Persuasion: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  Modelling: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

function InterventionCard({ item }: { item: BehaviouralIntervention }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-sm text-foreground leading-snug flex-1">
          {item.target_behaviour}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.empirically_grounded ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400" title="Grounded in evidence cross-validation">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Evidence
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Derived from workshop signals">
              <Circle className="h-3.5 w-3.5" />
              Signal
            </span>
          )}
        </div>
      </div>

      {/* COM-B gaps */}
      <div className="space-y-2">
        {item.capability_gap && (
          <div className="flex gap-2 text-xs">
            <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0 w-24">Capability</span>
            <span className="text-muted-foreground">{item.capability_gap}</span>
          </div>
        )}
        {item.opportunity_gap && (
          <div className="flex gap-2 text-xs">
            <span className="font-semibold text-purple-600 dark:text-purple-400 shrink-0 w-24">Opportunity</span>
            <span className="text-muted-foreground">{item.opportunity_gap}</span>
          </div>
        )}
        {item.motivation_gap && (
          <div className="flex gap-2 text-xs">
            <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0 w-24">Motivation</span>
            <span className="text-muted-foreground">{item.motivation_gap}</span>
          </div>
        )}
      </div>

      {/* Action */}
      {item.action && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs font-medium text-foreground border-l-2 border-purple-400">
          <span className="text-muted-foreground font-normal mr-1">Action:</span>
          {item.action}
        </div>
      )}

      {/* Footer badges */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            PRIORITY_COLOURS[item.priority] ?? 'bg-muted text-muted-foreground'
          }`}
        >
          {item.priority}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            INTERVENTION_COLOURS[item.intervention_type] ?? 'bg-muted text-muted-foreground'
          }`}
        >
          {item.intervention_type}
        </span>
        {item.supporting_lenses.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Also affects: {item.supporting_lenses.join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}

function LensSection({ lensData }: { lensData: LensInterventions }) {
  const [open, setOpen] = useState(true);
  const highCount = lensData.items.filter((i) => i.priority === 'High').length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-base">{lensData.lens}</span>
          <span className="text-xs text-muted-foreground">
            {lensData.items.length} intervention{lensData.items.length !== 1 ? 's' : ''}
          </span>
          {highCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 text-xs font-medium">
              {highCount} High priority
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t pt-4">
          {lensData.items.map((item, idx) => (
            <InterventionCard key={idx} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BehaviouralInterventionsClient({ workshopId, workshopName, initialData }: Props) {
  const [data, setData] = useState<BehaviouralInterventionsOutput | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const totalInterventions = data?.behavioural_interventions.reduce(
    (sum, l) => sum + l.items.length,
    0
  ) ?? 0;

  const highPriorityCount = data?.behavioural_interventions.reduce(
    (sum, l) => sum + l.items.filter((i) => i.priority === 'High').length,
    0
  ) ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Behavioural Interventions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            COM-B framework — {workshopName}
          </p>
        </div>
        {data ? (
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Regenerating…' : 'Regenerate'}
          </button>
        ) : null}
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
          <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-4">
            <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400" />
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

      {/* Loading spinner */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
          <p className="text-sm text-muted-foreground">Generating COM-B interventions…</p>
        </div>
      )}

      {/* Data summary bar */}
      {data && !loading && (
        <div className="flex items-center gap-6 rounded-lg bg-muted/50 px-5 py-3 text-sm">
          <div>
            <span className="font-semibold">{data.lensesUsed.length}</span>
            <span className="text-muted-foreground ml-1">lenses</span>
          </div>
          <div>
            <span className="font-semibold">{totalInterventions}</span>
            <span className="text-muted-foreground ml-1">total interventions</span>
          </div>
          <div>
            <span className="font-semibold text-red-600 dark:text-red-400">{highPriorityCount}</span>
            <span className="text-muted-foreground ml-1">high priority</span>
          </div>
          {data.evidenceGrounded && (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Evidence-grounded</span>
            </div>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            Generated {new Date(data.generatedAtMs).toLocaleString()}
          </div>
        </div>
      )}

      {/* Lens sections */}
      {data && !loading && (
        <div className="space-y-4">
          {data.behavioural_interventions.map((lensData, idx) => (
            <LensSection key={`${lensData.lens}-${idx}`} lensData={lensData} />
          ))}
        </div>
      )}
    </div>
  );
}
