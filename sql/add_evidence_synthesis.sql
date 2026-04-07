-- Add evidence_synthesis column to workshops table
-- Run in Supabase SQL editor (pre-live and production)

ALTER TABLE workshops ADD COLUMN IF NOT EXISTS evidence_synthesis JSONB;
