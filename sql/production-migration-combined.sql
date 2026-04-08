-- ============================================================
-- DREAM DISCOVERY — Production Migration (combined)
-- Run once in the production Supabase SQL editor after
-- merging pre-live → main.
-- All statements are idempotent (safe to re-run).
-- ============================================================


-- 1. V2 output column on scratchpad
ALTER TABLE "workshop_scratchpads" ADD COLUMN IF NOT EXISTS v2_output JSONB;


-- 2. Sessions userId nullable (required for PLATFORM_ADMIN)
ALTER TABLE "sessions" ALTER COLUMN "userId" DROP NOT NULL;


-- 3. Evidence synthesis column on workshops
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS evidence_synthesis JSONB;


-- 4. Behavioural interventions column on workshops
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS behavioural_interventions JSONB;


-- 5. Evidence documents table
CREATE TABLE IF NOT EXISTS evidence_documents (
  id                    TEXT         NOT NULL PRIMARY KEY,
  workshop_id           TEXT         NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  original_file_name    TEXT         NOT NULL,
  mime_type             TEXT         NOT NULL,
  file_size_bytes       INTEGER      NOT NULL,
  storage_key           TEXT         NOT NULL,
  status                TEXT         NOT NULL DEFAULT 'uploading',
  error_message         TEXT,
  source_category       TEXT,
  summary               TEXT,
  timeframe_from        TEXT,
  timeframe_to          TEXT,
  findings              JSONB,
  metrics               JSONB,
  excerpts              JSONB,
  signal_direction      TEXT,
  confidence            DOUBLE PRECISION,
  relevant_lenses           JSONB,
  relevant_actors           JSONB,
  relevant_journey_stages   JSONB,
  cross_validation      JSONB,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evidence_documents_workshop_id_idx
  ON evidence_documents (workshop_id);

CREATE INDEX IF NOT EXISTS evidence_documents_workshop_status_idx
  ON evidence_documents (workshop_id, status);

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

ALTER TABLE evidence_documents ENABLE ROW LEVEL SECURITY;

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


-- 6. Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id           TEXT        PRIMARY KEY,
  type         TEXT        NOT NULL,
  visitor_id   TEXT        NOT NULL,
  session_id   TEXT        NOT NULL,
  page_path    TEXT        NOT NULL,
  page_title   TEXT,
  referrer     TEXT,
  device_type  TEXT,
  duration_ms  INTEGER,
  country      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_visitor_id  ON analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_session_id  ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_page_path   ON analytics_events(page_path);


-- 7. Executive Portal — exec_licences table + execLicenceId on sessions
CREATE TABLE IF NOT EXISTS "exec_licences" (
  "id"              TEXT        NOT NULL,
  "organizationId"  TEXT        NOT NULL,
  "email"           TEXT        NOT NULL,
  "hashedPassword"  TEXT        NOT NULL,
  "name"            TEXT        NOT NULL,
  "title"           TEXT,
  "isActive"        BOOLEAN     NOT NULL DEFAULT true,
  "lastLoginAt"     TIMESTAMPTZ,
  "revokedAt"       TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "exec_licences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exec_licences_org_fkey"
    FOREIGN KEY ("organizationId")
    REFERENCES "organizations"("id")
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "exec_licences_email_key"
  ON "exec_licences"("email");

CREATE INDEX IF NOT EXISTS "exec_licences_org_idx"
  ON "exec_licences"("organizationId");

CREATE INDEX IF NOT EXISTS "exec_licences_org_active_idx"
  ON "exec_licences"("organizationId", "isActive");

ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "execLicenceId" TEXT;

ALTER TABLE "exec_licences" ENABLE ROW LEVEL SECURITY;
