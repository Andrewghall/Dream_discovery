# 02 - State Engine

The state engine is the single source of truth for conversation context. Every other component reads from it and writes to it. It is in-memory per session; there is no database in the live path.

## State shape

```typescript
interface ConversationState {
  // Session metadata
  sessionId: string;
  startedAt: number;              // epoch ms
  participantName?: string;

  // Live speech in progress
  liveUtterance: string;           // accumulating partial transcript for current turn
  lastPartialAt: number;           // epoch ms of last Deepgram partial
  lastWordAt: number;              // epoch ms of last finalised word

  // Current turn context
  currentLens: Lens;               // which of 5 lenses we are exploring
  currentSignal: Signal | null;    // primary signal detected in this turn
  signalStack: Signal[];           // all signals detected in current utterance, ordered by confidence
  depthScore: 0 | 1 | 2 | 3;       // 0=nothing said, 1=opinion, 2=specific, 3=example
  exampleProvided: boolean;

  // Speculative work in progress
  pendingProbe: ProbeCandidate | null;   // probe prepared during speech, not yet committed
  pendingProbeGeneratedAt: number;       // when we started generating
  pendingProbeTriggerUtterance: string;  // utterance snapshot that triggered this probe

  // History
  turns: Turn[];                   // all completed turns in session
  insights: Insight[];             // extracted, lens-tagged, evidence-backed statements
  lensScores: Record<Lens, LensScore>;   // accumulated understanding per lens
}

type Lens = 'people' | 'commercial' | 'partners' | 'technology' | 'operations' | 'open';

interface Signal {
  type: SignalType;
  confidence: number;              // 0-1
  detectedAt: number;              // epoch ms
  sourceSpan: string;              // the phrase that triggered it
}

type SignalType =
  | 'people_issue'
  | 'growth_goal'
  | 'icp_definition'
  | 'channel_problem'
  | 'constraint'
  | 'partnership'
  | 'tech_gap'
  | 'operational_friction'
  | 'commercial_model'
  | 'market_position';

interface Turn {
  turnId: string;
  startedAt: number;
  endedAt: number;
  speaker: 'user' | 'system';
  finalTranscript: string;
  lens: Lens;
  signalsDetected: Signal[];
  depthScore: number;
  exampleProvided: boolean;
  probeAskedAfter: string | null;  // the probe the system asked following this turn
}

interface ProbeCandidate {
  text: string;
  targetSignal: SignalType;
  strategy: 'drill_depth' | 'request_example' | 'redirect' | 'transition_lens';
  generatedBy: 'haiku_speculative' | 'haiku_sync' | 'template_fallback';
  tokenLatencyMs: number;
}

interface Insight {
  insightId: string;
  lens: Lens;
  signal: SignalType;
  statement: string;               // the insight, rewritten to stand alone
  evidence: string;                // the user's exact words that support it
  confidence: number;              // system's confidence the insight is well-grounded
  extractedAt: number;
}

interface LensScore {
  coverage: number;                // 0-1, how thoroughly explored
  depthReached: number;            // max depth score achieved in this lens
  insightCount: number;
  lastTouchedAt: number;
}
```

## State update rules

### On `partial_transcript` event

```
state.liveUtterance = accumulated partial text
state.lastPartialAt = now()
```

**No other state changes on partials.** Signal classifier runs async and writes to state.signalStack when it returns. Probe engine runs async and writes to state.pendingProbe when it returns.

### On signal classifier completion

```
if (result.signals.length > 0) {
  state.signalStack = mergeSignals(state.signalStack, result.signals)
  state.currentSignal = state.signalStack[0]  // highest confidence
}
```

`mergeSignals` deduplicates by type, keeping the highest-confidence instance.

### On probe engine completion (speculative)

```
if (state.liveUtterance still matches the utterance that triggered this generation) {
  state.pendingProbe = result
  state.pendingProbeGeneratedAt = now()
}
// If utterance has meaningfully diverged, discard the probe.
```

"Meaningfully diverged" = Levenshtein distance between triggerUtterance and current liveUtterance > 15 chars, OR current utterance has introduced a new signal not in the trigger's signal stack.

### On `endpoint_detected` event

```
1. Copy liveUtterance + any trailing finalised Deepgram segment into a new Turn.
2. Run depth scorer on the Turn.finalTranscript.
3. state.depthScore = depthScore result
4. state.exampleProvided = exampleProvided result
5. Append Turn to state.turns
6. Extract insights if depth >= 2 (see below)
7. Decide next action:
   - if depth >= 3 AND exampleProvided → commit pendingProbe if transition-appropriate, else generate transition probe
   - if depth < 3 OR NOT exampleProvided → commit pendingProbe if it targets depth, else generate drill probe
8. Clear liveUtterance, signalStack, currentSignal, pendingProbe
```

### Insight extraction trigger

Extract an insight when ALL of these are true:
- Turn's depth score >= 2
- Turn contains a specific claim, number, name, or example
- The claim can be rewritten to stand alone without "I" / "we" dependency

Run insight extraction through Haiku with the prompt in `prompts/session-synthesiser.md` (turn-level variant).

## Concurrency model

All state mutations happen on a single async queue per session. The state object is NOT shared across sessions. Each WebSocket connection gets its own state.

```typescript
class SessionState {
  private state: ConversationState;
  private mutationQueue: Promise<void> = Promise.resolve();

  async mutate(fn: (s: ConversationState) => Promise<void> | void) {
    this.mutationQueue = this.mutationQueue.then(() => fn(this.state));
    return this.mutationQueue;
  }

  snapshot(): ConversationState {
    return structuredClone(this.state);
  }
}
```

All writes go through `mutate`. All reads that need consistency use `snapshot` (immutable). Fire-and-forget async work (signal classifier, probe generator) reads a snapshot at dispatch time, then uses `mutate` to write results back with the divergence check above.

## Why a signal stack, not a single signal

Real discovery utterances carry multiple signals. Example:

> "We're growing really fast, but the sales team can't keep up, and honestly our lead flow has been drying up since Q3."

This contains: `growth_goal`, `people_issue`, `channel_problem`. A single-slot `currentSignal` forces a choice the system shouldn't make. The stack preserves all three with confidence scores; the probe engine chooses which to drill based on recency, confidence, and lens priority.

Order in the stack:
1. Most recently detected
2. Within recency, highest confidence
3. Within confidence, most aligned with currentLens

## Lens state machine

There is NO forced order through lenses. The currentLens updates based on what the user raises, not based on a script.

Lens transitions happen when:
- Depth reached >= 3 AND exampleProvided AND probe engine generates a `transition_lens` strategy probe
- User explicitly redirects ("can we talk about the tech stack?")
- Lens has been open for >6 turns without progress (force transition)

Default starting lens: `open`. The first real signal detected promotes to its natural lens.

## Debug panel output

Emit `state_update` WebSocket events to the client at most every 200ms (throttled). Client shows:
- Current lens
- Current signal (with confidence)
- Depth score (0-3)
- Example provided (yes/no)
- Pending probe (if any, show text)
- Signal stack (top 3)

This is not end-user UI. It's a developer view for building and demoing.
