'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { TensionSurfaceData, TensionEntry } from '@/lib/types/discover-analysis';

interface TensionSurfaceProps {
  data: TensionSurfaceData;
  /** Cap the number of displayed tensions (default: unlimited) */
  maxItems?: number;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; icon: typeof AlertTriangle }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', icon: AlertTriangle },
  significant: { bg: 'bg-amber-50', text: 'text-amber-700', icon: AlertCircle },
  moderate: { bg: 'bg-slate-50', text: 'text-slate-600', icon: Info },
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-emerald-100 text-emerald-800',
  negative: 'bg-red-100 text-red-800',
  neutral: 'bg-slate-100 text-slate-700',
  mixed: 'bg-amber-100 text-amber-800',
};

/**
 * Tension Surface — Ranked card list of unresolved organisational tensions
 */
export function TensionSurface({ data, maxItems }: TensionSurfaceProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (data.tensions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground/50">
        <p className="text-sm">No significant tensions identified</p>
      </div>
    );
  }

  const displayTensions = maxItems != null
    ? data.tensions.slice(0, maxItems)
    : data.tensions;

  return (
    <div className="space-y-3">
      {displayTensions.map((tension) => (
        <TensionCard
          key={tension.id}
          tension={tension}
          isExpanded={expandedId === tension.id}
          onToggle={() =>
            setExpandedId(expandedId === tension.id ? null : tension.id)
          }
        />
      ))}
    </div>
  );
}

function TensionCard({
  tension,
  isExpanded,
  onToggle,
}: {
  tension: TensionEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const style = SEVERITY_STYLES[tension.severity] || SEVERITY_STYLES.moderate;
  const SeverityIcon = style.icon;

  return (
    <div
      className={`border border-slate-200 rounded-lg overflow-hidden transition-all ${
        isExpanded ? 'shadow-sm' : ''
      }`}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
      >
        {/* Rank badge */}
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center">
          {tension.rank}
        </span>

        {/* Severity badge */}
        <span
          className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
        >
          <SeverityIcon className="h-3 w-3" />
          {tension.severity}
        </span>

        {/* Topic */}
        <span className="flex-1 text-sm font-medium text-slate-800 truncate">
          {tension.topic}
        </span>

        {/* Domain tag */}
        <span className="flex-shrink-0 text-xs text-slate-400 font-medium">
          {tension.domain}
        </span>

        {/* Expand icon */}
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100">
          {/* Competing viewpoints */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Competing Viewpoints
            </h4>
            <div className="space-y-2">
              {tension.viewpoints.map((vp, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-slate-50/50 rounded-lg p-3"
                >
                  <div className="flex-shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        SENTIMENT_COLORS[vp.sentiment] || SENTIMENT_COLORS.neutral
                      }`}
                    >
                      {vp.actor}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{vp.position}</p>
                    {vp.evidenceQuote && (
                      <p className="text-xs text-slate-400 italic mt-1">
                        &ldquo;{vp.evidenceQuote}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Affected actors */}
          {tension.affectedActors.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Affected Actors
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {tension.affectedActors.map((actor) => (
                  <span
                    key={actor}
                    className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs"
                  >
                    {actor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related constraints */}
          {tension.relatedConstraints.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Related Constraints
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {tension.relatedConstraints.map((cid) => (
                  <span
                    key={cid}
                    className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-mono"
                  >
                    {cid}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
