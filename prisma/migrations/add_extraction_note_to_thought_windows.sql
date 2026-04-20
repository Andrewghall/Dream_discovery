-- Add extraction_note column to thought_windows
-- Stores discard reasons when the meaning extractor rejects a committed passage.
-- Nullable; NULL means extraction has not run yet or was not recorded.
-- Safe to run on databases that already have the column (IF NOT EXISTS).

ALTER TABLE thought_windows
  ADD COLUMN IF NOT EXISTS extraction_note TEXT;
