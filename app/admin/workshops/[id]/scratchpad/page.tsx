'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  FileDown,
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
  GripVertical,
  ImagePlus,
  Building2,
  Presentation,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { nanoid } from 'nanoid';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { WorkshopOutputIntelligence } from '@/lib/output-intelligence/types';
import type { ReportSummary, ReportSectionConfig, ReportLayout, ReportConclusion, ReportNextStep, FacilitatorContact } from '@/lib/output-intelligence/types';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';
import { defaultReportLayout } from '@/lib/output-intelligence/types';
import type { StoredOutputIntelligence } from '@/lib/output-intelligence/types';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import LiveJourneyMap from '@/components/cognitive-guidance/live-journey-map';
import { ReportPromptOutput } from '@/components/scratchpad/ReportPromptOutput';
import type { PromptOutput } from '@/components/scratchpad/ReportPromptOutput';
import { DraggableSection, ItemToggle, DropIndicator } from '@/components/report-builder/DraggableSection';

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
  excludedItems = [],
  onToggleItem = () => {},
}: {
  summary: ReportSummary;
  onUpdate: (updated: ReportSummary) => void;
  excludedItems?: string[];
  onToggleItem?: (id: string) => void;
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
              <ItemToggle key={i} id={`finding:${i}`} excluded={excludedItems.includes(`finding:${i}`)} onToggle={onToggleItem}>
                <div className="flex items-start gap-3 group/finding">
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
                    className="opacity-0 group-hover/finding:opacity-100 text-muted-foreground hover:text-red-500 shrink-0 transition-all mt-0.5"
                    title="Remove finding"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </ItemToggle>
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
                <ItemToggle key={i} id={`lens:${lf.lens}`} excluded={excludedItems.includes(`lens:${lf.lens}`)} onToggle={onToggleItem}>
                  <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
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
                </ItemToggle>
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

function SupportingEvidenceBlock({
  intelligence,
  excludedItems = [],
  onToggleItem = () => {},
}: {
  intelligence: WorkshopOutputIntelligence;
  excludedItems?: string[];
  onToggleItem?: (id: string) => void;
}) {
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
              <ItemToggle key={i} id={`confirmed:${i}`} excluded={excludedItems.includes(`confirmed:${i}`)} onToggle={onToggleItem} className="px-5 py-3.5">
                <div className="flex items-start gap-3">
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
              </ItemToggle>
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
                <ItemToggle key={i} id={`new:${i}`} excluded={excludedItems.includes(`new:${i}`)} onToggle={onToggleItem} className="px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{ni.issue}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ni.workshopEvidence}</p>
                    <p className="text-xs text-blue-700 mt-1 font-medium">→ {ni.significance}</p>
                  </div>
                </ItemToggle>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Root Causes block ─────────────────────────────────────────────────────────

function RootCausesBlock({
  intelligence,
  excludedItems = [],
  onToggleItem = () => {},
}: {
  intelligence: WorkshopOutputIntelligence;
  excludedItems?: string[];
  onToggleItem?: (id: string) => void;
}) {
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
          <ItemToggle key={rc.rank} id={`cause:${rc.rank}`} excluded={excludedItems.includes(`cause:${rc.rank}`)} onToggle={onToggleItem}>
            <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-start gap-4">
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
          </ItemToggle>
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
  excludedItems = [],
  onToggleItem = () => {},
}: {
  summary: ReportSummary;
  intelligence: WorkshopOutputIntelligence;
  onUpdate: (updated: ReportSummary) => void;
  excludedItems?: string[];
  onToggleItem?: (id: string) => void;
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
            <ItemToggle key={i} id={`step:${i}`} excluded={excludedItems.includes(`step:${i}`)} onToggle={onToggleItem}>
              <div className="rounded-xl border border-border bg-card p-4">
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
            </ItemToggle>
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
                <ItemToggle key={i} id={`phase:${i}`} excluded={excludedItems.includes(`phase:${i}`)} onToggle={onToggleItem}>
                  <div className={`rounded-xl border ${colors.border} ${colors.bg} p-5`}>
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
                </ItemToggle>
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

// ── Strategic Impact block ────────────────────────────────────────────────────

function StrategicImpactBlock({
  intelligence,
  excludedItems = [],
  onToggleItem = () => {},
}: {
  intelligence: WorkshopOutputIntelligence;
  excludedItems?: string[];
  onToggleItem?: (id: string) => void;
}) {
  const si = intelligence.strategicImpact;

  const statItems = [
    { id: 'automation', label: 'Automation Potential', pct: si.automationPotential.percentage, color: 'bg-violet-100 text-violet-700 border-violet-200' },
    { id: 'ai_assisted', label: 'AI-Assisted Work',    pct: si.aiAssistedWork.percentage,    color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    { id: 'human_only', label: 'Human-Only Work',      pct: si.humanOnlyWork.percentage,     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ];

  return (
    <div className="space-y-5">
      {/* Business case */}
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Business Case Summary</p>
        <p className="text-sm text-foreground leading-relaxed">{si.businessCaseSummary}</p>
        <p className="text-xs text-muted-foreground mt-2">Confidence score: <span className="font-medium text-foreground">{si.confidenceScore}%</span></p>
      </div>

      {/* 3 stat boxes */}
      <div className="grid grid-cols-3 gap-3">
        {statItems.map(s => (
          !excludedItems.includes(s.id) && (
            <ItemToggle key={s.id} id={s.id} excluded={false} onToggle={onToggleItem}>
              <div className={`rounded-xl border px-4 py-4 text-center ${s.color}`}>
                <p className="text-2xl font-bold">{s.pct}%</p>
                <p className="text-[11px] font-medium mt-1">{s.label}</p>
              </div>
            </ItemToggle>
          )
        ))}
      </div>

      {/* Efficiency gains table */}
      {si.efficiencyGains.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold text-foreground">Efficiency Gains</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Metric</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Estimated</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {si.efficiencyGains.map((g, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{g.metric}</td>
                  <td className="px-4 py-2.5 text-emerald-700 font-semibold">{g.estimated}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{g.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Discovery Diagnostic block ─────────────────────────────────────────────────

const DIAGNOSTIC_CARDS_CFG = [
  { key: 'operationalReality',         label: 'Operational Reality',         color: 'border-indigo-200 bg-indigo-50'  },
  { key: 'organisationalMisalignment', label: 'Leadership Alignment Risk',   color: 'border-rose-200 bg-rose-50'      },
  { key: 'systemicFriction',           label: 'Systemic Friction',           color: 'border-amber-200 bg-amber-50'    },
  { key: 'transformationReadiness',    label: 'Transformation Readiness',    color: 'border-emerald-200 bg-emerald-50' },
] as const;

function DiscoveryDiagnosticBlock({
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

function DiscoverySignalsBlock({
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

function InsightSummaryBlock({ intelligence }: { intelligence: WorkshopOutputIntelligence }) {
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

function AlignmentBlock({ discoverAnalysis }: { discoverAnalysis: DiscoverAnalysis | null }) {
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

function NarrativeDivergenceBlock({ discoverAnalysis }: { discoverAnalysis: DiscoverAnalysis | null }) {
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

function TensionsBlock({ discoverAnalysis }: { discoverAnalysis: DiscoverAnalysis | null }) {
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

function StructuralBarriersBlock({ discoverAnalysis }: { discoverAnalysis: DiscoverAnalysis | null }) {
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

function ReportConclusionBlock({
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

// ── Journey Intro Block ───────────────────────────────────────────────────────

function JourneyIntroBlock({
  workshopId,
  journey,
  value,
  onChange,
  disabled,
}: {
  workshopId: string;
  journey: import('@/lib/cognitive-guidance/pipeline').LiveJourneyData;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Keep draft in sync if value changes from outside (e.g. initial load)
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
    // Empty state — show generate button
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

function CustomSectionEditor({
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

function AgenticPromptBar({
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
          {/* Suggest additions button */}
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

// ── Structural Confidence Block ───────────────────────────────────────────────

function StructuralConfidenceBlock({ data }: { data: DiscoverAnalysis }) {
  const { overall, byDomain, byLayer } = data.confidence;
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

function SignalMapBlock({ imageUrl }: { imageUrl: string | null; workshopId: string; onImageCaptured: (url: string) => void }) {
  return (
    <div className="space-y-3">
      {imageUrl ? (
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

function FacilitatorContactBlock({ contact, onChange }: { contact: FacilitatorContact | null; onChange: (c: FacilitatorContact) => void }) {
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DownloadReportPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [intelligence, setIntelligence] = useState<WorkshopOutputIntelligence | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [liveJourneyData, setLiveJourneyData] = useState<LiveJourneyData | null>(null);
  const [journeyVersions, setJourneyVersions] = useState<Array<{ id: string; version: number; dialoguePhase: string; createdAt: string }>>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [journeyRegenerating, setJourneyRegenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [promptOutputs, setPromptOutputs] = useState<PromptOutput[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // ── Report builder layout ─────────────────────────────────────────
  const [layout, setLayout] = useState<ReportLayout>(defaultReportLayout());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overDragId, setOverDragId] = useState<string | null>(null);
  const [clientLogoUrl, setClientLogoUrl] = useState<string>('');
  const [uploadingClientLogo, setUploadingClientLogo] = useState(false);
  const clientLogoFileRef = useRef<HTMLInputElement>(null);
  // ── Cross-page section data ─────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [discoveryOutput, setDiscoveryOutput] = useState<any | null>(null);
  const [discoverAnalysis, setDiscoverAnalysis] = useState<DiscoverAnalysis | null>(null);
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
        if (d.reportSummary) {
          const rs = d.reportSummary as ReportSummary;
          setReportSummary(rs);
          // Restore saved layout if it exists
          if (rs.layout?.sections?.length) {
            setLayout(rs.layout);
            if (rs.layout.clientLogoUrl) setClientLogoUrl(rs.layout.clientLogoUrl);
          }
        }
      }

      // Fetch discovery output if needed for cross-page sections (non-fatal)
      try {
        const scratchpadRes = await fetch(`/api/admin/workshops/${workshopId}/scratchpad`);
        if (scratchpadRes.ok) {
          const sd = await scratchpadRes.json();
          const dOut = sd.scratchpad?.discoveryOutput;
          if (dOut && Object.keys(dOut).length > 0) setDiscoveryOutput(dOut);
        }
      } catch { /* non-fatal */ }

      // Fetch structural analysis data (non-fatal)
      try {
        const analysisRes = await fetch(`/api/admin/workshops/${workshopId}/discover-analysis`);
        if (analysisRes.ok) {
          const ad = await analysisRes.json();
          if (ad.analysis) setDiscoverAnalysis(ad.analysis as DiscoverAnalysis);
        }
      } catch { /* non-fatal */ }

      // Fetch journey versions (non-fatal)
      try {
        const versionsRes = await fetch(
          `/api/admin/workshops/${workshopId}/live/session-versions?limit=20`
        );
        if (versionsRes.ok) {
          const vd = await versionsRes.json();
          const versions = vd.versions ?? [];
          setJourneyVersions(versions);
          const latestId = versions[0]?.id;
          if (latestId) {
            setSelectedVersionId(latestId);
            await loadJourneyVersion(latestId, workshopId);
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

  const loadJourneyVersion = async (versionId: string, wsId = workshopId) => {
    try {
      const versionRes = await fetch(
        `/api/admin/workshops/${wsId}/live/session-versions/${versionId}`
      );
      if (versionRes.ok) {
        const versionData = await versionRes.json();
        const lj = versionData.version?.payload?.liveJourney;
        if (lj?.stages?.length && lj?.interactions?.length) {
          setLiveJourneyData(lj as LiveJourneyData);
        }
      }
    } catch { /* non-fatal */ }
  };

  const handleRegenerateJourney = async () => {
    try {
      setJourneyRegenerating(true);
      const res = await fetch(`/api/admin/workshops/${workshopId}/journey/regenerate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Regeneration failed' }));
        toast.error(err.error || 'Journey regeneration failed');
        return;
      }
      const data = await res.json();
      if (data.liveJourney) {
        setLiveJourneyData(data.liveJourney as LiveJourneyData);
        toast.success('Journey map regenerated from full workshop data');
      }
    } catch {
      toast.error('Journey regeneration failed');
    } finally {
      setJourneyRegenerating(false);
    }
  };

  // ── Layout helpers ─────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const updateLayout = useCallback((updated: ReportLayout) => {
    setLayout(updated);
    // Save layout alongside reportSummary
    if (reportSummary) {
      const rs = { ...reportSummary, layout: updated };
      setReportSummary(rs);
      // Debounce handled by handleSummaryUpdate below — call directly
      void (async () => {
        try {
          await fetch(`/api/admin/workshops/${workshopId}/report-summary`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportSummary: rs }),
          });
        } catch { /* non-fatal */ }
      })();
    }
  }, [reportSummary, workshopId]);

  const updateSection = useCallback((id: string, patch: Partial<ReportSectionConfig>) => {
    setLayout(prev => {
      const next = { ...prev, sections: prev.sections.map(s => s.id === id ? { ...s, ...patch } : s) };
      updateLayout(next);
      return next;
    });
  }, [updateLayout]);

  const toggleItem = useCallback((sectionId: string, itemId: string) => {
    setLayout(prev => {
      const next = {
        ...prev,
        sections: prev.sections.map(s => {
          if (s.id !== sectionId) return s;
          const excluded = s.excludedItems.includes(itemId)
            ? s.excludedItems.filter(i => i !== itemId)
            : [...s.excludedItems, itemId];
          return { ...s, excludedItems: excluded };
        }),
      };
      updateLayout(next);
      return next;
    });
  }, [updateLayout]);

  const addCustomSection = useCallback(() => {
    const newSection: ReportSectionConfig = {
      id: `custom_${nanoid(8)}`,
      type: 'custom',
      title: 'New Section',
      enabled: true,
      collapsed: false,
      excludedItems: [],
      customContent: { text: '', imageUrl: '', imageAlt: '' },
    };
    setLayout(prev => {
      const next = { ...prev, sections: [...prev.sections, newSection] };
      updateLayout(next);
      return next;
    });
  }, [updateLayout]);

  const addChapterSection = useCallback(() => {
    const newSection: ReportSectionConfig = {
      id: `chapter_${nanoid(8)}`,
      type: 'chapter',
      title: 'New Chapter',
      enabled: true,
      collapsed: false,
      excludedItems: [],
    };
    setLayout(prev => {
      const next = { ...prev, sections: [...prev.sections, newSection] };
      updateLayout(next);
      return next;
    });
  }, [updateLayout]);

  const updateSectionTitle = useCallback((id: string, title: string) => {
    updateSection(id, { title });
  }, [updateSection]);

  const handleClientLogoUpload = useCallback(async (file: File) => {
    setUploadingClientLogo(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`/api/admin/workshops/${workshopId}/upload-section-image`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json() as { url: string };
      setClientLogoUrl(data.url);
      // Persist in layout
      updateLayout({ ...layout, clientLogoUrl: data.url });
    } catch {
      toast.error('Client logo upload failed');
    } finally {
      setUploadingClientLogo(false);
    }
  }, [workshopId, layout, updateLayout]);

  const removeSection = useCallback((id: string) => {
    setLayout(prev => {
      const next = { ...prev, sections: prev.sections.filter(s => s.id !== id) };
      updateLayout(next);
      return next;
    });
  }, [updateLayout]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };
  const handleDragOver = (event: DragOverEvent) => {
    setOverDragId(event.over ? String(event.over.id) : null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    setOverDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLayout(prev => {
      const oldIndex = prev.sections.findIndex(s => s.id === active.id);
      const newIndex = prev.sections.findIndex(s => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = { ...prev, sections: arrayMove(prev.sections, oldIndex, newIndex) };
      updateLayout(next);
      return next;
    });
  };

  // ── PDF export ──────────────────────────────────────────────────────────────

  const handleExportPdf = async () => {
    if (!intelligence || !reportSummary) {
      toast.error('Generate the report summary first before exporting PDF');
      return;
    }
    try {
      setExporting(true);
      const res = await fetch(`/api/admin/workshops/${workshopId}/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportSummary,
          intelligence,
          layout,
          liveJourneyData,
          workshopName: workshop?.name,
          orgName: workshop?.organization?.name,
          clientLogoUrl: clientLogoUrl || undefined,
          discoveryOutput: discoveryOutput || undefined,
          discoverAnalysis: discoverAnalysis || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' })) as { error: string };
        throw new Error(err.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workshop?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'workshop'}-discovery-report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PDF downloaded!');
    } catch (err) {
      toast.error(`PDF export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
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

  // ── PowerPoint export ────────────────────────────────────────────────────────

  const handleExportPptx = async () => {
    if (!intelligence || !reportSummary) {
      toast.error('Generate the report summary first before exporting PowerPoint');
      return;
    }
    try {
      setExportingPptx(true);
      const res = await fetch(`/api/admin/workshops/${workshopId}/export-pptx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportSummary,
          intelligence,
          layout,
          liveJourneyData,
          workshopName: workshop?.name,
          orgName: workshop?.organization?.name,
          clientLogoUrl: clientLogoUrl || undefined,
          discoveryOutput: discoveryOutput || undefined,
          discoverAnalysis: discoverAnalysis || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' })) as { error: string };
        throw new Error(err.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workshop?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'workshop'}-discovery-report.pptx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PowerPoint downloaded!');
    } catch (err) {
      toast.error(`PowerPoint export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExportingPptx(false);
    }
  };

  // handleExport removed — replaced by handleExportPdf above

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

          {/* ── Client Logo picker ─────────────────────────────────── */}
          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 bg-muted/20">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {clientLogoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={clientLogoUrl} alt="Client logo" className="h-6 max-w-[80px] object-contain rounded" />
                <button
                  onClick={() => { setClientLogoUrl(''); updateLayout({ ...layout, clientLogoUrl: undefined }); }}
                  className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors ml-1"
                  title="Remove client logo"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <button
                onClick={() => clientLogoFileRef.current?.click()}
                disabled={uploadingClientLogo}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {uploadingClientLogo ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
                ) : (
                  <>+ Client logo</>
                )}
              </button>
            )}
            <input
              ref={clientLogoFileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleClientLogoUpload(file);
                e.target.value = '';
              }}
            />
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
              <button
                onClick={() => setReportSummary(null)}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                title={`Click to regenerate\n\n${reportSummary.validationGaps.join('\n')}`}
              >
                <AlertTriangle className="h-3 w-3" />
                {reportSummary.validationGaps.length} quality gap{reportSummary.validationGaps.length > 1 ? 's' : ''} — click to regenerate
              </button>
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
              onClick={handleExportPdf}
              disabled={exporting || !intelligence || !reportSummary}
              size="sm"
              className="gap-2"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              {exporting ? 'Generating PDF…' : 'Generate PDF'}
            </Button>
            <Button
              onClick={handleExportPptx}
              disabled={exportingPptx || !intelligence || !reportSummary}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              {exportingPptx ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Presentation className="h-3.5 w-3.5" />
              )}
              {exportingPptx ? 'Generating PPTX…' : 'Generate PPTX'}
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
              layout={layout}
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

        {/* ── REPORT BUILDER — DnD sortable sections ──────────────────── */}
        {intelligence && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={layout.sections.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {layout.sections.map((cfg) => {
                  const isOver = overDragId === cfg.id && activeDragId !== cfg.id;
                  return (
                    <div key={cfg.id}>
                      <DropIndicator isOver={isOver} />
                      <DraggableSection
                        config={cfg}
                        onToggleEnabled={() => updateSection(cfg.id, { enabled: !cfg.enabled })}
                        onToggleCollapsed={() => updateSection(cfg.id, { collapsed: !cfg.collapsed })}
                        onRemove={(cfg.type === 'custom' || cfg.type === 'chapter') ? () => removeSection(cfg.id) : undefined}
                        onTitleChange={cfg.type === 'chapter' ? (title) => updateSectionTitle(cfg.id, title) : undefined}
                      >
                        {/* ── Executive Summary ── */}
                        {cfg.id === 'executive_summary' && (
                          <div className="p-1">
                            {reportSummary ? (
                              <ExecutiveSummaryBlock
                                summary={reportSummary}
                                onUpdate={handleSummaryUpdate}
                                excludedItems={cfg.excludedItems}
                                onToggleItem={(id) => toggleItem(cfg.id, id)}
                              />
                            ) : (
                              <div className="p-3">
                                <GenerateSummaryCta
                                  workshopId={workshopId}
                                  onComplete={(s) => setReportSummary(s)}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Supporting Evidence ── */}
                        {cfg.id === 'supporting_evidence' && (
                          <div className="p-4">
                            <SupportingEvidenceBlock
                              intelligence={intelligence}
                              excludedItems={cfg.excludedItems}
                              onToggleItem={(id) => toggleItem(cfg.id, id)}
                            />
                          </div>
                        )}

                        {/* ── Root Causes ── */}
                        {cfg.id === 'root_causes' && (
                          <div className="p-4">
                            <RootCausesBlock
                              intelligence={intelligence}
                              excludedItems={cfg.excludedItems}
                              onToggleItem={(id) => toggleItem(cfg.id, id)}
                            />
                          </div>
                        )}

                        {/* ── Solution Direction ── */}
                        {cfg.id === 'solution_direction' && (
                          <div className="p-4">
                            {reportSummary ? (
                              <>
                                <SolutionDirectionBlock
                                  summary={reportSummary}
                                  intelligence={intelligence}
                                  onUpdate={handleSummaryUpdate}
                                  excludedItems={cfg.excludedItems}
                                  onToggleItem={(id) => toggleItem(cfg.id, id)}
                                />
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
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground py-2">
                                Generate the executive summary first to populate this section.
                              </p>
                            )}
                          </div>
                        )}

                        {/* ── Customer Journey ── */}
                        {cfg.id === 'journey_map' && (
                          <div className="p-4">
                            {liveJourneyData ? (
                              <>
                                {/* Journey controls row */}
                                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                                  {journeyVersions.length > 1 && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <span className="text-[10px] uppercase tracking-wide font-medium">Session:</span>
                                      <select
                                        value={selectedVersionId ?? ''}
                                        onChange={async (e) => {
                                          const id = e.target.value;
                                          setSelectedVersionId(id);
                                          await loadJourneyVersion(id);
                                        }}
                                        className="text-xs border border-border rounded px-1.5 py-0.5 bg-background text-foreground"
                                      >
                                        {journeyVersions.map((v, i) => (
                                          <option key={v.id} value={v.id}>
                                            v{v.version} — {v.dialoguePhase}{i === 0 ? ' (latest)' : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  <button
                                    onClick={handleRegenerateJourney}
                                    disabled={journeyRegenerating}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ml-auto"
                                  >
                                    {journeyRegenerating
                                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating…</>
                                      : <><RefreshCw className="h-3 w-3" /> Regenerate from full data</>
                                    }
                                  </button>
                                </div>
                                <JourneyIntroBlock
                                  workshopId={workshopId}
                                  journey={liveJourneyData}
                                  value={reportSummary?.journeyIntro ?? ''}
                                  onChange={(v) => {
                                    if (reportSummary) handleSummaryUpdate({ ...reportSummary, journeyIntro: v });
                                  }}
                                  disabled={!reportSummary}
                                />
                                <JourneyDownloadBar workshopId={workshopId} />
                                <LiveJourneyMap data={liveJourneyData} mode="output" />
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground py-2">
                                No journey map generated yet. Run a live session to generate one.
                              </p>
                            )}
                          </div>
                        )}

                        {/* ── Strategic Impact ── */}
                        {cfg.id === 'strategic_impact' && (
                          <div className="p-4">
                            <StrategicImpactBlock
                              intelligence={intelligence}
                              excludedItems={cfg.excludedItems}
                              onToggleItem={(id) => toggleItem(cfg.id, id)}
                            />
                          </div>
                        )}

                        {/* ── Discovery Diagnostic ── */}
                        {cfg.id === 'discovery_diagnostic' && (
                          <div className="p-4">
                            <DiscoveryDiagnosticBlock
                              discoveryOutput={discoveryOutput}
                              excludedItems={cfg.excludedItems}
                              onToggleItem={(id) => toggleItem(cfg.id, id)}
                            />
                          </div>
                        )}

                        {/* ── Discovery Signals ── */}
                        {cfg.id === 'discovery_signals' && (
                          <div className="p-4">
                            <DiscoverySignalsBlock
                              discoveryOutput={discoveryOutput}
                              excludedItems={cfg.excludedItems}
                              onToggleItem={(id) => toggleItem(cfg.id, id)}
                            />
                          </div>
                        )}

                        {/* ── Structural: Domain Misalignment ── */}
                        {cfg.id === 'structural_alignment' && (
                          <div className="p-4">
                            <AlignmentBlock discoverAnalysis={discoverAnalysis} />
                          </div>
                        )}

                        {/* ── Structural: Narrative Divergence ── */}
                        {cfg.id === 'structural_narrative' && (
                          <div className="p-4">
                            <NarrativeDivergenceBlock discoverAnalysis={discoverAnalysis} />
                          </div>
                        )}

                        {/* ── Structural: Transformation Tensions ── */}
                        {cfg.id === 'structural_tensions' && (
                          <div className="p-4">
                            <TensionsBlock discoverAnalysis={discoverAnalysis} />
                          </div>
                        )}

                        {/* ── Structural: Structural Barriers ── */}
                        {cfg.id === 'structural_barriers' && (
                          <div className="p-4">
                            <StructuralBarriersBlock discoverAnalysis={discoverAnalysis} />
                          </div>
                        )}

                        {/* ── Structural: Transformation Readiness ── */}
                        {cfg.id === 'structural_confidence' && (
                          <div className="p-4">
                            {discoverAnalysis ? (
                              <StructuralConfidenceBlock data={discoverAnalysis} />
                            ) : (
                              <p className="text-sm text-muted-foreground">Enable Structural Analysis on the Discovery Output page first.</p>
                            )}
                          </div>
                        )}

                        {/* ── Discovery Signal Map ── */}
                        {cfg.id === 'discovery_signal_map' && (
                          <div className="p-4">
                            <SignalMapBlock
                              imageUrl={reportSummary?.signalMapImageUrl ?? null}
                              workshopId={workshopId}
                              onImageCaptured={(url) => {
                                if (reportSummary) handleSummaryUpdate({ ...reportSummary, signalMapImageUrl: url });
                              }}
                            />
                          </div>
                        )}

                        {/* ── Facilitator Contact ── */}
                        {cfg.id === 'facilitator_contact' && (
                          <div className="p-4">
                            <FacilitatorContactBlock
                              contact={reportSummary?.facilitatorContact ?? null}
                              onChange={(contact) => {
                                if (reportSummary) handleSummaryUpdate({ ...reportSummary, facilitatorContact: contact });
                              }}
                            />
                          </div>
                        )}

                        {/* ── Insight Map Summary ── */}
                        {cfg.id === 'insight_summary' && (
                          <div className="p-4">
                            <InsightSummaryBlock intelligence={intelligence} />
                          </div>
                        )}

                        {/* ── Report Conclusion ── */}
                        {cfg.id === 'report_conclusion' && (
                          <ReportConclusionBlock
                            workshopId={workshopId}
                            conclusion={reportSummary?.reportConclusion}
                            onUpdate={(c) => {
                              if (reportSummary) handleSummaryUpdate({ ...reportSummary, reportConclusion: c });
                            }}
                          />
                        )}

                        {/* ── Chapter sections have no body ── */}
                        {cfg.type === 'chapter' && null}

                        {/* ── Custom Section ── */}
                        {cfg.type === 'custom' && (
                          <CustomSectionEditor
                            section={cfg}
                            workshopId={workshopId}
                            onUpdate={(patch) => updateSection(cfg.id, patch)}
                          />
                        )}
                      </DraggableSection>
                    </div>
                  );
                })}
              </div>
            </SortableContext>

            {/* ── Add section controls ── */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={addChapterSection}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary/30 text-sm text-primary/60 hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add chapter header
              </button>
              <button
                onClick={addCustomSection}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add custom section
              </button>
            </div>

            {/* DragOverlay — ghost card during drag */}
            <DragOverlay>
              {activeDragId && (() => {
                const cfg = layout.sections.find(s => s.id === activeDragId);
                if (!cfg) return null;
                return (
                  <DraggableSection
                    config={cfg}
                    onToggleEnabled={() => {}}
                    onToggleCollapsed={() => {}}
                    isDragOverlay
                  >
                    <div className="h-10 rounded bg-muted/30 mx-4 mb-3" />
                  </DraggableSection>
                );
              })()}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
