/**
 * DREAM Discovery Question Agent -- Per-Lens Interview Questions
 *
 * A GPT-4o-mini tool-calling agent that generates tailored Discovery
 * interview questions for each lens in a workshop's domain pack.
 *
 * The agent uses:
 *   - Domain pack templates (lenses, question templates)
 *   - Company research (from Research Agent)
 *   - Workshop context (purpose, outcomes, client, industry)
 *
 * For each lens the agent produces:
 *   1 maturity rating question (5-level scale)
 *   3-4 exploratory questions (strengths, gaps, friction, future, etc.)
 *
 * Questions are grounded in research findings and client context,
 * not generic templates.
 */

import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import type {
  WorkshopPrepResearch,
  PrepContext,
  LensName,
  LensSource,
} from './agent-types';
import type { DomainPack } from '@/lib/domain-packs/registry';
import { getDomainPack } from '@/lib/domain-packs/registry';
import type { WorkshopBlueprint } from '@/lib/workshop/blueprint';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';

// ── Types ────────────────────────────────────────────────────

export interface DiscoveryQuestion {
  id: string;
  text: string;
  tag: string;
  maturityScale?: string[];
  purpose: string;
  isEdited: boolean;
}

export interface DiscoveryLensQuestions {
  key: string;
  label: string;
  questions: DiscoveryQuestion[];
}

export interface DiscoveryQuestionSet {
  lenses: DiscoveryLensQuestions[];
  generatedAtMs: number;
  agentRationale: string;
  facilitatorDirection?: string | null;
}

export type DiscoveryQuestionAgentOptions = {
  direction?: string | null;
  blueprint?: WorkshopBlueprint | null;
};

// ── Constants ────────────────────────────────────────────────

const MAX_ITERATIONS = 12;
const LOOP_TIMEOUT_MS = 60_000;
const MODEL = 'gpt-4o-mini';

const VALID_TAGS = [
  'triple_rating',
  'strengths',
  'gaps',
  'friction',
  'future',
  'working',
  'pain_points',
  'support',
  'constraint',
  'context',
] as const;

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const DISCOVERY_QUESTION_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_domain_pack_context',
      description:
        'Retrieve the domain pack configuration including the Discovery lenses and question templates. This gives you the starting templates for each lens.',
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
        'Retrieve the Research Agent\'s findings about the client company -- company overview, industry context, challenges, competitive landscape, and domain insights.',
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
      name: 'get_workshop_context',
      description:
        'Retrieve the workshop purpose, desired outcomes, client name, industry, and business context.',
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
      name: 'design_lens_questions',
      description:
        'Propose Discovery interview questions for a specific lens. Call this once per lens with 4-5 tailored questions. The first question MUST be a maturity rating question with a 5-level scale.',
      parameters: {
        type: 'object',
        properties: {
          lens: {
            type: 'string',
            description: 'The lens key (e.g. "People", "Organisation", "Customer", "Technology", "Regulation").',
          },
          label: {
            type: 'string',
            description: 'The human-readable label for this lens.',
          },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'The interview question text.',
                },
                tag: {
                  type: 'string',
                  enum: [
                    'triple_rating',
                    'strengths',
                    'gaps',
                    'friction',
                    'future',
                    'working',
                    'pain_points',
                    'support',
                    'constraint',
                    'context',
                  ],
                  description: 'The question category tag.',
                },
                maturityScale: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'For triple_rating questions only: 5 maturity levels from lowest (1) to highest (5). Each level is a short description.',
                },
                purpose: {
                  type: 'string',
                  description: 'Why this question matters -- what insight it aims to surface.',
                },
              },
              required: ['text', 'tag', 'purpose'],
            },
            description: 'The Discovery interview questions for this lens (4-5 questions).',
          },
        },
        required: ['lens', 'label', 'questions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'commit_discovery_questions',
      description:
        'Finalise the complete Discovery question set. Call this after designing questions for ALL lenses. Include a rationale explaining the question strategy.',
      parameters: {
        type: 'object',
        properties: {
          rationale: {
            type: 'string',
            description:
              'A paragraph explaining the overall Discovery question strategy -- how questions are grounded in research, why certain topics are emphasised, and how they will surface the right insights from participants.',
          },
        },
        required: ['rationale'],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

function executeDiscoveryTool(
  toolName: string,
  args: Record<string, unknown>,
  context: PrepContext,
  research: WorkshopPrepResearch | null,
  domainPack: DomainPack | null,
  designedLenses: Map<string, DiscoveryLensQuestions>,
): { result: string; summary: string } {
  switch (toolName) {
    case 'get_domain_pack_context': {
      if (!domainPack) {
        return {
          result: JSON.stringify({
            available: false,
            note: 'No domain pack configured. Use the standard 5 DREAM lenses: People, Organisation, Customer, Technology, Regulation.',
            defaultLenses: ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'],
          }),
          summary: '**Domain pack:** Not configured. Using standard DREAM lenses.',
        };
      }

      const templatesByLens: Record<string, string[]> = {};
      for (const t of domainPack.questionTemplates) {
        if (!templatesByLens[t.lens]) templatesByLens[t.lens] = [];
        templatesByLens[t.lens].push(t.text);
      }

      const lensLines = domainPack.lenses.map((l) => {
        const templates = templatesByLens[l] || [];
        return `  - ${l}: ${templates.length} template(s)${templates.length > 0 ? '\n' + templates.map(t => `      * "${t}"`).join('\n') : ''}`;
      }).join('\n');

      return {
        result: JSON.stringify({
          available: true,
          packKey: domainPack.key,
          packLabel: domainPack.label,
          category: domainPack.category,
          lenses: domainPack.lenses,
          questionTemplates: domainPack.questionTemplates.map(t => ({
            lens: t.lens,
            text: t.text,
            purpose: t.purpose,
            captureTypes: t.captureTypes,
          })),
          actorTaxonomy: domainPack.actorTaxonomy.map(a => ({
            key: a.key,
            label: a.label,
            description: a.description,
          })),
          metricReferences: domainPack.metricReferences.map(m => ({
            key: m.key,
            label: m.label,
            unit: m.unit,
            description: m.description,
          })),
        }),
        summary: `**Domain pack: ${domainPack.label}** (${domainPack.category})\n\n**Lenses:**\n${lensLines}\n\n**Actor Taxonomy:** ${domainPack.actorTaxonomy.map(a => a.label).join(', ')}\n**Metrics:** ${domainPack.metricReferences.map(m => m.label).join(', ')}`,
      };
    }

    case 'get_research_context': {
      if (!research) {
        return {
          result: JSON.stringify({
            available: false,
            note: 'No research available. Generate questions based on general industry knowledge and the domain pack templates.',
          }),
          summary: '**Research context:** Not available -- will use general industry knowledge.',
        };
      }

      const challengesList = research.keyPublicChallenges.length > 0
        ? research.keyPublicChallenges.map((c) => `  - ${c}`).join('\n')
        : '  (none identified)';
      const devsList = research.recentDevelopments.length > 0
        ? research.recentDevelopments.map((d) => `  - ${d}`).join('\n')
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
          journeyStages: research.journeyStages || null,
          industryDimensions: research.industryDimensions?.map(d => ({
            name: d.name,
            description: d.description,
          })) || null,
        }),
        summary: `**Retrieved research context:**\n\n**Company:** ${research.companyOverview}\n\n**Industry:** ${research.industryContext}\n\n**Key Challenges**\n${challengesList}\n\n**Recent Developments**\n${devsList}${research.domainInsights ? `\n\n**Domain Insights:** ${research.domainInsights}` : ''}`,
      };
    }

    case 'get_workshop_context': {
      const bp = context.blueprint;
      return {
        result: JSON.stringify({
          clientName: context.clientName || 'Unknown client',
          industry: context.industry || 'Unknown industry',
          workshopPurpose: context.workshopPurpose || null,
          desiredOutcomes: context.desiredOutcomes || null,
          dreamTrack: context.dreamTrack || null,
          targetDomain: context.targetDomain || null,
          engagementType: context.engagementType || null,
          domainPack: context.domainPack || null,
          actorTaxonomy: bp?.actorTaxonomy?.map(a => ({ label: a.label, description: a.description })) || null,
          blueprintLenses: bp?.lenses?.map(l => ({ name: l.name, description: l.description })) || null,
        }),
        summary: `**Workshop context:**\n\n**Client:** ${context.clientName || 'Unknown'} (${context.industry || 'Unknown industry'})\n**Track:** ${context.dreamTrack || 'Not set'}${context.targetDomain ? ` -- ${context.targetDomain}` : ''}${context.workshopPurpose ? `\n**Purpose:** ${context.workshopPurpose}` : ''}${context.desiredOutcomes ? `\n**Desired Outcomes:** ${context.desiredOutcomes}` : ''}${bp?.actorTaxonomy?.length ? `\n**Audience roles:** ${bp.actorTaxonomy.map(a => a.label).join(', ')}` : ''}`,
      };
    }

    case 'design_lens_questions': {
      const lens = String(args.lens || '');
      const label = String(args.label || lens);
      const questions = args.questions as Array<Record<string, unknown>>;

      if (!lens || !Array.isArray(questions)) {
        return {
          result: JSON.stringify({ error: 'Invalid lens or questions' }),
          summary: 'Invalid lens design request',
        };
      }

      // Build typed Discovery questions
      const typed: DiscoveryQuestion[] = questions.map((q) => {
        const tag = String(q.tag || 'context');
        const validTag = VALID_TAGS.includes(tag as typeof VALID_TAGS[number]) ? tag : 'context';

        const dq: DiscoveryQuestion = {
          id: nanoid(8),
          text: String(q.text || ''),
          tag: validTag,
          purpose: String(q.purpose || ''),
          isEdited: false,
        };

        if (validTag === 'triple_rating' && Array.isArray(q.maturityScale)) {
          dq.maturityScale = (q.maturityScale as unknown[]).map(s => String(s));
        }

        return dq;
      });

      const lensQuestions: DiscoveryLensQuestions = {
        key: lens,
        label,
        questions: typed,
      };

      designedLenses.set(lens, lensQuestions);

      const qLines = typed.map((q, i) => {
        const scaleNote = q.maturityScale ? ` (5-level scale)` : '';
        return `  ${i + 1}. [${q.tag}${scaleNote}] "${q.text}"\n     _Purpose:_ ${q.purpose}`;
      }).join('\n\n');

      return {
        result: JSON.stringify({
          lens,
          questionsStored: typed.length,
          tagDistribution: typed.reduce((acc, q) => {
            acc[q.tag] = (acc[q.tag] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        }),
        summary: `**Designed ${label} lens** -- ${typed.length} Discovery questions\n\n${qLines}`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

function buildDiscoverySystemPrompt(
  context: PrepContext,
  promptOptions?: { blueprint?: WorkshopBlueprint | null; direction?: string | null },
): string {
  const bp = promptOptions?.blueprint;
  const direction = promptOptions?.direction;

  // Build facilitator direction block (highest priority)
  const directionBlock = direction
    ? `\nFACILITATOR DIRECTION (HIGHEST PRIORITY -- FOLLOW THIS ABOVE ALL ELSE):
${direction}\n`
    : '';

  // Build audience awareness block from blueprint actor taxonomy
  const actors = bp?.actorTaxonomy;
  const actorBlock = actors?.length
    ? `\nAUDIENCE -- WHO WILL ANSWER THESE QUESTIONS:
The following roles will be interviewed. You MUST pitch every question at a level
these people can meaningfully answer from their own daily experience:
${actors.map(a => `  - ${a.label}: ${a.description}`).join('\n')}

LITMUS TEST RULE: For every question ask yourself -- could a ${actors[0]?.label || 'frontline worker'}
answer this honestly from their own work experience? If not, rewrite it until they can.
Questions must be broad enough to challenge, deep enough to surface real insight,
but NOT so technical or strategic that frontline staff cannot answer.
Do NOT ask about board-level strategy, ESG policy, or corporate governance unless
you know the audience includes senior leaders.\n`
    : '';

  return `You are the DREAM Discovery Question Agent. Your job is to generate tailored
Discovery interview questions for ${context.clientName || 'the client'} (${context.industry || 'unknown industry'}).

These questions will be used in one-on-one Discovery interviews with participants
BEFORE the live workshop session. Each interview explores the participant's
perspective through multiple lenses.

${context.workshopPurpose ? `WORKSHOP PURPOSE (WHY WE ARE HERE):\n${context.workshopPurpose}\n` : ''}${context.desiredOutcomes ? `DESIRED OUTCOMES (WHAT WE MUST WALK AWAY WITH):\n${context.desiredOutcomes}\n` : ''}${context.workshopPurpose || context.desiredOutcomes ? `THIS IS THE MOST IMPORTANT INPUT. Every Discovery question you design MUST serve this purpose and drive toward surfacing the insights needed to achieve these outcomes.\n` : ''}${directionBlock}${actorBlock}
YOUR APPROACH:
1. First, get the domain pack context (tool 1) to see the lenses and question templates.
2. Get the research context (tool 2) to understand the company, industry, and challenges.
3. Get the workshop context (tool 3) for purpose, outcomes, and business context.
4. For EACH lens, call design_lens_questions with 4-5 questions:
   - Question 1 MUST be a maturity rating question with tag "triple_rating" and a
     maturityScale array of exactly 5 levels (from lowest maturity to highest).
     The scale should be specific to the lens and client context, not generic.
     *** THIS QUESTION MUST EXPLICITLY ASK ALL THREE OF THE FOLLOWING ***
     (1) WHERE ARE YOU NOW?     — current maturity today
     (2) WHERE DO YOU WANT TO BE? — target maturity
     (3) WHAT IF NOTHING CHANGES? — projected maturity if no action is taken
     Combine all three into a single question. Example:
     "On a scale of 1–5, where is [Client] on [Lens] TODAY? Where do you WANT to be?
      And where will you realistically END UP if nothing changes?"
     NEVER ask only one or two of these. The spider diagram requires all three ratings.
     If you omit target or projected, those values will be fabricated in the report.
   - Questions 2-5 should be exploratory questions with tags from:
     strengths, gaps, friction, future, working, pain_points, support, constraint, context
   - Use the domain pack templates as a STARTING POINT but REFINE them based on:
     * The specific client and industry (reference by name)
     * Research findings (company challenges, market landscape, competitors)
     * Workshop purpose and desired outcomes
     * The AUDIENCE -- what these people actually know and experience day to day
   - Questions should feel tailored to this specific client, not generic
5. After all lenses are designed, call commit_discovery_questions with a rationale.

QUESTION DESIGN PRINCIPLES:
- These are for ONE-ON-ONE interviews, not group sessions
- Questions must be answerable by the people who will sit in the interview chair.
  A contact centre agent cannot speak to ESG strategy or board-level governance.
  A team leader can speak to daily operational friction and team dynamics.
  Pitch every question at the audience's level of knowledge and experience.
- MANDATORY: The maturity rating question MUST ask current state, target state,
  AND projected state (what if nothing changes) — all three in one question.
  Missing any one of these makes the spider diagram unreliable and forces the
  summary to fabricate answers.
- Exploratory questions should surface specific insights about the client's reality
- Reference actual industry dynamics, company challenges, and competitor landscape
- Questions should be open-ended and conversational, not yes/no
- Avoid jargon unless it is specific to the client's industry

MATURITY SCALE EXAMPLES:
For a People lens in a Contact Centre:
  Level 1: "Reactive -- high turnover, minimal training, no career paths"
  Level 2: "Basic -- some onboarding, ad-hoc coaching, limited development"
  Level 3: "Structured -- formal training programme, regular reviews, defined paths"
  Level 4: "Advanced -- data-driven development, proactive retention, strong culture"
  Level 5: "Leading -- industry benchmark for talent, continuous learning, high engagement"

The scale should always be specific to the lens AND the client's domain.

EXAMPLES OF GOOD vs BAD QUESTIONS:

BAD (too strategic for frontline staff):
  "What support do you need from leadership to advance sustainability initiatives?"
  "How would you rate your ESG compliance maturity?"

BAD (generic shell):
  "How would you rate your technology maturity?"
  "What are your biggest people challenges?"

GOOD (context-specific, audience-appropriate, grounded in research):
  "Your competitors are investing heavily in AI-powered routing -- on a scale of
   1 to 5, where would you place your contact centre's technology capability today,
   where do you want it in 2 years, and where do you realistically think it will be?"
  "We know attrition in UK contact centres averages 26% -- what is driving your
   best agents to leave, and what would make them stay?"
  "When a customer calls with a complex issue, what tools or systems help you most,
   and where do you find yourself working around the technology?"

The key difference: GOOD questions reference specific findings, name real
industry dynamics, give participants concrete context to respond to, and
are answerable from the participant's own experience.

When communicating your findings, speak naturally as a colleague would.
Be professional but warm. Explain your reasoning clearly.`;
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export async function runDiscoveryQuestionAgent(
  workshopId: string,
  onConversationEntry?: (entry: { role: string; content: string }) => void,
  options?: DiscoveryQuestionAgentOptions,
): Promise<DiscoveryQuestionSet> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured -- cannot run Discovery Question Agent');
  }

  // ── Load workshop data ──────────────────────────────────────
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true,
      clientName: true,
      industry: true,
      companyWebsite: true,
      dreamTrack: true,
      targetDomain: true,
      prepResearch: true,
      domainPack: true,
      domainPackConfig: true,
      engagementType: true,
      businessContext: true,
      description: true,
      blueprint: true,
    },
  });

  if (!workshop) {
    throw new Error(`Workshop ${workshopId} not found`);
  }

  // Load blueprint: prefer passed-in option, fall back to DB
  const blueprint = options?.blueprint ?? readBlueprintFromJson(workshop.blueprint);

  // Build PrepContext from workshop data
  const context: PrepContext = {
    workshopId,
    workshopPurpose: workshop.description || null,
    desiredOutcomes: (workshop as Record<string, unknown>).desiredOutcomes as string | null ?? null,
    clientName: workshop.clientName || null,
    industry: workshop.industry || null,
    companyWebsite: workshop.companyWebsite || null,
    dreamTrack: workshop.dreamTrack as 'ENTERPRISE' | 'DOMAIN' | null,
    targetDomain: workshop.targetDomain || null,
    engagementType: workshop.engagementType || null,
    domainPack: workshop.domainPack || null,
    domainPackConfig: workshop.domainPackConfig as Record<string, unknown> | null,
    blueprint,
  };

  const research = workshop.prepResearch as WorkshopPrepResearch | null;
  const domainPack = workshop.domainPack ? getDomainPack(workshop.domainPack) : null;

  // Wrap callback to match AgentConversationCallback style
  const emitConversation = (message: string, type: string = 'info') => {
    onConversationEntry?.({ role: type, content: message });
  };

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildDiscoverySystemPrompt(context, {
    blueprint,
    direction: options?.direction,
  });
  const startMs = Date.now();

  // Track designed lenses as they come in
  const designedLenses = new Map<string, DiscoveryLensQuestions>();

  // Determine lenses: blueprint (curated) > domain pack > generic fallback
  const blueprintLensNames = blueprint?.lenses?.length
    ? blueprint.lenses.map(l => l.name) : null;
  const lensNames: string[] = blueprintLensNames
    ?? (domainPack?.lenses || ['People', 'Organisation', 'Customer', 'Technology', 'Regulation']);
  const lensSource: LensSource = blueprintLensNames
    ? 'blueprint' : domainPack?.lenses ? 'domain_pack' : 'generic_fallback';
  const lensListStr = lensNames.join(', ');

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Please design tailored Discovery interview questions for ${context.clientName || 'this client'}. The lenses to cover are: ${lensListStr}. Start by reviewing the domain pack templates, research context, and workshop context, then design 4-5 questions per lens.`,
    },
  ];

  // Track the commit rationale for extraction
  let commitRationale = '';

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) {
        console.log(`[Discovery Question Agent] Timeout after ${iteration} iterations`);
        break;
      }

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'commit_discovery_questions' } }
        : 'auto';

      console.log(`[Discovery Question Agent] Iteration ${iteration}${isLastIteration ? ' (forced commit)' : ''}`);

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        messages,
        tools: DISCOVERY_QUESTION_TOOLS,
        tool_choice: toolChoice,
        parallel_tool_calls: true,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      // Emit thinking/commentary
      if (assistantMessage.content) {
        const thinking = assistantMessage.content.trim();
        if (thinking.length > 20) {
          emitConversation(thinking, 'info');
        }
      }

      // No tool calls -- done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        break;
      }

      // Process tool calls
      let committed = false;

      for (const toolCall of assistantMessage.tool_calls as any[]) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;

        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
        }

        if (fnName === 'commit_discovery_questions') {
          committed = true;
          commitRationale = String(fnArgs.rationale || '');

          // Build summary of all designed lenses
          const lensSummary: string[] = [];
          let totalQuestions = 0;
          for (const [, lensData] of designedLenses.entries()) {
            totalQuestions += lensData.questions.length;
            lensSummary.push(`**${lensData.label}:** ${lensData.questions.length} questions`);
            for (const q of lensData.questions) {
              const scaleNote = q.maturityScale ? ' (maturity scale)' : '';
              lensSummary.push(`  - [${q.tag}${scaleNote}] "${q.text}"`);
            }
          }

          emitConversation(
            `I've completed the Discovery question set. **${totalQuestions} questions** across ${designedLenses.size} lenses (lensSource: ${lensSource}).\n\n**Strategy**\n${commitRationale}\n\n**Questions by Lens**\n${lensSummary.join('\n')}`,
            'proposal',
          );

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: 'committed' }),
          });
        } else {
          const toolResult = executeDiscoveryTool(
            fnName, fnArgs, context, research, domainPack, designedLenses,
          );

          // Emit conversation entries for tool results
          if (fnName === 'design_lens_questions') {
            emitConversation(toolResult.summary, 'request');
          } else if (fnName === 'get_domain_pack_context' || fnName === 'get_research_context' || fnName === 'get_workshop_context') {
            emitConversation(toolResult.summary, 'request');
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult.result,
          });

          console.log(`[Discovery Question Agent] Tool ${fnName}: ${toolResult.summary.substring(0, 120)}`);
        }
      }

      if (committed) {
        const elapsed = Date.now() - startMs;
        console.log(`[Discovery Question Agent] Committed after ${iteration + 1} iterations, ${elapsed}ms`);

        const questionSet = buildDiscoveryQuestionSet(designedLenses, commitRationale, options?.direction);

        // Store result on the workshop
        await storeDiscoveryQuestions(workshopId, questionSet);

        return questionSet;
      }
    }

    // Loop ended without commit -- build from whatever lenses were designed
    console.log('[Discovery Question Agent] Loop ended without commit -- building from designed lenses');
    const questionSet = buildDiscoveryQuestionSet(
      designedLenses,
      'Discovery interview questions designed based on domain pack and company context.',
      options?.direction,
    );

    await storeDiscoveryQuestions(workshopId, questionSet);

    return questionSet;
  } catch (error) {
    console.error('[Discovery Question Agent] Failed:', error instanceof Error ? error.message : error);

    emitConversation(
      `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Falling back to domain pack template questions.`,
      'info',
    );

    const fallback = buildFallbackQuestionSet(domainPack, context, research, blueprint);

    try {
      await storeDiscoveryQuestions(workshopId, fallback);
    } catch (storeErr) {
      console.error('[Discovery Question Agent] Failed to store fallback:', storeErr instanceof Error ? storeErr.message : storeErr);
    }

    return fallback;
  }
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function buildDiscoveryQuestionSet(
  designedLenses: Map<string, DiscoveryLensQuestions>,
  rationale: string,
  direction?: string | null,
): DiscoveryQuestionSet {
  const lenses: DiscoveryLensQuestions[] = [];

  for (const [, lensData] of designedLenses.entries()) {
    lenses.push(lensData);
  }

  return {
    lenses,
    generatedAtMs: Date.now(),
    agentRationale: rationale,
    facilitatorDirection: direction || null,
  };
}

/**
 * Store the Discovery question set on the workshop's dedicated discoveryQuestions field.
 */
async function storeDiscoveryQuestions(
  workshopId: string,
  questionSet: DiscoveryQuestionSet,
): Promise<void> {
  try {
    await prisma.workshop.update({
      where: { id: workshopId },
      data: {
        discoveryQuestions: JSON.parse(JSON.stringify(questionSet)) as any,
      },
    });

    console.log(`[Discovery Question Agent] Stored ${questionSet.lenses.length} lenses of questions for workshop ${workshopId}`);
  } catch (err) {
    console.error('[Discovery Question Agent] Failed to store questions:', err instanceof Error ? err.message : err);
    throw err;
  }
}

/**
 * Build a fallback question set from domain pack templates when the agent fails.
 * Generates generic maturity + exploratory questions per lens.
 * Blueprint lenses take priority, then domain pack, then generic fallback.
 */
function buildFallbackQuestionSet(
  domainPack: DomainPack | null,
  context: PrepContext,
  research?: WorkshopPrepResearch | null,
  blueprint?: WorkshopBlueprint | null,
): DiscoveryQuestionSet {
  // Blueprint lenses (curated) > domain pack > generic fallback
  const blueprintLensNames = blueprint?.lenses?.length
    ? blueprint.lenses.map(l => l.name) : null;
  const lensNames: string[] = blueprintLensNames
    ?? (domainPack?.lenses || ['People', 'Organisation', 'Customer', 'Technology', 'Regulation']);
  const clientRef = context.clientName || 'your organisation';

  const DEFAULT_MATURITY_SCALES: Record<string, string[]> = {
    People: [
      'Reactive -- ad-hoc processes, high friction, no development paths',
      'Basic -- some structure, inconsistent practices, limited investment',
      'Structured -- formal programmes, regular reviews, defined career paths',
      'Advanced -- data-driven development, proactive retention, strong culture',
      'Leading -- industry benchmark, continuous learning, high engagement',
    ],
    Organisation: [
      'Siloed -- fragmented processes, unclear ownership, minimal alignment',
      'Functional -- some coordination, basic governance, departmental focus',
      'Integrated -- cross-functional processes, clear accountability, aligned goals',
      'Optimised -- data-driven decisions, lean operations, continuous improvement',
      'Adaptive -- agile structure, rapid response, innovation-driven',
    ],
    Customer: [
      'Transactional -- basic service, reactive to complaints, no journey view',
      'Responsive -- some feedback loops, inconsistent experience, channel gaps',
      'Managed -- defined journeys, consistent experience, proactive outreach',
      'Personalised -- data-driven personalisation, predictive service, omnichannel',
      'Transformative -- customer co-creation, anticipatory service, advocacy-driven',
    ],
    Technology: [
      'Legacy -- outdated systems, manual workarounds, limited integration',
      'Foundational -- core systems in place, some automation, basic reporting',
      'Connected -- integrated platforms, workflow automation, real-time data',
      'Intelligent -- AI/ML capabilities, predictive analytics, API-first',
      'Pioneering -- cutting-edge adoption, continuous innovation, platform ecosystem',
    ],
    Regulation: [
      'Reactive -- compliance as afterthought, manual monitoring, incident-driven',
      'Compliant -- meets minimum requirements, periodic audits, basic controls',
      'Proactive -- ahead of requirements, automated monitoring, embedded controls',
      'Strategic -- compliance as enabler, risk-based approach, regulatory influence',
      'Exemplary -- industry standard-setter, continuous assurance, competitive advantage',
    ],
  };

  const DEFAULT_EXPLORATORY: Record<string, Array<{ text: string; tag: string; purpose: string }>> = {
    People: [
      { text: `What is working well for people in ${clientRef} today?`, tag: 'working', purpose: 'Identify positive patterns to preserve and build on' },
      { text: `Where are the biggest capability or skills gaps?`, tag: 'gaps', purpose: 'Surface development and hiring needs' },
      { text: `What causes the most friction or frustration for your teams day to day?`, tag: 'friction', purpose: 'Identify operational pain points affecting staff' },
    ],
    Organisation: [
      { text: `Which organisational processes are working well at ${clientRef}?`, tag: 'strengths', purpose: 'Identify effective structures and processes' },
      { text: `Where do decisions get stuck or slowed down?`, tag: 'friction', purpose: 'Surface governance and decision-making bottlenecks' },
      { text: `What does the ideal organisational structure look like in 2-3 years?`, tag: 'future', purpose: 'Understand aspirational organisational design' },
    ],
    Customer: [
      { text: `What do customers value most about ${clientRef} today?`, tag: 'strengths', purpose: 'Identify differentiators to protect' },
      { text: `Where do customers experience the most friction or pain?`, tag: 'pain_points', purpose: 'Map customer journey pain points' },
      { text: `What would an ideal customer experience look like?`, tag: 'future', purpose: 'Define the target customer experience vision' },
    ],
    Technology: [
      { text: `Which technology at ${clientRef} is enabling the business well?`, tag: 'working', purpose: 'Identify technology strengths to leverage' },
      { text: `Where does technology create workarounds or slow people down?`, tag: 'friction', purpose: 'Surface technical debt and platform gaps' },
      { text: `What technology capabilities would transform the business?`, tag: 'future', purpose: 'Understand technology aspiration and investment appetite' },
    ],
    Regulation: [
      { text: `Which regulatory requirements have the most operational impact?`, tag: 'constraint', purpose: 'Identify highest-friction compliance areas' },
      { text: `Where does compliance conflict with customer or staff experience?`, tag: 'friction', purpose: 'Surface tension between compliance and operations' },
      { text: `How well prepared is ${clientRef} for upcoming regulatory changes?`, tag: 'context', purpose: 'Assess forward-looking regulatory readiness' },
    ],
  };

  const lenses: DiscoveryLensQuestions[] = lensNames.map((lens) => {
    const scale = DEFAULT_MATURITY_SCALES[lens] || DEFAULT_MATURITY_SCALES.People;
    const exploratory = DEFAULT_EXPLORATORY[lens] || DEFAULT_EXPLORATORY.People;

    // Use domain pack template for the first exploratory question if available
    const packTemplates = domainPack?.questionTemplates.filter(t => t.lens === lens) || [];
    const exploratoryQuestions = packTemplates.length > 0
      ? [
          ...packTemplates.slice(0, 2).map(t => ({
            id: nanoid(8),
            text: t.text,
            tag: 'context' as string,
            purpose: t.purpose,
            isEdited: false,
          })),
          ...exploratory.slice(0, 3 - Math.min(packTemplates.length, 2)).map(e => ({
            id: nanoid(8),
            text: e.text,
            tag: e.tag,
            purpose: e.purpose,
            isEdited: false,
          })),
        ]
      : exploratory.map(e => ({
          id: nanoid(8),
          text: e.text,
          tag: e.tag,
          purpose: e.purpose,
          isEdited: false,
        }));

    const maturityQuestion: DiscoveryQuestion = {
      id: nanoid(8),
      text: `On a scale of 1 to 5, how would you rate the ${lens} capability at ${clientRef} today? Where would you like it to be in 2 years? And where do you realistically think it will be?`,
      tag: 'triple_rating',
      maturityScale: scale,
      purpose: `Establish a baseline maturity assessment for the ${lens} lens with current, target, and projected ratings`,
      isEdited: false,
    };

    return {
      key: lens,
      label: lens,
      questions: [maturityQuestion, ...exploratoryQuestions],
    };
  });

  return {
    lenses,
    generatedAtMs: Date.now(),
    agentRationale: `Fallback Discovery questions for ${context.clientName || 'the client'}. These have not been tailored to specific company research -- the facilitator should review and modify as needed.`,
  };
}
