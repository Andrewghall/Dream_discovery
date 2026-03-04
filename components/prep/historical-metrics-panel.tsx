'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDomainPack, type MetricReference } from '@/lib/domain-packs/registry';
import { parseCsvString, type ParsedCsv } from '@/lib/historical-metrics/parse-csv';
import { analyzeMetricTrends, type MetricTrend } from '@/lib/historical-metrics/summarize';
import type { HistoricalMetricsData, PeriodGranularity } from '@/lib/historical-metrics/types';
import { PERIOD_GRANULARITIES } from '@/lib/historical-metrics/types';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

type Props = {
  workshopId: string;
  domainPack: string;
  existingMetrics: HistoricalMetricsData | null;
  onMetricsUpdated: (metrics: HistoricalMetricsData) => void;
};

type UploadStep = 'idle' | 'parsed' | 'mapped' | 'validating' | 'validated' | 'uploading' | 'done' | 'error';

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function TrendIcon({ trend }: { trend: MetricTrend['trend'] }) {
  switch (trend) {
    case 'increasing':
      return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
    case 'decreasing':
      return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
    case 'stable':
      return <Minus className="h-3.5 w-3.5 text-gray-500" />;
    default:
      return <span className="text-[10px] text-muted-foreground">--</span>;
  }
}

function formatValue(value: number, unit: string): string {
  if (unit === '%') return `${value}%`;
  if (unit === 'seconds') return `${value}s`;
  if (unit === 'score') return `${value}`;
  if (unit === 'count' && value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (unit === 'days') return `${value}d`;
  return `${value}`;
}

// ══════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════

export default function HistoricalMetricsPanel({
  workshopId,
  domainPack,
  existingMetrics,
  onMetricsUpdated,
}: Props) {
  const hasData = !!existingMetrics && existingMetrics.series.length > 0;
  const [collapsed, setCollapsed] = useState(hasData);

  // Domain pack metric references
  const metricRefs = useMemo<MetricReference[]>(() => {
    const pack = getDomainPack(domainPack);
    return pack?.metricReferences ?? [];
  }, [domainPack]);

  // Trends for existing data
  const trends = useMemo<MetricTrend[]>(() => {
    if (!existingMetrics) return [];
    return analyzeMetricTrends(existingMetrics);
  }, [existingMetrics]);

  // ── Upload state ──────────────────────────────────────
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState('');
  const [granularity, setGranularity] = useState<PeriodGranularity>('monthly');
  const [periodColumn, setPeriodColumn] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState('');
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);

  // ── File handler ──────────────────────────────────────
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCsvString(text);

      if (parsed.errors.length > 0 && parsed.rows.length === 0) {
        setUploadError(`CSV parse failed: ${parsed.errors[0].message}`);
        setUploadStep('error');
        return;
      }

      setParsedCsv(parsed);

      // Auto-detect period column (look for common names)
      const periodCandidates = ['period', 'date', 'month', 'quarter', 'year', 'week', 'time'];
      const detected = parsed.headers.find((h) =>
        periodCandidates.some((c) => h.toLowerCase().includes(c)),
      );
      if (detected) setPeriodColumn(detected);

      // Auto-map columns to metrics by matching header names to metric keys/labels
      const autoMap: Record<string, string> = {};
      for (const header of parsed.headers) {
        if (header === detected) continue; // skip period column
        const match = metricRefs.find(
          (ref) =>
            ref.key.toLowerCase() === header.toLowerCase() ||
            ref.label.toLowerCase() === header.toLowerCase(),
        );
        if (match) {
          autoMap[header] = match.key;
        }
      }
      setColumnMapping(autoMap);

      setUploadStep('parsed');
    };
    reader.readAsText(file);

    // Reset file input
    e.target.value = '';
  }, [metricRefs]);

  // ── Column mapping handler ────────────────────────────
  const handleColumnMap = useCallback((csvHeader: string, metricKey: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (metricKey === '__skip__') {
        delete next[csvHeader];
      } else {
        next[csvHeader] = metricKey;
      }
      return next;
    });
  }, []);

  // ── Validate ──────────────────────────────────────────
  const handleValidate = useCallback(async () => {
    if (!parsedCsv || !periodColumn) return;
    setUploadStep('validating');
    setUploadError('');

    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/metrics/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          granularity,
          columnMapping,
          rows: parsedCsv.rows,
          periodColumn,
          filename: fileName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Validation failed');
        setUploadStep('error');
        return;
      }

      setValidationResult(data.validation);
      setUploadStep('validated');
    } catch {
      setUploadError('Network error during validation');
      setUploadStep('error');
    }
  }, [parsedCsv, periodColumn, workshopId, granularity, columnMapping, fileName]);

  // ── Upload ────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!parsedCsv || !periodColumn) return;
    setUploadStep('uploading');
    setUploadError('');

    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          granularity,
          columnMapping,
          rows: parsedCsv.rows,
          periodColumn,
          filename: fileName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Upload failed');
        setUploadStep('error');
        return;
      }

      // Refresh metrics data
      const metricsRes = await fetch(`/api/admin/workshops/${workshopId}/metrics`);
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        if (metricsData.historicalMetrics) {
          onMetricsUpdated(metricsData.historicalMetrics);
        }
      }

      setUploadStep('done');
      // Reset after short delay
      setTimeout(() => {
        setUploadStep('idle');
        setParsedCsv(null);
        setFileName('');
        setValidationResult(null);
        setColumnMapping({});
        setPeriodColumn('');
      }, 2000);
    } catch {
      setUploadError('Network error during upload');
      setUploadStep('error');
    }
  }, [parsedCsv, periodColumn, workshopId, granularity, columnMapping, fileName, onMetricsUpdated]);

  // ── Delete source ─────────────────────────────────────
  const handleDeleteSource = useCallback(async (sourceId: string) => {
    setDeletingSourceId(sourceId);
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/metrics/${sourceId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        // Refresh metrics data
        const metricsRes = await fetch(`/api/admin/workshops/${workshopId}/metrics`);
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          onMetricsUpdated(metricsData.historicalMetrics ?? null);
        }
      }
    } catch {
      // fail silently
    }
    setDeletingSourceId(null);
  }, [workshopId, onMetricsUpdated]);

  // ── Reset upload ──────────────────────────────────────
  const resetUpload = useCallback(() => {
    setUploadStep('idle');
    setParsedCsv(null);
    setFileName('');
    setValidationResult(null);
    setUploadError('');
    setColumnMapping({});
    setPeriodColumn('');
  }, []);

  // Data columns (non-period)
  const dataColumns = useMemo(() => {
    if (!parsedCsv) return [];
    return parsedCsv.headers.filter((h) => h !== periodColumn);
  }, [parsedCsv, periodColumn]);

  const mappedCount = Object.keys(columnMapping).length;
  const canValidate = parsedCsv && periodColumn && mappedCount > 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-semibold">Historical Metrics</h2>
          {hasData && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
          {hasData && (
            <span className="text-xs text-muted-foreground">
              {existingMetrics!.series.length} metrics, {existingMetrics!.sources.length} source{existingMetrics!.sources.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-6 pb-6 space-y-5">
          {/* Available metrics from domain pack */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Available Metrics ({metricRefs.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {metricRefs.map((ref) => {
                const hasSeries = existingMetrics?.series.some((s) => s.metricKey === ref.key);
                return (
                  <span
                    key={ref.key}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${
                      hasSeries
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : 'bg-muted/30 text-muted-foreground'
                    }`}
                    title={ref.description}
                  >
                    {hasSeries && <CheckCircle2 className="h-3 w-3" />}
                    {ref.label} ({ref.unit})
                  </span>
                );
              })}
            </div>
          </div>

          {/* Existing data -- trend summary */}
          {trends.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Current Trends
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {trends.map((t) => (
                  <div
                    key={t.metricKey}
                    className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <TrendIcon trend={t.trend} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{t.metricLabel}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatValue(t.latestValue, t.unit)}
                        {t.changePercent !== null && (
                          <span className={t.changePercent > 0 ? 'text-emerald-600' : t.changePercent < 0 ? 'text-red-500' : ''}>
                            {' '}({t.changePercent > 0 ? '+' : ''}{t.changePercent.toFixed(1)}%)
                          </span>
                        )}
                        {' -- '}{t.dataPointCount} data point{t.dataPointCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing sources */}
          {existingMetrics && existingMetrics.sources.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Upload Sources
              </h3>
              <div className="space-y-1.5">
                {existingMetrics.sources.map((src) => (
                  <div
                    key={src.id}
                    className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-1.5"
                  >
                    <div>
                      <p className="text-xs font-medium">{src.filename}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(src.uploadedAt)} -- {src.rowCount} rows -- {src.granularity}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteSource(src.id)}
                      disabled={deletingSourceId === src.id}
                      className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                      title="Remove source"
                    >
                      {deletingSourceId === src.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Upload Section ────────────────────────────── */}
          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Upload CSV Data
            </h3>

            {uploadStep === 'idle' && (
              <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 p-6 cursor-pointer hover:border-muted-foreground/50 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Drop a CSV file here or click to browse
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  Columns should include a period/date column and one or more metric columns
                </span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            )}

            {uploadStep === 'done' && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm text-emerald-800">Upload successful</span>
              </div>
            )}

            {uploadStep === 'error' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-800">{uploadError}</span>
                </div>
                <Button onClick={resetUpload} variant="outline" size="sm">
                  Try Again
                </Button>
              </div>
            )}

            {/* Step: Parsed -- show column mapping */}
            {(uploadStep === 'parsed' || uploadStep === 'mapped') && parsedCsv && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {parsedCsv.headers.length} columns, {parsedCsv.rows.length} rows
                    </p>
                  </div>
                  <Button onClick={resetUpload} variant="ghost" size="sm">
                    Cancel
                  </Button>
                </div>

                {/* Granularity */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    Period granularity:
                  </label>
                  <Select value={granularity} onValueChange={(v) => setGranularity(v as PeriodGranularity)}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_GRANULARITIES.map((g) => (
                        <SelectItem key={g} value={g} className="text-xs">
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Period column */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    Period column:
                  </label>
                  <Select value={periodColumn} onValueChange={setPeriodColumn}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="Select period column" />
                    </SelectTrigger>
                    <SelectContent>
                      {parsedCsv.headers.map((h) => (
                        <SelectItem key={h} value={h} className="text-xs">
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Column mappings */}
                {periodColumn && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Map data columns to metrics:
                    </p>
                    <div className="space-y-2">
                      {dataColumns.map((header) => (
                        <div key={header} className="flex items-center gap-3">
                          <span className="text-xs font-mono bg-muted/50 px-2 py-1 rounded min-w-[120px] truncate">
                            {header}
                          </span>
                          <span className="text-xs text-muted-foreground">&#8594;</span>
                          <Select
                            value={columnMapping[header] ?? '__skip__'}
                            onValueChange={(v) => handleColumnMap(header, v)}
                          >
                            <SelectTrigger className="w-[200px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__skip__" className="text-xs text-muted-foreground">
                                Skip column
                              </SelectItem>
                              {metricRefs.map((ref) => (
                                <SelectItem key={ref.key} value={ref.key} className="text-xs">
                                  {ref.label} ({ref.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validate button */}
                <Button
                  onClick={handleValidate}
                  disabled={!canValidate}
                  size="sm"
                  className="w-full"
                >
                  Validate ({mappedCount} metric{mappedCount !== 1 ? 's' : ''} mapped)
                </Button>
              </div>
            )}

            {/* Step: Validating */}
            {uploadStep === 'validating' && (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Validating...</span>
              </div>
            )}

            {/* Step: Validated -- show summary */}
            {uploadStep === 'validated' && validationResult && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-semibold">Validation Summary</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Rows:</span>{' '}
                      <span className="font-medium">{validationResult.summary?.validRows ?? 0}/{validationResult.summary?.totalRows ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Metrics:</span>{' '}
                      <span className="font-medium">{validationResult.summary?.metricsFound?.length ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Skipped:</span>{' '}
                      <span className="font-medium">{validationResult.summary?.skippedRows ?? 0}</span>
                    </div>
                  </div>

                  {validationResult.errors?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold text-red-600 mb-1">
                        Errors ({validationResult.errors.length})
                      </p>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {validationResult.errors.slice(0, 5).map((err: any, i: number) => (
                          <p key={i} className="text-[10px] text-red-600">
                            Row {err.row}: {err.message}
                          </p>
                        ))}
                        {validationResult.errors.length > 5 && (
                          <p className="text-[10px] text-red-500">
                            +{validationResult.errors.length - 5} more errors
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {validationResult.warnings?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold text-amber-600 mb-1">
                        Warnings ({validationResult.warnings.length})
                      </p>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {validationResult.warnings.slice(0, 3).map((warn: any, i: number) => (
                          <p key={i} className="text-[10px] text-amber-600">
                            Row {warn.row}: {warn.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleUpload} size="sm" className="flex-1">
                    Upload Data
                  </Button>
                  <Button onClick={resetUpload} variant="outline" size="sm">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Uploading */}
            {uploadStep === 'uploading' && (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Uploading...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
