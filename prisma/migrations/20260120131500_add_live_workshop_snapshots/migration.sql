CREATE TABLE IF NOT EXISTS "live_workshop_snapshots" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dialoguePhase" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "live_workshop_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "live_workshop_snapshots_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "live_workshop_snapshots_workshopId_createdAt_idx" ON "live_workshop_snapshots"("workshopId", "createdAt");
