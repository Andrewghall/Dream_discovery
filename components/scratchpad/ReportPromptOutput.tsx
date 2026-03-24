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
import { CheckCircle2, PlusCircle } from 'lucide-react';

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

interface ReportPromptOutputProps {
  output: PromptOutput;
  onAddToReport?: (title: string, content: string) => void;
}

export function ReportPromptOutput({ output, onAddToReport }: ReportPromptOutputProps) {
  // Build plain-text version of the output for "Add to report"
  const plainText = (() => {
    if (output.type === 'text') return output.content;
    if (output.type === 'bullets') return output.items.join('\n');
    if (output.type === 'table') return output.rows.map(r => r.join('\t')).join('\n');
    return output.title;
  })();

  const card = (() => {
    switch (output.type) {
      case 'text':       return <TextCard data={output} />;
      case 'bar_chart':  return <BarChartCard data={output} />;
      case 'table':      return <TableCard data={output} />;
      case 'bullets':    return <BulletsCard data={output} />;
      default:           return null;
    }
  })();

  if (!card) return null;

  return (
    <div className="relative group">
      {card}
      {onAddToReport && (
        <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAddToReport(output.title, plainText)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md transition-all"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add to report
          </button>
        </div>
      )}
    </div>
  );
}
