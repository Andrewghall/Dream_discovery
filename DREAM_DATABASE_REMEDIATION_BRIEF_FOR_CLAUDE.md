# Database Remediation Brief for Claude

## Scope and Objective
This brief defines the full database remediation program for DREAM in Supabase project `sgftpkzycfbkgidmhbis`.
Goal is production-grade integrity, tenant isolation, schema parity with runtime, and deterministic behavior without silent fallback.

## Non-Negotiable Constraints
- Scope is DREAM only.
- Commit only to `pre-live`.
- Do not remove functionality.
- Do not silently downgrade writes when dynamic fields fail.
- No compliance claim without live DB evidence.
- Every phase must end with proof artifacts.

## Current Confirmed Facts
- Dream tables exist.
- RLS is disabled on all 19 key Dream tables.
- Dream policy count is zero for those tables.
- Schema drift is present, including runtime errors referencing missing `workshops.blueprint`.
- Dynamic runtime behavior has fallen back to static-like behavior in multiple flows.

## Database Tables in Scope
- workshops
- workshop_participants
- conversation_sessions
- conversation_messages
- conversation_insights
- conversation_reports
- data_points
- data_point_annotations
- data_point_classifications
- agentic_analyses
- live_workshop_snapshots
- transcript_chunks
- workshop_event_outbox
- workshop_scratchpads
- workshop_shares
- capture_sessions
- capture_segments
- findings
- diagnostic_syntheses

## Phase 0: Baseline and Backup
Owner is Claude to execute and you to approve.

### Tasks
- Create full backup and export metadata before modifications.
- Capture schema inventory for all Dream tables including columns, types, defaults, constraints, indexes.
- Capture RLS status per Dream table.
- Capture policy inventory per Dream table.
- Capture grants and role-level access for public schema.
- Capture known runtime failures and map each to schema or policy cause.

### Artifacts
- `docs/DB_INTEGRITY_BASELINE.md`
- `sql/baseline/*.sql` for snapshot queries
- Backup metadata reference with timestamp

### Exit Criteria
- Backup confirmed.
- Baseline report complete and reviewed.

## Phase 1: Schema Parity and Drift Elimination
Owner is Claude.

### Tasks
- Align actual DB to runtime expectations with idempotent SQL migrations.
- Ensure required workshops columns exist and are usable:
  - `engagement_type`
  - `domain_pack`
  - `domain_pack_config`
  - `discovery_questions`
  - `blueprint`
  - `historical_metrics`
  - `client_name`
  - `dream_track`
  - `prep_research`
  - plus any runtime-referenced columns discovered in baseline.
- Add missing indexes required for common joins and policy predicates.
- Validate FKs for child tables that depend on workshops and sessions.
- Remove runtime blockers caused by missing columns.

### Guardrails
- No destructive DDL without explicit rollback plan and backup confirmation.
- Use `IF NOT EXISTS` where possible.
- Do not leave partial migration state.

### Artifacts
- `sql/migrations/*.sql`
- `docs/SCHEMA_PARITY_REPORT.md` with before/after diff

### Exit Criteria
- No missing runtime-critical columns.
- Known schema drift errors are no longer reproducible.

## Phase 2: RLS Enablement and Policy Rollout
Owner is Claude.

### Tasks
- Enable RLS on all 19 Dream tables.
- Create policy helper functions to resolve authenticated user identity and org from JWT claims as needed.
- Define policy model:
  - `workshops` as parent org boundary table
  - child tables constrained through joins to `workshops.organizationId`
  - `workshop_shares` supports explicit shared access while maintaining org safety
  - service role and backend trusted paths remain operational and controlled.
- Minimum policy coverage:
  - `SELECT`, `INSERT`, `UPDATE`, `DELETE` as required per table and role semantics.
  - no broad permissive policies without org checks.
  - no orphan table without policy after RLS enabled.

### Guardrails
- Deny by default then explicit allow.
- No client-side dependency on service-role key.
- No policy that allows cross-org reads.

### Artifacts
- `sql/policies/*.sql`
- `docs/RLS_POLICY_MATRIX.md` with table-by-table command coverage and predicates

### Exit Criteria
- RLS true for all 19 tables.
- Policy count non-zero and complete for all 19 tables.

## Phase 3: Integrity Constraints and Data Hygiene
Owner is Claude.

### Tasks
- Run orphan detection and remediation:
  - children without parent workshop
  - children without parent session
  - findings and captures disconnected from workshop path.
- Validate uniqueness assumptions and conflict paths.
- Validate cascade behavior and safe delete behavior across all Dream entities.
- Ensure delete flow remains robust in mixed schema scenarios.

### Guardrails
- No blind mass delete.
- Any cleanup script must be previewable and reversible where feasible.

### Artifacts
- `sql/integrity_checks/*.sql`
- `docs/DATA_INTEGRITY_REPORT.md` with counts before and after

### Exit Criteria
- No critical orphan patterns remaining.
- Delete lifecycle validated end-to-end.

## Phase 4: Fail-Closed Runtime Behavior for DB Writes
Owner is Claude.

### Tasks
- Remove silent legacy write fallback in workshop create and update for dynamic fields.
- If dynamic persistence fails, return explicit actionable error with details and correlation ID.
- Keep safe read compatibility for legacy rows where necessary.
- Ensure API responses surface meaningful DB failure context to operator logs.

### Guardrails
- No hidden downgrade from dynamic to static mode.
- No generic error swallowing.

### Artifacts
- `docs/FAIL_CLOSED_BEHAVIOR.md`
- Tests demonstrating explicit failure behavior

### Exit Criteria
- Dynamic field persistence failures are visible and actionable.
- No silent downgrade path remains.

## Phase 5: Verification and Evidence Gates
Owner is Claude, final acceptance by you.

### Mandatory Verification
- RLS status query proves true for all 19 tables.
- Policy inventory query proves expected policy coverage for all 19 tables.
- Cross-tenant deny tests using real auth contexts:
  - org A cannot read org B workshops
  - org A cannot read org B sessions, reports, data points, snapshots, findings
  - org A cannot mutate org B records.
- Positive controls:
  - same-org authorized paths still work.
- Lifecycle smoke:
  - create workshop
  - prep update
  - discovery session
  - live session artifacts
  - output generation
  - workshop delete.
- Build and tests:
  - `npx tsc --noEmit`
  - `npm run test:run`

### Artifacts
- `docs/DB_REMEDIATION_VERIFICATION.md` with pass/fail matrix and raw outputs
- commit hashes and changed files list

### Exit Criteria
- All gates pass with evidence.

## Phase 6: Environment Hardening After Integrity
Owner is Claude with your approval.

### Tasks
- Define split DB strategy for pre-live and production after integrity is restored.
- Prevent future cross-environment contamination.
- Add startup guard that logs DB project ref and fails deployment when environment mismatch is detected.
- Document migration promotion process between pre-live and production.

### Artifacts
- `docs/ENVIRONMENT_SPLIT_PLAN.md`
- `docs/DB_PROMOTION_RUNBOOK.md`

### Exit Criteria
- Safe promotion workflow documented and tested.

## Operational Queries Claude Must Run and Include
- Dream table existence query.
- RLS status query for all 19 tables.
- Policy inventory query for all 19 tables.
- Policy count summary by table.
- Column existence checks for workshops critical fields.
- Orphan detection queries for core child tables.
- Cross-tenant deny check outputs.

## Risk Classification Rules
- Critical if any Dream table has `rowsecurity = false` after remediation.
- Critical if any Dream table has no policies under RLS true unless intentionally deny-all with documented reason.
- Critical if cross-tenant read or write is possible.
- High if schema drift errors remain possible in normal lifecycle flows.
- High if delete behavior can leave inconsistent state.
- Medium if evidence logging or diagnostics are incomplete.

## Deliverable Format Required from Claude for Each Phase
- Phase summary.
- SQL applied.
- Files changed.
- Tests run and results.
- Evidence snippets.
- Residual risks.
- Go/no-go recommendation.

## Final Acceptance Criteria
- RLS enforced on all Dream tables in scope.
- Complete policy coverage with org-safe predicates.
- Schema parity achieved for runtime-critical columns.
- No silent fallback on dynamic writes.
- Cross-tenant denial proven.
- End-to-end Dream lifecycle still works.
- Evidence pack complete and auditable.
