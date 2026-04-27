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

// ── Deepgram ASR profile ─────────────────────────────────────────────────────
// Select via DEEPGRAM_PROFILE env var (default: "current").
//
// Problem: Nova-3 + smart_format normalises filler words ("to", "ate",
// "ten/then") into digits, producing phantom number tokens (e.g. participant
// says "to compete" and the transcript reads "10 compete").
//
// Profile comparison for voice-interview use:
//
//   "current"            smart_format:true, no explicit numerals control.
//                        Best formatting quality; highest phantom-digit risk.
//
//   "a" / "no-smart"     smart_format:false, punctuate:true, numerals:false.
//                        Words stay as words ("ten", not "10"). Capitalisation
//                        and entity formatting are weaker, but phantom digits
//                        are eliminated. Recommended if artefacts persist.
//
//   "b" / "smart-no-num" smart_format:true, numerals:false.
//                        Attempts to keep smart formatting while blocking
//                        numeral conversion. In practice Deepgram's smart_format
//                        overrides numerals:false for some models, so this may
//                        not fully eliminate phantom digits. Use as a stepping
//                        stone between "current" and "a".
//
// Recommended migration path: current → b → a until artefacts stop.

const _PROFILE = (process.env.DEEPGRAM_PROFILE ?? 'current').toLowerCase();

const _BASE_CONFIG = {
  model: 'nova-3',
  language: 'en-GB',
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 1,
  interim_results: true,
  endpointing: 700,          // ms of silence before Deepgram segments — short enough to feel responsive
  utterance_end_ms: 1600,    // UtteranceEnd fires after 1.6s silence — fast for short answers, agent will still wait if user resumes (Deepgram resets)
  vad_events: true,
  diarize: true,             // label audio by speaker — lets us filter out background voices
} as const;

const DEEPGRAM_CONFIG: Record<string, unknown> = (() => {
  switch (_PROFILE) {
    case 'a':
    case 'no-smart':
      // Minimal normalisation — words stay as words. Best for preventing phantom digits.
      console.log('[deepgram] profile=a (no-smart): smart_format:false, punctuate:true, numerals:false');
      return { ..._BASE_CONFIG, smart_format: false, punctuate: true, numerals: false };

    case 'b':
    case 'smart-no-num':
      // Hybrid: keep smart formatting, attempt to block numeral conversion.
      // Note: smart_format may override numerals:false on some Nova-3 builds.
      console.log('[deepgram] profile=b (smart-no-num): smart_format:true, numerals:false');
      return { ..._BASE_CONFIG, smart_format: true, punctuate: true, numerals: false };

    default:
      // Default config — smart formatting on, numeral conversion off to prevent phantom digits.
      console.log('[deepgram] profile=current: smart_format:true, punctuate:true, numerals:false');
      return { ..._BASE_CONFIG, smart_format: true, punctuate: true, numerals: false };
  }
})();

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
