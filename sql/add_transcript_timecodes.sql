-- Migration: transcript_chunks timecode integrity
-- Ensures startTimeMs / endTimeMs columns exist as BIGINT,
-- adds the deduplication unique index, and adds performance indexes
-- for time-ordered reads and full-session transcript retrieval.
--
-- Run in: Supabase SQL editor (pre-live then production)
-- Safe to re-run: all statements use IF NOT EXISTS / IF EXISTS guards.

-- 1. Ensure startTimeMs column exists (should already be there, belt-and-braces)
ALTER TABLE transcript_chunks
  ADD COLUMN IF NOT EXISTS "startTimeMs" BIGINT NOT NULL DEFAULT 0;

-- 2. Ensure endTimeMs column exists
ALTER TABLE transcript_chunks
  ADD COLUMN IF NOT EXISTS "endTimeMs" BIGINT NOT NULL DEFAULT 0;

-- 3. Backfill endTimeMs = startTimeMs where it is 0 but startTimeMs has a value
--    (handles rows inserted before endTime was wired up)
UPDATE transcript_chunks
SET "endTimeMs" = "startTimeMs"
WHERE "endTimeMs" = 0 AND "startTimeMs" > 0;

-- 4. Unique index — prevents double-writes of identical chunks
--    (workshopId + startTimeMs + text uniquely identifies a spoken sentence)
CREATE UNIQUE INDEX IF NOT EXISTS transcript_chunks_dedup
  ON transcript_chunks ("workshopId", "startTimeMs", text);

-- 5. Composite index for time-ordered full-transcript reads
--    (used by transcript page + Generate Analysis pipeline)
CREATE INDEX IF NOT EXISTS transcript_chunks_workshop_time
  ON transcript_chunks ("workshopId", "startTimeMs" ASC);

-- 6. Index for speaker + time (used by per-speaker filtering)
CREATE INDEX IF NOT EXISTS transcript_chunks_speaker_time
  ON transcript_chunks ("workshopId", "speakerId", "startTimeMs" ASC);

-- Verify
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'transcript_chunks'
ORDER BY indexname;
