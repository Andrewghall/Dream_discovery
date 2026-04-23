-- Add provenance + idempotency metadata to raw_transcript_entries
-- Existing historical rows remain nullable; all new writes should populate these fields.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'RawTranscriptSourcePath'
  ) THEN
    CREATE TYPE "RawTranscriptSourcePath" AS ENUM ('BROWSER', 'CAPTUREAPI_S2S');
  END IF;
END $$;

ALTER TABLE raw_transcript_entries
  ADD COLUMN IF NOT EXISTS source_chunk_id TEXT,
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_path "RawTranscriptSourcePath";

CREATE UNIQUE INDEX IF NOT EXISTS raw_transcript_entries_workshop_source_chunk_uidx
  ON raw_transcript_entries ("workshopId", source_chunk_id);
