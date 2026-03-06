/**
 * Compute Narrative Divergence
 *
 * Groups participant utterances by organisational layer (Executive/Operational/Frontline),
 * computes term frequencies, sentiment distributions, and temporal focus per layer,
 * then identifies divergence points where layers use different language for the same topic.
 */

import { prisma } from '@/lib/prisma';
import { classifyParticipantLayers, type ParticipantInput } from './participant-layers';
import type {
  NarrativeLayer,
  NarrativeDivergenceData,
  NarrativeLayerData,
  TermFrequency,
  DivergencePoint,
  ParticipantLayerAssignment,
} from '@/lib/types/discover-analysis';

interface AnalysisRow {
  sentimentTone: string;
  temporalFocus: string;
  themes: unknown;
  semanticMeaning: string;
  dataPoint: {
    rawText: string;
    participantId: string | null;
  };
}

type ThemeEntry = { label: string };

// Common stop words to exclude from term frequency
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'it', 'its', 'they', 'them', 'their', 'we', 'our', 'us', 'you', 'your',
  'i', 'me', 'my', 'he', 'she', 'him', 'her', 'his', 'this', 'that',
  'these', 'those', 'which', 'what', 'who', 'whom', 'how', 'when',
  'where', 'why', 'not', 'no', 'yes', 'so', 'if', 'then', 'than',
  'very', 'just', 'also', 'more', 'most', 'some', 'any', 'all',
  'about', 'up', 'out', 'into', 'over', 'after', 'before', 'between',
  'under', 'above', 'such', 'each', 'other', 'only', 'same', 'like',
  'think', 'know', 'really', 'lot', 'things', 'thing', 'going', 'get',
  'make', 'way', 'well', 'much', 'many', 'even', 'still', 'back',
]);

/**
 * Compute narrative divergence analysis for a workshop.
 *
 * @param workshopId - Workshop to analyse
 * @param layerOverrides - Optional facilitator overrides for participant layers
 */
export async function computeNarrative(
  workshopId: string,
  layerOverrides?: Record<string, NarrativeLayer>,
): Promise<NarrativeDivergenceData> {
  // 1. Fetch participants
  const participants = await prisma.workshopParticipant.findMany({
    where: { workshopId },
    select: { id: true, name: true, role: true, department: true },
  });

  // 2. Classify into layers (AI-driven with optional overrides)
  const participantInputs: ParticipantInput[] = participants.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    department: p.department,
  }));

  const layerAssignments = await classifyParticipantLayers(participantInputs, layerOverrides);

  // Build lookup: participantId → layer
  const layerLookup = new Map<string, NarrativeLayer>();
  for (const a of layerAssignments) {
    layerLookup.set(a.participantId, a.layer);
  }

  // 3. Fetch analyses with participant info
  const analyses = await prisma.agenticAnalysis.findMany({
    where: {
      dataPoint: { workshopId },
    },
    select: {
      sentimentTone: true,
      temporalFocus: true,
      themes: true,
      semanticMeaning: true,
      dataPoint: {
        select: {
          rawText: true,
          participantId: true,
        },
      },
    },
  }) as unknown as AnalysisRow[];

  // ── Fallback: ConversationReport data ───────────────────────
  if (analyses.length === 0) {
    const [layers, divergencePoints] = await buildNarrativeFromReports(workshopId, layerLookup, layerAssignments);
    return { layerAssignments, layers, divergencePoints };
  }

  // 4. Group analyses by layer
  const layerAnalyses: Record<NarrativeLayer, AnalysisRow[]> = {
    executive: [],
    operational: [],
    frontline: [],
  };

  for (const a of analyses) {
    const pid = a.dataPoint.participantId;
    if (!pid) continue;
    const layer = layerLookup.get(pid) || 'frontline';
    layerAnalyses[layer].push(a);
  }

  // 5. Compute per-layer data
  const layers: NarrativeLayerData[] = (['executive', 'operational', 'frontline'] as NarrativeLayer[])
    .map((layer) => computeLayerData(layer, layerAnalyses[layer], layerAssignments));

  // 6. Identify divergence points
  const divergencePoints = identifyDivergencePoints(layerAnalyses);

  return {
    layerAssignments,
    layers,
    divergencePoints,
  };
}

// ── Layer computation ────────────────────────────────────────

function computeLayerData(
  layer: NarrativeLayer,
  analyses: AnalysisRow[],
  assignments: ParticipantLayerAssignment[],
): NarrativeLayerData {
  const participantCount = assignments.filter((a) => a.layer === layer).length;

  // Term frequencies from raw text + semantic meanings
  const termCounts = new Map<string, number>();
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  const temporalCounts = { past: 0, present: 0, future: 0 };
  const samplePhrases: string[] = [];

  for (const a of analyses) {
    // Count terms from raw text
    const words = extractTerms(a.dataPoint.rawText);
    for (const word of words) {
      termCounts.set(word, (termCounts.get(word) || 0) + 1);
    }

    // Also count theme labels as terms (higher signal)
    const themes = parseJsonArray<ThemeEntry>(a.themes);
    for (const t of themes) {
      const label = t.label?.trim().toLowerCase();
      if (label && label.length > 2) {
        termCounts.set(label, (termCounts.get(label) || 0) + 3); // Weight theme labels higher
      }
    }

    // Sentiment
    const sentiment = normaliseSentiment(a.sentimentTone);
    sentimentCounts[sentiment]++;

    // Temporal focus
    const temporal = normaliseTemporalFocus(a.temporalFocus);
    temporalCounts[temporal]++;

    // Sample phrases (max 5)
    if (samplePhrases.length < 5 && a.dataPoint.rawText) {
      const phrase = a.dataPoint.rawText.slice(0, 150);
      if (phrase.length > 20) samplePhrases.push(phrase);
    }
  }

  // Build top terms (max 15)
  const sortedTerms = [...termCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const maxCount = sortedTerms[0]?.[1] || 1;
  const topTerms: TermFrequency[] = sortedTerms.map(([term, count]) => ({
    term,
    count,
    normalised: Math.round((count / maxCount) * 100) / 100,
  }));

  // Determine dominant sentiment
  const totalSentiment = sentimentCounts.positive + sentimentCounts.negative + sentimentCounts.neutral;
  let dominantSentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
  if (totalSentiment > 0) {
    const posRatio = sentimentCounts.positive / totalSentiment;
    const negRatio = sentimentCounts.negative / totalSentiment;
    if (posRatio > 0.5) dominantSentiment = 'positive';
    else if (negRatio > 0.5) dominantSentiment = 'negative';
    else if (posRatio > 0.3 && negRatio > 0.3) dominantSentiment = 'mixed';
  }

  // Temporal focus normalised
  const totalTemporal = temporalCounts.past + temporalCounts.present + temporalCounts.future || 1;

  return {
    layer,
    participantCount,
    topTerms,
    dominantSentiment,
    temporalFocus: {
      past: Math.round((temporalCounts.past / totalTemporal) * 100) / 100,
      present: Math.round((temporalCounts.present / totalTemporal) * 100) / 100,
      future: Math.round((temporalCounts.future / totalTemporal) * 100) / 100,
    },
    samplePhrases,
  };
}

// ── Divergence detection ─────────────────────────────────────

function identifyDivergencePoints(
  layerAnalyses: Record<NarrativeLayer, AnalysisRow[]>,
): DivergencePoint[] {
  // Build theme→layer→sentiment map
  const themeLayerMap = new Map<string, Map<NarrativeLayer, { sentiments: string[]; phrases: string[] }>>();

  for (const layer of ['executive', 'operational', 'frontline'] as NarrativeLayer[]) {
    for (const a of layerAnalyses[layer]) {
      const themes = parseJsonArray<ThemeEntry>(a.themes);
      for (const t of themes) {
        const label = t.label?.trim();
        if (!label) continue;

        if (!themeLayerMap.has(label)) themeLayerMap.set(label, new Map());
        const layerMap = themeLayerMap.get(label)!;
        if (!layerMap.has(layer)) layerMap.set(layer, { sentiments: [], phrases: [] });

        const entry = layerMap.get(layer)!;
        entry.sentiments.push(a.sentimentTone || 'neutral');
        if (entry.phrases.length < 2 && a.semanticMeaning) {
          entry.phrases.push(a.semanticMeaning.slice(0, 120));
        }
      }
    }
  }

  // Find themes where at least 2 layers discuss it and sentiments diverge
  const divergencePoints: DivergencePoint[] = [];

  for (const [topic, layerMap] of themeLayerMap) {
    if (layerMap.size < 2) continue;

    const positions: { layer: NarrativeLayer; language: string; sentiment: string }[] = [];
    const sentimentSet = new Set<string>();

    for (const [layer, data] of layerMap) {
      const dominant = getDominantSentiment(data.sentiments);
      sentimentSet.add(dominant);
      positions.push({
        layer,
        language: data.phrases[0] || topic,
        sentiment: dominant,
      });
    }

    // Only include if there's actual divergence in sentiment
    if (sentimentSet.size >= 2) {
      divergencePoints.push({ topic, layerPositions: positions });
    }
  }

  // Sort by number of layers involved (more layers = more significant), max 8
  return divergencePoints
    .sort((a, b) => b.layerPositions.length - a.layerPositions.length)
    .slice(0, 8);
}

// ── Helpers ──────────────────────────────────────────────────

function extractTerms(text: string | null): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

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

function normaliseSentiment(tone: string | null | undefined): 'positive' | 'negative' | 'neutral' | 'mixed' {
  if (!tone) return 'neutral';
  const t = tone.toLowerCase();
  if (t === 'positive' || t === 'optimistic') return 'positive';
  if (t === 'negative' || t === 'critical' || t === 'concerned' || t === 'frustrated') return 'negative';
  if (t === 'mixed' || t === 'ambivalent') return 'mixed';
  return 'neutral';
}

function normaliseTemporalFocus(focus: string | null | undefined): 'past' | 'present' | 'future' {
  if (!focus) return 'present';
  const f = focus.toLowerCase();
  if (f === 'past' || f === 'historical') return 'past';
  if (f === 'future' || f === 'aspirational') return 'future';
  return 'present';
}

function getDominantSentiment(sentiments: string[]): string {
  const counts: Record<string, number> = {};
  for (const s of sentiments) {
    const norm = normaliseSentiment(s);
    counts[norm] = (counts[norm] || 0) + 1;
  }
  let max = 0;
  let dominant = 'neutral';
  for (const [s, c] of Object.entries(counts)) {
    if (c > max) { max = c; dominant = s; }
  }
  return dominant;
}

// ── ConversationReport fallback ──────────────────────────────

async function buildNarrativeFromReports(
  workshopId: string,
  layerLookup: Map<string, NarrativeLayer>,
  layerAssignments: ParticipantLayerAssignment[],
): Promise<[NarrativeLayerData[], DivergencePoint[]]> {
  const reports = await prisma.conversationReport.findMany({
    where: { workshopId },
    select: {
      participantId: true,
      tone: true,
      wordCloudThemes: true,
      executiveSummary: true,
      keyInsights: true,
    },
  });

  // Group reports by layer
  const layerReports: Record<NarrativeLayer, typeof reports> = { executive: [], operational: [], frontline: [] };
  for (const report of reports) {
    if (!report.participantId) continue;
    const layer = layerLookup.get(report.participantId) || 'frontline';
    layerReports[layer].push(report);
  }

  // Build per-layer data
  const layers: NarrativeLayerData[] = (['executive', 'operational', 'frontline'] as NarrativeLayer[]).map((layer) => {
    const reps = layerReports[layer];
    const termCounts = new Map<string, number>();
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    const temporalCounts = { past: 0, present: 0, future: 0 };
    const samplePhrases: string[] = [];

    for (const r of reps) {
      const themes = (r.wordCloudThemes as Array<{ text: string; value: number }>) || [];
      for (const t of themes) {
        if (t.text) termCounts.set(t.text, (termCounts.get(t.text) || 0) + t.value);
      }

      const tone = (r.tone as string | null) || '';
      const sentiment = toneToNarrativeSentiment(tone);
      sentimentCounts[sentiment]++;

      const temporal = toneToTemporal(tone);
      temporalCounts[temporal]++;

      if (samplePhrases.length < 3 && r.executiveSummary) {
        samplePhrases.push((r.executiveSummary as string).slice(0, 150));
      }
    }

    const sorted = [...termCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    const maxCount = sorted[0]?.[1] || 1;
    const topTerms: TermFrequency[] = sorted.map(([term, count]) => ({
      term, count, normalised: Math.round((count / maxCount) * 100) / 100,
    }));

    const total = sentimentCounts.positive + sentimentCounts.negative + sentimentCounts.neutral;
    let dominantSentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
    if (total > 0) {
      const posR = sentimentCounts.positive / total;
      const negR = sentimentCounts.negative / total;
      if (posR > 0.5) dominantSentiment = 'positive';
      else if (negR > 0.5) dominantSentiment = 'negative';
      else if (posR > 0.3 && negR > 0.3) dominantSentiment = 'mixed';
    }

    const totalT = temporalCounts.past + temporalCounts.present + temporalCounts.future || 1;

    return {
      layer,
      participantCount: layerAssignments.filter((a) => a.layer === layer).length,
      topTerms,
      dominantSentiment,
      temporalFocus: {
        past: Math.round((temporalCounts.past / totalT) * 100) / 100,
        present: Math.round((temporalCounts.present / totalT) * 100) / 100,
        future: Math.round((temporalCounts.future / totalT) * 100) / 100,
      },
      samplePhrases,
    };
  });

  // Build divergence points from keyInsights across layers
  const topicLayerMap = new Map<string, Map<NarrativeLayer, string[]>>();
  for (const report of reports) {
    if (!report.participantId) continue;
    const layer = layerLookup.get(report.participantId) || 'frontline';
    const tone = (report.tone as string | null) || 'neutral';
    const insights = (report.keyInsights as Array<{ title?: string }>) || [];
    for (const insight of insights) {
      const topic = insight.title?.trim();
      if (!topic) continue;
      if (!topicLayerMap.has(topic)) topicLayerMap.set(topic, new Map());
      const lm = topicLayerMap.get(topic)!;
      if (!lm.has(layer)) lm.set(layer, []);
      lm.get(layer)!.push(tone);
    }
  }

  const divergencePoints: DivergencePoint[] = [];
  for (const [topic, lm] of topicLayerMap) {
    if (lm.size < 2) continue;
    const positions: { layer: NarrativeLayer; language: string; sentiment: string }[] = [];
    const sentimentSet = new Set<string>();
    for (const [layer, tones] of lm) {
      const dominant = getDominantSentiment(tones);
      sentimentSet.add(dominant);
      positions.push({ layer, language: topic, sentiment: dominant });
    }
    if (sentimentSet.size >= 2) {
      divergencePoints.push({ topic, layerPositions: positions });
    }
  }

  return [
    layers,
    divergencePoints.sort((a, b) => b.layerPositions.length - a.layerPositions.length).slice(0, 8),
  ];
}

function toneToNarrativeSentiment(tone: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
  const t = tone.toLowerCase();
  if (t === 'strategic' || t === 'visionary') return 'positive';
  if (t === 'critical') return 'negative';
  if (t === 'constructive') return 'mixed';
  return 'neutral';
}

function toneToTemporal(tone: string): 'past' | 'present' | 'future' {
  const t = tone.toLowerCase();
  if (t === 'visionary' || t === 'strategic') return 'future';
  if (t === 'critical') return 'past';
  return 'present';
}
