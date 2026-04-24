# 05 - Probe Engine

The probe engine generates the next question. It runs speculatively during the user's speech, so the probe is ready the moment they finish. This is how we achieve sub-250ms response after endpoint.

## Two generation paths

### Speculative path (normal)

Trigger: signal classifier returns a confirmed signal (confidence >= 0.7) AND no probe is currently pending for that signal.

1. Snapshot current state.
2. Compose probe prompt with snapshot.
3. Fire Haiku call, max_tokens=40.
4. On completion, check divergence:
   - If liveUtterance still matches (or extends) the snapshot trigger, write result to `state.pendingProbe`.
   - If it has diverged meaningfully, discard.
5. On endpoint detection, if `state.pendingProbe` is valid and appropriate, commit it.

### Synchronous fallback (rare)

Trigger: endpoint detected but no valid `pendingProbe` in state.

1. Run probe generation synchronously with Haiku.
2. Stream result directly to TTS without waiting for full completion.
3. Accept the ~500-800ms latency cost.

## Model and config

```typescript
model: 'claude-haiku-4-5-20251001'
max_tokens: 40                  // hard cap on probe length
stop_sequences: ['\n\n', '?']   // stop at first question mark
```

40 tokens is ~30 words. Our target is 8-18 words per probe, so this leaves headroom without allowing rambling.

## Probe strategies

The probe engine must select one of four strategies based on state:

### `drill_depth` (most common)

Current depth < 3. User gave opinion or general statement. Probe asks for specificity.

- Triggers: depthScore in {1, 2}, exampleProvided = false.
- Prompt guidance: "Ask for specificity or a concrete example of what they just said."
- Examples:
  - User: "We need to grow faster." → "How much faster, and by when?"
  - User: "The team's struggling." → "Which part of the team, and what does struggling look like?"

### `request_example` (second most common)

Depth at 2 but no concrete example yet.

- Triggers: depthScore = 2, exampleProvided = false.
- Prompt guidance: "Ask for a specific recent example of what they described."
- Examples:
  - User: "Sales cycles have been longer recently." → "Can you walk me through your most recent long cycle?"
  - User: "We're losing deals on price." → "Tell me about the last deal you lost on price."

### `redirect` (sometimes)

User has raised a signal but wandered off-topic. Probe returns to the signal.

- Triggers: currentSignal exists but last 2 turns didn't address it.
- Prompt guidance: "Bring them back to the [signal] they raised earlier. Reference their own words."

### `transition_lens` (rare, on depth completion)

Depth >= 3 AND exampleProvided. Current lens is sufficiently explored.

- Triggers: depthScore = 3, exampleProvided = true, and either (a) lens coverage > 0.6 or (b) lens has >= 2 insights.
- Prompt guidance: "Naturally transition to a different area that connects to what they just said. Do not announce the transition."
- Examples:
  - After a deep people discussion: "When that capability gap shows up in sales cycles, what does the commercial impact look like?"

## Probe rules (enforced in prompt AND post-validated)

Every probe must:

1. **Be one question.** No compound questions with "and" joining two asks.
2. **Be 6-20 words.** Short enough to feel conversational, long enough to carry nuance.
3. **Reference their language.** If they said "scaling", probe uses "scaling", not "growth".
4. **Not acknowledge or compliment.** No "great point", "I see", "interesting". Start on the question.
5. **Not be closed.** Avoid yes/no structure. Open questions only (what, how, when, where, tell me, walk me through).
6. **Not ask them to define jargon.** Treat their jargon as legitimate; drill into examples instead.

Post-validation: after Haiku returns, a deterministic check rejects probes that:
- Contain " and " as a conjunction before another question mark.
- Start with filler tokens ("So,", "Great,", "Okay,", "I see,").
- Exceed 22 words (2-word grace over the soft cap).
- End with "?" more than once (compound questions).

Rejected probes fall back to a deterministic template from the probe library below.

## Fallback probe templates

Deterministic, signal-keyed. Used when Haiku returns an invalid probe or when fallback timing is critical.

```typescript
const FALLBACK_PROBES: Record<SignalType, { drill: string; example: string }> = {
  people_issue: {
    drill: "What specifically about the team isn't working?",
    example: "Tell me about a recent moment when that became obvious."
  },
  growth_goal: {
    drill: "What does that growth actually look like in numbers?",
    example: "What's the biggest single thing standing between you and that number?"
  },
  icp_definition: {
    drill: "Who buys from you most consistently, and why them?",
    example: "Walk me through your last three closed deals."
  },
  channel_problem: {
    drill: "Where exactly does the lead flow break down?",
    example: "Tell me about the last month of pipeline."
  },
  constraint: {
    drill: "What's actually blocking it, in concrete terms?",
    example: "When did you last hit that block?"
  },
  partnership: {
    drill: "What would a good partner actually deliver for you?",
    example: "Tell me about the partnership that worked best, and what made it work."
  },
  tech_gap: {
    drill: "Which part of the stack is the real bottleneck?",
    example: "Walk me through a workflow that breaks today."
  },
  operational_friction: {
    drill: "Where does the handoff actually fall over?",
    example: "Describe what happened the last time that went wrong."
  },
  commercial_model: {
    drill: "What about the commercial model isn't landing?",
    example: "Tell me about a deal where the pricing became the problem."
  },
  market_position: {
    drill: "Who do you actually lose to, and why?",
    example: "Describe the last deal you lost to a competitor."
  }
};
```

These are the "never worse than this" floor. Haiku-generated probes should outperform them by referencing the user's specific language, but the fallback guarantees the system always has something appropriate to say.

## Prompt

See `prompts/probe-generator.md` for the full prompt. It includes:

- DREAM™ discovery context and Andrew's interviewing style.
- The four strategies with worked examples.
- The six rules above as explicit constraints.
- A slot for conversation history and current state.
- Required output format (just the probe, no preamble).

## Commit decision logic

On endpoint detection:

```typescript
function selectProbe(state: ConversationState): ProbeCandidate {
  const pending = state.pendingProbe;

  // No pending probe - synchronous fallback path
  if (!pending) {
    return generateSyncProbe(state);
  }

  // Pending probe is stale
  if (Date.now() - pending.generatedAt > 8000) {
    return generateSyncProbe(state);
  }

  // Depth was insufficient and pending probe is a transition - override
  if (state.depthScore < 3 && pending.strategy === 'transition_lens') {
    return generateSyncProbe(state, { forceStrategy: 'drill_depth' });
  }

  // Depth complete and pending probe is drilling - override to transition
  if (state.depthScore >= 3 && state.exampleProvided && pending.strategy === 'drill_depth') {
    return generateSyncProbe(state, { forceStrategy: 'transition_lens' });
  }

  return pending;
}

function generateSyncProbe(state, opts = {}): ProbeCandidate {
  // Haiku call with max 800ms budget; on timeout use fallback template
  // ...
}
```

## Cost

Per session (30-turn discovery, ~90 speculative fires, ~30 committed probes):
- Speculative generations (most discarded): ~90 × 500 input tokens × $1/M = $0.045
- Committed probes: negligible incremental (same as speculative count)
- Fallback syncs: ~2 per session × 500 tokens × $1/M = $0.001
- Signal classifier: ~$0.003 (from doc 04)

Total per session: ~$0.05. Immaterial at any volume Ethenta will run.
