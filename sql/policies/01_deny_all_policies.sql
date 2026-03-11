-- Phase 2: Explicit deny-all policies for anon + authenticated
-- Executed: 2026-03-11
-- Effect: anon and authenticated roles explicitly denied all access to all 19 Dream tables
-- service_role bypasses RLS entirely — app (Next.js API routes via Prisma + service_role) unaffected
-- Rationale: all data access goes through server-side Next.js routes using service_role key.
--            No direct client-side Supabase table access exists. Policies make intent explicit.

DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'workshops','workshop_participants','workshop_scratchpads',
    'workshop_shares','workshop_event_outbox','conversation_sessions',
    'conversation_messages','conversation_insights','conversation_reports',
    'data_points','data_point_annotations','data_point_classifications',
    'agentic_analyses','live_workshop_snapshots','transcript_chunks',
    'capture_sessions','capture_segments','findings','diagnostic_syntheses'
  ]) LOOP
    EXECUTE format('
      CREATE POLICY anon_deny_all ON %I FOR ALL TO anon USING (false) WITH CHECK (false);
      CREATE POLICY authenticated_deny_direct ON %I FOR ALL TO authenticated USING (false) WITH CHECK (false);
    ', t, t);
  END LOOP;
END $$;
