'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Square, FileText, ArrowLeft, Clock, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';
import { transcribeAudio, checkCaptureAPIHealth, CaptureAPIStream, type StreamTranscript } from '@/lib/captureapi/client';
import { nanoid } from 'nanoid';
import { useDiagnosticTraces } from '@/hooks/useDiagnosticTraces';
import { PipelineSniffer } from '@/components/diagnostics/pipeline-sniffer';
import type { ServerTimings } from '@/lib/diagnostics/types';

interface TranscriptEntry {
  id: string;
  speakerId: string | null;
  text: string;
  startTime: number;
  endTime: number;
  emotionalTone?: string;
}

interface CoachingPrompt {
  id: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  source: 'plan' | 'live' | 'system';
  dismissed?: boolean;
}

interface TopicDetection {
  topic: string;
  category: string;
  evidence: string;
}

interface PlanCoverageItem {
  item: string;
  category: string;
  covered: boolean;
}

const CHUNK_MS = 10_000;
const SPEAKER_COLORS: Record<string, string> = {
  speaker_0: 'text-blue-700',
  speaker_1: 'text-emerald-700',
  speaker_2: 'text-purple-700',
  speaker_3: 'text-orange-700',
};

export default function SalesLivePage() {
  const params = useParams();
  const router = useRouter();
  const workshopId = params.workshopId as string;

  // Capture state
  const [status, setStatus] = useState<'idle' | 'capturing' | 'stopped'>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Transcript
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Intelligence
  const [customerIntent, setCustomerIntent] = useState<string>('neutral');
  const [emotionalTone, setEmotionalTone] = useState<string>('neutral');
  const [toneTrend, setToneTrend] = useState<string>('stable');
  const [topics, setTopics] = useState<TopicDetection[]>([]);
  const [coachingPrompts, setCoachingPrompts] = useState<CoachingPrompt[]>([]);
  const [planCoverage, setPlanCoverage] = useState<PlanCoverageItem[]>([]);

  // Developer diagnostics
  const [isDeveloper, setIsDeveloper] = useState(false);
  const diagnostics = useDiagnosticTraces();

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.isDeveloper) setIsDeveloper(true); })
      .catch(() => null);
  }, []);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureWSRef = useRef<CaptureAPIStream | null>(null);
  const queueRef = useRef<{ blob: Blob; startTime: number; endTime: number; traceId?: string }[]>([]);
  const processingRef = useRef(false);
  const stopRef = useRef(false);
  const chunkStartRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pcmContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const latestTraceIdRef = useRef<string | null>(null);

  // Auto-scroll transcript + record render timing for diagnostics
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Record UI render timestamp for the latest trace
    if (isDeveloper && latestTraceIdRef.current) {
      diagnostics.recordTimestamp(latestTraceIdRef.current, 't_uiRendered', Date.now());
      latestTraceIdRef.current = null;
    }
  }, [transcript, isDeveloper, diagnostics]);

  // Elapsed timer
  useEffect(() => {
    if (status !== 'capturing' || !callStartTime) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - callStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [status, callStartTime]);

  // SSE connection
  useEffect(() => {
    if (status !== 'capturing') return;

    const es = new EventSource(`/api/sales/${workshopId}/events`);

    es.addEventListener('transcript.new', (e) => {
      const t_sseReceived = Date.now();
      const data = JSON.parse(e.data);
      const p = data.payload;

      // Pipeline diagnostics — merge server timings
      if (p._serverTimings) {
        const st = p._serverTimings as ServerTimings;
        diagnostics.mergeServerTimestamps(st);
        diagnostics.recordTimestamp(st.traceId, 't_sseReceived', t_sseReceived);
      }

      setTranscript((prev) => [...prev, {
        id: p.id,
        speakerId: p.speakerId,
        text: p.text,
        startTime: p.startTime,
        endTime: p.endTime,
        emotionalTone: p.emotionalTone,
      }]);
    });

    es.addEventListener('intelligence.update', (e) => {
      const data = JSON.parse(e.data);
      const intel = data.payload;
      if (intel.customerIntent) setCustomerIntent(intel.customerIntent);
      if (intel.emotionalTone) setEmotionalTone(intel.emotionalTone);
      if (intel.toneTrend) setToneTrend(intel.toneTrend);
      if (intel.topicsDetected?.length) {
        setTopics((prev) => {
          const newTopics = [...prev];
          for (const t of intel.topicsDetected) {
            if (!newTopics.find((nt) => nt.topic === t.topic && nt.category === t.category)) {
              newTopics.push(t);
            }
          }
          return newTopics.slice(-20);
        });
      }
      if (intel.coachingPrompts?.length) {
        setCoachingPrompts((prev) => [...intel.coachingPrompts.filter((p: CoachingPrompt) => !p.dismissed), ...prev].slice(0, 8));
      }
      if (intel.planCoverage?.length) {
        setPlanCoverage((prev) => {
          const merged = [...prev];
          for (const item of intel.planCoverage) {
            const idx = merged.findIndex((m) => m.item === item.item);
            if (idx >= 0) {
              merged[idx] = item;
            } else {
              merged.push(item);
            }
          }
          return merged;
        });
      }
    });

    return () => es.close();
  }, [status, workshopId]);

  // Audio level monitoring
  const startAudioMonitoring = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  // Process transcription queue
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (queueRef.current.length > 0 && !stopRef.current) {
      const item = queueRef.current.shift();
      if (!item) break;

      try {
        const tid = item.traceId;
        if (tid) diagnostics.recordTimestamp(tid, 't_captureApiSent', Date.now());

        const result = await transcribeAudio(item.blob, { mode: 'workshop', enableSLM: true });

        if (tid) {
          diagnostics.recordTimestamp(tid, 't_captureApiReceived', Date.now());
          if (result.metadata?.processingTimeMs) {
            diagnostics.setCaptureApiReportedMs(tid, result.metadata.processingTimeMs);
          }
        }

        if (result.success && result.transcription?.cleanText?.trim()) {
          const text = result.transcription.cleanText.trim();
          const speakerId = result.transcription.speaker != null ? `speaker_${result.transcription.speaker}` : null;

          if (tid) {
            diagnostics.setTextPreview(tid, text);
            diagnostics.recordTimestamp(tid, 't_serverPostSent', Date.now());
            latestTraceIdRef.current = tid;
          }

          // Post to our sales transcript endpoint
          await fetch(`/api/sales/${workshopId}/transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              speakerId,
              startTime: item.startTime,
              endTime: item.endTime,
              text,
              rawText: result.transcription.rawText,
              confidence: result.transcription.confidence,
              source: result.transcription.source,
              slmMetadata: result.analysis ? {
                entities: result.analysis.entities,
                emotionalTone: result.analysis.emotionalTone,
                slmConfidence: result.analysis.confidence,
              } : undefined,
              ...(tid ? { traceId: tid } : {}),
            }),
          });

          // Trigger AI analysis (fire and forget)
          fetch(`/api/sales/${workshopId}/analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chunkText: text,
              speakerId,
              callDurationMs: callStartTime ? Date.now() - callStartTime : 0,
            }),
          }).catch(console.error);
        }
      } catch (error) {
        console.error('Transcription error:', error);
      }
    }

    processingRef.current = false;
  }, [workshopId, callStartTime, diagnostics]);

  // Start capture
  const startCapture = async () => {
    // Connect CaptureAPI WebSocket stream
    try {
      const wsStream = new CaptureAPIStream({
        onTranscript: async (msg: StreamTranscript) => {
          console.log('[DREAM-DIAG] onTranscript fired:', { type: msg.type, rawText: msg.rawText?.substring(0, 50), cleanText: msg.cleanText?.substring(0, 50), isFinal: (msg as any).isFinal, speaker: msg.speaker });
          const text = msg.cleanText?.trim();
          if (!text) {
            console.log('[DREAM-DIAG] skipping — cleanText empty');
            return;
          }

          const speakerId = msg.speaker !== null ? `speaker_${msg.speaker}` : null;
          const now = Date.now();

          // Post to sales transcript endpoint
          console.log('[DREAM-DIAG] POSTing to /api/sales/' + workshopId + '/transcript');
          const resp = await fetch(`/api/sales/${workshopId}/transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              speakerId,
              startTime: now - 5000,
              endTime: now,
              text,
              rawText: msg.rawText,
              confidence: msg.confidence,
              source: 'deepgram',
              slmMetadata: {
                entities: msg.entities,
                emotionalTone: msg.emotionalTone,
                slmConfidence: msg.slmConfidence,
              },
            }),
          });
          console.log('[DREAM-DIAG] POST response:', resp.status, resp.statusText);

          // Fire and forget AI analysis
          fetch(`/api/sales/${workshopId}/analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chunkText: text,
              speakerId,
              callDurationMs: callStartTime ? Date.now() - callStartTime : 0,
            }),
          }).catch(console.error);
        },
        onError: (err) => {
          console.error('[CaptureAPIStream] Error:', err);
        },
      });

      await wsStream.connect();
      captureWSRef.current = wsStream;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Cannot connect to CaptureAPI — ${msg}`);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      startAudioMonitoring(stream);

      // --- Raw PCM streaming via WebSocket (16kHz mono Int16) ---
      const pcmCtx = new AudioContext({ sampleRate: 16000 });
      const pcmSource = pcmCtx.createMediaStreamSource(stream);
      const processor = pcmCtx.createScriptProcessor(4096, 1, 1);
      pcmSource.connect(processor);
      processor.connect(pcmCtx.destination);

      let pcmChunkCount = 0;
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const ws = captureWSRef.current;
        if (!ws) { if (pcmChunkCount === 0) console.warn('[DREAM-DIAG] captureWSRef is null'); return; }
        if (!ws.isReady) { if (pcmChunkCount === 0) console.warn('[DREAM-DIAG] ws.isReady=false'); return; }
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        try {
          ws.sendBuffer(pcmData.buffer);
          pcmChunkCount++;
          if (pcmChunkCount % 50 === 1) console.log('[DREAM-DIAG] PCM chunks sent:', pcmChunkCount, 'bytes:', pcmData.buffer.byteLength);
        } catch (err) {
          console.error('[CaptureAPIStream] PCM send failed:', err);
        }
        }
      };

      pcmContextRef.current = pcmCtx;

      setCallStartTime(Date.now());
      setStatus('capturing');
      stopRef.current = false;
    } catch (error) {
      console.error('Failed to start capture:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  // Stop capture
  const stopCapture = () => {
    stopRef.current = true;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
    }
    pcmContextRef.current?.close();
    pcmContextRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    captureWSRef.current?.close();
    captureWSRef.current = null;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close();
    setStatus('stopped');
    setAudioLevel(0);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return h > 0
      ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
      : `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const getIntentColor = (intent: string) => {
    switch (intent) {
      case 'ready_to_buy': return 'bg-green-500 text-white';
      case 'interested': return 'bg-green-400 text-white';
      case 'exploring': return 'bg-blue-400 text-white';
      case 'hesitant': return 'bg-yellow-400 text-black';
      case 'objecting': return 'bg-red-400 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getToneIcon = () => {
    if (toneTrend === 'improving') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (toneTrend === 'declining') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const dismissPrompt = (id: string) => {
    setCoachingPrompts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top Bar */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/sales/${workshopId}/plan`}>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Plan
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Sales Call Intelligence</h1>
          {status === 'capturing' && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-400">LIVE</span>
              <span className="text-sm text-gray-400 ml-2">
                <Clock className="h-3 w-3 inline mr-1" />
                {formatTime(elapsed)}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === 'idle' && (
            <Button onClick={startCapture} className="bg-red-600 hover:bg-red-700">
              <Mic className="h-4 w-4 mr-2" />
              Start Recording
            </Button>
          )}
          {status === 'capturing' && (
            <Button onClick={stopCapture} variant="destructive">
              <Square className="h-4 w-4 mr-2" />
              Stop Call
            </Button>
          )}
          {status === 'stopped' && (
            <Button onClick={() => router.push(`/sales/${workshopId}/report`)}>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          )}
        </div>
      </div>

      {/* Audio Level Bar */}
      {status === 'capturing' && (
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-green-500 transition-all duration-100"
            style={{ width: `${audioLevel}%` }}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex h-[calc(100vh-60px)]">
        {/* Left Panel — Transcript */}
        <div className="w-1/2 border-r border-gray-800 flex flex-col">
          <div className="px-4 py-2 border-b border-gray-800 text-sm text-gray-400 font-medium">
            Live Transcript
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {transcript.length === 0 && status === 'idle' && (
              <div className="text-center text-gray-500 mt-20">
                <Mic className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Click &quot;Start Recording&quot; to begin capturing</p>
              </div>
            )}
            {transcript.length === 0 && status === 'capturing' && (
              <div className="text-center text-gray-500 mt-20">
                <div className="w-8 h-8 border-2 border-gray-600 border-t-green-500 rounded-full animate-spin mx-auto mb-4" />
                <p>Listening... speak to begin</p>
              </div>
            )}
            {transcript.map((entry) => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex-shrink-0">
                  <Badge variant="outline" className={`text-xs ${SPEAKER_COLORS[entry.speakerId || ''] || 'text-gray-400'}`}>
                    {entry.speakerId?.replace('speaker_', 'S') || '?'}
                  </Badge>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-200 leading-relaxed">{entry.text}</p>
                  {entry.emotionalTone && entry.emotionalTone !== 'neutral' && (
                    <span className="text-xs text-gray-500 mt-1 inline-block">
                      {entry.emotionalTone}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Right Panel — Intelligence */}
        <div className="w-1/2 flex flex-col overflow-y-auto">
          <div className="px-4 py-2 border-b border-gray-800 text-sm text-gray-400 font-medium">
            Real-Time Intelligence
          </div>
          <div className="p-4 space-y-4">
            {/* Customer Intent */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm text-gray-400">Customer Intent</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <Badge className={`text-sm px-3 py-1 ${getIntentColor(customerIntent)}`}>
                  {customerIntent.replace('_', ' ').toUpperCase()}
                </Badge>
              </CardContent>
            </Card>

            {/* Emotional Tone */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                  Emotional Tone {getToneIcon()}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <span className="text-lg font-medium capitalize">{emotionalTone}</span>
                <span className="text-xs text-gray-500 ml-2">({toneTrend})</span>
              </CardContent>
            </Card>

            {/* Coaching Prompts */}
            {coachingPrompts.length > 0 && (
              <Card className="bg-gray-900 border-amber-700/50">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Coaching Prompts
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2">
                  {coachingPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className={`flex items-start gap-2 p-2 rounded text-sm ${
                        prompt.priority === 'high' ? 'bg-amber-900/30 border border-amber-700/30' :
                        prompt.priority === 'medium' ? 'bg-gray-800' : 'bg-gray-800/50'
                      }`}
                    >
                      <span className="flex-1 text-gray-200">{prompt.message}</span>
                      <button
                        onClick={() => dismissPrompt(prompt.id)}
                        className="text-gray-500 hover:text-gray-300 text-xs flex-shrink-0"
                      >
                        dismiss
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Topics Detected */}
            {topics.length > 0 && (
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm text-gray-400">Topics Detected</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="flex flex-wrap gap-2">
                    {topics.map((t, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {t.category === 'buying_signal' ? '!!! ' : ''}
                        {t.topic}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Plan Coverage */}
            {planCoverage.length > 0 && (
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm text-gray-400">Plan Coverage</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-1">
                  {planCoverage.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {item.covered ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-gray-600 flex-shrink-0" />
                      )}
                      <span className={item.covered ? 'text-gray-400 line-through' : 'text-gray-200'}>
                        {item.item}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Sniffer — developer only */}
      {isDeveloper && (
        <PipelineSniffer
          traces={diagnostics.traces}
          stats={diagnostics.stats}
          paused={diagnostics.paused}
          onTogglePause={() => diagnostics.setPaused(!diagnostics.paused)}
          onClear={diagnostics.clear}
          onExport={diagnostics.exportTraces}
        />
      )}
    </div>
  );
}
