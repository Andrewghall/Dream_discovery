'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { HemisphereDiagnostic, DiagnosticDelta } from '@/lib/types/hemisphere-diagnostic';

interface DiagnosticComparisonProps {
  before: HemisphereDiagnostic;
  after: HemisphereDiagnostic;
  delta: DiagnosticDelta;
}

function DeltaArrow({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (Math.abs(value) < 0.5) {
    return (
      <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
        <Minus className="h-2.5 w-2.5" /> stable
      </span>
    );
  }
  const isPositive = value > 0;
  return (
    <span className={`text-[10px] flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
      {isPositive ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {isPositive ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

export function DiagnosticComparison({ before, after, delta }: DiagnosticComparisonProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider">Before / After</h3>
      </div>

      {/* Balance shift */}
      <div className="bg-white/5 rounded-lg px-3 py-2.5">
        <p className="text-[11px] text-slate-300 leading-relaxed">{delta.balanceShift}</p>
        <p className="text-[10px] text-slate-400 mt-1">{delta.biasChange}</p>
      </div>

      {/* Overall metrics comparison */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <span className="text-[9px] text-slate-500 block">Before</span>
        </div>
        <div className="text-center">
          <span className="text-[9px] text-slate-500 block">Delta</span>
        </div>
        <div className="text-center">
          <span className="text-[9px] text-slate-500 block">After</span>
        </div>

        {/* Creative density */}
        <div className="text-center">
          <span className="text-[11px] text-emerald-400 font-mono">{before.sentimentIndex.overallCreative}%</span>
        </div>
        <div className="flex justify-center">
          <DeltaArrow value={delta.overallCreativeDelta} />
        </div>
        <div className="text-center">
          <span className="text-[11px] text-emerald-400 font-mono">{after.sentimentIndex.overallCreative}%</span>
        </div>

        <div className="text-center col-span-3">
          <span className="text-[9px] text-slate-500">Creative Density</span>
        </div>

        {/* Constraint density */}
        <div className="text-center">
          <span className="text-[11px] text-red-400 font-mono">{before.sentimentIndex.overallConstraint}%</span>
        </div>
        <div className="flex justify-center">
          <DeltaArrow value={delta.overallConstraintDelta} />
        </div>
        <div className="text-center">
          <span className="text-[11px] text-red-400 font-mono">{after.sentimentIndex.overallConstraint}%</span>
        </div>

        <div className="text-center col-span-3">
          <span className="text-[9px] text-slate-500">Constraint Density</span>
        </div>

        {/* Gini coefficient */}
        <div className="text-center">
          <span className="text-[11px] text-blue-400 font-mono">{before.biasDetection.giniCoefficient.toFixed(2)}</span>
        </div>
        <div className="flex justify-center">
          <DeltaArrow value={after.biasDetection.giniCoefficient - before.biasDetection.giniCoefficient} suffix="" />
        </div>
        <div className="text-center">
          <span className="text-[11px] text-blue-400 font-mono">{after.biasDetection.giniCoefficient.toFixed(2)}</span>
        </div>

        <div className="text-center col-span-3">
          <span className="text-[9px] text-slate-500">Gini Coefficient (Voice Balance)</span>
        </div>

        {/* Balance score */}
        <div className="text-center">
          <span className="text-[11px] text-white font-mono">{before.balanceSafeguard.overallBalance}</span>
        </div>
        <div className="flex justify-center">
          <DeltaArrow value={after.balanceSafeguard.overallBalance - before.balanceSafeguard.overallBalance} suffix="" />
        </div>
        <div className="text-center">
          <span className="text-[11px] text-white font-mono">{after.balanceSafeguard.overallBalance}</span>
        </div>

        <div className="text-center col-span-3">
          <span className="text-[9px] text-slate-500">Balance Score (0-100)</span>
        </div>
      </div>

      {/* Domain deltas */}
      {delta.domainDeltas.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-white/5">
          <span className="text-[10px] text-slate-500 font-medium">Domain Movement</span>
          {delta.domainDeltas.map((dd) => (
            <div key={dd.domain} className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{dd.domain}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-emerald-400">
                  {dd.creativeDelta > 0 ? '+' : ''}{dd.creativeDelta.toFixed(1)}%
                </span>
                <span className="text-[9px] text-slate-600">/</span>
                <span className="text-[9px] text-red-400">
                  {dd.constraintDelta > 0 ? '+' : ''}{dd.constraintDelta.toFixed(1)}%
                </span>
                <span
                  className={`text-[9px] px-1 rounded ${
                    dd.direction === 'more-creative' ? 'bg-emerald-500/10 text-emerald-400'
                    : dd.direction === 'more-constrained' ? 'bg-red-500/10 text-red-400'
                    : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {dd.direction === 'more-creative' ? 'creative' : dd.direction === 'more-constrained' ? 'constrained' : 'stable'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New domains */}
      {delta.newDomainsAppeared.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-white/5">
          <span className="text-[10px] text-slate-500 font-medium">New Domains</span>
          <div className="flex flex-wrap gap-1">
            {delta.newDomainsAppeared.map((d) => (
              <span key={d} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
