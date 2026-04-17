-- Migration: Add consent_records table
-- GDPR Art. 7 requires that consent be demonstrable.
-- This table provides the evidentiary record for all consent decisions.
-- Run in Supabase SQL editor (pre-live, then production after merge to main).

CREATE TYPE IF NOT EXISTS "ConsentPurpose" AS ENUM (
  'WORKSHOP_PARTICIPATION',
  'AUDIO_RECORDING',
  'DATA_RETENTION',
  'MARKETING'
);

CREATE TYPE IF NOT EXISTS "ConsentChannel" AS ENUM (
  'WEB_FORM',
  'CAPTURE_MOBILE',
  'ADMIN_RECORDED'
);

CREATE TABLE IF NOT EXISTS "consent_records" (
  "id"               TEXT        NOT NULL,
  "participant_id"   TEXT,
  "email"            TEXT,
  "workshop_id"      TEXT,
  "purpose"          "ConsentPurpose" NOT NULL,
  "channel"          "ConsentChannel" NOT NULL,
  "consent_text"     TEXT        NOT NULL,
  "consent_version"  TEXT        NOT NULL DEFAULT '1.0',
  "granted"          BOOLEAN     NOT NULL,
  "granted_at"       TIMESTAMPTZ,
  "withdrawn_at"     TIMESTAMPTZ,
  "ip_address"       TEXT,
  "user_agent"       TEXT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "consent_records_participant_fkey"
    FOREIGN KEY ("participant_id")
    REFERENCES "workshop_participants"("id")
    ON DELETE SET NULL,

  CONSTRAINT "consent_records_workshop_fkey"
    FOREIGN KEY ("workshop_id")
    REFERENCES "workshops"("id")
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "consent_records_participant_idx"  ON "consent_records"("participant_id");
CREATE INDEX IF NOT EXISTS "consent_records_workshop_idx"     ON "consent_records"("workshop_id");
CREATE INDEX IF NOT EXISTS "consent_records_email_idx"        ON "consent_records"("email");
CREATE INDEX IF NOT EXISTS "consent_records_purpose_idx"      ON "consent_records"("purpose", "granted");
CREATE INDEX IF NOT EXISTS "consent_records_created_idx"      ON "consent_records"("created_at");

-- Enable RLS (data is tenanted via workshop_id / participant_id)
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_consent_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consent_records_updated_at
  BEFORE UPDATE ON "consent_records"
  FOR EACH ROW EXECUTE FUNCTION update_consent_records_updated_at();
