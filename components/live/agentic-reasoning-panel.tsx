'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Brain } from 'lucide-react';

/**
 * Agentic Reasoning Panel — Live conversation box showing
 * the DREAM agent's internal reasoning in real-time.
 *
 * The facilitator can watch the agent think — see its deliberation,
 * classification decisions, belief updates, and contradiction detection.
 */

export type ReasoningEntry = {
  timestampMs: number;
  level: 'fragment' | 'utterance' | 'belief' | 'contradiction' | 'stabilisation';
  icon: string;
  summary: string;
  details?: string;
};

type AgenticReasoningPanelProps = {
  entries: ReasoningEntry[];
  isCapturing: boolean;
};

export function AgenticReasoningPanel({ entries, isCapturing }: AgenticReasoningPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, collapsed]);

  const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const levelColour = (level: ReasoningEntry['level']): string => {
    switch (level) {
      case 'stabilisation': return 'text-red-400';
      case 'contradiction': return 'text-yellow-400';
      case 'belief': return 'text-blue-400';
      case 'utterance': return 'text-green-400';
      case 'fragment': return 'text-gray-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-200">DREAM Agent Reasoning</span>
          {isCapturing && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-400">Live</span>
            </span>
          )}
          <span className="text-xs text-gray-500">
            {entries.length} entries
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {!collapsed && (
        <div
          ref={scrollRef}
          className="max-h-40 overflow-y-auto p-2 space-y-1 font-mono text-xs"
        >
          {entries.length === 0 && (
            <div className="text-gray-500 text-center py-4">
              {isCapturing
                ? 'Waiting for speech...'
                : 'Start capture to see agent reasoning'}
            </div>
          )}

          {entries.map((entry, i) => (
            <div
              key={i}
              className="flex gap-2 hover:bg-gray-800/50 rounded px-1 py-0.5 cursor-pointer"
              onClick={() => setExpandedEntry(expandedEntry === i ? null : i)}
            >
              <span className="text-gray-600 shrink-0 w-16">{formatTime(entry.timestampMs)}</span>
              <span className="shrink-0">{entry.icon}</span>
              <div className="min-w-0">
                <span className={levelColour(entry.level)}>
                  {entry.summary}
                </span>
                {expandedEntry === i && entry.details && (
                  <div className="text-gray-500 mt-0.5 pl-2 border-l border-gray-700">
                    {entry.details}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
