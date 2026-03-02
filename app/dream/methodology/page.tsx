import type { Metadata } from 'next';
import { PageHero } from '@/components/dream-landing/page-hero';
import { ScrollReveal } from '@/components/dream-landing/scroll-reveal';
import { CTASection } from '@/components/dream-landing/cta-section';

export const metadata: Metadata = {
  title: 'The DREAM Methodology  -  Five Phases of Transformation',
  description:
    'Discover, Reimagine, Educate, Apply, Mobilise  -  the five-phase methodology that turns organisational noise into structured strategic clarity.',
  alternates: { canonical: '/dream/methodology' },
  openGraph: {
    title: 'The DREAM Methodology  -  Five Phases of Transformation',
    description: 'Five structured phases that turn organisational noise into strategic clarity.',
    url: '/dream/methodology',
  },
};

const PHASES = [
  {
    letter: 'D',
    name: 'Discover',
    gradient: 'from-blue-500 to-cyan-500',
    bg: 'bg-white',
    tagline: 'AI-Powered Discovery',
    paragraphs: [
      'Before the workshop begins, every participant engages in a structured 15-minute AI conversation. This isn\'t a survey or a questionnaire  -  it\'s a genuine dialogue, guided by Agentic AI, that explores what each person really thinks about the organisation\'s current state and future potential.',
      'The conversation covers five organisational domains: People, Organisation, Customer, Technology, and Regulation. For each domain, participants provide maturity ratings  -  current state, target state, and projected trajectory  -  along with free-form insights, constraints, and visions.',
      'Every response is scored for confidence. The AI detects certainty vs hedging automatically, building a map of where the organisation is confident and where it is guessing. Insights are extracted, themes detected, and constraints identified  -  all before anyone enters the workshop room.',
    ],
    bullets: [
      'Structured 15-minute AI-guided conversations with each participant',
      'Five organisational domains: People, Organisation, Customer, Technology, Regulation',
      'Individual maturity ratings: current, target, projected',
      'Automatic insight extraction, theme clustering, and constraint identification',
      'Confidence scoring on every response',
      'Discovery Intelligence briefing prepared for facilitators',
    ],
  },
  {
    letter: 'R',
    name: 'Reimagine',
    gradient: 'from-purple-500 to-pink-500',
    bg: 'bg-gradient-to-b from-slate-50 to-white',
    tagline: 'Collective Future-State Visioning',
    paragraphs: [
      'Reimagine is pure creative energy. No constraints allowed. No budgets discussed. The question is simple: what does the ideal future look like?',
      'Participants collectively envision the future state of the organisation. AI facilitation ensures every voice is heard  -  not just the loudest. Themes emerge from the group\'s collective vision, and the 360° Hemisphere begins to build live on-screen as creative nodes populate the upper hemisphere.',
      'This phase deliberately separates vision from execution. By capturing what people genuinely believe the future should look like  -  before constraints are introduced  -  DREAM reveals the organisation\'s true ambition. The gap between reimagined future and current reality becomes the transformation distance.',
    ],
    bullets: [
      'Pure vision generation  -  no constraints, no budgets, no limitations',
      'AI-powered facilitation ensures all perspectives are heard',
      'Real-time theme clustering across participant contributions',
      'Live 360° Hemisphere builds on-screen',
      'Creative density measured across all five domains',
    ],
  },
  {
    letter: 'E',
    name: 'Educate',
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-white',
    tagline: 'Collective Intelligence Surfaced',
    paragraphs: [
      'The workshop educates itself. Through structured synthesis, patterns emerge that no individual participant could see alone. The collective intelligence of the group becomes greater than the sum of its parts.',
      'DREAM surfaces knowledge gaps, identifies where different parts of the organisation hold contradictory beliefs, and highlights where expertise exists but isn\'t being leveraged. The Educate phase transforms individual knowledge into shared understanding.',
      'Pattern recognition across domains reveals connections that traditional workshops miss. A constraint in Technology might be blocking a vision in Customer. A strength in People might be the key to unlocking an Organisation challenge.',
    ],
    bullets: [
      'Collective intelligence surfaced from all Discovery conversations',
      'Pattern recognition across organisational domains',
      'Knowledge gaps identified and highlighted',
      'Cross-domain connections revealed',
      'Contradictory beliefs between layers surfaced',
    ],
  },
  {
    letter: 'A',
    name: 'Apply',
    gradient: 'from-emerald-500 to-[#50c878]',
    bg: 'bg-gradient-to-b from-slate-50 to-white',
    tagline: 'Constraint-Aware Transformation Design',
    paragraphs: [
      'Apply bridges the gap between the reimagined future and today\'s reality. But it does so directionally  -  constraints are identified right-to-left (from future back to present: what blocks us from getting there?) while the transformation plan is built left-to-right (from present toward the future).',
      'This directional thinking is what makes DREAM different. Instead of asking "what problems do we have?" it asks "what specific things would prevent us from reaching that future?" Every constraint is weighted, categorised by domain, and linked to the vision it blocks.',
      'The result is a transformation plan that accounts for every barrier identified, scored across six practical dimensions: cost, risk, experience impact, regulatory compliance, workforce readiness, and operational complexity.',
    ],
    bullets: [
      'Constraints mapped right-to-left from future state back to present',
      'Transformation plan built left-to-right from present toward future',
      'Multi-lens confidence scoring: cost, risk, experience, regulatory, workforce, operational',
      'Constraint-aware solution design',
      'The gap between vision and enablers reveals true transformation distance',
    ],
  },
  {
    letter: 'M',
    name: 'Mobilise',
    gradient: 'from-red-500 to-rose-500',
    bg: 'bg-white',
    tagline: 'From Insight to Action',
    paragraphs: [
      'Mobilise transforms workshop intelligence into actionable deliverables. The executive scratchpad produces editable strategic output that can be taken directly into board rooms, steering committees, and programme kick-offs.',
      'Every recommendation is grounded in data  -  not opinion. The Hemisphere Psyche Diagnostic compares the organisation\'s state before and after the workshop, revealing where minds have shifted and where resistance persists.',
      'Exportable reports package the full analytical output for presentation. Seven analytical views, the Hemisphere diagnostic, and the executive scratchpad  -  all delivered immediately after the workshop.',
    ],
    bullets: [
      'Executive scratchpad with editable strategic deliverables',
      'Hemisphere Psyche Diagnostic: before vs after comparison',
      'Seven analytical views packaged for board-level presentation',
      'Exportable reports in multiple formats',
      'Measurable strategic insight delivered immediately',
    ],
  },
];

export default function MethodologyPage() {
  return (
    <>
      <PageHero
        eyebrow="The Methodology"
        headline="Five Phases. One"
        highlightText="Transformation."
        subheadline="Each letter in DREAM represents a phase in the journey from insight to action. Together, they create a structured path from organisational noise to strategic clarity."
        backgroundImage="/dream-heroes/hero-signals.png"
        imagePosition="center"
      />

      {/* ═══ PHASE DEEP-DIVES ═══ */}
      {PHASES.map((phase, i) => (
        <section key={phase.letter} className={`${phase.bg} py-20`}>
          <div className="max-w-5xl mx-auto px-6">
            <ScrollReveal>
              <div className="flex items-start gap-6 mb-8">
                <div
                  className={`text-7xl sm:text-8xl font-black bg-gradient-to-br ${phase.gradient} bg-clip-text text-transparent leading-none flex-shrink-0`}
                >
                  {phase.letter}
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">{phase.name}</h2>
                  <p className={`text-sm font-medium bg-gradient-to-r ${phase.gradient} bg-clip-text text-transparent`}>
                    {phase.tagline}
                  </p>
                </div>
              </div>
            </ScrollReveal>

            <div className="grid md:grid-cols-2 gap-10">
              <div>
                {phase.paragraphs.map((para, pi) => (
                  <ScrollReveal key={pi} delay={100 + pi * 80}>
                    <p className="text-slate-600 leading-relaxed mb-4">{para}</p>
                  </ScrollReveal>
                ))}
              </div>
              <ScrollReveal delay={200}>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Key Capabilities</h3>
                  <ul className="space-y-3">
                    {phase.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${phase.gradient} flex-shrink-0`} />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>
      ))}

      {/* ═══ DIRECTIONAL FLOW ═══ */}
      <section className="bg-[#0d0d0d] py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 text-center">
              The Directional Flow
            </h2>
            <p className="text-lg text-white/60 text-center max-w-2xl mx-auto mb-12">
              DREAM creates directional clarity  -  constraints are mapped right-to-left from the future, then transformation is planned left-to-right from the present.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  phase: 'Reimagine',
                  direction: 'Envision the future',
                  description: 'Start with the end state. What does the ideal organisation look like? No constraints, no budgets  -  pure vision.',
                  colour: 'border-purple-500/30',
                  textColour: 'text-purple-400',
                },
                {
                  phase: 'Constraints',
                  direction: 'Right → Left',
                  description: 'Look backwards from the future. What specific things would prevent us from reaching that vision? Map every barrier.',
                  colour: 'border-amber-500/30',
                  textColour: 'text-amber-400',
                },
                {
                  phase: 'Apply',
                  direction: 'Left → Right',
                  description: 'Plan forward from today. Build a constraint-aware transformation roadmap scored across six practical dimensions.',
                  colour: 'border-[#5cf28e]/30',
                  textColour: 'text-[#5cf28e]',
                },
              ].map((item, i) => (
                <div
                  key={item.phase}
                  className={`bg-white/5 rounded-2xl p-6 border ${item.colour}`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-wider ${item.textColour} mb-2`}>
                    {item.direction}
                  </p>
                  <h3 className="text-lg font-bold text-white mb-3">{item.phase}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <CTASection
        headline="Experience the DREAM methodology"
        subheadline="See how five phases transform organisational noise into strategic clarity."
      />
    </>
  );
}
