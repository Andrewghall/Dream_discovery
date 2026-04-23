'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { HemisphereNodeDatum } from '@/components/live/hemisphere-nodes';
import { normalizeRenderDomain } from '@/lib/live/semantic-unit-domain-projection';

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

function toRoundedPercentages(domains: Array<{ domain: string; relevance: number }>) {
  if (domains.length === 0) return [] as Array<{ domain: string; relevance: number; percent: number }>;

  const sanitized = domains.map((domain) => ({
    ...domain,
    relevance: Math.max(0, domain.relevance),
  }));
  const total = sanitized.reduce((sum, domain) => sum + domain.relevance, 0);
  if (total <= 0) {
    const evenBase = Math.floor(100 / sanitized.length);
    let remainder = 100 - evenBase * sanitized.length;
    return sanitized.map((domain) => ({
      ...domain,
      percent: evenBase + (remainder-- > 0 ? 1 : 0),
    }));
  }

  const scaled = sanitized.map((domain, index) => {
    const rawPercent = (domain.relevance / total) * 100;
    const basePercent = Math.floor(rawPercent);
    return {
      ...domain,
      index,
      rawPercent,
      basePercent,
      remainder: rawPercent - basePercent,
    };
  });

  let remaining = 100 - scaled.reduce((sum, domain) => sum + domain.basePercent, 0);
  const byRemainder = [...scaled].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.index - b.index;
  });

  const extraByIndex = new Map<number, number>();
  for (let i = 0; i < byRemainder.length && remaining > 0; i++) {
    extraByIndex.set(byRemainder[i].index, 1);
    remaining -= 1;
  }

  return scaled.map((domain) => ({
    domain: domain.domain,
    relevance: domain.relevance,
    percent: domain.basePercent + (extraByIndex.get(domain.index) ?? 0),
  }));
}

export function NodeDetailModal({
  node,
  onClose,
  availableDomains = [],
  onReprioritizeDomain,
  onRemoveDomain,
  onSetDomainPercentage,
  onSaveTrainingFeedback,
  trainingFeedbackStatus = 'idle',
}: {
  node: HemisphereNodeDatum;
  onClose: () => void;
  availableDomains?: string[];
  onReprioritizeDomain?: (domain: string) => void;
  onRemoveDomain?: (domain: string) => void;
  onSetDomainPercentage?: (domain: string, percent: number) => void;
  onSaveTrainingFeedback?: () => void;
  trainingFeedbackStatus?: 'idle' | 'saving' | 'saved' | 'error';
}) {
  const cls = node.classification;
  const analysis = node.agenticAnalysis;
  const type = cls?.primaryType ?? 'INSIGHT';
  const colors = NODE_TYPE_COLORS[type] ?? NODE_TYPE_COLORS.INSIGHT;
  const confidence = cls?.confidence;
  const domains = [...(analysis?.domains ?? [])]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 4);
  const meaning = analysis?.semanticMeaning;
  const sentiment = analysis?.sentimentTone;

  const primaryDomain = domains[0];
  const secondaryDomains = domains.slice(1);
  const roundedDomains = toRoundedPercentages(domains);
  const roundedPrimaryDomain = roundedDomains[0];
  const roundedSecondaryDomains = roundedDomains.slice(1);
  const editableDomains = useMemo(() => {
    const ordered = [
      ...availableDomains.map((domain) => normalizeRenderDomain(domain)).filter(Boolean),
      ...roundedDomains.map((domain) => normalizeRenderDomain(domain.domain)).filter(Boolean),
    ];
    return Array.from(new Set(ordered));
  }, [availableDomains, roundedDomains]);
  const roundedPercentByDomain = useMemo(() => {
    return new Map(
      roundedDomains.map((domain) => [normalizeRenderDomain(domain.domain), domain.percent])
    );
  }, [roundedDomains]);
  const draftSeed = useMemo(() => (
    editableDomains
      .map((domain) => `${domain}:${roundedPercentByDomain.get(domain) ?? 0}`)
      .join('|')
  ), [editableDomains, roundedPercentByDomain]);
  const [draftPercentages, setDraftPercentages] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    for (const domain of editableDomains) {
      nextDrafts[domain] = String(roundedPercentByDomain.get(domain) ?? 0);
    }
    setDraftPercentages(nextDrafts);
  }, [draftSeed, node.dataPointId]);

  const commitPercentage = (domain: string, rawValue: string, fallbackPercent: number) => {
    const parsed = Number(rawValue);
    const nextPercent = Number.isFinite(parsed) ? parsed : fallbackPercent;
    const clamped = Math.max(0, Math.min(100, Math.round(nextPercent)));
    setDraftPercentages((prev) => ({
      ...prev,
      [domain]: String(clamped),
    }));
    onSetDomainPercentage?.(domain, clamped);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-[95vw] max-w-4xl rounded-xl shadow-2xl overflow-hidden"
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
            {node.domainLearningSource === 'saved_feedback' && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: `${colors.border}1A`, color: colors.text }}
              >
                Learned from saved feedback
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md transition-colors hover:bg-black/5">
            <X className="h-4 w-4" style={{ color: colors.text }} />
          </button>
        </div>

        {/* Body — statement left, judgement right */}
        <div className="flex min-h-[220px]">

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
          <div className="w-[24rem] flex-shrink-0 px-5 py-5 flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-40" style={{ color: colors.text }}>
              Domain Judgement
            </p>
            {node.domainLearningSource === 'saved_feedback' && (
              <p className="text-[11px] leading-relaxed opacity-60" style={{ color: colors.text }}>
                This domain split was restored from previously saved correction feedback.
              </p>
            )}

            {/* Primary domain — prominent */}
            {primaryDomain && roundedPrimaryDomain ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold" style={{ color: colors.text }}>{primaryDomain.domain}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: colors.border }}>
                    {roundedPrimaryDomain.percent}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${colors.border}20` }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${roundedPrimaryDomain.percent}%`, backgroundColor: colors.border }}
                  />
                </div>
                {onReprioritizeDomain && (
                  <button
                    type="button"
                    onClick={() => onReprioritizeDomain(primaryDomain.domain)}
                    className="mt-2 text-[11px] font-medium underline underline-offset-2 opacity-70 hover:opacity-100"
                    style={{ color: colors.text }}
                  >
                    Keep as primary
                  </button>
                )}
                {onSaveTrainingFeedback && (
                  <button
                    type="button"
                    onClick={onSaveTrainingFeedback}
                    disabled={trainingFeedbackStatus === 'saving'}
                    className="mt-2 ml-3 text-[11px] font-medium underline underline-offset-2 opacity-70 hover:opacity-100 disabled:opacity-40"
                    style={{ color: colors.text }}
                  >
                    {trainingFeedbackStatus === 'saving'
                      ? 'Saving feedback...'
                      : trainingFeedbackStatus === 'saved'
                        ? 'Saved as training feedback'
                        : trainingFeedbackStatus === 'error'
                          ? 'Retry saving feedback'
                          : 'Save as training feedback'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs opacity-30" style={{ color: colors.text }}>No domain assigned</p>
            )}

            {/* Secondary domains — smaller */}
            {secondaryDomains.length > 0 && (
              <div className="space-y-2">
                {secondaryDomains.map((d, index) => {
                  const rounded = roundedSecondaryDomains[index];
                  if (!rounded) return null;
                  return (
                  <div key={d.domain}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs opacity-70" style={{ color: colors.text }}>{d.domain}</span>
                      <span className="text-xs tabular-nums opacity-60" style={{ color: colors.text }}>
                        {rounded.percent}%
                      </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${colors.border}20` }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${rounded.percent}%`, backgroundColor: `${colors.border}80` }}
                      />
                    </div>
                    {onReprioritizeDomain && (
                      <div className="mt-1 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onReprioritizeDomain(d.domain)}
                          className="text-[11px] font-medium underline underline-offset-2 opacity-70 hover:opacity-100"
                          style={{ color: colors.text }}
                        >
                          Make primary
                        </button>
                        {onRemoveDomain && (
                          <button
                            type="button"
                            onClick={() => onRemoveDomain(d.domain)}
                            className="text-[11px] font-medium underline underline-offset-2 opacity-70 hover:opacity-100"
                            style={{ color: colors.text }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}

            {onSetDomainPercentage && editableDomains.length > 0 && (
              <div
                className="space-y-2 border-t pt-3"
                style={{ borderColor: `${colors.border}22` }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-40" style={{ color: colors.text }}>
                  Adjust Domain Split
                </p>
                <div className="grid grid-cols-2 gap-2">
                {editableDomains.map((domain) => {
                  const currentPercent = roundedPercentByDomain.get(domain) ?? 0;
                  const isPresent = currentPercent > 0;
                  return (
                    <div
                      key={domain}
                      className="grid grid-cols-1 gap-1 rounded-md px-2 py-1.5"
                      style={{ backgroundColor: `${colors.border}08` }}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium" style={{ color: colors.text }}>
                          {domain}
                        </div>
                        {!isPresent && (
                          <div className="text-[10px] opacity-50" style={{ color: colors.text }}>
                            Not currently present
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={draftPercentages[domain] ?? String(currentPercent)}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDraftPercentages((prev) => ({ ...prev, [domain]: value }));
                            if (value !== '') {
                              commitPercentage(domain, value, currentPercent);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              commitPercentage(domain, draftPercentages[domain] ?? String(currentPercent), currentPercent);
                            }
                          }}
                          onBlur={() => {
                            commitPercentage(domain, draftPercentages[domain] ?? String(currentPercent), currentPercent);
                          }}
                          className="w-14 rounded-md border bg-transparent px-2 py-1 text-right text-xs"
                          style={{ borderColor: `${colors.border}44`, color: colors.text }}
                        />
                        <span className="text-xs opacity-60" style={{ color: colors.text }}>%</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        {onReprioritizeDomain && isPresent && (
                          <button
                            type="button"
                            onClick={() => onReprioritizeDomain(domain)}
                            className="font-medium underline underline-offset-2 opacity-70 hover:opacity-100"
                            style={{ color: colors.text }}
                          >
                            Primary
                          </button>
                        )}
                        {onRemoveDomain && isPresent && (
                          <button
                            type="button"
                            onClick={() => {
                              setDraftPercentages((prev) => ({ ...prev, [domain]: '0' }));
                              onRemoveDomain(domain);
                            }}
                            className="font-medium underline underline-offset-2 opacity-70 hover:opacity-100"
                            style={{ color: colors.text }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
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
