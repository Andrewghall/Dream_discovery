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
import type { AgentConversationCallback, AgentReview } from './agent-types';
import { buildJourneyContextString } from '../journey-completion-state';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 3;
const LOOP_TIMEOUT_MS = 8_000;
const MODEL = 'gpt-4o-mini';

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const DEFAULT_CONSTRAINT_DOMAINS = ['People', 'Operations', 'Customer', 'Technology', 'Regulation'];

function buildConstraintTools(dimensions?: string[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const domainEnum = dimensions?.length ? dimensions : DEFAULT_CONSTRAINT_DOMAINS;

  return [
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
            enum: domainEnum,
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
}

const CONSTRAINT_TOOLS = buildConstraintTools();

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

// ══════════════════════════════════════════════════════════════
// REVIEW MODE — Constraint Agent reviews proposals from its domain
// Same tools, same reasoning, same agentic loop.
// ══════════════════════════════════════════════════════════════

const CONSTRAINT_REVIEW_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  CONSTRAINT_TOOLS[0], // query_constraint_beliefs
  {
    type: 'function',
    function: {
      name: 'submit_review',
      description: 'Submit your review of the proposals. This is your commit tool.',
      parameters: {
        type: 'object',
        properties: {
          stance: {
            type: 'string',
            enum: ['agree', 'challenge', 'build'],
            description: 'agree = proposals are phase-appropriate, challenge = proposals violate phase rules or miss known constraints, build = agree but see additional constraint angles',
          },
          feedback: {
            type: 'string',
            description: 'Your specific assessment from the constraints perspective. Reference known constraints and explain your reasoning.',
          },
          suggestedChanges: {
            type: 'string',
            description: 'If challenging or building, what specifically should change?',
          },
        },
        required: ['stance', 'feedback'],
      },
    },
  },
];

export async function reviewWithConstraintAgent(
  proposals: string,
  phase: string,
  cogState: CognitiveState,
  guidanceState: GuidanceState,
  onConversation?: AgentConversationCallback,
): Promise<AgentReview> {
  if (!env.OPENAI_API_KEY) {
    return { agent: 'Constraint Agent', stance: 'agree', feedback: 'Constraint Agent unavailable.' };
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const prep = guidanceState.prepContext;
  const startMs = Date.now();

  const phaseInstruction = phase === 'REIMAGINE'
    ? `CRITICAL: We are in REIMAGINE phase. This is PURE VISION — zero constraints, zero friction, zero barriers. If ANY proposal mentions constraints, limitations, barriers, changes needed, or practical concerns — you MUST CHALLENGE it immediately. REIMAGINE asks "what does perfect look like?" not "what's stopping us?".`
    : phase === 'CONSTRAINTS'
      ? `We are in CONSTRAINTS phase. Your home turf. Do these proposals help map real, specific limitations? Are they grounded in beliefs? Are they missing any known constraint domains?`
      : `We are in DEFINE APPROACH. Do these proposals account for the constraints we've mapped while still being actionable and forward-looking?`;

  const journeyCtx = buildJourneyContextString(guidanceState.journeyCompletionState);

  const systemPrompt = `You are the DREAM Constraint Agent reviewing proposals from a colleague.

${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown'})` : ''}
Current phase: ${phase}
Total beliefs: ${cogState.beliefs.size}

Your domain expertise is limitations, risks, and blockers. You know what stands in the way.

${phaseInstruction}

${journeyCtx ? `JOURNEY CONTEXT:\n${journeyCtx}\nWhen reviewing proposals, check if specific journey stages have regulatory, technical, or organisational constraints that haven't been captured. If you spot a constraint at a journey stage, flag it as a "build" with the specific stage and constraint type.\n` : ''}
REVIEW MODE: Use query_constraint_beliefs to check what constraints exist in the conversation, then assess whether the proposals are appropriate for this phase. Submit your review with submit_review.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Review these proposals from the Facilitation Agent:\n\n${proposals}\n\nAre these appropriate for the ${phase} phase? Use your tools to check against known constraints.` },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) break;

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'submit_review' } }
        : 'auto';

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages,
        tools: CONSTRAINT_REVIEW_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        onConversation?.({
          timestampMs: Date.now(),
          agent: 'constraint-agent',
          to: 'orchestrator',
          message: `[REVIEWING] ${assistantMessage.content.trim()}`,
          type: 'info',
        });
      }

      if (!assistantMessage.tool_calls?.length) break;

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;
        try { fnArgs = JSON.parse(toolCall.function.arguments); } catch { fnArgs = {}; }

        if (fnName === 'submit_review') {
          const review: AgentReview = {
            agent: 'Constraint Agent',
            stance: (['agree', 'challenge', 'build'].includes(String(fnArgs.stance))
              ? String(fnArgs.stance) : 'agree') as AgentReview['stance'],
            feedback: String(fnArgs.feedback || 'No feedback provided.'),
            suggestedChanges: fnArgs.suggestedChanges ? String(fnArgs.suggestedChanges) : undefined,
          };

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'constraint-agent',
            to: 'facilitation-agent',
            message: `[${review.stance.toUpperCase()}] ${review.feedback}${review.suggestedChanges ? `\nSuggestion: ${review.suggestedChanges}` : ''}`,
            type: review.stance === 'challenge' ? 'challenge' : 'proposal',
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"submitted"}' });
          return review;
        } else {
          const toolResult = executeConstraintTool(fnName, fnArgs, cogState);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult.result });
        }
      }
    }
  } catch (error) {
    console.error('[Constraint Agent Review] Failed:', error instanceof Error ? error.message : error);
  }

  return { agent: 'Constraint Agent', stance: 'agree', feedback: 'Review timed out — no objections raised.' };
}
