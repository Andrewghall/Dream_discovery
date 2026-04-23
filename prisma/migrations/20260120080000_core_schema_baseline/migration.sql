-- Core replay baseline for Prisma timestamped migrations.
-- Purpose: create the minimum pre-existing core schema assumed by the
-- current replayable migration chain.
--
-- Intentionally pre-migration state:
-- - workshop_participants WITHOUT doNotSendAgain
-- - workshops WITHOUT is_example / example_source_id
-- - sessions.userId NOT NULL
--
-- This baseline is for migration-chain integrity, not for reconstructing
-- the entire present-day production schema.

-- 1. Enums required by the baseline tables

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'TENANT_USER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkshopType') THEN
    CREATE TYPE "WorkshopType" AS ENUM (
      'STRATEGY',
      'PROCESS',
      'CHANGE',
      'TEAM',
      'CUSTOMER',
      'INNOVATION',
      'CULTURE',
      'CUSTOM',
      'SALES'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkshopStatus') THEN
    CREATE TYPE "WorkshopStatus" AS ENUM (
      'DRAFT',
      'DISCOVERY_SENT',
      'IN_PROGRESS',
      'COMPLETED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttributionPreference') THEN
    CREATE TYPE "AttributionPreference" AS ENUM ('NAMED', 'ANONYMOUS');
  END IF;
END $$;


-- 2. Core auth / tenancy tables

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logoUrl" TEXT,
  "primaryColor" TEXT,
  "secondaryColor" TEXT,
  "maxSeats" INTEGER NOT NULL DEFAULT 5,
  "billingEmail" TEXT,
  "adminName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  "role" "UserRole" NOT NULL DEFAULT 'TENANT_ADMIN',
  "organizationId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_key" UNIQUE ("email"),
  CONSTRAINT "users_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON UPDATE CASCADE ON DELETE SET NULL
);


-- 3. Core workshop table (pre-example-workshop state)

CREATE TABLE IF NOT EXISTS "workshops" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "businessContext" TEXT,
  "workshopType" "WorkshopType" NOT NULL DEFAULT 'CUSTOM',
  "status" "WorkshopStatus" NOT NULL DEFAULT 'DRAFT',
  "zoomMeetingId" TEXT,
  "createdById" TEXT NOT NULL,
  "scheduledDate" TIMESTAMP(3),
  "responseDeadline" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "includeRegulation" BOOLEAN NOT NULL DEFAULT true,
  "meetingPlan" JSONB,
  "salesReport" JSONB,
  "salesActions" JSONB,

  CONSTRAINT "workshops_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workshops_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "workshops_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "workshops_organizationId_idx"
  ON "workshops"("organizationId");

CREATE INDEX IF NOT EXISTS "workshops_organizationId_status_idx"
  ON "workshops"("organizationId", "status");

CREATE INDEX IF NOT EXISTS "workshops_createdAt_idx"
  ON "workshops"("createdAt");


-- 4. Workshop participants (pre-doNotSendAgain state)

CREATE TABLE IF NOT EXISTS "workshop_participants" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "department" TEXT,
  "discoveryToken" TEXT NOT NULL,
  "attributionPreference" "AttributionPreference" NOT NULL DEFAULT 'NAMED',
  "emailSentAt" TIMESTAMP(3),
  "responseStartedAt" TIMESTAMP(3),
  "responseCompletedAt" TIMESTAMP(3),
  "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "workshop_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workshop_participants_discoveryToken_key" UNIQUE ("discoveryToken"),
  CONSTRAINT "workshop_participants_workshopId_fkey"
    FOREIGN KEY ("workshopId") REFERENCES "workshops"("id")
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "workshop_participants_workshopId_idx"
  ON "workshop_participants"("workshopId");

CREATE INDEX IF NOT EXISTS "workshop_participants_email_idx"
  ON "workshop_participants"("email");

CREATE INDEX IF NOT EXISTS "workshop_participants_workshopId_responseCompletedAt_idx"
  ON "workshop_participants"("workshopId", "responseCompletedAt");


-- 5. Sessions (pre-20260325120000 state: userId NOT NULL)

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "execLicenceId" TEXT,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessions_token_key" UNIQUE ("token"),
  CONSTRAINT "sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "sessions_userId_idx"
  ON "sessions"("userId");

CREATE INDEX IF NOT EXISTS "sessions_token_idx"
  ON "sessions"("token");

CREATE INDEX IF NOT EXISTS "sessions_expiresAt_idx"
  ON "sessions"("expiresAt");

CREATE INDEX IF NOT EXISTS "sessions_userId_expiresAt_idx"
  ON "sessions"("userId", "expiresAt");
