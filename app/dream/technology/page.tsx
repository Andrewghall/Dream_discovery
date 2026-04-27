import type { Metadata } from 'next';
import { Brain, Sparkles, BarChart3, Shield, Database, Cpu, ArrowRight } from 'lucide-react';
import { PageHero } from '@/components/dream-landing/page-hero';
import { ScrollReveal } from '@/components/dream-landing/scroll-reveal';
import { CTASection } from '@/components/dream-landing/cta-section';

export const metadata: Metadata = {
  title: 'EthentaFlow  -  The Technology Behind DREAM',
  description:
    'EthentaFlow™ orchestrates multiple specialist AI agents alongside deterministic analytics to power DREAM. Real-time synthesis, agentic coordination, and 7 analytical views transform workshop conversations into board-ready intelligence.',
  alternates: { canonical: '/dream/technology' },
  openGraph: {
    title: 'EthentaFlow™  -  The Technology Behind DREAM',
    description: 'Deterministic AI intelligence that captures, synthesises, and delivers organisational insight.',
    url: '/dream/technology',
  },
};

const CAPABILITIES = [
  {
    icon: Brain,
    iconBg: 'bg-emerald-100 text-emerald-700',
    title: 'Capture Everything',
    description:
      'Every insight, constraint, and vision is captured through AI-guided conversations across seven organisational domains. No signal is lost.',
    details: [
      'Structured 15-minute AI conversations with each participant',
      'Seven organisational domains: People, Operations, Technology, Commercial, Customer, Risk / Compliance, Partners',
      'Individual maturity ratings: current state, target state, projected trajectory',
      'Confidence scoring on every response  -  certainty vs hedging detected automatically',
      'Automatic insight extraction, theme detection, and constraint identification',
    ],
  },
  {
    icon: Sparkles,
    iconBg: 'bg-indigo-100 text-indigo-600',
    title: 'Synthesise in Real-Time',
    description:
      'Multiple specialist AI agents orchestrate in real-time  -  each with a distinct role  -  to analyse, correlate, and surface patterns as the workshop unfolds.',
    details: [
      'Discovery Agent conducts adaptive conversations, extracting structured intelligence from each participant',
      'Facilitation Orchestrator coordinates live workshop phases, handing off between specialist agents',
      'Question Set Agent generates phase-specific questions grounded in real Discovery data',
      'Synthesis agents cluster themes, score confidence, and surface cross-participant patterns in real-time',
      'Live 360° Hemisphere builds on-screen as the agents work in concert',
    ],
  },
  {
    icon: BarChart3,
    iconBg: 'bg-purple-100 text-purple-600',
    title: 'Deliver Intelligence',
    description:
      'Seven analytical views transform raw dialogue into actionable, board-ready insight.',
    details: [
      'Sentiment Index: creative density vs constraint density across every domain',
      'Bias Detection: dominant voices, contribution imbalance, Gini coefficient scoring',
      'Balance Safeguards: pattern-matched flags for systemic imbalances',
      'Multi-Lens Analysis: cost, risk, experience, regulatory, workforce, operational scoring',
      'Exportable reports for board-level presentation',
    ],
  },
];

const PIPELINE_STAGES = [
  {
    icon: Database,
    stage: 'Capture',
    colour: 'from-[#5cf28e] to-[#50c878]',
    description:
      'AI-guided conversations across 5 organisational domains. Maturity ratings, confidence scoring, and automatic insight extraction produce structured intelligence from every participant.',
  },
  {
    icon: Cpu,
    stage: 'Synthesise',
    colour: 'from-indigo-500 to-purple-500',
    description:
      'Multiple specialist AI agents  -  orchestrated by a central Facilitation Orchestrator  -  analyse, correlate, and cluster patterns in real-time. The deterministic diagnostic engine computes sentiment, bias, and balance scores reproducibly alongside the agentic layer.',
  },
  {
    icon: BarChart3,
    stage: 'Deliver',
    colour: 'from-purple-500 to-pink-500',
    description:
      'Seven analytical views, the 360° Hemisphere diagnostic, and an executive scratchpad. Exportable, board-ready intelligence delivered immediately after the workshop.',
  },
];

export default function TechnologyPage() {
  return (
    <>
      <PageHero
        eyebrow="The Technology"
        headline="Powered by"
        highlightText="EthentaFlow™"
        subheadline="Multiple specialist AI agents orchestrated together with deterministic analytics. Not a single AI  -  an ensemble that captures, synthesises, and delivers reproducible intelligence."
        backgroundImage="/dream-heroes/hero-signals.png"
        imagePosition="center"
      />

      {/* ═══ THREE PILLARS ═══ */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6 space-y-16">
          {CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon;
            const reverse = i % 2 === 1;
            return (
              <ScrollReveal key={cap.title} delay={100}>
                <div className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 items-start`}>
                  <div className="flex-1">
                    <div className={`w-12 h-12 rounded-xl ${cap.iconBg} flex items-center justify-center mb-4`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">{cap.title}</h3>
                    <p className="text-slate-600 leading-relaxed mb-4">{cap.description}</p>
                  </div>
                  <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                    <ul className="space-y-3">
                      {cap.details.map((detail) => (
                        <li key={detail} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#50c878] flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* ═══ ARCHITECTURE FLOW ═══ */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 text-center">
              The Intelligence Pipeline
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <p className="text-lg text-slate-600 text-center max-w-2xl mx-auto mb-12">
              Three stages, one continuous flow  -  from raw conversation to board-ready insight.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-6">
            {PIPELINE_STAGES.map((stage, i) => {
              const Icon = stage.icon;
              return (
                <ScrollReveal key={stage.stage} delay={200 + i * 100}>
                  <div className="text-center">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${stage.colour} mb-4`}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && (
                      <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2">
                        <ArrowRight className="h-5 w-5 text-slate-300" />
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{stage.stage}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{stage.description}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ DETERMINISTIC ENGINE ═══ */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Not Just AI. Deterministic Intelligence.
              </h2>
              <p className="text-lg text-slate-600 mb-10">
                EthentaFlow&apos;s analytical engine produces reproducible, auditable results.
                The same data always produces the same insights.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: Shield,
                title: 'Reproducible',
                description: 'Sentiment and bias scores are computed deterministically  -  not generated by an LLM. Run it twice, get the same result.',
              },
              {
                icon: BarChart3,
                title: 'Auditable',
                description: 'Bias detection uses the Gini coefficient. Balance safeguards are pattern-matched. Every metric has a transparent methodology.',
              },
              {
                icon: Brain,
                title: 'Grounded',
                description: 'AI facilitation is grounded in real Discovery data. Questions are generated from what participants actually said  -  not hallucinated.',
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <ScrollReveal key={item.title} delay={100 + i * 80}>
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 h-full">
                    <Icon className="h-6 w-6 text-[#33824d] mb-3" />
                    <h3 className="text-base font-bold text-slate-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ PULL QUOTE ═══ */}
      <section className="bg-gradient-to-r from-[#5cf28e]/10 via-[#50c878]/10 to-[#33824d]/10 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <ScrollReveal>
            <p className="text-xl md:text-2xl text-slate-700 italic font-medium leading-relaxed">
              &ldquo;EthentaFlow doesn&rsquo;t summarise what was said. It reveals what the organisation actually thinks.&rdquo;
            </p>
          </ScrollReveal>
        </div>
      </section>

      <CTASection
        headline="See EthentaFlow in action"
        subheadline="Book a demo to experience the capture-and-synthesise engine firsthand."
      />
    </>
  );
}
