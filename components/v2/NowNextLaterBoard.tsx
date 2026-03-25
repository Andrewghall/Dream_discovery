'use client';

import type { V2PathStep } from '@/lib/output/v2-synthesis-agent';

const HORIZON_CONFIG = {
  now: {
    label: 'Now',
    sub: '0–4 weeks',
    bg: 'bg-emerald-50 border-emerald-200',
    headerBg: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  next: {
    label: 'Next',
    sub: '1–3 months',
    bg: 'bg-amber-50 border-amber-200',
    headerBg: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  later: {
    label: 'Later',
    sub: '3–12 months',
    bg: 'bg-blue-50 border-blue-200',
    headerBg: 'bg-blue-500',
    dot: 'bg-blue-500',
  },
} as const;

interface NowNextLaterBoardProps {
  steps: V2PathStep[];
}

export function NowNextLaterBoard({ steps }: NowNextLaterBoardProps) {
  const now = steps.filter((s) => s.horizon === 'now');
  const next = steps.filter((s) => s.horizon === 'next');
  const later = steps.filter((s) => s.horizon === 'later');

  const columns: Array<{ key: keyof typeof HORIZON_CONFIG; items: V2PathStep[] }> = [
    { key: 'now', items: now },
    { key: 'next', items: next },
    { key: 'later', items: later },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {columns.map(({ key, items }) => {
        const config = HORIZON_CONFIG[key];
        return (
          <div key={key} className={`rounded-xl border ${config.bg} flex flex-col overflow-hidden`}>
            {/* Column header */}
            <div className={`${config.headerBg} px-4 py-3`}>
              <div className="text-base font-bold text-white">{config.label}</div>
              <div className="text-xs text-white/80">{config.sub}</div>
            </div>

            {/* Cards */}
            <div className="flex-1 p-3 space-y-3">
              {items.length === 0 && (
                <p className="text-xs text-slate-400 italic p-2">No actions in this horizon.</p>
              )}
              {items.map((step, i) => (
                <div key={i} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                  <p className="text-xs font-semibold text-slate-900 mb-2 leading-snug">{step.action}</p>
                  <div className="space-y-1">
                    {step.constraintAddressed && (
                      <div className="flex items-start gap-1.5 text-xs text-slate-500">
                        <span className="flex-shrink-0 font-medium text-slate-400">Addresses:</span>
                        <span>{step.constraintAddressed}</span>
                      </div>
                    )}
                    {step.journeyStage && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="flex-shrink-0 font-medium text-slate-400">Stage:</span>
                        <span>{step.journeyStage}</span>
                      </div>
                    )}
                    {step.owner && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="flex-shrink-0 font-medium text-slate-400">Owner:</span>
                        <span className="font-medium text-slate-700">{step.owner}</span>
                      </div>
                    )}
                    {step.expectedImpact && (
                      <div className="mt-2 rounded bg-emerald-50 border border-emerald-100 px-2 py-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 mb-0.5">Expected impact</div>
                        <p className="text-xs text-slate-700 leading-relaxed">{step.expectedImpact}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
