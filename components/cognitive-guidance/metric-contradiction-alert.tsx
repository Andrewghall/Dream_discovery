'use client';

import { AlertTriangle, X } from 'lucide-react';
import type { Signal } from '@/lib/cognitive-guidance/pipeline';

type Props = {
  signals: Signal[];
  onDismiss: (signalId: string) => void;
};

export default function MetricContradictionAlert({ signals, onDismiss }: Props) {
  const contradictions = signals.filter((s) => s.type === 'metric_contradiction');

  if (contradictions.length === 0) return null;

  return (
    <div className="space-y-2">
      {contradictions.map((signal) => (
        <div
          key={signal.id}
          className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 dark:bg-amber-950/30 dark:border-amber-700/50"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Data mismatch detected
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-snug">
              {signal.description}
            </p>
            {signal.lenses.length > 0 && (
              <div className="flex gap-1 mt-1">
                {signal.lenses.map((lens) => (
                  <span
                    key={lens}
                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                  >
                    {lens}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onDismiss(signal.id)}
            className="p-1 rounded hover:bg-amber-100 text-amber-500 hover:text-amber-700 transition-colors shrink-0"
            title="Dismiss alert"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
