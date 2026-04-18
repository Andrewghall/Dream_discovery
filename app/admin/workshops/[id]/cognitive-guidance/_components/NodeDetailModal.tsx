'use client';

import { X } from 'lucide-react';
import type { HemisphereNodeDatum } from '@/components/live/hemisphere-nodes';

const NODE_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  VISIONARY:    { bg: '#f5f3ff', text: '#6d28d9', border: '#8b5cf6' },
  OPPORTUNITY:  { bg: '#eff6ff', text: '#1d4ed8', border: '#3b82f6' },
  CONSTRAINT:   { bg: '#fff7ed', text: '#c2410c', border: '#f97316' },
  RISK:         { bg: '#fef2f2', text: '#b91c1c', border: '#ef4444' },
  ENABLER:      { bg: '#f0fdfa', text: '#0d9488', border: '#14b8a6' },
  INSIGHT:      { bg: '#ecfdf5', text: '#059669', border: '#10b981' },
  ACTION:       { bg: '#fffbeb', text: '#b45309', border: '#f59e0b' },
  QUESTION:     { bg: '#f0f9ff', text: '#0369a1', border: '#0ea5e9' },
};

function formatTimeMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function NodeDetailModal({ node, onClose }: { node: HemisphereNodeDatum; onClose: () => void }) {
  const cls = node.classification;
  const analysis = node.agenticAnalysis;
  const type = cls?.primaryType ?? 'INSIGHT';
  const colors = NODE_TYPE_COLORS[type] ?? NODE_TYPE_COLORS.INSIGHT;
  const confidence = cls?.confidence;
  const domains = (analysis?.domains ?? []).slice(0, 3);
  const meaning = analysis?.semanticMeaning;
  const sentiment = analysis?.sentimentTone;

  const primaryDomain = domains[0];
  const secondaryDomains = domains.slice(1);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-[95vw] max-w-3xl rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: colors.bg, border: `2px solid ${colors.border}` }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: `1px solid ${colors.border}22` }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: colors.border, color: '#fff' }}
            >
              {type}
            </span>
            {confidence != null && (
              <span className="text-xs font-medium opacity-60" style={{ color: colors.text }}>
                {(confidence * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md transition-colors hover:bg-black/5">
            <X className="h-4 w-4" style={{ color: colors.text }} />
          </button>
        </div>

        {/* Body — statement left, judgement right */}
        <div className="flex min-h-[180px]">

          {/* LEFT — the committed statement, nothing else */}
          <div className="flex-1 px-6 py-5 flex flex-col justify-center min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3 opacity-40" style={{ color: colors.text }}>
              Statement
            </p>
            <p
              className="text-lg font-medium leading-relaxed"
              style={{ color: colors.text }}
            >
              &ldquo;{node.rawText}&rdquo;
            </p>
          </div>

          {/* Divider */}
          <div className="w-px self-stretch" style={{ backgroundColor: `${colors.border}22` }} />

          {/* RIGHT — clean decision panel */}
          <div className="w-64 flex-shrink-0 px-5 py-5 flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-40" style={{ color: colors.text }}>
              Domain Judgement
            </p>

            {/* Primary domain — prominent */}
            {primaryDomain ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold" style={{ color: colors.text }}>{primaryDomain.domain}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: colors.border }}>
                    {(primaryDomain.relevance * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${colors.border}20` }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${primaryDomain.relevance * 100}%`, backgroundColor: colors.border }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs opacity-30" style={{ color: colors.text }}>No domain assigned</p>
            )}

            {/* Secondary domains — smaller */}
            {secondaryDomains.length > 0 && (
              <div className="space-y-2">
                {secondaryDomains.map((d) => (
                  <div key={d.domain}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs opacity-70" style={{ color: colors.text }}>{d.domain}</span>
                      <span className="text-xs tabular-nums opacity-60" style={{ color: colors.text }}>
                        {(d.relevance * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${colors.border}20` }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${d.relevance * 100}%`, backgroundColor: `${colors.border}80` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Interpretation — one line, only if present */}
            {meaning && meaning !== node.rawText && (
              <p className="text-xs leading-relaxed opacity-60 border-t pt-3" style={{ color: colors.text, borderColor: `${colors.border}22` }}>
                {meaning}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-2 text-xs opacity-40"
          style={{ borderTop: `1px solid ${colors.border}22`, color: colors.text }}
        >
          <div className="flex items-center gap-3">
            {sentiment && <span className="capitalize">{sentiment}</span>}
            {node.speakerId && <span>{node.speakerId.replace('speaker-', 'Speaker #')}</span>}
          </div>
          {node.transcriptChunk?.startTimeMs != null && (
            <span>{formatTimeMs(node.transcriptChunk.startTimeMs)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
