'use client';

import type { Signal, SignalType } from '@/lib/cognitive-guidance/pipeline';

const SIGNAL_COLORS: Record<SignalType, string> = {
  contradiction: 'bg-red-100 text-red-800 border-red-300',
  missing_dimension: 'bg-amber-100 text-amber-800 border-amber-300',
  risk_cluster: 'bg-orange-100 text-orange-800 border-orange-300',
  weak_enabler: 'bg-amber-100 text-amber-800 border-amber-300',
  high_freq_constraint: 'bg-orange-100 text-orange-800 border-orange-300',
  unanswered_question: 'bg-blue-100 text-blue-800 border-blue-300',
  repeated_theme: 'bg-slate-100 text-slate-700 border-slate-300',
};

const SIGNAL_LABELS: Record<SignalType, string> = {
  contradiction: 'Contradiction',
  missing_dimension: 'Missing Dimension',
  risk_cluster: 'Risk Cluster',
  weak_enabler: 'Weak Enabler',
  high_freq_constraint: 'High Freq Constraint',
  unanswered_question: 'Unanswered Question',
  repeated_theme: 'Repeated Theme',
};

type Props = {
  signals: Signal[];
};

export default function GapIndicatorStrip({ signals }: Props) {
  if (signals.length === 0) return null;

  const sorted = [...signals].sort((a, b) => b.strength - a.strength);

  return (
    <div className="flex gap-1 overflow-x-auto">
      {sorted.map((signal) => (
        <div
          key={signal.id}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap shrink-0 ${SIGNAL_COLORS[signal.type]}`}
        >
          <span>{SIGNAL_LABELS[signal.type]}</span>
          <span className="text-[10px] opacity-70">
            {(signal.strength * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}
