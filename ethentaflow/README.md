# EthentaFlow

Real-time conversational intelligence for GTM discovery.

Not a chatbot. Not a transcription tool. A streaming, stateful conversational agent that understands before the speaker finishes, responds instantly on pause, and drills to depth before progressing.

## What this repo contains

A complete specification plus starter code for Claude Code to build against. Every file here is either a spec Claude Code should implement against, or scaffolding Claude Code should extend.

## Build sequence

Claude Code should build in this order. Do not skip ahead. Each phase produces something testable before moving on.

1. **Phase 1 - Transport spine.** Mic capture in browser, WebSocket to backend, Deepgram streaming connection, partial transcripts logged to console. No intelligence yet. Success: you speak, partial transcripts print server-side within 300ms.
2. **Phase 2 - Endpointing.** Implement the dual endpoint detector (Deepgram UtteranceEnd + prosodic completion heuristic). Success: system correctly distinguishes "thinking pause" from "finished speaking" in at least 8 of 10 test utterances.
3. **Phase 3 - State engine.** Build the rolling state object, turn manager, and conversation history. Success: state updates visible in debug panel as user speaks.
4. **Phase 4 - Signal classifier.** Small classifier (Haiku) running on partial transcripts. Success: signals light up in debug panel as relevant words are spoken, not after.
5. **Phase 5 - Probe engine.** Claude Sonnet generates the next probe speculatively during speech, commits on endpoint. Success: probe appears on screen within 200ms of endpoint detection.
6. **Phase 6 - TTS and barge-in.** Stream probe audio back via Deepgram Aura or ElevenLabs. Cancel immediately if user starts speaking. Success: full voice loop, barge-in works.
7. **Phase 7 - Depth model.** Score each answer 1-3. Block progression until depth >= 3 with example. Success: system re-probes shallow answers until specific example is given.
8. **Phase 8 - Capture path.** Async recording, diarisation, post-session synthesis via Claude Opus. Success: session file written to disk with insights extracted.

## Repo layout

```
ethentaflow/
  README.md                          <- you are here
  docs/
    01-architecture.md               <- system overview, data flow
    02-state-engine.md               <- state object, update rules
    03-endpoint-detection.md         <- dual endpointing, prosodic logic
    04-signal-classifier.md          <- signal taxonomy, classifier spec
    05-probe-engine.md               <- speculative probe generation
    06-depth-model.md                <- scoring, progression rules
    07-capture-path.md               <- async recording, synthesis
    08-lens-flow.md                  <- five lenses, natural ordering
    09-build-order.md                <- detailed phase-by-phase
    10-testing.md                    <- how to test each piece
  prompts/
    signal-classifier.md             <- exact prompt for Haiku
    probe-generator.md               <- exact prompt for Sonnet
    depth-scorer.md                  <- exact prompt for depth scoring
    session-synthesiser.md           <- exact prompt for Opus post-synthesis
  server/                            <- Node.js backend skeleton
    package.json
    src/
      index.ts                       <- entry point
      deepgram.ts                    <- Deepgram streaming client
      endpoint-detector.ts           <- dual endpointing logic
      state-engine.ts                <- rolling conversation state
      signal-classifier.ts           <- Haiku signal detection
      probe-engine.ts                <- Sonnet probe generation
      depth-scorer.ts                <- depth evaluation
      tts.ts                         <- TTS streaming
      capture.ts                     <- async recording path
      types.ts                       <- shared types
  client/                            <- browser skeleton
    package.json
    src/
      main.ts                        <- entry
      mic.ts                         <- mic capture, audio streaming
      ws.ts                          <- WebSocket client
      audio-playback.ts              <- TTS playback + barge-in
      ui.ts                          <- minimal UI
```

## Stack (locked)

- **Backend**: Node.js 22+, TypeScript, ws, Deepgram SDK
- **STT**: Deepgram Nova-3 streaming (interim_results + UtteranceEnd)
- **Fast LLM (signal classifier, probe generator)**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Deep LLM (session synthesis, depth scoring on edge cases)**: Claude Opus 4.7 (`claude-opus-4-7`)
- **TTS**: Deepgram Aura 2 (streaming) - keeps the whole voice loop on one vendor and same network path
- **Frontend**: Vanilla TypeScript + Vite. No framework for v1. Single page.
- **Recording**: Browser MediaRecorder for the audio, stored server-side

**Note on the LLM decision.** The original discussion considered OpenAI Realtime for latency. We are NOT using OpenAI Realtime. Reasons:
- The probe engine is not latency-critical in the way a general voice agent is. Probes are pre-computed during speech, not generated on endpoint. By the time the user pauses, the probe is already ready.
- Claude Haiku 4.5 returns first token in ~200-400ms for short outputs. With speculative generation during partials, the probe is ready before endpoint fires.
- Keeping the entire stack on Anthropic + Deepgram simplifies auth, observability, and eventual portability into Agent 2.0's sovereign infrastructure.
- Claude's instruction-following on DREAM™ methodology is materially better for nuanced probe generation than GPT-class models in testing.

## Environment variables

Create `.env` in both `/server` and do NOT commit it:

```
ANTHROPIC_API_KEY=sk-ant-...
DEEPGRAM_API_KEY=...
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug
```

## Success criteria for v1

The system passes v1 when all of these are true in a live demo:

1. User speaks continuously for 10 seconds. Partial transcripts visible on screen within 300ms of speech start.
2. User pauses mid-thought for 600ms. System does NOT interrupt. User continues. System correctly recognises continuation.
3. User finishes a complete thought. System responds within 250ms of endpoint detection.
4. User gives a vague answer ("we want to grow"). System probes for specificity, does not progress.
5. User interrupts system mid-response. System stops speaking within 150ms.
6. Session ends. Insights file produced on disk with lens-tagged, evidence-backed statements.
7. Session audio and full transcript persisted for audit.

If any of these fail, v1 is not done.
