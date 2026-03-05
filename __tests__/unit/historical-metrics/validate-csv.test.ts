/**
 * Tests for CSV validation and normalization service.
 *
 * Validates that the validateAndNormalize function correctly:
 * - Normalizes valid CSV data into MetricSeries
 * - Reports errors for invalid data
 * - Reports warnings for out-of-range values
 * - Handles edge cases (empty cells, duplicate periods, etc.)
 */

import { describe, it, expect } from 'vitest';
import { validateAndNormalize } from '@/lib/historical-metrics/validate-csv';
import type { MetricReference } from '@/lib/domain-packs/registry';

// -- Test fixtures --

const CONTACT_CENTRE_METRICS: MetricReference[] = [
  { key: 'aht', label: 'Average Handle Time', unit: 'seconds', description: 'Mean duration' },
  { key: 'fcr', label: 'First Contact Resolution', unit: '%', description: 'First contact' },
  { key: 'csat', label: 'Customer Satisfaction', unit: 'score', description: 'Satisfaction' },
  { key: 'call_volume', label: 'Call Volume', unit: 'count', description: 'Call count' },
];

function makeRows(count: number): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const month = String(i + 1).padStart(2, '0');
    rows.push({
      Period: `2024-${month}-01`,
      AHT: String(180 + i * 5),
      FCR: String(72 + i),
      CSAT: String(4.1 + i * 0.05),
    });
  }
  return rows;
}

const DEFAULT_MAPPING: Record<string, string> = {
  AHT: 'aht',
  FCR: 'fcr',
  CSAT: 'csat',
};

describe('validateAndNormalize', () => {
  it('happy path -- 3 metrics, 12 rows', () => {
    const result = validateAndNormalize({
      rows: makeRows(12),
      columnMapping: DEFAULT_MAPPING,
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.valid).toBe(true);
    expect(result.series.length).toBe(3);
    expect(result.series[0].dataPoints.length).toBe(12);
    expect(result.series[1].dataPoints.length).toBe(12);
    expect(result.series[2].dataPoints.length).toBe(12);
    expect(result.summary.totalRows).toBe(12);
    expect(result.summary.validRows).toBe(12);
    expect(result.summary.skippedRows).toBe(0);
    expect(result.summary.metricsFound).toContain('aht');
    expect(result.summary.metricsFound).toContain('fcr');
    expect(result.summary.metricsFound).toContain('csat');
    expect(result.errors.length).toBe(0);
  });

  it('copies metric label and unit from pack references', () => {
    const result = validateAndNormalize({
      rows: makeRows(3),
      columnMapping: DEFAULT_MAPPING,
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    const ahtSeries = result.series.find(s => s.metricKey === 'aht');
    expect(ahtSeries?.metricLabel).toBe('Average Handle Time');
    expect(ahtSeries?.unit).toBe('seconds');
  });

  it('reports error for unknown metric key', () => {
    const result = validateAndNormalize({
      rows: makeRows(3),
      columnMapping: { ...DEFAULT_MAPPING, 'UnknownCol': 'nonexistent_metric' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    // Should still be valid (the known metrics are fine)
    expect(result.valid).toBe(true);
    // Should have an error for the unknown metric
    const unknownError = result.errors.find(e => e.metricKey === 'nonexistent_metric');
    expect(unknownError).toBeTruthy();
    expect(unknownError!.message).toContain('not defined in the domain pack');
  });

  it('reports error for non-numeric value', () => {
    const rows = [
      { Period: '2024-01-01', AHT: '180', FCR: 'not-a-number', CSAT: '4.2' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: DEFAULT_MAPPING,
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    const numError = result.errors.find(e => e.column === 'FCR' && e.row === 1);
    expect(numError).toBeTruthy();
    expect(numError!.message).toContain('not a valid number');
  });

  it('reports warning for percentage out of range (150%)', () => {
    const rows = [
      { Period: '2024-01-01', AHT: '180', FCR: '150', CSAT: '4.2' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: DEFAULT_MAPPING,
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.valid).toBe(true); // Still valid (warnings are non-blocking)
    const rangeWarning = result.warnings.find(
      e => e.metricKey === 'fcr' && e.message.includes('exceeds 100%'),
    );
    expect(rangeWarning).toBeTruthy();
  });

  it('reports warning for negative percentage', () => {
    const rows = [
      { Period: '2024-01-01', AHT: '180', FCR: '-5', CSAT: '4.2' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: DEFAULT_MAPPING,
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    const rangeWarning = result.warnings.find(
      e => e.metricKey === 'fcr' && e.message.includes('negative'),
    );
    expect(rangeWarning).toBeTruthy();
  });

  it('reports warning for empty cell, skips that metric for that row', () => {
    const rows = [
      { Period: '2024-01-01', AHT: '180', FCR: '', CSAT: '4.2' },
      { Period: '2024-02-01', AHT: '185', FCR: '75', CSAT: '4.3' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: DEFAULT_MAPPING,
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.valid).toBe(true);
    const emptyWarning = result.warnings.find(
      e => e.metricKey === 'fcr' && e.row === 1,
    );
    expect(emptyWarning).toBeTruthy();
    expect(emptyWarning!.message).toContain('Empty value');

    // FCR should have only 1 data point (row 2), not 2
    const fcrSeries = result.series.find(s => s.metricKey === 'fcr');
    expect(fcrSeries?.dataPoints.length).toBe(1);
  });

  it('flags duplicate periods for same metric', () => {
    const rows = [
      { Period: '2024-01-01', AHT: '180', FCR: '72' },
      { Period: '2024-01-01', AHT: '185', FCR: '75' }, // Duplicate period
      { Period: '2024-02-01', AHT: '190', FCR: '78' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: { AHT: 'aht', FCR: 'fcr' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.valid).toBe(true);
    expect(result.summary.duplicatePeriods.length).toBeGreaterThan(0);
    // Last-write-wins: AHT for 2024-01-01 should be 185
    const ahtSeries = result.series.find(s => s.metricKey === 'aht');
    const janPoint = ahtSeries?.dataPoints.find(p => p.period === '2024-01-01');
    expect(janPoint?.value).toBe(185);
  });

  it('reports error for invalid date string', () => {
    const rows = [
      { Period: 'not-a-date', AHT: '180', FCR: '72' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: { AHT: 'aht', FCR: 'fcr' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    const dateError = result.errors.find(e => e.column === 'Period');
    expect(dateError).toBeTruthy();
    expect(dateError!.message).toContain('Cannot parse period');
  });

  it('reports error for empty period column', () => {
    const rows = [
      { Period: '', AHT: '180', FCR: '72' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: { AHT: 'aht', FCR: 'fcr' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    const emptyError = result.errors.find(e => e.column === 'Period');
    expect(emptyError).toBeTruthy();
    expect(emptyError!.message).toContain('empty');
  });

  it('returns valid: false when all rows are invalid', () => {
    const rows = [
      { Period: 'garbage1', AHT: 'abc', FCR: 'def' },
      { Period: 'garbage2', AHT: 'xyz', FCR: 'qrs' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: { AHT: 'aht', FCR: 'fcr' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.valid).toBe(false);
    expect(result.series.length).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles mixed valid/invalid rows (partial success)', () => {
    const rows = [
      { Period: '2024-01-01', AHT: '180', FCR: '72' },
      { Period: 'bad-date', AHT: '185', FCR: '75' },
      { Period: '2024-03-01', AHT: '190', FCR: '78' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: { AHT: 'aht', FCR: 'fcr' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.valid).toBe(true);
    expect(result.summary.validRows).toBe(2);
    expect(result.summary.skippedRows).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.series[0].dataPoints.length).toBe(2);
  });

  it('handles quarterly format "Q1 2024"', () => {
    const rows = [
      { Period: 'Q1 2024', AHT: '180' },
      { Period: 'Q2 2024', AHT: '185' },
      { Period: 'Q3 2024', AHT: '190' },
      { Period: 'Q4 2024', AHT: '195' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: { AHT: 'aht' },
      periodColumn: 'Period',
      granularity: 'quarterly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.valid).toBe(true);
    expect(result.series[0].dataPoints.length).toBe(4);
    expect(result.series[0].dataPoints[0].period).toBe('2024-01-01');
    expect(result.series[0].dataPoints[1].period).toBe('2024-04-01');
    expect(result.series[0].dataPoints[2].period).toBe('2024-07-01');
    expect(result.series[0].dataPoints[3].period).toBe('2024-10-01');
  });

  it('strips commas from numeric values', () => {
    const rows = [
      { Period: '2024-01-01', Calls: '12,500' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: { Calls: 'call_volume' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.valid).toBe(true);
    expect(result.series[0].dataPoints[0].value).toBe(12500);
  });

  it('strips currency symbols from values', () => {
    const rows = [
      { Period: '2024-01-01', AHT: '$180' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: { AHT: 'aht' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.valid).toBe(true);
    expect(result.series[0].dataPoints[0].value).toBe(180);
  });

  it('reports metricsMissing for pack metrics not in the upload', () => {
    const rows = [{ Period: '2024-01-01', AHT: '180' }];

    const result = validateAndNormalize({
      rows,
      columnMapping: { AHT: 'aht' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.summary.metricsFound).toEqual(['aht']);
    expect(result.summary.metricsMissing).toContain('fcr');
    expect(result.summary.metricsMissing).toContain('csat');
    expect(result.summary.metricsMissing).toContain('call_volume');
  });

  it('returns valid: false when all column mappings are invalid', () => {
    const rows = [{ Period: '2024-01-01', X: '180' }];

    const result = validateAndNormalize({
      rows,
      columnMapping: { X: 'nonexistent' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.valid).toBe(false);
    expect(result.series.length).toBe(0);
  });

  it('sorts data points by period ascending', () => {
    const rows = [
      { Period: '2024-03-01', AHT: '190' },
      { Period: '2024-01-01', AHT: '180' },
      { Period: '2024-02-01', AHT: '185' },
    ];

    const result = validateAndNormalize({
      rows,
      columnMapping: { AHT: 'aht' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    expect(result.valid).toBe(true);
    const points = result.series[0].dataPoints;
    expect(points[0].period).toBe('2024-01-01');
    expect(points[1].period).toBe('2024-02-01');
    expect(points[2].period).toBe('2024-03-01');
  });

  it('warns for negative count values', () => {
    const rows = [{ Period: '2024-01-01', Calls: '-100' }];

    const result = validateAndNormalize({
      rows,
      columnMapping: { Calls: 'call_volume' },
      periodColumn: 'Period',
      granularity: 'monthly',
      metricReferences: CONTACT_CENTRE_METRICS,
    });

    const warning = result.warnings.find(w => w.metricKey === 'call_volume');
    expect(warning).toBeTruthy();
    expect(warning!.message).toContain('negative');
  });
});
