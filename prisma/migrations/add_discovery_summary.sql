-- Add cached discovery summary column to Workshop
ALTER TABLE "Workshop" ADD COLUMN IF NOT EXISTS "discovery_summary" JSONB;
