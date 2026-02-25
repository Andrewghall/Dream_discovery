/**
 * DREAM Facilitation Orchestrator — Real LLM Agent
 *
 * The Orchestrator is itself a REAL reasoning agent — not a script.
 * It receives the current session state, reasons about what to do,
 * and uses tools to consult its team of specialist agents.
 *
 * Every agent in this system is a genuine LLM with its own system prompt,
 * tools, and multi-turn agentic reasoning loop.
 *
 * Agents (7 real LLMs, each with own system prompt, tools, and reasoning loop):
 * 1. ORCHESTRATOR — reasons about the session, decides actions (this file)
 * 2. THEME AGENT — assesses conversational flow, reviews proposals
 * 3. RESEARCH AGENT — reviews proposals against company/industry knowledge
 * 4. DISCOVERY AGENT — reviews proposals against participant interview data
 * 5. CONSTRAINT AGENT — maps limitations, reviews phase-appropriateness
 * 6. FACILITATION AGENT — proposes sub-questions for the main question
 * 7. GUARDIAN AGENT — validates grounding against cited beliefs
 *
 * The Orchestrator has tools to:
 * - Assess the session state
 * - Consult the Theme Agent
 * - Consult the Constraint Agent
 * - Request facilitation proposals
 * - Send proposals to agents for review (real agentic calls)
 * - Send challenges back for refinement
 * - Verify and emit approved pads via Guardian
 *
 * The entire deliberation is visible in the Agent Conversation Panel.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CognitiveState } from '../cognitive-state';
import {
  getOrCreateGuidanceState,
  type GuidanceState,
} from '../guidance-state';
import { runThemeAgent, reviewWithThemeAgent } from './theme-agent';
import { runFacilitationAgent, type DeliberationContext, type PadProposal } from './facilitation-agent';
import { runConstraintAgent, reviewWithConstraintAgent } from './constraint-agent';
import { runGuardianAgent, validateReferences } from './guardian-agent';
import { reviewWithResearchAgent } from './research-agent';
import { reviewWithDiscoveryAgent } from './discovery-intelligence-agent';
import type { AgentConversationCallback, AgentReview } from './agent-types';

// ── Constants ───────────────────────────────────────────────

const THEME_CHECK_INTERVAL_MS = 60_000;
const THEME_STALE_MS = 15 * 60_000;
const PAD_GENERATION_INTERVAL_MS = 30_000;
const PAD_UTTERANCE_THRESHOLD = 5;
const ORCHESTRATOR_MODEL = 'gpt-4o-mini';
const MAX_ORCHESTRATOR_ITERATIONS = 6;
const ORCHESTRATOR_TIMEOUT_MS = 45_000;

// ══════════════════════════════════════════════════════════════
// SHOULD-RUN CHECKS (pre-LLM gating — saves cost)
// ══════════════════════════════════════════════════════════════

function shouldCheckTheme(
  cogState: CognitiveState,
  gs: GuidanceState,
): boolean {
  const now = Date.now();
  if (now - gs.lastThemeCheckAtMs < THEME_CHECK_INTERVAL_MS) return false;
  if (!gs.activeThemeId) return true;
  const activeTheme = gs.themes.find((t) => t.id === gs.activeThemeId);
  if (activeTheme?.startedAtMs && now - activeTheme.startedAtMs > THEME_STALE_MS) return true;
  return false;
}

function shouldGeneratePads(
  cogState: CognitiveState,
  gs: GuidanceState,
): boolean {
  const now = Date.now();
  if (now - gs.lastPadGenerationAtMs >= PAD_GENERATION_INTERVAL_MS) return true;
  if (gs.utterancesSinceLastPad >= PAD_UTTERANCE_THRESHOLD) return true;
  return false;
}

// ══════════════════════════════════════════════════════════════
// ORCHESTRATOR TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════

const ORCHESTRATOR_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'assess_session',
      description: 'Get the current session state: beliefs, themes, phase, main question, and research/discovery context. Call this first to understand the landscape.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consult_theme_agent',
      description: 'Ask the Theme Agent to assess the conversational landscape and recommend whether a new theme is needed. The Theme Agent will query beliefs, check coverage, and reason about the direction.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consult_constraint_agent',
      description: 'Ask the Constraint Agent to map recent constraint/risk beliefs. Only useful during CONSTRAINTS phase. The agent will query beliefs and categorise constraints by type and severity.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_facilitation_proposals',
      description: 'Ask the Facilitation Agent to generate sub-question proposals for the current main question. Pass it the deliberation context you have gathered from other agents.',
      parameters: {
        type: 'object',
        properties: {
          themeContext: { type: 'string', description: 'What the Theme Agent recommended or assessed.' },
          constraintContext: { type: 'string', description: 'What the Constraint Agent found (gaps, mapped constraints).' },
          researchContext: { type: 'string', description: 'Relevant research highlights about the company/industry.' },
          discoveryContext: { type: 'string', description: 'Relevant Discovery interview insights.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_proposals_for_review',
      description: 'Send the Facilitation Agent\'s proposals to ALL specialist agents for review: Theme Agent (conversational flow), Research Agent (company/industry grounding), Discovery Agent (participant interview alignment), and Constraint Agent (phase appropriateness). Each agent runs as itself with its own tools and reasoning — 4 real agentic calls in parallel. Returns each agent\'s verdict.',
      parameters: {
        type: 'object',
        properties: {
          proposalSummary: {
            type: 'string',
            description: 'A description of the proposals to review.',
          },
        },
        required: ['proposalSummary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_refinement',
      description: 'Send challenge feedback to the Facilitation Agent and ask it to refine its proposals. Use this after agents have challenged.',
      parameters: {
        type: 'object',
        properties: {
          challengeFeedback: {
            type: 'string',
            description: 'The compiled feedback from agents that challenged the proposals.',
          },
        },
        required: ['challengeFeedback'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verify_and_emit',
      description: 'Send final proposals to the Guardian Agent for grounding verification, then emit approved pads to the facilitator screen. This is your commit tool — call it when you are satisfied with the proposals.',
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
  const activeTheme = guidanceState.themes.find((t) => t.id === guidanceState.activeThemeId);
  const checkTheme = shouldCheckTheme(cogState, guidanceState);

  return `You are the DREAM Orchestrator Agent. You lead a team of specialist agents during a live workshop facilitation session. Your job is to reason about the current state of the conversation and coordinate your team to generate the best possible sub-questions for the facilitator.

SESSION CONTEXT:
${prep?.clientName ? `Client: ${prep.clientName} (${prep.industry || 'Unknown'})` : 'No client context'}
${prep?.dreamTrack ? `DREAM Track: ${prep.dreamTrack}${prep.targetDomain ? ' — Focus: ' + prep.targetDomain : ''}` : ''}
Phase: ${guidanceState.dialoguePhase}
Beliefs: ${cogState.beliefs.size}
${mainQ ? `CURRENT MAIN QUESTION: "${mainQ.text}" (Purpose: ${mainQ.purpose})` : 'No main question active'}
Active theme: ${activeTheme ? `"${activeTheme.title}" (${activeTheme.lens || 'cross-cutting'})` : 'None'}
${checkTheme ? 'Theme check is DUE — consider consulting Theme Agent.' : 'Theme check not due yet.'}

YOUR TEAM:
- Theme Agent: Understands conversational flow. Can query beliefs and assess thematic direction.
- Constraint Agent: Knows limitations and risks. Can query constraint beliefs and map gaps.
- Facilitation Agent: Generates sub-question proposals aligned to the main question.
- Guardian Agent: Validates that outputs are grounded in real beliefs (final verification).

YOUR PROCESS:
1. assess_session — understand the current landscape
2. consult_theme_agent — is the conversational direction right? (if theme check is due)
3. consult_constraint_agent — what constraints exist? (CONSTRAINTS phase only)
4. request_facilitation_proposals — get sub-question proposals with deliberation context
5. send_proposals_for_review — let Theme Agent and Constraint Agent review (real agentic calls)
6. If challenged: request_refinement — send feedback back for a second pass
7. verify_and_emit — Guardian checks grounding, approved pads go to screen

RULES:
- You are a REASONING agent. Think about what you learn from each tool call before deciding next steps.
- Do NOT rubber-stamp — if something doesn't feel right, investigate.
- ${guidanceState.dialoguePhase === 'REIMAGINE' ? 'REIMAGINE PHASE: Everything must be aspirational. Zero constraints. If any agent or proposal mentions limitations, challenge it.' : guidanceState.dialoguePhase === 'CONSTRAINTS' ? 'CONSTRAINTS PHASE: Map real limitations. Be thorough and specific.' : 'DEFINE APPROACH PHASE: Solutions must be actionable and account for known constraints.'}
- Be decisive. The facilitator is waiting. Complete your deliberation and call verify_and_emit.`;
}

// ══════════════════════════════════════════════════════════════
// TOOL EXECUTION — each tool invokes real agents
// ══════════════════════════════════════════════════════════════

async function executeOrchestratorTool(
  toolName: string,
  args: Record<string, unknown>,
  cogState: CognitiveState,
  guidanceState: GuidanceState,
  onConversation: AgentConversationCallback | undefined,
  // Mutable state shared across the orchestrator's tool calls
  state: {
    deliberation: DeliberationContext;
    proposals: PadProposal[];
    themeUpdated: boolean;
  },
  emitEvent: (type: string, payload: unknown) => void,
): Promise<string> {
  const mainQ = guidanceState.currentMainQuestion;
  const prep = guidanceState.prepContext;

  switch (toolName) {
    // ── ASSESS SESSION ──────────────────────────────────────
    case 'assess_session': {
      // Gather domain coverage from beliefs
      const domainCounts: Record<string, number> = {};
      const categoryCounts: Record<string, number> = {};
      for (const b of cogState.beliefs.values()) {
        categoryCounts[b.category] = (categoryCounts[b.category] || 0) + 1;
        for (const d of b.domains) {
          domainCounts[d.domain] = (domainCounts[d.domain] || 0) + 1;
        }
      }

      // Build research highlights
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

      // Build discovery highlights
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
        phase: guidanceState.dialoguePhase,
        mainQuestion: mainQ ? { text: mainQ.text, purpose: mainQ.purpose, phase: mainQ.phase } : null,
        activeTheme: guidanceState.themes.find((t) => t.id === guidanceState.activeThemeId)?.title || null,
        completedThemes: guidanceState.themes.filter((t) => t.status === 'completed').map((t) => t.title),
        research: researchSummary,
        discovery: discoverySummary,
      });
    }

    // ── CONSULT THEME AGENT ─────────────────────────────────
    case 'consult_theme_agent': {
      guidanceState.lastThemeCheckAtMs = Date.now();

      onConversation?.({
        timestampMs: Date.now(),
        agent: 'orchestrator',
        to: 'theme-agent',
        message: `${cogState.beliefs.size} beliefs accumulated.${mainQ ? ` Exploring: "${mainQ.text}".` : ''} Assess the conversational direction.`,
        type: 'handoff',
      });

      try {
        const proposal = await runThemeAgent(cogState, guidanceState, onConversation);

        if (proposal) {
          if (validateReferences(proposal.sourceBeliefIds, cogState)) {
            // Guardian validates the theme
            const verdict = await runGuardianAgent(
              {
                proposedOutput: { title: proposal.theme.title, description: proposal.theme.description },
                outputDescription: `Theme suggestion: "${proposal.theme.title}"`,
                sourceBeliefIds: proposal.sourceBeliefIds,
                agentName: 'Theme Agent',
                currentPhase: guidanceState.dialoguePhase,
              },
              cogState,
              onConversation,
            );

            if (verdict.verdict !== 'reject') {
              const theme = verdict.verdict === 'modify' && typeof verdict.modifiedOutput === 'string'
                ? { ...proposal.theme, title: verdict.modifiedOutput }
                : proposal.theme;

              emitEvent('theme.suggested', { theme });
              state.themeUpdated = true;
              state.deliberation.themeRecommendation = `Conversation gravitating toward "${theme.title}" (${theme.lens || 'cross-cutting'}): ${theme.description || proposal.reasoning}. ${proposal.sourceBeliefIds.length} beliefs support this.`;

              return JSON.stringify({ themeProposed: true, theme: theme.title, reasoning: proposal.reasoning, verified: true });
            } else {
              state.deliberation.themeRecommendation = `Theme "${proposal.theme.title}" was proposed but rejected: ${verdict.reasoning}`;
              return JSON.stringify({ themeProposed: true, rejected: true, reasoning: verdict.reasoning });
            }
          }
          return JSON.stringify({ themeProposed: true, invalidReferences: true });
        }

        state.deliberation.themeRecommendation = guidanceState.activeThemeId
          ? 'Current theme remains appropriate.'
          : null;
        return JSON.stringify({ themeProposed: false, reason: 'No theme change warranted.' });
      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : 'Theme check failed' });
      }
    }

    // ── CONSULT CONSTRAINT AGENT ────────────────────────────
    case 'consult_constraint_agent': {
      if (guidanceState.dialoguePhase !== 'CONSTRAINTS') {
        return JSON.stringify({ skipped: true, reason: 'Not in CONSTRAINTS phase.' });
      }

      onConversation?.({
        timestampMs: Date.now(),
        agent: 'orchestrator',
        to: 'constraint-agent',
        message: `Map constraints and identify coverage gaps.${mainQ ? ` We're exploring: "${mainQ.text}".` : ''}`,
        type: 'handoff',
      });

      try {
        const constraintProposals = await runConstraintAgent(cogState, guidanceState, onConversation);
        const mapped: string[] = [];

        for (const cp of constraintProposals) {
          if (validateReferences(cp.sourceBeliefIds, cogState)) {
            const verdict = await runGuardianAgent(
              {
                proposedOutput: { label: cp.constraint.label, severity: cp.constraint.severity },
                outputDescription: `Constraint: "${cp.constraint.label}" (${cp.constraint.severity})`,
                sourceBeliefIds: cp.sourceBeliefIds,
                agentName: 'Constraint Agent',
                currentPhase: guidanceState.dialoguePhase,
              },
              cogState,
              onConversation,
            );

            if (verdict.verdict !== 'reject') {
              const constraint = verdict.verdict === 'modify' && typeof verdict.modifiedOutput === 'string'
                ? { ...cp.constraint, label: verdict.modifiedOutput }
                : cp.constraint;

              emitEvent('constraint.mapped', { constraint });
              mapped.push(`${constraint.label} (${constraint.severity})`);
            }
          }
        }

        if (mapped.length > 0) {
          state.deliberation.constraintGaps = `Constraints identified: ${mapped.join('; ')}`;
        }

        return JSON.stringify({ constraintsMapped: mapped.length, constraints: mapped });
      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : 'Constraint mapping failed' });
      }
    }

    // ── REQUEST FACILITATION PROPOSALS ──────────────────────
    case 'request_facilitation_proposals': {
      // Build deliberation context from orchestrator's gathered intelligence
      const deliberation: DeliberationContext = {
        themeRecommendation: args.themeContext ? String(args.themeContext) : state.deliberation.themeRecommendation,
        constraintGaps: args.constraintContext ? String(args.constraintContext) : state.deliberation.constraintGaps,
        researchHighlights: args.researchContext ? String(args.researchContext) : state.deliberation.researchHighlights,
        discoveryInsights: args.discoveryContext ? String(args.discoveryContext) : state.deliberation.discoveryInsights,
      };

      onConversation?.({
        timestampMs: Date.now(),
        agent: 'orchestrator',
        to: 'facilitation-agent',
        message: `Generate sub-questions.${mainQ ? ` Goal: "${mainQ.text}".` : ''} Passing deliberation context from team assessment.`,
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

    // ── SEND PROPOSALS FOR REVIEW ───────────────────────────
    // Real agentic calls — Theme Agent and Constraint Agent
    // each run their full reasoning loops to review proposals
    // ────────────────────────────────────────────────────────
    case 'send_proposals_for_review': {
      const proposalSummary = String(args.proposalSummary || '');

      onConversation?.({
        timestampMs: Date.now(),
        agent: 'orchestrator',
        to: '',
        message: `Sending proposals to all 4 specialist agents for review. Each will reason from their domain using their own tools.`,
        type: 'info',
      });

      // Run ALL 4 reviews in parallel — real agentic calls, each with own tools
      const [themeReview, researchReview, discoveryReview, constraintReview] = await Promise.all([
        reviewWithThemeAgent(proposalSummary, cogState, guidanceState, onConversation),
        reviewWithResearchAgent(proposalSummary, guidanceState, onConversation),
        reviewWithDiscoveryAgent(proposalSummary, guidanceState, onConversation),
        reviewWithConstraintAgent(proposalSummary, guidanceState.dialoguePhase, cogState, guidanceState, onConversation),
      ]);

      const reviews = [themeReview, researchReview, discoveryReview, constraintReview];
      const challenges = reviews.filter((r) => r.stance === 'challenge');
      const builds = reviews.filter((r) => r.stance === 'build');

      return JSON.stringify({
        reviewCount: reviews.length,
        challenges: challenges.length,
        builds: builds.length,
        reviews: reviews.map((r) => ({
          agent: r.agent,
          stance: r.stance,
          feedback: r.feedback,
          suggestedChanges: r.suggestedChanges || null,
        })),
      });
    }

    // ── REQUEST REFINEMENT ──────────────────────────────────
    case 'request_refinement': {
      const feedback = String(args.challengeFeedback || '');

      onConversation?.({
        timestampMs: Date.now(),
        agent: 'orchestrator',
        to: 'facilitation-agent',
        message: `Challenges received. Sending feedback for refinement:\n${feedback}`,
        type: 'handoff',
      });

      // Enrich deliberation with challenge feedback
      const refinedDeliberation: DeliberationContext = {
        ...state.deliberation,
        themeRecommendation: [
          state.deliberation.themeRecommendation,
          feedback.includes('Theme Agent') ? `CHALLENGE FROM THEME AGENT: ${feedback}` : null,
        ].filter(Boolean).join(' ') || null,
        constraintGaps: [
          state.deliberation.constraintGaps,
          feedback.includes('Constraint Agent') ? `CHALLENGE FROM CONSTRAINT AGENT: ${feedback}` : null,
        ].filter(Boolean).join(' ') || null,
      };

      try {
        const refined = await runFacilitationAgent(cogState, guidanceState, onConversation, refinedDeliberation);

        if (refined.length > 0) {
          state.proposals = refined;

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'facilitation-agent',
            to: 'orchestrator',
            message: `Refined ${refined.length} proposal${refined.length !== 1 ? 's' : ''} incorporating challenge feedback.`,
            type: 'info',
          });

          return JSON.stringify({
            refined: true,
            proposalCount: refined.length,
            proposals: refined.map((p, i) => `${i + 1}. "${p.pad.prompt.substring(0, 80)}"`),
          });
        }

        return JSON.stringify({ refined: false, reason: 'Facilitation Agent returned empty — keeping original proposals.' });
      } catch (error) {
        return JSON.stringify({ refined: false, error: error instanceof Error ? error.message : 'Refinement failed' });
      }
    }

    // ── VERIFY AND EMIT ─────────────────────────────────────
    case 'verify_and_emit': {
      if (state.proposals.length === 0) {
        return JSON.stringify({ emitted: 0, reason: 'No proposals to verify.' });
      }

      let emitted = 0;
      const results: string[] = [];

      for (const proposal of state.proposals) {
        if (!validateReferences(proposal.sourceBeliefIds, cogState)) {
          results.push(`REJECTED (invalid refs): "${proposal.pad.prompt.substring(0, 60)}"`);
          continue;
        }

        onConversation?.({
          timestampMs: Date.now(),
          agent: 'orchestrator',
          to: 'guardian',
          message: `Final grounding check: "${proposal.pad.prompt.substring(0, 80)}..."`,
          type: 'handoff',
        });

        const verdict = await runGuardianAgent(
          {
            proposedOutput: { prompt: proposal.pad.prompt, type: proposal.pad.type },
            outputDescription: `Facilitation pad: "${proposal.pad.prompt.substring(0, 100)}"`,
            sourceBeliefIds: proposal.sourceBeliefIds,
            agentName: 'Facilitation Agent',
            currentPhase: guidanceState.dialoguePhase,
          },
          cogState,
          onConversation,
        );

        if (verdict.verdict !== 'reject') {
          const pad = verdict.verdict === 'modify' && typeof verdict.modifiedOutput === 'string'
            ? { ...proposal.pad, prompt: verdict.modifiedOutput }
            : proposal.pad;

          emitEvent('pad.generated', { pad });
          emitted++;

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'orchestrator',
            to: '',
            message: `Approved and surfaced: "${pad.prompt.substring(0, 60)}..."${state.themeUpdated ? ' (aligned with new theme)' : ''}`,
            type: 'acknowledgement',
          });

          results.push(`APPROVED: "${pad.prompt.substring(0, 60)}"`);
        } else {
          results.push(`REJECTED by Guardian: "${proposal.pad.prompt.substring(0, 60)}" — ${verdict.reasoning}`);
        }
      }

      return JSON.stringify({ emitted, total: state.proposals.length, results });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN ORCHESTRATION FUNCTION — REAL LLM AGENT
// ══════════════════════════════════════════════════════════════

export async function runFacilitationOrchestrator(
  workshopId: string,
  cogState: CognitiveState,
  emitEvent: (type: string, payload: unknown) => void,
  onConversation?: AgentConversationCallback,
): Promise<void> {
  const guidanceState = getOrCreateGuidanceState(workshopId);

  // Pre-LLM gates — no need to spin up the agent for these
  if (guidanceState.freeflowMode) return;
  if (cogState.beliefs.size < 3) return;

  guidanceState.utterancesSinceLastPad++;

  // Only run the full orchestrator if there's work to do
  const needsThemeCheck = shouldCheckTheme(cogState, guidanceState);
  const needsPadGeneration = shouldGeneratePads(cogState, guidanceState);
  if (!needsThemeCheck && !needsPadGeneration) return;

  if (!env.OPENAI_API_KEY) return;

  // Reset pad generation tracking if we're generating
  if (needsPadGeneration) {
    guidanceState.lastPadGenerationAtMs = Date.now();
    guidanceState.utterancesSinceLastPad = 0;
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const systemPrompt = buildOrchestratorSystemPrompt(cogState, guidanceState);
  const startMs = Date.now();

  // Mutable state shared across tool calls
  const orchestratorState = {
    deliberation: {} as DeliberationContext,
    proposals: [] as PadProposal[],
    themeUpdated: false,
  };

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `New utterances have been processed. ${cogState.beliefs.size} beliefs accumulated. ${needsThemeCheck ? 'Theme check is due. ' : ''}${needsPadGeneration ? 'Sub-question generation is due. ' : ''}Assess the situation and coordinate your team.`,
    },
  ];

  onConversation?.({
    timestampMs: Date.now(),
    agent: 'orchestrator',
    to: '',
    message: `Deliberation cycle starting. ${cogState.beliefs.size} beliefs.${needsThemeCheck ? ' Theme check due.' : ''}${needsPadGeneration ? ' Pad generation due.' : ''}`,
    type: 'info',
  });

  try {
    for (let iteration = 0; iteration < MAX_ORCHESTRATOR_ITERATIONS; iteration++) {
      if (Date.now() - startMs > ORCHESTRATOR_TIMEOUT_MS) {
        console.log(`[Orchestrator] Timeout after ${iteration} iterations`);
        // If we have proposals but timed out before verify_and_emit, emit them now
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

      // Log the orchestrator's reasoning
      if (assistantMessage.content?.trim()) {
        onConversation?.({
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

      // Process tool calls
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
      }
    }
  } catch (error) {
    console.error('[Orchestrator] Failed:', error instanceof Error ? error.message : error);

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'orchestrator',
      to: '',
      message: `Orchestration error: ${error instanceof Error ? error.message : 'Unknown error'}. Attempting recovery.`,
      type: 'info',
    });

    // Safety net: if we gathered proposals before the error, try to emit them
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
