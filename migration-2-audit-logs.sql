-- ============================================================
-- Audit Log Table for GDPR/ISO 27001 Compliance
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "userEmail" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "method" TEXT,
  "path" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "success" BOOLEAN DEFAULT TRUE,
  "errorMessage" TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "audit_logs_organization_timestamp_idx" ON audit_logs("organizationId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_user_timestamp_idx" ON audit_logs("userId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON audit_logs("resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON audit_logs("action");
CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON audit_logs("timestamp" DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see audit logs from their organization
DROP POLICY IF EXISTS "Users access own org audit logs" ON audit_logs;
CREATE POLICY "Users access own org audit logs" ON audit_logs
  FOR SELECT
  USING ("organizationId" = public.current_user_org_id());

-- Policy: System can insert audit logs
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE audit_logs IS 'GDPR/ISO 27001 audit trail';
