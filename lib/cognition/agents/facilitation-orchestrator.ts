/**
 * DREAM Facilitation Orchestrator — Live Facilitation Mode
 *
 * 4-agent architecture optimised for live workshop dynamics:
 * 1. ORCHESTRATOR — reads the room, coordinates the cycle (this file)
 * 2. FACILITATION AGENT — generates participant-anchored sub-questions
 * 3. GUARDIAN AGENT — validates grounding against cited beliefs
 * 4. JOURNEY COMPLETION AGENT — detects journey gaps, feeds to Facilitation Agent
 *
 * Theme, Research, Discovery, and Constraint agents are SUSPENDED
 * from real-time cycles. Their code is preserved but not invoked.
 *
 * Design principles:
 * - Stability, pace, cognitive clarity
 * - Participant-aligned language (verbatim grounding)
 * - Signal-driven question strategy (not agentic debate)
 * - ASK → PAUSE → PROBE rhythm
 * - Low latency (5-10s cycles, not 45-60s)
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CognitiveState } from '../cognitive-state';
import {
  getOrCreateGuidanceState,
  type GuidanceState,
} from '../guidance-state';
import { runFacilitationAgent, type DeliberationContext, type PadProposal } from './facilitation-agent';
import { validateReferences } from './guardian-agent';
import { runJourneyCompletionAgent } from './journey-completion-agent';
import {
  mergeAgentAssessment,
  buildJourneyContextString,
} from '../journey-completion-state';
import type { LiveJourneyData, LiveJourneyInteraction, AiAgencyLevel } from '@/lib/cognitive-guidance/pipeline';
import type { AgentConversationCallback } from './agent-types';

// ── Constants ───────────────────────────────────────────────

const MAX_VISIBLE_PADS = 4;                  // Max pads on screen per cycle
const MIN_EMISSION_INTERVAL_MS = 120_000;    // 2 min hard minimum between emissions
const PAD_GENERATION_INTERVAL_MS = 45_000;   // 45s between generation triggers
const PAD_UTTERANCE_THRESHOLD = 6;           // 6 utterances trigger
const ORCHESTRATOR_MODEL = 'gpt-4o-mini';
const MAX_ORCHESTRATOR_ITERATIONS = 4;       // assess → journey → facilitation → emit
const ORCHESTRATOR_TIMEOUT_MS = 25_000;      // 25s hard cap (allows journey agent call)

// ══════════════════════════════════════════════════════════════
// PACING GOVERNANCE (pre-LLM gating — saves cost)
// ══════════════════════════════════════════════════════════════

function shouldGeneratePads(
  cogState: CognitiveState,
  gs: GuidanceState,
): boolean {
  const now = Date.now();
  // Hard minimum interval — no pad bursts
  if (now - gs.lastPadGenerationAtMs < MIN_EMISSION_INTERVAL_MS) return false;
  if (now - gs.lastPadGenerationAtMs >= PAD_GENERATION_INTERVAL_MS) return true;
  if (gs.utterancesSinceLastPad >= PAD_UTTERANCE_THRESHOLD) return true;
  return false;
}

// ══════════════════════════════════════════════════════════════
// SIGNAL DETECTION — pure function, no LLM, no side effects
// ══════════════════════════════════════════════════════════════

type SessionSignal = {
  type: 'missing_dimension' | 'repeated_theme' | 'category_imbalance';
  description: string;
  lens: string | null;
  strength: number; // 0-1
};

function detectBeliefSignals(cogState: CognitiveState): SessionSignal[] {
  const signals: SessionSignal[] = [];
  const beliefs = Array.from(cogState.beliefs.values());
  if (beliefs.length < 3) return signals;

  const ALL_DOMAINS = ['People', 'Operations', 'Customer', 'Technology', 'Regulation'];

  // 1. Missing dimensions — domains with 0 beliefs after ≥5 total
  if (beliefs.length >= 5) {
    const domainCounts: Record<string, number> = {};
    for (const b of beliefs) {
      for (const d of b.domains) {
        domainCounts[d.domain] = (domainCounts[d.domain] || 0) + 1;
      }
    }
    for (const domain of ALL_DOMAINS) {
      if (!domainCounts[domain]) {
        signals.push({
          type: 'missing_dimension',
          description: `Nobody has mentioned anything about ${domain} yet`,
          lens: domain,
          strength: 1.0,
        });
      }
    }
  }

  // 2. Repeated themes — beliefs with duplicate semantic signatures
  const sigCounts = new Map<string, string[]>();
  for (const b of beliefs) {
    const sig = b.semanticSignature;
    if (sig) {
      const list = sigCounts.get(sig) || [];
      list.push(b.label);
      sigCounts.set(sig, list);
    }
  }
  for (const [, labels] of sigCounts) {
    if (labels.length >= 3) {
      signals.push({
        type: 'repeated_theme',
        description: `"${labels[0]}" keeps coming up (${labels.length} times) — worth probing deeper`,
        lens: null,
        strength: Math.min(1.0, labels.length / beliefs.length),
      });
    }
  }

  // 3. Category imbalance — lots of constraints but few enablers per domain
  const domainConstraints: Record<string, number> = {};
  const domainEnablers: Record<string, number> = {};
  for (const b of beliefs) {
    for (const d of b.domains) {
      if (b.category === 'constraint' || b.category === 'risk') {
        domainConstraints[d.domain] = (domainConstraints[d.domain] || 0) + 1;
      }
      if (b.category === 'enabler' || b.category === 'action') {
        domainEnablers[d.domain] = (domainEnablers[d.domain] || 0) + 1;
      }
    }
  }
  for (const domain of ALL_DOMAINS) {
    const constraints = domainConstraints[domain] || 0;
    const enablers = domainEnablers[domain] || 0;
    if (constraints >= 3 && enablers <= 1) {
      signals.push({
        type: 'category_imbalance',
        description: `${domain} has ${constraints} constraints but only ${enablers} enabler${enablers !== 1 ? 's' : ''} — who solves these?`,
        lens: domain,
        strength: (constraints - enablers) / constraints,
      });
    }
  }

  return signals;
}

// ══════════════════════════════════════════════════════════════
// JOURNEY DATA BUILDER — lightweight, from cognitive state actors
// ══════════════════════════════════════════════════════════════

function buildJourneyFromCogState(
  cogState: CognitiveState,
): LiveJourneyData {
  const stages = ['Discovery', 'Engagement', 'Commitment', 'Fulfilment', 'Support', 'Growth'];
  const actors: LiveJourneyData['actors'] = [];
  const interactions: LiveJourneyInteraction[] = [];

  const stageKeywords: Record<string, string[]> = {
    Discovery: ['discover', 'find', 'learn', 'awareness', 'search', 'browse', 'hear about'],
    Engagement: ['engage', 'interact', 'visit', 'explore', 'consider', 'evaluate', 'contact'],
    Commitment: ['commit', 'decide', 'purchase', 'buy', 'sign', 'agree', 'choose', 'select'],
    Fulfilment: ['deliver', 'receive', 'onboard', 'setup', 'implement', 'fulfil'],
    Support: ['support', 'help', 'assist', 'resolve', 'fix', 'service', 'issue'],
    Growth: ['retain', 'loyalty', 'expand', 'recommend', 'renew', 'grow'],
  };

  function inferStage(text: string): string {
    const lower = text.toLowerCase();
    let bestStage = stages[0];
    let bestCount = 0;
    for (const stage of stages) {
      const kws = stageKeywords[stage] || [];
      const count = kws.filter(kw => lower.includes(kw)).length;
      if (count > bestCount) { bestCount = count; bestStage = stage; }
    }
    return bestStage;
  }

  for (const actor of cogState.actors.values()) {
    actors.push({ name: actor.name, role: actor.role, mentionCount: actor.mentionCount });
    for (const interaction of actor.interactions) {
      interactions.push({
        id: `cog:${actor.name}:${interaction.utteranceId}`,
        actor: actor.name,
        stage: inferStage(interaction.action + ' ' + interaction.context),
        action: interaction.action,
        context: interaction.context,
        sentiment: (interaction.sentiment as LiveJourneyInteraction['sentiment']) || 'neutral',
        businessIntensity: 0.5,
        customerIntensity: 0.5,
        aiAgencyNow: 'human' as AiAgencyLevel,
        aiAgencyFuture: 'human' as AiAgencyLevel,
        isPainPoint: interaction.sentiment === 'critical',
        isMomentOfTruth: false,
        sourceNodeIds: [interaction.utteranceId],
        addedBy: 'ai',
        createdAtMs: Date.now(),
      });
    }
  }

  return { stages, actors, interactions };
}

// ══════════════════════════════════════════════════════════════
// ORCHESTRATOR TOOL DEFINITIONS — 4 tools
// ══════════════════════════════════════════════════════════════

const ORCHESTRATOR_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'assess_session',
      description: 'Read the room: beliefs, signal gaps, recent participant speech, phase context. Call this FIRST every cycle.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consult_journey_completion_agent',
      description: 'Ask the Journey Completion Agent to assess the customer journey map and identify gaps. Emits journey data to the UI and feeds gap context to the Facilitation Agent. Only useful when actors exist in the session.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_facilitation_proposals',
      description: 'Ask the Facilitation Agent to generate 1-3 sub-questions grounded in participant speech, signal gaps, and journey gaps.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verify_and_emit',
      description: 'Verify proposals have valid belief references and emit approved pads to the facilitator screen.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ══════════════════════════════════════════════════════════════
// ORCHESTRATOR SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════

function buildOrchestratorSystemPrompt(
  cogState: CognitiveState,
  guidanceState: GuidanceState,
): string {
  const prep = guidanceState.prepContext;
  const mainQ = guidanceState.currentMainQuestion;

  return `You are the DREAM Orchestrator. You coordinate a live workshop facilitation cycle. Be fast — the facilitator is waiting.

SESSION CONTEXT:
${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown'})` : 'No client context'}
${prep?.dreamTrack ? `DREAM Track: ${prep.dreamTrack}${prep.targetDomain ? ' — Focus: ' + prep.targetDomain : ''}` : ''}
Phase: ${guidanceState.dialoguePhase}
Beliefs: ${cogState.beliefs.size}
${mainQ ? `CURRENT MAIN QUESTION: "${mainQ.text}" (Purpose: ${mainQ.purpose})` : 'No main question active'}

YOUR PROCESS:
1. assess_session — read the room: beliefs, signals, gaps, recent participant speech
2. consult_journey_completion_agent — check journey map gaps (only if actors detected)
3. request_facilitation_proposals — generate sub-questions with signal + speech + journey context
4. verify_and_emit — verify belief references, emit approved pads to facilitator

RULES:
- Four tool calls max, done. No deliberation loops.
- Skip step 2 if assess_session shows no actors detected yet.
- NEVER skip assess_session — signals and speech are essential input.
- ${guidanceState.dialoguePhase === 'REIMAGINE' ? 'REIMAGINE PHASE: Everything must be aspirational. Zero constraints.' : guidanceState.dialoguePhase === 'CONSTRAINTS' ? 'CONSTRAINTS PHASE: Map real limitations. Be thorough and specific.' : 'DEFINE APPROACH PHASE: Solutions must be actionable and account for known constraints.'}
${guidanceState.surfacedPadPrompts.length > 0
  ? `\nAlready surfaced (${guidanceState.surfacedPadPrompts.length} pads). New proposals must cover DIFFERENT ground:\n${guidanceState.surfacedPadPrompts.map((p, i) => `  ${i + 1}. "${p.substring(0, 80)}"`).join('\n')}`
  : ''}`;
}

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ══════════════════════════════════════════════════════════════

async function executeOrchestratorTool(
  toolName: string,
  _args: Record<string, unknown>,
  cogState: CognitiveState,
  guidanceState: GuidanceState,
  onConversation: AgentConversationCallback | undefined,
  state: {
    deliberation: DeliberationContext;
    proposals: PadProposal[];
  },
  emitEvent: (type: string, payload: unknown) => void | Promise<void>,
): Promise<string> {
  const mainQ = guidanceState.currentMainQuestion;
  const prep = guidanceState.prepContext;

  switch (toolName) {
    // ── ASSESS SESSION ──────────────────────────────────────
    case 'assess_session': {
      // Domain + category counts
      const domainCounts: Record<string, number> = {};
      const categoryCounts: Record<string, number> = {};
      for (const b of cogState.beliefs.values()) {
        categoryCounts[b.category] = (categoryCounts[b.category] || 0) + 1;
        for (const d of b.domains) {
          domainCounts[d.domain] = (domainCounts[d.domain] || 0) + 1;
        }
      }

      // Detect signals
      const signals = detectBeliefSignals(cogState);

      // Recent speech — what participants actually said
      const recentSpeech = cogState.recentUtterances.slice(-10).map((u) =>
        `${u.speaker ? `[${u.speaker}]` : '[Speaker]'}: "${u.text}"`
      );

      // Store for downstream Facilitation Agent
      state.deliberation.signals = signals.length > 0
        ? signals.map((s) => `${s.type}: ${s.description}`).join('\n')
        : null;
      state.deliberation.recentUtterances = recentSpeech.length > 0
        ? recentSpeech.join('\n')
        : null;

      // Research highlights (from prep)
      let researchSummary = 'No research available.';
      if (prep?.research) {
        const r = prep.research;
        researchSummary = [
          r.companyOverview ? `Company: ${r.companyOverview.substring(0, 300)}` : null,
          r.industryContext ? `Industry: ${r.industryContext.substring(0, 300)}` : null,
          r.keyPublicChallenges?.length ? `Challenges: ${r.keyPublicChallenges.slice(0, 4).join('; ')}` : null,
        ].filter(Boolean).join('\n');
        state.deliberation.researchHighlights = researchSummary;
      }

      // Discovery highlights (from prep)
      let discoverySummary = 'No Discovery data available.';
      if (prep?.discoveryIntelligence) {
        const di = prep.discoveryIntelligence;
        discoverySummary = [
          `${di.participantCount || 0} participants interviewed.`,
          di.briefingSummary ? `Summary: ${di.briefingSummary.substring(0, 300)}` : null,
          di.painPoints?.length ? `Pain points: ${di.painPoints.slice(0, 3).map((p: { description?: string }) => p.description || p).join('; ')}` : null,
          di.aspirations?.length ? `Aspirations: ${di.aspirations.slice(0, 3).join('; ')}` : null,
        ].filter(Boolean).join('\n');
        state.deliberation.discoveryInsights = discoverySummary;
      }

      return JSON.stringify({
        beliefs: cogState.beliefs.size,
        domainCoverage: domainCounts,
        categoryCoverage: categoryCounts,
        signals: signals.map((s) => ({ type: s.type, description: s.description, lens: s.lens })),
        recentSpeech: recentSpeech.slice(-5),
        phase: guidanceState.dialoguePhase,
        mainQuestion: mainQ ? { text: mainQ.text, purpose: mainQ.purpose, phase: mainQ.phase } : null,
        research: researchSummary,
        discovery: discoverySummary,
      });
    }

    // ── CONSULT JOURNEY COMPLETION AGENT ─────────────────────
    case 'consult_journey_completion_agent': {
      const liveJourney = buildJourneyFromCogState(cogState);

      if (liveJourney.actors.length === 0) {
        return JSON.stringify({ skipped: true, reason: 'No actors detected yet.' });
      }

      await onConversation?.({
        timestampMs: Date.now(),
        agent: 'orchestrator',
        to: 'journey-completion-agent',
        message: `Assess journey map: ${liveJourney.actors.length} actors, ${liveJourney.interactions.length} interactions.`,
        type: 'handoff',
      });

      try {
        const assessment = await runJourneyCompletionAgent(guidanceState, liveJourney, onConversation);

        if (assessment) {
          // Merge into guidance state
          const currentJourneyState = guidanceState.journeyCompletionState || {
            overallCompletionPercent: 0,
            stageCompletionPercents: {},
            actorCompletionPercents: {},
            gaps: [],
            domainActorName: null,
            lastAssessedAtMs: 0,
            assessmentCount: 0,
          };

          guidanceState.journeyCompletionState = mergeAgentAssessment(currentJourneyState, assessment);

          // Build journey context for Facilitation Agent
          const journeyContext = buildJourneyContextString(guidanceState.journeyCompletionState);
          state.deliberation.journeyGaps = journeyContext;

          // Persist journey completion to outbox — updates journey visualization on the UI
          await emitEvent('journey.completion', {
            journeyCompletionState: guidanceState.journeyCompletionState,
          });

          const topGaps = assessment.gaps.filter(g => g.priority >= 0.5).slice(0, 3);
          return JSON.stringify({
            assessed: true,
            overallCompletion: assessment.overallCompletionPercent,
            gapCount: assessment.gaps.length,
            domainActor: assessment.domainActorName,
            topGaps: topGaps.map(g => ({
              type: g.gapType,
              stage: g.stage,
              description: g.description,
            })),
          });
        }

        return JSON.stringify({ assessed: false, reason: 'Journey Agent returned no assessment.' });
      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : 'Journey assessment failed' });
      }
    }

    // ── REQUEST FACILITATION PROPOSALS ──────────────────────
    case 'request_facilitation_proposals': {
      const deliberation: DeliberationContext = {
        researchHighlights: state.deliberation.researchHighlights || null,
        discoveryInsights: state.deliberation.discoveryInsights || null,
        signals: state.deliberation.signals || null,
        recentUtterances: state.deliberation.recentUtterances || null,
        journeyGaps: state.deliberation.journeyGaps || null,
      };

      await onConversation?.({
        timestampMs: Date.now(),
        agent: 'orchestrator',
        to: 'facilitation-agent',
        message: `Generate sub-questions.${mainQ ? ` GOAL: "${mainQ.text}"` : ''} Signals + speech context passed.`,
        type: 'handoff',
      });

      try {
        state.proposals = await runFacilitationAgent(cogState, guidanceState, onConversation, deliberation);

        if (state.proposals.length === 0) {
          return JSON.stringify({ proposalCount: 0, reason: 'Facilitation Agent had nothing to propose.' });
        }

        const summaries = state.proposals.map((p, i) =>
          `${i + 1}. [${p.pad.type}, ${p.pad.lens || 'General'}] "${p.pad.prompt}" — ${p.reasoning}`,
        );

        return JSON.stringify({ proposalCount: state.proposals.length, proposals: summaries });
      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : 'Facilitation failed' });
      }
    }

    // ── VERIFY AND EMIT ─────────────────────────────────────
    case 'verify_and_emit': {
      if (state.proposals.length === 0) {
        return JSON.stringify({ emitted: 0, reason: 'No proposals to verify.' });
      }

      // Pacing: cap at MAX_VISIBLE_PADS per emission
      const toVerify = state.proposals.slice(0, MAX_VISIBLE_PADS);
      let emitted = 0;
      const results: string[] = [];

      for (const proposal of toVerify) {
        // Deterministic safety filter — no LLM needed
        if (!validateReferences(proposal.sourceBeliefIds, cogState)) {
          results.push(`REJECTED (invalid refs): "${proposal.pad.prompt.substring(0, 60)}"`);
          continue;
        }
        if (proposal.sourceBeliefIds.length === 0) {
          results.push(`REJECTED (no citations): "${proposal.pad.prompt.substring(0, 60)}"`);
          continue;
        }

        // Approved — persist to outbox + emit
        await emitEvent('pad.generated', { pad: proposal.pad });
        guidanceState.surfacedPadPrompts.push(proposal.pad.prompt);
        emitted++;

        await onConversation?.({
          timestampMs: Date.now(),
          agent: 'orchestrator',
          to: '',
          message: `Emitted: "${proposal.pad.prompt.substring(0, 60)}..."`,
          type: 'acknowledgement',
        });

        results.push(`EMITTED: "${proposal.pad.prompt.substring(0, 60)}"`);
      }

      // Post-emission: reset tracking + clear proposals so loop terminates
      if (emitted > 0) {
        guidanceState.lastPadGenerationAtMs = Date.now();
        guidanceState.utterancesSinceLastPad = 0;
      }
      state.proposals = []; // Prevent re-verification on next iteration

      return JSON.stringify({ emitted, total: toVerify.length, results, done: true });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN ORCHESTRATION FUNCTION
// ══════════════════════════════════════════════════════════════

export async function runFacilitationOrchestrator(
  workshopId: string,
  cogState: CognitiveState,
  emitEvent: (type: string, payload: unknown) => void | Promise<void>,
  onConversation?: AgentConversationCallback,
): Promise<void> {
  const guidanceState = getOrCreateGuidanceState(workshopId);

  // Pre-LLM gates
  if (guidanceState.freeflowMode) return;
  if (cogState.beliefs.size < 3) return;

  guidanceState.utterancesSinceLastPad++;

  // Pacing: only run when generation is due
  if (!shouldGeneratePads(cogState, guidanceState)) return;

  if (!env.OPENAI_API_KEY) return;

  // Mark generation started
  guidanceState.lastPadGenerationAtMs = Date.now();
  guidanceState.utterancesSinceLastPad = 0;

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildOrchestratorSystemPrompt(cogState, guidanceState);
  const startMs = Date.now();

  // Mutable state shared across tool calls
  const orchestratorState = {
    deliberation: {} as DeliberationContext,
    proposals: [] as PadProposal[],
  };

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `${cogState.beliefs.size} beliefs accumulated. Generate facilitation sub-questions.`,
    },
  ];

  await onConversation?.({
    timestampMs: Date.now(),
    agent: 'orchestrator',
    to: '',
    message: `Cycle starting. ${cogState.beliefs.size} beliefs.`,
    type: 'info',
  });

  try {
    for (let iteration = 0; iteration < MAX_ORCHESTRATOR_ITERATIONS; iteration++) {
      if (Date.now() - startMs > ORCHESTRATOR_TIMEOUT_MS) {
        console.log(`[Orchestrator] Timeout after ${iteration} iterations`);
        if (orchestratorState.proposals.length > 0) {
          await executeOrchestratorTool(
            'verify_and_emit', {}, cogState, guidanceState,
            onConversation, orchestratorState, emitEvent,
          );
        }
        break;
      }

      const isLastIteration = iteration === MAX_ORCHESTRATOR_ITERATIONS - 1;
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = isLastIteration
        ? { type: 'function', function: { name: 'verify_and_emit' } }
        : 'auto';

      console.log(`[Orchestrator] Iteration ${iteration}${isLastIteration ? ' (forced commit)' : ''}`);

      const completion = await openai.chat.completions.create({
        model: ORCHESTRATOR_MODEL,
        temperature: 0.3,
        messages,
        tools: ORCHESTRATOR_TOOLS,
        tool_choice: toolChoice,
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.content?.trim()) {
        await onConversation?.({
          timestampMs: Date.now(),
          agent: 'orchestrator',
          to: '',
          message: assistantMessage.content.trim(),
          type: 'info',
        });
      }

      if (!assistantMessage.tool_calls?.length) {
        console.log(`[Orchestrator] No tool calls on iteration ${iteration} — done`);
        break;
      }

      let cycleComplete = false;
      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;
        try { fnArgs = JSON.parse(toolCall.function.arguments); } catch { fnArgs = {}; }

        console.log(`[Orchestrator] Tool: ${fnName}`);

        const result = await executeOrchestratorTool(
          fnName, fnArgs, cogState, guidanceState,
          onConversation, orchestratorState, emitEvent,
        );

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });

        // verify_and_emit is terminal — stop the entire cycle
        if (fnName === 'verify_and_emit') { cycleComplete = true; break; }
      }
      if (cycleComplete) break;
    }
  } catch (error) {
    console.error('[Orchestrator] Failed:', error instanceof Error ? error.message : error);

    await onConversation?.({
      timestampMs: Date.now(),
      agent: 'orchestrator',
      to: '',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'info',
    });

    // Safety net: emit any gathered proposals
    if (orchestratorState.proposals.length > 0) {
      try {
        await executeOrchestratorTool(
          'verify_and_emit', {}, cogState, guidanceState,
          onConversation, orchestratorState, emitEvent,
        );
      } catch {
        console.error('[Orchestrator] Recovery emit also failed');
      }
    }
  }
}
