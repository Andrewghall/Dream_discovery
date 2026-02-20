/**
 * Cognitive Reasoning Engine — Model-Agnostic Interface
 *
 * This is the clean abstraction that any model (GPT-4o-mini today,
 * SLM tomorrow) can implement. The cognitive state engine calls this
 * interface — it doesn't know or care what model is behind it.
 *
 * The model is a replaceable reasoning module.
 * The cognitive state IS the intelligence, the model is just how it thinks.
 */

import type { CognitiveState, Belief, ActiveContradiction, TrackedActor, ReasoningEntry, Domain, BeliefCategory, PrimaryType } from './cognitive-state';

// ══════════════════════════════════════════════════════════════
// STATE UPDATE — What the engine returns after processing
// ══════════════════════════════════════════════════════════════

export type BeliefUpdate = {
  action: 'create' | 'reinforce' | 'revise' | 'weaken';
  beliefId?: string; // For reinforce/revise/weaken — existing belief ID
  label: string;
  category: BeliefCategory;
  primaryType: PrimaryType;
  domains: Array<{ domain: Domain; relevance: number }>;
  confidence: number; // Agent's suggested confidence (state engine may adjust)
  reasoning: string;
};

export type ContradictionUpdate = {
  action: 'detect' | 'resolve';
  contradictionId?: string; // For resolve
  beliefAId?: string; // For detect
  beliefBId?: string; // For detect
  reasoning: string;
  resolution?: string;
};

export type ActorUpdate = {
  name: string;
  role: string;
  interactions: Array<{
    withActor: string;
    action: string;
    sentiment: string;
    context: string;
  }>;
};

export type EntityUpdate = {
  normalised: string;
  type: 'actor' | 'concept' | 'system' | 'process' | 'metric';
  coOccurring: string[];
};

export type DomainShift = {
  newFocus: Domain;
  reasoning: string;
};

export type SentimentShift = {
  newSentiment: 'positive' | 'neutral' | 'concerned' | 'critical';
  trajectory: 'improving' | 'stable' | 'declining';
  reasoning: string;
};

/**
 * The complete state update returned by the reasoning engine.
 */
export type CognitiveStateUpdate = {
  // Classification of the utterance
  primaryType: PrimaryType;
  classification: {
    semanticMeaning: string;
    speakerIntent: string;
    temporalFocus: 'past' | 'present' | 'future' | 'timeless';
    sentimentTone: 'positive' | 'neutral' | 'concerned' | 'critical';
  };

  // Belief system updates
  beliefUpdates: BeliefUpdate[];
  contradictionUpdates: ContradictionUpdate[];

  // Entity & actor tracking
  entityUpdates: EntityUpdate[];
  actorUpdates: ActorUpdate[];

  // Conversation dynamics
  domainShift: DomainShift | null;
  sentimentShift: SentimentShift | null;

  // Agent's reasoning (for the live panel)
  reasoning: string;

  // Overall confidence in this analysis
  overallConfidence: number;
};

// ══════════════════════════════════════════════════════════════
// THE ENGINE INTERFACE — Model-agnostic
// ══════════════════════════════════════════════════════════════

/**
 * Input for processing a complete utterance.
 */
export type UtteranceInput = {
  text: string;
  speaker: string | null;
  utteranceId: string;
  startTimeMs: number;
  endTimeMs: number;
};

/**
 * The CognitiveReasoningEngine interface.
 *
 * Any model that can process structured input and return JSON
 * can implement this. GPT-4o-mini today, SLM tomorrow.
 */
export interface CognitiveReasoningEngine {
  /**
   * Process a complete utterance in context of the full cognitive state.
   *
   * The engine receives:
   * - The utterance text and metadata
   * - The FULL cognitive state (beliefs, contradictions, entities, momentum)
   *
   * The engine returns:
   * - State updates to apply (new beliefs, reinforcements, contradictions, etc.)
   * - Classification of the utterance
   * - Reasoning explanation (for the live panel)
   */
  processUtterance(
    state: CognitiveState,
    utterance: UtteranceInput,
  ): Promise<CognitiveStateUpdate>;

  /** Human-readable name of the engine (for logging/UI) */
  readonly engineName: string;
}

// ══════════════════════════════════════════════════════════════
// STATE ENGINE — Applies updates to CognitiveState
// ══════════════════════════════════════════════════════════════

import {
  generateBeliefId,
  generateContradictionId,
  semanticSignature,
  shouldStabilise,
  jaccardSimilarity,
} from './cognitive-state';

/**
 * Apply a CognitiveStateUpdate to the CognitiveState.
 *
 * This is the state engine — it owns the dynamics (confidence growth,
 * decay, stabilisation). The reasoning engine suggests, the state
 * engine decides.
 *
 * Returns arrays of events for SSE emission.
 */
export function applyCognitiveUpdate(
  state: CognitiveState,
  update: CognitiveStateUpdate,
  utteranceId: string,
): {
  newBeliefs: Belief[];
  reinforcedBeliefs: Belief[];
  stabilisedBeliefs: Belief[];
  newContradictions: ActiveContradiction[];
  resolvedContradictions: ActiveContradiction[];
  reasoningEntries: ReasoningEntry[];
} {
  const now = Date.now();
  const newBeliefs: Belief[] = [];
  const reinforcedBeliefs: Belief[] = [];
  const stabilisedBeliefs: Belief[] = [];
  const newContradictions: ActiveContradiction[] = [];
  const resolvedContradictions: ActiveContradiction[] = [];
  const reasoningEntries: ReasoningEntry[] = [];

  state.lastActivityMs = now;
  state.processedUtteranceCount++;
  state.lastProcessedAtMs = now;

  // ── Process belief updates ──────────────────────────────────
  for (const bu of update.beliefUpdates) {
    if (bu.action === 'create') {
      // Check for existing belief with similar semantic signature
      const sig = semanticSignature(bu.label);
      let matched = false;

      for (const [, existing] of state.beliefs) {
        const existingSig = existing.semanticSignature;
        const existingWords = new Set(existingSig.split(' '));
        const newWords = new Set(sig.split(' '));
        const similarity = jaccardSimilarity(existingWords, newWords);

        if (similarity > 0.5) {
          // Reinforce existing belief instead of creating duplicate
          existing.evidenceCount++;
          existing.supportingUtteranceIds.push(utteranceId);
          existing.lastReinforcedAtMs = now;
          // Logarithmic confidence growth
          existing.confidence = Math.min(1, existing.confidence + (1 - existing.confidence) * 0.15);
          reinforcedBeliefs.push(existing);
          matched = true;

          reasoningEntries.push({
            timestampMs: now,
            level: 'belief',
            icon: '🟢',
            summary: bu.reasoning || `Reinforcing: "${existing.label}"`,
            details: `"${existing.label}" — confidence: ${(existing.confidence * 100).toFixed(0)}%, evidence: ${existing.evidenceCount}`,
          });
          break;
        }
      }

      if (!matched) {
        const belief: Belief = {
          id: generateBeliefId(),
          label: bu.label,
          semanticSignature: sig,
          category: bu.category,
          primaryType: bu.primaryType,
          domains: bu.domains,
          confidence: Math.max(0.2, Math.min(0.5, bu.confidence)), // New beliefs start modest
          evidenceCount: 1,
          supportingUtteranceIds: [utteranceId],
          stabilised: false,
          stabilisedAtMs: null,
          contradictedBy: [],
          elaboratedBy: [],
          createdAtMs: now,
          lastReinforcedAtMs: now,
          needsLlmReview: false,
        };
        state.beliefs.set(belief.id, belief);
        newBeliefs.push(belief);

        reasoningEntries.push({
          timestampMs: now,
          level: 'belief',
          icon: '🔵',
          summary: bu.reasoning || `New belief: "${belief.label}"`,
          details: `${belief.category} — ${belief.domains.map(d => d.domain).join(', ')} — confidence: ${(belief.confidence * 100).toFixed(0)}%`,
        });
      }
    } else if (bu.action === 'reinforce' && bu.beliefId) {
      const existing = state.beliefs.get(bu.beliefId);
      if (existing) {
        existing.evidenceCount++;
        existing.supportingUtteranceIds.push(utteranceId);
        existing.lastReinforcedAtMs = now;
        existing.confidence = Math.min(1, existing.confidence + (1 - existing.confidence) * 0.15);
        reinforcedBeliefs.push(existing);

        reasoningEntries.push({
          timestampMs: now,
          level: 'belief',
          icon: '🟢',
          summary: bu.reasoning || `Reinforced: "${existing.label}"`,
          details: `"${existing.label}" — confidence: ${(existing.confidence * 100).toFixed(0)}%, evidence: ${existing.evidenceCount}`,
        });
      }
    } else if (bu.action === 'weaken' && bu.beliefId) {
      const existing = state.beliefs.get(bu.beliefId);
      if (existing) {
        existing.confidence = Math.max(0.05, existing.confidence * 0.7);
        reasoningEntries.push({
          timestampMs: now,
          level: 'belief',
          icon: '🟡',
          summary: bu.reasoning || `Weakened: "${existing.label}"`,
          details: `"${existing.label}" — confidence dropped to ${(existing.confidence * 100).toFixed(0)}%`,
        });
      }
    }
  }

  // ── Process contradiction updates ───────────────────────────
  for (const cu of update.contradictionUpdates) {
    if (cu.action === 'detect' && cu.beliefAId && cu.beliefBId) {
      const beliefA = state.beliefs.get(cu.beliefAId);
      const beliefB = state.beliefs.get(cu.beliefBId);
      if (beliefA && beliefB) {
        const contradiction: ActiveContradiction = {
          id: generateContradictionId(),
          beliefAId: cu.beliefAId,
          beliefBId: cu.beliefBId,
          detectedAtMs: now,
          resolvedAtMs: null,
          resolution: null,
        };
        state.contradictions.set(contradiction.id, contradiction);
        beliefA.contradictedBy.push(contradiction.id);
        beliefB.contradictedBy.push(contradiction.id);
        // Reduce confidence on both
        beliefA.confidence = Math.max(0.1, beliefA.confidence * 0.8);
        beliefB.confidence = Math.max(0.1, beliefB.confidence * 0.8);
        newContradictions.push(contradiction);

        reasoningEntries.push({
          timestampMs: now,
          level: 'contradiction',
          icon: '🟡',
          summary: cu.reasoning || `Contradiction detected between two beliefs`,
          details: `"${beliefA.label}" vs "${beliefB.label}"`,
        });
      }
    } else if (cu.action === 'resolve' && cu.contradictionId) {
      const contradiction = state.contradictions.get(cu.contradictionId);
      if (contradiction && !contradiction.resolvedAtMs) {
        contradiction.resolvedAtMs = now;
        contradiction.resolution = cu.resolution || cu.reasoning;
        resolvedContradictions.push(contradiction);

        reasoningEntries.push({
          timestampMs: now,
          level: 'contradiction',
          icon: '🟢',
          summary: cu.reasoning || `Contradiction resolved`,
          details: cu.resolution || undefined,
        });
      }
    }
  }

  // ── Process entity updates ──────────────────────────────────
  for (const eu of update.entityUpdates) {
    const existing = state.entities.get(eu.normalised);
    if (existing) {
      existing.mentionCount++;
      existing.lastSeenMs = now;
      for (const co of eu.coOccurring) {
        existing.coOccurringEntities.set(
          co,
          (existing.coOccurringEntities.get(co) || 0) + 1
        );
      }
    } else {
      const coMap = new Map<string, number>();
      for (const co of eu.coOccurring) {
        coMap.set(co, 1);
      }
      state.entities.set(eu.normalised, {
        normalised: eu.normalised,
        type: eu.type,
        mentionCount: 1,
        firstSeenMs: now,
        lastSeenMs: now,
        coOccurringEntities: coMap,
      });
    }
  }

  // ── Process actor updates ───────────────────────────────────
  for (const au of update.actorUpdates) {
    const existing = state.actors.get(au.name);
    if (existing) {
      existing.mentionCount++;
      existing.role = au.role || existing.role;
      for (const interaction of au.interactions) {
        existing.interactions.push({
          ...interaction,
          utteranceId,
        });
      }
    } else {
      state.actors.set(au.name, {
        name: au.name,
        role: au.role,
        mentionCount: 1,
        interactions: au.interactions.map((i) => ({
          ...i,
          utteranceId,
        })),
      });
    }
  }

  // ── Process domain/sentiment shifts ─────────────────────────
  if (update.domainShift) {
    if (state.momentum.currentDomainFocus !== update.domainShift.newFocus) {
      state.momentum.topicShifts++;
      state.momentum.lastTopicShiftAtMs = now;
      state.momentum.domainDwellMs = 0;
      state.momentum.domainFocusStartedAtMs = now;
    }
    state.momentum.currentDomainFocus = update.domainShift.newFocus;
  }

  if (update.sentimentShift) {
    state.momentum.currentSentiment = update.sentimentShift.newSentiment;
    state.momentum.sentimentTrajectory = update.sentimentShift.trajectory;
  }

  state.momentum.speakerTurns++;

  // ── Check for stabilisation ─────────────────────────────────
  for (const [, belief] of state.beliefs) {
    if (!belief.stabilised && shouldStabilise(belief, state)) {
      belief.stabilised = true;
      belief.stabilisedAtMs = now;
      stabilisedBeliefs.push(belief);

      reasoningEntries.push({
        timestampMs: now,
        level: 'stabilisation',
        icon: '🔴',
        summary: `Stabilised: "${belief.label}" — committed to output`,
        details: `Evidence: ${belief.evidenceCount} utterances, confidence: ${(belief.confidence * 100).toFixed(0)}%`,
      });
    }
  }

  // ── Add reasoning entries to state ──────────────────────────
  // Add the agent's overall reasoning as first entry
  if (update.reasoning) {
    reasoningEntries.unshift({
      timestampMs: now,
      level: 'utterance',
      icon: '🟢',
      summary: update.reasoning,
    });
  }

  // Keep reasoning log bounded (last 200 entries)
  state.reasoningLog.push(...reasoningEntries);
  if (state.reasoningLog.length > 200) {
    state.reasoningLog = state.reasoningLog.slice(-200);
  }

  return {
    newBeliefs,
    reinforcedBeliefs,
    stabilisedBeliefs,
    newContradictions,
    resolvedContradictions,
    reasoningEntries,
  };
}
