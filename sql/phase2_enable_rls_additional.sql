-- Enable RLS + deny-all policies on tables added after Phase 2 baseline
-- Tables: organizations, users, sessions, login_attempts,
--         password_reset_tokens, audit_logs, discovery_themes, live_session_versions

ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_themes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_versions ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organizations','users','sessions','login_attempts',
    'password_reset_tokens','audit_logs','discovery_themes','live_session_versions'
  ]) LOOP
    EXECUTE format('
      CREATE POLICY anon_deny_all ON %I FOR ALL TO anon USING (false) WITH CHECK (false);
      CREATE POLICY authenticated_deny_direct ON %I FOR ALL TO authenticated USING (false) WITH CHECK (false);
    ', t, t);
  END LOOP;
END $$;
