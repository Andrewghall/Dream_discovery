# DB Integrity Baseline — Phase 0

**Date:** 2026-03-11
**Supabase Project:** `sgftpkzycfbkgidmhbis` (pre-live)
**Executed by:** Claude (Phase 0 of DREAM_DATABASE_REMEDIATION_BRIEF)

---

## Summary

Phase 0 baseline complete. Three critical findings confirmed prior to any remediation work.

| Finding | Severity | Status |
|---------|----------|--------|
| RLS disabled on all 19 Dream tables | CRITICAL | Confirmed pre-remediation |
| Zero policies on all 19 Dream tables | CRITICAL | Confirmed pre-remediation |
| `anon` role has full CRUD on all 19 tables | CRITICAL | Confirmed pre-remediation |
| Workshops schema — all 10 runtime-critical columns present | ✅ CLEAR | No schema drift |

---

## 1. RLS Status — All 19 Tables

Query run:
```sql
SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND relkind = 'r'
  AND relname IN (
    'workshops','workshop_participants','conversation_sessions',
    'conversation_messages','conversation_insights','conversation_reports',
    'data_points','data_point_annotations','data_point_classifications',
    'agentic_analyses','live_workshop_snapshots','transcript_chunks',
    'workshop_event_outbox','workshop_scratchpads','workshop_shares',
    'capture_sessions','capture_segments','findings','diagnostic_syntheses'
  )
ORDER BY relname;
```

**Result: ALL 19 tables `rls_enabled = false`**

| Table | RLS Enabled |
|-------|------------|
| agentic_analyses | false |
| capture_segments | false |
| capture_sessions | false |
| conversation_insights | false |
| conversation_messages | false |
| conversation_reports | false |
| conversation_sessions | false |
| data_point_annotations | false |
| data_point_classifications | false |
| data_points | false |
| diagnostic_syntheses | false |
| findings | false |
| live_workshop_snapshots | false |
| transcript_chunks | false |
| workshop_event_outbox | false |
| workshop_participants | false |
| workshop_scratchpads | false |
| workshop_shares | false |
| workshops | false |

---

## 2. Policy Inventory — All 19 Tables

Query run:
```sql
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ( ... all 19 ... )
ORDER BY tablename, policyname;
```

**Result: 0 rows. Zero policies exist on any Dream table.**

---

## 3. Role Grants — All 19 Tables

Query run:
```sql
SELECT grantee, table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ( ... all 19 ... )
GROUP BY grantee, table_name
ORDER BY table_name, grantee;
```

**Result: EVERY table grants full privileges to ALL roles including `anon`**

Every table shows identical grants for all 4 roles:

| Role | Privileges |
|------|-----------|
| `anon` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| `authenticated` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| `postgres` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| `service_role` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |

**Risk:** The `anon` key is present in the browser JavaScript bundle. With RLS off and full CRUD grants to `anon`, the raw Supabase REST API is completely open. Any person with network access who extracts the anon key can read, write, or delete any row from any organisation.

**Mitigating factor (current):** All data mutations in DREAM go through Next.js API routes which enforce server-side authentication. No client-side Supabase queries exist. This prevents accidental exposure through the app itself, but does not protect against direct API access.

---

## 4. Workshops Schema — Columns Inventory

**All 35 columns present. All 10 runtime-critical columns confirmed.**

| Column | Type | Required by Runtime |
|--------|------|-------------------|
| `id` | text NOT NULL | ✅ |
| `organizationId` | text NOT NULL | ✅ |
| `name` | text NOT NULL | ✅ |
| `description` | text nullable | ✅ |
| `businessContext` | text nullable | ✅ |
| `workshopType` | USER-DEFINED NOT NULL | ✅ |
| `status` | USER-DEFINED NOT NULL | ✅ |
| `zoomMeetingId` | text nullable | — |
| `createdById` | text NOT NULL | ✅ |
| `scheduledDate` | timestamp nullable | — |
| `responseDeadline` | timestamp nullable | — |
| `createdAt` | timestamp NOT NULL | ✅ |
| `updatedAt` | timestamp NOT NULL | ✅ |
| `includeRegulation` | boolean NOT NULL (default true) | — |
| `meetingPlan` | jsonb nullable | — |
| `salesReport` | jsonb nullable | — |
| `salesActions` | jsonb nullable | — |
| `client_name` | text nullable | ✅ CRITICAL |
| `industry` | text nullable | ✅ |
| `company_website` | text nullable | ✅ |
| `dream_track` | USER-DEFINED nullable | ✅ CRITICAL |
| `target_domain` | text nullable | ✅ |
| `prep_research` | jsonb nullable | ✅ CRITICAL |
| `custom_questions` | jsonb nullable | — |
| `discovery_briefing` | jsonb nullable | ✅ CRITICAL |
| `discover_analysis` | jsonb nullable | — |
| `engagement_type` | USER-DEFINED nullable | ✅ CRITICAL |
| `domain_pack` | text nullable | ✅ CRITICAL |
| `domain_pack_config` | jsonb nullable | ✅ CRITICAL |
| `discovery_questions` | jsonb nullable | ✅ CRITICAL |
| `blueprint` | jsonb nullable | ✅ CRITICAL |
| `historical_metrics` | jsonb nullable | ✅ CRITICAL |
| `output_intelligence` | jsonb nullable | — |
| `discovery_summary` | jsonb nullable | — |
| `report_summary` | jsonb nullable | — |

**Schema drift status: NONE.** All columns expected by the runtime are present.

**Note on `add_discovery_summary.sql`:** This standalone migration file uses `ALTER TABLE "Workshop"` (capital W) which would fail against the actual `workshops` table (lowercase). However `discovery_summary` is present, indicating Prisma's own migration system created it. The standalone SQL file was never applied and can be ignored.

---

## 5. Known Runtime Failures Mapped

| Error | Root Cause | Phase to Fix |
|-------|-----------|--------------|
| `blueprint` column missing (historical) | Was missing, now present | N/A — resolved |
| Discover-analysis crash on legacy data | Nested arrays `undefined` instead of `[]` in old `discoverAnalysis` JSON | Fixed in app code (not DB) |
| Discovery intelligence 500 errors | `discoverAnalysis.confidence.byDomain.distribution` undefined in legacy data | Fixed in app code |

---

## 6. Phase 0 Exit Criteria

| Criteria | Status |
|---------|--------|
| Backup confirmed | ⏳ PENDING — user must take Supabase backup before Phase 2 |
| Baseline report complete | ✅ This document |

---

## What Happens Next

**Phase 1 (Schema Parity): SKIPPED** — No schema drift found. All 10 runtime-critical columns present.

**Phase 2 (RLS Enablement): NEXT** — Enable RLS on all 19 tables and create org-scoped policies. This is the highest-priority remediation item.

**Pre-condition for Phase 2:** Supabase backup must be taken via the Supabase Dashboard → Project Settings → Database → Backups before any DDL is executed.

---

## Residual Risks Before Remediation

| Risk | Classification |
|------|---------------|
| `anon` full CRUD on all 19 tables with RLS off | CRITICAL |
| Authenticated users can read/write across all orgs | CRITICAL |
| No policy guardrail for `workshop_shares` cross-org boundary | CRITICAL |
| Mixed camelCase/snake_case column naming (cosmetic, not functional) | LOW |
