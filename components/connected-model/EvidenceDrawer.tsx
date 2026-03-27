'use client';

import { X, Quote, Link2, Zap } from 'lucide-react';
import type { CausalFinding } from '@/lib/output-intelligence/types';

const TIER_LABEL: Record<string, string> = {
  WEAK: 'Weak',
  EMERGING: 'Emerging',
  REINFORCED: 'Reinforced',
  SYSTEMIC: 'Systemic',
};

const LAYER_LABEL: Record<string, string> = {
  CONSTRAINT: 'Current reality — what holds the organisation back',
  ENABLER: 'Bridge — what can move the organisation forward',
  REIMAGINATION: 'Future aspiration — where the organisation wants to be',
};

interface EvidenceDrawerProps {
  finding: CausalFinding | null;
  /** Layer of the clicked node (used when finding.causalChain is absent) */
  nodeLayer?: 'CONSTRAINT' | 'ENABLER' | 'REIMAGINATION';
  onClose: () => void;
}

export function EvidenceDrawer({ finding, nodeLayer, onClose }: EvidenceDrawerProps) {
  if (!finding) return null;

  const chain = finding.causalChain;

  // Infer the layer this finding's node sits in
  const layer: string | undefined =
    nodeLayer ??
    (chain
      ? chain.constraintLabel === finding.issueTitle
        ? 'CONSTRAINT'
        : chain.enablerLabel === finding.issueTitle
          ? 'ENABLER'
          : 'REIMAGINATION'
      : undefined);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-[420px] max-w-full bg-white shadow-2xl z-50 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 sticky top-0 bg-white">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Finding Detail
            </p>
            <h3 className="text-base font-semibold text-slate-900 leading-snug">
              {finding.issueTitle}
            </h3>
            {layer && (
              <p className="text-xs text-slate-500 mt-1">{LAYER_LABEL[layer] ?? layer}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-6">
          {/* ── 1. What we learned ──────────────────────────────── */}
          <section>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              What we learned
            </p>
            <p className="text-sm text-slate-800 leading-relaxed font-medium">
              {finding.issueTitle}
            </p>
            {finding.whyItMatters && (
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {finding.whyItMatters}
              </p>
            )}
            {finding.whoItAffects && (
              <p className="text-xs text-slate-500 mt-1.5">
                <span className="font-medium">Affects:</span> {finding.whoItAffects}
              </p>
            )}
          </section>

          {/* ── 2. What validates it ─────────────────────────────── */}
          <section>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              What validates it
            </p>

            {finding.evidenceQuotes && finding.evidenceQuotes.length > 0 ? (
              <div className="space-y-3">
                {finding.evidenceQuotes.map((q, i) => (
                  <div key={i} className="flex gap-2.5">
                    <Quote className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-700 italic leading-relaxed">
                        &ldquo;{q.text}&rdquo;
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {[q.participantRole, q.lens ? `via ${q.lens}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No direct quotes available for this finding.</p>
            )}

            {finding.evidenceBasis && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                <span className="font-medium">Evidence basis:</span>
                <span>{finding.evidenceBasis}</span>
              </div>
            )}

            {finding.bottleneckContext && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <span className="font-medium">Bottleneck: </span>{finding.bottleneckContext}
              </div>
            )}

            {finding.compensatingBehaviourContext && (
              <div className="mt-2 text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2">
                <span className="font-medium">Compensating behaviour: </span>
                {finding.compensatingBehaviourContext}
              </div>
            )}
          </section>

          {/* ── 3. What it connects to ───────────────────────────── */}
          {chain && (
            <section>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                What it connects to
              </p>
              <div className="flex flex-col gap-0">
                {/* Reimagination */}
                <div className="flex items-start gap-2.5 rounded-t-lg bg-teal-50 border border-teal-200 px-3 py-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-teal-500 font-semibold uppercase tracking-wide">
                      Future aspiration
                    </p>
                    <p className="text-xs text-teal-900 mt-0.5 leading-snug">{chain.reimaginationLabel}</p>
                  </div>
                </div>
                {/* Connector arrow */}
                <div className="flex justify-center bg-teal-50/50 border-x border-teal-200 py-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-px h-3 bg-teal-200" />
                    <p className="text-[9px] text-teal-400 font-medium">enables ↑</p>
                  </div>
                </div>
                {/* Enabler */}
                <div className="flex items-start gap-2.5 bg-amber-50 border-x border-amber-200 px-3 py-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">
                      Bridge
                    </p>
                    <p className="text-xs text-amber-900 mt-0.5 leading-snug">{chain.enablerLabel}</p>
                  </div>
                </div>
                {/* Connector arrow */}
                <div className="flex justify-center bg-amber-50/50 border-x border-amber-200 py-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-px h-3 bg-amber-200" />
                    <p className="text-[9px] text-amber-400 font-medium">drives ↑</p>
                  </div>
                </div>
                {/* Constraint */}
                <div className="flex items-start gap-2.5 rounded-b-lg bg-rose-50 border border-rose-200 px-3 py-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-rose-500 font-semibold uppercase tracking-wide">
                      Current reality
                    </p>
                    <p className="text-xs text-rose-900 mt-0.5 leading-snug">{chain.constraintLabel}</p>
                  </div>
                </div>
              </div>

              {/* Chain strength */}
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Chain strength</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${Math.round(chain.chainStrength * 100)}%` }}
                    />
                  </div>
                  <span className="font-medium">{Math.round(chain.chainStrength * 100)}%</span>
                  <span className="text-slate-400">({TIER_LABEL[chain.weakestLinkTier] ?? chain.weakestLinkTier} link)</span>
                </div>
              </div>
            </section>
          )}

          {/* ── 4. What action it implies ────────────────────────── */}
          <section>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              What action it implies
            </p>
            {finding.recommendedAction && (
              <div className="flex gap-2.5 bg-indigo-50 rounded-lg border border-indigo-100 px-3 py-2.5">
                <Zap className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-sm text-indigo-900 leading-relaxed">{finding.recommendedAction}</p>
              </div>
            )}
            {finding.operationalImplication && (
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                <span className="font-medium">Operational implication: </span>
                {finding.operationalImplication}
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
