// EthentaFlow client entry.

import { MicCapture } from './mic.js';
import { WSClient } from './ws.js';
import { AudioPlayback } from './audio-playback.js';
import { UI } from './ui.js';

const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':3001/ws';

const ui = new UI();
let mic: MicCapture | null = null;
let ws: WSClient | null = null;
let playback: AudioPlayback | null = null;

// Gate: stop sending mic audio to server while TTS is playing to prevent echo feedback loop.
// The mic picks up the speaker output; without this gate Deepgram fires SpeechStarted on
// the system's own voice, triggering barge-in and crashing the first sentence.
let ttsActive = false;
// True once the server has sent tts_end (stream done) but audio may still be playing
let ttsStreamDone = false;
// Brief hold-off after audio physically finishes: echo reverb lingers ~300ms.
const TTS_HOLDOFF_MS = 350;
let ttsHoldoffTimer: ReturnType<typeof setTimeout> | null = null;

function onTtsStreamEnd(): void {
  // Server finished sending — mark stream done but keep ttsActive=true.
  // The mic gate opens only once the AudioPlayback's onEnded fires.
  ttsStreamDone = true;
  // If playback has already finished (edge case: very short audio, or ElevenLabs error
  // returned no audio at all), open gate now so the session doesn't lock up silently.
  if (!playback?.isPlaying()) {
    openMicGate();
  } else {
    // Safety net: if onEnded never fires within 60s, force-open the gate.
    // This can happen if the AudioContext stays suspended and audio never completes.
    const safetyTimer = setTimeout(() => {
      if (ttsActive) {
        console.warn('[audio] onEnded never fired — force-opening mic gate');
        openMicGate();
      }
    }, 60_000);
    // Cancel the safety timer once onEnded fires naturally
    const prevOnEnded = playback!.onEnded;
    playback!.onEnded = () => {
      clearTimeout(safetyTimer);
      playback!.onEnded = prevOnEnded;
      prevOnEnded?.();
    };
  }
}

function openMicGate(): void {
  // Start the echo hold-off — mic opens after reverb dies
  if (ttsHoldoffTimer) { clearTimeout(ttsHoldoffTimer); ttsHoldoffTimer = null; }
  ttsHoldoffTimer = setTimeout(() => {
    ttsActive = false;
    ttsStreamDone = false;
    ttsHoldoffTimer = null;
    // Tell the server that audio has fully finished playing (buffer drained + echo holdoff).
    // Server uses this to fire any chained follow-on probe (e.g. Q1 after intro greeting)
    // at exactly the right moment — not 20-30s early when the TTS stream ended.
    ws?.sendPlaybackDone();
  }, TTS_HOLDOFF_MS);
}

function setTtsActive(active: boolean): void {
  if (active) {
    if (ttsHoldoffTimer) { clearTimeout(ttsHoldoffTimer); ttsHoldoffTimer = null; }
    ttsActive = true;
    ttsStreamDone = false;
  }
}

const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const endBtn = document.getElementById('endBtn') as HTMLButtonElement;

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  try {
    await startSession();
    endBtn.disabled = false;
  } catch (err) {
    console.error(err);
    ui.setStatus('Failed to start: ' + (err as Error).message);
    startBtn.disabled = false;
  }
});

endBtn.addEventListener('click', () => {
  stopSession();
});

async function startSession(): Promise<void> {
  ui.setStatus('Connecting...');
  ws = new WSClient(WS_URL);
  await ws.connect();

  ws.onMessage = msg => {
    switch (msg.type) {
      case 'ready':
        ui.setStatus('Ready - speak naturally');
        ui.setLive(true);
        ui.startSessionTimer();
        break;
      case 'partial':
        ui.setPartial(msg.text);
        break;
      case 'final':
        // User has spoken — card stays up (server will send lens_rating to dismiss it)
        ui.appendFinalUser(msg.text);
        break;
      case 'probe':
        // A new probe means the scoring phase for this turn is done — dismiss the card
        // ONLY if this is NOT a measure strategy (the card should stay up during measurement)
        if (msg.strategy !== 'measure') {
          ui.hideScoringCard();
          ui.appendSystemProbe(msg.text, msg.strategy);
        }
        break;
      case 'measure_prompt':
        // Show the coloured scoring card for this lens
        ui.showScoringCard(msg.lens, msg.question);
        break;
      case 'lens_rating':
        // Highlight the captured score on the card, then fade the card after a moment
        ui.highlightScore(msg.current);
        setTimeout(() => {
          ui.hideScoringCard();
        }, 1800);
        break;
      case 'state_update':
        ui.updateDebug(msg.state);
        break;
      case 'tts_start':
        ui.setStatus('Listening (system speaking)');
        setTtsActive(true);
        break;
      case 'tts_end':
        // Server stream finished — but don't open mic gate yet.
        // Wait until AudioPlayback.onEnded fires (audio physically done playing).
        onTtsStreamEnd();
        break;
      case 'session_paused':
        ui.setStatus('Session paused');
        ui.setLive(false);
        break;
      case 'session_resumed':
        ui.setStatus('Session resumed — speak naturally');
        ui.setLive(true);
        break;
      case 'coverage_update':
        ui.updateCoverage(msg);
        break;
      case 'interview_progress':
        ui.updateInterviewProgress(msg);
        break;
      case 'session_complete':
        ui.setStatus('Session complete');
        break;
      case 'error':
        ui.setStatus('Error: ' + msg.message);
        break;
    }
  };

  ws.onAudio = chunk => {
    if (playback) playback.push(chunk);
  };

  ws.onClose = () => {
    ui.setLive(false);
    ui.setStatus('Disconnected');
    ui.stopSessionTimer();
    endBtn.disabled = true;
    startBtn.disabled = false;
    ttsActive = false;
    ttsStreamDone = false;
    if (ttsHoldoffTimer) { clearTimeout(ttsHoldoffTimer); ttsHoldoffTimer = null; }
  };

  playback = new AudioPlayback(24000);
  await playback.init();
  // Open the mic gate only when audio has physically finished playing,
  // not when the server stream ends (audio may still be buffered and playing).
  playback.onEnded = () => {
    if (ttsStreamDone) {
      openMicGate();
    }
  };

  mic = new MicCapture(16000);
  await mic.start(chunk => {
    // Do NOT send audio to the server while TTS is playing (or during hold-off).
    // This prevents the mic picking up speaker output and triggering barge-in
    // on the system's own voice.
    if (ttsActive) return;

    ws?.sendAudio(chunk);

    // Hard barge-in: only if user is speaking very loudly while audio is still queued.
    // Threshold 0.4 = loud speech, not ambient noise. Primary barge-in is via server
    // SpeechStarted event; this is a last-resort fallback.
    if (playback?.isPlaying() && (mic?.currentLevel() ?? 0) > 0.4) {
      playback.stop();
      ws?.sendInterrupt();
    }
  });

  // Read participant data from URL params — set by the Discovery setup page
  // e.g. http://localhost:5173/?name=Andrew+Hall&title=Chief+Operating+Officer&resume=<sessionId>
  const urlParams = new URLSearchParams(location.search);
  const participantName = urlParams.get('name') ?? undefined;
  const participantTitle = urlParams.get('title') ?? undefined;
  const resumeSessionId = urlParams.get('resume') ?? undefined;
  // Optional lens override: ?lenses=people,operations,technology,risk_compliance
  const lensesParam = urlParams.get('lenses');
  const lenses = lensesParam ? lensesParam.split(',').map(l => l.trim()).filter(Boolean) : undefined;
  ws.sendStart(participantName, participantTitle, resumeSessionId, lenses);
}

function stopSession(): void {
  mic?.stop();
  ws?.sendEnd();
  ws?.close();
  playback?.stop();
  mic = null;
  ws = null;
  playback = null;
  ttsActive = false;
  ttsStreamDone = false;
  if (ttsHoldoffTimer) { clearTimeout(ttsHoldoffTimer); ttsHoldoffTimer = null; }
  ui.setLive(false);
  ui.stopSessionTimer();
  ui.setStatus('Disconnected');
  endBtn.disabled = true;
  startBtn.disabled = false;
}
