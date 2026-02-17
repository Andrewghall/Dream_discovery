-- ============================================================
-- Participant Consent Table for GDPR Article 6 Compliance
-- ============================================================
-- Records explicit consent from participants before data processing
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS participant_consents (
  "id" TEXT PRIMARY KEY,
  "participantId" TEXT NOT NULL REFERENCES workshop_participants("id") ON DELETE CASCADE,
  "workshopId" TEXT NOT NULL REFERENCES workshops("id") ON DELETE CASCADE,

  -- Consent details
  "consentVersion" TEXT NOT NULL, -- Version of privacy policy
  "consentText" TEXT NOT NULL, -- Full text shown to participant
  "consentGiven" BOOLEAN NOT NULL,
  "consentTimestamp" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Tracking information (GDPR requires this)
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "language" TEXT DEFAULT 'en',

  -- Withdrawal
  "withdrawnAt" TIMESTAMP WITH TIME ZONE,
  "withdrawalReason" TEXT,

  -- Metadata
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "participant_consents_participant_idx" ON participant_consents("participantId");
CREATE INDEX IF NOT EXISTS "participant_consents_workshop_idx" ON participant_consents("workshopId");
CREATE INDEX IF NOT EXISTS "participant_consents_timestamp_idx" ON participant_consents("consentTimestamp" DESC);

-- Enable RLS
ALTER TABLE participant_consents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see consents from their organization's workshops
CREATE POLICY "Users access own org consents" ON participant_consents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workshops
      WHERE workshops."id" = participant_consents."workshopId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Add comment
COMMENT ON TABLE participant_consents IS 'GDPR Article 6 - Records explicit consent for data processing';
