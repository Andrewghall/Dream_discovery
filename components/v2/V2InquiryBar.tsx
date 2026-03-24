'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, ChevronDown, ChevronUp, Loader2, Sparkles, PlusCircle } from 'lucide-react';

interface InquiryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface V2ReportBlock {
  id: string;
  type: 'gpt_generated';
  title: string;
  content: string;
  commentary: string;
  includeInReport: boolean;
  sectionContext: string;
}

interface V2InquiryBarProps {
  workshopId: string;
  sectionContext: string;
  sectionLabel: string;
  onAddToReport?: (block: V2ReportBlock) => void;
}

/**
 * V2InquiryBar — per-tab GPT inquiry bar.
 * Pre-seeded with the section's V2 data so responses are contextually scoped.
 * Has an "Add to report" button on each assistant response.
 */
export function V2InquiryBar({ workshopId, sectionContext, sectionLabel, onAddToReport }: V2InquiryBarProps) {
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [lastAssistantContent, setLastAssistantContent] = useState('');
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
    setLastAssistantContent('');

    requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const userMsg: InquiryMessage = { role: 'user', content: question };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    setIsStreaming(true);
    let assistantContent = '';

    try {
      const response = await fetch(
        `/api/admin/workshops/${workshopId}/scratchpad/inquiry`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            history: newMessages.slice(-10),
            // Inject section context so the AI answers within this section's scope
            additionalContext: sectionContext,
          }),
        },
      );

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              assistantContent += data.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
            if (data.done) break;
          } catch {
            // skip malformed SSE
          }
        }
      }

      setLastAssistantContent(assistantContent);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to get response';
      setMessages((prev) => [...prev, { role: 'assistant', content: `*Error: ${msg}*` }]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, workshopId, sectionContext]);

  const handleAddToReport = useCallback(() => {
    if (!lastAssistantContent || !onAddToReport) return;
    onAddToReport({
      id: `gpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'gpt_generated',
      title: `${sectionLabel} — AI Analysis`,
      content: lastAssistantContent,
      commentary: '',
      includeInReport: true,
      sectionContext: sectionLabel,
    });
  }, [lastAssistantContent, onAddToReport, sectionLabel]);

  return (
    <div ref={containerRef} className="w-full mt-6 scroll-mt-4">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl shadow-sm">
        {/* Header label */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-indigo-700">{sectionLabel} Inquiry</span>
        </div>

        {/* Expanded message thread */}
        {isExpanded && messages.length > 0 && (
          <div className="border-t border-indigo-200 mt-1">
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-xs text-indigo-400">Conversation</span>
              <button onClick={() => setIsExpanded(false)} className="text-indigo-300 hover:text-indigo-500 p-1">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div ref={scrollAreaRef} className="max-h-72 overflow-y-auto px-4 pb-3 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user' ? 'bg-indigo-100 text-indigo-900' : 'bg-white border border-indigo-100 text-slate-700'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content || '...'}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Add to report button — appears after last assistant message */}
            {lastAssistantContent && !isStreaming && onAddToReport && (
              <div className="px-4 pb-3 flex justify-end">
                <button
                  onClick={handleAddToReport}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md transition-all"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add to report
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          {messages.length > 0 && !isExpanded && (
            <button onClick={() => setIsExpanded(true)} className="flex-shrink-0 text-indigo-400 hover:text-indigo-600 p-1">
              <ChevronUp className="h-4 w-4" />
            </button>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder={`Ask about ${sectionLabel.toLowerCase()}...`}
            disabled={isStreaming}
            className="flex-1 text-sm text-slate-700 placeholder:text-indigo-300 bg-transparent border-0 outline-none disabled:opacity-50"
          />

          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className="flex-shrink-0 p-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
