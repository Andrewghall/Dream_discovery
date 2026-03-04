# Blueprint Runtime Handoff

## Scope
This handoff covers Task 11 (test hardening) and Task 12 (final validation and release handoff) for the blueprint-driven workshop runtime.

Date: 2026-03-04
Branch intent: pre_live only

## Architecture Summary
The runtime is now centered on a workshop blueprint that is composed during setup and consumed across prep, discovery, and live execution:

1. Setup captures industry, track, engagement, domain pack, purpose, outcomes, and optional diagnostic context.
2. Blueprint composition defines lenses, journey stage template, actor taxonomy, question policy, pacing, signal policy, and confidence rules.
3. Prep orchestration reads blueprint constraints for question generation and sufficiency framing.
4. Discovery runtime uses three-tier question resolution:
   - discoveryQuestions
   - blueprint-derived questions
   - legacy fixed fallback
5. Live runtime consumes blueprint constraints for facilitator flow, pad progression, journey behavior, and event handling.
6. Contact-centre historical metrics utilities exist under historical metrics modules and tests.

## End-to-End Data Flow
1. Workshop creation/update persists workshop context and blueprint-compatible fields.
2. Guidance state stores blueprint plus runtime fields (coverage threshold, journey completion state, etc.).
3. Prep routes generate discovery briefing and live workshop question sets from available evidence and blueprint constraints.
4. Conversation init/message resolve discovery question sets in priority order and record participant evidence.
5. Live transcript processing emits typed events (classification, pads, journey, agent conversation) used by facilitator runtime.
6. Journey and pad state logic apply coverage and progression rules while preserving replay/dedup behavior.

## Dynamic vs Fallback Behavior
Dynamic behavior:
- Lenses, phase ordering, and question constraints can come from blueprint.
- Live facilitation/pad logic can react to runtime events and journey mutations.
- Coverage thresholds are configurable and persisted.
- Historical metrics modules normalize/validate imported series for diagnostics.

Fallback behavior:
- If discovery interviews are absent, prep reports data insufficiency and proceeds with reduced evidence.
- If blueprint is missing/invalid, runtime falls back to legacy defaults.
- If external dependencies fail in some subsystems (for example rate limit backend), graceful fallback paths are preserved and tested.

## Validation Results
Commands executed:
- `npx tsc --noEmit`
- `npx vitest run __tests__/integration/blueprint-composition.test.ts __tests__/integration/blueprint-live-runtime.test.ts __tests__/integration/fixed-questions-blueprint.test.ts __tests__/integration/lens-bleed-prevention.test.ts __tests__/integration/sufficiency-gating.test.ts __tests__/integration/workshop-blueprint-generator.test.ts __tests__/integration/question-set-blueprint.test.ts __tests__/unit/historical-metrics`
- `npm run test:run`

Results:
- TypeScript: PASS
- Targeted blueprint/sufficiency/historical metrics suites: PASS (341 tests)
- Full suite: PASS (42 files, 780 tests)

Blocking failures: none.
Unrelated pre-existing failures: none in current local run.

## Rollout Steps
1. Ensure branch is `pre_live` before merge/deploy.
2. Apply database migrations required by blueprint and metrics schema updates.
3. Deploy API and app changes together to avoid blueprint schema drift.
4. Verify post-deploy smoke path:
   - create workshop
   - run prep orchestration
   - open live session
   - confirm blueprint-constrained questions/lenses appear
5. Validate contact-centre metric upload and normalization in pre-live environment.
6. Monitor live events and logs for sufficiency and contradiction signals.

## Rollback Steps
1. Revert to prior pre_live deployment artifact.
2. Disable blueprint-dependent runtime toggles if partial rollback is needed.
3. Keep data intact; do not delete blueprint/metrics records during rollback.
4. If migration rollback is required, use a prepared down migration only after snapshot backup.
5. Re-run smoke tests on reverted build for workshop create, prep, and live session.

## Known Limits
1. Some tests intentionally log expected errors to stderr while asserting graceful handling.
2. Blueprint invalid JSON paths are handled with fallback and warning logs.
3. Legacy fallback remains active for workshops lacking blueprint state.
