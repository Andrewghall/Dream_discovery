'use client';

import { use, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { SECTION_REGISTRY } from '@/lib/output/section-registry';
import type { WorkshopOutputIntelligence } from '@/lib/output-intelligence/types';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import { DiscoveryValidationPanel } from '@/components/output-intelligence/DiscoveryValidationPanel';
import { RootCausePanel } from '@/components/output-intelligence/RootCausePanel';
import { FutureStatePanel } from '@/components/output-intelligence/FutureStatePanel';
import { ExecutionRoadmapPanel } from '@/components/output-intelligence/ExecutionRoadmapPanel';
import { StrategicImpactPanel } from '@/components/output-intelligence/StrategicImpactPanel';
import LiveJourneyMap from '@/components/cognitive-guidance/live-journey-map';
import { DiscoveryOutputTab } from '@/components/scratchpad/DiscoveryOutputTab';
import { HemisphereOutputTab } from '@/components/scratchpad/HemisphereOutputTab';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Workshop {
  id: string;
  name: string;
  description?: string | null;
  organization?: {
    id: string;
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
  } | null;
}

// ── Stat card for Executive Summary ────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5 text-center">
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
    </div>
  );
}

// ── Journey download bar ────────────────────────────────────────────────────

function JourneyDownloadBar({ workshopId }: { workshopId: string }) {
  const [downloading, setDownloading] = useState<'pdf' | 'png' | null>(null);

  const download = async (format: 'pdf' | 'png') => {
    setDownloading(format);
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/export-journey?format=${format}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `journey-map.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      // Surface error via toast if sonner is available, else log
      console.error('Journey export failed:', err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 px-4 pb-3 pt-1">
      <span className="text-xs text-muted-foreground mr-1">Download:</span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => download('pdf')}
        disabled={!!downloading}
      >
        {downloading === 'pdf' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Download className="h-3 w-3" />
        )}
        PDF (Landscape)
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => download('png')}
        disabled={!!downloading}
      >
        {downloading === 'png' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Download className="h-3 w-3" />
        )}
        PNG
      </Button>
    </div>
  );
}

// ── Panel renderer ──────────────────────────────────────────────────────────

function renderPanel(
  sectionId: string,
  intelligence: WorkshopOutputIntelligence,
  liveJourneyData: LiveJourneyData | null,
  workshopId: string,
  discoveryOutputData: any,
): React.ReactNode {
  switch (sectionId) {
    case 'exec-summary':
      return (
        <div className="space-y-6 p-6 max-w-4xl mx-auto">
          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Hypothesis Accuracy"
              value={`${intelligence.discoveryValidation.hypothesisAccuracy}%`}
            />
            <StatCard
              label="Automation Potential"
              value={`${intelligence.strategicImpact.automationPotential.percentage}%`}
            />
            <StatCard
              label="Confidence Score"
              value={`${intelligence.strategicImpact.confidenceScore}%`}
            />
          </div>

          {/* Business case narrative */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-base font-semibold text-foreground">Business Case</h2>
            <p className="text-base leading-relaxed text-foreground">
              {intelligence.strategicImpact.businessCaseSummary}
            </p>
          </div>

          {/* Discovery summary */}
          <div className="rounded-xl border border-border bg-muted/20 p-6">
            <h3 className="text-sm font-semibold text-foreground mb-2">Discovery Summary</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {intelligence.discoveryValidation.summary}
            </p>
          </div>
        </div>
      );

    case 'discovery':
      return <DiscoveryValidationPanel data={intelligence.discoveryValidation} />;

    case 'reimagine':
      return <FutureStatePanel data={intelligence.futureState} />;

    case 'constraints':
      return <RootCausePanel data={intelligence.rootCause} />;

    case 'solution':
      return <ExecutionRoadmapPanel data={intelligence.roadmap} />;

    case 'customer-journey':
      if (!liveJourneyData) {
        return (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center p-6">
            <p className="text-sm text-muted-foreground">
              No journey map data available. Complete a live session to generate the journey map.
            </p>
            <Link href={`/admin/workshops/${workshopId}/cognitive-guidance`}>
              <Button variant="outline" size="sm">
                Go to Live Session
              </Button>
            </Link>
          </div>
        );
      }
      return (
        <div>
          <JourneyDownloadBar workshopId={workshopId} />
          <LiveJourneyMap data={liveJourneyData} mode="output" />
        </div>
      );

    case 'summary':
      return <StrategicImpactPanel data={intelligence.strategicImpact} />;

    case 'output-analysis':
      return (
        <div className="space-y-6">
          {/* Live hemisphere / brain map */}
          <HemisphereOutputTab workshopId={workshopId} />
          {/* Domain-level discovery analysis (from synthesis) */}
          {discoveryOutputData && Object.keys(discoveryOutputData).length > 0 && (
            <DiscoveryOutputTab data={discoveryOutputData} />
          )}
        </div>
      );

    default:
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Section not found: {sectionId}
        </div>
      );
  }
}

// ── Page component ──────────────────────────────────────────────────────────

export default function DownloadReportPage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [intelligence, setIntelligence] = useState<WorkshopOutputIntelligence | null>(null);
  const [liveJourneyData, setLiveJourneyData] = useState<LiveJourneyData | null>(null);
  const [discoveryOutputData, setDiscoveryOutputData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('exec-summary');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Parallel: workshop details + intelligence + scratchpad (non-fatal)
      const [workshopRes, intelligenceRes, scratchpadRes] = await Promise.all([
        fetch(`/api/admin/workshops/${workshopId}`),
        fetch(`/api/admin/workshops/${workshopId}/output-intelligence`),
        fetch(`/api/admin/workshops/${workshopId}/scratchpad`),
      ]);

      if (workshopRes.ok) {
        const workshopData = await workshopRes.json();
        setWorkshop(workshopData.workshop);
      }

      if (intelligenceRes.ok) {
        const intelligenceData = await intelligenceRes.json();
        // API returns { intelligence: StoredOutputIntelligence | null }
        const stored = intelligenceData.intelligence;
        if (stored?.intelligence) {
          setIntelligence(stored.intelligence);
        }
      }

      // Scratchpad discoveryOutput — used for Output Analysis tab (non-fatal)
      if (scratchpadRes.ok) {
        const scratchpadData = await scratchpadRes.json();
        const discoveryOutput = scratchpadData.scratchpad?.discoveryOutput;
        if (discoveryOutput && Object.keys(discoveryOutput).length > 0) {
          setDiscoveryOutputData(discoveryOutput);
        }
      }

      // Sequential: fetch live session versions for journey map
      try {
        const versionsRes = await fetch(
          `/api/admin/workshops/${workshopId}/live/session-versions?limit=1`
        );
        if (versionsRes.ok) {
          const versionsData = await versionsRes.json();
          const latestVersion = versionsData.versions?.[0];
          if (latestVersion?.id) {
            const versionRes = await fetch(
              `/api/admin/workshops/${workshopId}/live/session-versions/${latestVersion.id}`
            );
            if (versionRes.ok) {
              const versionData = await versionRes.json();
              const liveJourney = versionData.version?.payload?.liveJourney;
              if (liveJourney?.stages?.length && liveJourney?.interactions?.length) {
                setLiveJourneyData(liveJourney as LiveJourneyData);
              }
            }
          }
        }
      } catch {
        // Non-fatal — journey map will show empty state
      }
    } catch (error) {
      console.error('Failed to fetch report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await fetch(`/api/admin/workshops/${workshopId}/export-html`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(errorData.error || 'Failed to export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        `${workshop?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'workshop'}-report.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Report exported! Upload the ZIP contents to your client's domain.");
    } catch (error) {
      console.error('Failed to export HTML:', error);
      toast.error(
        `Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setExporting(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading report…</p>
        </div>
      </div>
    );
  }

  // ── Sections — 7 core + Output Analysis (always shown) ─────────────────

  const coreSections = [...SECTION_REGISTRY].sort((a, b) => a.priority - b.priority);

  // Insert "Output Analysis" after exec-summary (between priority 0 and 10)
  const OUTPUT_ANALYSIS = { id: 'output-analysis', title: 'Output Analysis' };
  const execIdx = coreSections.findIndex((s) => s.id === 'exec-summary');
  const sections = [
    ...coreSections.slice(0, execIdx + 1),
    OUTPUT_ANALYSIS,
    ...coreSections.slice(execIdx + 1),
  ];

  const colCount = sections.length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href={`/admin/workshops/${workshopId}`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">
                Download Report
              </h1>
              {workshop && (
                <p className="text-xs text-muted-foreground leading-tight">
                  {workshop.name}
                  {workshop.organization?.name ? ` — ${workshop.organization.name}` : ''}
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={exporting || !intelligence}
            size="sm"
            className="gap-2"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exporting ? 'Exporting…' : 'Export HTML'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto px-4 py-6">
        {!intelligence ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="rounded-full bg-muted p-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No report generated yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Run synthesis on the Insight Map to generate intelligence for this report.
              </p>
            </div>
            <Link href={`/admin/workshops/${workshopId}/hemisphere`}>
              <Button variant="outline" size="sm">
                Go to Insight Map → Synthesise
              </Button>
            </Link>
          </div>
        ) : (
          /* ── Intelligence tabs ── */
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList
              className="grid w-full mb-6"
              style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
            >
              {sections.map((section) => (
                <TabsTrigger key={section.id} value={section.id} className="text-xs">
                  {section.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {sections.map((section) => (
              <TabsContent key={section.id} value={section.id}>
                {renderPanel(section.id, intelligence, liveJourneyData, workshopId, discoveryOutputData)}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
