'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, ChevronDown, ChevronUp, Loader2, Sparkles, X, Mic } from 'lucide-react';
import { useVoice } from './assessment/use-voice';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const PLACEHOLDER_SUGGESTIONS = [
  'How does the Discovery phase work?',
  'What outputs does DREAM produce?',
  'What is EthentaFlow?',
  'Who is DREAM built for?',
];

// Sentence boundary — negative lookbehind avoids splitting on "1." "2." etc.
const SENTENCE_END_RE = /(?<!\d)[.!?](?:\s+|$)|\n\n/;

/** Remove markdown formatting so TTS and display stay clean */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')               // headers
    .replace(/\*\*([^*\r\n]+)\*\*/g, '$1')   // bold
    .replace(/\*([^*\r\n]+)\*/g, '$1')       // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '')       // inline / fenced code
    .replace(/^\s*[-*]\s+/gm, '')            // bullet points
    .replace(/^\s*\d+\.\s+/gm, '')           // numbered lists
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')      // links
    .replace(/^-{3,}$/gm, '')                // horizontal rules
    .replace(/\n{3,}/g, '\n\n')              // excess newlines
    .trim();
}

/* Animated wave bars */
function SpeakingWave({ colour = '#5cf28e', size = 'md' }: { colour?: string; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-3' : 'h-4';
  return (
    <span className={`inline-flex items-end gap-[2px] ${h}`} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            backgroundColor: colour,
            height: '100%',
            animation: `waveBar 0.85s ease-in-out ${i * 0.15}s infinite alternate`,
          }}
        />
      ))}
      <style>{`@keyframes waveBar{from{transform:scaleY(0.2);opacity:.4}to{transform:scaleY(1);opacity:1}}`}</style>
    </span>
  );
}

export function DreamChatBar() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Audio queue for sentence-chunked TTS
  type AudioChunk = { sentence: string; audio: HTMLAudioElement; url: string };
  const audioQueueRef = useRef<AudioChunk[]>([]);
  const isPlayingRef = useRef(false);
  const streamActiveRef = useRef(false); // true while GPT is still streaming
  const spokenContentRef = useRef('');  // text already fully spoken — base for word reveal

  const voice = useVoice();
  const isListening = voice.state === 'listening';
  const isVoiceProcessing = voice.state === 'processing' || voice.state === 'reflecting';

  useEffect(() => {
    const interval = setInterval(() => setPlaceholderIndex(p => (p + 1) % PLACEHOLDER_SUGGESTIONS.length), 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isExpanded && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, isExpanded]);

  /* ── Audio queue player — word-by-word reveal ──────────── */
  const playNextChunk = useCallback(() => {
    const chunk = audioQueueRef.current.shift();
    if (!chunk) {
      if (!streamActiveRef.current) setIsSpeaking(false);
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    const words = chunk.sentence.split(/\s+/).filter(Boolean);
    let wordIndex = 0;
    let wordInterval: ReturnType<typeof setInterval> | null = null;

    const startWordReveal = () => {
      if (words.length === 0 || !chunk.audio.duration) return;
      const msPerWord = Math.max(40, (chunk.audio.duration * 1000) / words.length);
      wordInterval = setInterval(() => {
        wordIndex = Math.min(wordIndex + 1, words.length);
        const base = spokenContentRef.current;
        const visible = base + (base ? ' ' : '') + words.slice(0, wordIndex).join(' ');
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { role: 'assistant', content: visible };
          }
          return updated;
        });
        if (wordIndex >= words.length && wordInterval) {
          clearInterval(wordInterval);
          wordInterval = null;
        }
      }, msPerWord);
    };

    chunk.audio.addEventListener('canplay', startWordReveal, { once: true });

    chunk.audio.play().catch(() => {});
    chunk.audio.onended = () => {
      if (wordInterval) { clearInterval(wordInterval); wordInterval = null; }
      URL.revokeObjectURL(chunk.url);
      // Commit the full sentence as the new stable base
      const base = spokenContentRef.current;
      spokenContentRef.current = base + (base ? ' ' : '') + chunk.sentence;
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { role: 'assistant', content: spokenContentRef.current };
        }
        return updated;
      });
      playNextChunk();
    };
  }, []);

  /* Fetch TTS for one sentence and add to queue */
  const enqueueSentence = useCallback(async (sentence: string) => {
    const trimmed = stripMarkdown(sentence.trim());
    if (!trimmed) return;
    try {
      const res = await fetch('/api/public/assessment/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      // Store the clean (stripped) sentence so display matches what was spoken
      audioQueueRef.current.push({ sentence: trimmed, audio, url });
      if (!isPlayingRef.current) playNextChunk();
    } catch { /* non-blocking */ }
  }, [playNextChunk]);

  const stopAllAudio = useCallback(() => {
    // Drain queue and stop any playing audio
    audioQueueRef.current.forEach(c => { try { c.audio.pause(); URL.revokeObjectURL(c.url); } catch { /* ignore */ } });
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
    voice.stopSpeaking();
  }, [voice]);

  /* ── Core message submit ────────────────────────────────── */
  const submitMessage = useCallback(async (question: string, withVoice: boolean) => {
    if (!question || isStreaming) return;

    stopAllAudio();
    spokenContentRef.current = ''; // reset spoken base for the new response
    setIsExpanded(true);

    const userMsg: ChatMessage = { role: 'user', content: question };
    const history = [...messages, userMsg];
    setMessages(history);
    setIsStreaming(true);
    streamActiveRef.current = true;

    let sentenceBuffer = '';
    let fullContent = '';

    try {
      const response = await fetch('/api/public/dream-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: history.slice(-6), voice: withVoice }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `Request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');
      const decoder = new TextDecoder();

      // For voice mode: start with empty message — text revealed as audio plays
      // For text mode: stream content directly into message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);

            if (data.content) {
              fullContent += data.content;

              if (withVoice) {
                // Accumulate into sentence buffer; dispatch complete sentences to TTS
                sentenceBuffer += data.content;
                let match: RegExpExecArray | null;
                // Reset lastIndex so exec scans from start each iteration
                SENTENCE_END_RE.lastIndex = 0;
                while ((match = SENTENCE_END_RE.exec(sentenceBuffer)) !== null) {
                  const end = match.index + match[0].length;
                  const sentence = sentenceBuffer.slice(0, end);
                  sentenceBuffer = sentenceBuffer.slice(end);
                  SENTENCE_END_RE.lastIndex = 0;
                  enqueueSentence(sentence); // fire-and-forget — queued async
                }
                // Text is NOT streamed to screen — voice reveals it word-by-word
              } else {
                // Text mode: stream directly to screen as before
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: fullContent };
                  return updated;
                });
              }
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'undefined') throw e;
          }
        }
      }

      // Flush any remaining buffer (last sentence may not end with punctuation)
      if (withVoice && sentenceBuffer.trim()) {
        enqueueSentence(sentenceBuffer);
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to get response';
      setMessages(prev => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.role === 'assistant' && !updated[updated.length - 1].content) {
          updated[updated.length - 1] = { role: 'assistant', content: `*${msg}*` };
        } else {
          updated.push({ role: 'assistant', content: `*${msg}*` });
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      streamActiveRef.current = false;
      // If queue already drained while streaming, ensure speaking flag cleared
      if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
        setIsSpeaking(false);
      }
    }
  }, [isStreaming, messages, stopAllAudio, enqueueSentence]);

  /* Text submit */
  const handleSubmit = useCallback(() => {
    const q = input.trim();
    if (!q) return;
    setInput('');
    submitMessage(q, false);
  }, [input, submitMessage]);

  /* Mic button */
  const handleMicClick = useCallback(() => {
    if (isSpeaking) { stopAllAudio(); return; }
    if (isListening) { voice.stopListening(); return; }
    stopAllAudio();
    voice.startListening((transcript) => {
      if (transcript.trim()) submitMessage(transcript.trim(), true);
    });
  }, [isSpeaking, isListening, voice, stopAllAudio, submitMessage]);

  const handleSuggestionClick = (s: string) => {
    setInput(s);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const micColour = isSpeaking ? '#5cf28e' : isListening ? '#ef4444' : '#64748b';
  const micBg = isSpeaking ? 'bg-[#5cf28e]/15' : isListening ? 'bg-red-500/15' : 'bg-slate-100 hover:bg-slate-200';

  return (
    <div id="ask-dream" className="fixed bottom-0 left-0 right-0 z-50">
      {/* Expanded thread */}
      {isExpanded && messages.length > 0 && (
        <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-2xl">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {isSpeaking ? <SpeakingWave size="sm" /> : <Sparkles className="h-4 w-4 text-[#50c878]" />}
                <span className="text-xs text-slate-500 font-medium">
                  {isSpeaking ? 'Speaking…' : isStreaming ? 'Thinking…' : 'DREAM AI'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {isSpeaking && (
                  <button onClick={stopAllAudio} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded">
                    Stop
                  </button>
                )}
                {/* Collapse — hides panel, keeps conversation */}
                <button onClick={() => setIsExpanded(false)} title="Minimise" className="text-slate-400 hover:text-slate-600 p-1 rounded">
                  <ChevronDown className="h-4 w-4" />
                </button>
                {/* Close — ends conversation and returns to page */}
                <button
                  onClick={() => { stopAllAudio(); setMessages([]); setIsExpanded(false); }}
                  title="Close conversation"
                  className="text-slate-400 hover:text-red-400 p-1 rounded transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={scrollAreaRef} className="max-h-96 overflow-y-auto px-6 py-4 space-y-4">
              {messages.map((msg, i) => {
                const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1;
                return (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-[#5cf28e]/10 text-slate-700 border border-[#50c878]/20'
                      }`}
                    >
                      {isLastAssistant && isSpeaking && !msg.content ? (
                        /* Voice mode: waiting for first sentence — show wave only */
                        <SpeakingWave />
                      ) : (
                        <div className="whitespace-pre-wrap">
                          {msg.content || (isLastAssistant && isStreaming ? '…' : '')}
                          {/* Cursor while voice is speaking more sentences */}
                          {isLastAssistant && isSpeaking && msg.content && (
                            <span className="inline-block w-1 h-4 bg-[#5cf28e] ml-0.5 align-middle animate-pulse" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-2xl">
        <div className="max-w-4xl mx-auto px-6 py-3">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {PLACEHOLDER_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestionClick(s)}
                  className="px-3 py-1 text-xs text-[#33824d] bg-[#5cf28e]/10 border border-[#50c878]/30 rounded-full hover:bg-[#5cf28e]/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            {messages.length > 0 && !isExpanded && (
              <button onClick={() => setIsExpanded(true)} className="flex-shrink-0 text-slate-400 hover:text-slate-600 p-1">
                <ChevronUp className="h-4 w-4" />
              </button>
            )}

            <Sparkles className="h-5 w-5 text-[#50c878] flex-shrink-0" />

            {isListening ? (
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm text-slate-400 italic animate-pulse">
                  {voice.interimTranscript || 'Listening…'}
                </span>
                <SpeakingWave colour="#ef4444" size="sm" />
              </div>
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                placeholder={PLACEHOLDER_SUGGESTIONS[placeholderIndex]}
                disabled={isStreaming || isVoiceProcessing}
                className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 bg-transparent border-0 outline-none disabled:opacity-50"
              />
            )}

            {/* Mic — always visible; tap while speaking to stop */}
            {voice.supported && (
              <button
                onClick={handleMicClick}
                disabled={isStreaming || isVoiceProcessing}
                title={isSpeaking ? 'Stop' : isListening ? 'Stop listening' : 'Ask by voice'}
                className={`flex-shrink-0 p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${micBg}`}
                style={isListening ? { boxShadow: '0 0 0 4px rgba(239,68,68,0.15)' } : undefined}
              >
                {isSpeaking ? (
                  <SpeakingWave colour={micColour} size="sm" />
                ) : isVoiceProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : (
                  <Mic className="h-4 w-4" style={{ color: micColour }} />
                )}
              </button>
            )}

            {/* Send — only when text is typed */}
            {input.trim() && (
              <button
                onClick={handleSubmit}
                disabled={isStreaming}
                className="flex-shrink-0 p-2.5 rounded-xl bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] disabled:opacity-30 transition-all shadow-sm"
              >
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
