'use client'
import { useEffect, useState } from 'react'

const PHRASES = [
  'Reading your profile\u2026',
  'Identifying constraint patterns\u2026',
  'Building your DREAM diagnostic\u2026',
  'Almost there\u2026',
]

export function AnalysingScreen({ onDone }: { onDone: () => void }) {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [nodeCount, setNodeCount] = useState(0)

  useEffect(() => {
    const phraseInterval = setInterval(() => {
      setPhraseIndex(i => Math.min(i + 1, PHRASES.length - 1))
    }, 900)
    const nodeInterval = setInterval(() => {
      setNodeCount(n => Math.min(n + 1, 18))
    }, 160)
    const done = setTimeout(onDone, 4000)
    return () => {
      clearInterval(phraseInterval)
      clearInterval(nodeInterval)
      clearTimeout(done)
    }
  }, [onDone])

  // Pre-computed node positions to avoid hydration issues
  const NODES = [
    { x: 50, y: 50, r: 5, color: '#5cf28e' },
    { x: 28, y: 35, r: 3.5, color: '#5cc6f2' },
    { x: 72, y: 32, r: 3.5, color: '#f2c65c' },
    { x: 75, y: 62, r: 3.5, color: '#c65cf2' },
    { x: 32, y: 68, r: 3.5, color: '#f2705c' },
    { x: 50, y: 18, r: 2.5, color: '#5cf28e' },
    { x: 82, y: 46, r: 2.5, color: '#5cc6f2' },
    { x: 18, y: 50, r: 2.5, color: '#f2c65c' },
    { x: 62, y: 78, r: 2.5, color: '#c65cf2' },
    { x: 38, y: 20, r: 2, color: '#5cf28e' },
    { x: 80, y: 28, r: 2, color: '#5cc6f2' },
    { x: 85, y: 72, r: 2, color: '#f2705c' },
    { x: 20, y: 72, r: 2, color: '#c65cf2' },
    { x: 50, y: 82, r: 2, color: '#5cf28e' },
    { x: 62, y: 14, r: 1.5, color: '#5cc6f2' },
    { x: 14, y: 28, r: 1.5, color: '#f2c65c' },
    { x: 88, y: 55, r: 1.5, color: '#5cf28e' },
    { x: 35, y: 85, r: 1.5, color: '#c65cf2' },
  ]

  const CONNECTIONS = [[0,1],[0,2],[0,3],[0,4],[1,5],[2,6],[3,7],[4,8],[1,9],[2,10],[3,11],[4,12],[3,13],[2,14],[1,15],[3,16],[4,17]]

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col items-center justify-center">
      <div className="relative w-64 h-64 mb-8">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {CONNECTIONS.map(([a, b], i) => {
            const na = NODES[a]
            const nb = NODES[b]
            const show = i < nodeCount - 1
            return show ? (
              <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                stroke="rgba(92,242,142,0.15)" strokeWidth="0.5"
                style={{ animation: `fadeIn 0.4s ease both` }}
              />
            ) : null
          })}
          {NODES.map((n, i) => i < nodeCount ? (
            <g key={i} style={{ animation: 'nodePop 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              <circle cx={n.x} cy={n.y} r={n.r * 2.5} fill="none"
                stroke={n.color} strokeWidth="0.5" opacity="0.25"
                style={{ animation: `ringOut 1.5s ease-out ${i * 0.06}s infinite` }}
              />
              <circle cx={n.x} cy={n.y} r={n.r}
                fill={n.color} opacity="0.9"
                style={{ filter: `drop-shadow(0 0 4px ${n.color})` }}
              />
            </g>
          ) : null)}
        </svg>
        <style>{`
          @keyframes nodePop { 0%{opacity:0;transform:scale(0)} 60%{transform:scale(1.3)} 100%{opacity:1;transform:scale(1)} }
          @keyframes ringOut { 0%{transform:scale(1);opacity:0.4} 100%{transform:scale(3);opacity:0} }
          @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        `}</style>
      </div>
      <p
        key={phraseIndex}
        className="text-[#5cf28e]/80 text-sm font-light tracking-[0.2em] uppercase"
        style={{ animation: 'fadeIn 0.5s ease both' }}
      >
        {PHRASES[phraseIndex]}
      </p>
    </div>
  )
}
