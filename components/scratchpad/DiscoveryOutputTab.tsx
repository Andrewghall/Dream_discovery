'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Brain, ChevronDown, Sparkles, Loader2 } from 'lucide-react';
import { AiInsightCard } from './AiInsightCard';
import { ReportSectionToggle } from '@/components/report-builder/ReportSectionToggle';

interface DiscoveryOutputTabProps {
  data: any;
  workshopId?: string;
  onGenerated?: (updated: any) => void;
  onChange?: (data: any) => void;
}

/* ── Executive Intelligence sections ─────────────────────────── */

const INTEL_SECTIONS = [
  {
    key: 'operationalReality',
    label: 'OPERATIONAL REALITY',
    subtitle: 'How this organisation actually operates',
    dotColor: '#4f46e5',
    borderColor: 'border-indigo-100',
    labelColor: 'text-indigo-600',
  },
  {
    key: 'organisationalMisalignment',
    label: 'ORGANISATIONAL MISALIGNMENT',
    subtitle: 'Where the organisation is fractured',
    dotColor: '#e11d48',
    borderColor: 'border-rose-100',
    labelColor: 'text-rose-600',
  },
  {
    key: 'systemicFriction',
    label: 'SYSTEMIC FRICTION',
    subtitle: 'What is slowing transformation',
    dotColor: '#d97706',
    borderColor: 'border-amber-100',
    labelColor: 'text-amber-600',
  },
  {
    key: 'transformationReadiness',
    label: 'TRANSFORMATION READINESS',
    subtitle: 'Whether the organisation can change',
    dotColor: '#059669',
    borderColor: 'border-emerald-100',
    labelColor: 'text-emerald-600',
  },
] as const;

/* ── Domain color map (kept for Workshop Signals accordion) ──── */

const colorMap: Record<string, { border: string; bg: string; text: string; hex: string }> = {
  blue:   { border: 'border-blue-200',   bg: 'bg-blue-50',   text: 'text-blue-600',   hex: '#2563eb' },
  purple: { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-600', hex: '#9333ea' },
  green:  { border: 'border-green-200',  bg: 'bg-green-50',  text: 'text-green-600',  hex: '#16a34a' },
  orange: { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-600', hex: '#ea580c' },
  indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-600', hex: '#4f46e5' },
  pink:   { border: 'border-pink-200',   bg: 'bg-pink-50',   text: 'text-pink-600',   hex: '#db2777' },
};

/* ── Main Component ───────────────────────────────────────────── */

export function DiscoveryOutputTab({ data, workshopId, onGenerated, onChange: _onChange }: DiscoveryOutputTabProps) {
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!workshopId) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/discovery-intelligence`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate');
      onGenerated?.(json.discoveryOutput);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setGenerating(false);
    }
  }

  if (!data) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No discovery data found. Run discovery interviews first.
        </p>
      </Card>
    );
  }

  const sections: any[] = data.sections || [];
  const hasExecutiveIntelligence = Boolean(data.operationalReality?.insight);

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Perception Signal</span>
            <span className="text-[10px] text-slate-400">— Discovery Phase</span>
          </div>
          {workshopId && (
            <div className="flex items-center gap-2">
              <ReportSectionToggle workshopId={workshopId} sectionId="discovery_diagnostic" title="Discovery Diagnostic" />
              <ReportSectionToggle workshopId={workshopId} sectionId="discovery_signals" title="Discovery Signals" />
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">How the Organisation Sees Itself</h2>

        {/* Small factual stat chips */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {data.participants?.length > 0 && (
            <span className="text-xs text-slate-500">{data.participants.length} participants</span>
          )}
          {data.participants?.length > 0 && data.totalUtterances > 0 && (
            <span className="text-slate-200 text-xs">|</span>
          )}
          {data.totalUtterances > 0 && (
            <span className="text-xs text-slate-500">{data.totalUtterances} insights captured</span>
          )}
          {sections.length > 0 && data.totalUtterances > 0 && (
            <span className="text-slate-200 text-xs">|</span>
          )}
          {sections.length > 0 && (
            <span className="text-xs text-slate-500">{sections.length} domains explored</span>
          )}
        </div>
      </div>

      {/* ── AI Perception Summary ───────────────────────────────── */}
      {data._aiSummary && <AiInsightCard summary={data._aiSummary} />}

      {/* ── Executive Intelligence Sections ────────────────────── */}
      {hasExecutiveIntelligence ? (
        <>
          <div className="space-y-4">
            {INTEL_SECTIONS.map((section) => {
              const intel = data[section.key];
              if (!intel?.insight) return null;
              const evidence: string[] = intel.evidence || [];
              return (
                <div
                  key={section.key}
                  className={`rounded-xl border ${section.borderColor} bg-white p-6`}
                >
                  {/* Section label */}
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: section.dotColor }}
                    />
                    <p className={`text-[10px] font-bold tracking-widest uppercase ${section.labelColor}`}>
                      {section.label}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mb-4 pl-4">{section.subtitle}</p>

                  {/* Insight paragraph */}
                  <p className="text-sm text-slate-700 leading-relaxed mb-5">{intel.insight}</p>

                  {/* Evidence bullets */}
                  {evidence.length > 0 && (
                    <div className="border-t border-slate-50 pt-4">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Evidence from workshop signals
                      </p>
                      <ul className="space-y-2">
                        {evidence.map((e: string, i: number) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className="text-slate-300 mt-0.5 text-sm flex-shrink-0">·</span>
                            <span className="text-sm text-slate-600 leading-snug">{e}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Final Discovery Summary ─────────────────────────── */}
          {data.finalDiscoverySummary && (
            <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-6">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-3">
                Final Discovery Summary
              </p>
              <p className="text-sm leading-relaxed text-slate-100">
                {data.finalDiscoverySummary}
              </p>
            </div>
          )}
        </>
      ) : (
        /* Generate button — works from discovery data alone, no synthesis needed */
        <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 p-6 text-center">
          <Brain className="h-6 w-6 text-indigo-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 mb-1">Discovery Intelligence not yet generated</p>
          <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
            Generate executive intelligence from discovery interview data — no workshop required.
            Produces Operational Reality, Misalignment, Friction, and Readiness analysis.
          </p>
          {generateError && (
            <p className="text-xs text-rose-500 mb-3">{generateError}</p>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || !workshopId}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating...</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" />Generate Discovery Intelligence</>
            )}
          </button>
        </div>
      )}

      {/* ── Workshop Signals — collapsed domain breakdown ──────── */}
      {sections.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none py-3 px-4 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-180" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Workshop Signals — Domain Breakdown
            </span>
            <span className="text-xs text-slate-400 ml-auto">{sections.length} domains</span>
          </summary>

          <div className="mt-3">
            <Accordion type="multiple" className="w-full space-y-2">
              {sections.map((section: any, idx: number) => {
                const colors = colorMap[section.color] || colorMap.blue;
                return (
                  <AccordionItem
                    key={idx}
                    value={`domain-${idx}`}
                    className={`border ${colors.border} rounded-lg px-4 bg-white`}
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{section.icon}</span>
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${colors.text}`}>{section.domain}</p>
                          <p className="text-[11px] text-slate-400">
                            {section.utteranceCount} insights
                            {section.topThemes?.length > 0 && ` · ${section.topThemes.slice(0, 3).join(', ')}`}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pb-3 pt-1">
                        {/* Representative Quotes */}
                        {section.quotes?.length > 0 && (
                          <div className="space-y-2">
                            {section.quotes.map((quote: any, i: number) => (
                              <div
                                key={i}
                                className={`p-3 border-l-2 bg-slate-50 rounded-r-lg`}
                                style={{ borderLeftColor: colors.hex }}
                              >
                                <p className="text-xs italic text-slate-600 mb-1">&ldquo;{quote.text}&rdquo;</p>
                                <p className="text-[10px] text-slate-400">— {quote.author}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Sentiment bar */}
                        {section.sentiment && (
                          <div>
                            <p className="text-[10px] text-slate-400 mb-1.5">Sentiment distribution</p>
                            <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                              {section.sentiment.concerned > 0 && (
                                <div className="bg-rose-300" style={{ width: `${section.sentiment.concerned}%` }} />
                              )}
                              {section.sentiment.neutral > 0 && (
                                <div className="bg-amber-200" style={{ width: `${section.sentiment.neutral}%` }} />
                              )}
                              {section.sentiment.optimistic > 0 && (
                                <div className="bg-emerald-300" style={{ width: `${section.sentiment.optimistic}%` }} />
                              )}
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                              <span>{section.sentiment.concerned}% concerned</span>
                              <span>{section.sentiment.neutral}% neutral</span>
                              <span>{section.sentiment.optimistic}% optimistic</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </details>
      )}
    </div>
  );
}
