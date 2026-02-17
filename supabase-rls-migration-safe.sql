-- ============================================================
-- Row-Level Security (RLS) Migration - SAFE VERSION
-- ============================================================
-- Only enables RLS on tables that exist
-- ============================================================

-- PART 1: Create helper function
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_org_id', TRUE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- PART 2: Enable RLS on tables (only if they exist)
-- ============================================================

DO $$
BEGIN
  -- Enable RLS on each table if it exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organizations') THEN
    ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workshops') THEN
    ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workshop_participants') THEN
    ALTER TABLE workshop_participants ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_sessions') THEN
    ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_messages') THEN
    ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_insights') THEN
    ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_reports') THEN
    ALTER TABLE conversation_reports ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'data_points') THEN
    ALTER TABLE data_points ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'data_point_classifications') THEN
    ALTER TABLE data_point_classifications ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'data_point_annotations') THEN
    ALTER TABLE data_point_annotations ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agentic_analyses') THEN
    ALTER TABLE agentic_analyses ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'discovery_themes') THEN
    ALTER TABLE discovery_themes ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'live_workshop_snapshots') THEN
    ALTER TABLE live_workshop_snapshots ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workshop_scratchpads') THEN
    ALTER TABLE workshop_scratchpads ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transcript_chunks') THEN
    ALTER TABLE transcript_chunks ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;


-- PART 3: Create RLS Policies (with safety checks)
-- ============================================================

-- Drop existing policies if they exist (to allow re-running)
DO $$
BEGIN
  -- Organizations
  DROP POLICY IF EXISTS "Users access own organization" ON organizations;
  CREATE POLICY "Users access own organization" ON organizations
    FOR ALL
    USING ("id" = public.current_user_org_id());

  -- Users
  DROP POLICY IF EXISTS "Users access own org users" ON users;
  CREATE POLICY "Users access own org users" ON users
    FOR ALL
    USING ("organizationId" = public.current_user_org_id());

  -- Workshops
  DROP POLICY IF EXISTS "Users access own org workshops" ON workshops;
  CREATE POLICY "Users access own org workshops" ON workshops
    FOR ALL
    USING ("organizationId" = public.current_user_org_id());

  -- Workshop Participants
  DROP POLICY IF EXISTS "Users access own org participants" ON workshop_participants;
  CREATE POLICY "Users access own org participants" ON workshop_participants
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM workshops
        WHERE workshops."id" = workshop_participants."workshopId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Conversation Sessions
  DROP POLICY IF EXISTS "Users access own org sessions" ON conversation_sessions;
  CREATE POLICY "Users access own org sessions" ON conversation_sessions
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM workshops
        WHERE workshops."id" = conversation_sessions."workshopId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Conversation Messages
  DROP POLICY IF EXISTS "Users access own org messages" ON conversation_messages;
  CREATE POLICY "Users access own org messages" ON conversation_messages
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM conversation_sessions
        JOIN workshops ON workshops."id" = conversation_sessions."workshopId"
        WHERE conversation_sessions."id" = conversation_messages."sessionId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Conversation Insights
  DROP POLICY IF EXISTS "Users access own org insights" ON conversation_insights;
  CREATE POLICY "Users access own org insights" ON conversation_insights
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM workshops
        WHERE workshops."id" = conversation_insights."workshopId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Conversation Reports
  DROP POLICY IF EXISTS "Users access own org reports" ON conversation_reports;
  CREATE POLICY "Users access own org reports" ON conversation_reports
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM workshops
        WHERE workshops."id" = conversation_reports."workshopId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Data Points
  DROP POLICY IF EXISTS "Users access own org data points" ON data_points;
  CREATE POLICY "Users access own org data points" ON data_points
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM workshops
        WHERE workshops."id" = data_points."workshopId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Data Point Classifications
  DROP POLICY IF EXISTS "Users access own org classifications" ON data_point_classifications;
  CREATE POLICY "Users access own org classifications" ON data_point_classifications
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM data_points
        JOIN workshops ON workshops."id" = data_points."workshopId"
        WHERE data_points."id" = data_point_classifications."dataPointId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Data Point Annotations
  DROP POLICY IF EXISTS "Users access own org annotations" ON data_point_annotations;
  CREATE POLICY "Users access own org annotations" ON data_point_annotations
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM data_points
        JOIN workshops ON workshops."id" = data_points."workshopId"
        WHERE data_points."id" = data_point_annotations."dataPointId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Agentic Analyses
  DROP POLICY IF EXISTS "Users access own org analyses" ON agentic_analyses;
  CREATE POLICY "Users access own org analyses" ON agentic_analyses
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM data_points
        JOIN workshops ON workshops."id" = data_points."workshopId"
        WHERE data_points."id" = agentic_analyses."dataPointId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Discovery Themes
  DROP POLICY IF EXISTS "Users access own org themes" ON discovery_themes;
  CREATE POLICY "Users access own org themes" ON discovery_themes
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM workshops
        WHERE workshops."id" = discovery_themes."workshopId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Live Workshop Snapshots
  DROP POLICY IF EXISTS "Users access own org snapshots" ON live_workshop_snapshots;
  CREATE POLICY "Users access own org snapshots" ON live_workshop_snapshots
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM workshops
        WHERE workshops."id" = live_workshop_snapshots."workshopId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Workshop Scratchpads
  DROP POLICY IF EXISTS "Users access own org scratchpads" ON workshop_scratchpads;
  CREATE POLICY "Users access own org scratchpads" ON workshop_scratchpads
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM workshops
        WHERE workshops."id" = workshop_scratchpads."workshopId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

  -- Transcript Chunks
  DROP POLICY IF EXISTS "Users access own org transcripts" ON transcript_chunks;
  CREATE POLICY "Users access own org transcripts" ON transcript_chunks
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM workshops
        WHERE workshops."id" = transcript_chunks."workshopId"
        AND workshops."organizationId" = public.current_user_org_id()
      )
    );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Some policies could not be created. This may be because the table does not exist.';
END $$;


-- ============================================================
-- VERIFICATION
-- ============================================================

-- Show which tables have RLS enabled
SELECT
  tablename,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
