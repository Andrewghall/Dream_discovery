-- ============================================================
-- Transcript Dedup Index
-- Run this SQL directly in your database (Supabase SQL Editor)
-- ============================================================
-- Speeds up the idempotency check in the transcript ingest hot
-- path, which filters by (workshopId, speakerId, startTimeMs).
-- Without this index, the dedup findFirst does a full table scan
-- of transcript_chunks for the workshop.
-- ============================================================

CREATE INDEX IF NOT EXISTS "transcript_chunks_workshopId_speakerId_startTimeMs_idx"
  ON "transcript_chunks"("workshopId", "speakerId", "startTimeMs");

-- Verify:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'transcript_chunks'
-- ORDER BY indexname;
