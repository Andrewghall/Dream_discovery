/**
 * GPT-4o-mini Agentic Cognitive Reasoning Engine
 *
 * Genuine agentic loop: the model receives an utterance, then DECIDES
 * which tools to call (query_beliefs, check_contradiction, etc.),
 * observes results, and continues reasoning until it calls commit_analysis.
 *
 * This is NOT a single-call structured extraction. The model drives
 * the reasoning process through self-directed tool use.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CognitiveState, ReasoningEntry } from '../cognitive-state';
import type {
  CognitiveReasoningEngine,
  CognitiveStateUpdate,
  UtteranceInput,
  BeliefUpdate,
  ContradictionUpdate,
  EntityUpdate,
  ActorUpdate,
} from '../reasoning-engine';
import { buildAgenticSystemPrompt, buildAgenticUserMessage } from '../prompt-adapters/gpt-prompts';
import { COGNITIVE_TOOLS, executeTool } from './tools';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 4;       // Max tool-calling rounds
const LOOP_TIMEOUT_MS = 5_000;  // Hard timeout for entire loop
const MODEL = 'gpt-4o-mini';

// ── Safe type parsers (reused from original) ────────────────

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
  if (VALID_DOMAINS.has(s)) return s as ValidDomain;
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
// AGENTIC ENGINE
// ══════════════════════════════════════════════════════════════

export class GPT4oMiniEngine implements CognitiveReasoningEngine {
  readonly engineName = 'gpt-4o-mini-agentic';
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
    onReasoningStep?: (entry: ReasoningEntry) => void,
  ): Promise<CognitiveStateUpdate> {
    const systemPrompt = buildAgenticSystemPrompt(state);
    const userMessage = buildAgenticUserMessage(state, utterance);
    const deliberation: string[] = [];
    const startMs = Date.now();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    try {
      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        // Check timeout
        if (Date.now() - startMs > LOOP_TIMEOUT_MS) {
          deliberation.push('Reached time limit — committing current understanding.');
          console.log(`[Agentic Engine] Timeout after ${iteration} iterations`);
          break;
        }

        // On the final iteration, force commit_analysis
        const isLastIteration = iteration === MAX_ITERATIONS - 1;
        const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
          ? { type: 'function', function: { name: 'commit_analysis' } }
          : 'auto';

        console.log(`[Agentic Engine] Iteration ${iteration}${isLastIteration ? ' (forced commit)' : ''}`);

        const completion = await this.openai.chat.completions.create({
          model: MODEL,
          temperature: 0.3,
          messages,
          tools: COGNITIVE_TOOLS,
          tool_choice: toolChoice,
          parallel_tool_calls: true,
        });

        const choice = completion.choices[0];
        const assistantMessage = choice.message;

        // Append assistant message to conversation
        messages.push(assistantMessage);

        // Capture text content (model thinking between tool calls)
        if (assistantMessage.content) {
          deliberation.push(assistantMessage.content);
          onReasoningStep?.({
            timestampMs: Date.now(),
            level: 'utterance',
            icon: '💭',
            summary: assistantMessage.content,
          });
        }

        // No tool calls — model is done
        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
          console.log(`[Agentic Engine] No tool calls on iteration ${iteration} — model finished`);
          break;
        }

        // Process each tool call
        let commitArgs: Record<string, unknown> | null = null;

        for (const toolCall of assistantMessage.tool_calls) {
          // Only handle function tool calls (skip custom tool calls)
          if (toolCall.type !== 'function') continue;

          const fnName = toolCall.function.name;
          let fnArgs: Record<string, unknown>;

          try {
            fnArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            fnArgs = {};
          }

          if (fnName === 'commit_analysis') {
            // Terminal tool — extract the final analysis
            commitArgs = fnArgs;

            const meaning = String(fnArgs.semanticMeaning || '').substring(0, 80);
            deliberation.push(`Committing: ${fnArgs.primaryType} — ${meaning}`);
            onReasoningStep?.({
              timestampMs: Date.now(),
              level: 'utterance',
              icon: '🎯',
              summary: `Committing: ${fnArgs.primaryType} — ${meaning}`,
            });

            // Respond to the tool call (required by API)
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ status: 'committed' }),
            });
          } else {
            // Execute query tool against cognitive state
            const toolResult = executeTool(fnName, fnArgs, state);

            deliberation.push(toolResult.reasoningSummary);
            onReasoningStep?.({
              timestampMs: Date.now(),
              level: 'utterance',
              icon: '🔍',
              summary: toolResult.reasoningSummary,
            });

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult.result,
            });

            console.log(`[Agentic Engine] Tool ${fnName}: ${toolResult.reasoningSummary.substring(0, 100)}`);
          }
        }

        // If commit_analysis was called, we're done
        if (commitArgs) {
          const elapsed = Date.now() - startMs;
          console.log(`[Agentic Engine] Committed after ${iteration + 1} iterations, ${elapsed}ms`);
          return this.normaliseCommitArgs(commitArgs, deliberation);
        }
      }

      // If we exited the loop without committing (timeout or model stopped),
      // force one final commit call
      console.log('[Agentic Engine] Loop ended without commit — forcing final commit');
      return await this.forceCommit(messages, deliberation);

    } catch (error) {
      console.error('[Agentic Engine] Failed:', error instanceof Error ? error.message : error);
      return this.fallbackUpdate(utterance, deliberation);
    }
  }

  // ── Force a final commit when the loop exits without one ────

  private async forceCommit(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    deliberation: string[],
  ): Promise<CognitiveStateUpdate> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages,
        tools: COGNITIVE_TOOLS,
        tool_choice: { type: 'function', function: { name: 'commit_analysis' } },
      });

      const toolCalls = completion.choices[0]?.message?.tool_calls;
      const firstFnCall = toolCalls?.find(tc => tc.type === 'function');
      if (firstFnCall && firstFnCall.type === 'function') {
        const args = JSON.parse(firstFnCall.function.arguments);
        deliberation.push('Forced commit after loop exhaustion');
        return this.normaliseCommitArgs(args, deliberation);
      }
    } catch (error) {
      console.error('[Agentic Engine] Force commit failed:', error instanceof Error ? error.message : error);
    }

    deliberation.push('Force commit failed — returning fallback');
    return this.fallbackUpdate({ text: '', speaker: null, utteranceId: '', startTimeMs: 0, endTimeMs: 0 }, deliberation);
  }

  // ── Normalise commit_analysis arguments into CognitiveStateUpdate ──

  private normaliseCommitArgs(
    args: Record<string, unknown>,
    deliberation: string[],
  ): CognitiveStateUpdate {
    return {
      primaryType: safePrimaryType(args.primaryType),
      classification: {
        semanticMeaning: String(args.semanticMeaning || 'Unable to interpret'),
        speakerIntent: String(args.speakerIntent || 'Unknown'),
        temporalFocus: safeTemporal(args.temporalFocus),
        sentimentTone: safeSentiment(args.sentimentTone),
      },
      beliefUpdates: this.normaliseBeliefUpdates(args.beliefUpdates),
      contradictionUpdates: this.normaliseContradictionUpdates(args.contradictionUpdates),
      entityUpdates: this.normaliseEntityUpdates(args.entityUpdates),
      actorUpdates: this.normaliseActorUpdates(args.actorUpdates),
      domainShift: this.normaliseDomainShift(args.domainShift),
      sentimentShift: this.normaliseSentimentShift(args.sentimentShift),
      deliberation,
      overallConfidence: typeof args.overallConfidence === 'number'
        ? Math.max(0, Math.min(1, args.overallConfidence))
        : 0.5,
    };
  }

  // ── Normalisation helpers (reused from original) ──────────

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
    })).filter((b) => b.label.length > 3);
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

  // ── Fallback when the entire agentic loop fails ───────────

  private fallbackUpdate(utterance: UtteranceInput, deliberation: string[]): CognitiveStateUpdate {
    return {
      primaryType: 'INSIGHT',
      classification: {
        semanticMeaning: utterance.text,
        speakerIntent: 'Unknown — analysis failed',
        temporalFocus: 'present',
        sentimentTone: 'neutral',
      },
      beliefUpdates: utterance.text.length > 0 ? [{
        action: 'create',
        label: utterance.text.length > 80 ? utterance.text.substring(0, 80) + '...' : utterance.text,
        category: 'insight',
        primaryType: 'INSIGHT',
        domains: [{ domain: 'Operations', relevance: 0.3 }],
        confidence: 0.2,
        reasoning: 'Fallback — agentic analysis failed, preserving utterance as low-confidence insight',
      }] : [],
      contradictionUpdates: [],
      entityUpdates: [],
      actorUpdates: [],
      domainShift: null,
      sentimentShift: null,
      deliberation: [...deliberation, 'Agentic engine encountered an error. Preserving utterance as low-confidence insight.'],
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
