'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import {
  Download,
  Loader2,
  Sparkles,
  RefreshCw,
  X,
  Plus,
  Send,
  Pencil,
  ImagePlus,
} from 'lucide-react';
import type {
  WorkshopOutputIntelligence,
  ReportSummary,
  ReportSectionConfig,
  ReportLayout,
  ReportConclusion,
  ReportNextStep,
  FacilitatorContact,
} from '@/lib/output-intelligence/types';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import type { PromptOutput } from '@/components/scratchpad/ReportPromptOutput';
import { ItemToggle } from '@/components/report-builder/DraggableSection';
import { EditableText } from './ScratchpadEditors';

// ── Discovery Diagnostic block ─────────────────────────────────────────────────

const DIAGNOSTIC_CARDS_CFG = [
  { key: 'operationalReality',         label: 'Operational Reality',         color: 'border-indigo-200 bg-indigo-50'  },
  { key: 'organisationalMisalignment', label: 'Leadership Alignment Risk',   color: 'border-rose-200 bg-rose-50'      },
  { key: 'systemicFriction',           label: 'Systemic Friction',           color: 'border-amber-200 bg-amber-50'    },
  { key: 'transformationReadiness',    label: 'Transformation Readiness',    color: 'border-emerald-200 bg-emerald-50' },
] as const;

export function DiscoveryDiagnosticBlock({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoveryOutput,
  excludedItems = [],
  onToggleItem = () => {},
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoveryOutput: any | null;
  excludedItems?: string[];
  onToggleItem?: (id: string) => void;
}) {
  if (!discoveryOutput) {
    return <p className="text-xs text-muted-foreground py-2">Discovery output not available. Go to Discovery Output and run the Executive Diagnostic.</p>;
  }

  return (
    <div className="space-y-4">
      {discoveryOutput.finalDiscoverySummary && (
        <div className="rounded-xl border border-border bg-muted/20 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Diagnostic Summary</p>
          <p className="text-sm text-foreground leading-relaxed">{discoveryOutput.finalDiscoverySummary}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {DIAGNOSTIC_CARDS_CFG.map(({ key, label, color }) => {
          const card = discoveryOutput[key] as { insight: string; evidence?: string[] } | undefined;
          if (!card?.insight) return null;
          const itemId = `card:${key}`;
          return (
            <ItemToggle key={key} id={itemId} excluded={excludedItems.includes(itemId)} onToggle={onToggleItem}>
              <div className={`rounded-xl border px-4 py-4 ${color}`}>
                <p className="text-[11px] font-semibold uppercase tracking-widest opacity-60 mb-2">{label}</p>
                <p className="text-sm leading-relaxed text-foreground">{card.insight}</p>
                {card.evidence && card.evidence.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {card.evidence.slice(0, 2).map((e, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="shrink-0">·</span>{e}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </ItemToggle>
          );
        })}
      </div>
    </div>
  );
}

// ── Discovery Signals block ────────────────────────────────────────────────────

export function DiscoverySignalsBlock({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoveryOutput,
  excludedItems = [],
  onToggleItem = () => {},
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoveryOutput: any | null;
  excludedItems?: string[];
  onToggleItem?: (id: string) => void;
}) {
  if (!discoveryOutput?.sections?.length) {
    return <p className="text-xs text-muted-foreground py-2">Discovery output not available. Go to Discovery Output to generate signals.</p>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections: any[] = discoveryOutput.sections;

  return (
    <div className="space-y-3">
      {discoveryOutput._aiSummary && (
        <div className="rounded-xl border border-border bg-muted/20 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Perception Summary</p>
          <p className="text-sm text-foreground leading-relaxed">{discoveryOutput._aiSummary}</p>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {sections.map((s, i) => {
            const itemId = `signal:${String(s.domain ?? i).toLowerCase().replace(/\s+/g, '_')}`;
            return (
              <ItemToggle key={i} id={itemId} excluded={excludedItems.includes(itemId)} onToggle={onToggleItem} className="px-5 py-3.5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{s.icon}</span>
                      <span className="text-sm font-medium text-foreground">{s.domain}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Consensus: <span className="font-medium text-foreground">{s.consensusLevel}%</span></span>
                  </div>
                  {/* Sentiment bar */}
                  <div className="h-2 rounded-full overflow-hidden flex gap-0.5">
                    <div className="bg-red-400 h-full rounded-l-full transition-all" style={{ width: `${s.sentiment?.concerned ?? 0}%` }} />
                    <div className="bg-gray-300 h-full transition-all" style={{ width: `${s.sentiment?.neutral ?? 0}%` }} />
                    <div className="bg-emerald-400 h-full rounded-r-full transition-all" style={{ width: `${s.sentiment?.optimistic ?? 0}%` }} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-red-600">Concerned {s.sentiment?.concerned ?? 0}%</span>
                    <span className="text-[10px] text-muted-foreground">Neutral {s.sentiment?.neutral ?? 0}%</span>
                    <span className="text-[10px] text-emerald-600">Optimistic {s.sentiment?.optimistic ?? 0}%</span>
                  </div>
                </div>
              </ItemToggle>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Insight Summary block ─────────────────────────────────────────────────────

export function InsightSummaryBlock({ intelligence }: { intelligence: WorkshopOutputIntelligence }) {
  const { discoveryValidation } = intelligence;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/20 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Insight Map Summary</p>
        <p className="text-sm text-foreground leading-relaxed">{discoveryValidation.summary}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-center">
          <p className="text-xl font-bold text-indigo-700">{discoveryValidation.hypothesisAccuracy}%</p>
          <p className="text-[11px] text-indigo-600 mt-0.5">Hypothesis Accuracy</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
          <p className="text-xl font-bold text-foreground">{discoveryValidation.confirmedIssues.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Confirmed Issues</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
          <p className="text-xl font-bold text-blue-700">{discoveryValidation.newIssues.length}</p>
          <p className="text-[11px] text-blue-600 mt-0.5">New Issues Surfaced</p>
        </div>
      </div>
    </div>
  );
}

// ── Structural Analysis blocks ────────────────────────────────────────────────

export function AlignmentBlock({ discoverAnalysis }: { discoverAnalysis: DiscoverAnalysis | null }) {
  if (!discoverAnalysis?.alignment?.cells?.length) {
    return <p className="text-xs text-muted-foreground py-2">No alignment data available. Generate Structural Analysis from Discovery Output.</p>;
  }
  const { cells } = discoverAnalysis.alignment;
  const divergent = [...cells].sort((a, b) => a.alignmentScore - b.alignmentScore).slice(0, 10);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Top divergent actor × theme pairs (negative = misalignment)</p>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Theme</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Actor</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {divergent.map((cell, i) => {
              const score = cell.alignmentScore;
              const color = score < -0.5 ? 'text-red-600' : score < 0 ? 'text-amber-600' : 'text-emerald-600';
              return (
                <tr key={i}>
                  <td className="px-4 py-2 text-foreground truncate max-w-[160px]">{cell.theme}</td>
                  <td className="px-4 py-2 text-muted-foreground">{cell.actor}</td>
                  <td className={`px-4 py-2 font-semibold text-right ${color}`}>{score.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NarrativeDivergenceBlock({ discoverAnalysis }: { discoverAnalysis: DiscoverAnalysis | null }) {
  if (!discoverAnalysis?.narrative?.layers?.length) {
    return <p className="text-xs text-muted-foreground py-2">No narrative data available. Generate Structural Analysis from Discovery Output.</p>;
  }
  const { layers } = discoverAnalysis.narrative;
  const LAYER_COLORS: Record<string, string> = {
    executive:   'border-violet-200 bg-violet-50',
    operational: 'border-blue-200 bg-blue-50',
    frontline:   'border-emerald-200 bg-emerald-50',
  };
  const SENT_COLORS: Record<string, string> = {
    positive: 'text-emerald-700',
    negative: 'text-red-700',
    neutral:  'text-muted-foreground',
    mixed:    'text-amber-700',
  };
  return (
    <div className="grid grid-cols-3 gap-3">
      {layers.map((layer) => (
        <div key={layer.layer} className={`rounded-xl border px-4 py-3.5 ${LAYER_COLORS[layer.layer] ?? 'border-border bg-muted/20'}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1 capitalize">{layer.layer}</p>
          <p className={`text-[11px] font-medium mb-2 ${SENT_COLORS[layer.dominantSentiment] ?? ''}`}>
            {layer.dominantSentiment}
          </p>
          <ul className="space-y-0.5">
            {(layer.topTerms ?? []).slice(0, 5).map((t) => (
              <li key={t.term} className="text-[11px] text-foreground flex items-center gap-1.5">
                <span className="shrink-0 w-12 bg-muted-foreground/20 rounded-full h-1.5 overflow-hidden">
                  <span className="block h-full bg-primary/50 rounded-full" style={{ width: `${t.normalised * 100}%` }} />
                </span>
                {t.term}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function TensionsBlock({ discoverAnalysis }: { discoverAnalysis: DiscoverAnalysis | null }) {
  if (!discoverAnalysis?.tensions?.tensions?.length) {
    return <p className="text-xs text-muted-foreground py-2">No tension data available. Generate Structural Analysis from Discovery Output.</p>;
  }
  const { tensions } = discoverAnalysis.tensions;
  const SEV_STYLE: Record<string, string> = {
    critical:    'bg-red-100 text-red-700 border-red-200',
    significant: 'bg-amber-100 text-amber-700 border-amber-200',
    moderate:    'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <div className="space-y-2">
      {tensions.slice(0, 8).map((t, i) => (
        <div key={t.id} className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="shrink-0 text-[11px] font-bold text-muted-foreground/50 mt-0.5">#{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-foreground">{t.topic}</p>
                <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${SEV_STYLE[t.severity] ?? SEV_STYLE.moderate}`}>
                  {t.severity}
                </span>
              </div>
              {(t.viewpoints ?? []).slice(0, 2).map((vp, j) => (
                <p key={j} className="text-xs text-muted-foreground truncate">
                  <span className="font-medium text-foreground/70">{vp.actor}</span> — {vp.position}
                </p>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StructuralBarriersBlock({ discoverAnalysis }: { discoverAnalysis: DiscoverAnalysis | null }) {
  if (!discoverAnalysis?.constraints?.constraints?.length) {
    return <p className="text-xs text-muted-foreground py-2">No constraint data available. Generate Structural Analysis from Discovery Output.</p>;
  }
  const { constraints } = discoverAnalysis.constraints;
  const sorted = [...constraints].sort((a, b) => b.weight - a.weight).slice(0, 10);
  const SEV_STYLE: Record<string, string> = {
    critical:    'bg-red-100 text-red-700',
    significant: 'bg-amber-100 text-amber-700',
    moderate:    'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Barrier</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Domain</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Severity</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Weight</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((c, i) => (
            <tr key={i}>
              <td className="px-4 py-2 text-foreground max-w-[200px]">{c.description.split(' ').slice(0, 8).join(' ')}{c.description.split(' ').length > 8 ? '…' : ''}</td>
              <td className="px-4 py-2 text-muted-foreground">{c.domain}</td>
              <td className="px-4 py-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${SEV_STYLE[c.severity] ?? SEV_STYLE.moderate}`}>{c.severity}</span>
              </td>
              <td className="px-4 py-2 text-right font-medium text-foreground">{c.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Report Conclusion block ───────────────────────────────────────────────────

export function ReportConclusionBlock({
  workshopId,
  conclusion,
  onUpdate,
}: {
  workshopId: string;
  conclusion: ReportConclusion | null | undefined;
  onUpdate: (c: ReportConclusion) => void;
}) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/report-conclusion`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' })) as { error?: string };
        throw new Error(err.error ?? 'Generation failed');
      }
      const data = await res.json() as { conclusion: ReportConclusion };
      onUpdate(data.conclusion);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate conclusion');
    } finally {
      setGenerating(false);
    }
  };

  const updateStep = (id: string, patch: Partial<ReportNextStep>) => {
    if (!conclusion) return;
    onUpdate({
      ...conclusion,
      nextSteps: conclusion.nextSteps.map(s => s.id === id ? { ...s, ...patch } : s),
    });
  };

  const removeStep = (id: string) => {
    if (!conclusion) return;
    onUpdate({ ...conclusion, nextSteps: conclusion.nextSteps.filter(s => s.id !== id) });
  };

  const addStep = () => {
    if (!conclusion) return;
    onUpdate({
      ...conclusion,
      nextSteps: [...conclusion.nextSteps, { id: nanoid(8), title: 'New Step', description: '' }],
    });
  };

  if (!conclusion) {
    return (
      <div className="px-5 py-6 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          Generate an AI-powered summary and recommended next steps for the end of your report.
        </p>
        <Button
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="gap-2"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? 'Generating…' : 'Generate Conclusion'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">
      {/* Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Conclusion
          </p>
          <button
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {generating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
        <EditableText
          value={conclusion.summary}
          onSave={(v) => onUpdate({ ...conclusion, summary: v })}
          multiline
          className="text-sm text-foreground leading-relaxed"
        />
      </div>

      {/* Next Steps */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Recommended Next Steps
        </p>
        <div className="space-y-2">
          {conclusion.nextSteps.map((step, i) => (
            <div key={step.id} className="group/step flex items-start gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <EditableText
                  value={step.title}
                  onSave={(v) => updateStep(step.id, { title: v })}
                  className="text-sm font-semibold text-foreground"
                  placeholder="Step title"
                />
                <EditableText
                  value={step.description}
                  onSave={(v) => updateStep(step.id, { description: v })}
                  multiline
                  className="text-xs text-muted-foreground leading-relaxed"
                  placeholder="Step description"
                />
              </div>
              <button
                onClick={() => removeStep(step.id)}
                className="shrink-0 opacity-0 group-hover/step:opacity-100 p-1 text-muted-foreground/40 hover:text-red-500 transition-all"
                title="Remove step"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addStep}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add step
        </button>
      </div>
    </div>
  );
}

// ── Journey Download Bar ──────────────────────────────────────────────────────

export function JourneyDownloadBar({ workshopId }: { workshopId: string }) {
  const [downloading, setDownloading] = useState<'pdf' | 'png' | null>(null);

  const download = async (format: 'pdf' | 'png') => {
    setDownloading(format);
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/export-journey?format=${format}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `journey-map.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Journey export failed:', err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 pb-3">
      <span className="text-xs text-muted-foreground mr-1">Download:</span>
      {(['pdf', 'png'] as const).map((fmt) => (
        <Button
          key={fmt}
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => download(fmt)}
          disabled={!!downloading}
        >
          {downloading === fmt ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          {fmt.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}

// ── Journey Intro Block ───────────────────────────────────────────────────────

export function JourneyIntroBlock({
  workshopId,
  journey,
  value,
  onChange,
  disabled,
}: {
  workshopId: string;
  journey: LiveJourneyData;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const res = await fetch(`/api/admin/workshops/${workshopId}/journey/intro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journey }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json() as { intro: string };
      setDraft(data.intro);
      onChange(data.intro);
      setEditing(false);
    } catch {
      // silent
    } finally {
      setGenerating(false);
    }
  };

  if (!value && !editing) {
    return (
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={generating || disabled}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg px-3 py-2 transition-colors disabled:opacity-50 w-full justify-center"
        >
          {generating
            ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating intro…</>
            : <><Sparkles className="h-3 w-3" /> Generate journey introduction</>
          }
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 group relative">
      {editing ? (
        <div className="space-y-2">
          <textarea
            className="w-full text-sm text-muted-foreground leading-relaxed rounded-lg border border-border bg-muted/30 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            rows={3}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Regenerate
            </button>
            <button
              onClick={() => { onChange(draft); setEditing(false); }}
              className="text-xs px-2 py-1 rounded bg-foreground text-background hover:opacity-80 transition-opacity"
            >
              Save
            </button>
            <button
              onClick={() => { setDraft(value); setEditing(false); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          className="text-sm text-muted-foreground leading-relaxed cursor-pointer hover:text-foreground/80 transition-colors"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {value}
          <Pencil className="inline-block ml-1.5 h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
        </div>
      )}
    </div>
  );
}

// ── Custom Section Editor ─────────────────────────────────────────────────────

export function CustomSectionEditor({
  section,
  workshopId,
  onUpdate,
}: {
  section: ReportSectionConfig;
  workshopId: string;
  onUpdate: (patch: Partial<ReportSectionConfig>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`/api/admin/workshops/${workshopId}/upload-section-image`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json() as { url: string };
      onUpdate({ customContent: { ...section.customContent, imageUrl: data.url } });
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Section title */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
          Section Title
        </p>
        <input
          className="w-full text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary pb-0.5 text-foreground"
          value={section.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Section title…"
        />
      </div>

      {/* Text content */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
          Content
        </p>
        <textarea
          className="w-full text-sm bg-muted/20 border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
          rows={4}
          value={section.customContent?.text ?? ''}
          onChange={(e) => onUpdate({ customContent: { ...section.customContent, text: e.target.value } })}
          placeholder="Add text content for this section…"
        />
      </div>

      {/* Image upload */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
          Image
        </p>
        {section.customContent?.imageUrl ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={section.customContent.imageUrl}
              alt={section.customContent.imageAlt ?? ''}
              className="max-w-full rounded-lg border border-border"
            />
            <div className="flex items-center gap-2">
              <input
                className="flex-1 text-xs bg-transparent border-b border-border focus:outline-none focus:border-primary pb-0.5 text-foreground"
                value={section.customContent?.imageAlt ?? ''}
                onChange={(e) => onUpdate({ customContent: { ...section.customContent, imageAlt: e.target.value } })}
                placeholder="Image caption / alt text…"
              />
              <button
                onClick={() => onUpdate({ customContent: { ...section.customContent, imageUrl: '', imageAlt: '' } })}
                className="text-xs text-muted-foreground hover:text-red-500 transition-colors shrink-0"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg px-3 py-2.5 transition-colors disabled:opacity-50 w-full justify-center"
          >
            {uploading ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
            ) : (
              <><ImagePlus className="h-3 w-3" /> Upload image</>
            )}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageUpload(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

// ── Agentic Prompt Bar ────────────────────────────────────────────────────────

export function AgenticPromptBar({
  workshopId,
  layout,
  onOutput,
}: {
  workshopId: string;
  layout: ReportLayout;
  onOutput: (output: PromptOutput) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const STATIC_SUGGESTIONS = [
    'Bar chart of root causes by severity',
    'Table comparing current vs future state by lens',
    'Summarise the key constraints found in workshop',
    'List the top efficiency gains with estimated impact',
  ];

  const handleSuggest = async () => {
    setFetchingSuggestions(true);
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/report-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { suggestions?: string[] };
      setAiSuggestions(data.suggestions ?? []);
    } catch {
      toast.error('Could not fetch suggestions — try again');
    } finally {
      setFetchingSuggestions(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || generating) return;

    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/report-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' })) as { error?: string };
        throw new Error(err.error ?? 'Request failed');
      }

      const data = await res.json() as { output: PromptOutput };
      onOutput(data.output);
      setPrompt('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate output');
    } finally {
      setGenerating(false);
    }
  };

  const visibleSuggestions = aiSuggestions.length > 0 ? aiSuggestions : STATIC_SUGGESTIONS;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Additional Analysis</p>
          <span className="text-xs text-muted-foreground flex-1">
            Ask for charts, tables, or deeper dives
          </span>
          <button
            onClick={() => void handleSuggest()}
            disabled={fetchingSuggestions}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
          >
            {fetchingSuggestions ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {fetchingSuggestions ? 'Analysing…' : 'Suggest additions'}
          </button>
          {aiSuggestions.length > 0 && (
            <button
              onClick={() => setAiSuggestions([])}
              className="p-1 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              title="Clear AI suggestions"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions */}
      <div className="px-5 pt-3 pb-2 flex flex-wrap gap-1.5">
        {visibleSuggestions.map((s) => (
          <button
            key={s}
            onClick={() => {
              setPrompt(s);
              setTimeout(() => textareaRef.current?.focus(), 50);
            }}
            className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
              aiSuggestions.length > 0
                ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
                : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-5 pb-4 flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="Ask for additional output — e.g. 'Bar chart of root causes by severity'"
          className="flex-1 min-h-[60px] max-h-[120px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          disabled={generating}
        />
        <Button
          onClick={() => void handleSubmit()}
          disabled={!prompt.trim() || generating}
          size="sm"
          className="h-10 px-4 gap-2 shrink-0"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {generating ? 'Generating…' : 'Generate'}
        </Button>
      </div>
    </div>
  );
}

// ── Generate Report Summary CTA ───────────────────────────────────────────────

export function GenerateSummaryCta({
  workshopId,
  onComplete,
}: {
  workshopId: string;
  onComplete: (summary: ReportSummary) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    setStatusMsg('Starting…');

    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/report-summary`, {
        method: 'POST',
      });

      if (!res.ok || !res.body) {
        throw new Error('Failed to start generation');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const eventBlocks = buffer.split('\n\n');
        buffer = eventBlocks.pop() ?? '';

        for (const block of eventBlocks) {
          const lines = block.split('\n');
          let eventType = '';
          let dataLine = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: ')) dataLine = line.slice(6).trim();
          }
          if (!dataLine) continue;

          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(dataLine) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (eventType === 'status') {
            setStatusMsg((payload.message as string) ?? '');
          } else if (eventType === 'complete') {
            onComplete(payload.reportSummary as ReportSummary);
            toast.success('Report summary generated');
            return;
          } else if (eventType === 'error') {
            throw new Error((payload.message as string) ?? 'Generation failed');
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
      setStatusMsg('');
    }
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-6 py-5 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Generate Executive Summary &amp; Solution Direction
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Agentic analysis reads all existing intelligence and writes the two client-facing sections.
        </p>
        {statusMsg && (
          <p className="text-xs text-primary mt-1 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {statusMsg}
          </p>
        )}
      </div>
      <Button
        onClick={handleGenerate}
        disabled={generating}
        className="gap-2 shrink-0"
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {generating ? 'Generating…' : 'Generate Report Summary'}
      </Button>
    </div>
  );
}

// ── Structural Confidence Block ───────────────────────────────────────────────

export function StructuralConfidenceBlock({ data }: { data: DiscoverAnalysis }) {
  const { overall, byDomain } = data.confidence;
  const total = overall.certain + overall.hedging + overall.uncertain;
  const certainPct = total > 0 ? Math.round((overall.certain / total) * 100) : 0;
  const hedgingPct = total > 0 ? Math.round((overall.hedging / total) * 100) : 0;
  const uncertainPct = 100 - certainPct - hedgingPct;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Overall Confidence</p>
        <div className="flex h-3 rounded-full overflow-hidden">
          <div className="bg-slate-700" style={{ width: `${certainPct}%` }} />
          <div className="bg-amber-400" style={{ width: `${hedgingPct}%` }} />
          <div className="bg-red-400" style={{ width: `${uncertainPct}%` }} />
        </div>
        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
          <span>{certainPct}% certain</span>
          <span>{hedgingPct}% hedging</span>
          <span>{uncertainPct}% uncertain</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">By Domain</p>
        <div className="space-y-1">
          {byDomain.slice(0, 6).map(d => {
            const dt = d.distribution.certain + d.distribution.hedging + d.distribution.uncertain;
            const cp = dt > 0 ? Math.round((d.distribution.certain / dt) * 100) : 0;
            const hp = dt > 0 ? Math.round((d.distribution.hedging / dt) * 100) : 0;
            const up = 100 - cp - hp;
            return (
              <div key={d.domain} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-36 truncate capitalize">{d.domain}</span>
                <div className="flex flex-1 h-2 rounded overflow-hidden">
                  <div className="bg-slate-700" style={{ width: `${cp}%` }} />
                  <div className="bg-amber-400" style={{ width: `${hp}%` }} />
                  <div className="bg-red-400" style={{ width: `${up}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Signal Map Block ──────────────────────────────────────────────────────────

export function SignalMapBlock({ imageUrl }: { imageUrl: string | null; workshopId: string; onImageCaptured: (url: string) => void }) {
  return (
    <div className="space-y-3">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Discovery Signal Map" className="w-full rounded-lg border" />
      ) : (
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">No signal map captured yet. Open the Organisational State tab and the map will be captured when you add it to the report.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>● Aspiration</span><span>● Enablers</span><span>● Friction</span><span>● Constraint</span>
      </div>
    </div>
  );
}

// ── Facilitator Contact Block ─────────────────────────────────────────────────

export function FacilitatorContactBlock({ contact, onChange }: { contact: FacilitatorContact | null; onChange: (c: FacilitatorContact) => void }) {
  const [local, setLocal] = useState<FacilitatorContact>(contact ?? { name: '', email: '', phone: '', companyName: '' });
  const update = (field: keyof FacilitatorContact, value: string) => {
    const updated = { ...local, [field]: value };
    setLocal(updated);
    onChange(updated);
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">This appears as the final back page of the report.</p>
      {(['name', 'email', 'phone', 'companyName'] as const).map(field => (
        <div key={field}>
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground block mb-1">
            {field === 'companyName' ? 'Company Name' : field.charAt(0).toUpperCase() + field.slice(1)}
          </label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={local[field] ?? ''}
            onChange={e => update(field, e.target.value)}
            placeholder={field === 'name' ? 'Facilitator Name' : field === 'email' ? 'email@example.com' : field === 'phone' ? '+44 7000 000000' : 'Your Company'}
          />
        </div>
      ))}
    </div>
  );
}
