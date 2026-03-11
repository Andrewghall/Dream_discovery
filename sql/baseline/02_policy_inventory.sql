-- Phase 0: Policy inventory for all Dream tables
-- Run in Supabase SQL editor (read-only)
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'workshops',
    'workshop_participants',
    'conversation_sessions',
    'conversation_messages',
    'conversation_insights',
    'conversation_reports',
    'data_points',
    'data_point_annotations',
    'data_point_classifications',
    'agentic_analyses',
    'live_workshop_snapshots',
    'transcript_chunks',
    'workshop_event_outbox',
    'workshop_scratchpads',
    'workshop_shares',
    'capture_sessions',
    'capture_segments',
    'findings',
    'diagnostic_syntheses'
  )
ORDER BY tablename, policyname;
-- Baseline result: 0 rows
-- Expected post-remediation: full policy coverage per table
