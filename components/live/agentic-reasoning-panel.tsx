'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Brain, Eye, EyeOff } from 'lucide-react';

/**
 * Agentic Reasoning Panel — Live facilitator-facing insight stream.
 *
 * Default (curated) mode shows only meaningful observations:
 * new themes, reinforcements, contradictions, stabilisations, and commit decisions.
 *
 * Verbose mode shows everything including internal tool queries (for debugging).
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

/** Returns true if this entry should be shown in curated (non-verbose) mode. */
function isCuratedEntry(entry: ReasoningEntry): boolean {
  // Always hide fragments
  if (entry.level === 'fragment') return false;
  // Hide empty summaries
  if (!entry.summary || entry.summary.trim().length === 0) return false;
  // Hide internal tool query noise that may have slipped through
  const s = entry.summary;
  if (s.startsWith('Queried beliefs')) return false;
  if (s.startsWith('Searched entities')) return false;
  if (s.startsWith('Momentum:')) return false;
  if (s.includes('not found')) return false;
  // Show everything else (beliefs, contradictions, stabilisations, commits, meaningful tool results)
  return true;
}

export function AgenticReasoningPanel({ entries, isCapturing }: AgenticReasoningPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [verbose, setVerbose] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayEntries = verbose ? entries : entries.filter(isCuratedEntry);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayEntries.length, collapsed]);

  const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const levelColour = (level: ReasoningEntry['level']): string => {
    switch (level) {
      case 'stabilisation': return 'text-red-300 font-semibold';
      case 'contradiction': return 'text-amber-300 font-medium';
      case 'belief': return 'text-blue-300 font-medium';
      case 'utterance': return 'text-gray-300';
      case 'fragment': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const levelBorder = (level: ReasoningEntry['level']): string => {
    switch (level) {
      case 'stabilisation': return 'border-l-2 border-red-500 pl-2';
      case 'contradiction': return 'border-l-2 border-amber-500 pl-2';
      case 'belief': return 'border-l-2 border-blue-500 pl-2';
      default: return '';
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
            {verbose ? `${entries.length} entries` : `${displayEntries.length} insights`}
          </span>
          {/* Verbose toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setVerbose(!verbose); }}
            className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors ${
              verbose ? 'bg-purple-600/40 text-purple-300' : 'bg-gray-700 text-gray-400 hover:text-gray-300'
            }`}
            title={verbose ? 'Showing all entries (debug)' : 'Showing curated insights'}
          >
            {verbose ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {verbose ? 'All' : 'Curated'}
          </button>
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
          {displayEntries.length === 0 && (
            <div className="text-gray-500 text-center py-4">
              {isCapturing
                ? 'Waiting for speech...'
                : 'Start capture to see agent reasoning'}
            </div>
          )}

          {displayEntries.map((entry, i) => (
            <div
              key={i}
              className={`flex gap-2 hover:bg-gray-800/50 rounded px-1 py-0.5 cursor-pointer ${levelBorder(entry.level)}`}
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
