export function speakText(text: string, language: string = 'en'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Text-to-speech not supported in this browser');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'en' ? 'en-GB' : language; // UK English
  utterance.rate = 1.1; // Good conversational pace - not dragging
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to find a UK English female voice
  const voices = window.speechSynthesis.getVoices();
  
  // Prioritize UK English female voices
  let selectedVoice = voices.find(voice => 
    voice.lang === 'en-GB' && voice.name.toLowerCase().includes('female')
  );
  
  // Fallback to any UK English voice
  if (!selectedVoice) {
    selectedVoice = voices.find(voice => voice.lang === 'en-GB');
  }
  
  // Fallback to any female English voice
  if (!selectedVoice) {
    selectedVoice = voices.find(voice => 
      voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
    );
  }
  
  // Final fallback to any English voice
  if (!selectedVoice) {
    selectedVoice = voices.find(voice => voice.lang.startsWith(language));
  }
  
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
