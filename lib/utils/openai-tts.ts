let currentAudio: HTMLAudioElement | null = null;

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

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
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
  }
  pendingText = null;
}
