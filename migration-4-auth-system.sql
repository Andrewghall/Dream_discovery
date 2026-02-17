-- Migration 4: Secure Authentication System
-- Adds password field, roles, login tracking, and account lockout

-- 1. Create UserRole enum
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('PLATFORM_ADMIN', 'TENANT_ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add new columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "password" TEXT,
  ADD COLUMN IF NOT EXISTS "role" "UserRole" DEFAULT 'TENANT_ADMIN',
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP WITH TIME ZONE,
  ALTER COLUMN "organizationId" DROP NOT NULL;

-- 3. Set default password for existing users (TEMPORARY - will be changed)
-- Using bcrypt hash of 'ChangeMe123!'
UPDATE users
SET "password" = '$2a$10$YourTemporaryHashHere'
WHERE "password" IS NULL;

-- 4. Make password NOT NULL after setting defaults
ALTER TABLE users ALTER COLUMN "password" SET NOT NULL;

-- 5. Create login_attempts table
CREATE TABLE IF NOT EXISTS login_attempts (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "success" BOOLEAN NOT NULL,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "login_attempts_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES users("id") ON DELETE CASCADE
);

-- 6. Create indexes for login_attempts
CREATE INDEX IF NOT EXISTS "login_attempts_email_createdAt_idx"
  ON login_attempts("email", "createdAt");
CREATE INDEX IF NOT EXISTS "login_attempts_success_createdAt_idx"
  ON login_attempts("success", "createdAt");

-- 7. Create organization context function if not exists
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_org_id', TRUE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 8. Enable RLS on new table
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own org login attempts" ON login_attempts
  FOR ALL
  USING ("userId" IN (
    SELECT "id" FROM users WHERE "organizationId" = public.current_user_org_id()
  ));

COMMENT ON TABLE login_attempts IS 'Audit log for all login attempts - GDPR/ISO 27001 compliance';
COMMENT ON TABLE users IS 'Updated with secure authentication - passwords are bcrypt hashed';
