'use client';

import { cn } from '@/lib/utils';

export interface WordCloudItem {
  text: string;
  value: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function WordCloud({
  words,
  className,
  variant = 'neutral',
}: {
  words: WordCloudItem[];
  className?: string;
  variant?: 'neutral' | 'ambition' | 'reality';
}) {
  const max = Math.max(1, ...words.map((w) => w.value));

  const neutralPalette = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
  ];

  return (
    <div className={cn('word-cloud flex flex-wrap gap-x-3 gap-y-2', className)}>
      {words.map((w, idx) => {
        const t = w.value / max;
        const fontSize = 12 + clamp(t, 0, 1) * 20;
        const opacity = 0.5 + clamp(t, 0, 1) * 0.5;

        const color =
          variant === 'ambition'
            ? 'rgb(4 120 87)'
            : variant === 'reality'
              ? 'rgb(190 18 60)'
              : neutralPalette[idx % neutralPalette.length];

        return (
          <span
            key={w.text}
            className={cn('leading-none')}
            style={{ fontSize, opacity, color }}
            title={`${w.text}: ${w.value}`}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}
