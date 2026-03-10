'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Download,
  Loader2,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Send,
  RefreshCw,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { WorkshopOutputIntelligence } from '@/lib/output-intelligence/types';
import type { ReportSummary } from '@/lib/output-intelligence/types';
import type { StoredOutputIntelligence } from '@/lib/output-intelligence/types';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import LiveJourneyMap from '@/components/cognitive-guidance/live-journey-map';
import { ReportPromptOutput } from '@/components/scratchpad/ReportPromptOutput';
import type { PromptOutput } from '@/components/scratchpad/ReportPromptOutput';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Workshop {
  id: string;
  name: string;
  organization?: { name: string } | null;
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({
  label,
  sublabel,
}: {
  label: string;
  sublabel?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-2">
          {label}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      {sublabel && (
        <p className="text-xs text-muted-foreground text-center mt-1">{sublabel}</p>
      )}
    </div>
  );
}

// ── Inline field editor ───────────────────────────────────────────────────────

function EditableText({
  value,
  onSave,
  multiline = false,
  className,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          className={`w-full bg-transparent rounded-sm px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none border border-primary/20 leading-relaxed ${className ?? ''}`}
          value={draft}
          rows={Math.max(3, (draft.match(/\n/g) ?? []).length + 2)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
          }}
          autoFocus
        />
      );
    }
    return (
      <input
        className={`w-full bg-transparent border-b border-primary/40 focus:outline-none focus:border-primary pb-0.5 ${className ?? ''}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        autoFocus
      />
    );
  }

  return (
    <div
      className={`group/editable relative cursor-text rounded-sm hover:bg-primary/[0.04] transition-colors -mx-1 px-1 ${className ?? ''}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground/40 italic text-xs">{placeholder ?? 'Click to add'}</span>}
      <Pencil className="absolute right-0 top-0.5 h-3 w-3 text-primary/25 opacity-0 group-hover/editable:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}

// ── Inline list item adder ────────────────────────────────────────────────────

function AddItemInput({
  onAdd,
  placeholder,
}: {
  onAdd: (text: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setValue('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-2 py-1"
      >
        <Plus className="h-3 w-3" />
        Add item
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        className="flex-1 bg-transparent border-b border-primary/40 text-sm focus:outline-none focus:border-primary pb-0.5"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setValue(''); setOpen(false); }
        }}
        placeholder={placeholder ?? 'Type and press Enter to add'}
        autoFocus
      />
      <button onClick={commit} className="text-xs text-primary font-medium shrink-0">Add</button>
      <button onClick={() => { setValue(''); setOpen(false); }} className="text-xs text-muted-foreground shrink-0">Cancel</button>
    </div>
  );
}

// ── Executive Summary block ───────────────────────────────────────────────────

function ExecutiveSummaryBlock({
  summary,
  onUpdate,
}: {
  summary: ReportSummary;
  onUpdate: (updated: ReportSummary) => void;
}) {
  const es = summary.executiveSummary;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">

      {/* The Ask */}
      <div className="px-6 py-5 border-b border-border bg-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              The Question Asked
            </p>
            <EditableText
              value={es.theAsk}
              onSave={(v) => onUpdate({ ...summary, executiveSummary: { ...es, theAsk: v } })}
              className="text-base text-foreground leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* The Answer — prominent */}
      <div className="px-6 py-6 bg-primary/5 border-b border-primary/20">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/70 mb-2">
          The Answer
        </p>
        <EditableText
          value={es.theAnswer}
          onSave={(v) => onUpdate({ ...summary, executiveSummary: { ...es, theAnswer: v } })}
          className="text-xl font-bold text-foreground leading-snug"
        />
      </div>

      {/* Body */}
      <div className="px-6 py-6 space-y-7">

        {/* What We Found — numbered findings */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            What We Found
          </p>
          <ul className="space-y-3">
            {es.whatWeFound.map((finding, i) => (
              <li key={i} className="flex items-start gap-3 group/item">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary mt-0.5">
                  {i + 1}
                </span>
                <EditableText
                  value={finding}
                  onSave={(v) => {
                    const updated = es.whatWeFound.map((f, j) => j === i ? v : f);
                    onUpdate({ ...summary, executiveSummary: { ...es, whatWeFound: updated } });
                  }}
                  className="flex-1 text-sm text-foreground leading-relaxed"
                />
                <button
                  onClick={() => {
                    const updated = es.whatWeFound.filter((_, j) => j !== i);
                    onUpdate({ ...summary, executiveSummary: { ...es, whatWeFound: updated } });
                  }}
                  className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-red-500 shrink-0 transition-all mt-0.5"
                  title="Remove finding"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <AddItemInput
            onAdd={(text) => onUpdate({ ...summary, executiveSummary: { ...es, whatWeFound: [...es.whatWeFound, text] } })}
            placeholder="Add a finding — name a system, metric, or process"
          />
        </div>

        {/* Per-Lens Findings */}
        {es.lensFindings && es.lensFindings.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Findings by Lens
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {es.lensFindings.map((lf, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    {lf.lens}
                  </p>
                  <EditableText
                    value={lf.finding}
                    onSave={(v) => {
                      const updated = es.lensFindings.map((f, j) => j === i ? { ...f, finding: v } : f);
                      onUpdate({ ...summary, executiveSummary: { ...es, lensFindings: updated } });
                    }}
                    multiline
                    className="text-sm text-foreground leading-relaxed"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Why It Matters + Opportunity / Risk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Why It Matters
            </p>
            <EditableText
              value={es.whyItMatters}
              onSave={(v) => onUpdate({ ...summary, executiveSummary: { ...es, whyItMatters: v } })}
              multiline
              className="text-sm text-foreground leading-relaxed"
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700">
              Opportunity / Risk
            </p>
            <EditableText
              value={es.opportunityOrRisk}
              onSave={(v) => onUpdate({ ...summary, executiveSummary: { ...es, opportunityOrRisk: v } })}
              multiline
              className="text-sm text-amber-900 leading-relaxed"
            />
          </div>
        </div>

        {/* Urgency */}
        <div className="rounded-xl border border-border bg-muted/10 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              Why Act Now
            </p>
            <EditableText
              value={es.urgency}
              onSave={(v) => onUpdate({ ...summary, executiveSummary: { ...es, urgency: v } })}
              multiline
              className="text-sm text-foreground leading-relaxed"
            />
          </div>
        </div>

        {/* Bridge to Solution */}
        {es.nextStepsPreview && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-start gap-3">
            <ChevronDown className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <EditableText
              value={es.nextStepsPreview}
              onSave={(v) => onUpdate({ ...summary, executiveSummary: { ...es, nextStepsPreview: v } })}
              className="flex-1 text-sm text-foreground leading-relaxed"
            />
          </div>
        )}

        {/* Validation gaps — admin-only diagnostic, shown in page header not here */}
      </div>
    </div>
  );
}

// ── Supporting Evidence block ─────────────────────────────────────────────────

function SupportingEvidenceBlock({ intelligence }: { intelligence: WorkshopOutputIntelligence }) {
  const [showNew, setShowNew] = useState(false);
  const { discoveryValidation } = intelligence;

  return (
    <div className="space-y-4">
      {/* Confirmed Issues */}
      {discoveryValidation.confirmedIssues.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Confirmed Issues</p>
            <span className="text-[10px] font-medium text-muted-foreground">
              Hypothesis accuracy: {discoveryValidation.hypothesisAccuracy}%
            </span>
          </div>
          <div className="divide-y divide-border">
            {discoveryValidation.confirmedIssues.map((ci, i) => (
              <div key={i} className="px-5 py-3.5 flex items-start gap-3">
                <span
                  className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                    ci.confidence === 'high'
                      ? 'bg-red-100 text-red-700'
                      : ci.confidence === 'medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {ci.confidence}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{ci.issue}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ci.workshopEvidence}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Issues */}
      {discoveryValidation.newIssues.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-card overflow-hidden">
          <button
            onClick={() => setShowNew((v) => !v)}
            className="w-full px-5 py-3.5 border-b border-blue-200 bg-blue-50 flex items-center justify-between hover:bg-blue-100/60 transition-colors"
          >
            <p className="text-xs font-semibold text-blue-800">
              New Issues — Surfaced in Workshop
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px]">
                {discoveryValidation.newIssues.length}
              </span>
            </p>
            {showNew ? (
              <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
            )}
          </button>
          {showNew && (
            <div className="divide-y divide-blue-100">
              {discoveryValidation.newIssues.map((ni, i) => (
                <div key={i} className="px-5 py-3.5">
                  <p className="text-sm font-medium text-foreground">{ni.issue}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ni.workshopEvidence}</p>
                  <p className="text-xs text-blue-700 mt-1 font-medium">→ {ni.significance}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Root Causes block ─────────────────────────────────────────────────────────

function RootCausesBlock({ intelligence }: { intelligence: WorkshopOutputIntelligence }) {
  const { rootCause } = intelligence;
  const severityColor: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    significant: 'bg-amber-100 text-amber-700 border-amber-200',
    moderate: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <div className="space-y-4">
      {/* Systemic pattern banner */}
      <div className="rounded-xl border border-border bg-muted/20 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
          Systemic Pattern
        </p>
        <p className="text-sm text-foreground leading-relaxed">{rootCause.systemicPattern}</p>
      </div>

      {/* Cause cards */}
      <div className="grid gap-3">
        {rootCause.rootCauses.map((rc) => (
          <div
            key={rc.rank}
            className="rounded-xl border border-border bg-card px-5 py-4 flex items-start gap-4"
          >
            <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
              <span className="text-xs font-bold text-muted-foreground font-mono">#{rc.rank}</span>
              <span
                className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                  severityColor[rc.severity] ?? severityColor.moderate
                }`}
              >
                {rc.severity}
              </span>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-sm font-semibold text-foreground">{rc.cause}</p>
              <p className="text-xs text-muted-foreground">{rc.category}</p>
              {rc.evidence.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {rc.evidence.slice(0, 2).map((e, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5">·</span>
                      {e}
                    </li>
                  ))}
                </ul>
              )}
              {rc.affectedLenses.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {rc.affectedLenses.map((l) => (
                    <span key={l} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                      {l}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Solution Direction block ──────────────────────────────────────────────────

const PHASE_COLORS = [
  { bg: 'bg-primary/5', border: 'border-primary/20', num: 'bg-primary text-primary-foreground', label: 'text-primary' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', num: 'bg-emerald-600 text-white', label: 'text-emerald-700' },
  { bg: 'bg-violet-50', border: 'border-violet-200', num: 'bg-violet-600 text-white', label: 'text-violet-700' },
];

function SolutionDirectionBlock({
  summary,
  intelligence,
  onUpdate,
}: {
  summary: ReportSummary;
  intelligence: WorkshopOutputIntelligence;
  onUpdate: (updated: ReportSummary) => void;
}) {
  const ss = summary.solutionSummary;
  const { roadmap, futureState } = intelligence;

  return (
    <div className="space-y-6">

      {/* Direction headline card */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 mb-2">
          Transformation Direction
        </p>
        <EditableText
          value={ss.direction}
          onSave={(v) => onUpdate({ ...summary, solutionSummary: { ...ss, direction: v } })}
          className="text-xl font-bold text-emerald-900 leading-snug"
        />
      </div>

      {/* Rationale */}
      <div className="rounded-xl border border-border bg-card px-5 py-5 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          The Rationale
        </p>
        <EditableText
          value={ss.rationale}
          onSave={(v) => onUpdate({ ...summary, solutionSummary: { ...ss, rationale: v } })}
          multiline
          className="text-sm text-foreground leading-relaxed"
        />
      </div>

      {/* What Must Change */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          What Must Change
        </p>
        <div className="space-y-3">
          {ss.whatMustChange.map((item, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <EditableText
                value={item.area}
                onSave={(v) => {
                  const updated = ss.whatMustChange.map((x, j) => j === i ? { ...x, area: v } : x);
                  onUpdate({ ...summary, solutionSummary: { ...ss, whatMustChange: updated } });
                }}
                className="text-xs font-bold text-foreground mb-2.5"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2.5">
                <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 mb-1">
                    Today's Reality
                  </p>
                  <EditableText
                    value={item.currentState}
                    onSave={(v) => {
                      const updated = ss.whatMustChange.map((x, j) => j === i ? { ...x, currentState: v } : x);
                      onUpdate({ ...summary, solutionSummary: { ...ss, whatMustChange: updated } });
                    }}
                    multiline
                    className="text-xs text-red-900 leading-relaxed"
                  />
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 mb-1">
                    Required Change
                  </p>
                  <EditableText
                    value={item.requiredChange}
                    onSave={(v) => {
                      const updated = ss.whatMustChange.map((x, j) => j === i ? { ...x, requiredChange: v } : x);
                      onUpdate({ ...summary, solutionSummary: { ...ss, whatMustChange: updated } });
                    }}
                    multiline
                    className="text-xs text-emerald-900 leading-relaxed"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Target Operating Model (from existing futureState intelligence) */}
      {futureState.targetOperatingModel && (
        <div className="rounded-xl border border-border bg-card px-5 py-5 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Target Operating Model
          </p>
          <p className="text-sm text-foreground leading-relaxed">{futureState.targetOperatingModel}</p>
        </div>
      )}

      {/* Redesign Principles (from existing futureState intelligence) */}
      {futureState.redesignPrinciples.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Redesign Principles
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {futureState.redesignPrinciples.map((p, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transformation Roadmap (from existing roadmap intelligence — NOT agent-generated) */}
      {roadmap.phases.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Transformation Roadmap
          </p>
          <div className="space-y-3">
            {roadmap.phases.map((phase, i) => {
              const colors = PHASE_COLORS[i] ?? PHASE_COLORS[0];
              return (
                <div key={i} className={`rounded-xl border ${colors.border} ${colors.bg} p-5`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colors.num} text-xs font-bold`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3 mb-2">
                        <p className={`text-sm font-bold ${colors.label}`}>{phase.phase}</p>
                        <span className="text-xs text-muted-foreground shrink-0">{phase.timeframe}</span>
                      </div>
                      {phase.initiatives.length > 0 && (
                        <ul className="space-y-1.5">
                          {phase.initiatives.map((init, j) => (
                            <li key={j} className="flex items-start gap-2">
                              <span className="text-muted-foreground shrink-0 text-xs mt-0.5">·</span>
                              <span className="text-xs text-foreground">
                                <span className="font-medium">{init.title}</span>
                                {init.outcome ? ` — ${init.outcome}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {phase.capabilities.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {phase.capabilities.map((c) => (
                            <span key={c} className="px-1.5 py-0.5 rounded bg-white/60 border border-white text-[10px] text-foreground/70">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Critical path */}
          {roadmap.criticalPath && (
            <div className="mt-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Critical Path
              </p>
              <p className="text-sm text-foreground">{roadmap.criticalPath}</p>
            </div>
          )}

          {/* Key risks */}
          {roadmap.keyRisks.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 mb-1.5">
                Key Risks
              </p>
              <ul className="space-y-1">
                {roadmap.keyRisks.map((r, i) => (
                  <li key={i} className="text-xs text-amber-900 flex items-start gap-2">
                    <span className="shrink-0">·</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Starting Point + Success Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Starting Point
          </p>
          <EditableText
            value={ss.startingPoint}
            onSave={(v) => onUpdate({ ...summary, solutionSummary: { ...ss, startingPoint: v } })}
            multiline
            className="text-sm text-foreground leading-relaxed"
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Success Looks Like
          </p>
          <ul className="space-y-2">
            {ss.successIndicators.map((indicator, i) => (
              <li key={i} className="flex items-start gap-2.5 group/item">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <EditableText
                  value={indicator}
                  onSave={(v) => {
                    const updated = ss.successIndicators.map((x, j) => j === i ? v : x);
                    onUpdate({ ...summary, solutionSummary: { ...ss, successIndicators: updated } });
                  }}
                  className="flex-1 text-sm text-foreground"
                />
                <button
                  onClick={() => {
                    const updated = ss.successIndicators.filter((_, j) => j !== i);
                    onUpdate({ ...summary, solutionSummary: { ...ss, successIndicators: updated } });
                  }}
                  className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-red-500 shrink-0 transition-all"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <AddItemInput
            onAdd={(text) => onUpdate({ ...summary, solutionSummary: { ...ss, successIndicators: [...ss.successIndicators, text] } })}
            placeholder="Add a success indicator — must be observable"
          />
        </div>
      </div>

    </div>
  );
}

// ── Journey Map section ───────────────────────────────────────────────────────

function JourneyDownloadBar({ workshopId }: { workshopId: string }) {
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

// ── Agentic Prompt Bar ────────────────────────────────────────────────────────

function AgenticPromptBar({
  workshopId,
  onOutput,
}: {
  workshopId: string;
  onOutput: (output: PromptOutput) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const SUGGESTIONS = [
    'Bar chart of root causes by severity',
    'Table comparing current vs future state by lens',
    'Summarise the key constraints found in workshop',
    'List the top efficiency gains with estimated impact',
  ];

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
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Request failed');
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

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Additional Analysis</p>
          <span className="text-xs text-muted-foreground">
            Ask for charts, tables, or deeper dives
          </span>
        </div>
      </div>

      {/* Suggestions */}
      <div className="px-5 pt-3 pb-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setPrompt(s)}
            className="px-2.5 py-1 rounded-full border border-border bg-muted/40 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
          onClick={handleSubmit}
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

function GenerateSummaryCta({
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
            continue; // malformed JSON — skip this event block
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DownloadReportPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [intelligence, setIntelligence] = useState<WorkshopOutputIntelligence | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [liveJourneyData, setLiveJourneyData] = useState<LiveJourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [promptOutputs, setPromptOutputs] = useState<PromptOutput[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showJourneyMap, setShowJourneyMap] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [workshopRes, intelligenceRes, summaryRes] = await Promise.all([
        fetch(`/api/admin/workshops/${workshopId}`),
        fetch(`/api/admin/workshops/${workshopId}/output-intelligence`),
        fetch(`/api/admin/workshops/${workshopId}/report-summary`),
      ]);

      if (workshopRes.ok) {
        const d = await workshopRes.json();
        setWorkshop(d.workshop);
      }

      if (intelligenceRes.ok) {
        const d = await intelligenceRes.json();
        const stored = d.intelligence as StoredOutputIntelligence | null;
        if (stored?.intelligence) setIntelligence(stored.intelligence);
      }

      if (summaryRes.ok) {
        const d = await summaryRes.json();
        if (d.reportSummary) setReportSummary(d.reportSummary as ReportSummary);
      }

      // Fetch journey map (non-fatal)
      try {
        const versionsRes = await fetch(
          `/api/admin/workshops/${workshopId}/live/session-versions?limit=1`
        );
        if (versionsRes.ok) {
          const vd = await versionsRes.json();
          const latestId = vd.versions?.[0]?.id;
          if (latestId) {
            const versionRes = await fetch(
              `/api/admin/workshops/${workshopId}/live/session-versions/${latestId}`
            );
            if (versionRes.ok) {
              const versionData = await versionRes.json();
              const lj = versionData.version?.payload?.liveJourney;
              if (lj?.stages?.length && lj?.interactions?.length) {
                setLiveJourneyData(lj as LiveJourneyData);
              }
            }
          }
        }
      } catch {
        // Non-fatal
      }
    } catch (err) {
      console.error('Failed to fetch report data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Called whenever user edits any field — updates local state and debounce-saves to DB
  const handleSummaryUpdate = useCallback((updated: ReportSummary) => {
    setReportSummary(updated);
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/workshops/${workshopId}/report-summary`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportSummary: updated }),
        });
        if (!res.ok) throw new Error('Save failed');
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, 800);
  }, [workshopId]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await fetch(`/api/admin/workshops/${workshopId}/export-html`, {
        method: 'POST',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Failed to export');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workshop?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'workshop'}-report.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Report exported! Upload the ZIP contents to your client's domain.");
    } catch (err) {
      toast.error(`Failed to export: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading report…</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href={`/admin/workshops/${workshopId}`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">
                Download Report
              </h1>
              {workshop && (
                <p className="text-xs text-muted-foreground leading-tight">
                  {workshop.name}
                  {workshop.organization?.name ? ` — ${workshop.organization.name}` : ''}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Save status indicator */}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                Save failed
              </span>
            )}
            {/* Quality indicator — admin only, never exported */}
            {reportSummary && !reportSummary.validationPassed && reportSummary.validationGaps.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-700 cursor-default"
                title={reportSummary.validationGaps.join('\n')}>
                <AlertTriangle className="h-3 w-3" />
                {reportSummary.validationGaps.length} quality gap{reportSummary.validationGaps.length > 1 ? 's' : ''} — regenerate to clear
              </span>
            )}
            {reportSummary && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => void fetchData()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            )}
            <Button
              onClick={handleExport}
              disabled={exporting || !intelligence}
              size="sm"
              className="gap-2"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {exporting ? 'Exporting…' : 'Export HTML'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* ── AGENTIC PROMPT BAR — always at the top ────────────────────── */}
        {intelligence && (
          <>
            {promptOutputs.length > 0 && (
              <div className="space-y-4">
                <SectionHeading
                  label="Additional Analysis"
                  sublabel="Generated on demand — not saved to report"
                />
                {promptOutputs.map((output, i) => (
                  <ReportPromptOutput key={i} output={output} />
                ))}
              </div>
            )}
            <AgenticPromptBar
              workshopId={workshopId}
              onOutput={(o) => setPromptOutputs((prev) => [...prev, o])}
            />
          </>
        )}

        {/* No intelligence yet */}
        {!intelligence && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Analysis not yet generated
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Run the 5-engine intelligence pipeline first to populate this report.
                </p>
              </div>
            </div>
            <Link href={`/admin/workshops/${workshopId}/hemisphere`}>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
              >
                Go to Insight Map →
              </Button>
            </Link>
          </div>
        )}

        {/* ── EXECUTIVE SUMMARY ──────────────────────────────────────────── */}
        {intelligence && (
          <>
            <div>
              <SectionHeading
                label="Executive Summary"
              />

              {reportSummary ? (
                <ExecutiveSummaryBlock summary={reportSummary} onUpdate={handleSummaryUpdate} />
              ) : (
                <GenerateSummaryCta
                  workshopId={workshopId}
                  onComplete={(s) => setReportSummary(s)}
                />
              )}
            </div>

            {/* ── SUPPORTING EVIDENCE ──────────────────────────────────── */}
            <div>
              <SectionHeading
                label="Supporting Evidence"
                sublabel="Issues confirmed and surfaced during the workshop"
              />
              <SupportingEvidenceBlock intelligence={intelligence} />
            </div>

            {/* ── ROOT CAUSES ──────────────────────────────────────────── */}
            <div>
              <SectionHeading
                label="Root Causes"
                sublabel="Why these issues exist — ranked by severity"
              />
              <RootCausesBlock intelligence={intelligence} />
            </div>

            {/* ── SOLUTION DIRECTION ───────────────────────────────────── */}
            {reportSummary && (
              <div>
                <SectionHeading
                  label="Solution Direction"
                  sublabel="Given the ask and findings, the recommended way forward"
                />
                <SolutionDirectionBlock summary={reportSummary} intelligence={intelligence} onUpdate={handleSummaryUpdate} />

                {/* Regenerate button */}
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground gap-1.5 h-7"
                    onClick={() => setReportSummary(null)}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerate summary
                  </Button>
                </div>
              </div>
            )}

            {/* ── JOURNEY MAP ──────────────────────────────────────────── */}
            {liveJourneyData && (
              <div>
                <SectionHeading
                  label="Customer Journey"
                  sublabel="Actor swim-lanes from the live workshop session"
                />
                <div className="flex justify-end -mt-3 mb-3">
                  <button
                    onClick={() => setShowJourneyMap(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className={`inline-flex h-4 w-7 items-center rounded-full border transition-colors ${showJourneyMap ? 'bg-foreground/15 border-foreground/20' : 'bg-muted border-border'}`}>
                      <span className={`h-3.5 w-3.5 rounded-full bg-background shadow-sm border border-border transition-transform ${showJourneyMap ? 'translate-x-3' : 'translate-x-0'}`} />
                    </span>
                    {showJourneyMap ? 'Included in report' : 'Excluded from report'}
                  </button>
                </div>
                {showJourneyMap && (
                  <>
                    <JourneyDownloadBar workshopId={workshopId} />
                    <LiveJourneyMap data={liveJourneyData} mode="output" />
                  </>
                )}
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
