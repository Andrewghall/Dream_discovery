'use client';

import type { Signal, SignalType, SessionConfidence } from '@/lib/cognitive-guidance/pipeline';

const DOT_COLORS: Record<SignalType, string> = {
  contradiction: 'bg-red-500',
  missing_dimension: 'bg-amber-500',
  risk_cluster: 'bg-orange-500',
  weak_enabler: 'bg-amber-500',
  high_freq_constraint: 'bg-orange-500',
  unanswered_question: 'bg-blue-500',
  repeated_theme: 'bg-slate-500',
};

const LENS_BADGE_COLORS: Record<string, string> = {
  People: 'bg-purple-100 text-purple-700',
  Organisation: 'bg-orange-100 text-orange-700',
  Customer: 'bg-blue-100 text-blue-700',
  Technology: 'bg-emerald-100 text-emerald-700',
  Regulation: 'bg-pink-100 text-pink-700',
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
  sessionConfidence: SessionConfidence;
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export default function SignalClusterPanel({ signals, sessionConfidence }: Props) {
  const sorted = [...signals].sort((a, b) => b.strength - a.strength);

  return (
    <div className="w-80 flex flex-col gap-4 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      {/* Section 1: Signals */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Signals</h3>
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-gray-200 text-[11px] font-medium text-gray-700">
            {signals.length}
          </span>
        </div>

        {sorted.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No signals detected yet</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sorted.map((signal) => (
              <li key={signal.id} className="flex flex-col gap-1">
                {/* Type dot + label */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[signal.type]}`}
                  />
                  <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                    {SIGNAL_LABELS[signal.type]}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-700 leading-snug pl-3.5">
                  {signal.description}
                </p>

                {/* Strength bar */}
                <div className="pl-3.5">
                  <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gray-400 transition-all duration-300"
                      style={{ width: `${signal.strength * 100}%` }}
                    />
                  </div>
                </div>

                {/* Lens tags */}
                {signal.lenses.length > 0 && (
                  <div className="flex gap-1 pl-3.5 flex-wrap">
                    {signal.lenses.map((lens) => (
                      <span
                        key={lens}
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          LENS_BADGE_COLORS[lens] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {lens}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Divider */}
      <hr className="border-gray-200" />

      {/* Section 2: Session Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Session Metrics</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Overall Confidence"
            value={formatPercent(sessionConfidence.overallConfidence)}
          />
          <MetricCard
            label="Categorised Rate"
            value={formatPercent(sessionConfidence.categorisedRate)}
          />
          <MetricCard
            label="Lens Coverage"
            value={formatPercent(sessionConfidence.lensCoverageRate)}
          />
          <MetricCard
            label="Active Contradictions"
            value={String(sessionConfidence.contradictionCount)}
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-gray-50 px-2.5 py-2">
      <span className="text-[10px] text-gray-500 leading-tight">{label}</span>
      <span className="text-sm font-semibold text-gray-900 tabular-nums">{value}</span>
    </div>
  );
}
