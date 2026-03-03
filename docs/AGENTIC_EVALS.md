# Agentic Evals

## Purpose
This evaluation layer provides deterministic regression checks for agentic output quality before prompt/logic/model changes are merged.

## What Is Evaluated
Current scope: discovery agentic output benchmark + sales agentic output benchmark.

Rubric dimensions:
1. Sentiment correctness (exact match)
2. Domain overlap (Jaccard)
3. Theme overlap (Jaccard)
4. Confidence inside expected range

Weighted score:
- sentiment: 30%
- domains: 35%
- themes: 30%
- confidence range: 5%

## Data
Gold benchmark cases live in:
- `__tests__/fixtures/agentic/discovery-gold-cases.json` (22 discovery cases)
- `__tests__/fixtures/agentic/sales-gold-cases.json` (15 sales cases)

Each case contains:
1. expected labels/domains/themes/confidence range (discovery) or intent/tone/topics/coaching/deal-health (sales)
2. prediction payload (current benchmark output)

## Running

Run agentic evals locally (test assertions):

```bash
npm run test:agentic
```

## Drift Monitoring

Run the drift monitor to score both suites and write a timestamped JSON snapshot:

```bash
npm run eval:drift
```

Snapshots are written to `.agentic-evals/snapshots/` (gitignored). Each file records:

- Timestamp and git ref/branch
- Per-suite overall score, threshold, pass/fail, case count
- Any individual cases scoring below the suite threshold
- Overall gate result

Compare snapshots over time to detect gradual score drift before it crosses a threshold.

Script: `scripts/drift-monitor.ts` (runs via `vite-node` for alias resolution).

## CI Gate

Workflow: `.github/workflows/agentic-evals.yml`

### Triggers

| Event | Branches |
|-------|----------|
| `pull_request` | `pre-live`, `main` |
| `push` | `pre-live` |

### Gate behavior

1. Runs `vitest run __tests__/agentic` with verbose + JSON reporters.
2. Both discovery and sales suites must pass for the gate to pass.
3. If any test fails the workflow exits non-zero and blocks the PR merge.
4. A structured summary prints at the end of every run (pass or fail) showing per-suite status, test counts, and thresholds.
5. Failed tests are annotated with `::error::` so they surface in the GitHub PR checks tab.

### Thresholds

| Suite | Threshold | Enforced in |
|-------|-----------|-------------|
| Discovery | 80 | `__tests__/agentic/discovery-rubric.test.ts` |
| Sales | 80 | `__tests__/agentic/sales-rubric.test.ts` |

Threshold changes are governance changes and require review.

## Case Inventory (28 cases: 22 standard + 6 adversarial)

| # | Case ID | Sentiment | Domains | Theme Count | Edge Case |
|---|---------|-----------|---------|-------------|-----------|
| 1 | case-ops-friction | concerned | operations, people, technology | 3 | |
| 2 | case-customer-positive | positive | customer, operations | 3 | |
| 3 | case-risk-critical | critical | regulation, risk | 3 | |
| 4 | case-tech-debt-concerned | concerned | technology, operations | 4 | |
| 5 | case-culture-positive | positive | people, culture | 3 | |
| 6 | case-finance-neutral | neutral | finance, operations | 3 | |
| 7 | case-strategy-positive | positive | strategy, innovation | 3 | |
| 8 | case-regulation-neutral | neutral | regulation | 2 | Single domain |
| 9 | case-people-critical | critical | people, operations | 3 | |
| 10 | case-innovation-positive | positive | technology, innovation | 3 | |
| 11 | case-customer-churn-concerned | concerned | customer, operations | 4 | |
| 12 | case-multi-domain-critical | critical | operations, technology, people, risk | 4 | 4+ domains |
| 13 | case-single-domain-neutral | neutral | finance | 2 | Single domain |
| 14 | case-minimal-themes | neutral | operations | 1 | Single theme |
| 15 | case-high-confidence | positive | customer, strategy | 3 | High confidence (0.85-0.99) |
| 16 | case-low-confidence | concerned | people, operations | 2 | Low confidence (0.35-0.65) |
| 17 | case-ops-neutral | neutral | operations, technology | 3 | |
| 18 | case-people-engagement-concerned | concerned | people, culture | 3 | |
| 19 | case-tech-upgrade-positive | positive | technology | 3 | Single domain |
| 20 | case-risk-neutral | neutral | risk, regulation | 3 | |
| 21 | case-customer-critical | critical | customer, risk | 3 | |
| 22 | case-superset-prediction | concerned | operations | 3 | Superset prediction (Jaccard penalty) |
| 23 | adv-sarcasm-positive-surface | critical | operations, people | 3 | Adversarial: positive surface masking critical |
| 24 | adv-ambiguous-domain-overlap | concerned | finance, strategy | 3 | Adversarial: ambiguous domain boundaries |
| 25 | adv-contradictory-signals | neutral | people, operations | 4 | Adversarial: mixed positive/negative themes |
| 26 | adv-jargon-heavy-tech | concerned | technology | 3 | Adversarial: dense jargon domain confusion |
| 27 | adv-emotion-masking-critical | critical | risk, regulation, finance | 3 | Adversarial: formal language masking severity |
| 28 | adv-zero-overlap-themes | positive | innovation | 2 | Adversarial: narrow domain stability |

### Coverage summary

- **Sentiments**: 7 positive, 7 neutral, 8 concerned, 6 critical
- **Domains**: 10 unique - operations, people, customer, technology, regulation, risk, finance, strategy, innovation, culture
- **Edge cases**: single domain (3), single theme (1), 4+ domains (1), high confidence (1), low confidence (1), superset prediction (1)
- **Adversarial drift cases**: 6 (sarcasm masking, domain ambiguity, contradictory signals, jargon confusion, emotion masking, narrow vocabulary)

---

## Sales Eval Track

### Rubric dimensions
1. Customer intent correctness (exact match)
2. Sentiment tone correctness (exact match)
3. Topic overlap (Jaccard with recall penalty)
4. Coaching accuracy (triggered flag + priority match)
5. Deal health correctness (exact match)
6. Confidence inside expected range

### Weighted score
- intent: 25%
- sentiment: 15%
- topics: 25%
- coaching: 15%
- deal health: 15%
- confidence range: 5%

### Penalties
- **Intent mismatch**: 0.5x final score multiplier (caps at ~38 with everything else perfect)
- **Missing topic recall**: topic component scaled by (1 - 0.5 * recall deficit), same pattern as discovery themes

### Coaching scoring
| Gold triggered | Pred triggered | Priority match | Score |
|----------------|----------------|----------------|-------|
| true | true | yes | 1.0 |
| true | true | no | 0.5 |
| true | false | n/a | 0.0 |
| false | false | n/a | 1.0 |
| false | true | n/a | 0.5 |

## Sales Case Inventory (21 cases: 15 standard + 6 adversarial)

| # | Case ID | Intent | Sentiment | Topics | Coaching | Deal Health | Edge Case |
|---|---------|--------|-----------|--------|----------|-------------|-----------|
| 1 | sales-discovery-exploring | exploring | neutral | needs, decision_process | none | Warm | |
| 2 | sales-demo-interested | interested | positive | needs, buying_signal | low | Warm | |
| 3 | sales-objection-pricing | objecting | concerned | objection, budget | high | Cool | |
| 4 | sales-ready-to-close | ready_to_buy | positive | buying_signal, timeline, decision_process | medium | Hot | |
| 5 | sales-cold-outreach-neutral | neutral | neutral | other | none | Cold | |
| 6 | sales-competitor-mention | hesitant | concerned | competition, objection | high | Cool | |
| 7 | sales-budget-confirmed | ready_to_buy | positive | budget, timeline, buying_signal | low | Hot | |
| 8 | sales-multi-stakeholder | exploring | neutral | decision_process, needs, timeline | medium | Warm | |
| 9 | sales-technical-concerns | objecting | critical | objection, needs | high | Cool | |
| 10 | sales-expansion-opportunity | interested | positive | needs, buying_signal, budget | medium | Hot | |
| 11 | sales-stalling-deal | hesitant | neutral | timeline, decision_process | high | Cool | |
| 12 | sales-champion-building | interested | positive | decision_process, needs, buying_signal | low | Warm | |
| 13 | sales-lost-deal-signals | objecting | critical | competition, objection, budget | high | Cold | |
| 14 | sales-needs-discovery-deep | exploring | positive | needs, timeline | none | Warm | |
| 15 | sales-single-topic-minimal | neutral | neutral | other | none | Cold | Low confidence, single topic |
| 16 | adv-mixed-intent-signals | hesitant | neutral | needs, objection, budget | high | Cool | Adversarial: mixed interest/objection |
| 17 | adv-false-urgency-buyer | exploring | positive | needs, timeline | medium | Warm | Adversarial: urgency without buying signals |
| 18 | adv-passive-aggressive-objection | objecting | concerned | competition, objection, decision_process | high | Cold | Adversarial: polite masking objection |
| 19 | adv-ghost-deal-engaged | neutral | positive | needs, other | medium | Cold | Adversarial: engaged but no purchase intent |
| 20 | adv-coaching-edge-borderline | interested | neutral | needs, decision_process | low | Warm | Adversarial: borderline coaching signal |
| 21 | adv-deal-health-inversion | interested | positive | buying_signal, timeline, budget | medium | Warm | Adversarial: hot signals but timeline delay |

### Sales coverage summary

- **Intents**: 4 interested, 4 exploring, 3 hesitant, 4 objecting, 2 ready_to_buy, 4 neutral
- **Sentiments**: 8 positive, 7 neutral, 3 concerned, 3 critical
- **Topics**: 8 unique - needs, budget, timeline, competition, decision_process, objection, buying_signal, other
- **Deal health**: 3 Hot, 7 Warm, 5 Cool, 6 Cold
- **Coaching**: 3 no coaching, 4 low, 5 medium, 9 high
- **Adversarial drift cases**: 6 (mixed intent, false urgency, passive-aggressive, ghost deal, borderline coaching, deal health inversion)

## Prompt Change Safety

Any change to a system prompt, model selection, or orchestration flow must follow the checklist in [AGENTIC_PROMPT_CHANGE_CHECKLIST.md](./AGENTIC_PROMPT_CHANGE_CHECKLIST.md). Key rules:

1. Capture before/after drift snapshots (`npm run eval:drift`).
2. Revert if any suite drops below threshold or falls more than 5 points.
3. Two reviewer sign-offs required (code + domain owner).

## How To Extend
1. Add more gold cases for new domains/use-cases.
2. Add new rubric dimensions only if they are deterministic and stable.
3. Keep thresholds explicit in test files.
4. Treat threshold changes as governance changes requiring review.
