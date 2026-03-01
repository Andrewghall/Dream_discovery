'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ScrollReveal } from './scroll-reveal';

/* ────────────────────────────────────────────────────────────
   Sample Journey Data — curated example for marketing showcase.
   Represents a realistic enterprise transformation journey.
   ──────────────────────────────────────────────────────────── */

type AgencyLevel = 'human' | 'assisted' | 'autonomous';
type Sentiment = 'positive' | 'neutral' | 'concerned';

interface JourneyCell {
  action: string;
  sentiment: Sentiment;
  agency: AgencyLevel;
  painPoint?: boolean;
  momentOfTruth?: boolean;
}

const ACTORS = ['Customer', 'Operations Lead', 'Partner / Ecosystem'] as const;

const STAGES = ['Discovery', 'Engagement', 'Fulfilment', 'Growth'] as const;

const JOURNEY: Record<string, Record<string, JourneyCell>> = {
  Customer: {
    Discovery: {
      action: 'Shares unfiltered expectations in guided conversation',
      sentiment: 'positive',
      agency: 'human',
    },
    Engagement: {
      action: 'AI surfaces hidden priorities across touchpoints',
      sentiment: 'positive',
      agency: 'assisted',
      momentOfTruth: true,
    },
    Fulfilment: {
      action: 'Journey mapped with constraint overlays',
      sentiment: 'neutral',
      agency: 'assisted',
    },
    Growth: {
      action: 'Continuous sentiment tracking post-launch',
      sentiment: 'positive',
      agency: 'autonomous',
    },
  },
  'Operations Lead': {
    Discovery: {
      action: 'Rates maturity across five domains confidentially',
      sentiment: 'neutral',
      agency: 'human',
    },
    Engagement: {
      action: 'Real-time theme clustering reveals misalignment',
      sentiment: 'concerned',
      agency: 'assisted',
      painPoint: true,
    },
    Fulfilment: {
      action: 'Constraint-aware roadmap designed collaboratively',
      sentiment: 'positive',
      agency: 'assisted',
      momentOfTruth: true,
    },
    Growth: {
      action: 'AI monitors transformation signals and drift',
      sentiment: 'positive',
      agency: 'autonomous',
    },
  },
  'Partner / Ecosystem': {
    Discovery: {
      action: 'Maps ecosystem constraints and alignment gaps',
      sentiment: 'neutral',
      agency: 'human',
    },
    Engagement: {
      action: 'AI identifies where partner goals diverge from strategy',
      sentiment: 'concerned',
      agency: 'assisted',
      painPoint: true,
    },
    Fulfilment: {
      action: 'Ecosystem roadmap aligned to transformation plan',
      sentiment: 'positive',
      agency: 'assisted',
    },
    Growth: {
      action: 'Deterministic scoring on partner integration maturity',
      sentiment: 'positive',
      agency: 'autonomous',
    },
  },
};

/* ── Visual config ─────────────────────────────────────── */

const AGENCY_CONFIG: Record<AgencyLevel, { icon: string; label: string; bg: string; text: string }> = {
  human:      { icon: '\u{1F464}', label: 'Human',      bg: 'bg-slate-700',    text: 'text-slate-300' },
  assisted:   { icon: '\u{1F91D}', label: 'Assisted',   bg: 'bg-blue-900/60',  text: 'text-blue-300' },
  autonomous: { icon: '\u{1F916}', label: 'Autonomous', bg: 'bg-emerald-900/60', text: 'text-emerald-300' },
};

const SENTIMENT_DOT: Record<Sentiment, string> = {
  positive: 'bg-emerald-400',
  neutral: 'bg-slate-400',
  concerned: 'bg-amber-400',
};

/* ────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────── */

export function JourneyShowcase() {
  return (
    <section className="bg-[#0d0d0d] py-20">
      <div className="max-w-6xl mx-auto px-6">
        <ScrollReveal>
          <p className="text-[#5cf28e] text-sm font-semibold tracking-[0.15em] uppercase mb-3 text-center">
            See It In Action
          </p>
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 text-center">
            Where AI Meets{' '}
            <span className="bg-gradient-to-r from-[#5cf28e] to-[#50c878] bg-clip-text text-transparent">
              Human Judgement
            </span>
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <p className="text-lg text-white/50 max-w-2xl mx-auto text-center mb-12">
            DREAM maps every actor&apos;s journey, showing exactly where AI augments
            human decision-making &mdash; and where humans must lead.
          </p>
        </ScrollReveal>

        {/* ── Journey Grid ─────────────────────────────── */}
        <ScrollReveal delay={200}>
          <div className="overflow-x-auto -mx-6 px-6">
            <div className="min-w-[680px]">
              {/* Stage headers */}
              <div className="grid grid-cols-[140px_repeat(4,1fr)] gap-2 mb-2">
                <div /> {/* empty corner */}
                {STAGES.map((stage) => (
                  <div key={stage} className="text-center">
                    <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
                      {stage}
                    </span>
                  </div>
                ))}
              </div>

              {/* Actor rows */}
              {ACTORS.map((actor, ai) => (
                <div key={actor} className="grid grid-cols-[140px_repeat(4,1fr)] gap-2 mb-2">
                  {/* Actor label */}
                  <div className="flex items-center">
                    <span className="text-sm font-semibold text-white/70 truncate">{actor}</span>
                  </div>

                  {/* Journey cells */}
                  {STAGES.map((stage, si) => {
                    const cell = JOURNEY[actor][stage];
                    const agencyStyle = AGENCY_CONFIG[cell.agency];
                    const sentimentDot = SENTIMENT_DOT[cell.sentiment];
                    const delay = 300 + ai * 150 + si * 80;

                    return (
                      <ScrollReveal key={`${actor}-${stage}`} delay={delay}>
                        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 hover:bg-white/[0.07] transition-all h-full flex flex-col justify-between min-h-[110px]">
                          {/* Top: sentiment dot + markers */}
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className={`w-2 h-2 rounded-full ${sentimentDot}`} />
                            {cell.painPoint && (
                              <span className="text-[10px]" title="Pain point">
                                {'\u{1F534}'}
                              </span>
                            )}
                            {cell.momentOfTruth && (
                              <span className="text-[10px]" title="Moment of truth">
                                {'\u{2B50}'}
                              </span>
                            )}
                          </div>

                          {/* Action text */}
                          <p className="text-[11px] text-white/60 leading-snug mb-2 flex-1">
                            {cell.action}
                          </p>

                          {/* Agency badge */}
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${agencyStyle.bg} ${agencyStyle.text}`}
                          >
                            <span>{agencyStyle.icon}</span>
                            {agencyStyle.label}
                          </div>
                        </div>
                      </ScrollReveal>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* ── Agency Legend ─────────────────────────────── */}
        <ScrollReveal delay={600}>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 mb-8">
            {(['human', 'assisted', 'autonomous'] as const).map((level, i) => {
              const cfg = AGENCY_CONFIG[level];
              return (
                <div key={level} className="flex items-center gap-3">
                  {i > 0 && (
                    <svg width="20" height="8" className="text-white/20 hidden sm:block">
                      <path d="M0 4h14l-3-3M14 4l-3 3" stroke="currentColor" fill="none" strokeWidth="1.5" />
                    </svg>
                  )}
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${cfg.bg} ${cfg.text} text-xs font-medium`}>
                    <span>{cfg.icon}</span>
                    {cfg.label}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollReveal>

        {/* ── CTA ──────────────────────────────────────── */}
        <ScrollReveal delay={700}>
          <div className="text-center">
            <Link
              href="/dream/use-cases"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#5cf28e] hover:text-[#50c878] transition-colors"
            >
              Explore use cases <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
