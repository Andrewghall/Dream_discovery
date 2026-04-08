'use client';

import type { V2Truth } from '@/lib/output/v2-synthesis-agent';

const EVIDENCE_COLOURS = {
  strong:   'bg-emerald-100 text-emerald-800 border-emerald-200',
  moderate: 'bg-amber-100 text-amber-800 border-amber-200',
  weak:     'bg-slate-100 text-slate-600 border-slate-200',
} as const;

const LENS_COLOURS: Record<string, string> = {
  People:       'bg-blue-100 text-blue-700',
  Organisation: 'bg-emerald-100 text-emerald-700',
  Customer:     'bg-purple-100 text-purple-700',
  Technology:   'bg-orange-100 text-orange-700',
  Regulation:   'bg-red-100 text-red-700',
};

function lensColour(lens: string) {
  return LENS_COLOURS[lens] || 'bg-slate-100 text-slate-600';
}

interface TruthCardProps {
  truth: V2Truth;
  index: number;
}

export function TruthCard({ truth, index }: TruthCardProps) {
  const strengthBar = truth.evidenceStrength === 'strong' ? 'bg-emerald-400'
    : truth.evidenceStrength === 'moderate' ? 'bg-amber-400' : 'bg-slate-300';

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Top strength stripe */}
      <div className={`h-1 flex-shrink-0 ${strengthBar}`} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Number + statement */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold mt-0.5">
            {index + 1}
          </div>
          <p className="text-sm font-semibold text-slate-900 leading-snug">{truth.statement}</p>
        </div>

        {/* Anchor badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            👤 {truth.actor}
          </span>
          <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            📍 {truth.journeyStage}
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${lensColour(truth.lens)}`}>
            🔍 {truth.lens}
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${EVIDENCE_COLOURS[truth.evidenceStrength]}`}>
            {truth.evidenceStrength === 'strong' ? '●●●' : truth.evidenceStrength === 'moderate' ? '●●○' : '●○○'} {truth.evidenceStrength} signal
          </span>
        </div>

        {/* Workshop evidence — verbatim quotes */}
        {truth.evidence?.length > 0 && (
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Workshop evidence
            </div>
            <ul className="space-y-2">
              {truth.evidence.map((e, i) => (
                <li key={i} className="flex items-start gap-1 text-xs text-slate-700 italic leading-relaxed">
                  <span className="flex-shrink-0 text-slate-300 font-serif text-sm leading-tight">"</span>
                  <span>{e}</span>
                  <span className="flex-shrink-0 text-slate-300 font-serif text-sm leading-tight">"</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Why it matters */}
        {truth.whyItMatters && (
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 mt-auto">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-1.5">
              Why this matters
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{truth.whyItMatters}</p>
          </div>
        )}
      </div>
    </div>
  );
}
