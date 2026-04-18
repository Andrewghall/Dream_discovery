# Tenant Isolation Architecture — RLS Strategy

**Status**: Architectural decision record (ADR)
**Date**: 2026-04-17
**Owner**: Engineering Lead
**Review date**: 2026-10-17

---

## Decision

Tenant isolation in the DREAM platform is enforced at the **application layer**, not via PostgreSQL Row-Level Security (RLS) on the Prisma connection.

---

## Reason

Prisma connects to Supabase using the **service-role key**, which is a superuser credential that bypasses RLS by design. Setting a `SET LOCAL app.current_org_id` before each query is not reliable in a connection-pooled environment (PgBouncer in transaction mode resets session variables), and Prisma does not natively support per-query RLS context propagation.

Supabase RLS **is** enabled on all tables (see `sql/phase2_enable_rls.sql` and `sql/phase2_enable_rls_additional.sql`) and provides a defence-in-depth backstop for any direct Supabase client connections (e.g. from the dashboard or future mobile clients using the `anon` key). It does **not** apply to server-side Prisma queries.

---

## Application-layer enforcement

Every API route that reads or writes tenant-scoped data **must** enforce isolation via one of:

1. **`validateWorkshopAccess()`** (`lib/middleware/validate-workshop-access.ts`) — checks that the authenticated session's `organizationId` matches the workshop's `organizationId` before any data operation.
2. **Explicit `where: { organizationId: session.organizationId }` clause** on every Prisma query involving tenant data.
3. **PLATFORM_ADMIN explicit block** — platform admin sessions cannot read tenant workshop/participant data without explicit impersonation.

---

## Evidence of application-layer enforcement

- `lib/middleware/validate-workshop-access.ts` — primary middleware
- `app/api/admin/workshops/route.ts` — scoped GET with org filter
- `app/api/admin/workshops/[id]/route.ts` — validateWorkshopAccess on every handler
- `app/api/admin/participants/route.ts` — org-scoped participant queries
- `app/api/admin/users/route.ts` — org-scoped user queries
- `__tests__/integration/tenant-boundary-hardening.test.ts` — regression tests

---

## Residual risk

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Developer adds new route without org scoping | Medium | High | Code review checklist; integration test suite |
| Prisma query missing `where.organizationId` | Low | High | Lint rule candidate; periodic audit |
| RLS disabled on a table inadvertently | Low | High | Migration review; `phase2_enable_rls.sql` checked into source |

**Residual risk accepted by**: [Engineering Lead — name required]
**Date**: 2026-04-17

---

## Verification query (run against production DB to confirm RLS is active)

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables with sensitive data should show `rowsecurity = true`. This provides defence-in-depth for direct DB access outside the application layer.

---

## Future improvement

Evaluate migrating to Supabase's `pgbouncer=false` session-mode connection string, which would allow reliable `SET LOCAL` per-request RLS context. This would provide dual-layer enforcement and is the recommended long-term architecture.
