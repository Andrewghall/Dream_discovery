'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// Extend window for speech recognition
declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition
    webkitSpeechRecognition?: new () => ISpeechRecognition
  }
}

interface ISpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: ISpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}

interface ISpeechRecognitionEvent {
  resultIndex: number
  results: ISpeechRecognitionResultList
}

interface ISpeechRecognitionResultList {
  length: number
  [index: number]: ISpeechRecognitionResult
}

interface ISpeechRecognitionResult {
  isFinal: boolean
  [index: number]: { transcript: string }
}

export type VoiceState = 'idle' | 'speaking' | 'listening' | 'processing' | 'reflecting'

export function useVoice() {
  const [state, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onDoneRef = useRef<((t: string) => void) | null>(null)

  useEffect(() => {
    const hasSpeech = typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(hasSpeech)
  }, [])

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined') return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.88
    utterance.pitch = 1.05
    utterance.volume = 1
    // Prefer a natural English voice
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.lang === 'en-GB' && v.localService) ||
                      voices.find(v => v.lang === 'en-GB') ||
                      voices.find(v => v.lang.startsWith('en') && v.localService) ||
                      voices.find(v => v.lang.startsWith('en'))
    if (preferred) utterance.voice = preferred
    utterance.onend = () => { setVoiceState('idle'); onEnd?.() }
    setVoiceState('speaking')
    window.speechSynthesis.speak(utterance)
  }, [])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis.cancel()
    setVoiceState('idle')
  }, [])

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    recognitionRef.current?.stop()
    setVoiceState('processing')
  }, [])

  const startListening = useCallback((onDone: (transcript: string) => void) => {
    if (!supported) return
    const SRConstructor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SRConstructor) return
    const rec = new SRConstructor()
    recognitionRef.current = rec
    onDoneRef.current = onDone

    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'

    let finalTranscript = ''

    rec.onresult = (e: ISpeechRecognitionEvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalTranscript += r[0].transcript + ' '
        else interim += r[0].transcript
      }
      setTranscript(finalTranscript)
      setInterimTranscript(interim)

      // Reset silence timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        if (finalTranscript.trim().length > 5) {
          stopListening()
        }
      }, 2200)
    }

    rec.onend = () => {
      setVoiceState('idle')
      setInterimTranscript('')
      if (finalTranscript.trim()) {
        onDoneRef.current?.(finalTranscript.trim())
      }
    }

    rec.onerror = () => {
      setVoiceState('idle')
    }

    setTranscript('')
    setInterimTranscript('')
    setVoiceState('listening')
    rec.start()
  }, [supported, stopListening])

  return { state, transcript, interimTranscript, supported, speak, stopSpeaking, startListening, stopListening, setVoiceState }
}
