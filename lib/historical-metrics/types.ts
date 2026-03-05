/**
 * Historical Metrics -- core types and Zod schemas
 *
 * Defines the data model for historical performance data ingestion.
 * Each domain pack defines metricReferences (key/label/unit/description);
 * this module provides the storage format for actual metric time series
 * uploaded via CSV.
 */

import { z } from 'zod';

// ============================================================
// Period Granularity
// ============================================================

export const PERIOD_GRANULARITIES = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
] as const;

export type PeriodGranularity = (typeof PERIOD_GRANULARITIES)[number];

// ============================================================
// Metric Data Point -- single value in a time series
// ============================================================

export interface MetricDataPoint {
  /** ISO date string representing the start of the period */
  period: string;
  /** Numeric value for this period */
  value: number;
  /** Optional annotation (e.g. "bank holiday week", "system outage") */
  note: string | null;
}

// ============================================================
// Metric Series -- one metric over time
// ============================================================

export interface MetricSeries {
  /** Must match a key in the domain pack's metricReferences */
  metricKey: string;
  /** Display label copied from the pack's MetricReference */
  metricLabel: string;
  /** Unit copied from the pack's MetricReference (seconds, %, score, count, etc.) */
  unit: string;
  /** Time-ordered data points */
  dataPoints: MetricDataPoint[];
}

// ============================================================
// Upload Source -- audit trail for each upload batch
// ============================================================

export interface UploadSource {
  /** Unique identifier for this upload (nanoid) */
  id: string;
  /** Original filename */
  filename: string;
  /** ISO datetime of upload */
  uploadedAt: string;
  /** User ID who performed the upload */
  uploadedBy: string;
  /** Number of rows in the uploaded CSV */
  rowCount: number;
  /** Period granularity selected for this upload */
  granularity: PeriodGranularity;
  /** Mapping from CSV column name to metric key */
  columnMapping: Record<string, string>;
}

// ============================================================
// Historical Metrics Data -- top-level container
// ============================================================

export interface HistoricalMetricsData {
  /** Schema version for forward compatibility */
  version: 1;
  /** Domain pack key at time of upload (e.g. "contact_centre") */
  domainPack: string;
  /** Audit trail of all upload batches */
  sources: UploadSource[];
  /** Normalized, merged metric series */
  series: MetricSeries[];
  /** ISO datetime of last modification */
  lastUpdatedAt: string;
}

// ============================================================
// Zod Schemas
// ============================================================

export const MetricDataPointSchema = z.object({
  period: z.string().min(1),
  value: z.number().finite(),
  note: z.string().nullable(),
});

export const MetricSeriesSchema = z.object({
  metricKey: z.string().min(1),
  metricLabel: z.string().min(1),
  unit: z.string().min(1),
  dataPoints: z.array(MetricDataPointSchema).min(1),
});

export const UploadSourceSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  uploadedAt: z.string().min(1),
  uploadedBy: z.string().min(1),
  rowCount: z.number().int().min(0),
  granularity: z.enum(PERIOD_GRANULARITIES),
  columnMapping: z.record(z.string(), z.string()),
});

export const HistoricalMetricsDataSchema = z.object({
  version: z.literal(1),
  domainPack: z.string().min(1),
  sources: z.array(UploadSourceSchema),
  series: z.array(MetricSeriesSchema),
  lastUpdatedAt: z.string().min(1),
});

// ============================================================
// CSV Upload Payload -- inbound request validation
// ============================================================

export const CsvUploadPayloadSchema = z.object({
  /** Period granularity for this upload */
  granularity: z.enum(PERIOD_GRANULARITIES),
  /** Mapping from CSV column header to metric key */
  columnMapping: z.record(z.string(), z.string()),
  /** Parsed CSV rows as key-value objects (header -> cell value) */
  rows: z.array(z.record(z.string(), z.string())).min(1),
  /** Name of the CSV column containing period/date values */
  periodColumn: z.string().min(1),
  /** Original filename for audit trail */
  filename: z.string().min(1),
});

export type CsvUploadPayload = z.infer<typeof CsvUploadPayloadSchema>;

// ============================================================
// Reader Helper (follows readBlueprintFromJson pattern)
// ============================================================

/**
 * Parse and validate historical metrics JSON from the database.
 * Returns null if absent or invalid. Does not throw.
 */
export function readHistoricalMetricsFromJson(
  json: unknown,
): HistoricalMetricsData | null {
  if (json === null || json === undefined) return null;

  const result = HistoricalMetricsDataSchema.safeParse(json);
  if (!result.success) {
    console.warn(
      '[historical-metrics] Invalid JSON, returning null',
      result.error.issues,
    );
    return null;
  }
  return result.data as HistoricalMetricsData;
}
