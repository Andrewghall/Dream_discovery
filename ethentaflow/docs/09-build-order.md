# 09 - Build Order

This doc breaks the 8 phases from the README into explicit tasks Claude Code should execute in order. Each phase has an acceptance test. Do not advance to the next phase until the acceptance test passes.

## Phase 1 - Transport spine

**Goal:** Get raw audio flowing from mic to Deepgram, with partial transcripts printing server-side.

**Tasks:**
1. `server/package.json` - initialise, add deps: `ws`, `@deepgram/sdk`, `@anthropic-ai/sdk`, `dotenv`, `typescript`, `tsx`, `@types/node`, `@types/ws`.
2. `server/tsconfig.json` - strict, ES2022, NodeNext modules.
3. `server/src/index.ts` - Express-free HTTP server on PORT env, upgrade to WebSocket on `/ws`.
4. `server/src/deepgram.ts` - function `createDeepgramConnection(onPartial, onFinal, onUtteranceEnd, onSpeechStarted)`. Connect to Deepgram with config from doc 03. Keep-alive every 3 seconds.
5. Wire the WebSocket: on client audio frame, forward to Deepgram. On Deepgram events, console.log for now.
6. `client/package.json` - minimal, `vite` as dev dep.
7. `client/src/mic.ts` - `AudioWorklet` capture at 16kHz PCM, posting frames to main thread.
8. `client/src/ws.ts` - WebSocket to server, send binary audio frames.
9. `client/src/main.ts` - button to start/stop, minimal UI.

**Acceptance test:** Open the client, click start, say "one two three four five". Server console shows partial transcripts containing those words within 500ms of speaking them.

**Common traps:**
- Deepgram websocket needs `token` auth header, not `Bearer`.
- Sample rate mismatch produces garbled transcripts. Verify client is actually producing 16kHz.
- Browsers require HTTPS for mic access EXCEPT on localhost. Keep everything on localhost for v1.

## Phase 2 - Endpointing

**Goal:** Implement the dual-gate endpoint detector from doc 03.

**Tasks:**
1. `server/src/types.ts` - all types from docs 02 and 03.
2. `server/src/endpoint-detector.ts` - class `EndpointDetector` implementing the state machine from doc 03. Takes Deepgram events, emits `endpoint_detected` events.
3. Integrate into index.ts - on each Deepgram event, pass to detector. On `endpoint_detected`, console.log the finalised utterance.
4. Implement Gate C (prosodic + syntactic heuristic) as standalone pure function with unit tests.

**Acceptance test:** Run the 10-utterance battery from doc 10. Gate correctly fires on at least 8 of 10. ZERO cases where the gate fires before a complete thought (false positives are worse than false negatives here).

## Phase 3 - State engine

**Goal:** Rolling state, turn management, debug panel output.

**Tasks:**
1. `server/src/state-engine.ts` - `SessionState` class from doc 02.
2. Wire into index.ts - one SessionState per WebSocket connection.
3. On each Deepgram partial, update `liveUtterance`.
4. On each endpoint detection, create a Turn, append to history.
5. Throttled `state_update` emit to client (every 200ms max).
6. `client/src/ui.ts` - debug panel showing state object.

**Acceptance test:** Speak three complete utterances in a row. Debug panel shows three turns with correct transcripts, correct timestamps, and state resets correctly between turns (liveUtterance clears).

## Phase 4 - Signal classifier

**Goal:** Haiku running on partials, writing signals to state.

**Tasks:**
1. `prompts/signal-classifier.md` - from this repo, load at startup.
2. `server/src/signal-classifier.ts` - `classifyPartial(state, liveUtterance)` returning signals. Debouncing: one in-flight per session.
3. Wire into state engine - on each partial that extends liveUtterance meaningfully (+3 chars), dispatch classifier.
4. On classifier response, merge into signal stack with divergence check.
5. Extend debug panel to show current signal + stack.

**Acceptance test:** Say "I'm really not happy with the team - they just can't keep up with demand." Debug panel shows `people_issue` signal within 800ms of saying "team".

## Phase 5 - Probe engine

**Goal:** Speculative probe generation during speech, committed on endpoint.

**Tasks:**
1. `prompts/probe-generator.md` - full prompt.
2. `server/src/probe-engine.ts` - `generateProbe(state, strategy)` returning ProbeCandidate.
3. Speculative trigger: when signal classifier confirms a signal at confidence >= 0.7, start speculative generation.
4. Commit logic from doc 05 on endpoint detection.
5. Fallback templates from doc 05.
6. Post-validation (reject invalid probes).
7. Emit `probe_committed` event to client with text; display in UI.

**Acceptance test:** Say a vague statement ("we need to grow"). Within 300ms of pause, a probe appears on screen that asks for specificity. Probe is <22 words, single question, no filler.

## Phase 6 - TTS and barge-in

**Goal:** Voice loop complete. System speaks probes. User can interrupt.

**Tasks:**
1. `server/src/tts.ts` - Deepgram Aura streaming client. Function `synthesise(text, onAudio, abortSignal)`.
2. On probe commit, synthesise immediately, stream audio chunks to client over WebSocket.
3. `client/src/audio-playback.ts` - AudioContext-based chunk player with abort support.
4. Barge-in: client monitors mic input level during TTS playback. If level > threshold AND playback is active, send `interrupt` to server AND stop playback.
5. Server on `interrupt`: abort TTS stream, reset endpoint detector to LISTENING state.
6. Server-side barge-in: Deepgram SpeechStarted arrives while TTS playing - cancel TTS, same handling.

**Acceptance test:**
- Say a vague statement, system responds with probe. Audio plays within 500ms of pause.
- While system is speaking, start speaking yourself. System stops within 200ms.
- Audio quality is clean, no stuttering.

## Phase 7 - Depth model

**Goal:** Depth scoring blocks premature lens transitions. System drills shallow answers.

**Tasks:**
1. `prompts/depth-scorer.md` - full prompt.
2. `server/src/depth-scorer.ts` - deterministic pre-check + LLM fallback from doc 06.
3. On endpoint, run depth scorer against `currentSignal` specifically.
4. Progression gate in probe engine's commit decision.
5. Safety valve (4-turn limit) from doc 06.
6. Extend debug panel: show depth score, exampleProvided flag, progression-gate status.

**Acceptance test:**
- Say "we want to grow". System probes. Say "we want to grow a lot". System probes again (still depth 1-2, no example).
- Say "we want to double revenue to £10M by end of 2027". System probes for example.
- Say "our biggest deal last year was Barclays at £800K, I'd need four more like that". System progresses (depth 3, example provided).

## Phase 8 - Capture path

**Goal:** Persistence + post-session synthesis.

**Tasks:**
1. `server/src/capture.ts` - file writers for audio (ffmpeg child process), transcript jsonl, turns jsonl, probes jsonl.
2. Fan out audio: mic frames go to Deepgram AND to capture writer.
3. Metadata.json written at session start.
4. On WebSocket close or explicit end, trigger synthesis.
5. `prompts/session-synthesiser.md` - full prompt.
6. `server/src/synthesise.ts` - Opus call, produces session.json.
7. CLI tool `server/src/tools/synthesise.ts` for re-running synthesis on a recorded session.

**Acceptance test:** Run a 10-minute mock discovery. End session. Verify:
- `audio-user.webm` contains clean audio.
- `transcript.jsonl` has all finals with timestamps.
- `turns.jsonl` has all turns.
- `session.json` exists with structured insights, lens coverage, and recommended follow-ups.
- Insights cite specific turns and include verbatim evidence quotes.

## Ongoing (all phases)

- Logging: structured JSON logs to stdout, log level from env.
- Error handling: never crash the session on LLM errors; fall back to templates.
- Metrics: every turn records a latency breakdown (partial-to-endpoint, endpoint-to-probe, probe-to-first-audio) in the turn log. These let Andrew tune the system empirically.

## Deferred to v2

- Multi-tenant auth and session isolation
- Cloud deployment
- Multiple concurrent users
- Non-English languages
- Full diarisation in capture path
- Lens transition animations in UI
- Voice selection for TTS
- Custom wake word / explicit start/stop phrases
- Mid-session pause/resume
- Replay UI for recorded sessions
