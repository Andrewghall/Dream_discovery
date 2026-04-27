// index-v2: minimal ChatGPT-quality voice agent server.
//
// One loop. One LLM call per turn. No watchdogs, no settle windows, no recovery
// cascades, no signal classifier, no depth scorer, no regex rating extractors.
//
// Audio in → Deepgram → utterance_end → agent turn → TTS → audio out → wait → repeat.

import dotenv from 'dotenv';
dotenv.config({ override: true });

import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import OpenAI from 'openai';

import { createDeepgramConnection } from './deepgram.js';
import { synthesiseStream } from './tts.js';
import { relaxText } from './relax-text.js';
import {
  createInitialState,
  runAgentTurn,
  applyToolCall,
  recordTurn,
  lensLabel,
  DEFAULT_LENS_SEQUENCE,
  type AgentState,
  type ToolCall,
} from './agent-v2.js';
import { getDiscoveryQuestion } from './discovery-questions.js';
import {
  synthesiseSession,
  synthesiseOneLens,
  synthesiseSessionLevel,
  buildDreamHandoff,
  postToDream,
  type SynthesisOutput,
  type PerLensSynthesis,
  type SessionLevelSynthesis,
} from './synthesiser-v2.js';
import type { Lens } from './types.js';

// ── Env ────────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env var: ${name}`); process.exit(1); }
  return v;
}

const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');
const DEEPGRAM_API_KEY = requireEnv('DEEPGRAM_API_KEY');
const ELEVENLABS_API_KEY = requireEnv('ELEVENLABS_API_KEY');
const PORT = Number(process.env.PORT ?? 3001);
const AGENT_MODEL = process.env.AGENT_MODEL ?? 'gpt-4o';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── HTTP + WS ──────────────────────────────────────────────────────────────

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('DREAMflow voice server (v2). Connect via WebSocket at /ws.');
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', ws => {
  void handleSession(ws).catch(err => {
    console.error('[session] unhandled error', err);
    try { ws.close(); } catch { /* ignore */ }
  });
});

httpServer.listen(PORT, () => {
  console.log(`DREAMflow v2 listening on :${PORT}`);
  console.log(`WebSocket at ws://localhost:${PORT}/ws`);
  console.log(`Agent model: ${AGENT_MODEL}`);
});

// ── Session ────────────────────────────────────────────────────────────────

async function handleSession(ws: WebSocket): Promise<void> {
  const sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  console.log(`[session] new ${sessionId}`);

  // ── Per-session state ────────────────────────────────────────────────────
  let state: AgentState | null = null;
  let activeTts: { abort: () => void; done: Promise<void> } | null = null;
  let micGateClosed = true;          // true while agent is speaking / before client confirms playback ended
  let userBuffer = '';                // accumulated finals during current user utterance
  let waitingResolver: ((text: string | null) => void) | null = null;
  let playbackDoneResolver: (() => void) | null = null;
  let sessionEnded = false;
  let sessionPaused = false;
  let pauseStartedAt = 0;
  let pauseResumeResolver: (() => void) | null = null; // resolves when resumed
  const shownLensCards = new Set<Lens>();              // lenses for which the card has been shown
  // Per-lens synthesis runs in parallel — no serialisation. Results merge
  // into accumulatedPerLens by lens key.
  const accumulatedPerLens: Map<Lens, PerLensSynthesis> = new Map();
  let lastSessionLevel: SessionLevelSynthesis | null = null;
  let workshopId: string | undefined;
  let participantToken: string | undefined;

  function send(msg: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(msg));
  }
  function sendBinary(buf: Buffer): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(buf, { binary: true });
  }

  // ── Deepgram connection (voice mode only — opens lazily on 'start') ─────
  let dg: ReturnType<typeof createDeepgramConnection> | null = null;
  function openDeepgramIfNeeded(): void {
    if (dg || !state || state.mode !== 'voice') return;
    dg = createDeepgramConnection(DEEPGRAM_API_KEY, {
      onOpen: () => console.log(`[dg] open ${sessionId}`),
      onClose: () => console.log(`[dg] closed ${sessionId}`),
      onError: err => console.error(`[dg] error`, err),
      onTranscript: msg => {
        const alt = msg.channel.alternatives[0];
        if (!alt?.transcript) return;
        if (micGateClosed) return;
        if (msg.is_final) {
          userBuffer = (userBuffer + ' ' + alt.transcript).trim();
          send({ type: 'final', text: alt.transcript });
          console.log(`[user-final] ${alt.transcript}`);
        } else {
          send({ type: 'partial', text: alt.transcript });
        }
      },
      onUtteranceEnd: () => {
        if (micGateClosed) return;
        if (userBuffer && waitingResolver) {
          const utt = userBuffer;
          userBuffer = '';
          const resolve = waitingResolver;
          waitingResolver = null;
          console.log(`[user-utterance] ${utt}`);
          resolve(utt);
        }
      },
      onSpeechStarted: () => { /* no-op */ },
    });
  }

  // ── Voice helpers ────────────────────────────────────────────────────────

  /** Speak a single sentence segment streamed from the model. If isFirst is
   *  true, opens the audio pipeline (tts_start) and creates a new chat bubble.
   *  Subsequent calls APPEND to the same bubble so a multi-sentence turn is
   *  rendered as ONE bubble with growing text — not N tiny bubbles. */
  async function speakSegment(textRaw: string, isFirst: boolean): Promise<void> {
    if (sessionEnded || sessionPaused) return;
    const text = textRaw.trim();
    if (!text) return;

    // Always emit chat bubbles. In text mode, that's the ONLY thing — no TTS.
    if (isFirst) {
      userBuffer = '';
      if (state?.mode === 'voice') {
        micGateClosed = true;
        send({ type: 'tts_start' });
      }
      send({ type: 'probe', text: state?.mode === 'voice' ? relaxText(text) : text, strategy: 'drill_depth' });
    } else {
      send({ type: 'probe_append', text: ' ' + (state?.mode === 'voice' ? relaxText(text) : text) });
    }
    console.log(`[agent-stream] ${text.slice(0, 100)}${text.length > 100 ? '…' : ''}`);

    if (state?.mode === 'text') {
      // No TTS in text mode — bubble is enough.
      return;
    }

    const ttsText = relaxText(text);
    const tts = synthesiseStream(ELEVENLABS_API_KEY, ttsText, chunk => {
      sendBinary(chunk);
    });
    // Hold a reference so pause can abort; the queue serialises so we always
    // overwrite rather than racing.
    activeTts = tts;
    try {
      await tts.done;
    } catch (err) {
      console.error('[tts] segment error', err);
    }
    if (activeTts === tts) activeTts = null;
  }

  async function speak(textRaw: string): Promise<void> {
    if (sessionEnded) return;
    const text = relaxText(textRaw.trim());
    if (!text) return;

    micGateClosed = true;
    userBuffer = '';
    send({ type: 'tts_start' });
    // Use 'drill_depth' (or any non-'measure') so the client renders this as
    // a chat bubble. 'measure' is reserved for the scoring-card prompt only.
    send({ type: 'probe', text, strategy: 'drill_depth' });
    console.log(`[agent] ${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`);

    const tts = synthesiseStream(ELEVENLABS_API_KEY, text, chunk => {
      sendBinary(chunk);
    });
    activeTts = tts;
    try {
      await tts.done;
    } catch (err) {
      console.error('[tts] error', err);
    }
    activeTts = null;
    send({ type: 'tts_end' });

    // Wait for client to confirm playback finished (buffer drained + echo holdoff).
    await new Promise<void>(resolve => {
      playbackDoneResolver = resolve;
      // Safety timeout — never wait more than 60s for playback_done; the client
      // should always send it but if something hangs, we recover.
      setTimeout(() => {
        if (playbackDoneResolver === resolve) {
          console.warn('[tts] playback_done timeout — opening mic anyway');
          playbackDoneResolver = null;
          resolve();
        }
      }, 60000);
    });

    // Open mic gate — but NOT while paused. The pause/resume handlers manage
    // the gate themselves when the participant resumes.
    if (!sessionPaused) {
      micGateClosed = false;
    }
  }

  function listen(): Promise<string | null> {
    if (sessionEnded) return Promise.resolve(null);
    return new Promise(resolve => { waitingResolver = resolve; });
  }

  // ── Client messages ──────────────────────────────────────────────────────
  ws.on('message', async (raw, isBinary) => {
    if (isBinary) {
      // Audio chunk from client — forward to Deepgram unless mic gate is closed.
      if (!micGateClosed && dg) {
        dg.sendAudio(raw as Buffer);
      }
      return;
    }
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg?.type) return;

    switch (msg.type) {
      case 'start': {
        if (state) return; // already started
        const lenses = (Array.isArray(msg.lenses) && msg.lenses.length > 0)
          ? (msg.lenses as Lens[])
          : DEFAULT_LENS_SEQUENCE;
        state = createInitialState({
          participantName: typeof msg.participantName === 'string' ? msg.participantName : undefined,
          participantTitle: typeof msg.participantTitle === 'string' ? msg.participantTitle : undefined,
          participantCompany: typeof msg.participantCompany === 'string' ? msg.participantCompany : undefined,
          participantEmail: typeof msg.participantEmail === 'string' ? msg.participantEmail : undefined,
          mode: msg.mode === 'text' ? 'text' : 'voice',
          lenses,
        });
        workshopId = typeof msg.workshopId === 'string' ? msg.workshopId : undefined;
        participantToken = typeof msg.participantToken === 'string' ? msg.participantToken : undefined;
        console.log(`[client] start participant=${state.participantName ?? '(anon)'} title=${state.participantTitle ?? '(unknown)'} company=${state.participantCompany ?? '(unknown)'} email=${state.participantEmail ?? '(none)'} mode=${state.mode} workshop=${workshopId ?? '(none)'}`);
        openDeepgramIfNeeded();
        send({ type: 'ready', mode: state.mode });
        emitCoverage(state);
        // Don't show the rating card on initial connect — only after the welcome
        // turn finishes and the agent transitions into the first lens. The
        // measure_prompt fires from emitPhase() when the lens actually changes.
        void runConversation();
        return;
      }
      case 'playback_done': {
        if (playbackDoneResolver) {
          const r = playbackDoneResolver;
          playbackDoneResolver = null;
          r();
        }
        return;
      }
      case 'interrupt': {
        if (activeTts) {
          activeTts.abort();
          activeTts = null;
        }
        if (playbackDoneResolver) {
          const r = playbackDoneResolver;
          playbackDoneResolver = null;
          r();
        }
        return;
      }
      case 'end': {
        sessionEnded = true;
        try { ws.close(); } catch { /* ignore */ }
        return;
      }
      case 'switch_mode': {
        if (!state) return;
        const next = msg.mode === 'text' ? 'text' : 'voice';
        if (next === state.mode) return;
        const prev = state.mode;
        state.mode = next;
        console.log(`[mode] switched ${prev} → ${next}`);
        if (next === 'voice') {
          // Need Deepgram for voice mode — open lazily.
          openDeepgramIfNeeded();
        } else {
          // Switching to text — close mic gate so any in-flight audio is
          // discarded; the typing input is the only path now.
          micGateClosed = true;
          // Cancel any active TTS so the next agent turn arrives as text only.
          if (activeTts) { try { activeTts.abort(); } catch { /* ignore */ } activeTts = null; }
        }
        send({ type: 'mode_switched', mode: next });
        return;
      }
      case 'user_text': {
        // Text-mode message — treat as a finalised user utterance and resolve
        // the listen() promise the same way an utterance_end transcript would.
        if (!state || state.mode !== 'text') return;
        const text = typeof msg.text === 'string' ? msg.text.trim() : '';
        if (!text) return;
        send({ type: 'final', text });
        if (waitingResolver) {
          const resolve = waitingResolver;
          waitingResolver = null;
          resolve(text);
        } else {
          userBuffer = text;
        }
        return;
      }
      case 'email_pdf': {
        // Client-generated PDF blob (base64) — forward to Resend so the
        // participant gets a copy. Non-fatal.
        if (!state) return;
        const recipient = (typeof msg.to === 'string' && msg.to.trim()) || state.participantEmail;
        const base64 = typeof msg.base64 === 'string' ? msg.base64 : '';
        const filename = typeof msg.filename === 'string' ? msg.filename : 'discovery-report.pdf';
        if (!recipient) {
          send({ type: 'error', message: 'No email address on file. Pass ?email= in the URL or enter it in the UI.' });
          return;
        }
        if (!base64) {
          send({ type: 'error', message: 'No PDF data received.' });
          return;
        }
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          console.warn('[email] RESEND_API_KEY not configured — cannot send');
          send({ type: 'error', message: 'Email service not configured on the server (missing RESEND_API_KEY).' });
          return;
        }
        const fromAddress = process.env.RESEND_FROM ?? 'DREAMflow <onboarding@resend.dev>';
        try {
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              from: fromAddress,
              to: [recipient],
              subject: 'Your DREAM Discovery report',
              html: `<p>Hi ${state.participantName ? state.participantName.split(/\s+/)[0] : 'there'},</p>
                     <p>Thank you for completing your DREAM Discovery session. Your full report is attached as a PDF.</p>
                     <p>The report covers each of the lenses you discussed, your maturity ratings, key insights, and a written executive summary.</p>
                     <p>Best,<br/>DREAMflow</p>`,
              attachments: [{ filename, content: base64 }],
            }),
          });
          if (!r.ok) {
            const body = await r.text().catch(() => '');
            console.error(`[email] Resend failed (${r.status}): ${body.slice(0, 300)}`);
            send({ type: 'error', message: `Email send failed (${r.status}).` });
            return;
          }
          console.log(`[email] PDF sent to ${recipient}`);
          send({ type: 'email_sent', to: recipient });
        } catch (err) {
          console.error('[email] error', err);
          send({ type: 'error', message: 'Email send failed.' });
        }
        return;
      }
      case 'pause': {
        if (sessionPaused || !state) return;
        sessionPaused = true;
        pauseStartedAt = Date.now();
        // Stop any in-flight TTS so the participant can step away.
        if (activeTts) {
          try { activeTts.abort(); } catch { /* ignore */ }
          activeTts = null;
        }
        // Close mic gate — drop any audio frames during pause.
        micGateClosed = true;
        // Release any pending playback waiter so the loop doesn't hang.
        if (playbackDoneResolver) {
          const r = playbackDoneResolver;
          playbackDoneResolver = null;
          r();
        }
        send({ type: 'session_paused' });
        send({ type: 'tts_end' });
        console.log(`[session] paused ${sessionId}`);
        return;
      }
      case 'resume': {
        if (!sessionPaused || !state) return;
        sessionPaused = false;
        const pausedFor = Date.now() - pauseStartedAt;
        state.pausedMs += pausedFor;
        // Shift all lensStartedAt timestamps so per-lens elapsed math
        // excludes the pause window.
        for (const [lens, ts] of state.lensStartedAt.entries()) {
          state.lensStartedAt.set(lens, ts + pausedFor);
        }
        // Re-open the mic gate so audio can flow again.
        micGateClosed = false;
        send({ type: 'session_resumed' });
        console.log(`[session] resumed ${sessionId} (paused ${Math.round(pausedFor / 1000)}s)`);
        // Wake the conversation loop if it was waiting on pause.
        if (pauseResumeResolver) {
          const r = pauseResumeResolver;
          pauseResumeResolver = null;
          r();
        }
        return;
      }
    }
  });

  ws.on('close', () => {
    sessionEnded = true;
    if (activeTts) try { activeTts.abort(); } catch { /* ignore */ }
    try { dg?.close(); } catch { /* ignore */ }
    console.log(`[session] closed ${sessionId}`);
  });

  // ── Main conversation loop ───────────────────────────────────────────────
  async function waitWhilePaused(): Promise<void> {
    if (!sessionPaused) return;
    await new Promise<void>(resolve => { pauseResumeResolver = resolve; });
  }

  async function runConversation(): Promise<void> {
    if (!state) return;

    // 1. Welcome turn — no user input yet, 3-sentence intro.
    await waitWhilePaused();
    if (sessionEnded) return;
    await runAndSpeak(null);

    // Brief pause between welcome and the role-confirm — gives a natural
    // paragraph break so the welcome doesn't run straight into the next ask.
    await waitWhilePaused();
    if (sessionEnded) return;
    await new Promise(r => setTimeout(r, 800));

    // 2. Chained role-confirmation — only if we have a URL-provided title to
    //    confirm. Otherwise the welcome's own "tell me your name and title"
    //    question covers it; we wait for the user to introduce themselves
    //    naturally and handle that in the regular loop below.
    await waitWhilePaused();
    if (
      !sessionEnded &&
      state &&
      !state.complete &&
      !state.participantRoleDescription &&
      state.participantTitle &&
      !state.roleConfirmed
    ) {
      await runAndSpeak(null);
    }

    // 3. Loop: listen → run agent → speak. The first time the user answers,
    //    the agent captures their role description and asks the first rating
    //    (with the card) in the same turn — handled by the system prompt.
    while (!sessionEnded && state && !state.complete) {
      await waitWhilePaused();
      if (sessionEnded) break;
      const userText = await listen();
      if (sessionEnded) break;
      if (!userText) continue;
      await waitWhilePaused();
      if (sessionEnded) break;

      recordTurn(state, 'user', userText);
      await runAndSpeak(userText);
    }

    if (state?.complete) {
      // Force-synthesise every lens that has ANY trace of conversation —
      // ratings, evidence, OR mention in the transcript. The session
      // sometimes advances faster than per-lens captures land, so we
      // backfill at the end. Run in parallel.
      try {
        const conversationText = state!.conversation.map(c => c.content).join(' ').toLowerCase();
        const lensesNeedingSynthesis = state!.lensSequence.filter(l => {
          if (accumulatedPerLens.has(l)) return false;
          if (state!.ratings.has(l)) return true;
          if ((state!.evidence.get(l)?.length ?? 0) > 0) return true;
          // Detect by lens label appearing in the conversation.
          const label = lensLabel(l).toLowerCase();
          return conversationText.includes(label) || conversationText.includes(l.toLowerCase());
        });
        console.log(`[synthesiser] backfilling ${lensesNeedingSynthesis.length} lenses at session end`);
        await Promise.all(lensesNeedingSynthesis.map(l => runPerLensSynthesis(l)));

        const sessionLevel = await synthesiseSessionLevel({
          client: openai,
          state: state!,
          model: process.env.SYNTHESIS_MODEL_FINAL ?? 'gpt-4o',
        });
        lastSessionLevel = sessionLevel;
        const finalSynthesis = buildAccumulatedSynthesis('final');
        send({
          type: 'synthesis_update',
          synthesis: {
            ...finalSynthesis,
            participantName: state!.participantName,
            participantTitle: state!.participantTitle,
            participantCompany: state!.participantCompany,
          },
        });
        console.log(`[synthesiser] final synthesis emitted (${Object.keys(finalSynthesis.perLens).length} lenses)`);

        // Dream handoff — non-fatal. Skipped if DREAM_API_URL isn't set.
        const payload = buildDreamHandoff({
          state: state!,
          sessionId,
          workshopId,
          participantToken,
          synthesis: finalSynthesis as SynthesisOutput,
        });
        void postToDream({ payload });
      } catch (err) {
        console.error('[synthesiser] final synthesis error', err);
      }

      send({ type: 'session_complete' });
      console.log(`[session] complete ${sessionId}`);
    }
  }

  /** Run per-lens synthesis for ONE lens. Runs in parallel with others.
   *  Result merges into accumulatedPerLens and emits a synthesis_update. */
  async function runPerLensSynthesis(lens: Lens): Promise<void> {
    if (!state) return;
    try {
      console.log(`[synthesiser] lens=${lens} starting`);
      const result = await synthesiseOneLens({
        client: openai,
        state: state!,
        lens,
        model: process.env.SYNTHESIS_MODEL_LENS ?? 'gpt-4o-mini',
      });
      if (!result) return;
      accumulatedPerLens.set(lens, result);
      const merged = buildAccumulatedSynthesis('partial');
      send({
        type: 'synthesis_update',
        synthesis: {
          ...merged,
          participantName: state!.participantName,
          participantTitle: state!.participantTitle,
          participantCompany: state!.participantCompany,
        },
      });
      console.log(`[synthesiser] lens=${lens} merged (${accumulatedPerLens.size} total)`);
    } catch (err) {
      console.error(`[synthesiser] lens=${lens} error`, err);
    }
  }

  /** Build a full SynthesisOutput from accumulated per-lens data + the
   *  most recent session-level synthesis (if any). */
  function buildAccumulatedSynthesis(scope: 'partial' | 'final'): SynthesisOutput {
    const perLens: SynthesisOutput['perLens'] = {};
    if (state) {
      // Render in lens-sequence order so the panel always shows lenses in
      // the right order, regardless of when each finished synthesising.
      for (const lens of state.lensSequence) {
        const v = accumulatedPerLens.get(lens);
        if (v) perLens[lens] = v;
      }
    }
    return {
      perLens,
      crossLensThemes: lastSessionLevel?.crossLensThemes ?? [],
      executiveSummary: lastSessionLevel?.executiveSummary ?? '',
      executiveTone: lastSessionLevel?.executiveTone ?? 'pragmatic',
      keyInsights: lastSessionLevel?.keyInsights ?? [],
      inputQualityScore: lastSessionLevel?.inputQualityScore ?? 70,
      inputQualityLabel: lastSessionLevel?.inputQualityLabel ?? 'medium',
      inputQualityDescription: lastSessionLevel?.inputQualityDescription ?? '',
      feedbackToInterviewee: lastSessionLevel?.feedbackToInterviewee ?? '',
      themesAndIntent: lastSessionLevel?.themesAndIntent ?? [],
      generatedAt: Date.now(),
      scope,
    };
  }

  async function runAndSpeak(userTranscript: string | null): Promise<void> {
    if (!state) return;
    let result;
    // Streaming TTS: as each sentence completes from the LLM, push to a queue
    // that's spoken in order. First audio lands ~600-800ms after the user
    // finishes speaking, vs ~2-3s if we waited for the full LLM response.
    let speakQueue: Promise<void> = Promise.resolve();
    let firstSentenceQueued = false;
    const enqueueSentence = (sentence: string) => {
      // Open the audio pipeline on the first sentence — emits tts_start,
      // probe, etc. Subsequent sentences just keep streaming.
      speakQueue = speakQueue.then(() => speakSegment(sentence, !firstSentenceQueued));
      firstSentenceQueued = true;
    };
    try {
      result = await runAgentTurn({
        client: openai,
        state,
        userTranscript,
        model: AGENT_MODEL,
        onSentence: enqueueSentence,
      });
    } catch (err) {
      console.error('[agent] runAgentTurn failed', err);
      // No-silence guarantee: speak a brief recovery line so the user knows
      // we're not dead. The conversation loop continues afterwards.
      await speak('Sorry, give me a moment.');
      return;
    }
    // Drain whatever sentences were streamed out + flush playback.
    await speakQueue;
    if (firstSentenceQueued && state?.mode === 'voice') {
      // Mark the streamed turn complete on the wire so the client opens
      // its mic gate (the per-sentence speakSegment doesn't do it).
      send({ type: 'tts_end' });
      await new Promise<void>(resolve => {
        playbackDoneResolver = resolve;
        setTimeout(() => {
          if (playbackDoneResolver === resolve) {
            playbackDoneResolver = null;
            resolve();
          }
        }, 60000);
      });
      if (!sessionPaused) micGateClosed = false;
    }

    // Apply tool calls FIRST (state changes), then speak.
    const lensBeforeTools = state.currentLens;
    const ratingBeforeTools = state.ratings.get(state.currentLens);
    for (const tc of result.toolCalls) {
      handleToolCall(state, tc);
    }
    let lensChanged = state.currentLens !== lensBeforeTools;

    // Server-side safety net: if the model spoke about a NEXT lens by name
    // without calling advance_lens (a known failure mode), detect it and
    // advance ourselves. We only auto-advance if the current lens already has
    // a rating captured (so we don't skip ahead before the rating is in).
    if (!lensChanged && result.text && state.ratings.get(state.currentLens)?.today != null) {
      const currentIdx = state.lensSequence.indexOf(state.currentLens);
      if (currentIdx >= 0 && currentIdx < state.lensSequence.length - 1) {
        const nextLens = state.lensSequence[currentIdx + 1]!;
        const nextLabel = lensLabel(nextLens).toLowerCase();
        const nextKey = nextLens.toLowerCase();
        const lower = result.text.toLowerCase();
        // Trigger phrases that signal an unannounced lens transition.
        const looksLikeTransition =
          lower.includes(`now let's look at ${nextLabel}`) ||
          lower.includes(`moving on to ${nextLabel}`) ||
          lower.includes(`turning to ${nextLabel}`) ||
          lower.includes(`onto ${nextLabel}`) ||
          lower.includes(`thinking about ${nextLabel}`) ||
          lower.includes(`on to ${nextLabel}`) ||
          lower.includes(`on ${nextKey},`) ||
          lower.includes(`for ${nextLabel}`) ||
          lower.includes(`when it comes to ${nextLabel}`);
        if (looksLikeTransition) {
          console.log(`[auto-advance] model spoke about ${nextLens} without advance_lens — advancing automatically`);
          handleToolCall(state, { type: 'advance_lens' });
          lensChanged = true;
        }
      }
    }

    if (lensChanged) {
      emitPhase(state);
      // Kick off a per-lens synthesis IN PARALLEL for the just-completed
      // lens. No serialisation — multiple lens advances can be processing
      // simultaneously. Result merges into accumulatedPerLens and emits a
      // synthesis_update with the latest full state.
      const justCompleted = lensBeforeTools;
      void runPerLensSynthesis(justCompleted);
    }
    emitCoverage(state);

    // Show the rating card whenever the agent is on a lens that has no
    // rating yet AND the role is captured AND the agent has just spoken.
    // The shownLensCards set ensures we only emit ONCE per lens.
    const lensHasNoRating = state.ratings.get(state.currentLens)?.today == null;
    const roleReady = !!state.participantRoleDescription;
    const shouldShowCard = roleReady && lensHasNoRating && !!result.text;

    if (shouldShowCard && !shownLensCards.has(state.currentLens)) {
      const q = getDiscoveryQuestion(state.currentLens);
      send({
        type: 'measure_prompt',
        lens: state.currentLens,
        question: q?.text ?? lensLabel(state.currentLens),
        maturityScale: q?.maturityScale ?? null,
      });
      shownLensCards.add(state.currentLens);
    }

    if (result.text) {
      // If streaming already spoke this turn, just record the assistant turn —
      // don't re-speak. Otherwise (no streaming, e.g. tool-loop fallback path)
      // speak the full text now.
      if (firstSentenceQueued) {
        recordTurn(state, 'assistant', result.text);
      } else {
        await speak(result.text);
        recordTurn(state, 'assistant', result.text);
      }
    } else if (result.toolCalls.length > 0) {
      // Defensive fallback: model called tools without speaking. Acknowledge so
      // the user isn't left wondering. The loop will continue and likely
      // produce real speech on the next iteration.
      console.warn('[agent] tool-only response; speaking fallback acknowledgement');
      await speak('Got it.');
    }

    // If the model called end_session, the loop will exit on the next iteration
    // because state.complete is true.
  }

  function handleToolCall(s: AgentState, call: ToolCall): void {
    console.log(`[tool] ${call.type}${'lens' in s ? ` lens=${s.currentLens}` : ''} ${JSON.stringify(call)}`);
    applyToolCall(s, call);
    if (call.type === 'capture_rating') {
      const r = s.ratings.get(s.currentLens);
      if (r && r.today != null && r.target != null) {
        send({
          type: 'lens_rating',
          lens: s.currentLens,
          current: r.today,
          target: r.target,
          trajectory: r.drift != null && r.drift < r.today ? 'declining' : r.drift != null && r.drift > r.today ? 'improving' : 'flat',
        });
      }
    }
  }

  function emitPhase(s: AgentState): void {
    send({ type: 'lens_phase', lens: s.currentLens, phase: 'measurement' });
    // measure_prompt is sent from runAndSpeak right before speaking, so the
    // card appears in sync with the agent's spoken question — not earlier.
  }

  function emitCoverage(s: AgentState): void {
    const sections = s.lensSequence.map((lens, idx) => {
      const r = s.ratings.get(lens);
      const e = s.evidence.get(lens) ?? [];
      const hasRating = r && r.today != null && r.target != null;
      const pct = hasRating ? Math.min(100, 50 + Math.min(50, e.length * 25)) : 0;
      return {
        lens,
        label: lensLabel(lens),
        pct,
        isCurrent: lens === s.currentLens,
        idx,
      };
    });
    const totalPct = Math.round(sections.reduce((sum, x) => sum + x.pct, 0) / sections.length);
    const currentIdx = sections.findIndex(s2 => s2.isCurrent);
    // Per-section timing:
    //   sectionStartTimes[i] = 0 means this section hasn't started yet.
    //   sectionEndTimes[i] = 0 means it's either not started OR still in progress.
    //   Client renders elapsed = (endTime || now) - startTime, or '—' if unstarted.
    const sectionStartTimes = s.lensSequence.map(lens => s.lensStartedAt.get(lens) ?? 0);
    const sectionEndTimes = s.lensSequence.map(lens => s.lensEndedAt.get(lens) ?? 0);
    send({
      type: 'coverage_update',
      sections,
      currentSection: currentIdx >= 0 ? currentIdx + 1 : 1,
      totalSections: sections.length,
      totalPct,
      sectionStartTimes,
      sectionEndTimes,
    });
  }
}
