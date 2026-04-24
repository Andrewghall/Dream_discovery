# 10 - Testing

Test batteries for each component. These are not exhaustive - they are the minimum coverage to validate v1 behaves correctly.

## Endpoint detection - 10-utterance battery

Read each utterance naturally, with the described pause. System should correctly classify whether a turn end was detected.

| # | Utterance | Pause behaviour | Expected result |
|---|-----------|-----------------|-----------------|
| 1 | "We've been running the sales team with four people for two years." | End cleanly, wait 2s. | Turn ends at sentence end. |
| 2 | "So the thing is... (800ms pause) ...we just can't find good engineers." | Mid-sentence pause. | NO turn end during pause. Turn ends after final word. |
| 3 | "Yes." | Crisp, end. | Turn ends within 800ms. |
| 4 | "We're growing fast and the team can't keep up and we're losing deals because of it." | Run-on, no commas, end clean. | Single turn, ends after "it". |
| 5 | "I think maybe we should, um, think about, uh, what the priorities are." | Filler-heavy thinking out loud. | One turn. No premature end during "ums". |
| 6 | "It's complicated." | Short declarative. | Turn ends. |
| 7 | "Well, we did try a partnership last year but it didn't really go anywhere because" (1.5s pause) "they couldn't deliver what they promised." | Long pause after "because" (continuation marker). | NO turn end during pause. One turn total. |
| 8 | "The CFO changed in Q2, then Q3 we restructured, and now we're rebuilding the commercial team from scratch." | Multiple clauses, one sentence. | One turn, ends after "scratch". |
| 9 | "Yeah, exactly." | Two-word agreement. | Turn ends. |
| 10 | "Our biggest deal was a £2 million contract with a regional bank in early 2025." | Specific, factual. | Turn ends cleanly. |

**Pass threshold:** 8 of 10 correct. ZERO cases where system cuts off during utterances 2, 5, or 7 (thinking pauses).

## Signal classifier - labelled utterance set

```typescript
const SIGNAL_CLASSIFIER_TESTS = [
  {
    utterance: "The sales team just doesn't have the right capability for enterprise deals.",
    expected: [{ type: 'people_issue', minConfidence: 0.7 }]
  },
  {
    utterance: "We need to triple revenue over the next 18 months.",
    expected: [{ type: 'growth_goal', minConfidence: 0.7 }]
  },
  {
    utterance: "Our best customers tend to be mid-market manufacturers with 500 to 2000 employees.",
    expected: [{ type: 'icp_definition', minConfidence: 0.7 }]
  },
  {
    utterance: "Lead flow from outbound has basically died since the start of this year.",
    expected: [{ type: 'channel_problem', minConfidence: 0.7 }]
  },
  {
    utterance: "We can't move forward until the compliance piece is sorted.",
    expected: [{ type: 'constraint', minConfidence: 0.6 }]
  },
  {
    utterance: "We're thinking about bringing on a reseller network in Germany.",
    expected: [{ type: 'partnership', minConfidence: 0.7 }]
  },
  {
    utterance: "Our CRM doesn't talk to the billing system, so everything's manual.",
    expected: [
      { type: 'tech_gap', minConfidence: 0.7 },
      { type: 'operational_friction', minConfidence: 0.6 }
    ]
  },
  {
    utterance: "Customers keep pushing back on our pricing model.",
    expected: [{ type: 'commercial_model', minConfidence: 0.7 }]
  },
  {
    utterance: "We're losing deals to a startup who claim they're cheaper and faster.",
    expected: [
      { type: 'market_position', minConfidence: 0.7 },
      { type: 'commercial_model', minConfidence: 0.5 }
    ]
  },
  {
    utterance: "The weather's been terrible this week.",
    expected: []  // no signal
  }
];
```

**Pass threshold:** Each expected signal detected at or above its minConfidence. No false positives on the negative-control utterance (#10).

## Depth scorer - labelled turns

```typescript
const DEPTH_SCORER_TESTS = [
  { turn: "Yeah.", expected: { depth: 0, exampleProvided: false } },
  { turn: "We need to grow faster.", expected: { depth: 1, exampleProvided: false } },
  { turn: "We need to grow revenue by about 40% over the next year.", expected: { depth: 2, exampleProvided: false } },
  {
    turn: "Last quarter we missed target by 20% because our biggest enterprise prospect, Barclays, pushed the deal to this year after their CFO changed.",
    expected: { depth: 3, exampleProvided: true }
  },
  {
    turn: "Our team in Lisbon is great, but we've been trying to hire senior engineers for eight months and haven't made a single offer stick.",
    expected: { depth: 3, exampleProvided: true }
  },
  { turn: "It's really complicated and I'd rather not get into it.", expected: { depth: 1, exampleProvided: false } },
  { turn: "Pretty much, yeah.", expected: { depth: 0, exampleProvided: false } },
  {
    turn: "Our ICP is mid-market financial services in the UK, though we do some work in Ireland too.",
    expected: { depth: 2, exampleProvided: false }
  },
  {
    turn: "Take last Thursday - we had three different teams on the same client call because nobody owns the account end-to-end.",
    expected: { depth: 3, exampleProvided: true }
  },
  {
    turn: "Things are good.",
    expected: { depth: 1, exampleProvided: false }
  }
];
```

**Pass threshold:** Depth score within ±0 on 8 of 10, within ±1 on all 10. `exampleProvided` correct on all 10.

## Probe quality rubric

A probe is acceptable if ALL these hold:

- 6-20 words (strict).
- Exactly one question mark.
- No filler openings ("Great,", "Interesting,", "So,", "Okay,", "I see,").
- Uses a word or phrase from the user's last utterance.
- Asks for either specificity or an example.
- Is open (not yes/no).

Generate 10 probes against 10 different user utterances. Score each on the rubric. Pass threshold: all 6 criteria met on 8 of 10 probes.

## Full voice loop smoke test

Script a 5-turn discovery:

1. Operator: says a vague opener ("we're trying to figure out our GTM").
2. System: probes for specifics.
3. Operator: gives a general growth goal.
4. System: drills for number.
5. Operator: gives a specific number.
6. System: asks for example.
7. Operator: gives an example.
8. System: transitions to a different lens via bridge probe.

Measure:
- Time from each operator pause to system's first audio: target p50 < 500ms, p95 < 900ms.
- Zero system interruptions of mid-sentence speech.
- Barge-in tested at least twice: system stops within 200ms.
- Final session.json has at least 2 insights with evidence.

## Performance testing

Not a priority for v1, but useful to establish baselines:

- CPU usage during active session: should be under 10% on a MacBook Pro.
- Memory usage: should be stable (no growth over 30-minute session).
- Network: WebSocket throughput ~32KB/s outbound (16kHz * 16-bit mono), similar inbound during TTS.

## Regression tests before any production-adjacent use

These are not needed for v1 demo but ARE needed before putting this in front of a client:

- 20-minute session stability (no dropped connections).
- Graceful handling of Deepgram WebSocket disconnect and reconnect.
- Graceful handling of Anthropic API 429 / 529 errors.
- Graceful handling of network loss on client side.
- Session recovery after crash.
