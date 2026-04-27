// TTS streaming via ElevenLabs.
// Uses their streaming PCM endpoint — 24kHz linear16, no container.
// ElevenLabs voices are dramatically more natural than OpenAI for
// conversational AI — proper sentence rhythm, intonation, British accent.
//
// Voice options:
//   Daniel    — onwK4e9ZLuTAKqWW03F9  — deep, authoritative, professional British male (premium tier)
//   George    — JBFqnCBsd6RMkjVDRZzb  — warm, clear, conversational British male
//   Harry     — SOYHLrjzK2X1ezoPC6cr  — friendly, natural British male
//   Charlotte — XB0fDUnXU5powFXDhCwa  — warm, engaging, professional British female
//   Alice     — Xb7hH8MSUJpSbSDYk0k2  — crisp, professional British female
//   Lily      — pFZP5JQG7iQjIQuC4Bku  — warm, bright British female
//
// Model options:
//   eleven_flash_v2_5   — lowest latency (~300ms), good quality
//   eleven_turbo_v2_5   — balanced latency/quality
//   eleven_multilingual_v2 — best quality, slightly higher latency

import { Buffer } from 'node:buffer';

// 24kHz, 16-bit mono = 48000 bytes/sec → 4800 bytes = 100ms chunks
const MIN_CHUNK_BYTES = 4800;

const ELEVENLABS_VOICE_ID = 'pFZP5JQG7iQjIQuC4Bku'; // Lily — warm, bright British female
const ELEVENLABS_MODEL    = 'eleven_flash_v2_5';      // lowest latency (~300ms) — best for real-time conversation

export interface TTSHandle {
  abort: () => void;
  done: Promise<void>;
}

export function synthesiseStream(
  apiKey: string,
  text: string,
  onAudio: (chunk: Buffer) => void,
): TTSHandle {
  const controller = new AbortController();

  const done = (async () => {
    try {
      // output_format must be a query param — body-only is ignored and returns mp3
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream?output_format=pcm_24000`;

      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL,
          voice_settings: {
            stability: 0.65,          // higher = calmer, less pitch variation, more measured delivery
            similarity_boost: 0.75,   // close to voice character
            style: 0.20,              // low style = understated, no excitement or uplift
            use_speaker_boost: true,  // keeps presence without adding energy
            speed: 1.0,               // natural pace — not rushing
          },
        }),
      });

      if (!response.ok) {
        const err = await response.text().catch(() => response.statusText);
        console.error(`[tts] ElevenLabs error ${response.status}: ${err}`);
        return;
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      let pending = Buffer.alloc(0);

      while (true) {
        if (controller.signal.aborted) {
          reader.cancel().catch(() => {});
          return;
        }

        const { value, done: streamDone } = await reader.read();

        if (streamDone) {
          // Flush remaining buffered audio
          if (pending.length > 0 && !controller.signal.aborted) {
            onAudio(pending);
          }
          return;
        }

        if (value) {
          pending = Buffer.concat([pending, Buffer.from(value)]);
          // Send in 100ms blocks for smooth scheduling
          while (pending.length >= MIN_CHUNK_BYTES) {
            if (controller.signal.aborted) return;
            onAudio(pending.subarray(0, MIN_CHUNK_BYTES));
            pending = pending.subarray(MIN_CHUNK_BYTES);
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('[tts] stream error', err);
      }
    }
  })();

  return {
    abort: () => controller.abort(),
    done,
  };
}
