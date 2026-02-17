-- Migration 6: Password Reset Tokens
-- Secure token storage for password reset flow

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "usedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES users("id") ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx" ON password_reset_tokens("userId");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_idx" ON password_reset_tokens("token");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expiresAt_idx" ON password_reset_tokens("expiresAt");

COMMENT ON TABLE password_reset_tokens IS 'Secure tokens for password reset with 1-hour expiration';
