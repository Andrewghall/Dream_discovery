/**
 * DREAM Evidence Clustering
 *
 * Deterministic, LLM-free layer that groups raw workshop signals into
 * evidence clusters before synthesis. Computes provenance metrics that
 * allow tier-based gating downstream.
 *
 * Runs as a parallel layer — does NOT replace existing synthesis output.
 * Produces EvidenceCluster[] that can be consumed by scoring, gating,
 * and (in a later phase) the synthesis prompt.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface RawSignal {
  /** Unique id of the underlying DataPoint / ConversationInsight */
  id: string;
  rawText: string;
  /** Confirmed speaker id — null for mentions-only actors */
  speakerId: string | null;
  /** Confirmed participant role (from WorkshopParticipant) — null if not a real participant */
  participantRole: string | null;
  /** Lens / domain this node was classified under */
  lens: string | null;
  /** Session phase this node was captured in */
  phase: string | null;
  /** Node classification type e.g. INSIGHT, CONSTRAINT, VISIONARY */
  primaryType: string | null;
  /** Normalised sentiment */
  sentiment: 'positive' | 'neutral' | 'concerned' | 'critical' | null;
  /** Theme labels extracted from agenticAnalysis */
  themeLabels: string[];
  /** 0–1 confidence from agenticAnalysis */
  confidence: number | null;
  /** Whether this is a confirmed real participant (not a mentioned actor) */
  isConfirmedParticipant: boolean;
  /** Source stream: 'discovery' | 'live' | 'historical' */
  sourceStream: 'discovery' | 'live' | 'historical';
}

export interface EvidenceCluster {
  /** Canonical theme label — normalised, lowercased key */
  clusterKey: string;
  /** Display label (first seen casing) */
  displayLabel: string;
  /** ALL raw signals attributed to this cluster */
  signals: RawSignal[];
  /** Unique confirmed participant IDs (speakerId-backed, isConfirmedParticipant=true) */
  distinctParticipantIds: Set<string>;
  /** Unique participant roles (from confirmed participants only) */
  participantRoles: Set<string>;
  /** Unique lenses this cluster appears in */
  lensSpread: Set<string>;
  /** Unique phases this cluster appears in */
  phaseSpread: Set<string>;
  /** Distinct source streams */
  sourceStreams: Set<string>;
  /** Signals that directly contradict (opposite sentiment, same theme) */
  contradictingSignals: RawSignal[];
  /** Raw frequency — total mentions including multi-mention same speaker */
  rawFrequency: number;
  /** Distinct confirmed participant count */
  distinctParticipants: number;
  /** Best verbatim quotes: deduplicated, max 10, ordered by confidence desc */
  bestQuotes: Array<{ text: string; participantRole: string | null; lens: string | null }>;
}

// ── Normalisation ────────────────────────────────────────────────────────────

/** Normalise a theme label to a stable cluster key */
function normaliseKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim()
    .slice(0, 80);
}

/** Normalise phase name to canonical form */
function normalisePhase(phase: string | null): string | null {
  if (!phase) return null;
  const p = phase.toUpperCase().replace(/[^A-Z_]/g, '');
  const KNOWN = ['DISCOVERY', 'REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];
  return KNOWN.find(k => p.includes(k.replace('_', '')) || p === k) ?? phase;
}

/** True if two signals are contradicting: same theme, opposite sentiment poles */
function areContradicting(a: RawSignal, b: RawSignal): boolean {
  const POSITIVE_POLES = new Set(['positive']);
  const NEGATIVE_POLES = new Set(['concerned', 'critical']);
  const aPos = POSITIVE_POLES.has(a.sentiment ?? '');
  const aNeg = NEGATIVE_POLES.has(a.sentiment ?? '');
  const bPos = POSITIVE_POLES.has(b.sentiment ?? '');
  const bNeg = NEGATIVE_POLES.has(b.sentiment ?? '');
  return (aPos && bNeg) || (aNeg && bPos);
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Build evidence clusters from a flat array of raw signals.
 *
 * Groups signals by normalised theme label. Each cluster aggregates:
 * - All signals (not sampled — the full set)
 * - Confirmed participant provenance (speakerId-backed only)
 * - Lens, phase, and source-stream spread
 * - Contradiction detection
 * - Curated best-quote list
 *
 * Signals with no theme labels are placed in a `_unthemed` cluster for
 * gap analysis but excluded from finding tiers.
 */
export function buildEvidenceClusters(signals: RawSignal[]): EvidenceCluster[] {
  const clusterMap = new Map<string, EvidenceCluster>();

  const getOrCreate = (key: string, displayLabel: string): EvidenceCluster => {
    if (!clusterMap.has(key)) {
      clusterMap.set(key, {
        clusterKey: key,
        displayLabel,
        signals: [],
        distinctParticipantIds: new Set(),
        participantRoles: new Set(),
        lensSpread: new Set(),
        phaseSpread: new Set(),
        sourceStreams: new Set(),
        contradictingSignals: [],
        rawFrequency: 0,
        distinctParticipants: 0,
        bestQuotes: [],
      });
    }
    return clusterMap.get(key)!;
  };

  // Pass 1: assign every signal to its clusters
  for (const signal of signals) {
    const themes = signal.themeLabels.length > 0
      ? signal.themeLabels
      : ['_unthemed'];

    for (const themeLabel of themes) {
      const key = themeLabel === '_unthemed' ? '_unthemed' : normaliseKey(themeLabel);
      const cluster = getOrCreate(key, themeLabel === '_unthemed' ? '_unthemed' : themeLabel);

      cluster.signals.push(signal);
      cluster.rawFrequency++;

      if (signal.isConfirmedParticipant && signal.speakerId) {
        cluster.distinctParticipantIds.add(signal.speakerId);
        if (signal.participantRole) cluster.participantRoles.add(signal.participantRole);
      }

      if (signal.lens) cluster.lensSpread.add(signal.lens);
      const normPhase = normalisePhase(signal.phase);
      if (normPhase) cluster.phaseSpread.add(normPhase);
      if (signal.sourceStream) cluster.sourceStreams.add(signal.sourceStream);
    }
  }

  // Pass 2: finalise derived metrics on each cluster
  for (const cluster of clusterMap.values()) {
    cluster.distinctParticipants = cluster.distinctParticipantIds.size;

    // Contradiction detection: find signal pairs with opposing sentiment
    const confirmedSignals = cluster.signals.filter(s => s.isConfirmedParticipant);
    const contradictions = new Set<string>();
    for (let i = 0; i < confirmedSignals.length; i++) {
      for (let j = i + 1; j < confirmedSignals.length; j++) {
        if (areContradicting(confirmedSignals[i], confirmedSignals[j])) {
          contradictions.add(confirmedSignals[j].id);
        }
      }
    }
    cluster.contradictingSignals = confirmedSignals.filter(s => contradictions.has(s.id));

    // Best quotes: confirmed participants first, deduplicated, sorted by confidence
    const seen = new Set<string>();
    const candidates = [...cluster.signals]
      .filter(s => s.rawText.trim().length > 10)
      .sort((a, b) => {
        const aConf = a.confidence ?? 0;
        const bConf = b.confidence ?? 0;
        if (a.isConfirmedParticipant !== b.isConfirmedParticipant) {
          return a.isConfirmedParticipant ? -1 : 1;
        }
        return bConf - aConf;
      });

    for (const s of candidates) {
      const normalised = s.rawText.trim().toLowerCase();
      if (!seen.has(normalised)) {
        seen.add(normalised);
        cluster.bestQuotes.push({
          text: s.rawText.trim(),
          participantRole: s.participantRole,
          lens: s.lens,
        });
        if (cluster.bestQuotes.length >= 10) break;
      }
    }
  }

  // Return sorted by rawFrequency desc; _unthemed always last
  return [...clusterMap.values()].sort((a, b) => {
    if (a.clusterKey === '_unthemed') return 1;
    if (b.clusterKey === '_unthemed') return -1;
    return b.rawFrequency - a.rawFrequency;
  });
}

// ── Snapshot node adapter ────────────────────────────────────────────────────

/** Shape of a node as stored in LiveWorkshopSnapshot.payload.nodesById */
export interface SnapshotNodeRaw {
  id?: string;
  rawText?: string;
  dialoguePhase?: string;
  lens?: string;
  classification?: {
    primaryType?: string;
    confidence?: number;
  };
  agenticAnalysis?: {
    sentimentTone?: string;
    themes?: Array<{ label?: string; confidence?: number }>;
    overallConfidence?: number;
    actors?: Array<{ name?: string; role?: string }>;
  };
  speakerId?: string;
}

/**
 * Convert snapshot nodes (hemisphere nodes) into RawSignal[].
 *
 * Hemisphere nodes do NOT have a confirmed speakerId in the usual sense —
 * they come from the live session capture, not discovery responses.
 * We treat them as `sourceStream: 'live'` and mark isConfirmedParticipant
 * based on whether speakerId is present AND is in the confirmedParticipantIds set.
 */
export function snapshotNodesToSignals(
  nodes: SnapshotNodeRaw[],
  confirmedParticipantIds: Set<string>,
  participantRoleMap: Map<string, string>, // speakerId → role
): RawSignal[] {
  return nodes
    .filter(n => n.rawText && n.rawText.trim().length > 3)
    .map(n => {
      const id = n.id ?? `node_${Math.random().toString(36).slice(2)}`;
      const speakerId = n.speakerId ?? null;
      const isConfirmed = speakerId !== null && confirmedParticipantIds.has(speakerId);
      const themeLabels = (n.agenticAnalysis?.themes ?? [])
        .map(t => t.label ?? '')
        .filter(Boolean);

      const rawSentiment = n.agenticAnalysis?.sentimentTone?.toLowerCase() ?? 'neutral';
      const sentiment = (['positive', 'neutral', 'concerned', 'critical'] as const)
        .find(s => rawSentiment.includes(s)) ?? 'neutral';

      return {
        id,
        rawText: n.rawText!.trim(),
        speakerId,
        participantRole: speakerId ? (participantRoleMap.get(speakerId) ?? null) : null,
        lens: n.lens ?? null,
        phase: n.dialoguePhase ?? null,
        primaryType: n.classification?.primaryType ?? null,
        sentiment,
        themeLabels,
        confidence: n.agenticAnalysis?.overallConfidence ?? n.classification?.confidence ?? null,
        isConfirmedParticipant: isConfirmed,
        sourceStream: 'live',
      };
    });
}

/**
 * Convert ConversationInsight records into RawSignal[].
 * Discovery insights always have a real participantId → isConfirmedParticipant = true.
 */
export function insightsToSignals(
  insights: Array<{
    id: string;
    text: string;
    insightType: string;
    category?: string | null;
    participantId?: string | null;
  }>,
  participantRoleMap: Map<string, string>, // participantId → role
): RawSignal[] {
  return insights
    .filter(i => i.text && i.text.trim().length > 3)
    .map(i => {
      const speakerId = i.participantId ?? null;
      return {
        id: i.id,
        rawText: i.text.trim(),
        speakerId,
        participantRole: speakerId ? (participantRoleMap.get(speakerId) ?? null) : null,
        lens: i.category ?? null,
        phase: 'DISCOVERY',
        primaryType: i.insightType,
        sentiment: (['CONSTRAINT', 'RISK', 'CHALLENGE', 'FRICTION'].includes(i.insightType.toUpperCase())
          ? 'concerned'
          : ['VISION', 'OPPORTUNITY', 'ENABLER'].includes(i.insightType.toUpperCase())
          ? 'positive'
          : 'neutral'),
        themeLabels: [],  // insights don't carry theme labels; clustered by type/category
        confidence: null,
        isConfirmedParticipant: speakerId !== null,
        sourceStream: 'discovery',
      };
    });
}
