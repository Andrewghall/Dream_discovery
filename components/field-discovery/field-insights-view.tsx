'use client';

/**
 * FieldInsightsView
 *
 * Shows a concise set of "discovery output slides" derived from STREAM_B
 * (field capture) findings and the DiagnosticSynthesis record.
 *
 * Five slides:
 *  1. Overview       — total findings by type
 *  2. Critical Issues — structural weaknesses + systemic risks
 *  3. Opportunities  — 30-day and 90-day actions
 *  4. Contradictions — friction and tension points
 *  5. Lens Breakdown — per-lens finding counts and themes
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  Zap,
  Lightbulb,
  RefreshCcw,
  Loader2,
  AlertCircle,
  Calendar,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { LENS_COLORS } from '@/components/cognitive-guidance/sticky-pad';

// ---------------------------------------------------------------------------
// Types (mirror synthesis-engine.ts for client-side use)
// ---------------------------------------------------------------------------

interface FindingItem {
  id: string;
  lens: string;
  type: string; // CONSTRAINT | OPPORTUNITY | RISK | CONTRADICTION
  title: string;
  description: string;
  severityScore: number | null;
  frequencyCount: number;
  roleCoverage: string[];
  confidenceScore: number | null;
  createdAt: string;
}

interface ThemeCluster {
  label: string;
  findingCount: number;
  avgSeverity: number;
}

interface LensSummary {
  lens: string;
  findingCount: number;
  themes: ThemeCluster[];
  frequencyMetrics: {
    constraints: number;
    opportunities: number;
    risks: number;
    contradictions: number;
  };
  severityRanking: Array<{ title: string; severityScore: number; type: string }>;
  quickWins: Array<{ title: string; description: string; severityScore: number }>;
}

interface CrossLensItem {
  description: string;
  lenses: string[];
  severity: number;
}

interface CrossLensAnalysis {
  structuralWeaknesses: CrossLensItem[];
  systemicRisks: CrossLensItem[];
  contradictions: CrossLensItem[];
  actions30Day: string[];
  actions90Day: string[];
}

interface SynthesisRecord {
  sessionsProcessed: number;
  version: number;
  lensSummaries: Record<string, LensSummary> | null;
  crossLens: CrossLensAnalysis | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLensColor(lens: string): string {
  return (LENS_COLORS as Record<string, { bg: string }>)[lens]?.bg ?? '#e2e8f0';
}

function LensDot({ lens }: { lens: string }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ backgroundColor: getLensColor(lens) }}
      title={lens}
    />
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    CONSTRAINT: 'bg-orange-100 text-orange-700 border-orange-200',
    RISK: 'bg-red-100 text-red-700 border-red-200',
    OPPORTUNITY: 'bg-green-100 text-green-700 border-green-200',
    CONTRADICTION: 'bg-violet-100 text-violet-700 border-violet-200',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${map[type] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {type.charAt(0) + type.slice(1).toLowerCase()}
    </span>
  );
}

function SeverityBar({ score }: { score: number | null }) {
  if (score == null) return null;
  const pct = Math.min(100, Math.round(score * 10));
  const color = score >= 7 ? 'bg-red-400' : score >= 4 ? 'bg-amber-400' : 'bg-green-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{score.toFixed(1)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide: Overview
// ---------------------------------------------------------------------------

function OverviewSlide({
  findings,
  synthesis,
}: {
  findings: FindingItem[];
  synthesis: SynthesisRecord | null;
}) {
  const counts = {
    CONSTRAINT: findings.filter((f) => f.type === 'CONSTRAINT').length,
    RISK: findings.filter((f) => f.type === 'RISK').length,
    OPPORTUNITY: findings.filter((f) => f.type === 'OPPORTUNITY').length,
    CONTRADICTION: findings.filter((f) => f.type === 'CONTRADICTION').length,
  };

  const stats = [
    { label: 'Constraints', count: counts.CONSTRAINT, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
    { label: 'Risks', count: counts.RISK, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
    { label: 'Opportunities', count: counts.OPPORTUNITY, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
    { label: 'Contradictions', count: counts.CONTRADICTION, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100' },
  ];

  return (
    <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 bg-amber-400" />
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-base font-semibold">Field Discovery Overview</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          {findings.length} field findings · {synthesis?.sessionsProcessed ?? 0} sessions analysed
          {synthesis && ` · v${synthesis.version}`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border px-4 py-3 flex flex-col items-center gap-0.5 ${s.bg}`}
            >
              <span className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.count}</span>
              <span className="text-[11px] text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
        {findings.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Lenses covered</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(findings.map((f) => f.lens))).sort().map((lens) => {
                const count = findings.filter((f) => f.lens === lens).length;
                return (
                  <span
                    key={lens}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border border-gray-200"
                    style={{ backgroundColor: getLensColor(lens) + '40' }}
                  >
                    <LensDot lens={lens} />
                    {lens} <span className="text-muted-foreground">({count})</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Slide: Critical Issues
// ---------------------------------------------------------------------------

function CriticalIssuesSlide({
  findings,
  synthesis,
}: {
  findings: FindingItem[];
  synthesis: SynthesisRecord | null;
}) {
  // Prefer synthesis data; fall back to raw findings sorted by severity
  const items: Array<{ text: string; lens: string; severity: number; tag: string }> = [];

  if (synthesis?.crossLens?.structuralWeaknesses?.length || synthesis?.crossLens?.systemicRisks?.length) {
    const weaknesses = (synthesis.crossLens?.structuralWeaknesses ?? []).map((w) => ({
      text: w.description,
      lens: w.lenses[0] ?? 'General',
      severity: w.severity,
      tag: 'Structural',
    }));
    const risks = (synthesis.crossLens?.systemicRisks ?? []).map((r) => ({
      text: r.description,
      lens: r.lenses[0] ?? 'General',
      severity: r.severity,
      tag: 'Risk',
    }));
    items.push(...weaknesses, ...risks);
  } else {
    // Fallback: top CONSTRAINT + RISK findings by severity
    const fallback = findings
      .filter((f) => f.type === 'CONSTRAINT' || f.type === 'RISK')
      .sort((a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0))
      .slice(0, 6);
    items.push(
      ...fallback.map((f) => ({
        text: f.title + ': ' + f.description.slice(0, 100),
        lens: f.lens,
        severity: f.severityScore ?? 0,
        tag: f.type === 'CONSTRAINT' ? 'Structural' : 'Risk',
      }))
    );
  }

  const displayed = items.slice(0, 6);

  return (
    <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 bg-red-400" />
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <CardTitle className="text-base font-semibold">Critical Issues</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">High-severity constraints and systemic risks surfaced in the field</p>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No critical issues identified yet.</p>
        ) : (
          <div className="space-y-2.5">
            {displayed.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-red-50/60 border border-red-100 px-3 py-2.5">
                <LensDot lens={item.lens} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{item.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{item.lens}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1 border-red-200 text-red-600">
                      {item.tag}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      severity {item.severity.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Slide: Opportunities & Actions
// ---------------------------------------------------------------------------

function OpportunitiesSlide({
  findings,
  synthesis,
}: {
  findings: FindingItem[];
  synthesis: SynthesisRecord | null;
}) {
  const actions30: string[] = [];
  const actions90: string[] = [];

  if (synthesis?.crossLens?.actions30Day?.length || synthesis?.crossLens?.actions90Day?.length) {
    actions30.push(...(synthesis.crossLens?.actions30Day ?? []).slice(0, 3));
    actions90.push(...(synthesis.crossLens?.actions90Day ?? []).slice(0, 4));
  } else {
    // Fallback: OPPORTUNITY findings sorted by severity
    const opps = findings
      .filter((f) => f.type === 'OPPORTUNITY')
      .sort((a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0));
    actions30.push(...opps.filter((f) => (f.severityScore ?? 0) >= 7).slice(0, 3).map((f) => f.title));
    actions90.push(...opps.filter((f) => (f.severityScore ?? 0) >= 5 && (f.severityScore ?? 0) < 7).slice(0, 4).map((f) => f.title));
  }

  const allActions = [
    ...actions30.map((a) => ({ text: a, badge: '30 days', badgeClass: 'bg-green-100 text-green-700 border-green-200' })),
    ...actions90.map((a) => ({ text: a, badge: '90 days', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' })),
  ];

  return (
    <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 bg-green-400" />
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-green-500" />
          <CardTitle className="text-base font-semibold">Opportunities & Actions</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Prioritised improvement opportunities from the field</p>
      </CardHeader>
      <CardContent>
        {allActions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No opportunities identified yet.</p>
        ) : (
          <div className="space-y-2">
            {allActions.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-green-50/60 border border-green-100 px-3 py-2.5">
                <Calendar className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{item.text}</p>
                </div>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${item.badgeClass}`}>
                  {item.badge}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Slide: Contradictions
// ---------------------------------------------------------------------------

function ContradictionsSlide({
  findings,
  synthesis,
}: {
  findings: FindingItem[];
  synthesis: SynthesisRecord | null;
}) {
  type ContradictionItem = { text: string; lens: string };
  let items: ContradictionItem[] = [];

  if (synthesis?.crossLens?.contradictions?.length) {
    items = synthesis.crossLens.contradictions.map((c) => ({
      text: c.description,
      lens: c.lenses[0] ?? 'General',
    }));
  } else {
    items = findings
      .filter((f) => f.type === 'CONTRADICTION')
      .sort((a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0))
      .map((f) => ({ text: f.title + ': ' + f.description.slice(0, 100), lens: f.lens }));
  }

  return (
    <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 bg-violet-400" />
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-500" />
          <CardTitle className="text-base font-semibold">Contradictions & Tensions</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Where the field reality conflicts with expectations</p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No contradictions detected in the current findings.</p>
        ) : (
          <div className="space-y-2.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-violet-50/60 border border-violet-100 px-3 py-2.5">
                <LensDot lens={item.lens} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{item.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.lens}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Slide: Lens Breakdown (full-width)
// ---------------------------------------------------------------------------

function LensBreakdownSlide({
  findings,
  synthesis,
}: {
  findings: FindingItem[];
  synthesis: SynthesisRecord | null;
}) {
  // Build per-lens rows from synthesis lensSummaries if available, else from raw findings
  type LensRow = {
    lens: string;
    count: number;
    topTheme: string | null;
    themeCount: number;
    avgSeverity: number;
    constraints: number;
    opportunities: number;
    risks: number;
    contradictions: number;
  };

  const rows: LensRow[] = [];

  if (synthesis?.lensSummaries && Object.keys(synthesis.lensSummaries).length > 0) {
    for (const [lens, summary] of Object.entries(synthesis.lensSummaries)) {
      rows.push({
        lens,
        count: summary.findingCount,
        topTheme: summary.themes[0]?.label ?? null,
        themeCount: summary.themes.length,
        avgSeverity: summary.severityRanking.length > 0
          ? Math.round((summary.severityRanking.reduce((s, r) => s + r.severityScore, 0) / summary.severityRanking.length) * 10) / 10
          : 0,
        constraints: summary.frequencyMetrics.constraints,
        opportunities: summary.frequencyMetrics.opportunities,
        risks: summary.frequencyMetrics.risks,
        contradictions: summary.frequencyMetrics.contradictions,
      });
    }
  } else {
    // Fallback: compute from raw findings
    const lenses = Array.from(new Set(findings.map((f) => f.lens)));
    for (const lens of lenses) {
      const lf = findings.filter((f) => f.lens === lens);
      const scored = lf.filter((f) => f.severityScore != null);
      rows.push({
        lens,
        count: lf.length,
        topTheme: null,
        themeCount: 0,
        avgSeverity: scored.length > 0 ? Math.round((scored.reduce((s, f) => s + (f.severityScore ?? 0), 0) / scored.length) * 10) / 10 : 0,
        constraints: lf.filter((f) => f.type === 'CONSTRAINT').length,
        opportunities: lf.filter((f) => f.type === 'OPPORTUNITY').length,
        risks: lf.filter((f) => f.type === 'RISK').length,
        contradictions: lf.filter((f) => f.type === 'CONTRADICTION').length,
      });
    }
  }

  rows.sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden md:col-span-2">
      <div className="h-1 bg-blue-400" />
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <CardTitle className="text-base font-semibold">Lens Breakdown</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Distribution of findings across diagnostic lenses</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No findings yet.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.lens} className="flex items-center gap-3">
                {/* Lens chip */}
                <div className="flex items-center gap-1.5 w-28 shrink-0">
                  <LensDot lens={row.lens} />
                  <span className="text-xs font-medium truncate">{row.lens}</span>
                </div>

                {/* Bar */}
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 flex items-center pl-2"
                    style={{
                      width: `${Math.round((row.count / maxCount) * 100)}%`,
                      backgroundColor: getLensColor(row.lens),
                    }}
                  >
                    {row.count > 2 && (
                      <span className="text-[10px] font-semibold text-gray-700 tabular-nums">{row.count}</span>
                    )}
                  </div>
                </div>

                {/* Count + avg severity */}
                <div className="w-20 shrink-0 flex items-center justify-end gap-2">
                  {row.count <= 2 && <span className="text-xs font-medium tabular-nums">{row.count}</span>}
                  <SeverityBar score={row.avgSeverity > 0 ? row.avgSeverity : null} />
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] text-muted-foreground">Bar length = finding count · Severity bar = avg score (0–10)</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main FieldInsightsView
// ---------------------------------------------------------------------------

interface FieldInsightsViewProps {
  workshopId: string;
}

export function FieldInsightsView({ workshopId }: FieldInsightsViewProps) {
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [synthesis, setSynthesis] = useState<SynthesisRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [synthesising, setSynthesising] = useState(false);
  const [synthError, setSynthError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [findingsRes, synthRes] = await Promise.all([
        fetch(`/api/admin/workshops/${workshopId}/findings?sourceStream=STREAM_B`),
        fetch(`/api/admin/workshops/${workshopId}/diagnostic-synthesis`),
      ]);

      if (findingsRes.ok) {
        const data = await findingsRes.json();
        setFindings(data.findings ?? []);
      }

      if (synthRes.ok) {
        const data = await synthRes.json();
        setSynthesis(data.synthesis ?? null);
      }
    } catch {
      setError('Could not load insights — check your network connection.');
    }
  }, [workshopId]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const runSynthesis = useCallback(async () => {
    setSynthesising(true);
    setSynthError(null);
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/diagnostic-synthesis`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Synthesis failed');
      const data = await res.json();
      setSynthesis(data.synthesis ?? null);
      // Also refresh findings (synthesis may have changed counts)
      const findingsRes = await fetch(`/api/admin/workshops/${workshopId}/findings?sourceStream=STREAM_B`);
      if (findingsRes.ok) {
        const fData = await findingsRes.json();
        setFindings(fData.findings ?? []);
      }
    } catch {
      setSynthError('Synthesis failed — please try again.');
    } finally {
      setSynthesising(false);
    }
  }, [workshopId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 max-w-lg">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Field Insights</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analysis drawn from {findings.length} STREAM B findings
            {synthesis && ` · Last synthesised ${new Date(synthesis.updatedAt).toLocaleDateString()}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { loadData(); runSynthesis(); }}
          disabled={synthesising || findings.length === 0}
        >
          {synthesising ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
          ) : (
            <><RefreshCcw className="h-4 w-4 mr-2" />Refresh Insights</>
          )}
        </Button>
      </div>

      {/* Synthesis error */}
      {synthError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {synthError}
        </div>
      )}

      {/* No findings yet */}
      {findings.length === 0 && (
        <Card className="rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <Activity className="h-8 w-8 text-amber-400" />
            <div>
              <p className="font-medium text-sm">No field findings yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Capture and analyse sessions on the Capture tab, or import a CSV file to extract findings.
                Once findings exist, insights will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Synthesis CTA — shown when findings exist but no synthesis run */}
      {findings.length > 0 && (!synthesis || synthesis.sessionsProcessed === 0) && (
        <Card className="rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex items-start gap-4 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Synthesis not yet run</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {findings.length} findings have been collected. Generate the synthesis to see cross-lens themes,
                prioritised actions, and critical issues.
              </p>
            </div>
            <Button size="sm" onClick={runSynthesis} disabled={synthesising}>
              {synthesising ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running…</>
              ) : (
                'Generate Insights'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Slide grid */}
      {findings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <OverviewSlide findings={findings} synthesis={synthesis} />
          <CriticalIssuesSlide findings={findings} synthesis={synthesis} />
          <OpportunitiesSlide findings={findings} synthesis={synthesis} />
          <ContradictionsSlide findings={findings} synthesis={synthesis} />
          <LensBreakdownSlide findings={findings} synthesis={synthesis} />
        </div>
      )}
    </div>
  );
}
