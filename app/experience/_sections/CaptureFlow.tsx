'use client'

// BECOME — vision-first, transformation arc as full-bleed background
export default function CaptureFlow() {
  return (
    <div className="relative h-screen flex items-center bg-[#0a0a0a] overflow-hidden">

      {/* Full-bleed transformation arc image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/experience/transformation-arc.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.22,
          filter: 'saturate(0.6)',
        }}
      />

      {/* Dark gradient — left heavy so text is readable */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/95 via-[#0a0a0a]/70 to-[#0a0a0a]/30" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/40 via-transparent to-[#0a0a0a]/60" />

      <div className="relative z-10 w-full max-w-5xl mx-auto px-16">

        <p className="snap-animate snap-animate-1 text-[11px] text-[#5cf28e]/75 tracking-[0.3em] uppercase mb-8">
          The Question
        </p>

        <h2
          className="snap-animate snap-animate-2 font-black tracking-[-0.04em] text-white leading-[0.95] mb-10"
          style={{ fontSize: 'clamp(56px, 9vw, 112px)' }}
        >
          What do you<br />
          want to<br />
          <span className="text-[#5cf28e]">become?</span>
        </h2>

        <div className="snap-animate snap-animate-3 h-px w-24 bg-[#5cf28e]/30 mb-8" />

        <p className="snap-animate snap-animate-4 text-white/45 text-lg md:text-xl font-light leading-relaxed max-w-sm">
          Not what you are today.<br />
          Not your constraints.<br />
          Where you are going.
        </p>

      </div>
    </div>
  )
}
