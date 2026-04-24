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
        break;
      case 'tts_end':
        ui.setStatus('Listening');
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
  };

  playback = new AudioPlayback(24000);
  await playback.init();

  mic = new MicCapture(16000);
  await mic.start(chunk => {
    ws?.sendAudio(chunk);
    // Barge-in: if playback is active AND mic level above threshold, send interrupt
    if (playback?.isPlaying() && (mic?.currentLevel() ?? 0) > 0.05) {
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
  ui.setLive(false);
  ui.setStatus('Disconnected');
  endBtn.disabled = true;
  startBtn.disabled = false;
}
