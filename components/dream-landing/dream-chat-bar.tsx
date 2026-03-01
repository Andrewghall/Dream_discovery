'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, ChevronDown, ChevronUp, Loader2, Sparkles, X } from 'lucide-react';

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

export function DreamChatBar() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotate placeholder suggestions
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_SUGGESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    if (isExpanded && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, isExpanded]);

  const handleSubmit = useCallback(async () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    setInput('');
    setIsExpanded(true);

    // Add user message
    const userMsg: ChatMessage = { role: 'user', content: question };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // Start streaming
    setIsStreaming(true);
    let assistantContent = '';

    try {
      const response = await fetch('/api/public/dream-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history: newMessages.slice(-6),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `Request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();

      // Add empty assistant message to fill
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              assistantContent += data.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: assistantContent,
                };
                return updated;
              });
            }
            if (data.done) break;
            if (data.error) {
              assistantContent += `\n\n*Error: ${data.error}*`;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: assistantContent,
                };
                return updated;
              });
            }
          } catch {
            // Skip malformed SSE data
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to get response';
      setMessages((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].content === '') {
          return [...prev.slice(0, -1), { role: 'assistant', content: `*${errorMsg}*` }];
        }
        return [...prev, { role: 'assistant', content: `*${errorMsg}*` }];
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages]);

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div id="ask-dream" className="fixed bottom-0 left-0 right-0 z-50">
      {/* Expanded message thread */}
      {isExpanded && messages.length > 0 && (
        <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-2xl">
          <div className="max-w-4xl mx-auto">
            {/* Thread header */}
            <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#50c878]" />
                <span className="text-xs text-slate-500 font-medium">DREAM AI</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { setMessages([]); setIsExpanded(false); }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollAreaRef}
              className="max-h-96 overflow-y-auto px-6 py-4 space-y-4"
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-[#5cf28e]/10 text-slate-700 border border-[#50c878]/20'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content || '...'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-2xl">
        <div className="max-w-4xl mx-auto px-6 py-3">
          {/* Suggestion chips  -  only when no messages */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {PLACEHOLDER_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-3 py-1 text-xs text-[#33824d] bg-[#5cf28e]/10 border border-[#50c878]/30 rounded-full hover:bg-[#5cf28e]/20 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            {messages.length > 0 && !isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600 p-1"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            )}

            <Sparkles className="h-5 w-5 text-[#50c878] flex-shrink-0" />

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={PLACEHOLDER_SUGGESTIONS[placeholderIndex]}
              disabled={isStreaming}
              className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 bg-transparent border-0 outline-none disabled:opacity-50"
            />

            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isStreaming}
              className="flex-shrink-0 p-2.5 rounded-xl bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
