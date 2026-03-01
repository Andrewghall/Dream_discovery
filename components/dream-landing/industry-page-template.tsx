import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { IndustryData } from '@/lib/dream-landing/industry-data';
import { PageHero } from './page-hero';
import { ScrollReveal } from './scroll-reveal';
import { CTASection } from './cta-section';

interface IndustryPageTemplateProps {
  industry: IndustryData;
}

export function IndustryPageTemplate({ industry }: IndustryPageTemplateProps) {
  return (
    <>
      <PageHero
        eyebrow={industry.name}
        headline={industry.headline}
        subheadline={industry.subheadline}
      />

      {/* ═══ INDUSTRY CHALLENGES ═══ */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
              The Challenges
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-10">
              What {industry.name} Organisations Face
            </h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-6">
            {industry.challenges.map((challenge, i) => (
              <ScrollReveal key={challenge.title} delay={100 + i * 80}>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 h-full">
                  <h3 className="text-base font-bold text-slate-900 mb-2">{challenge.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{challenge.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW DREAM HELPS ═══ */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
              How DREAM Helps
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-10">
              Structured Intelligence for {industry.name}
            </h2>
          </ScrollReveal>
          <div className="space-y-6">
            {industry.dreamHelps.map((help, i) => (
              <ScrollReveal key={help.phase} delay={100 + i * 100}>
                <div className="flex items-start gap-4">
                  <div className="w-20 h-10 rounded-lg bg-[#5cf28e]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#33824d]">{help.phase}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{help.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ EXAMPLE INSIGHTS ═══ */}
      <section className="bg-[#0d0d0d] text-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#5cf28e] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
              Example Insights
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold mb-8">
              What DREAM Reveals in {industry.name}
            </h2>
          </ScrollReveal>
          <div className="space-y-4">
            {industry.exampleInsights.map((insight, i) => (
              <ScrollReveal key={i} delay={100 + i * 80}>
                <div className="bg-white/5 rounded-xl p-5 border border-[#5cf28e]/10">
                  <p className="text-sm text-slate-300 leading-relaxed">
                    &ldquo;{insight}&rdquo;
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ RELATED USE CASES ═══ */}
      {industry.relatedUseCases.length > 0 && (
        <section className="bg-white py-16">
          <div className="max-w-5xl mx-auto px-6">
            <ScrollReveal>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Related Use Cases</h2>
              <div className="flex flex-wrap gap-3">
                {industry.relatedUseCases.map((uc) => (
                  <Link
                    key={uc.href}
                    href={uc.href}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:border-[#50c878]/30 hover:bg-slate-50 transition-all"
                  >
                    {uc.title} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      <CTASection
        headline={`Transform your ${industry.name.toLowerCase()} organisation`}
        subheadline="Book a demo to see how DREAM delivers decision intelligence for your industry."
      />
    </>
  );
}
