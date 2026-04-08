'use client';

import { ScrollReveal, AnimatedCounter } from './scroll-reveal';
import { CalendlyButton } from './calendly-button';

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
            The World&apos;s First Agentic Decision Intelligence Platform
          </p>
        </ScrollReveal>

        {/* DREAM Animated Logo */}
        <ScrollReveal delay={200}>
          <div className="dream-banner-glow mx-auto mb-10">
            <video
              src="/DREAMMovingLogo.mp4"
              autoPlay
              loop
              muted
              playsInline
              aria-label="DREAM  -  Discover, Reimagine, Educate, Apply, Mobilise"
              className="mx-auto w-full max-w-[700px] rounded-xl"
            />
          </div>
        </ScrollReveal>

        {/* Headline */}
        <ScrollReveal delay={400}>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            Stop Guessing. Start Deciding{' '}
            <span className="bg-gradient-to-r from-[#5cf28e] to-[#50c878] bg-clip-text text-transparent">
              With Confidence.
            </span>
          </h1>
        </ScrollReveal>

        {/* Elevator pitch */}
        <ScrollReveal delay={500}>
          <p className="text-lg md:text-xl text-white/60 max-w-3xl mx-auto leading-relaxed mb-10">
            Built for leadership teams who must align strategy, cut through conflicting
            priorities, and produce decisions executives can defend. Multiple agentic AI specialists
            work in concert  -  capturing, synthesising, and analysing  -  to turn how your
            organisation really thinks into measurable strategic direction.
          </p>
        </ScrollReveal>

        {/* CTAs */}
        <ScrollReveal delay={600}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <CalendlyButton
              className="px-8 py-4 text-lg font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] shadow-lg shadow-[#5cf28e]/20 hover:bg-[#50c878] transition-all hover:shadow-xl hover:shadow-[#5cf28e]/30 cursor-pointer"
            >
              See It in Action
            </CalendlyButton>
            <a
              href="#assessment"
              className="px-8 py-4 text-lg font-semibold rounded-xl border border-white/20 text-white hover:bg-white/10 transition-all"
            >
              Take a 5-Minute Assessment
            </a>
          </div>
          <p className="text-sm text-white/40 max-w-xl mx-auto mb-16">
            Rate your readiness across People, Organisation, Customer, Technology
            and Regulation and receive a personalised transformation score.
          </p>
        </ScrollReveal>

        {/* Stats strip */}
        <ScrollReveal delay={700}>
          <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/10 max-w-2xl mx-auto">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-[#5cf28e]">
                <AnimatedCounter target={1000} suffix="+" />
              </div>
              <div className="text-xs sm:text-sm text-white/40 mt-1">Insights per session</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-[#5cf28e]">
                10&times;
              </div>
              <div className="text-xs sm:text-sm text-white/40 mt-1">Faster than surveys</div>
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
