import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Zap, Layers, Target } from 'lucide-react';
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
  title: 'Ethenta DREAM — Agentic Decision Intelligence Platform',
  description:
    'The world\u2019s first agentic decision intelligence platform. DREAM uses agentic AI and specialist small language models to cut through the noise, capture how your people actually think, and turn collective thinking into defensible decisions.',
  alternates: { canonical: '/dream' },
  openGraph: {
    title: 'Ethenta DREAM — Agentic Decision Intelligence Platform',
    description:
      'Turn collective thinking into decision intelligence. Agentic AI and specialist SLMs that capture what people really think.',
    url: '/dream',
  },
};

const PERSONAS = [
  {
    title: 'Enterprise AI Adoption',
    href: '/dream/use-cases/enterprise-ai-adoption',
    description:
      'Your people know more than any strategy deck. DREAM captures every voice and surfaces the tensions, misaligned priorities, and hidden constraints that derail AI adoption and transformation.',
  },
  {
    title: 'Strategy & Innovation',
    href: '/dream/use-cases',
    description:
      'The organisational truth that PowerPoint decks and steering committees hide. Give teams the space to think, reimagine, and align.',
  },
  {
    title: 'Consultancies & Advisory',
    href: '/dream/industries/professional-services',
    description:
      'Deeper client insight in less time. Agentic AI handles the analysis so your consultants can focus on what matters.',
  },
  {
    title: 'Regulated Industries',
    href: '/dream/industries/financial-services',
    description:
      'Map constraints as first-class citizens. Balance innovation with governance. Deterministic scoring you can defend.',
  },
];

export default function DreamLandingPage() {
  return (
    <>
      {/* ═══ 1. HERO ═══ */}
      <HeroSection />

      {/* ═══ 2. CAPABILITY MATURITY ASSESSMENT ═══ */}
      <AssessmentSection />

      {/* ═══ 3. WHAT MAKES DREAM DIFFERENT — collapsible cards ═══ */}
      <DifferentiatorsSection />

      {/* ═══ 4. ACTOR JOURNEY SHOWCASE ═══ */}
      <JourneyShowcase />

      {/* ═══ 5. ENTERPRISE AI ADOPTION SPOTLIGHT ═══ */}
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
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ 6. WHO IT'S FOR ═══ */}
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

      {/* ═══ 7. CTA ═══ */}
      <CTASection
        headline="Ready to cut through the noise?"
        subheadline="See how DREAM turns collective thinking into decision intelligence."
      />
    </>
  );
}
