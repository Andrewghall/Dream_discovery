/**
 * DREAM Question Set Agent — Workshop Facilitation Questions
 *
 * A GPT-4o-mini tool-calling agent that generates a tailored set of
 * workshop facilitation questions for the three live workshop phases:
 *   REIMAGINE → CONSTRAINTS → DEFINE APPROACH
 *
 * The agent uses:
 *   - Company research (from Research Agent)
 *   - Discovery interview insights (themes, pain points, aspirations)
 *   - DREAM track context (Enterprise vs Domain)
 *
 * These are NOT Discovery interview questions. Discovery has already
 * happened — the agents have those answers. These questions guide the
 * facilitator through the live workshop session.
 */

import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import { env } from '@/lib/env';
import type {
  WorkshopQuestionSet,
  FacilitationQuestion,
  WorkshopPhase,
  WorkshopPrepResearch,
  PrepContext,
  AgentConversationCallback,
  LensName,
} from './agent-types';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 6;
const LOOP_TIMEOUT_MS = 40_000;
const MODEL = 'gpt-4o-mini';

// ── Phase context: what lenses apply and in what order ──────

const PHASE_LENS_ORDER: Record<WorkshopPhase, string[]> = {
  REIMAGINE: ['People', 'Customer', 'Organisation'],
  CONSTRAINTS: ['Regulation', 'Customer', 'Technology', 'Organisation', 'People'],
  DEFINE_APPROACH: ['People', 'Organisation', 'Technology', 'Customer', 'Regulation'],
};

const PHASE_GUIDANCE: Record<WorkshopPhase, string> = {
  REIMAGINE: `REIMAGINE is the visionary phase. Participants paint a picture of the ideal future state WITHOUT constraints. No technology limitations, no budget concerns, no regulation barriers — just pure aspiration. The facilitator guides them through People, Customer, and Organisation lenses only. The goal is to get genuine, unconstrained thinking about what "great" looks like.`,

  CONSTRAINTS: `CONSTRAINTS maps the real-world limitations, working RIGHT-TO-LEFT through the lenses: Regulation → Customer → Technology → Organisation → People. Start with hard external constraints (regulatory, compliance) and work inward to softer people constraints. The goal is to systematically identify what stands between today and the reimagined vision. This phase references the vision from REIMAGINE to assess each constraint's impact.`,

  DEFINE_APPROACH: `DEFINE APPROACH builds the practical solution LEFT-TO-RIGHT: People → Organisation → Technology → Customer → Regulation. Start with human needs and build outward. The facilitator guides participants to design an approach that bridges today's reality to the reimagined future while respecting the constraints identified. Focus on actionable workstreams, ownership, and measurable outcomes.`,
};

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const QUESTION_SET_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_research_context',
      description:
        'Retrieve the Research Agent\'s findings about the client company — company overview, industry context, challenges, competitive landscape, and domain insights.',
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
      name: 'get_discovery_insights',
      description:
        'Retrieve insights from completed Discovery interviews — key themes, pain points, aspirations, consensus areas, divergence areas, and maturity scores. This is what participants have ALREADY told us. Use this to build questions that go deeper, not repeat what was said.',
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
      name: 'get_workshop_phases',
      description:
        'Retrieve the structure and purpose of each workshop phase (REIMAGINE, CONSTRAINTS, DEFINE_APPROACH), including which lenses apply in what order and what each phase aims to achieve.',
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
      name: 'design_phase_questions',
      description:
        'Propose facilitation questions for a specific workshop phase. Each question should guide the facilitator in drawing out the right insights from participants. Questions should be grounded in what we know from research and Discovery interviews.',
      parameters: {
        type: 'object',
        properties: {
          phase: {
            type: 'string',
            enum: ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'],
            description: 'The workshop phase to design questions for.',
          },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                lens: {
                  type: 'string',
                  description: 'The DREAM lens this question addresses (People, Organisation, Customer, Technology, Regulation, or General for cross-cutting).',
                },
                text: {
                  type: 'string',
                  description: 'The facilitation question text — what the facilitator would ask the room.',
                },
                purpose: {
                  type: 'string',
                  description: 'Why this question matters — what it aims to surface from participants.',
                },
                grounding: {
                  type: 'string',
                  description: 'How this question connects to research findings or Discovery interview data.',
                },
                subQuestions: {
                  type: 'array',
                  description: '2-3 starter sub-questions that explore specific angles within this main question. These become the initial post-it notes when the facilitator activates this question in the live session.',
                  items: {
                    type: 'object',
                    properties: {
                      lens: {
                        type: 'string',
                        description: 'The DREAM lens this sub-question explores.',
                      },
                      text: {
                        type: 'string',
                        description: 'The sub-question text — a specific angle or probe.',
                      },
                      purpose: {
                        type: 'string',
                        description: 'What this sub-question aims to surface.',
                      },
                    },
                    required: ['lens', 'text', 'purpose'],
                  },
                },
              },
              required: ['lens', 'text', 'purpose', 'grounding'],
            },
            description: 'The facilitation questions for this phase (typically 5-8 per phase).',
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
        'Commit the final workshop facilitation question set. Call this after designing questions for all three phases. Include an overall rationale explaining the question strategy.',
      parameters: {
        type: 'object',
        properties: {
          designRationale: {
            type: 'string',
            description:
              'A paragraph explaining the overall question design strategy — how the questions build on Discovery insights, why certain topics are emphasized, and how they guide the facilitator through the workshop. This is shown to the facilitator.',
          },
        },
        required: ['designRationale'],
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
  context: PrepContext,
  research: WorkshopPrepResearch | null,
  discoveryBriefing: Record<string, unknown> | null,
  designedPhases: Map<WorkshopPhase, FacilitationQuestion[]>,
): { result: string; summary: string } {
  switch (toolName) {
    case 'get_research_context': {
      if (!research) {
        return {
          result: JSON.stringify({ available: false, note: 'No research available. Generate questions based on general industry knowledge and the DREAM track context.' }),
          summary: '**Research context:** Not available — will use general industry knowledge.',
        };
      }

      const challengesList = research.keyPublicChallenges.length > 0
        ? research.keyPublicChallenges.map((c) => `  \u2022 ${c}`).join('\n')
        : '  (none identified)';
      const devsList = research.recentDevelopments.length > 0
        ? research.recentDevelopments.map((d) => `  \u2022 ${d}`).join('\n')
        : '  (none identified)';

      return {
        result: JSON.stringify({
          available: true,
          companyOverview: research.companyOverview,
          industryContext: research.industryContext,
          keyPublicChallenges: research.keyPublicChallenges,
          recentDevelopments: research.recentDevelopments,
          competitorLandscape: research.competitorLandscape,
          domainInsights: research.domainInsights,
        }),
        summary: `**Retrieved research context:**\n\n**Company:** ${research.companyOverview}\n\n**Industry:** ${research.industryContext}\n\n**Key Challenges**\n${challengesList}\n\n**Recent Developments**\n${devsList}${research.domainInsights ? `\n\n**Domain Insights:** ${research.domainInsights}` : ''}`,
      };
    }

    case 'get_discovery_insights': {
      if (!discoveryBriefing) {
        return {
          result: JSON.stringify({
            available: false,
            note: 'No Discovery interview data available yet. Participants have not completed their interviews. Generate questions based on research context and DREAM track — the facilitator can refine after Discovery is complete.',
          }),
          summary: '**Discovery insights:** Not yet available — participants have not completed interviews. Questions will be based on research context.',
        };
      }

      const briefing = discoveryBriefing;
      const themes = Array.isArray(briefing.discoveryThemes) ? briefing.discoveryThemes : [];
      const painPoints = Array.isArray(briefing.painPoints) ? briefing.painPoints : [];
      const aspirations = Array.isArray(briefing.aspirations) ? briefing.aspirations : [];
      const consensus = Array.isArray(briefing.consensusAreas) ? briefing.consensusAreas : [];
      const divergence = Array.isArray(briefing.divergenceAreas) ? briefing.divergenceAreas : [];
      const watchPoints = Array.isArray(briefing.watchPoints) ? briefing.watchPoints : [];

      const themesText = themes.length > 0
        ? themes.map((t: Record<string, unknown>) => `  \u2022 **${t.title}** (${t.domain || 'General'}, ${t.sentiment}) — ${t.frequency} mentions`).join('\n')
        : '  (none)';
      const painText = painPoints.length > 0
        ? painPoints.map((p: Record<string, unknown>) => `  \u2022 ${p.description} (${p.domain}, ${p.severity})`).join('\n')
        : '  (none)';
      const aspText = aspirations.length > 0
        ? aspirations.map((a: unknown) => `  \u2022 ${a}`).join('\n')
        : '  (none)';

      return {
        result: JSON.stringify({
          available: true,
          briefingSummary: briefing.briefingSummary || '',
          themes,
          painPoints,
          aspirations,
          consensusAreas: consensus,
          divergenceAreas: divergence,
          watchPoints,
          maturitySnapshot: briefing.maturitySnapshot || [],
        }),
        summary: `**Retrieved Discovery insights from participant interviews:**\n\n${briefing.briefingSummary ? `**Summary:** ${String(briefing.briefingSummary).substring(0, 300)}...\n\n` : ''}**Key Themes (${themes.length})**\n${themesText}\n\n**Pain Points (${painPoints.length})**\n${painText}\n\n**Aspirations (${aspirations.length})**\n${aspText}${consensus.length > 0 ? `\n\n**Consensus Areas:** ${consensus.slice(0, 3).join('; ')}` : ''}${divergence.length > 0 ? `\n\n**Divergence Areas:** ${divergence.slice(0, 3).map((d: Record<string, unknown>) => String(d.topic)).join('; ')}` : ''}${watchPoints.length > 0 ? `\n\n**Watch Points:** ${watchPoints.slice(0, 3).join('; ')}` : ''}`,
      };
    }

    case 'get_workshop_phases': {
      const trackContext = context.dreamTrack === 'DOMAIN'
        ? `This is a **Domain-focused** workshop targeting **${context.targetDomain || 'a specific business area'}**. Questions should be weighted toward this domain while still covering all relevant lenses.`
        : 'This is an **Enterprise-wide** assessment. Questions should cover all lenses equally.';

      return {
        result: JSON.stringify({
          dreamTrack: context.dreamTrack,
          targetDomain: context.targetDomain,
          trackGuidance: trackContext,
          phases: {
            REIMAGINE: {
              label: 'Reimagine',
              purpose: PHASE_GUIDANCE.REIMAGINE,
              lensOrder: PHASE_LENS_ORDER.REIMAGINE,
              questionCount: '5-8 questions',
              keyPrinciple: 'NO constraints. Pure vision. Dream big.',
            },
            CONSTRAINTS: {
              label: 'Constraints',
              purpose: PHASE_GUIDANCE.CONSTRAINTS,
              lensOrder: PHASE_LENS_ORDER.CONSTRAINTS,
              questionCount: '6-10 questions',
              keyPrinciple: 'Map what stands in the way. Right-to-left through lenses.',
            },
            DEFINE_APPROACH: {
              label: 'Define Approach',
              purpose: PHASE_GUIDANCE.DEFINE_APPROACH,
              lensOrder: PHASE_LENS_ORDER.DEFINE_APPROACH,
              questionCount: '6-10 questions',
              keyPrinciple: 'Build the practical path forward. Left-to-right through lenses.',
            },
          },
        }),
        summary: `**Workshop Phase Structure:**\n\n${trackContext}\n\n**Phase 1 — REIMAGINE** (Pure Vision)\nLens order: ${PHASE_LENS_ORDER.REIMAGINE.join(' \u2192 ')}\n${PHASE_GUIDANCE.REIMAGINE}\n\n**Phase 2 — CONSTRAINTS** (Map Limitations, Right-to-Left)\nLens order: ${PHASE_LENS_ORDER.CONSTRAINTS.join(' \u2192 ')}\n${PHASE_GUIDANCE.CONSTRAINTS}\n\n**Phase 3 — DEFINE APPROACH** (Build Solution, Left-to-Right)\nLens order: ${PHASE_LENS_ORDER.DEFINE_APPROACH.join(' \u2192 ')}\n${PHASE_GUIDANCE.DEFINE_APPROACH}`,
      };
    }

    case 'design_phase_questions': {
      const phase = String(args.phase || '') as WorkshopPhase;
      const questions = args.questions as Array<Record<string, unknown>>;

      if (!phase || !Array.isArray(questions)) {
        return {
          result: JSON.stringify({ error: 'Invalid phase or questions' }),
          summary: 'Invalid phase design request',
        };
      }

      // Build facilitation questions with starter sub-questions
      const facilitation: FacilitationQuestion[] = questions.map((q, i) => ({
        id: nanoid(8),
        phase,
        lens: (String(q.lens || 'General') as LensName | 'General' | null),
        text: String(q.text || ''),
        purpose: String(q.purpose || ''),
        grounding: String(q.grounding || ''),
        order: i + 1,
        isEdited: false,
        subQuestions: Array.isArray(q.subQuestions)
          ? q.subQuestions.map((sq: Record<string, unknown>) => ({
              id: nanoid(8),
              lens: String(sq.lens || 'General') as LensName | 'General',
              text: String(sq.text || ''),
              purpose: String(sq.purpose || ''),
            }))
          : [],
      }));

      designedPhases.set(phase, facilitation);

      // Build summary with full question listing
      const qLines = facilitation.map((q) => {
        return `  ${q.order}. **[${q.lens}]** "${q.text}"\n     _Purpose:_ ${q.purpose}\n     _Grounding:_ ${q.grounding}`;
      }).join('\n\n');

      const phaseLabel = phase === 'DEFINE_APPROACH' ? 'Define Approach' : phase.charAt(0) + phase.slice(1).toLowerCase();

      return {
        result: JSON.stringify({
          phase,
          questionsStored: facilitation.length,
          lensDistribution: facilitation.reduce((acc, q) => {
            const lens = q.lens || 'General';
            acc[lens] = (acc[lens] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        }),
        summary: `**Designed ${phaseLabel} phase** \u2014 ${facilitation.length} facilitation questions\n\n${qLines}`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

function buildQuestionSetSystemPrompt(context: PrepContext): string {
  const trackDesc = context.dreamTrack === 'DOMAIN'
    ? `The DREAM track is **Domain**, focused on **${context.targetDomain || 'a specific area'}**. Weight questions toward this domain while still covering all relevant lenses in each phase.`
    : 'The DREAM track is **Enterprise** \u2014 a full end-to-end assessment across the entire business.';

  return `You are the DREAM Workshop Question Set Agent. Your job is to design the
facilitation questions that will guide the live workshop session for
${context.clientName || 'the client'} (${context.industry || 'unknown industry'}).

${trackDesc}

CRITICAL CONTEXT:
- Discovery interviews have ALREADY been completed. Participants have already
  answered questions about their roles, pain points, aspirations, and maturity
  ratings. You have access to what they said via get_discovery_insights().
- These workshop facilitation questions are DIFFERENT from Discovery questions.
  Do NOT repeat Discovery interview questions.
- These questions guide a GROUP WORKSHOP SESSION with 8-15 participants in a room.
- The facilitator uses these questions to run each phase of the workshop.

THE THREE WORKSHOP PHASES:

1. REIMAGINE (Pure Vision)
   Lenses: People \u2192 Customer \u2192 Organisation ONLY
   Goal: Get participants to paint the ideal future WITHOUT any constraints.
   No technology, no budget, no regulation \u2014 just what "amazing" looks like.
   Key: Open, aspirational, creative questions. "If you could wave a magic wand..."

2. CONSTRAINTS (Map Limitations \u2014 Right-to-Left)
   Lenses: Regulation \u2192 Customer \u2192 Technology \u2192 Organisation \u2192 People
   Goal: Systematically identify what stands between today and the reimagined vision.
   Start with hard external constraints and work inward.
   Key: Specific, probing, referencing the vision they just created.

3. DEFINE APPROACH (Build Solution \u2014 Left-to-Right)
   Lenses: People \u2192 Organisation \u2192 Technology \u2192 Customer \u2192 Regulation
   Goal: Design the practical path forward that bridges reality to vision.
   Key: Actionable, ownership-focused, measurable. "Who owns this? What's step one?"

YOUR APPROACH:
1. First, get the research context (company, industry, challenges).
2. Get Discovery insights if available (what participants already told us).
3. Get the workshop phase structure (lens order, purpose).
4. For each phase in order (REIMAGINE, CONSTRAINTS, DEFINE_APPROACH):
   - Design 5-8 facilitation questions per phase
   - Each question should follow the lens order for that phase
   - Questions MUST reference specific company context where possible
   - Questions should BUILD ON Discovery insights, not repeat them
   - If Discovery revealed a pain point, ask "how does this play into the
     constraints?" \u2014 don't ask "what are your pain points?" again
   - For EACH main question, generate 2-3 starter sub-questions. These are
     specific angles or probes that immediately trigger dialogue when the
     facilitator activates the main question. Sub-questions should:
     * Each target a specific lens (People, Organisation, Customer, etc.)
     * Be directly scoped to the parent main question's topic
     * Reference concrete research/Discovery findings where possible
     * Give the room something tangible to discuss immediately
     * CRITICAL — match the phase tone:
       REIMAGINE subs must be purely aspirational, creative, zero-constraint.
         Ask "describe the ideal...", "what does perfect look like...",
         "imagine there are no barriers — what becomes possible?"
         NEVER mention limitations, barriers, constraints, or changes needed.
         The creative lens with NO friction is essential.
       CONSTRAINTS subs should be specific, probing, grounded in the vision.
         Ask "what stands in the way?", "what limitations exist?"
       DEFINE_APPROACH subs should be actionable and ownership-focused.
         Ask "who owns this?", "what's step one?", "how do we prove it?"
5. Commit the final question set with a design rationale.

QUESTION DESIGN PRINCIPLES:
- Questions are for a GROUP discussion, not individual interviews
- CRITICAL: Every question MUST be deeply specific to ${context.clientName || 'the client'}.
  Do NOT write generic template questions with a company name inserted.
  Instead, reference actual challenges, industry dynamics, and Discovery insights.
- For REIMAGINE: Open-ended, aspirational, no mention of limitations
- For CONSTRAINTS: Specific, grounded in the vision they just created
- For DEFINE_APPROACH: Actionable, ownership-focused, outcome-oriented
- Include a mix of lens-specific and cross-cutting questions
- Each question should have a clear purpose and connection to known data

EXAMPLES OF GOOD vs BAD QUESTIONS:

BAD (generic shell):
  "What does the ideal customer experience look like?"
  "What technology constraints exist?"

GOOD (context-specific, grounded in research/Discovery):
  "In Discovery, 8 of 12 participants flagged Clubcard integration as a pain
   point. In the reimagined future, what does the perfect Clubcard experience
   look like for a customer walking into a Tesco Extra?"
  "Your industry is seeing rapid adoption of checkout-free retail — Sainsbury's
   and Amazon Fresh are investing heavily. What technology constraints prevent
   Tesco from moving in this direction?"

The key difference: GOOD questions reference specific findings, name real
industry dynamics, and mention actual pain points from Discovery. They give
the facilitator CONTEXT to work with, not just a blank prompt.

When communicating your findings, speak naturally as a colleague would.
Be professional but warm. Explain your reasoning clearly and acknowledge
what you've been asked to do.`;
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export async function runQuestionSetAgent(
  context: PrepContext,
  research: WorkshopPrepResearch | null,
  onConversation?: AgentConversationCallback,
  discoveryBriefing?: Record<string, unknown> | null,
): Promise<WorkshopQuestionSet> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured \u2014 cannot run Question Set Agent');
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildQuestionSetSystemPrompt(context);
  const startMs = Date.now();

  // Track designed phases as they come in
  const designedPhases = new Map<WorkshopPhase, FacilitationQuestion[]>();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Please design a tailored set of workshop facilitation questions for ${context.clientName || 'this client'}. These questions will guide the facilitator through REIMAGINE, CONSTRAINTS, and DEFINE APPROACH. Start by reviewing the research context and Discovery insights, then the phase structure, then design questions for each phase in order.`,
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
        temperature: 0.4,
        messages,
        tools: QUESTION_SET_TOOLS,
        tool_choice: toolChoice,
        parallel_tool_calls: true,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      // Emit thinking/commentary
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

          // Build summary of all designed phases
          const phasesSummary: string[] = [];
          let totalQuestions = 0;
          for (const [phase, questions] of designedPhases.entries()) {
            totalQuestions += questions.length;
            const phaseLabel = phase === 'DEFINE_APPROACH' ? 'Define Approach' : phase.charAt(0) + phase.slice(1).toLowerCase();
            phasesSummary.push(`**${phaseLabel}:** ${questions.length} questions`);
            for (const q of questions) {
              phasesSummary.push(`  ${q.order}. [${q.lens}] "${q.text}"`);
            }
          }

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'question-set-agent',
            to: 'prep-orchestrator',
            message: `I've completed the workshop facilitation question set. **${totalQuestions} questions** across 3 phases.\n\n**Design Rationale**\n${String(fnArgs.designRationale || '')}\n\n**Questions by Phase**\n${phasesSummary.join('\n')}`,
            type: 'proposal',
            metadata: {
              toolsUsed: ['get_research_context', 'get_discovery_insights', 'get_workshop_phases', 'design_phase_questions'],
            },
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: 'committed' }),
          });
        } else {
          const toolResult = executeQuestionSetTool(
            fnName, fnArgs, context, research, discoveryBriefing || null, designedPhases,
          );

          // Emit conversation entries for substantive tool results
          if (fnName === 'design_phase_questions') {
            onConversation?.({
              timestampMs: Date.now(),
              agent: 'question-set-agent',
              to: 'prep-orchestrator',
              message: toolResult.summary,
              type: 'request',
              metadata: { toolsUsed: [fnName] },
            });
          } else if (fnName === 'get_research_context' || fnName === 'get_discovery_insights' || fnName === 'get_workshop_phases') {
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

          console.log(`[Question Set Agent] Tool ${fnName}: ${toolResult.summary.substring(0, 120)}`);
        }
      }

      if (committed) {
        const elapsed = Date.now() - startMs;
        console.log(`[Question Set Agent] Committed after ${iteration + 1} iterations, ${elapsed}ms`);
        return buildWorkshopQuestionSet(
          designedPhases,
          String(
            (messages.find(m => m.role === 'tool' && typeof m.content === 'string' && m.content.includes('committed'))
              ? fnArgs_extract(messages) : '') || 'Questions designed for workshop facilitation.'
          ),
        );
      }
    }

    // Loop ended without commit — build from whatever phases were designed
    console.log('[Question Set Agent] Loop ended without commit \u2014 building from designed phases');
    return buildWorkshopQuestionSet(designedPhases, 'Workshop facilitation questions designed based on company context.');
  } catch (error) {
    console.error('[Question Set Agent] Failed:', error instanceof Error ? error.message : error);

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'question-set-agent',
      to: 'prep-orchestrator',
      message: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Falling back to generic workshop facilitation questions.`,
      type: 'info',
    });

    return fallbackQuestionSet(context);
  }
}

// Helper to extract designRationale from committed message
function fnArgs_extract(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): string {
  // Look through messages for the commit_question_set tool call arguments
  for (const msg of messages) {
    if (msg.role === 'assistant' && 'tool_calls' in msg && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if (tc.type === 'function' && tc.function.name === 'commit_question_set') {
          try {
            const args = JSON.parse(tc.function.arguments);
            return String(args.designRationale || '');
          } catch { /* ignore */ }
        }
      }
    }
  }
  return '';
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function buildWorkshopQuestionSet(
  designedPhases: Map<WorkshopPhase, FacilitationQuestion[]>,
  designRationale: string,
): WorkshopQuestionSet {
  const allPhases: WorkshopPhase[] = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];

  const phases = {} as WorkshopQuestionSet['phases'];

  for (const phase of allPhases) {
    const designed = designedPhases.get(phase);
    const phaseLabel = phase === 'DEFINE_APPROACH' ? 'Define Approach' : phase.charAt(0) + phase.slice(1).toLowerCase();

    phases[phase] = {
      label: phaseLabel,
      description: PHASE_GUIDANCE[phase],
      lensOrder: PHASE_LENS_ORDER[phase],
      questions: designed || generateFallbackPhaseQuestions(phase),
    };
  }

  return {
    phases,
    designRationale,
    generatedAtMs: Date.now(),
  };
}

function generateFallbackPhaseQuestions(phase: WorkshopPhase): FacilitationQuestion[] {
  const fallbacks: Record<WorkshopPhase, Array<{ lens: string; text: string; purpose: string }>> = {
    REIMAGINE: [
      { lens: 'General', text: 'If we could design the ideal future state for this business with no constraints at all, what does success look like in 3 years?', purpose: 'Opens the vision conversation with a broad, unconstrained prompt' },
      { lens: 'People', text: 'In this ideal future, how are the people in the organisation working? What does their day look like?', purpose: 'Explores the human dimension of the vision' },
      { lens: 'Customer', text: 'What does the customer experience look like in this reimagined future? Walk me through a perfect interaction.', purpose: 'Gets specific about customer outcomes' },
      { lens: 'Organisation', text: 'How does the organisation need to be structured to deliver this vision? What changes?', purpose: 'Explores organisational design implications' },
      { lens: 'People', text: 'Who are the key actors and stakeholders that make this vision real? What roles matter most?', purpose: 'Identifies critical stakeholders and roles' },
      { lens: 'General', text: 'What are the top 3 measurable business outcomes that tell us we\'ve succeeded?', purpose: 'Anchors the vision in concrete outcomes' },
    ],
    CONSTRAINTS: [
      { lens: 'Regulation', text: 'What regulatory, compliance, or legal requirements must we work within? Which are non-negotiable?', purpose: 'Starts with hard external constraints' },
      { lens: 'Customer', text: 'What customer-side constraints exist? Budget limitations, adoption barriers, behavioural challenges?', purpose: 'Identifies customer-facing limitations' },
      { lens: 'Technology', text: 'What technology constraints are we dealing with? Legacy systems, integration challenges, data limitations?', purpose: 'Maps technical debt and platform constraints' },
      { lens: 'Organisation', text: 'What organisational constraints exist? Budget, structure, politics, competing priorities?', purpose: 'Surfaces internal organisational blockers' },
      { lens: 'People', text: 'What people constraints apply? Skills gaps, capacity issues, change readiness, cultural resistance?', purpose: 'Identifies human factors that constrain progress' },
      { lens: 'General', text: 'Looking at all these constraints, which are absolute blockers versus conditions we can manage or work around?', purpose: 'Prioritises constraints by severity' },
      { lens: 'General', text: 'Where does the vision from our Reimagine session most conflict with the reality of these constraints?', purpose: 'Connects constraints back to the vision' },
    ],
    DEFINE_APPROACH: [
      { lens: 'People', text: 'What do the people need to make this work? Training, new roles, different ways of working?', purpose: 'Starts with human needs and capabilities' },
      { lens: 'Organisation', text: 'How does the organisation need to change? New processes, governance structures, ways of measuring success?', purpose: 'Designs organisational enablers' },
      { lens: 'Technology', text: 'What technology enables this approach? What do we build, buy, or integrate?', purpose: 'Identifies technology requirements' },
      { lens: 'Customer', text: 'How do we prove the customer outcome? What does the customer journey look like in practice?', purpose: 'Validates the customer experience design' },
      { lens: 'Regulation', text: 'How do we satisfy the regulatory requirements we identified while still delivering the vision?', purpose: 'Ensures compliance is designed in' },
      { lens: 'General', text: 'Who owns each workstream? What are the immediate next steps and quick wins?', purpose: 'Drives toward actionable ownership' },
      { lens: 'General', text: 'What does the 90-day plan look like? What can we start tomorrow?', purpose: 'Creates urgency and near-term commitments' },
    ],
  };

  return (fallbacks[phase] || []).map((q, i) => ({
    id: nanoid(8),
    phase,
    lens: q.lens as LensName | 'General' | null,
    text: q.text,
    purpose: q.purpose,
    grounding: 'Generic facilitation question — not tailored to specific client context.',
    order: i + 1,
    isEdited: false,
    subQuestions: [],
  }));
}

function fallbackQuestionSet(context: PrepContext): WorkshopQuestionSet {
  return buildWorkshopQuestionSet(new Map(), `Generic workshop facilitation questions for ${context.clientName || 'the client'}. These have not been tailored to specific company context or Discovery insights — the facilitator should review and modify as needed.`);
}
