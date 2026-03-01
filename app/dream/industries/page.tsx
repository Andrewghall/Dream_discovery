import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Heart, Landmark, ShoppingBag, Cpu, Briefcase, ArrowRight } from 'lucide-react';
import { PageHero } from '@/components/dream-landing/page-hero';
import { ScrollReveal } from '@/components/dream-landing/scroll-reveal';
import { CTASection } from '@/components/dream-landing/cta-section';

export const metadata: Metadata = {
  title: 'Industries — DREAM Across Every Sector',
};

const INDUSTRY_CARDS = [
  {
    icon: Building2,
    iconBg: 'bg-blue-100 text-blue-600',
    title: 'Financial Services',
    tagline: 'Digital transformation, regulatory compliance, customer experience redesign',
    href: '/dream/industries/financial-services',
  },
  {
    icon: Heart,
    iconBg: 'bg-rose-100 text-rose-600',
    title: 'Healthcare',
    tagline: 'Service redesign, workforce transformation, patient journey optimisation',
    href: '/dream/industries/healthcare',
  },
  {
    icon: Landmark,
    iconBg: 'bg-indigo-100 text-indigo-600',
    title: 'Government & Public Sector',
    tagline: 'Service modernisation, citizen experience, policy alignment',
    href: '/dream/industries/government',
  },
  {
    icon: ShoppingBag,
    iconBg: 'bg-amber-100 text-amber-700',
    title: 'Retail & Consumer',
    tagline: 'Customer experience transformation, omnichannel strategy, workforce capability',
    href: '/dream/industries/retail',
  },
  {
    icon: Cpu,
    iconBg: 'bg-purple-100 text-purple-600',
    title: 'Technology',
    tagline: 'Product strategy alignment, engineering culture, go-to-market readiness',
    href: '/dream/industries/technology-sector',
  },
  {
    icon: Briefcase,
    iconBg: 'bg-emerald-100 text-emerald-600',
    title: 'Professional Services',
    tagline: 'Client delivery methodology, knowledge management, growth strategy',
    href: '/dream/industries/professional-services',
  },
];

export default function IndustriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Industries"
        headline="Transforming Organisations Across"
        highlightText="Every Sector"
        subheadline="DREAM works across any industry where organisational alignment, strategic clarity, and transformation intelligence matter."
      />

      {/* ═══ INDUSTRY GRID ═══ */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {INDUSTRY_CARDS.map((industry, i) => {
              const Icon = industry.icon;
              return (
                <ScrollReveal key={industry.title} delay={100 + i * 80}>
                  <Link href={industry.href} className="block group h-full">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:border-[#50c878]/30 hover:shadow-md transition-all h-full flex flex-col">
                      <div className={`w-12 h-12 rounded-xl ${industry.iconBg} flex items-center justify-center mb-4`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{industry.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed flex-1">{industry.tagline}</p>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#33824d] group-hover:text-[#50c878] transition-colors mt-4">
                        Explore <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ CROSS-INDUSTRY VALUE PROP ═══ */}
      <section className="bg-gradient-to-r from-[#5cf28e]/10 via-[#50c878]/10 to-[#33824d]/10 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <ScrollReveal>
            <p className="text-xl md:text-2xl text-slate-700 font-medium leading-relaxed">
              Regardless of industry, every organisation faces the same challenge: getting people aligned around what actually matters. DREAM makes that alignment visible, measurable, and actionable.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <CTASection
        headline="See DREAM in your industry"
        subheadline="Book a demo to explore how DREAM delivers decision intelligence for your sector."
      />
    </>
  );
}
