-- Phase 2: Enable RLS on all 19 Dream tables
-- Executed: 2026-03-11
-- Effect: anon/authenticated roles get zero direct table access (fail-closed by default)
-- App: UNCHANGED — Prisma (postgres role) and service_role bypass RLS entirely
-- Rollback: run phase2_rollback_rls.sql if needed

ALTER TABLE workshops                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_participants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_scratchpads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_shares            ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_event_outbox      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_points                ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_point_annotations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_point_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentic_analyses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_workshop_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_chunks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_segments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_syntheses       ENABLE ROW LEVEL SECURITY;
