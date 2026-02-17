-- Add solution image URL field to workshop scratchpads
ALTER TABLE "workshop_scratchpads"
ADD COLUMN IF NOT EXISTS "solutionImageUrl" TEXT;

-- Add comment
COMMENT ON COLUMN "workshop_scratchpads"."solutionImageUrl" IS 'URL to uploaded solution overview image from Supabase Storage';
