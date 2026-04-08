'use client'

// THE NOISE — visual overwhelm, multiple overlapping screenshots, one bold statement
export default function Problem() {
  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center bg-[#0a0a0a] overflow-hidden">

      {/* Chaotic background: multiple screenshots overlapping at different scales */}
      <div className="absolute inset-0">
        {/* Layer 1 — domain misalignment, top-left, rotated */}
        <div
          className="absolute"
          style={{
            backgroundImage: "url('/experience/domain-misalignment.png')",
            backgroundSize: 'cover',
            width: '65%', height: '65%',
            top: '-5%', left: '-8%',
            opacity: 0.18,
            transform: 'rotate(-4deg)',
            filter: 'saturate(0.5)',
          }}
        />
        {/* Layer 2 — narrative divergence, top-right */}
        <div
          className="absolute"
          style={{
            backgroundImage: "url('/experience/narrative-divergence.png')",
            backgroundSize: 'cover',
            width: '60%', height: '60%',
            top: '5%', right: '-5%',
            opacity: 0.16,
            transform: 'rotate(3deg)',
            filter: 'saturate(0.4)',
          }}
        />
        {/* Layer 3 — primary themes, bottom-left */}
        <div
          className="absolute"
          style={{
            backgroundImage: "url('/experience/primary-themes.png')",
            backgroundSize: 'cover',
            width: '55%', height: '55%',
            bottom: '-8%', left: '5%',
            opacity: 0.14,
            transform: 'rotate(2deg)',
            filter: 'saturate(0.4)',
          }}
        />
        {/* Layer 4 — logic map, bottom-right */}
        <div
          className="absolute"
          style={{
            backgroundImage: "url('/experience/logic-map.png')",
            backgroundSize: 'cover',
            width: '58%', height: '58%',
            bottom: '-4%', right: '-4%',
            opacity: 0.15,
            transform: 'rotate(-2.5deg)',
            filter: 'saturate(0.3)',
          }}
        />
        {/* Dark vignette to make text readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/70 via-[#0a0a0a]/40 to-[#0a0a0a]/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/60 via-transparent to-[#0a0a0a]/60" />
      </div>

      {/* Content — dead centre, sparse */}
      <div className="relative z-10 text-center px-5 sm:px-8 max-w-4xl mx-auto">
        <p className="snap-animate snap-animate-1 text-[11px] text-[#5cf28e]/70 tracking-[0.3em] uppercase mb-10">
          The Reality
        </p>

        <h2
          className="snap-animate snap-animate-2 font-black leading-[0.92] tracking-[-0.04em] text-white mb-8"
          style={{ fontSize: 'clamp(52px, 10vw, 128px)' }}
        >
          Too much<br />
          <span className="text-white/50">noise.</span>
        </h2>

        <p className="snap-animate snap-animate-3 text-xl md:text-2xl text-white/45 font-light leading-relaxed max-w-lg mx-auto">
          Data. Reports. Meetings. More data.<br />
          And still — no clear way forward.
        </p>
      </div>

    </div>
  )
}
