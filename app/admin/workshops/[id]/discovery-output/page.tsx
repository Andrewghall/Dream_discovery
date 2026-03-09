'use client';

import { use, useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, BarChart2, RefreshCw, Info, Brain, TrendingUp, Eye, Zap, Search, X } from 'lucide-react';
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

// ── Going In Brain component ──────────────────────────────────

function GoingInBrain({ discoveryOutput }: { discoveryOutput: any }) {
  const [activeSignal, setActiveSignal] = useState<string | null>(null);

  if (!discoveryOutput?.sections?.length) {
    return (
      <Card className="p-8 text-center">
        <Brain className="h-6 w-6 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600">Perception Signal analysis needed first</p>
        <p className="text-xs text-slate-400 mt-1">
          Generate Discovery Intelligence on the Perception Signal tab to activate the Going In Brain.
        </p>
      </Card>
    );
  }

  const sections: any[] = discoveryOutput.sections;

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            Going In Brain — Pre-Workshop State
          </p>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-1">
          Signal intelligence derived purely from pre-workshop discovery conversations.
          This is the cognitive state of the organisation before the workshop begins.
        </p>
        {discoveryOutput.finalDiscoverySummary && (
          <p className="text-sm text-slate-100 leading-relaxed mt-3 pt-3 border-t border-slate-700">
            {discoveryOutput.finalDiscoverySummary}
          </p>
        )}
      </div>

      {/* Signal cards */}
      <div className="grid grid-cols-5 gap-3">
        {GOING_IN_SIGNALS.map((sig) => {
          const strength = sig.derive(sections);
          const colors = COLOR_CLASSES[sig.color];
          const isActive = activeSignal === sig.key;
          const isLive = strength > 0;

          return (
            <button
              key={sig.key}
              onClick={() => setActiveSignal(isActive ? null : sig.key)}
              className={`rounded-xl border p-4 text-left transition-all ${colors.card} bg-white hover:shadow-sm ${
                isActive ? `ring-2 ${colors.ring} shadow-sm` : ''
              } ${!isLive ? 'opacity-60' : ''}`}
            >
              <p className={`text-[9px] font-bold tracking-widest uppercase mb-2 ${colors.label}`}>
                {sig.label}
              </p>
              <div className="mb-3">
                {isLive ? (
                  <p className={`text-2xl font-bold ${colors.label}`}>{strength}%</p>
                ) : (
                  <p className="text-xs text-slate-400 font-medium">—</p>
                )}
              </div>
              {/* Signal strength bar */}
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${colors.bar}`}
                  style={{ width: `${strength}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-snug">{sig.description}</p>
            </button>
          );
        })}
      </div>

      {/* Expanded detail panel */}
      {activeSignal && (() => {
        const sig = GOING_IN_SIGNALS.find(s => s.key === activeSignal);
        if (!sig) return null;
        const colors = COLOR_CLASSES[sig.color];
        const strength = sig.derive(sections);
        const detailText = (sig as any).detail(sections, discoveryOutput);

        return (
          <div className={`rounded-xl border-2 ${colors.card} bg-white p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${colors.bar}`} />
              <p className={`text-[10px] font-bold tracking-widest uppercase ${colors.label}`}>
                {sig.label} Signal — {strength > 0 ? `${strength}% strength` : 'Pre-workshop'}
              </p>
            </div>
            <p className="text-xs text-slate-400 mb-3">{sig.description}</p>

            {detailText ? (
              <p className="text-sm text-slate-700 leading-relaxed">{detailText}</p>
            ) : sig.empty ? (
              <p className="text-sm text-slate-400 italic">{sig.empty}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">No signal data available for this domain.</p>
            )}

            {/* Domain breakdown for PERCEPTION */}
            {activeSignal === 'perception' && sections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Domain Consensus
                </p>
                {sections.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <p className="text-xs text-slate-500 w-28 truncate">{s.domain}</p>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full"
                        style={{ width: `${s.consensusLevel || 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 w-8 text-right">{s.consensusLevel || 0}%</p>
                  </div>
                ))}
              </div>
            )}

            {/* Domain breakdown for INHIBITION */}
            {activeSignal === 'inhibition' && sections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Concern Level by Domain
                </p>
                {sections
                  .slice()
                  .sort((a: any, b: any) => (b.sentiment?.concerned || 0) - (a.sentiment?.concerned || 0))
                  .map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <p className="text-xs text-slate-500 w-28 truncate">{s.domain}</p>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-400 rounded-full"
                          style={{ width: `${s.sentiment?.concerned || 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 w-8 text-right">{s.sentiment?.concerned || 0}%</p>
                    </div>
                  ))}
              </div>
            )}

            {/* Domain breakdown for IMAGINATION */}
            {activeSignal === 'imagination' && sections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Optimism Level by Domain
                </p>
                {sections
                  .slice()
                  .sort((a: any, b: any) => (b.sentiment?.optimistic || 0) - (a.sentiment?.optimistic || 0))
                  .map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <p className="text-xs text-slate-500 w-28 truncate">{s.domain}</p>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-400 rounded-full"
                          style={{ width: `${s.sentiment?.optimistic || 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 w-8 text-right">{s.sentiment?.optimistic || 0}%</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function DiscoveryOutputPage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [loading, setLoading] = useState(true);
  const [discoveryOutput, setDiscoveryOutput] = useState<any>(null);
  const [discoverAnalysis, setDiscoverAnalysis] = useState<DiscoverAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workshopName, setWorkshopName] = useState<string>('');

  // Tab control
  const [activeTab, setActiveTab] = useState('perception');

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
                value="perception"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent bg-transparent px-4 pb-3 pt-0 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Perception Signal
              </TabsTrigger>
              <TabsTrigger
                value="going-in-brain"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent bg-transparent px-4 pb-3 pt-0 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Going In Brain
              </TabsTrigger>
              <TabsTrigger
                value="signal-analysis"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent bg-transparent px-4 pb-3 pt-0 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Signal Analysis
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab content — scrollable within this area */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Tab 1: Perception Signal ─────────────────────────── */}
            <TabsContent value="perception" className="mt-0 p-6">
              <DiscoveryOutputTab
                data={discoveryOutput}
                workshopId={workshopId}
                onGenerated={(updated) => setDiscoveryOutput(updated)}
              />
            </TabsContent>

            {/* ── Tab 2: Going In Brain ────────────────────────────── */}
            <TabsContent value="going-in-brain" className="mt-0 p-6">
              <GoingInBrain discoveryOutput={discoveryOutput} />
            </TabsContent>

            {/* ── Tab 3: Signal Analysis ───────────────────────────── */}
            <TabsContent value="signal-analysis" className="mt-0 p-6">
              <div className="space-y-8">
                {/* Header + generate button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Signal Analysis</h2>
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

                    {(discoverAnalysis.alignment?.themes?.length ?? 0) > 0 && (
                      <Card className="p-6">
                        <h3 className="font-bold text-lg mb-1">Alignment Heatmap</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Actor × theme alignment and divergence across the organisation
                        </p>
                        <AlignmentHeatmap data={discoverAnalysis.alignment} showSampleSize />
                      </Card>
                    )}

                    {(discoverAnalysis.tensions?.tensions?.length ?? 0) > 0 && (
                      <Card className="p-6">
                        <h3 className="font-bold text-lg mb-1">Tension Surface</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Ranked unresolved tensions and competing perspectives
                        </p>
                        <TensionSurface data={discoverAnalysis.tensions} />
                      </Card>
                    )}

                    {(discoverAnalysis.constraints?.constraints?.length ?? 0) > 0 && (
                      <Card className="p-6">
                        <h3 className="font-bold text-lg mb-1">Constraint Map</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Weighted constraints and their dependencies
                        </p>
                        <ConstraintMap data={discoverAnalysis.constraints} />
                      </Card>
                    )}

                    {(discoverAnalysis.narrative?.layers?.length ?? 0) > 0 && (
                      <Card className="p-6">
                        <h3 className="font-bold text-lg mb-1">Narrative Divergence</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Language and sentiment differences across organisational layers
                        </p>
                        <NarrativeDivergence data={discoverAnalysis.narrative} />
                      </Card>
                    )}

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
              </div>
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
