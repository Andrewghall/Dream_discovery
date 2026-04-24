# 03 - Endpoint Detection

This is the most important component in the system. Get this wrong and the system either interrupts the user or feels sluggish. Both are fatal.

## The problem

"Has the user finished speaking?" has no single-signal answer. Possible signals:
- Silence duration (simple, but fails on thinking pauses and noisy environments)
- Falling pitch at end of phrase (prosodic, usually reliable)
- Syntactic completeness (the sentence parses as complete)
- Semantic completeness (the thought is complete)
- Deepgram's speech_final flag (fires on VAD-detected silence threshold)
- Deepgram's UtteranceEnd event (fires on word-timing gap, robust to noise)

Using any single signal fails. We combine three.

## The approach: dual-gate endpointing

A turn end fires ONLY when gate A AND (gate B OR gate C) are true.

**Gate A - Minimum silence:** at least 400ms since last finalised word (`lastWordAt`).
- Prevents firing mid-word on network jitter.
- Prevents firing during rapid speech with brief micro-pauses.

**Gate B - Deepgram UtteranceEnd:** received from Deepgram's `utterance_end_ms=1000` config.
- Reliable in clean audio.
- Word-timing-based, robust to background noise.

**Gate C - Prosodic + syntactic completeness:** our own heuristic (see below).
- Fires faster than UtteranceEnd when the utterance is clearly complete.
- Allows sub-1-second turn detection on short, clearly-terminated utterances.

## Deepgram configuration

```
wss://api.deepgram.com/v1/listen
  ?model=nova-3
  &encoding=linear16
  &sample_rate=16000
  &channels=1
  &interim_results=true
  &endpointing=300
  &utterance_end_ms=1000
  &vad_events=true
  &smart_format=true
  &punctuate=true
  &language=en-GB
```

Notes:
- `endpointing=300` - Deepgram will mark `speech_final: true` after 300ms of VAD-detected silence. We treat this as a hint, not the turn end.
- `utterance_end_ms=1000` - Deepgram sends a separate `UtteranceEnd` JSON event after 1000ms word-timing gap. This is Gate B.
- `vad_events=true` - gives us SpeechStarted events for barge-in detection.
- `language=en-GB` - change per deployment. DREAM™ is currently British English.

## Gate C: prosodic + syntactic completeness heuristic

Implemented entirely server-side, no extra API calls. Runs on every finalised Deepgram segment (`is_final: true`).

An utterance is "likely complete" when:

1. **Ends with sentence-final punctuation** after smart_format (`.`, `?`, `!`), AND
2. **The final word is not a common continuation marker** (excluded: "and", "but", "so", "because", "or", "then", "also", "plus", "which", "that", "who", "when", "where", "if"), AND
3. **The utterance is at least 3 words long** (filter out "yeah", "okay" one-word responses - those ARE complete, handled separately), AND
4. **Word-rate analysis doesn't indicate the user is still actively forming thought:**
   - Compute rolling word-gap over last 5 words.
   - If average gap > 300ms AND last gap > 500ms, the user was slowing down (likely ending).
   - If average gap < 200ms, the user was in full flow (probably not ending despite punctuation).

One-word responses ("yes", "no", "okay", "sometimes", "maybe") bypass this and fire Gate C immediately after 400ms silence (Gate A). These are legitimate complete turns in conversation.

### Pseudocode

```typescript
function evaluateGateC(segment: FinalisedSegment, recentWords: WordTiming[]): boolean {
  const text = segment.text.trim();

  // Short responses - bypass structural checks
  const SHORT_COMPLETE = /^(yes|no|yeah|nope|okay|ok|sure|maybe|sometimes|exactly|right|correct|wrong|absolutely|never|always)\.?$/i;
  if (SHORT_COMPLETE.test(text)) return true;

  // Must end in sentence-final punctuation
  if (!/[.?!]$/.test(text)) return false;

  const words = text.split(/\s+/);
  if (words.length < 3) return false;

  // Last word must not be a continuation marker
  const CONTINUATION = new Set([
    'and', 'but', 'so', 'because', 'or', 'then', 'also', 'plus',
    'which', 'that', 'who', 'when', 'where', 'if', 'though',
    'although', 'however', 'therefore', 'moreover'
  ]);
  const lastWord = words[words.length - 1].replace(/[.?!]$/, '').toLowerCase();
  if (CONTINUATION.has(lastWord)) return false;

  // Word-rate analysis
  if (recentWords.length >= 5) {
    const last5 = recentWords.slice(-5);
    const gaps = [];
    for (let i = 1; i < last5.length; i++) {
      gaps.push(last5[i].start - last5[i-1].end);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const lastGap = gaps[gaps.length - 1];

    // If user is accelerating (short gaps), probably not ending
    if (avgGap < 0.2) return false;

    // If user is slowing down (long last gap), strong end signal
    if (avgGap > 0.3 && lastGap > 0.5) return true;
  }

  return true; // structural checks passed, no word-rate contra-indication
}
```

## The endpoint detector state machine

```
    [LISTENING] ──user speaks──► [ACTIVE_SPEECH]
        ▲                              │
        │                              │ silence >= 400ms (Gate A)
        │                              ▼
        │                       [PENDING_END]
        │                              │
        │                              ├── Gate B fires ──► [TURN_ENDED]
        │                              ├── Gate C fires ──► [TURN_ENDED]
        │                              └── user resumes ──► back to ACTIVE_SPEECH
        │
        └── turn processed, probe emitted ────┐
                                              │
                                         [SYSTEM_SPEAKING]
                                              │
                              mic activity OR │ system finishes
                                   barge-in   │
                                              ▼
                                         [LISTENING]
```

## Timing tuning

Default config (start here, tune per user):

```typescript
const ENDPOINT_CONFIG = {
  gateA_minimumSilenceMs: 400,
  gateB_utteranceEndMs: 1000,        // Deepgram setting
  gateC_evaluationIntervalMs: 50,    // how often to re-check Gate C
  thinkingPauseGraceMs: 1200,        // if Gate A + Gate B alone, wait extra
  shortResponseGraceMs: 0,           // one-word responses commit instantly after Gate A
};
```

**Why 400ms for Gate A:** Natural conversation has 200-400ms inter-turn gaps. 400ms is below the threshold at which silence feels awkward to the speaker but above the threshold of typical within-sentence pauses.

**Why 1000ms for Gate B:** Deepgram's own recommendation. Below 1000ms it produces too many false positives on thinking pauses. Above 1500ms it feels laggy.

**The thinking-pause grace:** If Gate A is satisfied but Gate C did not fire (ambiguous), wait up to an additional 1200ms for Gate B before firing. This lets thoughtful speakers finish without being cut off.

## Barge-in detection

When the system is speaking (TTS playing), barge-in fires when:
- Deepgram SpeechStarted event arrives (via `vad_events=true`), AND
- SpeechStarted is more than 200ms after the most recent TTS audio frame was sent to client.

The 200ms debounce prevents the system's own audio (picked up by an open mic) from triggering barge-in. If the user runs with headphones, this debounce could be reduced to 50ms. Detect via client sending a `using_headphones: true` hint.

On barge-in:
1. Cancel TTS stream immediately (abort server-side, tell client to stop audio).
2. Clear `pendingProbe`.
3. Return to ACTIVE_SPEECH state. The user's new utterance is a fresh turn.

## Anti-patterns to avoid

- **Do not use silence duration alone.** It fails on noise and punishes thoughtful speakers.
- **Do not use Deepgram's `speech_final` as the turn end.** It fires too eagerly (300ms silence) and will cut users off.
- **Do not wait for Deepgram's `is_final` on every segment before deciding.** Interim results are sufficient for Gate C; waiting adds latency.
- **Do not use a single timer.** The state machine above must handle transitions explicitly.
- **Do not forget the "user resumes" transition out of PENDING_END.** Without it, users who pause-then-continue get cut off.

## Testing

See `docs/10-testing.md` for the 10-utterance test battery. Minimum pass threshold: 8/10 correct turn detections, zero cases where the system interrupts a complete thought.
