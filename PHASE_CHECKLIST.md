# Agent2 Build Checkpoint Template
## Mandatory Phase Reporting Format for Claude

Use this exact template at the end of each phase and before moving to the next one.

## 1. Phase Header
1. `Phase Number`:
2. `Phase Name`:
3. `Date (UTC)`:
4. `Branch`:
5. `Commit(s)`:

## 2. Scope Status
1. `Planned Scope`:
2. `Completed Scope`:
3. `Out of Scope Changes`:
4. `Deferred Items`:

## 3. Deliverables Evidence
1. `Files Changed`:
2. `New Files`:
3. `Deleted Files`:
4. `Migrations Added/Updated`:
5. `API Endpoints Added/Updated`:
6. `Workers/Jobs Added/Updated`:
7. `Schemas/Contracts Added/Updated`:

## 4. Quality Gates
1. `npm run lint`:
2. `npx tsc --noEmit`:
3. `npx vitest run`:
4. `Integration Tests Run`:
5. `Performance/Soak Checks`:

For each item above, report:
1. `status`: pass/fail/not-run
2. `evidence`: key output summary
3. `if fail`: root cause + fix plan

## 5. Security, Tenancy, and Policy Verification
1. `Tenant isolation checks`:
2. `Authorization decision checks`:
3. `Mode control checks (human/assist/agentic)`:
4. `High-risk forced-human checks`:
5. `Audit trail completeness checks`:

## 6. Kafka/Event Reliability Verification
1. `Envelope validation`:
2. `Idempotency checks`:
3. `DLQ behavior checks`:
4. `Replay flow checks`:
5. `State mutation path (worker-driven) checks`:

## 7. SLM Factory Verification (if phase includes SLM work)
1. `Primitive specs added/updated`:
2. `Dataset lineage snapshot`:
3. `Teacher labeling run status`:
4. `Training runs completed`:
5. `Evaluation metrics summary`:
6. `Registry promotion status`:
7. `Canary/rollback status`:

## 8. MEIS Verification (if phase includes MEIS work)
1. `Artefact ingestion status`:
2. `Multimodal adapter status`:
3. `Evidence normalization status`:
4. `Validation/cross-check status`:
5. `Workflow hook integration status`:
6. `Confidence gating status`:

## 9. Modular SKU Verification
1. `Entitlement checks (module enabled/disabled)`:
2. `Core platform behavior when modules disabled`:
3. `403 module_not_enabled behavior`:
4. `No cross-module hard dependencies`:

## 10. Codex Review Gate
1. `Gate Type`:
2. `Findings (Critical/High/Medium/Low)`:
3. `Blocked? (yes/no)`:
4. `Required Remediation`:
5. `Remediation Complete?`:

## 11. Risks and Blockers
1. `Open Risks`:
2. `Blockers`:
3. `Mitigations`:
4. `Owner`:
5. `ETA`:

## 12. Next Phase Readiness
1. `Entry Criteria for Next Phase`:
2. `Criteria Met? (yes/no)`:
3. `If no`: exact missing items
4. `Go/No-Go Decision`:

## 13. Hard Rule
Do not start the next phase unless:
1. Current phase quality gates pass, or failures are explicitly accepted by owner.
2. Codex review gate is not blocked.
3. Security/tenancy regressions are zero for the delivered scope.
