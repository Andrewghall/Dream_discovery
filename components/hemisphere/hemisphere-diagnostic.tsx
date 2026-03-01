'use client';

import { useState } from 'react';
import { Loader2, BarChart3, GitCompare } from 'lucide-react';
import type { HemisphereDiagnostic, DiagnosticDelta } from '@/lib/types/hemisphere-diagnostic';
import { SentimentIndexCard } from './sentiment-index-card';
import { BiasDetectionCard } from './bias-detection-card';
import { BalanceSafeguardCard } from './balance-safeguard-card';
import { MultiLensCard } from './multi-lens-card';
import { DiagnosticComparison } from './diagnostic-comparison';

interface HemisphereDiagnosticPanelProps {
  before: HemisphereDiagnostic | null;
  after: HemisphereDiagnostic | null;
  delta: DiagnosticDelta | null;
  loading: boolean;
}

type DiagnosticView = 'primary' | 'comparison';

export function HemisphereDiagnosticPanel({
  before,
  after,
  delta,
  loading,
}: HemisphereDiagnosticPanelProps) {
  const [view, setView] = useState<DiagnosticView>('primary');

  // Use the most relevant diagnostic (after > before)
  const primary = after || before;
  const canCompare = before !== null && after !== null && delta !== null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
        <p className="text-[11px] text-slate-500">Computing diagnostic...</p>
      </div>
    );
  }

  if (!primary) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <BarChart3 className="h-6 w-6 text-slate-600" />
        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
          No diagnostic data available.
          <br />
          Generate a hemisphere visualisation first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* View toggle */}
      {canCompare && (
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => setView('primary')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded-md transition-all ${
              view === 'primary'
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="h-3 w-3" />
            Diagnostic
          </button>
          <button
            onClick={() => setView('comparison')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded-md transition-all ${
              view === 'comparison'
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCompare className="h-3 w-3" />
            Before / After
          </button>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-[9px] text-slate-600">
        <span>{primary.nodeCount} nodes / {primary.edgeCount} edges</span>
        <span>{primary.snapshotId ? 'Live Session' : 'Discovery Baseline'}</span>
      </div>

      {view === 'comparison' && canCompare ? (
        <DiagnosticComparison before={before!} after={after!} delta={delta!} />
      ) : (
        <>
          {/* Sentiment Index */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
            <SentimentIndexCard sentimentIndex={primary.sentimentIndex} />
          </div>

          {/* Bias Detection */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
            <BiasDetectionCard biasDetection={primary.biasDetection} />
          </div>

          {/* Balance Safeguard */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
            <BalanceSafeguardCard balanceSafeguard={primary.balanceSafeguard} />
          </div>

          {/* Multi-Lens */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
            <MultiLensCard multiLens={primary.multiLens} />
          </div>
        </>
      )}
    </div>
  );
}
