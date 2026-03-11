-- Phase 0: RLS status for all Dream tables
-- Run in Supabase SQL editor (read-only)
SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND relkind = 'r'
  AND relname IN (
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
ORDER BY relname;
-- Expected post-remediation: ALL rows rls_enabled = true
