'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  LiveJourneyData,
  LiveJourneyInteraction,
  LiveJourneyActor,
  AiAgencyLevel,
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

const AI_AGENCY_ICONS: Record<AiAgencyLevel, { icon: string; label: string }> = {
  human:      { icon: '👤', label: 'Human' },
  assisted:   { icon: '🤝', label: 'Assisted' },
  autonomous: { icon: '🤖', label: 'Autonomous' },
};

const INTENSITY_LEVELS = [0.25, 0.5, 0.75, 1.0];

function getSentimentStyle(sentiment: string) {
  return SENTIMENT_COLORS[sentiment] || SENTIMENT_COLORS.neutral;
}

// ══════════════════════════════════════════════════════════
// PROPS
// ══════════════════════════════════════════════════════════

type Props = {
  data: LiveJourneyData;
  onChange: (data: LiveJourneyData) => void;
  expanded: boolean;
  onToggleExpand: () => void;
};

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════

export default function LiveJourneyMap({ data, onChange, expanded, onToggleExpand }: Props) {
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

  function updateInteraction(interactionId: string, updates: Partial<LiveJourneyInteraction>) {
    onChange({
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
    onChange({
      ...data,
      interactions: [...interactions, newInteraction],
    });
  }

  function removeInteraction(interactionId: string) {
    onChange({
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
    onChange({
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
    onChange({
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
            </div>
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
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[900px]"
                style={{
                  gridTemplateColumns: `180px repeat(${stages.length}, minmax(170px, 1fr))`,
                }}
              >
                {/* Header row — stages */}
                <div className="bg-muted/50 p-3 border-b border-r sticky left-0 z-10" />
                {stages.map((stage, idx) => (
                  <div key={idx} className="bg-muted/50 p-3 border-b border-r text-center">
                    {editingStage === idx ? (
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
                      <div
                        className="cursor-pointer group"
                        onClick={() => { setEditingStage(idx); setEditStageValue(stage); }}
                      >
                        <div className="text-xs font-semibold text-foreground uppercase tracking-wider group-hover:text-blue-600 transition-colors">
                          {stage}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Stage {idx + 1}</div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Actor rows */}
                {actors.map((actor, actorIdx) => (
                  <div key={actorIdx} className="contents">
                    {/* Actor name cell */}
                    <div className="bg-muted/30 p-3 border-b border-r sticky left-0 z-10">
                      <div className="text-sm font-semibold text-foreground">{actor.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{actor.role}</div>
                      {actor.mentionCount > 0 && (
                        <div className="text-[9px] text-muted-foreground/60 mt-0.5">{actor.mentionCount} mentions</div>
                      )}
                    </div>

                    {/* Interaction cells */}
                    {stages.map((stage, stageIdx) => {
                      const cellInteractions = getInteractions(actor.name, stage);
                      return (
                        <div
                          key={`cell-${actorIdx}-${stageIdx}`}
                          className="p-2 border-b border-r min-h-[80px]"
                        >
                          <div className="space-y-1.5">
                            {cellInteractions.map((interaction) => {
                              const isEditing = editingCell === interaction.id;

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

                              return (
                                <InteractionCard
                                  key={interaction.id}
                                  interaction={interaction}
                                  onEdit={() => startEdit(interaction)}
                                  onRemove={() => removeInteraction(interaction.id)}
                                  onUpdateIntensity={(field, value) => updateInteraction(interaction.id, { [field]: value })}
                                  onToggleAiAgency={(field) => {
                                    const order: AiAgencyLevel[] = ['human', 'assisted', 'autonomous'];
                                    const current = interaction[field];
                                    const next = order[(order.indexOf(current) + 1) % order.length];
                                    updateInteraction(interaction.id, { [field]: next });
                                  }}
                                />
                              );
                            })}
                            <button
                              className="w-full p-1 rounded border border-dashed border-muted-foreground/20 text-[10px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                              onClick={() => addInteraction(actor.name, stage)}
                            >
                              + Add
                            </button>
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
  onEdit,
  onRemove,
  onUpdateIntensity,
  onToggleAiAgency,
}: {
  interaction: LiveJourneyInteraction;
  onEdit: () => void;
  onRemove: () => void;
  onUpdateIntensity: (field: 'businessIntensity' | 'customerIntensity', value: number) => void;
  onToggleAiAgency: (field: 'aiAgencyNow' | 'aiAgencyFuture') => void;
}) {
  const style = getSentimentStyle(interaction.sentiment);

  return (
    <div
      className={`group relative p-2 rounded-lg border ${style.bg} ${style.border} cursor-pointer hover:shadow-md transition-all animate-in fade-in duration-300`}
      onClick={onEdit}
    >
      {/* Pain point / moment of truth markers */}
      {interaction.isPainPoint && (
        <span className="absolute -top-1.5 -left-1.5 text-[10px]" title="Pain Point">🔴</span>
      )}
      {interaction.isMomentOfTruth && (
        <span className="absolute -top-1.5 -right-1.5 text-[10px]" title="Moment of Truth">⭐</span>
      )}

      {/* AI-added sparkle */}
      {interaction.addedBy === 'ai' && (
        <Sparkles className="absolute top-1 right-1 h-2.5 w-2.5 text-blue-400 opacity-50" />
      )}

      {/* Remove button */}
      <button
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-[10px] z-10"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remove"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Action + context */}
      <div className={`text-[11px] font-medium ${style.text} leading-tight pr-4`}>
        {interaction.action}
      </div>
      {interaction.context && (
        <div className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{interaction.context}</div>
      )}

      {/* Dual intensity bars */}
      <div className="mt-1.5 space-y-0.5" onClick={e => e.stopPropagation()}>
        <IntensityBar
          label="Biz"
          value={interaction.businessIntensity}
          color="bg-blue-400"
          trackColor="bg-blue-100"
          onChange={(v) => onUpdateIntensity('businessIntensity', v)}
        />
        <IntensityBar
          label="Cust"
          value={interaction.customerIntensity}
          color="bg-purple-400"
          trackColor="bg-purple-100"
          onChange={(v) => onUpdateIntensity('customerIntensity', v)}
        />
      </div>

      {/* AI agency */}
      <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground" onClick={e => e.stopPropagation()}>
        <button
          className="hover:bg-black/5 rounded px-0.5 transition-colors"
          onClick={() => onToggleAiAgency('aiAgencyNow')}
          title={`Day 1: ${AI_AGENCY_ICONS[interaction.aiAgencyNow].label} (click to cycle)`}
        >
          {AI_AGENCY_ICONS[interaction.aiAgencyNow].icon}
        </button>
        <span className="opacity-40">→</span>
        <button
          className="hover:bg-black/5 rounded px-0.5 transition-colors"
          onClick={() => onToggleAiAgency('aiAgencyFuture')}
          title={`Future: ${AI_AGENCY_ICONS[interaction.aiAgencyFuture].label} (click to cycle)`}
        >
          {AI_AGENCY_ICONS[interaction.aiAgencyFuture].icon}
        </button>
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
  color,
  trackColor,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  trackColor: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[8px] font-medium text-muted-foreground w-6 text-right">{label}</span>
      <div className="flex gap-px flex-1">
        {INTENSITY_LEVELS.map((level) => (
          <button
            key={level}
            className={`h-1.5 flex-1 rounded-sm transition-colors ${
              value >= level ? color : trackColor
            } hover:opacity-80`}
            onClick={() => onChange(value >= level && value < level + 0.25 ? level - 0.25 : level)}
            title={`${Math.round(level * 100)}%`}
          />
        ))}
      </div>
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
