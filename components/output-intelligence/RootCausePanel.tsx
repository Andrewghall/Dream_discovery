'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Clock, Wrench, ChevronRight, TrendingUp } from 'lucide-react';
import type { RootCauseIntelligence, WorkshopConstraint, DrivingForce } from '@/lib/output-intelligence/types';

interface Props {
  data: RootCauseIntelligence;
}

// ── Type config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<WorkshopConstraint['type'], { bg: string; text: string; border: string; dot: string }> = {
  Structural:  { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200',  dot: 'bg-slate-500'  },
  Cultural:    { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  Technical:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  Regulatory:  { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
  Resource:    { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  Leadership:  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
};

function TypeBadge({ type }: { type: WorkshopConstraint['type'] }) {
  const c = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {type}
    </span>
  );
}

// ── Severity ─────────────────────────────────────────────────────────────────

const SEV: Record<WorkshopConstraint['severity'], { dot: string; label: string; bar: string; text: string }> = {
  critical:    { dot: 'bg-red-500',   label: 'text-red-700 bg-red-50 border-red-200',     bar: 'bg-red-500',   text: 'Critical'    },
  significant: { dot: 'bg-amber-400', label: 'text-amber-700 bg-amber-50 border-amber-200', bar: 'bg-amber-400', text: 'Significant' },
  moderate:    { dot: 'bg-slate-300', label: 'text-slate-600 bg-slate-50 border-slate-200', bar: 'bg-slate-300', text: 'Moderate'    },
};

// ── Resolution ───────────────────────────────────────────────────────────────

const RESOLUTION_CONFIG: Record<WorkshopConstraint['resolutionStatus'], { style: string; Icon: React.ComponentType<{className?: string}>; short: string }> = {
  'Addressed in Vision':           { style: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2, short: 'Addressed' },
  'Partially Addressed':           { style: 'bg-amber-50 text-amber-700 border-amber-200',       Icon: Clock,        short: 'Partial'   },
  'Requires Enabler':              { style: 'bg-blue-50 text-blue-700 border-blue-200',           Icon: Wrench,       short: 'Needs Enabler' },
  'Structural — Hard to Change':   { style: 'bg-red-50 text-red-700 border-red-200',             Icon: AlertCircle,  short: 'Hard to Change' },
};

function ResolutionBadge({ status }: { status: WorkshopConstraint['resolutionStatus'] }) {
  const c = RESOLUTION_CONFIG[status];
  const { Icon } = c;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.style}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

// ── Force Field — full redesign ───────────────────────────────────────────────

function ForceField({
  constraints,
  drivers,
  headline,
}: {
  constraints: WorkshopConstraint[];
  drivers: DrivingForce[];
  headline?: string;
}) {
  const topC = [...constraints]
    .sort((a, b) => ({ critical: 3, significant: 2, moderate: 1 }[b.severity] - { critical: 3, significant: 2, moderate: 1 }[a.severity]))
    .slice(0, 7);
  const topD = [...drivers]
    .sort((a, b) => ({ strong: 3, moderate: 2, emerging: 1 }[b.strength] - { strong: 3, moderate: 2, emerging: 1 }[a.strength]))
    .slice(0, 7);
  const rows = Math.max(topC.length, topD.length);

  const cBarPct: Record<WorkshopConstraint['severity'], number> = { critical: 100, significant: 72, moderate: 44 };
  const dBarPct: Record<DrivingForce['strength'], number>       = { strong: 100, moderate: 70, emerging: 42 };
  const dBarColor: Record<DrivingForce['strength'], string>     = { strong: 'bg-emerald-500', moderate: 'bg-emerald-400', emerging: 'bg-emerald-300' };

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Force Field Analysis</p>
        {headline && (
          <p className="text-white text-sm sm:text-base font-medium leading-snug italic">
            "{headline}"
          </p>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-2">
        <div className="px-6 py-3 bg-red-950/5 border-r border-b border-slate-200 flex items-center gap-2">
          <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">← Restraining</span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">Forces preventing change</span>
        </div>
        <div className="px-6 py-3 bg-emerald-950/5 border-b border-slate-200 flex items-center justify-end gap-2">
          <span className="text-[10px] text-slate-400 hidden sm:inline">Forces enabling change</span>
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Driving →</span>
        </div>
      </div>

      {/* Rows — two full columns, no truncation */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => {
          const c = topC[i];
          const d = topD[i];
          return (
            <div key={i} className="grid grid-cols-2 divide-x divide-slate-100 min-h-[72px]">

              {/* LEFT — constraint */}
              <div className={`px-5 py-4 flex items-start gap-3 ${c ? 'bg-rose-50/30' : 'bg-white'}`}>
                {c ? (
                  <>
                    {/* Severity bar */}
                    <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
                      <div className={`w-1.5 rounded-full ${SEV[c.severity].bar}`} style={{ height: `${cBarPct[c.severity] * 0.36 + 8}px` }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-snug">{c.title}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <TypeBadge type={c.type} />
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${SEV[c.severity].label}`}>
                          {SEV[c.severity].text}
                        </span>
                      </div>
                    </div>
                  </>
                ) : <div />}
              </div>

              {/* RIGHT — driver */}
              <div className={`px-5 py-4 flex items-start gap-3 ${d ? 'bg-emerald-50/30' : 'bg-white'}`}>
                {d ? (
                  <>
                    {/* Strength bar */}
                    <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
                      <div className={`w-1.5 rounded-full ${dBarColor[d.strength]}`} style={{ height: `${dBarPct[d.strength] * 0.36 + 8}px` }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 leading-snug">{d.force}</p>
                      <p className="text-xs text-slate-500 mt-1 leading-snug">{d.source}</p>
                      <span className={`mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        d.strength === 'strong'   ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        d.strength === 'moderate' ? 'bg-teal-100 text-teal-700 border-teal-200' :
                                                    'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {d.strength}
                      </span>
                    </div>
                  </>
                ) : <div />}
              </div>

            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="grid grid-cols-2 border-t border-slate-200">
        <div className="px-6 py-3 bg-rose-50 flex items-center gap-2">
          <span className="text-xs font-bold text-rose-700">{topC.length} restraining forces shown</span>
          {constraints.length > topC.length && (
            <span className="text-xs text-rose-400">+{constraints.length - topC.length} more in list below</span>
          )}
        </div>
        <div className="px-6 py-3 bg-emerald-50 flex items-center justify-end gap-2">
          {drivers.length > topD.length && (
            <span className="text-xs text-emerald-400">+{drivers.length - topD.length} more</span>
          )}
          <span className="text-xs font-bold text-emerald-700">{topD.length} driving forces shown</span>
        </div>
      </div>
    </div>
  );
}

// ── Constraint type breakdown ─────────────────────────────────────────────────

function ConstraintTypeBreakdown({ constraints }: { constraints: WorkshopConstraint[] }) {
  const counts = {} as Record<WorkshopConstraint['type'], number>;
  for (const c of constraints) counts[c.type] = (counts[c.type] ?? 0) + 1;
  const sorted = (Object.entries(counts) as [WorkshopConstraint['type'], number][])
    .sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] ?? 1;

  const severitySplit = {
    critical: constraints.filter(c => c.severity === 'critical').length,
    significant: constraints.filter(c => c.severity === 'significant').length,
    moderate: constraints.filter(c => c.severity === 'moderate').length,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Type breakdown */}
      <div className="rounded-2xl border border-slate-200 p-5 bg-white">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Constraint Types</p>
        <div className="space-y-2.5">
          {sorted.map(([type, count]) => {
            const c = TYPE_CONFIG[type];
            const pct = Math.round((count / max) * 100);
            return (
              <div key={type} className="flex items-center gap-3">
                <span className={`shrink-0 text-xs font-semibold w-20 ${c.text}`}>{type}</span>
                <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.dot} transition-all`}
                    style={{ width: `${pct}%`, opacity: 0.7 }}
                  />
                </div>
                <span className="shrink-0 text-xs font-bold text-slate-700 w-4 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Severity split */}
      <div className="rounded-2xl border border-slate-200 p-5 bg-white">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Severity Profile</p>
        <div className="space-y-4">
          {[
            { key: 'critical' as const,    label: 'Critical',    color: 'bg-red-500',   text: 'text-red-700',   desc: 'Blocking transformation now' },
            { key: 'significant' as const, label: 'Significant', color: 'bg-amber-400', text: 'text-amber-700', desc: 'Major friction, needs addressing' },
            { key: 'moderate' as const,    label: 'Moderate',    color: 'bg-slate-300', text: 'text-slate-600', desc: 'Manageable with planning' },
          ].map(({ key, label, color, text, desc }) => (
            <div key={key} className="flex items-center gap-4">
              <div className={`shrink-0 w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                <span className="text-white text-base font-black">{severitySplit[key]}</span>
              </div>
              <div>
                <p className={`text-sm font-bold ${text}`}>{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
            </div>
          ))}
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
          <p className="text-xs text-slate-500">Every constraint surfaced — in participants' own words</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">

        {/* LEFT — scrollable list */}
        <div className="border-r border-slate-200 bg-white divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
          {constraints.map((c, i) => {
            const isActive = selected === i;
            return (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`w-full text-left flex items-start gap-3 px-5 py-4 transition-colors ${
                  isActive
                    ? 'bg-rose-50 border-l-4 border-l-rose-600'
                    : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                }`}
              >
                <span className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${SEV[c.severity].dot}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-snug ${isActive ? 'text-rose-900' : 'text-slate-800'}`}>
                    {c.title}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <TypeBadge type={c.type} />
                  </div>
                </div>
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 mt-1 ${isActive ? 'text-rose-400' : 'text-slate-300'}`} />
              </button>
            );
          })}
        </div>

        {/* RIGHT — detail */}
        <div className="bg-white p-6 flex flex-col gap-5 min-h-[400px]">
          {active && (
            <>
              <div className="flex flex-wrap items-start gap-2 pb-4 border-b border-slate-100">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <TypeBadge type={active.type} />
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border uppercase ${SEV[active.severity].label}`}>
                      {SEV[active.severity].text}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 leading-snug">{active.title}</h4>
                </div>
              </div>

              {/* Participant voice */}
              <div className="rounded-xl bg-slate-50 border-l-4 border-slate-400 px-5 py-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">In Their Words</p>
                <p className="text-sm text-slate-700 italic leading-relaxed">"{active.participantVoice}"</p>
              </div>

              {/* Root cause */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Why This Exists</p>
                <p className="text-sm text-slate-700 leading-relaxed">{active.rootCause}</p>
              </div>

              {/* Affected lenses */}
              {(active.affectedLenses ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Spans These Lenses</p>
                  <div className="flex flex-wrap gap-1.5">
                    {active.affectedLenses.map((l, i) => (
                      <span key={i} className="px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200">{l}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution status */}
              <div className="pt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Does the Vision Address This?</p>
                <ResolutionBadge status={active.resolutionStatus} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Resolution scorecard ──────────────────────────────────────────────────────

function ResolutionSummary({ constraints }: { constraints: WorkshopConstraint[] }) {
  const counts = {
    'Addressed in Vision': 0,
    'Partially Addressed': 0,
    'Requires Enabler': 0,
    'Structural — Hard to Change': 0,
  } as Record<WorkshopConstraint['resolutionStatus'], number>;
  for (const c of constraints) counts[c.resolutionStatus]++;

  const total = constraints.length;
  const pct = total > 0
    ? Math.round(((counts['Addressed in Vision'] + counts['Partially Addressed'] * 0.5) / total) * 100)
    : 0;

  const strokeColor = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 38;
  const strokeDash = (pct / 100) * circumference;

  return (
    <div className="rounded-2xl border border-slate-200 p-6 bg-gradient-to-br from-slate-50 to-white">
      <h3 className="text-base font-bold text-slate-900 mb-5">Does the Vision Break Through?</h3>
      <div className="flex items-center gap-8">
        {/* SVG ring — larger */}
        <div className="shrink-0 relative w-28 h-28">
          <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
            <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="38" fill="none"
              stroke={strokeColor}
              strokeWidth="8"
              strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-900">{pct}%</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">covered</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 space-y-3">
          {(Object.entries(counts) as [WorkshopConstraint['resolutionStatus'], number][]).map(([status, count]) => {
            if (count === 0) return null;
            const conf = RESOLUTION_CONFIG[status];
            const { Icon } = conf;
            const textClass = conf.style.split(' ').find(s => s.startsWith('text-')) ?? 'text-slate-600';
            return (
              <div key={status} className="flex items-center gap-3">
                <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${conf.style.split(' ').find(s => s.startsWith('bg-'))} border ${conf.style.split(' ').find(s => s.startsWith('border-'))}`}>
                  <Icon className={`h-3.5 w-3.5 ${textClass}`} />
                </div>
                <span className="text-xs text-slate-600 flex-1 leading-snug">{status}</span>
                <span className="text-sm font-black text-slate-900">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Root causes ranked ────────────────────────────────────────────────────────

function RootCausesList({ causes }: { causes: RootCauseIntelligence['rootCauses'] }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <TrendingUp className="h-4 w-4 text-slate-400" />
        <h3 className="text-base font-bold text-slate-900">Why These Constraints Exist — Root Causes</h3>
      </div>
      <div className="space-y-3">
        {causes.map((cause) => (
          <div key={cause.rank} className="flex gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
            <div className="shrink-0 w-9 h-9 rounded-full bg-rose-100 text-rose-700 text-sm font-bold flex items-center justify-center mt-0.5">
              {cause.rank}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-slate-900">{cause.cause}</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border uppercase shrink-0 ${SEV[cause.severity].label}`}>
                  {SEV[cause.severity].text}
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
              {(cause.evidence ?? []).slice(0, 2).map((e, i) => (
                <p key={i} className="text-xs text-slate-500 flex gap-2 mt-1">
                  <span className="text-slate-300 shrink-0">—</span>
                  <span>{e}</span>
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Friction map ──────────────────────────────────────────────────────────────

function FrictionMap({ frictionMap }: { frictionMap: RootCauseIntelligence['frictionMap'] }) {
  if (!frictionMap?.length) return null;
  const max = Math.max(...frictionMap.map(f => f.frictionLevel), 1);
  return (
    <div>
      <h3 className="text-base font-bold text-slate-900 mb-4">Friction by Stage</h3>
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        {frictionMap.map((f, i) => {
          const pct = (f.frictionLevel / max) * 100;
          const color = pct >= 70 ? 'bg-red-400' : pct >= 40 ? 'bg-amber-400' : 'bg-emerald-400';
          const textColor = pct >= 70 ? 'text-red-600' : pct >= 40 ? 'text-amber-600' : 'text-emerald-600';
          return (
            <div key={i} className={`px-5 py-3.5 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
              <div className="flex items-center gap-4">
                <span className="w-36 shrink-0 text-xs font-semibold text-slate-700">{f.stage}</span>
                <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`shrink-0 w-5 text-xs font-black text-right ${textColor}`}>{f.frictionLevel}</span>
                {f.primaryCause && (
                  <span className="text-xs text-slate-400 max-w-[200px] hidden md:block leading-snug">{f.primaryCause}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function RootCausePanel({ data }: Props) {
  const hasNewFormat = !!(data.workshopConstraints?.length || data.drivingForces?.length);

  return (
    <div className="space-y-8">

      {/* 1. Systemic pattern hero */}
      {data.systemicPattern && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950 text-white shadow-lg">
          <p className="text-[10px] font-bold text-rose-300 uppercase tracking-widest mb-3">Systemic Pattern</p>
          <p className="text-sm sm:text-base leading-relaxed text-slate-200">{data.systemicPattern}</p>
        </div>
      )}

      {/* 2. Force field — full redesign */}
      {hasNewFormat && data.workshopConstraints && data.drivingForces && (
        <ForceField
          constraints={data.workshopConstraints}
          drivers={data.drivingForces}
          headline={data.forceFieldHeadline}
        />
      )}

      {/* 3. Type breakdown + severity profile */}
      {hasNewFormat && data.workshopConstraints && data.workshopConstraints.length > 0 && (
        <ConstraintTypeBreakdown constraints={data.workshopConstraints} />
      )}

      {/* 4. Resolution scorecard */}
      {hasNewFormat && data.workshopConstraints && data.workshopConstraints.length > 0 && (
        <ResolutionSummary constraints={data.workshopConstraints} />
      )}

      {/* 5. Constraint explorer */}
      {hasNewFormat && data.workshopConstraints && data.workshopConstraints.length > 0 && (
        <ConstraintExplorer constraints={data.workshopConstraints} />
      )}

      {/* 6. Root causes */}
      {(data.rootCauses ?? []).length > 0 && (
        <RootCausesList causes={data.rootCauses} />
      )}

      {/* 7. Friction map */}
      {(data.frictionMap ?? []).length > 0 && (
        <FrictionMap frictionMap={data.frictionMap} />
      )}

    </div>
  );
}
