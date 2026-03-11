# RLS Policy Matrix — Phase 2

**Date:** 2026-03-11
**Supabase Project:** `sgftpkzycfbkgidmhbis` (pre-live)

---

## Summary

38 policies across 19 tables. All Dream tables have RLS enabled with explicit deny-all
policies for `anon` and `authenticated` roles. `service_role` and `postgres` (Prisma)
bypass RLS entirely — app functionality is unaffected.

| Metric | Value |
|--------|-------|
| Tables with RLS enabled | 19 / 19 |
| Total policies | 38 |
| Policies per table | 2 (`anon_deny_all`, `authenticated_deny_direct`) |
| Roles with explicit deny | `anon`, `authenticated` |
| Roles bypassing RLS | `service_role`, `postgres` |

---

## Policy Model

**Why deny-all rather than org-scoped?**

All DREAM data access flows through Next.js API routes using the `SUPABASE_SERVICE_ROLE_KEY`.
No client-side Supabase queries exist (confirmed in baseline — only `lib/storage.ts` uses
the anon key, and only for Supabase Storage, not tables). Therefore:

- `service_role` handles all legitimate data access → bypasses RLS → unaffected
- `anon` has no legitimate use case for direct table access → explicit deny
- `authenticated` has no legitimate use case for direct table access → explicit deny

If direct client-side table access is ever added in future, org-scoped policies should
replace `authenticated_deny_direct` with predicates like:
```sql
USING (auth.jwt() -> 'user_metadata' ->> 'organizationId' = "organizationId")
```

---

## Policy Coverage by Table

| Table | anon_deny_all | authenticated_deny_direct | RLS |
|-------|:---:|:---:|:---:|
| agentic_analyses | ✅ | ✅ | ✅ |
| capture_segments | ✅ | ✅ | ✅ |
| capture_sessions | ✅ | ✅ | ✅ |
| conversation_insights | ✅ | ✅ | ✅ |
| conversation_messages | ✅ | ✅ | ✅ |
| conversation_reports | ✅ | ✅ | ✅ |
| conversation_sessions | ✅ | ✅ | ✅ |
| data_point_annotations | ✅ | ✅ | ✅ |
| data_point_classifications | ✅ | ✅ | ✅ |
| data_points | ✅ | ✅ | ✅ |
| diagnostic_syntheses | ✅ | ✅ | ✅ |
| findings | ✅ | ✅ | ✅ |
| live_workshop_snapshots | ✅ | ✅ | ✅ |
| transcript_chunks | ✅ | ✅ | ✅ |
| workshop_event_outbox | ✅ | ✅ | ✅ |
| workshop_participants | ✅ | ✅ | ✅ |
| workshop_scratchpads | ✅ | ✅ | ✅ |
| workshop_shares | ✅ | ✅ | ✅ |
| workshops | ✅ | ✅ | ✅ |

---

## Phase 2 Exit Criteria

| Criteria | Status |
|---------|--------|
| RLS true for all 19 tables | ✅ |
| Policy count non-zero for all 19 tables | ✅ 38 policies total |
| No broad permissive policies | ✅ All policies are deny-all |
| No cross-org reads possible | ✅ Zero access for anon/authenticated |
| service_role and backend paths operational | ✅ Bypass RLS by design |
