# 06 - Depth Model

The depth model determines whether a user's answer has enough substance to progress. Without this, the system becomes a survey. With it, the system behaves like a senior consultant.

## The depth scale

```
0  Nothing meaningful said                    ("yeah", "hmm")
1  Opinion / general statement                ("we need to grow")
2  Specific detail                            ("we need to hit £5M by next Q3")
3  Concrete example / evidence                ("last month we missed target by 20% because the
                                                enterprise deal we'd forecast since January
                                                slipped to Q1 after their CFO changed")
```

Progression rule: **the system does not leave a signal until depth reaches 3 AND an example has been provided.** These are evaluated independently because an answer can be very specific (depth 2) without giving an example (e.g. someone giving numbers but not narrating a concrete situation).

## Scoring approach

Depth scoring runs on each completed turn (on endpoint detection), not on partials.

Two evaluators:

1. **Deterministic pre-check** - cheap, runs first.
2. **LLM evaluator** - runs only if pre-check is ambiguous.

### Deterministic pre-check

```typescript
function preCheckDepth(turnText: string): { depth: 0 | 1 | 2 | 3 | 'ambiguous', exampleProvided: boolean } {
  const words = turnText.trim().split(/\s+/);

  // Depth 0: too short to contain meaning
  if (words.length < 4) return { depth: 0, exampleProvided: false };

  // Example indicators - strong signal of depth 3
  const EXAMPLE_MARKERS = [
    /\b(last|the other|recent(ly)?|yesterday|this (week|month|quarter|year))\b/i,
    /\bfor example\b/i,
    /\bfor instance\b/i,
    /\bwalked? (in|me) through\b/i,
    /\btook? (us|me) through\b/i,
    /\bthere was (this|a|one) (time|deal|moment|client|customer)\b/i
  ];
  const hasExampleMarker = EXAMPLE_MARKERS.some(rx => rx.test(turnText));

  // Specificity indicators - numbers, names, dates, proper nouns
  const hasNumber = /\b\d+([,.]\d+)?\s*(%|percent|k|m|million|thousand|quarters?|weeks?|months?|years?|days?|pounds?|dollars?|euros?)\b/i.test(turnText)
                  || /£\d+/.test(turnText) || /\$\d+/.test(turnText) || /€\d+/.test(turnText);
  const hasProperNoun = /\b[A-Z][a-z]{2,}(\s+[A-Z][a-z]+)*\b/.test(turnText); // rough, excludes first-word capitals
  const hasSpecificity = hasNumber || hasProperNoun;

  // Clear depth 3 = example marker present AND specificity
  if (hasExampleMarker && hasSpecificity) return { depth: 3, exampleProvided: true };

  // Likely depth 2 = specificity without example
  if (hasSpecificity && !hasExampleMarker) return { depth: 2, exampleProvided: false };

  // Likely depth 3 = example marker but no explicit number - ambiguous, needs LLM
  if (hasExampleMarker) return { depth: 'ambiguous', exampleProvided: true };

  // Ambiguous middle cases - defer to LLM
  return { depth: 'ambiguous', exampleProvided: false };
}
```

### LLM evaluator (for ambiguous cases)

Runs Haiku with a tight prompt. See `prompts/depth-scorer.md`.

Budget: 600ms timeout. On timeout, assume depth = 1 (forces a drill probe - safer than assuming depth = 3 and progressing prematurely).

Output schema:

```typescript
interface DepthScorerResponse {
  depth: 0 | 1 | 2 | 3;
  example_provided: boolean;
  reasoning: string;  // one sentence, for debug only
}
```

## Edge cases

### Long, rambling answers

User gives a 45-second answer covering multiple points. The turn may have depth 3 on one signal and depth 1 on another.

Resolution: score against the `currentSignal` specifically, not the whole utterance. If the utterance covered multiple signals, the probe engine picks up the unaddressed ones in subsequent turns.

### Emotional / evasive answers

User says "it's complicated" or "I'd rather not get into specifics". Depth pre-check returns ambiguous; LLM evaluator should return depth 1 with exampleProvided = false.

The probe engine should respond with a softer drill, not force the point. See probe generator prompt for guidance on emotional deflection.

### User already gave an example in a previous turn

Check `state.turns` for the current lens + signal combination. If an example was already provided and the current turn is a follow-up, the turn can progress on specificity alone (depth 2 acceptable if previous depth-3 example still holds).

### Short confirming answers

User responds "yes, exactly" to a probe that itself contained specific detail. The user's turn has depth 0 but they're confirming a depth-3 interpretation. Resolution: if the probe was a specific paraphrase and the user confirms, treat the confirmation as transferring the probe's depth to the user's turn.

This is an advanced case. For v1, simpler behaviour is acceptable: confirming answers trigger one follow-up for explicit example, then progress.

## Progression gate

```typescript
function canProgressLens(state: ConversationState): boolean {
  return state.depthScore >= 3 && state.exampleProvided === true;
}
```

This gate lives in the probe engine's commit decision logic (see doc 05). When false, the probe strategy must be `drill_depth` or `request_example` - never `transition_lens`.

## Avoiding the dead-end trap

Real conversations sometimes genuinely cannot produce an example. E.g. "we've never had a partner work out" - there's no positive example to give. Forcing a drill indefinitely makes the system feel hostile.

Safety valve: if a signal has been drilled for 4+ turns without reaching depth 3, the system:

1. Emits a meta-probe that acknowledges the absence explicitly: "So it sounds like there hasn't been a partnership that worked - what would one need to deliver to be worth doing?"
2. Treats this hypothetical-framing answer as depth 3 equivalent for progression purposes.
3. Marks the signal with `explored_without_example: true` in the insight record.

This is handled by the probe engine strategy selection, not the depth scorer. The depth scorer reports truthfully; the progression logic is where the safety valve fires.

## Testing

Unit tests should cover:

- 10 unambiguous depth-0/1/2/3 answers (ground truth labelled).
- 5 ambiguous cases requiring LLM evaluation.
- 3 emotional / evasive answers.
- 3 short confirming answers.
- The 4-turn safety valve trigger.

See `docs/10-testing.md`.
