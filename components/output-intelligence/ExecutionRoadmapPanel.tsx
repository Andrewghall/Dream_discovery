'use client';

import { AlertTriangle, TrendingUp, DollarSign, CheckCircle2, Info } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, ReferenceArea,
} from 'recharts';
import type { ExecutionRoadmap, RoadmapPhase, RoiSummary } from '@/lib/output-intelligence/types';

interface Props {
  data: ExecutionRoadmap;
}

// ── Gantt chart — derived from V1 roadmap phases ──────────────────────────

/** Fixed week windows per phase (aligns with V2 synthesis agent conventions) */
const GANTT_PHASE_WEEKS = [
  { start: 1,  end: 4  }, // Phase 1 — Immediate Enablement
  { start: 5,  end: 12 }, // Phase 2 — Structural Transformation
  { start: 13, end: 52 }, // Phase 3 — Advanced Automation
] as const;

// Colours match the phase card headers: blue-600, purple-700, emerald-700
const GANTT_PHASE_COLORS = ['#2563eb', '#7e22ce', '#047857'] as const;

// Phase band definitions for reference areas: [x1, x2, midpoint, color, fillOpacity]
const PHASE_BANDS = [
  { x1: 0,  x2: 4,  mid: 2,  color: GANTT_PHASE_COLORS[0], fill: '#2563eb' },
  { x1: 4,  x2: 12, mid: 8,  color: GANTT_PHASE_COLORS[1], fill: '#7e22ce' },
  { x1: 12, x2: 52, mid: 32, color: GANTT_PHASE_COLORS[2], fill: '#047857' },
] as const;

function RoadmapGantt({
  phases,
  roiSummary,
}: {
  phases: RoadmapPhase[];
  roiSummary?: RoiSummary | null;
}) {
  if (!phases?.length) return null;

  // Build one row per initiative, spread evenly within the phase window
  const rows: Array<{ name: string; phaseLabel: string; color: string; offset: number; duration: number }> = [];

  phases.forEach((phase, phaseIdx) => {
    const window = GANTT_PHASE_WEEKS[phaseIdx] ?? GANTT_PHASE_WEEKS[0];
    const color = GANTT_PHASE_COLORS[phaseIdx] ?? GANTT_PHASE_COLORS[0];
    const phaseLabel = phase.phase.split(' — ')[0] ?? `Phase ${phaseIdx + 1}`;
    const inits = phase.initiatives ?? [];
    const count = Math.max(inits.length, 1);
    const span = window.end - window.start;

    inits.forEach((init, initIdx) => {
      const segSize = Math.floor(span / count);
      const startWeek = window.start + initIdx * segSize;
      const endWeek = initIdx === count - 1 ? window.end : startWeek + segSize;
      rows.push({
        name: init.title.length > 30 ? init.title.slice(0, 28) + '…' : init.title,
        phaseLabel,
        color,
        offset: startWeek - 1,
        duration: endWeek - startWeek + 1,
      });
    });
  });

  if (!rows.length) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(rows.length * 42 + 60, 180)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />

          {/* ── Phase background bands with cost overlay ── */}
          {PHASE_BANDS.map((band, i) => (
            <ReferenceArea
              key={i}
              x1={band.x1}
              x2={band.x2}
              fill={band.fill}
              fillOpacity={0.06}
              stroke={band.fill}
              strokeOpacity={0.2}
              strokeWidth={1}
            />
          ))}

          {/* ── Cost labels at top of each phase band ── */}
          {PHASE_BANDS.map((band, i) => {
            const cost = roiSummary?.phases?.[i]?.estimatedCost;
            return cost ? (
              <ReferenceLine
                key={`cost-${i}`}
                x={band.mid}
                stroke="transparent"
                label={{
                  value: `💰 ${cost}`,
                  position: 'insideTop',
                  fill: band.fill,
                  fontSize: 9,
                  fontWeight: 700,
                }}
              />
            ) : null;
          })}

          <XAxis
            type="number"
            domain={[0, 52]}
            ticks={[0, 4, 12, 26, 52]}
            tickFormatter={(v) => v === 0 ? 'Now' : `W${v}`}
            tick={{ fontSize: 10 }}
            label={{ value: 'Weeks from kickoff', position: 'insideBottom', offset: -12, fontSize: 11 }}
          />
          <YAxis dataKey="name" type="category" width={170} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value, name) =>
              name === 'duration' ? [`${value} weeks`, 'Duration'] : [null, null]
            }
            labelFormatter={(label) => {
              const row = rows.find((r) => r.name === label);
              const phaseIdx = PHASE_BANDS.findIndex((_, i) => row?.phaseLabel === `Phase ${i + 1}`);
              const cost = roiSummary?.phases?.[phaseIdx]?.estimatedCost;
              return row
                ? `${label}  ·  ${row.phaseLabel}${cost ? `  ·  ${cost}` : ''}`
                : label;
            }}
          />
          <Bar dataKey="offset" stackId="g" fill="transparent" legendType="none" isAnimationActive={false} />
          <Bar dataKey="duration" stackId="g" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {rows.map((row, i) => <Cell key={i} fill={row.color} />)}
          </Bar>
          <ReferenceLine x={0} stroke="#64748b" strokeDasharray="4 2" />
        </BarChart>
      </ResponsiveContainer>

      {/* Phase legend */}
      <div className="flex flex-wrap gap-4 mt-1 ml-2">
        {phases.map((phase, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: GANTT_PHASE_COLORS[i] ?? GANTT_PHASE_COLORS[0] }} />
            <span className="text-xs text-slate-500">
              {phase.phase.split(' — ')[0]}
              {phase.timeframe ? ` (${phase.timeframe})` : ''}
              {roiSummary?.phases?.[i]?.estimatedCost
                ? ` · ${roiSummary.phases[i].estimatedCost}`
                : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ROI & Benefits Realisation Table ──────────────────────────────────────

const CONFIDENCE_STYLES: Record<string, { label: string; className: string }> = {
  High:   { label: 'High',   className: 'bg-emerald-100 text-emerald-700' },
  Medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700'     },
  Low:    { label: 'Low',    className: 'bg-slate-100 text-slate-500'     },
};

const PHASE_ROI_ACCENTS = ['border-blue-300', 'border-purple-300', 'border-emerald-300'];
const PHASE_ROI_HEADER  = ['text-blue-700',   'text-purple-700',   'text-emerald-700' ];

function RoiTable({ roi }: { roi: RoiSummary }) {
  return (
    <div className="space-y-5">

      {/* ── Per-phase grid ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 w-24">Phase</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Investment cost</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Annual benefit</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Key benefit drivers</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Break-even</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">ROI multiple</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {roi.phases.map((p, i) => {
              const conf = CONFIDENCE_STYLES[p.confidenceLevel] ?? CONFIDENCE_STYLES.Low;
              return (
                <tr key={i} className={`border-b border-slate-100 border-l-2 ${PHASE_ROI_ACCENTS[i] ?? ''}`}>
                  <td className={`px-3 py-3 font-bold whitespace-nowrap ${PHASE_ROI_HEADER[i] ?? 'text-slate-700'}`}>
                    {p.phase}
                  </td>
                  <td className="px-3 py-3 text-slate-700 font-medium whitespace-nowrap">{p.estimatedCost}</td>
                  <td className="px-3 py-3 text-emerald-700 font-medium whitespace-nowrap">{p.estimatedAnnualBenefit}</td>
                  <td className="px-3 py-3 text-slate-600">
                    <ul className="space-y-0.5">
                      {(p.benefitDrivers ?? []).map((d, j) => (
                        <li key={j} className="flex items-start gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{p.breakEvenTimeline}</td>
                  <td className="px-3 py-3 font-bold text-slate-800 whitespace-nowrap">{p.roiMultiple}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${conf.className}`}>
                      {conf.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Programme totals strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-slate-400 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Total programme cost</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{roi.totalProgrammeCost}</p>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">3-year cumulative benefit</p>
            <p className="text-sm font-bold text-emerald-800 mt-0.5">{roi.totalThreeYearBenefit}</p>
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Programme payback</p>
            <p className="text-sm font-bold text-blue-800 mt-0.5">{roi.paybackPeriod}</p>
          </div>
        </div>
      </div>

      {/* ── Narrative ── */}
      {roi.narrative && (
        <p className="text-xs text-slate-600 leading-relaxed italic border-l-2 border-slate-300 pl-3">
          {roi.narrative}
        </p>
      )}

      {/* ── Key assumptions ── */}
      {roi.keyAssumptions?.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            Grounding assumptions
          </p>
          <ul className="space-y-1">
            {roi.keyAssumptions.map((a, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                <span className="text-slate-400 flex-shrink-0 mt-0.5">·</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Phase card colours ─────────────────────────────────────────────────────

const PHASE_COLORS = [
  {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    header: 'bg-blue-600',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
  },
  {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    header: 'bg-purple-700',
    badge: 'bg-purple-100 text-purple-700',
    dot: 'bg-purple-500',
  },
  {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    header: 'bg-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
  },
];

export function ExecutionRoadmapPanel({ data }: Props) {
  return (
    <div className="space-y-8">

      {/* ── Delivery Timeline (Gantt) ──────────────────────────────────────── */}
      {(data.phases ?? []).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Delivery Timeline
          </p>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <RoadmapGantt phases={data.phases} roiSummary={data.roiSummary} />
          </div>
        </div>
      )}

      {/* ── ROI & Benefits Realisation ────────────────────────────────────── */}
      {data.roiSummary?.phases?.length ? (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-700">ROI &amp; Benefits Realisation</h3>
            <span className="text-[10px] text-slate-400 italic">
              — estimates grounded in workshop signals, not guarantees
            </span>
          </div>
          <RoiTable roi={data.roiSummary} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
          <TrendingUp className="h-6 w-6 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400">ROI &amp; benefits estimates will appear here after regenerating Brain Scan</p>
        </div>
      )}

      {/* Critical path */}
      {data.criticalPath && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
            Critical Path
          </p>
          <p className="text-sm text-amber-800">{data.criticalPath}</p>
        </div>
      )}

      {/* Phase columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(data.phases ?? []).map((phase, i) => {
          const colors = PHASE_COLORS[i] ?? PHASE_COLORS[0];
          return (
            <div
              key={phase.phase}
              className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden flex flex-col`}
            >
              {/* Phase header */}
              <div className={`${colors.header} px-4 py-3 text-white`}>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">
                  {phase.phase.split(' — ')[0]}
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {phase.phase.split(' — ')[1] ?? phase.phase}
                </p>
                {phase.timeframe && (
                  <p className="text-xs opacity-70 mt-1">{phase.timeframe}</p>
                )}
              </div>

              <div className="p-4 flex-1 space-y-4">
                {/* Initiatives */}
                {(phase.initiatives ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Initiatives
                    </p>
                    <div className="space-y-2">
                      {phase.initiatives.map((init, j) => (
                        <div key={j} className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <div className="flex items-start gap-2">
                            <span className={`shrink-0 mt-1 w-2 h-2 rounded-full ${colors.dot}`} />
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{init.title}</p>
                              {init.description && (
                                <p className="text-xs text-slate-500 mt-0.5">{init.description}</p>
                              )}
                              {init.outcome && (
                                <p className="text-xs text-emerald-600 mt-1">
                                  <span className="font-medium">→ </span>{init.outcome}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Capabilities */}
                {(phase.capabilities ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Capabilities Required
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {phase.capabilities.map((cap, j) => (
                        <span
                          key={j}
                          className={`text-xs px-2 py-0.5 rounded-full ${colors.badge} font-medium`}
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dependencies */}
                {(phase.dependencies ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Dependencies
                    </p>
                    <ul className="space-y-1">
                      {phase.dependencies.map((dep, j) => (
                        <li key={j} className="text-xs text-slate-600 flex gap-2">
                          <span className="text-slate-300 shrink-0">↳</span>
                          {dep}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Constraints */}
                {(phase.constraints ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Constraints
                    </p>
                    <ul className="space-y-1">
                      {phase.constraints.map((c, j) => (
                        <li key={j} className="text-xs text-slate-500 flex gap-2">
                          <span className="text-red-300 shrink-0">!</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Key risks */}
      {(data.keyRisks ?? []).length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-700">Key Risks</h3>
          </div>
          <div className="space-y-2">
            {data.keyRisks.map((risk, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200"
              >
                <span className="shrink-0 text-amber-500 font-bold text-xs mt-0.5">{i + 1}</span>
                <p className="text-sm text-amber-800">{risk}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
