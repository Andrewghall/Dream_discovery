-- Hard reset: remove TranscriptChunk table and transcript_chunk_id FK on data_points.
-- Run in Supabase SQL editor AFTER deploying the schema change.

ALTER TABLE data_points DROP COLUMN IF EXISTS transcript_chunk_id;
DROP TABLE IF EXISTS transcript_chunks CASCADE;
