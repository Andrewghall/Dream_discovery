-- Add blueprint column to workshops table
-- Stores a composed WorkshopBlueprint JSON snapshot (runtime configuration)
-- NULL for existing workshops (runtime falls back to DEFAULT_BLUEPRINT)
ALTER TABLE "workshops" ADD COLUMN "blueprint" JSONB;
