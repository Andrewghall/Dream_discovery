'use client'
import { useEffect, useRef, useState } from 'react'

// POCTR segments for hemisphere
const POCTR = [
  { key: 'C',  label: 'Customer',   color: '#5cf28e', rgb: '92,242,142'  },
  { key: 'T',  label: 'Technology', color: '#5cc6f2', rgb: '92,198,242'  },
  { key: 'P',  label: 'People',     color: '#f2c65c', rgb: '242,198,92'  },
  { key: 'Pt', label: 'Partner',    color: '#f2705c', rgb: '242,112,92'  },
  { key: 'R',  label: 'Regulator',  color: '#c65cf2', rgb: '198,92,242'  },
]

// Hemisphere signal type legend
const HEMI_LEGEND = [
  { color: '#f2705c', rgb: '242,112,92',  label: 'Constraint & Challenge'  },
  { color: '#5cf28e', rgb: '92,242,142',  label: 'Enablers & Transform'    },
  { color: '#5cc6f2', rgb: '92,198,242',  label: 'Vision & Imagination'    },
]

// Floating context words
const CONTEXT_WORDS = [
  { word: 'intent…',    tier: 0, x: 4,  baseY: 38 },
  { word: '…risk…',     tier: 1, x: 6,  baseY: 55 },
  { word: '…signal…',   tier: 0, x: 3,  baseY: 25 },
  { word: '…customer…', tier: 2, x: 7,  baseY: 68 },
  { word: '…context…',  tier: 1, x: 5,  baseY: 48 },
  { word: 'authority…', tier: 0, x: 4,  baseY: 32 },
  { word: '…culture…',  tier: 2, x: 8,  baseY: 72 },
  { word: 'sentiment…', tier: 1, x: 6,  baseY: 42 },
  { word: '…intent…',   tier: 0, x: 3,  baseY: 20 },
  { word: '…risk…',     tier: 2, x: 9,  baseY: 60 },
]

// Constellation nodes
const NODES = [
  { id: 0, cx: 50, cy: 50, r: 6, delay: 0.0, color: '#5cf28e', rgb: '92,242,142'  },
  { id: 1, cx: 42, cy: 38, r: 4, delay: 0.3, color: '#5cc6f2', rgb: '92,198,242'  },
  { id: 2, cx: 58, cy: 36, r: 4, delay: 0.5, color: '#f2c65c', rgb: '242,198,92'  },
  { id: 3, cx: 62, cy: 54, r: 4, delay: 0.7, color: '#f2705c', rgb: '242,112,92'  },
  { id: 4, cx: 44, cy: 62, r: 4, delay: 0.9, color: '#c65cf2', rgb: '198,92,242'  },
  { id: 5, cx: 50, cy: 30, r: 3, delay: 1.1, color: '#5cf28e', rgb: '92,242,142'  },
  { id: 6, cx: 66, cy: 44, r: 3, delay: 1.3, color: '#5cc6f2', rgb: '92,198,242'  },
  { id: 7, cx: 38, cy: 48, r: 3, delay: 1.5, color: '#f2c65c', rgb: '242,198,92'  },
]

const CONNECTIONS = [[0,1],[0,2],[0,3],[0,4],[1,5],[2,5],[2,6],[3,6],[4,7],[1,7],[5,6]]

// Pre-computed hemisphere dots — module-level to avoid SSR/client float mismatch
const HEMI_DOTS = POCTR.flatMap((seg, si) => {
  const count = [8, 6, 7, 5, 6][si]
  return Array.from({ length: count }, (_, di) => {
    const segStartDeg = si * 36
    const angleDeg = segStartDeg + di * (30 / count) + 3
    const angleRad = angleDeg * (Math.PI / 180)
    const radius = 52 + (di % 3) * 14
    const cx = parseFloat((radius * Math.cos(angleRad)).toFixed(4))
    const cy = parseFloat((radius * Math.sin(angleRad)).toFixed(4))
    return { seg, di, cx, cy, delay: 4.2 + si * 0.8 + di * 0.2 }
  })
})

// Agentic conversation messages
// Multi-agent conversation — three agents contextualising in real-time
const AGENT_MSGS = [
  { t: 0.5,  agent: 'LEXIS',  text: 'Picking up a high-friction cluster in the Technology domain. Negative affect, repeated across 4 speakers.' },
  { t: 1.7,  agent: 'AXIOM',  text: 'Corroborated. Sentiment score −0.71 averaged across cluster. This isn\'t noise — it\'s structural.' },
  { t: 2.8,  agent: 'BRIDGE', text: 'Checking historical context… similar cluster appeared 14 months ago. Outcome: unresolved, escalated.' },
  { t: 4.0,  agent: 'LEXIS',  text: 'Now seeing an echo in Partner signals. Same language pattern — "no ownership", "stalled". Cross-domain spread.' },
  { t: 5.2,  agent: 'AXIOM',  text: 'That changes the weight. Technology and Partner are co-dependent constraints, not independent issues.' },
  { t: 6.2,  agent: 'BRIDGE', text: 'Agreed. I\'m holding state — need one more signal before we can classify with confidence.' },
  { t: 7.4,  agent: 'LEXIS',  text: 'Incoming — Customer domain. Positive divergence. "NPS is recovering, ahead of target." Enabler signal.' },
  { t: 8.4,  agent: 'AXIOM',  text: 'Interesting split: leadership and operational layers constrained, but customer experience is improving.' },
  { t: 9.3,  agent: 'BRIDGE', text: 'Context window complete. Three-utterance chain confirmed. Classifying now.' },
  { t: 10.1, agent: 'LEXIS',  text: 'Technology → Constraint & Challenge  ·  Partner → Constraint & Challenge' },
  { t: 10.7, agent: 'AXIOM',  text: 'Customer → Enablers & Transform  ·  All signals placed in hemisphere.' },
]

const AGENT_COLORS: Record<string, string> = {
  LEXIS:  'rgba(92,198,242,0.95)',
  AXIOM:  'rgba(242,198,92,0.95)',
  BRIDGE: 'rgba(92,242,142,0.95)',
}

// Pre-computed sin values for particle positions
const PARTICLE_SIN = [-3, 8, -6, 9, -2, 7, -4, 10, -1, 8, -5, 6]

const STYLES = `
  @keyframes cf-waveIn     { from{transform:scaleY(0);opacity:0} to{transform:scaleY(1);opacity:1} }
  @keyframes cf-wordDrift  {
    0%   { opacity:0; transform:translateX(0) translateY(0px); }
    15%  { opacity:1; }
    100% { opacity:0.55; transform:translateX(32vw) translateY(-10px); }
  }
  @keyframes cf-particle   {
    0%   { opacity:0; transform:translate(0,0) scale(0.3); }
    20%  { opacity:0.9; transform:translate(calc(var(--tx)*0.2), calc(var(--ty)*0.2)) scale(1); }
    100% { opacity:0; transform:translate(var(--tx), var(--ty)) scale(0.2); }
  }
  @keyframes cf-nodeIn     { 0%{opacity:0;transform:scale(0)} 60%{opacity:1;transform:scale(1.3)} 100%{opacity:1;transform:scale(1)} }
  @keyframes cf-lineGrow   { from{stroke-dashoffset:var(--len)} to{stroke-dashoffset:0} }
  @keyframes cf-ringOut    { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.8);opacity:0} }
  @keyframes cf-dotPop     { 0%{opacity:0;transform:scale(0)} 60%{transform:scale(1.4)} 100%{opacity:1;transform:scale(1)} }
  @keyframes cf-glow       { 0%,100%{filter:drop-shadow(0 0 4px currentColor)} 50%{filter:drop-shadow(0 0 14px currentColor) drop-shadow(0 0 28px currentColor)} }
  @keyframes cf-fadeIn     { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes cf-finalGlow  { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)} 40%{opacity:1;transform:translate(-50%,-50%) scale(1.3)} 100%{opacity:1;transform:translate(-50%,-50%) scale(1)} }
  @keyframes cf-cursor     { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes cf-msgSlide   { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
`

export default function EthentaFlowSection() {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sectionRef = useRef(null as any)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [mounted])

  if (!mounted) return <div className="relative h-screen bg-[#080810]" />

  return (
    <div ref={sectionRef} className="relative h-screen flex flex-col justify-center bg-[#07090f] overflow-hidden">
      <style>{STYLES}</style>

      {/* Subtle hero backdrop */}
      <div style={{ position:'absolute', inset:0,
        backgroundImage:"url('/Ethenta_Hero_Image.png')",
        backgroundSize:'cover', backgroundPosition:'center',
        opacity:0.09, filter:'saturate(0.5) brightness(0.7)' }}/>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(7,9,15,0.55) 0%, rgba(7,9,15,0.3) 50%, rgba(7,9,15,0.55) 100%)' }}/>

      {/* EthentaFlow™ logo — top right */}
      <div style={{ position:'absolute', top:28, right:36, opacity:0.85, zIndex:20 }}>
        <img src="/ethenta_flow_transparent_white.png" alt="EthentaFlow" style={{ height:34 }}/>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-10">

        {/* Header */}
        <div className="mb-5">
          <p className="snap-animate snap-animate-1 text-[11px] tracking-[0.3em] uppercase mb-2"
            style={{ color:'rgba(92,198,242,0.75)' }}>
            EthentaFlow™ — The Engine
          </p>
          <h2 className="snap-animate snap-animate-2 font-black tracking-[-0.04em] text-white leading-[0.92]"
            style={{ fontSize:'clamp(28px,3.5vw,50px)' }}>
            Conversation State<br/>
            <span style={{ color:'#5cc6f2' }}>Intelligence.</span>
          </h2>
          <p className="snap-animate snap-animate-3 text-white/55 text-sm font-light mt-2 max-w-lg leading-relaxed">
            Context before classification. Meaning before metadata.<br/>
            The utterance is held in state until the full picture is known.
          </p>
        </div>

        {/* ── Main animation canvas ── */}
        {visible && <>
        <div style={{ position:'relative', width:'100%', height:290,
          borderRadius:20, border:'1px solid rgba(92,198,242,0.2)',
          background:'rgba(12,18,32,0.8)',
          boxShadow:'0 0 60px rgba(92,198,242,0.08), inset 0 0 40px rgba(7,9,15,0.4)',
          overflow:'hidden' }}>

          {/* Zone labels */}
          {[
            { label:'CAPTURE',   sub:'audio → context',        x:'16.5%', color:'rgba(92,198,242,0.9)' },
            { label:'SYNTHESISE',sub:'state building',          x:'50%',   color:'rgba(92,242,142,0.9)' },
            { label:'CLASSIFY',  sub:'hemisphere population',   x:'83.5%', color:'rgba(198,92,242,0.9)' },
          ].map((z,i) => (
            <div key={i} style={{ position:'absolute', top:10, left:z.x, transform:'translateX(-50%)',
              textAlign:'center', opacity:0, animation:`cf-fadeIn 0.5s ease ${0.1+i*0.15}s forwards`, zIndex:5 }}>
              <div style={{ fontSize:8.5, fontWeight:800, letterSpacing:'0.18em', color:z.color }}>{z.label}</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginTop:2 }}>{z.sub}</div>
            </div>
          ))}

          {/* Zone dividers */}
          <div style={{ position:'absolute', top:36, bottom:16, left:'33.3%', width:1, background:'rgba(255,255,255,0.05)' }}/>
          <div style={{ position:'absolute', top:36, bottom:16, left:'66.6%', width:1, background:'rgba(255,255,255,0.05)' }}/>

          {/* ═══ ZONE 1: AUDIO WAVEFORM ═══ */}
          <div style={{ position:'absolute', left:'2%', top:'50%', transform:'translateY(-50%)', width:'30%' }}>
            <div suppressHydrationWarning style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3, height:80 }}>
              {Array.from({length:28}, (_,i) => {
                const heights  = [20,35,55,70,85,95,80,90,75,60,85,92,78,65,88,95,72,60,80,70,55,40,30,45,60,50,35,25]
                const opacities= [0.6,0.75,0.5,0.8,0.65,0.7,0.55,0.8,0.6,0.7,0.75,0.5,0.65,0.8,0.6,0.7,0.55,0.75,0.6,0.5,0.7,0.65,0.8,0.6,0.55,0.7,0.75,0.6]
                const durations= [0.7,0.5,0.8,0.6,0.9,0.5,0.7,0.6,0.8,0.5,0.7,0.9,0.6,0.8,0.5,0.7,0.6,0.9,0.5,0.8,0.7,0.6,0.5,0.9,0.7,0.6,0.8,0.5]
                return (
                  <div key={i} style={{
                    width:3, borderRadius:2,
                    background:`rgba(92,198,242,${opacities[i]})`,
                    height:`${heights[i]}%`,
                    transformOrigin:'center',
                    animation:`cf-waveIn 0.4s ease-out ${i*0.04}s both`,
                    boxShadow:'0 0 8px rgba(92,198,242,0.6)',
                  }}/>
                )
              })}
            </div>

            {/* Floating context words */}
            {CONTEXT_WORDS.map((w,i) => (
              <div key={`w${i}`} style={{
                position:'absolute', left:`${w.x * 3.5}%`, top:`${w.baseY}%`,
                fontSize: w.tier === 0 ? 10 : w.tier === 1 ? 8.5 : 7.5,
                color: ['rgba(92,198,242,0.7)','rgba(92,242,142,0.6)','rgba(198,92,242,0.55)'][w.tier],
                fontFamily:'monospace', fontStyle:'italic', whiteSpace:'nowrap',
                opacity:0, animation:`cf-wordDrift ${2.5+i*0.3}s ease-out ${0.3+i*0.22}s both`,
                textShadow:'0 0 8px currentColor', pointerEvents:'none',
              }}>{w.word}</div>
            ))}

            <div style={{ textAlign:'center', marginTop:8 }}>
              <div style={{ fontSize:7, color:'rgba(92,198,242,0.45)', letterSpacing:'0.12em', fontFamily:'monospace' }}>
                30 MIN · {'>'}800 UTTERANCES
              </div>
            </div>
          </div>

          {/* ═══ ZONE 2: CONSTELLATION / CSI SYNTHESIS ═══ */}
          <div style={{ position:'absolute', left:'33.3%', top:36, right:'33.4%', bottom:16 }}>
            <svg width="100%" height="100%" viewBox="0 0 200 220" style={{ overflow:'visible' }}>

              {CONNECTIONS.map(([a,b],i) => {
                const na = NODES[a], nb = NODES[b]
                const x1 = na.cx * 2, y1 = na.cy * 2.2
                const x2 = nb.cx * 2, y2 = nb.cy * 2.2
                const len = Math.hypot(x2-x1, y2-y1)
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="rgba(92,242,142,0.2)" strokeWidth="1"
                    strokeDasharray={len}
                    style={{ '--len':`${len}`, strokeDashoffset:len,
                      animation:`cf-lineGrow 0.5s ease ${1.3+i*0.16}s forwards` } as React.CSSProperties}
                  />
                )
              })}

              {NODES.map(n => {
                const cx = n.cx * 2, cy = n.cy * 2.2
                return (
                  <g key={n.id} style={{ opacity:0, animation:`cf-nodeIn 0.5s cubic-bezier(0.34,1.56,0.64,1) ${0.8+n.delay*1.3}s forwards`, transformOrigin:`${cx}px ${cy}px` }}>
                    <circle cx={cx} cy={cy} r={n.r*2} fill="none"
                      stroke={`rgba(${n.rgb},0.4)`} strokeWidth="1"
                      style={{ animation:`cf-ringOut 2s ease-out ${1.6+n.delay*1.3}s both` }}/>
                    <circle cx={cx} cy={cy} r={n.r} fill={`rgba(${n.rgb},0.12)`}
                      stroke={`rgba(${n.rgb},0.8)`} strokeWidth="1.5"
                      style={{ filter:`drop-shadow(0 0 6px rgba(${n.rgb},0.7))`,
                        animation:`cf-glow 1.5s ease-in-out ${n.delay}s both`, color:n.color }}/>
                    <circle cx={cx} cy={cy} r={n.r * 0.45} fill={n.color}
                      style={{ filter:`drop-shadow(0 0 4px ${n.color})` }}/>
                  </g>
                )
              })}

              <g style={{ opacity:0, animation:`cf-nodeIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 3.6s forwards`, transformOrigin:'100px 110px' }}>
                <circle cx="100" cy="110" r="28" fill="none" stroke="rgba(92,242,142,0.5)" strokeWidth="1.5"
                  style={{ animation:`cf-ringOut 1.2s ease-out 3.9s infinite` }}/>
                <circle cx="100" cy="110" r="28" fill="none" stroke="rgba(92,242,142,0.3)" strokeWidth="1"
                  style={{ animation:`cf-ringOut 1.5s ease-out 4.2s infinite` }}/>
              </g>

              <text x="100" y="195" textAnchor="middle" fill="rgba(92,242,142,0.7)" fontSize="7.5"
                fontFamily="monospace" fontWeight="bold" letterSpacing="1.5"
                style={{ opacity:0, animation:`cf-fadeIn 0.4s ease 3.3s forwards` }}>
                CONTEXT CONFIRMED
              </text>
            </svg>
          </div>

          {/* ═══ ZONE 3: HEMISPHERE ═══ */}
          <div style={{ position:'absolute', right:'2%', top:'50%', transform:'translateY(-50%)', width:'30%', display:'flex', flexDirection:'column', alignItems:'center' }}>
            <svg width="200" height="115" viewBox="-100 -100 200 115" style={{ overflow:'visible' }}>
              <line x1="-82" y1="0" x2="82" y2="0" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
              <path d="M -80 0 A 80 80 0 0 1 80 0" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>

              {POCTR.map((seg, si) => {
                const startDeg = si * 36, endDeg = (si + 1) * 36, midDeg = startDeg + 18
                const r = 80, ir = 46
                const toRad = (d: number) => d * Math.PI / 180
                const x1  = parseFloat((r  * Math.cos(toRad(startDeg))).toFixed(3))
                const y1  = parseFloat((-r  * Math.sin(toRad(startDeg))).toFixed(3))
                const x2  = parseFloat((r  * Math.cos(toRad(endDeg))).toFixed(3))
                const y2  = parseFloat((-r  * Math.sin(toRad(endDeg))).toFixed(3))
                const ix1 = parseFloat((ir * Math.cos(toRad(startDeg))).toFixed(3))
                const iy1 = parseFloat((-ir * Math.sin(toRad(startDeg))).toFixed(3))
                const ix2 = parseFloat((ir * Math.cos(toRad(endDeg))).toFixed(3))
                const iy2 = parseFloat((-ir * Math.sin(toRad(endDeg))).toFixed(3))
                const lx  = parseFloat(((r + 13) * Math.cos(toRad(midDeg))).toFixed(3))
                const ly  = parseFloat((-(r + 13) * Math.sin(toRad(midDeg))).toFixed(3))
                return (
                  <g key={si}>
                    <path d={`M${ix1},${iy1} L${x1},${y1} A${r},${r} 0 0,0 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 0,1 ${ix1},${iy1}`}
                      fill={`rgba(${seg.rgb},0.06)`} stroke={`rgba(${seg.rgb},0.2)`} strokeWidth="0.5"
                      style={{ opacity:0, animation:`cf-fadeIn 0.5s ease ${3.9+si*0.6}s forwards` }}/>
                    <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                      fill={`rgba(${seg.rgb},0.8)`} fontSize="8" fontFamily="monospace" fontWeight="bold"
                      style={{ opacity:0, animation:`cf-fadeIn 0.4s ease ${4.4+si*0.6}s forwards` }}>
                      {seg.key}
                    </text>
                  </g>
                )
              })}

              {HEMI_DOTS.map((d,i) => (
                <circle key={i} cx={d.cx} cy={-d.cy} r="3.5"
                  fill={`rgba(${d.seg.rgb},0.85)`}
                  style={{ opacity:0,
                    animation:`cf-dotPop 0.45s cubic-bezier(0.34,1.56,0.64,1) ${d.delay}s forwards`,
                    filter:`drop-shadow(0 0 5px rgba(${d.seg.rgb},0.8))` }}/>
              ))}

              <circle cx="0" cy="0" r="9" fill="rgba(92,242,142,0.15)"
                stroke="rgba(92,242,142,0.55)" strokeWidth="1.5"
                style={{ opacity:0, animation:`cf-finalGlow 0.7s ease 8s forwards`,
                  filter:'drop-shadow(0 0 10px rgba(92,242,142,0.6))' }}/>
              <text x="0" y="-1" textAnchor="middle" dominantBaseline="middle"
                fill="rgba(92,242,142,0.9)" fontSize="5" fontFamily="monospace" fontWeight="bold"
                style={{ opacity:0, animation:`cf-fadeIn 0.4s ease 8.4s forwards` }}>CSI</text>
            </svg>

            {/* POCTR axis labels */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center', marginTop:5 }}>
              {POCTR.map((seg,i) => (
                <div key={seg.key} style={{ display:'flex', alignItems:'center', gap:4,
                  opacity:0, animation:`cf-fadeIn 0.4s ease ${5.2+i*0.2}s forwards` }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:seg.color, boxShadow:`0 0 6px ${seg.color}` }}/>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.65)', fontFamily:'monospace' }}>{seg.label}</span>
                </div>
              ))}
            </div>

            {/* Signal type legend */}
            <div style={{ marginTop:8, padding:'8px 12px', borderRadius:10,
              border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)',
              opacity:0, animation:`cf-fadeIn 0.5s ease 6.8s forwards` }}>
              {HEMI_LEGEND.map((l) => (
                <div key={l.label} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                  <div style={{ width:9, height:9, borderRadius:'50%', background:l.color,
                    boxShadow:`0 0 8px rgba(${l.rgb},0.9)`, flexShrink:0 }}/>
                  <span style={{ fontSize:9.5, color:'rgba(255,255,255,0.8)', fontFamily:'monospace', whiteSpace:'nowrap', fontWeight:600 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Particle stream */}
          {Array.from({length:12}, (_,i) => (
            <div key={`p${i}`} style={{
              position:'absolute',
              left:`${20+i*1.5}%`,
              top:`${30+Math.sin(i)*25}%`,
              width:4, height:4, borderRadius:'50%',
              background: POCTR[i%5].color,
              boxShadow:`0 0 6px ${POCTR[i%5].color}`,
              '--tx':`${(i%3===0?18:i%3===1?22:16) + i}vw`,
              '--ty':`${(i%2===0?-5:5) + PARTICLE_SIN[i]}px`,
              opacity:0,
              animation:`cf-particle 2s ease-out ${0.5+i*0.35}s both`,
            } as React.CSSProperties}/>
          ))}
        </div>

        {/* ── Agentic conversation terminal ── */}
        <div style={{
          marginTop:10, width:'100%',
          borderRadius:14, border:'1px solid rgba(92,242,142,0.2)',
          background:'rgba(8,12,20,0.85)',
          backdropFilter:'blur(12px)',
          padding:'12px 20px',
          fontFamily:'monospace',
          display:'flex', flexDirection:'column', gap:0,
          overflow:'hidden',
          boxShadow:'0 0 40px rgba(92,242,142,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          {/* Terminal title bar */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, borderBottom:'1px solid rgba(255,255,255,0.08)', paddingBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#f2705c', boxShadow:'0 0 4px #f2705c' }}/>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#f2c65c', boxShadow:'0 0 4px #f2c65c' }}/>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#5cf28e', boxShadow:'0 0 4px #5cf28e' }}/>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginLeft:8, letterSpacing:'0.12em' }}>ethentaflow · csi-agent · live session</span>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'rgba(92,242,142,0.9)', boxShadow:'0 0 8px rgba(92,242,142,0.8)', animation:'cf-cursor 1.2s ease-in-out infinite' }}/>
              <span style={{ fontSize:9, color:'rgba(92,242,142,0.85)', letterSpacing:'0.12em', fontWeight:700 }}>RECORDING</span>
            </div>
          </div>

          {/* Messages */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'3px 0', alignItems:'flex-start' }}>
            {AGENT_MSGS.map((msg, i) => (
              <div key={i} style={{
                width:'100%', display:'flex', alignItems:'baseline', gap:10,
                opacity:0, animation:`cf-msgSlide 0.3s ease ${msg.t}s forwards`,
                paddingBottom:3,
              }}>
                {/* Agent badge */}
                <span style={{
                  fontSize:9, fontWeight:900, letterSpacing:'0.1em',
                  color: AGENT_COLORS[msg.agent as keyof typeof AGENT_COLORS],
                  minWidth:50, flexShrink:0,
                  textShadow: `0 0 12px ${AGENT_COLORS[msg.agent as keyof typeof AGENT_COLORS]}`,
                }}>
                  {msg.agent}
                </span>
                {/* Separator */}
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.25)', flexShrink:0 }}>›</span>
                {/* Content */}
                <span style={{
                  fontSize:10.5,
                  color: msg.agent === 'BRIDGE' ? 'rgba(92,242,142,0.95)'
                       : msg.agent === 'AXIOM'  ? 'rgba(255,230,120,0.95)'
                       : 'rgba(200,235,255,0.95)',
                  fontStyle:'normal',
                  lineHeight: 1.45,
                }}>
                  {msg.text}
                </span>
              </div>
            ))}
          </div>
        </div>
        </>}

      </div>
    </div>
  )
}
