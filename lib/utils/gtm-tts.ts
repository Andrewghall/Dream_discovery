/**
 * GTM TTS utility — always uses OpenAI (never browser TTS).
 *
 * Returns a Promise that resolves when audio playback ENDS,
 * so callers can await it and chain the next action cleanly.
 *
 * prefetchGtm pre-loads audio into the cache so speakGtm has near-zero
 * latency when it fires. Cache is keyed by text + speed.
 */

let currentAudio: HTMLAudioElement | null = null;

// ── Prefetch cache ──────────────────────────────────────────────────────────
const prefetchCache = new Map<string, Promise<string>>(); // key → objectURL promise

function cacheKey(text: string, speed: number): string {
  return `${speed}::${text}`;
}

export function prefetchGtm(text: string, token: string, speed = 1.0): Promise<void> {
  const key = cacheKey(text, speed);
  if (!prefetchCache.has(key)) {
    const p = fetch('/api/speak-discovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, token, speed }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`TTS prefetch failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => URL.createObjectURL(blob));
    prefetchCache.set(key, p);
    // Evict after 60 s to avoid memory leaks
    setTimeout(() => {
      prefetchCache.get(key)?.then((url) => URL.revokeObjectURL(url)).catch(() => {});
      prefetchCache.delete(key);
    }, 60_000);
  }
  return prefetchCache.get(key)!.then(() => undefined);
}

export function stopGtmAudio(): void {
  if (currentAudio) {
    try { currentAudio.pause(); } catch { /* ignore */ }
    currentAudio = null;
  }
}

export async function speakGtm(text: string, token: string, speed = 1.0): Promise<void> {
  stopGtmAudio();

  const key = cacheKey(text, speed);
  let url: string;

  if (prefetchCache.has(key)) {
    try {
      url = await prefetchCache.get(key)!;
      prefetchCache.delete(key);
    } catch {
      prefetchCache.delete(key);
      url = await fetchTtsUrl(text, token, speed);
    }
  } else {
    url = await fetchTtsUrl(text, token, speed);
  }

  const audio = new Audio(url);
  currentAudio = audio;

  return new Promise<void>((resolve, reject) => {
    audio.playbackRate = speed;
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

async function fetchTtsUrl(text: string, token: string, speed: number): Promise<string> {
  const res = await fetch('/api/speak-discovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, token, speed }),
  });
  if (!res.ok) throw new Error(`TTS request failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
