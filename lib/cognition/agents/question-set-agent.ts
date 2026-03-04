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

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 6;
const LOOP_TIMEOUT_MS = 40_000;
const MODEL = 'gpt-4o-mini';

// ── Phase context: what lenses apply and in what order ──────

const DEFAULT_PHASE_LENS_ORDER: Record<WorkshopPhase, string[]> = {
  REIMAGINE: ['People', 'Customer', 'Organisation'],
  CONSTRAINTS: ['Regulation', 'Customer', 'Technology', 'Organisation', 'People'],
  DEFINE_APPROACH: ['People', 'Organisation', 'Technology', 'Customer', 'Regulation'],
};

/**
 * Get lens order for a phase.
 * Priority: blueprint phaseLensPolicy > research dimensions > hardcoded defaults.
 * Returns both the lens list and the source for tracking.
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
  return { lenses: DEFAULT_PHASE_LENS_ORDER[phase], source: 'generic_fallback' };
}

/** @deprecated Use getPhaseLensOrder - kept for backward compat */
const PHASE_LENS_ORDER = DEFAULT_PHASE_LENS_ORDER;

const PHASE_GUIDANCE: Record<WorkshopPhase, string> = {
  REIMAGINE: `REIMAGINE is the visionary phase. Participants paint a picture of the ideal future state WITHOUT constraints. No technology limitations, no budget concerns, no regulation barriers - just pure aspiration. The facilitator guides them through People, Customer, and Organisation lenses only. The goal is to get genuine, unconstrained thinking about what "great" looks like.`,

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
                  description: 'The dimension/lens this question addresses. Use the dimension names from get_workshop_phases (these may be research-derived industry dimensions or the default lenses). Use "General" for cross-cutting questions.',
                },
                text: {
                  type: 'string',
                  description: 'The facilitation question text - what the facilitator would ask the room.',
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
                        description: 'The dimension/lens this sub-question explores. Use dimension names from get_workshop_phases or "General".',
                      },
                      text: {
                        type: 'string',
                        description: 'The sub-question text - a specific angle or probe.',
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
              required: ['lens', 'text', 'purpose', 'grounding', 'subQuestions'],
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

      return {
        result: JSON.stringify({
          dreamTrack: context.dreamTrack,
          targetDomain: context.targetDomain,
          trackGuidance: trackContext,
          hasResearchedDimensions: lensSource === 'research_dimensions' || lensSource === 'domain_pack',
          lensSource,
          questionPolicy: { questionsPerPhase: qPerPhase, subQuestionsPerMain: subPerMain },
          journeyStages: bp?.journeyStages || null,
          phases: {
            REIMAGINE: {
              label: 'Reimagine',
              purpose: PHASE_GUIDANCE.REIMAGINE,
              lensOrder: reimagine.lenses,
              questionCount: questionCountLabel,
              keyPrinciple: 'NO constraints. Pure vision. Dream big.',
            },
            CONSTRAINTS: {
              label: 'Constraints',
              purpose: PHASE_GUIDANCE.CONSTRAINTS,
              lensOrder: constraints.lenses,
              questionCount: questionCountLabel,
              keyPrinciple: 'Map what stands in the way. Right-to-left through lenses.',
            },
            DEFINE_APPROACH: {
              label: 'Define Approach',
              purpose: PHASE_GUIDANCE.DEFINE_APPROACH,
              lensOrder: defineApproach.lenses,
              questionCount: questionCountLabel,
              keyPrinciple: 'Build the practical path forward. Left-to-right through lenses.',
            },
          },
        }),
        summary: `Retrieved workshop phase structure (lensSource: ${lensSource}). ${trackContext}\n\n3 phases: REIMAGINE (${reimagine.lenses.length} dimensions), CONSTRAINTS (${constraints.lenses.length} dimensions), DEFINE APPROACH (${defineApproach.lenses.length} dimensions).${lensSource !== 'generic_fallback' ? ` Using ${lensSource} dimensions: ${reimagine.lenses.join(', ')}.` : ' Using generic default lenses.'} Target: ${qPerPhase} questions/phase, ${subPerMain} sub-questions/main.${journeyStages ? `\n\n**Journey Stages:**\n${journeyStages}` : ''}`,
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
        lens: String(q.lens || 'General'),
        text: String(q.text || ''),
        purpose: String(q.purpose || ''),
        grounding: String(q.grounding || ''),
        order: i + 1,
        isEdited: false,
        subQuestions: Array.isArray(q.subQuestions)
          ? q.subQuestions.map((sq: Record<string, unknown>) => ({
              id: nanoid(8),
              lens: String(sq.lens || 'General'),
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
        summary: `**Designed ${phaseLabel} phase** - ${facilitation.length} facilitation questions\n\n${qLines}`,
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

3. DEFINE APPROACH (Build Solution)
   Dimensions: All (${research.industryDimensions.map(d => d.name).join(', ')})
   Goal: Design the practical path forward that bridges reality to vision.
   Key: Actionable, ownership-focused, measurable. "Who owns this? What's step one?"
` : `THE THREE WORKSHOP PHASES:

1. REIMAGINE (Pure Vision)
   Lenses: People, Customer, Organisation ONLY
   Goal: Get participants to paint the ideal future WITHOUT any constraints.
   No technology, no budget, no regulation - just what "amazing" looks like.
   Key: Open, aspirational, creative questions. "If you could wave a magic wand..."

2. CONSTRAINTS (Map Limitations - Right-to-Left)
   Lenses: Regulation, Customer, Technology, Organisation, People
   Goal: Systematically identify what stands between today and the reimagined vision.
   Start with hard external constraints and work inward.
   Key: Specific, probing, referencing the vision they just created.

3. DEFINE APPROACH (Build Solution - Left-to-Right)
   Lenses: People, Organisation, Technology, Customer, Regulation
   Goal: Design the practical path forward that bridges reality to vision.
   Key: Actionable, ownership-focused, measurable. "Who owns this? What's step one?"
`}${research?.journeyStages?.length ? `\nCUSTOMER JOURNEY STAGES:\n${research.journeyStages.map((s, i) => `  ${i + 1}. ${s.name}: ${s.description}`).join('\n')}\nReference these journey stages when grounding your questions.\n` : ''}${constraintsBlock}
YOUR APPROACH:
1. First, get the research context (company, industry, challenges).
2. Get Discovery insights if available (what participants already told us).
3. Get blueprint constraints (required/forbidden topics, focus areas, metrics).
4. Get the workshop phase structure (lens order, purpose).
5. For each phase in order (REIMAGINE, CONSTRAINTS, DEFINE_APPROACH):
   - Design ${bp?.questionPolicy?.questionsPerPhase ?? 5} facilitation questions per phase
   - Each question should follow the lens order for that phase
   - Questions MUST reference specific company context where possible
   - Questions should BUILD ON Discovery insights, not repeat them
   - If Discovery revealed a pain point, ask "how does this play into the
     constraints?" - don't ask "what are your pain points?" again
   - For EACH main question, generate ${bp?.questionPolicy?.subQuestionsPerMain ?? 3} starter sub-questions. These are
     specific angles or probes that immediately trigger dialogue when the
     facilitator activates the main question. Sub-questions should:
     * Each target a specific dimension from the workshop's lens set
     * Be directly scoped to the parent main question's topic
     * Reference concrete research/Discovery findings where possible
     * Give the room something tangible to discuss immediately
     * CRITICAL - sub-questions must NOT repeat the main question's framing.
       The main question already sets the aspirational/constraint/action frame.
       Sub-questions drill into SPECIFIC angles:
       REIMAGINE subs: The main question handles the "imagine the ideal" framing.
         Subs must probe SPECIFIC aspects - name a real finding from Discovery
         or research and ask about it. NEVER use generic patterns like
         "In your ideal...", "Describe the perfect...", "Paint the picture...",
         "What does the ideal future look like...", "Imagine a world where...".
         Instead: "Discovery flagged X as a pain point - in this reimagined
         future, how does that change?", "8 participants mentioned Y - what
         does Y look like when it's working brilliantly?"
       CONSTRAINTS subs should be specific, probing, grounded in the vision.
         Ask "what stands in the way?", "what limitations exist?"
       DEFINE_APPROACH subs should be actionable and ownership-focused.
         Ask "who owns this?", "what's step one?", "how do we prove it?"
6. Commit the final question set with a design rationale and data confidence assessment.

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
  "Your industry is seeing rapid adoption of checkout-free retail - Sainsbury's
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
  const systemPrompt = buildQuestionSetSystemPrompt(context, research, discoveryBriefing);
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

      // No tool calls - done
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

          const { source: lensSourceLabel } = getPhaseLensOrder('REIMAGINE', research, context.blueprint);
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
        return buildWorkshopQuestionSet(
          designedPhases,
          commitArgs.designRationale || 'Questions designed for workshop facilitation.',
          research,
          context.blueprint,
          (commitArgs.dataConfidence as DataConfidence) || 'moderate',
          commitArgs.dataSufficiencyNotes || [],
        );
      }
    }

    // Loop ended without commit -- build from whatever phases were designed
    console.log('[Question Set Agent] Loop ended without commit -- building from designed phases');
    return buildWorkshopQuestionSet(
      designedPhases,
      'Workshop facilitation questions designed based on company context.',
      research,
      context.blueprint,
      'moderate',
      ['Agent loop ended without explicit commit -- confidence assessment may be incomplete'],
    );
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
    const { lenses } = getPhaseLensOrder(phase, research, blueprint);

    phases[phase] = {
      label: phaseLabel,
      description: PHASE_GUIDANCE[phase],
      lensOrder: lenses,
      questions: designed || generateFallbackPhaseQuestions(phase),
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

function generateFallbackPhaseQuestions(phase: WorkshopPhase): FacilitationQuestion[] {
  type FallbackQ = { lens: string; text: string; purpose: string; subQuestions?: Array<{ lens: string; text: string; purpose: string }> };
  const fallbacks: Record<WorkshopPhase, FallbackQ[]> = {
    REIMAGINE: [
      { lens: 'General', text: 'If we could design the ideal future state for this business with no constraints at all, what does success look like in 3 years?', purpose: 'Opens the vision conversation with a broad, unconstrained prompt', subQuestions: [
        { lens: 'People', text: 'In this ideal future, how do people experience their work day? What makes it fulfilling?', purpose: 'Explore the human experience dimension' },
        { lens: 'Customer', text: 'Describe the perfect customer interaction from start to finish - what does effortless look like?', purpose: 'Paint the ideal customer experience' },
      ] },
      { lens: 'People', text: 'In this ideal future, how are the people in the organisation working? What does their day look like?', purpose: 'Explores the human dimension of the vision', subQuestions: [
        { lens: 'People', text: 'What new skills or capabilities do people have in this future?', purpose: 'Explore capability aspirations' },
        { lens: 'Organisation', text: 'How do teams collaborate differently in this vision?', purpose: 'Explore structural changes' },
      ] },
      { lens: 'Customer', text: 'What does the customer experience look like in this reimagined future? Walk me through a perfect interaction.', purpose: 'Gets specific about customer outcomes', subQuestions: [
        { lens: 'Customer', text: 'What does the customer never have to worry about in this future?', purpose: 'Identify friction points to eliminate' },
        { lens: 'People', text: 'How do front-line staff make customers feel in this ideal experience?', purpose: 'Connect people to customer outcomes' },
      ] },
      { lens: 'Organisation', text: 'How does the organisation need to be structured to deliver this vision? What changes?', purpose: 'Explores organisational design implications', subQuestions: [
        { lens: 'Organisation', text: 'What processes or structures disappear in this reimagined organisation?', purpose: 'Challenge existing structures' },
        { lens: 'People', text: 'Who are the new roles or functions that emerge?', purpose: 'Explore new capability needs' },
      ] },
      { lens: 'People', text: 'Who are the key actors and stakeholders that make this vision real? What roles matter most?', purpose: 'Identifies critical stakeholders and roles', subQuestions: [
        { lens: 'People', text: 'Which roles have the most impact on delivering the vision?', purpose: 'Prioritise stakeholder importance' },
        { lens: 'Customer', text: 'Who does the customer interact with most, and what does that relationship look like?', purpose: 'Map customer-facing roles' },
      ] },
      { lens: 'General', text: 'What are the top 3 measurable business outcomes that tell us we\'ve succeeded?', purpose: 'Anchors the vision in concrete outcomes', subQuestions: [
        { lens: 'Customer', text: 'What does the customer measure us by in this ideal state?', purpose: 'Define customer success metrics' },
        { lens: 'Organisation', text: 'What internal metrics shift most dramatically?', purpose: 'Identify organisational KPIs' },
      ] },
    ],
    CONSTRAINTS: [
      { lens: 'Regulation', text: 'What regulatory, compliance, or legal requirements must we work within? Which are non-negotiable?', purpose: 'Starts with hard external constraints', subQuestions: [
        { lens: 'Regulation', text: 'Which regulations have the most operational impact day-to-day?', purpose: 'Identify highest-friction regulations' },
        { lens: 'Technology', text: 'What technology limitations exist because of regulatory requirements?', purpose: 'Map regulation-technology overlap' },
      ] },
      { lens: 'Customer', text: 'What customer-side constraints exist? Budget limitations, adoption barriers, behavioural challenges?', purpose: 'Identifies customer-facing limitations', subQuestions: [
        { lens: 'Customer', text: 'What do customers resist most about change?', purpose: 'Understand adoption barriers' },
        { lens: 'People', text: 'How do customer constraints affect staff ways of working?', purpose: 'Connect customer to people constraints' },
      ] },
      { lens: 'Technology', text: 'What technology constraints are we dealing with? Legacy systems, integration challenges, data limitations?', purpose: 'Maps technical debt and platform constraints', subQuestions: [
        { lens: 'Technology', text: 'Which systems are the biggest blockers to progress?', purpose: 'Prioritise technical debt' },
        { lens: 'Organisation', text: 'What organisational decisions created these technology constraints?', purpose: 'Connect tech debt to governance' },
      ] },
      { lens: 'Organisation', text: 'What organisational constraints exist? Budget, structure, politics, competing priorities?', purpose: 'Surfaces internal organisational blockers', subQuestions: [
        { lens: 'Organisation', text: 'Which competing priorities most directly threaten this work?', purpose: 'Identify priority conflicts' },
        { lens: 'People', text: 'Where is political resistance strongest and why?', purpose: 'Map organisational politics' },
      ] },
      { lens: 'People', text: 'What people constraints apply? Skills gaps, capacity issues, change readiness, cultural resistance?', purpose: 'Identifies human factors that constrain progress', subQuestions: [
        { lens: 'People', text: 'What skills are we most lacking to deliver the vision?', purpose: 'Identify critical skill gaps' },
        { lens: 'Organisation', text: 'How does the current culture resist the change we need?', purpose: 'Map cultural barriers' },
      ] },
      { lens: 'General', text: 'Looking at all these constraints, which are absolute blockers versus conditions we can manage or work around?', purpose: 'Prioritises constraints by severity', subQuestions: [
        { lens: 'General', text: 'What constraints would disappear if we had full executive sponsorship?', purpose: 'Separate structural from political constraints' },
        { lens: 'General', text: 'Which constraints are we most able to influence or change?', purpose: 'Identify actionable constraints' },
      ] },
      { lens: 'General', text: 'Where does the vision from our Reimagine session most conflict with the reality of these constraints?', purpose: 'Connects constraints back to the vision', subQuestions: [
        { lens: 'General', text: 'What parts of the vision survive even the toughest constraints?', purpose: 'Find resilient vision elements' },
        { lens: 'General', text: 'Where must the vision adapt to constraint reality?', purpose: 'Identify required vision adjustments' },
      ] },
    ],
    DEFINE_APPROACH: [
      { lens: 'People', text: 'What do the people need to make this work? Training, new roles, different ways of working?', purpose: 'Starts with human needs and capabilities', subQuestions: [
        { lens: 'People', text: 'What training programme do we start in the first 90 days?', purpose: 'Define immediate people actions' },
        { lens: 'Organisation', text: 'Which teams need restructuring to support this approach?', purpose: 'Connect people to org changes' },
      ] },
      { lens: 'Organisation', text: 'How does the organisation need to change? New processes, governance structures, ways of measuring success?', purpose: 'Designs organisational enablers', subQuestions: [
        { lens: 'Organisation', text: 'What governance model ensures accountability without bureaucracy?', purpose: 'Design lean governance' },
        { lens: 'General', text: 'How do we measure progress in the first 6 months?', purpose: 'Define success metrics' },
      ] },
      { lens: 'Technology', text: 'What technology enables this approach? What do we build, buy, or integrate?', purpose: 'Identifies technology requirements', subQuestions: [
        { lens: 'Technology', text: 'What quick-win technology changes can we make in the first quarter?', purpose: 'Identify immediate tech wins' },
        { lens: 'Customer', text: 'Which technology change has the biggest customer impact?', purpose: 'Prioritise by customer value' },
      ] },
      { lens: 'Customer', text: 'How do we prove the customer outcome? What does the customer journey look like in practice?', purpose: 'Validates the customer experience design', subQuestions: [
        { lens: 'Customer', text: 'What is the first customer touchpoint we redesign?', purpose: 'Define starting point for CX improvement' },
        { lens: 'People', text: 'Who owns the customer experience end-to-end?', purpose: 'Assign CX ownership' },
      ] },
      { lens: 'Regulation', text: 'How do we satisfy the regulatory requirements we identified while still delivering the vision?', purpose: 'Ensures compliance is designed in', subQuestions: [
        { lens: 'Regulation', text: 'What compliance work can run in parallel with delivery?', purpose: 'Parallelise compliance' },
        { lens: 'Organisation', text: 'Who owns the regulatory relationship going forward?', purpose: 'Assign regulatory ownership' },
      ] },
      { lens: 'General', text: 'Who owns each workstream? What are the immediate next steps and quick wins?', purpose: 'Drives toward actionable ownership', subQuestions: [
        { lens: 'People', text: 'Who is the single accountable person for each workstream?', purpose: 'Drive individual accountability' },
        { lens: 'General', text: 'What can we deliver in the first 2 weeks to build momentum?', purpose: 'Create early wins' },
      ] },
      { lens: 'General', text: 'What does the 90-day plan look like? What can we start tomorrow?', purpose: 'Creates urgency and near-term commitments', subQuestions: [
        { lens: 'General', text: 'What is the single most impactful action we take in week one?', purpose: 'Drive immediate action' },
        { lens: 'Organisation', text: 'What governance cadence keeps this on track - weekly, fortnightly?', purpose: 'Establish rhythm' },
      ] },
    ],
  };

  return (fallbacks[phase] || []).map((q, i) => ({
    id: nanoid(8),
    phase,
    lens: q.lens,
    text: q.text,
    purpose: q.purpose,
    grounding: 'Generic facilitation question - not tailored to specific client context.',
    order: i + 1,
    isEdited: false,
    subQuestions: (q.subQuestions || []).map((sq) => ({
      id: nanoid(8),
      lens: sq.lens,
      text: sq.text,
      purpose: sq.purpose,
    })),
  }));
}

function fallbackQuestionSet(context: PrepContext): WorkshopQuestionSet {
  return buildWorkshopQuestionSet(
    new Map(),
    `Generic workshop facilitation questions for ${context.clientName || 'the client'}. These have not been tailored to specific company context or Discovery insights -- the facilitator should review and modify as needed.`,
    null,
    context.blueprint,
    'low',
    ['Fallback question set used -- agent could not complete design'],
  );
}
