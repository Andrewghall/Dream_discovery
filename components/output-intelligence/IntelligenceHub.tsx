'use client';

import { useState, useCallback } from 'react';
import { Sparkles, RefreshCw, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
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

// ── Tab config ────────────────────────────────────────────────────────────────

interface Tab {
  key: EngineKey;
  label: string;
  description: string;
}

const TABS: Tab[] = [
  {
    key: 'discoveryValidation',
    label: 'Discovery Validation',
    description: 'How well did workshop findings match the discovery hypothesis?',
  },
  {
    key: 'rootCause',
    label: 'Root Cause',
    description: 'Systemic causes behind the organisation\'s challenges',
  },
  {
    key: 'futureState',
    label: 'Future State',
    description: 'Target operating model and AI/human redesign',
  },
  {
    key: 'roadmap',
    label: 'Roadmap',
    description: 'Phased transformation plan from vision to delivery',
  },
  {
    key: 'strategicImpact',
    label: 'Strategic Impact',
    description: 'Automation potential, efficiency gains, and business case',
  },
];

const ENGINE_LABELS: Record<EngineKey, string> = {
  discoveryValidation: 'Discovery Validation',
  rootCause: 'Root Cause Intelligence',
  futureState: 'Future State Design',
  roadmap: 'Execution Roadmap',
  strategicImpact: 'Strategic Impact',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface IntelligenceHubProps {
  workshopId: string;
  initialStored: StoredOutputIntelligence | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IntelligenceHub({ workshopId, initialStored }: IntelligenceHubProps) {
  const [activeTab, setActiveTab] = useState<EngineKey>('discoveryValidation');
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
              // Surface the actual error message so we can diagnose
              const errDetail = String(data.error ?? '');
              if (errDetail) setStatusMessage(`Engine error (${engine}): ${errDetail}`);
            } else if (eventType === 'partial.errors') {
              const errs = data.errors as Record<string, string> | undefined;
              if (errs) {
                const msgs = Object.entries(errs).map(([k, v]) => `${k}: ${v}`).join(' | ');
                setStatusMessage(`Partial errors — ${msgs}`);
              }
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
              setStatusMessage('Intelligence generated ✓');
              // Only promote 'running' engines to 'complete' — leave 'error' statuses as-is
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
      setStatusMessage(
        `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsGenerating(false);
    }
  }, [workshopId]);

  // ── Render ────────────────────────────────────────────────────────────────

  const hasIntelligence = !!intelligence;
  const generatedAt = stored?.generatedAtMs
    ? new Date(stored.generatedAtMs).toLocaleString()
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            5-stage agentic analysis of your workshop signals
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
            {isGenerating ? 'Generating…' : hasIntelligence ? 'Regenerate' : 'Generate Intelligence'}
          </Button>
        </div>
      </div>

      {/* Engine progress strip (shown during generation) */}
      {isGenerating && (
        <div className="shrink-0 px-6 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-4 flex-wrap">
            {TABS.map((tab) => {
              const status = engineStatuses[tab.key];
              return (
                <div key={tab.key} className="flex items-center gap-1.5 text-xs">
                  {status === 'idle' && (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                  )}
                  {status === 'running' && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  )}
                  {status === 'complete' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  {status === 'error' && (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span
                    className={
                      status === 'complete'
                        ? 'text-emerald-600 font-medium'
                        : status === 'running'
                        ? 'text-blue-600 font-medium'
                        : 'text-slate-400'
                    }
                  >
                    {ENGINE_LABELS[tab.key]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="shrink-0 px-6 border-b border-slate-200 bg-white">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => {
            const status = engineStatuses[tab.key];
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {status === 'running' && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                )}
                {status === 'complete' && intelligence && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto p-6">
        {TABS.map((tab) => {
          if (tab.key !== activeTab) return null;
          const status: EngineStatus = !hasIntelligence
            ? isGenerating && engineStatuses[tab.key] !== 'idle'
              ? engineStatuses[tab.key]
              : 'idle'
            : 'complete';

          return (
            <EngineShell
              key={tab.key}
              title={tab.label}
              description={tab.description}
              status={status}
            >
              {intelligence && tab.key === 'discoveryValidation' && (
                <DiscoveryValidationPanel data={intelligence.discoveryValidation} />
              )}
              {intelligence && tab.key === 'rootCause' && (
                <RootCausePanel data={intelligence.rootCause} />
              )}
              {intelligence && tab.key === 'futureState' && (
                <FutureStatePanel data={intelligence.futureState} />
              )}
              {intelligence && tab.key === 'roadmap' && (
                <ExecutionRoadmapPanel data={intelligence.roadmap} />
              )}
              {intelligence && tab.key === 'strategicImpact' && (
                <StrategicImpactPanel data={intelligence.strategicImpact} />
              )}
            </EngineShell>
          );
        })}
      </div>
    </div>
  );
}
