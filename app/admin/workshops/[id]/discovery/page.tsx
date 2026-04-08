'use client';

import React, { use, useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, BookOpen, TrendingUp, Layers, Loader2, RefreshCw, Compass, ChevronDown, ChevronUp, BadgeCheck, Info } from 'lucide-react';
import { AlignmentHeatmap } from '@/components/discover-analysis/alignment-heatmap';
import { TensionSurface } from '@/components/discover-analysis/tension-surface';
import { NarrativeDivergence } from '@/components/discover-analysis/narrative-divergence';
import { ConstraintMap } from '@/components/discover-analysis/constraint-map';
import { ConfidenceIndex } from '@/components/discover-analysis/confidence-index';
import { GptInquiryBar } from '@/components/discover-analysis/gpt-inquiry-bar';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';
import { buildAnalysisFromFindings } from '@/lib/field-discovery/findings-to-analysis-adapter';

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
  lenses: Record<string, string>;
  sources: {
    liveSnapshotId?: string | null;
    reportCount: number;
    dataPointCount: number;
  };
};

type KeyInsight = {
  title: string;
  insight: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
};

type PhaseInsight = {
  phase: string;
  currentScore: number | null;
  targetScore: number | null;
  gaps: string[];
  painPoints: string[];
};

type ParticipantReport = {
  id: string;
  participantId: string;
  participantName: string;
  participantRole: string | null;
  participantDepartment: string | null;
  executiveSummary: string;
  feedback: string;
  tone: string | null;
  keyInsights: KeyInsight[] | null;
  phaseInsights: PhaseInsight[] | null;
  createdAt: string;
};

// Rotating palette for dynamic lens cards — works for any number of lenses
const LENS_PALETTE: { badge: string; border: string; header: string }[] = [
  { badge: 'bg-violet-100 text-violet-700', border: 'border-l-violet-400', header: 'bg-violet-50 dark:bg-violet-950/20' },
  { badge: 'bg-emerald-100 text-emerald-700', border: 'border-l-emerald-400', header: 'bg-emerald-50 dark:bg-emerald-950/20' },
  { badge: 'bg-blue-100 text-blue-700', border: 'border-l-blue-400', header: 'bg-blue-50 dark:bg-blue-950/20' },
  { badge: 'bg-red-100 text-red-700', border: 'border-l-red-400', header: 'bg-red-50 dark:bg-red-950/20' },
  { badge: 'bg-amber-100 text-amber-700', border: 'border-l-amber-400', header: 'bg-amber-50 dark:bg-amber-950/20' },
  { badge: 'bg-pink-100 text-pink-700', border: 'border-l-pink-400', header: 'bg-pink-50 dark:bg-pink-950/20' },
  { badge: 'bg-cyan-100 text-cyan-700', border: 'border-l-cyan-400', header: 'bg-cyan-50 dark:bg-cyan-950/20' },
  { badge: 'bg-orange-100 text-orange-700', border: 'border-l-orange-400', header: 'bg-orange-50 dark:bg-orange-950/20' },
];

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
  const [summaryGenerating, setSummaryGenerating] = useState(false);

  // ── Workshop domain pack (for conditional Field Discovery card) ──
  const [workshopDomainPack, setWorkshopDomainPack] = useState<string | null>(null);

  // ── Participant reports ───────────────────────────────────
  const [participantReports, setParticipantReports] = useState<ParticipantReport[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // ── Discover Analysis state ──────────────────────────────
  const [analysis, setAnalysis] = useState<DiscoverAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string | null>(null);
  const [analysisCheckDone, setAnalysisCheckDone] = useState(false);

  // ── Generate analysis (SSE) ──────────────────────────────
  const generateAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    setAnalysisProgress('Starting...');

    try {
      const res = await fetch(
        `/api/admin/workshops/${encodeURIComponent(workshopId)}/discover-analysis`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      );

      if (!res.ok) throw new Error(`Failed: ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const event = line.slice(7).trim();
            // Read next data line
            const nextIdx = lines.indexOf(line) + 1;
            if (nextIdx < lines.length && lines[nextIdx].startsWith('data: ')) {
              try {
                const data = JSON.parse(lines[nextIdx].slice(6));
                if (event === 'progress') {
                  setAnalysisProgress(data.message || 'Processing...');
                } else if (event === 'analysis.complete') {
                  setAnalysis(data.analysis);
                } else if (event === 'error') {
                  console.error('Analysis error:', data.message);
                  setAnalysisProgress(`Error: ${data.message}`);
                }
              } catch { /* skip */ }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate analysis:', error);
      setAnalysisProgress('Failed to generate analysis');
    } finally {
      setAnalysisLoading(false);
      setAnalysisProgress(null);
    }
  }, [workshopId]);

  // ── Fetch cached analysis + workshop info (all workshops) ──
  useEffect(() => {
    async function fetchAnalysis() {
      try {
        // 1. Try fetching stored analysis from API
        const res = await fetch(
          `/api/admin/workshops/${encodeURIComponent(workshopId)}/discover-analysis`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.analysis) {
            setAnalysis(data.analysis);
            return;
          }
        }
      } catch { /* continue to fallbacks */ }

      // 2. If no stored analysis, try building from findings
      try {
        const findingsRes = await fetch(
          `/api/admin/workshops/${encodeURIComponent(workshopId)}/findings`,
          { cache: 'no-store' },
        );
        if (findingsRes.ok) {
          const findingsData = await findingsRes.json();
          if (findingsData.findings && findingsData.findings.length > 0) {
            const adapted = buildAnalysisFromFindings(workshopId, findingsData.findings);
            setAnalysis(adapted);
            return;
          }
        }
      } catch { /* continue to fallback */ }

      setAnalysisCheckDone(true);
    }

    async function fetchWorkshopInfo() {
      try {
        const res = await fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.workshop?.domainPack) setWorkshopDomainPack(data.workshop.domainPack);
        }
      } catch { /* fail silently */ }
    }

    fetchAnalysis();
    fetchWorkshopInfo();
  }, [workshopId]);

  // ── Auto-generate analysis on first load if no cached data ───────────
  useEffect(() => {
    if (analysisCheckDone && !analysis && !analysisLoading) {
      generateAnalysis();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisCheckDone]);

  // ── Fetch spider + keywords (all workshops, retail demo fallback) ─────
  useEffect(() => {
    async function fetchDiscoveryData() {
      setLoading(true);
      let gotSpider = false;
      let gotKeywords = false;
      try {
        const [spiderRes, keywordsRes] = await Promise.all([
          fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/spider?bust=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/admin/workshops/${encodeURIComponent(workshopId)}/keywords?bust=${Date.now()}`, { cache: 'no-store' }),
        ]);

        if (spiderRes.ok) {
          const data = await spiderRes.json();
          if (data.axisStats && data.axisStats.length > 0) {
            setSpiderData(data.axisStats);
            setParticipantCount(data.participantCount || 0);
            gotSpider = true;
          }
        }

        if (keywordsRes.ok) {
          const data = await keywordsRes.json();
          // API returns { terms: [{ text, count }] }
          const terms = data.terms || data.keywords;
          if (Array.isArray(terms) && terms.length > 0) {
            setWordCloudData(
              terms.slice(0, 60).map((k: { text?: string; term?: string; count: number }) => ({
                text: k.text || k.term || '',
                value: k.count,
              }))
            );
            gotKeywords = true;
          }
        }
      } catch {
        // fail silently
      }

      setLoading(false);
    }

    fetchDiscoveryData();
  }, [workshopId]);

  // ── Fetch cached summary on load, auto-generate once if no cache ────
  useEffect(() => {
    async function fetchCachedSummary() {
      setSummaryLoading(true);
      try {
        const res = await fetch(
          `/api/admin/workshops/${encodeURIComponent(workshopId)}/summary`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.summary) {
            setSummary(data.summary);
            setSummaryLoading(false);
            return;
          }
        }
      } catch { /* fall through */ }
      // No cached summary — auto-generate once and cache it
      setSummaryLoading(false);
      setSummaryGenerating(true);
      try {
        const genRes = await fetch(
          `/api/admin/workshops/${encodeURIComponent(workshopId)}/summary`,
          { method: 'POST', cache: 'no-store' }
        );
        if (genRes.ok) {
          const genData = await genRes.json();
          if (genData.summary) setSummary(genData.summary);
        }
      } catch { /* fail silently */ }
      setSummaryGenerating(false);
    }
    fetchCachedSummary();
  }, [workshopId]);

  // ── Generate summary via GPT (POST = generate + cache) ───────────────
  const generateSummary = async () => {
    setSummaryGenerating(true);
    try {
      const res = await fetch(
        `/api/admin/workshops/${encodeURIComponent(workshopId)}/summary`,
        { method: 'POST', cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.summary) setSummary(data.summary);
      }
    } catch { /* fail silently */ }
    setSummaryGenerating(false);
  };

  // ── Fetch participant reports ─────────────────────────────
  useEffect(() => {
    async function fetchParticipantReports() {
      try {
        const res = await fetch(
          `/api/admin/workshops/${encodeURIComponent(workshopId)}/participant-reports`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.reports && data.reports.length > 0) {
            setParticipantReports(data.reports);
          }
        }
      } catch { /* fail silently */ }
    }
    fetchParticipantReports();
  }, [workshopId]);

  // ── Radar chart data transform — 3 series: Today, Target, Projected ──
  const radarChartData = useMemo(() => {
    if (!spiderData || spiderData.length === 0) return null;
    // Include ALL axes (so all domains show on the chart even if some have no data yet).
    // Null scores are rendered at 0 (axis is visible but shape point is at centre).
    const hasAnyScore = spiderData.some((a) => a.today.median !== null);
    if (!hasAnyScore) return null;
    return spiderData.map((a) => ({
      label: a.label.length > 20 ? a.label.slice(0, 18) + '...' : a.label,
      value: a.today.median ?? 0,
    }));
  }, [spiderData]);

  const radarSeries = useMemo(() => {
    if (!spiderData || spiderData.length === 0) return undefined;

    // Use ALL axes so labels match radarChartData; nulls become 0 at the centre.
    const fmt = (a: SpiderAxisStat) =>
      a.label.length > 20 ? a.label.slice(0, 18) + '...' : a.label;

    const todaySeries = {
      name: 'Today',
      data: spiderData.map((a) => ({ label: fmt(a), value: a.today.median ?? 0 })),
    };
    const targetSeries = {
      name: 'Target',
      data: spiderData.map((a) => ({ label: fmt(a), value: a.target.median ?? 0 })),
    };
    const projectedSeries = {
      name: 'Projected (do nothing)',
      // Never fall back to today value — null projected means no projection exists, shown as 0 (centre).
      data: spiderData.map((a) => ({ label: fmt(a), value: a.projected?.median ?? 0 })),
    };

    // Only include a series if it has at least one non-zero score sourced from real data.
    const series = [todaySeries];
    if (targetSeries.data.some((d) => d.value > 0)) series.push(targetSeries);
    // Projected is only shown when actual projectedScore data exists (not a today fallback).
    if (spiderData.some((a) => a.projected?.median != null && a.projected.median > 0)) series.push(projectedSeries);

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
          <div className="flex items-center gap-3">
            {participantCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{participantCount} participants</span>
              </div>
            )}
            {!summaryLoading && (
              summary ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateSummary}
                  disabled={summaryGenerating}
                >
                  {summaryGenerating ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating...</>
                  ) : (
                    <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Regenerate</>
                  )}
                </Button>
              ) : (
                <Button size="sm" onClick={generateSummary} disabled={summaryGenerating}>
                  {summaryGenerating ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating...</>
                  ) : (
                    <><BookOpen className="h-3.5 w-3.5 mr-1.5" />Generate Summary</>
                  )}
                </Button>
              )
            )}
          </div>
        </div>

        {/* GPT Inquiry Bar — ask about the analysis */}
        <GptInquiryBar workshopId={workshopId} hasAnalysis={!!analysis} analysis={analysis} />

        {/* Executive Summary */}
        {summaryLoading ? (
          <div className="rounded-xl border bg-card p-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              <span className="text-sm text-muted-foreground">Loading summary...</span>
            </div>
          </div>
        ) : summary ? (
          <div className="rounded-xl border bg-card p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Executive Summary</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {summary.executiveSummary}
            </p>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground/60">
              <span>{summary.sources.reportCount} interview report{summary.sources.reportCount !== 1 ? 's' : ''}</span>
              <span>{summary.sources.dataPointCount} data points</span>
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
                <div style={{ width: '100%', maxWidth: 440 }}>
                  <LazyRadarChart data={radarChartData} series={radarSeries} />
                </div>
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
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Domain Perspectives</h2>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                {Object.keys(summary.lenses).length} domains
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(summary.lenses).map(([lens, text], i) => {
                const palette = LENS_PALETTE[i % LENS_PALETTE.length];
                return (
                  <div key={lens} className={`rounded-xl overflow-hidden border border-border bg-card border-l-4 ${palette.border}`}>
                    <div className={`px-5 py-3.5 ${palette.header} border-b border-border/50 flex items-center gap-3`}>
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold flex-shrink-0 ${palette.badge}`}>
                        {lens.charAt(0).toUpperCase()}
                      </span>
                      <h3 className="text-sm font-semibold leading-snug">{lens}</h3>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* FIELD DISCOVERY — Conditional on domain pack             */}
        {/* ══════════════════════════════════════════════════════════ */}

        {workshopDomainPack && (
          <div className="mt-12 pt-8 border-t-2 border-blue-200">
            <Link href={`/admin/workshops/${workshopId}/discovery/field`}>
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 dark:hover:bg-blue-950/30 p-6 transition-all cursor-pointer group">
                <div className="flex items-center gap-3 mb-2">
                  <Compass className="h-5 w-5 text-blue-600 group-hover:text-blue-700" />
                  <h2 className="text-lg font-bold tracking-tight text-blue-700 dark:text-blue-400">Field Discovery</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  On-site interview capture, multi-segment recording, structured findings extraction, and cross-stream diagnostic synthesis.
                </p>
                <p className="text-xs text-blue-600 mt-2 group-hover:underline">
                  Open Field Discovery module &rarr;
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ORGANISATIONAL ANALYSIS -- Discover Analysis Dashboard    */}
        {/* ══════════════════════════════════════════════════════════ */}

        <div className="mt-12 pt-8 border-t-2 border-slate-200">
          {/* Section header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-slate-500" />
              <div>
                <h2 className="text-xl font-bold tracking-tight">Organisational Analysis</h2>
                <p className="text-sm text-muted-foreground">
                  {analysis
                    ? `${analysis.participantCount} participants analysed`
                    : 'Structural insight from collective viewpoints'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {analysis && (
                <span className="text-xs text-muted-foreground/50">
                  Generated {new Date(analysis.generatedAt).toLocaleDateString()}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={generateAnalysis}
                disabled={analysisLoading}
              >
                {analysisLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : analysis ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Layers className="h-3.5 w-3.5 mr-1.5" />
                    Generate Analysis
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Progress indicator */}
          {analysisLoading && analysisProgress && (
            <div className="rounded-xl border bg-card p-6 mb-6 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className="text-sm text-muted-foreground">{analysisProgress}</span>
            </div>
          )}

          {/* Analysis content OR empty state */}
          {analysis ? (
            <div className="space-y-8">
              {/* Data quality banner — shown when derived from interview reports */}
              {analysis.dataQuality?.source === 'interview_reports' && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">{analysis.dataQuality.note}</p>
                </div>
              )}

              {/* Section 1: Alignment Heatmap */}
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-sm font-semibold">Alignment Heatmap</h3>
                  <DataQualityBadge source={analysis.dataQuality?.source} />
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Where do actors and themes align &mdash; or fracture?
                </p>
                <AlignmentHeatmap data={analysis.alignment} />
              </div>

              {/* Section 2: Tension Surface */}
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-sm font-semibold">Tension Surface</h3>
                  <DataQualityBadge source={analysis.dataQuality?.source} />
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Unresolved tensions ranked by severity
                </p>
                <TensionSurface data={analysis.tensions} />
              </div>

              {/* Section 3: Two-column — Narrative Divergence + Confidence */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 rounded-xl border bg-card p-6">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-sm font-semibold">Narrative Divergence</h3>
                    <DataQualityBadge source={analysis.dataQuality?.source} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    How language and perception differ across organisational layers
                  </p>
                  <NarrativeDivergence data={analysis.narrative} />
                </div>
                <div className="lg:col-span-2 rounded-xl border bg-card p-6">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-sm font-semibold">Confidence Index</h3>
                    <DataQualityBadge source={analysis.dataQuality?.source} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Certainty, hedging, and uncertainty distribution
                  </p>
                  <ConfidenceIndex data={analysis.confidence} />
                </div>
              </div>

              {/* Section 4: Constraint Map */}
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-sm font-semibold">Constraint Map</h3>
                  <DataQualityBadge source={analysis.dataQuality?.source} />
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Weighted constraints and their dependencies
                </p>
                <ConstraintMap data={analysis.constraints} />
              </div>
            </div>
          ) : !analysisLoading ? (
            <div className="rounded-xl border bg-card p-12 flex flex-col items-center justify-center text-center">
              <Layers className="h-10 w-10 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground/60 mb-2">
                No organisational analysis yet
              </h3>
              <p className="text-sm text-muted-foreground/40 max-w-md mb-6">
                Generate an analysis to surface alignment, tensions, narrative divergence,
                constraints, and confidence levels across your workshop data.
              </p>
              <Button onClick={generateAnalysis} disabled={analysisLoading}>
                <Layers className="h-4 w-4 mr-2" />
                Generate Organisational Analysis
              </Button>
            </div>
          ) : null}
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* INDIVIDUAL INTERVIEW REPORTS — Reference material         */}
        {/* ══════════════════════════════════════════════════════════ */}

        {participantReports.length > 0 && (
          <div className="mt-12 pt-8 border-t">
            <div className="flex items-center gap-2 mb-6">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Individual Interview Reports
              </h2>
              <span className="ml-auto text-xs text-muted-foreground/60">{participantReports.length} interviews</span>
            </div>
            <div className="space-y-3">
              {participantReports.map((report) => {
                const isExpanded = expandedReportId === report.id;
                const toneColor =
                  report.tone === 'strategic' ? 'bg-blue-100 text-blue-700' :
                  report.tone === 'visionary' ? 'bg-violet-100 text-violet-700' :
                  report.tone === 'critical' ? 'bg-red-100 text-red-700' :
                  report.tone === 'constructive' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-amber-100 text-amber-700';

                return (
                  <div key={report.id} className="rounded-xl border bg-card overflow-hidden">
                    <button
                      className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-sm">{report.participantName}</span>
                          {report.participantRole && (
                            <span className="text-xs text-muted-foreground">{report.participantRole}</span>
                          )}
                          {report.participantDepartment && (
                            <span className="text-xs text-muted-foreground/60">&middot; {report.participantDepartment}</span>
                          )}
                          {report.tone && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${toneColor}`}>
                              {report.tone}
                            </span>
                          )}
                        </div>
                        {!isExpanded && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{report.executiveSummary}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-muted-foreground/50">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-6 pb-6 space-y-5 border-t bg-muted/10">
                        <div className="pt-4">
                          <p className="text-sm leading-relaxed text-muted-foreground">{report.executiveSummary}</p>
                          {report.feedback && (
                            <p className="text-xs mt-3 text-muted-foreground/70 italic">{report.feedback}</p>
                          )}
                        </div>

                        {report.phaseInsights && report.phaseInsights.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Domain Scores</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                              {report.phaseInsights.map((pi) => {
                                const phaseColor =
                                  pi.phase === 'people' ? 'bg-violet-50 border-violet-200 text-violet-700' :
                                  pi.phase === 'customer' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                  pi.phase === 'technology' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                  pi.phase === 'regulation' ? 'bg-red-50 border-red-200 text-red-700' :
                                  'bg-amber-50 border-amber-200 text-amber-700';
                                return (
                                  <div key={pi.phase} className={`rounded-lg border p-3 text-center ${phaseColor}`}>
                                    <p className="text-xs font-semibold capitalize mb-1">{pi.phase}</p>
                                    <p className="text-xl font-bold">{pi.currentScore ?? '–'}</p>
                                    {pi.targetScore !== null && (
                                      <p className="text-xs opacity-70">&rarr; {pi.targetScore}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {report.keyInsights && report.keyInsights.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Key Insights</p>
                            <div className="space-y-3">
                              {report.keyInsights.map((insight, i) => (
                                <div key={i} className="rounded-lg border bg-card p-4">
                                  <div className="flex items-start gap-3">
                                    <BadgeCheck className={`h-4 w-4 mt-0.5 shrink-0 ${
                                      insight.confidence === 'high' ? 'text-emerald-500' :
                                      insight.confidence === 'medium' ? 'text-amber-500' : 'text-slate-400'
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold">{insight.title}</p>
                                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.insight}</p>
                                      {insight.evidence && insight.evidence.length > 0 && (
                                        <ul className="mt-2 space-y-1">
                                          {insight.evidence.map((e, j) => (
                                            <li key={j} className="text-xs text-muted-foreground/70 pl-3 border-l-2 border-muted italic">{e}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// DATA QUALITY BADGE
// ══════════════════════════════════════════════════════════

function DataQualityBadge({ source }: { source?: string }) {
  if (source === 'full_analysis') {
    return (
      <span
        title="High confidence — derived from full agentic analysis"
        className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
        High
      </span>
    );
  }
  if (source === 'interview_reports') {
    return (
      <span
        title="Medium confidence — derived from interview report summaries. Run full agentic analysis for deeper statistical confidence."
        className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
        Medium
      </span>
    );
  }
  return null;
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
  return <RadarChart data={data} series={series} size={380} max={10} />;
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
