'use client'
import { useState, useEffect } from 'react'

type Phase = 1 | 2 | 3 | 4 | null

// POCTR framework — EthentaFlow™ Conversation State Intelligence
const poctr = ['People', 'Organisation', 'Customer', 'Technology', 'Regulation']

const GLOBAL_STYLES = `
  @keyframes gPop      { 0%{opacity:0;transform:scale(0) rotate(-15deg)} 55%{transform:scale(1.22) rotate(2deg)} 80%{transform:scale(0.94)} 100%{opacity:1;transform:scale(1) rotate(0)} }
  @keyframes gSlideL   { 0%{opacity:0;transform:translateX(-45px)} 65%{transform:translateX(4px)} 100%{opacity:1;transform:translateX(0)} }
  @keyframes gSlideR   { 0%{opacity:0;transform:translateX(45px)} 65%{transform:translateX(-4px)} 100%{opacity:1;transform:translateX(0)} }
  @keyframes gDropIn   { 0%{opacity:0;transform:translateY(-55px) scale(0.5)} 55%{transform:translateY(5px) scale(1.05)} 80%{transform:translateY(-2px)} 100%{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes gFadeUp   { 0%{opacity:0;transform:translateY(10px)} 100%{opacity:1;transform:translateY(0)} }
  @keyframes gFlash    { 0%{opacity:0} 20%{opacity:1} 100%{opacity:0} }
  @keyframes gScanH    { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
  @keyframes gBarFill  { from{transform:scaleX(0)} to{transform:scaleX(1)} }
  @keyframes gDotPulse { 0%,100%{transform:scale(1);opacity:0.85} 50%{transform:scale(1.7);opacity:0.4} }
  @keyframes gSpinSlow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes gBlink    { 0%,100%{opacity:0.9} 50%{opacity:0.3} }
  @keyframes gGlow     { 0%,100%{opacity:0.7} 50%{opacity:1} }
  @keyframes gRingOut  { 0%{transform:scale(1);opacity:0.75} 100%{transform:scale(2.8);opacity:0} }
  @keyframes gLTR      { from{clip-path:inset(0 100% 0 0)} to{clip-path:inset(0 0 0 0)} }
  @keyframes gRTL      { from{clip-path:inset(0 0 0 100%)} to{clip-path:inset(0 0 0 0)} }
  @keyframes gBlockOn  { from{background:rgba(220,60,60,0.09);border-color:rgba(220,60,60,0.55)} to{background:rgba(92,242,142,0.1);border-color:rgba(92,242,142,0.65)} }
  @keyframes gTextOn   { from{color:rgba(255,255,255,0.65)} to{color:rgba(92,242,142,0.92)} }
  @keyframes gSubOn    { from{color:rgba(220,60,60,0.6)} to{color:rgba(92,242,142,0.65)} }
  @keyframes gVisionR  { 0%{transform:scale(1);opacity:0.8;border-width:2.5px} 100%{transform:scale(3.5);opacity:0;border-width:0.5px} }
  @media (max-width: 640px) {
    .phase-btns { gap: 6px !important; }
    .phase-btn-item { padding: 7px 14px !important; font-size: 10px !important; letter-spacing: 0.1em !important; }
  }
`

// ── Shared: circle node (HTML, no distortion) ─────────────────────
function CircleNode({ label, sub, color, rgb, delay, pulse }: {
  label: string; sub?: string; color: string; rgb: string; delay: string; pulse?: boolean
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, opacity:0, animation:`gPop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${delay} forwards`, flexShrink:0 }}>
      <div style={{ position:'relative', width:48, height:48 }}>
        {pulse && (
          <div style={{ position:'absolute', top:'50%', left:'50%' }}>
            <div style={{ width:48, height:48, borderRadius:'50%', border:`2px solid rgba(${rgb},0.7)`,
              transform:'translate(-50%,-50%)',
              animation:`gRingOut 1.4s ease-out 0.1s infinite` }} />
          </div>
        )}
        <div style={{ width:48, height:48, borderRadius:'50%',
          border:`2px solid rgba(${rgb},${pulse ? 0.9 : 0.55})`,
          background:`radial-gradient(circle, rgba(${rgb},0.12) 0%, rgba(${rgb},0.03) 100%)`,
          boxShadow: pulse ? `0 0 20px rgba(${rgb},0.35), 0 0 40px rgba(${rgb},0.12)` : 'none',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          animation: pulse ? `gGlow 1.8s ease-in-out 0.1s infinite` : 'none',
        }}>
          <div style={{ fontSize:7.5, fontWeight:800, color, letterSpacing:'0.12em', textTransform:'uppercase', textAlign:'center', lineHeight:1.2 }}>{label}</div>
          {sub && <div style={{ fontSize:6, color:`rgba(${rgb},0.6)`, marginTop:1 }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

// ── Phase 1: Discover ─────────────────────────────────────────────
function DiscoverAnim() {
  const streams = [
    { label: 'Discovery Agent',      sub: 'Structured AI conversations across all five POCTR domains — context, not just phrases', color: '#5cf28e', rgb: '92,242,142',  delay: 0.0 },
    { label: 'Synthesis Engine',     sub: 'Specialist agents cluster themes, score confidence & surface cross-participant patterns',  color: '#5cc6f2', rgb: '92,198,242',  delay: 0.4 },
    { label: 'Deterministic Analytics', sub: 'Reproducible sentiment, bias & balance scores — same data always same insight',      color: '#c65cf2', rgb: '198,92,242',   delay: 0.8 },
  ]
  return (
    <div style={{ position:'relative', display:'flex', alignItems:'center', height:'100%', padding:'8px 14px', gap:6 }}>
      {/* Scanline */}
      <div style={{ position:'absolute', inset:0, overflow:'hidden', borderRadius:16, pointerEvents:'none' }}>
        <div style={{ position:'absolute', inset:0, width:'30%', background:'linear-gradient(90deg,transparent,rgba(92,242,142,0.045),transparent)', animation:'gScanH 3.5s linear 1s infinite' }}/>
      </div>

      {/* Streams — pure HTML */}
      <div style={{ width:205, display:'flex', flexDirection:'column', justifyContent:'space-around', height:'100%', padding:'18px 0', gap:6, flexShrink:0 }}>
        {streams.map((s,i) => (
          <div key={i} style={{ opacity:0, animation:`gSlideL 0.55s cubic-bezier(0.34,1.56,0.64,1) ${s.delay}s forwards` }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
              <div style={{ position:'relative', width:14, height:14, flexShrink:0, marginTop:2 }}>
                <div style={{ position:'absolute', inset:0, transform:'rotate(45deg)', borderRadius:2,
                  background:`rgba(${s.rgb},0.9)`, boxShadow:`0 0 12px rgba(${s.rgb},1), 0 0 24px rgba(${s.rgb},0.4)`,
                  animation:`gDotPulse 1.6s ease-in-out ${s.delay+0.9}s infinite` }}/>
              </div>
              <div>
                <div style={{ fontSize:10.5, fontWeight:700, color:s.color, letterSpacing:'0.02em', textShadow:`0 0 10px rgba(${s.rgb},0.5)` }}>{s.label}</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.42)', marginTop:2, lineHeight:1.35 }}>{s.sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Converging SVG lines — uniform scaling, NO preserveAspectRatio="none" */}
      <div style={{ flex:1, position:'relative', height:'100%', minWidth:0 }}>
        <svg width="100%" height="100%" viewBox="0 0 230 210"
          style={{ position:'absolute', inset:0 }}>
          {[38,105,172].map((y,i) => (
            <g key={i}>
              <line x1="0" y1={y} x2="115" y2="105"
                stroke={`rgba(${streams[i].rgb},0.2)`} strokeWidth="2.5"
                strokeDasharray="200"
                style={{ strokeDashoffset:200, animation:`gSVGDraw 0.65s ease ${0.45+i*0.22}s forwards` }}/>
              <line x1="0" y1={y} x2="115" y2="105"
                stroke={`rgba(${streams[i].rgb},0.65)`} strokeWidth="1.2"
                strokeDasharray="200"
                style={{ strokeDashoffset:200, animation:`gSVGDraw 0.65s ease ${0.45+i*0.22}s forwards` }}/>
              <circle r="3.5" fill={streams[i].color}
                style={{ filter:`drop-shadow(0 0 5px ${streams[i].color})` }}>
                <animateMotion dur="0.65s" begin={`${0.45+i*0.22}s`} fill="freeze"
                  path={`M0,${y} L115,105`} />
              </circle>
            </g>
          ))}
          <line x1="115" y1="105" x2="230" y2="105"
            stroke="rgba(92,242,142,0.35)" strokeWidth="1.5"
            strokeDasharray="115"
            style={{ strokeDashoffset:115, animation:`gSVGDraw 0.45s ease 1.65s forwards` }}/>
          <circle r="3.5" fill="#5cf28e" style={{ filter:'drop-shadow(0 0 6px #5cf28e)' }}>
            <animateMotion dur="0.45s" begin="1.65s" fill="freeze" path="M115,105 L230,105"/>
          </circle>
          {/* Hexagon synthesis node */}
          <g style={{ opacity:0, animation:`gSVGPop 0.65s cubic-bezier(0.34,1.56,0.64,1) 1.2s forwards`, transformOrigin:'115px 105px' }}>
            <circle cx="115" cy="105" r="22" fill="none" stroke="rgba(92,242,142,0.7)" strokeWidth="1.5"
              style={{ animation:`gSVGRing 1s ease-out 1.85s forwards` }}/>
            <polygon points="115,85 131,95 131,115 115,125 99,115 99,95"
              fill="rgba(92,242,142,0.06)" stroke="rgba(92,242,142,0.7)" strokeWidth="1.3"/>
            <circle cx="115" cy="105" r="6" fill="#5cf28e" style={{ filter:'drop-shadow(0 0 8px #5cf28e)', animation:`gSVGPulse 2s ease-in-out 2s infinite` }}/>
            <text x="115" y="142" textAnchor="middle" fill="rgba(92,242,142,0.8)" fontSize="7.5" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">SYNTHESIS</text>
          </g>
          <style>{`
            @keyframes gSVGDraw  { from{stroke-dashoffset:200} to{stroke-dashoffset:0} }
            @keyframes gSVGPop   { 0%{opacity:0;transform:scale(0)} 60%{transform:scale(1.22)} 100%{opacity:1;transform:scale(1)} }
            @keyframes gSVGRing  { 0%{r:22;opacity:0.75;stroke-width:2} 100%{r:52;opacity:0;stroke-width:0.5} }
            @keyframes gSVGPulse { 0%,100%{opacity:0.85;r:6} 50%{opacity:0.5;r:9} }
          `}</style>
        </svg>
      </div>

      {/* Reading of Now card — HTML, no distortion */}
      <div style={{ width:130, flexShrink:0, opacity:0, animation:`gSlideR 0.6s cubic-bezier(0.34,1.56,0.64,1) 2.1s forwards` }}>
        <div style={{ borderRadius:12, border:'1.5px solid rgba(92,242,142,0.45)',
          background:'linear-gradient(135deg,rgba(92,242,142,0.05) 0%,rgba(92,198,242,0.02) 100%)',
          boxShadow:'0 0 30px rgba(92,242,142,0.1), inset 0 0 16px rgba(92,242,142,0.04)',
          padding:'11px 10px 10px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, overflow:'hidden', borderRadius:12 }}>
            <div style={{ position:'absolute', top:0, bottom:0, width:'45%', background:'linear-gradient(90deg,transparent,rgba(92,242,142,0.05),transparent)', animation:'gScanH 2.2s linear 2.8s infinite' }}/>
          </div>
          <div style={{ fontSize:6.5, fontWeight:800, color:'rgba(92,242,142,0.55)', letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:8 }}>360° Hemisphere</div>
          {poctr.map((p,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.38)', width:18, flexShrink:0 }}>{p[0]}</div>
              <div style={{ flex:1, height:4, borderRadius:2, background:'rgba(255,255,255,0.07)', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:2, transformOrigin:'left',
                  background:`rgba(92,242,142,${0.4+i*0.07})`,
                  width:`${[82,68,74,58,76][i]}%`,
                  transform:'scaleX(0)', animation:`gBarFill 0.4s ease ${2.65+i*0.1}s forwards` }}/>
              </div>
            </div>
          ))}
          <div style={{ height:1, background:'rgba(92,242,142,0.12)', margin:'7px 0 6px' }}/>
          <div style={{ fontSize:8, fontWeight:800, color:'#5cf28e', letterSpacing:'0.12em', textTransform:'uppercase', textShadow:'0 0 8px rgba(92,242,142,0.5)' }}>Reading of Now</div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.38)', marginTop:2, lineHeight:1.4 }}>EthentaFlow™ — before<br/>the workshop begins</div>
        </div>
      </div>
    </div>
  )
}

// ── Phase 2: Reimagine ────────────────────────────────────────────
function ReimaginAnim() {
  const stages = [
    { label: 'TODAY',     sub: 'Reading of Now\nin the room', color:'#94a3b8', rgb:'148,163,184', r:30, delay:0.0 },
    { label: 'REIMAGINE', sub: 'What if anything\nwere possible?', color:'#5cc6f2', rgb:'92,198,242', r:36, delay:0.7 },
    { label: 'VISION',    sub: 'The ideal\nfuture state', color:'#5cf28e', rgb:'92,242,142', r:42, delay:1.4 },
  ]
  return (
    <div style={{ position:'relative', height:'100%' }}>
      <div style={{ position:'absolute', inset:0, borderRadius:16, overflow:'hidden' }}>
        <img src="/thechallengeslide.png" alt="" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.1, filter:'saturate(0.1) brightness(0.5)' }}/>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(13,13,13,0.9) 0%,rgba(13,13,13,0.55) 100%)' }}/>
      </div>
      <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-around', height:'100%', padding:'0 40px' }}>
        {stages.map((s,i) => (
          <div key={s.label} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, position:'relative' }}>
            {/* Connector arrow — HTML SVG, fixed size */}
            {i > 0 && (
              <div style={{ position:'absolute', right:'100%', top:'50%', transform:'translateY(-50%)', width:72, marginRight:-4 }}>
                <svg width="72" height="20" viewBox="0 0 72 20" overflow="visible">
                  <defs>
                    <linearGradient id={`rg${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={`rgba(${stages[i-1].rgb},0.5)`}/>
                      <stop offset="100%" stopColor={`rgba(${s.rgb},0.9)`}/>
                    </linearGradient>
                  </defs>
                  <line x1="4" y1="10" x2="62" y2="10" stroke={`url(#rg${i})`} strokeWidth="1.5"
                    strokeDasharray="62"
                    style={{ strokeDashoffset:62, animation:`gSVGDraw2 0.5s ease ${s.delay-0.15}s forwards` }}/>
                  <polygon points="66,10 56,4 56,16" fill={`rgba(${s.rgb},0.9)`}
                    style={{ opacity:0, animation:`gFadeUp 0.25s ease ${s.delay+0.05}s forwards`, filter:`drop-shadow(0 0 3px rgba(${s.rgb},0.8))` }}/>
                  <style>{`@keyframes gSVGDraw2 { from{stroke-dashoffset:62} to{stroke-dashoffset:0} }`}</style>
                </svg>
              </div>
            )}
            {/* Node — HTML div, no distortion */}
            <div style={{ position:'relative', opacity:0, animation:`gPop 0.65s cubic-bezier(0.34,1.56,0.64,1) ${s.delay}s forwards` }}>
              {i === 2 && [0,1,2].map(ri => (
                <div key={ri} style={{ position:'absolute', top:'50%', left:'50%' }}>
                  <div style={{
                    width:s.r*2, height:s.r*2, borderRadius:'50%',
                    border:`1.5px solid rgba(${s.rgb},${0.5-ri*0.1})`,
                    transform:'translate(-50%,-50%)',
                    animation:`gRingOut ${1.3+ri*0.3}s ease-out ${1.9+ri*0.2}s infinite`,
                  }}/>
                </div>
              ))}
              <div style={{ width:s.r*2, height:s.r*2, borderRadius:'50%',
                border:`${i===2?2:1.5}px solid rgba(${s.rgb},${i===2?0.9:0.45})`,
                background:`radial-gradient(circle, rgba(${s.rgb},0.12) 0%, rgba(${s.rgb},0.03) 100%)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow: i===2 ? `0 0 30px rgba(${s.rgb},0.3), 0 0 60px rgba(${s.rgb},0.1)` : 'none',
                animation: i===2 ? `gGlow 2s ease-in-out 2.1s infinite` : 'none' }}>
                <div style={{ width:s.r*0.5, height:s.r*0.5, borderRadius:'50%',
                  background:`rgba(${s.rgb},${i===2?1:0.7})`,
                  boxShadow:`0 0 ${i===2?18:8}px rgba(${s.rgb},0.9)` }}/>
              </div>
            </div>
            <div style={{ textAlign:'center', opacity:0, animation:`gFadeUp 0.4s ease ${s.delay+0.35}s forwards` }}>
              <div style={{ fontSize:11, fontWeight:900, letterSpacing:'0.16em', color:s.color, textShadow:`0 0 14px rgba(${s.rgb},0.65)` }}>{s.label}</div>
              <div style={{ fontSize:8.5, color:'rgba(255,255,255,0.42)', marginTop:4, lineHeight:1.5, whiteSpace:'pre-line' }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Phase 3 & 4 shared block component ───────────────────────────
function CBlock({ label, state, delay }: { label: string; state: 'red'|'green'; delay: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
      <div style={{
        width:72, height:58, borderRadius:8, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:3,
        background: state==='red' ? 'rgba(220,60,60,0.09)' : 'rgba(220,60,60,0.09)',
        border: state==='red' ? '1.5px solid rgba(220,60,60,0.55)' : '1.5px solid rgba(220,60,60,0.55)',
        position:'relative', overflow:'hidden',
        opacity:0,
        animation: state==='red'
          ? `gDropIn 0.55s cubic-bezier(0.34,1.56,0.64,1) ${delay} forwards`
          : `gDropIn 0.55s cubic-bezier(0.34,1.56,0.64,1) ${delay} forwards, gBlockOn 0.35s ease ${delay} forwards`,
      }}>
        {state==='red' && (
          <div style={{ fontSize:13, lineHeight:1, color:'rgba(220,80,80,0.75)',
            animation:`gBlink 2.1s ease-in-out calc(${delay} + 0.5s) infinite` }}>⚠</div>
        )}
        {state==='green' && (
          <div style={{ fontSize:11, lineHeight:1, color:'rgba(92,242,142,0.8)', animation:`gFlash 0.4s ease ${delay} both` }}>✓</div>
        )}
        <div style={{ fontSize:9, fontWeight:700, fontFamily:'monospace',
          animation: state==='green' ? `gTextOn 0.35s ease ${delay} forwards` : 'none',
          color: state==='red' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.82)',
        }}>{label}</div>
        <div style={{ fontSize:7, letterSpacing:'0.06em', fontFamily:'sans-serif',
          animation: state==='green' ? `gSubOn 0.35s ease ${delay} forwards` : 'none',
          color: state==='red' ? 'rgba(220,60,60,0.62)' : 'rgba(220,60,60,0.62)',
        }}>{state==='red' ? 'BARRIER' : 'resolved'}</div>
        {state==='green' && (
          <div style={{ position:'absolute', inset:0, background:'rgba(92,242,142,0.3)', borderRadius:8,
            opacity:0, animation:`gFlash 0.4s ease ${delay} forwards` }}/>
        )}
      </div>
      {/* Stem */}
      <div style={{ width:1.5, height:22, background: state==='red' ? 'rgba(220,60,60,0.3)' : 'rgba(92,242,142,0.35)',
        opacity:0, animation:`gFadeUp 0.3s ease calc(${delay} + 0.15s) forwards` }}/>
    </div>
  )
}

// ── Phase 3: Constraints ──────────────────────────────────────────
function ConstraintsAnim() {
  const lineDelay = 0.25
  const totalLineMs = 1500
  return (
    <div style={{ position:'relative', height:'100%', display:'flex', flexDirection:'column', padding:'8px 8px 0' }}>
      {/* Blocks row */}
      <div style={{ flex:1, display:'flex', alignItems:'flex-end', justifyContent:'space-between', padding:'8px 52px 0' }}>
        {poctr.map((c,i) => (
          <CBlock key={c} label={c} state="red" delay={`${0.55+i*0.2}s`}/>
        ))}
      </div>
      {/* Circles + line row */}
      <div style={{ position:'relative', height:56, flexShrink:0, display:'flex', alignItems:'center', padding:'0 8px' }}>
        {/* VISION circle — left in RTL scheme */}
        <CircleNode label="VISION" sub="→ today" color="rgba(92,242,142,0.9)" rgb="92,242,142" delay="0s"/>
        {/* Line container */}
        <div style={{ flex:1, position:'relative', height:24, margin:'0 8px' }}>
          {/* Glow track RTL */}
          <div style={{ position:'absolute', top:'50%', left:0, right:0, height:10,
            transform:'translateY(-50%)', background:'rgba(92,242,142,0.1)', borderRadius:5, filter:'blur(5px)',
            clipPath:'inset(0 100% 0 0)', animation:`gRTL ${totalLineMs}ms ease-out ${lineDelay}s forwards` }}/>
          {/* Main line RTL */}
          <div style={{ position:'absolute', top:'50%', left:0, right:0, height:2,
            transform:'translateY(-50%)', background:'rgba(92,242,142,0.5)', borderRadius:1,
            clipPath:'inset(0 100% 0 0)', animation:`gRTL ${totalLineMs}ms ease-out ${lineDelay}s forwards` }}/>
        </div>
        {/* TODAY circle */}
        <CircleNode label="TODAY" sub="blocked" color="rgba(255,255,255,0.5)" rgb="255,255,255" delay="2.1s"/>
      </div>
      <p style={{ color:'rgba(255,255,255,0.38)', fontSize:11, textAlign:'center', margin:'6px 0 8px' }}>
        Working backwards from vision — every POCTR barrier mapped
      </p>
    </div>
  )
}

// ── Phase 4: Way Forward ──────────────────────────────────────────
function WayForwardAnim() {
  return (
    <div style={{ position:'relative', height:'100%', display:'flex', flexDirection:'column', padding:'8px 8px 0' }}>
      {/* Blocks row */}
      <div style={{ flex:1, display:'flex', alignItems:'flex-end', justifyContent:'space-between', padding:'8px 52px 0' }}>
        {poctr.map((c,i) => (
          <CBlock key={c} label={c} state="green" delay={`${0.15+i*0.28}s`}/>
        ))}
      </div>
      {/* Circles + line row */}
      <div style={{ position:'relative', height:56, flexShrink:0, display:'flex', alignItems:'center', padding:'0 8px' }}>
        {/* TODAY circle — LEFT, LTR */}
        <CircleNode label="TODAY" sub="ready" color="#5cf28e" rgb="92,242,142" delay="0s"/>
        {/* Line LTR */}
        <div style={{ flex:1, position:'relative', height:24, margin:'0 8px' }}>
          {/* Bloom */}
          <div style={{ position:'absolute', top:'50%', left:0, right:0, height:14,
            transform:'translateY(-50%)', background:'rgba(92,242,142,0.1)', borderRadius:7, filter:'blur(7px)',
            clipPath:'inset(0 100% 0 0)', animation:`gLTR 1.3s ease-out 0.1s forwards` }}/>
          {/* Line */}
          <div style={{ position:'absolute', top:'50%', left:0, right:0, height:2.5,
            transform:'translateY(-50%)', background:'rgba(92,242,142,0.85)', borderRadius:2,
            clipPath:'inset(0 100% 0 0)', animation:`gLTR 1.3s ease-out 0.1s forwards` }}/>
          {/* Hot white edge — short div that travels */}
          <div style={{ position:'absolute', top:'50%', left:0, width:12, height:3,
            transform:'translateY(-50%)', background:'white', borderRadius:2, filter:'blur(1px)',
            boxShadow:'0 0 8px white',
            animation:`gLTR 1.3s ease-out 0.1s forwards`, clipPath:'inset(0 0 0 0)' }}/>
        </div>
        {/* VISION circle — RIGHT with burst rings */}
        <div style={{ position:'relative', flexShrink:0 }}>
          {[0,1,2].map(ri => (
            <div key={ri} style={{ position:'absolute', top:'50%', left:'50%' }}>
              <div style={{
                width:48, height:48, borderRadius:'50%',
                border:`1.5px solid rgba(92,242,142,${0.6-ri*0.12})`,
                transform:'translate(-50%,-50%)',
                animation:`gVisionR ${1.3+ri*0.28}s ease-out ${1.6+ri*0.2}s infinite`,
              }}/>
            </div>
          ))}
          <CircleNode label="VISION" sub="achieved" color="#5cf28e" rgb="92,242,142" delay="1.55s" pulse/>
        </div>
      </div>
      <p style={{ color:'rgba(255,255,255,0.4)', fontSize:11, textAlign:'center', margin:'6px 0 8px' }}>
        Every POCTR barrier resolved — a clear, validated path to vision
      </p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
const PHASES = [
  { id:1 as const, num:'01', label:'Discover',    color:'#5cf28e', rgb:'92,242,142' },
  { id:2 as const, num:'02', label:'Reimagine',   color:'#5cc6f2', rgb:'92,198,242' },
  { id:3 as const, num:'03', label:'Constraints', color:'#f07055', rgb:'240,112,85' },
  { id:4 as const, num:'04', label:'Way Forward', color:'#5cf28e', rgb:'92,242,142' },
]

export default function DecisionFlow() {
  const [active, setActive] = useState<Phase>(null)
  const [animKey, setAnimKey] = useState(0)
  function select(p: Phase) { setActive(p); setAnimKey(k => k+1) }
  useEffect(() => { select(1) }, [])

  const ap = PHASES.find(p => p.id === active)
  const glowX = active===1?'12%':active===2?'38%':active===3?'62%':'88%'
  const gc = ap?.rgb ?? '92,242,142'

  return (
    <div className="relative h-[100dvh] flex flex-col justify-center bg-[#0d0d0d] overflow-hidden">
      <style>{GLOBAL_STYLES}</style>
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', transition:'all 1s ease',
        background:`radial-gradient(ellipse 55% 60% at ${glowX} 50%, rgba(${gc},0.065) 0%, transparent 70%)` }}/>
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:0.02,
        backgroundImage:'linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)',
        backgroundSize:'60px 60px' }}/>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
        <p className="snap-animate snap-animate-1 text-[11px] text-[#5cf28e]/75 tracking-[0.3em] uppercase mb-4">
          EthentaFlow™ — Conversation State Intelligence
        </p>
        <h2 className="snap-animate snap-animate-2 font-black tracking-[-0.04em] text-white mb-7"
          style={{ fontSize:'clamp(24px,4vw,52px)' }}>
          Four stages.<br/>
          <span className="text-[#5cf28e]">One journey.</span>
        </h2>

        <div className="snap-animate snap-animate-3 phase-btns flex gap-2 mb-5 flex-wrap">
          {PHASES.map(p => {
            const on = active===p.id
            return (
              <button key={p.id} onClick={() => select(p.id)} className="phase-btn-item" style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'10px 22px', borderRadius:999,
                fontSize:11, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase',
                cursor:'pointer', transition:'all 0.3s ease',
                background: on ? `rgba(${p.rgb},0.14)` : 'transparent',
                border:`1.5px solid ${on ? `rgba(${p.rgb},0.75)` : 'rgba(255,255,255,0.12)'}`,
                color: on ? p.color : 'rgba(255,255,255,0.45)',
                boxShadow: on ? `0 0 28px rgba(${p.rgb},0.22), inset 0 0 16px rgba(${p.rgb},0.06)` : 'none',
                transform: on ? 'scale(1.05)' : 'scale(1)',
              }}>
                <span style={{ fontFamily:'monospace', fontSize:9, opacity:0.5 }}>{p.num}</span>
                {p.label}
                {on && <span style={{ width:5, height:5, borderRadius:'50%', background:p.color, boxShadow:`0 0 10px ${p.color}`, animation:'gDotPulse 1.4s ease-in-out infinite' }}/>}
              </button>
            )
          })}
        </div>

        <div style={{ position:'relative', borderRadius:18, overflow:'hidden', height:'clamp(200px, 28vh, 320px)',
          border:`1px solid ${active ? `rgba(${gc},0.16)` : 'rgba(255,255,255,0.06)'}`,
          background: active ? `rgba(${gc},0.02)` : 'rgba(255,255,255,0.01)',
          boxShadow: active ? `0 0 70px rgba(${gc},0.07), inset 0 0 50px rgba(${gc},0.03)` : 'none',
          transition:'all 0.7s ease' }}>
          {active===1 && <DiscoverAnim    key={`d-${animKey}`}/>}
          {active===2 && <ReimaginAnim    key={`r-${animKey}`}/>}
          {active===3 && <ConstraintsAnim key={`c-${animKey}`}/>}
          {active===4 && <WayForwardAnim  key={`w-${animKey}`}/>}
        </div>
      </div>
    </div>
  )
}
