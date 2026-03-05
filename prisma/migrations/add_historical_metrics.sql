-- Add historical_metrics column to workshops table
-- Stores normalized metric time series from CSV uploads (HistoricalMetricsData JSON)
-- NULL for workshops without uploaded historical data
ALTER TABLE "workshops" ADD COLUMN IF NOT EXISTS "historical_metrics" JSONB;
