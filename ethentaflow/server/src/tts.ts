// TTS streaming via Deepgram Aura.
// Produces chunked audio which the server forwards to the client.
//
// Deepgram sends very small raw PCM chunks (~1–2KB each, ~40ms).
// Scheduling dozens of tiny AudioBufferSourceNode instances on the client
// causes audible gaps. We buffer server-side to MIN_CHUNK_BYTES before
// forwarding, giving the client smooth 100ms+ blocks to schedule.

import { createClient } from '@deepgram/sdk';

export interface TTSHandle {
  abort: () => void;
  done: Promise<void>;
}

// 24kHz, 16-bit mono = 48000 bytes/sec.
// 4800 bytes = 100ms — large enough to schedule cleanly, small enough for low latency.
const MIN_CHUNK_BYTES = 4800;

export function synthesiseStream(
  apiKey: string,
  text: string,
  onAudio: (chunk: Buffer) => void,
): TTSHandle {
  const client = createClient(apiKey);
  const controller = new AbortController();

  const done = (async () => {
    try {
      const response = await client.speak.request(
        { text },
        {
          model: 'aura-2-arcas-en',  // British English male voice
          encoding: 'linear16',
          sample_rate: 24000,
          container: 'none',
        },
      );

      const stream = await response.getStream();
      if (!stream) return;

      const reader = stream.getReader();
      let pending = Buffer.alloc(0);

      while (true) {
        if (controller.signal.aborted) {
          reader.cancel().catch(() => {});
          return;
        }

        const { value, done } = await reader.read();

        if (done) {
          // Flush any remaining buffered audio
          if (pending.length > 0 && !controller.signal.aborted) {
            onAudio(pending);
          }
          return;
        }

        if (value) {
          pending = Buffer.concat([pending, Buffer.from(value)]);
          // Send once we have at least MIN_CHUNK_BYTES accumulated
          while (pending.length >= MIN_CHUNK_BYTES) {
            if (controller.signal.aborted) return;
            onAudio(pending.subarray(0, MIN_CHUNK_BYTES));
            pending = pending.subarray(MIN_CHUNK_BYTES);
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('TTS error', err);
      }
    }
  })();

  return {
    abort: () => controller.abort(),
    done,
  };
}
