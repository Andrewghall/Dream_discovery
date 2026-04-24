/**
 * GTM TTS utility — always uses OpenAI (never browser TTS).
 *
 * Returns a Promise that resolves when audio playback ENDS,
 * so callers can await it and chain the next action cleanly.
 */

let currentAudio: HTMLAudioElement | null = null;

export function stopGtmAudio(): void {
  if (currentAudio) {
    try { currentAudio.pause(); } catch { /* ignore */ }
    currentAudio = null;
  }
}

export async function speakGtm(text: string, token: string): Promise<void> {
  stopGtmAudio();

  const res = await fetch('/api/speak-discovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, token }),
  });

  if (!res.ok) throw new Error(`TTS request failed: ${res.status}`);

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;

  return new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      reject(new Error('Audio playback error'));
    };
    audio.play().catch((err) => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      reject(err);
    });
  });
}
