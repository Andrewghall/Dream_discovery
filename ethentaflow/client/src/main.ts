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
// Brief hold-off after TTS ends: echo reverb lingers ~300ms after audio stops.
const TTS_HOLDOFF_MS = 350;
let ttsHoldoffTimer: ReturnType<typeof setTimeout> | null = null;

function setTtsActive(active: boolean): void {
  if (active) {
    if (ttsHoldoffTimer) { clearTimeout(ttsHoldoffTimer); ttsHoldoffTimer = null; }
    ttsActive = true;
  } else {
    // Don't clear immediately — wait for echo to die
    ttsHoldoffTimer = setTimeout(() => {
      ttsActive = false;
      ttsHoldoffTimer = null;
    }, TTS_HOLDOFF_MS);
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
        break;
      case 'partial':
        ui.setPartial(msg.text);
        break;
      case 'final':
        ui.appendFinalUser(msg.text);
        break;
      case 'probe':
        ui.appendSystemProbe(msg.text, msg.strategy);
        break;
      case 'state_update':
        ui.updateDebug(msg.state);
        break;
      case 'tts_start':
        ui.setStatus('Listening (system speaking)');
        setTtsActive(true);
        break;
      case 'tts_end':
        ui.setStatus('Listening');
        setTtsActive(false);
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
    endBtn.disabled = true;
    startBtn.disabled = false;
    ttsActive = false;
    if (ttsHoldoffTimer) { clearTimeout(ttsHoldoffTimer); ttsHoldoffTimer = null; }
  };

  playback = new AudioPlayback(24000);
  await playback.init();

  mic = new MicCapture(16000);
  await mic.start(chunk => {
    // Do NOT send audio to the server while TTS is playing (or during hold-off).
    // This prevents the mic picking up speaker output and triggering barge-in
    // on the system's own voice.
    if (ttsActive) return;

    ws?.sendAudio(chunk);

    // Barge-in: if playback is somehow still active and user is clearly speaking
    // above echo threshold, interrupt. The ttsActive gate above handles the common
    // case; this is a belt-and-braces check for edge cases.
    if (playback?.isPlaying() && (mic?.currentLevel() ?? 0) > 0.08) {
      playback.stop();
      ws?.sendInterrupt();
    }
  });

  ws.sendStart();
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
  if (ttsHoldoffTimer) { clearTimeout(ttsHoldoffTimer); ttsHoldoffTimer = null; }
  ui.setLive(false);
  ui.setStatus('Disconnected');
  endBtn.disabled = true;
  startBtn.disabled = false;
}
