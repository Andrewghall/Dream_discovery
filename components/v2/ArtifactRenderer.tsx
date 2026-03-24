'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { Artifact, HeatmapData, GanttData, BarChartData, MatrixData, TimelineData } from '@/lib/output/v2-synthesis-agent';

// ── DREAM colour palette ───────────────────────────────────────────────────

const DREAM_COLOURS = ['#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4'];

// ── Heatmap ────────────────────────────────────────────────────────────────

function intensityToColour(intensity: number): string {
  // 0 = white, 5 = amber-200, 10 = red-500
  if (intensity <= 0) return '#f8fafc';
  if (intensity <= 2) return '#fef3c7';
  if (intensity <= 4) return '#fde68a';
  if (intensity <= 6) return '#fbbf24';
  if (intensity <= 8) return '#f97316';
  return '#ef4444';
}

function HeatmapChart({ data }: { data: HeatmapData }) {
  const { cells, actors, stages } = data;
  if (!actors?.length || !stages?.length) return null;

  const cellSize = Math.min(Math.floor(720 / stages.length), 80);

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Column headers (journey stages) */}
        <div className="flex" style={{ marginLeft: 120 }}>
          {stages.map((s) => (
            <div
              key={s}
              className="text-center text-xs font-semibold text-slate-600 pb-2 px-1"
              style={{ width: cellSize, flexShrink: 0 }}
            >
              {s}
            </div>
          ))}
        </div>
        {/* Rows (actors) */}
        {actors.map((actor) => (
          <div key={actor} className="flex items-center mb-1">
            <div
              className="text-xs font-medium text-slate-700 text-right pr-3 flex-shrink-0"
              style={{ width: 120 }}
            >
              {actor}
            </div>
            {stages.map((stage) => {
              const cell = cells.find((c) => c.actor === actor && c.stage === stage);
              const intensity = cell?.intensity ?? 0;
              return (
                <div
                  key={stage}
                  title={`${actor} / ${stage}: ${intensity}/10`}
                  className="rounded flex items-center justify-center text-xs font-bold cursor-default"
                  style={{
                    width: cellSize,
                    height: 36,
                    flexShrink: 0,
                    backgroundColor: intensityToColour(intensity),
                    color: intensity >= 7 ? '#fff' : '#374151',
                    margin: '0 2px',
                  }}
                >
                  {intensity > 0 ? intensity : ''}
                </div>
              );
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 ml-[120px]">
          <span className="text-xs text-slate-500">Pain intensity:</span>
          {[0, 2, 4, 6, 8, 10].map((v) => (
            <div key={v} className="flex items-center gap-1">
              <div
                className="w-5 h-4 rounded"
                style={{ backgroundColor: intensityToColour(v) }}
              />
              <span className="text-xs text-slate-500">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Gantt ──────────────────────────────────────────────────────────────────

function GanttChart({ data }: { data: GanttData }) {
  const { phases } = data;
  if (!phases?.length) return null;

  // Flatten initiatives into chart rows
  const rows: Array<{
    name: string;
    owner: string;
    phase: number;
    phaseLabel: string;
    color: string;
    startWeek: number;
    duration: number;
  }> = [];

  for (const phase of phases) {
    for (const initiative of phase.initiatives) {
      rows.push({
        name: initiative.name,
        owner: initiative.owner,
        phase: phase.phase,
        phaseLabel: phase.label,
        color: phase.color || DREAM_COLOURS[phase.phase - 1] || DREAM_COLOURS[0],
        startWeek: initiative.startWeek,
        duration: initiative.endWeek - initiative.startWeek,
      });
    }
  }

  if (!rows.length) return null;

  const maxWeek = Math.max(...rows.map((r) => r.startWeek + r.duration)) + 1;

  // Build chart data as stacked bars (offset + duration)
  const chartData = rows.map((r) => ({
    name: r.name.length > 28 ? r.name.slice(0, 26) + '…' : r.name,
    owner: r.owner,
    phaseLabel: r.phaseLabel,
    offset: r.startWeek,
    duration: r.duration,
    fill: r.color,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(rows.length * 42 + 60, 200)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 8, bottom: 24 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis
            type="number"
            domain={[0, maxWeek]}
            tickCount={Math.min(maxWeek + 1, 14)}
            label={{ value: 'Weeks', position: 'insideBottom', offset: -8, fontSize: 11 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={180}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value, name) => [
              name === 'duration' ? `${value} weeks` : null,
              name === 'duration' ? 'Duration' : null,
            ]}
            labelFormatter={(label) => {
              const row = chartData.find((r) => r.name === label);
              return row ? `${label} (${row.phaseLabel} · ${row.owner})` : label;
            }}
          />
          <Legend
            formatter={(value) => (value === 'duration' ? 'Initiative duration' : null)}
            wrapperStyle={{ fontSize: 11 }}
          />
          {/* Invisible offset bar to push real bar right */}
          <Bar dataKey="offset" stackId="g" fill="transparent" legendType="none" />
          {/* Actual duration bars — coloured per phase */}
          <Bar dataKey="duration" stackId="g" radius={[0, 3, 3, 0]}>
            {chartData.map((row, i) => (
              <Cell key={i} fill={row.fill} />
            ))}
          </Bar>
          {/* Today line at week 0 */}
          <ReferenceLine x={0} stroke="#64748b" strokeDasharray="4 2" label={{ value: 'Now', fontSize: 10, fill: '#64748b' }} />
        </BarChart>
      </ResponsiveContainer>
      {/* Phase legend */}
      <div className="flex flex-wrap gap-3 mt-2">
        {phases.map((p) => (
          <div key={p.phase} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color || DREAM_COLOURS[p.phase - 1] }} />
            <span className="text-xs text-slate-600">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bar chart ──────────────────────────────────────────────────────────────

function BarChartViz({ data }: { data: BarChartData }) {
  const { items, xLabel, yLabel } = data;
  if (!items?.length) return null;

  const chartData = items.map((item, i) => ({
    name: item.label.length > 22 ? item.label.slice(0, 20) + '…' : item.label,
    fullName: item.label,
    value: item.value,
    fill: item.color || DREAM_COLOURS[i % DREAM_COLOURS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(chartData.length * 40 + 80, 220)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 8, bottom: 24 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis
          type="number"
          label={{ value: xLabel, position: 'insideBottom', offset: -8, fontSize: 11 }}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          dataKey="name"
          type="category"
          width={160}
          tick={{ fontSize: 11 }}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11, offset: 10 }}
        />
        <Tooltip
          formatter={(value) => [value, xLabel]}
          labelFormatter={(label) => chartData.find((d) => d.name === label)?.fullName || label}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="value" name={xLabel} radius={[0, 4, 4, 0]}>
          {chartData.map((row, i) => (
            <Cell key={i} fill={row.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Matrix ─────────────────────────────────────────────────────────────────

function MatrixViz({ data }: { data: MatrixData }) {
  const { rows, cols, cells } = data;
  if (!rows?.length || !cols?.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="w-32 p-2" />
            {cols.map((c) => (
              <th key={c} className="p-2 text-center font-semibold text-slate-700 border border-slate-200 bg-slate-50">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <td className="p-2 font-medium text-slate-700 border border-slate-200 bg-slate-50 text-right">
                {row}
              </td>
              {cols.map((col) => {
                const cell = cells.find((c) => c.row === row && c.col === col);
                return (
                  <td key={col} className="p-2 text-center border border-slate-200 text-slate-600">
                    {cell?.value || '–'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Timeline ───────────────────────────────────────────────────────────────

function TimelineViz({ data }: { data: TimelineData }) {
  const { events } = data;
  if (!events?.length) return null;

  const sorted = [...events].sort((a, b) => a.week - b.week);

  return (
    <div className="relative">
      {/* Track line */}
      <div className="absolute top-5 left-12 right-0 h-0.5 bg-slate-200" />
      <div className="flex gap-4 overflow-x-auto pb-2">
        {sorted.map((event, i) => (
          <div key={i} className="relative flex flex-col items-center min-w-[120px]">
            {/* Dot */}
            <div
              className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md"
              style={{ backgroundColor: event.color || DREAM_COLOURS[i % DREAM_COLOURS.length] }}
            >
              W{event.week}
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-800 text-center leading-tight">
              {event.label}
            </div>
            <div className="mt-1 text-xs text-slate-500 text-center leading-relaxed">
              {event.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main renderer ──────────────────────────────────────────────────────────

interface ArtifactRendererProps {
  artifact: Artifact;
  className?: string;
}

export function ArtifactRenderer({ artifact, className }: ArtifactRendererProps) {
  if (!artifact || artifact.type === 'none' || !artifact.data) return null;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className || ''}`}>
      {artifact.type === 'heatmap' && <HeatmapChart data={artifact.data as HeatmapData} />}
      {artifact.type === 'gantt' && <GanttChart data={artifact.data as GanttData} />}
      {artifact.type === 'bar_chart' && <BarChartViz data={artifact.data as BarChartData} />}
      {artifact.type === 'matrix' && <MatrixViz data={artifact.data as MatrixData} />}
      {artifact.type === 'timeline' && <TimelineViz data={artifact.data as TimelineData} />}
    </div>
  );
}
