-- Migration 5: Database-Stored Sessions
-- Allows session revocation and multi-device management

CREATE TABLE IF NOT EXISTS sessions (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "lastActivityAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "revokedAt" TIMESTAMP WITH TIME ZONE,

  CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES users("id") ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON sessions("userId");
CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON sessions("token");
CREATE INDEX IF NOT EXISTS "sessions_expiresAt_idx" ON sessions("expiresAt");
CREATE INDEX IF NOT EXISTS "sessions_userId_expiresAt_idx" ON sessions("userId", "expiresAt");

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own sessions
CREATE POLICY "Users access own sessions" ON sessions
  FOR ALL
  USING ("userId" IN (
    SELECT "id" FROM users WHERE "organizationId" = public.current_user_org_id()
  ));

-- Policy: Platform admins can see all sessions
CREATE POLICY "Platform admins see all sessions" ON sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users."id" = "userId"
      AND users.role = 'PLATFORM_ADMIN'
    )
  );

COMMENT ON TABLE sessions IS 'Database-stored sessions for revocation and multi-device management';
