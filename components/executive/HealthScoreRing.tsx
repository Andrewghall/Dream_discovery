'use client';

import { useEffect, useState } from 'react';

interface HealthScoreRingProps {
  score: number; // 0–100
  label?: string;
}

export function HealthScoreRing({ score, label = 'Discovery Confidence' }: HealthScoreRingProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayed(score);
    }, 200);
    return () => clearTimeout(timer);
  }, [score]);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayed / 100) * circumference;

  const color = score >= 70 ? '#5cf28e' : score >= 45 ? '#f2c65c' : '#f2955c';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg width="144" height="144" className="rotate-[-90deg]">
          {/* Track */}
          <circle cx="72" cy="72" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          {/* Progress */}
          <circle
            cx="72" cy="72" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)', filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{displayed}</span>
          <span className="text-[10px] text-white/30 mt-0.5">/ 100</span>
        </div>
      </div>
      <p className="text-[11px] text-white/35 tracking-wide uppercase">{label}</p>
    </div>
  );
}
