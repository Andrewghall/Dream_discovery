'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CheckCircle2 } from 'lucide-react';

// ── Output types ──────────────────────────────────────────────────────────────

export type PromptOutputType = 'text' | 'bar_chart' | 'table' | 'bullets';

export interface TextOutput {
  type: 'text';
  title: string;
  content: string;
}

export interface BarChartOutput {
  type: 'bar_chart';
  title: string;
  labels: string[];
  values: number[];
  xLabel?: string;
  yLabel?: string;
}

export interface TableOutput {
  type: 'table';
  title: string;
  headers: string[];
  rows: string[][];
}

export interface BulletsOutput {
  type: 'bullets';
  title: string;
  items: string[];
}

export type PromptOutput = TextOutput | BarChartOutput | TableOutput | BulletsOutput;

// ── Renderers ─────────────────────────────────────────────────────────────────

function TextCard({ data }: { data: TextOutput }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{data.title}</h3>
      <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
        {data.content}
      </div>
    </div>
  );
}

function BarChartCard({ data }: { data: BarChartOutput }) {
  const chartData = data.labels.map((label, i) => ({
    name: label,
    value: data.values[i] ?? 0,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">{data.title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            angle={-30}
            textAnchor="end"
            interval={0}
            label={
              data.xLabel
                ? { value: data.xLabel, position: 'insideBottom', offset: -28, fontSize: 11 }
                : undefined
            }
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            label={
              data.yLabel
                ? { value: data.yLabel, angle: -90, position: 'insideLeft', fontSize: 11 }
                : undefined
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TableCard({ data }: { data: TableOutput }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{data.title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {data.headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2.5 text-foreground align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulletsCard({ data }: { data: BulletsOutput }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{data.title}</h3>
      <ul className="space-y-2">
        {data.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ReportPromptOutput({ output }: { output: PromptOutput }) {
  switch (output.type) {
    case 'text':
      return <TextCard data={output} />;
    case 'bar_chart':
      return <BarChartCard data={output} />;
    case 'table':
      return <TableCard data={output} />;
    case 'bullets':
      return <BulletsCard data={output} />;
    default:
      return null;
  }
}
