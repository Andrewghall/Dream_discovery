/**
 * DREAM Guardian Agent
 *
 * A lightweight GPT-4o-mini verification agent that sits between every
 * proposing agent and the SSE output. Its sole job is to prevent
 * hallucination by verifying every output is grounded in actual data.
 *
 * Three checks:
 * 1. Grounding — Does every claim trace to an actual belief/utterance?
 * 2. Fabrication — Any invented statistics, names, specifics not in sources?
 * 3. Relevance — Is this appropriate for current phase + active theme?
 *
 * Design principle: fast and cheap. Short prompt, max 2 iterations.
 * Adds ~1-2s latency per verification.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { CognitiveState } from '../cognitive-state';
import type { DialoguePhase } from '@/lib/cognitive-guidance/pipeline';
import type { AgentConversationCallback } from './agent-types';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 2;
const LOOP_TIMEOUT_MS = 5_000;
const MODEL = 'gpt-4o-mini';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export type GuardianVerdict = {
  verdict: 'approve' | 'reject' | 'modify';
  reasoning: string;
  modifiedOutput?: unknown;
};

export type GuardianInput = {
  proposedOutput: unknown;
  outputDescription: string;
  sourceBeliefIds: string[];
  agentName: string;
  currentPhase: DialoguePhase;
};

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const GUARDIAN_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'verify_belief_references',
      description: 'Check that the cited belief IDs exist in the CognitiveState and retrieve their actual text.',
      parameters: {
        type: 'object',
        properties: {
          beliefIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Belief IDs to verify.',
          },
        },
        required: ['beliefIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'render_verdict',
      description: 'Deliver your verification verdict. Call this to commit your decision.',
      parameters: {
        type: 'object',
        properties: {
          verdict: {
            type: 'string',
            enum: ['approve', 'reject', 'modify'],
            description: 'Your verdict: approve (output is grounded), reject (output is fabricated or inappropriate), modify (mostly good but needs adjustment).',
          },
          reasoning: {
            type: 'string',
            description: 'Brief explanation of your decision.',
          },
          modifiedText: {
            type: 'string',
            description: 'If verdict is "modify", provide the corrected text. Otherwise omit.',
          },
        },
        required: ['verdict', 'reasoning'],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

function executeGuardianTool(
  toolName: string,
  args: Record<string, unknown>,
  cogState: CognitiveState,
): { result: string; summary: string } {
  switch (toolName) {
    case 'verify_belief_references': {
      const ids = Array.isArray(args.beliefIds) ? args.beliefIds.map(String) : [];
      const found: Array<{ id: string; label: string; category: string; exists: true }> = [];
      const missing: string[] = [];

      for (const id of ids) {
        const belief = cogState.beliefs.get(id);
        if (belief) {
          found.push({ id: belief.id, label: belief.label, category: belief.category, exists: true });
        } else {
          missing.push(id);
        }
      }

      return {
        result: JSON.stringify({
          totalChecked: ids.length,
          found: found.length,
          missing: missing.length,
          foundBeliefs: found,
          missingIds: missing,
        }),
        summary: `Verified ${ids.length} beliefs: ${found.length} found, ${missing.length} missing`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export async function runGuardianAgent(
  input: GuardianInput,
  cogState: CognitiveState,
  onConversation?: AgentConversationCallback,
): Promise<GuardianVerdict> {
  if (!env.OPENAI_API_KEY) {
    // If no API key, approve by default (don't block)
    return { verdict: 'approve', reasoning: 'Guardian unavailable — approved by default' };
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const startMs = Date.now();

  // Resolve source beliefs for the system prompt
  const sourceBeliefs = input.sourceBeliefIds
    .map((id) => cogState.beliefs.get(id))
    .filter(Boolean)
    .map((b) => ({ id: b!.id, label: b!.label, category: b!.category }));

  const systemPrompt = `You are the DREAM Guardian Agent. Your sole job is to prevent hallucination.

You are verifying output from: ${input.agentName}
Current workshop phase: ${input.currentPhase}

The agent proposed: ${input.outputDescription}
Cited ${input.sourceBeliefIds.length} belief references.

VERIFICATION CHECKS:
1. GROUNDING: Does this output genuinely emerge from the cited beliefs, or has the agent extrapolated beyond the data?
2. FABRICATION: Does the output contain any claims, statistics, or specifics NOT present in the source beliefs?
3. RELEVANCE: Is this output appropriate for the ${input.currentPhase} phase?

Source beliefs (${sourceBeliefs.length} found):
${sourceBeliefs.map((b) => `- [${b.id}] ${b.label} (${b.category})`).join('\n')}

IMPORTANT:
- If all beliefs are valid and the output is grounded → approve
- If the output mentions specifics not in the beliefs → reject or modify
- If only minor wording adjustments needed → modify (provide corrected text)
- Be FAST — only call verify_belief_references if you need to check more beliefs

Call render_verdict when ready.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Proposed output:\n${JSON.stringify(input.proposedOutput, null, 2)}`,
    },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) break;

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'render_verdict' } }
        : 'auto';

      const completion = await openAiBreaker.execute(() => openai.chat.completions.create({
        model: MODEL,
        temperature: 0.1, // Low temperature for verification
        messages,
        tools: GUARDIAN_TOOLS,
        tool_choice: toolChoice,
      }));

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (!assistantMessage.tool_calls?.length) break;

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;
        try { fnArgs = JSON.parse(toolCall.function.arguments); } catch { fnArgs = {}; }

        if (fnName === 'render_verdict') {
          const verdict = (['approve', 'reject', 'modify'].includes(String(fnArgs.verdict))
            ? String(fnArgs.verdict)
            : 'approve') as GuardianVerdict['verdict'];

          const reasoning = String(fnArgs.reasoning || '');
          const modifiedText = fnArgs.modifiedText ? String(fnArgs.modifiedText) : undefined;

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'guardian',
            to: 'orchestrator',
            message: `Verification of ${input.agentName}'s output: ${verdict.toUpperCase()}. ${reasoning}`,
            type: 'verdict',
            metadata: {
              verdict,
              reasoning,
              beliefsCited: input.sourceBeliefIds.length,
            },
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"committed"}' });

          const result: GuardianVerdict = { verdict, reasoning };
          if (verdict === 'modify' && modifiedText) {
            result.modifiedOutput = modifiedText;
          }
          return result;
        } else {
          const toolResult = executeGuardianTool(fnName, fnArgs, cogState);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult.result });
        }
      }
    }
  } catch (error) {
    console.error('[Guardian Agent] Failed:', error instanceof Error ? error.message : error);
  }

  // Default to approve if verification failed (don't block the facilitator)
  return { verdict: 'approve', reasoning: 'Guardian verification timed out — approved by default' };
}

// ══════════════════════════════════════════════════════════════
// REFERENCE VALIDATION (Layer 2 — pre-Guardian check)
// ══════════════════════════════════════════════════════════════

/**
 * Quick pre-Guardian check: verify all cited belief IDs actually exist.
 * Returns false if any ID is missing — no need to call Guardian.
 */
export function validateReferences(
  sourceBeliefIds: string[],
  cogState: CognitiveState,
): boolean {
  if (sourceBeliefIds.length === 0) return true; // No citations to verify

  for (const id of sourceBeliefIds) {
    if (!cogState.beliefs.get(id)) {
      console.warn(`[Guardian] Reference validation failed: belief ${id} not found`);
      return false;
    }
  }
  return true;
}
