# Agent2 Master Build Brief
## Workflow Overlay + MEIS + SLM Factory (Modular SKU)

## Purpose
Build Agent2 as a production-grade, modular workflow overlay platform with:
1. Workflow Overlay (model-driven orchestration)
2. Multimodal Evidence Intelligence Service (MEIS)
3. SLM Factory (primitive design/training/deployment lifecycle)

This must be delivered as separable paid modules and fully governed by policy, access control, and auditability.

## Mandatory Outcomes
1. Core contact-centre platform continues to run if overlay modules are disabled.
2. Workflow behavior is model-derived, not hardcoded industry logic.
3. MEIS converts artefacts into structured evidence with confidence and governance.
4. Agentic execution uses registered SLM primitives, not ad-hoc LLM calls in business routes.
5. Platform-wide mode controls are exactly `human`, `assist`, `agentic`.
6. High-risk actions always route to human review.

## Module Boundaries (Non-Negotiable)
1. `core` (existing baseline contact-centre capabilities)
2. `modules/workflow-overlay`
3. `modules/meis`
4. `modules/slm-factory`
5. `shared` (authz/policy/kafka/audit/tenant utilities)

Rules:
1. No deep cross-module imports.
2. Module APIs/contracts only.
3. Tenant-scoped entitlement gates at API, UI, and worker layers.

## Entitlement Flags
1. `workflow_overlay_enabled`
2. `meis_enabled`
3. `slm_factory_enabled`
4. `agentic_runtime_enabled`

If disabled: explicit `403 module_not_enabled` (no hidden fallback).

## Platform Control Model
Use hybrid authorization:
1. RBAC (role baseline)
2. ABAC (context: tenant, risk, mode, workflow stage)
3. Relationship checks (assignment/ownership)
4. Policy-as-code decision service (`authorize(actor, action, resource, context)`)

Persist automation modes with scope:
1. global
2. tenant
3. module
4. action/resource override

Effective mode precedence:
`resource/action` > `module` > `tenant` > `global`

## SLM Factory (Critical Spine)
Implement in `modules/slm-factory`:
1. Primitive specs (schema + thresholds + risk + mode compatibility)
2. Dataset pipeline (lineage and quality checks)
3. Teacher labeling pipeline
4. Training orchestration
5. Evaluation/calibration
6. Model registry and lifecycle states
7. Canary/rollback rollout control
8. Runtime monitoring and drift detection

Required first primitive set:
1. intake_intent
2. intake_validation
3. customer_verification
4. email_header_fraud
5. phishing_content
6. fraud_aml_risk
7. policy_recommendation
8. resolution_planner
9. tool_action_validator
10. response_drafter
11. quality_compliance_validator
12. escalation_packager
13. supervisor_synthesis

## SLM Primitive Training Blueprint (Explicit)
Every primitive must define:
1. input schema
2. output schema
3. teacher-label method
4. human-labeled signals
5. policy labels used
6. evaluation metrics
7. promotion thresholds

### Mandatory Primitive Coverage
1. `intake_intent`
   1. Purpose: classify interaction intent/urgency/channel/sentiment.
   2. Training: teacher labels from curated interaction samples + human QA labels.
2. `intake_validation`
   1. Purpose: validate interaction authenticity and structural validity before orchestration.
   2. Training: labeled valid/invalid interaction packets, malformed payload corpora, spoof pattern sets.
3. `email_header_fraud`
   1. Purpose: analyze SPF/DKIM/DMARC/Received-chain anomalies.
   2. Training: header corpora with known-good and known-spoof outcomes.
4. `phishing_content`
   1. Purpose: detect social engineering, malicious links, impersonation cues.
   2. Training: phishing datasets + internal false-positive reviewed samples.
5. `fraud_aml_risk`
   1. Purpose: assign fraud/AML risk tier and reason codes.
   2. Training: adjudicated fraud/AML outcomes + override decisions.
6. `customer_verification`
   1. Purpose: determine identity confidence and verification path.
   2. Training: verified/not-verified resolution history + KYC outcomes.
7. `policy_recommendation`
   1. Purpose: recommend allowed mode/action under policy packs.
   2. Training: policy simulation labels + historical policy decisions.
8. `resolution_planner`
   1. Purpose: produce ordered action plan and required approvals.
   2. Training: successful resolution traces + failed/escalated traces.
9. `tool_action_validator`
   1. Purpose: validate proposed tool actions against policy and system constraints.
   2. Training: allowed/blocked action logs + incident postmortems.
10. `response_drafter`
   1. Purpose: generate compliant customer response drafts (email/chat/summary).
   2. Training: approved communications + quality/compliance review labels.
11. `quality_compliance_validator`
   1. Purpose: check factuality, tone, policy compliance before send/execute.
   2. Training: QA scoring data + compliance fail/pass annotations.
12. `escalation_packager`
   1. Purpose: build structured human handoff with evidence and rationale.
   2. Training: resolved escalation packs + reviewer feedback.
13. `supervisor_synthesis`
   1. Purpose: synthesize primitive outputs for orchestrator decision proposal.
   2. Training: historical multi-signal case decisions + final outcomes.

## Primitive Promotion Gates (Must Pass)
1. schema validity rate meets threshold
2. confidence calibration acceptable
3. risk-tier precision/recall targets met
4. safety regression suite pass
5. policy compatibility tests pass
6. shadow/canary performance within tolerance

## Workflow Overlay Requirements
1. DREAM journey import
2. Journey mapper
3. Candidate workflow generation
4. Scratchpad refinement
5. Publish/version workflow models
6. Compile to executable plan
7. Deterministic orchestrator runtime
8. Workboard assignment/routing
9. Automatic case creation/update inside Agent2 from workflow events
10. Workflow module dashboards with proactive resolution metrics

No “unknown workflow -> default process” behavior.

## Workflow Overlay Gamechanger Definition
This module is intended to move work away from purely reactive contact handling and into proactive operational resolution.

Mandatory behavior:
1. Workflow execution can auto-create and update cases in Agent2 when model/policy conditions are met.
2. Workflow module reports must surface:
   1. proactive cases created
   2. auto-routed tasks by actor/team/system
   3. intervention points where human review was required
   4. resolution outcomes and SLA impacts
3. Core contact-centre handling remains available, but workflow-driven orchestration becomes a first-class resolution path.
4. No domain hardcoding: workflows for airline, insurance, utilities, healthcare, etc. must all come from models.

## Workflow Overlay Build Order Constraint
Workflow Overlay implementation follows SLM Factory foundation.
1. SLM primitive contracts and runtime gateway must be in place before deep workflow execution logic.
2. Workflow runtime must consume primitive registry outputs, not direct ad-hoc model prompts.
3. Case auto-creation logic must be policy-gated and fully auditable.

## MEIS Requirements
1. Artefact ingestion (image, pdf, audio, video, text, structured attachment)
2. Provider-agnostic multimodal interpretation adapters
3. Structured evidence normalization (extensible schema)
4. Validation against connected records/systems
5. Semantic retrieval (supporting, not primary representation)
6. Workflow hook outputs (decision-ready evidence events)
7. Confidence + assumptions + human-review gating
8. Full evidence audit trail

## Vector Database Requirement (Mandatory)
Vector capability is required as part of MEIS and must be implemented in this build.

1. Default vector backend: Supabase `pgvector` (unless an approved equivalent is documented).
2. Persist embeddings for:
   1. artefacts
   2. normalized evidence objects
   3. relevant knowledge fragments used for evidence context
3. Enforce tenant isolation on all vector rows/queries.
4. Use ANN indexing suitable for production query latency.
5. Provide retrieval endpoints for:
   1. similar claims/evidence
   2. product/entity similarity matching
   3. related knowledge retrieval
6. Track and report retrieval quality metrics:
   1. recall@k
   2. precision@k
   3. p95 latency
7. Structured evidence remains the primary operational representation.
8. Vector retrieval may inform decisions but cannot bypass policy or confidence gating.

## Kafka/Event Requirements
1. Versioned envelope schema
2. Topic partitioning by tenant key
3. Idempotent consumers with dedupe store
4. DLQ + replay tooling
5. Worker-driven state mutation for critical operations

## Critical Existing Fixes (Must Land Early)
1. Remove tenant trust/fallback patterns in engine-room execution paths.
2. Correct gamification tenancy schema/RLS consistency.
3. Replace in-memory global pause with persisted control state.
4. Align UI/API role checks for SOP and control surfaces.

## Delivery Phasing

### Phase 0: Foundations & Freeze
Scope:
1. Define module boundaries and dependency rules.
2. Define entitlement model and flags.
3. Define canonical contracts (workflow, evidence, primitive, auth decision).
4. Freeze ad-hoc model calls in core routes.

Exit Criteria:
1. Architecture decision record approved.
2. Contract schemas committed.
3. Build checks green.

Codex Review Gate:
1. Validate module boundary map.
2. Validate no direct ad-hoc model calls in business routes.

### Phase 1: Security, Tenancy, Policy Spine
Scope:
1. Centralize authorization decision service.
2. Persist mode controls and global pause.
3. Fix tenant safety/RLS critical issues.
4. Standardize mode semantics (`human/assist/agentic`).

Exit Criteria:
1. Tenant isolation tests pass.
2. Mode and pause persistence tests pass.
3. Critical auth/tenant findings closed.

Codex Review Gate:
1. API authorization trace audit.
2. RLS and tenant-path validation.

### Phase 2: SLM Factory MVP (Production-Grade)
Scope:
1. Implement primitive spec system.
2. Implement dataset lineage pipeline.
3. Implement teacher labeling + training orchestration.
4. Implement evaluation, calibration, and registry.
5. Implement runtime primitive gateway.

Exit Criteria:
1. 13 primitives defined in spec format.
2. All 13 primitives have dataset specs, training configs, and evaluation configs committed.
3. At least 6 primitives fully trained/evaluated/registered/canary, including:
   1. intake_validation
   2. email_header_fraud
   3. fraud_aml_risk
   4. response_drafter
   5. quality_compliance_validator
   6. supervisor_synthesis
4. Orchestrator can resolve primitive from registry.

Codex Review Gate:
1. Spec/schema quality review.
2. Training/eval reproducibility review.
3. Registry + rollout control review.

### Phase 3: Workflow Overlay Runtime (Post-SLM)
Scope:
1. Journey import/mapping/generation/scratchpad/publish flow.
2. Executable plan compiler.
3. Runtime orchestration state machine.
4. Workboard and assignment model.
5. Kafka lifecycle events.
6. Automatic case creation/update pipeline from workflow nodes.
7. Workflow dashboards for proactive activity and resolution.

Exit Criteria:
1. End-to-end: import -> generate -> refine -> publish -> run.
2. No hardcoded industry paths.
3. Escalation paths mandatory and test-covered.
4. Workflow execution can create/update Agent2 cases automatically when policy allows.
5. Dashboard reporting reflects workflow-originated work and outcomes.

Codex Review Gate:
1. Workflow model validation review.
2. Runtime state transition and failure-mode review.
3. Case creation and dashboard metric integrity review.

### Phase 4: MEIS Integration
Scope:
1. Artefact ingestion and metadata linking.
2. Multimodal analysis adapters.
3. Evidence normalization + validation + retrieval.
4. Confidence gating + workflow hook events.
5. Evidence audit events and traceability.

Exit Criteria:
1. Artefact -> structured evidence -> workflow routing works end-to-end.
2. Low-confidence routes to human review.
3. Audit completeness passes.

Codex Review Gate:
1. Evidence schema and provenance review.
2. Confidence/policy gate review.

### Phase 5: Commercial Modularization
Scope:
1. Enforce entitlement gates per module.
2. Ensure core operation without modules enabled.
3. Separate docs/runbooks and operational toggles.
4. Billing/usage telemetry by module.

Exit Criteria:
1. Per-tenant enable/disable without core breakage.
2. `403 module_not_enabled` behavior consistent.
3. SKU telemetry and docs complete.

Codex Review Gate:
1. Module boundary + entitlement test review.
2. Disable/enable scenario validation.

### Phase 6: Hardening and Go-Live Readiness
Scope:
1. End-to-end integration tests.
2. Performance and soak tests.
3. DLQ replay drills.
4. Governance review reports.

Exit Criteria:
1. Lint/typecheck/tests pass.
2. No critical/high open findings.
3. Operational runbooks accepted.

Codex Review Gate:
1. Final production readiness review.
2. Open-risk signoff list.

## Required Test Gates (Every Phase)
1. `npm run lint`
2. `npx tsc --noEmit`
3. `npx vitest run`

Additional integration gates:
1. Tenant isolation
2. Mode enforcement
3. High-risk forced human review
4. Idempotent Kafka processing
5. DLQ and replay behavior
6. Workflow lifecycle end-to-end
7. MEIS evidence lifecycle end-to-end
8. Workflow auto-case creation end-to-end
9. Workflow dashboard metric correctness and traceability
10. Vector retrieval quality and latency thresholds

## Reporting Contract for Claude
Every checkpoint response must include:
1. Completed scope vs planned scope
2. Files changed
3. Migrations added/updated
4. Test outputs summary
5. Risks/blockers
6. Next phase start criteria

## Definition of Done
The build is complete only if:
1. Workflow Overlay, MEIS, and SLM Factory are all operational.
2. Module isolation and entitlements are enforced end-to-end.
3. Agentic execution depends on SLM registry contracts, not ad-hoc route prompts.
4. Auditability and policy controls are complete and tested.
5. No critical/high issues remain.

## Absolute Execution Contract (No Ambiguity)
1. No partial completion claims for any phase.
2. No placeholders, TODO stubs, mock handlers, or unimplemented interface shells in delivered scope.
3. No ad-hoc direct LLM calls in workflow-critical decision routes.
4. No bypass of policy gates in `assist` or `agentic` modes.
5. No missing migration for any new persisted field or table.
6. No undocumented API contract changes.

If any of the above exists, phase status is automatically `NOT COMPLETE`.

## Primitive Quality Targets (Mandatory)
Targets below are minimum promotion thresholds from `candidate` to `canary`:
1. `intake_intent`: macro-F1 >= 0.90, calibration error <= 0.06
2. `intake_validation`: precision >= 0.97, recall >= 0.92
3. `email_header_fraud`: precision >= 0.98, recall >= 0.94
4. `phishing_content`: precision >= 0.97, recall >= 0.93
5. `fraud_aml_risk`: high-risk recall >= 0.96, low-risk false-positive <= 0.08
6. `customer_verification`: verification decision accuracy >= 0.95
7. `policy_recommendation`: policy agreement rate >= 0.98
8. `resolution_planner`: executable plan validity >= 0.95
9. `tool_action_validator`: blocked-action catch rate >= 0.99
10. `response_drafter`: compliance pass >= 0.98, hallucination rate <= 0.02
11. `quality_compliance_validator`: precision >= 0.97, recall >= 0.95
12. `escalation_packager`: reviewer acceptance >= 0.95
13. `supervisor_synthesis`: decision agreement with adjudicated outcomes >= 0.93

If thresholds are not met, primitive cannot be promoted.

## Dataset and Training Minimums (Mandatory)
For each primitive:
1. Minimum 10k labeled examples or documented approved exception with risk rationale.
2. Temporal split: train/val/test with forward-time holdout.
3. Cross-tenant stratification where permitted by privacy policy.
4. Bias and drift checks included in evaluation report.
5. Full lineage metadata captured:
   1. source tables/files
   2. extraction commit hash
   3. labeling recipe version
   4. policy pack version used

No training run without lineage-complete dataset manifest.

## Mandatory Artifacts Per Primitive
Each primitive must produce and store:
1. `PRIMITIVE_SPEC.md`
2. `DATASET_MANIFEST.json`
3. `TRAINING_CONFIG.yaml`
4. `EVAL_REPORT.md`
5. `CALIBRATION_REPORT.md`
6. `SAFETY_TEST_REPORT.md`
7. `REGISTRY_CARD.json`

## Phase Stop/Go Rules
1. A phase cannot advance if any required gate is `fail` or `not-run`.
2. A phase cannot advance with open critical/high findings.
3. A phase cannot advance without Codex review gate pass.
4. A phase cannot advance if migration and runtime behavior are mismatched.
5. A phase cannot advance if API/UI behavior diverges on auth or mode semantics.

## Anti-Evasion Rules for Claude
1. Do not replace unmet implementation with narrative explanations.
2. Do not mark tasks complete based only on local UI behavior.
3. Do not hide failures behind fallback stubs.
4. Do not down-scope without explicit owner approval and recorded decision.
5. Do not present synthetic-only flows as production-ready.

## Final Acceptance Evidence Bundle
Before final completion claim, deliver:
1. Full requirements-to-code trace matrix.
2. Full phase checkpoint history using `PHASE_CHECKLIST.md`.
3. Primitive registry export with versions and status.
4. Workflow run replay showing automatic case creation and dashboard reflection.
5. MEIS replay showing artefact -> evidence -> workflow decision path.
6. Audit export proving policy/mode/actor traceability.

## Phase 2 Closure Enforcement (Hard Gate)
Phase 2 is rejected unless it is fully complete against planned scope.

Mandatory closure requirements:
1. Teacher labeling pipeline implemented end-to-end (no stubs).
2. Training orchestration implemented end-to-end (job lifecycle + execution + status + artifacts).
3. No deferred items remain that were part of planned Phase 2 scope.
4. Workflow-critical primitives cannot rely on `llm_fallback`.
5. Checkpoint must not claim `COMPLETE` if any planned item is deferred.

If any requirement above is not met, status is automatically:
`PHASE 2 = NOT COMPLETE`

## No-Advance Rule to Phase 3
Do not start Phase 3 unless all are true:
1. Phase 2 closure requirements are fully met.
2. Codex review result is `PASS` (not conditional).
3. Critical/high findings count is zero.
4. Quality gates pass:
   1. `npm run lint`
   2. `npx tsc --noEmit`
   3. `npx vitest run`

## Binary Pass/Fail Checklist (Mandatory in Checkpoint)
Claude must report each item as `PASS` or `FAIL` only:
1. 13/13 primitive specs committed.
2. 13/13 dataset manifests committed.
3. 13/13 training configs committed.
4. Teacher labeling pipeline implemented and executed with evidence.
5. Training orchestration implemented and executed with evidence.
6. 6 required canary primitives promoted with complete artifacts.
7. Workflow-critical primitive invocation uses registry path only.
8. No deferred planned Phase 2 items remain.
9. Lint pass.
10. Typecheck pass.
11. Tests pass.
12. Codex gate pass.

If any line is `FAIL`, the phase is not complete.
