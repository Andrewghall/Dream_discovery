'use client'

// HOW WE LISTEN — 5 circles in pentagon, TRUTH arrives last with starburst
// Pentagon positions (pixel offsets from centre, r=130): top, TR, BR, BL, TL

const sources = [
  { label: 'Pre-Workshop',       note: 'Questionnaires & context',       color: '#5cf28e', rgb: '92,242,142',  x: '-124px', y: '-40px',  delay: '0.2s'  },
  { label: 'At-Desk',            note: 'Live structured interviews',     color: '#5cc6f2', rgb: '92,198,242',  x:  '124px', y: '-40px',  delay: '0.75s' },
  { label: 'Historical Data',    note: 'Documents, reports, customer',   color: '#f2c65c', rgb: '242,198,92',  x:   '76px', y: '105px',  delay: '1.3s'  },
  { label: 'Live Workshop',      note: 'Real-time capture & transcript', color: '#c65cf2', rgb: '198,92,242',  x:  '-76px', y: '105px',  delay: '1.85s' },
  { label: 'Customer Evidence',  note: 'NPS, feedback & field signals',  color: '#f2955c', rgb: '242,149,92',  x:    '0px', y: '-130px', delay: '2.35s' },
]

export default function Validation() {
  return (
    <div className="relative min-h-[100dvh] flex items-center bg-[#0a0a0a] overflow-hidden">

      <style>{`
        @keyframes v-pop {
          0%   { opacity:0; transform:scale(0) rotate(-15deg); }
          55%  { opacity:1; transform:scale(1.18) rotate(2deg); }
          78%  { transform:scale(0.93) rotate(-1deg); }
          100% { opacity:1; transform:scale(1) rotate(0); }
        }
        @keyframes v-ring1 { 0%{transform:scale(1);opacity:0.75} 100%{transform:scale(2.4);opacity:0} }
        @keyframes v-ring2 { 0%{transform:scale(1);opacity:0.5}  100%{transform:scale(3);opacity:0} }
        @keyframes v-ring3 { 0%{transform:scale(1);opacity:0.35} 100%{transform:scale(3.8);opacity:0} }
        @keyframes v-lineDraw { from{stroke-dashoffset:var(--d)} to{stroke-dashoffset:0} }
        @keyframes v-truthFlash { 0%{opacity:0;transform:translate(-50%,-50%) scale(0)} 40%{opacity:1;transform:translate(-50%,-50%) scale(1.5)} 60%{transform:translate(-50%,-50%) scale(0.88)} 80%{transform:translate(-50%,-50%) scale(1.06)} 100%{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes v-glow { 0%{transform:translate(-50%,-50%) scale(0.2);opacity:0} 100%{transform:translate(-50%,-50%) scale(1);opacity:1} }
        @keyframes v-burst { 0%{transform:translate(-50%,-50%) scale(0.5);opacity:0.9} 100%{transform:translate(-50%,-50%) scale(3);opacity:0} }
        @keyframes v-burst2{ 0%{transform:translate(-50%,-50%) scale(0.5);opacity:0.6} 100%{transform:translate(-50%,-50%) scale(4.5);opacity:0} }
        @keyframes v-burst3{ 0%{transform:translate(-50%,-50%) scale(0.5);opacity:0.4} 100%{transform:translate(-50%,-50%) scale(6);opacity:0} }
        @keyframes v-innerSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes v-pulse { 0%,100%{box-shadow:0 0 20px rgba(92,242,142,0.5),0 0 40px rgba(92,242,142,0.2)} 50%{box-shadow:0 0 40px rgba(92,242,142,0.9),0 0 80px rgba(92,242,142,0.4)} }
        @keyframes v-scan  { 0%{transform:translate(-50%,-50%) rotate(0deg)} 100%{transform:translate(-50%,-50%) rotate(360deg)} }
        @keyframes v-orbit { 0%{transform:translate(-50%,-50%) rotate(0deg) translateX(68px) rotate(0deg)} 100%{transform:translate(-50%,-50%) rotate(360deg) translateX(68px) rotate(-360deg)} }
        @keyframes v-orbit2{ 0%{transform:translate(-50%,-50%) rotate(180deg) translateX(82px) rotate(-180deg)} 100%{transform:translate(-50%,-50%) rotate(540deg) translateX(82px) rotate(-540deg)} }
        @keyframes v-dotBlink { 0%,100%{opacity:0.9;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.6)} }
        @media (max-width: 768px) {
          .validation-inner { flex-direction: column !important; align-items: center !important; gap: 0 !important; }
          .validation-text { width: 100% !important; margin-bottom: 0 !important; }
          .validation-diagram-wrap { flex: none !important; overflow: hidden !important; height: 250px !important; display: flex !important; align-items: center !important; justify-content: center !important; }
          .validation-diagram { transform: scale(0.55) !important; transform-origin: center center !important; }
        }
      `}</style>

      {/* live-capture subtle background */}
      <div className="absolute inset-0"
        style={{ backgroundImage:"url('/experience/live-capture.png')", backgroundSize:'cover', backgroundPosition:'center', opacity:0.055, filter:'saturate(0.2)' }} />
      <div className="absolute inset-0 bg-[#0a0a0a]/65" />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 flex items-center gap-8 validation-inner">

        {/* Left — copy */}
        <div className="validation-text" style={{ width: 230, flexShrink: 0 }}>
          <p className="snap-animate snap-animate-1 text-[11px] text-[#5cf28e]/75 tracking-[0.3em] uppercase mb-6">
            How We Listen
          </p>
          <h2
            className="snap-animate snap-animate-2 font-black tracking-[-0.04em] text-white leading-[0.92] mb-8"
            style={{ fontSize: 'clamp(38px, 4.8vw, 68px)' }}
          >
            Five ways<br />to hear<br />
            <span className="text-[#5cf28e]">the truth.</span>
          </h2>
          <p className="snap-animate snap-animate-3 text-white/62 text-sm font-light leading-relaxed">
            Every source is independent.<br />
            Where they converge — that&rsquo;s signal.
          </p>
        </div>

        {/* Right — diagram */}
        <div className="flex-1 flex items-center justify-center validation-diagram-wrap">
          <div className="validation-diagram" style={{ position: 'relative', width: 440, height: 440, flexShrink: 0 }}>

            {/* === TRUTH burst rings — arrive at 2.4s === */}
            {/* burst 1 */}
            <div style={{
              position:'absolute', top:'50%', left:'50%',
              width:86, height:86, borderRadius:'50%',
              border:'2px solid rgba(92,242,142,0.8)',
              opacity:0,
              animation:'v-burst 0.7s cubic-bezier(0.2,0,0.8,1) 2.9s forwards',
            }}/>
            {/* burst 2 */}
            <div style={{
              position:'absolute', top:'50%', left:'50%',
              width:86, height:86, borderRadius:'50%',
              border:'1.5px solid rgba(92,242,142,0.5)',
              opacity:0,
              animation:'v-burst2 0.9s cubic-bezier(0.2,0,0.8,1) 3.0s forwards',
            }}/>
            {/* burst 3 */}
            <div style={{
              position:'absolute', top:'50%', left:'50%',
              width:86, height:86, borderRadius:'50%',
              border:'1px solid rgba(92,242,142,0.3)',
              opacity:0,
              animation:'v-burst3 1.1s cubic-bezier(0.2,0,0.8,1) 3.1s forwards',
            }}/>

            {/* Ambient glow blob behind everything */}
            <div style={{
              position:'absolute', top:'50%', left:'50%',
              width:120, height:120, borderRadius:'50%',
              background:'radial-gradient(circle, rgba(92,242,142,0.18) 0%, rgba(92,242,142,0.04) 60%, transparent 80%)',
              opacity:0,
              animation:'v-glow 0.8s ease 2.9s forwards',
            }}/>

            {/* Connection lines SVG — draw after last circle lands */}
            <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', overflow:'visible' }}
              viewBox="0 0 440 440">
              {/* Spokes — each source to centre (220,220) */}
              {/* Pre-Workshop TL (96,180) */}
              <line x1="96" y1="180" x2="220" y2="220" stroke="rgba(92,242,142,0.18)" strokeWidth="1"
                strokeDasharray="130" style={{ '--d':'130', strokeDashoffset:'130', animation:'v-lineDraw 0.5s ease 2.1s forwards' } as React.CSSProperties}/>
              {/* At-Desk TR (344,180) */}
              <line x1="344" y1="180" x2="220" y2="220" stroke="rgba(92,242,142,0.18)" strokeWidth="1"
                strokeDasharray="130" style={{ '--d':'130', strokeDashoffset:'130', animation:'v-lineDraw 0.5s ease 2.15s forwards' } as React.CSSProperties}/>
              {/* Historical BR (296,325) */}
              <line x1="296" y1="325" x2="220" y2="220" stroke="rgba(92,242,142,0.18)" strokeWidth="1"
                strokeDasharray="130" style={{ '--d':'130', strokeDashoffset:'130', animation:'v-lineDraw 0.5s ease 2.2s forwards' } as React.CSSProperties}/>
              {/* Live Workshop BL (144,325) */}
              <line x1="144" y1="325" x2="220" y2="220" stroke="rgba(92,242,142,0.18)" strokeWidth="1"
                strokeDasharray="130" style={{ '--d':'130', strokeDashoffset:'130', animation:'v-lineDraw 0.5s ease 2.25s forwards' } as React.CSSProperties}/>
              {/* Customer Evidence Top (220,90) */}
              <line x1="220" y1="90" x2="220" y2="220" stroke="rgba(92,242,142,0.18)" strokeWidth="1"
                strokeDasharray="130" style={{ '--d':'130', strokeDashoffset:'130', animation:'v-lineDraw 0.5s ease 2.3s forwards' } as React.CSSProperties}/>
              {/* Pentagon ring */}
              <polygon points="220,90 344,180 296,325 144,325 96,180"
                fill="none" stroke="rgba(92,242,142,0.06)" strokeWidth="1"/>
            </svg>

            {/* Four source circles */}
            {sources.map((s, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top:  `calc(50% + ${s.y} - 65px)`,
                  left: `calc(50% + ${s.x} - 65px)`,
                  // x/y are pixel offsets (pentagon positions)
                  zIndex: 2,
                  opacity: 0,
                  animation: `v-pop 0.65s cubic-bezier(0.34,1.56,0.64,1) ${s.delay} forwards`,
                }}
              >
                {/* Landing rings — fire once on pop */}
                <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`1.5px solid rgba(${s.rgb},0.7)`,
                  animation:`v-ring1 0.8s ease-out calc(${s.delay} + 0.1s) forwards`, opacity:0 }}/>
                <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`1px solid rgba(${s.rgb},0.45)`,
                  animation:`v-ring2 1s ease-out calc(${s.delay} + 0.15s) forwards`, opacity:0 }}/>
                <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`1px solid rgba(${s.rgb},0.25)`,
                  animation:`v-ring3 1.2s ease-out calc(${s.delay} + 0.2s) forwards`, opacity:0 }}/>

                {/* Circle body */}
                <div style={{
                  width: 130, height: 130, borderRadius: '50%',
                  border: `1.5px solid rgba(${s.rgb},0.65)`,
                  background: `radial-gradient(circle at 40% 40%, rgba(${s.rgb},0.1) 0%, rgba(${s.rgb},0.03) 100%)`,
                  boxShadow: `0 0 24px rgba(${s.rgb},0.12), inset 0 0 20px rgba(${s.rgb},0.04)`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                  position:'relative',
                }}>
                  {/* Inner spinning dashed ring */}
                  <div style={{
                    position:'absolute', inset:10, borderRadius:'50%',
                    border:`1px dashed rgba(${s.rgb},0.2)`,
                    animation:`v-innerSpin ${14 + i * 3}s linear infinite`,
                  }}/>
                  {/* Dot accent */}
                  <div style={{ width:6, height:6, borderRadius:'50%', background:`rgba(${s.rgb},0.9)`,
                    boxShadow:`0 0 8px rgba(${s.rgb},0.8)`,
                    animation:`v-dotBlink 2.2s ease-in-out ${i * 0.4}s infinite`, marginBottom:2 }}/>
                  <span style={{ color:'rgba(255,255,255,0.88)', fontSize:10.5, fontWeight:700, textAlign:'center', padding:'0 12px', lineHeight:1.3, letterSpacing:'0.02em' }}>
                    {s.label}
                  </span>
                  <span style={{ color:'rgba(255,255,255,0.45)', fontSize:8, textAlign:'center', padding:'0 14px', lineHeight:1.4 }}>
                    {s.note}
                  </span>
                </div>
              </div>
            ))}

            {/* Orbiting particle dots — appear with TRUTH */}
            <div style={{ position:'absolute', top:'50%', left:'50%', width:10, height:10, borderRadius:'50%',
              background:'rgba(92,242,142,0.9)', boxShadow:'0 0 8px rgba(92,242,142,0.8)',
              opacity:0, animation:'v-orbit 4s linear 3.0s infinite, v-glow 0.4s ease 3.0s forwards' }}/>
            <div style={{ position:'absolute', top:'50%', left:'50%', width:6, height:6, borderRadius:'50%',
              background:'rgba(92,242,142,0.6)', boxShadow:'0 0 5px rgba(92,242,142,0.6)',
              opacity:0, animation:'v-orbit2 6s linear 3.2s infinite, v-glow 0.4s ease 3.2s forwards' }}/>

            {/* TRUTH — centre label */}
            <div
              style={{
                position: 'absolute', top: '50%', left: '50%', zIndex: 10,
                opacity: 0,
                animation: 'v-truthFlash 0.7s cubic-bezier(0.34,1.56,0.64,1) 2.9s forwards',
              }}
            >
              <div style={{ position:'relative', textAlign:'center' }}>
                {/* Glowing backdrop */}
                <div style={{
                  position:'absolute', top:'50%', left:'50%',
                  transform:'translate(-50%,-50%)',
                  width:72, height:72, borderRadius:'50%',
                  background:'radial-gradient(circle, rgba(92,242,142,0.25) 0%, transparent 70%)',
                  filter:'blur(6px)',
                }}/>
                <div
                  style={{
                    fontSize: 12, fontWeight: 900, letterSpacing: '0.24em', textTransform: 'uppercase',
                    color: '#5cf28e',
                    textShadow: '0 0 16px rgba(92,242,142,1), 0 0 32px rgba(92,242,142,0.6), 0 0 64px rgba(92,242,142,0.3)',
                    whiteSpace: 'nowrap',
                    transform: 'translate(-50%, -50%)',
                    position: 'absolute',
                    top: '50%', left: '50%',
                    animation: 'v-pulse 2.2s ease-in-out 3s infinite',
                  }}
                >
                  Truth
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
