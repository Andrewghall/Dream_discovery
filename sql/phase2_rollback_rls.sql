-- Phase 2 ROLLBACK: Disable RLS on all 19 Dream tables
-- Run ONLY if app breaks after phase2_enable_rls.sql
-- Should not be needed — app uses service_role which bypasses RLS

ALTER TABLE workshops                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_participants      DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_scratchpads       DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_shares            DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_event_outbox      DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages      DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights      DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_reports       DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_points                DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_point_annotations     DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_point_classifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic_analyses           DISABLE ROW LEVEL SECURITY;
ALTER TABLE live_workshop_snapshots    DISABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_chunks          DISABLE ROW LEVEL SECURITY;
ALTER TABLE capture_sessions           DISABLE ROW LEVEL SECURITY;
ALTER TABLE capture_segments           DISABLE ROW LEVEL SECURITY;
ALTER TABLE findings                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_syntheses       DISABLE ROW LEVEL SECURITY;
