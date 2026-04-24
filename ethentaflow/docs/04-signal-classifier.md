# 04 - Signal Classifier

The signal classifier is a small, fast LLM call that runs on every Deepgram partial. Its job: identify GTM discovery signals as they emerge, not after the sentence completes.

## Signal taxonomy

Ten signals, mapped to lenses:

| Signal | Lens | Example trigger |
|--------|------|-----------------|
| `people_issue` | people | "team not working", "can't find people", "culture problem" |
| `growth_goal` | commercial | "want to grow", "scale", "double revenue" |
| `icp_definition` | commercial | "our customers", "we sell to", "ideal client" |
| `channel_problem` | commercial | "leads are", "marketing isn't", "pipeline dry" |
| `constraint` | operations | "blocker", "can't", "stuck on", "slow" |
| `partnership` | partners | "partner", "reseller", "channel", "alliance" |
| `tech_gap` | technology | "our systems", "platform doesn't", "integration" |
| `operational_friction` | operations | "process breaks", "manual work", "handoff" |
| `commercial_model` | commercial | "pricing", "margins", "contract length" |
| `market_position` | commercial | "competitors", "differentiator", "positioning" |

Lens mapping is NOT 1:1. A `people_issue` can surface inside a commercial conversation. The classifier returns the signal; the state engine decides the lens.

## When it runs

- On every Deepgram partial transcript event, debounced to max one in-flight call per 300ms.
- If a new partial arrives while a classification is in flight, queue the newest and discard any intermediate.
- On endpoint detection (final pass) to catch anything missed.

## Model and config

```typescript
model: 'claude-haiku-4-5-20251001'
max_tokens: 150
```

Do NOT set temperature or top_p (Opus 4.7 rejects non-default values; Haiku accepts them but we keep the pattern uniform for future migration).

## Prompt

See `prompts/signal-classifier.md` for the full prompt. Summary:

- System prompt establishes GTM discovery context and the ten-signal taxonomy.
- User message contains:
  - Conversation history (last 3 turns, compact).
  - Current live utterance (possibly incomplete).
- Response format: strict JSON, parsed with fallback to empty array on parse failure.

## Response schema

```typescript
interface ClassifierResponse {
  signals: Array<{
    type: SignalType;
    confidence: number;          // 0-1
    source_span: string;         // the phrase that triggered it, verbatim from utterance
    reasoning?: string;          // brief, for debugging - not required
  }>;
}
```

If the classifier returns no signals, that's fine. Many partials will contain no signal.

## Latency expectations

Haiku 4.5 on a 150-token output with a ~400-token input (system + history + utterance):
- p50 first token: ~200ms
- p50 full response: ~400ms
- p95 full response: ~800ms

With debouncing, we run at most ~3 classifications per second per session. Cost: ~$0.003 per discovery session (50 partials classified at Haiku pricing).

## Why Haiku, not a local classifier

A keyword matcher or small embedding classifier would be faster and cheaper. We do not use one because:

1. DREAM™ discovery surfaces signals via indirect language. "I don't sleep at night worrying about our Q4 pipeline" is a `channel_problem` signal with zero keyword overlap.
2. Context matters. "Our people are amazing" is not a `people_issue`; "our people are amazing but we're burning them out" is.
3. We need graceful handling of incomplete partials. Haiku handles "my team isn't really perfor—" correctly; keyword matchers can't infer intent from fragments.

A future optimisation is to distill Haiku's behaviour into a local SLM for Agent 2.0 sovereign deployment. Not for v1.

## Divergence handling

When a classification returns, check whether the utterance it was classifying is still the current live utterance:

```typescript
if (
  response.triggeredAtUtterance === state.snapshot().liveUtterance
  || isPrefix(response.triggeredAtUtterance, state.snapshot().liveUtterance)
) {
  // apply result
} else {
  // utterance has moved on, discard result
}
```

"isPrefix" = the triggering utterance is a strict prefix of the current one (the user continued speaking, didn't restart).

## Confidence thresholds

- Below 0.4: discard, do not add to signal stack.
- 0.4 - 0.7: add to stack but mark `tentative: true`; do not trigger probe generation on this alone.
- Above 0.7: confirmed signal, triggers probe generation if no probe is already pending for this signal.

## Testing

Unit-test the classifier in isolation with recorded utterances and expected signals. See `docs/10-testing.md`.
