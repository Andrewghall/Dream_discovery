/**
 * ReportSectionToggle — "Add to Report" / "In Report" pill button.
 *
 * Place this in section headers on source pages (Brain Scan, Actor Journey,
 * Discovery Output, Insight Map) to let facilitators add that section to the
 * final PDF report from wherever they're working.
 *
 * Props:
 *   workshopId  — the current workshop
 *   sectionId   — the canonical section ID (e.g. 'strategic_impact')
 *   title       — human label stored in the layout when adding a new entry
 */

'use client';

import { CheckCircle2, Plus, Loader2 } from 'lucide-react';
import { useReportLayout } from '@/hooks/use-report-layout';

interface ReportSectionToggleProps {
  workshopId: string;
  sectionId: string;
  title: string;
  /** Optional class overrides for the pill */
  className?: string;
}

export function ReportSectionToggle({
  workshopId,
  sectionId,
  title,
  className = '',
}: ReportSectionToggleProps) {
  const { loading, isEnabled, toggleSection } = useReportLayout(workshopId);
  const included = isEnabled(sectionId);

  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium bg-muted/30 border-border text-muted-foreground ${className}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading…
      </span>
    );
  }

  return (
    <button
      onClick={() => toggleSection(sectionId, title)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all duration-150 cursor-pointer select-none ${
        included
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
          : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
      } ${className}`}
      title={included ? 'Remove from report' : 'Add to report'}
    >
      {included ? (
        <CheckCircle2 className="h-3 w-3 shrink-0" />
      ) : (
        <Plus className="h-3 w-3 shrink-0" />
      )}
      {included ? 'In Report' : 'Add to Report'}
    </button>
  );
}
