'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AlertTriangle, TrendingUp, DollarSign, CheckCircle2, Info, Edit3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, ReferenceArea,
} from 'recharts';
import type { ExecutionRoadmap, RoadmapPhase, RoiSummary, RoiPhaseEstimate } from '@/lib/output-intelligence/types';

interface Props {
  data: ExecutionRoadmap;
}

// ── ROI parse helpers ─────────────────────────────────────────────────────────

/** Parse "£250k – £400k" or "£1m – £1.5m" → midpoint in £k */
function parseMidKGBP(s: string): number {
  if (!s) return 0;
  const matches = [...s.matchAll(/£\s*(\d+(?:\.\d+)?)\s*(k|m)/gi)];
  if (!matches.length) return 0;
  const vals = matches.map(m => {
    const n = parseFloat(m[1]);
    return m[2].toLowerCase() === 'm' ? n * 1000 : n;
  });
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Parse break-even like "6-9 months post-delivery" → weeks from start of that phase */
function parseBreakEvenWeek(timeline: string, phaseEndWeek: number): number {
  const range = timeline.match(/(\d+)\s*[-–]\s*(\d+)\s*months?/i);
  if (range) {
    const avg = (parseInt(range[1]) + parseInt(range[2])) / 2;
    return Math.round(phaseEndWeek + avg * 4.33);
  }
  const single = timeline.match(/(\d+)\s*months?/i);
  if (single) return Math.round(phaseEndWeek + parseInt(single[1]) * 4.33);
  return phaseEndWeek + 26;
}

// Real delivery windows in weeks (Phase 1 = 0–3 months, Phase 2 = 3–9 months, Phase 3 = 9–18 months)
// Previously used compressed chart units [0,4],[4,12],[12,52] which caused break-even calc to place
// benefit accrual start mostly beyond the visible range — benefit line never crossed cost.
const PHASE_WINDOWS: [number, number][] = [[0, 13], [13, 39], [39, 78]];

/** Build cumulative cost + benefit curve at 2-week intervals, 0–156 (3 years) */
function buildRoiCurve(
  phases: RoiPhaseEstimate[],
): Array<{ week: number; cost: number; benefit: number }> {
  const costs    = phases.map(p => parseMidKGBP(p.estimatedCost));
  const benefits = phases.map(p => parseMidKGBP(p.estimatedAnnualBenefit) / 52); // per week
  const breakEvens = phases.map((p, i) =>
    parseBreakEvenWeek(p.breakEvenTimeline, PHASE_WINDOWS[i]?.[1] ?? 78)
  );

  const STEP = 2;
  let cCost = 0, cBenefit = 0;
  const points: Array<{ week: number; cost: number; benefit: number }> = [];

  // Extend to W156 (3 years) so the benefit line has room to cross the cost line
  for (let w = 0; w <= 156; w += STEP) {
    for (let ph = 0; ph < phases.length; ph++) {
      const [start, end] = PHASE_WINDOWS[ph] ?? [0, 13];
      if (w > start && w <= end) {
        cCost += (costs[ph] / (end - start)) * STEP;
      }
    }
    for (let ph = 0; ph < phases.length; ph++) {
      const be = breakEvens[ph] ?? 999;
      if (w >= be) cBenefit += benefits[ph] * STEP;
    }
    points.push({ week: w, cost: Math.round(cCost), benefit: Math.round(cBenefit) });
  }
  return points;
}

/** Format £k value for Y axis labels */
function fmtGBP(k: number) {
  if (k >= 1000) return `£${(k / 1000).toFixed(k % 1000 === 0 ? 0 : 1)}m`;
  return k === 0 ? '£0' : `£${Math.round(k)}k`;
}

// ── Editable cell ─────────────────────────────────────────────────────────────

function EditableCell({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    onChange(trimmed || value);
    setEditing(false);
  }, [draft, value, onChange]);

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className={`border border-indigo-400 rounded px-1.5 py-0.5 text-xs outline-none bg-indigo-50 w-full ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
      className={`group cursor-text inline-flex items-center gap-0.5 hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-200 rounded px-0.5 transition-colors ${className}`}
    >
      {value}
      <Edit3 className="h-2.5 w-2.5 text-indigo-300 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
    </span>
  );
}

// ── Gantt chart ───────────────────────────────────────────────────────────────

// Real week windows: Phase 1 = 3 months (W0–W13), Phase 2 = 3–9 months (W13–W39), Phase 3 = 9–18 months (W39–W78)
const GANTT_PHASE_WEEKS = [
  { start: 0,  end: 13 },
  { start: 13, end: 39 },
  { start: 39, end: 78 },
] as const;

const GANTT_PHASE_COLORS = ['#2563eb', '#7e22ce', '#047857'] as const;

const PHASE_BANDS = [
  { x1: 0,  x2: 13, mid: 6,  fill: '#2563eb' },
  { x1: 13, x2: 39, mid: 26, fill: '#7e22ce' },
  { x1: 39, x2: 78, mid: 58, fill: '#047857' },
] as const;

// Recharts margins — must match exactly for SVG overlay alignment
const CHART_MARGIN = { top: 8, right: 24, bottom: 28, left: 8 } as const;
const Y_AXIS_W = 170;
// Effective chart area offsets:
//   left  = CHART_MARGIN.left + Y_AXIS_W
//   right = CHART_MARGIN.right
//   top   = CHART_MARGIN.top
//   bottom = CHART_MARGIN.bottom + ~12 (axis label line) = 40

function GanttOverlay({
  roiCurve,
  containerW,
  containerH,
}: {
  roiCurve: Array<{ week: number; cost: number; benefit: number }>;
  containerW: number;
  containerH: number;
}) {
  if (!roiCurve.length || containerW < 10 || containerH < 10) return null;

  const left   = CHART_MARGIN.left + Y_AXIS_W;
  const right  = CHART_MARGIN.right;
  const top    = CHART_MARGIN.top;
  const bottom = 40; // CHART_MARGIN.bottom + axis label

  const cW = containerW - left - right;
  const cH = containerH - top - bottom;

  const maxVal = Math.max(...roiCurve.map(p => Math.max(p.cost, p.benefit)), 100);
  const yMax   = maxVal * 1.3;

  const xPx = (week: number) => left + (week / 156) * cW; // 156 = 3yr chart domain
  const yPx = (val: number)  => top  + cH * (1 - val / yMax);

  // SVG path helpers
  const costPts    = roiCurve.map(p => `${xPx(p.week).toFixed(1)},${yPx(p.cost).toFixed(1)}`);
  const benefitPts = roiCurve.map(p => `${xPx(p.week).toFixed(1)},${yPx(p.benefit).toFixed(1)}`);
  const costPath    = `M${costPts.join(' L')}`;
  const benefitPath = `M${benefitPts.join(' L')}`;

  // Benefit area fill (under the benefit line)
  const benefitAreaPath = [
    `M${xPx(0).toFixed(1)},${yPx(0).toFixed(1)}`,
    ...roiCurve.map(p => `L${xPx(p.week).toFixed(1)},${yPx(p.benefit).toFixed(1)}`),
    `L${xPx(156).toFixed(1)},${yPx(0).toFixed(1)}`,
    'Z',
  ].join(' ');

  // Find payback crossover
  let payback: { week: number; val: number } | null = null;
  for (let i = 1; i < roiCurve.length; i++) {
    if (roiCurve[i].benefit >= roiCurve[i].cost &&
        roiCurve[i - 1].benefit < roiCurve[i - 1].cost) {
      payback = { week: roiCurve[i].week, val: roiCurve[i].cost };
      break;
    }
  }

  // Right-side Y ticks for monetary scale
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    val: yMax * pct,
    y: yPx(yMax * pct),
  }));

  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', overflow: 'visible',
        zIndex: 10,
      }}
      viewBox={`0 0 ${containerW} ${containerH}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="roi-benefit-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Benefit fill area */}
      <path d={benefitAreaPath} fill="url(#roi-benefit-grad)" />

      {/* Cumulative cost (dashed red) */}
      <path d={costPath} fill="none" stroke="#dc2626" strokeWidth="3"
            strokeDasharray="8,4" opacity="1" strokeLinecap="round" />

      {/* Cumulative benefit (solid green) */}
      <path d={benefitPath} fill="none" stroke="#059669" strokeWidth="3.5"
            opacity="1" strokeLinecap="round" />

      {/* Payback marker */}
      {payback && (
        <g>
          <line
            x1={xPx(payback.week)} y1={top}
            x2={xPx(payback.week)} y2={top + cH}
            stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.7"
          />
          <circle
            cx={xPx(payback.week)} cy={yPx(payback.val)}
            r="5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5"
          />
          <rect
            x={xPx(payback.week) + 8} y={yPx(payback.val) - 20}
            width="68" height="16" rx="3" fill="#fef3c7" stroke="#f59e0b"
            strokeWidth="0.75" fillOpacity="0.95"
          />
          <text
            x={xPx(payback.week) + 12} y={yPx(payback.val) - 8}
            fontSize="8" fontWeight="700" fill="#b45309"
          >
            Payback ~{Math.round(payback.week / 4.33)}mo
          </text>
        </g>
      )}

      {/* Right-side monetary Y axis */}
      <line
        x1={containerW - right} y1={top}
        x2={containerW - right} y2={top + cH}
        stroke="#e2e8f0" strokeWidth="0.75"
      />
      {yTicks.map(({ val, y }, i) => (
        <g key={i}>
          <line x1={containerW - right - 3} y1={y} x2={containerW - right} y2={y}
                stroke="#cbd5e1" strokeWidth="0.75" />
          <text
            x={containerW - right + 4} y={y}
            fontSize="7.5" fill="#94a3b8" dominantBaseline="middle"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {fmtGBP(val)}
          </text>
        </g>
      ))}

      {/* Mini legend */}
      <rect x={left + 8} y={top + 6} width="104" height="36"
            rx="4" fill="white" fillOpacity="0.92" stroke="#e2e8f0" strokeWidth="0.75" />
      {/* Cost line */}
      <line x1={left + 14} y1={top + 17} x2={left + 26} y2={top + 17}
            stroke="#ef4444" strokeWidth="2" strokeDasharray="5,3" />
      <text x={left + 30} y={top + 21} fontSize="7.5" fill="#64748b"
            style={{ fontFamily: 'system-ui, sans-serif' }}>
        Cumul. cost
      </text>
      {/* Benefit line */}
      <line x1={left + 14} y1={top + 30} x2={left + 26} y2={top + 30}
            stroke="#10b981" strokeWidth="2.5" />
      <text x={left + 30} y={top + 34} fontSize="7.5" fill="#64748b"
            style={{ fontFamily: 'system-ui, sans-serif' }}>
        Cumul. benefit
      </text>
    </svg>
  );
}

function RoadmapGantt({
  phases,
  editableRoi,
}: {
  phases: RoadmapPhase[];
  editableRoi?: RoiSummary;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setContainerW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) =>
      setContainerW(entry.contentRect.width)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── MUST be before early returns to satisfy Rules of Hooks ────────────────
  const roiCurve = useMemo(
    () => editableRoi?.phases?.length ? buildRoiCurve(editableRoi.phases) : [],
    [editableRoi],
  );

  if (!phases?.length) return null;

  // Build Gantt rows
  const rows: Array<{ name: string; color: string; offset: number; duration: number }> = [];
  phases.forEach((phase, phaseIdx) => {
    const window = GANTT_PHASE_WEEKS[phaseIdx] ?? GANTT_PHASE_WEEKS[0];
    const color  = GANTT_PHASE_COLORS[phaseIdx] ?? GANTT_PHASE_COLORS[0];
    const inits  = phase.initiatives ?? [];
    const count  = Math.max(inits.length, 1);
    const span   = window.end - window.start;
    inits.forEach((init, initIdx) => {
      const segSize  = Math.floor(span / count);
      const startWeek = window.start + initIdx * segSize;
      const endWeek   = initIdx === count - 1 ? window.end : startWeek + segSize;
      rows.push({
        name: init.title.length > 30 ? init.title.slice(0, 28) + '…' : init.title,
        color,
        offset: startWeek - 1,
        duration: endWeek - startWeek + 1,
      });
    });
  });

  if (!rows.length) return null;

  const ganttHeight = Math.max(rows.length * 42 + 60, 180);

  return (
    <div>
      {/* Gantt + overlay wrapper */}
      <div ref={wrapperRef} style={{ position: 'relative', height: ganttHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={CHART_MARGIN}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />

            {/* Phase bands */}
            {PHASE_BANDS.map((band, i) => (
              <ReferenceArea
                key={i} x1={band.x1} x2={band.x2}
                fill={band.fill} fillOpacity={0.06}
                stroke={band.fill} strokeOpacity={0.2} strokeWidth={1}
              />
            ))}

            {/* Cost labels from editableRoi */}
            {PHASE_BANDS.map((band, i) => {
              const cost = editableRoi?.phases?.[i]?.estimatedCost;
              return cost ? (
                <ReferenceLine
                  key={`cost-${i}`} x={band.mid} stroke="transparent"
                  label={{
                    value: `💰 ${cost}`, position: 'insideTop',
                    fill: band.fill, fontSize: 9, fontWeight: 700,
                  }}
                />
              ) : null;
            })}

            <XAxis
              type="number" domain={[0, 156]}
              ticks={[0, 13, 39, 78, 104, 130, 156]}
              tickFormatter={v => {
                if (v === 0) return 'Now';
                if (v === 13) return '3 mo';
                if (v === 39) return '9 mo';
                if (v === 78) return '18 mo';
                if (v === 104) return '2 yr';
                if (v === 130) return '2.5 yr';
                if (v === 156) return '3 yr';
                return `W${v}`;
              }}
              tick={{ fontSize: 10 }}
              label={{ value: 'Timeline from kickoff', position: 'insideBottom', offset: -12, fontSize: 11 }}
            />
            <YAxis dataKey="name" type="category" width={Y_AXIS_W} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(value, name) =>
                name === 'duration' ? [`${value} weeks`, 'Duration'] : [null, null]
              }
            />
            <Bar dataKey="offset"   stackId="g" fill="transparent" legendType="none" isAnimationActive={false} />
            <Bar dataKey="duration" stackId="g" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {rows.map((row, i) => <Cell key={i} fill={row.color} />)}
            </Bar>
            <ReferenceLine x={0} stroke="#64748b" strokeDasharray="4 2" />
          </BarChart>
        </ResponsiveContainer>

        {/* ROI line overlay — only render once ResizeObserver has the real width */}
        {roiCurve.length > 0 && containerW > 0 && (
          <GanttOverlay
            roiCurve={roiCurve}
            containerW={containerW}
            containerH={ganttHeight}
          />
        )}
      </div>

      {/* Phase legend */}
      <div className="flex flex-wrap gap-4 mt-1 ml-2">
        {phases.map((phase, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: GANTT_PHASE_COLORS[i] ?? GANTT_PHASE_COLORS[0] }} />
            <span className="text-xs text-slate-500">
              {phase.phase.split(' — ')[0]}
              {phase.timeframe ? ` (${phase.timeframe})` : ''}
              {editableRoi?.phases?.[i]?.estimatedCost
                ? ` · ${editableRoi.phases[i].estimatedCost}`
                : ''}
            </span>
          </div>
        ))}
        {/* ROI overlay legend */}
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200">
          <svg width="18" height="8">
            <line x1="0" y1="4" x2="18" y2="4" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,3" />
          </svg>
          <span className="text-xs text-slate-400">Cumul. cost</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="18" height="8">
            <line x1="0" y1="4" x2="18" y2="4" stroke="#10b981" strokeWidth="2.5" />
          </svg>
          <span className="text-xs text-slate-400">Cumul. benefit</span>
        </div>
      </div>
    </div>
  );
}

// ── ROI Table — editable ──────────────────────────────────────────────────────

const CONFIDENCE_STYLES: Record<string, string> = {
  High:   'bg-emerald-100 text-emerald-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low:    'bg-slate-100 text-slate-500',
};

const PHASE_ROI_ACCENTS = ['border-blue-300',   'border-purple-300',  'border-emerald-300'];
const PHASE_ROI_HEADER  = ['text-blue-700',     'text-purple-700',    'text-emerald-700' ];
const CONFIDENCE_CYCLE: RoiPhaseEstimate['confidenceLevel'][] = ['High', 'Medium', 'Low'];

function RoiTable({
  roi,
  updatePhase,
  updateSummary,
}: {
  roi: RoiSummary;
  updatePhase: (idx: number, field: keyof RoiPhaseEstimate, value: string) => void;
  updateSummary: (field: 'totalProgrammeCost' | 'totalThreeYearBenefit' | 'paybackPeriod', value: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Edit hint */}
      <div className="flex items-center gap-1.5 text-[10px] text-indigo-500 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 w-fit">
        <Edit3 className="h-3 w-3" />
        Click any value to edit — the Gantt chart updates live
      </div>

      {/* Per-phase grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 w-20">Phase</th>
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

                  {/* Editable: cost */}
                  <td className="px-3 py-3 font-medium whitespace-nowrap">
                    <EditableCell
                      value={p.estimatedCost}
                      onChange={v => updatePhase(i, 'estimatedCost', v)}
                      className="text-slate-700"
                    />
                  </td>

                  {/* Editable: annual benefit */}
                  <td className="px-3 py-3 font-medium whitespace-nowrap">
                    <EditableCell
                      value={p.estimatedAnnualBenefit}
                      onChange={v => updatePhase(i, 'estimatedAnnualBenefit', v)}
                      className="text-emerald-700"
                    />
                  </td>

                  {/* Benefit drivers — static (too long to inline-edit nicely) */}
                  <td className="px-3 py-3 text-slate-600">
                    <ul className="space-y-0.5">
                      {(p.benefitDrivers ?? []).map((d, j) => (
                        <li key={j} className="flex items-start gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </td>

                  {/* Editable: break-even */}
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                    <EditableCell
                      value={p.breakEvenTimeline}
                      onChange={v => updatePhase(i, 'breakEvenTimeline', v)}
                    />
                  </td>

                  {/* Editable: ROI multiple */}
                  <td className="px-3 py-3 font-bold text-slate-800 whitespace-nowrap">
                    <EditableCell
                      value={p.roiMultiple}
                      onChange={v => updatePhase(i, 'roiMultiple', v)}
                    />
                  </td>

                  {/* Confidence — click to cycle */}
                  <td className="px-3 py-3">
                    <button
                      onClick={() => {
                        const idx = CONFIDENCE_CYCLE.indexOf(p.confidenceLevel);
                        const next = CONFIDENCE_CYCLE[(idx + 1) % CONFIDENCE_CYCLE.length];
                        updatePhase(i, 'confidenceLevel', next);
                      }}
                      title="Click to change"
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer hover:opacity-80 transition-opacity ${conf}`}
                    >
                      {p.confidenceLevel}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Programme totals strip — editable */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-slate-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Total programme cost</p>
            <EditableCell
              value={roi.totalProgrammeCost}
              onChange={v => updateSummary('totalProgrammeCost', v)}
              className="text-sm font-bold text-slate-800"
            />
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-emerald-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">3-year cumulative benefit</p>
            <EditableCell
              value={roi.totalThreeYearBenefit}
              onChange={v => updateSummary('totalThreeYearBenefit', v)}
              className="text-sm font-bold text-emerald-800"
            />
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-blue-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Programme payback</p>
            <EditableCell
              value={roi.paybackPeriod}
              onChange={v => updateSummary('paybackPeriod', v)}
              className="text-sm font-bold text-blue-800"
            />
          </div>
        </div>
      </div>

      {/* Narrative */}
      {roi.narrative && (
        <p className="text-xs text-slate-600 leading-relaxed italic border-l-2 border-slate-300 pl-3">
          {roi.narrative}
        </p>
      )}

      {/* Key assumptions */}
      {(roi.keyAssumptions?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            Grounding assumptions
          </p>
          <ul className="space-y-1">
            {roi.keyAssumptions.map((a, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                <span className="text-slate-400 shrink-0 mt-0.5">·</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Phase card colours ────────────────────────────────────────────────────────

const PHASE_COLORS = [
  { bg: 'bg-blue-50',    border: 'border-blue-200',    header: 'bg-blue-600',    badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'    },
  { bg: 'bg-purple-50',  border: 'border-purple-200',  header: 'bg-purple-700',  badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500'  },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-emerald-700', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
];

// ── Main panel ────────────────────────────────────────────────────────────────

export function ExecutionRoadmapPanel({ data }: Props) {
  const [editableRoi, setEditableRoi] = useState<RoiSummary | undefined>(
    data.roiSummary ?? undefined
  );

  // Sync if parent data changes (e.g., Brain Scan re-run)
  useEffect(() => {
    if (data.roiSummary) setEditableRoi(data.roiSummary);
  }, [data.roiSummary]);

  const updatePhase = useCallback((idx: number, field: keyof RoiPhaseEstimate, value: string) => {
    setEditableRoi(prev => {
      if (!prev) return prev;
      const phases = [...prev.phases];
      phases[idx] = { ...phases[idx], [field]: value } as RoiPhaseEstimate;
      return { ...prev, phases };
    });
  }, []);

  const updateSummary = useCallback(
    (field: 'totalProgrammeCost' | 'totalThreeYearBenefit' | 'paybackPeriod', value: string) => {
      setEditableRoi(prev => prev ? { ...prev, [field]: value } : prev);
    },
    [],
  );

  return (
    <div className="space-y-8">

      {/* ── Delivery Timeline + ROI overlay ─────────────────────────────── */}
      {(data.phases ?? []).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Delivery Timeline
          </p>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <RoadmapGantt phases={data.phases} editableRoi={editableRoi} />
          </div>
        </div>
      )}

      {/* ── ROI & Benefits Realisation (editable) ───────────────────────── */}
      {editableRoi?.phases?.length ? (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-700">ROI &amp; Benefits Realisation</h3>
            <span className="text-[10px] text-slate-400 italic">
              — estimates grounded in workshop signals, not guarantees
            </span>
          </div>
          <RoiTable
            roi={editableRoi}
            updatePhase={updatePhase}
            updateSummary={updateSummary}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
          <TrendingUp className="h-6 w-6 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400">ROI &amp; benefits estimates will appear after regenerating Brain Scan</p>
        </div>
      )}

      {/* Critical path */}
      {data.criticalPath && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Critical Path</p>
          <p className="text-sm text-amber-800">{data.criticalPath}</p>
        </div>
      )}

      {/* Phase columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(data.phases ?? []).map((phase, i) => {
          const colors = PHASE_COLORS[i] ?? PHASE_COLORS[0];
          return (
            <div key={phase.phase} className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden flex flex-col`}>
              <div className={`${colors.header} px-4 py-3 text-white`}>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">
                  {phase.phase.split(' — ')[0]}
                </p>
                <p className="text-sm font-semibold mt-0.5">{phase.phase.split(' — ')[1] ?? phase.phase}</p>
                {phase.timeframe && <p className="text-xs opacity-70 mt-1">{phase.timeframe}</p>}
              </div>

              <div className="p-4 flex-1 space-y-4">
                {(phase.initiatives ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Initiatives</p>
                    <div className="space-y-2">
                      {phase.initiatives.map((init, j) => (
                        <div key={j} className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <div className="flex items-start gap-2">
                            <span className={`shrink-0 mt-1 w-2 h-2 rounded-full ${colors.dot}`} />
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{init.title}</p>
                              {init.description && <p className="text-xs text-slate-500 mt-0.5">{init.description}</p>}
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

                {(phase.capabilities ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Capabilities Required</p>
                    <div className="flex flex-wrap gap-1">
                      {phase.capabilities.map((cap, j) => (
                        <span key={j} className={`text-xs px-2 py-0.5 rounded-full ${colors.badge} font-medium`}>{cap}</span>
                      ))}
                    </div>
                  </div>
                )}

                {(phase.dependencies ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dependencies</p>
                    <ul className="space-y-1">
                      {phase.dependencies.map((dep, j) => (
                        <li key={j} className="text-xs text-slate-600 flex gap-2">
                          <span className="text-slate-300 shrink-0">↳</span>{dep}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(phase.constraints ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Constraints</p>
                    <ul className="space-y-1">
                      {phase.constraints.map((c, j) => (
                        <li key={j} className="text-xs text-slate-500 flex gap-2">
                          <span className="text-red-300 shrink-0">!</span>{c}
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
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
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
