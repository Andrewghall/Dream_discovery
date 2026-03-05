'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Pencil, Save, X, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import type { WorkshopBlueprint, LensPolicyEntry, JourneyStageEntry, ActorEntry } from '@/lib/workshop/blueprint';

type Props = {
  blueprint: WorkshopBlueprint;
  onSave?: (blueprint: WorkshopBlueprint) => void;
};

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatInterval(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

const DEFAULT_LENS_COLORS = [
  '#bfdbfe', '#a7f3d0', '#ddd6fe', '#fed7aa', '#fecaca',
  '#fde68a', '#c7d2fe', '#fbcfe8', '#99f6e4', '#e2e8f0',
];

export default function BlueprintPreviewPanel({ blueprint, onSave }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WorkshopBlueprint | null>(null);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(JSON.parse(JSON.stringify(blueprint)));
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(null);
    setEditing(false);
  };

  const handleSave = () => {
    if (!draft || !onSave) return;
    setSaving(true);
    onSave(draft);
    setEditing(false);
    setSaving(false);
  };

  // --- Lens editing helpers ---
  const updateLens = (index: number, patch: Partial<LensPolicyEntry>) => {
    if (!draft) return;
    const lenses = [...draft.lenses];
    lenses[index] = { ...lenses[index], ...patch };
    setDraft({ ...draft, lenses });
  };

  const removeLens = (index: number) => {
    if (!draft) return;
    const lenses = draft.lenses.filter((_, i) => i !== index);
    setDraft({ ...draft, lenses });
  };

  const addLens = () => {
    if (!draft) return;
    const color = DEFAULT_LENS_COLORS[draft.lenses.length % DEFAULT_LENS_COLORS.length];
    const newLens: LensPolicyEntry = { name: '', description: '', color, keywords: [] };
    setDraft({ ...draft, lenses: [...draft.lenses, newLens] });
  };

  // --- Journey stage editing helpers ---
  const updateStage = (index: number, patch: Partial<JourneyStageEntry>) => {
    if (!draft) return;
    const stages = [...draft.journeyStages];
    stages[index] = { ...stages[index], ...patch };
    setDraft({ ...draft, journeyStages: stages });
  };

  const removeStage = (index: number) => {
    if (!draft) return;
    const stages = draft.journeyStages.filter((_, i) => i !== index);
    setDraft({ ...draft, journeyStages: stages });
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    if (!draft) return;
    const target = index + direction;
    if (target < 0 || target >= draft.journeyStages.length) return;
    const stages = [...draft.journeyStages];
    [stages[index], stages[target]] = [stages[target], stages[index]];
    setDraft({ ...draft, journeyStages: stages });
  };

  const addStage = () => {
    if (!draft) return;
    const newStage: JourneyStageEntry = { name: '', description: '' };
    setDraft({ ...draft, journeyStages: [...draft.journeyStages, newStage] });
  };

  // --- Actor editing helpers ---
  const updateActor = (index: number, patch: Partial<ActorEntry>) => {
    if (!draft) return;
    const actors = [...draft.actorTaxonomy];
    actors[index] = { ...actors[index], ...patch };
    if (patch.label !== undefined) {
      actors[index].key = patch.label.toLowerCase().replace(/[\s\/]+/g, '_').replace(/[^a-z0-9_]/g, '');
    }
    setDraft({ ...draft, actorTaxonomy: actors });
  };

  const removeActor = (index: number) => {
    if (!draft) return;
    const actors = draft.actorTaxonomy.filter((_, i) => i !== index);
    setDraft({ ...draft, actorTaxonomy: actors });
  };

  const addActor = () => {
    if (!draft) return;
    const newActor: ActorEntry = { key: '', label: '', description: '' };
    setDraft({ ...draft, actorTaxonomy: [...draft.actorTaxonomy, newActor] });
  };

  const bp = editing && draft ? draft : blueprint;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">&#x1F3D7;&#xFE0F;</span>
          <h2 className="text-sm font-semibold">Blueprint Configuration</h2>
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs text-muted-foreground">v{blueprint.blueprintVersion}</span>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-6 pb-6 space-y-5">
          {/* Edit / Save / Cancel toolbar */}
          {onSave && (
            <div className="flex items-center justify-end gap-2">
              {editing ? (
                <>
                  <button
                    onClick={cancelEditing}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium hover:bg-muted/50 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={startEditing}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium hover:bg-muted/50 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}
            </div>
          )}

          {/* Lenses */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Lenses ({bp.lenses.length})
            </h3>
            {editing ? (
              <div className="space-y-2">
                {bp.lenses.map((lens, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={lens.color}
                      onChange={(e) => updateLens(i, { color: e.target.value })}
                      className="w-6 h-6 rounded-full border cursor-pointer shrink-0"
                      style={{ padding: 0 }}
                    />
                    <input
                      type="text"
                      value={lens.name}
                      onChange={(e) => updateLens(i, { name: e.target.value })}
                      placeholder="Lens name"
                      className="flex-1 px-2 py-1 rounded-md border text-xs bg-background"
                    />
                    <button
                      onClick={() => removeLens(i)}
                      className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors shrink-0"
                      title="Remove lens"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addLens}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add lens
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {bp.lenses.map((lens) => (
                  <div
                    key={lens.name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium bg-card"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: lens.color }}
                    />
                    {lens.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Journey Stages */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Journey Stages ({bp.journeyStages.length})
            </h3>
            {editing ? (
              <div className="space-y-2">
                {bp.journeyStages.map((stage, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
                    <div className="flex flex-col gap-0.5 shrink-0 mt-1">
                      <button
                        onClick={() => moveStage(i, -1)}
                        disabled={i === 0}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                        title="Move up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveStage(i, 1)}
                        disabled={i === bp.journeyStages.length - 1}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                        title="Move down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-[10px] font-bold text-gray-600 shrink-0 mt-1.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={stage.name}
                        onChange={(e) => updateStage(i, { name: e.target.value })}
                        placeholder="Stage name"
                        className="w-full px-2 py-1 rounded-md border text-xs bg-background"
                      />
                      <input
                        type="text"
                        value={stage.description}
                        onChange={(e) => updateStage(i, { description: e.target.value })}
                        placeholder="Description"
                        className="w-full px-2 py-1 rounded-md border text-xs bg-background text-muted-foreground"
                      />
                    </div>
                    <button
                      onClick={() => removeStage(i)}
                      className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors shrink-0 mt-1"
                      title="Remove stage"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addStage}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add stage
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {bp.journeyStages.map((stage, i) => (
                  <div
                    key={stage.name}
                    className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-[10px] font-bold text-gray-600 shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium leading-tight">{stage.name}</p>
                      {stage.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{stage.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actor Taxonomy */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Actor Taxonomy ({bp.actorTaxonomy.length})
            </h3>
            {editing ? (
              <div className="space-y-2">
                {bp.actorTaxonomy.map((actor, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={actor.label}
                      onChange={(e) => updateActor(i, { label: e.target.value })}
                      placeholder="Actor role"
                      className="flex-1 px-2 py-1 rounded-md border text-xs bg-background"
                    />
                    <input
                      type="text"
                      value={actor.description}
                      onChange={(e) => updateActor(i, { description: e.target.value })}
                      placeholder="Description"
                      className="flex-1 px-2 py-1 rounded-md border text-xs bg-background text-muted-foreground"
                    />
                    <button
                      onClick={() => removeActor(i)}
                      className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors shrink-0"
                      title="Remove actor"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addActor}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add actor
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {bp.actorTaxonomy.map((actor) => (
                  <span
                    key={actor.key}
                    className="inline-block px-2 py-0.5 rounded-md border text-xs bg-muted/30"
                    title={actor.description}
                  >
                    {actor.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Question Policy */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Question Policy
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Per Phase</p>
                <p className="text-sm font-semibold tabular-nums">
                  {blueprint.questionPolicy.questionsPerPhase}
                </p>
              </div>
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Sub-Qs / Main</p>
                <p className="text-sm font-semibold tabular-nums">
                  {blueprint.questionPolicy.subQuestionsPerMain}
                </p>
              </div>
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Coverage Threshold</p>
                <p className="text-sm font-semibold tabular-nums">
                  {blueprint.questionPolicy.coverageThresholdPercent}%
                </p>
              </div>
            </div>
          </div>

          {/* Data Requirements */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Data Requirements
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Typical Duration</p>
                <p className="text-sm font-semibold tabular-nums">
                  {blueprint.dataRequirements.typicalDurationDays} days
                </p>
              </div>
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Interview Count</p>
                <p className="text-sm font-semibold tabular-nums">
                  {blueprint.dataRequirements.typicalInterviewCount}
                </p>
              </div>
            </div>
            {blueprint.dataRequirements.sessionMix.length > 0 && (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-1.5 font-semibold">Type</th>
                      <th className="text-center px-3 py-1.5 font-semibold">Min</th>
                      <th className="text-center px-3 py-1.5 font-semibold">Ideal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blueprint.dataRequirements.sessionMix.map((mix) => (
                      <tr key={mix.captureType} className="border-t">
                        <td className="px-3 py-1.5">{mix.captureType}</td>
                        <td className="text-center px-3 py-1.5 tabular-nums">{mix.minSessions}</td>
                        <td className="text-center px-3 py-1.5 tabular-nums">{mix.idealSessions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pacing */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Pacing
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Max Visible Pads</p>
                <p className="text-sm font-semibold tabular-nums">
                  {blueprint.pacing.maxVisiblePads}
                </p>
              </div>
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Emission Interval</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatInterval(blueprint.pacing.minEmissionIntervalMs)}
                </p>
              </div>
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Pad Generation</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatInterval(blueprint.pacing.padGenerationIntervalMs)}
                </p>
              </div>
            </div>
          </div>

          {/* Version footer */}
          <div className="pt-2 border-t">
            <p className="text-[10px] text-muted-foreground">
              Blueprint v{blueprint.blueprintVersion} -- composed {formatTimestamp(blueprint.composedAtMs)}
              {blueprint.domainPack && ` -- ${blueprint.domainPack} pack`}
              {blueprint.engagementType && ` -- ${blueprint.engagementType}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
