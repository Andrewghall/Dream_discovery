'use client';

import { useState } from 'react';
import type { ValidityResult } from '@/lib/ethentaflow/types';

export type EthentaFlowDiagEvent = {
  id: string;
  ts: number;
  speakerId: string;
  text: string;
  decision: 'commit' | 'hold' | 'discard';
  holdCycle?: number;
  validityScore: number | null;
  hardRuleApplied: string | null;
  reasons: string[];
  primaryDomain: string | null;
  secondaryDomain: string | null;
  domainConfidence: number | null;
  decisionPath: string | null;
  lensPackId: string;
  scoreBreakdown: ValidityResult['score_breakdown'] | null;
};

export type LensPackDiagInfo = {
  source: 'prep_research' | 'missing' | 'default_fallback' | 'default';
  packId: string;
  packName: string;
  domainCount: number;
  reason?: string;
};

type Props = {
  events: EthentaFlowDiagEvent[];
  lensPackInfo: LensPackDiagInfo;
  onClear: () => void;
};

const DECISION_STYLES: Record<EthentaFlowDiagEvent['decision'], { bg: string; text: string; label: string }> = {
  commit:  { bg: 'bg-emerald-900/60', text: 'text-emerald-300', label: 'COMMIT'  },
  hold:    { bg: 'bg-amber-900/60',   text: 'text-amber-300',   label: 'HOLD'    },
  discard: { bg: 'bg-red-900/60',     text: 'text-red-300',     label: 'DISCARD' },
};

const SCORE_BAR_COLOR: Record<EthentaFlowDiagEvent['decision'], string> = {
  commit:  'bg-emerald-500',
  hold:    'bg-amber-500',
  discard: 'bg-red-500',
};

function ScoreBar({ score, decision }: { score: number; decision: EthentaFlowDiagEvent['decision'] }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="w-14 h-1.5 bg-zinc-700 rounded-full overflow-hidden flex-shrink-0">
        <div className={`h-full rounded-full ${SCORE_BAR_COLOR[decision]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-zinc-400 text-[10px] tabular-nums flex-shrink-0">{(score).toFixed(2)}</span>
    </div>
  );
}

function ScoreBreakdown({ bd }: { bd: ValidityResult['score_breakdown'] }) {
  const rows: [string, number, boolean][] = [
    ['self_contain', bd.self_containment, false],
    ['structural',   bd.structural_completeness, false],
    ['biz_anchor',   bd.business_anchor, false],
    ['signal',       bd.signal_strength, false],
    ['specificity',  bd.specificity, false],
    ['continuity',   bd.continuity, false],
    ['ref_penalty',  bd.referential_penalty, true],
    ['ambig_penalty',bd.ambiguity_penalty, true],
  ];
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5 text-[10px]">
      {rows.map(([label, val, isPenalty]) => (
        <div key={label} className="flex items-center justify-between gap-2">
          <span className="text-zinc-500">{label}</span>
          <span className={isPenalty ? 'text-red-400' : 'text-zinc-300'}>
            {isPenalty ? '−' : ''}{val.toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
}

function DiagRow({ event }: { event: EthentaFlowDiagEvent }) {
  const [expanded, setExpanded] = useState(false);
  const ds = DECISION_STYLES[event.decision];
  const speakerShort = event.speakerId.replace('speaker_', 'S');
  const textSnippet = event.text.length > 70 ? event.text.slice(0, 70) + '…' : event.text;
  const timeStr = new Date(event.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div
      className={`rounded border border-zinc-700/50 px-2.5 py-1.5 cursor-pointer select-none transition-colors hover:border-zinc-600/70 ${expanded ? 'bg-zinc-800/80' : 'bg-zinc-900/60'}`}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-zinc-500 text-[10px] tabular-nums flex-shrink-0 w-14">{timeStr}</span>
        <span className="text-zinc-400 text-[10px] flex-shrink-0 w-6">{speakerShort}</span>
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${ds.bg} ${ds.text} flex-shrink-0`}>
          {ds.label}{event.holdCycle ? ` ×${event.holdCycle}` : ''}
        </span>
        <span className="text-zinc-300 text-[11px] truncate flex-1 min-w-0">
          {textSnippet}
        </span>
        {event.validityScore !== null && (
          <ScoreBar score={event.validityScore} decision={event.decision} />
        )}
        {event.primaryDomain && (
          <span className="text-zinc-400 text-[10px] flex-shrink-0 max-w-[80px] truncate">
            {event.primaryDomain}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-zinc-700/40 pt-2">
          {/* Full text */}
          <p className="text-zinc-300 text-[11px] leading-relaxed">{event.text}</p>

          {/* Hard rule */}
          {event.hardRuleApplied && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-red-400 font-mono">HARD RULE:</span>
              <span className="text-[10px] text-red-300">{event.hardRuleApplied}</span>
            </div>
          )}

          {/* Reasons */}
          {event.reasons.length > 0 && (
            <div className="space-y-0.5">
              {event.reasons.map((r, i) => (
                <div key={i} className="text-[10px] text-zinc-400">· {r}</div>
              ))}
            </div>
          )}

          {/* Domain */}
          {event.primaryDomain && (
            <div className="text-[10px] text-zinc-400 space-y-0.5">
              <span className="text-zinc-500">domain: </span>
              <span className="text-zinc-200">{event.primaryDomain}</span>
              {event.secondaryDomain && (
                <span className="text-zinc-500"> / {event.secondaryDomain}</span>
              )}
              {event.domainConfidence !== null && (
                <span className="text-zinc-500 ml-1">conf={event.domainConfidence.toFixed(2)}</span>
              )}
            </div>
          )}
          {event.decisionPath && (
            <div className="text-[10px] text-zinc-500 font-mono break-all">{event.decisionPath}</div>
          )}

          {/* Score breakdown */}
          {event.scoreBreakdown && <ScoreBreakdown bd={event.scoreBreakdown} />}

          {/* Lens pack */}
          <div className="text-[10px] text-zinc-600 font-mono">lens: {event.lensPackId}</div>
        </div>
      )}
    </div>
  );
}

function LensPackBanner({ info }: { info: LensPackDiagInfo }) {
  const isDefault = info.source !== 'prep_research';
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-[10px] border ${
      isDefault
        ? 'bg-amber-950/60 border-amber-700/50 text-amber-300'
        : 'bg-emerald-950/50 border-emerald-700/40 text-emerald-300'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDefault ? 'bg-amber-400' : 'bg-emerald-400'}`} />
      {isDefault ? (
        <span>
          <span className="font-semibold">DEFAULT_LENS_PACK</span>
          <span className="text-amber-400/70 ml-1">— no prep research. Domain scoring uses generic vocabulary.</span>
          {info.reason && <span className="ml-1 text-amber-500/60">{info.reason}</span>}
        </span>
      ) : (
        <span>
          <span className="font-semibold">{info.packName}</span>
          <span className="text-emerald-400/70 ml-1">— {info.domainCount} workshop domains from prep research</span>
        </span>
      )}
    </div>
  );
}

export function EthentaFlowDiagnosticsPanel({ events, lensPackInfo, onClear }: Props) {
  const [filterDecision, setFilterDecision] = useState<EthentaFlowDiagEvent['decision'] | 'all'>('all');

  const filtered = filterDecision === 'all' ? events : events.filter(e => e.decision === filterDecision);

  const counts = {
    commit:  events.filter(e => e.decision === 'commit').length,
    hold:    events.filter(e => e.decision === 'hold').length,
    discard: events.filter(e => e.decision === 'discard').length,
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      {/* Lens pack source banner */}
      <LensPackBanner info={lensPackInfo} />

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Filter:</span>
        {(['all', 'commit', 'hold', 'discard'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterDecision(f)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              filterDecision === f
                ? 'border-zinc-500 bg-zinc-700 text-zinc-200'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
            }`}
          >
            {f === 'all' ? `ALL (${events.length})` : `${f.toUpperCase()} (${counts[f]})`}
          </button>
        ))}
        <button
          onClick={onClear}
          className="ml-auto text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-0.5">
        {filtered.length === 0 ? (
          <div className="text-zinc-600 text-xs text-center py-6">
            No {filterDecision === 'all' ? '' : filterDecision + ' '}events yet
          </div>
        ) : (
          [...filtered].reverse().map(event => (
            <DiagRow key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
