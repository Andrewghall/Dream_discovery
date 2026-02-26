'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, BookOpen, TrendingUp } from 'lucide-react';

// ══════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════

const RETAIL_WORKSHOP_ID = 'retail-cx-workshop';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

type PageProps = { params: Promise<{ id: string }> };

type SpiderAxisStat = {
  axisId: string;
  label: string;
  today: { median: number | null };
  target: { median: number | null };
  projected: { median: number | null };
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
// DEMO DATA — retail reference workshop
// ══════════════════════════════════════════════════════════

const DEMO_SPIDER_DATA: SpiderAxisStat[] = [
  { axisId: 'people',       label: 'People',       today: { median: 5.3 }, target: { median: 8.2 }, projected: { median: 4.5 } },
  { axisId: 'organisation', label: 'Organisation',  today: { median: 4.1 }, target: { median: 8.0 }, projected: { median: 3.8 } },
  { axisId: 'customer',     label: 'Customer',      today: { median: 4.8 }, target: { median: 9.0 }, projected: { median: 4.0 } },
  { axisId: 'technology',   label: 'Technology',    today: { median: 3.5 }, target: { median: 8.5 }, projected: { median: 3.0 } },
  { axisId: 'regulation',   label: 'Regulation',    today: { median: 6.2 }, target: { median: 8.0 }, projected: { median: 5.8 } },
];

const DEMO_WORD_CLOUD: WordCloudItem[] = [
  { text: 'customer',       value: 47 },
  { text: 'experience',     value: 42 },
  { text: 'personalisation',value: 38 },
  { text: 'journey',        value: 35 },
  { text: 'omnichannel',    value: 31 },
  { text: 'automation',     value: 29 },
  { text: 'loyalty',        value: 27 },
  { text: 'digital',        value: 26 },
  { text: 'insight',        value: 25 },
  { text: 'engagement',     value: 24 },
  { text: 'friction',       value: 23 },
  { text: 'seamless',       value: 22 },
  { text: 'recommendation', value: 21 },
  { text: 'fulfilment',     value: 20 },
  { text: 'inventory',      value: 19 },
  { text: 'conversion',     value: 18 },
  { text: 'analytics',      value: 18 },
  { text: 'touchpoint',     value: 17 },
  { text: 'retention',      value: 17 },
  { text: 'satisfaction',   value: 16 },
  { text: 'demand',         value: 15 },
  { text: 'prediction',     value: 15 },
  { text: 'segment',        value: 14 },
  { text: 'feedback',       value: 14 },
  { text: 'real-time',      value: 13 },
  { text: 'integration',    value: 13 },
  { text: 'workforce',      value: 12 },
  { text: 'training',       value: 12 },
  { text: 'basket',         value: 11 },
  { text: 'pricing',        value: 11 },
  { text: 'supply-chain',   value: 10 },
  { text: 'sustainability', value: 10 },
  { text: 'compliance',     value: 9 },
  { text: 'agility',        value: 9 },
  { text: 'convenience',    value: 8 },
  { text: 'data-driven',    value: 8 },
  { text: 'ai-agent',       value: 8 },
  { text: 'innovation',     value: 7 },
  { text: 'click-collect',  value: 7 },
  { text: 'promotion',      value: 7 },
  { text: 'self-service',   value: 6 },
  { text: 'markdown',       value: 6 },
  { text: 'returns',        value: 6 },
  { text: 'seasonal',       value: 5 },
  { text: 'churn',          value: 5 },
  { text: 'acquisition',    value: 5 },
  { text: 'mobile',         value: 5 },
  { text: 'checkout',       value: 4 },
  { text: 'subscription',   value: 4 },
  { text: 'community',      value: 4 },
];

const DEMO_SUMMARY: WorkshopSummary = {
  workshopId: RETAIL_WORKSHOP_ID,
  workshopName: 'Retail CX Transformation',
  generatedAt: new Date().toISOString(),
  visionStatement:
    'Transform the end-to-end retail customer experience into a seamlessly personalised, AI-augmented journey — where every touchpoint anticipates customer needs, removes friction, and builds lasting loyalty while empowering colleagues to focus on high-value human interactions.',
  executiveSummary:
    'Across 12 participant interviews spanning operations, marketing, technology, and store leadership, a clear consensus emerged: the current retail experience is fragmented across channels, over-reliant on manual processes, and lacking the data infrastructure to deliver meaningful personalisation. Participants consistently identified the gap between customer expectations — shaped by digital-native competitors — and the organisation\'s ability to deliver joined-up experiences. Key themes included the urgent need for omnichannel inventory visibility, AI-driven demand forecasting, and a unified customer data platform. Store colleagues expressed enthusiasm for AI-assisted tools that remove administrative burden, while leadership emphasised the importance of phased adoption to maintain regulatory compliance and workforce confidence. The strongest consensus was that personalisation must move from reactive segmentation to predictive, real-time engagement — but only with transparent data practices that earn customer trust.',
  lenses: {
    People:
      'Workforce readiness is the pivotal enabler. Colleagues are open to AI-assisted tooling but need structured upskilling programmes and clear role evolution pathways. Middle management requires the most support — bridging operational execution with new digital capabilities. Retention risk is highest among experienced store staff who feel technology is being imposed rather than co-designed with them.',
    Customer:
      'Customers expect seamless transitions between online browsing, in-store discovery, and post-purchase support. The biggest pain points are inconsistent pricing across channels, lack of real-time stock visibility, and impersonal communications. Loyalty programme members want recognition that transcends transactions — personalised recommendations, early access, and genuine relationship building rather than points-based incentives.',
    Technology:
      'The current technology landscape is characterised by siloed systems: a legacy POS, a separate e-commerce platform, and disconnected CRM and inventory management. Participants unanimously prioritised a composable architecture with a unified customer data platform as the foundation. AI adoption should focus first on demand forecasting and inventory optimisation (high impact, lower risk), then progress to customer-facing personalisation engines.',
    Regulation:
      'Data privacy and consumer protection regulations are evolving rapidly. Participants flagged GDPR compliance gaps in current marketing automation and a lack of transparent opt-in mechanisms for AI-driven personalisation. Sustainability reporting requirements are also creating urgency around supply chain traceability. A privacy-by-design approach was recommended, embedding compliance into the technology architecture from day one rather than retrofitting.',
    Organisation:
      'Organisational structure currently mirrors channel silos — separate teams for online, stores, and wholesale create competing priorities. Participants strongly advocated for cross-functional squads aligned to customer journey stages rather than channels. Decision-making speed was cited as a major constraint — too many approval layers delay responsiveness to market signals. A centre-of-excellence model for AI and data was recommended to accelerate capability building.',
  },
  sources: {
    reportCount: 12,
    dataPointCount: 847,
  },
};

const DEMO_PARTICIPANT_COUNT = 12;

// ══════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════

export default function DiscoveryPage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const isRetailDemo = workshopId === RETAIL_WORKSHOP_ID;

  const [spiderData, setSpiderData] = useState<SpiderAxisStat[] | null>(
    isRetailDemo ? DEMO_SPIDER_DATA : null
  );
  const [wordCloudData, setWordCloudData] = useState<WordCloudItem[] | null>(
    isRetailDemo ? DEMO_WORD_CLOUD : null
  );
  const [summary, setSummary] = useState<WorkshopSummary | null>(
    isRetailDemo ? DEMO_SUMMARY : null
  );
  const [participantCount, setParticipantCount] = useState(
    isRetailDemo ? DEMO_PARTICIPANT_COUNT : 0
  );
  const [loading, setLoading] = useState(!isRetailDemo);
  const [summaryLoading, setSummaryLoading] = useState(!isRetailDemo);

  // ── Fetch spider + keywords (skip for retail demo) ─────
  useEffect(() => {
    if (isRetailDemo) return;

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
          // API returns { terms: [{ text, count }] }
          const terms = data.terms || data.keywords;
          if (Array.isArray(terms)) {
            setWordCloudData(
              terms.slice(0, 60).map((k: { text?: string; term?: string; count: number }) => ({
                text: k.text || k.term || '',
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
  }, [workshopId, isRetailDemo]);

  // ── Fetch summary (skip for retail demo) ───────────────
  useEffect(() => {
    if (isRetailDemo) return;

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
  }, [workshopId, isRetailDemo]);

  // ── Radar chart data transform — 3 series: Today, Target, Projected ──
  const radarChartData = useMemo(() => {
    if (!spiderData) return null;
    return spiderData
      .filter((a) => a.today.median !== null)
      .map((a) => ({
        label: a.label.length > 20 ? a.label.slice(0, 18) + '...' : a.label,
        value: a.today.median ?? 0,
      }));
  }, [spiderData]);

  const radarSeries = useMemo(() => {
    if (!spiderData) return undefined;

    const axes = spiderData.filter((a) => a.today.median !== null);
    const fmt = (a: SpiderAxisStat) =>
      a.label.length > 20 ? a.label.slice(0, 18) + '...' : a.label;

    const todaySeries = {
      name: 'Today',
      data: axes.map((a) => ({ label: fmt(a), value: a.today.median ?? 0 })),
    };
    const targetSeries = {
      name: 'Target',
      data: axes.map((a) => ({ label: fmt(a), value: a.target.median ?? 0 })),
    };
    const projectedSeries = {
      name: 'Projected (do nothing)',
      data: axes.map((a) => ({ label: fmt(a), value: a.projected?.median ?? a.today.median ?? 0 })),
    };

    // Only include series that have data
    const series = [todaySeries];
    if (targetSeries.data.some((d) => d.value > 0)) series.push(targetSeries);
    if (projectedSeries.data.some((d) => d.value > 0)) series.push(projectedSeries);

    return series.length > 1 ? series : undefined;
  }, [spiderData]);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
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
                <LazyRadarChart data={radarChartData} series={radarSeries} />
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
