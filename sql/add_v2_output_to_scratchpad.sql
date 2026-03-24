-- Add v2_output column to WorkshopScratchpad for knowledge-pack-anchored V2 structured output
ALTER TABLE "WorkshopScratchpad" ADD COLUMN IF NOT EXISTS v2_output JSONB;
