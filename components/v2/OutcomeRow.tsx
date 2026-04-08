'use client';

import type { V2Outcome } from '@/lib/output/v2-synthesis-agent';

interface OutcomeRowProps {
  outcome: V2Outcome;
  index: number;
}

export function OutcomeRow({ outcome, index }: OutcomeRowProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            {index + 1}
          </div>
          <p className="text-sm font-semibold text-slate-900">{outcome.outcome}</p>
        </div>
        <div className="flex-shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-semibold text-emerald-700">
          {outcome.metric}
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Baseline → Target */}
        <div className="md:col-span-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Current → Target
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-center gap-2">
            <div className="flex-1">
              <div className="text-[10px] text-slate-400 mb-0.5">Now</div>
              <p className="text-xs text-slate-600 leading-snug">{outcome.baseline || '—'}</p>
            </div>
            <div className="text-slate-300 font-bold flex-shrink-0">→</div>
            <div className="flex-1">
              <div className="text-[10px] text-emerald-500 mb-0.5 font-semibold">Target</div>
              <p className="text-xs font-semibold text-emerald-700 leading-snug">{outcome.target || '—'}</p>
            </div>
          </div>
          {outcome.targetEvidence && (
            <div className="mt-2 rounded bg-blue-50 border border-blue-100 px-2.5 py-2">
              <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mb-1">Evidence for target</div>
              <p className="text-xs italic text-slate-600 leading-relaxed">"{outcome.targetEvidence}"</p>
            </div>
          )}
        </div>

        {/* Insight + Action */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Linked Insight
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">{outcome.linkedInsight}</p>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            Delivering Action
          </div>
          <p className="text-xs text-slate-700 font-medium leading-snug">{outcome.linkedAction}</p>
        </div>

        {/* Who / Where */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Who / Where
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              👤 {outcome.actor}
            </span>
            <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              📍 {outcome.journeyStage}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
