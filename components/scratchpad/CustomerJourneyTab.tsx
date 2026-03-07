'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { AiInsightCard } from './AiInsightCard';
import LiveJourneyMap from '@/components/cognitive-guidance/live-journey-map';
import type { LiveJourneyData, LiveJourneyInteraction } from '@/lib/cognitive-guidance/pipeline';

interface Interaction {
  actor: string;
  stage: string;
  action: string;
  sentiment: 'positive' | 'neutral' | 'concerned' | 'critical';
  context: string;
  isPainPoint?: boolean;
  isMomentOfTruth?: boolean;
}

interface Actor {
  name: string;
  role: string;
}

interface JourneyData {
  stages: string[];
  actors: Actor[];
  interactions: Interaction[];
  painPointSummary?: string;
  momentOfTruthSummary?: string;
}

interface CustomerJourneyTabProps {
  data: any;
  onChange?: (data: any) => void;
}

const SENTIMENT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  positive: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  neutral: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' },
  concerned: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-400' },
};

function getSentimentStyle(sentiment: string) {
  return SENTIMENT_COLORS[sentiment] || SENTIMENT_COLORS.neutral;
}

export function CustomerJourneyTab({ data, onChange }: CustomerJourneyTabProps) {

  if (!data || typeof data !== 'object') {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No customer journey data yet. Generate a report from the Hemisphere to populate this tab.
        </p>
      </Card>
    );
  }

  const journey: JourneyData = {
    stages: Array.isArray(data.stages) ? data.stages : [],
    actors: Array.isArray(data.actors) ? data.actors : [],
    interactions: Array.isArray(data.interactions) ? data.interactions : [],
    painPointSummary: data.painPointSummary || '',
    momentOfTruthSummary: data.momentOfTruthSummary || '',
  };

  // Adapter: convert scratchpad JourneyData → LiveJourneyData for the output map
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const liveJourneyData: LiveJourneyData = useMemo(() => ({
    stages: journey.stages,
    actors: journey.actors.map((a) => ({ name: a.name, role: a.role, mentionCount: 0 })),
    interactions: journey.interactions.map((i, idx): LiveJourneyInteraction => ({
      id: `scratchpad-${idx}`,
      actor: i.actor,
      stage: i.stage,
      action: i.action,
      context: i.context || '',
      sentiment: i.sentiment,
      businessIntensity: 0.5,
      customerIntensity: 0.5,
      aiAgencyNow: 'human',
      aiAgencyFuture: 'assisted',
      isPainPoint: !!i.isPainPoint,
      isMomentOfTruth: !!i.isMomentOfTruth,
      sourceNodeIds: [],
      addedBy: 'ai',
      createdAtMs: Date.now(),
    })),
  }), [journey.stages, journey.actors, journey.interactions]);

  // Stats
  const painPointCount = journey.interactions.filter(i => i.isPainPoint).length;
  const motCount = journey.interactions.filter(i => i.isMomentOfTruth).length;

  return (
    <div className="space-y-12 bg-[#f8f4ec] -mx-8 -my-8 px-8 py-12 min-h-screen">
      {/* AI Executive Insight */}
      {data._aiSummary && <AiInsightCard summary={data._aiSummary} />}

      {/* Title */}
      <div className="bg-white rounded-3xl p-16 border-0 shadow-sm">
        <div className="inline-block px-4 py-1.5 rounded-full border border-black/10 text-[10px] uppercase tracking-[0.25em] text-black/40 mb-8 font-medium">
          CUSTOMER JOURNEY
        </div>
        <h1 className="text-7xl font-semibold mb-8 leading-[1.1] text-gray-900" style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}>
          Actor Journey Map
        </h1>
        <div className="space-y-4 max-w-4xl">
          <p className="text-lg text-gray-700 leading-relaxed">
            This journey map shows how different actors interact across the service stages. Each card represents an interaction — edit, add, or remove to refine the journey.
          </p>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span>{journey.actors.length} actors</span>
            <span>{journey.stages.length} stages</span>
            <span>{journey.interactions.length} interactions</span>
            {painPointCount > 0 && <span className="text-red-600">🔴 {painPointCount} pain points</span>}
            {motCount > 0 && <span className="text-amber-600">⭐ {motCount} moments of truth</span>}
          </div>
        </div>
      </div>

      {/* Live Journey Map (output mode) */}
      {liveJourneyData.interactions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
          <LiveJourneyMap
            data={liveJourneyData}
            mode="output"
          />
        </div>
      )}


      {/* Pain Points Summary */}
      {journey.painPointSummary && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-black/5">
          <div className="text-xs uppercase tracking-[0.15em] text-red-400 mb-4 font-medium">
            PAIN POINT ANALYSIS
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{journey.painPointSummary}</p>
        </div>
      )}

      {/* Moments of Truth Summary */}
      {journey.momentOfTruthSummary && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-black/5">
          <div className="text-xs uppercase tracking-[0.15em] text-amber-500 mb-4 font-medium">
            MOMENTS OF TRUTH
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{journey.momentOfTruthSummary}</p>
        </div>
      )}
    </div>
  );
}
