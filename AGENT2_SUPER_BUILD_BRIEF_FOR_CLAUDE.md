# Agent2.0 Super Build Brief (Single Source of Truth)
## Private Agentic SLM Quality Intelligence Platform for Customer Operations

## 1) Objective
Build Agent2.0 as a production-grade, private AI operational intelligence platform that:
- evaluates 100% of interactions in real time
- runs intelligence inside platform-controlled infrastructure
- uses specialized language models (SLMs) for deterministic outputs
- drives operational actions (not just dashboards)
- supports multi-system access via API + Kafka

This brief supersedes fragmented docs. Treat this as the canonical implementation order.

## 2) Platform Positioning
Agent2.0 is not a post-call QA dashboard. It is:
- an event-driven operational intelligence layer
- a sovereign/private AI runtime for customer operations
- an agentic orchestration system that converts interaction signals into action

Core differentiation:
- no mandatory external LLM dependency in live execution path
- deterministic, role-aware compliance and quality decisions
- infrastructure-based economics vs token-based economics

## 3) End-State Architecture
Interaction Sources
-> Capture + Ingestion
-> Actor-Aware Normalization
-> Kafka Event Backbone
-> SLM Inference Network
-> Agentic Quality Engine
-> Decision Intelligence Layer
-> Operational Systems (Cases, WFM, SOP, Training, Dashboards)

### Mandatory layers
1. Capture Layer
- voice, chat, email, CRM logs, 3rd-party transcripts
- source-agnostic ingestion adapters

2. Normalization Layer
- canonical interaction schema
- actor timeline, event markers, channel metadata

3. Kafka Backbone
- real-time distribution of normalized interaction events
- replayability, idempotency, DLQ

4. SLM Inference Layer
- specialized primitives for compliance/quality/intent/risk/response
- deterministic outputs with confidence and provenance

5. Agentic Quality Engine
- multi-agent interpretation and action planning
- assist/human/agentic modes under policy control

6. Decision Intelligence Layer
- convert scores/signals into operational actions
- case updates, escalations, coaching, WFM interventions

7. Command Centre + APIs
- live operational state, risk heatmaps, compliance alerts, action traceability

## 4) Non-Negotiable Principles
1. No fake completion: no fabricated training/eval/promotion evidence.
2. No hidden hardcoded business logic where model/policy should decide.
3. Synthetic data must be external to logic files.
4. Real-time path must work without remote LLM reliance.
5. Every automated action must be auditable and reversible.
6. Policy and access control must gate all autonomous behavior.

## 5) Core Data Models
## 5.1 Interaction (normalized)
- interaction_id
- tenant_id
- source_system
- channel
- started_at
- ended_at
- metadata_json

## 5.2 Actor Timeline Segment
- segment_id
- interaction_id
- actor_id
- actor_role (customer|agent|team_leader|digital_agent|system)
- start_time
- end_time
- transcript_segment
- context_json

## 5.3 Inference Record
- request_id
- primitive_name
- primitive_version
- input_hash
- output_json
- confidence
- inference_source (slm_local|slm_local_backup|rules_fallback|llm_remote)
- latency_ms
- evaluated_at

## 5.4 Decision Record
- decision_id
- request_id
- decision_type
- decision_payload
- policy_mode (human|assist|agentic)
- acted_by
- created_at

## 5.5 Audit Record
- audit_id
- tenant_id
- request_id
- actor_id
- action
- payload_redacted_json
- audit_hash
- occurred_at

## 6) SLM Primitive Portfolio (minimum)
- intake_intent
- intake_validation
- customer_verification
- email_header_fraud
- phishing_content
- fraud_aml_risk
- policy_recommendation
- resolution_planner
- tool_action_validator
- response_drafter
- quality_compliance_validator
- escalation_packager
- supervisor_synthesis

Each primitive must have:
- contract schema
- policy constraints
- evaluation thresholds
- promotion gates
- rollback strategy

## 7) Agentic Quality Engine Capabilities
1. Interaction Intelligence
- SOP adherence, knowledge correctness, empathy/clarity signals

2. Behavioural Intelligence
- frustration/confusion/stress/escalation pattern detection

3. Compliance Intelligence
- disclosure checks, ID verification, restricted statements

4. Coaching Intelligence
- live assist prompts, post-call coaching plans, skill trajectories

5. Organizational Intelligence
- systemic issue detection across journeys/teams/processes

## 8) Mode Control (Human / Assist / Agentic)
Mode applies per workflow/step, not globally.
- Human: AI provides context, no autonomous action
- Assist: AI proposes action, human approves
- Agentic: AI executes within policy boundaries

Requirements:
- mode switch operable in UI and API
- mode changes audited
- policy gate blocks unauthorized autonomy

## 9) Integration Surface (Multi-System)
Build one canonical SLM access layer for:
- Agent2.0 internal routes
- DREAM and other internal apps
- external enterprise systems

Expose:
1. Sync API
- POST /api/slm/invoke

2. Async API
- POST /api/slm/jobs
- GET /api/slm/jobs/:id

3. Kafka topics
- slm.invoke.request.v1
- slm.invoke.result.v1
- slm.invoke.error.v1
- dead-letter topic

## 10) Security and Sovereignty
- private deployment (on-prem/private cloud/sovereign cloud)
- tenant isolation at DB + policy + transport
- PII redaction in logs/events
- no public endpoint without auth policy
- signed/tamper-evident audit chain

## 11) Training, Evaluation, and Promotion
Training is valid only with real artifacts and traceability.

## 11.1 Training evidence required
- real training_job_id
- real backend job reference
- started_at/completed_at
- artifact paths + hashes
- linked registry record

## 11.2 Evaluation requirements
- held-out test set
- real inference-based metrics (no random generation)
- per-class precision/recall/F1 + confusion matrix
- calibration metrics and safety checks

## 11.3 Specialist signoff requirements
- authenticated specialist approvals via API/UI
- required role matrix per primitive
- no pipeline-inserted fake signoffs

## 11.4 Promotion gates
Promote only if all pass:
- eval thresholds
- safety/policy checks
- required specialist signoffs
- runtime smoke validation

## 12) Operational Actions and Workflow Hooks
Quality/intelligence outputs must trigger:
- case creation/update
- escalation routing
- coaching assignment
- WFM intervention signals
- SOP improvement recommendations

## 13) Dashboards and Command Centre
Live views must show:
- quality risk heatmap
- compliance incidents
- coaching queue and completion impact
- primitive health and fallback rates
- action outcomes and SLA impact

## 14) Observability and Reliability
- per-primitive latency/error/fallback metrics
- idempotency on async processing
- retry + DLQ + replay tooling
- drift alerts and model degradation alerts
- route-to-primitive usage telemetry

## 15) Delivery Phases
## Phase 1: Foundation
- normalization contracts
- Kafka hardening
- SLM access layer sync/async
- baseline audit trail

## Phase 2: Intelligence Runtime
- actor-aware timeline pipeline
- primitive invocation wiring across core routes
- agentic quality engine v1

## Phase 3: Governance and Control
- mode controls everywhere
- policy enforcement and access model
- specialist signoff workflow
- promotion gates and rollback

## Phase 4: Operational Integration
- case/WFM/training/SOP integration
- command centre live intelligence
- multi-system API + Kafka adoption

## 16) Acceptance Gates (Hard)
GO only if all pass:
1. 100% real evidence (no fabricated DB artifacts)
2. SLM runtime works without remote LLM dependency
3. >=6 production routes invoke via SLM access layer
4. Async flow proves pending->completed with idempotency
5. Required specialist signoffs complete and authenticated
6. Real eval metrics from held-out inference
7. Promotion decisions consistent with actual gate outcomes
8. lint/tsc/tests/build clean

## 17) Required Evidence Pack (Raw)
- raw SQL outputs for training/eval/signoff/promotion/registry/audit tables
- raw API payloads and responses for invoke/jobs/dashboard
- raw Kafka request/result/error samples with matching request_id
- artifact paths, sizes, hashes, and log tails
- quality gate command outputs
- final pass/fail matrix + GO/NO-GO

## 18) Explicit Anti-Patterns (Prohibited)
- hardcoded UI values pretending to be live intelligence
- synthetic evaluation metrics using random values
- direct DB insertion of signoffs/promotion as a shortcut
- hidden fallback workflows that fake completion
- unprotected public tunnel endpoints in production path

## 19) Build Instruction to Claude
Implement directly from this document. No analysis-only response.
Return:
1. file-by-file diff summary
2. migration list
3. raw evidence pack
4. final GO/NO-GO against Section 16

## 20) World-Beating Scoring Rubric (0-100)
Score every category with raw evidence. No evidence = 0 for that line item.

## 20.1 Category Weights
1. Measurable Superiority vs Market: 25 points
2. Full Agent2.0 Integration Coverage: 20 points
3. Agentic Execution and Control Integrity: 15 points
4. SLM Training/Eval/Promotion Rigor: 20 points
5. Sovereign Reliability and Security: 10 points
6. Operational Outcome Impact: 10 points
Total: 100 points

## 20.2 Scoring Details
### A) Measurable Superiority vs Market (25)
- Compliance breach detection recall improvement vs baseline/peer benchmark: 8
- False positive rate reduction vs baseline/peer benchmark: 5
- Real-time intervention latency p95 improvement: 5
- Cost per 1,000 interactions improvement (infrastructure economics): 4
- External/blinded benchmark evidence quality: 3

### B) Full Agent2.0 Integration Coverage (20)
- Cases fully integrated with quality signals/actions: 4
- SOP runtime fully integrated with quality/policy feedback loops: 4
- Trainer module integrated with real coaching recommendations and outcomes: 4
- WFM/team leader/analytics integration producing real operational actions: 4
- No static/demo-only hardcoded quality surfaces in production path: 4

### C) Agentic Execution and Control Integrity (15)
- Human/Assist/Agentic modes functional across key workflows: 5
- Policy gates enforce autonomy constraints correctly: 4
- Mode changes and autonomous actions fully audited and reversible: 3
- Fraud/compliance escalation agents trigger reliably under policy: 3

### D) SLM Training/Eval/Promotion Rigor (20)
- 13/13 primitives with real training artifacts and traceability: 5
- Held-out inference evaluation with per-class metrics/confusion matrix: 5
- Authenticated specialist signoffs (required role matrix complete): 4
- Promotion decisions consistent with real gates/evidence (no contradictions): 3
- No synthetic/fabricated metric generation paths in promotion-critical logic: 3

### E) Sovereign Reliability and Security (10)
- Offline/private execution path proven (no mandatory external LLM): 4
- Kafka reliability proven (idempotency, retry, DLQ, replay): 3
- Security controls proven (tenant isolation, PII redaction, auth policies): 3

### F) Operational Outcome Impact (10)
- Reduction in escalations / compliance misses: 4
- Resolution speed/SLA improvement: 3
- Coaching effectiveness uplift (repeat-error reduction): 2
- Customer outcome lift (for example CSAT trajectory): 1

## 20.3 Grade Bands
- 90-100: World-Beating (GO for flagship positioning)
- 80-89: Enterprise-Strong (GO for production, not flagship claim)
- 70-79: Competitive (targeted rollout only)
- 60-69: Transitional (no broad claims)
- <60: Not ready (NO-GO)

## 20.4 Hard Claim Rule
You may only claim \"world-beating\" if:
1. Total score >= 90
2. Category A (Measurable Superiority) >= 20/25
3. Category D (SLM Rigor) >= 16/20
4. Category E (Sovereign Reliability/Security) >= 8/10
5. No Section 16 hard gate failures

## 20.5 Mandatory Output Format for Scoring Runs
Return:
1. Category score table with raw evidence references
2. Total score out of 100
3. Grade band
4. GO/NO-GO
5. If below world-beating threshold, exact delta-to-90 plan with owners and dates
