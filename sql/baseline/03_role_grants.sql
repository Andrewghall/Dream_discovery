-- Phase 0: Role grants on Dream tables
-- Run in Supabase SQL editor (read-only)
SELECT
  grantee,
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
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
GROUP BY grantee, table_name
ORDER BY table_name, grantee;
-- Baseline result: anon + authenticated have full CRUD on all 19 tables
-- After RLS: grants remain but policies restrict what rows are visible/mutable
