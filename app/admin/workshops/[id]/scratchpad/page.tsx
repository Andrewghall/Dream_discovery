'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  FileDown,
  Download,
  Eye,
  Loader2,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Send,
  RefreshCw,
  Pencil,
  Plus,
  X,
  GripVertical,
  ImagePlus,
  Building2,
  Presentation,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { nanoid } from 'nanoid';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { WorkshopOutputIntelligence } from '@/lib/output-intelligence/types';
import type { ReportSummary, ReportSectionConfig, ReportLayout, ReportConclusion, ReportNextStep, FacilitatorContact } from '@/lib/output-intelligence/types';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';
import { defaultReportLayout } from '@/lib/output-intelligence/types';
import type { StoredOutputIntelligence } from '@/lib/output-intelligence/types';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import LiveJourneyMap from '@/components/cognitive-guidance/live-journey-map';
import { ReportPromptOutput } from '@/components/scratchpad/ReportPromptOutput';
import type { PromptOutput } from '@/components/scratchpad/ReportPromptOutput';
import { DraggableSection, DropIndicator } from '@/components/report-builder/DraggableSection';
import { SectionHeading } from './_components/ScratchpadEditors';
import {
  ExecutiveSummaryBlock,
  SupportingEvidenceBlock,
  RootCausesBlock,
  SolutionDirectionBlock,
  StrategicImpactBlock,
  WayForwardBlock,
} from './_components/IntelligenceBlocks';
import {
  DiscoveryDiagnosticBlock,
  DiscoverySignalsBlock,
  InsightSummaryBlock,
  AlignmentBlock,
  NarrativeDivergenceBlock,
  TensionsBlock,
  StructuralBarriersBlock,
  ReportConclusionBlock,
  JourneyDownloadBar,
  JourneyIntroBlock,
  CustomSectionEditor,
  AgenticPromptBar,
  GenerateSummaryCta,
  StructuralConfidenceBlock,
  SignalMapBlock,
  FacilitatorContactBlock,
} from './_components/DiscoveryBlocks';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Workshop {
  id: string;
  name: string;
  organization?: { name: string } | null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DownloadReportPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [intelligence, setIntelligence] = useState<WorkshopOutputIntelligence | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [liveJourneyData, setLiveJourneyData] = useState<LiveJourneyData | null>(null);
  const [journeyVersions, setJourneyVersions] = useState<Array<{ id: string; version: number; dialoguePhase: string; createdAt: string }>>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [journeyRegenerating, setJourneyRegenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [promptOutputs, setPromptOutputs] = useState<PromptOutput[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // ── Report builder layout ─────────────────────────────────────────
  const [layout, setLayout] = useState<ReportLayout>(defaultReportLayout());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overDragId, setOverDragId] = useState<string | null>(null);
  const [clientLogoUrl, setClientLogoUrl] = useState<string>('');
  const [uploadingClientLogo, setUploadingClientLogo] = useState(false);
  const clientLogoFileRef = useRef<HTMLInputElement>(null);
  // ── Cross-page section data ─────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [discoveryOutput, setDiscoveryOutput] = useState<any | null>(null);
  const [discoverAnalysis, setDiscoverAnalysis] = useState<DiscoverAnalysis | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetchData();
    // Pick up any V2 GPT blocks queued from the output page's "Add to report" buttons
    try {
      const pending = JSON.parse(sessionStorage.getItem('v2_pending_report_blocks') || '[]') as Array<{
        title: string;
        content: string;
        id: string;
      }>;
      if (pending.length > 0) {
        sessionStorage.removeItem('v2_pending_report_blocks');
        // We delay slightly so layout is initialised before we append
        setTimeout(() => {
          for (const block of pending) {
            addGptSection(block.title, block.content);
          }
        }, 800);
      }
    } catch { /* non-fatal */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [workshopRes, intelligenceRes, summaryRes] = await Promise.all([
        fetch(`/api/admin/workshops/${workshopId}`),
        fetch(`/api/admin/workshops/${workshopId}/output-intelligence`),
        fetch(`/api/admin/workshops/${workshopId}/report-summary`),
      ]);

      if (workshopRes.ok) {
        const d = await workshopRes.json();
        setWorkshop(d.workshop);
      }

      if (intelligenceRes.ok) {
        const d = await intelligenceRes.json();
        const stored = d.intelligence as StoredOutputIntelligence | null;
        if (stored?.intelligence) setIntelligence(stored.intelligence);
      }

      if (summaryRes.ok) {
        const d = await summaryRes.json();
        if (d.reportSummary) {
          const rs = d.reportSummary as ReportSummary;
          setReportSummary(rs);
          // Restore saved layout if it exists, merging in any new built-in sections
          // and applying updated default `enabled` values from defaultReportLayout()
          if (rs.layout?.sections?.length) {
            const stored   = rs.layout;
            const defaults = defaultReportLayout();
            const storedIds = new Set(stored.sections.map(s => s.id));

            // v2 introduced the correct chapter order (Discovery → Journey → Brain Scan).
            // Any stored layout older than v2 gets rebuilt from the new default order,
            // preserving only per-item exclusions and explicit user-disabled state.
            const needsRebuild = !stored.version || stored.version < 3;
            const hasCustom   = stored.sections.some(s => s.type === 'custom');

            let mergedSections;
            if (needsRebuild) {
              // Rebuild from default order, carry forward user exclusions and explicit disables
              const storedMap = new Map(stored.sections.map(s => [s.id, s]));
              mergedSections = defaults.sections.map(def => {
                const prev = storedMap.get(def.id);
                if (!prev) return def;
                return {
                  ...def,
                  excludedItems: prev.excludedItems ?? [],
                  enabled: def.enabled ? true : prev.enabled,
                };
              });
              if (hasCustom) {
                const customSections = stored.sections.filter(s => s.type === 'custom');
                mergedSections = [...mergedSections, ...customSections];
              }
            } else {
              // v2+ stored layout — preserve user's order, just add any brand-new sections
              const defaultMap = new Map(defaults.sections.map(s => [s.id, s]));
              const upgraded = stored.sections.map(s => {
                const def = defaultMap.get(s.id);
                if (!def) return s;
                if (def.enabled && !s.enabled) return { ...s, enabled: true };
                return s;
              });
              const newSections = defaults.sections.filter(s => !storedIds.has(s.id));
              mergedSections = newSections.length > 0 ? [...upgraded, ...newSections] : upgraded;
            }

            setLayout({ ...stored, version: 3, sections: mergedSections });
            if (stored.clientLogoUrl) setClientLogoUrl(stored.clientLogoUrl);
          }
        }
      }

      // Fetch discovery output if needed for cross-page sections (non-fatal)
      try {
        const scratchpadRes = await fetch(`/api/admin/workshops/${workshopId}/scratchpad`);
        if (scratchpadRes.ok) {
          const sd = await scratchpadRes.json();
          const dOut = sd.scratchpad?.discoveryOutput;
          if (dOut && Object.keys(dOut).length > 0) setDiscoveryOutput(dOut);
        }
      } catch { /* non-fatal */ }

      // Fetch structural analysis data (non-fatal)
      try {
        const analysisRes = await fetch(`/api/admin/workshops/${workshopId}/discover-analysis`);
        if (analysisRes.ok) {
          const ad = await analysisRes.json();
          if (ad.analysis) setDiscoverAnalysis(ad.analysis as DiscoverAnalysis);
        }
      } catch { /* non-fatal */ }

      // Fetch journey versions (non-fatal)
      try {
        const versionsRes = await fetch(
          `/api/admin/workshops/${workshopId}/live/session-versions?limit=20`
        );
        if (versionsRes.ok) {
          const vd = await versionsRes.json();
          const versions = vd.versions ?? [];
          setJourneyVersions(versions);
          const latestId = versions[0]?.id;
          if (latestId) {
            setSelectedVersionId(latestId);
            await loadJourneyVersion(latestId, workshopId);
          }
        }
      } catch {
        // Non-fatal
      }
    } catch (err) {
      console.error('Failed to fetch report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadJourneyVersion = async (versionId: string, wsId = workshopId) => {
    try {
      const versionRes = await fetch(
        `/api/admin/workshops/${wsId}/live/session-versions/${versionId}`
      );
      if (versionRes.ok) {
        const versionData = await versionRes.json();
        const lj = versionData.version?.payload?.liveJourney;
        if (lj?.stages?.length && lj?.interactions?.length) {
          setLiveJourneyData(lj as LiveJourneyData);
        }
      }
    } catch { /* non-fatal */ }
  };

  const handleRegenerateJourney = async () => {
    try {
      setJourneyRegenerating(true);
      const res = await fetch(`/api/admin/workshops/${workshopId}/journey/regenerate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Regeneration failed' }));
        toast.error(err.error || 'Journey regeneration failed');
        return;
      }
      const data = await res.json();
      if (data.liveJourney) {
        setLiveJourneyData(data.liveJourney as LiveJourneyData);
        toast.success('Journey map regenerated from full workshop data');
      }
    } catch {
      toast.error('Journey regeneration failed');
    } finally {
      setJourneyRegenerating(false);
    }
  };

  // ── Layout helpers ─────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const updateLayout = useCallback((updated: ReportLayout) => {
    setLayout(updated);
    // Save layout alongside reportSummary
    if (reportSummary) {
      const rs = { ...reportSummary, layout: updated };
      setReportSummary(rs);
      // Debounce handled by handleSummaryUpdate below — call directly
      void (async () => {
        try {
          await fetch(`/api/admin/workshops/${workshopId}/report-summary`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportSummary: rs }),
          });
        } catch { /* non-fatal */ }
      })();
    }
  }, [reportSummary, workshopId]);

  const updateSection = useCallback((id: string, patch: Partial<ReportSectionConfig>) => {
    setLayout(prev => {
      const next = { ...prev, sections: prev.sections.map(s => s.id === id ? { ...s, ...patch } : s) };
      updateLayout(next);
      return next;
    });
  }, [updateLayout]);

  const toggleItem = useCallback((sectionId: string, itemId: string) => {
    setLayout(prev => {
      const next = {
        ...prev,
        sections: prev.sections.map(s => {
          if (s.id !== sectionId) return s;
          const excluded = s.excludedItems.includes(itemId)
            ? s.excludedItems.filter(i => i !== itemId)
            : [...s.excludedItems, itemId];
          return { ...s, excludedItems: excluded };
        }),
      };
      updateLayout(next);
      return next;
    });
  }, [updateLayout]);

  const addCustomSection = useCallback(() => {
    const newSection: ReportSectionConfig = {
      id: `custom_${nanoid(8)}`,
      type: 'custom',
      title: 'New Section',
      enabled: true,
      collapsed: false,
      excludedItems: [],
      customContent: { text: '', imageUrl: '', imageAlt: '' },
    };
    setLayout(prev => {
      const next = { ...prev, sections: [...prev.sections, newSection] };
      updateLayout(next);
      return next;
    });
  }, [updateLayout]);

  // Add a GPT-generated block directly to the report layout with editable commentary
  const addGptSection = useCallback((title: string, content: string) => {
    const newSection: ReportSectionConfig = {
      id: `gpt_${nanoid(8)}`,
      type: 'custom',
      title,
      enabled: true,
      collapsed: false,
      excludedItems: [],
      customContent: { text: content, imageUrl: '', imageAlt: '', commentary: '' },
    };
    setLayout(prev => {
      const next = { ...prev, sections: [...prev.sections, newSection] };
      updateLayout(next);
      return next;
    });
    // Scroll to bottom so user sees the new block appear
    requestAnimationFrame(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
  }, [updateLayout]);

  const addChapterSection = useCallback(() => {
    const newSection: ReportSectionConfig = {
      id: `chapter_${nanoid(8)}`,
      type: 'chapter',
      title: 'New Chapter',
      enabled: true,
      collapsed: false,
      excludedItems: [],
    };
    setLayout(prev => {
      const next = { ...prev, sections: [...prev.sections, newSection] };
      updateLayout(next);
      return next;
    });
  }, [updateLayout]);

  const updateSectionTitle = useCallback((id: string, title: string) => {
    updateSection(id, { title });
  }, [updateSection]);

  const handleClientLogoUpload = useCallback(async (file: File) => {
    setUploadingClientLogo(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`/api/admin/workshops/${workshopId}/upload-section-image`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json() as { url: string };
      setClientLogoUrl(data.url);
      // Persist in layout
      updateLayout({ ...layout, clientLogoUrl: data.url });
    } catch {
      toast.error('Client logo upload failed');
    } finally {
      setUploadingClientLogo(false);
    }
  }, [workshopId, layout, updateLayout]);

  const removeSection = useCallback((id: string) => {
    setLayout(prev => {
      const next = { ...prev, sections: prev.sections.filter(s => s.id !== id) };
      updateLayout(next);
      return next;
    });
  }, [updateLayout]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };
  const handleDragOver = (event: DragOverEvent) => {
    setOverDragId(event.over ? String(event.over.id) : null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    setOverDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLayout(prev => {
      const oldIndex = prev.sections.findIndex(s => s.id === active.id);
      const newIndex = prev.sections.findIndex(s => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = { ...prev, sections: arrayMove(prev.sections, oldIndex, newIndex) };
      updateLayout(next);
      return next;
    });
  };

  // ── PDF export ──────────────────────────────────────────────────────────────

  const handleExportPdf = async () => {
    if (!intelligence || !reportSummary) {
      toast.error('Generate the report summary first before exporting PDF');
      return;
    }
    try {
      setExporting(true);
      const res = await fetch(`/api/admin/workshops/${workshopId}/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportSummary,
          intelligence,
          layout,
          liveJourneyData,
          workshopName: workshop?.name,
          orgName: workshop?.organization?.name,
          clientLogoUrl: clientLogoUrl || undefined,
          discoveryOutput: discoveryOutput || undefined,
          discoverAnalysis: discoverAnalysis || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' })) as { error: string };
        throw new Error(err.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workshop?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'workshop'}-discovery-report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PDF downloaded!');
    } catch (err) {
      toast.error(`PDF export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  // ── Preview report (open full HTML in new tab) ────────────────────────────────

  const handlePreviewReport = async () => {
    if (!intelligence || !reportSummary) {
      toast.error('Generate the report summary first before previewing');
      return;
    }
    try {
      setPreviewing(true);
      const res = await fetch(`/api/admin/workshops/${workshopId}/preview-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportSummary,
          intelligence,
          layout,
          liveJourneyData,
          workshopName: workshop?.name,
          orgName: workshop?.organization?.name,
          clientLogoUrl: clientLogoUrl || undefined,
          discoveryOutput: discoveryOutput || undefined,
          discoverAnalysis: discoverAnalysis || undefined,
        }),
      });
      if (!res.ok) throw new Error('Preview failed');
      const html = await res.text();
      // Show full-screen inline preview (no popup needed)
      setPreviewHtml(html);
    } catch (err) {
      toast.error(`Preview failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPreviewing(false);
    }
  };

  // Called whenever user edits any field — updates local state and debounce-saves to DB
  const handleSummaryUpdate = useCallback((updated: ReportSummary) => {
    setReportSummary(updated);
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/workshops/${workshopId}/report-summary`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportSummary: updated }),
        });
        if (!res.ok) throw new Error('Save failed');
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, 800);
  }, [workshopId]);

  // ── PowerPoint export ────────────────────────────────────────────────────────

  const handleExportPptx = async () => {
    if (!intelligence || !reportSummary) {
      toast.error('Generate the report summary first before exporting PowerPoint');
      return;
    }
    try {
      setExportingPptx(true);
      const res = await fetch(`/api/admin/workshops/${workshopId}/export-pptx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportSummary,
          intelligence,
          layout,
          liveJourneyData,
          workshopName: workshop?.name,
          orgName: workshop?.organization?.name,
          clientLogoUrl: clientLogoUrl || undefined,
          discoveryOutput: discoveryOutput || undefined,
          discoverAnalysis: discoverAnalysis || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' })) as { error: string };
        throw new Error(err.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workshop?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'workshop'}-discovery-report.pptx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PowerPoint downloaded!');
    } catch (err) {
      toast.error(`PowerPoint export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExportingPptx(false);
    }
  };

  // handleExport removed — replaced by handleExportPdf above

  // ── Loading ───────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ── Full-screen report preview overlay ────────────────────────────── */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col">
          <div className="flex items-center justify-between bg-slate-900 text-white px-5 py-2.5 shrink-0">
            <span className="text-sm font-semibold">Report Preview — {workshop?.name}</span>
            <button
              onClick={() => setPreviewHtml(null)}
              className="text-slate-300 hover:text-white text-sm px-3 py-1 rounded hover:bg-slate-700 transition-colors"
            >
              ✕ Close preview
            </button>
          </div>
          <iframe
            srcDoc={previewHtml}
            className="flex-1 w-full bg-white"
            title="Report Preview"
            sandbox="allow-same-origin"
          />
        </div>
      )}

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
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

          {/* ── Client Logo picker ─────────────────────────────────── */}
          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 bg-muted/20">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {clientLogoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={clientLogoUrl} alt="Client logo" className="h-6 max-w-[80px] object-contain rounded" />
                <button
                  onClick={() => { setClientLogoUrl(''); updateLayout({ ...layout, clientLogoUrl: undefined }); }}
                  className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors ml-1"
                  title="Remove client logo"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <button
                onClick={() => clientLogoFileRef.current?.click()}
                disabled={uploadingClientLogo}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {uploadingClientLogo ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
                ) : (
                  <>+ Client logo</>
                )}
              </button>
            )}
            <input
              ref={clientLogoFileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleClientLogoUpload(file);
                e.target.value = '';
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Save status indicator */}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                Save failed
              </span>
            )}
            {/* Quality indicator — admin only, never exported */}
            {reportSummary && !reportSummary.validationPassed && (reportSummary.validationGaps ?? []).length > 0 && (
              <button
                onClick={() => setReportSummary(null)}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                title={`Click to regenerate\n\n${(reportSummary.validationGaps ?? []).join('\n')}`}
              >
                <AlertTriangle className="h-3 w-3" />
                {(reportSummary.validationGaps ?? []).length} quality gap{(reportSummary.validationGaps ?? []).length > 1 ? 's' : ''} — click to regenerate
              </button>
            )}
            {reportSummary && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => void fetchData()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            )}
            <Button
              onClick={handlePreviewReport}
              disabled={previewing || !intelligence || !reportSummary}
              size="sm"
              variant="outline"
              className="gap-2"
              title="Preview the full report before generating PDF"
            >
              {previewing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {previewing ? 'Loading…' : 'Preview Report'}
            </Button>
            <Button
              onClick={handleExportPdf}
              disabled={exporting || !intelligence || !reportSummary}
              size="sm"
              className="gap-2"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              {exporting ? 'Generating PDF…' : 'Generate PDF'}
            </Button>
            <Button
              onClick={handleExportPptx}
              disabled={exportingPptx || !intelligence || !reportSummary}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              {exportingPptx ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Presentation className="h-3.5 w-3.5" />
              )}
              {exportingPptx ? 'Generating PPTX…' : 'Generate PPTX'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* ── AGENTIC PROMPT BAR — always at the top ────────────────────── */}
        {intelligence && (
          <>
            {promptOutputs.length > 0 && (
              <div className="space-y-4">
                <SectionHeading
                  label="Additional Analysis"
                  sublabel="Generated on demand — not saved to report"
                />
                {promptOutputs.map((output, i) => (
                  <ReportPromptOutput key={i} output={output} onAddToReport={addGptSection} />
                ))}
              </div>
            )}
            <AgenticPromptBar
              workshopId={workshopId}
              layout={layout}
              onOutput={(o) => setPromptOutputs((prev) => [...prev, o])}
            />
          </>
        )}

        {/* No intelligence yet */}
        {!intelligence && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Analysis not yet generated
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Run the 5-engine intelligence pipeline first to populate this report.
                </p>
              </div>
            </div>
            <Link href={`/admin/workshops/${workshopId}/hemisphere`}>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
              >
                Go to Insight Map →
              </Button>
            </Link>
          </div>
        )}

        {/* ── REPORT CONTENTS INDEX ────────────────────────────────────── */}
        {intelligence && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
              <div>
                <p className="text-sm font-semibold text-foreground">Report Contents</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {layout.sections.filter(s => s.enabled && s.type !== 'chapter').length} sections enabled · toggle to include/exclude from PDF
                </p>
              </div>
            </div>
            <div className="divide-y divide-border">
              {(() => {
                let sectionNum = 0;
                return layout.sections.map((s) => {
                  const isChapter = s.type === 'chapter';
                  if (!isChapter) sectionNum++;
                  const num = sectionNum;
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 px-5 py-2.5 ${isChapter ? 'bg-slate-900' : s.enabled ? '' : 'opacity-40'}`}
                    >
                      {isChapter ? (
                        <>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 w-5 shrink-0">—</span>
                          <span className="text-xs font-bold text-white flex-1">{s.title}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0 text-right">{String(num).padStart(2, '0')}</span>
                          <span className={`text-xs flex-1 ${s.enabled ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s.title}</span>
                          <button
                            onClick={() => updateSection(s.id, { enabled: !s.enabled })}
                            className={`shrink-0 w-8 h-4 rounded-full transition-colors relative ${s.enabled ? 'bg-indigo-500' : 'bg-border'}`}
                            title={s.enabled ? 'Remove from report' : 'Add to report'}
                          >
                            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${s.enabled ? 'left-4' : 'left-0.5'}`} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ── REPORT BUILDER — DnD sortable sections ──────────────────── */}
        {intelligence && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={layout.sections.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {layout.sections.map((cfg) => {
                  const isOver = overDragId === cfg.id && activeDragId !== cfg.id;
                  return (
                    <div key={cfg.id}>
                      <DropIndicator isOver={isOver} />
                      <DraggableSection
                        config={cfg}
                        onToggleEnabled={() => updateSection(cfg.id, { enabled: !cfg.enabled })}
                        onToggleCollapsed={() => updateSection(cfg.id, { collapsed: !cfg.collapsed })}
                        onRemove={(cfg.type === 'custom' || cfg.type === 'chapter') ? () => removeSection(cfg.id) : undefined}
                        onTitleChange={cfg.type === 'chapter' ? (title) => updateSectionTitle(cfg.id, title) : undefined}
                      >
                        {/* ── Executive Summary ── */}
                        {cfg.id === 'executive_summary' && (
                          <div className="p-1">
                            {reportSummary ? (
                              <ExecutiveSummaryBlock
                                summary={reportSummary}
                                onUpdate={handleSummaryUpdate}
                                excludedItems={cfg.excludedItems}
                                onToggleItem={(id) => toggleItem(cfg.id, id)}
                              />
                            ) : (
                              <div className="p-3">
                                <GenerateSummaryCta
                                  workshopId={workshopId}
                                  onComplete={(s) => setReportSummary(s)}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Supporting Evidence ── */}
                        {cfg.id === 'supporting_evidence' && (
                          <div className="p-4">
                            <SupportingEvidenceBlock
                              intelligence={intelligence}
                              excludedItems={cfg.excludedItems}
                              onToggleItem={(id) => toggleItem(cfg.id, id)}
                            />
                          </div>
                        )}

                        {/* ── Root Causes ── */}
                        {cfg.id === 'root_causes' && (
                          <div className="p-4">
                            <RootCausesBlock
                              intelligence={intelligence}
                              excludedItems={cfg.excludedItems}
                              onToggleItem={(id) => toggleItem(cfg.id, id)}
                            />
                          </div>
                        )}

                        {/* ── Solution Direction ── */}
                        {cfg.id === 'solution_direction' && (
                          <div className="p-4">
                            {reportSummary ? (
                              <>
                                <SolutionDirectionBlock
                                  summary={reportSummary}
                                  intelligence={intelligence}
                                  onUpdate={handleSummaryUpdate}
                                  excludedItems={cfg.excludedItems}
                                  onToggleItem={(id) => toggleItem(cfg.id, id)}
                                />
                                <div className="mt-3 flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-muted-foreground gap-1.5 h-7"
                                    onClick={() => setReportSummary(null)}
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                    Regenerate summary
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground py-2">
                                Generate the executive summary first to populate this section.
                              </p>
                            )}
                          </div>
                        )}

                        {/* ── Customer Journey ── */}
                        {cfg.id === 'journey_map' && (
                          <div className="p-4">
                            {liveJourneyData ? (
                              <>
                                {/* Journey controls row */}
                                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                                  {journeyVersions.length > 1 && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <span className="text-[10px] uppercase tracking-wide font-medium">Session:</span>
                                      <select
                                        value={selectedVersionId ?? ''}
                                        onChange={async (e) => {
                                          const id = e.target.value;
                                          setSelectedVersionId(id);
                                          await loadJourneyVersion(id);
                                        }}
                                        className="text-xs border border-border rounded px-1.5 py-0.5 bg-background text-foreground"
                                      >
                                        {journeyVersions.map((v, i) => (
                                          <option key={v.id} value={v.id}>
                                            v{v.version} — {v.dialoguePhase}{i === 0 ? ' (latest)' : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  <button
                                    onClick={handleRegenerateJourney}
                                    disabled={journeyRegenerating}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ml-auto"
                                  >
                                    {journeyRegenerating
                                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating…</>
                                      : <><RefreshCw className="h-3 w-3" /> Regenerate from full data</>
                                    }
                                  </button>
                                </div>
                                <JourneyIntroBlock
                                  workshopId={workshopId}
                                  journey={liveJourneyData}
                                  value={reportSummary?.journeyIntro ?? ''}
                                  onChange={(v) => {
                                    if (reportSummary) handleSummaryUpdate({ ...reportSummary, journeyIntro: v });
                                  }}
                                  disabled={!reportSummary}
                                />
                                <JourneyDownloadBar workshopId={workshopId} />
                                <LiveJourneyMap data={liveJourneyData} mode="output" />
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground py-2">
                                No journey map generated yet. Run a live session to generate one.
                              </p>
                            )}
                          </div>
                        )}

                        {/* ── Strategic Impact ── */}
                        {cfg.id === 'strategic_impact' && (
                          <div className="p-4">
                            <StrategicImpactBlock
                              intelligence={intelligence}
                              excludedItems={cfg.excludedItems}
                              onToggleItem={(id) => toggleItem(cfg.id, id)}
                            />
                          </div>
                        )}

                        {/* ── Way Forward ── */}
                        {cfg.id === 'way_forward' && (
                          <div className="p-4">
                            <WayForwardBlock intelligence={intelligence} />
                          </div>
                        )}

                        {/* ── Discovery Diagnostic ── */}
                        {cfg.id === 'discovery_diagnostic' && (
                          <div className="p-4">
                            <DiscoveryDiagnosticBlock
                              discoveryOutput={discoveryOutput}
                              excludedItems={cfg.excludedItems}
                              onToggleItem={(id) => toggleItem(cfg.id, id)}
                            />
                          </div>
                        )}

                        {/* ── Discovery Signals ── */}
                        {cfg.id === 'discovery_signals' && (
                          <div className="p-4">
                            <DiscoverySignalsBlock
                              discoveryOutput={discoveryOutput}
                              excludedItems={cfg.excludedItems}
                              onToggleItem={(id) => toggleItem(cfg.id, id)}
                            />
                          </div>
                        )}

                        {/* ── Structural: Domain Misalignment ── */}
                        {cfg.id === 'structural_alignment' && (
                          <div className="p-4">
                            <AlignmentBlock discoverAnalysis={discoverAnalysis} />
                          </div>
                        )}

                        {/* ── Structural: Narrative Divergence ── */}
                        {cfg.id === 'structural_narrative' && (
                          <div className="p-4">
                            <NarrativeDivergenceBlock discoverAnalysis={discoverAnalysis} />
                          </div>
                        )}

                        {/* ── Structural: Transformation Tensions ── */}
                        {cfg.id === 'structural_tensions' && (
                          <div className="p-4">
                            <TensionsBlock discoverAnalysis={discoverAnalysis} />
                          </div>
                        )}

                        {/* ── Structural: Structural Barriers ── */}
                        {cfg.id === 'structural_barriers' && (
                          <div className="p-4">
                            <StructuralBarriersBlock discoverAnalysis={discoverAnalysis} />
                          </div>
                        )}

                        {/* ── Structural: Transformation Readiness ── */}
                        {cfg.id === 'structural_confidence' && (
                          <div className="p-4">
                            {discoverAnalysis ? (
                              <StructuralConfidenceBlock data={discoverAnalysis} />
                            ) : (
                              <p className="text-sm text-muted-foreground">Enable Structural Analysis on the Discovery Output page first.</p>
                            )}
                          </div>
                        )}

                        {/* ── Discovery Signal Map ── */}
                        {cfg.id === 'discovery_signal_map' && (
                          <div className="p-4">
                            <SignalMapBlock
                              imageUrl={reportSummary?.signalMapImageUrl ?? null}
                              workshopId={workshopId}
                              onImageCaptured={(url) => {
                                if (reportSummary) handleSummaryUpdate({ ...reportSummary, signalMapImageUrl: url });
                              }}
                            />
                          </div>
                        )}

                        {/* ── Facilitator Contact ── */}
                        {cfg.id === 'facilitator_contact' && (
                          <div className="p-4">
                            <FacilitatorContactBlock
                              contact={reportSummary?.facilitatorContact ?? null}
                              onChange={(contact) => {
                                if (reportSummary) handleSummaryUpdate({ ...reportSummary, facilitatorContact: contact });
                              }}
                            />
                          </div>
                        )}

                        {/* ── Connected Model ── */}
                        {cfg.id === 'connected_model' && intelligence?.causalIntelligence && (() => {
                          const findings = [
                            ...(intelligence.causalIntelligence.organisationalIssues ?? []),
                            ...(intelligence.causalIntelligence.reinforcedFindings   ?? []),
                            ...(intelligence.causalIntelligence.emergingPatterns     ?? []),
                          ];
                          if (!findings.length) return null;
                          return (
                            <div className="p-3 space-y-1">
                              <p className="text-[10px] text-slate-400 px-1 mb-2">Toggle findings to include or exclude from the report</p>
                              {findings.map(f => {
                                const excluded = cfg.excludedItems.includes(f.findingId);
                                return (
                                  <button
                                    key={f.findingId}
                                    onClick={() => toggleItem(cfg.id, f.findingId)}
                                    className={`w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-lg border text-xs transition-all ${
                                      excluded
                                        ? 'border-slate-100 bg-slate-50 text-slate-300 line-through'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                    }`}
                                  >
                                    <span className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center ${excluded ? 'border-slate-200 bg-white' : 'border-indigo-400 bg-indigo-50'}`}>
                                      {!excluded && <span className="w-1.5 h-1.5 rounded-sm bg-indigo-500" />}
                                    </span>
                                    <span className="leading-snug">{f.issueTitle}</span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* ── Insight Map Summary ── */}
                        {cfg.id === 'insight_summary' && (
                          <div className="p-4">
                            <InsightSummaryBlock intelligence={intelligence} />
                          </div>
                        )}

                        {/* ── Report Conclusion ── */}
                        {cfg.id === 'report_conclusion' && (
                          <ReportConclusionBlock
                            workshopId={workshopId}
                            conclusion={reportSummary?.reportConclusion}
                            onUpdate={(c) => {
                              if (reportSummary) handleSummaryUpdate({ ...reportSummary, reportConclusion: c });
                            }}
                          />
                        )}

                        {/* ── Chapter sections have no body ── */}
                        {cfg.type === 'chapter' && null}

                        {/* ── Custom Section ── */}
                        {cfg.type === 'custom' && (
                          <CustomSectionEditor
                            section={cfg}
                            workshopId={workshopId}
                            onUpdate={(patch) => updateSection(cfg.id, patch)}
                          />
                        )}
                      </DraggableSection>
                    </div>
                  );
                })}
              </div>
            </SortableContext>

            {/* ── Add section controls ── */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={addChapterSection}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary/30 text-sm text-primary/60 hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add chapter header
              </button>
              <button
                onClick={addCustomSection}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add custom section
              </button>
            </div>

            {/* DragOverlay — ghost card during drag */}
            <DragOverlay>
              {activeDragId && (() => {
                const cfg = layout.sections.find(s => s.id === activeDragId);
                if (!cfg) return null;
                return (
                  <DraggableSection
                    config={cfg}
                    onToggleEnabled={() => {}}
                    onToggleCollapsed={() => {}}
                    isDragOverlay
                  >
                    <div className="h-10 rounded bg-muted/30 mx-4 mb-3" />
                  </DraggableSection>
                );
              })()}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
