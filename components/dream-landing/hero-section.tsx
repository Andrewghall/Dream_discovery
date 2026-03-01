'use client';

import Image from 'next/image';
import { ScrollReveal, AnimatedCounter } from './scroll-reveal';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0d0d0d]">
      {/* Subtle green radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 30% 70%, rgba(92, 242, 142, 0.06), transparent)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        {/* Eyebrow */}
        <ScrollReveal delay={100}>
          <p className="text-[#5cf28e] text-sm font-semibold tracking-[0.2em] uppercase mb-8">
            Workshop Intelligence Platform
          </p>
        </ScrollReveal>

        {/* DREAM Banner */}
        <ScrollReveal delay={200}>
          <div className="dream-banner-glow mx-auto mb-10">
            <Image
              src="/Dream.PNG"
              alt="DREAM — Discover, Reimagine, Educate, Apply, Mobilise"
              width={700}
              height={253}
              priority
              className="mx-auto w-full max-w-[700px] rounded-xl"
            />
          </div>
        </ScrollReveal>

        {/* Headline */}
        <ScrollReveal delay={400}>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            Turn Every Workshop Into{' '}
            <span className="bg-gradient-to-r from-[#5cf28e] to-[#50c878] bg-clip-text text-transparent">
              Decision Intelligence
            </span>
          </h1>
        </ScrollReveal>

        {/* Elevator pitch */}
        <ScrollReveal delay={500}>
          <p className="text-lg md:text-xl text-white/60 max-w-3xl mx-auto leading-relaxed mb-10">
            DREAM captures what people really think, surfaces what organisations actually need,
            and transforms live workshops into measurable strategic insight &mdash; powered by
            EthentaFlow&trade;, the AI engine that never misses a signal.
          </p>
        </ScrollReveal>

        {/* CTAs */}
        <ScrollReveal delay={600}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="mailto:hello@ethenta.com?subject=DREAM%20Demo%20Request"
              className="px-8 py-4 text-lg font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] shadow-lg shadow-[#5cf28e]/20 hover:bg-[#50c878] transition-all hover:shadow-xl hover:shadow-[#5cf28e]/30"
            >
              Book a Demo
            </a>
            <a
              href="#ask-dream"
              className="px-8 py-4 text-lg font-semibold rounded-xl border border-white/20 text-white hover:bg-white/10 transition-all"
            >
              Ask DREAM Anything
            </a>
          </div>
        </ScrollReveal>

        {/* Stats strip */}
        <ScrollReveal delay={700}>
          <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/10 max-w-2xl mx-auto">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-[#5cf28e]">
                <AnimatedCounter target={1000} suffix="+" />
              </div>
              <div className="text-xs sm:text-sm text-white/40 mt-1">Insights per workshop</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-[#5cf28e]">
                <AnimatedCounter target={15} suffix=" min" />
              </div>
              <div className="text-xs sm:text-sm text-white/40 mt-1">Per conversation</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-[#5cf28e]">
                <AnimatedCounter target={7} />
              </div>
              <div className="text-xs sm:text-sm text-white/40 mt-1">Analytical views</div>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-white/40 rounded-full" />
        </div>
      </div>
    </section>
  );
}
