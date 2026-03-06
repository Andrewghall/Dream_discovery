/**
 * Compute Alignment Heatmap
 *
 * Aggregates actor×theme alignment scores from AgenticAnalysis data.
 * Falls back to ConversationReport data when no AgenticAnalysis exists.
 */

import { prisma } from '@/lib/prisma';
import type { AlignmentHeatmapData, AlignmentCell } from '@/lib/types/discover-analysis';

type ThemeEntry = { label: string; category?: string; confidence?: number; reasoning?: string };
type ActorEntry = { name: string; role?: string; interactions?: Array<{ withActor?: string; action?: string; sentiment?: string; context?: string }> };

interface AnalysisRow {
  sentimentTone: string;
  themes: unknown;
  actors: unknown;
  dataPoint: {
    rawText: string;
  };
}

/**
 * Compute alignment heatmap for a workshop.
 *
 * Builds a theme×actor matrix from AgenticAnalysis data, computing
 * sentiment-based alignment scores for each cell.
 */
export async function computeAlignment(workshopId: string): Promise<AlignmentHeatmapData> {
  // Fetch all agentic analyses for this workshop
  const analyses = await prisma.agenticAnalysis.findMany({
    where: {
      dataPoint: { workshopId },
    },
    select: {
      sentimentTone: true,
      themes: true,
      actors: true,
      dataPoint: {
        select: { rawText: true },
      },
    },
  }) as unknown as AnalysisRow[];

  // Accumulate data per theme×actor pair
  const cellMap = new Map<string, {
    theme: string;
    actor: string;
    positive: number;
    negative: number;
    neutral: number;
    quotes: string[];
  }>();

  // Count totals for ranking
  const themeCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();

  for (const a of analyses) {
    const themes = parseJsonArray<ThemeEntry>(a.themes);
    const actors = parseJsonArray<ActorEntry>(a.actors);
    const sentiment = normaliseSentiment(a.sentimentTone);
    const quote = a.dataPoint.rawText?.slice(0, 200) || '';

    // Extract theme labels
    const themeLabels = themes
      .map((t) => t.label?.trim())
      .filter((l): l is string => !!l);

    // Extract actor names
    const actorNames = actors
      .map((ac) => ac.name?.trim())
      .filter((n): n is string => !!n);

    // If no actors found, use "General" as catch-all
    const effectiveActors = actorNames.length > 0 ? actorNames : ['General'];

    for (const theme of themeLabels) {
      themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);

      for (const actor of effectiveActors) {
        actorCounts.set(actor, (actorCounts.get(actor) || 0) + 1);

        const key = `${theme}|||${actor}`;
        const cell = cellMap.get(key) || {
          theme,
          actor,
          positive: 0,
          negative: 0,
          neutral: 0,
          quotes: [],
        };

        if (sentiment === 'positive') cell.positive++;
        else if (sentiment === 'negative') cell.negative++;
        else cell.neutral++;

        if (quote && cell.quotes.length < 3) {
          cell.quotes.push(quote);
        }

        cellMap.set(key, cell);
      }
    }
  }

  // Theme density normalisation: rank by density (mentions / total) not raw count
  const totalThemeMentions = [...themeCounts.values()].reduce((s, c) => s + c, 0) || 1;
  const topThemes = [...themeCounts.entries()]
    .sort((a, b) => (b[1] / totalThemeMentions) - (a[1] / totalThemeMentions))
    .slice(0, 10)
    .map(([theme]) => theme);

  // Actor normalisation: equalise actor influence regardless of mention volume
  const totalActorMentions = [...actorCounts.values()].reduce((s, c) => s + c, 0) || 1;
  const topActors = [...actorCounts.entries()]
    .sort((a, b) => (b[1] / totalActorMentions) - (a[1] / totalActorMentions))
    .slice(0, 10)
    .map(([actor]) => actor);

  // Build cells for top themes × top actors only
  const topThemeSet = new Set(topThemes);
  const topActorSet = new Set(topActors);

  const cells: AlignmentCell[] = [];

  for (const [, cell] of cellMap) {
    if (!topThemeSet.has(cell.theme) || !topActorSet.has(cell.actor)) continue;

    const total = cell.positive + cell.negative + cell.neutral;
    if (total === 0) continue;

    // Alignment score: -1 (all negative) → 0 (balanced) → +1 (all positive)
    const alignmentScore = total > 0
      ? (cell.positive - cell.negative) / total
      : 0;

    cells.push({
      theme: cell.theme,
      actor: cell.actor,
      alignmentScore: Math.round(alignmentScore * 100) / 100,
      sentimentBalance: {
        positive: cell.positive,
        negative: cell.negative,
        neutral: cell.neutral,
      },
      utteranceCount: total,
      sampleQuotes: cell.quotes,
    });
  }

  // ── Fallback: ConversationReport data ───────────────────
  if (analyses.length === 0) {
    return computeAlignmentFromReports(workshopId);
  }

  return {
    themes: topThemes,
    actors: topActors,
    cells,
  };
}

// ── ConversationReport fallback ──────────────────────────────

async function computeAlignmentFromReports(workshopId: string): Promise<AlignmentHeatmapData> {
  const reports = await prisma.conversationReport.findMany({
    where: { workshopId },
    select: {
      tone: true,
      keyInsights: true,
      participant: { select: { role: true } },
    },
  });

  const cellMap = new Map<string, {
    theme: string; actor: string;
    positive: number; negative: number; neutral: number; quotes: string[];
  }>();
  const themeCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();

  for (const report of reports) {
    const actor = groupRole((report.participant as { role?: string } | null)?.role ?? null);
    const sentiment = toneToSentiment(report.tone as string | null);
    const insights = (report.keyInsights as Array<{ title?: string }>) || [];

    actorCounts.set(actor, (actorCounts.get(actor) || 0) + 1);

    for (const insight of insights) {
      const theme = insight.title?.trim();
      if (!theme) continue;
      themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);

      const key = `${theme}|||${actor}`;
      const cell = cellMap.get(key) || { theme, actor, positive: 0, negative: 0, neutral: 0, quotes: [] };
      if (sentiment === 'positive') cell.positive++;
      else if (sentiment === 'negative') cell.negative++;
      else cell.neutral++;
      cellMap.set(key, cell);
    }
  }

  const totalTheme = [...themeCounts.values()].reduce((s, c) => s + c, 0) || 1;
  const topThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] / totalTheme - a[1] / totalTheme)
    .slice(0, 10).map(([t]) => t);

  const totalActor = [...actorCounts.values()].reduce((s, c) => s + c, 0) || 1;
  const topActors = [...actorCounts.entries()]
    .sort((a, b) => b[1] / totalActor - a[1] / totalActor)
    .slice(0, 10).map(([a]) => a);

  const topThemeSet = new Set(topThemes);
  const topActorSet = new Set(topActors);

  const cells: AlignmentCell[] = [];
  for (const [, cell] of cellMap) {
    if (!topThemeSet.has(cell.theme) || !topActorSet.has(cell.actor)) continue;
    const total = cell.positive + cell.negative + cell.neutral;
    if (total === 0) continue;
    const alignmentScore = (cell.positive - cell.negative) / total;
    cells.push({
      theme: cell.theme,
      actor: cell.actor,
      alignmentScore: Math.round(alignmentScore * 100) / 100,
      sentimentBalance: { positive: cell.positive, negative: cell.negative, neutral: cell.neutral },
      utteranceCount: total,
      sampleQuotes: cell.quotes,
    });
  }

  return { themes: topThemes, actors: topActors, cells };
}

function groupRole(role: string | null): string {
  if (!role) return 'General';
  const r = role.toLowerCase();
  if (/\b(ceo|chief|director|vp|vice.president|head of|president|executive)\b/.test(r)) return 'Leadership';
  if (/\b(manager|lead|supervisor|coordinator)\b/.test(r)) return 'Management';
  if (/\b(customer|service|agent|cabin|crew|passenger)\b/.test(r)) return 'Customer Ops';
  if (/\b(tech|it\b|system|data|engineer|developer|analyst)\b/.test(r)) return 'Technology';
  if (/\b(ops|operation|logistics|ground|dispatch|handling)\b/.test(r)) return 'Operations';
  return 'General Staff';
}

function toneToSentiment(tone: string | null): 'positive' | 'negative' | 'neutral' {
  if (!tone) return 'neutral';
  const t = tone.toLowerCase();
  if (t === 'strategic' || t === 'visionary') return 'positive';
  if (t === 'critical') return 'negative';
  return 'neutral';
}

// ── Helpers ──────────────────────────────────────────────────

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normaliseSentiment(tone: string | null | undefined): 'positive' | 'negative' | 'neutral' {
  if (!tone) return 'neutral';
  const t = tone.toLowerCase();
  if (t === 'positive' || t === 'optimistic' || t === 'enthusiastic') return 'positive';
  if (t === 'negative' || t === 'critical' || t === 'concerned' || t === 'frustrated') return 'negative';
  return 'neutral';
}
