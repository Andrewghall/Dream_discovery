'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { WorkshopOutputIntelligence, ReportSummary } from '@/lib/output-intelligence/types';
import { ItemToggle } from '@/components/report-builder/DraggableSection';
import { EditableText, AddItemInput } from './ScratchpadEditors';

// ── Phase colours for roadmap ─────────────────────────────────────────────────

export const PHASE_COLORS = [
  { bg: 'bg-primary/5', border: 'border-primary/20', num: 'bg-primary text-primary-foreground', label: 'text-primary' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', num: 'bg-emerald-600 text-white', label: 'text-emerald-700' },
  { bg: 'bg-violet-50', border: 'border-violet-200', num: 'bg-violet-600 text-white', label: 'text-violet-700' },
];

// ── Executive Summary block ───────────────────────────────────────────────────

export function ExecutiveSummaryBlock({
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
  if (!es) return null;
  const whatWeFound = es.whatWeFound ?? [];
  const lensFindings = es.lensFindings ?? [];

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
            {whatWeFound.map((finding, i) => (
              <ItemToggle key={i} id={`finding:${i}`} excluded={excludedItems.includes(`finding:${i}`)} onToggle={onToggleItem}>
                <div className="flex items-start gap-3 group/finding">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary mt-0.5">
                    {i + 1}
                  </span>
                  <EditableText
                    value={finding}
                    onSave={(v) => {
                      const updated = whatWeFound.map((f, j) => j === i ? v : f);
                      onUpdate({ ...summary, executiveSummary: { ...es, whatWeFound: updated } });
                    }}
                    className="flex-1 text-sm text-foreground leading-relaxed"
                  />
                  <button
                    onClick={() => {
                      const updated = whatWeFound.filter((_, j) => j !== i);
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
            onAdd={(text) => onUpdate({ ...summary, executiveSummary: { ...es, whatWeFound: [...whatWeFound, text] } })}
            placeholder="Add a finding — name a system, metric, or process"
          />
        </div>

        {/* Per-Lens Findings */}
        {lensFindings.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Findings by Lens
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lensFindings.map((lf, i) => (
                <ItemToggle key={i} id={`lens:${lf.lens}`} excluded={excludedItems.includes(`lens:${lf.lens}`)} onToggle={onToggleItem}>
                  <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                      {lf.lens}
                    </p>
                    <EditableText
                      value={lf.finding}
                      onSave={(v) => {
                        const updated = lensFindings.map((f, j) => j === i ? { ...f, finding: v } : f);
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
      </div>
    </div>
  );
}

// ── Supporting Evidence block ─────────────────────────────────────────────────

export function SupportingEvidenceBlock({
  intelligence,
  excludedItems = [],
  onToggleItem = () => {},
}: {
  intelligence: WorkshopOutputIntelligence;
  excludedItems?: string[];
  onToggleItem?: (id: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const discoveryValidation = intelligence.discoveryValidation;
  if (!discoveryValidation) return null;
  const confirmedIssues = discoveryValidation.confirmedIssues ?? [];
  const newIssues = discoveryValidation.newIssues ?? [];

  return (
    <div className="space-y-4">
      {/* Confirmed Issues */}
      {confirmedIssues.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Confirmed Issues</p>
            <span className="text-[10px] font-medium text-muted-foreground">
              Hypothesis accuracy: {discoveryValidation.hypothesisAccuracy}%
            </span>
          </div>
          <div className="divide-y divide-border">
            {confirmedIssues.map((ci, i) => (
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
      {newIssues.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-card overflow-hidden">
          <button
            onClick={() => setShowNew((v) => !v)}
            className="w-full px-5 py-3.5 border-b border-blue-200 bg-blue-50 flex items-center justify-between hover:bg-blue-100/60 transition-colors"
          >
            <p className="text-xs font-semibold text-blue-800">
              New Issues — Surfaced in Workshop
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px]">
                {newIssues.length}
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
              {newIssues.map((ni, i) => (
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

export function RootCausesBlock({
  intelligence,
  excludedItems = [],
  onToggleItem = () => {},
}: {
  intelligence: WorkshopOutputIntelligence;
  excludedItems?: string[];
  onToggleItem?: (id: string) => void;
}) {
  const rootCause = intelligence.rootCause;
  if (!rootCause) return null;
  const rootCauses = rootCause.rootCauses ?? [];
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
        {rootCauses.map((rc) => (
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
                {(rc.evidence ?? []).length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {(rc.evidence ?? []).slice(0, 2).map((e, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">·</span>
                        {e}
                      </li>
                    ))}
                  </ul>
                )}
                {(rc.affectedLenses ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(rc.affectedLenses ?? []).map((l) => (
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

export function SolutionDirectionBlock({
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
  if (!ss) return null;
  const roadmap = intelligence.roadmap;
  const futureState = intelligence.futureState;

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
          {(ss.whatMustChange ?? []).map((item, i) => (
            <ItemToggle key={i} id={`step:${i}`} excluded={excludedItems.includes(`step:${i}`)} onToggle={onToggleItem}>
              <div className="rounded-xl border border-border bg-card p-4">
                <EditableText
                  value={item.area}
                  onSave={(v) => {
                    const updated = (ss.whatMustChange ?? []).map((x, j) => j === i ? { ...x, area: v } : x);
                    onUpdate({ ...summary, solutionSummary: { ...ss, whatMustChange: updated } });
                  }}
                  className="text-xs font-bold text-foreground mb-2.5"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2.5">
                  <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 mb-1">
                      Today&apos;s Reality
                    </p>
                    <EditableText
                      value={item.currentState}
                      onSave={(v) => {
                        const updated = (ss.whatMustChange ?? []).map((x, j) => j === i ? { ...x, currentState: v } : x);
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
                        const updated = (ss.whatMustChange ?? []).map((x, j) => j === i ? { ...x, requiredChange: v } : x);
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

      {/* Target Operating Model */}
      {futureState?.targetOperatingModel && (
        <div className="rounded-xl border border-border bg-card px-5 py-5 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Target Operating Model
          </p>
          <p className="text-sm text-foreground leading-relaxed">{futureState?.targetOperatingModel}</p>
        </div>
      )}

      {/* Redesign Principles */}
      {(futureState?.redesignPrinciples ?? []).length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Redesign Principles
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(futureState?.redesignPrinciples ?? []).map((p, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transformation Roadmap */}
      {(roadmap?.phases ?? []).length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Transformation Roadmap
          </p>
          <div className="space-y-3">
            {(roadmap?.phases ?? []).map((phase, i) => {
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
                        {(phase.initiatives ?? []).length > 0 && (
                          <ul className="space-y-1.5">
                            {(phase.initiatives ?? []).map((init, j) => (
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
                        {(phase.capabilities ?? []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(phase.capabilities ?? []).map((c) => (
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

          {roadmap?.criticalPath && (
            <div className="mt-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Critical Path
              </p>
              <p className="text-sm text-foreground">{roadmap?.criticalPath}</p>
            </div>
          )}

          {(roadmap?.keyRisks ?? []).length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 mb-1.5">
                Key Risks
              </p>
              <ul className="space-y-1">
                {(roadmap?.keyRisks ?? []).map((r, i) => (
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
            {(ss.successIndicators ?? []).map((indicator, i) => (
              <li key={i} className="flex items-start gap-2.5 group/item">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <EditableText
                  value={indicator}
                  onSave={(v) => {
                    const updated = (ss.successIndicators ?? []).map((x, j) => j === i ? v : x);
                    onUpdate({ ...summary, solutionSummary: { ...ss, successIndicators: updated } });
                  }}
                  className="flex-1 text-sm text-foreground"
                />
                <button
                  onClick={() => {
                    const updated = (ss.successIndicators ?? []).filter((_, j) => j !== i);
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
            onAdd={(text) => onUpdate({ ...summary, solutionSummary: { ...ss, successIndicators: [...(ss.successIndicators ?? []), text] } })}
            placeholder="Add a success indicator — must be observable"
          />
        </div>
      </div>

    </div>
  );
}

// ── Strategic Impact block ────────────────────────────────────────────────────

export function StrategicImpactBlock({
  intelligence,
  excludedItems = [],
  onToggleItem = () => {},
}: {
  intelligence: WorkshopOutputIntelligence;
  excludedItems?: string[];
  onToggleItem?: (id: string) => void;
}) {
  const si = intelligence.strategicImpact;
  if (!si) return null;

  const statItems = [
    { id: 'automation', label: 'Automation Potential', pct: si.automationPotential?.percentage ?? null, color: 'bg-violet-100 text-violet-700 border-violet-200' },
    { id: 'ai_assisted', label: 'AI-Assisted Work',    pct: si.aiAssistedWork?.percentage ?? null,    color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    { id: 'human_only', label: 'Human-Only Work',      pct: si.humanOnlyWork?.percentage ?? null,     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ];

  return (
    <div className="space-y-5">
      {/* Business case */}
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Business Case Summary</p>
        <p className="text-sm text-foreground leading-relaxed">{si.businessCaseSummary}</p>
        <p className="text-xs text-muted-foreground mt-2">Confidence score: <span className="font-medium text-foreground">{si.confidenceScore !== null ? `${si.confidenceScore}%` : '—'}</span></p>
      </div>

      {/* 3 stat boxes */}
      <div className="grid grid-cols-3 gap-3">
        {statItems.map(s => (
          !excludedItems.includes(s.id) && (
            <ItemToggle key={s.id} id={s.id} excluded={false} onToggle={onToggleItem}>
              <div className={`rounded-xl border px-4 py-4 text-center ${s.color}`}>
                {s.pct !== null ? (
                  <p className="text-2xl font-bold">{s.pct}%</p>
                ) : (
                  <p className="text-xs italic opacity-60">—</p>
                )}
                <p className="text-[11px] font-medium mt-1">{s.label}</p>
              </div>
            </ItemToggle>
          )
        ))}
      </div>

      {/* Efficiency gains table */}
      {(si.efficiencyGains ?? []).length > 0 && (
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
              {(si.efficiencyGains ?? []).map((g, i) => (
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

// ── Way Forward block ─────────────────────────────────────────────────────────

const WF_COLORS = [
  { border: 'border-primary/30',   header: 'bg-primary/10',   label: 'text-primary',     dot: 'bg-primary',     badge: 'bg-primary/10 text-primary' },
  { border: 'border-violet-200',   header: 'bg-violet-50',    label: 'text-violet-700',  dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700' },
  { border: 'border-emerald-200',  header: 'bg-emerald-50',   label: 'text-emerald-700', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
];

export function WayForwardBlock({ intelligence }: { intelligence: WorkshopOutputIntelligence }) {
  const phases = intelligence.roadmap?.phases ?? [];
  const roi    = intelligence.roadmap?.roiSummary;

  if (!phases.length) {
    return (
      <p className="text-sm text-muted-foreground py-2 px-1">
        No roadmap phases found. Run the output intelligence pipeline to generate Way Forward content.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Gantt timeline bar */}
      <div className="flex gap-0 rounded-lg overflow-hidden border border-border text-[10px] font-semibold">
        {phases.map((p, i) => {
          const c = WF_COLORS[i] ?? WF_COLORS[0];
          return (
            <div key={i} className={`flex-1 ${c.header} ${c.label} px-3 py-2 text-center`}>
              <div>{p.phase.split(' — ')[0]}</div>
              {p.timeframe && <div className="font-normal opacity-70">{p.timeframe}</div>}
            </div>
          );
        })}
      </div>

      {/* Phase cards */}
      <div className="grid grid-cols-1 gap-3">
        {phases.map((p, i) => {
          const c = WF_COLORS[i] ?? WF_COLORS[0];
          return (
            <div key={i} className={`rounded-xl border-2 ${c.border} overflow-hidden`}>
              <div className={`${c.header} px-4 py-2.5 flex items-center justify-between`}>
                <span className={`text-xs font-bold uppercase tracking-wide ${c.label}`}>
                  {p.phase}
                </span>
                {p.timeframe && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
                    {p.timeframe}
                  </span>
                )}
              </div>
              <div className="px-4 py-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {(p.initiatives ?? []).slice(0, 6).map((init, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-xs text-foreground py-0.5">
                      <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      <span className="leading-snug">{init.title}</span>
                    </div>
                  ))}
                  {(p.initiatives ?? []).length > 6 && (
                    <div className="text-[10px] text-muted-foreground col-span-2 mt-1">
                      +{(p.initiatives ?? []).length - 6} more initiatives in PDF
                    </div>
                  )}
                </div>
                {p.dependencies?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Dependencies</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.dependencies.join(' · ')}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ROI summary footer */}
      {roi && (
        <div className="grid grid-cols-3 gap-3 pt-1">
          {roi.totalProgrammeCost && (
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Total Programme Cost</p>
              <p className="text-sm font-bold text-foreground">{roi.totalProgrammeCost}</p>
            </div>
          )}
          {roi.totalThreeYearBenefit && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">3-Year Benefit</p>
              <p className="text-sm font-bold text-emerald-800">{roi.totalThreeYearBenefit}</p>
            </div>
          )}
          {roi.paybackPeriod && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide mb-1">Programme Payback</p>
              <p className="text-sm font-bold text-foreground">{roi.paybackPeriod}</p>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground italic px-1">
        Full Gantt chart with cost/benefit curves rendered in the exported PDF.
      </p>
    </div>
  );
}
