import Link from 'next/link';
import { Brain, Sparkles, BarChart3, MessageSquare, Users, ArrowRight, Zap, Layers, Target } from 'lucide-react';
import { HeroSection } from '@/components/dream-landing/hero-section';
import { ScrollReveal } from '@/components/dream-landing/scroll-reveal';
import { CTASection } from '@/components/dream-landing/cta-section';

const METHODOLOGY_LETTERS = [
  { letter: 'D', name: 'Discover', gradient: 'from-blue-500 to-cyan-500' },
  { letter: 'R', name: 'Reimagine', gradient: 'from-purple-500 to-pink-500' },
  { letter: 'E', name: 'Educate', gradient: 'from-amber-500 to-orange-500' },
  { letter: 'A', name: 'Apply', gradient: 'from-emerald-500 to-[#50c878]' },
  { letter: 'M', name: 'Mobilise', gradient: 'from-red-500 to-rose-500' },
];

const PERSONAS = [
  {
    title: 'Enterprise Transformation',
    href: '/dream/industries',
    description: 'Capture every voice and surface the tensions that derail programmes.',
  },
  {
    title: 'Strategy & Innovation',
    href: '/dream/use-cases',
    description: 'The organisational truth that PowerPoint decks and steering committees hide.',
  },
  {
    title: 'Consultancies & Advisory',
    href: '/dream/industries/professional-services',
    description: 'Deeper client insight in less time with structured AI-powered intelligence.',
  },
  {
    title: 'Regulated Industries',
    href: '/dream/industries/financial-services',
    description: 'Map constraints as first-class citizens. Balance innovation with governance.',
  },
];

export default function DreamLandingPage() {
  return (
    <>
      {/* Hero — kept full-screen */}
      <HeroSection />

      {/* ═══ ETHENTAFLOW TEASER ═══ */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
              The Technology
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Powered by{' '}
              <span className="bg-gradient-to-r from-[#5cf28e] to-[#50c878] bg-clip-text text-transparent">
                EthentaFlow&trade;
              </span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <p className="text-lg text-slate-600 max-w-2xl mb-8">
              The capture-and-synthesise engine that transforms conversations into organisational intelligence.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className="flex flex-wrap gap-6 mb-8">
              {[
                { icon: Brain, label: 'Capture Everything' },
                { icon: Sparkles, label: 'Synthesise in Real-Time' },
                { icon: BarChart3, label: 'Deliver Intelligence' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-slate-700">
                  <div className="w-8 h-8 rounded-lg bg-[#5cf28e]/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-[#33824d]" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={250}>
            <Link
              href="/dream/technology"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#33824d] hover:text-[#50c878] transition-colors"
            >
              Explore EthentaFlow <ArrowRight className="h-4 w-4" />
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ METHODOLOGY TEASER ═══ */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
              The Methodology
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10">
              Five Phases. One Transformation.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-8">
              {METHODOLOGY_LETTERS.map((phase, i) => (
                <div key={phase.letter} className="text-center">
                  <div
                    className={`text-5xl sm:text-6xl font-black bg-gradient-to-br ${phase.gradient} bg-clip-text text-transparent leading-none mb-1`}
                  >
                    {phase.letter}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-500 font-medium">{phase.name}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className="text-center">
              <Link
                href="/dream/methodology"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#33824d] hover:text-[#50c878] transition-colors"
              >
                See the full methodology <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ INSIGHTS TEASER ═══ */}
      <section className="bg-slate-950 text-white py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <ScrollReveal>
            <p className="text-[#5cf28e] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
              Analytical Intelligence
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">See What Others Miss</h2>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
              Seven distinct analytical views that reveal the true state of your organisation.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className="flex justify-center gap-6 mb-8">
              {['360° Hemisphere', 'Sentiment Index', 'Bias Detection'].map((label) => (
                <div
                  key={label}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"
                >
                  <span className="text-xs text-slate-400 text-center px-2">{label}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={250}>
            <Link
              href="/dream/insights"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#5cf28e] hover:text-[#50c878] transition-colors"
            >
              Explore all 7 views <ArrowRight className="h-4 w-4" />
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ HOW IT WORKS TEASER ═══ */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3 text-center">
              The Journey
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10 text-center">
              From Conversation to Action
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-xl mx-auto mb-8">
              {[
                { icon: MessageSquare, label: 'Before', sub: 'AI Discovery' },
                { icon: Users, label: 'During', sub: 'Live Guidance' },
                { icon: BarChart3, label: 'After', sub: 'Intelligence' },
              ].map(({ icon: Icon, label, sub }, i) => (
                <div key={label} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#5cf28e]/10 border border-[#50c878]/20 mb-3">
                    <Icon className="h-6 w-6 text-[#33824d]" />
                  </div>
                  <div className="text-sm font-bold text-slate-900">{label}</div>
                  <div className="text-xs text-slate-500">{sub}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className="text-center">
              <Link
                href="/dream/how-it-works"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#33824d] hover:text-[#50c878] transition-colors"
              >
                See the full journey <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ USE CASE SPOTLIGHT: ENTERPRISE AI ADOPTION ═══ */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <div className="bg-[#0d0d0d] rounded-3xl p-8 sm:p-12 overflow-hidden relative">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse 60% 60% at 80% 50%, rgba(92, 242, 142, 0.08), transparent)',
                }}
              />
              <div className="relative z-10">
                <p className="text-[#5cf28e] text-xs font-semibold tracking-[0.2em] uppercase mb-4">
                  Featured Use Case
                </p>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
                  Enterprise AI Adoption
                </h2>
                <p className="text-white/60 max-w-2xl mb-6 leading-relaxed">
                  Every enterprise wants to adopt AI. Few know how. DREAM cuts through the noise —
                  conflicting priorities, siloed thinking, misaligned maturity perceptions — and builds
                  a transformation roadmap grounded in what people actually think.
                </p>
                <div className="flex flex-wrap gap-3 mb-8">
                  {[
                    { icon: Zap, label: 'Cut through noise' },
                    { icon: Layers, label: 'Align the enterprise' },
                    { icon: Target, label: 'Build the roadmap' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 text-white/70">
                      <Icon className="h-4 w-4 text-[#5cf28e]" />
                      <span className="text-sm">{label}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/dream/use-cases/enterprise-ai-adoption"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all shadow-lg shadow-[#5cf28e]/20"
                >
                  Explore this use case <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ WHO IT'S FOR ═══ */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3 text-center">
              Who It&apos;s For
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10 text-center">
              Built for Organisations That Demand Clarity
            </h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {PERSONAS.map((persona, i) => (
              <ScrollReveal key={persona.title} delay={150 + i * 80}>
                <Link href={persona.href} className="block group">
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:border-[#50c878]/30 hover:shadow-md transition-all h-full">
                    <h3 className="text-base font-bold text-slate-900 mb-2">{persona.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">{persona.description}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#33824d] group-hover:text-[#50c878] transition-colors">
                      Learn more <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA BAND ═══ */}
      <CTASection
        headline="Ready to cut through the noise?"
        subheadline="See how DREAM transforms workshops into decision intelligence."
      />
    </>
  );
}
