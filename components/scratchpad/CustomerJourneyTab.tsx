'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AiInsightCard } from './AiInsightCard';

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
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Interaction>>({});

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

  // Get interactions for a specific actor+stage cell
  const getInteractions = (actorName: string, stageName: string): Interaction[] => {
    return journey.interactions.filter(
      (i) => i.actor.toLowerCase() === actorName.toLowerCase() && i.stage.toLowerCase() === stageName.toLowerCase()
    );
  };

  // Edit handlers
  const startEdit = (interaction: Interaction, idx: number) => {
    setEditingCell(`${interaction.actor}:${interaction.stage}:${idx}`);
    setEditForm({ ...interaction });
  };

  const saveEdit = () => {
    if (!editingCell || !editForm.actor || !editForm.stage) return;
    const [actorName, stageName, idxStr] = editingCell.split(':');
    const idx = parseInt(idxStr, 10);
    const updated = { ...data };
    const interactions = [...(updated.interactions || [])];

    // Find matching interactions for this cell
    let cellIdx = 0;
    for (let i = 0; i < interactions.length; i++) {
      if (interactions[i].actor.toLowerCase() === actorName.toLowerCase() &&
          interactions[i].stage.toLowerCase() === stageName.toLowerCase()) {
        if (cellIdx === idx) {
          interactions[i] = { ...interactions[i], ...editForm };
          break;
        }
        cellIdx++;
      }
    }
    updated.interactions = interactions;
    onChange?.(updated);
    setEditingCell(null);
    setEditForm({});
  };

  const addInteraction = (actorName: string, stageName: string) => {
    const updated = { ...data };
    const interactions = [...(updated.interactions || [])];
    interactions.push({
      actor: actorName,
      stage: stageName,
      action: 'New interaction',
      sentiment: 'neutral',
      context: '',
      isPainPoint: false,
      isMomentOfTruth: false,
    });
    updated.interactions = interactions;
    onChange?.(updated);
  };

  const removeInteraction = (actorName: string, stageName: string, cellIdx: number) => {
    const updated = { ...data };
    const interactions = [...(updated.interactions || [])];
    let count = 0;
    for (let i = 0; i < interactions.length; i++) {
      if (interactions[i].actor.toLowerCase() === actorName.toLowerCase() &&
          interactions[i].stage.toLowerCase() === stageName.toLowerCase()) {
        if (count === cellIdx) {
          interactions.splice(i, 1);
          break;
        }
        count++;
      }
    }
    updated.interactions = interactions;
    onChange?.(updated);
  };

  // Stats
  const painPointCount = journey.interactions.filter(i => i.isPainPoint).length;
  const motCount = journey.interactions.filter(i => i.isMomentOfTruth).length;
  const sentimentCounts = journey.interactions.reduce((acc, i) => {
    acc[i.sentiment] = (acc[i.sentiment] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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

      {/* Sentiment Legend */}
      <div className="flex items-center gap-6">
        {Object.entries(SENTIMENT_COLORS).map(([key, style]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${style.dot}`} />
            <span className="text-xs text-gray-500 capitalize">{key} ({sentimentCounts[key] || 0})</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-sm">●</span>
          <span className="text-xs text-gray-500">Pain Point</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-500 text-sm">★</span>
          <span className="text-xs text-gray-500">Moment of Truth</span>
        </div>
      </div>

      {/* Swim-lane Grid */}
      {journey.stages.length > 0 && journey.actors.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[900px]"
              style={{
                gridTemplateColumns: `180px repeat(${journey.stages.length}, minmax(160px, 1fr))`,
              }}
            >
              {/* Header row — stages */}
              <div className="bg-slate-50 p-4 border-b border-r border-slate-100 sticky left-0 z-10" />
              {journey.stages.map((stage, idx) => (
                <div key={idx} className="bg-slate-50 p-4 border-b border-r border-slate-100 text-center">
                  <div className="text-xs font-semibold text-gray-900 uppercase tracking-wider">{stage}</div>
                  <div className="text-[10px] text-gray-400 mt-1">Stage {idx + 1}</div>
                </div>
              ))}

              {/* Actor rows */}
              {journey.actors.map((actor, actorIdx) => (
                <>
                  {/* Actor name cell */}
                  <div
                    key={`actor-${actorIdx}`}
                    className="bg-slate-50 p-4 border-b border-r border-slate-100 sticky left-0 z-10"
                  >
                    <div className="text-sm font-semibold text-gray-900">{actor.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{actor.role}</div>
                  </div>

                  {/* Interaction cells */}
                  {journey.stages.map((stage, stageIdx) => {
                    const cellInteractions = getInteractions(actor.name, stage);
                    return (
                      <div
                        key={`cell-${actorIdx}-${stageIdx}`}
                        className="p-2 border-b border-r border-slate-100 min-h-[80px]"
                      >
                        <div className="space-y-1.5">
                          {cellInteractions.map((interaction, idx) => {
                            const style = getSentimentStyle(interaction.sentiment);
                            const cellKey = `${interaction.actor}:${interaction.stage}:${idx}`;
                            const isEditing = editingCell === cellKey;

                            if (isEditing) {
                              return (
                                <div key={idx} className="p-2 rounded-lg border-2 border-blue-300 bg-blue-50 space-y-2">
                                  <input
                                    className="w-full text-xs p-1 rounded border border-blue-200 bg-white"
                                    value={editForm.action || ''}
                                    onChange={(e) => setEditForm({ ...editForm, action: e.target.value })}
                                    placeholder="Action..."
                                  />
                                  <input
                                    className="w-full text-xs p-1 rounded border border-blue-200 bg-white"
                                    value={editForm.context || ''}
                                    onChange={(e) => setEditForm({ ...editForm, context: e.target.value })}
                                    placeholder="Context..."
                                  />
                                  <select
                                    className="w-full text-xs p-1 rounded border border-blue-200 bg-white"
                                    value={editForm.sentiment || 'neutral'}
                                    onChange={(e) => setEditForm({ ...editForm, sentiment: e.target.value as Interaction['sentiment'] })}
                                  >
                                    <option value="positive">Positive</option>
                                    <option value="neutral">Neutral</option>
                                    <option value="concerned">Concerned</option>
                                    <option value="critical">Critical</option>
                                  </select>
                                  <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1 text-[10px]">
                                      <input
                                        type="checkbox"
                                        checked={!!editForm.isPainPoint}
                                        onChange={(e) => setEditForm({ ...editForm, isPainPoint: e.target.checked })}
                                      />
                                      Pain Point
                                    </label>
                                    <label className="flex items-center gap-1 text-[10px]">
                                      <input
                                        type="checkbox"
                                        checked={!!editForm.isMomentOfTruth}
                                        onChange={(e) => setEditForm({ ...editForm, isMomentOfTruth: e.target.checked })}
                                      />
                                      Moment of Truth
                                    </label>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button size="sm" className="h-6 text-[10px] px-2" onClick={saveEdit}>Save</Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setEditingCell(null)}>Cancel</Button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={idx}
                                className={`group relative p-2 rounded-lg border ${style.bg} ${style.border} cursor-pointer hover:shadow-md transition-shadow`}
                                onClick={() => startEdit(interaction, idx)}
                              >
                                {interaction.isPainPoint && (
                                  <span className="absolute -top-1 -left-1 text-[10px]" title="Pain Point">🔴</span>
                                )}
                                {interaction.isMomentOfTruth && (
                                  <span className="absolute -top-1 -right-1 text-[10px]" title="Moment of Truth">⭐</span>
                                )}
                                <div className={`text-[11px] font-medium ${style.text} leading-tight`}>
                                  {interaction.action}
                                </div>
                                {interaction.context && (
                                  <div className="text-[9px] text-gray-400 mt-0.5 line-clamp-2">{interaction.context}</div>
                                )}
                                <button
                                  className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-[10px]"
                                  onClick={(e) => { e.stopPropagation(); removeInteraction(actor.name, stage, idx); }}
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                          <button
                            className="w-full p-1 rounded border border-dashed border-slate-200 text-[10px] text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                            onClick={() => addInteraction(actor.name, stage)}
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
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
