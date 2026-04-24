// Deepgram streaming connection wrapper.
// Each session creates one connection. Server audio frames are forwarded in.
// Deepgram events are emitted to callbacks.

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type {
  DeepgramTranscript,
  DeepgramUtteranceEnd,
  DeepgramSpeechStarted,
} from './types.js';

export interface DeepgramCallbacks {
  onTranscript: (msg: DeepgramTranscript) => void;
  onUtteranceEnd: (msg: DeepgramUtteranceEnd) => void;
  onSpeechStarted: (msg: DeepgramSpeechStarted) => void;
  onOpen: () => void;
  onClose: () => void;
  onError: (err: Error) => void;
}

export interface DeepgramHandle {
  sendAudio: (chunk: Buffer) => void;
  close: () => void;
}

const DEEPGRAM_CONFIG = {
  model: 'nova-3',
  language: 'en-GB',
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 1,
  interim_results: true,
  endpointing: 300,
  utterance_end_ms: 1000,
  vad_events: true,
  smart_format: true,
  punctuate: true,
};

export function createDeepgramConnection(apiKey: string, cb: DeepgramCallbacks): DeepgramHandle {
  const client = createClient(apiKey);
  const conn = client.listen.live(DEEPGRAM_CONFIG);

  let keepAliveInterval: NodeJS.Timeout | null = null;

  conn.on(LiveTranscriptionEvents.Open, () => {
    keepAliveInterval = setInterval(() => {
      try {
        conn.keepAlive();
      } catch (e) {
        // ignore
      }
    }, 3000);
    cb.onOpen();
  });

  conn.on(LiveTranscriptionEvents.Transcript, (data: unknown) => {
    cb.onTranscript(data as DeepgramTranscript);
  });

  conn.on(LiveTranscriptionEvents.UtteranceEnd, (data: unknown) => {
    cb.onUtteranceEnd(data as DeepgramUtteranceEnd);
  });

  conn.on(LiveTranscriptionEvents.SpeechStarted, (data: unknown) => {
    cb.onSpeechStarted(data as DeepgramSpeechStarted);
  });

  conn.on(LiveTranscriptionEvents.Close, () => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    cb.onClose();
  });

  conn.on(LiveTranscriptionEvents.Error, (err: Error) => {
    cb.onError(err);
  });

  return {
    sendAudio: (chunk: Buffer) => {
      try {
        // Deepgram SDK expects ArrayBuffer, not Node Buffer
        const ab = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer;
        conn.send(ab);
      } catch (e) {
        // ignore - connection may be closing
      }
    },
    close: () => {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      try {
        conn.finish();
      } catch (e) {
        // ignore
      }
    },
  };
}
