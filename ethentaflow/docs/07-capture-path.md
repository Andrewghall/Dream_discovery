# 07 - Capture Path

The capture path runs parallel to the live path. It handles recording, persistence, diarisation, and post-session synthesis. It must never block the live path.

## Responsibilities

1. **Record raw audio** for the full session, both sides.
2. **Persist the full transcript** with word-level timestamps.
3. **Run diarisation** (post-session) to mark user vs system turns properly.
4. **Generate session synthesis** using Claude Opus 4.7 - structured insights, lens coverage, recommended follow-ups.
5. **Write a session file** that can be audited, exported, or fed back into DREAM™.

## Architecture

```
Live path (always running):
  mic → deepgram → state engine → probe → TTS → browser

Capture path (parallel):
  mic → disk (raw audio, user side)
  TTS → disk (raw audio, system side)
  Deepgram final transcripts → disk (transcript log)
  State engine turn completions → disk (turn metadata)

Post-session (on disconnect or explicit end):
  disk → diarisation check
  disk → Opus synthesis
  disk → final session.json artifact
```

## File layout per session

```
/var/ethentaflow/sessions/{sessionId}/
  audio-user.webm           <- user mic audio, raw
  audio-system.webm         <- TTS audio emitted
  transcript.jsonl          <- one JSON line per Deepgram final, with timestamps
  turns.jsonl               <- one JSON line per completed turn from state engine
  probes.jsonl              <- one JSON line per probe emitted
  metadata.json             <- session start/end, participant info, config
  session.json              <- final artifact produced post-session (synthesis output)
```

`.jsonl` = newline-delimited JSON. Append-only, easy to stream-write, easy to process.

## Recording mechanics

### User audio

The client sends 16kHz PCM frames to the server over the WebSocket. The server:

1. Forwards frames to Deepgram for transcription (live path).
2. Writes frames to `audio-user.webm` using a streaming encoder (e.g. `@ffmpeg/ffmpeg` or native ffmpeg child process).

Two separate consumers of the same stream. Fan out in the server, not the client.

### System audio

Deepgram Aura streams back PCM or Opus audio. The server:

1. Forwards to the client for playback (live path).
2. Writes to `audio-system.webm`.

### Transcript log

Every Deepgram message with `is_final: true` gets appended:

```json
{"t": 1714000000000, "speaker": "user", "text": "we're struggling to hire senior engineers", "words": [{"w": "we're", "s": 0.12, "e": 0.31, "c": 0.99}, ...]}
```

### Turn log

When the state engine completes a turn:

```json
{"turnId": "t_7", "startedAt": 1714000000000, "endedAt": 1714000014200, "speaker": "user", "finalTranscript": "we're struggling to hire senior engineers in Lisbon", "lens": "people", "signalsDetected": [{"type": "people_issue", "confidence": 0.91}], "depthScore": 2, "exampleProvided": false}
```

### Probe log

When the system commits a probe:

```json
{"t": 1714000014500, "turnId": "t_8", "text": "Tell me about the last hire who worked out well.", "strategy": "request_example", "generatedBy": "haiku_speculative", "tokenLatencyMs": 380}
```

## Post-session synthesis

Triggered when:
- WebSocket disconnects gracefully (user clicked end / closed tab), OR
- Explicit "end session" message received, OR
- 5 minutes of inactivity with open connection.

Steps:

1. **Assemble the session context** - read turns.jsonl, probes.jsonl, insights from state.
2. **Diarisation check** - verify user and system turns didn't get mislabeled. For v1, trust state engine labels (they're correct by construction). Full diarisation (identifying multiple user speakers) deferred.
3. **Opus synthesis** - call Claude Opus 4.7 with the full turn log and prompt in `prompts/session-synthesiser.md`. Max tokens: 4000. No streaming needed.
4. **Write session.json** with the synthesised artifact.

### Opus synthesis output schema

```typescript
interface SessionSynthesis {
  sessionId: string;
  synthesisedAt: number;
  participantName?: string;
  durationSeconds: number;

  summary: string;                         // 2-3 sentence high-level summary

  lensCoverage: Record<Lens, {
    coverage: 'deep' | 'surface' | 'untouched';
    keyFindings: string[];
    openQuestions: string[];
  }>;

  insights: Array<{
    lens: Lens;
    signal: SignalType;
    statement: string;                      // stands alone without context
    evidence: string;                       // quote from user
    confidence: 'high' | 'medium' | 'low';
    turnId: string;                         // traceable to source
  }>;

  recommendedFollowUps: Array<{
    lens: Lens;
    topic: string;
    rationale: string;
  }>;

  redFlags: string[];                      // anything the system noticed that warrants attention

  // Raw data for downstream processing
  totalTurns: number;
  avgDepthScore: number;
  signalsCovered: SignalType[];
}
```

## Opus synthesis prompt

See `prompts/session-synthesiser.md`.

Key instructions for the prompt:

- Never invent or exaggerate. If the conversation didn't cover something, lensCoverage for that lens is `untouched`.
- Every insight must cite the specific turn it came from.
- The `statement` field must be self-contained (no "they said", "the user mentioned"). It reads as a direct diagnostic observation.
- The `evidence` field is a verbatim quote (or near-verbatim, cleaned up for readability).
- Confidence is `high` only when there was a specific example backing the insight.

## Durability and recovery

- Write to disk on every event (jsonl append). No in-memory buffering beyond one event.
- If the server crashes mid-session, the transcript and turn logs are preserved up to the last flush.
- Post-session synthesis is idempotent: can be re-run against the persisted logs without re-recording.

For v1, no explicit recovery UI. If a session crashes, the session files remain on disk; an operator can trigger synthesis manually via a CLI command:

```bash
node dist/tools/synthesise.js --session {sessionId}
```

## Privacy and retention

- v1 runs locally. No cloud upload.
- Session files are plaintext and audio; treat as sensitive.
- Andrew's philosophy: sovereign processing. Do not route captured audio or transcripts through third parties beyond Deepgram (STT only, not retained per their API terms) and Anthropic (LLM calls, not retained on the privacy tier).
- Default retention: indefinite on disk. Add a config-driven TTL in v2.

## Cost

Per 30-minute session:
- Audio storage: ~10MB x 2 = 20MB
- Transcript / turn logs: ~200KB
- Opus synthesis: ~8K input tokens + 2K output tokens = ~$0.22
- Total capture-path cost: ~$0.22 per session. Storage cost trivial.

Combined with live-path cost from doc 05 (~$0.05), total per-session LLM spend is around $0.27.
