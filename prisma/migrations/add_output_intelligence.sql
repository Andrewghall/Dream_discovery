-- Add DREAM Output Intelligence field to workshops table
-- Stores the 5-stage agentic intelligence pipeline output as JSON

ALTER TABLE "workshops" ADD COLUMN IF NOT EXISTS "output_intelligence" JSONB;
