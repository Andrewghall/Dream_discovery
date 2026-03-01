import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Zap, Layers, Target, BarChart3, Users } from 'lucide-react';
import { HeroSection } from '@/components/dream-landing/hero-section';
import { ScrollReveal } from '@/components/dream-landing/scroll-reveal';
import { CTASection } from '@/components/dream-landing/cta-section';
import { DifferentiatorsSection } from '@/components/dream-landing/differentiators-section';
import { JourneyShowcase } from '@/components/dream-landing/journey-showcase';
import dynamic from 'next/dynamic';

const AssessmentSection = dynamic(
  () => import('@/components/dream-landing/assessment-section').then((m) => m.AssessmentSection),
  { ssr: true },
);

export const metadata: Metadata = {
  title: 'Ethenta DREAM \u2014 AI-Guided Decision Intelligence Platform',
  description:
    'Stop guessing. DREAM captures how your organisation really thinks and turns collective insight into measurable strategic direction \u2014 with AI that augments human judgment, not replaces it.',
  alternates: { canonical: '/dream' },
  openGraph: {
    title: 'Ethenta DREAM \u2014 AI-Guided Decision Intelligence Platform',
    description:
      'Built for leadership teams who must align strategy and produce decisions they can defend. AI-guided decision intelligence.',
    url: '/dream',
  },
};

const PERSONAS = [
  {
    title: 'Enterprise AI Adoption',
    href: '/dream/use-cases/enterprise-ai-adoption',
    description:
      'Every enterprise wants AI. Few know where to start. DREAM surfaces tensions, misaligned priorities, and hidden constraints \u2014 then builds a transformation roadmap grounded in what people actually think.',
  },
  {
    title: 'Strategy & Innovation',
    href: '/dream/use-cases',
    description:
      'The organisational truth that PowerPoint decks hide. Capture every voice, score the trade-offs, and align teams around priorities you can measure.',
  },
  {
    title: 'Consultancies & Advisory',
    href: '/dream/industries/professional-services',
    description:
      '10\u00D7 deeper client insight in a fraction of the time. AI-guided analysis so your consultants focus on strategy, not data gathering.',
  },
  {
    title: 'Regulated Industries',
    href: '/dream/industries/financial-services',
    description:
      'Map constraints as first-class citizens. Balance innovation with governance. Data-backed scoring you can defend to any regulator.',
  },
];

const VALUE_PROPS = [
  {
    icon: Zap,
    title: 'Enterprise 360\u00B0',
    description: 'Capture what your entire organisation and partner ecosystem really thinks — in a fraction of the time surveys take.',
  },
  {
    icon: Users,
    title: 'Cross-Functional Alignment',
    description: 'Surface the tensions and misaligned priorities that derail programmes.',
  },
  {
    icon: BarChart3,
    title: 'Measurable Trade-Offs',
    description: 'Produce decisions with scored priorities, not opinion-based PowerPoint.',
  },
];

export default function DreamLandingPage() {
  return (
    <>
      {/* ═══ 1. HERO ═══ */}
      <HeroSection />

      {/* ═══ 2. CAPABILITY MATURITY ASSESSMENT ═══ */}
      <AssessmentSection />

      {/* ═══ 3. VALUE GRID ═══ */}
      <section className="bg-white py-16">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3 text-center">
              What You Get
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-3 gap-6 mt-8">
            {VALUE_PROPS.map(({ icon: Icon, title, description }, i) => (
              <ScrollReveal key={title} delay={100 + i * 80}>
                <div className="text-center p-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#5cf28e]/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-[#5cf28e]" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. WHAT MAKES DREAM DIFFERENT — collapsible cards ═══ */}
      <DifferentiatorsSection />

      {/* ═══ 5. ACTOR JOURNEY SHOWCASE ═══ */}
      <JourneyShowcase />

      {/* ═══ 6. ENTERPRISE AI ADOPTION SPOTLIGHT ═══ */}
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
                  Every enterprise wants to adopt AI. Few know how. DREAM cuts through the noise &mdash;
                  conflicting priorities, siloed thinking, misaligned maturity perceptions &mdash; and builds
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

                {/* Breadth signal */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-3">DREAM also powers</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {['Operating model redesign', 'Compliance & regulation', 'Human-AI workflow design', 'Partner ecosystem alignment'].map((uc) => (
                      <span key={uc} className="px-3 py-1.5 text-xs text-white/50 border border-white/10 rounded-full">
                        {uc}
                      </span>
                    ))}
                  </div>
                  <Link
                    href="/dream/use-cases"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5cf28e]/70 hover:text-[#5cf28e] transition-colors"
                  >
                    See all use cases <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ 7. WHO IT'S FOR ═══ */}
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

      {/* ═══ 8. CTA ═══ */}
      <CTASection
        headline="Your organisation already has the answers."
        subheadline="DREAM reveals them and turns them into a plan you can act on."
      />
    </>
  );
}
