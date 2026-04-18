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
  const keywords = cls?.keywords ?? [];
  const domains = analysis?.domains ?? [];
  const themes = analysis?.themes ?? [];
  const actors = analysis?.actors ?? [];
  const sentiment = analysis?.sentimentTone;
  const meaning = analysis?.semanticMeaning;

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
          style={{ borderBottom: `1px solid ${colors.border}33` }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: colors.border, color: '#fff' }}
            >
              {type}
            </span>
            {confidence != null && (
              <span className="text-xs font-medium" style={{ color: colors.text }}>
                {(confidence * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors hover:bg-black/5"
          >
            <X className="h-4 w-4" style={{ color: colors.text }} />
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex divide-x" style={{ borderColor: `${colors.border}22` }}>

          {/* LEFT — full quote + interpretation */}
          <div className="flex-1 px-5 py-4 space-y-3 min-w-0">
            <h4 className="text-xs font-semibold uppercase tracking-wide opacity-50" style={{ color: colors.text }}>
              Captured Statement
            </h4>
            <p
              className="text-base font-medium leading-relaxed"
              style={{ color: colors.text }}
            >
              &ldquo;{node.rawText}&rdquo;
            </p>

            {meaning && meaning !== node.rawText && (
              <div className="pt-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-50" style={{ color: colors.text }}>
                  Interpretation
                </h4>
                <p className="text-sm leading-relaxed" style={{ color: colors.text }}>
                  {meaning}
                </p>
              </div>
            )}

            {/* Themes */}
            {themes.length > 0 && (
              <div className="pt-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5 opacity-50" style={{ color: colors.text }}>
                  Themes
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {themes.map((t) => (
                    <span
                      key={t.label}
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${colors.border}20`, color: colors.text, border: `1px solid ${colors.border}40` }}
                    >
                      {t.label} ({(t.confidence * 100).toFixed(0)}%)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {keywords.length > 0 && (
              <div className="pt-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5 opacity-50" style={{ color: colors.text }}>
                  Keywords
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${colors.border}20`, color: colors.text, border: `1px solid ${colors.border}40` }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — domain breakdown */}
          <div className="w-72 flex-shrink-0 px-5 py-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide opacity-50" style={{ color: colors.text }}>
              Domain Breakdown
            </h4>

            {domains.length > 0 ? (
              <div className="space-y-2.5">
                {domains.map((d) => (
                  <div key={d.domain}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium leading-tight" style={{ color: colors.text }}>{d.domain}</span>
                      <span className="ml-2 flex-shrink-0 tabular-nums opacity-60" style={{ color: colors.text }}>
                        {(d.relevance * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${colors.border}20` }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${d.relevance * 100}%`, backgroundColor: colors.border }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs opacity-40" style={{ color: colors.text }}>No domain data</p>
            )}

            {/* Actors */}
            {actors.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5 opacity-50" style={{ color: colors.text }}>
                  Actors
                </h4>
                <div className="space-y-1">
                  {actors.map((a) => (
                    <div key={a.name} className="text-xs" style={{ color: colors.text }}>
                      <span className="font-semibold">{a.name}</span>
                      {a.role ? <span className="opacity-60"> — {a.role}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer: sentiment + speaker + time */}
        <div
          className="flex items-center justify-between px-5 py-2.5 text-xs opacity-60"
          style={{ borderTop: `1px solid ${colors.border}22`, color: colors.text }}
        >
          <div className="flex items-center gap-3">
            {sentiment && <span className="capitalize">{sentiment}</span>}
            {node.speakerId && (
              <span>Speaker: {node.speakerId.replace('speaker-', '#')}</span>
            )}
          </div>
          {node.transcriptChunk?.startTimeMs != null && (
            <span>{formatTimeMs(node.transcriptChunk.startTimeMs)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
