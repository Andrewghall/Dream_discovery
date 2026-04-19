-- Passage linkage metadata for DataPoints
-- Enables grouping of sibling units extracted from the same resolved passage,
-- and recovery of reasoning structure (context / observation / implication / example / correction).

ALTER TABLE data_points
  ADD COLUMN IF NOT EXISTS source_window_id TEXT,
  ADD COLUMN IF NOT EXISTS sequence_index INTEGER,
  ADD COLUMN IF NOT EXISTS related_data_point_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reasoning_role TEXT;

CREATE INDEX IF NOT EXISTS data_points_source_window_id_idx ON data_points(source_window_id);
