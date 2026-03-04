# Agentic Runtime Gap Report

> Baseline audit of the Dream Discovery agentic runtime.
> Task 1 of 12 -- no functional code changes, exploration only.

---

## 1. Workshop Setup

### What Exists

| Component | File | Notes |
|-----------|------|-------|
| Workshop model | `prisma/schema.prisma` lines 110-167 | ~30+ fields including `dreamTrack`, `targetDomain`, `industry`, `engagementType` |
| Creation API | `app/api/admin/workshops/route.ts` | POST handler, assigns org, validates auth |
| Creation UI | `app/admin/workshops/new/page.tsx` | Multi-field form, domain pack selector |
| Domain Packs | `lib/domain-packs/registry.ts` | Partial blueprint: lenses, actor taxonomy, question templates, diagnostic outputs |
| Engagement Types | `lib/domain-packs/engagement-types.ts` | 5 types: DIAGNOSTIC_BASELINE, OPERATIONAL_DEEP_DIVE, AI_ENABLEMENT, TRANSFORMATION_SPRINT, CULTURAL_ALIGNMENT |
| Domain Pack Config | `Workshop.domainPackConfig` (JSON) | Snapshot of pack at creation time |
| Archetype Classifier | `lib/output/archetype-classifier.ts` | Deterministic scorer (post-synthesis only) |

### What Is Missing

- **Pre-built workshop blueprints/templates**: Domain packs cover lenses and question shapes but do not prescribe phase sequencing, agent pacing, section composition, or output structure before synthesis runs.
- **Blueprint-to-runtime binding**: No mechanism maps an engagement type or domain pack to a runtime configuration (which agents fire, in what order, with what constraints).
- **Archetype classification at setup time**: Classification only happens after hemisphere synthesis. Early classification could guide prep agent behaviour and section pre-selection.

### Files to Change

| File | Change |
|------|--------|
| `lib/domain-packs/registry.ts` | Extend pack definitions with runtime config (phase order, pacing hints, section weights) |
| `lib/domain-packs/engagement-types.ts` | Add runtime profile per engagement type |
| `lib/output/archetype-classifier.ts` | Add lightweight pre-classification from workshop metadata (before synthesis) |
| `prisma/schema.prisma` | Consider `runtimeProfile Json?` on Workshop if persistence needed |

### Risk Notes

- Domain pack registry is read at creation time and snapshot into `domainPackConfig`. Any schema change must be backward-compatible with existing snapshots.
- Retail snapshot workshop uses domainPackConfig; must not break on schema evolution.

---

## 2. Prep Orchestration

### What Exists

| Agent | File | Model | Iterations | Timeout |
|-------|------|-------|------------|---------|
| Prep Orchestrator | `lib/cognition/agents/prep-orchestrator.ts` | n/a (sequencer) | n/a | n/a |
| Research Agent | `lib/cognition/agents/research-agent.ts` | gpt-4o | 15 | 150s |
| Question Set Agent | `lib/cognition/agents/question-set-agent.ts` | gpt-4o-mini | 6 | 40s |
| Discovery Question Agent | `lib/cognition/agents/discovery-question-agent.ts` | gpt-4o-mini | 12 | 60s |
| Discovery Intelligence Agent | `lib/cognition/agents/discovery-intelligence-agent.ts` | gpt-4o-mini | 5 | 40s |
| Guardian Agent | `lib/cognition/agents/guardian-agent.ts` | gpt-4o-mini | 2 | 5s |
| Discover Analysis pipeline | `lib/discover-analysis/` (4 compute modules) | gpt-4o (narrative only) | n/a | n/a |

Supporting infrastructure:
- `lib/cognition/agents/agent-types.ts` -- PrepContext, AgentConversationCallback, FacilitationQuestion, SubQuestion
- `lib/cognition/guidance-state.ts` -- in-memory facilitator state (globalThis)
- Agent conversation SSE streaming via callback pattern

### What Is Missing

- **Playbook/blueprint system**: Prep orchestrator runs a fixed Research -> Question Set chain. No way to swap agent order, skip agents, or inject domain-specific agents per engagement type.
- **Cross-agent context sharing**: Each agent receives PrepContext but agents do not read each other's outputs mid-chain (Research output feeds Question Set, but no shared memory/context bus).
- **Pacing governance from blueprint**: Agent iteration counts and timeouts are hardcoded constants, not driven by workshop type or domain pack.
- **Conditional agent inclusion**: No mechanism to include/exclude agents based on workshop configuration (e.g., skip Discovery Intelligence Agent if no field capture data exists).

### Files to Change

| File | Change |
|------|--------|
| `lib/cognition/agents/prep-orchestrator.ts` | Replace fixed chain with blueprint-driven agent sequence |
| `lib/cognition/agents/research-agent.ts` | Read pacing config from PrepContext instead of hardcoded constants |
| `lib/cognition/agents/question-set-agent.ts` | Same: externalize iteration/timeout |
| `lib/cognition/agents/discovery-question-agent.ts` | Same |
| `lib/cognition/agents/discovery-intelligence-agent.ts` | Same |
| `lib/cognition/agents/agent-types.ts` | Extend PrepContext with runtime profile / pacing overrides |

### Risk Notes

- Research Agent is the most expensive call (gpt-4o, 15 iterations, 150s). Changing its pacing or toolset must be tested against the retail snapshot to verify output quality.
- Agent conversation callbacks stream to the UI in real time. Any chain restructuring must preserve SSE message ordering.

---

## 3. Discovery Runtime

### What Exists

| Component | File | Notes |
|-----------|------|-------|
| Stream A (remote/survey) | `app/api/admin/workshops/[id]/discover-analysis/route.ts` | 3-stage pipeline: deterministic -> GPT narrative -> confidence |
| Stream B (field capture) | `lib/field-discovery/capture-session-manager.ts` | CRUD for field sessions |
| Field Extraction | `lib/field-discovery/field-extraction-agent.ts` | GPT-4o-mini, extracts findings from transcripts |
| Synthesis Engine | `lib/field-discovery/synthesis-engine.ts` | Deterministic aggregation (no LLM) |
| Stream A Adapter | `lib/field-discovery/stream-a-adapter.ts` | Idempotent migration: Stream A -> Finding records |
| Findings Adapter | `lib/field-discovery/findings-to-analysis-adapter.ts` | Pure function: Finding -> DiscoverAnalysis |
| Alignment Compute | `lib/discover-analysis/compute-alignment.ts` | Domain alignment scoring |
| Narrative Compute | `lib/discover-analysis/compute-narrative.ts` | GPT-powered narrative generation |
| Confidence Compute | `lib/discover-analysis/compute-confidence.ts` | Statistical confidence scoring |
| Constraints Compute | `lib/discover-analysis/compute-constraints.ts` | Constraint extraction and categorisation |

### What Is Missing

- **Hardcoded 5-lens model**: Field extraction agent uses a fixed set of lenses (People, Customer, Technology, Organisation, Regulation). Domain packs define custom lenses but the field extraction agent does not consume them.
- **Hardcoded finding types**: `CONSTRAINT`, `OPPORTUNITY`, `RISK`, `CONTRADICTION` are fixed. Domain packs may need domain-specific finding categories.
- **Hardcoded severity thresholds**: Confidence and alignment scoring use static thresholds not tuneable per workshop type.
- **No blueprint-driven stream selection**: Both streams always available. Some engagement types may only need Stream A or only Stream B.

### Files to Change

| File | Change |
|------|--------|
| `lib/field-discovery/field-extraction-agent.ts` | Inject lenses from domain pack / workshop config instead of hardcoded list |
| `lib/discover-analysis/compute-alignment.ts` | Externalize threshold constants |
| `lib/discover-analysis/compute-confidence.ts` | Same |
| `lib/discover-analysis/compute-constraints.ts` | Accept finding type schema from config |
| `app/api/admin/workshops/[id]/discover-analysis/route.ts` | Read runtime profile to decide which compute stages to run |

### Risk Notes

- Stream A adapter is idempotent and guards against double-migration. Changes to finding type schema must preserve this invariant.
- Retail snapshot has 1019 nodes across both streams. Any changes to lens or finding type processing must be verified against this dataset.
- `LensSource` tracking (`research_dimensions | domain_pack | generic_fallback`) was recently fixed; lens injection must preserve this hierarchy.

---

## 4. Live Runtime (Cognitive Guidance)

### What Exists

| Component | File | Notes |
|-----------|------|-------|
| Guidance Page | `app/admin/workshops/[id]/cognitive-guidance/page.tsx` | ~1300 lines, "Peeling the Onion" two-level question model |
| Deterministic Pipeline | `lib/cognitive-guidance/pipeline.ts` | 5 stages: categorise -> lens map -> signal detect -> pad generate -> journey build |
| Guidance State | `lib/cognition/guidance-state.ts` | In-memory state (globalThis), per-workshop |
| Facilitation Orchestrator | `lib/cognition/agents/facilitation-orchestrator.ts` | 6-tool loop, pacing governance |
| Facilitation Agent | `lib/cognition/agents/facilitation-agent.ts` | 3 iterations, 8s, generates sticky pads |
| Theme Agent | `lib/cognition/agents/theme-agent.ts` | Theme clustering and tracking |
| Constraint Agent | `lib/cognition/agents/constraint-agent.ts` | Constraint identification during live |
| Journey Completion | `lib/cognition/agents/journey-completion-agent.ts` | 13 gap types, completion scoring |
| Journey Enrichment | `lib/cognition/agents/journey-enrichment-agent.ts` | AI agency + intensity scoring |

Pacing constants (all hardcoded in facilitation-orchestrator.ts):
- `MIN_EMISSION_INTERVAL_MS` = 120s
- `PAD_GENERATION_INTERVAL_MS` = 45s
- `PAD_UTTERANCE_THRESHOLD` = 6

### What Is Missing

- **Hardcoded phase sequence**: `SYNTHESIS -> REIMAGINE -> CONSTRAINTS -> DEFINE_APPROACH` is fixed. Some engagement types may skip phases or reorder them.
- **Hardcoded seed pads**: 6 seed pads per phase with fixed text and types. These should come from the domain pack or blueprint.
- **Hardcoded journey stages**: `Discovery, Engagement, Commitment, Fulfilment, Support, Growth` is a generic customer journey. Domain packs could supply domain-specific stages.
- **Hardcoded pacing constants**: Emission intervals and utterance thresholds are not tuneable per workshop type or facilitator preference.
- **Hardcoded signal types**: `repeated_theme`, `missing_dimension`, `contradiction`, etc. are fixed in the pipeline. Domain-specific signal types are not supported.
- **No blueprint-driven agent selection**: All agents run for all workshops. Some engagement types may not need journey agents or constraint agents.

### Files to Change

| File | Change |
|------|--------|
| `app/admin/workshops/[id]/cognitive-guidance/page.tsx` | Read phase sequence from runtime profile; generate seed pads from config |
| `lib/cognitive-guidance/pipeline.ts` | Accept signal type registry and journey stages from config |
| `lib/cognition/agents/facilitation-orchestrator.ts` | Read pacing constants from PrepContext / runtime profile |
| `lib/cognition/agents/facilitation-agent.ts` | Scope pad generation to blueprint constraints |
| `lib/cognition/agents/journey-completion-agent.ts` | Accept journey stage schema from config |
| `lib/cognition/agents/journey-enrichment-agent.ts` | Same |
| `lib/cognition/guidance-state.ts` | Store runtime profile reference in state |

### Risk Notes

- The "Peeling the Onion" model (main questions + sub-questions) is partially implemented. Phase sequence changes must not conflict with the ongoing two-level question work.
- Guidance state is in-memory (globalThis). Runtime profile must be lightweight enough to store alongside existing state.
- Pacing constants directly affect facilitator experience. Changes should be A/B tested or at minimum validated against a live session recording.

---

## 5. Cross-Cutting Concerns

### Hardcoded Values Inventory (Priority)

| Location | Hardcoded Value | Proposed Source |
|----------|----------------|-----------------|
| `facilitation-orchestrator.ts` | MIN_EMISSION_INTERVAL_MS=120000 | Runtime profile |
| `facilitation-orchestrator.ts` | PAD_GENERATION_INTERVAL_MS=45000 | Runtime profile |
| `facilitation-orchestrator.ts` | PAD_UTTERANCE_THRESHOLD=6 | Runtime profile |
| `research-agent.ts` | MAX_ITERATIONS=15, TIMEOUT=150000 | Runtime profile |
| `question-set-agent.ts` | MAX_ITERATIONS=6, TIMEOUT=40000 | Runtime profile |
| `cognitive-guidance/page.tsx` | Phase sequence array | Domain pack / engagement type |
| `cognitive-guidance/page.tsx` | Seed pads per phase (6 each) | Domain pack / blueprint |
| `pipeline.ts` | Journey stages array | Domain pack |
| `pipeline.ts` | Signal type enum | Extensible registry |
| `field-extraction-agent.ts` | 5-lens array | Domain pack lenses |
| `compute-alignment.ts` | Alignment thresholds | Runtime profile |
| `compute-confidence.ts` | Confidence thresholds | Runtime profile |

### What a "Runtime Profile" Would Contain

```
RuntimeProfile {
  phaseSequence: string[]
  pacingConfig: { emissionInterval, padInterval, utteranceThreshold }
  agentChain: { agentId, enabled, iterationLimit, timeout }[]
  journeyStages: string[]
  signalTypes: string[]
  lensOverrides: string[] | null
  sectionWeights: Record<string, number>
  findingTypes: string[]
  thresholds: Record<string, number>
}
```

This profile would be composed at workshop creation from:
1. Engagement type defaults
2. Domain pack overrides
3. Facilitator customisations (future)

### Backward Compatibility Strategy

- All existing workshops have no runtime profile. The system must fall back to current hardcoded defaults when profile is absent.
- Domain pack config snapshots in existing workshops must remain valid.
- Retail snapshot (1019 nodes) must produce identical output before and after changes.

---

## 6. Summary

**Total files requiring changes**: ~20 across 4 runtime layers
**New abstractions needed**: RuntimeProfile type, blueprint composer, agent chain executor
**Highest risk area**: Live runtime pacing (directly affects facilitator UX)
**Lowest risk area**: Threshold externalisation (pure config, no logic change)
**Recommended starting point**: Define RuntimeProfile type and compose it from existing domain pack + engagement type data, with hardcoded fallbacks for all fields.
