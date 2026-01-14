let currentAudio: HTMLAudioElement | null = null;

let fallbackTimer: number | null = null;
let fallbackUtterance: SpeechSynthesisUtterance | null = null;

let hasUserInteracted = false;
let pendingText: string | null = null;

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

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    if (fallbackTimer != null) {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    fallbackUtterance = null;

    console.log('🔊 Requesting OpenAI TTS for:', text.substring(0, 50) + '...');

    let openAiAudioStarted = false;

    if (typeof window !== 'undefined' && window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
      try {
        fallbackTimer = window.setTimeout(() => {
          if (openAiAudioStarted) return;
          try {
            const u = new SpeechSynthesisUtterance(text);
            u.rate = 1.05;
            fallbackUtterance = u;
            window.speechSynthesis.speak(u);
          } catch {
            // ignore
          }
        }, 700);
      } catch {
        // ignore
      }
    }

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

    const cancelFallback = () => {
      openAiAudioStarted = true;
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          if (fallbackUtterance) {
            window.speechSynthesis.cancel();
          }
        } catch {
          // ignore
        }
      }
      if (fallbackTimer != null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      fallbackUtterance = null;
    };

    audio.onplaying = () => {
      cancelFallback();
    };

    try {
      await audio.play();
      cancelFallback();
      console.log('✅ Playing OpenAI TTS audio');
    } catch (e: any) {
      // Most common in Chrome/Safari: autoplay policy blocks play() before user interaction.
      if (e?.name === 'NotAllowedError') {
        console.warn('🔇 Autoplay blocked; will retry after user interaction');
        pendingText = text;
        hasUserInteracted = false;
        ensureInteractionListeners();

        if (fallbackTimer != null) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        fallbackUtterance = null;
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
  if (fallbackTimer != null) {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  fallbackUtterance = null;
  pendingText = null;
}
