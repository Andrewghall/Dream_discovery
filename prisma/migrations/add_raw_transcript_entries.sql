-- Raw Transcript Entries
-- Verbatim Deepgram output, source of truth.
-- Written at receipt time for every isFinal result.
-- Never modified by any downstream processing.

CREATE TABLE IF NOT EXISTS raw_transcript_entries (
  id           TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workshopId" TEXT        NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  "speakerId"  TEXT,
  text         TEXT        NOT NULL,
  "startTimeMs" BIGINT     NOT NULL,
  "endTimeMs"  BIGINT      NOT NULL,
  confidence   DOUBLE PRECISION,
  "speechFinal" BOOLEAN    NOT NULL DEFAULT FALSE,
  sequence     INTEGER     NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS raw_transcript_entries_workshop_idx
  ON raw_transcript_entries ("workshopId");

CREATE INDEX IF NOT EXISTS raw_transcript_entries_workshop_start_idx
  ON raw_transcript_entries ("workshopId", "startTimeMs");

CREATE INDEX IF NOT EXISTS raw_transcript_entries_workshop_speaker_start_idx
  ON raw_transcript_entries ("workshopId", "speakerId", "startTimeMs");
