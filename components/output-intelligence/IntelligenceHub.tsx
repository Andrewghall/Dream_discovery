'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, Sparkles, RefreshCw, Loader2, CheckCircle2, AlertCircle, Clock,
  Bot, Zap, TrendingUp, AlertTriangle, Lightbulb, Target, Map, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EngineShell, type EngineStatus } from './EngineShell';
import { DiscoveryValidationPanel } from './DiscoveryValidationPanel';
import { RootCausePanel } from './RootCausePanel';
import { FutureStatePanel } from './FutureStatePanel';
import { ExecutionRoadmapPanel } from './ExecutionRoadmapPanel';
import { StrategicImpactPanel } from './StrategicImpactPanel';
import type {
  StoredOutputIntelligence,
  WorkshopOutputIntelligence,
  EngineKey,
} from '@/lib/output-intelligence/types';

// ── Signal config — DREAM cognitive function mapping ──────────────────────────

interface Signal {
  key: EngineKey;
  name: string;
  phase: string;
  color: 'indigo' | 'rose' | 'violet' | 'emerald' | 'amber';
  description: string;
  getMetric: (i: WorkshopOutputIntelligence) => string;
  Icon: React.ComponentType<{ className?: string }>;
}

const SIGNALS: Signal[] = [
  {
    key: 'discoveryValidation',
    name: 'PERCEPTION',
    phase: 'Discovery',
    color: 'indigo',
    description: 'How the organisation sees itself',
    getMetric: (i) => `${i.discoveryValidation.hypothesisAccuracy}% hypothesis confirmed`,
    Icon: Target,
  },
  {
    key: 'rootCause',
    name: 'INHIBITION',
    phase: 'Constraints',
    color: 'rose',
    description: 'Forces preventing transformation',
    getMetric: (i) => `${i.rootCause.rootCauses.length} systemic barriers`,
    Icon: AlertTriangle,
  },
  {
    key: 'futureState',
    name: 'IMAGINATION',
    phase: 'Reimagine',
    color: 'violet',
    description: 'What the future could be',
    getMetric: (i) => `${i.futureState.redesignPrinciples.length} design principles`,
    Icon: Lightbulb,
  },
  {
    key: 'strategicImpact',
    name: 'VISION',
    phase: 'Dream',
    color: 'emerald',
    description: 'The ideal future self',
    getMetric: (i) => `${i.strategicImpact.automationPotential.percentage}% automation potential`,
    Icon: TrendingUp,
  },
  {
    key: 'roadmap',
    name: 'EXECUTION',
    phase: 'Way Forward',
    color: 'amber',
    description: 'The transformation pathway',
    getMetric: () => '3-phase transformation roadmap',
    Icon: Map,
  },
];

const ENGINE_LABELS: Record<EngineKey, string> = {
  discoveryValidation: 'Perception Signal',
  rootCause: 'Inhibition Analysis',
  futureState: 'Imagination Output',
  roadmap: 'Execution Pathway',
  strategicImpact: 'Vision Metrics',
};

const SIGNAL_COLORS = {
  indigo: {
    bg: 'bg-indigo-50', border: 'border-indigo-200',
    text: 'text-indigo-700', accent: 'text-indigo-500',
    activeBg: 'bg-indigo-600', headerBg: 'bg-indigo-50/70',
  },
  rose: {
    bg: 'bg-rose-50', border: 'border-rose-200',
    text: 'text-rose-700', accent: 'text-rose-500',
    activeBg: 'bg-rose-600', headerBg: 'bg-rose-50/70',
  },
  violet: {
    bg: 'bg-violet-50', border: 'border-violet-200',
    text: 'text-violet-700', accent: 'text-violet-500',
    activeBg: 'bg-violet-600', headerBg: 'bg-violet-50/70',
  },
  emerald: {
    bg: 'bg-emerald-50', border: 'border-emerald-200',
    text: 'text-emerald-700', accent: 'text-emerald-500',
    activeBg: 'bg-emerald-600', headerBg: 'bg-emerald-50/70',
  },
  amber: {
    bg: 'bg-amber-50', border: 'border-amber-200',
    text: 'text-amber-700', accent: 'text-amber-500',
    activeBg: 'bg-amber-600', headerBg: 'bg-amber-50/70',
  },
} as const;

// ── Props ─────────────────────────────────────────────────────────────────────

interface IntelligenceHubProps {
  workshopId: string;
  initialStored: StoredOutputIntelligence | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IntelligenceHub({ workshopId, initialStored }: IntelligenceHubProps) {
  const [activeSignal, setActiveSignal] = useState<EngineKey>('discoveryValidation');
  const [stored, setStored] = useState<StoredOutputIntelligence | null>(initialStored);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [engineStatuses, setEngineStatuses] = useState<Record<EngineKey, EngineStatus>>({
    discoveryValidation: 'idle',
    rootCause: 'idle',
    futureState: 'idle',
    roadmap: 'idle',
    strategicImpact: 'idle',
  });
  const [engineErrors, setEngineErrors] = useState<Partial<Record<EngineKey, string>>>(
    initialStored?.errors ?? {}
  );

  const intelligence: WorkshopOutputIntelligence | null = stored?.intelligence ?? null;

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setStatusMessage('Connecting…');
    setEngineStatuses({
      discoveryValidation: 'idle',
      rootCause: 'idle',
      futureState: 'idle',
      roadmap: 'idle',
      strategicImpact: 'idle',
    });
    setEngineErrors({});

    try {
      const response = await fetch(`/api/admin/workshops/${workshopId}/output-intelligence`, {
        method: 'POST',
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = 'message';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr) as Record<string, unknown>;

            if (eventType === 'status') {
              setStatusMessage(String(data.message ?? ''));
            } else if (eventType === 'engine.started') {
              const engine = data.engine as EngineKey;
              setEngineStatuses((prev) => ({ ...prev, [engine]: 'running' }));
            } else if (eventType === 'engine.complete') {
              const engine = data.engine as EngineKey;
              setEngineStatuses((prev) => ({ ...prev, [engine]: 'complete' }));
            } else if (eventType === 'engine.error') {
              const engine = data.engine as EngineKey;
              setEngineStatuses((prev) => ({ ...prev, [engine]: 'error' }));
              const errDetail = String(data.error ?? '');
              if (errDetail) setEngineErrors((prev) => ({ ...prev, [engine]: errDetail }));
            } else if (eventType === 'partial.errors') {
              const errs = data.errors as Record<string, string> | undefined;
              if (errs) setEngineErrors((prev) => ({ ...prev, ...errs }));
            } else if (eventType === 'complete') {
              const incoming = data as {
                intelligence: WorkshopOutputIntelligence;
                lensesUsed: string[];
                generatedAtMs: number;
              };
              const newStored: StoredOutputIntelligence = {
                version: 1,
                generatedAtMs: incoming.generatedAtMs,
                lensesUsed: incoming.lensesUsed,
                signalsHash: '',
                intelligence: incoming.intelligence,
              };
              setStored(newStored);
              setStatusMessage('Brain scan complete ✓');
              setEngineStatuses((prev) => {
                const next = { ...prev };
                for (const k of Object.keys(next) as EngineKey[]) {
                  if (next[k] === 'running' || next[k] === 'idle') next[k] = 'complete';
                }
                return next;
              });
            } else if (eventType === 'error') {
              setStatusMessage(`Error: ${String(data.message ?? 'Unknown error')}`);
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      setStatusMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  }, [workshopId]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const hasIntelligence = !!intelligence;
  // Format client-side only to avoid SSR/client hydration mismatch (#418)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  useEffect(() => {
    if (stored?.generatedAtMs) {
      setGeneratedAt(new Date(stored.generatedAtMs).toLocaleString());
    }
  }, [stored?.generatedAtMs]);

  const activeSignalDef = SIGNALS.find((s) => s.key === activeSignal) ?? SIGNALS[0];
  const activeColors = SIGNAL_COLORS[activeSignalDef.color];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Brain className="h-5 w-5 text-indigo-500" />
            Organisational Brain Scan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Five cognitive signals derived from your workshop
          </p>
        </div>

        <div className="flex items-center gap-3">
          {generatedAt && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {generatedAt}
            </span>
          )}
          {statusMessage && !isGenerating && (
            <span className="text-xs text-slate-500">{statusMessage}</span>
          )}
          {isGenerating && statusMessage && (
            <span className="text-xs text-blue-600 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {statusMessage}
            </span>
          )}
          <Button
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
            size="sm"
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hasIntelligence ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? 'Scanning…' : hasIntelligence ? 'Regenerate' : 'Generate Brain Scan'}
          </Button>
        </div>
      </div>

      {/* ── Engine progress strip ─────────────────────────────────────────── */}
      {isGenerating && (
        <div className="shrink-0 px-6 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-5 flex-wrap">
            {SIGNALS.map((signal) => {
              const status = engineStatuses[signal.key];
              return (
                <div key={signal.key} className="flex items-center gap-1.5 text-xs">
                  {status === 'idle' && <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />}
                  {status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                  {status === 'complete' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  {status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                  <span className={
                    status === 'complete' ? 'text-emerald-600 font-medium' :
                    status === 'running' ? 'text-blue-600 font-medium' :
                    'text-slate-400'
                  }>
                    {ENGINE_LABELS[signal.key]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main scrollable content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">

          {/* ── Empty state ─────────────────────────────────────────────────── */}
          {!hasIntelligence && !isGenerating && (
            <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                <Brain className="h-8 w-8 text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">No brain scan yet</p>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">
                  Generate the Organisational Brain Scan to reveal five cognitive signals from your workshop.
                </p>
              </div>
              <Button onClick={() => void handleGenerate()} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Brain Scan
              </Button>
            </div>
          )}

          {/* ── Transformation Thesis — hero card ──────────────────────────── */}
          {intelligence && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 p-6 shadow-lg">
              <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-2">
                Transformation Thesis
              </p>
              <p className="text-base text-white leading-relaxed font-medium">
                {intelligence.strategicImpact.businessCaseSummary}
              </p>

              {/* Perception vs Vision tension */}
              <div className="mt-5 pt-5 border-t border-white/10">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Organisational Tension — Perception vs Vision
                </p>
                <div className="flex items-center gap-4">
                  <div className="text-right min-w-[70px]">
                    <p className="text-[10px] text-slate-400">Perception</p>
                    <p className="text-2xl font-bold text-indigo-300">
                      {intelligence.discoveryValidation.hypothesisAccuracy}%
                    </p>
                  </div>
                  <div className="flex-1 relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-indigo-400 rounded-full"
                      style={{ width: `${intelligence.discoveryValidation.hypothesisAccuracy}%` }}
                    />
                    <div
                      className="absolute right-0 top-0 h-full bg-emerald-400 rounded-full"
                      style={{ width: `${intelligence.strategicImpact.confidenceScore}%` }}
                    />
                  </div>
                  <div className="min-w-[70px]">
                    <p className="text-[10px] text-slate-400">Vision</p>
                    <p className="text-2xl font-bold text-emerald-300">
                      {intelligence.strategicImpact.confidenceScore}%
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center">
                  Gap reveals the energy driving transformation
                </p>
              </div>
            </div>
          )}

          {/* ── Five Cognitive Signal Cards ─────────────────────────────────── */}
          {(hasIntelligence || isGenerating) && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Cognitive Signals
              </p>
              <div className="grid grid-cols-5 gap-3">
                {SIGNALS.map((signal) => {
                  const colors = SIGNAL_COLORS[signal.color];
                  const isActive = activeSignal === signal.key;
                  const status = engineStatuses[signal.key];
                  const { Icon } = signal;

                  return (
                    <button
                      key={signal.key}
                      onClick={() => setActiveSignal(signal.key)}
                      className={`relative rounded-xl border p-4 text-left transition-all duration-150 ${
                        isActive
                          ? `${colors.activeBg} border-transparent shadow-lg scale-[1.02]`
                          : `${colors.bg} ${colors.border} hover:shadow-md hover:scale-[1.01]`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`h-4 w-4 ${isActive ? 'text-white/70' : colors.accent}`} />
                        {status === 'running' && (
                          <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                        )}
                        {status === 'complete' && intelligence && (
                          <CheckCircle2 className={`h-3 w-3 ${isActive ? 'text-white/50' : 'text-emerald-500'}`} />
                        )}
                        {status === 'error' && (
                          <AlertCircle className="h-3 w-3 text-amber-400" />
                        )}
                      </div>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${isActive ? 'text-white/60' : colors.accent}`}>
                        {signal.name}
                      </p>
                      <p className={`text-xs font-semibold mb-1.5 ${isActive ? 'text-white' : 'text-slate-800'}`}>
                        {signal.phase}
                      </p>
                      {intelligence ? (
                        <p className={`text-[10px] leading-snug ${isActive ? 'text-white/70' : 'text-slate-500'}`}>
                          {signal.getMetric(intelligence)}
                        </p>
                      ) : (
                        <p className={`text-[10px] leading-snug ${isActive ? 'text-white/50' : 'text-slate-400'}`}>
                          {signal.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Active Signal Detail Panel ──────────────────────────────────── */}
          {(hasIntelligence || isGenerating) && (
            <div>
              {SIGNALS.map((signal) => {
                if (signal.key !== activeSignal) return null;
                const colors = SIGNAL_COLORS[signal.color];
                const status: EngineStatus = !hasIntelligence
                  ? isGenerating && engineStatuses[signal.key] !== 'idle'
                    ? engineStatuses[signal.key]
                    : 'idle'
                  : 'complete';

                return (
                  <div key={signal.key}>
                    {/* Signal identity strip */}
                    <div className={`rounded-t-xl ${colors.headerBg} border ${colors.border} border-b-0 px-5 py-3 flex items-center gap-2`}>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${colors.accent}`}>
                        {signal.name}
                      </span>
                      <ChevronRight className={`h-3 w-3 ${colors.accent}`} />
                      <span className="text-xs font-medium text-slate-600">{signal.phase} Phase</span>
                      <span className="text-xs text-slate-400 ml-auto italic">{signal.description}</span>
                    </div>
                    <div className={`rounded-b-xl border ${colors.border} overflow-hidden`}>
                      <EngineShell
                        title={`${signal.name} — ${signal.phase}`}
                        description={signal.description}
                        status={status}
                      >
                        {intelligence && signal.key === 'discoveryValidation' && (
                          <DiscoveryValidationPanel data={intelligence.discoveryValidation} />
                        )}
                        {intelligence && signal.key === 'rootCause' && (
                          <RootCausePanel data={intelligence.rootCause} />
                        )}
                        {intelligence && signal.key === 'futureState' && (
                          <FutureStatePanel data={intelligence.futureState} />
                        )}
                        {intelligence && signal.key === 'roadmap' && (
                          <ExecutionRoadmapPanel data={intelligence.roadmap} />
                        )}
                        {intelligence && signal.key === 'strategicImpact' && (
                          <StrategicImpactPanel data={intelligence.strategicImpact} />
                        )}
                        {engineErrors[signal.key] && (
                          <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                            <p className="text-xs font-semibold text-amber-700 mb-1">
                              Engine failed — showing fallback data
                            </p>
                            <p className="text-xs text-amber-600 font-mono break-all">
                              {engineErrors[signal.key]}
                            </p>
                          </div>
                        )}
                      </EngineShell>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Contact Centre Domain Module ────────────────────────────────── */}
          {intelligence && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Contact Centre Domain Module
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-medium text-sky-600">
                  <Zap className="h-2.5 w-2.5" />
                  Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">

                {/* Contact Driver Analysis */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                    Contact Driver Analysis
                  </p>
                  <div className="space-y-3">
                    {intelligence.rootCause.rootCauses.slice(0, 5).map((rc, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-xs font-medium text-slate-700 leading-snug">{rc.cause}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{rc.category}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Operational Pressure Map */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                    Operational Pressure Map
                  </p>
                  <div className="space-y-2.5">
                    {intelligence.rootCause.frictionMap.slice(0, 6).map((fm, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-600 truncate pr-2">{fm.stage}</span>
                          <span className="text-[10px] font-bold text-slate-700 shrink-0">{fm.frictionLevel}/10</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              fm.frictionLevel >= 8 ? 'bg-rose-400' :
                              fm.frictionLevel >= 5 ? 'bg-amber-400' :
                              'bg-emerald-400'
                            }`}
                            style={{ width: `${fm.frictionLevel * 10}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workforce Model */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-violet-500" />
                    Workforce Model
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded-lg bg-rose-50 border border-rose-100 p-3 text-center">
                      <p className="text-xl font-bold text-rose-600">
                        {intelligence.strategicImpact.automationPotential.percentage}%
                      </p>
                      <p className="text-[10px] text-rose-500 font-medium mt-0.5">AI Only</p>
                    </div>
                    <div className="rounded-lg bg-violet-50 border border-violet-100 p-3 text-center">
                      <p className="text-xl font-bold text-violet-600">
                        {intelligence.strategicImpact.aiAssistedWork.percentage}%
                      </p>
                      <p className="text-[10px] text-violet-500 font-medium mt-0.5">AI Assisted</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
                      <p className="text-xl font-bold text-slate-600">
                        {intelligence.strategicImpact.humanOnlyWork.percentage}%
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">Human Only</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {intelligence.futureState.aiHumanModel.slice(0, 5).map((task, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          task.recommendation === 'AI Only'
                            ? 'bg-rose-100 text-rose-600'
                            : task.recommendation === 'AI Assisted'
                            ? 'bg-violet-100 text-violet-600'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {task.recommendation}
                        </span>
                        <span className="text-[10px] text-slate-600 truncate">{task.task}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Future Contact Centre Model */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-emerald-500" />
                    Future Contact Centre Model
                  </p>
                  <div className="space-y-3">
                    {intelligence.futureState.operatingModelChanges.slice(0, 4).map((change, i) => (
                      <div key={i} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          {change.area}
                        </p>
                        <div className="flex items-start gap-1.5 mb-1">
                          <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">Now</span>
                          <span className="text-[10px] text-slate-500 line-through leading-snug">{change.currentState}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-[10px] text-emerald-500 font-bold shrink-0 mt-0.5">→</span>
                          <span className="text-[10px] text-slate-700 font-medium leading-snug">{change.futureState}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
