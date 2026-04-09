'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceState = 'idle' | 'speaking' | 'listening' | 'processing' | 'reflecting'

export function useVoice() {
  const [state, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [supported, setSupported] = useState(false)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSpeechRef = useRef(false)
  const animFrameRef = useRef<number | null>(null)
  const onDoneRef = useRef<((t: string) => void) | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mimeTypeRef = useRef<string>('')

  useEffect(() => {
    const hasSupport =
      typeof window !== 'undefined' &&
      typeof navigator?.mediaDevices?.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(hasSupport)
  }, [])

  // ── TTS (unchanged) ─────────────────────────────────────────────────────────

  const speak = useCallback(async (text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined') return

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()

    setVoiceState('speaking')

    try {
      const res = await fetch('/api/public/assessment/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('TTS request failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        audioRef.current = null
        setVoiceState('idle')
        onEnd?.()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        audioRef.current = null
        setVoiceState('idle')
        onEnd?.()
      }
      await audio.play()
    } catch {
      // Fallback to Web Speech API for TTS only
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.88
      utterance.pitch = 1.05
      const voices = window.speechSynthesis.getVoices()
      const preferred =
        voices.find(v => v.lang === 'en-GB' && v.localService) ||
        voices.find(v => v.lang === 'en-GB') ||
        voices.find(v => v.lang.startsWith('en'))
      if (preferred) utterance.voice = preferred
      utterance.onend = () => { setVoiceState('idle'); onEnd?.() }
      window.speechSynthesis.speak(utterance)
    }
  }, [])

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setVoiceState('idle')
  }, [])

  // ── Recording helpers ────────────────────────────────────────────────────────

  const cleanupRecording = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    analyserRef.current = null
    hasSpeechRef.current = false
  }, [])

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
    }
    setVoiceState('processing')
  }, [])

  // ── STT via Deepgram (replaces Web Speech API) ───────────────────────────────

  const startListening = useCallback((onDone: (transcript: string) => void) => {
    if (!supported) return
    onDoneRef.current = onDone
    setTranscript('')
    setInterimTranscript('')
    hasSpeechRef.current = false
    chunksRef.current = []

    void (async () => {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        setVoiceState('idle')
        return
      }
      mediaStreamRef.current = stream

      // Silence detection via AnalyserNode
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyserRef.current = analyser
      analyser.fftSize = 256
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      // Pick best supported MIME type
      const mimeType =
        ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(m =>
          MediaRecorder.isTypeSupported(m)
        ) ?? ''
      mimeTypeRef.current = mimeType

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const chunks = [...chunksRef.current]
        chunksRef.current = []
        cleanupRecording()

        const blob = new Blob(chunks, { type: mimeTypeRef.current || 'audio/webm' })
        if (blob.size < 1000) {
          setVoiceState('idle')
          return
        }

        try {
          const form = new FormData()
          form.append('audio', blob, 'recording.webm')
          const res = await fetch('/api/public/deepgram-transcribe', { method: 'POST', body: form })
          if (!res.ok) throw new Error(`status ${res.status}`)
          const data = await res.json() as { text?: string }
          const text = data.text?.trim() ?? ''
          if (text) {
            setTranscript(text)
            onDoneRef.current?.(text)
          }
        } catch {
          // silent fail — user can try again
        } finally {
          setVoiceState('idle')
        }
      }

      recorder.start(100)
      setVoiceState('listening')

      // Silence detection constants
      const SPEECH_THRESHOLD = 8  // RMS above this = speech (0–128 scale)
      const SILENCE_AFTER_SPEECH_MS = 1500
      const MIN_RECORDING_MS = 800
      const recordingStart = Date.now()

      const checkSilence = () => {
        if (!analyserRef.current || recorder.state !== 'recording') return
        analyser.getByteTimeDomainData(dataArray)

        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] - 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / dataArray.length)

        if (rms > SPEECH_THRESHOLD) {
          hasSpeechRef.current = true
          if (silenceTimerRef.current !== null) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }
        } else if (hasSpeechRef.current && silenceTimerRef.current === null) {
          const elapsed = Date.now() - recordingStart
          if (elapsed > MIN_RECORDING_MS) {
            silenceTimerRef.current = setTimeout(() => {
              if (recorder.state === 'recording') recorder.stop()
            }, SILENCE_AFTER_SPEECH_MS)
          }
        }

        animFrameRef.current = requestAnimationFrame(checkSilence)
      }

      animFrameRef.current = requestAnimationFrame(checkSilence)
    })()
  }, [supported, cleanupRecording])

  return {
    state,
    transcript,
    interimTranscript,
    supported,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    setVoiceState,
  }
}
