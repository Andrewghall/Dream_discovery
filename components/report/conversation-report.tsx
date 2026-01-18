'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart } from '@/components/report/radar-chart';
import { WordCloud, WordCloudItem } from '@/components/report/word-cloud';
import { Button } from '@/components/ui/button';
import { fixedQuestionsForVersion } from '@/lib/conversation/fixed-questions';

export interface PhaseInsight {
  phase: string;
  currentScore: number | null;
  targetScore: number | null;
  projectedScore: number | null;
  strengths: string[];
  working: string[];
  gaps: string[];
  painPoints: string[];
  frictions: string[];
  barriers: string[];
  constraint: string[];
  future: string[];
  support: string[];
}

function phaseLabel(phase: string): string {
  if (phase === 'people') return 'D1 — People';
  if (phase === 'corporate') return 'D2 — Corporate / Organisational';
  if (phase === 'customer') return 'D3 — Customer';
  if (phase === 'technology') return 'D4 — Technology';
  if (phase === 'regulation') return 'D5 — Regulation';
  return phase;
}

function phaseRatingPrompt(phase: string): string {
  if (phase === 'people') return 'Rate how well-equipped you and your colleagues are to do your jobs effectively.';
  if (phase === 'corporate') return "Rate how well the organisation's processes and decision-making help you do your job.";
  if (phase === 'customer') return 'Rate how well the organisation meets customer needs and expectations.';
  if (phase === 'technology') return 'Rate the technology, systems, and tools you use in terms of reliability and ease of use.';
  if (phase === 'regulation') return 'Rate how well the organisation handles regulatory and compliance requirements.';
  return 'Rate this area on a 1–10 scale.';
}

const MATURITY_BANDS: Array<{ label: string; bg: string }> = [
  { label: 'Reactive', bg: '#ffcccc' },
  { label: 'Emerging', bg: '#ffe6cc' },
  { label: 'Defined', bg: '#fff2cc' },
  { label: 'Optimised', bg: '#ccffcc' },
  { label: 'Intelligent', bg: '#cce6ff' },
];

function maturityScaleForPhase(phase: string, questionSetVersion: string | null | undefined): string[] | null {
  const qs = fixedQuestionsForVersion(questionSetVersion);
  const questions = qs[phase as keyof typeof qs];
  const triple = Array.isArray(questions) ? questions.find((q) => q.tag === 'triple_rating') : null;
  const scale = triple && Array.isArray(triple.maturityScale) ? triple.maturityScale : null;
  return Array.isArray(scale) && scale.length === 5 ? scale : null;
}

function questionTextForPhase(phase: string, questionSetVersion: string | null | undefined): string | null {
  const qs = fixedQuestionsForVersion(questionSetVersion);
  const questions = qs[phase as keyof typeof qs];
  const triple = Array.isArray(questions) ? questions.find((q) => q.tag === 'triple_rating') : null;
  const text = triple && typeof triple.text === 'string' ? triple.text.trim() : '';
  return text ? text : null;
}

function bandForScore(score: number | null): { band: string; colorClass: string } {
  if (!score) return { band: '—', colorClass: 'bg-muted' };
  if (score <= 2) return { band: 'Reactive', colorClass: 'bg-red-100' };
  if (score <= 4) return { band: 'Emerging', colorClass: 'bg-orange-100' };
  if (score <= 6) return { band: 'Defined', colorClass: 'bg-yellow-100' };
  if (score <= 8) return { band: 'Optimised', colorClass: 'bg-green-100' };
  return { band: 'Intelligent', colorClass: 'bg-blue-100' };
}

function scoreText(n: number | null) {
  return typeof n === 'number' ? `${n}/10` : '—';
}

function nonEmpty(arr: string[] | undefined | null) {
  return Array.isArray(arr) && arr.length > 0;
}

export function ConversationReport({
  executiveSummary,
  tone,
  feedback,
  inputQuality,
  keyInsights,
  phaseInsights,
  wordCloudThemes,
  onDownloadPdf,
  pdfMode,
  questionSetVersion,
}: {
  executiveSummary: string;
  tone: string | null;
  feedback: string;
  inputQuality?: {
    score: number;
    label: 'high' | 'medium' | 'low';
    rationale: string;
  };
  keyInsights?: Array<{
    title: string;
    insight: string;
    confidence: 'high' | 'medium' | 'low';
    evidence: string[];
  }>;
  phaseInsights: PhaseInsight[];
  wordCloudThemes: WordCloudItem[];
  onDownloadPdf?: () => void | Promise<void>;
  pdfMode?: boolean;
  questionSetVersion?: string | null;
}) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const reportDate = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

  const handleDownloadPdf = async () => {
    if (!onDownloadPdf) return;
    if (isDownloadingPdf) return;

    try {
      setIsDownloadingPdf(true);
      await onDownloadPdf();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const axes = phaseInsights.map((p) => ({ phase: p.phase, label: phaseLabel(p.phase) }));

  const currentSeries = {
    name: 'Current capability',
    data: axes.map((a) => ({
      label: a.label,
      value: phaseInsights.find((p) => p.phase === a.phase)?.currentScore ?? 0,
    })),
  };

  const futureSeries = {
    name: 'Target ambition',
    data: axes.map((a) => ({
      label: a.label,
      value: phaseInsights.find((p) => p.phase === a.phase)?.targetScore ?? 0,
    })),
  };

  const confidenceSeries = {
    name: 'Projected if unchanged',
    data: axes.map((a) => ({
      label: a.label,
      value: phaseInsights.find((p) => p.phase === a.phase)?.projectedScore ?? 0,
    })),
  };

  return (
    <div id="discovery-report" className="container max-w-4xl mx-auto px-3 sm:px-4 py-6 space-y-4">
      {!pdfMode && (
        <div className="print-only print-header">
          <div className="print-header-row">
            <div className="print-header-date">{reportDate}</div>
            <div className="print-header-title">DREAM DISCOVERY</div>
            <div className="print-header-spacer" />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <img src="/ethenta-logo.png" alt="Ethenta" className="h-8 w-auto" />
        </div>
        <img src="/Dream.PNG" alt="DREAM" className="w-full h-auto max-h-28 object-contain" />
        <div className="text-sm font-medium text-center">
          Preparing your summary report from the dialogue session.
        </div>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Discovery Report</CardTitle>
              <CardDescription>Interviewee view of the organisation and operating environment</CardDescription>
            </div>
            <div className="no-print">
              <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloadingPdf}>
                {isDownloadingPdf ? 'Downloading PDF…' : 'Download PDF'}
              </Button>
              {isDownloadingPdf && (
                <div className="mt-2 text-xs font-medium text-muted-foreground animate-pulse">
                  Completing and downloading your PDF…
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tone && (
            <div className="text-xs text-muted-foreground mb-2">
              Tone: <span className="font-medium text-foreground">{tone}</span>
            </div>
          )}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{executiveSummary}</div>
        </CardContent>
      </Card>

      {(inputQuality || (Array.isArray(keyInsights) && keyInsights.length > 0)) && (
        <div className="grid grid-cols-1 gap-4">
          {inputQuality && (
            <Card>
              <CardHeader>
                <CardTitle>Input Quality (Evidence Check)</CardTitle>
                <CardDescription>How much usable detail was captured in the discovery answers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="text-sm">
                  Score: <span className="font-semibold">{inputQuality.score}/100</span> (
                  <span className="font-semibold">{inputQuality.label}</span>)
                </div>
                {inputQuality.rationale && <div className="whitespace-pre-wrap">{inputQuality.rationale}</div>}
              </CardContent>
            </Card>
          )}

          {Array.isArray(keyInsights) && keyInsights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Key Insights (Evidence-backed)</CardTitle>
                <CardDescription>Only insights supported by quotes from the participant’s answers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {keyInsights.map((k, idx) => (
                  <div key={`${k.title}-${idx}`} className="space-y-1">
                    <div className="font-semibold">{idx + 1}. {k.title}</div>
                    <div className="whitespace-pre-wrap">{k.insight}</div>
                    <div className="text-xs text-muted-foreground">
                      Confidence: <span className="font-medium text-foreground">{k.confidence}</span>
                    </div>
                    {Array.isArray(k.evidence) && k.evidence.length > 0 && (
                      <div className="text-xs">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Evidence quotes</div>
                        <div className="whitespace-pre-wrap">
                          {k.evidence.map((q) => `“${q}”`).join('\n')}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="report-charts-grid grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Spider Diagram (Three Scores)</CardTitle>
            <CardDescription>Current, target, and projected (1–10)</CardDescription>
          </CardHeader>
          <CardContent className="report-radar-content flex flex-col items-center">
            {phaseInsights.length ? (
              <div className="flex justify-center">
                <RadarChart data={currentSeries.data} series={[currentSeries, futureSeries, confidenceSeries]} />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No ratings captured.</div>
            )}
          </CardContent>
        </Card>

        <Card className="report-themes-card">
          <CardHeader>
            <CardTitle>Themes & Intent</CardTitle>
            <CardDescription>Most common cleaned keywords across narrative responses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <WordCloud words={wordCloudThemes} variant="neutral" />
          </CardContent>
        </Card>
      </div>

      <div className="report-domain-grid grid grid-cols-1 gap-4">
        {phaseInsights.map((p) => (
          <Card key={p.phase} className="report-phase-card">
            <CardHeader>
              <CardTitle>{phaseLabel(p.phase)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {questionTextForPhase(p.phase, questionSetVersion) && (
                <div className="text-sm font-medium whitespace-pre-wrap leading-snug">
                  {questionTextForPhase(p.phase, questionSetVersion)}
                </div>
              )}

              {(() => {
                const scale = maturityScaleForPhase(p.phase, questionSetVersion);
                if (!scale) return null;
                return (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Maturity bands: 1–2 Reactive, 3–4 Emerging, 5–6 Defined, 7–8 Optimised, 9–10 Intelligent
                    </div>
                    <div className="space-y-1">
                      {scale.map((t, idx) => (
                        <div
                          key={`${p.phase}-band-${idx}`}
                          className="rounded-md border px-3 py-2 text-xs leading-snug"
                          style={{ backgroundColor: MATURITY_BANDS[idx]?.bg || undefined }}
                        >
                          <span className="font-medium">{MATURITY_BANDS[idx]?.label}:</span> {t}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground whitespace-normal">
                  {phaseRatingPrompt(p.phase)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'current', label: 'Current', helper: 'How things are today', value: p.currentScore },
                      { key: 'target', label: 'Target', helper: 'Where it needs to be in 18 months', value: p.targetScore },
                      { key: 'projected', label: 'Projected', helper: 'Where it will be if nothing changes', value: p.projectedScore },
                    ] as const
                  ).map((row) => {
                    const band = bandForScore(row.value);
                    return (
                      <div key={row.key} className="rounded-md border p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold leading-tight">{row.label}</div>
                            <div className="text-[11px] text-muted-foreground leading-snug">{row.helper}</div>
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-md border ${band.colorClass}`}>
                            {row.value ?? '—'} {row.value ? `/10 · ${band.band}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {nonEmpty(p.strengths) && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Strengths / enablers</div>
                  <div className="whitespace-pre-wrap">{p.strengths.join('\n')}</div>
                </div>
              )}

              {nonEmpty(p.working) && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">What’s working</div>
                  <div className="whitespace-pre-wrap">{p.working.join('\n')}</div>
                </div>
              )}

              {nonEmpty(p.gaps) && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Gaps / challenges</div>
                  <div className="whitespace-pre-wrap">{p.gaps.join('\n')}</div>
                </div>
              )}

              {nonEmpty(p.painPoints) && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Pain points</div>
                  <div className="whitespace-pre-wrap">{p.painPoints.join('\n')}</div>
                </div>
              )}

              {nonEmpty(p.frictions) && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Friction</div>
                  <div className="whitespace-pre-wrap">{p.frictions.join('\n')}</div>
                </div>
              )}

              {nonEmpty(p.barriers) && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Barriers</div>
                  <div className="whitespace-pre-wrap">{p.barriers.join('\n')}</div>
                </div>
              )}

              {nonEmpty(p.constraint) && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Constraints</div>
                  <div className="whitespace-pre-wrap">{p.constraint.join('\n')}</div>
                </div>
              )}

              {nonEmpty(p.future) && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Future vision</div>
                  <div className="whitespace-pre-wrap">{p.future.join('\n')}</div>
                </div>
              )}

              {nonEmpty(p.support) && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Support needed</div>
                  <div className="whitespace-pre-wrap">{p.support.join('\n')}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feedback to the Interviewee</CardTitle>
          <CardDescription>What to share back with the participant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{feedback}</div>
        </CardContent>
      </Card>

      {!pdfMode && (
        <div className="print-only print-footer">
          <div className="print-footer-row">
            <div className="print-footer-left">Copyright 2026 Ethenta</div>
            <div className="print-footer-right">
              <span className="print-page-number" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
