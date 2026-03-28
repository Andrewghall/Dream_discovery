'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Clock, Wrench, ChevronRight } from 'lucide-react';
import type { RootCauseIntelligence, WorkshopConstraint, DrivingForce } from '@/lib/output-intelligence/types';

interface Props {
  data: RootCauseIntelligence;
}

// ── Constraint type badge ────────────────────────────────────────────────────

const TYPE_STYLES: Record<WorkshopConstraint['type'], string> = {
  Structural:  'bg-slate-100 text-slate-700 border-slate-200',
  Cultural:    'bg-purple-100 text-purple-700 border-purple-200',
  Technical:   'bg-blue-100 text-blue-700 border-blue-200',
  Regulatory:  'bg-amber-100 text-amber-700 border-amber-200',
  Resource:    'bg-orange-100 text-orange-700 border-orange-200',
  Leadership:  'bg-indigo-100 text-indigo-700 border-indigo-200',
};

function TypeBadge({ type }: { type: WorkshopConstraint['type'] }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${TYPE_STYLES[type]}`}>
      {type}
    </span>
  );
}

// ── Severity indicator ───────────────────────────────────────────────────────

const SEV_DOT: Record<WorkshopConstraint['severity'], string> = {
  critical:    'bg-red-500',
  significant: 'bg-amber-400',
  moderate:    'bg-slate-300',
};

const SEV_LABEL: Record<WorkshopConstraint['severity'], string> = {
  critical:    'text-red-700 bg-red-50 border-red-200',
  significant: 'text-amber-700 bg-amber-50 border-amber-200',
  moderate:    'text-slate-600 bg-slate-50 border-slate-200',
};

// ── Resolution status ────────────────────────────────────────────────────────

const RESOLUTION_CONFIG = {
  'Addressed in Vision': {
    style: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: CheckCircle2,
  },
  'Partially Addressed': {
    style: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: Clock,
  },
  'Requires Enabler': {
    style: 'bg-blue-50 text-blue-700 border-blue-200',
    Icon: Wrench,
  },
  'Structural — Hard to Change': {
    style: 'bg-red-50 text-red-700 border-red-200',
    Icon: AlertCircle,
  },
} as const;

function ResolutionBadge({ status }: { status: WorkshopConstraint['resolutionStatus'] }) {
  const config = RESOLUTION_CONFIG[status];
  if (!config) return null;
  const { Icon } = config;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.style}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

// ── Force Field Diagram ──────────────────────────────────────────────────────

const CONSTRAINT_BAR_WIDTH: Record<WorkshopConstraint['severity'], string> = {
  critical:    'w-full',
  significant: 'w-3/4',
  moderate:    'w-1/2',
};

const DRIVER_BAR_WIDTH: Record<DrivingForce['strength'], string> = {
  strong:   'w-full',
  moderate: 'w-3/4',
  emerging: 'w-1/2',
};

function ForceFieldDiagram({
  constraints,
  drivers,
  headline,
  goal,
}: {
  constraints: WorkshopConstraint[];
  drivers: DrivingForce[];
  headline?: string;
  goal: string;
}) {
  const topConstraints = [...constraints]
    .sort((a, b) => ({ critical: 3, significant: 2, moderate: 1 }[b.severity] - { critical: 3, significant: 2, moderate: 1 }[a.severity]))
    .slice(0, 5);

  const topDrivers = [...drivers]
    .sort((a, b) => ({ strong: 3, moderate: 2, emerging: 1 }[b.strength] - { strong: 3, moderate: 2, emerging: 1 }[a.strength]))
    .slice(0, 5);

  // Pad to equal rows
  const rows = Math.max(topConstraints.length, topDrivers.length);

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Force Field Analysis</p>
        {headline && (
          <p className="text-white text-sm font-medium italic">"{headline}"</p>
        )}
      </div>

      <div className="p-5">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_120px_1fr] gap-3 mb-4">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Restraining Forces
            </span>
          </div>
          <div />
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-widest">
              Driving Forces
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </span>
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => {
            const constraint = topConstraints[i];
            const driver = topDrivers[i];
            return (
              <div key={i} className="grid grid-cols-[1fr_120px_1fr] gap-3 items-center min-h-[36px]">
                {/* Left — restraining bar (extends right-to-left visually by being right-aligned) */}
                <div className="flex items-center justify-end gap-2">
                  {constraint ? (
                    <>
                      <span className="text-xs text-slate-600 font-medium text-right leading-tight max-w-[130px] hidden sm:block truncate" title={constraint.title}>
                        {constraint.title}
                      </span>
                      <div className="flex-shrink-0 flex justify-end" style={{ width: '100px' }}>
                        <div className={`h-7 rounded-l-full bg-gradient-to-l from-rose-500 to-rose-400 flex items-center justify-end pr-2 ${CONSTRAINT_BAR_WIDTH[constraint.severity]}`}>
                          <span className="text-white text-[10px] font-black">←</span>
                        </div>
                      </div>
                    </>
                  ) : <div />}
                </div>

                {/* Centre goal */}
                {i === Math.floor(rows / 2) ? (
                  <div className="text-center">
                    <div className="rounded-lg bg-slate-900 text-white px-2 py-2">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Goal</p>
                      <p className="text-[10px] font-bold text-white leading-tight mt-0.5">{goal}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <div className="w-px h-full border-l border-dashed border-slate-200" />
                  </div>
                )}

                {/* Right — driving bar */}
                <div className="flex items-center gap-2">
                  {driver ? (
                    <>
                      <div className="flex-shrink-0" style={{ width: '100px' }}>
                        <div className={`h-7 rounded-r-full bg-gradient-to-r from-emerald-400 to-emerald-500 flex items-center justify-start pl-2 ${DRIVER_BAR_WIDTH[driver.strength]}`}>
                          <span className="text-white text-[10px] font-black">→</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-600 font-medium leading-tight max-w-[130px] hidden sm:block truncate" title={driver.force}>
                        {driver.force}
                      </span>
                    </>
                  ) : <div />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-4 justify-center text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-8 h-2 rounded-full bg-rose-500 opacity-100 block" /> Critical</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-2 rounded-full bg-rose-400 block" /> Significant</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-2 rounded-full bg-rose-300 block" /> Moderate</span>
          <span className="mx-2 border-l border-slate-200" />
          <span className="flex items-center gap-1.5"><span className="w-8 h-2 rounded-full bg-emerald-500 block" /> Strong driver</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-2 rounded-full bg-emerald-400 block" /> Moderate</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-2 rounded-full bg-emerald-300 block" /> Emerging</span>
        </div>
      </div>
    </div>
  );
}

// ── Constraint explorer (two-panel) ──────────────────────────────────────────

function ConstraintExplorer({ constraints }: { constraints: WorkshopConstraint[] }) {
  const [selected, setSelected] = useState(0);
  const active = constraints[selected];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-rose-600 text-white text-xs font-bold shrink-0">
          {constraints.length}
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">What the Room Named</h3>
          <p className="text-xs text-slate-500">Constraints surfaced by participants — in their own words</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {/* LEFT — list */}
        <div className="border-r border-slate-200 bg-white divide-y divide-slate-100">
          {constraints.map((c, i) => {
            const isActive = selected === i;
            return (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`w-full text-left flex items-center gap-3 px-5 py-4 transition-colors ${
                  isActive
                    ? 'bg-rose-50 border-l-2 border-l-rose-600'
                    : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                }`}
              >
                <span className={`shrink-0 w-2 h-2 rounded-full mt-0.5 ${SEV_DOT[c.severity]}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-snug truncate ${isActive ? 'text-rose-900' : 'text-slate-800'}`}>
                    {c.title}
                  </p>
                  <div className="mt-0.5">
                    <TypeBadge type={c.type} />
                  </div>
                </div>
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-rose-400' : 'text-slate-300'}`} />
              </button>
            );
          })}
        </div>

        {/* RIGHT — detail */}
        <div className="bg-white p-6 flex flex-col gap-5">
          {active && (
            <>
              {/* Header */}
              <div className="flex flex-wrap items-start gap-2 pb-4 border-b border-slate-100">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <TypeBadge type={active.type} />
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border uppercase ${SEV_LABEL[active.severity]}`}>
                      {active.severity}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 leading-snug">{active.title}</h4>
                </div>
              </div>

              {/* Participant voice */}
              <div className="rounded-xl bg-slate-50 border-l-4 border-slate-400 px-5 py-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">In Their Words</p>
                <p className="text-sm text-slate-700 italic leading-relaxed">"{active.participantVoice}"</p>
              </div>

              {/* Root cause */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Why This Exists</p>
                <p className="text-sm text-slate-700 leading-relaxed">{active.rootCause}</p>
              </div>

              {/* Affected lenses */}
              {(active.affectedLenses ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {active.affectedLenses.map((l, i) => (
                    <span key={i} className="px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200">
                      {l}
                    </span>
                  ))}
                </div>
              )}

              {/* Resolution status */}
              <div className="pt-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Does the Vision Address This?</p>
                <ResolutionBadge status={active.resolutionStatus} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Root causes ranked list ──────────────────────────────────────────────────

function RootCausesList({ causes }: { causes: RootCauseIntelligence['rootCauses'] }) {
  return (
    <div>
      <h3 className="text-base font-bold text-slate-900 mb-4">Why These Constraints Exist</h3>
      <div className="space-y-3">
        {causes.map((cause) => (
          <div key={cause.rank} className="flex gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
            <div className="shrink-0 w-9 h-9 rounded-full bg-rose-100 text-rose-700 text-sm font-bold flex items-center justify-center">
              {cause.rank}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-slate-900">{cause.cause}</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border uppercase ${SEV_LABEL[cause.severity]}`}>
                  {cause.severity}
                </span>
              </div>
              {cause.category && (
                <span className="inline-block mb-2 px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                  {cause.category}
                </span>
              )}
              <div className="flex flex-wrap gap-1 mb-2">
                {(cause.affectedLenses ?? []).map((l) => (
                  <span key={l} className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200">{l}</span>
                ))}
              </div>
              {(cause.evidence ?? []).length > 0 && (
                <ul className="space-y-1 mt-1">
                  {cause.evidence.slice(0, 2).map((e, i) => (
                    <li key={i} className="text-xs text-slate-500 flex gap-2">
                      <span className="text-slate-300 shrink-0">—</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Friction map ─────────────────────────────────────────────────────────────

function FrictionMap({ frictionMap }: { frictionMap: RootCauseIntelligence['frictionMap'] }) {
  if (!frictionMap?.length) return null;
  const max = Math.max(...frictionMap.map((f) => f.frictionLevel), 1);

  return (
    <div>
      <h3 className="text-base font-bold text-slate-900 mb-4">Friction by Stage</h3>
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        {frictionMap.map((f, i) => {
          const pct = (f.frictionLevel / max) * 100;
          const color = pct >= 70 ? 'bg-red-400' : pct >= 40 ? 'bg-amber-400' : 'bg-emerald-400';
          const textColor = pct >= 70 ? 'text-red-600' : pct >= 40 ? 'text-amber-600' : 'text-emerald-600';
          return (
            <div key={i} className={`px-5 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
              <div className="flex items-center gap-4">
                <span className="w-36 shrink-0 text-xs font-semibold text-slate-700 truncate" title={f.stage}>
                  {f.stage}
                </span>
                <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`shrink-0 w-5 text-xs font-bold text-right ${textColor}`}>
                  {f.frictionLevel}
                </span>
                {f.primaryCause && (
                  <span className="text-xs text-slate-400 truncate max-w-[180px] hidden md:block" title={f.primaryCause}>
                    {f.primaryCause}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Resolution summary donut-style scoreboard ────────────────────────────────

function ResolutionSummary({ constraints }: { constraints: WorkshopConstraint[] }) {
  const counts = {
    'Addressed in Vision': 0,
    'Partially Addressed': 0,
    'Requires Enabler': 0,
    'Structural — Hard to Change': 0,
  } as Record<WorkshopConstraint['resolutionStatus'], number>;

  for (const c of constraints) counts[c.resolutionStatus]++;

  const total = constraints.length;
  const resolved = counts['Addressed in Vision'];
  const partial  = counts['Partially Addressed'];
  const pctResolved = total > 0 ? Math.round(((resolved + partial * 0.5) / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 p-6 bg-gradient-to-br from-slate-50 to-white">
      <h3 className="text-base font-bold text-slate-900 mb-5">Does the Vision Break Through?</h3>
      <div className="flex items-center gap-6">
        {/* Score ring */}
        <div className="shrink-0 relative w-20 h-20">
          <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={pctResolved >= 70 ? '#10b981' : pctResolved >= 40 ? '#f59e0b' : '#ef4444'}
              strokeWidth="3"
              strokeDasharray={`${pctResolved} ${100 - pctResolved}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black text-slate-900">{pctResolved}%</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase">covered</span>
          </div>
        </div>
        {/* Breakdown */}
        <div className="flex-1 space-y-2">
          {(Object.entries(counts) as [WorkshopConstraint['resolutionStatus'], number][]).map(([status, count]) => {
            if (count === 0) return null;
            const conf = RESOLUTION_CONFIG[status];
            const { Icon } = conf;
            return (
              <div key={status} className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 ${conf.style.split(' ').find(s => s.startsWith('text-'))}`} />
                <span className="text-xs text-slate-600 flex-1">{status}</span>
                <span className="text-xs font-bold text-slate-900">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function RootCausePanel({ data }: Props) {
  const hasNewFormat = !!(data.workshopConstraints?.length || data.drivingForces?.length);
  const goal = data.systemicPattern?.split('.')[0] ?? 'Transformation';

  return (
    <div className="space-y-8">

      {/* 1. Systemic Pattern — dark hero */}
      {data.systemicPattern && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-rose-950 text-white shadow-lg">
          <p className="text-xs font-bold text-rose-300 uppercase tracking-widest mb-3">Systemic Pattern</p>
          <p className="text-sm leading-relaxed text-slate-200">{data.systemicPattern}</p>
        </div>
      )}

      {/* 2. Force Field Diagram */}
      {hasNewFormat && data.workshopConstraints && data.drivingForces && (
        <ForceFieldDiagram
          constraints={data.workshopConstraints}
          drivers={data.drivingForces}
          headline={data.forceFieldHeadline}
          goal={goal.slice(0, 60)}
        />
      )}

      {/* 3. Resolution summary */}
      {hasNewFormat && data.workshopConstraints && data.workshopConstraints.length > 0 && (
        <ResolutionSummary constraints={data.workshopConstraints} />
      )}

      {/* 4. Workshop constraints explorer */}
      {hasNewFormat && data.workshopConstraints && data.workshopConstraints.length > 0 && (
        <ConstraintExplorer constraints={data.workshopConstraints} />
      )}

      {/* 5. Root causes */}
      {(data.rootCauses ?? []).length > 0 && (
        <RootCausesList causes={data.rootCauses} />
      )}

      {/* 6. Friction map */}
      {(data.frictionMap ?? []).length > 0 && (
        <FrictionMap frictionMap={data.frictionMap} />
      )}

    </div>
  );
}
