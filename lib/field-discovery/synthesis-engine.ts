/**
 * Synthesis Engine
 *
 * Purely deterministic (no LLM calls) synthesis of Findings into
 * diagnostic summaries. Same pure-function pattern as
 * lib/cognitive-guidance/pipeline.ts.
 *
 * Two main operations:
 *   1. runIncrementalSynthesis - group findings by lens, compute themes,
 *      severity rankings, frequency metrics, role distribution
 *   2. runStreamComparison - compare Stream A (remote discovery) vs
 *      Stream B (field capture) per lens
 */

import { prisma } from '@/lib/prisma';
import type { Finding, SourceStream } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LensSummary {
  lens: string;
  findingCount: number;
  themes: ThemeCluster[];
  severityRanking: Array<{ title: string; severityScore: number; type: string }>;
  frequencyMetrics: { constraints: number; opportunities: number; risks: number; contradictions: number };
  roleDistribution: Record<string, number>;
  quickWins: Array<{ title: string; description: string; severityScore: number }>;
}

export interface ThemeCluster {
  label: string;
  findingCount: number;
  avgSeverity: number;
  types: string[];
}

export interface CrossLensAnalysis {
  structuralWeaknesses: Array<{ description: string; lenses: string[]; severity: number }>;
  systemicRisks: Array<{ description: string; lenses: string[]; severity: number }>;
  contradictions: Array<{ description: string; lenses: string[]; severity: number }>;
  actions30Day: string[];
  actions90Day: string[];
}

export interface StreamComparisonLens {
  lens: string;
  streamACount: number;
  streamBCount: number;
  streamAAvgSeverity: number;
  streamBAvgSeverity: number;
  alignmentGapIndex: number; // 0 = perfect alignment, 1 = complete misalignment
  perceptionVsReality: string; // summary label
}

export interface StreamComparison {
  lensComparisons: StreamComparisonLens[];
  overallAlignmentGap: number;
  perceptionGaps: string[];
  leadershipVsFrontline: string[];
  frictionClusters: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function extractThemeClusters(findings: Finding[]): ThemeCluster[] {
  // Group findings by their first significant word in the title as a simple clustering
  const titleWords = new Map<string, Finding[]>();

  for (const f of findings) {
    // Use first two words of title as cluster key (simple approach)
    const words = f.title.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
    const key = words || 'uncategorised';
    if (!titleWords.has(key)) titleWords.set(key, []);
    titleWords.get(key)!.push(f);
  }

  const clusters: ThemeCluster[] = [];
  for (const [label, group] of titleWords) {
    if (group.length >= 1) {
      clusters.push({
        label: label.replace(/\b\w/g, (c) => c.toUpperCase()),
        findingCount: group.length,
        avgSeverity: avg(group.map((f) => f.severityScore ?? 0)),
        types: [...new Set(group.map((f) => f.type))],
      });
    }
  }

  return clusters.sort((a, b) => b.avgSeverity - a.avgSeverity);
}

// ---------------------------------------------------------------------------
// Incremental Synthesis
// ---------------------------------------------------------------------------

export async function runIncrementalSynthesis(workshopId: string): Promise<void> {
  const findings = await prisma.finding.findMany({
    where: { workshopId },
    orderBy: { createdAt: 'desc' },
  });

  if (findings.length === 0) return;

  // Group by lens
  const byLens = groupBy(findings, (f) => f.lens);

  const lensSummaries: Record<string, LensSummary> = {};

  for (const [lens, lensFindings] of Object.entries(byLens)) {
    const themes = extractThemeClusters(lensFindings);

    const severityRanking = lensFindings
      .filter((f) => f.severityScore != null)
      .sort((a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0))
      .slice(0, 10)
      .map((f) => ({ title: f.title, severityScore: f.severityScore ?? 0, type: f.type }));

    const frequencyMetrics = {
      constraints: lensFindings.filter((f) => f.type === 'CONSTRAINT').length,
      opportunities: lensFindings.filter((f) => f.type === 'OPPORTUNITY').length,
      risks: lensFindings.filter((f) => f.type === 'RISK').length,
      contradictions: lensFindings.filter((f) => f.type === 'CONTRADICTION').length,
    };

    const roleDistribution: Record<string, number> = {};
    for (const f of lensFindings) {
      for (const role of f.roleCoverage) {
        roleDistribution[role] = (roleDistribution[role] || 0) + 1;
      }
    }

    // Quick wins: opportunities with moderate-to-high severity
    const quickWins = lensFindings
      .filter((f) => f.type === 'OPPORTUNITY' && (f.severityScore ?? 0) >= 5)
      .sort((a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0))
      .slice(0, 5)
      .map((f) => ({
        title: f.title,
        description: f.description,
        severityScore: f.severityScore ?? 0,
      }));

    lensSummaries[lens] = {
      lens,
      findingCount: lensFindings.length,
      themes,
      severityRanking,
      frequencyMetrics,
      roleDistribution,
      quickWins,
    };
  }

  // Cross-lens analysis
  const highSeverity = findings.filter((f) => (f.severityScore ?? 0) >= 7);
  const crossLensFindings = groupBy(highSeverity, (f) => f.type);

  const crossLens: CrossLensAnalysis = {
    structuralWeaknesses: (crossLensFindings['CONSTRAINT'] || [])
      .slice(0, 5)
      .map((f) => ({
        description: f.title + ': ' + f.description.slice(0, 100),
        lenses: [f.lens],
        severity: f.severityScore ?? 0,
      })),
    systemicRisks: (crossLensFindings['RISK'] || [])
      .slice(0, 5)
      .map((f) => ({
        description: f.title + ': ' + f.description.slice(0, 100),
        lenses: [f.lens],
        severity: f.severityScore ?? 0,
      })),
    contradictions: (crossLensFindings['CONTRADICTION'] || [])
      .slice(0, 5)
      .map((f) => ({
        description: f.title + ': ' + f.description.slice(0, 100),
        lenses: [f.lens],
        severity: f.severityScore ?? 0,
      })),
    actions30Day: findings
      .filter((f) => f.type === 'OPPORTUNITY' && (f.severityScore ?? 0) >= 7)
      .slice(0, 3)
      .map((f) => f.title),
    actions90Day: findings
      .filter((f) => f.type === 'OPPORTUNITY' && (f.severityScore ?? 0) >= 5 && (f.severityScore ?? 0) < 7)
      .slice(0, 5)
      .map((f) => f.title),
  };

  // Count processed sessions
  const sessionsProcessed = await prisma.captureSession.count({
    where: { workshopId, status: 'ANALYSED' },
  });

  // Upsert DiagnosticSynthesis
  await prisma.diagnosticSynthesis.upsert({
    where: { workshopId },
    create: {
      workshopId,
      lensSummaries: lensSummaries as any,
      crossLens: crossLens as any,
      sessionsProcessed,
      version: 1,
    },
    update: {
      lensSummaries: lensSummaries as any,
      crossLens: crossLens as any,
      sessionsProcessed,
      version: { increment: 1 },
    },
  });
}

// ---------------------------------------------------------------------------
// Stream Comparison
// ---------------------------------------------------------------------------

export async function runStreamComparison(workshopId: string): Promise<void> {
  const findings = await prisma.finding.findMany({
    where: { workshopId },
  });

  if (findings.length === 0) return;

  const streamA = findings.filter((f) => f.sourceStream === 'STREAM_A');
  const streamB = findings.filter((f) => f.sourceStream === 'STREAM_B');

  // Get unique lenses
  const allLenses = [...new Set(findings.map((f) => f.lens))];

  const lensComparisons: StreamComparisonLens[] = allLenses.map((lens) => {
    const aFindings = streamA.filter((f) => f.lens === lens);
    const bFindings = streamB.filter((f) => f.lens === lens);

    const aAvg = avg(aFindings.map((f) => f.severityScore ?? 0));
    const bAvg = avg(bFindings.map((f) => f.severityScore ?? 0));

    // Alignment gap: normalised difference in severity distribution
    const maxSeverity = Math.max(aAvg, bAvg, 1);
    const gap = Math.abs(aAvg - bAvg) / maxSeverity;

    let label = 'Aligned';
    if (gap > 0.5) label = 'Significant gap';
    else if (gap > 0.25) label = 'Moderate gap';
    else if (gap > 0.1) label = 'Minor gap';

    return {
      lens,
      streamACount: aFindings.length,
      streamBCount: bFindings.length,
      streamAAvgSeverity: Math.round(aAvg * 10) / 10,
      streamBAvgSeverity: Math.round(bAvg * 10) / 10,
      alignmentGapIndex: Math.round(gap * 100) / 100,
      perceptionVsReality: label,
    };
  });

  const overallAlignmentGap =
    lensComparisons.length > 0
      ? Math.round(avg(lensComparisons.map((lc) => lc.alignmentGapIndex)) * 100) / 100
      : 0;

  // Detect perception gaps (where Stream A severity is much lower than Stream B)
  const perceptionGaps = lensComparisons
    .filter((lc) => lc.streamBAvgSeverity - lc.streamAAvgSeverity > 2)
    .map((lc) => `${lc.lens}: Field reality (${lc.streamBAvgSeverity}) exceeds remote perception (${lc.streamAAvgSeverity})`);

  // Leadership vs frontline detection
  const executiveFindings = findings.filter((f) => f.roleCoverage.some((r) =>
    r.includes('executive') || r.includes('director') || r.includes('ceo') || r.includes('cxo') || r.includes('head')
  ));
  const frontlineFindings = findings.filter((f) => f.roleCoverage.some((r) =>
    r.includes('agent') || r.includes('frontline') || r.includes('operational') || r.includes('employee')
  ));

  const leadershipVsFrontline: string[] = [];
  for (const lens of allLenses) {
    const execAvg = avg(executiveFindings.filter((f) => f.lens === lens).map((f) => f.severityScore ?? 0));
    const frontAvg = avg(frontlineFindings.filter((f) => f.lens === lens).map((f) => f.severityScore ?? 0));
    if (Math.abs(execAvg - frontAvg) > 2 && executiveFindings.length > 0 && frontlineFindings.length > 0) {
      leadershipVsFrontline.push(
        `${lens}: Leadership avg severity ${execAvg.toFixed(1)} vs Frontline avg severity ${frontAvg.toFixed(1)}`
      );
    }
  }

  // Friction clusters: lenses with high constraint + risk density
  const frictionClusters = allLenses
    .filter((lens) => {
      const lensF = findings.filter((f) => f.lens === lens);
      const frictionCount = lensF.filter((f) => f.type === 'CONSTRAINT' || f.type === 'RISK').length;
      return frictionCount >= 3;
    })
    .map((lens) => `${lens}: High friction density`);

  const streamComparison: StreamComparison = {
    lensComparisons,
    overallAlignmentGap,
    perceptionGaps,
    leadershipVsFrontline,
    frictionClusters,
  };

  // Update the synthesis record with stream comparison
  await prisma.diagnosticSynthesis.upsert({
    where: { workshopId },
    create: {
      workshopId,
      streamComparison: streamComparison as any,
      version: 1,
    },
    update: {
      streamComparison: streamComparison as any,
    },
  });
}
