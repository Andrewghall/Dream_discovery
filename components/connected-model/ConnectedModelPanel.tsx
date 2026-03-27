'use client';

import { useState } from 'react';
import { Network, ArrowUp, ChevronDown, ChevronUp, ChevronRight, AlertTriangle, Zap, Layers } from 'lucide-react';
import type { CausalIntelligence, CausalFinding, EdgeTier } from '@/lib/output-intelligence/types';
import { EvidenceDrawer } from './EvidenceDrawer';

// ── Scoring engine ────────────────────────────────────────────────────────────

interface ScoredFinding {
  finding: CausalFinding;
  score: number;
  chainScore: number;
  densityScore: number;
  lensScore: number;
  actorScore: number;
  tier: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  lensCount: number;
  actorCount: number;
  unlocks: string | null;
}

const EDGE_DENSITY_MAX = 8;
const LENS_MAX = 3;
const ACTOR_MAX = 6;  // normalise actor count: 6 dependent areas = full score

/**
 * Normalise chain strength to 0–1.
 * The causal intelligence agent may output either 0–1 floats or 0–100 integers.
 */
function normStrength(s: number): number {
  return s > 1 ? s / 100 : s;
}

/**
 * Actor impact: how broadly this finding affects the organisation.
 * Primary: parse "N dependent areas" from whoItAffects.
 * Fallback: count distinct participantRoles across evidenceQuotes.
 */
function computeActorImpact(finding: CausalFinding): { score: number; count: number } {
  const match = finding.whoItAffects.match(/(\d+)\s+dependent\s+areas?/i);
  if (match) {
    const n = parseInt(match[1], 10);
    return { score: Math.min(1, n / ACTOR_MAX), count: n };
  }

  const roles = new Set(
    (finding.evidenceQuotes ?? [])
      .map(q => q.participantRole)
      .filter((r): r is string => r !== null),
  );
  return { score: Math.min(1, roles.size / 4), count: roles.size };
}

function scoreFinding(finding: CausalFinding): ScoredFinding {
  const chainScore = normStrength(finding.causalChain?.chainStrength ?? 0);
  const densityScore = Math.min(1, finding.evidenceEdgeIds.length / EDGE_DENSITY_MAX);

  const distinctLenses = new Set(
    (finding.evidenceQuotes ?? []).map(q => q.lens).filter((l): l is string => l !== null),
  ).size;
  const lensScore = Math.min(1, distinctLenses / LENS_MAX);

  const { score: actorScore, count: actorCount } = computeActorImpact(finding);

  // Weights: chainStrength 35 + edgeDensity 25 + crossLens 20 + actorImpact 20 = 100
  const composite = chainScore * 0.35 + densityScore * 0.25 + lensScore * 0.20 + actorScore * 0.20;

  const tier: ScoredFinding['tier'] =
    finding.category === 'ORGANISATIONAL_ISSUE' || composite >= 0.65 ? 'CRITICAL' :
    composite >= 0.40 ? 'HIGH' : 'MEDIUM';

  const unlocks = finding.causalChain
    ? `${finding.causalChain.enablerLabel} → ${finding.causalChain.reimaginationLabel}`
    : null;

  return {
    finding, score: composite, chainScore, densityScore, lensScore,
    actorScore, tier, lensCount: distinctLenses, actorCount, unlocks,
  };
}

const TIER_CONFIG: Record<ScoredFinding['tier'], {
  label: string; badge: string; bar: string; timeHorizon: string;
}> = {
  CRITICAL: {
    label: 'CRITICAL',
    badge: 'bg-rose-50 border-rose-300 text-rose-700',
    bar: 'bg-rose-400',
    timeHorizon: '0–30 days',
  },
  HIGH: {
    label: 'HIGH',
    badge: 'bg-amber-50 border-amber-300 text-amber-700',
    bar: 'bg-amber-400',
    timeHorizon: '30–90 days',
  },
  MEDIUM: {
    label: 'MEDIUM',
    badge: 'bg-slate-50 border-slate-200 text-slate-500',
    bar: 'bg-slate-300',
    timeHorizon: '90–180 days',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  ORGANISATIONAL_ISSUE: { label: 'Organisational Issue', color: 'bg-rose-50 border-rose-200 text-rose-700', dot: 'bg-rose-500' },
  REINFORCED_FINDING:   { label: 'Reinforced Finding',   color: 'bg-indigo-50 border-indigo-200 text-indigo-700', dot: 'bg-indigo-500' },
  EMERGING_PATTERN:     { label: 'Emerging Pattern',     color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500' },
  CONTRADICTION:        { label: 'Contradiction',        color: 'bg-purple-50 border-purple-200 text-purple-700', dot: 'bg-purple-500' },
  EVIDENCE_GAP:         { label: 'Evidence Gap',         color: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-400' },
} as const;

// ── Sub-components ────────────────────────────────────────────────────────────

interface PriorityFindingCardProps {
  scored: ScoredFinding;
  rank: number;
  noQuotes: boolean;
  onClick: () => void;
}

function PriorityFindingCard({ scored, rank, noQuotes, onClick }: PriorityFindingCardProps) {
  const { finding, tier, score, chainScore, lensCount, actorCount, unlocks } = scored;
  const cfg = TIER_CONFIG[tier];
  const scorePct = Math.round(score * 100);
  const chainPct = Math.round(chainScore * 100);
  const filledSegments = Math.round(score * 10);

  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-slate-100 rounded-xl overflow-hidden hover:border-slate-200 hover:shadow-sm transition-all group"
    >
      {/* Header: tier + score bar + metadata */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 flex-wrap">
        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${cfg.badge}`}>
          {cfg.label}
        </span>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={`w-1.5 h-2.5 rounded-sm ${i < filledSegments ? cfg.bar : 'bg-slate-100'}`} />
          ))}
        </div>
        <span className="text-[10px] text-slate-400 shrink-0">{scorePct}%</span>
        <span className="text-[10px] text-slate-300 ml-auto shrink-0 hidden sm:block">
          chain {chainPct}%
          {lensCount > 0 ? ` · ${lensCount} lens${lensCount !== 1 ? 'es' : ''}` : ''}
          {actorCount > 0 ? ` · ${actorCount} actor${actorCount !== 1 ? 's' : ''}` : ''}
        </span>
        <span className="text-[10px] text-slate-300 shrink-0">#{rank}</span>
        {noQuotes && (
          <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded shrink-0">
            no quotes
          </span>
        )}
      </div>

      {/* Title + why */}
      <div className="px-4 pb-2">
        <p className="text-sm font-semibold text-slate-800 leading-snug mb-1">{finding.issueTitle}</p>
        {finding.whyItMatters && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
            {finding.whyItMatters}
          </p>
        )}
      </div>

      {/* Unlocks */}
      {unlocks && (
        <div className="border-t border-teal-50 bg-teal-50/60 px-4 py-2">
          <div className="flex items-start gap-2">
            <ArrowUp className="h-3 w-3 text-teal-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-teal-500 uppercase tracking-wider mb-0.5">Fixing this unlocks</p>
              <p className="text-xs text-teal-800 leading-snug truncate">{unlocks}</p>
            </div>
          </div>
        </div>
      )}

      {/* Impact */}
      {finding.operationalImplication && (
        <div className="border-t border-rose-50 bg-rose-50/40 px-4 py-2">
          <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mb-0.5">If left unresolved</p>
          <p className="text-xs text-rose-800 leading-snug line-clamp-2">{finding.operationalImplication}</p>
        </div>
      )}

      {/* Action: time horizon + owner + action */}
      <div className="border-t border-slate-50 bg-slate-50/60 px-4 py-2 flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-1 shrink-0">
          <Zap className="h-3 w-3 text-amber-500" />
          <span className="text-[10px] font-bold text-slate-600">{cfg.timeHorizon}</span>
        </div>
        {finding.whoItAffects && (
          <>
            <span className="text-slate-200 text-xs">·</span>
            <span className="text-[10px] text-slate-500 shrink-0">Owner: {finding.whoItAffects}</span>
          </>
        )}
        {finding.recommendedAction && (
          <>
            <span className="text-slate-200 text-xs hidden sm:block">·</span>
            <p className="text-[10px] text-slate-500 hidden sm:block truncate flex-1">{finding.recommendedAction}</p>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0 ml-auto mt-0.5" />
      </div>
    </button>
  );
}

interface TradeOffCardProps {
  finding: CausalFinding;
  onClick: () => void;
}

function TradeOffCard({ finding, onClick }: TradeOffCardProps) {
  // Extract the two opposing concepts from "Opposing views: X ↔ Y"
  const raw = finding.issueTitle.replace(/^Opposing views:\s*/i, '');
  const [sideA, sideB] = raw.split(' ↔ ');

  const quoteA = finding.evidenceQuotes?.[0];
  const quoteB = finding.evidenceQuotes?.[1];

  // Collect unique lenses for the header label
  const lenses = [...new Set(
    (finding.evidenceQuotes ?? []).map(q => q.lens).filter((l): l is string => l !== null),
  )];

  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-purple-100 rounded-xl overflow-hidden hover:border-purple-200 transition-all group"
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-start gap-2 flex-wrap">
        <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 px-1.5 py-0.5 rounded border border-purple-200 bg-purple-50 shrink-0">
          Decision required
        </span>
        {lenses.length > 0 && (
          <span className="text-[10px] text-purple-400">{lenses.join(' ↔ ')}</span>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0 ml-auto mt-0.5" />
      </div>

      {/* Concept labels */}
      <div className="px-4 pb-2">
        <p className="text-sm font-semibold text-slate-800 leading-snug">
          {sideA ?? raw}{sideB ? <span className="text-slate-400 font-normal"> vs </span> : ''}{sideB ?? ''}
        </p>
      </div>

      {/* Side-by-side perspectives */}
      {(quoteA || quoteB) && (
        <div className="border-t border-purple-50 grid grid-cols-2 divide-x divide-purple-50">
          {/* Side A */}
          <div className="px-3 py-2.5 bg-purple-50/30">
            {sideA && <p className="text-[9px] font-bold text-purple-400 uppercase tracking-wider mb-1">{sideA}</p>}
            {quoteA ? (
              <>
                <p className="text-[11px] text-slate-600 italic leading-relaxed line-clamp-3 group-hover:line-clamp-none">
                  "{quoteA.text}"
                </p>
                {quoteA.participantRole && (
                  <p className="text-[10px] text-slate-400 mt-1 not-italic">— {quoteA.participantRole}</p>
                )}
              </>
            ) : (
              <p className="text-[11px] text-slate-400 italic">No quote captured</p>
            )}
          </div>

          {/* Side B */}
          <div className="px-3 py-2.5 bg-slate-50/30">
            {sideB && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{sideB}</p>}
            {quoteB ? (
              <>
                <p className="text-[11px] text-slate-600 italic leading-relaxed line-clamp-3 group-hover:line-clamp-none">
                  "{quoteB.text}"
                </p>
                {quoteB.participantRole && (
                  <p className="text-[10px] text-slate-400 mt-1 not-italic">— {quoteB.participantRole}</p>
                )}
              </>
            ) : (
              <p className="text-[11px] text-slate-400 italic">No quote captured</p>
            )}
          </div>
        </div>
      )}

      {/* Resolution */}
      {finding.recommendedAction && (
        <div className="border-t border-purple-50 px-4 py-2 flex items-start gap-2">
          <AlertTriangle className="h-3 w-3 text-purple-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 group-hover:line-clamp-none">
            {finding.recommendedAction}
          </p>
        </div>
      )}
    </button>
  );
}

interface ChainColumnProps {
  constraintLabel: string;
  enablerLabel: string;
  reimaginationLabel: string;
  chainStrength: number;
  narrative?: string;
  onNodeClick: (label: string, layer: 'CONSTRAINT' | 'ENABLER' | 'REIMAGINATION') => void;
}

function ChainColumn({ constraintLabel, enablerLabel, reimaginationLabel, chainStrength, onNodeClick }: ChainColumnProps) {
  const strengthPct = Math.round(normStrength(chainStrength) * 100);

  return (
    <div className="flex flex-col items-center gap-0 min-w-[200px] max-w-[240px]">
      <button
        onClick={() => onNodeClick(reimaginationLabel, 'REIMAGINATION')}
        className="w-full text-left rounded-xl bg-teal-50 border border-teal-300 px-3 py-2.5 hover:bg-teal-100 hover:border-teal-400 transition-colors group"
      >
        <p className="text-[9px] font-bold text-teal-500 uppercase tracking-wider mb-1">Aspires to</p>
        <p className="text-xs text-teal-900 leading-snug font-medium line-clamp-3 group-hover:line-clamp-none">{reimaginationLabel}</p>
      </button>

      <div className="flex flex-col items-center py-1">
        <div className="w-px h-3 bg-teal-300" />
        <p className="text-[9px] text-teal-400 font-medium px-1 py-0.5 bg-white rounded border border-teal-200">enables ↑</p>
        <div className="w-px h-3 bg-amber-300" />
      </div>

      <button
        onClick={() => onNodeClick(enablerLabel, 'ENABLER')}
        className="w-full text-left rounded-xl bg-amber-50 border border-amber-300 px-3 py-2.5 hover:bg-amber-100 hover:border-amber-400 transition-colors group"
      >
        <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider mb-1">Bridge</p>
        <p className="text-xs text-amber-900 leading-snug font-medium line-clamp-3 group-hover:line-clamp-none">{enablerLabel}</p>
      </button>

      <div className="flex flex-col items-center py-1">
        <div className="w-px h-3 bg-amber-300" />
        <p className="text-[9px] text-amber-400 font-medium px-1 py-0.5 bg-white rounded border border-amber-200">drives ↑</p>
        <div className="w-px h-3 bg-rose-300" />
      </div>

      <button
        onClick={() => onNodeClick(constraintLabel, 'CONSTRAINT')}
        className="w-full text-left rounded-xl bg-rose-50 border border-rose-300 px-3 py-2.5 hover:bg-rose-100 hover:border-rose-400 transition-colors group"
      >
        <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mb-1">Holds back</p>
        <p className="text-xs text-rose-900 leading-snug font-medium line-clamp-3 group-hover:line-clamp-none">{constraintLabel}</p>
      </button>

      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-300 rounded-full" style={{ width: `${strengthPct}%` }} />
        </div>
        <span>{strengthPct}%</span>
      </div>
    </div>
  );
}

interface FindingRowProps {
  finding: CausalFinding;
  onClick: () => void;
}

function FindingRow({ finding, onClick }: FindingRowProps) {
  const cfg = CATEGORY_CONFIG[finding.category] ?? CATEGORY_CONFIG.REINFORCED_FINDING;

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button onClick={onClick} className="w-full text-left p-4 hover:bg-slate-50 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
            <div className="min-w-0">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.color}`}>
                {cfg.label}
              </span>
              <p className="text-sm font-medium text-slate-800 leading-snug mt-1">{finding.issueTitle}</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 mt-1" />
        </div>
        {finding.whyItMatters && (
          <p className="text-xs text-slate-500 mt-1.5 ml-4 pl-0.5 leading-relaxed">{finding.whyItMatters}</p>
        )}
      </button>

      {finding.causalChain && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            <span className="text-rose-500 font-medium truncate max-w-[120px]">{finding.causalChain.constraintLabel}</span>
            <ArrowUp className="h-3 w-3 text-amber-400 shrink-0" />
            <span className="text-amber-700 font-medium truncate max-w-[120px]">{finding.causalChain.enablerLabel}</span>
            <ArrowUp className="h-3 w-3 text-teal-400 shrink-0" />
            <span className="text-teal-600 font-medium truncate max-w-[120px]">{finding.causalChain.reimaginationLabel}</span>
            <span className="ml-auto text-slate-400 shrink-0">
              {Math.round(normStrength(finding.causalChain.chainStrength) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export interface ConnectedModelPanelProps {
  causalIntelligence: CausalIntelligence;
  lensesUsed: string[];
  workshopGoal?: string | null;
}

export function ConnectedModelPanel({ causalIntelligence, lensesUsed, workshopGoal }: ConnectedModelPanelProps) {
  const [selectedFinding, setSelectedFinding] = useState<CausalFinding | null>(null);
  const [selectedNodeLayer, setSelectedNodeLayer] = useState<'CONSTRAINT' | 'ENABLER' | 'REIMAGINATION' | undefined>();
  const [showGaps, setShowGaps] = useState(false);

  const { dominantCausalChains, organisationalIssues, reinforcedFindings, emergingPatterns, contradictions, evidenceGaps } = causalIntelligence;

  const allFindings: CausalFinding[] = [...organisationalIssues, ...reinforcedFindings, ...emergingPatterns];

  // ── Data quality guards ──────────────────────────────────────────────────
  const findingsWithoutChain = allFindings.filter(f => !f.causalChain);
  const findingsWithoutQuotes = allFindings.filter(f => (f.evidenceQuotes?.length ?? 0) === 0);
  const avgLensScore = allFindings.length > 0
    ? allFindings.reduce((sum, f) => {
        const lenses = new Set((f.evidenceQuotes ?? []).map(q => q.lens).filter((l): l is string => l !== null));
        return sum + Math.min(1, lenses.size / LENS_MAX);
      }, 0) / allFindings.length
    : 0;
  const lowLensCoverage = avgLensScore < 0.2 && allFindings.length > 0;

  // ── Score + rank: only findings WITH causalChain are eligible for priority triage ──
  const eligibleFindings = allFindings.filter(f => !!f.causalChain);
  const scoredFindings = eligibleFindings
    .map(scoreFinding)
    .sort((a, b) => {
      const tierOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
      const d = tierOrder[a.tier] - tierOrder[b.tier];
      return d !== 0 ? d : b.score - a.score;
    });

  const top5 = scoredFindings.slice(0, 5);
  const remainingCount = scoredFindings.length - 5;

  // Quote-less set for flagging
  const withoutQuotesSet = new Set(findingsWithoutQuotes.map(f => f.findingId));

  function deriveTier(strength: number): EdgeTier {
    const s = normStrength(strength);
    if (s >= 0.75) return 'SYSTEMIC';
    if (s >= 0.5) return 'REINFORCED';
    if (s >= 0.25) return 'EMERGING';
    return 'WEAK';
  }

  function openFinding(finding: CausalFinding, layer?: 'CONSTRAINT' | 'ENABLER' | 'REIMAGINATION') {
    setSelectedFinding(finding);
    setSelectedNodeLayer(layer);
  }

  function handleNodeClick(label: string, layer: 'CONSTRAINT' | 'ENABLER' | 'REIMAGINATION') {
    const match = allFindings.find(f =>
      f.causalChain?.constraintLabel === label ||
      f.causalChain?.enablerLabel === label ||
      f.causalChain?.reimaginationLabel === label ||
      f.issueTitle.toLowerCase().includes(label.toLowerCase().slice(0, 20)),
    );
    if (match) { openFinding(match, layer); return; }

    const chain = dominantCausalChains.find(c =>
      c.constraintLabel === label || c.enablerLabel === label || c.reimaginationLabel === label,
    );
    const synthetic: CausalFinding = {
      findingId: `node-${label}`,
      category: layer === 'CONSTRAINT' ? 'ORGANISATIONAL_ISSUE' : 'REINFORCED_FINDING',
      issueTitle: label, whyItMatters: '', whoItAffects: '', evidenceBasis: '',
      operationalImplication: '', recommendedAction: '', evidenceEdgeIds: [],
      causalChain: chain ? {
        constraintLabel: chain.constraintLabel, enablerLabel: chain.enablerLabel,
        reimaginationLabel: chain.reimaginationLabel, chainStrength: chain.chainStrength,
        weakestLinkTier: deriveTier(chain.chainStrength),
      } : undefined,
    };
    openFinding(synthetic, layer);
  }

  if (dominantCausalChains.length === 0 && allFindings.length === 0) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center">
        <Network className="h-8 w-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">
          No causal chains available. Run Output Intelligence with sufficient live session data to generate the connected model.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Workshop goal ─────────────────────────────────── */}
      {workshopGoal && (
        <div className="rounded-xl bg-slate-900 px-4 py-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Workshop goal</p>
          <p className="text-sm text-white leading-relaxed">{workshopGoal}</p>
        </div>
      )}

      {/* ── Data quality guards ───────────────────────────── */}
      {(findingsWithoutChain.length > 0 || findingsWithoutQuotes.length > 0 || lowLensCoverage) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Data quality</p>
          </div>
          {findingsWithoutChain.length > 0 && (
            <p className="text-xs text-amber-800">
              <span className="font-semibold">{findingsWithoutChain.length} finding{findingsWithoutChain.length !== 1 ? 's' : ''}</span>{' '}
              excluded from priority triage — no causal chain detected. These appear in the full graph but cannot be ranked without a confirmed constraint → enabler → vision pathway.
            </p>
          )}
          {findingsWithoutQuotes.length > 0 && (
            <p className="text-xs text-amber-800">
              <span className="font-semibold">{findingsWithoutQuotes.length} finding{findingsWithoutQuotes.length !== 1 ? 's' : ''}</span>{' '}
              have no supporting quotes — scores may be understated and evidence cannot be reviewed in the drawer.
            </p>
          )}
          {lowLensCoverage && (
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Low cross-lens coverage</span> — findings cite fewer than 2 lenses on average.
              Cross-lens impact scores are suppressed. Consider adding more lens dimensions to the prep questions.
            </p>
          )}
        </div>
      )}

      {/* ── Priority Triage ───────────────────────────────── */}
      {top5.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            Priority triage — top {top5.length} findings
          </p>
          <p className="text-[10px] text-slate-400 mb-3">
            Ranked by chain strength (35%) · evidence density (25%) · cross-lens impact (20%) · actor breadth (20%)
          </p>
          <div className="space-y-2">
            {top5.map((scored, i) => (
              <PriorityFindingCard
                key={scored.finding.findingId}
                scored={scored}
                rank={i + 1}
                noQuotes={withoutQuotesSet.has(scored.finding.findingId)}
                onClick={() => openFinding(scored.finding)}
              />
            ))}
          </div>
          {remainingCount > 0 && (
            <p className="mt-2 text-[10px] text-slate-400">
              + {remainingCount} additional finding{remainingCount !== 1 ? 's' : ''} (lower priority) — click any chain node below to explore.
            </p>
          )}
        </div>
      )}

      {/* ── Decision trade-offs ───────────────────────────── */}
      {contradictions.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            Conflicting signals — decisions required
          </p>
          <p className="text-[10px] text-slate-400 mb-3">
            Unresolved tensions create inconsistent decisions across teams. Each requires an explicit choice or acknowledged trade-off.
          </p>
          <div className="space-y-2">
            {contradictions.map((finding) => (
              <TradeOffCard key={finding.findingId} finding={finding} onClick={() => openFinding(finding)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Causal chain diagram ──────────────────────────── */}
      {dominantCausalChains.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Causal chains — click any node for evidence
            </p>
            {lensesUsed.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto text-[10px] text-slate-400">
                <Layers className="h-3 w-3" />
                <span>{lensesUsed.slice(0, 4).join(' · ')}{lensesUsed.length > 4 ? ` +${lensesUsed.length - 4}` : ''}</span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-4 min-w-min">
              {dominantCausalChains.map((chain, i) => (
                <ChainColumn
                  key={i}
                  constraintLabel={chain.constraintLabel}
                  enablerLabel={chain.enablerLabel}
                  reimaginationLabel={chain.reimaginationLabel}
                  chainStrength={chain.chainStrength}
                  narrative={chain.narrative}
                  onNodeClick={handleNodeClick}
                />
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Each column traces one evidence-backed pathway. Derived from fixed hemisphere layer assignments — no reinterpretation.
          </p>
        </div>
      )}

      {/* ── Evidence gaps ─────────────────────────────────── */}
      {evidenceGaps.length > 0 && (
        <div>
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">{evidenceGaps.length} unaddressed constraint{evidenceGaps.length !== 1 ? 's' : ''}</span>{' '}
                with no response pathway detected. These are blind spots in the current model.
              </p>
              <button onClick={() => setShowGaps(!showGaps)} className="text-[10px] text-amber-600 hover:text-amber-800 mt-1 transition-colors">
                {showGaps ? 'Hide' : `Show ${evidenceGaps.length}`}
              </button>
            </div>
          </div>
          {showGaps && (
            <div className="mt-2 space-y-2">
              {evidenceGaps.map((f) => (
                <FindingRow key={f.findingId} finding={f} onClick={() => openFinding(f)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Excluded findings (no causal chain) ──────────── */}
      {findingsWithoutChain.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Excluded from triage — no causal chain
          </p>
          <div className="space-y-2">
            {findingsWithoutChain.map((f) => (
              <FindingRow key={f.findingId} finding={f} onClick={() => openFinding(f)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Coverage footer ───────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-4">
        <span>Graph coverage</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-300 rounded-full" style={{ width: `${Math.round(causalIntelligence.graphCoverageScore)}%` }} />
          </div>
          <span className="font-medium">{Math.round(causalIntelligence.graphCoverageScore)}%</span>
        </div>
      </div>

      {/* ── Evidence Drawer ───────────────────────────────── */}
      <EvidenceDrawer
        finding={selectedFinding}
        nodeLayer={selectedNodeLayer}
        onClose={() => { setSelectedFinding(null); setSelectedNodeLayer(undefined); }}
      />
    </div>
  );
}
