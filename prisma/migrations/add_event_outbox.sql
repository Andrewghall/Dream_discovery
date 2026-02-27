-- CreateTable: workshop_event_outbox
-- Durable event outbox for cross-isolate delivery on Vercel serverless.
-- Events from after() callbacks are persisted here and polled by the frontend.

CREATE TABLE IF NOT EXISTS "workshop_event_outbox" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workshop_event_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workshop_event_outbox_workshopId_createdAt_idx"
  ON "workshop_event_outbox"("workshopId", "createdAt");

CREATE INDEX IF NOT EXISTS "workshop_event_outbox_workshopId_type_createdAt_idx"
  ON "workshop_event_outbox"("workshopId", "type", "createdAt");

ALTER TABLE "workshop_event_outbox"
  ADD CONSTRAINT "workshop_event_outbox_workshopId_fkey"
  FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
