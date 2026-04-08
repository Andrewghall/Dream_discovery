'use client';

import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  'What are my top 3 constraints?',
  'Which initiatives have the strongest evidence?',
  'What should we prioritise in the first 90 days?',
  'Where are the biggest gaps between our current state and targets?',
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export function AskDreamChat({ orgName }: { orgName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setLoading(true);

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const res = await fetch('/api/executive/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: err.error ?? 'Something went wrong.', streaming: false };
          return updated;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snapshot = accumulated;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: snapshot, streaming: true };
          return updated;
        });
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: accumulated, streaming: false };
        return updated;
      });
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Unable to reach the server. Please try again.', streaming: false };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)', minHeight: 400 }}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-4">
        {messages.length === 0 && (
          <div className="pt-8">
            <div className="text-center mb-10">
              <div className="w-12 h-12 rounded-2xl bg-[#5cf28e]/10 border border-[#5cf28e]/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[#5cf28e]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <h2 className="text-xl font-black text-white mb-2">Ask DREAM</h2>
              <p className="text-white/35 text-sm max-w-sm mx-auto leading-relaxed">
                Interrogate your {orgName} discovery data. Ask anything about your findings, constraints, or recommended path forward.
              </p>
            </div>

            {/* Suggested prompts */}
            <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="text-left px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-[#5cf28e]/30 hover:bg-[#5cf28e]/[0.04] transition-all text-sm text-white/50 hover:text-white/80"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-2xl rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#5cf28e]/15 text-white/90 border border-[#5cf28e]/20'
                  : 'bg-[#111111] border border-[#1e1e1e] text-white/75'
              }`}
            >
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-1 h-4 bg-[#5cf28e] ml-1 animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-white/[0.06] pt-4">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask about your discovery findings…"
            rows={2}
            className="w-full bg-[#111111] border border-white/10 rounded-2xl px-5 py-4 text-white/80 text-sm placeholder-white/20 resize-none focus:outline-none focus:border-[#5cf28e]/40 transition-colors pr-16 disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="absolute right-3 bottom-3 w-9 h-9 rounded-xl bg-[#5cf28e] flex items-center justify-center transition-all hover:bg-[#50d47e] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 text-[#0a0a0a]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-white/15 mt-2 text-right">⌘↵ to send</p>
      </div>
    </div>
  );
}
