'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

export type AgentConversationEntry = {
  timestampMs: number;
  agent: string;
  to: string;
  message: string;
  type: 'handoff' | 'request' | 'proposal' | 'verification' | 'verdict' | 'acknowledgement' | 'info' | 'challenge';
  metadata?: {
    beliefsCited?: number;
    toolsUsed?: string[];
    verdict?: 'approve' | 'reject' | 'modify';
    reasoning?: string;
    searchMode?: 'tavily_web_search' | 'parametric_fallback';
    sourceCount?: number;
  };
};

type AgentOrchestrationPanelProps = {
  entries: AgentConversationEntry[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  isLive?: boolean;
  title?: string;
};

// ══════════════════════════════════════════════════════════
// AGENT STYLES — colours + icons for each agent type
// ══════════════════════════════════════════════════════════

const AGENT_STYLES: Record<string, { color: string; bg: string; darkBg: string; icon: string; label: string }> = {
  // Pre-workshop agents
  'prep-orchestrator':            { color: '#475569', bg: '#f1f5f9', darkBg: '#1e293b', icon: '📋', label: 'Prep Orchestrator' },
  'research-agent':               { color: '#0891b2', bg: '#ecfeff', darkBg: '#164e63', icon: '🔍', label: 'Research Agent' },
  'question-set-agent':           { color: '#4f46e5', bg: '#eef2ff', darkBg: '#312e81', icon: '❓', label: 'Question Set Agent' },
  'discovery-intelligence-agent': { color: '#d97706', bg: '#fffbeb', darkBg: '#78350f', icon: '📊', label: 'Discovery Intelligence' },
  // Live workshop agents
  'orchestrator':                 { color: '#6b7280', bg: '#f3f4f6', darkBg: '#374151', icon: '🎯', label: 'Orchestrator' },
  'theme-agent':                  { color: '#7c3aed', bg: '#f5f3ff', darkBg: '#4c1d95', icon: '🎨', label: 'Theme Agent' },
  'facilitation-agent':           { color: '#2563eb', bg: '#eff6ff', darkBg: '#1e3a5f', icon: '💬', label: 'Facilitation Agent' },
  'constraint-agent':             { color: '#ea580c', bg: '#fff7ed', darkBg: '#7c2d12', icon: '⚠️', label: 'Constraint Agent' },
  'guardian':                     { color: '#059669', bg: '#ecfdf5', darkBg: '#064e3b', icon: '🛡️', label: 'Guardian' },
  // Review panel agents (deliberation)
  'discovery-agent':              { color: '#d97706', bg: '#fffbeb', darkBg: '#78350f', icon: '🔬', label: 'Discovery Agent' },
  // Journey completion agent
  'journey-completion-agent':     { color: '#0d9488', bg: '#f0fdfa', darkBg: '#134e4a', icon: '🗺️', label: 'Journey Agent' },
};

function getAgentStyle(agent: string) {
  return AGENT_STYLES[agent] ?? { color: '#6b7280', bg: '#f3f4f6', darkBg: '#374151', icon: '🤖', label: agent };
}

function formatAgentName(agent: string): string {
  const style = AGENT_STYLES[agent];
  if (style) return style.label;
  return agent
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ══════════════════════════════════════════════════════════
// CURATED FILTER
// ══════════════════════════════════════════════════════════

/** Curated mode hides internal tool queries, shows only agent-to-agent messages */
function isCuratedEntry(entry: AgentConversationEntry): boolean {
  // Always show handoffs, proposals, verdicts, acknowledgements, and challenges
  if (['handoff', 'proposal', 'verdict', 'acknowledgement', 'challenge'].includes(entry.type)) return true;
  // Show verification only if it contains a verdict
  if (entry.type === 'verification' && entry.metadata?.verdict) return true;
  // Show info messages that are substantive
  if (entry.type === 'info' && entry.message.length > 20) return true;
  // Hide internal tool requests
  if (entry.type === 'request' && entry.message.length < 50) return false;
  return true;
}

// ══════════════════════════════════════════════════════════
// VERDICT BADGE
// ══════════════════════════════════════════════════════════

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles = {
    approve: 'bg-green-900/40 text-green-400 border-green-700',
    reject:  'bg-red-900/40 text-red-400 border-red-700',
    modify:  'bg-amber-900/40 text-amber-400 border-amber-700',
  };
  const s = styles[verdict as keyof typeof styles] || 'bg-gray-800 text-gray-400 border-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${s}`}>
      {verdict === 'approve' ? '✓' : verdict === 'reject' ? '✗' : '~'} {verdict.toUpperCase()}
    </span>
  );
}

// ══════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════

export function AgentOrchestrationPanel({
  entries,
  collapsed,
  onToggleCollapse,
  isLive = false,
  title = 'AGENT ORCHESTRATION',
}: AgentOrchestrationPanelProps) {
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
    return new Date(ms).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-900 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-400 tracking-wider">{title}</span>
          {isLive && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-400">Live</span>
            </span>
          )}
          <span className="text-xs text-gray-500">
            {verbose ? `${entries.length} total` : `${displayEntries.length} message${displayEntries.length !== 1 ? 's' : ''}`}
          </span>
          {/* Curated/All toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setVerbose(!verbose); }}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              verbose
                ? 'bg-purple-600/30 text-purple-300 border border-purple-700'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300 border border-gray-700'
            }`}
            title={verbose ? 'Showing all entries (debug)' : 'Showing curated conversation'}
          >
            {verbose ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {verbose ? 'All' : 'Curated'}
          </button>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Collapsed summary bar */}
      {collapsed && displayEntries.length > 0 && (
        <div className="px-5 pb-2 flex items-center gap-2 text-xs text-gray-500 truncate">
          <span>{getAgentStyle(displayEntries[displayEntries.length - 1].agent).icon}</span>
          <span className="truncate">{displayEntries[displayEntries.length - 1].message.slice(0, 200)}</span>
        </div>
      )}

      {/* Conversation thread */}
      {!collapsed && (
        <div
          ref={scrollRef}
          className="max-h-[80vh] overflow-y-auto px-5 pb-5 space-y-4"
        >
          {displayEntries.length === 0 ? (
            <p className="text-xs text-gray-600 py-12 text-center">
              Agent conversations will appear here as the system processes information...
            </p>
          ) : (
            displayEntries.map((entry, i) => {
              const style = getAgentStyle(entry.agent);
              const isExpanded = expandedEntry === i;

              return (
                <div
                  key={i}
                  className="flex gap-3 group cursor-pointer"
                  onClick={() => setExpandedEntry(isExpanded ? null : i)}
                >
                  {/* Agent avatar */}
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm"
                    style={{ backgroundColor: style.darkBg }}
                  >
                    {style.icon}
                  </div>

                  {/* Message content */}
                  <div className={`flex-1 min-w-0 ${entry.type === 'challenge' ? 'border-l-2 border-amber-500 pl-2' : ''}`}>
                    {/* Agent name + arrow + target + timestamp */}
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: style.color }}>
                        {formatAgentName(entry.agent)}
                      </span>
                      {entry.to && (
                        <>
                          <span className="text-xs text-gray-600">→</span>
                          <span className="text-xs text-gray-400">
                            {formatAgentName(entry.to)}
                          </span>
                        </>
                      )}
                      {/* Challenge badge */}
                      {entry.type === 'challenge' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border bg-amber-900/40 text-amber-400 border-amber-700">
                          ⚡ CHALLENGE
                        </span>
                      )}
                      {/* Verdict badge */}
                      {entry.metadata?.verdict && (
                        <VerdictBadge verdict={entry.metadata.verdict} />
                      )}
                      <span className="text-[10px] text-gray-600 ml-auto shrink-0">
                        {formatTime(entry.timestampMs)}
                      </span>
                    </div>

                    {/* Message text — with basic markdown rendering */}
                    <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                      {entry.message.split('\n').map((line, li) => {
                        // Bold: **text**
                        const parts = line.split(/\*\*(.+?)\*\*/g);
                        const rendered = parts.map((part, pi) =>
                          pi % 2 === 1 ? (
                            <strong key={pi} className="text-gray-100 font-semibold">{part}</strong>
                          ) : (
                            <span key={pi}>{part}</span>
                          )
                        );
                        return (
                          <span key={li}>
                            {li > 0 && '\n'}
                            {rendered}
                          </span>
                        );
                      })}
                    </div>

                    {/* Expandable metadata */}
                    {isExpanded && entry.metadata && (
                      <div className="mt-2 p-2 rounded bg-gray-900 border border-gray-800 text-[10px] text-gray-500 space-y-1">
                        {entry.metadata.beliefsCited !== undefined && (
                          <div>Beliefs cited: <span className="text-gray-400">{entry.metadata.beliefsCited}</span></div>
                        )}
                        {entry.metadata.toolsUsed && entry.metadata.toolsUsed.length > 0 && (
                          <div>Tools used: <span className="text-gray-400">{entry.metadata.toolsUsed.join(', ')}</span></div>
                        )}
                        {entry.metadata.reasoning && (
                          <div>Reasoning: <span className="text-gray-400">{entry.metadata.reasoning}</span></div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
