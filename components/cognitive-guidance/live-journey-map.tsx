'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  LiveJourneyData,
  LiveJourneyInteraction,
  LiveJourneyActor,
  AiAgencyLevel,
  JourneyConstraintFlag,
} from '@/lib/cognitive-guidance/pipeline';

// ══════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════

const SENTIMENT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  positive:  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  neutral:   { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-600',   dot: 'bg-slate-400' },
  concerned: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  critical:  { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-400' },
};

const AI_AGENCY_ICONS: Record<AiAgencyLevel, { icon: string; label: string; badgeColor: string }> = {
  human:      { icon: '👤', label: 'Human', badgeColor: 'bg-slate-200 text-slate-600' },
  assisted:   { icon: '🤝', label: 'Assisted', badgeColor: 'bg-blue-100 text-blue-700' },
  autonomous: { icon: '🤖', label: 'Autonomous', badgeColor: 'bg-emerald-100 text-emerald-700' },
};

const INTENSITY_LEVELS = [0.25, 0.5, 0.75, 1.0];

const CONSTRAINT_SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blocking:    { bg: 'bg-red-100',   text: 'text-red-700',   border: 'border-red-300' },
  significant: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  manageable:  { bg: 'bg-gray-100',  text: 'text-gray-600',  border: 'border-gray-300' },
};

function getSentimentStyle(sentiment: string) {
  return SENTIMENT_COLORS[sentiment] || SENTIMENT_COLORS.neutral;
}

// ══════════════════════════════════════════════════════════
// PROPS
// ══════════════════════════════════════════════════════════

type Props = {
  data: LiveJourneyData;
  onChange?: (data: LiveJourneyData) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** 'live' = full editing controls (default), 'output' = read-only clean display */
  mode?: 'live' | 'output';
  /** Called when user clicks Regenerate — parent handles API call */
  onRegenerate?: () => Promise<void>;
};

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════

export default function LiveJourneyMap({ data, onChange, expanded = true, onToggleExpand, mode = 'live', onRegenerate }: Props) {
  const isOutput = mode === 'output';
  const [regenerating, setRegenerating] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LiveJourneyInteraction>>({});
  const [addingActor, setAddingActor] = useState(false);
  const [newActorName, setNewActorName] = useState('');
  const [newActorRole, setNewActorRole] = useState('');
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [editStageValue, setEditStageValue] = useState('');

  const { stages, actors, interactions } = data;

  // Stats
  const painPointCount = interactions.filter(i => i.isPainPoint).length;
  const motCount = interactions.filter(i => i.isMomentOfTruth).length;
  const sentimentCounts = interactions.reduce((acc, i) => {
    acc[i.sentiment] = (acc[i.sentiment] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── Helpers ──────────────────────────────────────────────

  function getInteractions(actorName: string, stageName: string): LiveJourneyInteraction[] {
    return interactions.filter(
      i => i.actor.toLowerCase() === actorName.toLowerCase() && i.stage.toLowerCase() === stageName.toLowerCase()
    );
  }

  const safeOnChange = (newData: LiveJourneyData) => {
    if (onChange) onChange(newData);
  };

  function updateInteraction(interactionId: string, updates: Partial<LiveJourneyInteraction>) {
    safeOnChange({
      ...data,
      interactions: interactions.map(i =>
        i.id === interactionId ? { ...i, ...updates } : i
      ),
    });
  }

  function addInteraction(actorName: string, stageName: string) {
    const newInteraction: LiveJourneyInteraction = {
      id: `fac:${Date.now()}:${actorName}:${stageName}`,
      actor: actorName,
      stage: stageName,
      action: 'New interaction',
      context: '',
      sentiment: 'neutral',
      businessIntensity: 0.5,
      customerIntensity: 0.5,
      aiAgencyNow: 'human',
      aiAgencyFuture: 'assisted',
      isPainPoint: false,
      isMomentOfTruth: false,
      sourceNodeIds: [],
      addedBy: 'facilitator',
      createdAtMs: Date.now(),
    };
    safeOnChange({
      ...data,
      interactions: [...interactions, newInteraction],
    });
  }

  function removeInteraction(interactionId: string) {
    safeOnChange({
      ...data,
      interactions: interactions.filter(i => i.id !== interactionId),
    });
  }

  function addActor() {
    if (!newActorName.trim()) return;
    const actor: LiveJourneyActor = {
      name: newActorName.trim(),
      role: newActorRole.trim() || 'Participant',
      mentionCount: 0,
    };
    safeOnChange({
      ...data,
      actors: [...actors, actor],
    });
    setAddingActor(false);
    setNewActorName('');
    setNewActorRole('');
  }

  function renameStage(idx: number) {
    if (!editStageValue.trim()) return;
    const newStages = [...stages];
    // Update all interactions that reference the old stage name
    const oldName = newStages[idx];
    newStages[idx] = editStageValue.trim();
    safeOnChange({
      ...data,
      stages: newStages,
      interactions: interactions.map(i =>
        i.stage.toLowerCase() === oldName.toLowerCase()
          ? { ...i, stage: editStageValue.trim() }
          : i
      ),
    });
    setEditingStage(null);
    setEditStageValue('');
  }

  function addStage(afterIndex: number) {
    const newStages = [...stages];
    const newStageName = `Stage ${stages.length + 1}`;
    newStages.splice(afterIndex + 1, 0, newStageName);
    safeOnChange({ ...data, stages: newStages });
    // Immediately enter edit mode for the new stage
    setEditingStage(afterIndex + 1);
    setEditStageValue(newStageName);
  }

  function deleteStage(idx: number) {
    const stageName = stages[idx];
    const stageInteractions = interactions.filter(
      i => i.stage.toLowerCase() === stageName.toLowerCase()
    );
    if (stageInteractions.length > 0) {
      if (!window.confirm(`Delete stage "${stageName}" and its ${stageInteractions.length} interaction(s)?`)) {
        return;
      }
    }
    const newStages = stages.filter((_, i) => i !== idx);
    const newInteractions = interactions.filter(
      i => i.stage.toLowerCase() !== stageName.toLowerCase()
    );
    safeOnChange({ ...data, stages: newStages, interactions: newInteractions });
  }

  function reorderStage(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= stages.length) return;
    const newStages = [...stages];
    const [moved] = newStages.splice(fromIdx, 1);
    newStages.splice(toIdx, 0, moved);
    safeOnChange({ ...data, stages: newStages });
  }

  function deleteActor(actorIdx: number) {
    const actorName = actors[actorIdx].name;
    const actorInteractions = interactions.filter(
      i => i.actor.toLowerCase() === actorName.toLowerCase()
    );
    if (actorInteractions.length > 0) {
      if (!window.confirm(`Delete actor "${actorName}" and their ${actorInteractions.length} interaction(s)?`)) {
        return;
      }
    }
    const newActors = actors.filter((_, i) => i !== actorIdx);
    const newInteractions = interactions.filter(
      i => i.actor.toLowerCase() !== actorName.toLowerCase()
    );
    safeOnChange({ ...data, actors: newActors, interactions: newInteractions });
  }

  function reorderActor(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= actors.length) return;
    const newActors = [...actors];
    const [moved] = newActors.splice(fromIdx, 1);
    newActors.splice(toIdx, 0, moved);
    safeOnChange({ ...data, actors: newActors });
  }

  // ── Edit handlers ────────────────────────────────────────

  function startEdit(interaction: LiveJourneyInteraction) {
    setEditingCell(interaction.id);
    setEditForm({ ...interaction });
  }

  function saveEdit() {
    if (!editingCell) return;
    updateInteraction(editingCell, editForm);
    setEditingCell(null);
    setEditForm({});
  }

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header bar */}
      {isOutput ? (
        <div className="flex items-center gap-2 w-full px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Customer Journey Map</h3>
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-muted text-[11px] font-medium">
            {actors.length} actors
          </span>
          <span className="text-[11px] text-muted-foreground">
            {stages.length} stages &middot; {interactions.length} interactions
          </span>
          {painPointCount > 0 && (
            <span className="text-[11px] text-red-600 font-medium">
              &bull; {painPointCount} pain point{painPointCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      ) : (
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 w-full px-4 py-3 hover:bg-muted/50 transition-colors"
        >
          <h3 className="text-sm font-semibold text-foreground">Live Journey Map</h3>
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-muted text-[11px] font-medium">
            {actors.length} actors
          </span>
          <span className="text-[11px] text-muted-foreground">
            {stages.length} stages &middot; {interactions.length} interactions
          </span>
          {painPointCount > 0 && (
            <span className="text-[11px] text-red-600 font-medium">
              &bull; {painPointCount} pain point{painPointCount !== 1 ? 's' : ''}
            </span>
          )}
          {motCount > 0 && (
            <span className="text-[11px] text-amber-600 font-medium">
              &bull; {motCount} moment{motCount !== 1 ? 's' : ''} of truth
            </span>
          )}
          <span className="ml-auto text-muted-foreground">
            {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </span>
        </button>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t">
          {/* Legend + Add Actor */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
            <div className="flex items-center gap-4 flex-wrap">
              {Object.entries(SENTIMENT_COLORS).map(([key, style]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                  <span className="text-[10px] text-muted-foreground capitalize">{key} ({sentimentCounts[key] || 0})</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="text-red-500 text-[10px]">●</span>
                <span className="text-[10px] text-muted-foreground">Pain Point</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-500 text-[10px]">★</span>
                <span className="text-[10px] text-muted-foreground">Moment of Truth</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-2">
                {Object.entries(AI_AGENCY_ICONS).map(([key, val]) => (
                  <span key={key} className="text-[10px] text-muted-foreground">
                    {val.icon} {val.label}
                  </span>
                ))}
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 border border-emerald-600/30" />
                <span className="text-[10px] text-muted-foreground">Enriched</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">🛡️</span>
                <span className="text-[10px] text-muted-foreground">Governance</span>
              </div>
            </div>
            {!isOutput && (
              <div className="flex items-center gap-2">
                {onRegenerate && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={regenerating}
                    onClick={async () => {
                      setRegenerating(true);
                      try { await onRegenerate(); } finally { setRegenerating(false); }
                    }}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${regenerating ? 'animate-spin' : ''}`} />
                    {regenerating ? 'Regenerating…' : 'Regenerate'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setAddingActor(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Actor
                </Button>
              </div>
            )}
          </div>

          {/* Add Actor Form */}
          {addingActor && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-t border-blue-100">
              <input
                className="text-xs px-2 py-1 rounded border border-blue-200 bg-white flex-1"
                placeholder="Actor name..."
                value={newActorName}
                onChange={e => setNewActorName(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && addActor()}
              />
              <input
                className="text-xs px-2 py-1 rounded border border-blue-200 bg-white flex-1"
                placeholder="Role..."
                value={newActorRole}
                onChange={e => setNewActorRole(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addActor()}
              />
              <Button size="sm" className="h-7 text-xs" onClick={addActor}>Add</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingActor(false)}>Cancel</Button>
            </div>
          )}

          {/* Grid */}
          {stages.length > 0 && (
            <div className="w-full">
              <div
                className="grid w-full"
                style={{
                  gridTemplateColumns: `90px repeat(${stages.length}, minmax(0, 1fr))`,
                }}
              >
                {/* Header row — stages */}
                <div className="bg-muted/50 p-3 border-b border-r sticky left-0 z-10">
                  {!isOutput && (
                    <button
                      className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => addStage(-1)}
                      title="Insert stage at start"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {stages.map((stage, idx) => (
                  <div key={idx} className="bg-muted/50 p-1.5 border-b border-r text-center group/stage relative">
                    {!isOutput && editingStage === idx ? (
                      <div className="flex items-center gap-1">
                        <input
                          className="text-xs px-1.5 py-0.5 rounded border bg-white flex-1 text-center font-semibold uppercase"
                          value={editStageValue}
                          onChange={e => setEditStageValue(e.target.value)}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') renameStage(idx);
                            if (e.key === 'Escape') setEditingStage(null);
                          }}
                          onBlur={() => renameStage(idx)}
                        />
                      </div>
                    ) : (
                      <>
                        <div
                          className={isOutput ? '' : 'cursor-pointer'}
                          onClick={isOutput ? undefined : () => { setEditingStage(idx); setEditStageValue(stage); }}
                        >
                          <div className={`text-[10px] font-semibold text-foreground uppercase tracking-wider ${isOutput ? '' : 'group-hover/stage:text-blue-600'} transition-colors leading-tight`}>
                            {stage}
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">Stage {idx + 1}</div>
                        </div>

                        {/* Stage controls — visible on hover (live mode only) */}
                        {!isOutput && <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 opacity-0 group-hover/stage:opacity-100 transition-opacity">
                          {idx > 0 && (
                            <button
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              onClick={(e) => { e.stopPropagation(); reorderStage(idx, idx - 1); }}
                              title="Move left"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            className="p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                            onClick={(e) => { e.stopPropagation(); deleteStage(idx); }}
                            title={`Delete "${stage}"`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {idx < stages.length - 1 && (
                            <button
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              onClick={(e) => { e.stopPropagation(); reorderStage(idx, idx + 1); }}
                              title="Move right"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            className="p-0.5 rounded hover:bg-blue-100 text-muted-foreground hover:text-blue-600 transition-colors"
                            onClick={(e) => { e.stopPropagation(); addStage(idx); }}
                            title="Add stage after"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>}
                      </>
                    )}
                  </div>
                ))}

                {/* Actor rows */}
                {actors.map((actor, actorIdx) => (
                  <div key={actorIdx} className="contents">
                    {/* Actor name cell */}
                    <div className="bg-muted/30 p-1.5 border-b border-r sticky left-0 z-10 group/actor relative">
                      <div className="text-[10px] font-semibold text-foreground leading-tight">{actor.name}</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{actor.role}</div>
                      {/* Actor controls — live mode only */}
                      {!isOutput && (
                        <div className="absolute right-0.5 top-0 bottom-0 flex flex-col items-center justify-center gap-0 opacity-0 group-hover/actor:opacity-100 transition-opacity">
                          {actorIdx > 0 && (
                            <button
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => reorderActor(actorIdx, actorIdx - 1)}
                              title="Move up"
                            >
                              <ChevronUp className="h-2.5 w-2.5" />
                            </button>
                          )}
                          <button
                            className="p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                            onClick={() => deleteActor(actorIdx)}
                            title={`Delete "${actor.name}"`}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                          {actorIdx < actors.length - 1 && (
                            <button
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => reorderActor(actorIdx, actorIdx + 1)}
                              title="Move down"
                            >
                              <ChevronDown className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Interaction cells */}
                    {stages.map((stage, stageIdx) => {
                      const cellInteractions = getInteractions(actor.name, stage);
                      return (
                        <div
                          key={`cell-${actorIdx}-${stageIdx}`}
                          className={`${isOutput ? 'p-1' : 'p-1.5'} border-b border-r ${isOutput ? 'min-h-[36px]' : 'min-h-[60px]'}`}
                        >
                          <div className={`${isOutput ? 'space-y-1' : 'space-y-1.5'}`}>
                            {cellInteractions.map((interaction) => {
                              const isEditing = !isOutput && editingCell === interaction.id;

                              if (isEditing) {
                                return (
                                  <EditForm
                                    key={interaction.id}
                                    editForm={editForm}
                                    setEditForm={setEditForm}
                                    onSave={saveEdit}
                                    onCancel={() => setEditingCell(null)}
                                  />
                                );
                              }

                              // Output mode: compact chip — no intensity bars, no badges
                              if (isOutput) {
                                const chipStyle = getSentimentStyle(interaction.sentiment);
                                return (
                                  <div
                                    key={interaction.id}
                                    className={`relative p-1 rounded border ${chipStyle.bg} ${chipStyle.border}`}
                                  >
                                    {interaction.isPainPoint && (
                                      <span className="absolute -top-1 -left-1 text-[9px]" title="Pain Point">🔴</span>
                                    )}
                                    {interaction.isMomentOfTruth && (
                                      <span className="absolute -top-1 -right-1 text-[9px]" title="Moment of Truth">⭐</span>
                                    )}
                                    <div className={`text-[9px] font-medium ${chipStyle.text} leading-tight line-clamp-2`}>
                                      {interaction.action}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <InteractionCard
                                  key={interaction.id}
                                  interaction={interaction}
                                  readOnly={false}
                                  onEdit={() => startEdit(interaction)}
                                  onRemove={() => removeInteraction(interaction.id)}
                                  onUpdateIntensity={(field, value) => updateInteraction(interaction.id, { [field]: value })}
                                  onSetAiAgency={(field, value) => {
                                    updateInteraction(interaction.id, { [field]: value });
                                  }}
                                />
                              );
                            })}
                            {!isOutput && (
                              <button
                                className="w-full p-1 rounded border border-dashed border-muted-foreground/20 text-[10px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                                onClick={() => addInteraction(actor.name, stage)}
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Empty state when no actors */}
                {actors.length === 0 && (
                  <div className="col-span-full flex items-center justify-center py-12">
                    <p className="text-sm text-muted-foreground italic">
                      Actors will appear as they are mentioned in conversation, or add one manually above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// INTERACTION CARD
// ══════════════════════════════════════════════════════════

function InteractionCard({
  interaction,
  readOnly = false,
  onEdit,
  onRemove,
  onUpdateIntensity,
  onSetAiAgency,
}: {
  interaction: LiveJourneyInteraction;
  readOnly?: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onUpdateIntensity: (field: 'businessIntensity' | 'customerIntensity', value: number) => void;
  onSetAiAgency: (field: 'aiAgencyNow' | 'aiAgencyFuture', value: AiAgencyLevel) => void;
}) {
  const style = getSentimentStyle(interaction.sentiment);

  // Emotional weight heatmap: combined intensity drives border colour
  const combinedIntensity = (interaction.businessIntensity + interaction.customerIntensity) / 2;
  const intensityStyle = combinedIntensity > 0.7
    ? 'ring-1 ring-red-300/40'
    : combinedIntensity > 0.5
      ? 'ring-1 ring-amber-300/30'
      : '';

  // Governance overlay: has regulatory constraint flags
  const hasGovernance = interaction.constraintFlags?.some(f => f.type === 'regulatory');

  // AI boundary badge: show when enriched (not default 'human'→'human')
  const isEnriched = interaction.aiAgencyNow !== 'human' || interaction.aiAgencyFuture !== 'human'
    || interaction.businessIntensity !== 0.5 || interaction.customerIntensity !== 0.5;

  return (
    <div
      className={`group relative p-1 rounded border ${style.bg} ${style.border} ${intensityStyle} ${isEnriched ? 'animate-enrichment-pulse' : ''} ${readOnly ? '' : 'cursor-pointer hover:shadow-md'} transition-all animate-in fade-in duration-300`}
      onClick={readOnly ? undefined : onEdit}
    >
      {/* Pain point / moment of truth markers */}
      {interaction.isPainPoint && (
        <span className="absolute -top-1 -left-1 text-[8px]" title="Pain Point">🔴</span>
      )}
      {interaction.isMomentOfTruth && (
        <span className="absolute -top-1 -right-1 text-[8px]" title="Moment of Truth">⭐</span>
      )}

      {/* Enrichment indicator */}
      {isEnriched && (
        <span
          className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-emerald-400 border border-emerald-600/30"
          title="AI-enriched interaction"
        />
      )}

      {/* Remove button (live mode only) */}
      {!readOnly && (
        <button
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 z-10"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Action + context */}
      <div className={`text-[10px] font-semibold ${style.text} leading-tight pr-3`}>
        {interaction.action}
      </div>
      {interaction.context && (
        <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight line-clamp-1">{interaction.context}</div>
      )}

      {/* Constraint badges */}
      {interaction.constraintFlags && interaction.constraintFlags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {interaction.constraintFlags.map((flag) => {
            const severity = CONSTRAINT_SEVERITY_COLORS[flag.severity] || CONSTRAINT_SEVERITY_COLORS.manageable;
            return (
              <span
                key={flag.id}
                className={`inline-flex items-center px-1 py-0 rounded text-[8px] font-medium border ${severity.bg} ${severity.text} ${severity.border}`}
                title={`${flag.type}: ${flag.label} (${flag.severity})`}
              >
                {flag.severity === 'blocking' ? '⛔' : flag.severity === 'significant' ? '⚠️' : '○'}{' '}
                {flag.label.length > 15 ? flag.label.substring(0, 15) + '…' : flag.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Dual intensity bars with ghost indicators */}
      <div className="mt-1 space-y-0.5" onClick={e => e.stopPropagation()}>
        <IntensityBar
          label="Biz"
          value={interaction.businessIntensity}
          idealValue={interaction.idealBusinessIntensity ?? null}
          color="bg-blue-400"
          trackColor="bg-blue-100"
          onChange={(v) => onUpdateIntensity('businessIntensity', v)}
        />
        <IntensityBar
          label="Cust"
          value={interaction.customerIntensity}
          idealValue={interaction.idealCustomerIntensity ?? null}
          color="bg-purple-400"
          trackColor="bg-purple-100"
          onChange={(v) => onUpdateIntensity('customerIntensity', v)}
        />
      </div>

      {/* AI agency  -  triple badge strip for Now and Future */}
      <div className="mt-0.5 flex items-center gap-0.5 text-[9px]" onClick={e => e.stopPropagation()}>
        {/* Now strip */}
        <div className="flex items-center gap-px">
          {(['human', 'assisted', 'autonomous'] as const).map((level) => {
            const cfg = AI_AGENCY_ICONS[level];
            const isActive = level === interaction.aiAgencyNow;
            const Tag = readOnly ? 'span' : 'button';
            return (
              <Tag
                key={`now-${level}`}
                className={`inline-flex items-center gap-0.5 px-1 py-0 rounded-full text-[8px] font-medium transition-all ${
                  isActive
                    ? cfg.badgeColor
                    : 'bg-transparent text-muted-foreground/25'
                } ${!readOnly ? 'hover:opacity-80 cursor-pointer' : ''}`}
                onClick={readOnly ? undefined : () => onSetAiAgency('aiAgencyNow', level)}
                title={`Now: ${cfg.label}${!readOnly ? ' (click to select)' : ''}`}
              >
                <span className={isActive ? '' : 'opacity-30'}>{cfg.icon}</span>
              </Tag>
            );
          })}
        </div>
        <span className="text-[8px] font-bold text-muted-foreground/40 mx-0.5">→</span>
        {/* Future strip */}
        <div className="flex items-center gap-px">
          {(['human', 'assisted', 'autonomous'] as const).map((level) => {
            const cfg = AI_AGENCY_ICONS[level];
            const isActive = level === interaction.aiAgencyFuture;
            const Tag = readOnly ? 'span' : 'button';
            return (
              <Tag
                key={`future-${level}`}
                className={`inline-flex items-center gap-0.5 px-1 py-0 rounded-full text-[8px] font-medium transition-all ${
                  isActive
                    ? cfg.badgeColor
                    : 'bg-transparent text-muted-foreground/25'
                } ${!readOnly ? 'hover:opacity-80 cursor-pointer' : ''}`}
                onClick={readOnly ? undefined : () => onSetAiAgency('aiAgencyFuture', level)}
                title={`Future: ${cfg.label}${!readOnly ? ' (click to select)' : ''}`}
              >
                <span className={isActive ? '' : 'opacity-30'}>{cfg.icon}</span>
              </Tag>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// INTENSITY BAR
// ══════════════════════════════════════════════════════════

function IntensityBar({
  label,
  value,
  idealValue,
  color,
  trackColor,
  onChange,
}: {
  label: string;
  value: number;
  idealValue?: number | null;
  color: string;
  trackColor: string;
  onChange: (value: number) => void;
}) {
  const hasIdeal = idealValue != null && idealValue > 0;
  // Calculate delta direction for indicator
  const delta = hasIdeal ? value - idealValue! : 0;

  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[7px] font-bold text-muted-foreground/70 w-5 text-right uppercase">{label}</span>
      <div className="flex gap-px flex-1 relative">
        {INTENSITY_LEVELS.map((level) => (
          <button
            key={level}
            className={`h-1.5 flex-1 rounded-sm transition-colors relative ${
              value >= level ? color : trackColor
            } hover:opacity-80`}
            onClick={() => onChange(value >= level && value < level + 0.25 ? level - 0.25 : level)}
            title={`${Math.round(level * 100)}%`}
          >
            {/* Ghost bar — faint outline showing the ideal value */}
            {hasIdeal && idealValue! >= level && value < level && (
              <div className={`absolute inset-0 rounded-sm ${color} opacity-20 border border-dashed border-current`} />
            )}
          </button>
        ))}
      </div>
      {/* Delta indicator */}
      {hasIdeal && Math.abs(delta) >= 0.25 && (
        <span className={`text-[7px] font-bold ${delta > 0 ? 'text-red-500' : 'text-green-500'}`}>
          {delta > 0 ? '↑' : '↓'}
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// EDIT FORM
// ══════════════════════════════════════════════════════════

function EditForm({
  editForm,
  setEditForm,
  onSave,
  onCancel,
}: {
  editForm: Partial<LiveJourneyInteraction>;
  setEditForm: (f: Partial<LiveJourneyInteraction>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-2.5 rounded-lg border-2 border-blue-300 bg-blue-50 space-y-2">
      <input
        className="w-full text-xs p-1.5 rounded border border-blue-200 bg-white"
        value={editForm.action || ''}
        onChange={e => setEditForm({ ...editForm, action: e.target.value })}
        placeholder="Action..."
        autoFocus
      />
      <input
        className="w-full text-xs p-1.5 rounded border border-blue-200 bg-white"
        value={editForm.context || ''}
        onChange={e => setEditForm({ ...editForm, context: e.target.value })}
        placeholder="Context..."
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          className="text-xs p-1 rounded border border-blue-200 bg-white"
          value={editForm.sentiment || 'neutral'}
          onChange={e => setEditForm({ ...editForm, sentiment: e.target.value as LiveJourneyInteraction['sentiment'] })}
        >
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="concerned">Concerned</option>
          <option value="critical">Critical</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={!!editForm.isPainPoint}
              onChange={e => setEditForm({ ...editForm, isPainPoint: e.target.checked })}
            />
            Pain
          </label>
          <label className="flex items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={!!editForm.isMomentOfTruth}
              onChange={e => setEditForm({ ...editForm, isMomentOfTruth: e.target.checked })}
            />
            MoT
          </label>
        </div>
      </div>

      {/* Intensity sliders */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium w-20">Biz intensity</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.25"
            value={editForm.businessIntensity ?? 0.5}
            onChange={e => setEditForm({ ...editForm, businessIntensity: parseFloat(e.target.value) })}
            className="flex-1 h-1.5 accent-blue-500"
          />
          <span className="text-[10px] w-8 text-right">{Math.round((editForm.businessIntensity ?? 0.5) * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium w-20">Cust intensity</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.25"
            value={editForm.customerIntensity ?? 0.5}
            onChange={e => setEditForm({ ...editForm, customerIntensity: parseFloat(e.target.value) })}
            className="flex-1 h-1.5 accent-purple-500"
          />
          <span className="text-[10px] w-8 text-right">{Math.round((editForm.customerIntensity ?? 0.5) * 100)}%</span>
        </div>
      </div>

      {/* AI agency selectors */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium block mb-0.5">AI Day 1</label>
          <select
            className="w-full text-xs p-1 rounded border border-blue-200 bg-white"
            value={editForm.aiAgencyNow || 'human'}
            onChange={e => setEditForm({ ...editForm, aiAgencyNow: e.target.value as AiAgencyLevel })}
          >
            <option value="human">👤 Human</option>
            <option value="assisted">🤝 Assisted</option>
            <option value="autonomous">🤖 Autonomous</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium block mb-0.5">AI Future</label>
          <select
            className="w-full text-xs p-1 rounded border border-blue-200 bg-white"
            value={editForm.aiAgencyFuture || 'assisted'}
            onChange={e => setEditForm({ ...editForm, aiAgencyFuture: e.target.value as AiAgencyLevel })}
          >
            <option value="human">👤 Human</option>
            <option value="assisted">🤝 Assisted</option>
            <option value="autonomous">🤖 Autonomous</option>
          </select>
        </div>
      </div>

      <div className="flex gap-1 pt-1">
        <Button size="sm" className="h-6 text-[10px] px-2" onClick={onSave}>Save</Button>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
