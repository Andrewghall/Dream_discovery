-- ══════════════════════════════════════════════════════════════════════════════
-- add_thought_window_layer  (idempotent — safe to re-run)
--
-- transcriptChunk = what was spoken  (written immediately, always)
-- thoughtWindow   = accumulation of spoken records for one speaker thread
-- dataPoint       = resolved thought artifact  (written once, after resolution)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Enum for window lifecycle state
DO $$ BEGIN
    CREATE TYPE "ThoughtWindowState" AS ENUM ('OPEN', 'PAUSED', 'RESOLVING', 'RESOLVED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. ThoughtWindow table
CREATE TABLE IF NOT EXISTS "thought_windows" (
    "id"                TEXT NOT NULL,
    "workshopId"        TEXT NOT NULL,
    "speakerId"         TEXT,
    "state"             "ThoughtWindowState" NOT NULL DEFAULT 'OPEN',
    "fullText"          TEXT NOT NULL,
    "openedAtMs"        BIGINT NOT NULL,
    "lastActivityAtMs"  BIGINT NOT NULL,
    "closedAtMs"        BIGINT,
    "pausedAtMs"        BIGINT,
    "spokenRecordCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedText"      TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "thought_windows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "thought_windows_workshopId_idx"
    ON "thought_windows"("workshopId");
CREATE INDEX IF NOT EXISTS "thought_windows_workshopId_speakerId_state_idx"
    ON "thought_windows"("workshopId", "speakerId", "state");
CREATE INDEX IF NOT EXISTS "thought_windows_workshopId_state_idx"
    ON "thought_windows"("workshopId", "state");

DO $$ BEGIN
    ALTER TABLE "thought_windows"
        ADD CONSTRAINT "thought_windows_workshopId_fkey"
        FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Link TranscriptChunk → ThoughtWindow (nullable — set on resolution)
ALTER TABLE "transcript_chunks"
    ADD COLUMN IF NOT EXISTS "thought_window_id" TEXT;

CREATE INDEX IF NOT EXISTS "transcript_chunks_thought_window_id_idx"
    ON "transcript_chunks"("thought_window_id");

DO $$ BEGIN
    ALTER TABLE "transcript_chunks"
        ADD CONSTRAINT "transcript_chunks_thought_window_id_fkey"
        FOREIGN KEY ("thought_window_id") REFERENCES "thought_windows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Extend DataPoint with thought-window lineage fields
ALTER TABLE "data_points"
    ADD COLUMN IF NOT EXISTS "thought_window_id"      TEXT,
    ADD COLUMN IF NOT EXISTS "spoken_record_ids"      TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "start_time_ms"          BIGINT,
    ADD COLUMN IF NOT EXISTS "end_time_ms"            BIGINT,
    ADD COLUMN IF NOT EXISTS "span_ms"                INTEGER,
    ADD COLUMN IF NOT EXISTS "spoken_record_count"    INTEGER DEFAULT 1;

-- Rename the old 1:1 FK column (keep existing data intact)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'data_points' AND column_name = 'transcriptChunkId'
    ) THEN
        ALTER TABLE "data_points" RENAME COLUMN "transcriptChunkId" TO "transcript_chunk_id";
    END IF;
END$$;

-- Add transcript_chunk_id if it doesn't exist yet (handles fresh DBs)
ALTER TABLE "data_points"
    ADD COLUMN IF NOT EXISTS "transcript_chunk_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "data_points_thought_window_id_key"
    ON "data_points"("thought_window_id") WHERE "thought_window_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "data_points_transcript_chunk_id_key"
    ON "data_points"("transcript_chunk_id") WHERE "transcript_chunk_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "data_points_thought_window_id_idx"
    ON "data_points"("thought_window_id");

DO $$ BEGIN
    ALTER TABLE "data_points"
        ADD CONSTRAINT "data_points_thought_window_id_fkey"
        FOREIGN KEY ("thought_window_id") REFERENCES "thought_windows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
