'use client';

import { ScrollReveal } from './scroll-reveal';

const PRIMARY_FEATURES = [
  {
    title: '360\u00B0 Hemisphere',
    visual: 'hemisphere',
    description:
      'A living map of your organisation\'s collective psyche. Visions and creativity in the upper hemisphere, constraints and friction below. See whether energy or resistance dominates.',
  },
  {
    title: 'Sentiment Index',
    visual: 'sentiment',
    description:
      'Measures creative density versus constraint density across every domain. Reveals whether your organisation is expansive, defensive, or fragmented.',
  },
  {
    title: 'Bias Detection',
    visual: 'bias',
    description:
      'Identifies dominant voices, contribution imbalances, and sentiment skew. Ensures no single perspective hijacks the narrative.',
  },
];

const SECONDARY_FEATURES = [
  {
    title: 'Balance Safeguards',
    description: 'Pattern-matched flags for systemic imbalances: excess imagination, missing domains, single-voice dominance.',
  },
  {
    title: 'Multi-Lens Analysis',
    description: 'Scores readiness across cost, risk, experience, regulatory, workforce, and operational dimensions.',
  },
  {
    title: 'Narrative Divergence',
    description: 'Compares language across organisational layers. What leadership says versus what frontline workers experience.',
  },
  {
    title: 'Confidence Index',
    description: 'Maps certainty, hedging, and uncertainty in participant language. Where the organisation is sure and where it is guessing.',
  },
];

function HemisphereVisual() {
  return (
    <div className="relative w-full h-32 flex items-center justify-center">
      {/* Outer ring */}
      <div className="absolute w-28 h-28 rounded-full border border-[#5cf28e]/30" />
      {/* Middle ring */}
      <div className="absolute w-20 h-20 rounded-full border border-indigo-400/30" />
      {/* Core */}
      <div className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-[#5cf28e]/20 to-indigo-400/20" />
      {/* Equator line */}
      <div className="absolute w-28 h-[1px] bg-gradient-to-r from-transparent via-[#5cf28e]/40 to-transparent" />
      {/* Nodes */}
      <div className="absolute w-2 h-2 rounded-full bg-[#5cf28e] top-6 left-1/2 -translate-x-2" />
      <div className="absolute w-2 h-2 rounded-full bg-emerald-400 top-10 right-1/3" />
      <div className="absolute w-1.5 h-1.5 rounded-full bg-purple-400 bottom-10 left-1/3" />
      <div className="absolute w-2 h-2 rounded-full bg-blue-400 bottom-8 right-1/4" />
      <div className="absolute w-1.5 h-1.5 rounded-full bg-orange-400 top-14 left-1/4" />
    </div>
  );
}

function SentimentVisual() {
  return (
    <div className="w-full h-32 flex flex-col justify-center gap-2 px-4">
      {['People', 'Organisation', 'Customer'].map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-[10px] text-white/75 w-16 text-right">{label}</span>
          <div className="flex-1 flex gap-0.5 h-4">
            <div
              className="bg-emerald-400 rounded-l"
              style={{ width: `${65 - i * 12}%` }}
            />
            <div
              className="bg-red-400/80 rounded-r"
              style={{ width: `${35 + i * 12}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function BiasVisual() {
  return (
    <div className="w-full h-32 flex items-center justify-center">
      <div className="relative w-24 h-24">
        {/* Arc background */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
          />
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="url(#biasGrad)"
            strokeWidth="8"
            strokeDasharray="200"
            strokeDashoffset="80"
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
          <defs>
            <linearGradient id="biasGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5cf28e" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
          </defs>
          <text x="50" y="54" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
            0.72
          </text>
        </svg>
        <div className="absolute -bottom-1 w-full text-center text-[9px] text-white/70">
          Equity Score
        </div>
      </div>
    </div>
  );
}

export function RevealsSection() {
  return (
    <section id="insights" className="bg-slate-950 text-white py-24">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <ScrollReveal>
          <p className="text-[#5cf28e] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
            Analytical Intelligence
          </p>
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            See What Others Miss
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <p className="text-lg text-slate-400 max-w-2xl mb-14">
            DREAM produces seven distinct analytical views that reveal the true state of your organisation.
          </p>
        </ScrollReveal>

        {/* Primary features  -  3 large cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {PRIMARY_FEATURES.map((feat, i) => {
            const Visual =
              feat.visual === 'hemisphere'
                ? HemisphereVisual
                : feat.visual === 'sentiment'
                  ? SentimentVisual
                  : BiasVisual;
            return (
              <ScrollReveal key={feat.title} delay={200 + i * 100}>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-full">
                  <Visual />
                  <h3 className="text-base font-bold mt-4 mb-2">{feat.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{feat.description}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Secondary features  -  4 smaller cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SECONDARY_FEATURES.map((feat, i) => (
            <ScrollReveal key={feat.title} delay={500 + i * 80}>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 h-full">
                <h4 className="text-sm font-bold mb-2">{feat.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{feat.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
