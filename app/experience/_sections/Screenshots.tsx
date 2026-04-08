'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Play, ChevronLeft, ChevronRight } from 'lucide-react'

type ItemType = 'image' | 'video'
// Ordered to spread visually similar images apart
const items: Array<{ id: string; type: ItemType; src: string; thumb: string; label: string; sub: string }> = [
  {
    id: 'demo',
    type: 'image' as const,
    src: '/experience/signal-graph.png',
    thumb: '/experience/signal-graph.png',
    label: 'Live Demo — 360° Hemisphere',
    sub: 'DREAM end-to-end — from signal capture to validated way forward',
  },
  {
    id: 'ss1',
    type: 'image' as const,
    src: '/experience/Screenshot 2026-04-07 at 15.19.59.png',
    thumb: '/experience/Screenshot 2026-04-07 at 15.19.59.png',
    label: 'Dashboard',
    sub: 'Live intelligence — your organisation\'s psyche, always visible',
  },
  {
    id: 'narrative-divergence',
    type: 'image' as const,
    src: '/experience/narrative-divergence.png',
    thumb: '/experience/narrative-divergence.png',
    label: 'Narrative Divergence',
    sub: 'Language and sentiment differences across executive, operational, and frontline layers',
  },
  {
    id: 'ss6',
    type: 'image' as const,
    src: '/experience/Screenshot 2026-04-07 at 15.22.20.png',
    thumb: '/experience/Screenshot 2026-04-07 at 15.22.20.png',
    label: 'Gantt Chart',
    sub: 'Phased delivery, sequenced by dependency and impact',
  },
  {
    id: 'domain-misalignment',
    type: 'image' as const,
    src: '/experience/domain-misalignment.png',
    thumb: '/experience/domain-misalignment.png',
    label: 'Domain Alignment',
    sub: 'Where leadership and operational thinking diverge — made visible',
  },
  {
    id: 'ss7',
    type: 'image' as const,
    src: '/experience/Screenshot 2026-04-07 at 15.23.08.png',
    thumb: '/experience/Screenshot 2026-04-07 at 15.23.08.png',
    label: 'Capture Flow',
    sub: 'Real-time question delivery with live transcription and classification',
  },
  {
    id: 'signal-graph',
    type: 'image' as const,
    src: '/experience/signal-graph.png',
    thumb: '/experience/signal-graph.png',
    label: 'Insight Map',
    sub: '1,041 signals — aspiration, friction, enablers — structurally mapped',
  },
  {
    id: 'ss4',
    type: 'image' as const,
    src: '/experience/Screenshot 2026-04-07 at 15.21.37.png',
    thumb: '/experience/Screenshot 2026-04-07 at 15.21.37.png',
    label: 'Root Cause View',
    sub: 'Constraints and friction mapped to root causes',
  },
  {
    id: 'phased-roadmap',
    type: 'image' as const,
    src: '/experience/phased-roadmap.png',
    thumb: '/experience/phased-roadmap.png',
    label: 'Phased Roadmap',
    sub: '3-phase implementation plan with capabilities, dependencies, and constraints',
  },
  {
    id: 'ss2',
    type: 'image' as const,
    src: '/experience/Screenshot 2026-04-07 at 15.20.59.png',
    thumb: '/experience/Screenshot 2026-04-07 at 15.20.59.png',
    label: 'Signal Analysis',
    sub: 'Evidence-weighted signals surfaced from every source',
  },
  {
    id: 'logic-map',
    type: 'image' as const,
    src: '/experience/logic-map.png',
    thumb: '/experience/logic-map.png',
    label: 'Logic Map',
    sub: 'Constraints, orphans, and valid chains — 22 critical nodes identified',
  },
  {
    id: 'ss3',
    type: 'image' as const,
    src: '/experience/Screenshot 2026-04-07 at 15.21.20.png',
    thumb: '/experience/Screenshot 2026-04-07 at 15.21.20.png',
    label: 'Theme Analysis',
    sub: 'Primary themes extracted and weighted by evidence',
  },
  {
    id: 'ss8',
    type: 'image' as const,
    src: '/experience/Screenshot 2026-04-07 at 15.23.32.png',
    thumb: '/experience/Screenshot 2026-04-07 at 15.23.32.png',
    label: 'Workshop View',
    sub: 'Live workshop interface — capture, classify, synthesise',
  },
  {
    id: 'primary-themes',
    type: 'image' as const,
    src: '/experience/primary-themes.png',
    thumb: '/experience/primary-themes.png',
    label: 'Primary Themes',
    sub: 'Evidence-weighted themes — what the organisation is actually saying',
  },
  {
    id: 'ss5',
    type: 'image' as const,
    src: '/experience/Screenshot 2026-04-07 at 15.22.03.png',
    thumb: '/experience/Screenshot 2026-04-07 at 15.22.03.png',
    label: 'Directive View',
    sub: 'Validated way forward — every action tied to a root cause',
  },
]

type Item = typeof items[number]

const CARD_W = 420
const CARD_H = 280
const GAP = 22
const SPEED = 0.14 // px per ms — auto-scroll speed
const ONE_SET = items.length * (CARD_W + GAP)

export default function Screenshots() {
  const [lightbox, setLightbox] = useState<Item | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const lastTimeRef = useRef<number | null>(null)
  const pausedRef = useRef(false)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // rAF auto-scroll loop
  const tick = useCallback((now: number) => {
    if (!pausedRef.current) {
      const c = containerRef.current
      if (c && lastTimeRef.current !== null) {
        const dt = Math.min(now - lastTimeRef.current, 64) // cap at 64ms to avoid jump after tab switch
        c.scrollLeft += SPEED * dt
        // Seamless wrap: when past one full set, snap back
        if (c.scrollLeft >= ONE_SET) {
          c.scrollLeft -= ONE_SET
        }
      }
      lastTimeRef.current = now
    } else {
      lastTimeRef.current = null
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [tick])

  // Pause on user interaction, resume after 2.5s idle
  const pauseAutoScroll = useCallback(() => {
    pausedRef.current = true
    clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false
    }, 2500)
  }, [])

  // Arrow nav — jump 2 cards
  const nudge = useCallback((dir: 1 | -1) => {
    const c = containerRef.current
    if (!c) return
    pauseAutoScroll()
    c.scrollBy({ left: dir * (CARD_W + GAP) * 2, behavior: 'smooth' })
  }, [pauseAutoScroll])

  // Drag support
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null)

  const onMouseDown = (e: React.MouseEvent) => {
    pauseAutoScroll()
    dragRef.current = { startX: e.clientX, startScroll: containerRef.current?.scrollLeft ?? 0 }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current || !containerRef.current) return
    const dx = e.clientX - dragRef.current.startX
    containerRef.current.scrollLeft = dragRef.current.startScroll - dx
    // seamless wrap during drag
    if (containerRef.current.scrollLeft < 0) containerRef.current.scrollLeft += ONE_SET
    if (containerRef.current.scrollLeft >= ONE_SET) containerRef.current.scrollLeft -= ONE_SET
  }

  const onMouseUp = () => { dragRef.current = null }

  const open = (item: Item) => setLightbox(item)
  const close = () => setLightbox(null)

  // Duplicate items for seamless loop
  const track = [...items, ...items]

  return (
    <div className="relative min-h-[100dvh] flex flex-col bg-[#0d0d0d] overflow-hidden">

      {/* Edge fades */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0d0d0d] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0d0d0d] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-[#0d0d0d] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-[#0d0d0d] to-transparent z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex-shrink-0 z-20 px-5 sm:px-10 lg:px-14 pt-8 sm:pt-12 pb-6 flex items-end justify-between">
        <div>
          <p className="snap-animate snap-animate-1 text-[11px] text-[#5cf28e]/75 tracking-[0.3em] uppercase mb-3">
            The Platform
          </p>
          <h2
            className="snap-animate snap-animate-2 font-black tracking-[-0.04em] text-white"
            style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
          >
            DREAM in action.
          </h2>
          <p className="snap-animate snap-animate-3 text-white/55 text-sm mt-2 font-light">
            Drag or use arrows to explore. Click any card to open.
          </p>
        </div>
        {/* Arrow nav buttons */}
        <div className="snap-animate snap-animate-3 flex gap-3 mb-1 z-30">
          <button
            onClick={() => nudge(-1)}
            className="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:border-white/35 transition-all duration-200 hover:bg-white/5"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => nudge(1)}
            className="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:border-white/35 transition-all duration-200 hover:bg-white/5"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Carousel — native scroll, no scrollbar */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center z-0 select-none"
        style={{
          overflowX: 'scroll',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          cursor: dragRef.current ? 'grabbing' : 'grab',
          paddingLeft: 56,
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={pauseAutoScroll}
        onTouchEnd={() => {
          // resume after touch
          resumeTimerRef.current = setTimeout(() => { pausedRef.current = false }, 2500)
        }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>

        {/* Inner track: duplicated for seamless loop */}
        <div className="flex flex-shrink-0" style={{ gap: GAP }}>
          {track.map((item, i) => (
            <button
              key={`${item.id}-${i}`}
              onClick={() => open(item)}
              className="flex-shrink-0 relative rounded-2xl overflow-hidden border border-white/10 hover:border-[#5cf28e]/55 transition-all duration-300 group bg-[#111111]"
              style={{ width: CARD_W, height: CARD_H }}
              onMouseDown={e => e.stopPropagation()} // let card click through drag
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url('${item.thumb}')` }}
              />
              <div className="absolute inset-0 bg-black/35 group-hover:bg-black/15 transition-colors duration-300" />

              {item.type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-black/55 border border-[#5cf28e]/70 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                    <Play className="w-6 h-6 text-[#5cf28e] ml-0.5" />
                  </div>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-black/85 to-transparent">
                <div className="text-white text-[12px] font-semibold leading-tight">{item.label}</div>
              </div>

              <div className="absolute inset-0 rounded-2xl ring-0 group-hover:ring-1 group-hover:ring-[#5cf28e]/45 transition-all duration-300" />
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-6"
          onClick={close}
        >
          <div
            className="relative w-full max-w-5xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#0d0d0d]"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={close}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl bg-black/70 border border-white/15 flex items-center justify-center hover:bg-black/90 transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>

            <div className="w-full bg-[#111111] flex items-center justify-center" style={{ maxHeight: '75vh' }}>
              {lightbox.type === 'video' ? (
                <video
                  src={lightbox.src}
                  controls
                  autoPlay
                  className="w-full object-contain"
                  style={{ maxHeight: '75vh' }}
                />
              ) : (
                <img
                  src={lightbox.src}
                  alt={lightbox.label}
                  className="w-full object-contain"
                  style={{ maxHeight: '75vh' }}
                />
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/8">
              <div className="text-white font-semibold text-sm">{lightbox.label}</div>
              <div className="text-white/62 text-xs mt-1">{lightbox.sub}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
