/**
 * Metrics Summarization -- trend analysis and prompt-ready summaries
 *
 * Pure functions that take HistoricalMetricsData and produce:
 *   1. Structured MetricTrend[] for agent tool responses
 *   2. Text summaries for LLM prompt injection
 *
 * Used by both prep agents (question grounding) and live agents
 * (contradiction detection, evidence-based facilitation).
 *
 * Trend direction is raw (increasing/decreasing/stable) rather than
 * interpreted (improving/declining). Agents have domain knowledge to
 * determine whether "increasing AHT" is good or bad.
 */

import type { HistoricalMetricsData, MetricSeries } from './types';

// ============================================================
// Metric Trend
// ============================================================

export interface MetricTrend {
  metricKey: string;
  metricLabel: string;
  unit: string;
  latestValue: number;
  latestPeriod: string;
  previousValue: number | null;
  trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
  /** Percentage change from previous to latest. Null if insufficient data. */
  changePercent: number | null;
  dataPointCount: number;
}

// ============================================================
// Constants
// ============================================================

/** Percentage threshold for considering a change as "stable" */
const STABLE_THRESHOLD_PERCENT = 2;

// ============================================================
// Trend Analysis
// ============================================================

/**
 * Compute a trend for a single metric series.
 */
function analyzeSingleSeries(series: MetricSeries): MetricTrend {
  const { metricKey, metricLabel, unit, dataPoints } = series;
  const count = dataPoints.length;

  if (count < 2) {
    return {
      metricKey,
      metricLabel,
      unit,
      latestValue: count === 1 ? dataPoints[0].value : 0,
      latestPeriod: count === 1 ? dataPoints[0].period : '',
      previousValue: null,
      trend: 'insufficient_data',
      changePercent: null,
      dataPointCount: count,
    };
  }

  // Data points should already be sorted by period ascending
  const latest = dataPoints[count - 1];
  const previous = dataPoints[count - 2];

  let changePercent: number | null = null;
  let trend: MetricTrend['trend'] = 'stable';

  if (previous.value !== 0) {
    changePercent = ((latest.value - previous.value) / Math.abs(previous.value)) * 100;

    if (changePercent > STABLE_THRESHOLD_PERCENT) {
      trend = 'increasing';
    } else if (changePercent < -STABLE_THRESHOLD_PERCENT) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }
  } else if (latest.value > 0) {
    // Previous was 0, latest is positive
    trend = 'increasing';
    changePercent = null; // Division by zero
  } else if (latest.value < 0) {
    trend = 'decreasing';
    changePercent = null;
  }

  return {
    metricKey,
    metricLabel,
    unit,
    latestValue: latest.value,
    latestPeriod: latest.period,
    previousValue: previous.value,
    trend,
    changePercent: changePercent !== null ? Math.round(changePercent * 10) / 10 : null,
    dataPointCount: count,
  };
}

/**
 * Compute trend analysis for all metric series in the historical data.
 */
export function analyzeMetricTrends(data: HistoricalMetricsData): MetricTrend[] {
  return data.series.map(analyzeSingleSeries);
}

// ============================================================
// Summary Builder
// ============================================================

/**
 * Format a value with its unit for display.
 */
function formatValue(value: number, unit: string): string {
  switch (unit) {
    case '%':
      return `${value}%`;
    case 'seconds':
      return `${value}s`;
    case 'score':
      return `${value}`;
    case 'count':
      return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`;
    case 'currency':
      return value >= 1000000
        ? `${(value / 1000000).toFixed(1)}M`
        : value >= 1000
          ? `${(value / 1000).toFixed(1)}k`
          : `${value}`;
    case 'days':
      return `${value} days`;
    case 'hours':
      return `${value} hours`;
    default:
      return `${value} ${unit}`;
  }
}

/**
 * Format a period string for display (YYYY-MM-DD to "Jan 2025" etc.).
 */
function formatPeriod(period: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = period.split('-');
  if (parts.length >= 2) {
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${months[monthIdx]} ${parts[0]}`;
    }
  }
  return period;
}

/**
 * Build a human-readable text summary of historical metrics
 * suitable for injection into LLM prompts.
 */
export function buildMetricsSummary(data: HistoricalMetricsData): string {
  const trends = analyzeMetricTrends(data);

  if (trends.length === 0) {
    return 'No historical metric series available.';
  }

  // Determine max data points across all series for the header
  const maxPoints = Math.max(...trends.map(t => t.dataPointCount));
  const granularity = data.sources.length > 0 ? data.sources[0].granularity : 'unknown';

  const lines = trends.map((t) => {
    const val = formatValue(t.latestValue, t.unit);
    const period = formatPeriod(t.latestPeriod);

    if (t.trend === 'insufficient_data') {
      return `  - ${t.metricLabel}: ${val} (${period}), single data point only`;
    }

    const changeStr = t.changePercent !== null
      ? `, ${t.trend} ${t.changePercent > 0 ? '+' : ''}${t.changePercent.toFixed(1)}% vs prior period`
      : `, ${t.trend}`;

    return `  - ${t.metricLabel}: latest ${val} (${period})${changeStr}`;
  });

  return [
    `HISTORICAL PERFORMANCE DATA (${data.domainPack}, ${granularity}, up to ${maxPoints} data points):`,
    ...lines,
    'Use these baselines to ground questions. Probe gaps between historical trends and aspirational outcomes.',
  ].join('\n');
}
