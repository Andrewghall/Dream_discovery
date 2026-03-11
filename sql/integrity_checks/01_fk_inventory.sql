-- Phase 3: Foreign key constraint inventory
-- Run in Supabase SQL editor (read-only)
SELECT
  tc.table_name         AS child_table,
  kcu.column_name       AS fk_column,
  ccu.table_name        AS parent_table,
  ccu.column_name       AS parent_column,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON rc.unique_constraint_name = ccu.constraint_name
  AND rc.constraint_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'workshops','workshop_participants','workshop_scratchpads',
    'workshop_shares','workshop_event_outbox','conversation_sessions',
    'conversation_messages','conversation_insights','conversation_reports',
    'data_points','data_point_annotations','data_point_classifications',
    'agentic_analyses','live_workshop_snapshots','transcript_chunks',
    'capture_sessions','capture_segments','findings','diagnostic_syntheses'
  )
ORDER BY tc.table_name, kcu.column_name;
-- Baseline result: all 19 tables have FK constraints
-- All cascades verified: workshop delete → all children deleted
-- SET NULL: data_points.transcriptChunkId, findings.captureSessionId (intentional)
-- RESTRICT: workshops.createdById, workshops.organizationId (prevents orphaned workshops)
