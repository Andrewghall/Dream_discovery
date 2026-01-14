'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart } from '@/components/report/radar-chart';
import { WordCloud, WordCloudItem } from '@/components/report/word-cloud';
import { Button } from '@/components/ui/button';

export interface PhaseInsight {
  phase: string;
  currentScore: number | null;
  futureScore: number | null;
  confidenceScore: number | null;
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
  phaseInsights,
  wordCloudThemes,
}: {
  executiveSummary: string;
  tone: string | null;
  feedback: string;
  phaseInsights: PhaseInsight[];
  wordCloudThemes: WordCloudItem[];
}) {
  const axes = phaseInsights.map((p) => ({
    label: p.phase.charAt(0).toUpperCase() + p.phase.slice(1),
    phase: p.phase,
  }));

  const currentSeries = {
    name: 'Current capability',
    data: axes.map((a) => ({
      label: a.label,
      value: phaseInsights.find((p) => p.phase === a.phase)?.currentScore ?? 0,
    })),
  };

  const futureSeries = {
    name: 'Desired future ambition',
    data: axes.map((a) => ({
      label: a.label,
      value: phaseInsights.find((p) => p.phase === a.phase)?.futureScore ?? 0,
    })),
  };

  const confidenceSeries = {
    name: 'Confidence to achieve',
    data: axes.map((a) => ({
      label: a.label,
      value: phaseInsights.find((p) => p.phase === a.phase)?.confidenceScore ?? 0,
    })),
  };

  return (
    <div id="discovery-report" className="container max-w-4xl mx-auto px-3 sm:px-4 py-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Discovery Report</CardTitle>
              <CardDescription>Interviewee view of the organisation and operating environment</CardDescription>
            </div>
            <div className="no-print">
              <Button
                variant="outline"
                onClick={() => {
                  try {
                    window.print();
                  } catch {
                    // ignore
                  }
                }}
              >
                Download PDF
              </Button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Spider Diagram (Three Scores)</CardTitle>
            <CardDescription>Current capability, desired ambition, and confidence (1–10)</CardDescription>
          </CardHeader>
          <CardContent>
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

      <div className="space-y-4">
        {phaseInsights.map((p) => (
          <Card key={p.phase}>
            <CardHeader>
              <CardTitle>{phaseLabel(p.phase)}</CardTitle>
              <CardDescription>
                Current: {scoreText(p.currentScore)} | Ambition: {scoreText(p.futureScore)} | Confidence: {scoreText(p.confidenceScore)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
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
          <CardTitle>Feedback to the interviewee</CardTitle>
          <CardDescription>Constructive, appreciative, and action-oriented</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{feedback}</div>
        </CardContent>
      </Card>
    </div>
  );
}
