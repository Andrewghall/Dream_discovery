'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, ChevronDown, ChevronUp, Loader2, MessageSquare } from 'lucide-react';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';

interface InquiryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GptInquiryBarProps {
  workshopId: string;
  /** Whether analysis data exists (bar is disabled without it) */
  hasAnalysis: boolean;
  /** Pass analysis data so the API can use it as fallback (e.g. for demo workshops) */
  analysis?: DiscoverAnalysis | null;
}

/**
 * GPT Inquiry Bar — Fixed bottom bar for facilitator questions
 *
 * Streams AI responses grounded in the Discover Analysis data.
 */
export function GptInquiryBar({ workshopId, hasAnalysis, analysis }: GptInquiryBarProps) {
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  const handleSubmit = useCallback(async () => {
    const question = input.trim();
    if (!question || isStreaming || !hasAnalysis) return;

    setInput('');
    setIsExpanded(true);

    // Add user message
    const userMsg: InquiryMessage = { role: 'user', content: question };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // Start streaming
    setIsStreaming(true);
    let assistantContent = '';

    try {
      const response = await fetch(
        `/api/admin/workshops/${workshopId}/discover-analysis/inquiry`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            history: newMessages.slice(-10),
            ...(analysis ? { analysis } : {}),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
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
      setMessages((prev) => [
        ...prev.slice(0, -1).length === prev.length ? prev : prev.slice(0, -1),
        { role: 'assistant', content: `*Error: ${errorMsg}*` },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, hasAnalysis, messages, workshopId]);

  return (
    <div className="w-full mb-6">
      <div>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          {/* Expanded message thread */}
          {isExpanded && messages.length > 0 && (
            <div className="border-b border-slate-100">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs text-slate-400 font-medium">
                  Analysis Inquiry
                </span>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto px-4 pb-3 space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-blue-50 text-slate-700'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content || '...'}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-center gap-3 px-4 py-3">
            {messages.length > 0 && !isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600 p-1"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            )}

            <MessageSquare className="h-4 w-4 text-slate-300 flex-shrink-0" />

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
              placeholder={
                hasAnalysis
                  ? 'Ask about the analysis... e.g. "What are the biggest tensions?"'
                  : 'Generate analysis first to enable inquiry'
              }
              disabled={!hasAnalysis || isStreaming}
              className="flex-1 text-sm text-slate-700 placeholder:text-slate-300 bg-transparent border-0 outline-none disabled:opacity-50"
            />

            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isStreaming || !hasAnalysis}
              className="flex-shrink-0 p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
