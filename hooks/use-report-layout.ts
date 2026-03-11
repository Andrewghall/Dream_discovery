/**
 * useReportLayout — shared hook for cross-page "Add to Report" toggles.
 *
 * Fetches the workshop's report layout from /api/admin/workshops/[id]/report-layout,
 * exposes helpers to check and toggle section inclusion, and PATCHes changes
 * back to the API on every update.
 *
 * Used by ReportSectionToggle on Brain Scan, Actor Journey, Discovery Output,
 * and Insight Map pages.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { defaultReportLayout } from '@/lib/output-intelligence/types';
import type { ReportLayout, ReportSectionConfig } from '@/lib/output-intelligence/types';

export function useReportLayout(workshopId: string) {
  const [layout, setLayout] = useState<ReportLayout>(defaultReportLayout());
  const [loading, setLoading] = useState(true);

  // ── Fetch on mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const fetchLayout = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/workshops/${workshopId}/report-layout`);
        if (!res.ok) return;
        const data = await res.json() as { layout: ReportLayout };
        if (!cancelled) setLayout(data.layout);
      } catch {
        // Non-fatal — leave default layout
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchLayout();
    return () => { cancelled = true; };
  }, [workshopId]);

  // ── Persist helper ─────────────────────────────────────────────────────────

  const persistLayout = useCallback(async (updated: ReportLayout) => {
    try {
      await fetch(`/api/admin/workshops/${workshopId}/report-layout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: updated }),
      });
    } catch {
      // Non-fatal
    }
  }, [workshopId]);

  // ── isEnabled ──────────────────────────────────────────────────────────────

  const isEnabled = useCallback((sectionId: string): boolean => {
    const section = layout.sections.find(s => s.id === sectionId);
    return section?.enabled === true;
  }, [layout]);

  // ── toggleSection ──────────────────────────────────────────────────────────

  const toggleSection = useCallback((sectionId: string, title: string): void => {
    setLayout(prev => {
      const existing = prev.sections.find(s => s.id === sectionId);

      let nextSections: ReportSectionConfig[];
      if (existing) {
        // Flip enabled flag
        nextSections = prev.sections.map(s =>
          s.id === sectionId ? { ...s, enabled: !s.enabled } : s
        );
      } else {
        // Add brand-new entry enabled: true
        const newEntry: ReportSectionConfig = {
          id: sectionId,
          type: 'builtin',
          title,
          enabled: true,
          collapsed: false,
          excludedItems: [],
        };
        nextSections = [...prev.sections, newEntry];
      }

      const next: ReportLayout = { ...prev, sections: nextSections };
      void persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  return { layout, loading, isEnabled, toggleSection };
}
