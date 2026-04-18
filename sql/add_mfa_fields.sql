-- Migration: Add TOTP MFA fields to users table
-- ISO 27001 A.9.4.2 / SOC 2 CC6.1 — Multi-factor authentication for privileged accounts
-- Run in Supabase SQL editor (pre-live, then production after merge to main).

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totp_secret"       TEXT,
  ADD COLUMN IF NOT EXISTS "totp_enabled"      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "totp_verified_at"  TIMESTAMPTZ;

-- Index for quick MFA-required lookups
CREATE INDEX IF NOT EXISTS "users_totp_enabled_idx" ON "users"("totp_enabled") WHERE "totp_enabled" = TRUE;

-- Note: totp_secret is stored encrypted (AES-256-GCM via lib/encryption.ts).
-- The column itself is TEXT because encryption produces a formatted string.
-- Never store a plaintext TOTP secret in this column.
