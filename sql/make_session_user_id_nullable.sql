-- Allow sessions without a corresponding user row (e.g. PLATFORM_ADMIN sessions)
-- PLATFORM_ADMIN is an env-var account with no User table row.
-- Making userId nullable lets us store revocable sessions for it.
ALTER TABLE "sessions" ALTER COLUMN "userId" DROP NOT NULL;
