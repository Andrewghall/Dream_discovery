-- Add isExample and exampleSourceId to workshops
-- isExample = true marks a cross-org demo/reference workshop visible to all authenticated users
-- exampleSourceId tracks which example workshop a fork was made from

ALTER TABLE "workshops" ADD COLUMN IF NOT EXISTS "is_example" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workshops" ADD COLUMN IF NOT EXISTS "example_source_id" TEXT;

CREATE INDEX IF NOT EXISTS "workshops_is_example_idx" ON "workshops"("is_example");
