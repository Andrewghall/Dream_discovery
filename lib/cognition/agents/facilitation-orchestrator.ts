/**
 * DREAM Facilitation Orchestrator --Live Facilitation Mode
 *
 * 3-agent architecture optimised for live workshop dynamics:
 * 1. ORCHESTRATOR --reads the room, coordinates the cycle (this file)
 * 2. FACILITATION AGENT --generates participant-anchored sub-questions
 * 3. GUARDIAN AGENT --validates grounding against cited beliefs
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
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { CognitiveState } from '../cognitive-state';
import {
  getOrCreateGuidanceState,
  type GuidanceState,
} from '../guidance-state';
import { runFacilitationAgent, type DeliberationContext, type PadProposal } from './facilitation-agent';
import { validateReferences } from './guardian-agent';
import type { StickyPad } from '@/lib/cognitive-guidance/pipeline';
import type { AgentConversationCallback } from './agent-types';
import { buildMetricsSummary, analyzeMetricTrends } from '@/lib/historical-metrics/summarize';

// ── Constants ───────────────────────────────────────────────

// Pacing defaults (overridden by blueprint.pacing when available)
const DEFAULT_MAX_VISIBLE_PADS = 4;
const DEFAULT_MIN_EMISSION_INTERVAL_MS = 120_000;
const DEFAULT_PAD_GENERATION_INTERVAL_MS = 45_000;
const DEFAULT_PAD_UTTERANCE_THRESHOLD = 6;

const ORCHESTRATOR_MODEL = 'gpt-4o-mini';
const MAX_ORCHESTRATOR_ITERATIONS = 4;       // assess -> facilitation -> verify -> emit
const ORCHESTRATOR_TIMEOUT_MS = 30_000;      // 30s hard cap

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
  const lenses = gs.blueprint?.lenses?.map(l => l.name).filter(Boolean);
  if (!lenses?.length) {
    throw new Error(
      'Workshop blueprint.lenses is missing — cannot run live session without a prep-configured lens set. ' +
      'Complete workshop prep before starting the live facilitation session.',
    );
  }
  return lenses;
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
  sp: { prompt: string; gapId: string; label: string },
  guidanceState: GuidanceState,
): StickyPad {
  const mainQIndex = guidanceState.currentMainQuestion
    ? 0 // Will be enriched by the client-side pad state machine
    : null;

  return {
    id: `gap:${sp.gapId || Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    type: 'GAP_PROBE',
    prompt: sp.prompt,
    signalStrength: 0.8,
    provenance: {
      triggerType: 'repeated_theme',
      sourceNodeIds: [],
      description: sp.label,
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
    journeyGapId: null,
    padLabel: sp.label,
  };
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
  const bp = guidanceState.blueprint;

  // Blueprint context: active lenses, actor taxonomy
  const lensNames = getActiveLensNames(guidanceState);
  const actorTaxonomy = bp?.actorTaxonomy;
  const blueprintSection = [
    `Active lenses: ${lensNames.join(', ')}`,
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
2. request_facilitation_proposals: generate sub-questions with signal + speech context
3. verify_and_emit: verify belief references, emit approved pads to facilitator

RULES:
- Four tool calls max, done. No deliberation loops.
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

    // ── REQUEST FACILITATION PROPOSALS ──────────────────────
    case 'request_facilitation_proposals': {
      const deliberation: DeliberationContext = {
        researchHighlights: state.deliberation.researchHighlights || null,
        discoveryInsights: state.deliberation.discoveryInsights || null,
        signals: state.deliberation.signals || null,
        recentUtterances: state.deliberation.recentUtterances || null,
        journeyGaps: null,
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

  if (guidanceState.freeflowMode) return;
  if (!env.OPENAI_API_KEY) return;

  // Pre-LLM gates for pad generation
  if (cogState.beliefs.size < 3) return;

  guidanceState.utterancesSinceLastPad++;

  // Pacing: only run pad generation when generation is due
  if (!shouldGeneratePads(cogState, guidanceState)) return;

  // Mark pad generation started
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

      const completion = await openAiBreaker.execute(() => openai.chat.completions.create({
        model: ORCHESTRATOR_MODEL,
        temperature: 0.3,
        messages,
        tools: ORCHESTRATOR_TOOLS,
        tool_choice: toolChoice,
      }));

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
