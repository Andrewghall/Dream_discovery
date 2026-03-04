/**
 * Tests for metric series merge logic.
 *
 * Validates that mergeMetricSeries correctly:
 * - Adds new metrics to empty series
 * - Combines data points for the same metric
 * - Replaces duplicate periods (last-write-wins)
 * - Handles multiple metrics simultaneously
 */

import { describe, it, expect } from 'vitest';
import { mergeMetricSeries, subtractSeries } from '@/lib/historical-metrics/merge-series';
import type { MetricSeries } from '@/lib/historical-metrics/types';

// -- Helpers --

function makeSeries(
  metricKey: string,
  periods: Array<{ period: string; value: number }>,
): MetricSeries {
  return {
    metricKey,
    metricLabel: metricKey.toUpperCase(),
    unit: 'test',
    dataPoints: periods.map(p => ({ ...p, note: null })),
  };
}

describe('mergeMetricSeries', () => {
  it('merges new metric into empty array', () => {
    const incoming = [
      makeSeries('aht', [
        { period: '2024-01-01', value: 180 },
        { period: '2024-02-01', value: 185 },
      ]),
    ];

    const result = mergeMetricSeries([], incoming);

    expect(result.length).toBe(1);
    expect(result[0].metricKey).toBe('aht');
    expect(result[0].dataPoints.length).toBe(2);
  });

  it('merges same metric with different periods', () => {
    const existing = [
      makeSeries('aht', [
        { period: '2024-01-01', value: 180 },
        { period: '2024-02-01', value: 185 },
      ]),
    ];
    const incoming = [
      makeSeries('aht', [
        { period: '2024-03-01', value: 190 },
        { period: '2024-04-01', value: 195 },
      ]),
    ];

    const result = mergeMetricSeries(existing, incoming);

    expect(result.length).toBe(1);
    expect(result[0].dataPoints.length).toBe(4);
    // Should be sorted by period
    expect(result[0].dataPoints[0].period).toBe('2024-01-01');
    expect(result[0].dataPoints[3].period).toBe('2024-04-01');
  });

  it('replaces overlapping periods (last-write-wins)', () => {
    const existing = [
      makeSeries('aht', [
        { period: '2024-01-01', value: 180 },
        { period: '2024-02-01', value: 185 },
      ]),
    ];
    const incoming = [
      makeSeries('aht', [
        { period: '2024-02-01', value: 999 }, // Override
        { period: '2024-03-01', value: 190 },
      ]),
    ];

    const result = mergeMetricSeries(existing, incoming);

    expect(result.length).toBe(1);
    expect(result[0].dataPoints.length).toBe(3);
    const febPoint = result[0].dataPoints.find(p => p.period === '2024-02-01');
    expect(febPoint?.value).toBe(999); // Incoming wins
  });

  it('merges multiple metrics at once', () => {
    const existing = [
      makeSeries('aht', [{ period: '2024-01-01', value: 180 }]),
    ];
    const incoming = [
      makeSeries('aht', [{ period: '2024-02-01', value: 185 }]),
      makeSeries('fcr', [{ period: '2024-01-01', value: 72 }]),
    ];

    const result = mergeMetricSeries(existing, incoming);

    expect(result.length).toBe(2);
    const aht = result.find(s => s.metricKey === 'aht');
    const fcr = result.find(s => s.metricKey === 'fcr');
    expect(aht?.dataPoints.length).toBe(2);
    expect(fcr?.dataPoints.length).toBe(1);
  });

  it('does not mutate input arrays', () => {
    const existing = [
      makeSeries('aht', [{ period: '2024-01-01', value: 180 }]),
    ];
    const incoming = [
      makeSeries('aht', [{ period: '2024-02-01', value: 185 }]),
    ];

    const existingPointsBefore = existing[0].dataPoints.length;
    mergeMetricSeries(existing, incoming);

    expect(existing[0].dataPoints.length).toBe(existingPointsBefore);
  });

  it('updates label and unit from incoming series', () => {
    const existing: MetricSeries[] = [{
      metricKey: 'aht',
      metricLabel: 'Old Label',
      unit: 'old_unit',
      dataPoints: [{ period: '2024-01-01', value: 180, note: null }],
    }];
    const incoming: MetricSeries[] = [{
      metricKey: 'aht',
      metricLabel: 'New Label',
      unit: 'new_unit',
      dataPoints: [{ period: '2024-02-01', value: 185, note: null }],
    }];

    const result = mergeMetricSeries(existing, incoming);

    expect(result[0].metricLabel).toBe('New Label');
    expect(result[0].unit).toBe('new_unit');
  });
});

describe('subtractSeries', () => {
  it('removes matching data points', () => {
    const existing = [
      makeSeries('aht', [
        { period: '2024-01-01', value: 180 },
        { period: '2024-02-01', value: 185 },
        { period: '2024-03-01', value: 190 },
      ]),
    ];
    const toRemove = [
      makeSeries('aht', [
        { period: '2024-02-01', value: 185 },
      ]),
    ];

    const result = subtractSeries(existing, toRemove);

    expect(result.length).toBe(1);
    expect(result[0].dataPoints.length).toBe(2);
    expect(result[0].dataPoints.map(p => p.period)).toEqual(['2024-01-01', '2024-03-01']);
  });

  it('removes entire series if all points are subtracted', () => {
    const existing = [
      makeSeries('aht', [{ period: '2024-01-01', value: 180 }]),
    ];
    const toRemove = [
      makeSeries('aht', [{ period: '2024-01-01', value: 180 }]),
    ];

    const result = subtractSeries(existing, toRemove);

    expect(result.length).toBe(0);
  });

  it('leaves unrelated metrics untouched', () => {
    const existing = [
      makeSeries('aht', [{ period: '2024-01-01', value: 180 }]),
      makeSeries('fcr', [{ period: '2024-01-01', value: 72 }]),
    ];
    const toRemove = [
      makeSeries('aht', [{ period: '2024-01-01', value: 180 }]),
    ];

    const result = subtractSeries(existing, toRemove);

    expect(result.length).toBe(1);
    expect(result[0].metricKey).toBe('fcr');
  });
});
