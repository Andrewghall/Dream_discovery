/**
 * Historical Metrics -- barrel re-exports
 */

// Types and schemas
export type {
  PeriodGranularity,
  MetricDataPoint,
  MetricSeries,
  UploadSource,
  HistoricalMetricsData,
  CsvUploadPayload,
} from './types';

export {
  PERIOD_GRANULARITIES,
  MetricDataPointSchema,
  MetricSeriesSchema,
  UploadSourceSchema,
  HistoricalMetricsDataSchema,
  CsvUploadPayloadSchema,
  readHistoricalMetricsFromJson,
} from './types';

// CSV parsing
export type { ParsedCsv } from './parse-csv';
export { parseCsvString } from './parse-csv';

// Period normalization
export { normalizePeriodString } from './normalize-period';

// Validation and normalization
export type {
  RowValidationError,
  ValidationSummary,
  ValidationResult,
} from './validate-csv';
export { validateAndNormalize } from './validate-csv';

// Series merge
export { mergeMetricSeries, subtractSeries } from './merge-series';

// Summarization and trend analysis
export type { MetricTrend } from './summarize';
export { analyzeMetricTrends, buildMetricsSummary } from './summarize';
