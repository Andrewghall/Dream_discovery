'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import type { WorkshopBlueprint } from '@/lib/workshop/blueprint';

type Props = {
  blueprint: WorkshopBlueprint;
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

export default function BlueprintPreviewPanel({ blueprint }: Props) {
  const [collapsed, setCollapsed] = useState(true);

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
          {/* Lenses */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Lenses ({blueprint.lenses.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {blueprint.lenses.map((lens) => (
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
          </div>

          {/* Journey Stages */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Journey Stages ({blueprint.journeyStages.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {blueprint.journeyStages.map((stage, i) => (
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
          </div>

          {/* Actor Taxonomy */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Actor Taxonomy ({blueprint.actorTaxonomy.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {blueprint.actorTaxonomy.map((actor) => (
                <span
                  key={actor.key}
                  className="inline-block px-2 py-0.5 rounded-md border text-xs bg-muted/30"
                  title={actor.description}
                >
                  {actor.label}
                </span>
              ))}
            </div>
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
