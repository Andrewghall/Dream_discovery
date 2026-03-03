'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Play,
  Loader2,
  AlertCircle,
  Layers,
  FileSearch,
  GitCompareArrows,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { SynthesisProgress } from '@/components/field-discovery/synthesis-progress';
import { FindingsExplorer } from '@/components/field-discovery/findings-explorer';
import type { FindingItem } from '@/components/field-discovery/findings-explorer';
import { StreamComparison } from '@/components/field-discovery/stream-comparison';
import type { StreamComparisonData } from '@/components/field-discovery/stream-comparison';
import { AlignmentHeatmap } from '@/components/discover-analysis/alignment-heatmap';
import { TensionSurface } from '@/components/discover-analysis/tension-surface';
import { ConstraintMap } from '@/components/discover-analysis/constraint-map';
import { ConfidenceIndex } from '@/components/discover-analysis/confidence-index';
import { GptInquiryBar } from '@/components/discover-analysis/gpt-inquiry-bar';
import { buildAnalysisFromFindings } from '@/lib/field-discovery/findings-to-analysis-adapter';
import type { FindingRecord } from '@/lib/field-discovery/findings-to-analysis-adapter';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SynthesisData {
  sessionsProcessed: number;
  totalSessions: number;
  roleCoverage: Record<string, number>;
  emergingThemes: Array<{
    label: string;
    findingCount: number;
    avgSeverity: number;
  }>;
}

// ---------------------------------------------------------------------------
// Empty state placeholder
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <AlertCircle className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DiagnosticDashboardPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  // Data state
  const [synthesis, setSynthesis] = useState<SynthesisData | null>(null);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [streamComparison, setStreamComparison] = useState<StreamComparisonData | null>(null);
  const [analysis, setAnalysis] = useState<DiscoverAnalysis | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningSynthesis, setRunningSynthesis] = useState(false);

  // ---- Build adapted analysis when findings change ----

  const rebuildAnalysis = useCallback(
    (items: FindingItem[]) => {
      if (items.length > 0) {
        const adapted = buildAnalysisFromFindings(
          workshopId,
          items as unknown as FindingRecord[]
        );
        setAnalysis(adapted);
      } else {
        setAnalysis(null);
      }
    },
    [workshopId]
  );

  // ---- Fetch functions ----

  const fetchSynthesis = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/diagnostic-synthesis`
      );
      if (!res.ok) {
        // 404 is acceptable - just means no synthesis data yet
        if (res.status === 404) {
          setSynthesis(null);
          return;
        }
        throw new Error('Failed to load synthesis data');
      }
      const data = await res.json();
      setSynthesis(data);
    } catch (err) {
      console.error('Error fetching synthesis:', err);
      // Non-blocking - synthesis may not exist yet
      setSynthesis(null);
    }
  }, [workshopId]);

  const fetchFindings = useCallback(async (): Promise<FindingItem[]> => {
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/findings`
      );
      if (!res.ok) throw new Error('Failed to load findings');
      const data = await res.json();
      const items: FindingItem[] = data.findings ?? [];
      setFindings(items);
      return items;
    } catch (err) {
      console.error('Error fetching findings:', err);
      setFindings([]);
      return [];
    }
  }, [workshopId]);

  const fetchStreamComparison = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/diagnostic-synthesis/stream-comparison`
      );
      if (!res.ok) {
        if (res.status === 404) {
          setStreamComparison(null);
          return;
        }
        throw new Error('Failed to load stream comparison');
      }
      const data = await res.json();
      setStreamComparison(data);
    } catch (err) {
      console.error('Error fetching stream comparison:', err);
      setStreamComparison(null);
    }
  }, [workshopId]);

  // ---- Initial load ----

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [, loadedFindings] = await Promise.all([
          fetchSynthesis(),
          fetchFindings(),
          fetchStreamComparison(),
        ]);
        if (!cancelled && loadedFindings) {
          rebuildAnalysis(loadedFindings);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load diagnostic data. Please try again.');
        }
      }
      if (!cancelled) setLoading(false);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [fetchSynthesis, fetchFindings, fetchStreamComparison, rebuildAnalysis]);

  // ---- Run synthesis ----

  const handleRunSynthesis = useCallback(async () => {
    setRunningSynthesis(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/diagnostic-synthesis`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body.error ?? 'Synthesis failed');
      }

      // Refresh all data after synthesis completes
      const [, newFindings] = await Promise.all([
        fetchSynthesis(),
        fetchFindings(),
        fetchStreamComparison(),
      ]);

      // Rebuild adapted analysis with fresh findings
      if (newFindings && newFindings.length > 0) {
        rebuildAnalysis(newFindings);
      }
    } catch (err) {
      console.error('Synthesis error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to run synthesis.'
      );
    } finally {
      setRunningSynthesis(false);
    }
  }, [workshopId, fetchSynthesis, fetchFindings, fetchStreamComparison, rebuildAnalysis]);

  // ---- Refresh findings ----

  const handleRefreshFindings = useCallback(async () => {
    const refreshed = await fetchFindings();
    rebuildAnalysis(refreshed);
  }, [fetchFindings, rebuildAnalysis]);

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href={`/admin/workshops/${workshopId}/discovery/field`}>
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">
              Diagnostic Dashboard
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">
            Cross-session synthesis, stream comparison, and findings exploration.
          </p>
        </div>

        <Button
          onClick={handleRunSynthesis}
          disabled={runningSynthesis}
          size="sm"
        >
          {runningSynthesis ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {runningSynthesis ? 'Running...' : 'Run Synthesis'}
        </Button>
      </div>

      {/* GPT Inquiry Bar */}
      <GptInquiryBar
        workshopId={workshopId}
        hasAnalysis={!!analysis}
        analysis={analysis}
      />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="constraints">
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            Constraints
          </TabsTrigger>
          <TabsTrigger value="per-lens">
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Per-Lens Analysis
          </TabsTrigger>
          <TabsTrigger value="findings">
            <FileSearch className="h-3.5 w-3.5 mr-1.5" />
            Findings
          </TabsTrigger>
          <TabsTrigger value="stream-comparison">
            <GitCompareArrows className="h-3.5 w-3.5 mr-1.5" />
            Stream Comparison
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          {analysis ? (
            <>
              <AlignmentHeatmap data={analysis.alignment} />
              <TensionSurface data={analysis.tensions} />
            </>
          ) : (
            <EmptyState message="Run synthesis to generate analysis overview" />
          )}
        </TabsContent>

        <TabsContent value="constraints" className="mt-4 space-y-6">
          {analysis ? (
            <>
              <ConstraintMap data={analysis.constraints} />
              <ConfidenceIndex data={analysis.confidence} />
            </>
          ) : (
            <EmptyState message="Run synthesis to generate constraint analysis" />
          )}
        </TabsContent>

        <TabsContent value="per-lens" className="mt-4">
          <SynthesisProgress
            sessionsProcessed={synthesis?.sessionsProcessed ?? 0}
            totalSessions={synthesis?.totalSessions ?? 0}
            roleCoverage={synthesis?.roleCoverage ?? {}}
            emergingThemes={synthesis?.emergingThemes ?? []}
          />
        </TabsContent>

        <TabsContent value="findings" className="mt-4">
          <FindingsExplorer
            workshopId={workshopId}
            findings={findings}
            onRefresh={handleRefreshFindings}
          />
        </TabsContent>

        <TabsContent value="stream-comparison" className="mt-4">
          <StreamComparison data={streamComparison} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
