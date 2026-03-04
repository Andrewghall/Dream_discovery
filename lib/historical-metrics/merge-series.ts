/**
 * Metric Series Merge
 *
 * When a workshop already has historicalMetrics and the user uploads
 * additional data, this module merges the new series into the existing ones.
 *
 * Rules:
 *   - Same metric key: combine data points, replacing duplicates (same period)
 *     with the newer value (last-write-wins)
 *   - New metric key: add as a new MetricSeries entry
 *   - Data points sorted by period ascending after merge
 */

import type { MetricSeries, MetricDataPoint } from './types';

/**
 * Merge incoming metric series into existing ones.
 * Returns a new array (does not mutate inputs).
 */
export function mergeMetricSeries(
  existing: MetricSeries[],
  incoming: MetricSeries[],
): MetricSeries[] {
  // Build a map of existing series by metric key (deep clone to avoid mutation)
  const merged = new Map<string, MetricSeries>();

  for (const series of existing) {
    merged.set(series.metricKey, {
      ...series,
      dataPoints: [...series.dataPoints],
    });
  }

  for (const incomingSeries of incoming) {
    const current = merged.get(incomingSeries.metricKey);

    if (!current) {
      // New metric -- add directly
      merged.set(incomingSeries.metricKey, {
        ...incomingSeries,
        dataPoints: [...incomingSeries.dataPoints],
      });
      continue;
    }

    // Existing metric -- merge data points
    const pointMap = new Map<string, MetricDataPoint>();

    // Add existing points first
    for (const pt of current.dataPoints) {
      pointMap.set(pt.period, pt);
    }

    // Incoming points overwrite on duplicate period (last-write-wins)
    for (const pt of incomingSeries.dataPoints) {
      pointMap.set(pt.period, pt);
    }

    // Sort by period ascending
    const mergedPoints = Array.from(pointMap.values())
      .sort((a, b) => a.period.localeCompare(b.period));

    current.dataPoints = mergedPoints;
    // Update label and unit from incoming (in case pack definition changed)
    current.metricLabel = incomingSeries.metricLabel;
    current.unit = incomingSeries.unit;
  }

  return Array.from(merged.values());
}

/**
 * Remove all data points that were contributed by a specific upload source.
 *
 * Since we do not track which source contributed which data point,
 * this function re-validates by rebuilding series from the remaining sources.
 * The caller is responsible for passing the filtered sources and their
 * original validation results.
 *
 * For the simpler case (just clearing a source's data), we accept the
 * series contributed by that source and subtract them.
 */
export function subtractSeries(
  existing: MetricSeries[],
  toRemove: MetricSeries[],
): MetricSeries[] {
  // Build a set of period+key pairs to remove
  const removeSet = new Set<string>();
  for (const series of toRemove) {
    for (const pt of series.dataPoints) {
      removeSet.add(`${series.metricKey}:${pt.period}`);
    }
  }

  const result: MetricSeries[] = [];

  for (const series of existing) {
    const filtered = series.dataPoints.filter(
      (pt) => !removeSet.has(`${series.metricKey}:${pt.period}`),
    );

    if (filtered.length > 0) {
      result.push({
        ...series,
        dataPoints: filtered,
      });
    }
  }

  return result;
}
