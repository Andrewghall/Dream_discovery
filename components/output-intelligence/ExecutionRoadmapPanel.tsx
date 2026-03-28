'use client';

import { AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { ExecutionRoadmap, RoadmapPhase } from '@/lib/output-intelligence/types';

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

function RoadmapGantt({ phases }: { phases: RoadmapPhase[] }) {
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
        offset: startWeek - 1,    // invisible offset bar (0-based for Recharts)
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
              return row ? `${label}  ·  ${row.phaseLabel}` : label;
            }}
          />
          {/* Transparent offset bar pushes real bar to correct start position */}
          <Bar dataKey="offset" stackId="g" fill="transparent" legendType="none" isAnimationActive={false} />
          {/* Duration bar — coloured per phase */}
          <Bar dataKey="duration" stackId="g" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {rows.map((row, i) => <Cell key={i} fill={row.color} />)}
          </Bar>
          <ReferenceLine x={0} stroke="#64748b" strokeDasharray="4 2" />
        </BarChart>
      </ResponsiveContainer>
      {/* Phase colour legend */}
      <div className="flex flex-wrap gap-4 mt-1 ml-2">
        {phases.map((phase, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: GANTT_PHASE_COLORS[i] ?? GANTT_PHASE_COLORS[0] }}
            />
            <span className="text-xs text-slate-500">
              {phase.phase.split(' — ')[0]}
              {phase.timeframe ? ` (${phase.timeframe})` : ''}
            </span>
          </div>
        ))}
      </div>
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
            <RoadmapGantt phases={data.phases} />
          </div>
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
