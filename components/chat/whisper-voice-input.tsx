'use client';

import { useEffect, useState, useRef } from 'react';
import { Circle, Square, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stopSpeaking as stopOpenAITts } from '@/lib/utils/openai-tts';

interface WhisperVoiceInputProps {
  onTranscript: (text: string) => void;
  voiceEnabled: boolean;
  onVoiceToggle: (enabled: boolean) => void;
}

export function WhisperVoiceInput({ onTranscript, voiceEnabled, onVoiceToggle }: WhisperVoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [inputLevel, setInputLevel] = useState<number>(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const recordingStartRef = useRef<number>(0);
  const lastLevelUpdateRef = useRef<number>(0);

  const TARGET_SAMPLE_RATE = 16000;

  const mergeFloat32Arrays = (chunks: Float32Array[]) => {
    const length = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Float32Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  };

  const calculateRms = (buffer: Float32Array) => {
    if (buffer.length === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = buffer[i];
      sumSquares += v * v;
    }
    return Math.sqrt(sumSquares / buffer.length);
  };

  const downsampleBuffer = (buffer: Float32Array, sourceSampleRate: number, targetSampleRate: number) => {
    if (targetSampleRate === sourceSampleRate) return buffer;
    const ratio = sourceSampleRate / targetSampleRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  };

  const encodeWav = (samples: Int16Array, sampleRate: number) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      view.setInt16(offset, samples[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  useEffect(() => {
    let cancelled = false;

    const loadDevices = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((d) => d.kind === 'audioinput');
        if (cancelled) return;
        setAudioDevices(mics);
        if (!selectedDeviceId) {
          const defaultMic = mics.find((d) => d.deviceId === 'default') || mics[0];
          setSelectedDeviceId(defaultMic?.deviceId || '');
        }
      } catch (e) {
        if (!cancelled) setAudioDevices([]);
      }
    };

    // Do not request mic permissions on mount; it triggers browser NotAllowedError
    // and blocks autoplay / user-gesture flows. Device labels may be blank until
    // the user presses Record and grants permission.
    loadDevices();

    const onDeviceChange = () => {
      loadDevices();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);

    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
    };
  }, [selectedDeviceId]);

  const startRecording = async () => {
    try {
      console.log('🎤 Starting audio recording...');

      // Critical: stop any currently playing TTS audio so we don't transcribe the AI voice.
      stopOpenAITts();

      const audioConstraint: MediaTrackConstraints = {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      };

      if (selectedDeviceId && selectedDeviceId !== 'default') {
        audioConstraint.deviceId = { exact: selectedDeviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });

      // Now that permission is granted, refresh device labels.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((d) => d.kind === 'audioinput');
        setAudioDevices(mics);
        if (!selectedDeviceId) {
          const defaultMic = mics.find((d) => d.deviceId === 'default') || mics[0];
          setSelectedDeviceId(defaultMic?.deviceId || '');
        }
      } catch {
        // ignore
      }

      const audioContext = new AudioContext();
      // On some browsers, the AudioContext starts suspended until resumed from a user gesture.
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      audioBufferRef.current = [];
      recordingStartRef.current = Date.now();

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        audioBufferRef.current.push(new Float32Array(input));

        const now = Date.now();
        if (now - lastLevelUpdateRef.current > 120) {
          lastLevelUpdateRef.current = now;
          const rmsNow = calculateRms(input);
          const normalized = Math.min(1, rmsNow / 0.12);
          setInputLevel(normalized);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      mediaStreamRef.current = stream;
      sourceRef.current = source;
      processorRef.current = processor;

      setIsRecording(true);
      setError(null);
      setInputLevel(0);
      console.log('🎤 Recording started (WAV/PCM)');
      
    } catch (err: any) {
      console.error('❌ Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone access.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Could not access microphone. Please check your settings.');
      }
      setTimeout(() => setError(null), 5000);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    const stopTime = Date.now();
    const durationSeconds = (stopTime - recordingStartRef.current) / 1000;
    setIsRecording(false);

    if (durationSeconds < 0.8) {
      setError('Recording too short. Please speak for at least 1 second.');
      setTimeout(() => setError(null), 3000);
    }

    const audioContext = audioContextRef.current;
    const processor = processorRef.current;
    const source = sourceRef.current;
    const stream = mediaStreamRef.current;

    try {
      processor?.disconnect();
      source?.disconnect();
    } catch {
      // ignore
    }

    stream?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    sourceRef.current = null;
    processorRef.current = null;

    const sourceSampleRate = audioContext?.sampleRate ?? TARGET_SAMPLE_RATE;
    audioContext?.close();
    audioContextRef.current = null;

    const merged = mergeFloat32Arrays(audioBufferRef.current);
    audioBufferRef.current = [];

    const rms = calculateRms(merged);
    console.log('🎤 RMS level:', rms);
    // If we are basically recording silence, Whisper will return nonsense (often a short token like "you").
    // Typical RMS for real speech is noticeably higher than background noise.
    if (rms < 0.008) {
      setIsProcessing(false);
      setError('No audio detected. Please speak closer to the microphone (or use headphones) and try again.');
      setTimeout(() => setError(null), 5000);
      setInputLevel(0);
      return;
    }

    const downsampled = downsampleBuffer(merged, sourceSampleRate, TARGET_SAMPLE_RATE);
    const pcm16 = floatTo16BitPCM(downsampled);
    const wavBlob = encodeWav(pcm16, TARGET_SAMPLE_RATE);

    console.log('🎤 WAV size:', wavBlob.size, 'bytes');
    console.log('🎤 Duration:', durationSeconds.toFixed(1), 'seconds');

    (async () => {
      try {
        setIsProcessing(true);
        const formData = new FormData();
        formData.append('audio', wavBlob, 'recording.wav');

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = (payload as any)?.error || 'Transcription failed';
          throw new Error(message);
        }

        const text = (payload as any)?.text;
        console.log('✅ Transcription received:', text);
        if (text) onTranscript(text);
        setError(null);
      } catch (err: any) {
        console.error('❌ Transcription error:', err);
        setError(err?.message || 'Failed to transcribe audio. Please try again.');
        setTimeout(() => setError(null), 4000);
      } finally {
        setIsProcessing(false);
        setInputLevel(0);
      }
    })();
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onVoiceToggle(!voiceEnabled)}
        title={voiceEnabled ? 'Speaker: On (click to disable)' : 'Speaker: Off (click to enable)'}
      >
        {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </Button>

      <div className="flex items-center gap-2">
        <select
          className="h-9 max-w-[180px] rounded-md border bg-background px-2 text-xs"
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          title="Microphone input device"
          disabled={isRecording || isProcessing}
        >
          {audioDevices.length === 0 ? (
            <option value="">Mic: (none)</option>
          ) : (
            audioDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone (${d.deviceId.slice(0, 6)})`}
              </option>
            ))
          )}
        </select>

        <div className="h-2 w-16 overflow-hidden rounded-full bg-muted" title="Live input level">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${Math.round(inputLevel * 100)}%` }}
          />
        </div>
      </div>
      
      <div className="relative">
        <Button
          type="button"
          variant={isRecording ? 'destructive' : 'outline'}
          size="sm"
          onClick={toggleRecording}
          disabled={isProcessing}
          title={isProcessing ? 'Transcribing...' : isRecording ? 'Stop recording' : 'Record your answer'}
          className={isRecording ? 'animate-pulse' : ''}
        >
          {isRecording ? (
            <>
              <Square className="h-4 w-4 mr-2" />
              Stop
            </>
          ) : (
            <>
              <Circle className="h-4 w-4 mr-2" />
              Record
            </>
          )}
        </Button>
        
        {isRecording && (
          <div className="absolute bottom-full mb-2 right-0 bg-red-600 text-white text-xs px-3 py-2 rounded-md whitespace-nowrap shadow-lg z-10 animate-pulse">
            🔴 Recording... Click to stop
          </div>
        )}
        
        {isProcessing && (
          <div className="absolute bottom-full mb-2 right-0 bg-blue-600 text-white text-xs px-3 py-2 rounded-md whitespace-nowrap shadow-lg z-10">
            ⏳ Transcribing...
          </div>
        )}
        
        {error && (
          <div className="absolute bottom-full mb-2 right-0 bg-destructive text-destructive-foreground text-xs px-3 py-2 rounded-md whitespace-nowrap shadow-lg z-10">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
