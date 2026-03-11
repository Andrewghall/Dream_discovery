-- Phase 0: Workshops table columns inventory
-- Run in Supabase SQL editor (read-only)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'workshops'
ORDER BY ordinal_position;
-- Baseline result: 35 columns, all 10 runtime-critical columns present, no schema drift
