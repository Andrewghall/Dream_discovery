let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

let hasUserInteracted = false;
let pendingText: string | null = null;

function isLikelyFemaleVoiceName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes('female')) return true;
  if (n.includes('male')) return false;

  const likelyFemaleTokens = [
    'samantha',
    'victoria',
    'kate',
    'serena',
    'moira',
    'tessa',
    'amelie',
    'olivia',
    'ava',
    'emily',
    'fiona',
    'zoe',
    'joanna',
    'kendra',
    'kimberly',
    'salli',
    'ivy',
    'emma',
    'amy',
    'catherine',
    'charlotte',
  ];

  return likelyFemaleTokens.some((t) => n.includes(t));
}

async function getPreferredUkVoice(): Promise<SpeechSynthesisVoice | null> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;

  const pick = (voices: SpeechSynthesisVoice[]) => {
    const preferredLangStarts = ['en-gb', 'en-ie', 'en-au', 'en-nz', 'en-za', 'en-in'];

    const normalize = (s: string | null | undefined) => (s || '').toLowerCase();
    const lang = (v: SpeechSynthesisVoice) => normalize(v.lang);

    const englishNonUs = voices.filter((v) => {
      const l = lang(v);
      return l.startsWith('en-') && !l.startsWith('en-us');
    });

    const preferredBucket = englishNonUs.filter((v) => preferredLangStarts.some((p) => lang(v).startsWith(p)));
    const pool = preferredBucket.length > 0 ? preferredBucket : englishNonUs;
    if (pool.length === 0) return null;

    const female = pool.find((v) => isLikelyFemaleVoiceName(v.name || ''));
    if (female) return female;

    return pool[0] || null;
  };

  const existing = pick(window.speechSynthesis.getVoices());
  if (existing) return existing;

  // Voices often load asynchronously; wait briefly for the voiceschanged event.
  return await new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      try {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      } catch {
        // ignore
      }
      resolve(pick(window.speechSynthesis.getVoices()));
    };

    const onVoicesChanged = () => settle();

    try {
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    } catch {
      // ignore
    }

    window.setTimeout(() => settle(), 500);
  });
}

async function speakWithBrowserTts(text: string): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.speechSynthesis ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return false;
  }

  try {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }

    const u = new SpeechSynthesisUtterance(text);
    const preferredVoice = await getPreferredUkVoice();
    if (preferredVoice) {
      u.voice = preferredVoice;
      u.lang = preferredVoice.lang;
    } else {
      u.lang = 'en-GB';
    }

    u.rate = 1.0;

    u.onstart = () => {
      try {
        window.dispatchEvent(new CustomEvent('dream-tts-start'));
      } catch {
        // ignore
      }
    };

    u.onend = () => {
      currentUtterance = null;
      try {
        window.dispatchEvent(new CustomEvent('dream-tts-end'));
      } catch {
        // ignore
      }
    };

    currentUtterance = u;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    currentUtterance = null;
    return false;
  }
}

function ensureInteractionListeners() {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __dreamTtsListenersInstalled?: boolean };
  if (w.__dreamTtsListenersInstalled) return;
  w.__dreamTtsListenersInstalled = true;

  const mark = () => {
    hasUserInteracted = true;
    if (pendingText) {
      const text = pendingText;
      pendingText = null;
      // Fire and forget
      void speakWithOpenAI(text);
    }
    window.removeEventListener('pointerdown', mark);
    window.removeEventListener('keydown', mark);
  };

  window.addEventListener('pointerdown', mark, { once: true });
  window.addEventListener('keydown', mark, { once: true });
}

export async function speakWithOpenAI(text: string): Promise<void> {
  try {
    ensureInteractionListeners();

    // Avoid autoplay errors by waiting until the user interacts with the page.
    if (!hasUserInteracted) {
      pendingText = text;
      console.log('🔊 TTS queued (waiting for user interaction)');
      return;
    }

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    currentUtterance = null;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    const spokeInBrowser = await speakWithBrowserTts(text);
    if (spokeInBrowser) {
      console.log('✅ Playing browser TTS');
      return;
    }

    console.log('🔊 Requesting OpenAI TTS for:', text.substring(0, 50) + '...');

    const response = await fetch('/api/speak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate speech');
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    const audio = new Audio(audioUrl);
    currentAudio = audio;

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dream-tts-start'));
      }
    } catch {
      // ignore
    }

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;

      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dream-tts-end'));
        }
      } catch {
        // ignore
      }
    };

    audio.onerror = (error) => {
      console.error('Audio playback error:', error);
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };

    try {
      await audio.play();
      console.log('✅ Playing OpenAI TTS audio');
    } catch (e: any) {
      // Most common in Chrome/Safari: autoplay policy blocks play() before user interaction.
      if (e?.name === 'NotAllowedError') {
        console.warn('🔇 Autoplay blocked; will retry after user interaction');
        pendingText = text;
        hasUserInteracted = false;
        ensureInteractionListeners();

        return;
      }
      throw e;
    }
  } catch (error) {
    console.error('❌ OpenAI TTS error:', error);
    // Never hard-fail the app because TTS couldn't play.
    return;
  }
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dream-tts-end'));
      }
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  if (currentUtterance) {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dream-tts-end'));
      }
    } catch {
      // ignore
    }
  }
  currentUtterance = null;
  pendingText = null;
}
