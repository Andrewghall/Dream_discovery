'use client';

/**
 * SampleSizeIndicator
 *
 * Tiny n=X badge used throughout the output dashboard
 * to show the sample size behind every metric.
 */

interface SampleSizeIndicatorProps {
  count: number;
  className?: string;
}

export function SampleSizeIndicator({ count, className }: SampleSizeIndicatorProps) {
  return (
    <span
      className={`inline-flex items-center text-[10px] text-slate-400 font-medium ${className || ''}`}
      title={`Based on ${count} data point${count !== 1 ? 's' : ''}`}
    >
      (n={count})
    </span>
  );
}
