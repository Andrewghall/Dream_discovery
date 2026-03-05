/**
 * Findings-to-Analysis Adapter
 *
 * Pure-function adapter that converts Field Discovery Finding[] records
 * into the DiscoverAnalysis shape consumed by the retail-quality
 * visualisation components (AlignmentHeatmap, TensionSurface,
 * ConstraintMap, ConfidenceIndex, NarrativeDivergence).
 *
 * No database calls, no side effects. Safe to call from server or client.
 */

import type {
  DiscoverAnalysis,
  AlignmentHeatmapData,
  AlignmentCell,
  TensionSurfaceData,
  TensionEntry,
  TensionViewpoint,
  NarrativeDivergenceData,
  NarrativeLayerData,
  NarrativeLayer,
  TermFrequency,
  DivergencePoint,
  ParticipantLayerAssignment,
  ConstraintMapData,
  ConstraintNode,
  ConstraintRelationship,
  ConfidenceIndexData,
  ConfidenceDistribution,
  ConfidenceByDomain,
  ConfidenceByLayer,
} from '@/lib/types/discover-analysis';

// ---------------------------------------------------------------------------
// Input type (matches Prisma Finding model)
// ---------------------------------------------------------------------------

export interface FindingRecord {
  id: string;
  workshopId: string;
  sourceStream: 'STREAM_A' | 'STREAM_B';
  lens: string;
  type: string; // CONSTRAINT, OPPORTUNITY, RISK, CONTRADICTION
  title: string;
  description: string;
  severityScore: number | null;
  frequencyCount: number;
  roleCoverage: string[];
  supportingQuotes: any; // JSON array of quote strings or objects
  confidenceScore: number | null;
  captureSessionId: string | null;
  createdAt: Date | string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SEVERITY = 5;
const MAX_TENSIONS = 12;
const MAX_SAMPLE_QUOTES = 3;
const MAX_SAMPLE_PHRASES = 5;
const MAX_DESCRIPTION_LEN = 200;
const MAX_TOP_TERMS = 20;

/** Stop words excluded from term frequency analysis. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'it', 'its',
  'this', 'that', 'these', 'those', 'not', 'no', 'nor', 'as', 'if',
  'then', 'than', 'too', 'very', 'just', 'about', 'above', 'after',
  'again', 'all', 'also', 'am', 'any', 'because', 'before', 'between',
  'both', 'each', 'few', 'more', 'most', 'other', 'our', 'out', 'own',
  'same', 'so', 'some', 'such', 'up', 'we', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'how', 'into', 'through',
  'during', 'over', 'under', 'they', 'them', 'their', 'there', 'here',
]);

/** Temporal keywords used to estimate past/present/future focus. */
const PAST_KEYWORDS = [
  'previously', 'historically', 'legacy', 'used to', 'former', 'traditional',
  'was', 'were', 'had', 'before', 'earlier', 'past', 'old', 'outdated',
];
const PRESENT_KEYWORDS = [
  'currently', 'now', 'today', 'existing', 'ongoing', 'active', 'present',
  'is', 'are', 'right now', 'at the moment',
];
const FUTURE_KEYWORDS = [
  'will', 'plan', 'future', 'upcoming', 'next', 'goal', 'vision', 'target',
  'roadmap', 'aspire', 'intend', 'propose', 'strategy', 'forward', 'transform',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sev(f: FindingRecord): number {
  return f.severityScore ?? DEFAULT_SEVERITY;
}

function conf(f: FindingRecord): number {
  return f.confidenceScore ?? 0.5;
}

/**
 * Extract flat quote strings from the supportingQuotes field,
 * which may be a JSON array of strings, objects with a `text` property,
 * or null/undefined.
 */
function extractQuotes(raw: any): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((q: any) => (typeof q === 'string' ? q : q?.text ?? ''))
    .filter((s: string) => s.length > 0);
}

/**
 * Count keyword matches (case-insensitive) in a body of text.
 */
function countKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    // Simple substring count
    let idx = 0;
    while ((idx = lower.indexOf(kw, idx)) !== -1) {
      count++;
      idx += kw.length;
    }
  }
  return count;
}

/**
 * Extract word frequencies from an array of titles, excluding stop words.
 * Returns sorted by count desc, capped at MAX_TOP_TERMS.
 */
function extractTermFrequencies(titles: string[]): TermFrequency[] {
  const freq = new Map<string, number>();

  for (const title of titles) {
    const words = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }

  const entries = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_TOP_TERMS);
  const maxCount = entries.length > 0 ? entries[0][1] : 1;

  return entries.map(([term, count]) => ({
    term,
    count,
    normalised: Math.round((count / maxCount) * 100) / 100,
  }));
}

/**
 * Determine dominant sentiment from a distribution of finding types.
 */
function dominantSentimentFromTypes(
  types: Record<string, number>
): 'positive' | 'negative' | 'neutral' | 'mixed' {
  const positive = types['OPPORTUNITY'] || 0;
  const negative = (types['CONSTRAINT'] || 0) + (types['RISK'] || 0);
  const neutral = types['CONTRADICTION'] || 0;
  const total = positive + negative + neutral;

  if (total === 0) return 'neutral';
  if (positive > negative * 1.5 && positive > neutral) return 'positive';
  if (negative > positive * 1.5 && negative > neutral) return 'negative';
  if (positive > 0 && negative > 0) return 'mixed';
  return 'neutral';
}

/**
 * Map sourceStream to NarrativeLayer.
 * STREAM_A (remote/survey) -> 'executive'
 * STREAM_B (field/deskside) -> 'frontline'
 */
function streamToLayer(stream: 'STREAM_A' | 'STREAM_B'): NarrativeLayer {
  return stream === 'STREAM_A' ? 'executive' : 'frontline';
}

// ---------------------------------------------------------------------------
// 1. Alignment Heatmap
// ---------------------------------------------------------------------------

/**
 * Build alignment heatmap data from findings.
 *
 * Themes correspond to unique lens values; actors to unique roles from
 * roleCoverage. Each cell aggregates alignment score, sentiment, and quotes
 * for the lens x actor pair.
 */
export function buildAlignmentFromFindings(findings: FindingRecord[]): AlignmentHeatmapData {
  if (findings.length === 0) {
    return { themes: [], actors: [], cells: [] };
  }

  // Collect unique lenses and actors with counts for sorting
  const themeCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();

  for (const f of findings) {
    themeCounts.set(f.lens, (themeCounts.get(f.lens) || 0) + 1);
    for (const role of f.roleCoverage) {
      actorCounts.set(role, (actorCounts.get(role) || 0) + 1);
    }
  }

  // Sort by total finding count desc
  const themes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  const actors = [...actorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([a]) => a);

  // Build cells for every theme x actor pair that has data
  const cells: AlignmentCell[] = [];

  for (const theme of themes) {
    for (const actor of actors) {
      const matching = findings.filter(
        (f) => f.lens === theme && f.roleCoverage.includes(actor)
      );

      if (matching.length === 0) continue;

      // Alignment score: OPPORTUNITY +1, CONSTRAINT/RISK -1, CONTRADICTION -0.5
      let rawScore = 0;
      let positive = 0;
      let negative = 0;
      let neutral = 0;

      for (const f of matching) {
        switch (f.type) {
          case 'OPPORTUNITY':
            rawScore += 1;
            positive++;
            break;
          case 'CONSTRAINT':
          case 'RISK':
            rawScore -= 1;
            negative++;
            break;
          case 'CONTRADICTION':
            rawScore -= 0.5;
            neutral++;
            break;
          default:
            neutral++;
        }
      }

      // Normalize to [-1, +1]
      const alignmentScore =
        matching.length > 0
          ? Math.round((rawScore / matching.length) * 100) / 100
          : 0;

      // Sentiment balance as proportions
      const total = positive + negative + neutral;
      const sentimentBalance = {
        positive: total > 0 ? Math.round((positive / total) * 100) / 100 : 0,
        negative: total > 0 ? Math.round((negative / total) * 100) / 100 : 0,
        neutral: total > 0 ? Math.round((neutral / total) * 100) / 100 : 0,
      };

      // Sample quotes: gather from supportingQuotes, take first 3
      const allQuotes: string[] = [];
      for (const f of matching) {
        allQuotes.push(...extractQuotes(f.supportingQuotes));
      }
      const sampleQuotes = allQuotes.slice(0, MAX_SAMPLE_QUOTES);

      cells.push({
        theme,
        actor,
        alignmentScore,
        sentimentBalance,
        utteranceCount: matching.length,
        sampleQuotes,
      });
    }
  }

  return { themes, actors, cells };
}

// ---------------------------------------------------------------------------
// 2. Tension Surface
// ---------------------------------------------------------------------------

/**
 * Build tension surface data from findings.
 *
 * Primary tension sources are CONTRADICTION-type findings. Additional
 * tensions come from high-severity (>=7) CONSTRAINT and RISK findings
 * that span multiple roles.
 */
export function buildTensionsFromFindings(findings: FindingRecord[]): TensionSurfaceData {
  if (findings.length === 0) {
    return { tensions: [] };
  }

  // Gather tension candidates
  const candidates: FindingRecord[] = [];

  // All contradictions
  for (const f of findings) {
    if (f.type === 'CONTRADICTION') {
      candidates.push(f);
    }
  }

  // High-severity constraints and risks spanning multiple roles
  for (const f of findings) {
    if (
      (f.type === 'CONSTRAINT' || f.type === 'RISK') &&
      sev(f) >= 7 &&
      f.roleCoverage.length >= 2
    ) {
      candidates.push(f);
    }
  }

  // De-duplicate by id (a finding could match both criteria theoretically,
  // but contradictions are never CONSTRAINT/RISK, so this is a safety guard)
  const seen = new Set<string>();
  const unique: FindingRecord[] = [];
  for (const c of candidates) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      unique.push(c);
    }
  }

  // Build tension entries
  const entries: TensionEntry[] = unique.map((f) => {
    const quotes = extractQuotes(f.supportingQuotes);
    const isContradiction = f.type === 'CONTRADICTION';

    // Build viewpoints from roleCoverage
    const viewpoints: TensionViewpoint[] = f.roleCoverage.map((role, idx) => ({
      actor: role,
      position: f.title,
      sentiment: isContradiction
        ? 'mixed'
        : f.type === 'CONSTRAINT'
          ? 'negative'
          : f.type === 'RISK'
            ? 'negative'
            : 'neutral',
      evidenceQuote: quotes[idx] || f.description.slice(0, 120),
    }));

    // tensionIndex = severityScore * (roleCoverage.length / 5) * contradiction multiplier
    const tensionIndex =
      Math.round(
        sev(f) * (f.roleCoverage.length / 5) * (isContradiction ? 1.5 : 1.0) * 100
      ) / 100;

    const severity: TensionEntry['severity'] =
      tensionIndex >= 10 ? 'critical' : tensionIndex >= 5 ? 'significant' : 'moderate';

    return {
      id: f.id,
      topic: f.title,
      rank: 0, // assigned after sorting
      tensionIndex,
      severity,
      viewpoints,
      affectedActors: [...f.roleCoverage],
      relatedConstraints: [] as string[],
      domain: f.lens,
    };
  });

  // Sort by tensionIndex desc, assign ranks, cap at MAX_TENSIONS
  entries.sort((a, b) => b.tensionIndex - a.tensionIndex);
  const capped = entries.slice(0, MAX_TENSIONS);
  for (let i = 0; i < capped.length; i++) {
    capped[i].rank = i + 1;
  }

  return { tensions: capped };
}

// ---------------------------------------------------------------------------
// 3. Narrative Divergence
// ---------------------------------------------------------------------------

/**
 * Build narrative divergence data from findings.
 *
 * Layers are derived from sourceStream:
 *   STREAM_A (remote/survey) -> 'executive'
 *   STREAM_B (field/deskside) -> 'frontline'
 *
 * Divergence points identify lenses where the two streams show different
 * severity or type distributions.
 */
export function buildNarrativeFromFindings(findings: FindingRecord[]): NarrativeDivergenceData {
  if (findings.length === 0) {
    return { layerAssignments: [], layers: [], divergencePoints: [] };
  }

  // Group by stream
  const byStream: Record<string, FindingRecord[]> = {};
  for (const f of findings) {
    const key = f.sourceStream;
    if (!byStream[key]) byStream[key] = [];
    byStream[key].push(f);
  }

  // Build layer data for each stream that has findings
  const layers: NarrativeLayerData[] = [];
  const streamKeys: Array<'STREAM_A' | 'STREAM_B'> = ['STREAM_A', 'STREAM_B'];

  for (const stream of streamKeys) {
    const streamFindings = byStream[stream];
    if (!streamFindings || streamFindings.length === 0) continue;

    const layer = streamToLayer(stream);

    // Top terms from titles
    const topTerms = extractTermFrequencies(streamFindings.map((f) => f.title));

    // Type distribution for dominant sentiment
    const typeDist: Record<string, number> = {};
    for (const f of streamFindings) {
      typeDist[f.type] = (typeDist[f.type] || 0) + 1;
    }
    const dominantSentiment = dominantSentimentFromTypes(typeDist);

    // Temporal focus estimated from description keywords
    const allDescriptions = streamFindings.map((f) => f.description).join(' ');
    const pastCount = countKeywords(allDescriptions, PAST_KEYWORDS);
    const presentCount = countKeywords(allDescriptions, PRESENT_KEYWORDS);
    const futureCount = countKeywords(allDescriptions, FUTURE_KEYWORDS);
    const temporalTotal = pastCount + presentCount + futureCount || 1;
    const temporalFocus = {
      past: Math.round((pastCount / temporalTotal) * 100) / 100,
      present: Math.round((presentCount / temporalTotal) * 100) / 100,
      future: Math.round((futureCount / temporalTotal) * 100) / 100,
    };

    // Sample phrases from descriptions
    const samplePhrases = streamFindings
      .slice(0, MAX_SAMPLE_PHRASES)
      .map((f) => f.description.slice(0, 150));

    layers.push({
      layer,
      participantCount: streamFindings.length,
      topTerms,
      dominantSentiment,
      temporalFocus,
      samplePhrases,
    });
  }

  // Layer assignments: empty (no individual participants in findings context)
  const layerAssignments: ParticipantLayerAssignment[] = [];

  // Divergence points: find lenses where Stream A and Stream B diverge
  const divergencePoints: DivergencePoint[] = [];
  const allLenses = [...new Set(findings.map((f) => f.lens))];

  for (const lens of allLenses) {
    const streamAFindings = (byStream['STREAM_A'] || []).filter((f) => f.lens === lens);
    const streamBFindings = (byStream['STREAM_B'] || []).filter((f) => f.lens === lens);

    // Need data from both streams to detect divergence
    if (streamAFindings.length === 0 || streamBFindings.length === 0) continue;

    // Compare average severity
    const avgSevA =
      streamAFindings.reduce((sum, f) => sum + sev(f), 0) / streamAFindings.length;
    const avgSevB =
      streamBFindings.reduce((sum, f) => sum + sev(f), 0) / streamBFindings.length;

    // Compare type distributions
    const typeDistA: Record<string, number> = {};
    for (const f of streamAFindings) {
      typeDistA[f.type] = (typeDistA[f.type] || 0) + 1;
    }
    const typeDistB: Record<string, number> = {};
    for (const f of streamBFindings) {
      typeDistB[f.type] = (typeDistB[f.type] || 0) + 1;
    }

    const sentimentA = dominantSentimentFromTypes(typeDistA);
    const sentimentB = dominantSentimentFromTypes(typeDistB);

    // Divergence threshold: severity gap >= 2 OR different dominant sentiments
    const severityGap = Math.abs(avgSevA - avgSevB);
    if (severityGap >= 2 || sentimentA !== sentimentB) {
      const layerPositions: DivergencePoint['layerPositions'] = [];

      if (streamAFindings.length > 0) {
        layerPositions.push({
          layer: 'executive' as NarrativeLayer,
          language: streamAFindings
            .slice(0, 2)
            .map((f) => f.title)
            .join('; '),
          sentiment: sentimentA,
        });
      }

      if (streamBFindings.length > 0) {
        layerPositions.push({
          layer: 'frontline' as NarrativeLayer,
          language: streamBFindings
            .slice(0, 2)
            .map((f) => f.title)
            .join('; '),
          sentiment: sentimentB,
        });
      }

      divergencePoints.push({
        topic: lens,
        layerPositions,
      });
    }
  }

  return { layerAssignments, layers, divergencePoints };
}

// ---------------------------------------------------------------------------
// 4. Constraint Map
// ---------------------------------------------------------------------------

/**
 * Build constraint map data from findings.
 *
 * Filters to CONSTRAINT and RISK type findings and converts each into a
 * ConstraintNode sorted by computed weight.
 */
export function buildConstraintsFromFindings(findings: FindingRecord[]): ConstraintMapData {
  const constraintFindings = findings.filter(
    (f) => f.type === 'CONSTRAINT' || f.type === 'RISK'
  );

  if (constraintFindings.length === 0) {
    return { constraints: [], relationships: [] };
  }

  const constraints: ConstraintNode[] = constraintFindings.map((f) => {
    const severityVal = sev(f);
    const severity: ConstraintNode['severity'] =
      severityVal >= 7 ? 'critical' : severityVal >= 4 ? 'significant' : 'moderate';

    const severityMultiplier =
      severity === 'critical' ? 3 : severity === 'significant' ? 2 : 1;
    const weight = f.frequencyCount * severityMultiplier;

    // Description: title + description, capped
    const fullDesc = f.title + ': ' + f.description;
    const description =
      fullDesc.length > MAX_DESCRIPTION_LEN
        ? fullDesc.slice(0, MAX_DESCRIPTION_LEN)
        : fullDesc;

    return {
      id: f.id,
      description,
      domain: f.lens,
      frequency: f.frequencyCount,
      severity,
      weight,
      dependsOn: [],
      blocks: [],
    };
  });

  // Sort by weight desc
  constraints.sort((a, b) => b.weight - a.weight);

  // No relationship data available from findings alone
  const relationships: ConstraintRelationship[] = [];

  return { constraints, relationships };
}

// ---------------------------------------------------------------------------
// 5. Confidence Index
// ---------------------------------------------------------------------------

/**
 * Build confidence index data from findings.
 *
 * Buckets findings by confidenceScore into certain (>0.8), hedging (0.5-0.8),
 * and uncertain (<0.5). Aggregates overall, by domain (lens), and by layer
 * (sourceStream).
 */
export function buildConfidenceFromFindings(findings: FindingRecord[]): ConfidenceIndexData {
  if (findings.length === 0) {
    return {
      overall: { certain: 0, hedging: 0, uncertain: 0 },
      byDomain: [],
      byLayer: [],
    };
  }

  // Helper to bucket a set of findings
  function buildDistribution(items: FindingRecord[]): ConfidenceDistribution {
    let certain = 0;
    let hedging = 0;
    let uncertain = 0;

    for (const f of items) {
      const c = conf(f);
      if (c > 0.8) certain++;
      else if (c >= 0.5) hedging++;
      else uncertain++;
    }

    return { certain, hedging, uncertain };
  }

  // Overall
  const overall = buildDistribution(findings);

  // By domain (lens)
  const byLens = new Map<string, FindingRecord[]>();
  for (const f of findings) {
    if (!byLens.has(f.lens)) byLens.set(f.lens, []);
    byLens.get(f.lens)!.push(f);
  }

  const byDomain: ConfidenceByDomain[] = [...byLens.entries()].map(([domain, items]) => {
    const distribution = buildDistribution(items);

    // Extract short hedging phrases from descriptions of hedging-confidence findings
    const hedgingFindings = items.filter((f) => {
      const c = conf(f);
      return c >= 0.5 && c <= 0.8;
    });

    const hedgingPhrases = hedgingFindings
      .slice(0, 5)
      .map((f) => {
        // Take first sentence or first 80 chars, whichever is shorter
        const firstSentence = f.description.split(/[.!?]/)[0] || '';
        return firstSentence.length > 80
          ? firstSentence.slice(0, 80) + '...'
          : firstSentence;
      })
      .filter((p) => p.length > 0);

    return { domain, distribution, hedgingPhrases };
  });

  // By layer (sourceStream -> NarrativeLayer)
  const byStream = new Map<string, FindingRecord[]>();
  for (const f of findings) {
    const key = f.sourceStream;
    if (!byStream.has(key)) byStream.set(key, []);
    byStream.get(key)!.push(f);
  }

  const byLayer: ConfidenceByLayer[] = [...byStream.entries()].map(([stream, items]) => ({
    layer: streamToLayer(stream as 'STREAM_A' | 'STREAM_B'),
    distribution: buildDistribution(items),
  }));

  return { overall, byDomain, byLayer };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Build a complete DiscoverAnalysis from an array of FindingRecord objects.
 *
 * This is the main entry point. All sub-builders are called internally.
 * The returned object is ready for direct consumption by the retail-quality
 * visualisation components with no further transformation.
 *
 * @param workshopId - The workshop these findings belong to
 * @param findings   - Array of FindingRecord objects (may be empty)
 * @returns A fully populated DiscoverAnalysis object
 */
export function buildAnalysisFromFindings(
  workshopId: string,
  findings: FindingRecord[]
): DiscoverAnalysis {
  // Collect unique actors across all findings to approximate participant count
  const uniqueActors = new Set<string>();
  for (const f of findings) {
    for (const role of f.roleCoverage) {
      uniqueActors.add(role);
    }
  }

  return {
    workshopId,
    generatedAt: new Date().toISOString(),
    participantCount: uniqueActors.size,
    alignment: buildAlignmentFromFindings(findings),
    tensions: buildTensionsFromFindings(findings),
    narrative: buildNarrativeFromFindings(findings),
    constraints: buildConstraintsFromFindings(findings),
    confidence: buildConfidenceFromFindings(findings),
  };
}
