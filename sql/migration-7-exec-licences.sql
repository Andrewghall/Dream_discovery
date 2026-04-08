-- Migration 7: Executive Portal — exec_licences table + execLicenceId on sessions
-- Run in Supabase SQL editor on pre-live before deploying, then on production after merging to main.

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

-- Add execLicenceId to sessions for exec session tracking
ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "execLicenceId" TEXT;

-- RLS: exec_licences is platform-managed — no public access
ALTER TABLE "exec_licences" ENABLE ROW LEVEL SECURITY;
