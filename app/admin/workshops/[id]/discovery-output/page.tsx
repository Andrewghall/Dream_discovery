'use client';

import { use, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader2, BarChart2, RefreshCw, Info, Brain, TrendingUp, Eye, Zap, Search, X } from 'lucide-react';
import { ReportSectionToggle } from '@/components/report-builder/ReportSectionToggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DiscoveryOutputTab } from '@/components/scratchpad/DiscoveryOutputTab';
import { AlignmentHeatmap } from '@/components/discover-analysis/alignment-heatmap';
import { TensionSurface } from '@/components/discover-analysis/tension-surface';
import { ConstraintMap } from '@/components/discover-analysis/constraint-map';
import { ConfidenceIndex } from '@/components/discover-analysis/confidence-index';
import { NarrativeDivergence } from '@/components/discover-analysis/narrative-divergence';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';
import { DashboardHemisphereCanvas, type DashboardHemisphereNode, type DashboardHemisphereEdge } from '@/components/hemisphere/dashboard-hemisphere-canvas';

interface PageProps {
  params: Promise<{ id: string }>;
}

// ── Going In Brain signal config ─────────────────────────────

const GOING_IN_SIGNALS = [
  {
    key: 'perception',
    label: 'PERCEPTION',
    description: 'How the organisation sees itself',
    color: 'indigo',
    Icon: Eye,
    derive: (sections: any[]) =>
      sections.length > 0
        ? Math.round(sections.reduce((s: number, x: any) => s + (x.consensusLevel || 0), 0) / sections.length)
        : 0,
    detail: (sections: any[], output: any) => output?._aiSummary || null,
    empty: null,
  },
  {
    key: 'inhibition',
    label: 'INHIBITION',
    description: 'Forces preventing transformation',
    color: 'rose',
    Icon: TrendingUp,
    derive: (sections: any[]) =>
      sections.length > 0
        ? Math.round(sections.reduce((s: number, x: any) => s + (x.sentiment?.concerned || 0), 0) / sections.length)
        : 0,
    detail: (sections: any[]) => {
      const highFriction = sections.filter((s: any) => (s.sentiment?.concerned || 0) > 30);
      return highFriction.length > 0
        ? `Friction signals detected in ${highFriction.length} domain${highFriction.length > 1 ? 's' : ''}: ${highFriction.map((s: any) => s.domain).join(', ')}.`
        : null;
    },
    empty: null,
  },
  {
    key: 'imagination',
    label: 'IMAGINATION',
    description: 'What future is believed possible',
    color: 'violet',
    Icon: Brain,
    derive: (sections: any[]) =>
      sections.length > 0
        ? Math.round(sections.reduce((s: number, x: any) => s + (x.sentiment?.optimistic || 0), 0) / sections.length)
        : 0,
    detail: (sections: any[]) => {
      const optimistic = sections.filter((s: any) => (s.sentiment?.optimistic || 0) > 30);
      return optimistic.length > 0
        ? `Imagination signals in ${optimistic.length} domain${optimistic.length > 1 ? 's' : ''}: ${optimistic.map((s: any) => s.domain).join(', ')}.`
        : null;
    },
    empty: null,
  },
  {
    key: 'vision',
    label: 'VISION',
    description: 'Ideal future self and its value',
    color: 'emerald',
    Icon: Zap,
    derive: () => 0,
    detail: () => null,
    empty: 'Insufficient signal — workshop not yet run',
  },
  {
    key: 'execution',
    label: 'EXECUTION',
    description: 'How transformation happens',
    color: 'amber',
    Icon: Zap,
    derive: () => 0,
    detail: () => null,
    empty: 'Insufficient signal — workshop not yet run',
  },
] as const;

const COLOR_CLASSES: Record<string, { card: string; label: string; bar: string; icon: string; ring: string }> = {
  indigo: { card: 'border-indigo-100', label: 'text-indigo-600', bar: 'bg-indigo-500', icon: 'text-indigo-400', ring: 'ring-indigo-200' },
  rose:   { card: 'border-rose-100',   label: 'text-rose-600',   bar: 'bg-rose-500',   icon: 'text-rose-400',   ring: 'ring-rose-200'   },
  violet: { card: 'border-violet-100', label: 'text-violet-600', bar: 'bg-violet-500', icon: 'text-violet-400', ring: 'ring-violet-200' },
  emerald:{ card: 'border-emerald-100',label: 'text-emerald-600',bar: 'bg-emerald-400',icon: 'text-emerald-400',ring: 'ring-emerald-200'},
  amber:  { card: 'border-amber-100',  label: 'text-amber-600',  bar: 'bg-amber-400',  icon: 'text-amber-400',  ring: 'ring-amber-200'  },
};

// ── Discovery globe node synthesis ───────────────────────────
// Builds hemisphere nodes from discovery data without a new API call.

function buildDiscoveryGlobe(
  discoverAnalysis: DiscoverAnalysis | null,
  discoveryOutput: any,
  conversationReports: any[],
): { nodes: DashboardHemisphereNode[]; edges: DashboardHemisphereEdge[]; balanceLabel: string } {
  const nodes: DashboardHemisphereNode[] = [];
  const edges: DashboardHemisphereEdge[] = [];

  // ── 1. Constraints → CONSTRAINT / FRICTION nodes ─────────────
  if (discoverAnalysis?.constraints?.constraints) {
    for (const c of discoverAnalysis.constraints.constraints) {
      nodes.push({
        id: `constraint:${c.id}`,
        type: c.severity === 'critical' ? 'CONSTRAINT' : 'FRICTION',
        label: c.description.split(' ').slice(0, 5).join(' '),
        weight: c.weight,
        phaseTags: [c.domain.toLowerCase().replace(/\s+/g, '_')],
      });
    }
    // Constraint relationships → edges
    for (const rel of discoverAnalysis.constraints.relationships ?? []) {
      edges.push({
        id: `edge:${rel.source}:${rel.target}`,
        source: `constraint:${rel.source}`,
        target: `constraint:${rel.target}`,
        strength: rel.type === 'blocks' ? 0.8 : 0.4,
      });
    }
  }

  // ── 2. Tensions → CHALLENGE nodes ────────────────────────────
  if (discoverAnalysis?.tensions?.tensions) {
    for (const t of discoverAnalysis.tensions.tensions) {
      nodes.push({
        id: `tension:${t.id}`,
        type: 'CHALLENGE',
        label: t.topic.split(' ').slice(0, 5).join(' '),
        weight: Math.round(t.tensionIndex * 3) + 1,
        phaseTags: [t.domain.toLowerCase().replace(/\s+/g, '_')],
      });
    }
  }

  // ── 3. Alignment cells — positive → VISION, negative → CHALLENGE ──
  if (discoverAnalysis?.alignment?.cells) {
    const sorted = [...discoverAnalysis.alignment.cells].sort(
      (a, b) => b.alignmentScore - a.alignmentScore,
    );
    // Top aligned → VISION
    for (const cell of sorted.filter(c => c.alignmentScore > 0.25).slice(0, 12)) {
      nodes.push({
        id: `align:pos:${cell.theme}:${cell.actor}`,
        type: 'VISION',
        label: cell.theme.split(' ').slice(0, 4).join(' '),
        weight: cell.utteranceCount,
        phaseTags: [],
      });
    }
    // Most divergent → CHALLENGE
    for (const cell of sorted.filter(c => c.alignmentScore < -0.25).slice(-8)) {
      nodes.push({
        id: `align:neg:${cell.theme}:${cell.actor}`,
        type: 'CHALLENGE',
        label: cell.theme.split(' ').slice(0, 4).join(' '),
        weight: cell.utteranceCount,
        phaseTags: [],
      });
    }
  }

  // ── 4. Discovery sections (hemisphere synthesis) ─────────────
  const sections: any[] = discoveryOutput?.sections ?? [];
  for (const section of sections) {
    // High optimistic → ENABLER (threshold lowered to 10 to capture more signal)
    if ((section.sentiment?.optimistic || 0) > 10) {
      for (const theme of (section.topThemes ?? []).slice(0, 3)) {
        nodes.push({
          id: `section:enable:${section.domain}:${theme}`,
          type: 'ENABLER',
          label: String(theme).split(' ').slice(0, 4).join(' '),
          weight: Math.round((section.sentiment.optimistic / 100) * 5) + 1,
          phaseTags: [section.domain.toLowerCase().replace(/\s+/g, '_')],
        });
      }
    }
    // High concerned → FRICTION
    if ((section.sentiment?.concerned || 0) > 25) {
      for (const theme of (section.topThemes ?? []).slice(0, 2)) {
        nodes.push({
          id: `section:friction:${section.domain}:${theme}`,
          type: 'FRICTION',
          label: String(theme).split(' ').slice(0, 4).join(' '),
          weight: Math.round((section.sentiment.concerned / 100) * 4) + 1,
          phaseTags: [section.domain.toLowerCase().replace(/\s+/g, '_')],
        });
      }
    }
  }

  // ── 5. Conversation reports → ENABLER (optimistic) / BELIEF (other) nodes ──
  // Optimistic-tone participants map to ENABLER (middle zone) — they signal organisational capacity.
  // All others map to BELIEF (aspiration zone) — they represent cognitive worldview going in.
  for (const report of conversationReports.slice(0, 20)) {
    const isOptimistic = report.tone === 'optimistic' || report.tone === 'positive';
    nodes.push({
      id: `report:${report.participantId}`,
      type: isOptimistic ? 'ENABLER' : 'BELIEF',
      label: (report.participantName || 'Participant').split(' ')[0],
      weight: isOptimistic ? 3 : (report.tone === 'concerned' || report.tone === 'critical') ? 2 : 1,
      phaseTags: report.participantRole
        ? [report.participantRole.toLowerCase().replace(/\s+/g, '_')]
        : [],
    });
  }

  // ── Balance label ─────────────────────────────────────────────
  const frictionCount = nodes.filter(n => n.type === 'FRICTION' || n.type === 'CONSTRAINT' || n.type === 'CHALLENGE').length;
  const enablerCount  = nodes.filter(n => n.type === 'ENABLER' || n.type === 'VISION' || n.type === 'BELIEF').length;
  const total = frictionCount + enablerCount || 1;
  const frictionRatio = frictionCount / total;
  const balanceLabel =
    frictionRatio > 0.6 ? 'defensive' :
    frictionRatio > 0.4 ? 'fragmented' :
    enablerCount > frictionCount * 1.5 ? 'innovation-dominated' :
    'aligned';

  return { nodes, edges, balanceLabel };
}

// ── Going In Brain component ──────────────────────────────────

// ── Executive Diagnostic Panel ────────────────────────────────────────────────

const DIAGNOSTIC_CARDS = [
  {
    key: 'operationalReality',
    title: 'Operational Reality',
    subtitle: 'How the organisation actually operates day-to-day',
    borderColor: 'border-l-slate-400',
  },
  {
    key: 'organisationalMisalignment',
    title: 'Leadership Alignment Risk',
    subtitle: 'Where the organisation is structurally fractured',
    borderColor: 'border-l-amber-400',
  },
  {
    key: 'systemicFriction',
    title: 'Systemic Friction',
    subtitle: 'What is slowing or preventing transformation',
    borderColor: 'border-l-red-400',
  },
  {
    key: 'transformationReadiness',
    title: 'Transformation Readiness',
    subtitle: 'Whether the organisation appears capable of change',
    borderColor: 'border-l-emerald-400',
  },
] as const;

function ExecDiagnosticPanel({
  discoveryOutput,
  workshopId,
  onGenerated,
}: {
  discoveryOutput: any;
  workshopId: string;
  onGenerated: (updated: any) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState<string | null>(null);

  const hasInsights = DIAGNOSTIC_CARDS.some(({ key }) => !!discoveryOutput?.[key]);

  const generate = async () => {
    setGenerating(true);
    setGenError(null);
    setGenProgress(null);
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/discovery-intelligence`, {
        method: 'POST',
      });

      // Non-2xx before streaming starts — surface the server error message
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any).error ?? `Request failed (HTTP ${res.status})`);
      }

      // Consume SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream received');

      const decoder = new TextDecoder();
      let buf = '';

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          const lines = part.split('\n');
          const eventLine = lines.find(l => l.startsWith('event: '));
          const dataLine  = lines.find(l => l.startsWith('data: '));
          if (!dataLine) continue;

          const eventType = eventLine?.slice(7).trim() ?? 'message';
          let data: Record<string, unknown> = {};
          try { data = JSON.parse(dataLine.slice(6)); } catch { continue; }

          if (eventType === 'progress') {
            setGenProgress((data.message as string) ?? null);
          } else if (eventType === 'complete') {
            if (data.discoveryOutput) onGenerated(data.discoveryOutput);
            break outer;
          } else if (eventType === 'error') {
            throw new Error((data.message as string) || 'Generation failed');
          }
        }
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Executive Diagnostic</h2>
          <p className="text-sm text-slate-500 mt-1">
            The organisational condition based on discovery signals — readable in under 10 seconds.
          </p>
        </div>
        {hasInsights && (
          <button
            onClick={generate}
            disabled={generating}
            className="shrink-0 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50 pt-1"
          >
            <RefreshCw className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating…' : 'Regenerate'}
          </button>
        )}
      </div>

      {/* Hero summary */}
      {discoveryOutput?.finalDiscoverySummary && (
        <div className="rounded-xl bg-slate-900 text-white px-6 py-5">
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">
            Diagnostic Summary
          </p>
          <p className="text-sm leading-relaxed text-slate-100">
            {discoveryOutput.finalDiscoverySummary}
          </p>
        </div>
      )}

      {/* Empty state */}
      {(!discoveryOutput || !hasInsights) && !generating && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center border-dashed">
          <div className="rounded-full bg-indigo-50 p-3">
            <BarChart2 className="h-6 w-6 text-indigo-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Generate your Executive Diagnostic</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Synthesise discovery signals into a concise organisational diagnosis.
              Each section is immediately understandable by a senior executive.
            </p>
          </div>
          <Button onClick={generate} disabled={generating}>
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating…</>
            ) : (
              '✦ Generate Executive Diagnostic'
            )}
          </Button>
        </Card>
      )}

      {generating && (!discoveryOutput || !hasInsights) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-50 border border-indigo-100">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
          <p className="text-sm text-indigo-700">
            {genProgress ?? 'Synthesising discovery signals into diagnostic insights…'}
          </p>
        </div>
      )}

      {genError && (
        <p className="text-sm text-red-600">{genError}</p>
      )}

      {/* 4 insight cards */}
      {hasInsights && (
        <div className="space-y-4">
          {DIAGNOSTIC_CARDS.map(({ key, title, subtitle, borderColor }) => {
            const section = discoveryOutput[key] as { insight: string; evidence?: string[] } | undefined;
            if (!section?.insight) return null;
            return (
              <div
                key={key}
                className={`rounded-lg border border-slate-100 border-l-4 ${borderColor} bg-white p-5 shadow-sm`}
              >
                <h3 className="font-bold text-slate-900 text-[15px] leading-snug">{title}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-3">{subtitle}</p>
                <p className="text-sm text-slate-700 leading-relaxed">{section.insight}</p>
                {(section.evidence?.length ?? 0) > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {section.evidence!.slice(0, 3).map((ev, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 flex-shrink-0" />
                        {ev}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Organisational State (formerly Going In Brain) ────────────────────────────

function GoingInBrain({ discoveryOutput, discoverAnalysis, conversationReports }: {
  discoveryOutput: any;
  discoverAnalysis: DiscoverAnalysis | null;
  conversationReports: any[];
}) {
  const [activeSignal, setActiveSignal] = useState<string | null>(null);
  const [activeInsightTab, setActiveInsightTab] = useState<'signals' | 'disposition'>('signals');
  const [nodeScale, setNodeScale] = useState(1.4);

  const sections: any[] = discoveryOutput?.sections ?? [];
  const hasSections = sections.length > 0;
  const hasAnalysis = discoverAnalysis != null;
  const hasReports = conversationReports.length > 0;

  const { nodes: globeNodes, edges: globeEdges } = useMemo(
    () => buildDiscoveryGlobe(discoverAnalysis, discoveryOutput, conversationReports),
    [discoverAnalysis, discoveryOutput, conversationReports],
  );

  // Signal distribution — computed from globe node types
  const signalDistribution = useMemo(() => {
    const friction = globeNodes.filter((n) => ['CONSTRAINT', 'FRICTION', 'CHALLENGE'].includes(n.type)).length;
    const aspiration = globeNodes.filter((n) => ['VISION', 'BELIEF'].includes(n.type)).length;
    const enabler = globeNodes.filter((n) => n.type === 'ENABLER').length;
    const total = Math.max(1, friction + aspiration + enabler);
    const frictionPct = Math.round((friction / total) * 100);
    const aspirationPct = Math.round((aspiration / total) * 100);
    const enablerPct = 100 - frictionPct - aspirationPct;
    const dominant = frictionPct >= aspirationPct && frictionPct >= enablerPct ? 'friction'
      : aspirationPct >= enablerPct ? 'aspiration' : 'enabler';
    return { frictionPct, aspirationPct, enablerPct, dominant };
  }, [globeNodes]);

  // Per-role disposition — groups reports by participantRole, classifies each group
  const roleDispositions = useMemo(() => {
    const roleGroups = new Map<string, any[]>();
    for (const report of conversationReports) {
      const role = report.participantRole || report.participantDepartment || 'Unknown';
      if (!roleGroups.has(role)) roleGroups.set(role, []);
      roleGroups.get(role)!.push(report);
    }
    return Array.from(roleGroups.entries())
      .map(([role, reports]) => {
        const concerned = reports.filter((r: any) =>
          ['concerned', 'negative', 'critical'].includes(r.tone ?? ''),
        ).length;
        const optimistic = reports.filter((r: any) =>
          ['optimistic', 'positive'].includes(r.tone ?? ''),
        ).length;
        const neutral = reports.length - concerned - optimistic;
        const frictionRatio = concerned / (reports.length || 1);
        const disposition =
          frictionRatio > 0.6 ? 'Defensive' :
          frictionRatio > 0.4 ? 'Fragmented' :
          optimistic > reports.length / 2 ? 'Aligned' : 'Neutral';
        return { role, count: reports.length, concerned, optimistic, neutral, frictionRatio, disposition };
      })
      .sort((a, b) => b.frictionRatio - a.frictionRatio);
  }, [conversationReports]);

  if (!hasSections && !hasAnalysis && !hasReports) {
    return (
      <Card className="p-8 text-center">
        <Brain className="h-6 w-6 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600">No discovery signal data yet</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Complete discovery interviews to activate Organisational State — no analysis required.
        </p>
      </Card>
    );
  }

  // ── Compute signal strengths — priority: sections → analysis → reports ──
  const strengths: Record<string, number> = { perception: 0, inhibition: 0, imagination: 0, vision: 0, execution: 0 };
  let dataSource = 'discovery interviews';

  if (hasSections) {
    // Best source: hemisphere synthesis sections with consensus + sentiment
    strengths.perception  = Math.round(sections.reduce((s: number, x: any) => s + (x.consensusLevel || 0), 0) / sections.length);
    strengths.inhibition  = Math.round(sections.reduce((s: number, x: any) => s + (x.sentiment?.concerned || 0), 0) / sections.length);
    strengths.imagination = Math.round(sections.reduce((s: number, x: any) => s + (x.sentiment?.optimistic || 0), 0) / sections.length);
    dataSource = 'discovery interviews';
  } else if (hasAnalysis) {
    // Second: discoverAnalysis (alignment heatmap, confidence index, narrative)
    const cells = discoverAnalysis!.alignment?.cells ?? [];
    if (cells.length > 0) {
      const avg = cells.reduce((s: number, c: any) => s + c.alignmentScore, 0) / cells.length;
      strengths.perception = Math.round(((avg + 1) / 2) * 100);
    }
    const conf = discoverAnalysis!.confidence?.overall;
    if (conf) {
      const total = (conf.certain + conf.hedging + conf.uncertain) || 1;
      strengths.inhibition = Math.round((conf.uncertain / total) * 100);
    }
    const layers = discoverAnalysis!.narrative?.layers ?? [];
    if (layers.length > 0) {
      const avgFuture = layers.reduce((s: number, l: any) => s + (l.temporalFocus?.future || 0), 0) / layers.length;
      strengths.imagination = Math.round(avgFuture * 100);
    }
    dataSource = 'signal analysis';
  } else if (hasReports) {
    // Third: raw conversation reports — tone + phaseInsights lens scores
    // PERCEPTION — avg current lens score across all participants (1-10 → 0-100)
    const allCurrentScores: number[] = conversationReports.flatMap((r: any) =>
      Object.values((r.phaseInsights ?? {}) as Record<string, any>)
        .map((v: any) => typeof v?.currentScore === 'number' ? v.currentScore : null)
        .filter((v): v is number => v !== null)
    );
    if (allCurrentScores.length > 0) {
      const avg = allCurrentScores.reduce((s, x) => s + x, 0) / allCurrentScores.length;
      strengths.perception = Math.round((avg / 10) * 100);
    }
    // INHIBITION — % of participants with concerned or negative tone
    const concernedCount = conversationReports.filter((r: any) =>
      r.tone === 'concerned' || r.tone === 'negative' || r.tone === 'critical'
    ).length;
    strengths.inhibition = Math.round((concernedCount / conversationReports.length) * 100);
    // IMAGINATION — avg aspiration gap (targetScore - currentScore), max gap = 9 on 1-10 scale
    const allGaps: number[] = conversationReports.flatMap((r: any) =>
      Object.values((r.phaseInsights ?? {}) as Record<string, any>)
        .map((v: any) =>
          typeof v?.targetScore === 'number' && typeof v?.currentScore === 'number'
            ? Math.max(0, v.targetScore - v.currentScore)
            : null
        )
        .filter((v): v is number => v !== null)
    );
    if (allGaps.length > 0) {
      const avgGap = allGaps.reduce((s, x) => s + x, 0) / allGaps.length;
      strengths.imagination = Math.round((avgGap / 9) * 100);
    }
    dataSource = `${conversationReports.length} interview${conversationReports.length > 1 ? 's' : ''}`;
  }

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            Organisational State — Pre-Workshop Cognitive Signal
          </p>
          <span className="ml-auto text-[9px] text-slate-500 uppercase tracking-wider">
            Derived from {dataSource}
          </span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          The cognitive condition of the organisation entering the workshop. What signals dominate collective thinking.
        </p>
      </div>

      {/* Two-column: Globe left, Insights right */}
      <div className="grid grid-cols-[55fr_45fr] gap-5 items-start">

        {/* LEFT — Discovery Signal Globe */}
        <div>
          {/* Signal distribution bar */}
          {globeNodes.length > 0 && (
            <div className="mb-4 rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-2">
                Discovery Signal Distribution
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                  signalDistribution.dominant === 'friction'
                    ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                    : 'bg-red-50 text-red-500'
                }`}>
                  Operational Friction — {signalDistribution.frictionPct}%
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                  signalDistribution.dominant === 'aspiration'
                    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                    : 'bg-emerald-50 text-emerald-600'
                }`}>
                  Aspiration — {signalDistribution.aspirationPct}%
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                  signalDistribution.dominant === 'enabler'
                    ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                    : 'bg-indigo-50 text-indigo-500'
                }`}>
                  Enablers — {signalDistribution.enablerPct}%
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Discovery Signal Map
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">Node size</span>
              <input
                type="range"
                min={0.6}
                max={3.0}
                step={0.1}
                value={nodeScale}
                onChange={e => setNodeScale(Number(e.target.value))}
                className="w-20 accent-indigo-500"
              />
            </div>
          </div>
          {globeNodes.length > 0 ? (
            <>
              <DashboardHemisphereCanvas
                nodes={globeNodes}
                edges={globeEdges}
                label="Discovery Phase"
                nodeCount={globeNodes.length}
                edgeCount={globeEdges.length}
                nodeScale={nodeScale}
                className="w-full"
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 px-1">
                {[
                  { color: '#60a5fa', label: 'Aligned signal' },
                  { color: '#a78bfa', label: 'Participant view' },
                  { color: '#34d399', label: 'Enabler' },
                  { color: '#fb7185', label: 'Tension' },
                  { color: '#f97316', label: 'Friction' },
                  { color: '#ef4444', label: 'Constraint' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[10px] text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div
              className="rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center"
              style={{ height: 420 }}
            >
              <p className="text-sm text-slate-400">No signal data for globe yet</p>
            </div>
          )}
        </div>

        {/* RIGHT — Insights panel with tabs */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Tab header */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveInsightTab('signals')}
              className={`flex-1 px-4 py-2.5 text-[10px] font-bold tracking-wider uppercase transition-colors ${
                activeInsightTab === 'signals'
                  ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Signal Strengths
            </button>
            <button
              onClick={() => setActiveInsightTab('disposition')}
              className={`flex-1 px-4 py-2.5 text-[10px] font-bold tracking-wider uppercase transition-colors ${
                activeInsightTab === 'disposition'
                  ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Disposition by Role
            </button>
          </div>

          {/* ── Signals tab ───────────────────────────── */}
          {activeInsightTab === 'signals' && (
            <div className="p-4 space-y-1.5">
              {GOING_IN_SIGNALS.map((sig) => {
                const strength = strengths[sig.key as keyof typeof strengths];
                const colors = COLOR_CLASSES[sig.color];
                const isActive = activeSignal === sig.key;
                const isLive = strength > 0;
                return (
                  <div key={sig.key}>
                    <button
                      onClick={() => setActiveSignal(isActive ? null : sig.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left
                        ${colors.card} bg-white hover:bg-slate-50
                        ${isActive ? `ring-2 ${colors.ring}` : ''}
                        ${!isLive ? 'opacity-50' : ''}`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${colors.bar}`} />
                      <p className={`text-[9px] font-bold tracking-widest uppercase ${colors.label} w-20 shrink-0`}>
                        {sig.label}
                      </p>
                      <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colors.bar}`}
                          style={{ width: `${strength}%` }}
                        />
                      </div>
                      <p className={`text-sm font-bold ${colors.label} w-9 text-right shrink-0`}>
                        {isLive ? `${strength}%` : '—'}
                      </p>
                    </button>

                    {/* Inline expanded detail */}
                    {isActive && (() => {
                      const detailText = hasSections
                        ? (sig as any).detail(sections, discoveryOutput)
                        : null;
                      return (
                        <div className={`rounded-lg border ${colors.card} bg-slate-50 p-3 mt-1`}>
                          <p className="text-[10px] text-slate-400 mb-2 italic">{sig.description}</p>
                          {detailText ? (
                            <p className="text-xs text-slate-700 leading-relaxed mb-2">{detailText}</p>
                          ) : sig.empty ? (
                            <p className="text-xs text-slate-400 italic mb-2">{sig.empty}</p>
                          ) : null}

                          {/* PERCEPTION — domain consensus bars */}
                          {sig.key === 'perception' && hasSections && (
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Domain Consensus</p>
                              {sections.map((s: any, i: number) => (
                                <div key={i} className="flex items-center gap-2">
                                  <p className="text-[10px] text-slate-500 w-24 truncate">{s.domain}</p>
                                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${s.consensusLevel || 0}%` }} />
                                  </div>
                                  <p className="text-[10px] text-slate-400 w-7 text-right">{s.consensusLevel || 0}%</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* PERCEPTION — alignment divergence (analysis fallback) */}
                          {sig.key === 'perception' && !hasSections && hasAnalysis && (() => {
                            const divergent = (discoverAnalysis!.alignment?.cells ?? [])
                              .filter((c: any) => c.alignmentScore < -0.05 && c.utteranceCount >= 2)
                              .sort((a: any, b: any) => a.alignmentScore - b.alignmentScore)
                              .slice(0, 5);
                            if (divergent.length === 0) return null;
                            return (
                              <div className="space-y-1">
                                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Alignment Divergence</p>
                                {divergent.map((c: any, i: number) => (
                                  <div key={i} className="flex items-start gap-1.5">
                                    <span className="text-slate-300 text-[10px] mt-0.5">·</span>
                                    <p className="text-[10px] text-slate-600">
                                      <span className="font-medium">{c.actor}</span> on &ldquo;{c.theme}&rdquo; — {c.alignmentScore.toFixed(2)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}

                          {/* INHIBITION — concern by domain */}
                          {sig.key === 'inhibition' && hasSections && (
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Concern Level by Domain</p>
                              {sections.slice().sort((a: any, b: any) => (b.sentiment?.concerned || 0) - (a.sentiment?.concerned || 0)).map((s: any, i: number) => (
                                <div key={i} className="flex items-center gap-2">
                                  <p className="text-[10px] text-slate-500 w-24 truncate">{s.domain}</p>
                                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-400 rounded-full" style={{ width: `${s.sentiment?.concerned || 0}%` }} />
                                  </div>
                                  <p className="text-[10px] text-slate-400 w-7 text-right">{s.sentiment?.concerned || 0}%</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* INHIBITION — top constraints (analysis fallback) */}
                          {sig.key === 'inhibition' && !hasSections && hasAnalysis && (() => {
                            const constraints = (discoverAnalysis!.constraints?.constraints ?? [])
                              .sort((a: any, b: any) => b.weight - a.weight).slice(0, 4);
                            if (constraints.length === 0) return null;
                            return (
                              <div className="space-y-1">
                                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Top Constraints</p>
                                {constraints.map((c: any, i: number) => (
                                  <div key={i} className="flex items-start gap-1.5">
                                    <span className="text-slate-300 text-[10px] mt-0.5">·</span>
                                    <p className="text-[10px] text-slate-600">{c.description} <span className="text-slate-400">({c.severity})</span></p>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}

                          {/* IMAGINATION — optimism by domain */}
                          {sig.key === 'imagination' && hasSections && (
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Optimism Level by Domain</p>
                              {sections.slice().sort((a: any, b: any) => (b.sentiment?.optimistic || 0) - (a.sentiment?.optimistic || 0)).map((s: any, i: number) => (
                                <div key={i} className="flex items-center gap-2">
                                  <p className="text-[10px] text-slate-500 w-24 truncate">{s.domain}</p>
                                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-violet-400 rounded-full" style={{ width: `${s.sentiment?.optimistic || 0}%` }} />
                                  </div>
                                  <p className="text-[10px] text-slate-400 w-7 text-right">{s.sentiment?.optimistic || 0}%</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* IMAGINATION — narrative future focus (analysis fallback) */}
                          {sig.key === 'imagination' && !hasSections && hasAnalysis && (() => {
                            const layers = discoverAnalysis!.narrative?.layers ?? [];
                            if (layers.length === 0) return null;
                            return (
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Future Focus by Layer</p>
                                {layers.map((l: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <p className="text-[10px] text-slate-500 w-24 capitalize">{l.layer}</p>
                                    <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                      <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.round((l.temporalFocus?.future || 0) * 100)}%` }} />
                                    </div>
                                    <p className="text-[10px] text-slate-400 w-7 text-right">{Math.round((l.temporalFocus?.future || 0) * 100)}%</p>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Disposition by Role tab ───────────────── */}
          {activeInsightTab === 'disposition' && (
            <div className="p-4 space-y-3">
              {roleDispositions.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-slate-400">No participant role data</p>
                  <p className="text-xs text-slate-300 mt-1">Complete discovery interviews to see disposition by role</p>
                </div>
              ) : (
                <>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                    {conversationReports.length} participant{conversationReports.length !== 1 ? 's' : ''} across {roleDispositions.length} role{roleDispositions.length !== 1 ? 's' : ''}
                  </p>
                  {roleDispositions.map((rd) => {
                    const dc =
                      rd.disposition === 'Defensive'
                        ? { badge: 'bg-red-100 text-red-700', row: 'bg-red-50', opt: 'bg-emerald-400', con: 'bg-rose-400' }
                        : rd.disposition === 'Fragmented'
                        ? { badge: 'bg-amber-100 text-amber-700', row: 'bg-amber-50', opt: 'bg-emerald-400', con: 'bg-amber-400' }
                        : rd.disposition === 'Aligned'
                        ? { badge: 'bg-emerald-100 text-emerald-700', row: 'bg-emerald-50', opt: 'bg-emerald-400', con: 'bg-rose-300' }
                        : { badge: 'bg-slate-100 text-slate-600', row: 'bg-slate-50', opt: 'bg-emerald-400', con: 'bg-rose-400' };
                    const total = rd.count || 1;
                    return (
                      <div key={rd.role} className={`rounded-lg ${dc.row} px-3 py-2.5`}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-700">{rd.role}</p>
                            <p className="text-[9px] text-slate-400">{rd.count} participant{rd.count !== 1 ? 's' : ''}</p>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${dc.badge}`}>
                            {rd.disposition}
                          </span>
                        </div>
                        {/* Sentiment proportion bar */}
                        <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                          {rd.optimistic > 0 && (
                            <div className={dc.opt} style={{ width: `${(rd.optimistic / total) * 100}%` }} />
                          )}
                          {rd.neutral > 0 && (
                            <div className="bg-slate-200" style={{ width: `${(rd.neutral / total) * 100}%` }} />
                          )}
                          {rd.concerned > 0 && (
                            <div className={dc.con} style={{ width: `${(rd.concerned / total) * 100}%` }} />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          {rd.optimistic > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span className="text-[9px] text-slate-400">{rd.optimistic} positive</span>
                            </div>
                          )}
                          {rd.neutral > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              <span className="text-[9px] text-slate-400">{rd.neutral} neutral</span>
                            </div>
                          )}
                          {rd.concerned > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              <span className="text-[9px] text-slate-400">{rd.concerned} concerned</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function DiscoveryOutputPage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [loading, setLoading] = useState(true);
  const [discoveryOutput, setDiscoveryOutput] = useState<any>(null);
  const [discoverAnalysis, setDiscoverAnalysis] = useState<DiscoverAnalysis | null>(null);
  const [conversationReports, setConversationReports] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [workshopName, setWorkshopName] = useState<string>('');

  // Tab control
  const [activeTab, setActiveTab] = useState('executive-diagnostic');

  // Analysis generation state
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string | null>(null);

  // Discovery search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAnswer, setSearchAnswer] = useState('');
  const [searchStreaming, setSearchStreaming] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAnswerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [scratchpadRes, workshopRes, analysisRes, reportsRes] = await Promise.all([
          fetch(`/api/admin/workshops/${workshopId}/scratchpad`),
          fetch(`/api/admin/workshops/${workshopId}`),
          fetch(`/api/admin/workshops/${workshopId}/discover-analysis`),
          fetch(`/api/admin/workshops/${workshopId}/participant-reports`),
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

        if (reportsRes.ok) {
          const reportsData = await reportsRes.json();
          if (reportsData.ok && reportsData.reports?.length > 0) {
            setConversationReports(reportsData.reports);
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
                setActiveTab('going-in-brain');
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

  const handleSearch = useCallback(async (q?: string) => {
    const query = (q ?? searchQuery).trim();
    if (!query || searchStreaming) return;
    setSearchAnswer('');
    setSearchError(null);
    setSearchStreaming(true);

    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/discovery-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const { text, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (text) {
              setSearchAnswer(prev => {
                const next = prev + text;
                // Scroll to answer
                setTimeout(() => searchAnswerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 10);
                return next;
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearchStreaming(false);
    }
  }, [workshopId, searchQuery, searchStreaming]);

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b bg-background px-6 py-3 flex items-center gap-3">
        <BarChart2 className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <h1 className="text-sm font-semibold">
            Perception Signal{' '}
            <span className="text-xs font-normal text-muted-foreground ml-1">— Discovery Phase</span>
          </h1>
          {workshopName && (
            <p className="text-xs text-muted-foreground">{workshopName}</p>
          )}
        </div>
      </div>

      {/* Discovery search bar — persistent above tabs */}
      <div className="border-b bg-slate-50/60 px-6 py-3">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSearch(); }}
            placeholder="Ask anything about this discovery… e.g. What did the Technology team say about legacy systems?"
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
            disabled={searchStreaming}
          />
          {searchAnswer && !searchStreaming && (
            <button
              onClick={() => { setSearchAnswer(''); setSearchQuery(''); setSearchError(null); }}
              className="text-slate-300 hover:text-slate-500 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => void handleSearch()}
            disabled={!searchQuery.trim() || searchStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {searchStreaming
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <span className="text-xs">✦</span>}
            Ask
          </button>
        </div>

        {/* Answer panel */}
        {(searchAnswer || searchError) && (
          <div ref={searchAnswerRef} className="mt-3 rounded-lg bg-white border border-slate-100 px-4 py-3">
            {searchError ? (
              <p className="text-xs text-rose-500">{searchError}</p>
            ) : (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {searchAnswer}
                {searchStreaming && <span className="inline-block w-1 h-3.5 bg-indigo-400 ml-0.5 animate-pulse align-text-bottom" />}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
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

      {/* Tabs */}
      {!loading && !error && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-[calc(100vh-57px)]">
          {/* Tab navigation — pinned at top */}
          <div className="border-b bg-background px-6 pt-3">
            <TabsList className="bg-transparent p-0 h-auto gap-0 border-0">
              <TabsTrigger
                value="executive-diagnostic"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent bg-transparent px-4 pb-3 pt-0 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Executive Diagnostic
              </TabsTrigger>
              <TabsTrigger
                value="perception"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent bg-transparent px-4 pb-3 pt-0 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Perception
              </TabsTrigger>
              <TabsTrigger
                value="going-in-brain"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent bg-transparent px-4 pb-3 pt-0 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Organisational State
              </TabsTrigger>
              <TabsTrigger
                value="signal-analysis"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent bg-transparent px-4 pb-3 pt-0 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Structural Analysis
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab content — scrollable within this area */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Tab 1: Executive Diagnostic ──────────────────────── */}
            <TabsContent value="executive-diagnostic" className="mt-0 p-6">
              <div className="flex justify-end gap-2 mb-4">
                <ReportSectionToggle
                  workshopId={workshopId}
                  sectionId="supporting_evidence"
                  title="Supporting Evidence"
                />
                <ReportSectionToggle
                  workshopId={workshopId}
                  sectionId="discovery_diagnostic"
                  title="Discovery Diagnostic"
                />
              </div>
              <ExecDiagnosticPanel
                discoveryOutput={discoveryOutput}
                workshopId={workshopId}
                onGenerated={(updated) => setDiscoveryOutput(updated)}
              />
            </TabsContent>

            {/* ── Tab 2: Perception ─────────────────────────────────── */}
            <TabsContent value="perception" className="mt-0 p-6">
              <DiscoveryOutputTab
                data={discoveryOutput}
                workshopId={workshopId}
                onGenerated={(updated) => setDiscoveryOutput(updated)}
              />
            </TabsContent>

            {/* ── Tab 3: Organisational State ───────────────────────── */}
            <TabsContent value="going-in-brain" className="mt-0 p-6">
              <div className="flex justify-end mb-4 gap-3">
                <ReportSectionToggle
                  workshopId={workshopId}
                  sectionId="discovery_signals"
                  title="Discovery Signals"
                />
                <ReportSectionToggle
                  workshopId={workshopId}
                  sectionId="discovery_signal_map"
                  title="Signal Map"
                />
              </div>
              <div id="signal-map-area">
                <GoingInBrain discoveryOutput={discoveryOutput} discoverAnalysis={discoverAnalysis} conversationReports={conversationReports} />
              </div>
            </TabsContent>

            {/* ── Tab 4: Structural Analysis ────────────────────────── */}
            <TabsContent value="signal-analysis" className="mt-0 p-6">
              <div className="space-y-8">
                {/* Header + generate button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Structural Analysis</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Where the organisation is structurally fractured — domain misalignment, actor divergence, tensions and constraints
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

                {/* Empty state */}
                {!discoverAnalysis && !generatingAnalysis && (
                  <Card className="p-6 flex flex-col items-center gap-3 text-center">
                    <Info className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground max-w-md">
                      Click <strong>Generate Analysis</strong> to compute the alignment heatmap,
                      constraint map, tension surface, and narrative divergence from your discovery data.
                    </p>
                  </Card>
                )}

                {/* Progress */}
                {generatingAnalysis && analysisProgress && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                    <p className="text-sm text-blue-700">{analysisProgress}</p>
                  </div>
                )}

                {/* Analysis components */}
                {discoverAnalysis && (
                  <div className="space-y-8">
                    {discoverAnalysis.dataQuality && (
                      <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-700">{discoverAnalysis.dataQuality.note}</p>
                      </div>
                    )}

                    {(discoverAnalysis.tensions?.tensions?.length ?? 0) > 0 && (
                      <Card className="p-6">
                        <div className="flex items-start justify-between gap-4 mb-1">
                          <h3 className="font-bold text-lg">Transformation Constraints</h3>
                          <ReportSectionToggle
                            workshopId={workshopId}
                            sectionId="structural_tensions"
                            title="Transformation Tensions"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Ranked unresolved tensions and competing perspectives — what is slowing or preventing transformation
                        </p>
                        <TensionSurface data={discoverAnalysis.tensions} />
                      </Card>
                    )}

                    {(discoverAnalysis.constraints?.constraints?.length ?? 0) > 0 && (
                      <Card className="p-6">
                        <div className="flex items-start justify-between gap-4 mb-1">
                          <h3 className="font-bold text-lg">Structural Barriers</h3>
                          <ReportSectionToggle
                            workshopId={workshopId}
                            sectionId="structural_barriers"
                            title="Structural Barriers"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Weighted constraints and dependencies — system fragmentation, capability gaps, operational instability
                        </p>
                        <ConstraintMap data={discoverAnalysis.constraints} />
                      </Card>
                    )}

                    {(discoverAnalysis.alignment?.themes?.length ?? 0) > 0 && (
                      <Card className="p-6">
                        <div className="flex items-start justify-between gap-4 mb-1">
                          <h3 className="font-bold text-lg">Domain Misalignment</h3>
                          <ReportSectionToggle
                            workshopId={workshopId}
                            sectionId="structural_alignment"
                            title="Domain Misalignment"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Actor × theme alignment and divergence — where leadership and operational thinking diverge
                        </p>
                        <AlignmentHeatmap data={discoverAnalysis.alignment} showSampleSize />
                      </Card>
                    )}

                    {(discoverAnalysis.narrative?.layers?.length ?? 0) > 0 && (
                      <Card className="p-6">
                        <div className="flex items-start justify-between gap-4 mb-1">
                          <h3 className="font-bold text-lg">Narrative Divergence</h3>
                          <ReportSectionToggle
                            workshopId={workshopId}
                            sectionId="structural_narrative"
                            title="Narrative Divergence"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Language and sentiment differences across organisational layers — executive vs operational vs frontline
                        </p>
                        <NarrativeDivergence data={discoverAnalysis.narrative} />
                      </Card>
                    )}

                    {discoverAnalysis.confidence && (
                      <Card className="p-6">
                        <div className="flex justify-between items-center mb-1">
                          <h3 className="font-bold text-lg">Transformation Readiness</h3>
                          <ReportSectionToggle workshopId={workshopId} sectionId="structural_confidence" title="Transformation Readiness" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Certainty, hedging and uncertainty across domains — signals of organisational confidence to execute change
                        </p>
                        <ConfidenceIndex data={discoverAnalysis.confidence} />
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
