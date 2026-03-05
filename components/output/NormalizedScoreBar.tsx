'use client';

import { SampleSizeIndicator } from './SampleSizeIndicator';

/**
 * NormalizedScoreBar
 *
 * Generic normalized bar visualization used across output sections.
 * Displays a label, a filled bar, a score, and an optional n= indicator.
 */

interface NormalizedScoreBarProps {
  label: string;
  /** Score between 0 and 1 (or -1 to 1 for sentiment) */
  score: number;
  /** Maximum value for the bar (default 1) */
  max?: number;
  /** Minimum value for the bar (default 0) */
  min?: number;
  /** Color class for the fill (e.g., 'bg-emerald-400') */
  fillColor?: string;
  /** Optional secondary fill color for dual-bar display */
  secondaryFillColor?: string;
  /** Optional secondary score for dual-bar display */
  secondaryScore?: number;
  /** Optional sample size to display */
  sampleSize?: number;
  /** Optional suffix after the score (e.g., '%', '/100') */
  suffix?: string;
  /** Optional tag/label shown at the end */
  tag?: string;
  /** Tag color class */
  tagColor?: string;
}

export function NormalizedScoreBar({
  label,
  score,
  max = 1,
  min = 0,
  fillColor = 'bg-blue-400',
  secondaryFillColor,
  secondaryScore,
  sampleSize,
  suffix = '',
  tag,
  tagColor = 'bg-slate-50 text-slate-600',
}: NormalizedScoreBarProps) {
  const range = max - min || 1;
  const percentage = Math.max(0, Math.min(100, ((score - min) / range) * 100));
  const secondaryPercentage = secondaryScore != null
    ? Math.max(0, Math.min(100, ((secondaryScore - min) / range) * 100))
    : 0;

  const displayScore = typeof score === 'number'
    ? (Number.isInteger(score) ? score : score.toFixed(2))
    : score;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-medium">
            {displayScore}{suffix}
          </span>
          {sampleSize != null && <SampleSizeIndicator count={sampleSize} />}
          {tag && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tagColor}`}>
              {tag}
            </span>
          )}
        </div>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
        <div
          className={`h-full ${fillColor} rounded-l transition-all`}
          style={{ width: `${percentage}%` }}
        />
        {secondaryFillColor && secondaryScore != null && (
          <div
            className={`h-full ${secondaryFillColor} rounded-r transition-all`}
            style={{ width: `${secondaryPercentage}%` }}
          />
        )}
      </div>
    </div>
  );
}
