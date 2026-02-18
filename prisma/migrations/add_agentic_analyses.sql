-- CreateTable: agentic_analyses
-- Stores AI agent analysis results for each data point

CREATE TABLE IF NOT EXISTS "agentic_analyses" (
    "id" TEXT NOT NULL,
    "dataPointId" TEXT NOT NULL,
    "semanticMeaning" TEXT NOT NULL,
    "speakerIntent" TEXT NOT NULL,
    "temporalFocus" TEXT NOT NULL,
    "sentimentTone" TEXT NOT NULL,
    "domains" JSONB NOT NULL,
    "themes" JSONB NOT NULL,
    "connections" JSONB NOT NULL,
    "overallConfidence" DOUBLE PRECISION NOT NULL,
    "uncertainties" TEXT[],
    "agentModel" TEXT NOT NULL,
    "actors" JSONB,
    "analysisVersion" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentic_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agentic_analyses_dataPointId_key" ON "agentic_analyses"("dataPointId");

-- AddForeignKey
ALTER TABLE "agentic_analyses" ADD CONSTRAINT "agentic_analyses_dataPointId_fkey" FOREIGN KEY ("dataPointId") REFERENCES "data_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
