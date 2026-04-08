'use client';

import { ScrollReveal } from './scroll-reveal';
import { CalendlyButton } from './calendly-button';

interface CTASectionProps {
  headline?: string;
  subheadline?: string;
  /** When true (default), primary CTA opens Calendly popup instead of following href */
  useCalendly?: boolean;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  variant?: 'gradient' | 'dark' | 'light';
}

export function CTASection({
  headline = 'Ready to transform your workshops?',
  subheadline,
  useCalendly = true,
  primaryCta = {
    label: 'Book a Demo',
    href: 'mailto:Andrew.Hall@ethenta.com?subject=DREAM%20Demo%20Request',
  },
  secondaryCta = { label: 'Explore Use Cases', href: '/dream/use-cases' },
  variant = 'gradient',
}: CTASectionProps) {
  const bgClass =
    variant === 'gradient'
      ? 'bg-gradient-to-r from-[#0d0d0d] via-[#1a1a2e] to-[#0d0d0d]'
      : variant === 'dark'
        ? 'bg-[#0d0d0d]'
        : 'bg-slate-50';

  const textClass = variant === 'light' ? 'text-slate-900' : 'text-white';
  const subTextClass = variant === 'light' ? 'text-slate-600' : 'text-white/60';

  return (
    <section className={`${bgClass} py-20 px-6`}>
      <div className="max-w-3xl mx-auto text-center">
        <ScrollReveal>
          <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${textClass} mb-4`}>
            {headline}
          </h2>
        </ScrollReveal>

        {subheadline && (
          <ScrollReveal delay={100}>
            <p className={`text-lg ${subTextClass} mb-8`}>{subheadline}</p>
          </ScrollReveal>
        )}

        <ScrollReveal delay={200}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            {useCalendly ? (
              <CalendlyButton
                className="px-8 py-4 text-lg font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] shadow-lg shadow-[#5cf28e]/20 hover:bg-[#50c878] transition-all hover:shadow-xl hover:shadow-[#5cf28e]/30 cursor-pointer"
              >
                {primaryCta.label}
              </CalendlyButton>
            ) : (
              <a
                href={primaryCta.href}
                className="px-8 py-4 text-lg font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] shadow-lg shadow-[#5cf28e]/20 hover:bg-[#50c878] transition-all hover:shadow-xl hover:shadow-[#5cf28e]/30"
              >
                {primaryCta.label}
              </a>
            )}
            <a
              href={secondaryCta.href}
              className={`px-8 py-4 text-lg font-semibold rounded-xl border transition-all ${
                variant === 'light'
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'border-white/20 text-white hover:bg-white/10'
              }`}
            >
              {secondaryCta.label}
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
