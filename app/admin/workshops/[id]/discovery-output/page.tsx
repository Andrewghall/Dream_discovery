'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, BarChart2, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DiscoveryOutputTab } from '@/components/scratchpad/DiscoveryOutputTab';
import { AlignmentHeatmap } from '@/components/discover-analysis/alignment-heatmap';
import { TensionSurface } from '@/components/discover-analysis/tension-surface';
import { ConstraintMap } from '@/components/discover-analysis/constraint-map';
import { ConfidenceIndex } from '@/components/discover-analysis/confidence-index';
import { NarrativeDivergence } from '@/components/discover-analysis/narrative-divergence';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DiscoveryOutputPage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [loading, setLoading] = useState(true);
  const [discoveryOutput, setDiscoveryOutput] = useState<any>(null);
  const [discoverAnalysis, setDiscoverAnalysis] = useState<DiscoverAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workshopName, setWorkshopName] = useState<string>('');

  // Analysis generation state
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [scratchpadRes, workshopRes, analysisRes] = await Promise.all([
          fetch(`/api/admin/workshops/${workshopId}/scratchpad`),
          fetch(`/api/admin/workshops/${workshopId}`),
          fetch(`/api/admin/workshops/${workshopId}/discover-analysis`),
        ]);

        if (!scratchpadRes.ok) {
          throw new Error(`Failed to load data (HTTP ${scratchpadRes.status})`);
        }

        const scratchpadData = await scratchpadRes.json();
        const output = scratchpadData.scratchpad?.discoveryOutput;
        if (output && Object.keys(output).length > 0) {
          setDiscoveryOutput(output);
        }

        if (workshopRes.ok) {
          const workshopData = await workshopRes.json();
          setWorkshopName(workshopData.workshop?.name ?? '');
        }

        if (analysisRes.ok) {
          const analysisData = await analysisRes.json();
          if (analysisData.analysis) {
            setDiscoverAnalysis(analysisData.analysis);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [workshopId]);

  // SSE-based analysis generation
  const generateAnalysis = useCallback(async () => {
    setGeneratingAnalysis(true);
    setAnalysisProgress('Starting analysis...');

    try {
      const res = await fetch(
        `/api/admin/workshops/${encodeURIComponent(workshopId)}/discover-analysis`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      );

      if (!res.ok) throw new Error(`Failed: ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'progress') {
                setAnalysisProgress(data.message || 'Processing...');
              } else if (currentEvent === 'analysis.complete') {
                setDiscoverAnalysis(data.analysis);
              } else if (currentEvent === 'error') {
                setAnalysisProgress(`Error: ${data.message}`);
              }
            } catch { /* skip malformed */ }
            currentEvent = '';
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate analysis:', err);
      setAnalysisProgress('Failed to generate analysis');
    } finally {
      setGeneratingAnalysis(false);
      setAnalysisProgress(null);
    }
  }, [workshopId]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background px-6 py-3 flex items-center gap-3">
        <BarChart2 className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <h1 className="text-sm font-semibold">Discovery Output</h1>
          {workshopName && (
            <p className="text-xs text-muted-foreground">{workshopName}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-10">

        {/* Loading spinner */}
        {loading && (
          <div className="flex justify-center mt-20">
            <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 max-w-md mx-auto mt-16">
            <p className="text-sm font-semibold text-red-700">Failed to load discovery output</p>
            <p className="text-xs text-red-600 font-mono mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Section 1: Discovery Interview Synthesis ─────────────────── */}
            {discoveryOutput ? (
              <section>
                <DiscoveryOutputTab data={discoveryOutput} />
              </section>
            ) : (
              <Card className="p-8 flex flex-col items-center gap-4 text-center">
                <div className="rounded-full bg-muted p-4">
                  <BarChart2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">No synthesis output yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Run <strong>✦ Synthesise</strong> on the Insight Map to generate domain-level
                    analysis — radar chart, word clouds, and per-domain sentiment &amp; quotes.
                  </p>
                </div>
                <Link href={`/admin/workshops/${workshopId}/hemisphere`}>
                  <Button variant="outline" size="sm">Go to Insight Map</Button>
                </Link>
              </Card>
            )}

            {/* ── Section 2: Organisational Analysis ───────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">Organisational Analysis</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Alignment heatmap, constraint map, tensions and confidence — derived directly from discovery data
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateAnalysis}
                  disabled={generatingAnalysis}
                >
                  {generatingAnalysis ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {analysisProgress ?? 'Generating…'}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {discoverAnalysis ? 'Regenerate' : 'Generate Analysis'}
                    </>
                  )}
                </Button>
              </div>

              {/* Prompt to generate if not yet run */}
              {!discoverAnalysis && !generatingAnalysis && (
                <Card className="p-6 flex flex-col items-center gap-3 text-center">
                  <Info className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground max-w-md">
                    Click <strong>Generate Analysis</strong> to compute the alignment heatmap,
                    constraint map, tension surface, and narrative divergence from your discovery data.
                    This analysis is based entirely on collected interview data — nothing is estimated.
                  </p>
                </Card>
              )}

              {/* Progress indicator while generating */}
              {generatingAnalysis && analysisProgress && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100 mb-6">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                  <p className="text-sm text-blue-700">{analysisProgress}</p>
                </div>
              )}

              {discoverAnalysis && (
                <div className="space-y-8">

                  {/* Data quality notice */}
                  {discoverAnalysis.dataQuality && (
                    <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-700">{discoverAnalysis.dataQuality.note}</p>
                    </div>
                  )}

                  {/* Alignment Heatmap */}
                  {(discoverAnalysis.alignment?.themes?.length ?? 0) > 0 && (
                    <Card className="p-6">
                      <h3 className="font-bold text-lg mb-1">Alignment Heatmap</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Actor × theme alignment and divergence across the organisation
                      </p>
                      <AlignmentHeatmap
                        data={discoverAnalysis.alignment}
                        showSampleSize
                      />
                    </Card>
                  )}

                  {/* Tension Surface */}
                  {(discoverAnalysis.tensions?.tensions?.length ?? 0) > 0 && (
                    <Card className="p-6">
                      <h3 className="font-bold text-lg mb-1">Tension Surface</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Ranked unresolved tensions and competing perspectives
                      </p>
                      <TensionSurface data={discoverAnalysis.tensions} />
                    </Card>
                  )}

                  {/* Constraint Map */}
                  {(discoverAnalysis.constraints?.constraints?.length ?? 0) > 0 && (
                    <Card className="p-6">
                      <h3 className="font-bold text-lg mb-1">Constraint Map</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Weighted constraints and their dependencies
                      </p>
                      <ConstraintMap data={discoverAnalysis.constraints} />
                    </Card>
                  )}

                  {/* Narrative Divergence */}
                  {(discoverAnalysis.narrative?.layers?.length ?? 0) > 0 && (
                    <Card className="p-6">
                      <h3 className="font-bold text-lg mb-1">Narrative Divergence</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Language and sentiment differences across organisational layers
                      </p>
                      <NarrativeDivergence data={discoverAnalysis.narrative} />
                    </Card>
                  )}

                  {/* Confidence Index */}
                  {discoverAnalysis.confidence && (
                    <Card className="p-6">
                      <h3 className="font-bold text-lg mb-1">Confidence Index</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Certainty, hedging, and uncertainty distribution across domains
                      </p>
                      <ConfidenceIndex data={discoverAnalysis.confidence} />
                    </Card>
                  )}

                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
