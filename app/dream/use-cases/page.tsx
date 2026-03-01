import type { Metadata } from 'next';
import Link from 'next/link';
import { Zap, RefreshCw, Users, ArrowRight } from 'lucide-react';
import { PageHero } from '@/components/dream-landing/page-hero';
import { ScrollReveal } from '@/components/dream-landing/scroll-reveal';
import { CTASection } from '@/components/dream-landing/cta-section';

export const metadata: Metadata = {
  title: 'Use Cases — DREAM in Action',
};

const USE_CASES = [
  {
    icon: Zap,
    title: 'Enterprise AI Adoption',
    description:
      'Every enterprise wants to adopt AI. Few know how. DREAM cuts through the noise — conflicting priorities, siloed thinking, misaligned maturity perceptions — and builds a transformation roadmap grounded in what people actually think.',
    href: '/dream/use-cases/enterprise-ai-adoption',
    featured: true,
    tags: ['AI Strategy', 'Transformation', 'Alignment'],
  },
  {
    icon: RefreshCw,
    title: 'Digital Transformation',
    description:
      'Digital transformation fails when organisations don\'t understand their own readiness. DREAM surfaces the gap between ambition and capability — then builds a constraint-aware path from here to there.',
    href: null,
    featured: false,
    tags: ['Digital', 'Modernisation', 'Roadmap'],
  },
  {
    icon: Users,
    title: 'Customer Experience Redesign',
    description:
      'Customer experience isn\'t owned by one team — it spans every department. DREAM reveals how different parts of the organisation see the customer, where perspectives diverge, and where alignment is critical.',
    href: null,
    featured: false,
    tags: ['CX', 'Alignment', 'Journey'],
  },
];

export default function UseCasesPage() {
  return (
    <>
      <PageHero
        eyebrow="Use Cases"
        headline="DREAM in"
        highlightText="Action"
        subheadline="See how organisations use DREAM to cut through noise, align their people, and drive transformation with clarity."
      />

      {/* ═══ USE CASE CARDS ═══ */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6 space-y-6">
          {USE_CASES.map((uc, i) => {
            const Icon = uc.icon;
            return (
              <ScrollReveal key={uc.title} delay={100 + i * 100}>
                {uc.featured && uc.href ? (
                  <Link href={uc.href} className="block group">
                    <div className="bg-[#0d0d0d] rounded-3xl p-8 sm:p-10 overflow-hidden relative">
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            'radial-gradient(ellipse 60% 60% at 80% 50%, rgba(92, 242, 142, 0.08), transparent)',
                        }}
                      />
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-[#5cf28e]/20 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-[#5cf28e]" />
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#5cf28e]/20 text-[#5cf28e]">
                            Featured
                          </span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">{uc.title}</h3>
                        <p className="text-white/60 max-w-2xl leading-relaxed mb-4">{uc.description}</p>
                        <div className="flex flex-wrap gap-2 mb-6">
                          {uc.tags.map((tag) => (
                            <span key={tag} className="px-2.5 py-1 text-xs text-white/50 border border-white/10 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#5cf28e] group-hover:text-[#50c878] transition-colors">
                          Explore this use case <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-slate-500" />
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-200 text-slate-500">
                        Coming Soon
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{uc.title}</h3>
                    <p className="text-slate-600 leading-relaxed mb-3">{uc.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {uc.tags.map((tag) => (
                        <span key={tag} className="px-2.5 py-1 text-xs text-slate-400 border border-slate-200 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      <CTASection
        headline="Have a specific use case in mind?"
        subheadline="DREAM adapts to any organisational challenge. Let's talk about yours."
      />
    </>
  );
}
