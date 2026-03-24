-- Add v2_output column to workshop_scratchpads for knowledge-pack-anchored V2 structured output
-- NOTE: Prisma model is WorkshopScratchpad but actual table name is workshop_scratchpads (@@map)
ALTER TABLE "workshop_scratchpads" ADD COLUMN IF NOT EXISTS v2_output JSONB;
