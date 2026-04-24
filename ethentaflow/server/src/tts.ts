// TTS streaming via Deepgram Aura.
// Produces chunked audio which the server forwards to the client.

import { createClient } from '@deepgram/sdk';

export interface TTSHandle {
  abort: () => void;
  done: Promise<void>;
}

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

      while (true) {
        if (controller.signal.aborted) {
          reader.cancel().catch(() => {});
          return;
        }
        const { value, done } = await reader.read();
        if (done) return;
        if (value) {
          onAudio(Buffer.from(value));
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
