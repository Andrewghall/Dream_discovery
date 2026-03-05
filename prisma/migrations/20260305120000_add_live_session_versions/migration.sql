-- CreateTable
CREATE TABLE IF NOT EXISTS "live_session_versions" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "dialoguePhase" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "label" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_session_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_session_versions_workshopId_version_key" ON "live_session_versions"("workshopId", "version");

-- CreateIndex
CREATE INDEX "live_session_versions_workshopId_createdAt_idx" ON "live_session_versions"("workshopId", "createdAt");

-- AddForeignKey
ALTER TABLE "live_session_versions" ADD CONSTRAINT "live_session_versions_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
