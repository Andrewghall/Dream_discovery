'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import type {
  NarrativeDivergenceData,
  NarrativeLayerData,
  DivergencePoint,
  ParticipantLayerAssignment,
  NarrativeLayer,
} from '@/lib/types/discover-analysis';

interface NarrativeDivergenceProps {
  data: NarrativeDivergenceData;
  onLayerOverride?: (participantId: string, layer: NarrativeLayer) => void;
}

const LAYER_LABELS: Record<NarrativeLayer, string> = {
  executive: 'Executive',
  operational: 'Operational',
  frontline: 'Frontline',
};

const LAYER_COLORS: Record<NarrativeLayer, { bg: string; accent: string; bar: string }> = {
  executive: { bg: 'bg-indigo-50', accent: 'text-indigo-700', bar: '#6366f1' },
  operational: { bg: 'bg-emerald-50', accent: 'text-emerald-700', bar: '#10b981' },
  frontline: { bg: 'bg-amber-50', accent: 'text-amber-700', bar: '#f59e0b' },
};

const SENTIMENT_INDICATOR: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'text-emerald-600' },
  negative: { label: 'Negative', color: 'text-red-600' },
  neutral: { label: 'Neutral', color: 'text-slate-500' },
  mixed: { label: 'Mixed', color: 'text-amber-600' },
};

/**
 * Narrative Divergence — Three-column layer comparison + divergence points
 */
export function NarrativeDivergence({ data, onLayerOverride }: NarrativeDivergenceProps) {
  const [showAssignments, setShowAssignments] = useState(false);

  const hasData = data.layers.some((l) => l.topTerms.length > 0);

  if (!hasData) {
    return (
      <div className="text-center py-12 text-muted-foreground/50">
        <p className="text-sm">Insufficient data for narrative analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Three-column layer comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data.layers.map((layer) => (
          <LayerColumn key={layer.layer} data={layer} />
        ))}
      </div>

      {/* Divergence points */}
      {data.divergencePoints.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Divergence Points
          </h4>
          <div className="space-y-2">
            {data.divergencePoints.map((dp, i) => (
              <DivergencePointRow key={i} point={dp} />
            ))}
          </div>
        </div>
      )}

      {/* Layer assignment panel (collapsible) */}
      {data.layerAssignments.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <button
            onClick={() => setShowAssignments(!showAssignments)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Users className="h-3 w-3" />
            {showAssignments ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span>Layer Assignments ({data.layerAssignments.length} participants)</span>
          </button>

          {showAssignments && (
            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
              {data.layerAssignments.map((a) => (
                <AssignmentRow
                  key={a.participantId}
                  assignment={a}
                  onOverride={onLayerOverride}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Layer Column ─────────────────────────────────────────────

function LayerColumn({ data }: { data: NarrativeLayerData }) {
  const colors = LAYER_COLORS[data.layer];
  const sentiment = SENTIMENT_INDICATOR[data.dominantSentiment] || SENTIMENT_INDICATOR.neutral;
  const maxTermCount = data.topTerms[0]?.normalised || 1;

  return (
    <div className={`rounded-lg p-3 ${colors.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className={`text-sm font-semibold ${colors.accent}`}>
          {LAYER_LABELS[data.layer]}
        </h4>
        <span className="text-xs text-slate-400">{data.participantCount} people</span>
      </div>

      {/* Sentiment */}
      <div className={`text-xs font-medium mb-3 ${sentiment.color}`}>
        {sentiment.label} sentiment
      </div>

      {/* Top terms (horizontal bars) */}
      <div className="space-y-1.5 mb-3">
        {data.topTerms.slice(0, 8).map((term) => (
          <div key={term.term} className="flex items-center gap-2">
            <span className="text-xs text-slate-600 w-20 truncate flex-shrink-0">
              {term.term}
            </span>
            <div className="flex-1 h-3 bg-white/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(term.normalised / maxTermCount) * 100}%`,
                  backgroundColor: colors.bar,
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="text-xs text-slate-400 w-5 text-right flex-shrink-0">
              {term.count}
            </span>
          </div>
        ))}
      </div>

      {/* Temporal focus (small stacked bar) */}
      <div className="mb-2">
        <div className="text-xs text-slate-400 mb-1">Temporal focus</div>
        <div className="flex h-2 rounded-full overflow-hidden bg-white/30">
          <div
            className="bg-slate-400"
            style={{ width: `${data.temporalFocus.past * 100}%` }}
            title={`Past: ${Math.round(data.temporalFocus.past * 100)}%`}
          />
          <div
            className="bg-slate-300"
            style={{ width: `${data.temporalFocus.present * 100}%` }}
            title={`Present: ${Math.round(data.temporalFocus.present * 100)}%`}
          />
          <div
            className="bg-slate-600"
            style={{ width: `${data.temporalFocus.future * 100}%` }}
            title={`Future: ${Math.round(data.temporalFocus.future * 100)}%`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
          <span>Past</span>
          <span>Present</span>
          <span>Future</span>
        </div>
      </div>

      {/* Sample phrases */}
      {data.samplePhrases.length > 0 && (
        <div className="border-t border-white/30 pt-2 mt-2">
          {data.samplePhrases.slice(0, 2).map((phrase, i) => (
            <p key={i} className="text-xs text-slate-500 italic truncate mb-0.5">
              &ldquo;{phrase}&rdquo;
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Divergence Point Row ─────────────────────────────────────

function DivergencePointRow({ point }: { point: DivergencePoint }) {
  return (
    <div className="flex items-start gap-3 bg-slate-50/50 rounded-lg p-2.5">
      <span className="text-sm font-medium text-slate-700 w-32 flex-shrink-0 truncate">
        {point.topic}
      </span>
      <div className="flex-1 flex flex-wrap gap-1.5">
        {point.layerPositions.map((pos) => {
          const colors = LAYER_COLORS[pos.layer];
          const sentimentInfo = SENTIMENT_INDICATOR[pos.sentiment] || SENTIMENT_INDICATOR.neutral;
          return (
            <span
              key={pos.layer}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.accent}`}
            >
              {LAYER_LABELS[pos.layer]}:
              <span className={sentimentInfo.color}>{pos.sentiment}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Assignment Row ───────────────────────────────────────────

function AssignmentRow({
  assignment,
  onOverride,
}: {
  assignment: ParticipantLayerAssignment;
  onOverride?: (participantId: string, layer: NarrativeLayer) => void;
}) {
  const colors = LAYER_COLORS[assignment.layer];

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50/50">
      <span className="text-xs text-slate-600 flex-1 truncate">
        {assignment.name}
      </span>
      <span className="text-xs text-slate-400 truncate max-w-24">
        {assignment.role || 'Unknown'}
      </span>

      {onOverride ? (
        <select
          value={assignment.layer}
          onChange={(e) => onOverride(assignment.participantId, e.target.value as NarrativeLayer)}
          className={`text-xs px-1.5 py-0.5 rounded border-0 ${colors.bg} ${colors.accent} cursor-pointer`}
        >
          <option value="executive">Executive</option>
          <option value="operational">Operational</option>
          <option value="frontline">Frontline</option>
        </select>
      ) : (
        <span className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.accent}`}>
          {LAYER_LABELS[assignment.layer]}
        </span>
      )}

      {assignment.isOverridden && (
        <span className="text-[10px] text-amber-500">(edited)</span>
      )}
    </div>
  );
}
