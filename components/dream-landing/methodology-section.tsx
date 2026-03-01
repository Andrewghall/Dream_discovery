'use client';

import { ScrollReveal } from './scroll-reveal';

const PHASES = [
  {
    letter: 'D',
    name: 'Discover',
    gradient: 'from-blue-500 to-cyan-500',
    description: 'AI-facilitated conversations with each participant across five organisational domains.',
    bullets: [
      'Structured 15-minute discovery interviews',
      'Maturity ratings & confidence scoring',
      'Automatic insight extraction',
    ],
  },
  {
    letter: 'R',
    name: 'Reimagine',
    gradient: 'from-purple-500 to-pink-500',
    description: 'Collectively envision the future state. Pure creative energy without constraints.',
    bullets: [
      'Vision & belief generation',
      'AI-powered facilitation guidance',
      'Real-time theme clustering',
    ],
  },
  {
    letter: 'E',
    name: 'Educate',
    gradient: 'from-amber-500 to-orange-500',
    description: 'Structured learning and knowledge synthesis. The workshop educates itself.',
    bullets: [
      'Collective intelligence surfaced',
      'Pattern recognition across domains',
      'Knowledge gaps identified',
    ],
  },
  {
    letter: 'A',
    name: 'Apply',
    gradient: 'from-emerald-500 to-teal-500',
    description: 'Bridge from today to the reimagined future while respecting real constraints.',
    bullets: [
      'Practical approach definition',
      'Constraint-aware solution design',
      'Multi-lens confidence assessment',
    ],
  },
  {
    letter: 'M',
    name: 'Mobilise',
    gradient: 'from-red-500 to-rose-500',
    description: 'Post-workshop execution planning. Commit to action with clarity and conviction.',
    bullets: [
      'Actionable deliverables',
      'Executive-ready output',
      'Measurable strategic insight',
    ],
  },
];

export function MethodologySection() {
  return (
    <section id="methodology" className="bg-gradient-to-b from-slate-50 to-white py-24">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <ScrollReveal>
          <p className="text-teal-500 text-sm font-semibold tracking-[0.15em] uppercase mb-3">
            The Methodology
          </p>
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Five Phases. One Transformation.
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <p className="text-lg text-slate-600 max-w-2xl mb-14">
            Each letter in DREAM represents a phase in the journey from insight to action.
          </p>
        </ScrollReveal>

        {/* Phase columns */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {PHASES.map((phase, i) => (
            <ScrollReveal key={phase.letter} delay={200 + i * 80}>
              <div className="text-center md:text-left">
                {/* Large letter */}
                <div
                  className={`text-6xl md:text-7xl font-black bg-gradient-to-br ${phase.gradient} bg-clip-text text-transparent mb-3 leading-none`}
                >
                  {phase.letter}
                </div>

                {/* Phase name */}
                <h3 className="text-lg font-bold text-slate-900 mb-2">{phase.name}</h3>

                {/* Description */}
                <p className="text-sm text-slate-600 leading-relaxed mb-3">{phase.description}</p>

                {/* Bullets */}
                <ul className="space-y-1">
                  {phase.bullets.map((bullet) => (
                    <li key={bullet} className="text-xs text-slate-500 flex items-start gap-1.5">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${phase.gradient} flex-shrink-0`} />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
