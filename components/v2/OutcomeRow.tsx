'use client';

import type { V2Outcome } from '@/lib/output/v2-synthesis-agent';

interface OutcomeRowProps {
  outcome: V2Outcome;
  index: number;
}

export function OutcomeRow({ outcome, index }: OutcomeRowProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Index + outcome */}
      <div className="md:col-span-2 flex items-start gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
          {index + 1}
        </div>
        <p className="text-sm font-semibold text-slate-900 leading-snug">{outcome.outcome}</p>
      </div>

      {/* Metric */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Metric</div>
        <p className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded px-2 py-1">{outcome.metric}</p>
      </div>

      {/* Linked insight */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Insight</div>
        <p className="text-xs text-slate-600 leading-relaxed">{outcome.linkedInsight}</p>
      </div>

      {/* Actor + Stage */}
      <div className="md:col-span-2 flex flex-col gap-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Who / Where</div>
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
            👤 {outcome.actor}
          </span>
          <span className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            📍 {outcome.journeyStage}
          </span>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-1 mb-0.5">Action</div>
        <p className="text-xs text-slate-600 leading-relaxed">{outcome.linkedAction}</p>
      </div>
    </div>
  );
}
