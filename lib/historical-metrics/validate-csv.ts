/**
 * CSV Validation and Normalization Service
 *
 * Takes parsed CSV rows + column mapping + domain pack metricReferences
 * and produces either normalized MetricSeries[] or structured errors.
 *
 * This is the core business logic for historical data ingestion.
 * Pack-agnostic: works for any domain pack that defines metricReferences.
 */

import type { MetricReference } from '@/lib/domain-packs/registry';
import type { MetricSeries, MetricDataPoint, PeriodGranularity } from './types';
import { normalizePeriodString } from './normalize-period';

// ============================================================
// Validation Error Types
// ============================================================

export interface RowValidationError {
  /** 1-indexed row number from the CSV */
  row: number;
  /** CSV column header name */
  column: string;
  /** Metric key if resolved, null if the error is about the period column */
  metricKey: string | null;
  /** Human-readable error description */
  message: string;
  /** Error severity */
  severity: 'error' | 'warning';
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  metricsFound: string[];
  metricsMissing: string[];
  duplicatePeriods: Array<{ metricKey: string; period: string }>;
}

export interface ValidationResult {
  /** True if at least some data was successfully normalized (partial success allowed) */
  valid: boolean;
  /** Normalized metric series (empty if all rows failed) */
  series: MetricSeries[];
  /** Hard errors that prevented data extraction */
  errors: RowValidationError[];
  /** Soft warnings (data was still extracted where possible) */
  warnings: RowValidationError[];
  /** Summary statistics */
  summary: ValidationSummary;
}

// ============================================================
// Value parsing helpers
// ============================================================

/**
 * Parse a string cell value into a number.
 * Strips commas, whitespace, currency symbols, and percentage signs.
 * Returns null if not a valid finite number.
 */
function parseNumericValue(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  // Strip common formatting: commas, currency, percentage, spaces
  const cleaned = raw
    .trim()
    .replace(/[,\s]/g, '')
    .replace(/^[£$€]/, '')
    .replace(/%$/, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return isFinite(num) ? num : null;
}

/**
 * Check if a numeric value is within expected range for the given unit.
 * Returns a warning message if out of expected range, null if ok.
 */
function rangeCheck(value: number, unit: string): string | null {
  if (unit === '%') {
    if (value < 0) return `Percentage value ${value} is negative`;
    if (value > 100) return `Percentage value ${value} exceeds 100%`;
  }
  if (unit === 'count' && value < 0) {
    return `Count value ${value} is negative`;
  }
  if (unit === 'score' && value < 0) {
    return `Score value ${value} is negative`;
  }
  if (unit === 'seconds' && value < 0) {
    return `Duration value ${value} is negative`;
  }
  return null;
}

// ============================================================
// Main validation function
// ============================================================

export function validateAndNormalize(opts: {
  rows: Record<string, string>[];
  columnMapping: Record<string, string>;
  periodColumn: string;
  granularity: PeriodGranularity;
  metricReferences: MetricReference[];
}): ValidationResult {
  const { rows, columnMapping, periodColumn, granularity, metricReferences } = opts;

  const errors: RowValidationError[] = [];
  const warnings: RowValidationError[] = [];

  // Build a lookup from metric key to its reference
  const refByKey = new Map<string, MetricReference>();
  for (const ref of metricReferences) {
    refByKey.set(ref.key, ref);
  }

  // Validate column mapping -- all mapped metric keys must exist in the pack
  const validMappings: Array<{ csvColumn: string; metricKey: string; ref: MetricReference }> = [];
  for (const [csvCol, metricKey] of Object.entries(columnMapping)) {
    const ref = refByKey.get(metricKey);
    if (!ref) {
      errors.push({
        row: 0,
        column: csvCol,
        metricKey,
        message: `Metric key "${metricKey}" is not defined in the domain pack. Available keys: ${metricReferences.map(r => r.key).join(', ')}`,
        severity: 'error',
      });
    } else {
      validMappings.push({ csvColumn: csvCol, metricKey, ref });
    }
  }

  // If no valid mappings at all, short-circuit
  if (validMappings.length === 0) {
    return {
      valid: false,
      series: [],
      errors,
      warnings,
      summary: {
        totalRows: rows.length,
        validRows: 0,
        skippedRows: rows.length,
        metricsFound: [],
        metricsMissing: metricReferences.map(r => r.key),
        duplicatePeriods: [],
      },
    };
  }

  // Accumulate data points per metric
  const pointsByMetric = new Map<string, MetricDataPoint[]>();
  for (const { metricKey } of validMappings) {
    pointsByMetric.set(metricKey, []);
  }

  let validRowCount = 0;
  let skippedRowCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1; // 1-indexed

    // Parse the period column
    const periodRaw = row[periodColumn];
    if (!periodRaw || !periodRaw.trim()) {
      errors.push({
        row: rowNum,
        column: periodColumn,
        metricKey: null,
        message: 'Period column is empty',
        severity: 'error',
      });
      skippedRowCount++;
      continue;
    }

    const period = normalizePeriodString(periodRaw, granularity);
    if (!period) {
      errors.push({
        row: rowNum,
        column: periodColumn,
        metricKey: null,
        message: `Cannot parse period "${periodRaw}" for granularity "${granularity}"`,
        severity: 'error',
      });
      skippedRowCount++;
      continue;
    }

    let rowHasAnyValue = false;

    for (const { csvColumn, metricKey, ref } of validMappings) {
      const cellRaw = row[csvColumn];

      // Empty cell -- skip this metric for this row
      if (!cellRaw || !cellRaw.trim()) {
        warnings.push({
          row: rowNum,
          column: csvColumn,
          metricKey,
          message: 'Empty value -- row skipped for this metric',
          severity: 'warning',
        });
        continue;
      }

      const value = parseNumericValue(cellRaw);
      if (value === null) {
        errors.push({
          row: rowNum,
          column: csvColumn,
          metricKey,
          message: `Value "${cellRaw}" is not a valid number`,
          severity: 'error',
        });
        continue;
      }

      // Range check
      const rangeWarning = rangeCheck(value, ref.unit);
      if (rangeWarning) {
        warnings.push({
          row: rowNum,
          column: csvColumn,
          metricKey,
          message: rangeWarning,
          severity: 'warning',
        });
      }

      // Add the data point
      pointsByMetric.get(metricKey)!.push({
        period,
        value,
        note: null,
      });
      rowHasAnyValue = true;
    }

    if (rowHasAnyValue) {
      validRowCount++;
    } else {
      skippedRowCount++;
    }
  }

  // Build series and detect duplicate periods
  const series: MetricSeries[] = [];
  const metricsFound: string[] = [];
  const duplicatePeriods: Array<{ metricKey: string; period: string }> = [];

  for (const { metricKey, ref } of validMappings) {
    const points = pointsByMetric.get(metricKey) ?? [];
    if (points.length === 0) continue;

    // Sort by period
    points.sort((a, b) => a.period.localeCompare(b.period));

    // Detect duplicates (consecutive identical periods after sort)
    const seen = new Set<string>();
    const deduped: MetricDataPoint[] = [];
    for (const pt of points) {
      if (seen.has(pt.period)) {
        duplicatePeriods.push({ metricKey, period: pt.period });
        // Last-write-wins: replace the existing point
        const idx = deduped.findIndex(d => d.period === pt.period);
        if (idx >= 0) {
          deduped[idx] = pt;
        }
      } else {
        seen.add(pt.period);
        deduped.push(pt);
      }
    }

    series.push({
      metricKey,
      metricLabel: ref.label,
      unit: ref.unit,
      dataPoints: deduped,
    });
    metricsFound.push(metricKey);
  }

  // Determine which pack metrics were not found in the upload
  const foundSet = new Set(metricsFound);
  const metricsMissing = metricReferences
    .map(r => r.key)
    .filter(k => !foundSet.has(k));

  const valid = series.length > 0;

  return {
    valid,
    series,
    errors,
    warnings,
    summary: {
      totalRows: rows.length,
      validRows: validRowCount,
      skippedRows: skippedRowCount,
      metricsFound,
      metricsMissing,
      duplicatePeriods,
    },
  };
}
