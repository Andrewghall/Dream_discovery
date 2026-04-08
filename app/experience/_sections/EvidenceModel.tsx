'use client'

// THE PAUSE — pure silence, stark contrast to The Noise
export default function EvidenceModel() {
  return (
    <div className="relative h-[100dvh] flex items-center justify-center bg-[#0a0a0a] overflow-hidden">

      {/* Single thin horizontal line — slowly draws itself */}
      <div
        className="absolute left-1/2 top-1/2 h-px bg-[#5cf28e]/20"
        style={{
          width: '40vw',
          transform: 'translate(-50%, -50%)',
          animation: 'lineGrow 1.8s ease-out 0.3s both',
        }}
      />

      <style>{`
        @keyframes lineGrow {
          from { width: 0; opacity: 0; }
          to   { width: 40vw; opacity: 1; }
        }
        @keyframes fadeUpSlow {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="relative z-10 text-center px-5 sm:px-8">

        <h2
          className="font-black tracking-[-0.04em] text-white leading-[1.05]"
          style={{
            fontSize: 'clamp(40px, 9vw, 108px)',
            animation: 'fadeUpSlow 1s ease-out 0.1s both',
          }}
        >
          What if you could<br />
          <span className="text-[#5cf28e]">stop?</span>
        </h2>

        <p
          className="text-white/55 text-xl md:text-2xl font-light mt-8 tracking-wide"
          style={{ animation: 'fadeUpSlow 1s ease-out 0.6s both' }}
        >
          Not a meeting. Not another report.<br />A real pause.
        </p>

      </div>
    </div>
  )
}
