// EthentaFlow client entry.

import { MicCapture } from './mic.js';
import { WSClient } from './ws.js';
import { AudioPlayback } from './audio-playback.js';
import { UI } from './ui.js';

// Build WebSocket URL.
//
// Resolution order:
//   1. VITE_WS_URL env var (set at build time) — full URL incl. wss://...
//   2. ?ws=<url> URL param (handy for testing against alt servers)
//   3. Same-origin host on port 3001 (local dev default)
function buildWsUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  const overrideUrl = new URLSearchParams(location.search).get('ws') ?? undefined;
  const base =
    (overrideUrl && overrideUrl.trim()) ||
    (envUrl && envUrl.trim()) ||
    ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':3001/ws');
  const workshopId = new URLSearchParams(location.search).get('workshop_id');
  return workshopId ? `${base}${base.includes('?') ? '&' : '?'}workshop_id=${encodeURIComponent(workshopId)}` : base;
}
const WS_URL = buildWsUrl();

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
const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
const endBtn = document.getElementById('endBtn') as HTMLButtonElement;
const textInput = document.getElementById('textInput') as HTMLTextAreaElement;
const textSendBtn = document.getElementById('textSendBtn') as HTMLButtonElement;
const textInputRow = document.getElementById('textInputRow') as HTMLDivElement;
const modeVoiceBtn = document.getElementById('modeVoiceBtn') as HTMLButtonElement;
const modeTextBtn = document.getElementById('modeTextBtn') as HTMLButtonElement;

let isPaused = false;
let sessionMode: 'voice' | 'text' = (new URLSearchParams(location.search).get('mode') === 'text') ? 'text' : 'voice';
let sessionActive = false;

function applyModeUI(): void {
  modeVoiceBtn.classList.toggle('active', sessionMode === 'voice');
  modeTextBtn.classList.toggle('active', sessionMode === 'text');
  // Show/hide the typing input row. Visible only in text mode AND while session is active.
  const visible = sessionMode === 'text' && sessionActive;
  textInputRow.style.display = visible ? 'block' : 'none';
}
applyModeUI();

function sendTypedAnswer(): void {
  const text = textInput.value.trim();
  if (!text || !ws) return;
  ws.sendUserText(text);
  ui.appendFinalUser(text);
  textInput.value = '';
  textInput.focus();
}
textSendBtn.addEventListener('click', sendTypedAnswer);

modeVoiceBtn.addEventListener('click', () => {
  if (sessionMode === 'voice') return;
  sessionMode = 'voice';
  applyModeUI();
  // If a session is active, tell the server to switch on the fly.
  if (sessionActive && ws) ws.sendSwitchMode('voice');
});
modeTextBtn.addEventListener('click', () => {
  if (sessionMode === 'text') return;
  sessionMode = 'text';
  applyModeUI();
  if (sessionActive && ws) {
    ws.sendSwitchMode('text');
    textInput.focus();
  }
});

textInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  // Shift+Enter adds a newline; Enter alone sends.
  if (e.shiftKey) return;
  e.preventDefault();
  sendTypedAnswer();
});

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  try {
    await startSession();
    sessionActive = true;
    pauseBtn.disabled = false;
    pauseBtn.textContent = 'Pause';
    isPaused = false;
    endBtn.disabled = false;
    applyModeUI();
    if (sessionMode === 'text') textInput.focus();
  } catch (err) {
    console.error(err);
    ui.setStatus('Failed to start: ' + (err as Error).message);
    startBtn.disabled = false;
  }
});

pauseBtn.addEventListener('click', () => {
  if (!ws) return;
  if (isPaused) {
    ws.sendResume();
    pauseBtn.textContent = 'Pause';
    isPaused = false;
  } else {
    ws.sendPause();
    pauseBtn.textContent = 'Resume';
    isPaused = true;
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
        // First sentence of an agent turn — creates a new chat bubble.
        ui.appendSystemProbe(msg.text, msg.strategy);
        break;
      case 'probe_append':
        // Subsequent streamed sentences from the same turn — append to
        // the most recent AI bubble so the turn renders as ONE bubble that
        // grows, not as N separate bubbles.
        ui.appendToLastSystemProbe(msg.text);
        break;
      case 'measure_prompt':
        // Show the coloured scoring card for this lens, with the canonical
        // Dream Discovery 5-band maturity scale (per lens) if provided.
        ui.showScoringCard(msg.lens, msg.question, msg.maturityScale ?? null);
        break;
      case 'lens_rating':
        // Highlight the captured score on the card. Do NOT auto-hide — the
        // card must stay visible while the agent explores follow-ups for this
        // lens, so the participant can refer to the maturity bands. The card
        // is replaced when the next lens's measure_prompt arrives, or hidden
        // on session_complete.
        ui.highlightScore(msg.current);
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
        ui.setPaused(true);
        break;
      case 'session_resumed':
        ui.setStatus('Session resumed — speak naturally');
        ui.setLive(true);
        ui.setPaused(false);
        break;
      case 'coverage_update':
        ui.updateCoverage(msg);
        break;
      case 'interview_progress':
        ui.updateInterviewProgress(msg);
        break;
      case 'synthesis_update':
        ui.updateSynthesis(msg.synthesis, ws);
        break;
      case 'email_sent':
        ui.notifyEmailSent((msg as any).to);
        break;
      case 'session_complete':
        ui.setStatus('Session complete');
        ui.hideScoringCard();
        ui.markSessionComplete();
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
    pauseBtn.disabled = true;
    pauseBtn.textContent = 'Pause';
    isPaused = false;
    sessionActive = false;
    applyModeUI();
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

  // Read participant data from URL params — set by the Discovery setup page.
  // e.g. http://localhost:5173/?name=Andrew+Hall&title=COO&company=Capita&email=a@b.co&mode=text
  const urlParams = new URLSearchParams(location.search);
  const participantName = urlParams.get('name') ?? undefined;
  const participantTitle = urlParams.get('title') ?? undefined;
  const participantCompany = urlParams.get('company') ?? undefined;
  const participantEmail = urlParams.get('email') ?? undefined;
  const resumeSessionId = urlParams.get('resume') ?? undefined;
  const workshopId = urlParams.get('workshopId') ?? undefined;
  const participantToken = urlParams.get('participantToken') ?? undefined;
  const lensesParam = urlParams.get('lenses');
  const lenses = lensesParam ? lensesParam.split(',').map(l => l.trim()).filter(Boolean) : undefined;
  ws.sendStart(participantName, participantTitle, resumeSessionId, lenses, undefined, {
    participantCompany, participantEmail, workshopId, participantToken, mode: sessionMode,
  });
  // In text mode, also share the email with the UI so the email button knows where to send.
  ui.setParticipantEmail(participantEmail);
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
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'Pause';
  isPaused = false;
  startBtn.disabled = false;
}
