-- Migration: add_evidence_documents
-- Purpose: Create evidence_documents table for the historical evidence ingestion layer.
--
-- Run this in:
--   1. Pre-live Supabase SQL editor (now)
--   2. Production Supabase SQL editor after merging to main
--
-- Table stores AI-normalised evidence from uploaded files (PDFs, spreadsheets,
-- images, reports, etc.) with cross-validation against workshop discovery.

CREATE TABLE IF NOT EXISTS evidence_documents (
  id                    TEXT         NOT NULL PRIMARY KEY,
  workshop_id           TEXT         NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  original_file_name    TEXT         NOT NULL,
  mime_type             TEXT         NOT NULL,
  file_size_bytes       INTEGER      NOT NULL,
  storage_key           TEXT         NOT NULL,

  -- Processing status
  status                TEXT         NOT NULL DEFAULT 'uploading',
  error_message         TEXT,

  -- AI-interpreted metadata
  source_category       TEXT,
  summary               TEXT,
  timeframe_from        TEXT,
  timeframe_to          TEXT,

  -- Extracted structured content (JSONB arrays)
  findings              JSONB,
  metrics               JSONB,
  excerpts              JSONB,

  -- Signal assessment
  signal_direction      TEXT,
  confidence            DOUBLE PRECISION,

  -- Relevance mapping
  relevant_lenses           JSONB,
  relevant_actors           JSONB,
  relevant_journey_stages   JSONB,

  -- Cross-validation results
  cross_validation      JSONB,

  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS evidence_documents_workshop_id_idx
  ON evidence_documents (workshop_id);

CREATE INDEX IF NOT EXISTS evidence_documents_workshop_status_idx
  ON evidence_documents (workshop_id, status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_evidence_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS evidence_documents_updated_at_trigger ON evidence_documents;
CREATE TRIGGER evidence_documents_updated_at_trigger
  BEFORE UPDATE ON evidence_documents
  FOR EACH ROW EXECUTE FUNCTION update_evidence_documents_updated_at();

-- RLS: only members of the same organisation can see evidence documents
-- (matches existing workshop-level RLS pattern)
ALTER TABLE evidence_documents ENABLE ROW LEVEL SECURITY;

-- Drop and recreate to avoid conflicts on re-run
DROP POLICY IF EXISTS "evidence_documents_workshop_member" ON evidence_documents;
CREATE POLICY "evidence_documents_workshop_member"
  ON evidence_documents
  FOR ALL
  USING (
    workshop_id IN (
      SELECT w.id FROM workshops w
      WHERE w."organizationId" IN (
        SELECT u."organizationId" FROM users u WHERE u.id::text = auth.uid()::text
      )
    )
  );
