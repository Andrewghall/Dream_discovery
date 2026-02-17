-- ============================================================
-- Row-Level Security (RLS) Migration for DREAM Discovery
-- ============================================================
-- This script enables multi-tenant security at the database level
-- Run this in your Supabase SQL Editor
-- ============================================================

-- PART 1: Create helper function to get organization from JWT
-- ============================================================

CREATE OR REPLACE FUNCTION auth.current_user_org_id()
RETURNS TEXT AS $$
BEGIN
  -- This will be set by application middleware
  RETURN current_setting('app.current_org_id', TRUE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- PART 2: Enable RLS on all tables
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_point_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_point_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentic_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_workshop_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_scratchpads ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_chunks ENABLE ROW LEVEL SECURITY;


-- PART 3: Create RLS Policies
-- ============================================================

-- Policy: Organizations table
-- Users can only see their own organization
CREATE POLICY "Users access own organization" ON organizations
  FOR ALL
  USING ("id" = auth.current_user_org_id());

-- Policy: Users table
-- Users can only see users in their organization
CREATE POLICY "Users access own org users" ON users
  FOR ALL
  USING ("organizationId" = auth.current_user_org_id());

-- Policy: Workshops table
-- Users can only access workshops in their organization
CREATE POLICY "Users access own org workshops" ON workshops
  FOR ALL
  USING ("organizationId" = auth.current_user_org_id());

-- Policy: Workshop Participants
-- Access through workshop's organization
CREATE POLICY "Users access own org participants" ON workshop_participants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workshops
      WHERE workshops."id" = workshop_participants."workshopId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Conversation Sessions
-- Access through workshop's organization
CREATE POLICY "Users access own org sessions" ON conversation_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workshops
      WHERE workshops."id" = conversation_sessions."workshopId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Conversation Messages
-- Access through session's workshop's organization
CREATE POLICY "Users access own org messages" ON conversation_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM conversation_sessions
      JOIN workshops ON workshops."id" = conversation_sessions."workshopId"
      WHERE conversation_sessions."id" = conversation_messages."sessionId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Conversation Insights
-- Direct organization check
CREATE POLICY "Users access own org insights" ON conversation_insights
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workshops
      WHERE workshops."id" = conversation_insights."workshopId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Conversation Reports
-- Direct organization check
CREATE POLICY "Users access own org reports" ON conversation_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workshops
      WHERE workshops."id" = conversation_reports."workshopId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Data Points
-- Access through workshop's organization
CREATE POLICY "Users access own org data points" ON data_points
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workshops
      WHERE workshops."id" = data_points."workshopId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Data Point Classifications
-- Access through data point's workshop
CREATE POLICY "Users access own org classifications" ON data_point_classifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM data_points
      JOIN workshops ON workshops."id" = data_points."workshopId"
      WHERE data_points."id" = data_point_classifications."dataPointId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Data Point Annotations
-- Access through data point's workshop
CREATE POLICY "Users access own org annotations" ON data_point_annotations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM data_points
      JOIN workshops ON workshops."id" = data_points."workshopId"
      WHERE data_points."id" = data_point_annotations."dataPointId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Agentic Analyses
-- Access through data point's workshop
CREATE POLICY "Users access own org analyses" ON agentic_analyses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM data_points
      JOIN workshops ON workshops."id" = data_points."workshopId"
      WHERE data_points."id" = agentic_analyses."dataPointId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Discovery Themes
-- Access through workshop's organization
CREATE POLICY "Users access own org themes" ON discovery_themes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workshops
      WHERE workshops."id" = discovery_themes."workshopId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Live Workshop Snapshots
-- Access through workshop's organization
CREATE POLICY "Users access own org snapshots" ON live_workshop_snapshots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workshops
      WHERE workshops."id" = live_workshop_snapshots."workshopId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Workshop Scratchpads
-- Access through workshop's organization
CREATE POLICY "Users access own org scratchpads" ON workshop_scratchpads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workshops
      WHERE workshops."id" = workshop_scratchpads."workshopId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );

-- Policy: Transcript Chunks
-- Access through workshop's organization
CREATE POLICY "Users access own org transcripts" ON transcript_chunks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workshops
      WHERE workshops."id" = transcript_chunks."workshopId"
      AND workshops."organizationId" = auth.current_user_org_id()
    )
  );


-- PART 4: Create bypass role for service accounts (optional)
-- ============================================================
-- This allows application service accounts to bypass RLS
-- Only use this for trusted background jobs

-- Create a role that can bypass RLS (for server-side operations)
-- COMMENTED OUT - only enable if you need service account access
-- ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
-- GRANT USAGE ON SCHEMA public TO service_role;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these to verify RLS is working correctly

-- 1. Check RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. List all RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Test organizational isolation (set org ID and query)
-- This would be done by your application middleware
-- SET LOCAL app.current_org_id = 'your-org-id-here';
-- SELECT * FROM workshops;


-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- DANGER: This disables all RLS protections
-- Only use in development if you need to rollback

/*
DROP POLICY IF EXISTS "Users access own organization" ON organizations;
DROP POLICY IF EXISTS "Users access own org users" ON users;
DROP POLICY IF EXISTS "Users access own org workshops" ON workshops;
DROP POLICY IF EXISTS "Users access own org participants" ON workshop_participants;
DROP POLICY IF EXISTS "Users access own org sessions" ON conversation_sessions;
DROP POLICY IF EXISTS "Users access own org messages" ON conversation_messages;
DROP POLICY IF EXISTS "Users access own org insights" ON conversation_insights;
DROP POLICY IF EXISTS "Users access own org reports" ON conversation_reports;
DROP POLICY IF EXISTS "Users access own org data points" ON data_points;
DROP POLICY IF EXISTS "Users access own org classifications" ON data_point_classifications;
DROP POLICY IF EXISTS "Users access own org annotations" ON data_point_annotations;
DROP POLICY IF EXISTS "Users access own org analyses" ON agentic_analyses;
DROP POLICY IF EXISTS "Users access own org themes" ON discovery_themes;
DROP POLICY IF EXISTS "Users access own org snapshots" ON live_workshop_snapshots;
DROP POLICY IF EXISTS "Users access own org scratchpads" ON workshop_scratchpads;
DROP POLICY IF EXISTS "Users access own org transcripts" ON transcript_chunks;

ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshops DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_points DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_point_classifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_point_annotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentic_analyses DISABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_themes DISABLE ROW LEVEL SECURITY;
ALTER TABLE live_workshop_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_scratchpads DISABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_chunks DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS auth.current_user_org_id();
*/
