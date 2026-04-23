/**
 * DREAM Question Set Agent - Workshop Facilitation Questions
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
 * happened - the agents have those answers. These questions guide the
 * facilitator through the live workshop session.
 */

import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';
import { hasDiscoveryData } from './agent-types';
import type {
  WorkshopQuestionSet,
  FacilitationQuestion,
  WorkshopPhase,
  WorkshopPrepResearch,
  PrepContext,
  AgentConversationCallback,
  LensSource,
  DataConfidence,
} from './agent-types';
import type { WorkshopBlueprint } from '@/lib/workshop/blueprint';
import { analyzeMetricTrends } from '@/lib/historical-metrics/summarize';
import {
  validateFacilitationQuestionText,
  validateQuestionSet,
} from './question-set-validator';
import { inferCanonicalWorkshopType } from '@/lib/workshop/workshop-definition';
import { buildLiveWorkshopContractBlock } from '@/lib/workshop/live-stage-contracts';
import { getQuestionContract, buildLensContractBlock } from '@/lib/workshop/question-contracts';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 9;
const LOOP_TIMEOUT_MS = 55_000;
const MODEL = 'gpt-4o-mini';
/**
 * Get lens order for a phase.
 * Priority: blueprint phaseLensPolicy > research dimensions.
 * THROWS if neither is available — never falls back to a hardcoded default order.
 */
export function getPhaseLensOrder(
  phase: WorkshopPhase,
  research?: WorkshopPrepResearch | null,
  blueprint?: WorkshopBlueprint | null,
): { lenses: string[]; source: LensSource } {
  // Blueprint is the most complete source (already incorporates research dimensions)
  if (blueprint?.phaseLensPolicy?.[phase]?.length) {
    return { lenses: blueprint.phaseLensPolicy[phase], source: blueprint.domainPack ? 'domain_pack' : 'research_dimensions' };
  }
  if (research?.industryDimensions?.length) {
    return { lenses: research.industryDimensions.map(d => d.name), source: 'research_dimensions' };
  }
  throw new Error(
    `Workshop lens set is required for phase "${phase}" — no fallback to generic defaults. ` +
    'Ensure workshop prep (blueprint or research dimensions) is completed before generating questions.',
  );
}

const PHASE_GUIDANCE: Record<WorkshopPhase, string> = {
  REIMAGINE: `REIMAGINE is the visionary phase. Participants paint a picture of the ideal future state WITHOUT constraints. No technology limitations, no funding concerns, no regulation barriers - just pure aspiration. The facilitator guides them through People, Commercial, and Partners lenses only. The goal is to get genuine, unconstrained thinking about what "great" looks like while staying grounded in real work and customer reality.`,

  CONSTRAINTS: `CONSTRAINTS maps the real-world limitations, working RIGHT-TO-LEFT through the lenses: Risk/Compliance → Commercial → Technology → Operations → People → Partners. Start with hard external constraints (regulatory, compliance) and work inward to softer operating and people constraints. The goal is to systematically identify what stands between today and the reimagined vision. This phase references the vision from REIMAGINE to assess each constraint's impact.`,

  DEFINE_APPROACH: `DEFINE APPROACH builds the practical solution LEFT-TO-RIGHT: People → Operations → Technology → Commercial → Risk/Compliance → Partners. Start with human needs and build outward. The facilitator guides participants to design an approach that bridges today's reality to the reimagined future while respecting the constraints identified. Focus on practical changes, sequence, proof points, and what would need to happen in real work for the approach to succeed.`,
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
        'Retrieve the Research Agent\'s findings about the client company - company overview, industry context, challenges, competitive landscape, and domain insights.',
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
        'Retrieve insights from completed Discovery interviews - key themes, pain points, aspirations, consensus areas, divergence areas, and maturity scores. This is what participants have ALREADY told us. Use this to build questions that go deeper, not repeat what was said.',
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
      name: 'get_blueprint_constraints',
      description:
        'Retrieve the workshop blueprint constraints that govern question design -- required topics that MUST be covered, forbidden topics to avoid, focus areas to emphasize, domain-specific metrics to probe, and question count policy. Call this BEFORE designing questions.',
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
      name: 'get_historical_metrics',
      description:
        'Retrieve historical operational performance data -- metric trends, baselines, and changes over time. Use to ground questions in real data and probe gaps between historical performance and aspirations.',
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
        'Propose facilitation questions for a specific workshop phase. Submit questions in any grouping you like -- all lenses at once, lens by lens, or depth by depth. Each call accumulates into per-lens depth slots (phase → lens → depth), so partial submissions are preserved and you never lose progress. A phase completes when every expected lens has a question at surface, depth, AND edge. The response tells you exactly which lens+depth slots are still empty. Consult contractsByPhase (from get_workshop_phases) for what each depth must achieve per lens.',
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
                  description: 'The dimension/lens this question addresses. CRITICAL: Use EXACTLY the lens names returned by get_workshop_phases — copy them character-for-character. For example, if get_workshop_phases returns "Risk/Compliance", use "Risk/Compliance" NOT "Regulation". If it returns "Operations", use "Operations" NOT "Organisation". Use "General" only for cross-cutting questions that span multiple lenses.',
                },
                depth: {
                  type: 'string',
                  enum: ['surface', 'depth', 'edge'],
                  description: 'The depth level of this question within its lens. Each lens MUST have exactly one question at each depth: surface (opens the space — observable, grounded in lived experience), depth (makes it concrete — structural, company-specific), edge (surfaces the most ambitious, unspoken version — what nobody in the room has fully committed to yet). See contractsByPhase in get_workshop_phases for what each depth must achieve per lens.',
                },
                text: {
                  type: 'string',
                  description: 'The facilitation question text — what the facilitator asks the room. Must be a genuine English question. Any standard question form is valid: "What...", "Where...", "How...", "Which...", "When...", "Who...", "In what...", "Across the...", etc. Do NOT open with instructional openers: Consider, Imagine, Describe, Think about, Reflect on, Tell me, Please, Let\'s, Building on, Leveraging, Driving, Delivering, Ensuring, Achieving, Focus on, Note that, You should, They should, Participants should, The facilitator.',
                },
                purpose: {
                  type: 'string',
                  description: 'Why this question matters - what it aims to surface from participants.',
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
                        description: 'The dimension/lens this sub-question explores. CRITICAL: Use EXACTLY the lens names from get_workshop_phases (e.g. "Risk/Compliance" not "Regulation", "Operations" not "Organisation"). Use "General" for cross-cutting.',
                      },
                      text: {
                        type: 'string',
                        description: 'The seed prompt text — a specific angle or probe the facilitator uses to open or deepen this question. Serves two purposes: (1) coverage insurance — ensures important areas are touched; (2) onion-peeling — if responses are shallow, this drives deeper. Must be a genuine English question. Any standard form is valid. Do NOT open with: Consider, Imagine, Describe, Think about, Reflect on, Tell me, Please, Let\'s, Building on, Leveraging, Driving, Delivering, Ensuring, Achieving, Focus on, Note that, You should, They should.',
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
              required: ['lens', 'depth', 'text', 'purpose', 'grounding', 'subQuestions'],
            },
            description: 'The facilitation questions to add. Any size: 1 question, 3 questions for 1 lens, all 18 for a 6-lens phase, or any other grouping. Each question is stored in its lens+depth slot. You can submit surface questions for all lenses, then depth questions, then edge questions, across multiple calls — progress accumulates. Tag every question with its depth field.',
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
        'Commit the final workshop facilitation question set. Call this after designing questions for all three phases. Include an overall rationale explaining the question strategy and an honest assessment of data confidence.',
      parameters: {
        type: 'object',
        properties: {
          designRationale: {
            type: 'string',
            description:
              'A paragraph explaining the overall question design strategy - how the questions build on Discovery insights, why certain topics are emphasized, and how they guide the facilitator through the workshop. This is shown to the facilitator.',
          },
          dataConfidence: {
            type: 'string',
            enum: ['high', 'moderate', 'low'],
            description:
              'Overall confidence in question quality based on available data. high = research + Discovery data available and informing questions; moderate = research only, no Discovery data; low = no research, no Discovery -- questions are best-effort from general knowledge.',
          },
          dataSufficiencyNotes: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Specific notes about missing data or gaps that affect question quality. E.g. "No Discovery interview data available", "Research did not cover regulatory landscape", "Only 3 of 12 participants completed interviews".',
          },
        },
        required: ['designRationale', 'dataConfidence', 'dataSufficiencyNotes'],
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
  designedDepthSlots: Map<WorkshopPhase, Map<string, Map<string, FacilitationQuestion>>>,
): { result: string; summary: string } {
  switch (toolName) {
    case 'get_research_context': {
      if (!research) {
        return {
          result: JSON.stringify({ available: false, note: 'No research available. Generate questions based on general industry knowledge and the DREAM track context.' }),
          summary: '**Research context:** Not available - will use general industry knowledge.',
        };
      }

      const challengesList = research.keyPublicChallenges.length > 0
        ? research.keyPublicChallenges.map((c) => `  \u2022 ${c}`).join('\n')
        : '  (none identified)';
      const devsList = research.recentDevelopments.length > 0
        ? research.recentDevelopments.map((d) => `  \u2022 ${d}`).join('\n')
        : '  (none identified)';

      // Include journey stages and industry dimensions if available
      const journeySection = research.journeyStages?.length
        ? `\n\n**Customer Journey** (${research.journeyStages.length} stages)\n${research.journeyStages.map((s, i) => `  ${i + 1}. ${s.name}: ${s.description}`).join('\n')}`
        : '';
      const dimensionSection = research.industryDimensions?.length
        ? `\n\n**Industry Dimensions** (${research.industryDimensions.length} axes)\n${research.industryDimensions.map(d => `  • ${d.name}: ${d.description}`).join('\n')}`
        : '';

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
          industryDimensions: research.industryDimensions?.map(d => ({ name: d.name, description: d.description })) || null,
        }),
        summary: `**Retrieved research context:**\n\n**Company:** ${research.companyOverview}\n\n**Industry:** ${research.industryContext}\n\n**Key Challenges**\n${challengesList}\n\n**Recent Developments**\n${devsList}${research.domainInsights ? `\n\n**Domain Insights:** ${research.domainInsights}` : ''}${journeySection}${dimensionSection}`,
      };
    }

    case 'get_discovery_insights': {
      if (!discoveryBriefing) {
        return {
          result: JSON.stringify({
            available: false,
            note: 'No Discovery interview data available yet. Participants have not completed their interviews. Generate questions based on research context and DREAM track - the facilitator can refine after Discovery is complete.',
          }),
          summary: '**Discovery insights:** Not yet available - participants have not completed interviews. Questions will be based on research context.',
        };
      }

      // Briefing object exists but contains no actual participant data (zero-interview fallback)
      if (!hasDiscoveryData(discoveryBriefing)) {
        return {
          result: JSON.stringify({
            available: false,
            note: 'Discovery interviews have not been completed. The briefing exists but contains no participant data. Generate questions based on research context and DREAM track.',
          }),
          summary: '**Discovery insights:** No interviews completed. Questions will be based on research context only.',
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
        ? themes.map((t: Record<string, unknown>) => `  \u2022 **${t.title}** (${t.domain || 'General'}, ${t.sentiment}) - ${t.frequency} mentions`).join('\n')
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

    case 'get_blueprint_constraints': {
      const bp = context.blueprint;
      if (!bp || !bp.questionConstraints) {
        return {
          result: JSON.stringify({
            available: false,
            note: 'No blueprint constraints available. Use general question design principles.',
          }),
          summary: '**Blueprint constraints:** Not available. Using general question design defaults.',
        };
      }

      const { questionConstraints, questionPolicy, diagnosticFocus, journeyStages } = bp;
      const requiredList = questionConstraints.requiredTopics.length > 0
        ? questionConstraints.requiredTopics.map(t => `  - ${t}`).join('\n')
        : '  (none)';
      const forbiddenList = questionConstraints.forbiddenTopics.length > 0
        ? questionConstraints.forbiddenTopics.map(t => `  - ${t}`).join('\n')
        : '  (none)';
      const focusList = questionConstraints.focusAreas.length > 0
        ? questionConstraints.focusAreas.map(f => `  - ${f}`).join('\n')
        : '  (none)';
      const metricsList = questionConstraints.domainMetrics.length > 0
        ? questionConstraints.domainMetrics.join(', ')
        : '(none)';

      return {
        result: JSON.stringify({
          available: true,
          questionConstraints,
          questionPolicy,
          diagnosticFocus: diagnosticFocus || null,
          journeyStages: journeyStages.map(s => ({ name: s.name, description: s.description })),
        }),
        summary: `**Retrieved blueprint constraints:**\n\n**Required Topics** (MUST cover)\n${requiredList}\n\n**Forbidden Topics** (avoid)\n${forbiddenList}\n\n**Focus Areas** (weight toward)\n${focusList}\n\n**Domain Metrics:** ${metricsList}\n\n**Question Policy:** ${questionPolicy.questionsPerPhase} questions/phase, ${questionPolicy.subQuestionsPerMain} sub-questions/main${diagnosticFocus ? `\n\n**Diagnostic Focus:** ${diagnosticFocus}` : ''}`,
      };
    }

    case 'get_historical_metrics': {
      if (!context.historicalMetrics) {
        return {
          result: JSON.stringify({
            available: false,
            note: 'No historical metrics uploaded. Generate questions based on research and Discovery context.',
          }),
          summary: '**Historical metrics:** Not available.',
        };
      }
      const trends = analyzeMetricTrends(context.historicalMetrics);
      const trendLines = trends.map((t) => {
        const changeStr = t.changePercent !== null
          ? ` (${t.trend}, ${t.changePercent > 0 ? '+' : ''}${t.changePercent.toFixed(1)}%)`
          : ` (${t.trend})`;
        return `  - ${t.metricLabel}: ${t.latestValue} ${t.unit} as of ${t.latestPeriod}${changeStr}`;
      });
      return {
        result: JSON.stringify({
          available: true,
          domainPack: context.historicalMetrics.domainPack,
          sourceCount: context.historicalMetrics.sources.length,
          metrics: trends,
        }),
        summary: `**Historical metrics:** ${trends.length} metrics from ${context.historicalMetrics.domainPack} pack.\n${trendLines.join('\n')}`,
      };
    }

    case 'get_workshop_phases': {
      const trackContext = context.dreamTrack === 'DOMAIN'
        ? `This is a **Domain-focused** workshop targeting **${context.targetDomain || 'a specific business area'}**. Questions should be weighted toward this domain while still covering all relevant lenses.`
        : 'This is an **Enterprise-wide** assessment. Questions should cover all lenses equally.';

      const bp = context.blueprint;
      const reimagine = getPhaseLensOrder('REIMAGINE', research, bp);
      const constraints = getPhaseLensOrder('CONSTRAINTS', research, bp);
      const defineApproach = getPhaseLensOrder('DEFINE_APPROACH', research, bp);
      const lensSource = reimagine.source; // same source for all phases

      // Read question counts from blueprint policy, with sensible fallbacks
      const qPerPhase = bp?.questionPolicy?.questionsPerPhase ?? 5;
      const subPerMain = bp?.questionPolicy?.subQuestionsPerMain ?? 3;
      const questionCountLabel = `${qPerPhase} questions`;

      // Include journey stages from blueprint if available
      const journeyStages = bp?.journeyStages?.length
        ? bp.journeyStages.map((s, i) => `  ${i + 1}. ${s.name}: ${s.description}`).join('\n')
        : null;

      // Build contract blocks — exact spec of what each depth level must achieve per lens
      const workshopType = inferCanonicalWorkshopType({ workshopType: context.workshopType });
      const clientName = context.clientName || 'the client';

      // Use compact form to keep context size manageable for large workshops (6+ lenses)
      const contractsByPhase: Record<string, string> = {};
      for (const [phaseName, lensResult] of [
        ['REIMAGINE', reimagine],
        ['CONSTRAINTS', constraints],
        ['DEFINE_APPROACH', defineApproach],
      ] as Array<[string, { lenses: string[] }]>) {
        const contract = getQuestionContract(phaseName as 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH', workshopType);
        contractsByPhase[phaseName] = lensResult.lenses.map(lens =>
          buildLensContractBlock(contract, lens, clientName, true), // compact=true
        ).join('\n');
      }

      // Question count: 3 depths × num_lenses per phase
      const reimagineCount = reimagine.lenses.length * 3;
      const constraintsCount = constraints.lenses.length * 3;
      const defineApproachCount = defineApproach.lenses.length * 3;

      return {
        result: JSON.stringify({
          dreamTrack: context.dreamTrack,
          targetDomain: context.targetDomain,
          trackGuidance: trackContext,
          hasResearchedDimensions: lensSource === 'research_dimensions' || lensSource === 'domain_pack',
          lensSource,
          questionPolicy: {
            questionsPerPhase: `3 per lens (surface + depth + edge). REIMAGINE: ${reimagineCount}, CONSTRAINTS: ${constraintsCount}, DEFINE_APPROACH: ${defineApproachCount}`,
            subQuestionsPerMain: subPerMain,
          },
          journeyStages: bp?.journeyStages || null,
          phases: {
            REIMAGINE: {
              label: 'Reimagine',
              purpose: PHASE_GUIDANCE.REIMAGINE,
              lensOrder: reimagine.lenses,
              questionCount: `${reimagineCount} (3 per lens × ${reimagine.lenses.length} lenses)`,
              keyPrinciple: 'Pure 100% vision. NO constraint language of any kind. Customer is north star.',
            },
            CONSTRAINTS: {
              label: 'Constraints',
              purpose: PHASE_GUIDANCE.CONSTRAINTS,
              lensOrder: constraints.lenses,
              questionCount: `${constraintsCount} (3 per lens × ${constraints.lenses.length} lenses)`,
              keyPrinciple: 'Map what stands between today and the vision. Surface → structural → what it protects.',
            },
            DEFINE_APPROACH: {
              label: 'Define Approach',
              purpose: PHASE_GUIDANCE.DEFINE_APPROACH,
              lensOrder: defineApproach.lenses,
              questionCount: `${defineApproachCount} (3 per lens × ${defineApproach.lenses.length} lenses)`,
              keyPrinciple: 'Practical path from today to the vision. First step → conditions → failure modes.',
            },
          },
          contractsByPhase,
        }),
        summary: `Retrieved workshop phase structure (lensSource: ${lensSource}). ${trackContext}\n\n3 phases: REIMAGINE (${reimagine.lenses.length} lenses × 3 depths = ${reimagineCount}q), CONSTRAINTS (${constraints.lenses.length} lenses × 3 depths = ${constraintsCount}q), DEFINE_APPROACH (${defineApproach.lenses.length} lenses × 3 depths = ${defineApproachCount}q). Lenses: ${reimagine.lenses.join(', ')}. Contract blocks for all phases included in contractsByPhase.${journeyStages ? `\n\n**Journey Stages:**\n${journeyStages}` : ''}`,
      };
    }

    case 'design_phase_questions': {
      // Normalise phase key: LLM may pass 'DEFINE APPROACH' (space) instead of 'DEFINE_APPROACH'
      const rawPhase = String(args.phase || '').trim().toUpperCase().replace(/\s+/g, '_');
      const phase = rawPhase as WorkshopPhase;
      const questions = args.questions as Array<Record<string, unknown>>;

      if (!phase || !Array.isArray(questions)) {
        return {
          result: JSON.stringify({ error: 'Invalid phase or questions' }),
          summary: 'Invalid phase design request',
        };
      }

      // Normalise lens names: map legacy names the LLM may still output → canonical universal names
      const LENS_NORMALISE: Record<string, string> = {
        'Organisation': 'Operations',
        'Regulation': 'Risk/Compliance',
        'Risk & Compliance': 'Risk/Compliance',
        'Risk and Compliance': 'Risk/Compliance',
        'Compliance': 'Risk/Compliance',
      };
      function normaliseLens(raw: string): string {
        return LENS_NORMALISE[raw] ?? raw;
      }

      // Determine expected lenses for this phase
      const VALID_DEPTHS = ['surface', 'depth', 'edge'] as const;
      type ValidDepth = typeof VALID_DEPTHS[number];
      const DEPTH_ORDER: Record<string, number> = { surface: 0, depth: 1, edge: 2 };
      let expectedLenses: string[] = [];
      try {
        expectedLenses = getPhaseLensOrder(phase, research, context.blueprint).lenses.map(normaliseLens);
      } catch {
        // Lens info unavailable — fall back to blueprint policy count
      }

      // Build facilitation questions from submitted data
      const facilitation: FacilitationQuestion[] = questions.map((q, i) => {
        // Normalise depth: accept 'Surface' → 'surface', 'Depth' → 'depth', 'Edge' → 'edge'
        const rawDepth = String(q.depth || '').toLowerCase().trim();
        return {
          id: nanoid(8),
          phase,
          lens: normaliseLens(String(q.lens || 'General')),
          text: String(q.text || ''),
          purpose: String(q.purpose || ''),
          grounding: String(q.grounding || ''),
          depth: VALID_DEPTHS.includes(rawDepth as ValidDepth) ? rawDepth as ValidDepth : undefined,
          order: i + 1,
          isEdited: false,
          subQuestions: Array.isArray(q.subQuestions)
            ? q.subQuestions.map((sq: Record<string, unknown>) => ({
                id: nanoid(8),
                lens: normaliseLens(String(sq.lens || 'General')),
                text: String(sq.text || ''),
                purpose: String(sq.purpose || ''),
              }))
            : [],
        };
      });

      // --- STEP 1: Text validation (reject entire submission if any question fails) ---
      const validationIssues = facilitation.flatMap((question, index) => {
        const issues: string[] = [];
        const mainErr = validateFacilitationQuestionText(question.text, question.lens, false);
        if (mainErr) {
          issues.push(`Q${index + 1}: ${mainErr} [MAIN: "${question.text.slice(0, 70)}"]`);
        }
        for (const [si, sq] of question.subQuestions.entries()) {
          const sqErr = validateFacilitationQuestionText(sq.text, sq.lens ?? question.lens, true);
          if (sqErr) {
            issues.push(`Q${index + 1}: sub-question ${si + 1}: ${sqErr} [SQ: "${sq.text.slice(0, 70)}"]`);
          }
        }
        return issues;
      });
      if (validationIssues.length > 0) {
        const remediation =
          'Rewrite every failing question. Rules: ' +
          '(1) NEVER start with these instructional openers: "Consider", "Imagine", "Describe", "Think about", ' +
          '"Reflect on", "Tell me", "Please", "Let\'s", "Focus on", "Note that", "Building on", "Leveraging", ' +
          '"Driving", "Delivering", "Ensuring", "Achieving", "You should", "They should". ' +
          '(2) Any standard English question form is valid: "What...", "Where...", "Which...", "When...", ' +
          '"How...", "Who...", "In what...", "Across...", "At what...", "For most...", "Looking at...", etc. ' +
          '(3) Remove financial terms (ROI, budget, revenue, profit, margin, investment). ' +
          '(4) Remove role-specific terms (board, C-suite, executive committee, shareholder, investor). ' +
          '(5) Remove abstract language (strategic alignment, organisational structure, operational strategy).';
        return {
          result: JSON.stringify({
            error: 'Phase questions failed validation',
            phase,
            issues: validationIssues,
            remediation,
          }),
          summary: `**${phase} rejected**\n${validationIssues.map((issue) => `- ${issue}`).join('\n')}\n- ${remediation}`,
        };
      }

      // --- STEP 2: Per-depth slot accumulation (accepts any valid questions, accumulates across calls) ---
      // The model may submit questions depth-by-depth (all-surface then all-depth then all-edge).
      // This accumulator tracks per-phase → per-lens → per-depth, accepting each valid question
      // and preserving progress so the model doesn't lose work across iterations.
      if (expectedLenses.length > 0) {
        // Ensure accumulator exists for this phase
        if (!designedDepthSlots.has(phase)) designedDepthSlots.set(phase, new Map());
        const phaseSlots = designedDepthSlots.get(phase)!;

        // Group submitted questions by lens for debug logging
        const byLens = new Map<string, FacilitationQuestion[]>();
        for (const q of facilitation) {
          const lens = q.lens || 'General';
          if (!byLens.has(lens)) byLens.set(lens, []);
          byLens.get(lens)!.push(q);
        }
        console.log(`[Question Set Agent] ${phase} submission: ${[...byLens.entries()].map(([l, qs]) => `${l}:[${qs.map(q => q.depth ?? '?').join(',')}]`).join(' ')}`);

        // Accumulate each submitted question into its phase → lens → depth slot
        // Only accept questions with a valid depth tag
        for (const q of facilitation) {
          if (!q.depth) continue; // skip questions without a depth tag
          const lens = q.lens || 'General';
          if (!phaseSlots.has(lens)) phaseSlots.set(lens, new Map());
          phaseSlots.get(lens)!.set(q.depth, q); // latest wins per slot
        }

        // Compute per-lens completion status
        const REQUIRED_DEPTHS = ['surface', 'depth', 'edge'] as const;
        const completedLenses: string[] = [];
        const incompleteLenses: Array<{ lens: string; missing: string[] }> = [];

        for (const lens of expectedLenses) {
          const lensSlots = phaseSlots.get(lens);
          const missing = REQUIRED_DEPTHS.filter(d => !lensSlots?.has(d));
          if (missing.length === 0) {
            completedLenses.push(lens);
          } else {
            incompleteLenses.push({ lens, missing });
          }
        }

        const stillMissing = incompleteLenses.map(l => l.lens);

        if (stillMissing.length > 0) {
          // Phase not yet complete — return progress guidance
          const pct = `${completedLenses.length}/${expectedLenses.length}`;
          const progressNote = completedLenses.length > 0
            ? `Progress: ${pct} lenses complete (${completedLenses.join(', ')}).`
            : `Progress: 0/${expectedLenses.length} lenses complete.`;
          const missingDetail = incompleteLenses.map(l => `${l.lens} needs: ${l.missing.join(', ')}`).join('; ');

          return {
            result: JSON.stringify({
              status: 'partial',
              phase,
              completedLenses,
              stillMissing,
              depthsNeeded: Object.fromEntries(incompleteLenses.map(l => [l.lens, l.missing])),
            }),
            summary: `**${phase} partial** — ${pct} lenses complete.\n- ${progressNote}\n- Still needed: ${missingDetail}. Call design_phase_questions again for the missing depths.`,
          };
        }

        // All expected lenses complete — flatten into ordered question list
        const ordered: FacilitationQuestion[] = [];
        for (const lens of expectedLenses) {
          for (const d of REQUIRED_DEPTHS) {
            const q = phaseSlots.get(lens)?.get(d);
            if (q) ordered.push(q);
          }
        }
        ordered.forEach((q, i) => { q.order = i + 1; });
        designedPhases.set(phase, ordered);

        const phaseLabel = phase === 'DEFINE_APPROACH' ? 'Define Approach' : phase.charAt(0) + phase.slice(1).toLowerCase();
        const qLines = ordered.map(q => {
          const depthTag = q.depth ? ` [${q.depth}]` : '';
          return `  ${q.order}. **[${q.lens}]${depthTag}** "${q.text}"`;
        }).join('\n');

        return {
          result: JSON.stringify({
            phase,
            questionsStored: ordered.length,
            lensDistribution: ordered.reduce((acc, q) => {
              const lens = q.lens || 'General';
              acc[lens] = (acc[lens] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
          }),
          summary: `**Designed ${phaseLabel} phase** - ${ordered.length} facilitation questions\n\n${qLines}`,
        };
      }

      // --- Fallback: no expected lenses — use original count-based validation ---
      const minQuestionsRequired = context.blueprint?.questionPolicy?.questionsPerPhase ?? 5;
      if (facilitation.length < minQuestionsRequired) {
        const countRemediation = `You submitted ${facilitation.length} question(s) but this phase requires ${minQuestionsRequired}. Design ALL ${minQuestionsRequired} questions and resubmit in a single call.`;
        return {
          result: JSON.stringify({
            error: `Too few questions — ${facilitation.length} submitted, ${minQuestionsRequired} required`,
            phase,
            remediation: countRemediation,
          }),
          summary: `**${phase} rejected** — only ${facilitation.length}/${minQuestionsRequired} questions provided.\n- ${countRemediation}`,
        };
      }
      designedPhases.set(phase, facilitation);

      const phaseLabel2 = phase === 'DEFINE_APPROACH' ? 'Define Approach' : phase.charAt(0) + phase.slice(1).toLowerCase();
      const qLines2 = facilitation.map(q => {
        const depthTag = q.depth ? ` [${q.depth}]` : '';
        return `  ${q.order}. **[${q.lens}]${depthTag}** "${q.text}"\n     _Purpose:_ ${q.purpose}`;
      }).join('\n\n');

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
        summary: `**Designed ${phaseLabel2} phase** - ${facilitation.length} facilitation questions\n\n${qLines2}`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

/** @internal Exported for testing */
export function buildQuestionSetSystemPrompt(context: PrepContext, research?: WorkshopPrepResearch | null, discoveryBriefing?: Record<string, unknown> | null): string {
  const trackDesc = context.dreamTrack === 'DOMAIN'
    ? `The DREAM track is **Domain**, focused on **${context.targetDomain || 'a specific area'}**. Weight questions toward this domain while still covering all relevant lenses in each phase.`
    : 'The DREAM track is **Enterprise** -- a full end-to-end assessment across the entire business.';
  const liveContractBlock = buildLiveWorkshopContractBlock(
    inferCanonicalWorkshopType({ workshopType: context.workshopType }),
  );

  // Build blueprint constraints block if available and meaningful
  const bp = context.blueprint;
  let constraintsBlock = '';
  const qc = bp?.questionConstraints;
  const hasConstraintContent = qc && (
    qc.requiredTopics.length > 0 ||
    qc.forbiddenTopics.length > 0 ||
    qc.focusAreas.length > 0 ||
    qc.domainMetrics.length > 0
  );
  if (hasConstraintContent && qc) {
    const { requiredTopics, forbiddenTopics, focusAreas, domainMetrics } = qc;
    const sections: string[] = [];

    if (requiredTopics.length > 0) {
      sections.push(`REQUIRED TOPICS -- You MUST cover each of these in at least one question:\n${requiredTopics.map(t => `  - ${t}`).join('\n')}`);
    }
    if (forbiddenTopics.length > 0) {
      sections.push(`FORBIDDEN TOPICS -- Do NOT ask about these:\n${forbiddenTopics.map(t => `  - ${t}`).join('\n')}`);
    }
    if (focusAreas.length > 0) {
      sections.push(`FOCUS AREAS -- Weight your questions toward these themes:\n${focusAreas.map(f => `  - ${f}`).join('\n')}`);
    }
    if (domainMetrics.length > 0) {
      sections.push(`DOMAIN METRICS -- Reference these KPIs in question grounding:\n${domainMetrics.map(m => `  - ${m}`).join('\n')}`);
    }

    const qPolicy = bp.questionPolicy;
    sections.push(`QUESTION POLICY:\n  - Target ${qPolicy.questionsPerPhase} questions per phase\n  - ${qPolicy.subQuestionsPerMain} starter sub-questions per main question`);

    if (bp.diagnosticFocus) {
      sections.push(`DIAGNOSTIC FOCUS: ${bp.diagnosticFocus}`);
    }

    constraintsBlock = `\nQUESTION CONSTRAINTS (from workshop blueprint):\n\n${sections.join('\n\n')}\n`;
  }

  return `You are the DREAM Workshop Question Set Agent. Your job is to design the
facilitation questions that will guide the live workshop session for
${context.clientName || 'the client'} (${context.industry || 'unknown industry'}).

${trackDesc}
${context.workshopPurpose ? `\nWORKSHOP PURPOSE (WHY WE ARE HERE):\n${context.workshopPurpose}` : ''}
${context.desiredOutcomes ? `\nDESIRED OUTCOMES (WHAT WE MUST WALK AWAY WITH):\n${context.desiredOutcomes}` : ''}
${context.workshopPurpose || context.desiredOutcomes ? `\nTHIS IS THE MOST IMPORTANT INPUT. Every facilitation question you design MUST serve this purpose and drive toward these outcomes. If a question does not ladder up to WHY we are here and WHAT we need to achieve, do not include it. The workshop exists for this reason and no other.\n` : ''}
${liveContractBlock ? `\nWORKSHOP-TYPE LIVE CONTRACT:\n${liveContractBlock}\n` : ''}
CRITICAL CONTEXT:
${hasDiscoveryData(discoveryBriefing)
    ? `- Discovery interviews have ALREADY been completed. Participants have already
  answered questions about their roles, pain points, aspirations, and maturity
  ratings. You have access to what they said via get_discovery_insights().
- These workshop facilitation questions are DIFFERENT from Discovery questions.
  Do NOT repeat Discovery interview questions.`
    : `- Discovery interviews have NOT been completed yet. There is no pre-interview
  data available. Design questions based on research context and industry knowledge.
  The get_discovery_insights() tool will confirm this.
- Do NOT claim or imply that Discovery insights exist.`}
- These questions guide a GROUP WORKSHOP SESSION with 8-15 participants in a room.
- The facilitator uses these questions to run each phase of the workshop.
${context.historicalMetrics
    ? `- Historical performance data IS available (${context.historicalMetrics.series.length} metrics).
  Call get_historical_metrics() to see actual operational baselines and trends.
  Ground questions in real data -- reference specific metrics to make questions evidence-based.`
    : '- No historical performance data available.'}

${research?.industryDimensions?.length ? `THE THREE WORKSHOP PHASES:

IMPORTANT: This workshop uses research-derived dimensions specific to
${context.industry || 'this industry'}, NOT the generic default lenses.
The dimensions are: ${research.industryDimensions.map(d => d.name).join(', ')}
${research.industryDimensions.map(d => `  - ${d.name}: ${d.description}`).join('\n')}

Use THESE dimension names in your question lens assignments. Do NOT use the
generic People/Organisation/Customer/Technology/Regulation names.

1. REIMAGINE (Pure Vision)
   Dimensions: All (${research.industryDimensions.map(d => d.name).join(', ')})
   Goal: Get participants to paint the ideal future WITHOUT any constraints.
   No technology, no budget, no regulation - just what "amazing" looks like.
   Key: Open, aspirational, creative questions. "If you could wave a magic wand..."

2. CONSTRAINTS (Map Limitations)
   Dimensions: All (${research.industryDimensions.map(d => d.name).join(', ')})
   Goal: Systematically identify what stands between today and the reimagined vision.
   Start with hard external constraints and work inward.
   Key: Specific, probing, referencing the vision they just created.

3. DEFINE_APPROACH (Build Solution)
   Dimensions: All (${research.industryDimensions.map(d => d.name).join(', ')})
   Goal: Design the practical path forward that bridges reality to vision.
   Key: Actionable, ownership-focused, measurable. "Who owns this? What's step one?"
` : `THE THREE WORKSHOP PHASES:

1. REIMAGINE (Pure Vision)
   Lenses: People, Commercial, Partners ONLY
   Goal: Get participants to paint the ideal future WITHOUT any constraints.
   No technology, no funding, no regulation - just what "amazing" looks like.
   Key: Open, aspirational, creative questions grounded in lived work and customer reality.

2. CONSTRAINTS (Map Limitations - Right-to-Left)
   Lenses: Risk/Compliance, Commercial, Technology, Operations, People, Partners
   Goal: Systematically identify what stands between today and the reimagined vision.
   Start with hard external constraints and work inward.
   Key: Specific, probing, referencing the vision they just created.

3. DEFINE_APPROACH (Build Solution - Left-to-Right)
   Lenses: People, Operations, Technology, Commercial, Risk/Compliance, Partners
   Goal: Design the practical path forward that bridges reality to vision.
   Key: Actionable, sequence-focused, measurable. Ask what would need to happen in practice, where the first move is, and how the room would know it is working.
`}${research?.journeyStages?.length ? `\nCUSTOMER JOURNEY STAGES:\n${research.journeyStages.map((s, i) => `  ${i + 1}. ${s.name}: ${s.description}`).join('\n')}\nReference these journey stages when grounding your questions.\n` : ''}${constraintsBlock}
CONTRACT-DRIVEN DEPTH STRUCTURE (NON-NEGOTIABLE):
For each lens in each phase, generate exactly 3 questions at increasing depth levels:

  surface: Opens the space. Observable, grounded in what participants actually experience.
           The question must be answerable by anyone in the room from lived experience.
           Avoids constraint language in REIMAGINE. Reveals the visible form of the constraint
           in CONSTRAINTS. Identifies the concrete first step in DEFINE_APPROACH.

  depth:   Makes it concrete and structural. Company-specific. Gets beneath symptoms to causes
           (CONSTRAINTS), or beneath aspiration to daily reality (REIMAGINE), or beneath first
           step to what conditions must hold (DEFINE_APPROACH).

  edge:    Surfaces the most ambitious, challenging, or unspoken version. The question nobody
           in the room has fully committed to yet. In REIMAGINE: the transformative possibility.
           In CONSTRAINTS: what the constraint is actually protecting. In DEFINE_APPROACH: where
           this approach will quietly fail and what nobody is saying about it.

The get_workshop_phases tool returns contractsByPhase -- read it carefully. It specifies exactly
what each depth level must achieve for each specific lens. Follow the contract, not your intuition.

QUESTION COUNT: 3 questions per lens (surface, depth, edge) for every phase. For a phase
with 6 lenses: 18 questions total (6 x 3). Tag each question with its "depth" field.
Group by lens when designing: do all 3 depths for one lens before moving on.

REIMAGINE HARD RULE: Zero constraint language at any depth level. Not even at edge depth.
No mention of barriers, gaps, what needs to change, limitations, or what stands in the way.
Pure vision -- what becomes possible. Customer is the north star. Sub-actors (operational and
commercial roles) appear in seed prompts to ground the vision in real working experience.

YOUR APPROACH:
1. Get the research context (company, industry, challenges).
2. Get Discovery insights if available (what participants already told us).
3. Get blueprint constraints (required/forbidden topics, focus areas, metrics).
4. Get historical metrics if available (operational baselines and trends).
5. Get the workshop phase structure. CRITICAL: read contractsByPhase carefully before designing.
6. Design questions for ALL THREE phases. Call design_phase_questions for each phase.
   You may submit questions in any grouping -- all at once, per-lens, or even per-depth.
   Each call accumulates into per-lens depth slots: your progress is preserved across calls.
   A phase completes when every lens has questions at all 3 depths. DO NOT commit until all
   three phases are complete.
   - Follow the contract for each phase x lens combination (from contractsByPhase)
   - Each lens needs exactly 3 depth levels: surface, depth, edge -- tag each with "depth" field
   - Questions MUST be deeply specific to ${context.clientName || 'the client'}.
     Reference actual challenges, industry dynamics, and Discovery insights.
     Do NOT write generic template questions with a company name inserted.
   - Questions should BUILD ON Discovery insights, not repeat them.
   - If the workshop type is GO-TO-MARKET, every phase question must stay tied to
     proposition credibility, buyer experience, win/loss, ICP fit, deal viability.
     Do NOT fall back to generic transformation or operations questions.
   - For EACH main question, generate ${bp?.questionPolicy?.subQuestionsPerMain ?? 3} seed prompts (subQuestions).
     Seed prompts serve two purposes: (1) coverage insurance -- ensure key areas the contract
     specifies are touched; (2) onion-peeling -- drive deeper if responses are shallow.
     Seed prompts must:
     * Follow the promptIntents from the contract for that depth level
     * Each target a specific dimension from the workshop's lens set
     * Be directly scoped to the parent main question's topic
     * Reference specific research/Discovery findings where possible
     * MUST be genuine questions -- any standard English question form is valid
     * Do NOT start with instructional openers: "Consider", "Imagine", "Describe",
       "Think about", "Let's", "Focus on", "Building on", "Leveraging", "Driving",
       "Ensuring", "Achieving", "You should", "They should"
     * Do NOT use financial terms (ROI, budget, revenue, profit, margin, investment)
     * Do NOT name specific senior roles (board, C-suite, shareholder, executive committee)
     * Must NOT repeat the main question's framing. Probe SPECIFIC angles:
       REIMAGINE subs: Observable, grounded in actual experience. NEVER "Imagine a world
         where...", "Describe the perfect...", "Paint the picture...". Instead:
         "What happens for customers when that part of the journey works really well?"
         "Where do you see that friction today, and what would be different?"
       CONSTRAINTS subs: Specific and probing. "Where do you see this getting blocked?"
         "What makes this difficult in practice?"
       DEFINE_APPROACH subs: Actionable and practical. "What happens first if we try this
         in practice?" "Where does this depend on cleaner handoffs?"
7. Commit the final question set with a design rationale and data confidence assessment.

QUESTION DESIGN PRINCIPLES:
- Questions are for a GROUP discussion, not individual interviews
- CRITICAL: Every question MUST be deeply specific to ${context.clientName || 'the client'}.
  Do NOT write generic template questions with a company name inserted.
  Instead, reference actual challenges, industry dynamics, and Discovery insights.
- HARD VALIDITY RULE: if a junior agent could not answer from lived experience,
  the question is invalid and must not be included.
- Every question must be answerable by agent, team leader, manager, and executive.
- EVERY main question and EVERY sub-question must be a genuine question in standard English.
  Any question form is valid: "What happens...", "Where do you see...", "How does...",
  "Which areas...", "When does...", "In what ways...", "Across the team...", "At what point..."
- Ask only about what people experience, what they see happening, where work gets
  stuck, what slows things down, what works well, and what gets repeated.
- Do NOT ask about financial performance, investment discipline, ROI, margin,
  cash flow, strategy effectiveness, or leadership decisions.
- For GO-TO-MARKET / Strategy workshops, the live questions must help the facilitator move the room from commercial truth to practical GTM choices. Do not write generic workshop prompts that could fit any company.
- NEVER open a question with instructional openers: "Consider", "Imagine", "Describe",
  "Think about", "Reflect on", "Let's", "Focus on", "Building on", "Leveraging",
  "Driving", "Ensuring", "Achieving", "You should", "They should".
- NEVER open with: "Who owns", "What is leadership doing", "Why don't they..."
- Keep each question to a single concept. Avoid combined abstractions like
  "effective and efficient" or "systemic inefficiencies".
- For REIMAGINE: Open-ended, aspirational, no mention of limitations
- For CONSTRAINTS: Specific, grounded in the vision they just created
- For DEFINE_APPROACH: Actionable, ownership-focused, outcome-oriented
- Include a mix of lens-specific and cross-cutting questions
- Each question should have a clear purpose and connection to known data

BANNED TEMPLATE PATTERNS - NEVER produce these sentence shapes:
These patterns appeared in earlier runs and produced generic corporate answers.
Do not use them even as inspiration for a rewrite.
  x "What are the root causes of..."
  x "What structural factors create and maintain..."
  x "What conditions must be true for X to be effective"
  x "What would removing X require from [company]?"
  x "What potential resistance might arise when implementing..."
  x "What is the real cost of maintaining these constraints"
  x "What specific X would need to happen for Y to succeed?"
  x "What would be the most ambitious/transformative/groundbreaking X that Y could achieve?"
  x "[Company] can take to improve X for better Y" (formulaic surface opener)
  x "What conditions need to be true for this X to be successful?"

QUESTION SHAPE VARIETY (MANDATORY):
Use a different opening shape for each question within a lens.
Across lenses in the same phase, vary shapes so no pattern repeats more than twice.
Draw from this library - do not default to "What does X look like":

  Observational:   "Where do you see...", "Which part of X creates the most Y..."
  Behavioural:     "Walk me through what happens when...", "When X comes up - what does that actually look like?"
  Consequence:     "What breaks first if...", "If you removed that tomorrow, what would it expose?"
  Grounding:       "Who ends up dealing with that - and what do they do?", "Where does time get lost most often?"
  Comparative:     "How does that compare to...", "What would your [customer/colleague] notice most?"
  Pressure:        "Why hasn't this been fixed yet?", "What's been protecting this from being resolved?"
  Prioritising:    "Which X creates the most Y...", "What's the one thing you'd change first?"
  Temporal:        "How long has that been a problem?", "When was the last time this worked well?"

GROUNDING REQUIREMENT:
At least ONE question per lens must anchor to something observable and real:
a specific place, a person who deals with it, or a moment when it shows up.
Not "what is the impact of X" - but "where does X show up", "who feels it first", "what does it look like when X happens".

MANDATORY QUALITY SELF-CHECK:
Before submitting any question, verify all three:
  1. Could a participant answer this with a safe, generic corporate response? → If yes, rewrite it.
  2. Does it sound like something a real facilitator would ask in a live room? → If no, rewrite it.
  3. Does it add a genuinely different angle from the other two questions for this lens? → If no, rewrite it.

LENS-SPECIFIC RULES:
- Operations: ask about flow, bottlenecks, delays, queueing, handoffs, and where work breaks down.
- People: ask about clarity, workload, capability, behaviour, and how work feels in practice.
- Technology: ask about tools, usability, friction, data gaps, and failure points.
- Commercial: treat this as customer experience and customer pain. Ask what customers experience or what teams see customers struggling with.
- Partners: ask about external dependencies, outsourced delivery, cross-team handoffs, and accountability gaps.
- Risk/Compliance: ask about rules, approvals, controls, and where they help or slow the work down.

EXAMPLES OF GOOD vs BAD QUESTIONS:

BAD (generic shell - do not write like this):
  "What does the ideal customer experience look like?"
  "What structural factors maintain the technology constraint?"
  "What conditions must be true for this improvement to be effective?"
  "What would removing these constraints require from the organisation?"
  "What is the real cost of maintaining current compliance constraints?"

GOOD (varied shapes, grounded, conversational):
  "Walk me through what happens when the technology fails mid-call for an agent."
  "Where in the operation does time get lost most often - and who carries that?"
  "Which partnership creates the most friction in the day-to-day right now?"
  "If you fixed this tomorrow, what would it immediately expose?"
  "What's been stopping this from being sorted - and what would finally shift it?"
  "When a compliance issue comes up - who deals with it, and what does that actually look like?"
  "What does the half-implemented version of this look like - and why would that be worse?"

The key differences: varied opening shapes, specific and observable, pressure
introduced through consequence not interrogation, no repeated template patterns.

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
  options?: { timeoutMs?: number; maxIterations?: number },
): Promise<WorkshopQuestionSet> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured \u2014 cannot run Question Set Agent');
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildQuestionSetSystemPrompt(context, research, discoveryBriefing);
  const timeoutMs = options?.timeoutMs ?? LOOP_TIMEOUT_MS;
  const maxIterations = options?.maxIterations ?? MAX_ITERATIONS;
  const startMs = Date.now();

  // Track designed phases as they come in
  const designedPhases = new Map<WorkshopPhase, FacilitationQuestion[]>();
  // Per-depth accumulator: preserves progress across partial submissions (per phase → lens → depth → question)
  // Allows model to submit 1 depth per lens per call and accumulate toward completion.
  const designedDepthSlots = new Map<WorkshopPhase, Map<string, Map<string, FacilitationQuestion>>>();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Please design a tailored set of workshop facilitation questions for ${context.clientName || 'this client'}. These questions will guide the facilitator through REIMAGINE, CONSTRAINTS, and DEFINE_APPROACH. Start by reviewing the research context and Discovery insights, then the phase structure, then design questions for each phase in order.`,
    },
  ];

  const ALL_PHASES: WorkshopPhase[] = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (Date.now() - startMs > timeoutMs) {
        console.log(`[Question Set Agent] Timeout after ${iteration} iterations`);
        break;
      }

      const isLastIteration = iteration === maxIterations - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'commit_question_set' } }
        : 'auto';

      console.log(`[Question Set Agent] Iteration ${iteration}${isLastIteration ? ' (forced commit)' : ''}`);

      const completion = await openAiBreaker.execute(() => openai.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        messages,
        tools: QUESTION_SET_TOOLS,
        tool_choice: toolChoice,
        parallel_tool_calls: true,
      }));

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

      // No tool calls — model wrote text instead of calling tools.
      // If phases are still missing, inject a direct instruction and continue.
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        const missingPhases = ALL_PHASES.filter(p => !designedPhases.get(p)?.length);
        if (missingPhases.length > 0 && !isLastIteration) {
          messages.push({
            role: 'user',
            content:
              `You must now call design_phase_questions for the missing phase(s): ${missingPhases.join(', ')}. ` +
              `Do NOT write a summary or explanation — call the tool directly for EACH missing phase, one call per phase. ` +
              `After all phases are designed, call commit_question_set.`,
          });
          continue;
        }
        break; // All phases done or last iteration — exit loop
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
          // Guard: all 3 phases must be designed before committing
          const missingPhases = ALL_PHASES.filter(p => !designedPhases.get(p)?.length);
          if (missingPhases.length > 0) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                error: `Cannot commit yet. The following phases have no questions: ${missingPhases.join(', ')}. You MUST call design_phase_questions for each missing phase before committing. Do it now.`,
              }),
            });
            console.log(`[Question Set Agent] Commit blocked — missing phases: ${missingPhases.join(', ')}`);
            continue; // don't set committed = true, keep iterating
          }

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

          const lensSourceLabel = getPhaseLensOrder('REIMAGINE', research, context.blueprint).source;
          const confidenceLabel = String(fnArgs.dataConfidence || 'moderate');
          const sufficiencyNotes = Array.isArray(fnArgs.dataSufficiencyNotes) ? fnArgs.dataSufficiencyNotes.map(String) : [];
          const sufficiencyBlock = sufficiencyNotes.length > 0
            ? `\n\n**Data Sufficiency Notes**\n${sufficiencyNotes.map(n => `  - ${n}`).join('\n')}`
            : '';
          onConversation?.({
            timestampMs: Date.now(),
            agent: 'question-set-agent',
            to: 'prep-orchestrator',
            message: `I've completed the workshop facilitation question set. **${totalQuestions} questions** across 3 phases (lensSource: ${lensSourceLabel}, confidence: ${confidenceLabel}).\n\n**Design Rationale**\n${String(fnArgs.designRationale || '')}${sufficiencyBlock}\n\n**Questions by Phase**\n${phasesSummary.join('\n')}`,
            type: 'proposal',
            metadata: {
              toolsUsed: ['get_research_context', 'get_discovery_insights', 'get_blueprint_constraints', 'get_workshop_phases', 'design_phase_questions'],
              lensSource: lensSourceLabel,
              dataConfidence: confidenceLabel,
            },
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: 'committed' }),
          });
        } else {
          const toolResult = executeQuestionSetTool(
            fnName, fnArgs, context, research, discoveryBriefing || null, designedPhases, designedDepthSlots,
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
          } else if (fnName === 'get_research_context' || fnName === 'get_discovery_insights' || fnName === 'get_blueprint_constraints' || fnName === 'get_workshop_phases') {
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
        const commitArgs = fnArgs_extract_full(messages);
        const questionSet = buildWorkshopQuestionSet(
          designedPhases,
          commitArgs.designRationale || 'Questions designed for workshop facilitation.',
          research,
          context.blueprint,
          (commitArgs.dataConfidence as DataConfidence) || 'moderate',
          commitArgs.dataSufficiencyNotes || [],
        );
        const validationError = validateQuestionSet(questionSet);
        if (validationError) {
          throw new Error(validationError);
        }
        return questionSet;
      }
    }

  // Loop exhausted without explicit commit. If all 3 phases are designed, build from what we have.
  // This handles the race condition where the LLM commits and designs a phase in the same
  // parallel call — the commit guard correctly blocked it, but the phase was stored in the
  // same iteration, and there were no remaining iterations for the retry commit.
  const REQUIRED_PHASES: WorkshopPhase[] = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];
  const stillMissing = REQUIRED_PHASES.filter(p => !designedPhases.get(p)?.length);
  if (stillMissing.length === 0) {
    console.log('[Question Set Agent] All phases designed — building from phases (no explicit commit)');
    const commitArgs = fnArgs_extract_full(messages);
    const questionSet = buildWorkshopQuestionSet(
      designedPhases,
      commitArgs.designRationale || 'Questions designed for workshop facilitation.',
      research,
      context.blueprint,
      (commitArgs.dataConfidence as DataConfidence) || 'moderate',
      commitArgs.dataSufficiencyNotes || [],
    );
    const validationError = validateQuestionSet(questionSet);
    if (validationError) {
      throw new Error(validationError);
    }
    return questionSet;
  }

  throw new Error(
    `[Question Set Agent] Loop ended without explicit commit — missing phases: ${stillMissing.join(', ')}. ` +
    'Re-run question generation to produce a valid question set.',
  );
}

// Helper to extract all commit args from the committed message
function fnArgs_extract_full(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): {
  designRationale: string;
  dataConfidence: string;
  dataSufficiencyNotes: string[];
} {
  for (const msg of messages) {
    if (msg.role === 'assistant' && 'tool_calls' in msg && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if (tc.type === 'function' && tc.function.name === 'commit_question_set') {
          try {
            const args = JSON.parse(tc.function.arguments);
            return {
              designRationale: String(args.designRationale || ''),
              dataConfidence: String(args.dataConfidence || 'moderate'),
              dataSufficiencyNotes: Array.isArray(args.dataSufficiencyNotes)
                ? args.dataSufficiencyNotes.map(String)
                : [],
            };
          } catch { /* ignore */ }
        }
      }
    }
  }
  return { designRationale: '', dataConfidence: 'moderate', dataSufficiencyNotes: [] };
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

/** @internal Exported for testing */
export function buildWorkshopQuestionSet(
  designedPhases: Map<WorkshopPhase, FacilitationQuestion[]>,
  designRationale: string,
  research?: WorkshopPrepResearch | null,
  blueprint?: WorkshopBlueprint | null,
  dataConfidence?: DataConfidence,
  dataSufficiencyNotes?: string[],
): WorkshopQuestionSet {
  const allPhases: WorkshopPhase[] = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];

  const phases = {} as WorkshopQuestionSet['phases'];

  for (const phase of allPhases) {
    const designed = designedPhases.get(phase);
    const phaseLabel = phase === 'DEFINE_APPROACH' ? 'Define Approach' : phase.charAt(0) + phase.slice(1).toLowerCase();
    const lenses = getPhaseLensOrder(phase, research, blueprint).lenses;

    if (!designed?.length) {
      throw new Error(
        `Phase "${phase}" has no questions — workshop question set is incomplete. ` +
        'Ensure the agent has committed questions for all phases before calling buildWorkshopQuestionSet().',
      );
    }

    phases[phase] = {
      label: phaseLabel,
      description: PHASE_GUIDANCE[phase],
      lensOrder: lenses,
      questions: designed,
    };
  }

  return {
    phases,
    designRationale,
    generatedAtMs: Date.now(),
    dataConfidence: dataConfidence ?? 'low',
    dataSufficiencyNotes: dataSufficiencyNotes ?? ['No data confidence assessment available'],
  };
}

function validateFacilitationQuestion(question: FacilitationQuestion): string[] {
  const issues: string[] = [];
  const mainValidationError = validateFacilitationQuestionText(question.text, question.lens);
  if (mainValidationError) {
    issues.push(mainValidationError);
  }

  for (const [index, subQuestion] of question.subQuestions.entries()) {
    const subValidationError = validateFacilitationQuestionText(subQuestion.text, subQuestion.lens ?? question.lens, true);
    if (subValidationError) {
      issues.push(`sub-question ${index + 1}: ${subValidationError}`);
    }
  }

  const texts = [
    question.text,
    ...question.subQuestions.map((subQuestion) => subQuestion.text),
  ].join(' ');
  return issues;
}
