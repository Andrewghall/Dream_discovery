'use client';

import { Card } from '@/components/ui/card';
import { Target, Lightbulb } from 'lucide-react';
import type { WorkshopArchetype } from '@/lib/output/archetype-classifier';

/**
 * WorkshopContextBanner
 *
 * Displays the workshop purpose, desired outcomes, and archetype
 * classification badge at the top of the scratchpad output page.
 */

interface WorkshopContextBannerProps {
  workshopPurpose?: string | null;
  desiredOutcomes?: string | null;
  archetype?: WorkshopArchetype | null;
  confidence?: number | null;
  rationale?: string | null;
}

const ARCHETYPE_LABELS: Record<WorkshopArchetype, string> = {
  agentic_tooling_blueprint: 'Agentic Tooling Blueprint',
  operational_contact_centre_improvement: 'Operational Improvement',
  compliance_risk_remediation: 'Compliance & Risk Remediation',
  hybrid: 'Hybrid Assessment',
};

const ARCHETYPE_COLORS: Record<WorkshopArchetype, string> = {
  agentic_tooling_blueprint: 'bg-blue-100 text-blue-800 border-blue-200',
  operational_contact_centre_improvement: 'bg-amber-100 text-amber-800 border-amber-200',
  compliance_risk_remediation: 'bg-red-100 text-red-800 border-red-200',
  hybrid: 'bg-purple-100 text-purple-800 border-purple-200',
};

export function WorkshopContextBanner({
  workshopPurpose,
  desiredOutcomes,
  archetype,
  confidence,
  rationale,
}: WorkshopContextBannerProps) {
  // Don't render if no context at all
  if (!workshopPurpose && !desiredOutcomes && !archetype) return null;

  return (
    <Card className="mb-6 p-4 bg-gradient-to-r from-slate-50 to-white border-slate-200">
      <div className="flex items-start gap-6">
        {/* Purpose + Outcomes */}
        <div className="flex-1 space-y-2">
          {workshopPurpose && (
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Purpose</span>
                <p className="text-sm text-slate-700 leading-relaxed">{workshopPurpose}</p>
              </div>
            </div>
          )}
          {desiredOutcomes && (
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Desired Outcomes</span>
                <p className="text-sm text-slate-700 leading-relaxed">{desiredOutcomes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Archetype badge */}
        {archetype && (
          <div className="flex-shrink-0 text-right">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Output Assessment
            </span>
            <span
              className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${ARCHETYPE_COLORS[archetype] || 'bg-slate-100 text-slate-700 border-slate-200'}`}
            >
              {ARCHETYPE_LABELS[archetype] || archetype.replace(/_/g, ' ')}
            </span>
            {confidence != null && (
              <p className="text-[10px] text-slate-400 mt-1">
                {(confidence * 100).toFixed(0)}% confidence
              </p>
            )}
            {rationale && (
              <p className="text-[10px] text-slate-400 mt-0.5 max-w-[240px] text-right">
                {rationale}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
