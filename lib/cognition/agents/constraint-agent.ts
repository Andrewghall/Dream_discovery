/**
 * DREAM Constraint Agent
 *
 * A GPT-4o-mini tool-calling agent that maps detected constraints
 * to journey interactions. Only active during CONSTRAINTS phase.
 *
 * Called by the Facilitation Orchestrator when:
 * - Phase is CONSTRAINTS
 * - New constraint/risk beliefs have been added since last run
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CognitiveState } from '../cognitive-state';
import type { GuidanceState, ConstraintFlag } from '../guidance-state';
import type { AgentConversationCallback } from './agent-types';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 3;
const LOOP_TIMEOUT_MS = 8_000;
const MODEL = 'gpt-4o-mini';

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const CONSTRAINT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_constraint_beliefs',
      description: 'Search beliefs specifically in the constraint and risk categories.',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            enum: ['People', 'Operations', 'Customer', 'Technology', 'Regulation'],
            description: 'Optional: filter by domain.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'map_constraints',
      description: 'Map constraints to journey stages. Call this to commit your constraint mappings.',
      parameters: {
        type: 'object',
        properties: {
          constraints: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['regulatory', 'technical', 'organisational', 'people', 'customer', 'budget'],
                },
                label: { type: 'string', description: 'Short label for the constraint.' },
                severity: {
                  type: 'string',
                  enum: ['blocking', 'significant', 'manageable'],
                },
                sourceBeliefIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Belief IDs that ground this constraint.',
                },
                reasoning: { type: 'string', description: 'Why this is a constraint at this severity.' },
              },
              required: ['type', 'label', 'severity', 'sourceBeliefIds', 'reasoning'],
            },
          },
        },
        required: ['constraints'],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

function executeConstraintTool(
  toolName: string,
  args: Record<string, unknown>,
  cogState: CognitiveState,
): { result: string; summary: string } {
  switch (toolName) {
    case 'query_constraint_beliefs': {
      const domain = args.domain ? String(args.domain) : null;

      const constraints = Array.from(cogState.beliefs.values()).filter((b) => {
        if (!['constraint', 'risk'].includes(b.category)) return false;
        if (domain && !b.domains.some((d) => d.domain === domain)) return false;
        return true;
      }).slice(0, 20);

      return {
        result: JSON.stringify({
          count: constraints.length,
          constraints: constraints.map((b) => ({
            id: b.id,
            label: b.label,
            category: b.category,
            domains: b.domains.map((d) => d.domain),
            confidence: b.confidence,
          })),
        }),
        summary: `Found ${constraints.length} constraint/risk beliefs${domain ? ` in ${domain}` : ''}`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export type ConstraintProposal = {
  constraint: ConstraintFlag;
  sourceBeliefIds: string[];
  reasoning: string;
};

export async function runConstraintAgent(
  cogState: CognitiveState,
  guidanceState: GuidanceState,
  onConversation?: AgentConversationCallback,
): Promise<ConstraintProposal[]> {
  if (!env.OPENAI_API_KEY) return [];
  if (guidanceState.dialoguePhase !== 'CONSTRAINTS') return [];

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const startMs = Date.now();

  const prep = guidanceState.prepContext;

  const systemPrompt = `You are the DREAM Constraint Agent. You identify and categorise constraints that affect the journey map.

${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown'})` : ''}
${prep?.dreamTrack ? `DREAM Track: ${prep.dreamTrack}${prep.targetDomain ? ' — Focus: ' + prep.targetDomain : ''}` : ''}
Current phase: CONSTRAINTS
Total beliefs: ${cogState.beliefs.size}

Your job: Identify constraint and risk beliefs, categorise them by type and severity, and map them so the facilitator can see them on the journey map.

Severity guide:
- blocking: Cannot proceed without addressing this. Regulatory requirements, fundamental technical limitations.
- significant: Will substantially impact outcomes if not addressed. Major resource gaps, skill deficiencies.
- manageable: Can be worked around but should be tracked. Minor process issues, non-critical gaps.

Call map_constraints when ready. Cite sourceBeliefIds for every constraint.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Review the constraint and risk beliefs and map them.' },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) break;

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'map_constraints' } }
        : 'auto';

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages,
        tools: CONSTRAINT_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        onConversation?.({
          timestampMs: Date.now(),
          agent: 'constraint-agent',
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

        if (fnName === 'map_constraints') {
          const rawConstraints = Array.isArray(fnArgs.constraints) ? fnArgs.constraints : [];
          const proposals: ConstraintProposal[] = [];

          for (const raw of rawConstraints as Array<Record<string, unknown>>) {
            const sourceBeliefIds = Array.isArray(raw.sourceBeliefIds)
              ? raw.sourceBeliefIds.map(String)
              : [];

            const constraint: ConstraintFlag = {
              id: `constraint_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              type: (raw.type as ConstraintFlag['type']) || 'organisational',
              label: String(raw.label || 'Unnamed constraint'),
              severity: (raw.severity as ConstraintFlag['severity']) || 'manageable',
              sourceNodeIds: sourceBeliefIds,
              addedBy: 'ai',
            };

            proposals.push({
              constraint,
              sourceBeliefIds,
              reasoning: String(raw.reasoning || ''),
            });
          }

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'constraint-agent',
            to: 'orchestrator',
            message: `I've identified ${proposals.length} constraint${proposals.length !== 1 ? 's' : ''}: ${proposals.map((p) => `"${p.constraint.label}" (${p.constraint.severity})`).join(', ')}`,
            type: 'proposal',
            metadata: {
              beliefsCited: proposals.reduce((sum, p) => sum + p.sourceBeliefIds.length, 0),
            },
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"committed"}' });
          return proposals;
        } else {
          const toolResult = executeConstraintTool(fnName, fnArgs, cogState);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult.result });
        }
      }
    }
  } catch (error) {
    console.error('[Constraint Agent] Failed:', error instanceof Error ? error.message : error);
  }

  return [];
}
