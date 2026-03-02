import type { Metadata } from 'next';
import {
  Shuffle,
  Layers,
  BarChart3,
  Battery,
  Users,
  Building2,
  ShoppingBag,
  Cpu,
  Shield,
  Eye,
  Target,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  CheckCircle,
} from 'lucide-react';
import { PageHero } from '@/components/dream-landing/page-hero';
import { ScrollReveal, AnimatedCounter } from '@/components/dream-landing/scroll-reveal';
import { CTASection } from '@/components/dream-landing/cta-section';
import { BreadcrumbJsonLd } from '@/lib/dream-landing/seo';

export const metadata: Metadata = {
  title: 'Enterprise AI Adoption  -  Cut Through the Noise with DREAM',
  description:
    'Every enterprise wants to adopt AI. Few know how. DREAM captures what your entire organisation and partner ecosystem actually thinks  -  then cuts through conflicting priorities and misaligned perceptions to build an actionable transformation roadmap.',
  alternates: { canonical: '/dream/use-cases/enterprise-ai-adoption' },
  openGraph: {
    title: 'Enterprise AI Adoption  -  Cut Through the Noise with DREAM',
    description: 'How DREAM helps enterprises build aligned AI transformation roadmaps.',
    url: '/dream/use-cases/enterprise-ai-adoption',
  },
};

const NOISE_CARDS = [
  {
    icon: Shuffle,
    title: 'Conflicting Priorities',
    description:
      'Every division has its own AI ambitions. Marketing wants generative content. Operations wants process automation. IT wants infrastructure modernisation. Nobody is aligned on what AI adoption actually means for the organisation as a whole.',
  },
  {
    icon: Layers,
    title: 'Siloed Thinking',
    description:
      'AI initiatives spring up in isolation. Each team evaluates tools in its own bubble. Partners and vendors are engaged without coordination. There is no enterprise-wide view of capability, readiness, or ecosystem alignment. The result: duplication, conflict, and wasted investment.',
  },
  {
    icon: BarChart3,
    title: 'Misaligned Maturity Perceptions',
    description:
      'Leadership believes the organisation is AI-ready. The frontline disagrees. When your executive team rates AI readiness at 7/10 and your practitioners rate it at 3/10, you have a perception gap that will derail any programme.',
  },
  {
    icon: Battery,
    title: 'Initiative Fatigue',
    description:
      'Teams have seen transformation programmes come and go. AI is the latest. Without genuine engagement and proof that leadership is listening, AI adoption becomes another corporate initiative that won\'t stick.',
  },
];

const DOMAIN_QUESTIONS = [
  {
    icon: Users,
    domain: 'People',
    colour: 'bg-blue-100 text-blue-600',
    question: 'What AI skills exist in your team today? What skills are you missing? How would AI change the way your team works?',
  },
  {
    icon: Building2,
    domain: 'Organisation',
    colour: 'bg-emerald-100 text-emerald-600',
    question: 'How would AI change your governance and decision-making processes? How would it reshape the way you work with partners and your wider ecosystem?',
  },
  {
    icon: ShoppingBag,
    domain: 'Customer',
    colour: 'bg-purple-100 text-purple-600',
    question: 'Where would AI most improve your customer experience? What do your customers expect from AI-powered interactions?',
  },
  {
    icon: Cpu,
    domain: 'Technology',
    colour: 'bg-orange-100 text-orange-600',
    question: 'What is your current technology debt that would block AI integration? What AI infrastructure exists today?',
  },
  {
    icon: Shield,
    domain: 'Regulation',
    colour: 'bg-red-100 text-red-600',
    question: 'What compliance constraints affect how you can deploy AI? What governance frameworks are needed for responsible AI use?',
  },
];

const EXAMPLE_INSIGHTS = [
  {
    insight: '73% of staff rated AI readiness at 3/10 while leadership projected 7/10',
    interpretation:
      'The maturity perception gap. This single finding often reshapes the entire AI adoption strategy.',
  },
  {
    insight:
      'The top constraint across all domains was "data quality"  -  mentioned by 18 of 20 participants, yet it appeared in zero executive planning documents',
    interpretation:
      'Constraints that everyone knows but nobody escalates. This is exactly what DREAM surfaces.',
  },
  {
    insight:
      'Marketing and Operations had completely different definitions of "AI adoption"  -  one meant content generation, the other meant process automation',
    interpretation:
      'Semantic misalignment: the organisation is pursuing different goals under the same label.',
  },
  {
    insight:
      'Only 2 of 15 participants could articulate a customer-facing AI use case, despite the board\'s stated priority being "AI-powered customer experience"',
    interpretation:
      'The strategy-execution gap made visible. The board\'s priority hasn\'t translated into organisational understanding.',
  },
  {
    insight:
      'The Hemisphere Diagnostic showed 78% of AI vision nodes concentrated in the Technology domain. People, Organisation, and Customer domains were nearly empty.',
    interpretation:
      'The organisation is treating AI as a technology problem, not a business transformation. This reframes the entire approach.',
  },
];

export default function EnterpriseAIAdoptionPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'DREAM', href: '/dream' },
          { name: 'Use Cases', href: '/dream/use-cases' },
          { name: 'Enterprise AI Adoption', href: '/dream/use-cases/enterprise-ai-adoption' },
        ]}
      />
      <PageHero
        eyebrow="Use Case"
        headline="Enterprise AI"
        highlightText="Adoption"
        subheadline="Every enterprise wants to adopt AI. Few know how. DREAM captures what your entire organisation and partner ecosystem actually thinks  -  then builds an aligned transformation roadmap."
        stats={[
          { target: 360, suffix: '°', label: 'Enterprise & partners' },
          { target: 5, label: 'Domains explored' },
          { target: 1000, suffix: '+', label: 'Insights captured' },
        ]}
        backgroundImage="/dream-heroes/hero-app-scratchpad.png"
        imagePosition="top center"
      />

      {/* ═══ THE NOISE PROBLEM ═══ */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
              The Problem
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              The Enterprise AI Problem Isn&apos;t Technology.{' '}
              <span className="text-slate-400">It&apos;s Noise.</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mb-10">
              Enterprises don&apos;t lack AI ambition. They lack alignment. Every division, every layer,
              every team has a different view of what AI adoption means, how ready they are, and where
              to start. The result is noise  -  and noise kills transformation.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-6">
            {NOISE_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <ScrollReveal key={card.title} delay={100 + i * 80}>
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 h-full">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-slate-600" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-2">{card.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{card.description}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ HOW DREAM CUTS THROUGH ═══ */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
              The Solution
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              DREAM Doesn&apos;t Ask What You Want to Do with AI.{' '}
              <span className="bg-gradient-to-r from-[#5cf28e] to-[#50c878] bg-clip-text text-transparent">
                It Reveals What You Actually Need.
              </span>
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mb-10">
              Structured AI conversations across 5 domains  -  spanning your teams, partners, and wider
              ecosystem  -  surface what people ACTUALLY think, not what they present in steering committees.
            </p>
          </ScrollReveal>
          <div className="space-y-4">
            {DOMAIN_QUESTIONS.map((domain, i) => {
              const Icon = domain.icon;
              return (
                <ScrollReveal key={domain.domain} delay={100 + i * 80}>
                  <div className="flex items-start gap-4 bg-white rounded-xl p-5 border border-slate-200">
                    <div className={`w-10 h-10 rounded-xl ${domain.colour} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-1">{domain.domain}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed italic">&ldquo;{domain.question}&rdquo;</p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ THE DIRECTIONAL FLOW ═══ */}
      <section className="bg-[#0d0d0d] py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#5cf28e] text-sm font-semibold tracking-[0.15em] uppercase mb-3 text-center">
              The Transformation Flow
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 text-center">
              DREAM Creates Directional Clarity
            </h2>
            <p className="text-lg text-white/60 text-center max-w-2xl mx-auto mb-12">
              Not just data. Direction. Constraints are mapped right-to-left from the future,
              then transformation is planned left-to-right from the present.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {/* Reimagine */}
              <div className="bg-white/5 rounded-2xl p-6 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="h-5 w-5 text-purple-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                    Envision the Future
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Reimagine</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Start with the end state. No constraints. No budgets. What does an AI-enabled
                  enterprise look like in 3 years?
                </p>
                <ul className="space-y-2">
                  {[
                    'Every participant  -  internal teams and partners alike  -  contributes their vision across all 5 domains',
                    'AI facilitation ensures all perspectives are heard',
                    'Themes emerge: where does the organisation converge on AI ambition?',
                    'The collective vision takes shape on-screen in real-time',
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs text-slate-500">
                      <span className="mt-1 w-1 h-1 rounded-full bg-purple-400 flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Constraints */}
              <div className="bg-white/5 rounded-2xl p-6 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <ArrowLeft className="h-5 w-5 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Right → Left
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Constraints</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Look backwards from the future. What specific things would prevent us from
                  reaching that vision?
                </p>
                <ul className="space-y-2">
                  {[
                    'Constraints mapped FROM the future state BACK to the present',
                    'Not "what problems do we have?" but "what blocks the future?"',
                    'Technical debt, skills gaps, regulatory barriers, cultural resistance',
                    'Each constraint weighted, categorised, and linked to the vision it blocks',
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs text-slate-500">
                      <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Apply */}
              <div className="bg-white/5 rounded-2xl p-6 border border-[#5cf28e]/20">
                <div className="flex items-center gap-2 mb-4">
                  <ArrowRight className="h-5 w-5 text-[#5cf28e]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#5cf28e]">
                    Left → Right
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Apply</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Plan forward from today. Design the constraint-aware path from here to there.
                </p>
                <ul className="space-y-2">
                  {[
                    'Transformation plan built LEFT TO RIGHT: from present to future',
                    'Every initiative accounts for the barriers identified',
                    'Multi-lens scoring: cost, risk, experience, regulatory, workforce, ops',
                    'The gap between vision and enablers reveals true transformation distance',
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs text-slate-500">
                      <span className="mt-1 w-1 h-1 rounded-full bg-[#5cf28e] flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollReveal>

          {/* Flow arrows */}
          <ScrollReveal delay={300}>
            <div className="flex items-center justify-center gap-4 text-sm text-white/40">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-[#5cf28e]" />
                <span>Plan the path forward</span>
              </div>
              <span className="text-white/20">|</span>
              <div className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4 text-amber-400" />
                <span>Identify what hinders</span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ EXAMPLE INSIGHTS ═══ */}
      <section className="bg-gradient-to-b from-[#0d0d0d] to-slate-950 text-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#5cf28e] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
              What DREAM Reveals
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold mb-10">
              Real Insights from Enterprise AI Workshops
            </h2>
          </ScrollReveal>
          <div className="space-y-4">
            {EXAMPLE_INSIGHTS.map((item, i) => (
              <ScrollReveal key={i} delay={100 + i * 80}>
                <div className="bg-white/5 rounded-xl p-6 border border-[#5cf28e]/10">
                  <p className="text-base font-semibold text-white mb-2">
                    &ldquo;{item.insight}&rdquo;
                  </p>
                  <p className="text-sm text-slate-400">{item.interpretation}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE OUTCOME ═══ */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3 text-center">
              The Outcome
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-10 text-center">
              Clarity. Alignment. Action.
            </h2>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Lightbulb,
                title: 'Clarity',
                description:
                  'A single, data-grounded view of where the organisation actually stands on AI readiness  -  not where leadership hopes it stands.',
              },
              {
                icon: CheckCircle,
                title: 'Alignment',
                description:
                  'Every division, every partner, every domain  -  surfaced, compared, and brought into a shared understanding. No more "they think this, we think that."',
              },
              {
                icon: Target,
                title: 'Actionable Roadmap',
                description:
                  'A transformation plan that moves left-to-right from present to future, accounts for every constraint identified right-to-left, and is scored across 6 practical dimensions.',
              },
            ].map((outcome, i) => {
              const Icon = outcome.icon;
              return (
                <ScrollReveal key={outcome.title} delay={100 + i * 100}>
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 border border-slate-200 text-center h-full">
                    <div className="w-14 h-14 rounded-2xl bg-[#5cf28e]/10 flex items-center justify-center mx-auto mb-4">
                      <Icon className="h-7 w-7 text-[#33824d]" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">{outcome.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{outcome.description}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <CTASection
        headline="Ready to cut through the noise?"
        subheadline="Book a demo to see how DREAM transforms enterprise AI adoption from confusion to clarity."
      />
    </>
  );
}
