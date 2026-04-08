'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { Metadata } from 'next';
import Hero from './_sections/Hero';
import Problem from './_sections/Problem';
import EvidenceModel from './_sections/EvidenceModel';
import CaptureFlow from './_sections/CaptureFlow';
import Validation from './_sections/Validation';
import DecisionFlow from './_sections/DecisionFlow';
import EthentaFlowSection from './_sections/EthentaFlow';
import Screenshots from './_sections/Screenshots';
import Output from './_sections/Output';
import Closing from './_sections/Closing';

const NAV = [
  { id: 'hero',        label: 'Dream' },
  { id: 'problem',     label: 'The Noise' },
  { id: 'evidence',    label: 'The Pause' },
  { id: 'capture',     label: 'Become' },
  { id: 'validation',  label: 'How We Listen' },
  { id: 'decision',    label: 'The Method' },
  { id: 'ethentaflow', label: 'EthentaFlow™' },
  { id: 'screenshots', label: 'In Action' },
  { id: 'output',      label: 'What You Get' },
  { id: 'closing',     label: 'Close' },
];

export default function ExperiencePage() {
  const [active, setActive] = useState('hero');
  const rootRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((id: string) => {
    const root = rootRef.current;
    const el = document.getElementById(id);
    if (!root || !el) return;
    root.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
  }, []);

  const currentIndex = NAV.findIndex((s) => s.id === active);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) scrollTo(NAV[currentIndex - 1].id);
  }, [currentIndex, scrollTo]);

  const goNext = useCallback(() => {
    if (currentIndex < NAV.length - 1) scrollTo(NAV[currentIndex + 1].id);
  }, [currentIndex, scrollTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            setActive(entry.target.id);
          }
        });
      },
      { root, threshold: 0.5 },
    );
    NAV.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <style>{`
        .exp-snap-root {
          height: 100dvh;
          overflow-y: scroll;
          overflow-x: hidden;
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
        }
        .exp-snap-root::-webkit-scrollbar { width: 3px; }
        .exp-snap-root::-webkit-scrollbar-track { background: #0a0a0a; }
        .exp-snap-root::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
        .snap-section {
          scroll-snap-align: start;
          scroll-snap-stop: always;
          min-height: 100dvh;
          overflow: hidden;
          position: relative;
        }
        .snap-animate { animation: snapIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .snap-animate-1 { animation-delay: 0.05s; }
        .snap-animate-2 { animation-delay: 0.15s; }
        .snap-animate-3 { animation-delay: 0.25s; }
        .snap-animate-4 { animation-delay: 0.35s; }
        .snap-animate-5 { animation-delay: 0.45s; }
        @keyframes snapIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .stagger-children > *:nth-child(1) { animation-delay: 0.05s; }
        .stagger-children > *:nth-child(2) { animation-delay: 0.15s; }
        .stagger-children > *:nth-child(3) { animation-delay: 0.25s; }
        .stagger-children > *:nth-child(4) { animation-delay: 0.35s; }
        .stagger-children > *:nth-child(5) { animation-delay: 0.45s; }
      `}</style>

      <div className="relative bg-[#0a0a0a]">
        {/* Ethenta logo — fixed */}
        <div className="fixed top-5 sm:top-7 left-4 sm:left-10 z-50">
          <img
            src="/ethenta-logo.png"
            alt="Ethenta"
            style={{ height: 20, opacity: 0.55, filter: 'invert(1) brightness(0.8)' }}
          />
        </div>

        {/* Exit link back to marketing site */}
        <a
          href="/dream"
          className="fixed top-5 sm:top-6 right-4 sm:right-8 z-50 text-[11px] text-white/30 hover:text-white/60 transition-colors tracking-wide"
        >
          ← ethenta.com
        </a>

        {/* Left sidebar nav */}
        <nav className="fixed left-6 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-3.5">
          {NAV.map((s) => {
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className="group flex items-center gap-3 text-left"
              >
                <div
                  className={`flex-shrink-0 rounded-full transition-all duration-300 ${
                    isActive
                      ? 'w-2 h-2 bg-[#5cf28e] shadow-[0_0_6px_rgba(92,242,142,0.8)]'
                      : 'w-1.5 h-1.5 bg-white/25 group-hover:bg-white/50'
                  }`}
                />
                <span
                  className={`text-[11px] tracking-wide whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? 'text-[#5cf28e] opacity-100 translate-x-0'
                      : 'text-white/40 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0'
                  }`}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom-right: counter + prev/next */}
        <div className="fixed bottom-5 sm:bottom-8 right-4 sm:right-8 z-50 flex items-center gap-4">
          <span className="text-white/25 text-xs tabular-nums">
            {String(currentIndex + 1).padStart(2, '0')}&thinsp;/&thinsp;{String(NAV.length).padStart(2, '0')}
          </span>
          <div className="hidden sm:flex flex-col gap-1.5">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 hover:border-white/25 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={goNext}
              disabled={currentIndex === NAV.length - 1}
              className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 hover:border-white/25 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile slide indicator — replaces sidebar on mobile */}
        <div className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
          {NAV.map((s, i) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`rounded-full transition-all duration-300 ${
                active === s.id ? 'w-4 h-1.5 bg-[#5cf28e]' : 'w-1.5 h-1.5 bg-white/25'
              }`}
            />
          ))}
        </div>

        {/* Snap-scroll container */}
        <div ref={rootRef} className="exp-snap-root">
          <section id="hero"        className="snap-section"><Hero        onNext={() => scrollTo('problem')} /></section>
          <section id="problem"     className="snap-section"><Problem     /></section>
          <section id="evidence"    className="snap-section"><EvidenceModel /></section>
          <section id="capture"     className="snap-section"><CaptureFlow /></section>
          <section id="validation"  className="snap-section"><Validation  /></section>
          <section id="decision"    className="snap-section"><DecisionFlow /></section>
          <section id="ethentaflow" className="snap-section"><EthentaFlowSection /></section>
          <section id="screenshots" className="snap-section"><Screenshots /></section>
          <section id="output"      className="snap-section"><Output      /></section>
          <section id="closing"     className="snap-section"><Closing     /></section>
        </div>
      </div>
    </>
  );
}
