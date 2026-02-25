'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, BookOpen, TrendingUp } from 'lucide-react';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

type PageProps = { params: Promise<{ id: string }> };

type SpiderAxisStat = {
  axisId: string;
  label: string;
  today: { median: number | null };
  target: { median: number | null };
};

type WordCloudItem = { text: string; value: number };

type WorkshopSummary = {
  workshopId: string;
  workshopName: string | null;
  generatedAt: string;
  visionStatement: string;
  executiveSummary: string;
  lenses: {
    People: string;
    Customer: string;
    Technology: string;
    Regulation: string;
    Organisation: string;
  };
  sources: {
    liveSnapshotId?: string | null;
    reportCount: number;
    dataPointCount: number;
  };
};

// ══════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════

export default function DiscoveryPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [spiderData, setSpiderData] = useState<SpiderAxisStat[] | null>(null);
  const [wordCloudData, setWordCloudData] = useState<WordCloudItem[] | null>(null);
  const [summary, setSummary] = useState<WorkshopSummary | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // ── Fetch spider + keywords ─────────────────────────────
  useEffect(() => {
    async function fetchDiscoveryData() {
      setLoading(true);
      try {
        const [spiderRes, keywordsRes] = await Promise.all([
          fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/spider?bust=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/keywords?bust=${Date.now()}`, { cache: 'no-store' }),
        ]);

        if (spiderRes.ok) {
          const data = await spiderRes.json();
          setSpiderData(data.axisStats || null);
          setParticipantCount(data.participantCount || 0);
        }

        if (keywordsRes.ok) {
          const data = await keywordsRes.json();
          if (Array.isArray(data.keywords)) {
            setWordCloudData(
              data.keywords.slice(0, 60).map((k: { term: string; count: number }) => ({
                text: k.term,
                value: k.count,
              }))
            );
          }
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }

    fetchDiscoveryData();
  }, [workshopId]);

  // ── Fetch summary ───────────────────────────────────────
  useEffect(() => {
    async function fetchSummary() {
      setSummaryLoading(true);
      try {
        const res = await fetch(
          `/api/admin/workshops/${encodeURIComponent(workshopId)}/summary?ts=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = await res.json();
          setSummary(data.summary || null);
        }
      } catch {
        // fail silently
      } finally {
        setSummaryLoading(false);
      }
    }

    fetchSummary();
  }, [workshopId]);

  // ── Radar chart data transform ──────────────────────────
  const radarChartData = useMemo(() => {
    if (!spiderData) return null;
    return spiderData
      .filter((a) => a.today.median !== null)
      .slice(0, 10)
      .map((a) => ({
        label: a.label.length > 20 ? a.label.slice(0, 18) + '...' : a.label,
        value: a.today.median ?? 0,
      }));
  }, [spiderData]);

  const radarTargetSeries = useMemo(() => {
    if (!spiderData) return undefined;
    const targetData = spiderData
      .filter((a) => a.target.median !== null)
      .slice(0, 10)
      .map((a) => ({
        label: a.label.length > 20 ? a.label.slice(0, 18) + '...' : a.label,
        value: a.target.median ?? 0,
      }));
    return targetData.length > 0 ? [{ name: 'Target', data: targetData }] : undefined;
  }, [spiderData]);

  const LENS_ICONS: Record<string, string> = {
    People: 'people',
    Customer: 'customer',
    Technology: 'technology',
    Organisation: 'organisation',
    Regulation: 'regulation',
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href={`/admin/workshops/${workshopId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Discovery Synthesis</h1>
              <p className="text-sm text-muted-foreground">
                Collective viewpoint from {participantCount > 0 ? `${participantCount} participant` : 'individual'} AI interview{participantCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {participantCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{participantCount} participants</span>
            </div>
          )}
        </div>

        {/* Executive Summary */}
        {summaryLoading ? (
          <div className="rounded-xl border bg-card p-8 mb-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <span className="text-sm text-muted-foreground">Generating synthesis...</span>
            </div>
          </div>
        ) : summary ? (
          <div className="space-y-6 mb-6">
            {/* Vision Statement */}
            <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-8">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">Vision Statement</h2>
              </div>
              <p className="text-lg leading-relaxed text-foreground font-medium">
                {summary.visionStatement}
              </p>
            </div>

            {/* Executive Summary */}
            <div className="rounded-xl border bg-card p-8">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Executive Summary</h2>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {summary.executiveSummary}
              </p>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground/60">
                <span>{summary.sources.reportCount} interview report{summary.sources.reportCount !== 1 ? 's' : ''}</span>
                <span>{summary.sources.dataPointCount} data points</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Spider + Word Cloud */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Spider Diagram */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-semibold mb-4">Domain Assessment</h3>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : radarChartData && radarChartData.length > 0 ? (
              <div className="flex justify-center">
                <LazyRadarChart data={radarChartData} series={radarTargetSeries} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                No spider data yet &mdash; complete participant interviews
              </div>
            )}
          </div>

          {/* Word Cloud */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-semibold mb-4">Key Themes</h3>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : wordCloudData && wordCloudData.length > 0 ? (
              <LazyWordCloud words={wordCloudData} />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                No keyword data yet &mdash; complete participant interviews
              </div>
            )}
          </div>
        </div>

        {/* Domain Lenses */}
        {summary?.lenses && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Domain Perspectives</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.entries(summary.lenses).map(([lens, text]) => (
                <div key={lens} className="rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${
                      lens === 'People' ? 'bg-violet-100 text-violet-700' :
                      lens === 'Customer' ? 'bg-emerald-100 text-emerald-700' :
                      lens === 'Technology' ? 'bg-blue-100 text-blue-700' :
                      lens === 'Regulation' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {lens.charAt(0)}
                    </span>
                    <h3 className="text-sm font-semibold">{lens}</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// LAZY-LOADED CHART COMPONENTS
// ══════════════════════════════════════════════════════════

function LazyRadarChart({
  data,
  series,
}: {
  data: Array<{ label: string; value: number }>;
  series?: Array<{ name: string; data: Array<{ label: string; value: number }> }>;
}) {
  const [RadarChart, setRadarChart] = useState<React.ComponentType<{
    data: Array<{ label: string; value: number }>;
    series?: Array<{ name: string; data: Array<{ label: string; value: number }> }>;
    size?: number;
    max?: number;
  }> | null>(null);

  useEffect(() => {
    import('@/components/report/radar-chart').then((mod) => {
      setRadarChart(() => mod.RadarChart);
    });
  }, []);

  if (!RadarChart)
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  return <RadarChart data={data} series={series} size={300} max={10} />;
}

function LazyWordCloud({ words }: { words: Array<{ text: string; value: number }> }) {
  const [WordCloud, setWordCloud] = useState<React.ComponentType<{
    words: Array<{ text: string; value: number }>;
    className?: string;
  }> | null>(null);

  useEffect(() => {
    import('@/components/report/word-cloud').then((mod) => {
      setWordCloud(() => mod.WordCloud);
    });
  }, []);

  if (!WordCloud)
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  return <WordCloud words={words} className="h-[300px]" />;
}
