'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { 0: SpeechRecognitionAlternative; isFinal: boolean };
type SpeechRecognitionResultList = ArrayLike<SpeechRecognitionResult> & { length: number };
type SpeechRecognitionResultEvent = { results: SpeechRecognitionResultList };
type SpeechRecognitionErrorEvent = { error: string };

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: null | (() => void);
  onresult: null | ((event: SpeechRecognitionResultEvent) => void);
  onerror: null | ((event: SpeechRecognitionErrorEvent) => void);
  onend: null | (() => void);
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return typeof ctor === 'function' ? (ctor as SpeechRecognitionConstructor) : null;
}

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  language: string;
  voiceEnabled: boolean;
  onVoiceToggle: (enabled: boolean) => void;
}

export function VoiceInput({ onTranscript, onInterimTranscript, language, voiceEnabled, onVoiceToggle }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(() => getSpeechRecognitionConstructor() !== null);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (SpeechRecognition) {
      const supported = true;
      console.log('🎤 VoiceInput component mounted');
      console.log('🎤 Speech recognition supported:', supported);
      console.log('🎤 Voice enabled:', voiceEnabled);
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Keep listening
      recognition.interimResults = true; // Show interim results
      recognition.lang = language === 'en' ? 'en-GB' : language; // UK English
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setError(null);
      };

      recognition.onresult = (event) => {
        console.log('🎤 Speech detected:', event.results);

        // Get both interim and final transcripts
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Show interim results in real-time
        if (interimTranscript && onInterimTranscript) {
          onInterimTranscript(interimTranscript);
        }

        // Send final transcript
        if (finalTranscript) {
          console.log('🎤 Final transcript:', finalTranscript);
          if (onInterimTranscript) {
            onInterimTranscript(''); // Clear interim
          }
          onTranscript(finalTranscript);
          recognition.stop();
          setIsListening(false);
          setError(null);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);

        // Handle specific errors with user-friendly messages
        switch (event.error) {
          case 'no-speech':
            setError('No speech detected. Please try again.');
            break;
          case 'audio-capture':
            setError('Microphone not found. Please check your device.');
            break;
          case 'not-allowed':
            setError('Microphone access denied. Please allow microphone access.');
            break;
          case 'network':
            setError('Network error. Please check your connection.');
            break;
          default:
            setError(`Error: ${event.error}`);
        }

        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, onTranscript, onInterimTranscript]);

  const toggleListening = async () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        // Request microphone permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognitionRef.current.start();
        setIsListening(true);
        setError(null);
      } catch (err: unknown) {
        console.error('Microphone access error:', err);
        const name =
          typeof err === 'object' && err && 'name' in err ? String((err as { name?: unknown }).name) : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('Microphone access denied. Please allow microphone access in your browser settings.');
        } else if (name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone.');
        } else {
          setError('Could not access microphone. Please check your settings.');
        }
        setTimeout(() => setError(null), 5000);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          console.log('🔊 Speaker button clicked, toggling from', voiceEnabled, 'to', !voiceEnabled);
          onVoiceToggle(!voiceEnabled);
        }}
        title={voiceEnabled ? 'Disable voice output' : 'Enable voice output'}
      >
        {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </Button>
      
      <div className="relative">
        <Button
          type="button"
          variant={isListening ? 'destructive' : 'outline'}
          size="icon"
          onClick={() => {
            console.log('🎤 Microphone button clicked');
            console.log('🎤 Is supported:', isSupported);
            console.log('🎤 Is listening:', isListening);
            toggleListening();
          }}
          title={!isSupported ? 'Voice input not supported in this browser. Try Chrome or Edge.' : isListening ? 'Stop listening' : 'Start voice input'}
          className={isListening ? 'animate-pulse' : ''}
          disabled={!isSupported}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        
        {isListening && (
          <div className="absolute bottom-full mb-2 right-0 bg-primary text-primary-foreground text-xs px-3 py-2 rounded-md whitespace-nowrap shadow-lg z-10 animate-pulse">
            🎤 Listening... Speak now
          </div>
        )}
        
        {error && (
          <div className="absolute bottom-full mb-2 right-0 bg-destructive text-destructive-foreground text-xs px-3 py-2 rounded-md whitespace-nowrap shadow-lg z-10">
            {error}
          </div>
        )}
        
        {!isSupported && (
          <div className="absolute bottom-full mb-2 right-0 bg-yellow-500 text-white text-xs px-3 py-2 rounded-md whitespace-nowrap shadow-lg z-10">
            ⚠️ Use Chrome or Edge for voice input
          </div>
        )}
      </div>
    </div>
  );
}
