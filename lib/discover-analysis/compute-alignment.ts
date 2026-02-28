/**
 * Compute Alignment Heatmap
 *
 * Aggregates actor×theme alignment scores from AgenticAnalysis data.
 * Each cell represents how a particular actor group relates to a theme,
 * with alignment derived from sentiment distribution.
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

  // Get top themes and actors by frequency (max 10 each)
  const topThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([theme]) => theme);

  const topActors = [...actorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
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

  return {
    themes: topThemes,
    actors: topActors,
    cells,
  };
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
