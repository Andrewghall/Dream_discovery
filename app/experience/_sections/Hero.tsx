'use client'
import { ChevronDown, ExternalLink } from 'lucide-react'

const DREAM_URL = 'https://dream-discovery-git-pre-live-andrewghall-3747s-projects.vercel.app/admin/workshops/cmmezcr7r0001jj04vc6fiqdw/behavioural-interventions'

interface HeroProps {
  onNext?: () => void
}

export default function Hero({ onNext }: HeroProps) {
  const openApp = () => {
    window.open(
      DREAM_URL,
      'dream-live',
      'width=1440,height=900,left=80,top=60,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes'
    )
  }

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0a]">

      {/* Signal graph background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/experience/signal-graph.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.18,
          filter: 'saturate(0.6)',
        }}
      />

      {/* Dark overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/60 via-[#0a0a0a]/20 to-[#0a0a0a]/80" />

      {/* Green radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(92,242,142,0.07) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-5 sm:px-8 lg:px-6 max-w-5xl mx-auto">

        {/* Pill label */}
        <div className="anim-fade-up anim-fade-up-1 inline-flex items-center gap-2.5 mb-10 px-4 py-2 rounded-full border border-white/12 bg-white/[0.04] text-white/45 text-[11px] tracking-[0.22em] uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5cf28e] anim-pulse-dot" />
          Ethenta · Decision Intelligence
        </div>

        {/* Main title — DREAM animated logo */}
        <div className="anim-fade-up anim-fade-up-2 mb-6 flex justify-center">
          <video
            src="/DREAMMovingLogo.mp4"
            autoPlay
            loop
            muted
            playsInline
            style={{ height: 'clamp(100px, 14vw, 180px)', objectFit: 'contain', filter: 'drop-shadow(0 0 40px rgba(92,242,142,0.15))' }}
          />
        </div>

        {/* Rule + subtitle */}
        <div className="anim-fade-up anim-fade-up-3 flex items-center justify-center gap-5 mb-6">
          <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-[#5cf28e]/40" />
          <span className="text-[#5cf28e]/80 text-xs tracking-[0.2em] uppercase font-medium">
            From organisational insight to validated action
          </span>
          <div className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-[#5cf28e]/40" />
        </div>

        <p className="anim-fade-up anim-fade-up-3 text-lg md:text-xl text-white/40 font-light leading-relaxed max-w-xl mx-auto mb-12">
          Turning what your organisation knows into a clear, evidence-backed way forward
        </p>

        {/* Launch app CTA */}
        <div className="anim-fade-up anim-fade-up-4">
          <button
            onClick={openApp}
            className="inline-flex items-center gap-3 px-7 py-3.5 rounded-full border border-white/14 bg-white/[0.05] text-white/65 text-sm hover:border-[#5cf28e]/35 hover:bg-[#5cf28e]/6 hover:text-white/85 transition-all duration-300 group"
          >
            <div className="w-7 h-7 rounded-full border border-[#5cf28e]/50 flex items-center justify-center bg-[#5cf28e]/10 group-hover:bg-[#5cf28e]/18 transition-colors">
              <ExternalLink className="w-3 h-3 text-[#5cf28e]" />
            </div>
            Explore DREAM live
          </button>
        </div>
      </div>

      {/* Scroll cue */}
      <button
        onClick={onNext}
        className="absolute bottom-8 left-16 flex items-center gap-3 opacity-35 hover:opacity-65 transition-opacity anim-fade-up anim-fade-up-5"
      >
        <div className="anim-scroll-bounce">
          <ChevronDown className="w-4 h-4 text-white" />
        </div>
        <span className="text-[10px] text-white tracking-[0.25em] uppercase">Scroll to explore</span>
      </button>

    </div>
  )
}
