/**
 * Tests for metrics summarization and trend analysis.
 */

import { describe, it, expect } from 'vitest';
import { analyzeMetricTrends, buildMetricsSummary } from '@/lib/historical-metrics/summarize';
import type { HistoricalMetricsData, MetricSeries } from '@/lib/historical-metrics/types';

// ── Helpers ──────────────────────────────────────────────────

function makeSeries(overrides: Partial<MetricSeries> = {}): MetricSeries {
  return {
    metricKey: 'aht',
    metricLabel: 'Average Handle Time',
    unit: 'seconds',
    dataPoints: [
      { period: '2024-01-01', value: 230 },
      { period: '2024-02-01', value: 245 },
    ],
    ...overrides,
  };
}

function makeData(series: MetricSeries[]): HistoricalMetricsData {
  return {
    version: 1,
    domainPack: 'contact_centre',
    sources: [
      {
        id: 'src-1',
        filename: 'test.csv',
        uploadedAt: '2024-03-01T00:00:00Z',
        uploadedBy: 'user-1',
        rowCount: 12,
        granularity: 'monthly',
        columnMapping: { period: 'Month', aht: 'AHT' },
      },
    ],
    series,
    lastUpdatedAt: '2024-03-01T00:00:00Z',
  };
}

// ── analyzeMetricTrends ──────────────────────────────────────

describe('analyzeMetricTrends', () => {
  it('detects an increasing trend', () => {
    const data = makeData([
      makeSeries({
        metricKey: 'aht',
        metricLabel: 'Average Handle Time',
        unit: 'seconds',
        dataPoints: [
          { period: '2024-01-01', value: 200 },
          { period: '2024-02-01', value: 230 },
        ],
      }),
    ]);

    const trends = analyzeMetricTrends(data);
    expect(trends).toHaveLength(1);
    expect(trends[0].trend).toBe('increasing');
    expect(trends[0].latestValue).toBe(230);
    expect(trends[0].previousValue).toBe(200);
    expect(trends[0].changePercent).toBeGreaterThan(0);
  });

  it('detects a decreasing trend', () => {
    const data = makeData([
      makeSeries({
        metricKey: 'fcr',
        metricLabel: 'First Contact Resolution',
        unit: '%',
        dataPoints: [
          { period: '2024-01-01', value: 78 },
          { period: '2024-02-01', value: 71 },
        ],
      }),
    ]);

    const trends = analyzeMetricTrends(data);
    expect(trends[0].trend).toBe('decreasing');
    expect(trends[0].changePercent).toBeLessThan(0);
  });

  it('detects stable (within 2% threshold)', () => {
    const data = makeData([
      makeSeries({
        dataPoints: [
          { period: '2024-01-01', value: 100 },
          { period: '2024-02-01', value: 101 }, // +1% -- within threshold
        ],
      }),
    ]);

    const trends = analyzeMetricTrends(data);
    expect(trends[0].trend).toBe('stable');
  });

  it('returns insufficient_data for single data point', () => {
    const data = makeData([
      makeSeries({
        dataPoints: [{ period: '2024-01-01', value: 200 }],
      }),
    ]);

    const trends = analyzeMetricTrends(data);
    expect(trends[0].trend).toBe('insufficient_data');
    expect(trends[0].changePercent).toBeNull();
    expect(trends[0].previousValue).toBeNull();
  });

  it('returns insufficient_data for zero data points', () => {
    const data = makeData([
      makeSeries({ dataPoints: [] }),
    ]);

    const trends = analyzeMetricTrends(data);
    expect(trends[0].trend).toBe('insufficient_data');
    expect(trends[0].latestValue).toBe(0);
    expect(trends[0].latestPeriod).toBe('');
  });

  it('handles multiple series', () => {
    const data = makeData([
      makeSeries({ metricKey: 'aht', metricLabel: 'AHT' }),
      makeSeries({ metricKey: 'fcr', metricLabel: 'FCR', unit: '%' }),
    ]);

    const trends = analyzeMetricTrends(data);
    expect(trends).toHaveLength(2);
    expect(trends[0].metricKey).toBe('aht');
    expect(trends[1].metricKey).toBe('fcr');
  });

  it('handles previous value of zero', () => {
    const data = makeData([
      makeSeries({
        dataPoints: [
          { period: '2024-01-01', value: 0 },
          { period: '2024-02-01', value: 10 },
        ],
      }),
    ]);

    const trends = analyzeMetricTrends(data);
    expect(trends[0].trend).toBe('increasing');
    expect(trends[0].changePercent).toBeNull(); // division by zero
  });

  it('rounds changePercent to one decimal place', () => {
    const data = makeData([
      makeSeries({
        dataPoints: [
          { period: '2024-01-01', value: 300 },
          { period: '2024-02-01', value: 333 },
        ],
      }),
    ]);

    const trends = analyzeMetricTrends(data);
    // (333 - 300) / 300 * 100 = 11.0 -- should round cleanly
    expect(trends[0].changePercent).toBe(11);
  });

  it('uses last two data points regardless of series length', () => {
    const data = makeData([
      makeSeries({
        dataPoints: [
          { period: '2024-01-01', value: 100 },
          { period: '2024-02-01', value: 200 },
          { period: '2024-03-01', value: 190 }, // Latest vs previous: 190 vs 200
        ],
      }),
    ]);

    const trends = analyzeMetricTrends(data);
    expect(trends[0].latestValue).toBe(190);
    expect(trends[0].previousValue).toBe(200);
    expect(trends[0].trend).toBe('decreasing');
    expect(trends[0].dataPointCount).toBe(3);
  });
});

// ── buildMetricsSummary ──────────────────────────────────────

describe('buildMetricsSummary', () => {
  it('returns no-data message for empty series', () => {
    const data = makeData([]);
    const summary = buildMetricsSummary(data);
    expect(summary).toBe('No historical metric series available.');
  });

  it('includes domain pack in header', () => {
    const data = makeData([makeSeries()]);
    const summary = buildMetricsSummary(data);
    expect(summary).toContain('contact_centre');
  });

  it('includes metric label and latest value', () => {
    const data = makeData([
      makeSeries({
        metricLabel: 'Average Handle Time',
        unit: 'seconds',
        dataPoints: [
          { period: '2024-01-01', value: 230 },
          { period: '2024-02-01', value: 245 },
        ],
      }),
    ]);
    const summary = buildMetricsSummary(data);
    expect(summary).toContain('Average Handle Time');
    expect(summary).toContain('245s');
    expect(summary).toContain('Feb 2024');
  });

  it('formats percentage values', () => {
    const data = makeData([
      makeSeries({
        metricLabel: 'FCR',
        unit: '%',
        dataPoints: [
          { period: '2024-01-01', value: 78 },
          { period: '2024-02-01', value: 71 },
        ],
      }),
    ]);
    const summary = buildMetricsSummary(data);
    expect(summary).toContain('71%');
  });

  it('formats count values with k suffix', () => {
    const data = makeData([
      makeSeries({
        metricLabel: 'Call Volume',
        unit: 'count',
        dataPoints: [
          { period: '2024-01-01', value: 1200 },
          { period: '2024-02-01', value: 1500 },
        ],
      }),
    ]);
    const summary = buildMetricsSummary(data);
    expect(summary).toContain('1.5k');
  });

  it('includes trend direction and change percent', () => {
    const data = makeData([
      makeSeries({
        dataPoints: [
          { period: '2024-01-01', value: 200 },
          { period: '2024-02-01', value: 230 },
        ],
      }),
    ]);
    const summary = buildMetricsSummary(data);
    expect(summary).toContain('increasing');
    expect(summary).toMatch(/\+\d+\.\d%/);
  });

  it('includes instruction line about baselines', () => {
    const data = makeData([makeSeries()]);
    const summary = buildMetricsSummary(data);
    expect(summary).toContain('Use these baselines');
  });

  it('handles single data point gracefully', () => {
    const data = makeData([
      makeSeries({
        dataPoints: [{ period: '2024-06-01', value: 42 }],
      }),
    ]);
    const summary = buildMetricsSummary(data);
    expect(summary).toContain('single data point');
    expect(summary).toContain('42s');
  });
});
