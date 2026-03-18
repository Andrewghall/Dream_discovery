/**
 * DREAM Journey Completion Agent
 *
 * A GPT-4o-mini tool-calling agent that assesses customer journey map
 * completeness and identifies gaps. Works as a peer in the multi-agent
 * team, communicating through the Orchestrator.
 *
 * Called by the Facilitation Orchestrator when:
 * - The live journey has ≥1 interaction AND ≥5 beliefs accumulated
 *
 * Tracks: stages, actors, interactions, automation level (human/assisted/AI-only),
 * Day 1 vs end state, customer EQ, company urgency, proactive vs reactive,
 * pain points, moments of truth.
 *
 * Uses domain-specific naming (e.g., "student" for education, "patient" for healthcare).
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { GuidanceState, JourneyGap, JourneyGapType } from '../guidance-state';
import type { AgentConversationCallback, AgentReview } from './agent-types';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import {
  type JourneyAssessment,
  type SuggestedMutation,
  calculateDeterministicCompletion,
  buildJourneyContextString,
  getInteractionMissingFields,
} from '../journey-completion-state';

// ── Constants ───────────────────────────────────────────────

const MAX_ITERATIONS = 4;
const LOOP_TIMEOUT_MS = 10_000;
const MODEL = 'gpt-4o-mini';

// ══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const JOURNEY_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_journey_state',
      description: 'Get the current live journey map: stages, actors, and all interactions with their data completeness.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_existing_gaps',
      description: 'Get the current list of identified journey gaps and their resolution status.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assess_completion',
      description: 'Submit your assessment of journey map completeness. This is your commit tool --call it when you have analyzed the gaps.',
      parameters: {
        type: 'object',
        properties: {
          overallCompletionPercent: {
            type: 'number',
            description: 'Overall journey map completion (0-100).',
          },
          stageCompletionPercents: {
            type: 'object',
            description: 'Completion percent per stage (e.g., {"Discovery": 45, "Engagement": 20}).',
            additionalProperties: { type: 'number' },
          },
          actorCompletionPercents: {
            type: 'object',
            description: 'Completion percent per actor.',
            additionalProperties: { type: 'number' },
          },
          domainActorName: {
            type: 'string',
            description: 'Domain-specific name for the primary actor (e.g., "student" for education, "patient" for healthcare, "customer" if unknown).',
          },
          gaps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                gapType: {
                  type: 'string',
                  enum: [
                    'missing_stage', 'missing_channel', 'missing_actor_at_stage',
                    'missing_ai_agency', 'missing_automation_level',
                    'missing_sentiment', 'missing_pain_points',
                    'missing_day1_vs_future', 'missing_eq',
                    'missing_urgency', 'missing_proactive_reactive',
                    'sparse_interactions', 'missing_moments_of_truth',
                  ],
                },
                stage: { type: 'string', description: 'Relevant stage name (or null).' },
                actor: { type: 'string', description: 'Relevant actor name (or null).' },
                description: { type: 'string', description: 'What is missing.' },
                suggestedQuestion: { type: 'string', description: 'A question that would fill this gap.' },
                priority: { type: 'number', description: 'Priority 0-1 (1 = most urgent).' },
              },
              required: ['gapType', 'description', 'suggestedQuestion', 'priority'],
            },
            description: 'List of identified gaps in the journey map.',
          },
          suggestedPadPrompts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                prompt: { type: 'string', description: 'The question to ask the facilitator.' },
                gapId: { type: 'string', description: 'Which gap this addresses.' },
                stage: { type: 'string', description: 'Stage this relates to (or null).' },
                label: { type: 'string', description: 'Label like "Journey Mapping" or "Journey: Registration".' },
              },
              required: ['prompt', 'label'],
            },
            description: 'Ready-to-use prompts for the Facilitation Agent to generate as post-it pads.',
          },
        },
        required: ['overallCompletionPercent', 'gaps', 'domainActorName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_mutations',
      description: 'Propose structural mutations to the live journey map. Call AFTER assess_completion when you have enough evidence to suggest specific changes. Each mutation MUST include a confidence score (0-1). NEVER propose update_interaction for interactions where addedBy="facilitator".',
      parameters: {
        type: 'object',
        properties: {
          mutations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['add_stage', 'rename_stage', 'merge_stage', 'remove_stage', 'add_actor', 'rename_actor', 'add_interaction', 'update_interaction'],
                },
                payload: { type: 'object', description: 'Mutation-specific payload (e.g. { stageName } for add_stage, { interactionId, updates } for update_interaction).' },
                confidence: { type: 'number', description: '0-1. >0.75=high (auto-emitted), 0.5–0.75=medium (proposed to orchestrator), <0.5=low (ask a question instead).' },
                rationale: { type: 'string', description: 'Why you are proposing this mutation — cite specific participant speech or evidence.' },
                sourceNodeIds: { type: 'array', items: { type: 'string' }, description: 'Belief or utterance node IDs that justify this mutation.' },
                gapId: { type: 'string', description: 'Which gap ID this mutation resolves (optional).' },
              },
              required: ['type', 'payload', 'confidence', 'rationale'],
            },
          },
        },
        required: ['mutations'],
      },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

function executeJourneyTool(
  toolName: string,
  _args: Record<string, unknown>,
  liveJourney: LiveJourneyData,
  existingGaps: JourneyGap[],
): { result: string; summary: string } {
  switch (toolName) {
    case 'get_journey_state': {
      const completion = calculateDeterministicCompletion(liveJourney);

      // Build interaction summaries per stage
      const stageDetails: Record<string, Array<{
        id: string;
        actor: string;
        addedBy: string;
        action: string;
        hasChannel: boolean;
        hasSentiment: boolean;
        hasAiAgency: boolean;
        hasDay1VsFuture: boolean;
        hasPainPoint: boolean;
        hasMomentOfTruth: boolean;
        hasUrgency: boolean;
        missingFields: string[];
      }>> = {};

      for (const interaction of liveJourney.interactions) {
        if (!stageDetails[interaction.stage]) stageDetails[interaction.stage] = [];
        stageDetails[interaction.stage].push({
          id: interaction.id,
          actor: interaction.actor,
          addedBy: interaction.addedBy,
          action: interaction.action,
          hasChannel: !!(interaction.context && interaction.context.length > 0),
          hasSentiment: interaction.sentiment !== 'neutral',
          hasAiAgency: interaction.aiAgencyNow !== 'human' || interaction.aiAgencyFuture !== 'human',
          hasDay1VsFuture: interaction.aiAgencyNow !== interaction.aiAgencyFuture,
          hasPainPoint: interaction.isPainPoint,
          hasMomentOfTruth: interaction.isMomentOfTruth,
          hasUrgency: interaction.businessIntensity > 0,
          missingFields: getInteractionMissingFields(interaction),
        });
      }

      return {
        result: JSON.stringify({
          stages: liveJourney.stages,
          actors: liveJourney.actors.map(a => ({ name: a.name, role: a.role, mentions: a.mentionCount })),
          totalInteractions: liveJourney.interactions.length,
          stageDetails,
          completion,
        }),
        summary: `Journey: ${liveJourney.stages.length} stages, ${liveJourney.actors.length} actors, ${liveJourney.interactions.length} interactions (${completion.overallCompletionPercent}% complete)`,
      };
    }

    case 'get_existing_gaps': {
      return {
        result: JSON.stringify({
          totalGaps: existingGaps.length,
          unresolvedGaps: existingGaps.filter(g => !g.resolved).length,
          gaps: existingGaps.map(g => ({
            id: g.id,
            gapType: g.gapType,
            stage: g.stage,
            actor: g.actor,
            description: g.description,
            priority: g.priority,
            resolved: g.resolved,
          })),
        }),
        summary: `${existingGaps.filter(g => !g.resolved).length} unresolved gaps of ${existingGaps.length} total`,
      };
    }

    default:
      return { result: JSON.stringify({ error: 'Unknown tool' }), summary: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

function buildJourneySystemPrompt(
  guidanceState: GuidanceState,
  liveJourney: LiveJourneyData,
): string {
  const prep = guidanceState.prepContext;
  const bp = guidanceState.blueprint;
  const existing = guidanceState.journeyCompletionState;

  // Actor taxonomy from blueprint (falls back to generic industry inference)
  const actorSection = bp?.actorTaxonomy?.length
    ? `DOMAIN-SPECIFIC ACTORS:\n${bp.actorTaxonomy.map(a => `- ${a.label}: ${a.description}`).join('\n')}\nUse these actor names in your assessment and questions.`
    : 'DOMAIN-SPECIFIC NAMING:\nUse domain-specific actor names. For education: "student" not "customer". For healthcare: "patient". For retail: "shopper". For B2B: "client". Infer from the industry and context.';

  // Journey stages from blueprint
  const stageNames = bp?.journeyStages?.length
    ? bp.journeyStages.map(s => s.name)
    : null;
  const stageContext = stageNames
    ? `Blueprint journey stages: ${stageNames.join(', ')}`
    : '';

  return `You are the DREAM Journey Completion Agent. You track the customer journey map being built live during a workshop and identify gaps that need filling.

${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown industry'})` : ''}
${prep?.dreamTrack ? `DREAM Track: ${prep.dreamTrack}${prep.targetDomain ? ' / Focus: ' + prep.targetDomain : ''}` : ''}
Current workshop phase: ${guidanceState.dialoguePhase}
${existing?.domainActorName ? `Domain actor: ${existing.domainActorName}` : ''}
${stageContext}

YOUR ROLE:
You assess the customer journey map completeness and identify what's missing. You communicate gaps to the Orchestrator, who coordinates with the Facilitation Agent to generate questions.

JOURNEY DATA MODEL -- each interaction should ideally capture:
1. Action + channel (what happens and through what medium)
2. Sentiment / customer EQ (emotional state of the customer at this point)
3. AI agency level (human / assisted / AI-only) for current state
4. Automation level: Day 1 vs end state (how it changes over time)
5. Company urgency to engage (businessIntensity)
6. Proactive vs reactive (is the business initiating or responding?)
7. Pain points (specific friction or failure points)
8. Moments of truth (critical decision/experience points)

${actorSection}

Current journey state: ${liveJourney.stages.length} stages, ${liveJourney.actors.length} actors, ${liveJourney.interactions.length} interactions
${existing ? `Previous assessment: ${existing.overallCompletionPercent}% complete (assessment #${existing.assessmentCount})` : 'First assessment'}

RULES:
- Assess ALL dimensions: channels, AI agency, automation, Day 1 vs end state, EQ, urgency, proactive/reactive, pain points, moments of truth
- Prioritize gaps by impact: stages with zero interactions first, then sparse stages, then missing data fields
- Generate suggestedPadPrompts that are specific and actionable, not vague
- Use domain-specific actor names in all questions
- Each gap's suggestedQuestion should be something a facilitator can naturally ask the room

MUTATION PROPOSALS (call suggest_mutations AFTER assess_completion):
- Only propose mutations when get_journey_state shows specific missing fields you can infer from conversation context
- Confidence >0.75: unambiguous from evidence (e.g. "we handle this by phone" → channel=phone). Auto-emitted immediately.
- Confidence 0.5–0.75: reasonable evidence but some uncertainty. Proposed to orchestrator for review.
- Confidence <0.5: do NOT suggest a mutation — generate a pad prompt gap instead
- NEVER propose update_interaction for interactions where addedBy="facilitator"
- For structural gaps (stage mentioned in conversation but not in map), prefer add_stage`;
}

// ══════════════════════════════════════════════════════════════
// MAIN AGENT FUNCTION
// ══════════════════════════════════════════════════════════════

export async function runJourneyCompletionAgent(
  guidanceState: GuidanceState,
  liveJourney: LiveJourneyData,
  onConversation?: AgentConversationCallback,
): Promise<JourneyAssessment | null> {
  if (!env.OPENAI_API_KEY) return null;

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildJourneySystemPrompt(guidanceState, liveJourney);
  const startMs = Date.now();
  const existingGaps = guidanceState.journeyCompletionState?.gaps || [];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: 'Assess the current journey map completeness. Use get_journey_state to review what we have, then assess_completion with your findings. If get_journey_state reveals specific missing fields you can infer from context, call suggest_mutations after assess_completion.',
    },
  ];

  // Accumulate suggested mutations across all iterations
  const collectedMutations: SuggestedMutation[] = [];
  // Track whether assess_completion was called (mutations attach to its assessment)
  let pendingAssessment: JourneyAssessment | null = null;

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (Date.now() - startMs > LOOP_TIMEOUT_MS) break;

      const isLastIteration = iteration === MAX_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'assess_completion' } }
        : 'auto';

      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages,
        tools: JOURNEY_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        await onConversation?.({
          timestampMs: Date.now(),
          agent: 'journey-completion-agent',
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

        if (fnName === 'assess_completion') {
          // Parse the assessment
          const rawGaps = Array.isArray(fnArgs.gaps) ? fnArgs.gaps as Array<Record<string, unknown>> : [];
          const gaps: JourneyGap[] = rawGaps.map((g, i) => ({
            id: `jgap_${Date.now()}_${i}`,
            gapType: (String(g.gapType || 'sparse_interactions')) as JourneyGapType,
            stage: g.stage ? String(g.stage) : null,
            actor: g.actor ? String(g.actor) : null,
            description: String(g.description || ''),
            suggestedQuestion: String(g.suggestedQuestion || ''),
            priority: typeof g.priority === 'number' ? g.priority : 0.5,
            resolved: false,
          }));

          const rawPrompts = Array.isArray(fnArgs.suggestedPadPrompts)
            ? fnArgs.suggestedPadPrompts as Array<Record<string, unknown>>
            : [];

          pendingAssessment = {
            overallCompletionPercent: typeof fnArgs.overallCompletionPercent === 'number'
              ? fnArgs.overallCompletionPercent : 0,
            stageCompletionPercents: (fnArgs.stageCompletionPercents as Record<string, number>) || {},
            actorCompletionPercents: (fnArgs.actorCompletionPercents as Record<string, number>) || {},
            gaps,
            domainActorName: fnArgs.domainActorName ? String(fnArgs.domainActorName) : null,
            suggestedPadPrompts: rawPrompts.map(p => ({
              prompt: String(p.prompt || ''),
              gapId: String(p.gapId || ''),
              stage: p.stage ? String(p.stage) : null,
              label: String(p.label || 'Journey Mapping'),
            })),
          };

          // Emit conversation entry about the assessment
          const topGaps = gaps.filter(g => g.priority >= 0.6).slice(0, 3);
          const gapSummary = topGaps.length > 0
            ? `Top gaps: ${topGaps.map(g => `${g.stage || 'General'}: ${g.description}`).join('; ')}`
            : 'No critical gaps found.';

          await onConversation?.({
            timestampMs: Date.now(),
            agent: 'journey-completion-agent',
            to: 'orchestrator',
            message: `**Journey Assessment**: ${pendingAssessment.overallCompletionPercent}% complete. ${gaps.length} gaps identified. ${pendingAssessment.domainActorName ? `Using domain actor: "${pendingAssessment.domainActorName}".` : ''} ${gapSummary}`,
            type: 'proposal',
            metadata: { sourceCount: gaps.length },
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"submitted","note":"You may now call suggest_mutations if you have high-confidence structural changes to propose."}' });
          // Don't return yet — allow suggest_mutations in next iteration

        } else if (fnName === 'suggest_mutations') {
          const rawMuts = Array.isArray(fnArgs.mutations)
            ? fnArgs.mutations as Array<Record<string, unknown>>
            : [];
          for (const m of rawMuts) {
            collectedMutations.push({
              type: String(m.type || 'add_interaction') as SuggestedMutation['type'],
              payload: (m.payload as Record<string, unknown>) || {},
              confidence: typeof m.confidence === 'number' ? Math.max(0, Math.min(1, m.confidence)) : 0,
              rationale: String(m.rationale || ''),
              sourceNodeIds: Array.isArray(m.sourceNodeIds) ? (m.sourceNodeIds as string[]) : [],
              gapId: m.gapId ? String(m.gapId) : undefined,
            });
          }
          if (collectedMutations.length > 0) {
            await onConversation?.({
              timestampMs: Date.now(),
              agent: 'journey-completion-agent',
              to: 'orchestrator',
              message: `Proposed ${collectedMutations.length} mutation(s): ${collectedMutations.map(m => `${m.type} (${Math.round(m.confidence * 100)}% confidence)`).join(', ')}`,
              type: 'proposal',
            });
          }
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ status: 'acknowledged', count: rawMuts.length }) });

          // If we already have an assessment, we can return now
          if (pendingAssessment) {
            const finalAssessment: JourneyAssessment = {
              ...pendingAssessment,
              suggestedMutations: collectedMutations.length > 0 ? collectedMutations : undefined,
            };
            return finalAssessment;
          }

        } else {
          const toolResult = executeJourneyTool(fnName, fnArgs, liveJourney, existingGaps);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult.result });

          await onConversation?.({
            timestampMs: Date.now(),
            agent: 'journey-completion-agent',
            to: 'journey-completion-agent',
            message: `[Tool: ${fnName}] ${toolResult.summary}`,
            type: 'request',
            metadata: { toolsUsed: [fnName] },
          });
        }
      }

      // If we have a pending assessment and the agent didn't call suggest_mutations, return it
      if (pendingAssessment && !assistantMessage.tool_calls?.some(tc => tc.type === 'function' && tc.function.name === 'suggest_mutations')) {
        return {
          ...pendingAssessment,
          suggestedMutations: collectedMutations.length > 0 ? collectedMutations : undefined,
        };
      }
    }
  } catch (error) {
    console.error('[Journey Completion Agent] Failed:', error instanceof Error ? error.message : error);
  }

  // Return whatever we have
  if (pendingAssessment) {
    return {
      ...pendingAssessment,
      suggestedMutations: collectedMutations.length > 0 ? collectedMutations : undefined,
    };
  }

  return null;
}

// ══════════════════════════════════════════════════════════════
// REVIEW FUNCTION --for reviewing facilitation proposals
// ══════════════════════════════════════════════════════════════

const JOURNEY_REVIEW_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  JOURNEY_TOOLS[0], // get_journey_state
  JOURNEY_TOOLS[1], // get_existing_gaps
  {
    type: 'function',
    function: {
      name: 'submit_review',
      description: 'Submit your review of the facilitation proposals.',
      parameters: {
        type: 'object',
        properties: {
          stance: {
            type: 'string',
            enum: ['agree', 'challenge', 'build'],
            description: '"agree" if proposals help fill journey gaps, "challenge" if they duplicate covered ground or miss critical gaps, "build" if they are good but should also capture specific journey fields.',
          },
          feedback: { type: 'string', description: 'Your assessment from a journey-completeness perspective.' },
          suggestedChanges: { type: 'string', description: 'Specific suggestions to improve proposals.' },
        },
        required: ['stance', 'feedback'],
      },
    },
  },
];

export async function reviewWithJourneyAgent(
  proposals: string,
  guidanceState: GuidanceState,
  liveJourney: LiveJourneyData,
  onConversation?: AgentConversationCallback,
): Promise<AgentReview> {
  if (!env.OPENAI_API_KEY) {
    return { agent: 'Journey Agent', stance: 'agree', feedback: 'Journey Agent unavailable.' };
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const basePrompt = buildJourneySystemPrompt(guidanceState, liveJourney);
  const startMs = Date.now();
  const existingGaps = guidanceState.journeyCompletionState?.gaps || [];

  const journeyContext = buildJourneyContextString(guidanceState.journeyCompletionState);

  const systemPrompt = `${basePrompt}

REVIEW MODE: You are reviewing proposals from the Facilitation Agent. Assess them from a journey-completeness perspective.
${journeyContext ? `\nCURRENT JOURNEY STATE:\n${journeyContext}` : ''}

Your stance:
- "agree" --proposal helps fill a journey gap or is otherwise valuable
- "challenge" --proposal duplicates covered ground or misses a critical gap; suggest redirecting to unfilled gaps
- "build" --proposal is good but should ALSO capture specific journey fields (e.g., "also ask about automation level" or "also capture Day 1 vs end state")

Always suggest the most impactful journey data to collect next.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Review these proposals from the Facilitation Agent:\n\n${proposals}\n\nDo these help fill journey gaps? Use your tools to check the current journey state.`,
    },
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
        tools: JOURNEY_REVIEW_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        await onConversation?.({
          timestampMs: Date.now(),
          agent: 'journey-completion-agent',
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
            agent: 'Journey Agent',
            stance: (['agree', 'challenge', 'build'].includes(String(fnArgs.stance))
              ? String(fnArgs.stance) : 'agree') as AgentReview['stance'],
            feedback: String(fnArgs.feedback || 'No feedback provided.'),
            suggestedChanges: fnArgs.suggestedChanges ? String(fnArgs.suggestedChanges) : undefined,
          };

          await onConversation?.({
            timestampMs: Date.now(),
            agent: 'journey-completion-agent',
            to: 'facilitation-agent',
            message: `[${review.stance.toUpperCase()}] ${review.feedback}${review.suggestedChanges ? `\nSuggestion: ${review.suggestedChanges}` : ''}`,
            type: review.stance === 'challenge' ? 'challenge' : 'proposal',
          });

          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '{"status":"submitted"}' });
          return review;
        } else {
          const toolResult = executeJourneyTool(fnName, fnArgs, liveJourney, existingGaps);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult.result });
        }
      }
    }
  } catch (error) {
    console.error('[Journey Agent Review] Failed:', error instanceof Error ? error.message : error);
  }

  return { agent: 'Journey Agent', stance: 'agree', feedback: 'Review timed out --no objections raised.' };
}
