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

  const colorClass =
    variant === 'ambition'
      ? 'text-emerald-700'
      : variant === 'reality'
        ? 'text-rose-700'
        : 'text-foreground';

  return (
    <div className={cn('flex flex-wrap gap-x-3 gap-y-2', className)}>
      {words.map((w) => {
        const t = w.value / max;
        const fontSize = 12 + clamp(t, 0, 1) * 20;
        const opacity = 0.5 + clamp(t, 0, 1) * 0.5;

        return (
          <span
            key={w.text}
            className={cn('leading-none', colorClass)}
            style={{ fontSize, opacity }}
            title={`${w.text}: ${w.value}`}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}
