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

            <a
              href="https://wa.me/447471944765?text=Hi%20Andrew%2C%20I%20have%20a%20question%20about%20DREAM%20Discovery"
              target="_blank"
              rel="noopener noreferrer"
              title="Chat with Andrew on WhatsApp"
              className="flex-shrink-0 p-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-[#25D366]">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>

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
