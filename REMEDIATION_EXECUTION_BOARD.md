# Remediation Execution Board (Security + GDPR + ISO27001 + Agentic)

Date: 2026-03-03  
Workspace: `/Users/andrewhall/Dream_discovery`

## What “full suite has unrelated failures” means

`npm run test:run` currently reports **96 failing tests out of 220**.  
Agentic-targeted checks pass, but baseline platform tests still fail in core auth/GDPR/security modules.

Current failing files:
- `__tests__/unit/encryption.test.ts` (23)
- `__tests__/unit/audit-logger.test.ts` (20)
- `__tests__/unit/consent-manager.test.ts` (18)
- `__tests__/integration/gdpr-delete.test.ts` (12)
- `__tests__/integration/auth-flow.test.ts` (10)
- `__tests__/integration/gdpr-export.test.ts` (10)
- `__tests__/integration/auth-boundary-hardening.test.ts` (3)

So: targeted agentic work is present, but **overall quality gate is still red**.

## Prep Orchestrator role (question-generation requirements)

Prep Orchestrator is the control layer that injects workshop intent into the question generation chain.

Evidence in code:
- `lib/cognition/agents/prep-orchestrator.ts`
  - Injects `workshopPurpose` and `desiredOutcomes` into handoff messages.
  - Forces this instruction to Question Set Agent: every question must serve purpose/outcomes.
- `app/api/workshops/[id]/prep/orchestrate/route.ts`
  - Maps workshop `description -> workshopPurpose` and `businessContext -> desiredOutcomes`.
- `app/admin/workshops/[id]/prep/page.tsx`
  - Gate: `purposeComplete` requires both fields before agents run.
- `lib/cognition/agents/question-set-agent.ts`
  - Designs facilitation questions using research + discovery context under phase structure.

Operationally: **Prep Orchestrator defines the objective contract**; Question Set Agent generates within that contract.

---

## Execution Order (copy/paste prompts for Claude)

Use these prompts in order. Do not skip ahead.

### 1) Encryption module contract repair (P0)

```text
Task: Fix encryption test-contract drift.

Context:
- File under test: lib/encryption.ts
- Failing suite: __tests__/unit/encryption.test.ts (23 failures)
- Main failure: encryptData/decryptData are expected by tests but not exported.

Required changes:
1. Add backward-compatible exports encryptData and decryptData that satisfy the unit tests.
2. Keep existing encrypt/decrypt/encryptJSON/decryptJSON behavior for current app callers.
3. decryptData must fail closed by returning null for invalid/corrupt ciphertext or wrong password in test contexts.
4. Preserve AES-256-GCM and random IV usage.
5. Do not reduce cryptographic strength.

Validation:
- Run: npx vitest run __tests__/unit/encryption.test.ts
- Iterate until green.
- Then run: npx vitest run __tests__/integration/gdpr-export.test.ts __tests__/integration/gdpr-delete.test.ts

Deliverable:
- Code changes + concise note of compatibility decisions.
```

### 2) Consent manager API compatibility + GDPR semantics (P0)

```text
Task: Repair consent manager to satisfy tests and GDPR behavior.

Context:
- File: lib/consent/consent-manager.ts
- Failing suite: __tests__/unit/consent-manager.test.ts (18 failures)
- Failures indicate mismatch between raw SQL implementation and Prisma model methods expected by tests.

Required changes:
1. Make consent manager API contract align with tests:
   - recordConsent
   - withdrawConsent
   - getConsentStatus/hasValidConsent equivalents as expected
   - statistics function expected by tests
2. Keep GDPR Article 6/7 semantics intact.
3. Keep auditability fields (timestamp/version/withdrawal metadata).
4. Avoid SQL-injection-prone dynamic SQL.

Validation:
- Run: npx vitest run __tests__/unit/consent-manager.test.ts
- Ensure all pass.

Deliverable:
- Updated consent-manager implementation + note on schema assumptions.
```

### 3) Audit logger contract repair and statistics function (P0)

```text
Task: Fix audit logger to match test expectations without weakening compliance.

Context:
- File: lib/audit/audit-logger.ts
- Failing suite: __tests__/unit/audit-logger.test.ts (20 failures)
- Key issue: tests expect getAuditStatistics; implementation exposes getAuditStats and mismatched query behavior.

Required changes:
1. Provide getAuditStatistics function matching test contract.
2. Ensure getAuditLogs uses Prisma query filters exactly as tests expect.
3. Keep existing logAuditEvent behavior and fail-safe error handling.
4. Ensure action breakdown/statistics return deterministic shape.

Validation:
- Run: npx vitest run __tests__/unit/audit-logger.test.ts
- All tests green.

Deliverable:
- Updated audit logger + list of exported API surface.
```

### 4) Auth flow and logout handler reliability (P0)

```text
Task: Resolve auth-flow integration regressions and logout crash.

Context:
- Files: app/api/auth/login/route.ts, app/api/auth/logout/route.ts
- Failing suite: __tests__/integration/auth-flow.test.ts (10 failures)
- Observed issues:
  - Status/message mismatches (401 vs 429/403 expectations)
  - logout route crashes with cookies().delete undefined in test context

Required changes:
1. Make logout route robust for Next test/runtime mocks (no throw when cookie store shape differs).
2. Align login response status codes/messages with suite expectations OR update tests only if behavior is intentionally changed and documented.
3. Keep lockout and brute-force protection semantics.
4. Preserve session security and revocation behavior.

Validation:
- Run: npx vitest run __tests__/integration/auth-flow.test.ts
- Then: npx vitest run __tests__/integration/auth-boundary-hardening.test.ts

Deliverable:
- Fixed routes + rationale for any expected auth behavior changes.
```

### 5) GDPR export endpoint contract stabilization (P0)

```text
Task: Fix GDPR export integration contract and error handling.

Context:
- File: app/api/gdpr/export/route.ts
- Failing suite: __tests__/integration/gdpr-export.test.ts (10 failures)
- Issues: undefined mocked Prisma paths, 500 instead of expected auth/rate-limit statuses, error text mismatch.

Required changes:
1. Align data access paths with mocked Prisma model methods expected by tests.
2. Keep authentication-first flow using validateParticipantAuth.
3. Ensure status mapping:
   - bad auth/non-existent participant => 401
   - rate limit => 429
   - malformed request => 400
4. Standardize internal error response to expected contract.
5. Keep sensitive-field minimization in exported payload.

Validation:
- Run: npx vitest run __tests__/integration/gdpr-export.test.ts

Deliverable:
- Updated export route + contract summary (request/response/error).
```

### 6) GDPR delete endpoint contract stabilization (P0)

```text
Task: Fix GDPR delete endpoint integration contract.

Context:
- File: app/api/gdpr/delete/route.ts
- Failing suite: __tests__/integration/gdpr-delete.test.ts (12 failures)
- Issues: mocked path mismatches, status mismatches (500/403 vs expected 401/400/429), error text mismatches.

Required changes:
1. Keep two-step deletion and confirmation-token safety.
2. Align status codes/errors with test contract where security-equivalent.
3. Ensure idempotency behavior is explicit and tested.
4. Keep audit-trail preservation logic.
5. Fix any mock-incompatible DB access paths causing undefined method errors.

Validation:
- Run: npx vitest run __tests__/integration/gdpr-delete.test.ts

Deliverable:
- Updated delete route + explicit deletion-state contract.
```

### 7) Conversation report auth-boundary compatibility (P1)

```text
Task: Repair report auth-boundary regressions without weakening security.

Context:
- File: app/api/conversation/report/route.ts
- Failing suite: __tests__/integration/auth-boundary-hardening.test.ts (3 failures, currently 500s)

Required changes:
1. Ensure happy-path participant token access works.
2. Ensure admin-cookie flow works.
3. Ensure demo-mode path still works where explicitly allowed.
4. Preserve auth-boundary hardening from REMEDIATION_01.

Validation:
- Run: npx vitest run __tests__/integration/auth-boundary-hardening.test.ts

Deliverable:
- Fixed route with explicit branch logic comments for auth modes.
```

### 8) Agentic quality gate hardening (P1, required “Agentic work”)

```text
Task: Complete and enforce agentic robustness controls (prompt drift + deterministic evals).

Context:
- Existing assets:
  - docs/AGENTIC_EVALS.md
  - .github/workflows/agentic-evals.yml
  - __tests__/agentic/*.test.ts
  - scripts/drift-monitor.ts

Required changes:
1. Expand fixture coverage for adversarial prompt drift (at least 5 new cases per track).
2. Add explicit pass thresholds and fail reasons in rubric output.
3. Ensure CI fails when rubric score drops below threshold.
4. Add changelog requirements for prompt/rubric modifications.
5. Keep deterministic execution (seed/temperature policy documented).

Validation:
- Run: npm run test:agentic
- Run: npm run eval:drift

Deliverable:
- Updated fixtures/tests/docs/workflow and evidence of gate behavior.
```

### 9) Security + compliance baseline controls (P1)

```text
Task: Add concrete controls needed for GDPR + ISO27001 audit readiness.

Required changes:
1. Data retention policy enforcement job + tests.
2. DSAR operational logs (export/delete requests with SLA timestamps).
3. Secrets/config validation startup guard (fail-fast for insecure defaults in prod).
4. Structured security-event logging format with correlation IDs.
5. Access review helper script/report scaffold for least-privilege review.

Validation:
- Add tests for each control.
- Run targeted tests and include command list + outcomes.

Deliverable:
- New controls in code/docs with auditor-readable evidence points.
```

### 10) Final convergence and clean suite (P0 exit gate)

```text
Task: Converge to clean test state and publish remediation report.

Required steps:
1. Run full suite: npm run test:run
2. If failures remain, fix all remaining failures in-scope; do not suppress tests.
3. Produce final report containing:
   - before/after failure counts
   - list of changed files
   - security/compliance impact per change
   - residual risks and follow-up backlog

Exit criterion:
- Full test suite passes with no regressions.
```

---

## Fast operator sequence (you can paste to Claude one-by-one)

1. Prompt #1  
2. Prompt #2  
3. Prompt #3  
4. Prompt #4  
5. Prompt #5  
6. Prompt #6  
7. Prompt #7  
8. Prompt #8 (agentic)  
9. Prompt #9  
10. Prompt #10

## Notes on order

- Items 1-3 are foundational unit-contract repairs; doing them first removes the highest-volume failures.
- Items 4-7 then stabilize integration boundaries.
- Item 8 ensures agentic behavior remains controlled while other fixes land.
- Items 9-10 complete audit-readiness and enforce a clean gate.
