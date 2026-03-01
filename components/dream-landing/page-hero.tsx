'use client';

import { ScrollReveal, AnimatedCounter } from './scroll-reveal';

interface StatItem {
  target: number;
  suffix?: string;
  prefix?: string;
  label: string;
}

interface PageHeroProps {
  eyebrow: string;
  headline: string;
  highlightText?: string;
  subheadline: string;
  dark?: boolean;
  stats?: StatItem[];
}

export function PageHero({
  eyebrow,
  headline,
  highlightText,
  subheadline,
  dark = true,
  stats,
}: PageHeroProps) {
  const bgClass = dark ? 'bg-[#0d0d0d]' : 'bg-white';
  const eyebrowClass = dark ? 'text-[#5cf28e]' : 'text-[#50c878]';
  const headlineClass = dark ? 'text-white' : 'text-slate-900';
  const subClass = dark ? 'text-white/60' : 'text-slate-600';
  const statValueClass = dark ? 'text-[#5cf28e]' : 'text-[#50c878]';
  const statLabelClass = dark ? 'text-white/40' : 'text-slate-500';
  const borderClass = dark ? 'border-white/10' : 'border-slate-200';

  return (
    <section className={`relative ${bgClass} py-24 md:py-32 overflow-hidden`}>
      {dark && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 30% 70%, rgba(92, 242, 142, 0.06), transparent)',
          }}
        />
      )}

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <ScrollReveal delay={100}>
          <p className={`${eyebrowClass} text-sm font-semibold tracking-[0.2em] uppercase mb-6`}>
            {eyebrow}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold ${headlineClass} leading-tight mb-6`}>
            {headline}{' '}
            {highlightText && (
              <span className="bg-gradient-to-r from-[#5cf28e] to-[#50c878] bg-clip-text text-transparent">
                {highlightText}
              </span>
            )}
          </h1>
        </ScrollReveal>

        <ScrollReveal delay={300}>
          <p className={`text-lg md:text-xl ${subClass} max-w-3xl mx-auto leading-relaxed`}>
            {subheadline}
          </p>
        </ScrollReveal>

        {stats && stats.length > 0 && (
          <ScrollReveal delay={400}>
            <div className={`grid grid-cols-${stats.length} gap-8 pt-10 mt-10 border-t ${borderClass} max-w-2xl mx-auto`}>
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className={`text-3xl md:text-4xl font-bold ${statValueClass}`}>
                    <AnimatedCounter
                      target={stat.target}
                      suffix={stat.suffix}
                      prefix={stat.prefix}
                    />
                  </div>
                  <div className={`text-xs sm:text-sm ${statLabelClass} mt-1`}>{stat.label}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        )}
      </div>
    </section>
  );
}
