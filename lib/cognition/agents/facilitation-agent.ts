/**
 * DREAM Facilitation Agent
 *
 * A GPT-4o-mini tool-calling agent that generates contextual facilitation
 * post-its (sticky pads) based on the active theme and accumulated beliefs.
 *
 * Called by the Facilitation Orchestrator:
 * - Every 5 new utterances, OR
 * - Every 30 seconds, whichever comes first
 * - Skipped when freeflowMode is true
 *
 * Key difference from the previous deterministic system:
 * Instead of template strings like "'${keyword}' has appeared ${count} times...",
 * this agent generates natural, contextual facilitation questions grounded in
 * actual beliefs AND pre-workshop Discovery intelligence.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CognitiveState } from '../cognitive-state';
import type { GuidanceState } from '../guidance-state';
import type { AgentConversationCallback } from './agent-types';
import type { StickyPad, StickyPadType, Lens } from '@/lib/cognitive-guidance/pipeline';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 3;
const LOOP_TIMEOUT_MS = 8_000;
const MODEL = 'gpt-4o-mini';

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const FACILITATION_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_beliefs',
      description: 'Search beliefs by pattern, category, or domain.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Keywords to match.' },
          category: {
            type: 'string',
            enum: ['aspiration', 'constraint', 'enabler', 'opportunity', 'risk', 'insight', 'action'],
          },
          domain: {
            type: 'string',
            enum: ['People', 'Operations', 'Customer', 'Technology', 'Regulation'],
          },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contradictions',
      description: 'Get unresolved belief contradictions.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_discovery_intelligence',
      description: 'Get pre-workshop Discovery interview synthesis — themes, pain points, maturity scores.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_pads',
      description: 'Generate 1-3 facilitation sticky pads. Each pad is a contextual prompt for the facilitator.',
      parameters: {
        type: 'object',
        properties: {
          pads: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['CLARIFICATION', 'GAP_PROBE', 'CONTRADICTION_PROBE', 'RISK_PROBE', 'ENABLER_PROBE', 'CUSTOMER_IMPACT', 'OWNERSHIP_ACTION'],
                },
                prompt: { type: 'string', description: 'The facilitation question/prompt text.' },
                lens: {
                  type: 'string',
                  enum: ['People', 'Organisation', 'Technology', 'Regulation', 'Customer'],
                  description: 'Primary lens (or null for cross-cutting).',
                },
                sourceBeliefIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Belief IDs that ground this pad.',
                },
                reasoning: { type: 'string', description: 'Why this pad is relevant now.' },
              },
              required: ['type', 'prompt', 'sourceBeliefIds', 'reasoning'],
            },
            description: 'Array of 1-3 facilitation pads.',
          },
        },
        required: ['pads'],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

function executeFacilitationTool(
  toolName: string,
  args: Record<string, unknown>,
  cogState: CognitiveState,
  guidanceState: GuidanceState,
): { result: string; summary: string } {
  switch (toolName) {
    case 'query_beliefs': {
      const pattern = String(args.pattern || '').toLowerCase();
      const category = args.category ? String(args.category) : null;
      const domain = args.domain ? String(args.domain) : null;

      const matches = Array.from(cogState.beliefs.values()).filter((b) => {
        if (pattern && !b.label.toLowerCase().includes(pattern)) return false;
        if (category && b.category !== category) return false;
        if (domain && !b.domains.some((d) => d.domain === domain)) return false;
        return true;
      }).slice(0, 15);

      return {
        result: JSON.stringify({
          matchCount: matches.length,
          beliefs: matches.map((b) => ({
            id: b.id,
            label: b.label,
            category: b.category,
            domains: b.domains.map((d) => d.domain),
            confidence: b.confidence,
          })),
        }),
        summary: `Found ${matches.length} beliefs matching "${pattern}"`,
      };
    }

    case 'get_contradictions': {
      const unresolved = Array.from(cogState.contradictions.values()).filter((c) => !c.resolvedAtMs);
      return {
        result: JSON.stringify({
          count: unresolved.length,
          contradictions: unresolved.slice(0, 5).map((c) => ({
            id: c.id,
            beliefAId: c.beliefAId,
            beliefBId: c.beliefBId,
            resolution: c.resolution,
          })),
        }),
        summary: `${unresolved.length} unresolved contradictions`,
      };
    }

    case 'get_discovery_intelligence': {
      const di = guidanceState.prepContext?.discoveryIntelligence;
      if (!di) {
        return {
          result: JSON.stringify({ available: false }),
          summary: 'No Discovery intelligence available',
        };
      }
      return {
        result: JSON.stringify({
          available: true,
          participantCount: di.participantCount,
          topThemes: di.discoveryThemes.slice(0, 5).map((t) => ({
            title: t.title,
            domain: t.domain,
            frequency: t.frequency,
            sentiment: t.sentiment,
          })),
          topPainPoints: di.painPoints.slice(0, 5).map((p) => ({
            description: p.description,
            domain: p.domain,
            frequency: p.frequency,
            severity: p.severity,
          })),
          maturityGaps: di.maturitySnapshot.map((m) => ({
            domain: m.domain,
            gap: +(m.targetMedian - m.todayMedian).toFixed(1),
          })),
          consensusAreas: di.consensusAreas.slice(0, 3),
          divergenceAreas: di.divergenceAreas.slice(0, 3),
        }),
        summary: `Discovery intelligence: ${di.discoveryThemes.length} themes, ${di.painPoints.length} pain points`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

function buildFacilitationSystemPrompt(
  cogState: CognitiveState,
  guidanceState: GuidanceState,
): string {
  const prep = guidanceState.prepContext;
  const activeTheme = guidanceState.themes.find((t) => t.id === guidanceState.activeThemeId);

  return `You are the DREAM Facilitation Agent. You generate contextual facilitation prompts (sticky post-its) that help the workshop facilitator guide the conversation.

${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown'})` : ''}
${prep?.dreamTrack ? `DREAM Track: ${prep.dreamTrack}${prep.targetDomain ? ' — Focus: ' + prep.targetDomain : ''}` : ''}
Current phase: ${guidanceState.dialoguePhase}
Active theme: ${activeTheme ? `"${activeTheme.title}" (${activeTheme.lens || 'cross-cutting'})` : 'None'}
Total beliefs: ${cogState.beliefs.size}

Your job: Generate 1-3 facilitation prompts that:
1. Are grounded in actual beliefs from the workshop
2. Reference Discovery intelligence when relevant
3. Probe deeper into themes, contradictions, or gaps
4. Help the facilitator ask the RIGHT question at the RIGHT time

RULES:
- Every pad MUST cite sourceBeliefIds — beliefs that actually exist
- Never fabricate questions about topics not in the beliefs
- Connect live discussion to pre-workshop Discovery insights when possible
- Match the prompt tone to the current phase:
  REIMAGINE → visionary, aspirational, open-ended
  CONSTRAINTS → practical, specific, challenging
  DEFINE_APPROACH → solution-oriented, concrete, actionable

When communicating, speak naturally as a colleague would.`;
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export type PadProposal = {
  pad: StickyPad;
  sourceBeliefIds: string[];
  reasoning: string;
};

export async function runFacilitationAgent(
  cogState: CognitiveState,
  guidanceState: GuidanceState,
  onConversation?: AgentConversationCallback,
): Promise<PadProposal[]> {
  if (!env.OPENAI_API_KEY) return [];

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildFacilitationSystemPrompt(cogState, guidanceState);
  const startMs = Date.now();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: 'Generate facilitation prompts based on the current beliefs and active theme.',
    },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) break;

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'generate_pads' } }
        : 'auto';

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        messages,
        tools: FACILITATION_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        onConversation?.({
          timestampMs: Date.now(),
          agent: 'facilitation-agent',
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

        if (fnName === 'generate_pads') {
          const rawPads = Array.isArray(fnArgs.pads) ? fnArgs.pads : [];
          const proposals: PadProposal[] = [];

          for (const raw of rawPads as Array<Record<string, unknown>>) {
            const sourceBeliefIds = Array.isArray(raw.sourceBeliefIds)
              ? raw.sourceBeliefIds.map(String)
              : [];

            const pad: StickyPad = {
              id: `pad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              type: (raw.type as StickyPadType) || 'CLARIFICATION',
              prompt: String(raw.prompt || ''),
              signalStrength: 0.7,
              provenance: {
                triggerType: 'repeated_theme',
                sourceNodeIds: sourceBeliefIds,
                description: String(raw.reasoning || ''),
              },
              createdAtMs: Date.now(),
              status: 'active',
              snoozedUntilMs: null,
              // Question-driven defaults for agent-generated pads
              source: 'agent',
              questionId: null,
              grounding: String(raw.reasoning || ''),
              coveragePercent: 0,
              coverageState: 'queued',
            };

            proposals.push({
              pad,
              sourceBeliefIds,
              reasoning: String(raw.reasoning || ''),
            });
          }

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'facilitation-agent',
            to: 'orchestrator',
            message: `I'd like to suggest ${proposals.length} facilitation pad${proposals.length !== 1 ? 's' : ''}: ${proposals.map((p) => `"${p.pad.prompt.substring(0, 80)}..."`).join('; ')}`,
            type: 'proposal',
            metadata: {
              beliefsCited: proposals.reduce((sum, p) => sum + p.sourceBeliefIds.length, 0),
              toolsUsed: ['query_beliefs', 'get_discovery_intelligence'],
            },
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"committed"}' });
          return proposals;
        } else {
          const toolResult = executeFacilitationTool(fnName, fnArgs, cogState, guidanceState);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult.result });
        }
      }
    }
  } catch (error) {
    console.error('[Facilitation Agent] Failed:', error instanceof Error ? error.message : error);
  }

  return [];
}
