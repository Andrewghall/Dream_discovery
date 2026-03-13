-- Migration: add is_system flag to organizations
-- Marks platform-owned orgs (e.g. the Jo Air demo org) so they are hidden
-- from the tenant-facing organization admin list.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
