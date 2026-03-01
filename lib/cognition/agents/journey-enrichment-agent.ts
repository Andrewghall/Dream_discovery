/**
 * DREAM Journey Enrichment Agent
 *
 * A GPT-4o-mini tool-calling agent that enriches customer journey
 * interactions with:
 *   - AI agency levels (human / assisted / autonomous) for now and future
 *   - Business and customer intensity scores (0-1)
 *   - Risk exposure flags from constraint/belief data
 *   - Automation confidence scores
 *   - Escalation triggers (AI→human handoff conditions)
 *   - Governance overlays (regulatory constraints per interaction)
 *
 * Called by the Facilitation Orchestrator AFTER the journey completion
 * agent, when enough data exists (≥3 interactions AND ≥5 beliefs).
 *
 * Runs in real-time during live sessions. MAX_ITERATIONS=3, TIMEOUT=8s.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { GuidanceState } from '../guidance-state';
import type { AgentConversationCallback } from './agent-types';
import type { LiveJourneyData, LiveJourneyInteraction } from '@/lib/cognitive-guidance/pipeline';
import type { CognitiveState } from '../cognitive-state';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 3;
const LOOP_TIMEOUT_MS = 8_000;
const MODEL = 'gpt-4o-mini';

// ── Types ───────────────────────────────────────────────────

export interface JourneyEnrichment {
  /** Enrichments keyed by interaction ID */
  enrichments: InteractionEnrichment[];
  /** Overall automation readiness score (0-1) */
  overallAutomationReadiness: number;
  /** Summary of enrichment decisions */
  summary: string;
}

export interface InteractionEnrichment {
  /** Interaction ID to match against */
  interactionId: string;
  /** AI agency level currently (based on today's technology landscape) */
  aiAgencyNow: 'human' | 'assisted' | 'autonomous';
  /** AI agency level in the future (based on vision/enabler beliefs) */
  aiAgencyFuture: 'human' | 'assisted' | 'autonomous';
  /** Business effort/resource intensity (0-1) */
  businessIntensity: number;
  /** Customer friction/delight intensity (0-1) */
  customerIntensity: number;
  /** How confident the model is in the AI classification (0-1) */
  automationConfidence: number;
  /** Conditions that would trigger AI→human handoff */
  escalationTriggers: string[];
  /** Regulatory/governance constraints mapped to this stage */
  governanceOverlays: string[];
  /** Risk exposure based on constraint cross-references */
  riskExposure: 'low' | 'medium' | 'high';
}

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const ENRICHMENT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_journey_state',
      description: 'Get the current journey interactions, stages, and actors.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_relevant_beliefs',
      description: 'Get accumulated beliefs from the session that relate to technology, automation, constraints, and actors.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enrich_interactions',
      description: 'Commit enrichment data for journey interactions. This is your final output tool.',
      parameters: {
        type: 'object',
        properties: {
          enrichments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                interactionId: { type: 'string', description: 'The interaction ID to enrich.' },
                aiAgencyNow: {
                  type: 'string',
                  enum: ['human', 'assisted', 'autonomous'],
                  description: 'Current AI agency level based on today\'s technology.',
                },
                aiAgencyFuture: {
                  type: 'string',
                  enum: ['human', 'assisted', 'autonomous'],
                  description: 'Future AI agency level based on the organisation\'s vision.',
                },
                businessIntensity: {
                  type: 'number',
                  description: 'Business effort/resource intensity (0-1). 1 = maximum effort required.',
                },
                customerIntensity: {
                  type: 'number',
                  description: 'Customer friction/delight intensity (0-1). 1 = high emotion or friction.',
                },
                automationConfidence: {
                  type: 'number',
                  description: 'How confident you are in the AI agency classification (0-1).',
                },
                escalationTriggers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Conditions that would trigger AI→human handoff (e.g., "complaint escalation", "high-value transaction").',
                },
                governanceOverlays: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Regulatory or governance constraints relevant to this interaction (e.g., "GDPR consent required", "FCA suitability check").',
                },
                riskExposure: {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                  description: 'Risk level from cross-referencing constraint beliefs.',
                },
              },
              required: ['interactionId', 'aiAgencyNow', 'aiAgencyFuture', 'businessIntensity', 'customerIntensity', 'automationConfidence', 'riskExposure'],
            },
          },
          overallAutomationReadiness: {
            type: 'number',
            description: 'Overall organisation automation readiness (0-1). Consider constraints, enablers, and vision.',
          },
          summary: {
            type: 'string',
            description: 'One sentence summarising the key enrichment patterns observed.',
          },
        },
        required: ['enrichments', 'overallAutomationReadiness', 'summary'],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

function executeEnrichmentTool(
  toolName: string,
  _args: Record<string, unknown>,
  liveJourney: LiveJourneyData,
  cogState: CognitiveState,
): { result: string; summary: string } {
  switch (toolName) {
    case 'get_journey_state': {
      const interactions = liveJourney.interactions.map((ix) => ({
        id: ix.id,
        actor: ix.actor,
        stage: ix.stage,
        action: ix.action,
        context: ix.context,
        sentiment: ix.sentiment,
        currentAiAgencyNow: ix.aiAgencyNow,
        currentAiAgencyFuture: ix.aiAgencyFuture,
        currentBusinessIntensity: ix.businessIntensity,
        currentCustomerIntensity: ix.customerIntensity,
        isPainPoint: ix.isPainPoint,
        isMomentOfTruth: ix.isMomentOfTruth,
      }));

      return {
        result: JSON.stringify({
          stages: liveJourney.stages,
          actors: liveJourney.actors.map((a) => ({ name: a.name, role: a.role })),
          interactions,
        }),
        summary: `Journey: ${liveJourney.interactions.length} interactions across ${liveJourney.stages.length} stages`,
      };
    }

    case 'get_relevant_beliefs': {
      // Extract beliefs relevant to technology, automation, constraints
      const relevantBeliefs: Array<{
        category: string;
        statement: string;
        sentiment: string;
        domains: string[];
      }> = [];

      const relevantCategories = new Set([
        'CONSTRAINT', 'ENABLER', 'VISION', 'RISK', 'TECHNOLOGY',
        'FRICTION', 'CHALLENGE', 'OPPORTUNITY',
      ]);

      for (const belief of cogState.beliefs.values()) {
        const cat = belief.category.toUpperCase();
        if (relevantCategories.has(cat) || belief.domains.some((d) =>
          d.domain.toLowerCase().includes('tech') ||
          d.domain.toLowerCase().includes('regulat') ||
          d.domain.toLowerCase().includes('automat') ||
          d.domain.toLowerCase().includes('ai') ||
          d.domain.toLowerCase().includes('digital')
        )) {
          relevantBeliefs.push({
            category: belief.category,
            statement: belief.label,
            sentiment: belief.primaryType || 'neutral',
            domains: belief.domains.map((d) => d.domain),
          });
        }
      }

      // Also extract actor mentions for enrichment context
      const actorMentions: Array<{ actor: string; interactionCount: number }> = [];
      for (const actor of cogState.actors.values()) {
        actorMentions.push({
          actor: actor.name,
          interactionCount: actor.interactions.length,
        });
      }

      return {
        result: JSON.stringify({
          relevantBeliefCount: relevantBeliefs.length,
          beliefs: relevantBeliefs.slice(0, 30), // Cap at 30 for token efficiency
          actorMentions,
          totalBeliefs: cogState.beliefs.size,
        }),
        summary: `${relevantBeliefs.length} relevant beliefs from ${cogState.beliefs.size} total`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

function buildEnrichmentSystemPrompt(
  guidanceState: GuidanceState,
): string {
  const prep = guidanceState.prepContext;

  return `You are the DREAM Journey Enrichment Agent. You analyse customer journey interactions and enrich them with AI agency levels, intensity scores, risk exposure, escalation triggers, and governance overlays.

${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown industry'})` : ''}
${prep?.dreamTrack ? `DREAM Track: ${prep.dreamTrack}` : ''}
Phase: ${guidanceState.dialoguePhase}

YOUR ROLE:
Infer enrichment data for each journey interaction based on:
1. The interaction itself (action, context, sentiment)
2. Accumulated beliefs from the session (constraints, enablers, visions)
3. Domain knowledge about automation potential

AI AGENCY CLASSIFICATION:
- "human": Requires human judgement, empathy, or complex decision-making. No current AI solution exists.
- "assisted": AI supports the human. Suggestions, recommendations, data synthesis, but human makes final call.
- "autonomous": AI can handle end-to-end with minimal oversight. Rules-based or well-defined processes.

For "now" — base on today's mature technology landscape.
For "future" — base on the organisation's stated vision and enabler beliefs. Be optimistic but realistic.

INTENSITY SCORING:
- businessIntensity (0-1): How much business effort/resource this interaction requires.
  0 = zero-touch automated; 1 = high-touch, multiple departments, significant cost.
- customerIntensity (0-1): How emotionally significant this is for the customer.
  0 = routine/invisible; 1 = high-emotion moment of truth.

RISK EXPOSURE:
Cross-reference constraint and friction beliefs with each interaction.
- "high": Interaction directly affected by critical constraints or regulatory requirements.
- "medium": Some constraint influence but manageable.
- "low": No significant constraint exposure.

GOVERNANCE OVERLAYS:
Map specific regulatory or policy constraints to interactions. E.g.:
- Data protection requirements (GDPR, CCPA)
- Industry-specific regulation (FCA, HIPAA, SOX)
- Internal governance (approval workflows, audit trails)

ESCALATION TRIGGERS:
Identify conditions where AI should hand off to a human. E.g.:
- Complaint severity thresholds
- High-value transaction limits
- Customer vulnerability indicators
- Regulatory exception handling

RULES:
- Enrich ALL provided interactions — don't skip any.
- Be specific with escalation triggers and governance overlays — generic is not helpful.
- automationConfidence should reflect how much evidence supports your classification.
  High confidence = multiple beliefs corroborate; Low = speculative inference.
- Use domain-specific language (if healthcare: patient, clinician; if finance: client, adviser).`;
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

/**
 * Run the journey enrichment agent to populate AI agency, intensity,
 * risk, escalation, and governance data for journey interactions.
 *
 * @param guidanceState — Current guidance state
 * @param liveJourney — Current journey data
 * @param cogState — Cognitive state with beliefs and actors
 * @param onConversation — Optional callback for agent conversation events
 * @returns Enrichment data or null if failed/skipped
 */
export async function runJourneyEnrichmentAgent(
  guidanceState: GuidanceState,
  liveJourney: LiveJourneyData,
  cogState: CognitiveState,
  onConversation?: AgentConversationCallback,
): Promise<JourneyEnrichment | null> {
  if (!env.OPENAI_API_KEY) return null;

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildEnrichmentSystemPrompt(guidanceState);
  const startMs = Date.now();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: 'Enrich all journey interactions. Use get_journey_state to review interactions, get_relevant_beliefs for constraint/enabler context, then enrich_interactions with your assessments.',
    },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) break;

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'enrich_interactions' } }
        : 'auto';

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages,
        tools: ENRICHMENT_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        await onConversation?.({
          timestampMs: Date.now(),
          agent: 'journey-enrichment-agent',
          to: 'orchestrator',
          message: assistantMessage.content.trim(),
          type: 'info',
        });
      }

      if (!assistantMessage.tool_calls?.length) break;

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;
        try { fnArgs = JSON.parse(toolCall.function.arguments); } catch { fnArgs = {}; }

        if (fnName === 'enrich_interactions') {
          const rawEnrichments = Array.isArray(fnArgs.enrichments)
            ? fnArgs.enrichments as Array<Record<string, unknown>>
            : [];

          const enrichments: InteractionEnrichment[] = rawEnrichments.map((e) => ({
            interactionId: String(e.interactionId || ''),
            aiAgencyNow: validateAgency(e.aiAgencyNow),
            aiAgencyFuture: validateAgency(e.aiAgencyFuture),
            businessIntensity: clamp01(Number(e.businessIntensity) || 0.5),
            customerIntensity: clamp01(Number(e.customerIntensity) || 0.5),
            automationConfidence: clamp01(Number(e.automationConfidence) || 0.5),
            escalationTriggers: Array.isArray(e.escalationTriggers)
              ? (e.escalationTriggers as unknown[]).map(String).filter(Boolean)
              : [],
            governanceOverlays: Array.isArray(e.governanceOverlays)
              ? (e.governanceOverlays as unknown[]).map(String).filter(Boolean)
              : [],
            riskExposure: validateRisk(e.riskExposure),
          }));

          const result: JourneyEnrichment = {
            enrichments,
            overallAutomationReadiness: clamp01(Number(fnArgs.overallAutomationReadiness) || 0.5),
            summary: String(fnArgs.summary || 'Enrichment completed.'),
          };

          await onConversation?.({
            timestampMs: Date.now(),
            agent: 'journey-enrichment-agent',
            to: 'orchestrator',
            message: `**Journey Enrichment**: ${enrichments.length} interactions enriched. Automation readiness: ${(result.overallAutomationReadiness * 100).toFixed(0)}%. ${result.summary}`,
            type: 'proposal',
            metadata: { sourceCount: enrichments.length },
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"submitted"}' });
          return result;
        } else {
          const toolResult = executeEnrichmentTool(fnName, fnArgs, liveJourney, cogState);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult.result });

          await onConversation?.({
            timestampMs: Date.now(),
            agent: 'journey-enrichment-agent',
            to: 'journey-enrichment-agent',
            message: `[Tool: ${fnName}] ${toolResult.summary}`,
            type: 'request',
            metadata: { toolsUsed: [fnName] },
          });
        }
      }
    }
  } catch (error) {
    console.error('[Journey Enrichment Agent] Failed:', error instanceof Error ? error.message : error);
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function validateAgency(value: unknown): 'human' | 'assisted' | 'autonomous' {
  const s = String(value || '').toLowerCase();
  if (s === 'assisted') return 'assisted';
  if (s === 'autonomous') return 'autonomous';
  return 'human';
}

function validateRisk(value: unknown): 'low' | 'medium' | 'high' {
  const s = String(value || '').toLowerCase();
  if (s === 'medium') return 'medium';
  if (s === 'high') return 'high';
  return 'low';
}
