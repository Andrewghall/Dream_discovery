# 01 - Architecture

## System diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (client)                        │
│                                                                 │
│   Mic ──► AudioWorklet ──► 16kHz PCM frames (100ms chunks)      │
│                                │                                │
│                                ▼                                │
│                          WebSocket (binary + JSON)              │
│                                │                                │
│   TTS Audio ◄── WebSocket ◄────┘                                │
│       │                                                         │
│       ▼                                                         │
│   AudioContext playback  ──► cancellable on mic activity        │
│                                                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ WebSocket (binary audio + JSON events)
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                      NODE.JS BACKEND (server)                   │
│                                                                 │
│   ┌─────────────┐    partial    ┌──────────────────┐            │
│   │  Deepgram   │──transcripts─►│ Endpoint Detector│            │
│   │  WebSocket  │               └────────┬─────────┘            │
│   └──────┬──────┘                        │                      │
│          │                               ▼                      │
│          │                    ┌─────────────────────┐           │
│          │                    │    State Engine     │           │
│          │                    │  (rolling context)  │           │
│          │                    └──────┬──────────────┘           │
│          │                           │                          │
│          │                           ├──► Signal Classifier     │
│          │                           │    (Haiku, fires on      │
│          │                           │     every partial)       │
│          │                           │                          │
│          │                           ├──► Probe Engine          │
│          │                           │    (Sonnet, speculative  │
│          │                           │     generation during    │
│          │                           │     speech)              │
│          │                           │                          │
│          │                           ├──► Depth Scorer          │
│          │                           │    (on endpoint)         │
│          │                           │                          │
│          │                           ▼                          │
│          │                  ┌──────────────────┐                │
│          │                  │   TTS Streaming  │                │
│          │                  │  (Deepgram Aura) │                │
│          │                  └────────┬─────────┘                │
│          │                           │                          │
│          │                           ▼                          │
│          │                      to browser                      │
│          │                                                      │
│          │       ┌─────────────────────────────────────┐        │
│          └──────►│    ASYNC CAPTURE PATH (parallel)    │        │
│                  │                                     │        │
│                  │  - Full audio saved to disk         │        │
│                  │  - Full transcript persisted        │        │
│                  │  - Diarisation applied              │        │
│                  │  - Post-session synthesis (Opus)    │        │
│                  │    produces structured insights     │        │
│                  └─────────────────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Two paths, one connection

Everything runs over one WebSocket between browser and server. The server maintains two internal paths:

1. **Live path** - every partial transcript flows through: state update → signal classification → speculative probe generation. This path must stay below 500ms total latency from utterance end to TTS first byte.
2. **Capture path** - runs in parallel, writes audio + transcript to disk, does not block the live path. Post-session synthesis runs after the session ends.

The live path never waits on the capture path. The capture path never waits on the live path.

## Data flow by event type

### `partial_transcript` (every 100-300ms during speech)

1. Deepgram emits interim result with `is_final: false`.
2. Server appends to `state.live_utterance`.
3. Server fires signal classifier (non-blocking, fire and forget - result updates state when it returns).
4. If signal classifier completes AND `state.live_utterance` is semantically complete enough to probe, server fires speculative probe generation (non-blocking).
5. Server sends `state_update` to client for UI debug panel (optional).

### `final_transcript` (Deepgram `is_final: true`)

1. Server appends finalised segment to `state.conversation_history[current_turn]`.
2. Server clears `state.live_utterance` for the finalised portion.
3. Does NOT trigger probe yet. Endpoint detection determines turn boundaries, not Deepgram's is_final.

### `endpoint_detected` (from endpoint detector, covered in doc 03)

1. Server evaluates depth score on the completed turn.
2. If depth < 3 OR no example given → commit the most recent speculative probe OR generate a targeted follow-up.
3. If depth >= 3 AND example given → generate lens-transition probe or close the lens.
4. Stream probe text to TTS, stream audio to client.

### `user_interrupt` (client detects mic activity while TTS playing)

1. Client immediately stops audio playback.
2. Client sends `interrupt` event to server.
3. Server cancels in-flight TTS stream.
4. Server treats the interrupt as a new turn start.

## Latency budget

Total budget from endpoint detection to TTS first audio byte: **500ms**.

| Stage | Budget | How we achieve it |
|-------|--------|-------------------|
| Endpoint detection | 0ms (already fired) | Dual endpointer |
| Probe commitment | 50ms | Probe was speculatively generated during speech, already in memory |
| TTS first byte | 250ms | Deepgram Aura streaming |
| Network to client | 50-150ms | WebSocket |
| Client buffering | 50ms | Minimal jitter buffer |
| **Total** | **~400-500ms** | |

If speculative probe was NOT ready at endpoint (e.g. user finished faster than expected), fallback path:

1. Commit state synchronously (~20ms)
2. Generate probe with Haiku, max_tokens=40 (~400-600ms first token)
3. Pipe directly to TTS

Fallback total: ~700-1000ms. Acceptable as a rare path, not a steady state.

## Why these technology choices

**Deepgram for STT:** Lowest time-to-first-partial in the market (~150ms), reliable interim results, UtteranceEnd feature specifically designed for turn detection in noisy environments. Andrew's hearing aids and any background noise in real discovery calls make VAD-only endpointing fragile - UtteranceEnd uses word-timing analysis and is robust to this.

**Claude Haiku 4.5 for signal classifier and probe generator:** The signal classifier runs on every partial (potentially 10+ times per turn). Haiku is fast and cheap enough to support this. For probe generation, Haiku's instruction following is sufficient for <40-token probes when given a tight prompt.

**Claude Opus 4.7 for post-session synthesis:** Synthesis is async and not latency-sensitive. Opus produces materially better structured output for the DREAM™ lens-tagged insights file.

**Deepgram Aura 2 for TTS:** Streaming TTS on the same network connection as STT. Sub-250ms time-to-first-byte. Natural prosody.

**Vanilla TypeScript for client:** No framework needed. The UI is minimal: a waveform, a transcript display, a debug panel. Adding React adds ~150KB and 200ms of first-paint latency for zero benefit at this stage. Port to your preferred framework later.

## What we explicitly do NOT build in v1

- Multi-user sessions / multi-tenant isolation (deferred to Agent 2.0 infra)
- Speaker diarisation in the live path (only in capture path, async)
- Language detection (English only for v1)
- Interruption recovery beyond "cancel TTS and restart turn"
- Persistent state across sessions (each session is standalone)
- Authentication (localhost only for v1, add auth before any internet deployment)
- Lens-transition logic (we implement lens scoring in v1; automatic transition in v2)
