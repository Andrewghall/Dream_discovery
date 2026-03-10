-- Add DREAM Report Summary field to workshops table
-- Stores the GPT-4o synthesised executive summary + solution summary as JSON

ALTER TABLE "workshops" ADD COLUMN IF NOT EXISTS "report_summary" JSONB;
