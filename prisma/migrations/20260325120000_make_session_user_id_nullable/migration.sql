-- Make Session.userId nullable to support PLATFORM_ADMIN sessions.
-- PLATFORM_ADMIN is an env-var account with no User table row.
-- Nullable userId lets us store revocable DB sessions for it,
-- and for derived impersonation/support sessions.
--
-- This migration is idempotent: if the column is already nullable
-- (applied via ad-hoc sql/make_session_user_id_nullable.sql) this is a no-op.

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "userId" DROP NOT NULL;
