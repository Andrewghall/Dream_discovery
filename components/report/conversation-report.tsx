'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart } from '@/components/report/radar-chart';
import { WordCloud, WordCloudItem } from '@/components/report/word-cloud';

export interface PhaseInsight {
  phase: string;
  rating: number | null;
  confidence: number | null;
  strengths: string[];
  reality: string[];
  ambition: string[];
}

export function ConversationReport({
  summary,
  phaseInsights,
  ambitionWordCloud,
  realityWordCloud,
}: {
  summary: string;
  phaseInsights: PhaseInsight[];
  ambitionWordCloud: WordCloudItem[];
  realityWordCloud: WordCloudItem[];
}) {
  const radarData = phaseInsights
    .filter((p) => typeof p.rating === 'number')
    .map((p) => ({
      label: p.phase.charAt(0).toUpperCase() + p.phase.slice(1),
      value: p.rating as number,
    }));

  return (
    <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Discovery Report</CardTitle>
          <CardDescription>Summary, spider diagram, and ambition vs reality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{summary}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Spider Diagram (Reality Rating)</CardTitle>
            <CardDescription>1–10 ratings by competency area</CardDescription>
          </CardHeader>
          <CardContent>
            {radarData.length ? (
              <div className="flex justify-center">
                <RadarChart data={radarData} />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No ratings captured.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ambition vs Reality</CardTitle>
            <CardDescription>Most common words in future-state vs current constraints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">AMBITION</div>
              <WordCloud words={ambitionWordCloud} variant="ambition" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">REALITY</div>
              <WordCloud words={realityWordCloud} variant="reality" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
