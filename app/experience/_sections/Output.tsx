'use client'

// WHAT YOU GET — phased roadmap full-bleed, 3 bold deliverables
const deliverables = [
  { num: '01', title: 'The Dashboard',  note: "Live intelligence. Your organisation's psyche, always visible." },
  { num: '02', title: 'The Directive',  note: 'A validated way forward — every action tied to a root cause.' },
  { num: '03', title: 'The Gantt',      note: 'Phased delivery, sequenced by dependency and impact.' },
]

export default function Output() {
  return (
    <div className="relative h-[100dvh] flex items-center bg-[#0a0a0a] overflow-hidden">

      {/* Full-bleed phased roadmap as background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/experience/phased-roadmap.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.2,
          filter: 'saturate(0.5)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/98 via-[#0a0a0a]/75 to-[#0a0a0a]/30" />

      <div className="relative z-10 w-full max-w-5xl mx-auto px-5 sm:px-8 lg:px-16">

        <p className="snap-animate snap-animate-1 text-[11px] text-[#5cf28e]/75 tracking-[0.3em] uppercase mb-6">
          What You Walk Away With
        </p>
        <h2
          className="snap-animate snap-animate-2 font-black tracking-[-0.04em] text-white mb-14"
          style={{ fontSize: 'clamp(40px, 8vw, 96px)' }}
        >
          Clarity.<br />
          <span className="text-[#5cf28e]">Direction.</span><br />
          Proof.
        </h2>

        <div className="space-y-6">
          {deliverables.map((d, i) => (
            <div
              key={i}
              className="snap-animate flex items-start gap-6"
              style={{ animationDelay: `${0.2 + i * 0.12}s` }}
            >
              <span className="text-[#5cf28e]/60 font-mono text-sm flex-shrink-0 pt-0.5">{d.num}</span>
              <div>
                <div className="text-white text-xl font-semibold mb-1">{d.title}</div>
                <div className="text-white/65 text-sm font-light">{d.note}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
