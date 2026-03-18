/**
 * DREAM Facilitation Orchestrator --Live Facilitation Mode
 *
 * 4-agent architecture optimised for live workshop dynamics:
 * 1. ORCHESTRATOR --reads the room, coordinates the cycle (this file)
 * 2. FACILITATION AGENT --generates participant-anchored sub-questions
 * 3. GUARDIAN AGENT --validates grounding against cited beliefs
 * 4. JOURNEY COMPLETION AGENT --detects journey gaps, feeds to Facilitation Agent
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
import { runJourneyEnrichmentAgent, type JourneyEnrichment } from './journey-enrichment-agent';
import {
  mergeAgentAssessment,
  buildJourneyContextString,
  partitionMutationsByConfidence,
} from '../journey-completion-state';
import type { LiveJourneyData, LiveJourneyInteraction, AiAgencyLevel, StickyPad } from '@/lib/cognitive-guidance/pipeline';
import type { AgentConversationCallback } from './agent-types';
import type { JourneyMutationIntent } from './journey-mutation-types';
import { buildMetricsSummary, analyzeMetricTrends } from '@/lib/historical-metrics/summarize';

// ── Constants ───────────────────────────────────────────────

// Pacing defaults (overridden by blueprint.pacing when available)
const DEFAULT_MAX_VISIBLE_PADS = 4;
const DEFAULT_MIN_EMISSION_INTERVAL_MS = 120_000;
const DEFAULT_PAD_GENERATION_INTERVAL_MS = 45_000;
const DEFAULT_PAD_UTTERANCE_THRESHOLD = 6;

const ORCHESTRATOR_MODEL = 'gpt-4o-mini';
const MAX_ORCHESTRATOR_ITERATIONS = 6;       // assess -> journey -> enrichment -> mutations -> facilitation -> emit
const ORCHESTRATOR_TIMEOUT_MS = 30_000;      // 30s hard cap (allows journey + enrichment calls)
const MIN_ENRICHMENT_INTERVAL_MS = 180_000;  // 3 min between enrichment runs
const MIN_ENRICHMENT_INTERACTIONS = 3;       // Need >=3 interactions to enrich
const MIN_ENRICHMENT_BELIEFS = 5;            // Need >=5 beliefs for enrichment

// Default lens names (overridden by blueprint.lenses when available)
const DEFAULT_DOMAINS = ['People', 'Operations', 'Customer', 'Technology', 'Regulation'];

// Default journey stages (overridden by blueprint.journeyStages when available)
const DEFAULT_STAGES = ['Discovery', 'Engagement', 'Commitment', 'Fulfilment', 'Support', 'Growth'];

// ══════════════════════════════════════════════════════════════
// BLUEPRINT-AWARE HELPERS
// ══════════════════════════════════════════════════════════════

function getPacing(gs: GuidanceState) {
  const bp = gs.blueprint;
  return {
    maxVisiblePads: bp?.pacing?.maxVisiblePads ?? DEFAULT_MAX_VISIBLE_PADS,
    minEmissionIntervalMs: bp?.pacing?.minEmissionIntervalMs ?? DEFAULT_MIN_EMISSION_INTERVAL_MS,
    padGenerationIntervalMs: bp?.pacing?.padGenerationIntervalMs ?? DEFAULT_PAD_GENERATION_INTERVAL_MS,
    padUtteranceThreshold: bp?.pacing?.padUtteranceThreshold ?? DEFAULT_PAD_UTTERANCE_THRESHOLD,
  };
}

function getActiveLensNames(gs: GuidanceState): string[] {
  return gs.blueprint?.lenses?.map(l => l.name) ?? DEFAULT_DOMAINS;
}

function getActiveJourneyStages(gs: GuidanceState): string[] {
  return gs.blueprint?.journeyStages?.map(s => s.name) ?? DEFAULT_STAGES;
}

// ══════════════════════════════════════════════════════════════
// PACING GOVERNANCE (pre-LLM gating -- saves cost)
// ══════════════════════════════════════════════════════════════

function shouldGeneratePads(
  cogState: CognitiveState,
  gs: GuidanceState,
): boolean {
  const pacing = getPacing(gs);
  const now = Date.now();
  // Hard minimum interval -- no pad bursts
  if (now - gs.lastPadGenerationAtMs < pacing.minEmissionIntervalMs) return false;
  if (now - gs.lastPadGenerationAtMs >= pacing.padGenerationIntervalMs) return true;
  if (gs.utterancesSinceLastPad >= pacing.padUtteranceThreshold) return true;
  return false;
}

// ══════════════════════════════════════════════════════════════
// SIGNAL DETECTION --pure function, no LLM, no side effects
// ══════════════════════════════════════════════════════════════

type SessionSignal = {
  type: 'missing_dimension' | 'repeated_theme' | 'category_imbalance' | 'metric_contradiction';
  description: string;
  lens: string | null;
  strength: number; // 0-1
  metricEvidence?: string | null;
};

function detectBeliefSignals(cogState: CognitiveState, gs: GuidanceState): SessionSignal[] {
  const signals: SessionSignal[] = [];
  const beliefs = Array.from(cogState.beliefs.values());
  if (beliefs.length < 3) return signals;

  const ALL_DOMAINS = getActiveLensNames(gs);

  // 1. Missing dimensions --domains with 0 beliefs after ≥5 total
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

  // 2. Repeated themes --beliefs with duplicate semantic signatures
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
        description: `"${labels[0]}" keeps coming up (${labels.length} times) --worth probing deeper`,
        lens: null,
        strength: Math.min(1.0, labels.length / beliefs.length),
      });
    }
  }

  // 3. Category imbalance --lots of constraints but few enablers per domain
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
        description: `${domain} has ${constraints} constraints but only ${enablers} enabler${enablers !== 1 ? 's' : ''} --who solves these?`,
        lens: domain,
        strength: (constraints - enablers) / constraints,
      });
    }
  }

  // 4. Metric contradictions --beliefs that conflict with historical trend data
  // Only in CONSTRAINTS and DEFINE_APPROACH phases (not REIMAGINE -- preserve creative freedom)
  if (gs.historicalMetrics && gs.dialoguePhase !== 'REIMAGINE' && gs.dialoguePhase !== 'SYNTHESIS') {
    const trends = analyzeMetricTrends(gs.historicalMetrics);
    const significantTrends = trends.filter(
      (t) => t.trend !== 'stable' && t.trend !== 'insufficient_data' && t.changePercent !== null && Math.abs(t.changePercent) > 5
    );

    // Positive-claim keywords
    const positivePatterns = /\b(great|good|excellent|strong|improving|best|low|fast|quick|efficient|high satisfaction)\b/i;
    // Negative-claim keywords
    const negativePatterns = /\b(bad|poor|terrible|slow|high|rising|increasing|worst|declining|struggling|failing)\b/i;

    for (const trend of significantTrends) {
      const metricLabel = trend.metricLabel.toLowerCase();
      const metricKey = trend.metricKey.toLowerCase();

      for (const b of beliefs) {
        const text = b.label.toLowerCase();
        // Check if belief mentions this metric by label or key
        if (!text.includes(metricLabel) && !text.includes(metricKey)) continue;

        const hasPositiveClaim = positivePatterns.test(text);
        const hasNegativeClaim = negativePatterns.test(text);
        if (!hasPositiveClaim && !hasNegativeClaim) continue;

        // Contradiction: positive claim + increasing bad metric OR negative claim + improving metric
        const isContradiction =
          (hasPositiveClaim && trend.trend === 'increasing' && trend.changePercent !== null && trend.changePercent > 5) ||
          (hasPositiveClaim && trend.trend === 'decreasing' && trend.changePercent !== null && trend.changePercent < -5) ||
          (hasNegativeClaim && trend.trend === 'decreasing' && trend.changePercent !== null && trend.changePercent < -5) ||
          (hasNegativeClaim && trend.trend === 'increasing' && trend.changePercent !== null && trend.changePercent > 5);

        if (isContradiction) {
          const directionWord = trend.trend === 'increasing' ? 'rising' : 'falling';
          const changeStr = trend.changePercent !== null ? `${Math.abs(trend.changePercent).toFixed(1)}%` : '';
          signals.push({
            type: 'metric_contradiction',
            description: `Someone said "${b.label.substring(0, 60)}" but ${trend.metricLabel} has been ${directionWord} ${changeStr} -- worth probing`,
            lens: null,
            strength: Math.min(1.0, Math.abs(trend.changePercent || 0) / 20),
            metricEvidence: `${trend.metricLabel}: ${trend.latestValue} ${trend.unit} (${trend.trend} ${changeStr})`,
          });
          break; // One signal per trend is enough
        }
      }
    }
  }

  return signals;
}

// ══════════════════════════════════════════════════════════════
// SUGGESTED PAD → STICKY PAD BUILDER
// ══════════════════════════════════════════════════════════════

function buildStickyPadFromSuggestion(
  sp: { prompt: string; gapId: string; stage: string | null; label: string },
  guidanceState: GuidanceState,
): StickyPad {
  const mainQIndex = guidanceState.currentMainQuestion
    ? 0 // Will be enriched by the client-side pad state machine
    : null;

  return {
    id: `journey-gap:${sp.gapId || Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    type: 'GAP_PROBE',
    prompt: sp.prompt,
    signalStrength: 0.8,
    provenance: {
      triggerType: 'repeated_theme',
      sourceNodeIds: [],
      description: `Journey gap: ${sp.label}${sp.stage ? ` (stage: ${sp.stage})` : ''}`,
    },
    createdAtMs: Date.now(),
    status: 'active',
    snoozedUntilMs: null,
    source: 'agent',
    questionId: null,
    grounding: sp.label,
    coveragePercent: 0,
    coverageState: 'active',
    lens: null,
    mainQuestionIndex: mainQIndex,
    journeyGapId: sp.gapId || null,
    padLabel: sp.label,
  };
}

// ══════════════════════════════════════════════════════════════
// JOURNEY DATA BUILDER --lightweight, from cognitive state actors
// ══════════════════════════════════════════════════════════════

function buildJourneyFromCogState(
  cogState: CognitiveState,
  gs: GuidanceState,
): LiveJourneyData {
  const stages = getActiveJourneyStages(gs);
  const actors: LiveJourneyData['actors'] = [];
  const interactions: LiveJourneyInteraction[] = [];

  // Default stage keywords for standard stages; custom stages get their
  // lowercase name as a keyword so inferStage still has something to match.
  const STANDARD_STAGE_KEYWORDS: Record<string, string[]> = {
    Discovery: ['discover', 'find', 'learn', 'awareness', 'search', 'browse', 'hear about'],
    Engagement: ['engage', 'interact', 'visit', 'explore', 'consider', 'evaluate', 'contact'],
    Commitment: ['commit', 'decide', 'purchase', 'buy', 'sign', 'agree', 'choose', 'select'],
    Fulfilment: ['deliver', 'receive', 'onboard', 'setup', 'implement', 'fulfil'],
    Support: ['support', 'help', 'assist', 'resolve', 'fix', 'service', 'issue'],
    Growth: ['retain', 'loyalty', 'expand', 'recommend', 'renew', 'grow'],
  };
  const stageKeywords: Record<string, string[]> = {};
  for (const stage of stages) {
    stageKeywords[stage] = STANDARD_STAGE_KEYWORDS[stage] ?? [stage.toLowerCase()];
  }

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
// ORCHESTRATOR TOOL DEFINITIONS --4 tools
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
      name: 'consult_journey_enrichment_agent',
      description: 'Ask the Journey Enrichment Agent to populate AI agency levels, intensity scores, risk exposure, and governance overlays for journey interactions. Only useful when ≥3 interactions AND ≥5 beliefs exist, and at least 3 minutes since last enrichment.',
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
      name: 'emit_journey_mutations',
      description: 'Emit structural mutations to the live journey map (add/rename/merge/remove stages and actors, add interactions). Use after journey assessment reveals structural changes needed.',
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
                payload: { type: 'object' },
                sourceNodeIds: { type: 'array', items: { type: 'string' } },
              },
              required: ['type', 'payload'],
            },
          },
        },
        required: ['mutations'],
      },
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
  const bp = guidanceState.blueprint;

  // Blueprint context: active lenses, journey stages, actor taxonomy
  const lensNames = getActiveLensNames(guidanceState);
  const stageNames = getActiveJourneyStages(guidanceState);
  const actorTaxonomy = bp?.actorTaxonomy;
  const blueprintSection = [
    `Active lenses: ${lensNames.join(', ')}`,
    `Journey stages: ${stageNames.join(', ')}`,
    actorTaxonomy?.length
      ? `Actor taxonomy: ${actorTaxonomy.map(a => `${a.label} (${a.description})`).join(', ')}`
      : null,
  ].filter(Boolean).join('\n');

  // Historical performance section
  const metricsSection = guidanceState.historicalMetrics
    ? `\nHISTORICAL PERFORMANCE:\n${buildMetricsSummary(guidanceState.historicalMetrics)}\nCheck participant claims against these baselines. Flag contradictions.`
    : '';

  return `You are the DREAM Orchestrator. You coordinate a live workshop facilitation cycle. Be fast, the facilitator is waiting.

SESSION CONTEXT:
${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown'})` : 'No client context'}
${prep?.dreamTrack ? `DREAM Track: ${prep.dreamTrack}${prep.targetDomain ? ' / Focus: ' + prep.targetDomain : ''}` : ''}
Phase: ${guidanceState.dialoguePhase}
Beliefs: ${cogState.beliefs.size}
${mainQ ? `CURRENT MAIN QUESTION: "${mainQ.text}" (Purpose: ${mainQ.purpose})` : 'No main question active'}

BLUEPRINT:
${blueprintSection}${metricsSection}

YOUR PROCESS:
1. assess_session: read the room (beliefs, signals, gaps, recent participant speech)
2. consult_journey_completion_agent: check journey map gaps (only if actors detected)
3. consult_journey_enrichment_agent: enrich interactions with AI agency, intensity, risk (only if >=3 interactions AND >=5 beliefs)
4. emit_journey_mutations: emit structural journey changes if assessment reveals them (add/rename/merge stages or actors). Prefer blueprint journey stages but allow new stages when the conversation reveals them.
5. request_facilitation_proposals: generate sub-questions with signal + speech + journey context
6. verify_and_emit: verify belief references, emit approved pads to facilitator

RULES:
- Six tool calls max, done. No deliberation loops.
- Skip step 2 if assess_session shows no actors detected yet.
- Skip step 3 if insufficient data (< 3 interactions or < 5 beliefs) or enriched recently.
- NEVER skip assess_session, signals and speech are essential input.
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
  workshopId: string,
  state: {
    deliberation: DeliberationContext;
    proposals: PadProposal[];
    emittedSuggestionKeys: Set<string>;
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
      const signals = detectBeliefSignals(cogState, guidanceState);

      // Recent speech -- what participants actually said
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

      // Historical metrics context (from prep)
      if (guidanceState.historicalMetrics) {
        state.deliberation.metricsContext = buildMetricsSummary(guidanceState.historicalMetrics);
      }

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
        historicalMetrics: guidanceState.historicalMetrics
          ? buildMetricsSummary(guidanceState.historicalMetrics)
          : null,
      });
    }

    // ── CONSULT JOURNEY COMPLETION AGENT ─────────────────────
    case 'consult_journey_completion_agent': {
      const liveJourney = buildJourneyFromCogState(cogState, guidanceState);

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

          // Persist journey completion + live journey data to outbox
          await emitEvent('journey.completion', {
            journeyCompletionState: guidanceState.journeyCompletionState,
            liveJourney,  // Full actor + interaction data from cogState
          });

          // ── Confidence gate for suggested mutations ──────────
          let mutationsEmitted = 0;
          let mutationsProposed = 0;
          if (assessment.suggestedMutations && assessment.suggestedMutations.length > 0) {
            const { highConfidence, mediumConfidence, lowConfidence } =
              partitionMutationsByConfidence(assessment.suggestedMutations);

            // HIGH confidence (>0.75): emit journey.mutation immediately
            for (const m of highConfidence) {
              const intent: JourneyMutationIntent = {
                id: `jca:${m.type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
                type: m.type as JourneyMutationIntent['type'],
                payload: m.payload,
                sourceNodeIds: m.sourceNodeIds,
                emittedAtMs: Date.now(),
              };
              await emitEvent('journey.mutation', intent);
              await onConversation?.({
                timestampMs: Date.now(),
                agent: 'journey-completion-agent',
                to: '',
                message: `[HIGH CONFIDENCE] Journey mutation emitted: ${m.type} — ${m.rationale}`,
                type: 'info',
              });
              mutationsEmitted++;
            }

            // MEDIUM confidence (0.5–0.75): fold into journeyGaps context for orchestrator review
            if (mediumConfidence.length > 0) {
              const proposedLines = mediumConfidence.map(m =>
                `PROPOSED MUTATION [${m.type}, ${Math.round(m.confidence * 100)}% confidence]: ${m.rationale}`
              ).join('\n');
              const existingGaps = state.deliberation.journeyGaps || '';
              state.deliberation.journeyGaps = existingGaps
                ? `${existingGaps}\n\nPROPOSED MUTATIONS (medium confidence — review before emitting):\n${proposedLines}`
                : `PROPOSED MUTATIONS (medium confidence — review before emitting):\n${proposedLines}`;
              mutationsProposed = mediumConfidence.length;
            }

            // LOW confidence (<0.5): already handled via suggestedPadPrompts path below
            if (lowConfidence.length > 0) {
              await onConversation?.({
                timestampMs: Date.now(),
                agent: 'journey-completion-agent',
                to: 'orchestrator',
                message: `${lowConfidence.length} low-confidence mutation(s) deferred — need more evidence.`,
                type: 'info',
              });
            }
          }

          // Emit suggestedPadPrompts as pad.generated events (composite-key dedup)
          const mainQuestionIndex = guidanceState.currentMainQuestion ? 0 : -1;
          let suggestedPadsEmitted = 0;
          for (const sp of assessment.suggestedPadPrompts || []) {
            if (!sp.prompt) continue;
            const dedupKey = `${workshopId}:${sp.gapId || ''}:${sp.stage || ''}:${mainQuestionIndex}`;
            if (state.emittedSuggestionKeys.has(dedupKey)) continue;
            state.emittedSuggestionKeys.add(dedupKey);
            const pad = buildStickyPadFromSuggestion(sp, guidanceState);
            await emitEvent('pad.generated', { pad });
            guidanceState.surfacedPadPrompts.push(sp.prompt);
            suggestedPadsEmitted++;
          }

          const topGaps = assessment.gaps.filter(g => g.priority >= 0.5).slice(0, 3);
          return JSON.stringify({
            assessed: true,
            overallCompletion: assessment.overallCompletionPercent,
            gapCount: assessment.gaps.length,
            domainActor: assessment.domainActorName,
            suggestedPadsEmitted,
            mutationsEmitted,
            mutationsProposed,
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

    // ── CONSULT JOURNEY ENRICHMENT AGENT ───────────────────
    case 'consult_journey_enrichment_agent': {
      const liveJourney = buildJourneyFromCogState(cogState, guidanceState);

      // Gate: need enough data to enrich meaningfully
      if (liveJourney.interactions.length < MIN_ENRICHMENT_INTERACTIONS) {
        return JSON.stringify({ skipped: true, reason: `Only ${liveJourney.interactions.length} interactions (need ≥${MIN_ENRICHMENT_INTERACTIONS}).` });
      }
      if (cogState.beliefs.size < MIN_ENRICHMENT_BELIEFS) {
        return JSON.stringify({ skipped: true, reason: `Only ${cogState.beliefs.size} beliefs (need ≥${MIN_ENRICHMENT_BELIEFS}).` });
      }

      // Throttle: max once per 3 minutes
      const lastEnrichmentMs = (guidanceState as any)._lastEnrichmentAtMs || 0;
      if (Date.now() - lastEnrichmentMs < MIN_ENRICHMENT_INTERVAL_MS) {
        return JSON.stringify({ skipped: true, reason: 'Enriched recently. Will enrich again later.' });
      }

      await onConversation?.({
        timestampMs: Date.now(),
        agent: 'orchestrator',
        to: 'journey-enrichment-agent',
        message: `Enrich ${liveJourney.interactions.length} interactions with AI agency, intensity, and risk data.`,
        type: 'handoff',
      });

      try {
        const enrichment = await runJourneyEnrichmentAgent(guidanceState, liveJourney, cogState, onConversation);

        if (enrichment) {
          // Apply enrichments to journey interactions
          const enrichmentMap = new Map(enrichment.enrichments.map(e => [e.interactionId, e]));

          for (const ix of liveJourney.interactions) {
            const e = enrichmentMap.get(ix.id);
            if (!e) continue;
            ix.aiAgencyNow = e.aiAgencyNow as AiAgencyLevel;
            ix.aiAgencyFuture = e.aiAgencyFuture as AiAgencyLevel;
            ix.businessIntensity = e.businessIntensity;
            ix.customerIntensity = e.customerIntensity;
            // Store constraint flags from enrichment
            if (e.governanceOverlays.length > 0 || e.riskExposure !== 'low') {
              ix.constraintFlags = [
                ...(ix.constraintFlags || []),
                ...e.governanceOverlays.map((g, gi) => ({
                  id: `enrich:${ix.id}:${gi}`,
                  type: 'regulatory' as const,
                  label: g,
                  severity: (e.riskExposure === 'high' ? 'blocking' : e.riskExposure === 'medium' ? 'significant' : 'manageable') as 'blocking' | 'significant' | 'manageable',
                  sourceNodeIds: [],
                  addedBy: 'ai' as const,
                })),
              ];
            }
          }

          // Track enrichment timestamp
          (guidanceState as any)._lastEnrichmentAtMs = Date.now();

          // Emit enriched journey data
          await emitEvent('journey.completion', {
            journeyCompletionState: guidanceState.journeyCompletionState,
            liveJourney,
          });

          return JSON.stringify({
            enriched: true,
            interactionsEnriched: enrichment.enrichments.length,
            automationReadiness: (enrichment.overallAutomationReadiness * 100).toFixed(0) + '%',
            summary: enrichment.summary,
          });
        }

        return JSON.stringify({ enriched: false, reason: 'Enrichment Agent returned no data.' });
      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : 'Enrichment failed' });
      }
    }

    // ── EMIT JOURNEY MUTATIONS ────────────────────────────
    case 'emit_journey_mutations': {
      const args = _args as { mutations?: Array<{ type: string; payload: Record<string, unknown>; sourceNodeIds?: string[] }> };
      const mutations = Array.isArray(args.mutations) ? args.mutations : [];

      if (mutations.length === 0) {
        return JSON.stringify({ emitted: 0, reason: 'No mutations provided.' });
      }

      let emittedCount = 0;
      for (const m of mutations) {
        const intent: JourneyMutationIntent = {
          id: `orch:${m.type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          type: m.type as JourneyMutationIntent['type'],
          payload: m.payload || {},
          sourceNodeIds: Array.isArray(m.sourceNodeIds) ? m.sourceNodeIds : [],
          emittedAtMs: Date.now(),
        };

        await emitEvent('journey.mutation', intent);
        emittedCount++;

        await onConversation?.({
          timestampMs: Date.now(),
          agent: 'orchestrator',
          to: '',
          message: `Journey mutation: ${m.type} -- ${JSON.stringify(m.payload).substring(0, 80)}`,
          type: 'info',
        });
      }

      return JSON.stringify({ emitted: emittedCount });
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
          `${i + 1}. [${p.pad.type}, ${p.pad.lens || 'General'}] "${p.pad.prompt}" --${p.reasoning}`,
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

      // Pacing: cap at maxVisiblePads per emission
      const pacing = getPacing(guidanceState);
      const toVerify = state.proposals.slice(0, pacing.maxVisiblePads);
      let emitted = 0;
      const results: string[] = [];

      for (const proposal of toVerify) {
        // Deterministic safety filter --no LLM needed
        if (!validateReferences(proposal.sourceBeliefIds, cogState)) {
          results.push(`REJECTED (invalid refs): "${proposal.pad.prompt.substring(0, 60)}"`);
          continue;
        }
        if (proposal.sourceBeliefIds.length === 0) {
          results.push(`REJECTED (no citations): "${proposal.pad.prompt.substring(0, 60)}"`);
          continue;
        }

        // Approved --persist to outbox + emit
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
    emittedSuggestionKeys: new Set<string>(),
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
            onConversation, workshopId, orchestratorState, emitEvent,
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
        console.log(`[Orchestrator] No tool calls on iteration ${iteration} --done`);
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
          onConversation, workshopId, orchestratorState, emitEvent,
        );

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });

        // verify_and_emit is terminal --stop the entire cycle
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
          onConversation, workshopId, orchestratorState, emitEvent,
        );
      } catch {
        console.error('[Orchestrator] Recovery emit also failed');
      }
    }
  }
}
