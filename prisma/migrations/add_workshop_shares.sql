-- Workshop sharing: allows users within the same org to share workshops
CREATE TABLE "workshop_shares" (
  "id"          TEXT NOT NULL,
  "workshopId"  TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "sharedById"  TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "workshop_shares_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workshop_shares_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workshop_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Each user can only be shared a workshop once
CREATE UNIQUE INDEX "workshop_shares_workshopId_userId_key" ON "workshop_shares"("workshopId", "userId");

-- Fast lookup: "which workshops are shared with me?"
CREATE INDEX "workshop_shares_userId_idx" ON "workshop_shares"("userId");
