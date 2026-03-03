# Prompt / Model / Orchestration Change Checklist

Every change to a system prompt, model selection, orchestration flow, or agent tool schema **must** follow this checklist before merging to `pre-live`.

---

## 1. Before you start

- [ ] Describe the change in one sentence:
  > _e.g. "Switch discovery agent from GPT-4o to GPT-4o-mini" or "Add plan-coverage lens to facilitation prompt"_
- [ ] Capture the baseline drift snapshot:
  ```bash
  npm run eval:drift
  ```
  Record the snapshot filename: `_________________________________`

## 2. Baseline scores

Run `npm run eval:drift` on the **current** `pre-live` HEAD and fill in:

| Suite | Score | Threshold | Pass |
|-------|-------|-----------|------|
| Discovery | ___/100 | 80 | Y/N |
| Sales | ___/100 | 80 | Y/N |

## 3. Make the change

- [ ] Change is isolated to prompt/model/orchestration only (no unrelated code changes in the same commit)
- [ ] No hard-coded values introduced (API keys, model names read from config/env)
- [ ] Existing test interfaces preserved (no breaking type changes)

## 4. After scores

Run `npm run eval:drift` on your branch **after** the change and fill in:

| Suite | Before | After | Delta | Threshold | Pass |
|-------|--------|-------|-------|-----------|------|
| Discovery | ___/100 | ___/100 | ___ | 80 | Y/N |
| Sales | ___/100 | ___/100 | ___ | 80 | Y/N |

Record the after snapshot filename: `_________________________________`

## 5. Rollback criteria

A change **must be reverted** if any of these are true:

- [ ] Any suite drops below its threshold (80)
- [ ] Any suite score drops by more than 5 points
- [ ] Any previously passing sentiment/intent match starts failing
- [ ] A new penalty (sentimentPenaltyApplied, intentPenaltyApplied, themeMissedPenaltyApplied, topicMissedPenaltyApplied) appears on a case that was penalty-free before

If any box above is checked, **do not merge**. Fix the regression or revert.

## 6. Test gate

- [ ] `npm run test:agentic` passes (29/29)
- [ ] `npm run test:security` passes (92/92)
- [ ] `npm run eval:drift` exits 0

## 7. PR requirements

- [ ] PR title prefixed with `[prompt]`, `[model]`, or `[orchestration]`
- [ ] PR body includes the before/after table from step 4
- [ ] PR body includes both snapshot filenames (before and after)
- [ ] PR body explains **why** the change is expected to be safe or beneficial

## 8. Reviewer sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Code reviewer | | | [ ] |
| Domain reviewer (discovery or sales owner) | | | [ ] |

Both sign-offs required before merge. Reviewer must verify:

1. Before/after scores are filled in and accurate
2. No rollback criteria triggered
3. Change rationale is sound
4. Test gate is green in CI

---

## Quick reference

| Command | Purpose |
|---------|---------|
| `npm run test:agentic` | Run eval test assertions (pass/fail gate) |
| `npm run eval:drift` | Score suites and write timestamped snapshot |
| `npm run test:security` | Run security regression suite |

See [AGENTIC_EVALS.md](./AGENTIC_EVALS.md) for rubric weights, penalty mechanics, and case inventories.

---

## Deterministic execution policy

All agentic eval scoring is fully deterministic (no model calls in the rubric). Temperature/seed policies apply only to live agent calls, not the eval framework. Eval results must be identical across runs given the same fixtures and rubric code. No randomness exists in scoring functions.

## Changelog

All prompt, model, orchestration, rubric, and fixture changes must be logged here (most recent first).

| Date | Change | Impact | Author |
|------|--------|--------|--------|
| 2026-03-03 | Added 6 adversarial cases per track (discovery + sales) | Score maintained at 100, coverage expanded to 28 discovery + 21 sales | Claude |
| 2026-03-03 | Changelog and deterministic execution policy added | N/A | Claude |
