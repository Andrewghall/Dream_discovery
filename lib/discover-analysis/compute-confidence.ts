/**
 * Compute Confidence Index
 *
 * Analyses certainty, hedging, and uncertainty across the workshop's
 * agentic analyses. Groups by domain and narrative layer.
 */

import { prisma } from '@/lib/prisma';
import type {
  ConfidenceIndexData,
  ConfidenceDistribution,
  ConfidenceByDomain,
  ConfidenceByLayer,
  NarrativeLayer,
} from '@/lib/types/discover-analysis';

interface AnalysisRow {
  overallConfidence: number;
  uncertainties: string[];
  domains: unknown;
  dataPoint: {
    participantId: string | null;
  };
}

type DomainEntry = { domain: string; relevance?: number };

/**
 * Compute confidence index for a workshop.
 *
 * @param workshopId - Workshop to analyse
 * @param layerLookup - participantId → NarrativeLayer (from narrative computation)
 */
export async function computeConfidence(
  workshopId: string,
  layerLookup: Map<string, NarrativeLayer>,
): Promise<ConfidenceIndexData> {
  const analyses = await prisma.agenticAnalysis.findMany({
    where: {
      dataPoint: { workshopId },
    },
    select: {
      overallConfidence: true,
      uncertainties: true,
      domains: true,
      dataPoint: {
        select: { participantId: true },
      },
    },
  }) as unknown as AnalysisRow[];

  // Accumulators
  const overall: ConfidenceDistribution = { certain: 0, hedging: 0, uncertain: 0 };

  const domainAccum = new Map<string, {
    certain: number;
    hedging: number;
    uncertain: number;
    hedgingPhrases: string[];
  }>();

  const layerAccum = new Map<NarrativeLayer, ConfidenceDistribution>();
  for (const l of ['executive', 'operational', 'frontline'] as NarrativeLayer[]) {
    layerAccum.set(l, { certain: 0, hedging: 0, uncertain: 0 });
  }

  for (const a of analyses) {
    const conf = a.overallConfidence;
    const hasUncertainties = a.uncertainties && a.uncertainties.length > 0;

    // Classify this data point
    let classification: 'certain' | 'hedging' | 'uncertain';
    if (conf >= 0.8 && !hasUncertainties) {
      classification = 'certain';
    } else if (conf < 0.5) {
      classification = 'uncertain';
    } else {
      classification = 'hedging';
    }

    // Overall
    overall[classification]++;

    // By domain
    const domains = parseJsonArray<DomainEntry>(a.domains);
    for (const d of domains) {
      const domainName = d.domain?.trim();
      if (!domainName) continue;

      if (!domainAccum.has(domainName)) {
        domainAccum.set(domainName, { certain: 0, hedging: 0, uncertain: 0, hedgingPhrases: [] });
      }
      const acc = domainAccum.get(domainName)!;
      acc[classification]++;

      // Collect hedging phrases
      if (classification === 'hedging' || classification === 'uncertain') {
        for (const phrase of a.uncertainties || []) {
          if (acc.hedgingPhrases.length < 3 && phrase.length > 5) {
            acc.hedgingPhrases.push(phrase.slice(0, 150));
          }
        }
      }
    }

    // By layer
    const pid = a.dataPoint.participantId;
    if (pid) {
      const layer = layerLookup.get(pid) || 'frontline';
      const layerDist = layerAccum.get(layer)!;
      layerDist[classification]++;
    }
  }

  // ── Fallback: ConversationReport data ───────────────────────
  if (analyses.length === 0) {
    return computeConfidenceFromReports(workshopId, layerLookup);
  }

  // Build domain results (sorted by uncertainty %)
  const byDomain: ConfidenceByDomain[] = [...domainAccum.entries()]
    .map(([domain, acc]) => ({
      domain,
      distribution: { certain: acc.certain, hedging: acc.hedging, uncertain: acc.uncertain },
      hedgingPhrases: acc.hedgingPhrases,
    }))
    .sort((a, b) => {
      const totalA = a.distribution.certain + a.distribution.hedging + a.distribution.uncertain || 1;
      const totalB = b.distribution.certain + b.distribution.hedging + b.distribution.uncertain || 1;
      return (b.distribution.uncertain / totalB) - (a.distribution.uncertain / totalA);
    });

  // Build layer results
  const byLayer: ConfidenceByLayer[] = (['executive', 'operational', 'frontline'] as NarrativeLayer[])
    .map((layer) => ({
      layer,
      distribution: layerAccum.get(layer)!,
    }));

  return { overall, byDomain, byLayer };
}

// ── ConversationReport fallback ──────────────────────────────

async function computeConfidenceFromReports(
  workshopId: string,
  layerLookup: Map<string, NarrativeLayer>,
): Promise<ConfidenceIndexData> {
  const reports = await prisma.conversationReport.findMany({
    where: { workshopId },
    select: { participantId: true, tone: true, phaseInsights: true },
  });

  const overall: ConfidenceDistribution = { certain: 0, hedging: 0, uncertain: 0 };
  const domainAccum = new Map<string, { certain: number; hedging: number; uncertain: number; hedgingPhrases: string[] }>();
  const layerAccum = new Map<NarrativeLayer, ConfidenceDistribution>();
  for (const l of ['executive', 'operational', 'frontline'] as NarrativeLayer[]) {
    layerAccum.set(l, { certain: 0, hedging: 0, uncertain: 0 });
  }

  for (const report of reports) {
    const classification = toneToConfidence(report.tone as string | null);
    overall[classification]++;

    // By domain (phase)
    const phaseInsights = (report.phaseInsights as Array<{ phase?: string }>) || [];
    for (const phase of phaseInsights) {
      const domain = (phase.phase || '').trim();
      if (!domain) continue;
      if (!domainAccum.has(domain)) {
        domainAccum.set(domain, { certain: 0, hedging: 0, uncertain: 0, hedgingPhrases: [] });
      }
      domainAccum.get(domain)![classification]++;
    }

    // By layer
    if (report.participantId) {
      const layer = layerLookup.get(report.participantId) || 'frontline';
      layerAccum.get(layer)![classification]++;
    }
  }

  const byDomain: ConfidenceByDomain[] = [...domainAccum.entries()]
    .map(([domain, acc]) => ({
      domain,
      distribution: { certain: acc.certain, hedging: acc.hedging, uncertain: acc.uncertain },
      hedgingPhrases: acc.hedgingPhrases,
    }))
    .sort((a, b) => {
      const totalA = a.distribution.certain + a.distribution.hedging + a.distribution.uncertain || 1;
      const totalB = b.distribution.certain + b.distribution.hedging + b.distribution.uncertain || 1;
      return (b.distribution.uncertain / totalB) - (a.distribution.uncertain / totalA);
    });

  const byLayer: ConfidenceByLayer[] = (['executive', 'operational', 'frontline'] as NarrativeLayer[])
    .map((layer) => ({ layer, distribution: layerAccum.get(layer)! }));

  return { overall, byDomain, byLayer };
}

function toneToConfidence(tone: string | null | undefined): 'certain' | 'hedging' | 'uncertain' {
  if (!tone) return 'hedging';
  const t = tone.toLowerCase();
  if (t === 'strategic' || t === 'visionary') return 'certain';
  if (t === 'critical') return 'uncertain';
  return 'hedging'; // constructive, operational, etc.
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
