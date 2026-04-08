'use client'

export default function Closing() {
  return (
    <div className="relative h-screen flex items-center justify-center bg-[#0a0a0a] overflow-hidden">

      {/* Signal graph — now visible and organised. Contrast to the noise slide. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/experience/signal-graph.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.2,
          filter: 'saturate(0.8)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(10,10,10,0.4) 0%, rgba(10,10,10,0.85) 70%)' }}
      />

      {/* Subtle green ring */}
      <div
        className="absolute"
        style={{
          width: '70vw', height: '70vw',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '1px solid rgba(92,242,142,0.06)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-10 text-center px-8 max-w-4xl mx-auto">

        <div
          className="snap-animate snap-animate-1 inline-flex items-center gap-2.5 mb-12 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] text-white/62 text-[11px] tracking-[0.22em] uppercase"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#5cf28e]" />
          DREAM by Ethenta
        </div>

        <h2
          className="snap-animate snap-animate-2 font-black tracking-[-0.04em] text-white leading-[0.95] mb-6"
          style={{ fontSize: 'clamp(52px, 9vw, 108px)' }}
        >
          Decision<br />
          <span className="text-[#5cf28e]">Intelligence.</span>
        </h2>

        <p
          className="snap-animate snap-animate-3 text-white/62 text-xl md:text-2xl font-light leading-relaxed mt-8"
        >
          Your organisation — understood.
        </p>

      </div>
    </div>
  )
}
