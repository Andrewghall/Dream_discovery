/**
 * DREAM Question Set Agent
 *
 * A GPT-4o-mini tool-calling agent that generates a tailored Discovery
 * question set based on research findings, DREAM track, and target domain.
 *
 * The output is an editable list that the facilitator reviews and
 * modifies before sending to participants.
 *
 * CRITICAL: triple_rating questions are NEVER modified — they generate
 * the spider scores. Only qualitative questions are tailored.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import { FIXED_QUESTIONS, type FixedQuestion } from '@/lib/conversation/fixed-questions';
import type {
  TailoredQuestionSet,
  TailoredQuestion,
  WorkshopPrepResearch,
  PrepContext,
  AgentConversationCallback,
} from './agent-types';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 5;
const LOOP_TIMEOUT_MS = 25_000;
const MODEL = 'gpt-4o-mini';

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const QUESTION_SET_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_base_questions',
      description:
        'Retrieve the base Discovery question set template. Returns all phases with their questions and tags. Use this to understand the structure before tailoring.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_research_context',
      description:
        'Retrieve the Research Agent\'s findings about the client company. Use this to understand the company, industry, and specific challenges before tailoring questions.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tailor_phase_questions',
      description:
        'Tailor the questions for a specific phase. You can modify qualitative question texts to reference the client\'s specific context. NEVER modify triple_rating questions.',
      parameters: {
        type: 'object',
        properties: {
          phase: {
            type: 'string',
            enum: ['intro', 'people', 'corporate', 'customer', 'technology', 'regulation', 'prioritization', 'summary'],
            description: 'The conversation phase to tailor.',
          },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'The question text (modified or original).' },
                tag: { type: 'string', description: 'The question tag (keep original).' },
                isModified: { type: 'boolean', description: 'Whether this question was changed from the base.' },
                tailoringNote: { type: 'string', description: 'Why this was changed (for facilitator review).' },
              },
              required: ['text', 'tag', 'isModified'],
            },
            description: 'The full list of questions for this phase. Must include ALL questions from the base.',
          },
        },
        required: ['phase', 'questions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'commit_question_set',
      description:
        'Commit the final tailored question set. Call this when all phases have been tailored. Include a summary of what was changed and why.',
      parameters: {
        type: 'object',
        properties: {
          tailoringSummary: {
            type: 'string',
            description:
              'A paragraph explaining what was changed, why, and how the questions now reflect the client context. This is shown to the facilitator.',
          },
          modifiedCount: {
            type: 'number',
            description: 'How many questions were modified.',
          },
          totalCount: {
            type: 'number',
            description: 'Total number of questions.',
          },
        },
        required: ['tailoringSummary', 'modifiedCount', 'totalCount'],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

function executeQuestionSetTool(
  toolName: string,
  args: Record<string, unknown>,
  research: WorkshopPrepResearch | null,
  tailoredPhases: Map<string, TailoredQuestion[]>,
): { result: string; summary: string } {
  switch (toolName) {
    case 'get_base_questions': {
      // Return the base questions in a structured format
      const summary: Record<string, { count: number; tags: string[] }> = {};
      for (const [phase, questions] of Object.entries(FIXED_QUESTIONS)) {
        summary[phase] = {
          count: questions.length,
          tags: questions.map((q: FixedQuestion) => q.tag),
        };
      }

      return {
        result: JSON.stringify({
          phases: Object.entries(FIXED_QUESTIONS).map(([phase, questions]) => ({
            phase,
            questions: (questions as FixedQuestion[]).map((q) => ({
              text: q.text,
              tag: q.tag,
              hasMaturityScale: !!q.maturityScale,
              isTripleRating: q.tag === 'triple_rating',
            })),
          })),
          totalQuestions: Object.values(FIXED_QUESTIONS).reduce(
            (sum, qs) => sum + (qs as FixedQuestion[]).length,
            0,
          ),
        }),
        summary: `Retrieved base question set: ${Object.keys(summary).length} phases, ${Object.values(summary).reduce((s, v) => s + v.count, 0)} total questions`,
      };
    }

    case 'get_research_context': {
      if (!research) {
        return {
          result: JSON.stringify({ error: 'No research available. Questions will be generic.' }),
          summary: 'No research context available — will use generic questions.',
        };
      }

      return {
        result: JSON.stringify({
          companyOverview: research.companyOverview,
          industryContext: research.industryContext,
          keyPublicChallenges: research.keyPublicChallenges,
          recentDevelopments: research.recentDevelopments,
          competitorLandscape: research.competitorLandscape,
          domainInsights: research.domainInsights,
        }),
        summary: `Retrieved research context: ${research.keyPublicChallenges.length} challenges, ${research.recentDevelopments.length} developments`,
      };
    }

    case 'tailor_phase_questions': {
      const phase = String(args.phase || '');
      const questions = args.questions as Array<Record<string, unknown>>;

      if (!phase || !Array.isArray(questions)) {
        return {
          result: JSON.stringify({ error: 'Invalid phase or questions' }),
          summary: 'Invalid tailoring request',
        };
      }

      // Build tailored questions array
      const baseQuestions = FIXED_QUESTIONS[phase as keyof typeof FIXED_QUESTIONS] || [];
      const tailored: TailoredQuestion[] = questions.map((q, i) => {
        const base = baseQuestions[i];
        return {
          phase,
          text: String(q.text || base?.text || ''),
          tag: String(q.tag || base?.tag || 'context'),
          maturityScale: base?.maturityScale,
          tailoringNote: q.tailoringNote ? String(q.tailoringNote) : undefined,
          isModified: Boolean(q.isModified),
        };
      });

      tailoredPhases.set(phase, tailored);
      const modifiedCount = tailored.filter((q) => q.isModified).length;

      return {
        result: JSON.stringify({
          phase,
          questionsStored: tailored.length,
          modified: modifiedCount,
          unchanged: tailored.length - modifiedCount,
        }),
        summary: `Tailored ${phase} phase: ${modifiedCount}/${tailored.length} questions modified`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

function buildQuestionSetSystemPrompt(context: PrepContext, research: WorkshopPrepResearch | null): string {
  const trackDesc =
    context.dreamTrack === 'DOMAIN'
      ? `The DREAM track is Domain, focused on ${context.targetDomain || 'a specific area'}. Weight questions toward this domain — add context-specific follow-ups, reduce irrelevant phases.`
      : 'The DREAM track is Enterprise — full end-to-end assessment. Tailor questions evenly across all domains.';

  const researchSummary = research
    ? `\nResearch Context Available:\n- Company: ${research.companyOverview.substring(0, 300)}...\n- Industry: ${research.industryContext.substring(0, 200)}...\n- Key challenges: ${research.keyPublicChallenges.slice(0, 3).join('; ')}\n${research.domainInsights ? `- Domain insights: ${research.domainInsights.substring(0, 200)}...` : ''}`
    : '\nNo research context available. Tailor based on industry knowledge only.';

  return `You are the DREAM Question Set Agent. Using research findings about ${context.clientName || 'the client'} and their ${context.industry || 'unknown'} industry, generate a tailored set of Discovery interview questions.

${trackDesc}
${researchSummary}

Your job:
1. First, retrieve the base question set using get_base_questions.
2. Then retrieve the research context using get_research_context.
3. For each phase, call tailor_phase_questions to modify qualitative questions.

CRITICAL RULES:
- Keep ALL triple_rating questions EXACTLY as they are (tag = "triple_rating").
  These generate the spider scores — do NOT modify their text.
- Keep the closing/summary question unchanged.
- ONLY modify qualitative questions (tags like "strengths", "gaps", "future",
  "friction", "working", "pain_points", etc.)
- When tailoring, reference the client's specific context, industry challenges,
  and known pain points to make questions more relevant.
- Maintain the questioning style: open-ended, non-leading, encouraging candid responses.
- Always include ALL original questions — you can modify text but never remove questions.

Example tailoring:
- Generic: "What helps you do your best work here?"
- Tailored for Tesco Customer Operations: "When thinking about how store operations
  and customer service teams work together, what helps you do your best work?
  Think of a specific time when collaboration worked well."

After tailoring all phases, call commit_question_set with a summary.

When communicating your findings, speak naturally as a colleague would.
Be professional but warm. Explain your reasoning clearly.`;
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export async function runQuestionSetAgent(
  context: PrepContext,
  research: WorkshopPrepResearch | null,
  onConversation?: AgentConversationCallback,
): Promise<TailoredQuestionSet> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured — cannot run Question Set Agent');
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildQuestionSetSystemPrompt(context, research);
  const startMs = Date.now();

  // Track tailored phases as they come in
  const tailoredPhases = new Map<string, TailoredQuestion[]>();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Please generate a tailored Discovery question set for ${context.clientName || 'this client'}. Start by reviewing the base questions and research context, then tailor each phase.`,
    },
  ];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) {
        console.log(`[Question Set Agent] Timeout after ${iteration} iterations`);
        break;
      }

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'commit_question_set' } }
        : 'auto';

      console.log(`[Question Set Agent] Iteration ${iteration}${isLastIteration ? ' (forced commit)' : ''}`);

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages,
        tools: QUESTION_SET_TOOLS,
        tool_choice: toolChoice,
        parallel_tool_calls: true,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      // Emit thinking
      if (assistantMessage.content) {
        const thinking = assistantMessage.content.trim();
        if (thinking.length > 20) {
          onConversation?.({
            timestampMs: Date.now(),
            agent: 'question-set-agent',
            to: 'prep-orchestrator',
            message: thinking,
            type: 'info',
          });
        }
      }

      // No tool calls — done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        break;
      }

      // Process tool calls
      let committed = false;

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;

        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
        }

        if (fnName === 'commit_question_set') {
          committed = true;

          const modifiedCount = Number(fnArgs.modifiedCount || 0);
          const totalCount = Number(fnArgs.totalCount || 0);

          // Build full question listing grouped by phase
          const phaseLines: string[] = [];
          for (const [phase, questions] of tailoredPhases.entries()) {
            const modified = questions.filter((q) => q.isModified);
            if (modified.length === 0) continue;
            phaseLines.push(`\n**${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase** (${modified.length} modified)`);
            for (const q of modified) {
              phaseLines.push(`  • "${q.text}"${q.tailoringNote ? `\n    _${q.tailoringNote}_` : ''}`);
            }
          }

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'question-set-agent',
            to: 'prep-orchestrator',
            message: `I've completed the tailored question set. **${modifiedCount} questions modified** out of ${totalCount} total.\n\n**Tailoring Summary**\n${String(fnArgs.tailoringSummary || '')}${phaseLines.length > 0 ? '\n\n**Modified Questions by Phase**' + phaseLines.join('\n') : ''}`,
            type: 'proposal',
            metadata: {
              toolsUsed: ['get_base_questions', 'get_research_context', 'tailor_phase_questions'],
            },
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: 'committed' }),
          });
        } else {
          const toolResult = executeQuestionSetTool(fnName, fnArgs, research, tailoredPhases);

          // Emit tailor_phase_questions with full detail, and info reads
          if (fnName === 'tailor_phase_questions') {
            const phase = String(fnArgs.phase || '');
            const phaseQuestions = tailoredPhases.get(phase) || [];
            const modified = phaseQuestions.filter((q) => q.isModified);
            const modifiedList = modified.length > 0
              ? modified.map((q) => `  • "${q.text}"${q.tailoringNote ? `\n    _${q.tailoringNote}_` : ''}`).join('\n')
              : '  (no modifications)';

            onConversation?.({
              timestampMs: Date.now(),
              agent: 'question-set-agent',
              to: 'prep-orchestrator',
              message: `**Tailored ${phase} phase:** ${modified.length}/${phaseQuestions.length} questions modified\n${modifiedList}`,
              type: 'request',
              metadata: { toolsUsed: [fnName] },
            });
          } else if (fnName === 'get_base_questions' || fnName === 'get_research_context') {
            onConversation?.({
              timestampMs: Date.now(),
              agent: 'question-set-agent',
              to: 'prep-orchestrator',
              message: toolResult.summary,
              type: 'request',
              metadata: { toolsUsed: [fnName] },
            });
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult.result,
          });

          console.log(`[Question Set Agent] Tool ${fnName}: ${toolResult.summary.substring(0, 100)}`);
        }
      }

      if (committed) {
        const elapsed = Date.now() - startMs;
        console.log(`[Question Set Agent] Committed after ${iteration + 1} iterations, ${elapsed}ms`);
        return buildTailoredQuestionSet(tailoredPhases, String(messages[messages.length - 2]?.content || ''));
      }
    }

    // Loop ended without commit — build from whatever phases were tailored
    console.log('[Question Set Agent] Loop ended without commit — building from tailored phases');
    return buildTailoredQuestionSet(tailoredPhases, 'Questions tailored based on client context.');
  } catch (error) {
    console.error('[Question Set Agent] Failed:', error instanceof Error ? error.message : error);

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'question-set-agent',
      to: 'prep-orchestrator',
      message: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Falling back to the base question set.`,
      type: 'info',
    });

    return fallbackQuestionSet();
  }
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function buildTailoredQuestionSet(
  tailoredPhases: Map<string, TailoredQuestion[]>,
  commitSummary: string,
): TailoredQuestionSet {
  const questions: Record<string, TailoredQuestion[]> = {};

  // For each phase in FIXED_QUESTIONS, use tailored version if available, otherwise use base
  for (const [phase, baseQuestions] of Object.entries(FIXED_QUESTIONS)) {
    const tailored = tailoredPhases.get(phase);
    if (tailored) {
      questions[phase] = tailored;
    } else {
      // Use base questions unchanged
      questions[phase] = (baseQuestions as FixedQuestion[]).map((q) => ({
        phase,
        text: q.text,
        tag: q.tag,
        maturityScale: q.maturityScale,
        isModified: false,
      }));
    }
  }

  const modifiedCount = Object.values(questions).reduce(
    (sum, qs) => sum + qs.filter((q) => q.isModified).length,
    0,
  );

  // Extract tailoring summary from commit message or use a generic one
  const summary =
    commitSummary.length > 20
      ? commitSummary.substring(0, 500)
      : `${modifiedCount} questions were tailored to the client context.`;

  return {
    questions,
    tailoringSummary: summary,
    generatedAtMs: Date.now(),
  };
}

function fallbackQuestionSet(): TailoredQuestionSet {
  const questions: Record<string, TailoredQuestion[]> = {};

  for (const [phase, baseQuestions] of Object.entries(FIXED_QUESTIONS)) {
    questions[phase] = (baseQuestions as FixedQuestion[]).map((q) => ({
      phase,
      text: q.text,
      tag: q.tag,
      maturityScale: q.maturityScale,
      isModified: false,
    }));
  }

  return {
    questions,
    tailoringSummary: 'Using base question set — tailoring was not available.',
    generatedAtMs: Date.now(),
  };
}
