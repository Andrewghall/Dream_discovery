'use client';

import { useState } from 'react';

const LENS_COLOR: Record<string, string> = {
  People:       '#3b82f6',
  Organisation: '#22c55e',
  Customer:     '#a855f7',
  Technology:   '#f97316',
  Regulation:   '#ef4444',
};

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f2c65c',
};

const HORIZON_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  now:   { bg: 'rgba(92,242,142,0.12)',  text: '#5cf28e',  label: 'Now (Weeks 1–4)'   },
  next:  { bg: 'rgba(242,198,92,0.12)',  text: '#f2c65c',  label: 'Next (Weeks 5–12)' },
  later: { bg: 'rgba(92,198,242,0.12)',  text: '#5cc6f2',  label: 'Later (Weeks 13–52)' },
};

const TABS = ['Discover', 'Reimagine', 'Constraints', 'Path Forward', 'Outcomes'] as const;
type Tab = typeof TABS[number];

interface V2Output {
  discover?: {
    execSummary?: string;
    truths?: Array<{ statement: string; actor?: string; journeyStage?: string; lens?: string; evidenceStrength?: string; whyItMatters?: string; evidence?: string[] }>;
    gaps?: string[];
    painConcentration?: string;
  };
  reimagine?: {
    execSummary?: string;
    futureStates?: Array<{ title: string; actor?: string; lens?: string; valueUnlocked?: string; whatDisappears?: string }>;
    actorJourneyShifts?: Array<{ actor: string; from: string; to: string }>;
  };
  constraints?: {
    execSummary?: string;
    clusters?: Array<{ name: string; count?: number; lens?: string; severity?: string; effort?: string; whyItBlocks?: string; items?: string[] }>;
    totals?: { total: number; solvable: number };
  };
  pathForward?: {
    execSummary?: string;
    steps?: Array<{ horizon: string; action: string; constraintAddressed?: string; owner?: string; expectedImpact?: string }>;
  };
  outcomes?: {
    execSummary?: string;
    items?: Array<{ outcome: string; baseline: string; target: string; metric?: string; linkedInsight?: string; actor?: string }>;
  };
}

export function ExecInsightsView({ v2Output }: { v2Output: V2Output }) {
  const [activeTab, setActiveTab] = useState<Tab>('Discover');

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-8 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === tab
                ? 'bg-[#5cf28e] text-[#0a0a0a]'
                : 'border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Discover */}
      {activeTab === 'Discover' && (
        <div className="space-y-6">
          {v2Output.discover?.execSummary && <ExecSummaryCard text={v2Output.discover.execSummary} />}
          {v2Output.discover?.truths?.map((t, i) => (
            <div key={i} className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-5">
              <div className="flex flex-wrap gap-2 mb-3">
                {t.lens && <Pill text={t.lens} color={LENS_COLOR[t.lens] ?? '#6b7280'} />}
                {t.actor && <Pill text={t.actor} color="#6b7280" />}
                {t.evidenceStrength && <Pill text={t.evidenceStrength} color={t.evidenceStrength === 'strong' ? '#5cf28e' : t.evidenceStrength === 'moderate' ? '#f2c65c' : '#f2955c'} />}
              </div>
              <p className="text-white/80 text-sm leading-relaxed mb-2">{t.statement}</p>
              {t.whyItMatters && <p className="text-white/35 text-xs leading-relaxed">{t.whyItMatters}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Reimagine */}
      {activeTab === 'Reimagine' && (
        <div className="space-y-6">
          {v2Output.reimagine?.execSummary && <ExecSummaryCard text={v2Output.reimagine.execSummary} />}
          <div className="grid sm:grid-cols-2 gap-4">
            {v2Output.reimagine?.futureStates?.map((fs, i) => (
              <div key={i} className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-5">
                {fs.lens && <Pill text={fs.lens} color={LENS_COLOR[fs.lens] ?? '#6b7280'} />}
                <p className="text-white font-semibold text-sm mt-3 mb-2">{fs.title}</p>
                {fs.valueUnlocked && <p className="text-[#5cf28e]/70 text-xs leading-relaxed mb-1"><span className="text-white/25">Value: </span>{fs.valueUnlocked}</p>}
                {fs.whatDisappears && <p className="text-white/30 text-xs leading-relaxed"><span className="text-white/20">Friction removed: </span>{fs.whatDisappears}</p>}
              </div>
            ))}
          </div>
          {v2Output.reimagine?.actorJourneyShifts && v2Output.reimagine.actorJourneyShifts.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 mb-4">Actor Journey Shifts</p>
              <div className="space-y-3">
                {v2Output.reimagine.actorJourneyShifts.map((s, i) => (
                  <div key={i} className="bg-[#111111] border border-[#1e1e1e] rounded-xl px-5 py-4 flex items-start gap-4">
                    <span className="text-xs font-bold text-white/60 w-28 flex-shrink-0 pt-0.5">{s.actor}</span>
                    <span className="text-xs text-white/35 flex-1">{s.from}</span>
                    <span className="text-white/20 text-xs">→</span>
                    <span className="text-xs text-[#5cf28e]/70 flex-1">{s.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Constraints */}
      {activeTab === 'Constraints' && (
        <div className="space-y-6">
          {v2Output.constraints?.execSummary && <ExecSummaryCard text={v2Output.constraints.execSummary} />}
          {v2Output.constraints?.totals && (
            <div className="flex gap-4">
              <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl px-5 py-3">
                <p className="text-2xl font-black text-white">{v2Output.constraints.totals.total}</p>
                <p className="text-xs text-white/30">Total constraints</p>
              </div>
              <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl px-5 py-3">
                <p className="text-2xl font-black text-[#5cf28e]">{v2Output.constraints.totals.solvable}</p>
                <p className="text-xs text-white/30">Solvable</p>
              </div>
            </div>
          )}
          {v2Output.constraints?.clusters?.map((c, i) => {
            const sevColor = SEV_COLOR[c.severity ?? 'medium'] ?? '#f2c65c';
            return (
              <div key={i} className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-white font-semibold text-sm">{c.name}</p>
                    {c.count != null && <p className="text-white/25 text-xs mt-0.5">{c.count} instances</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {c.severity && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: `${sevColor}20`, color: sevColor }}>{c.severity}</span>}
                    {c.lens && <Pill text={c.lens} color={LENS_COLOR[c.lens] ?? '#6b7280'} />}
                  </div>
                </div>
                {c.whyItBlocks && <p className="text-white/40 text-xs leading-relaxed mb-3">{c.whyItBlocks}</p>}
                {c.items && c.items.length > 0 && (
                  <ul className="space-y-1">
                    {c.items.slice(0, 4).map((item, j) => (
                      <li key={j} className="text-xs text-white/30 pl-3 border-l border-white/[0.06]">{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Path Forward */}
      {activeTab === 'Path Forward' && (
        <div className="space-y-6">
          {v2Output.pathForward?.execSummary && <ExecSummaryCard text={v2Output.pathForward.execSummary} />}
          {(['now', 'next', 'later'] as const).map(horizon => {
            const steps = v2Output.pathForward?.steps?.filter(s => s.horizon === horizon) ?? [];
            if (!steps.length) return null;
            const style = HORIZON_STYLE[horizon];
            return (
              <div key={horizon}>
                <p className="text-xs font-bold mb-3" style={{ color: style.text }}>{style.label}</p>
                <div className="space-y-3">
                  {steps.map((s, i) => (
                    <div key={i} className="border rounded-xl p-4" style={{ borderColor: `${style.text}30`, background: style.bg }}>
                      <p className="text-white/90 text-sm font-medium mb-1">{s.action}</p>
                      {s.owner && <p className="text-xs mb-1" style={{ color: `${style.text}80` }}>Owner: {s.owner}</p>}
                      {s.expectedImpact && <p className="text-white/35 text-xs leading-relaxed">{s.expectedImpact}</p>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Outcomes */}
      {activeTab === 'Outcomes' && (
        <div className="space-y-6">
          {v2Output.outcomes?.execSummary && <ExecSummaryCard text={v2Output.outcomes.execSummary} />}
          <div className="grid sm:grid-cols-2 gap-4">
            {v2Output.outcomes?.items?.map((o, i) => (
              <div key={i} className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-5">
                <p className="text-xs text-[#5cf28e]/60 uppercase tracking-wide mb-2">{o.metric ?? 'Outcome'}</p>
                <p className="text-white/80 text-sm leading-relaxed mb-4">{o.outcome}</p>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white/50">{o.baseline}</p>
                    <p className="text-[9px] text-white/20">Baseline</p>
                  </div>
                  <div className="text-white/20 text-sm flex-1 text-center">→</div>
                  <div className="text-center">
                    <p className="text-lg font-black text-[#5cf28e]">{o.target}</p>
                    <p className="text-[9px] text-white/20">Target</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExecSummaryCard({ text }: { text: string }) {
  return (
    <div className="border border-[#5cf28e]/20 rounded-2xl p-5 bg-[#5cf28e]/[0.04]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#5cf28e]" />
        <p className="text-[10px] text-[#5cf28e]/60 uppercase tracking-[0.2em]">Executive Summary</p>
      </div>
      <p className="text-white/65 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
      style={{ background: `${color}20`, color }}>
      {text}
    </span>
  );
}
