// EthentaFlow server entry point.
// Wires Deepgram + state engine + endpoint detector + classifier + probe engine + TTS + capture
// per WebSocket session.
//
// Run with: ANTHROPIC_API_KEY=... DEEPGRAM_API_KEY=... npm run dev

import dotenv from 'dotenv';
dotenv.config({ override: true });
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { EndpointDetector } from './endpoint-detector.js';
import { SessionState } from './state-engine.js';
import { createDeepgramConnection } from './deepgram.js';
import { SignalClassifier } from './signal-classifier.js';
import {
  ProbeEngine, isConfused, extractName, isConsentYes,
  ONBOARDING_ASK_CONSENT, ONBOARDING_ASK_JOB_TITLE,
  ONBOARDING_ASK_LOVES_JOB, ONBOARDING_ASK_FRUSTRATIONS,
  ONBOARDING_TRANSITION,
} from './probe-engine.js';
import { DepthScorer } from './depth-scorer.js';
import { synthesiseStream } from './tts.js';
import { startCapture } from './capture.js';
import type {
  ClientMessage, ServerMessage, Signal, Lens, SignalType, ProbeStrategy, ProbeCandidate,
} from './types.js';

const PORT = Number(process.env.PORT ?? 3001);
const ANTHROPIC_API_KEY = requireEnv('ANTHROPIC_API_KEY');
const DEEPGRAM_API_KEY = requireEnv('DEEPGRAM_API_KEY');

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env var: ${name}`); process.exit(1); }
  return v;
}

// Map signal types to default lenses (state engine uses for lens hints)
const SIGNAL_TO_LENS: Record<SignalType, Lens> = {
  people_issue: 'people',
  growth_goal: 'commercial',
  icp_definition: 'commercial',
  channel_problem: 'commercial',
  commercial_model: 'commercial',
  market_position: 'commercial',
  partnership: 'partners',
  tech_gap: 'technology',
  operational_friction: 'operations',
  constraint: 'operations',
};

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('EthentaFlow server. Connect via WebSocket at /ws.\n');
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', ws => {
  console.log('[conn] new session');
  void handleSession(ws).catch(err => console.error('[session] fatal', err));
});

async function handleSession(ws: WebSocket): Promise<void> {
  const state = new SessionState();
  const detector = new EndpointDetector();
  const classifier = new SignalClassifier(ANTHROPIC_API_KEY);
  const probeEngine = new ProbeEngine(ANTHROPIC_API_KEY);
  const depthScorer = new DepthScorer(ANTHROPIC_API_KEY);
  const capture = startCapture(state.sessionId);

  let lastProbeText: string | null = null;
  let activeTts: { abort: () => void } | null = null;

  const send = (msg: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  const sendBinary = (chunk: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(chunk, { binary: true });
    }
  };

  // Throttled state update emitter
  let lastStateEmit = 0;
  const emitStateUpdate = () => {
    const now = Date.now();
    if (now - lastStateEmit < 200) return;
    lastStateEmit = now;
    const snap = state.snapshot();
    send({
      type: 'state_update',
      state: {
        currentLens: snap.currentLens,
        currentSignal: snap.currentSignal,
        signalStack: snap.signalStack,
        depthScore: snap.depthScore,
        exampleProvided: snap.exampleProvided,
        pendingProbe: snap.pendingProbe,
        liveUtterance: snap.liveUtterance,
      },
    });
  };

  // Helper: speak a probe text via TTS and track it
  async function speakProbe(probeText: string, probeStrategy: ProbeStrategy): Promise<void> {
    const isDuplicate = state.trackProbe(probeText);
    if (isDuplicate) {
      console.log('[probe] skipping duplicate probe');
      return;
    }
    lastProbeText = probeText;
    send({ type: 'probe', text: probeText, strategy: probeStrategy });
    send({ type: 'tts_start' });
    detector.onSystemSpeakingStart();
    const tts = synthesiseStream(DEEPGRAM_API_KEY, probeText, chunk => {
      sendBinary(chunk);
      capture.writeSystemAudio(chunk);
    });
    activeTts = tts;
    tts.done.then(() => {
      if (activeTts === tts) {
        activeTts = null;
        send({ type: 'tts_end' });
        detector.onSystemSpeakingEnd();
      }
    });
  }

  // Deepgram connection
  const dg = createDeepgramConnection(DEEPGRAM_API_KEY, {
    onOpen: () => {
      console.log(`[dg] open (${state.sessionId})`);
      send({ type: 'ready', sessionId: state.sessionId });
      // Fire the opening context probe immediately after connection
      // Small delay to let the client settle before audio starts
      setTimeout(() => {
        if (!state.openingDone) {
          state.markOpeningDone();
          const openingText = probeEngine.getOpeningProbe();
          void speakProbe(openingText, 'open_context');
          console.log('[opening] sending context probe');
        }
      }, 500);
    },
    onTranscript: msg => {
      detector.onTranscript(msg);
      capture.writeFinalTranscript(msg);
      const alt = msg.channel.alternatives[0];
      if (!alt?.transcript) return;

      if (msg.is_final) {
        send({ type: 'final', text: alt.transcript });
      } else {
        // Update live utterance with interim
        const snap = state.snapshot();
        const combined = (snap.liveUtterance + ' ' + alt.transcript).trim();
        void state.updateLiveUtterance(combined).then(() => {
          send({ type: 'partial', text: alt.transcript });
          // Fire classifier (debounced internally)
          void classifier.classify(state.snapshot(), (signals, trigger) => {
            if (signals.length === 0) return;
            void state.mergeSignals(signals, trigger).then(() => {
              emitStateUpdate();
              // Speculative probe generation if we have a confident signal
              maybeSpeculativeProbe();
            });
          });
          emitStateUpdate();
        });
      }
    },
    onUtteranceEnd: msg => detector.onUtteranceEnd(msg),
    onSpeechStarted: msg => {
      detector.onSpeechStarted(msg);
      // Barge-in: if TTS is active, cancel it
      if (activeTts) {
        console.log('[bargein] speech started during TTS');
        activeTts.abort();
        activeTts = null;
        send({ type: 'tts_end' });
        detector.onSystemSpeakingEnd();
      }
    },
    onClose: () => console.log(`[dg] closed (${state.sessionId})`),
    onError: err => {
      console.error('[dg] error', err);
      send({ type: 'error', message: 'transcription error' });
    },
  });

  // Endpoint detector tick
  const tickInterval = setInterval(() => detector.tick(), 50);

  // Endpoint handler
  detector.on('endpoint_detected', async ({ finalUtterance, reason }) => {
    console.log(`[endpoint] ${reason}: "${finalUtterance}"`);

    // ================================================================
    // ONBOARDING PHASE — structured conversation before GTM discovery
    // ================================================================
    if (!state.onboardingDone) {
      const step = state.onboardingStep;
      console.log(`[onboarding] step=${step} utterance="${finalUtterance}"`);

      const recordTurn = () => state.commitTurn(finalUtterance, 0, false, lastProbeText)
        .then(t => capture.writeTurn(t));

      switch (step) {
        case 'ask_name': {
          await recordTurn();
          const name = extractName(finalUtterance);
          state.setParticipantDisplayName(name);
          state.advanceOnboarding('ask_consent');
          const q = ONBOARDING_ASK_CONSENT(name ?? 'there');
          await state.recordSystemProbe(q);
          await speakProbe(q, 'onboarding');
          break;
        }
        case 'ask_consent': {
          await recordTurn();
          const yes = isConsentYes(finalUtterance);
          state.setNameConsented(yes);
          if (!yes) state.setParticipantDisplayName(null);
          state.advanceOnboarding('ask_job_title');
          const q = ONBOARDING_ASK_JOB_TITLE(state.participantDisplayName, state.nameConsented);
          await state.recordSystemProbe(q);
          await speakProbe(q, 'onboarding');
          break;
        }
        case 'ask_job_title': {
          await recordTurn();
          const title = finalUtterance.trim().replace(/^(i'?m a?n?\s*|i work as a?n?\s*)/i, '').trim();
          state.setJobTitle(title || finalUtterance.trim());
          state.advanceOnboarding('ask_loves_job');
          const q = ONBOARDING_ASK_LOVES_JOB(state.jobTitle ?? 'that');
          await state.recordSystemProbe(q);
          await speakProbe(q, 'onboarding');
          break;
        }
        case 'ask_loves_job': {
          await recordTurn();
          state.setLovesJob(finalUtterance.trim());
          state.advanceOnboarding('ask_frustrations');
          const q = ONBOARDING_ASK_FRUSTRATIONS(state.participantDisplayName, state.nameConsented);
          await state.recordSystemProbe(q);
          await speakProbe(q, 'onboarding');
          break;
        }
        case 'ask_frustrations': {
          await recordTurn();
          state.setFrustrations(finalUtterance.trim());
          state.advanceOnboarding('done');
          // Personalise the transition if we have a name
          const name = state.nameConsented ? state.participantDisplayName : null;
          const transition = name
            ? `Thank you, ${name}. I really appreciate you sharing that. Now, let's talk about the bigger picture of your business. What's the biggest challenge you're trying to solve right now?`
            : ONBOARDING_TRANSITION;
          await state.recordSystemProbe(transition);
          await speakProbe(transition, 'onboarding');
          console.log(`[onboarding] done. name="${state.participantDisplayName}", title="${state.jobTitle}"`);
          break;
        }
        default:
          break;
      }
      emitStateUpdate();
      return;
    }

    // ================================================================
    // GTM DISCOVERY PHASE
    // ================================================================
    const snap = state.snapshot();
    const currentSignalType = snap.currentSignal?.type ?? null;

    // --- Confusion / no-signal gate ---
    const confused = isConfused(finalUtterance);
    const hasSignal = snap.currentSignal !== null;

    if (confused || !hasSignal) {
      state.incrementConfusion();
      const confCount = state.confusionCount;
      const turn = await state.commitTurn(finalUtterance, 0, false, lastProbeText);
      capture.writeTurn(turn);

      let reorientText: string;
      if (confCount <= 1) {
        reorientText = probeEngine.getReorientProbe(0);
      } else if (confCount <= 3) {
        reorientText = probeEngine.getReorientProbe(confCount - 1);
      } else {
        reorientText = probeEngine.getEncourageProbe(confCount - 4);
      }
      console.log(`[reorient] confusion=${confCount}, confused=${confused}, hasSignal=${hasSignal}`);

      const probeRecord: ProbeCandidate = {
        text: reorientText, targetSignal: null, strategy: confused ? 'reorient' : 'encourage',
        generatedBy: 'template_fallback', tokenLatencyMs: 0,
        generatedAt: Date.now(), triggerUtterance: finalUtterance,
      };
      capture.writeProbe(probeRecord);
      await state.recordSystemProbe(reorientText);
      await speakProbe(reorientText, probeRecord.strategy);
      emitStateUpdate();
      return;
    }

    // --- Normal turn: we have a signal ---
    state.resetConfusion();

    // 1. Score depth
    const depthResult = await depthScorer.score(finalUtterance, currentSignalType, lastProbeText);
    console.log(`[depth] ${depthResult.depth} (example=${depthResult.exampleProvided}): ${depthResult.reasoning}`);

    // 2. Determine lens promotion from open
    if (snap.currentLens === 'open' && snap.currentSignal) {
      const newLens = SIGNAL_TO_LENS[snap.currentSignal.type];
      await state.setLens(newLens);
    }

    // 3. Commit turn
    const turn = await state.commitTurn(
      finalUtterance, depthResult.depth, depthResult.exampleProvided, lastProbeText,
    );
    capture.writeTurn(turn);

    // 4. Select probe strategy
    const canProgress = depthResult.depth >= 3 && depthResult.exampleProvided;
    let strategy: ProbeStrategy;
    if (!canProgress) {
      strategy = depthResult.depth >= 2 ? 'request_example' : 'drill_depth';
    } else {
      strategy = 'transition_lens';
    }

    // 5. Decide: commit pending or generate sync
    const currentSnap = state.snapshot();
    let probe = currentSnap.pendingProbe;
    const probeIsStale = probe && (Date.now() - probe.generatedAt > 8000);
    const strategyMismatch = probe && probe.strategy !== strategy
      && !(strategy === 'request_example' && probe.strategy === 'drill_depth');

    if (!probe || probeIsStale || strategyMismatch) {
      probe = await probeEngine.generate(currentSnap, strategy, 'sync');
    }

    // 6. Dedup check — if we're about to repeat, regenerate
    const recentProbes = state.getRecentProbes();
    if (recentProbes.slice(-3).includes(probe.text)) {
      console.log('[probe] dedup: regenerating to avoid repeat');
      probe = await probeEngine.generate(currentSnap, strategy, 'sync');
    }

    capture.writeProbe(probe);
    await state.recordSystemProbe(probe.text);
    await speakProbe(probe.text, probe.strategy);
    emitStateUpdate();
  });

  // Speculative probe trigger
  async function maybeSpeculativeProbe(): Promise<void> {
    const snap = state.snapshot();
    if (!snap.currentSignal) return;
    if (snap.currentSignal.confidence < 0.7) return;
    if (snap.pendingProbe) {
      // Already have a probe targeting this signal - skip
      if (snap.pendingProbe.targetSignal === snap.currentSignal.type) return;
    }
    // Fire and forget
    probeEngine.generate(snap, 'drill_depth', 'speculative')
      .then(probe => state.setPendingProbe(probe))
      .then(() => emitStateUpdate())
      .catch(err => console.error('[spec probe] error', err));
  }

  // Client messages
  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      const buf = data as Buffer;
      dg.sendAudio(buf);
      capture.writeUserAudio(buf);
      return;
    }

    try {
      const msg = JSON.parse((data as Buffer).toString('utf-8')) as ClientMessage;
      switch (msg.type) {
        case 'start':
          console.log(`[client] start, participant=${msg.participantName ?? '(anon)'}`);
          break;
        case 'interrupt':
          if (activeTts) {
            activeTts.abort();
            activeTts = null;
            send({ type: 'tts_end' });
            detector.onSystemSpeakingEnd();
          }
          break;
        case 'end':
          ws.close();
          break;
      }
    } catch (err) {
      console.error('[client msg] parse error', err);
    }
  });

  ws.on('close', async () => {
    console.log(`[conn] closed (${state.sessionId})`);
    clearInterval(tickInterval);
    if (activeTts) activeTts.abort();
    dg.close();
    await capture.close();
    // Post-session synthesis is deferred - run via CLI tool on captured session dir
    console.log(`[session] captured to ${capture.sessionDir}`);
  });
}

httpServer.listen(PORT, () => {
  console.log(`EthentaFlow server listening on :${PORT}`);
  console.log(`WebSocket at ws://localhost:${PORT}/ws`);
});
