/**
 * GPT-4o-mini Cognitive Reasoning Engine
 *
 * First implementation of the CognitiveReasoningEngine interface.
 * Evolves from the existing workshop-analyst-agent.ts.
 *
 * Model-swappable: replace this file with an SLM engine that
 * implements the same interface.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CognitiveState } from '../cognitive-state';
import type {
  CognitiveReasoningEngine,
  CognitiveStateUpdate,
  UtteranceInput,
  BeliefUpdate,
  ContradictionUpdate,
  EntityUpdate,
  ActorUpdate,
} from '../reasoning-engine';
import { buildSystemPrompt, buildUtterancePrompt } from '../prompt-adapters/gpt-prompts';

// ── Safe type parsers ───────────────────────────────────────

type ValidPrimaryType = CognitiveStateUpdate['primaryType'];
type ValidCategory = BeliefUpdate['category'];
type ValidDomain = 'People' | 'Operations' | 'Customer' | 'Technology' | 'Regulation';
type ValidTemporal = 'past' | 'present' | 'future' | 'timeless';
type ValidSentiment = 'positive' | 'neutral' | 'concerned' | 'critical';
type ValidTrajectory = 'improving' | 'stable' | 'declining';

const VALID_PRIMARY_TYPES = new Set(['VISIONARY', 'OPPORTUNITY', 'CONSTRAINT', 'RISK', 'ENABLER', 'ACTION', 'QUESTION', 'INSIGHT']);
const VALID_CATEGORIES = new Set(['aspiration', 'constraint', 'enabler', 'opportunity', 'risk', 'insight', 'action']);
const VALID_DOMAINS = new Set(['People', 'Operations', 'Customer', 'Technology', 'Regulation']);

function safePrimaryType(v: unknown): ValidPrimaryType {
  const s = String(v || '').toUpperCase();
  return VALID_PRIMARY_TYPES.has(s) ? s as ValidPrimaryType : 'INSIGHT';
}

function safeCategory(v: unknown): ValidCategory {
  const s = String(v || '').toLowerCase();
  return VALID_CATEGORIES.has(s) ? s as ValidCategory : 'insight';
}

function safeDomain(v: unknown): ValidDomain {
  const s = String(v || '');
  // Try exact match first
  if (VALID_DOMAINS.has(s)) return s as ValidDomain;
  // Try case-insensitive
  for (const d of VALID_DOMAINS) {
    if (d.toLowerCase() === s.toLowerCase()) return d as ValidDomain;
  }
  return 'Operations';
}

function safeTemporal(v: unknown): ValidTemporal {
  const s = String(v || '').toLowerCase();
  if (['past', 'present', 'future', 'timeless'].includes(s)) return s as ValidTemporal;
  return 'present';
}

function safeSentiment(v: unknown): ValidSentiment {
  const s = String(v || '').toLowerCase();
  if (['positive', 'neutral', 'concerned', 'critical'].includes(s)) return s as ValidSentiment;
  return 'neutral';
}

function safeTrajectory(v: unknown): ValidTrajectory {
  const s = String(v || '').toLowerCase();
  if (['improving', 'stable', 'declining'].includes(s)) return s as ValidTrajectory;
  return 'stable';
}

// ══════════════════════════════════════════════════════════════
// GPT-4o-mini Engine Implementation
// ══════════════════════════════════════════════════════════════

export class GPT4oMiniEngine implements CognitiveReasoningEngine {
  readonly engineName = 'gpt-4o-mini';
  private openai: OpenAI;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured — cannot create GPT-4o-mini engine');
    }
    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async processUtterance(
    state: CognitiveState,
    utterance: UtteranceInput,
  ): Promise<CognitiveStateUpdate> {
    const systemPrompt = buildSystemPrompt(state);
    const userPrompt = buildUtterancePrompt(state, utterance);

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices?.[0]?.message?.content || '{}';
      console.log('[GPT4oMini Engine] Response length:', raw.length);

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return this.normaliseResponse(parsed);
    } catch (error) {
      console.error('[GPT4oMini Engine] Failed:', error instanceof Error ? error.message : error);
      // Return a minimal safe update rather than crashing
      return this.fallbackUpdate(utterance);
    }
  }

  /**
   * Normalise the raw GPT response into a valid CognitiveStateUpdate.
   * Handles missing fields, wrong types, and invalid enums.
   */
  private normaliseResponse(raw: Record<string, unknown>): CognitiveStateUpdate {
    const classification = (raw.classification || {}) as Record<string, unknown>;

    return {
      primaryType: safePrimaryType(raw.primaryType),
      classification: {
        semanticMeaning: String(classification.semanticMeaning || 'Unable to interpret'),
        speakerIntent: String(classification.speakerIntent || 'Unknown'),
        temporalFocus: safeTemporal(classification.temporalFocus),
        sentimentTone: safeSentiment(classification.sentimentTone),
      },
      beliefUpdates: this.normaliseBeliefUpdates(raw.beliefUpdates),
      contradictionUpdates: this.normaliseContradictionUpdates(raw.contradictionUpdates),
      entityUpdates: this.normaliseEntityUpdates(raw.entityUpdates),
      actorUpdates: this.normaliseActorUpdates(raw.actorUpdates),
      domainShift: this.normaliseDomainShift(raw.domainShift),
      sentimentShift: this.normaliseSentimentShift(raw.sentimentShift),
      reasoning: String(raw.reasoning || 'No reasoning provided'),
      overallConfidence: typeof raw.overallConfidence === 'number'
        ? Math.max(0, Math.min(1, raw.overallConfidence))
        : 0.5,
    };
  }

  private normaliseBeliefUpdates(raw: unknown): BeliefUpdate[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((b: Record<string, unknown>) => ({
      action: (['create', 'reinforce', 'revise', 'weaken'].includes(String(b.action))
        ? String(b.action) : 'create') as BeliefUpdate['action'],
      beliefId: b.beliefId ? String(b.beliefId) : undefined,
      label: String(b.label || 'Unnamed belief'),
      category: safeCategory(b.category),
      primaryType: safePrimaryType(b.primaryType),
      domains: Array.isArray(b.domains)
        ? b.domains.map((d: Record<string, unknown>) => ({
            domain: safeDomain(d.domain),
            relevance: typeof d.relevance === 'number' ? Math.max(0, Math.min(1, d.relevance)) : 0.5,
          }))
        : [],
      confidence: typeof b.confidence === 'number' ? Math.max(0, Math.min(1, b.confidence)) : 0.3,
      reasoning: String(b.reasoning || ''),
    })).filter((b) => b.label.length > 3); // Filter out garbage
  }

  private normaliseContradictionUpdates(raw: unknown): ContradictionUpdate[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((c: Record<string, unknown>) => ({
      action: (['detect', 'resolve'].includes(String(c.action))
        ? String(c.action) : 'detect') as 'detect' | 'resolve',
      contradictionId: c.contradictionId ? String(c.contradictionId) : undefined,
      beliefAId: c.beliefAId ? String(c.beliefAId) : undefined,
      beliefBId: c.beliefBId ? String(c.beliefBId) : undefined,
      reasoning: String(c.reasoning || ''),
      resolution: c.resolution ? String(c.resolution) : undefined,
    }));
  }

  private normaliseEntityUpdates(raw: unknown): EntityUpdate[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((e: Record<string, unknown>) => ({
      normalised: String(e.normalised || e.name || '').toLowerCase(),
      type: (['actor', 'concept', 'system', 'process', 'metric'].includes(String(e.type))
        ? String(e.type) : 'concept') as EntityUpdate['type'],
      coOccurring: Array.isArray(e.coOccurring) ? e.coOccurring.map(String) : [],
    })).filter((e) => e.normalised.length > 0);
  }

  private normaliseActorUpdates(raw: unknown): ActorUpdate[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((a: Record<string, unknown>) => ({
      name: String(a.name || 'Unknown'),
      role: String(a.role || ''),
      interactions: Array.isArray(a.interactions)
        ? a.interactions.map((i: Record<string, unknown>) => ({
            withActor: String(i.withActor || ''),
            action: String(i.action || ''),
            sentiment: String(i.sentiment || 'neutral'),
            context: String(i.context || ''),
          }))
        : [],
    })).filter((a) => a.name !== 'Unknown');
  }

  private normaliseDomainShift(raw: unknown): CognitiveStateUpdate['domainShift'] {
    if (!raw || typeof raw !== 'object') return null;
    const d = raw as Record<string, unknown>;
    if (!d.newFocus) return null;
    return {
      newFocus: safeDomain(d.newFocus),
      reasoning: String(d.reasoning || ''),
    };
  }

  private normaliseSentimentShift(raw: unknown): CognitiveStateUpdate['sentimentShift'] {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as Record<string, unknown>;
    if (!s.newSentiment) return null;
    return {
      newSentiment: safeSentiment(s.newSentiment),
      trajectory: safeTrajectory(s.trajectory),
      reasoning: String(s.reasoning || ''),
    };
  }

  /**
   * Fallback update when GPT call fails — keeps the system running.
   */
  private fallbackUpdate(utterance: UtteranceInput): CognitiveStateUpdate {
    return {
      primaryType: 'INSIGHT',
      classification: {
        semanticMeaning: utterance.text,
        speakerIntent: 'Unknown — analysis failed',
        temporalFocus: 'present',
        sentimentTone: 'neutral',
      },
      beliefUpdates: [{
        action: 'create',
        label: utterance.text.length > 80 ? utterance.text.substring(0, 80) + '...' : utterance.text,
        category: 'insight',
        primaryType: 'INSIGHT',
        domains: [{ domain: 'Operations', relevance: 0.3 }],
        confidence: 0.2,
        reasoning: 'Fallback — GPT analysis failed, preserving utterance as low-confidence insight',
      }],
      contradictionUpdates: [],
      entityUpdates: [],
      actorUpdates: [],
      domainShift: null,
      sentimentShift: null,
      reasoning: 'Analysis engine encountered an error. This utterance has been preserved as a low-confidence insight.',
      overallConfidence: 0.2,
    };
  }
}

// ── Singleton factory ───────────────────────────────────────

let _instance: GPT4oMiniEngine | null = null;

export function getGPT4oMiniEngine(): GPT4oMiniEngine {
  if (!_instance) {
    _instance = new GPT4oMiniEngine();
  }
  return _instance;
}
