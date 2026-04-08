/**
 * Cognitive State — The living understanding of a workshop session
 *
 * This is NOT a log of events. It's an evolving belief state that represents
 * what the DREAM agent currently understands about the workshop conversation.
 *
 * The cognitive state IS the output. The hemisphere visualises it.
 * The output lenses are live projections of it.
 */

// ── Domains ─────────────────────────────────────────────────
// Widened to string to support research-driven dynamic dimensions.
// Default dimensions: People, Operations, Customer, Technology, Regulation
// NOTE: These are CaptureAPI domain names used for belief classification and lens-projector grouping.
// Beliefs are stored with domain:'Operations'. Do NOT rename here — it would break live session lens
// grouping. The pipeline.ts DEFAULT_DOMAIN_TO_LENS map bridges Operations→Organisation for display.
export type Domain = string;
export const DEFAULT_DOMAINS: Domain[] = ['People', 'Operations', 'Customer', 'Technology', 'Regulation'];
/** @deprecated Use DEFAULT_DOMAINS — kept for backward compatibility */
export const ALL_DOMAINS: Domain[] = DEFAULT_DOMAINS;

// ── Belief Categories ───────────────────────────────────────
export type BeliefCategory =
  | 'aspiration'
  | 'constraint'
  | 'enabler'
  | 'opportunity'
  | 'risk'
  | 'insight'
  | 'action';

// ── Primary Classification ──────────────────────────────────
export type PrimaryType =
  | 'VISIONARY'
  | 'OPPORTUNITY'
  | 'CONSTRAINT'
  | 'RISK'
  | 'ENABLER'
  | 'ACTION'
  | 'QUESTION'
  | 'INSIGHT';

// ── Belief ──────────────────────────────────────────────────
// A first-class unit of understanding
export type Belief = {
  id: string;
  label: string;
  semanticSignature: string; // Canonical content-word key for fast matching
  category: BeliefCategory;
  primaryType: PrimaryType;

  // Domain relevance (0–1 per domain)
  domains: Array<{
    domain: Domain;
    relevance: number;
  }>;

  // Confidence dynamics
  confidence: number; // 0–1
  evidenceCount: number;
  supportingUtteranceIds: string[];

  // Stabilisation
  stabilised: boolean;
  stabilisedAtMs: number | null;

  // Relationships
  contradictedBy: string[]; // belief IDs
  elaboratedBy: string[];   // belief IDs

  // Lifecycle
  createdAtMs: number;
  lastReinforcedAtMs: number;
  needsLlmReview: boolean;
};

// ── Entity Mention ──────────────────────────────────────────
// Tracked concept with co-occurrence graph
export type EntityMention = {
  normalised: string;
  type: 'actor' | 'concept' | 'system' | 'process' | 'metric';
  mentionCount: number;
  firstSeenMs: number;
  lastSeenMs: number;
  coOccurringEntities: Map<string, number>; // entity → co-occurrence count
};

// ── Active Contradiction ────────────────────────────────────
export type ActiveContradiction = {
  id: string;
  beliefAId: string;
  beliefBId: string;
  detectedAtMs: number;
  resolvedAtMs: number | null;
  resolution: string | null; // Agent's reasoning for resolution
};

// ── Conversation Momentum ───────────────────────────────────
export type ConversationMomentum = {
  currentDomainFocus: Domain | null;
  domainDwellMs: number; // How long we've been focused on current domain
  domainFocusStartedAtMs: number | null;

  sentimentTrajectory: 'improving' | 'stable' | 'declining';
  currentSentiment: 'positive' | 'neutral' | 'concerned' | 'critical';

  speakerTurns: number;
  topicShifts: number;
  lastTopicShiftAtMs: number | null;
};

// ── Pending Meaning ─────────────────────────────────────────
// Idea still forming before the speaker finishes their thought
export type PendingMeaning = {
  speakerId: string | null;
  fragments: string[];
  contentWords: Set<string>; // For Jaccard similarity tracking
  semanticStability: number; // 0–1
  startedAtMs: number;
};

// ── Actor (from conversations) ──────────────────────────────
export type TrackedActor = {
  name: string;
  role: string;
  mentionCount: number;
  interactions: Array<{
    withActor: string;
    action: string;
    sentiment: string;
    context: string;
    utteranceId: string;
  }>;
};

// ── Reasoning Log Entry ─────────────────────────────────────
// What the agent was thinking — for the reasoning panel
export type ReasoningEntry = {
  timestampMs: number;
  level: 'fragment' | 'utterance' | 'belief' | 'contradiction' | 'stabilisation';
  icon: string; // 🔵 🟢 🟡 🔴
  summary: string;
  details?: string;
};

// ══════════════════════════════════════════════════════════════
// THE COGNITIVE STATE
// ══════════════════════════════════════════════════════════════

export type CognitiveState = {
  workshopId: string;
  workshopGoal: string;
  currentPhase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';

  // Core belief system
  beliefs: Map<string, Belief>;
  contradictions: Map<string, ActiveContradiction>;

  // Entity tracking
  entities: Map<string, EntityMention>;

  // Actor network
  actors: Map<string, TrackedActor>;

  // Conversation dynamics
  momentum: ConversationMomentum;
  pendingMeaning: PendingMeaning | null;

  // Reasoning log (for the live panel)
  reasoningLog: ReasoningEntry[];

  // Processed utterance tracking
  processedUtteranceCount: number;
  lastProcessedAtMs: number | null;

  // Recent utterance text for agent grounding
  recentUtterances: Array<{
    id: string;
    text: string;
    speaker: string | null;
    timestampMs: number;
  }>;

  // Research-driven custom dimensions (null = use defaults)
  customDimensions: import('./agents/agent-types').IndustryDimension[] | null;

  // Session lifecycle
  createdAtMs: number;
  lastActivityMs: number;
};

// ══════════════════════════════════════════════════════════════
// FACTORY
// ══════════════════════════════════════════════════════════════

export function createCognitiveState(
  workshopId: string,
  workshopGoal: string,
  currentPhase: CognitiveState['currentPhase'] = 'REIMAGINE'
): CognitiveState {
  const now = Date.now();
  return {
    workshopId,
    workshopGoal,
    currentPhase,

    beliefs: new Map(),
    contradictions: new Map(),
    entities: new Map(),
    actors: new Map(),

    momentum: {
      currentDomainFocus: null,
      domainDwellMs: 0,
      domainFocusStartedAtMs: null,
      sentimentTrajectory: 'stable',
      currentSentiment: 'neutral',
      speakerTurns: 0,
      topicShifts: 0,
      lastTopicShiftAtMs: null,
    },

    pendingMeaning: null,
    reasoningLog: [],
    processedUtteranceCount: 0,
    lastProcessedAtMs: null,
    recentUtterances: [],
    customDimensions: null,
    createdAtMs: now,
    lastActivityMs: now,
  };
}

// ══════════════════════════════════════════════════════════════
// UTTERANCE TRACKING — rolling window for agent grounding
// ══════════════════════════════════════════════════════════════

const MAX_RECENT_UTTERANCES = 30;

/**
 * Push a new utterance into the rolling window.
 * Capped at MAX_RECENT_UTTERANCES — oldest dropped first.
 */
export function pushUtterance(
  state: CognitiveState,
  utterance: { id: string; text: string; speaker: string | null; timestampMs: number },
): void {
  state.recentUtterances.push(utterance);
  if (state.recentUtterances.length > MAX_RECENT_UTTERANCES) {
    state.recentUtterances = state.recentUtterances.slice(-MAX_RECENT_UTTERANCES);
  }
}

// ══════════════════════════════════════════════════════════════
// BELIEF DYNAMICS
// ══════════════════════════════════════════════════════════════

/**
 * Generate a semantic signature from text for fast matching.
 * Extracts and sorts content words, ignoring filler/stop words.
 */
export function semanticSignature(text: string): string {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
    'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
    'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how', 'what',
    'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me',
    'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
    'it', 'its', 'they', 'them', 'their', 'about', 'up',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .sort()
    .join(' ');
}

/**
 * Jaccard similarity between two sets of content words.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── Stabilisation Thresholds ────────────────────────────────
export const STABILISATION_THRESHOLDS = {
  minConfidence: 0.6,
  minEvidence: 2,
  minAgeMs: 20_000, // 20 seconds
  // No unresolved contradictions (checked dynamically)
} as const;

/**
 * Check if a belief should be stabilised.
 */
export function shouldStabilise(belief: Belief, state: CognitiveState): boolean {
  if (belief.stabilised) return false;
  if (belief.confidence < STABILISATION_THRESHOLDS.minConfidence) return false;
  if (belief.evidenceCount < STABILISATION_THRESHOLDS.minEvidence) return false;

  const age = Date.now() - belief.createdAtMs;
  if (age < STABILISATION_THRESHOLDS.minAgeMs) return false;

  // Check no unresolved contradictions
  for (const cId of belief.contradictedBy) {
    const contradiction = state.contradictions.get(cId);
    if (contradiction && !contradiction.resolvedAtMs) return false;
  }

  return true;
}

/**
 * Generate a unique ID for a belief
 */
export function generateBeliefId(): string {
  return `belief_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique ID for a contradiction
 */
export function generateContradictionId(): string {
  return `contra_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
