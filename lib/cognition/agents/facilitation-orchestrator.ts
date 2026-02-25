/**
 * DREAM Facilitation Orchestrator — Multi-Agent Deliberation
 *
 * Called at the end of each utterance processing (in the `after()` block
 * of the transcript route). Orchestrates genuine multi-agent deliberation
 * where REAL separate agents challenge each other before sub-questions
 * are surfaced. Not a workflow — a debate.
 *
 * Pattern: assess → propose → challenge → refine → verify → emit
 *
 * Deliberation flow:
 * 1. Theme Agent assesses the conversational landscape (own LLM call)
 * 2. Constraint Agent (CONSTRAINTS phase) identifies gaps (own LLM call)
 * 3. Orchestrator builds deliberation context from research + Discovery + 1 + 2
 * 4. Facilitation Agent proposes sub-questions with full context (own LLM call)
 * 5. REVIEW ROUND — each agent reviews proposals from its domain:
 *    - Theme Agent: does this follow the conversational thread?
 *    - Research Agent: is this grounded in company/industry knowledge?
 *    - Discovery Agent: does this build on participant interviews?
 *    - Constraint Agent: is this phase-appropriate? (REIMAGINE = zero constraints)
 *    Each review is a REAL separate LLM call with domain-specific prompt.
 * 6. If challenged: Facilitation Agent REFINES with feedback (second LLM call)
 * 7. Guardian validates grounding → emit pad.generated
 *
 * The entire deliberation — including challenges, builds, and refinements —
 * is visible in the Agent Conversation Panel. The facilitator sees genuine
 * multi-agent debate, not a rubber-stamp workflow.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CognitiveState } from '../cognitive-state';
import {
  getGuidanceState,
  getOrCreateGuidanceState,
  type GuidanceState,
} from '../guidance-state';
import { runThemeAgent } from './theme-agent';
import { runFacilitationAgent, type DeliberationContext, type PadProposal } from './facilitation-agent';
import { runConstraintAgent } from './constraint-agent';
import { runGuardianAgent, validateReferences } from './guardian-agent';
import type { AgentConversationCallback } from './agent-types';

// ── Timing thresholds ───────────────────────────────────────

const THEME_CHECK_INTERVAL_MS = 60_000;    // Check theme every 60s at most
const THEME_STALE_MS = 15 * 60_000;        // Suggest new theme after 15min
const PAD_GENERATION_INTERVAL_MS = 30_000; // Generate pads every 30s
const PAD_UTTERANCE_THRESHOLD = 5;         // Or every 5 utterances
const CHALLENGER_MODEL = 'gpt-4o-mini';

// ══════════════════════════════════════════════════════════════
// CHALLENGER — the orchestrator's critical voice
// ══════════════════════════════════════════════════════════════

type AgentReview = {
  agent: string;
  stance: 'agree' | 'challenge' | 'build';
  feedback: string;
};

/**
 * Each agent reviews proposals from its own domain perspective.
 * These are REAL separate LLM calls — each agent runs with its own
 * system prompt and domain context. Not simulated.
 */
async function runAgentReview(
  agentName: string,
  systemPrompt: string,
  proposalDescription: string,
): Promise<AgentReview> {
  if (!env.OPENAI_API_KEY) {
    return { agent: agentName, stance: 'agree', feedback: 'Review unavailable.' };
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: CHALLENGER_MODEL,
      temperature: 0.4,
      max_tokens: 200,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: proposalDescription },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';
    try {
      const parsed = JSON.parse(text);
      return {
        agent: agentName,
        stance: parsed.stance || 'agree',
        feedback: parsed.feedback || text,
      };
    } catch {
      // Infer stance from text
      const lower = text.toLowerCase();
      const stance = lower.includes('disagree') || lower.includes('concern') || lower.includes('however')
        ? 'challenge' : lower.includes('also') || lower.includes('add') ? 'build' : 'agree';
      return { agent: agentName, stance, feedback: text.substring(0, 200) };
    }
  } catch {
    return { agent: agentName, stance: 'agree', feedback: 'Review unavailable.' };
  }
}

/**
 * Build the review prompt for each agent type. Each agent reviews
 * from its own domain expertise — not a generic template.
 */
function buildReviewPrompts(
  phase: string,
  mainQuestion: string | null,
  deliberation: DeliberationContext,
): Record<string, string> {
  const goal = mainQuestion ? `The current main question is: "${mainQuestion}".` : '';

  return {
    'Theme Agent': `You are the Theme Agent reviewing a colleague's proposal. Your domain is conversational flow and thematic coherence.
${goal}
${deliberation.themeRecommendation ? `Your earlier assessment: ${deliberation.themeRecommendation}` : ''}
Does this proposal align with the conversational direction? Does it follow the thread the room is exploring, or does it pull in a different direction? Be honest — if it doesn't fit, say so.
Respond with JSON: { "stance": "agree"|"challenge"|"build", "feedback": "your specific input" }`,

    'Research Agent': `You are the Research Agent reviewing a colleague's proposal. Your domain is company and industry knowledge.
${goal}
${deliberation.researchHighlights ? `Your research findings: ${deliberation.researchHighlights}` : 'You have limited research context.'}
Is this proposal grounded in what we know about the company and industry? Does it reference real dynamics, or is it generic? Could it be more specific to this client?
Respond with JSON: { "stance": "agree"|"challenge"|"build", "feedback": "your specific input" }`,

    'Discovery Agent': `You are the Discovery Agent reviewing a colleague's proposal. Your domain is what participants told us in pre-workshop interviews.
${goal}
${deliberation.discoveryInsights ? `Discovery findings: ${deliberation.discoveryInsights}` : 'No Discovery data available — flag this gap.'}
Does this proposal build on what participants have already shared? Does it go deeper rather than retreading ground? Are we asking them to repeat themselves or pushing into new territory?
Respond with JSON: { "stance": "agree"|"challenge"|"build", "feedback": "your specific input" }`,

    'Constraint Agent': `You are the Constraint Agent reviewing a colleague's proposal. Your domain is limitations, risks, and blockers.
${goal}
${deliberation.constraintGaps ? `Known constraints: ${deliberation.constraintGaps}` : ''}
${phase === 'REIMAGINE'
  ? 'CRITICAL: We are in REIMAGINE phase. If this proposal mentions ANY constraints, barriers, or limitations — CHALLENGE it immediately. REIMAGINE is pure vision, zero friction.'
  : phase === 'CONSTRAINTS'
    ? 'We are in CONSTRAINTS phase. Does this proposal help map real limitations? Is it specific enough?'
    : 'We are in DEFINE APPROACH. Does this proposal account for known constraints while still being actionable?'}
Respond with JSON: { "stance": "agree"|"challenge"|"build", "feedback": "your specific input" }`,
  };
}

// ══════════════════════════════════════════════════════════════
// SHOULD-RUN CHECKS
// ══════════════════════════════════════════════════════════════

function shouldCheckTheme(
  cogState: CognitiveState,
  gs: GuidanceState,
): boolean {
  const now = Date.now();

  // Don't check too frequently
  if (now - gs.lastThemeCheckAtMs < THEME_CHECK_INTERVAL_MS) return false;

  // Check if no active theme
  if (!gs.activeThemeId) return true;

  // Check if active theme is stale
  const activeTheme = gs.themes.find((t) => t.id === gs.activeThemeId);
  if (activeTheme?.startedAtMs && now - activeTheme.startedAtMs > THEME_STALE_MS) return true;

  // Check if domain focus shifted (new beliefs in different domain)
  return false;
}

function shouldGeneratePads(
  cogState: CognitiveState,
  gs: GuidanceState,
): boolean {
  const now = Date.now();

  // Check time threshold
  if (now - gs.lastPadGenerationAtMs >= PAD_GENERATION_INTERVAL_MS) return true;

  // Check utterance threshold
  if (gs.utterancesSinceLastPad >= PAD_UTTERANCE_THRESHOLD) return true;

  return false;
}

// ══════════════════════════════════════════════════════════════
// MAIN ORCHESTRATION FUNCTION
// ══════════════════════════════════════════════════════════════

export async function runFacilitationOrchestrator(
  workshopId: string,
  cogState: CognitiveState,
  emitEvent: (type: string, payload: unknown) => void,
  onConversation?: AgentConversationCallback,
): Promise<void> {
  const guidanceState = getOrCreateGuidanceState(workshopId);

  // Freeflow mode — agents go quiet
  if (guidanceState.freeflowMode) return;

  // Need at least some beliefs to reason about
  if (cogState.beliefs.size < 3) return;

  // Track utterance count
  guidanceState.utterancesSinceLastPad++;

  const now = Date.now();

  // ══════════════════════════════════════════════════════════
  // MULTI-AGENT DELIBERATION — real debate, not a workflow
  //
  // Flow:
  //   1. Theme Agent assesses conversational landscape (own LLM call)
  //   2. Constraint Agent identifies gaps if CONSTRAINTS phase (own LLM call)
  //   3. Orchestrator builds deliberation context from 1+2 + research + Discovery
  //   4. Facilitation Agent proposes sub-questions (own LLM call)
  //   5. REVIEW ROUND: Theme, Research, Discovery, Constraint agents
  //      each review from their domain (4 parallel LLM calls)
  //   6. If challenged: Facilitation Agent refines (second LLM call)
  //   7. Guardian validates grounding → emit
  //
  // Every step is logged in the Agent Conversation Panel.
  // ══════════════════════════════════════════════════════════

  const deliberation: DeliberationContext = {};
  const mainQ = guidanceState.currentMainQuestion;
  const prep = guidanceState.prepContext;

  // ── Build research + Discovery context for deliberation ──

  if (prep?.research) {
    const r = prep.research;
    const highlights = [
      r.companyOverview ? `Company: ${r.companyOverview.substring(0, 200)}` : null,
      r.industryContext ? `Industry: ${r.industryContext.substring(0, 200)}` : null,
      r.keyPublicChallenges?.length ? `Key challenges: ${r.keyPublicChallenges.slice(0, 3).join('; ')}` : null,
    ].filter(Boolean).join('. ');
    if (highlights) deliberation.researchHighlights = highlights;
  }

  if (prep?.discoveryIntelligence) {
    const di = prep.discoveryIntelligence;
    const insights = [
      di.briefingSummary ? `Discovery summary: ${di.briefingSummary.substring(0, 300)}` : null,
      di.painPoints?.length ? `Key pain points: ${di.painPoints.slice(0, 3).map((p) => p.description || p).join('; ')}` : null,
      di.aspirations?.length ? `Aspirations: ${di.aspirations.slice(0, 3).join('; ')}` : null,
    ].filter(Boolean).join('. ');
    if (insights) deliberation.discoveryInsights = insights;
  }

  // ── 1. Theme Agent — assess the conversational landscape ──

  let themeUpdated = false;

  if (shouldCheckTheme(cogState, guidanceState)) {
    guidanceState.lastThemeCheckAtMs = now;

    onConversation?.({
      timestampMs: now,
      agent: 'orchestrator',
      to: 'theme-agent',
      message: `${cogState.beliefs.size} beliefs accumulated.${mainQ ? ` The facilitator is exploring: "${mainQ.text}".` : ''} ${guidanceState.activeThemeId ? 'Does the current theme still serve our goal, or should we shift focus?' : 'No active theme — what conversational thread should we follow?'}`,
      type: 'handoff',
    });

    try {
      const proposal = await runThemeAgent(cogState, guidanceState, onConversation);

      if (proposal) {
        if (validateReferences(proposal.sourceBeliefIds, cogState)) {
          onConversation?.({
            timestampMs: Date.now(),
            agent: 'orchestrator',
            to: 'guardian',
            message: `Theme Agent proposes: "${proposal.theme.title}". Verifying against ${proposal.sourceBeliefIds.length} cited beliefs.`,
            type: 'handoff',
          });

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

          if (verdict.verdict === 'approve' || verdict.verdict === 'modify') {
            const theme = verdict.verdict === 'modify' && typeof verdict.modifiedOutput === 'string'
              ? { ...proposal.theme, title: verdict.modifiedOutput }
              : proposal.theme;

            emitEvent('theme.suggested', { theme });
            themeUpdated = true;

            // Feed theme recommendation into deliberation context
            deliberation.themeRecommendation = `The conversation is gravitating toward "${theme.title}" (${theme.lens || 'cross-cutting'}): ${theme.description || proposal.reasoning}. ${proposal.sourceBeliefIds.length} beliefs support this direction.`;

            onConversation?.({
              timestampMs: Date.now(),
              agent: 'orchestrator',
              to: '',
              message: `Theme "${theme.title}" verified. This will inform the Facilitation Agent's next sub-questions.`,
              type: 'acknowledgement',
            });
          } else {
            deliberation.themeRecommendation = `Theme Agent proposed "${proposal.theme.title}" but Guardian rejected it: ${verdict.reasoning}. The current conversational thread may need a different angle.`;

            onConversation?.({
              timestampMs: Date.now(),
              agent: 'orchestrator',
              to: '',
              message: `Theme rejected by Guardian: ${verdict.reasoning}. Noting this for the Facilitation Agent.`,
              type: 'info',
            });
          }
        }
      } else {
        // Theme Agent had no proposal — note the stability
        deliberation.themeRecommendation = guidanceState.activeThemeId
          ? `The current theme remains appropriate — no shift needed.`
          : null;
      }
    } catch (error) {
      console.error('[Orchestrator] Theme check failed:', error instanceof Error ? error.message : error);
    }
  }

  // ── 2. Constraint Agent — identify gaps (CONSTRAINTS phase) ──

  if (guidanceState.dialoguePhase === 'CONSTRAINTS') {
    const recentConstraints = Array.from(cogState.beliefs.values()).filter(
      (b) => ['constraint', 'risk'].includes(b.category) && b.createdAtMs > now - 60_000,
    );

    if (recentConstraints.length > 0) {
      onConversation?.({
        timestampMs: Date.now(),
        agent: 'orchestrator',
        to: 'constraint-agent',
        message: `${recentConstraints.length} new constraint/risk beliefs detected.${mainQ ? ` We're exploring: "${mainQ.text}".` : ''} Map these constraints and identify any coverage gaps that the Facilitation Agent should probe.`,
        type: 'handoff',
      });

      try {
        const proposals = await runConstraintAgent(cogState, guidanceState, onConversation);
        const gapNotes: string[] = [];

        for (const proposal of proposals) {
          if (validateReferences(proposal.sourceBeliefIds, cogState)) {
            const verdict = await runGuardianAgent(
              {
                proposedOutput: { label: proposal.constraint.label, severity: proposal.constraint.severity },
                outputDescription: `Constraint: "${proposal.constraint.label}" (${proposal.constraint.severity})`,
                sourceBeliefIds: proposal.sourceBeliefIds,
                agentName: 'Constraint Agent',
                currentPhase: guidanceState.dialoguePhase,
              },
              cogState,
              onConversation,
            );

            if (verdict.verdict !== 'reject') {
              const constraint = verdict.verdict === 'modify' && typeof verdict.modifiedOutput === 'string'
                ? { ...proposal.constraint, label: verdict.modifiedOutput }
                : proposal.constraint;

              emitEvent('constraint.mapped', { constraint });
              gapNotes.push(`${constraint.label} (${constraint.severity}): ${proposal.reasoning}`);
            }
          }
        }

        // Feed constraint gaps into deliberation context
        if (gapNotes.length > 0) {
          deliberation.constraintGaps = `Constraint Agent identified: ${gapNotes.join(' | ')}. The Facilitation Agent should probe these areas to deepen understanding.`;
        }
      } catch (error) {
        console.error('[Orchestrator] Constraint mapping failed:', error instanceof Error ? error.message : error);
      }
    }
  }

  // ── 3. Facilitation Agent — generate sub-questions with full deliberation context ──

  if (shouldGeneratePads(cogState, guidanceState)) {
    guidanceState.lastPadGenerationAtMs = now;
    guidanceState.utterancesSinceLastPad = 0;

    const prepInfo = prep?.clientName
      ? ` We're working with ${prep.clientName}${prep.industry ? ` in ${prep.industry}` : ''}.`
      : '';

    const mainQGoal = mainQ
      ? ` CURRENT GOAL: "${mainQ.text}" (Purpose: ${mainQ.purpose}).`
      : '';

    // Log the deliberation handoff — show what context the Facilitation Agent is receiving
    const deliberationSummary = [
      deliberation.themeRecommendation ? `Theme: ${deliberation.themeRecommendation.substring(0, 100)}` : null,
      deliberation.constraintGaps ? `Constraints: ${deliberation.constraintGaps.substring(0, 100)}` : null,
      deliberation.researchHighlights ? 'Research context included' : null,
      deliberation.discoveryInsights ? 'Discovery insights included' : null,
    ].filter(Boolean);

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'orchestrator',
      to: 'facilitation-agent',
      message: `${cogState.beliefs.size} beliefs accumulated.${prepInfo}${mainQGoal} Deliberation context: ${deliberationSummary.length > 0 ? deliberationSummary.join('; ') : 'no prior agent input this cycle'}. Generate sub-questions that follow the breadcrumbs toward the goal.`,
      type: 'handoff',
    });

    try {
      // Pass the full deliberation context to the Facilitation Agent
      let proposals = await runFacilitationAgent(cogState, guidanceState, onConversation, deliberation);

      if (proposals.length === 0) {
        // Facilitation Agent had nothing to propose — skip
      } else {
        // ── DELIBERATION REVIEW ROUND ──────────────────────────
        // Each agent reviews the proposals from its own domain.
        // Real separate LLM calls — genuine multi-agent debate.
        // ────────────────────────────────────────────────────────

        const reviewPrompts = buildReviewPrompts(
          guidanceState.dialoguePhase,
          mainQ?.text || null,
          deliberation,
        );

        // Describe what the Facilitation Agent proposed
        const proposalDescription = proposals.map((p, i) =>
          `Proposal ${i + 1} [${p.pad.type}, lens: ${p.pad.lens || 'General'}]: "${p.pad.prompt}" — Reasoning: ${p.reasoning}`,
        ).join('\n');

        onConversation?.({
          timestampMs: Date.now(),
          agent: 'orchestrator',
          to: '',
          message: `Facilitation Agent proposed ${proposals.length} sub-question${proposals.length !== 1 ? 's' : ''}. Opening the floor for review — each agent will assess from their domain.`,
          type: 'info',
        });

        // Run all agent reviews in parallel — real separate LLM calls
        const reviewAgents = Object.entries(reviewPrompts);
        const reviews = await Promise.all(
          reviewAgents.map(([agentName, prompt]) =>
            runAgentReview(agentName, prompt, proposalDescription),
          ),
        );

        // Log each agent's review in the conversation panel
        const challenges: AgentReview[] = [];
        const builds: AgentReview[] = [];

        for (const review of reviews) {
          onConversation?.({
            timestampMs: Date.now(),
            agent: review.agent.toLowerCase().replace(/\s+/g, '-'),
            to: 'facilitation-agent',
            message: `[${review.stance.toUpperCase()}] ${review.feedback}`,
            type: review.stance === 'challenge' ? 'challenge' : review.stance === 'build' ? 'proposal' : 'info',
          });

          if (review.stance === 'challenge') challenges.push(review);
          if (review.stance === 'build') builds.push(review);
        }

        // ── REFINEMENT ROUND (if challenged) ──────────────────
        // If any agent challenged, compile their feedback and ask
        // the Facilitation Agent to refine. One refinement round.
        // ──────────────────────────────────────────────────────

        if (challenges.length > 0) {
          const challengeFeedback = challenges
            .map((c) => `${c.agent}: ${c.feedback}`)
            .join('\n');
          const buildFeedback = builds
            .map((b) => `${b.agent}: ${b.feedback}`)
            .join('\n');

          onConversation?.({
            timestampMs: Date.now(),
            agent: 'orchestrator',
            to: 'facilitation-agent',
            message: `${challenges.length} challenge${challenges.length !== 1 ? 's' : ''} received. Sending feedback for refinement:\n${challengeFeedback}${buildFeedback ? `\n\nAdditional suggestions:\n${buildFeedback}` : ''}`,
            type: 'handoff',
          });

          // Build enriched deliberation with agent feedback
          const refinedDeliberation: DeliberationContext = {
            ...deliberation,
            // Append challenge feedback so the Facilitation Agent can see what was contested
            themeRecommendation: [
              deliberation.themeRecommendation,
              challenges.find((c) => c.agent === 'Theme Agent')
                ? `THEME AGENT CHALLENGE: ${challenges.find((c) => c.agent === 'Theme Agent')!.feedback}`
                : null,
            ].filter(Boolean).join(' ') || null,
            researchHighlights: [
              deliberation.researchHighlights,
              challenges.find((c) => c.agent === 'Research Agent')
                ? `RESEARCH AGENT CHALLENGE: ${challenges.find((c) => c.agent === 'Research Agent')!.feedback}`
                : null,
            ].filter(Boolean).join(' ') || null,
            discoveryInsights: [
              deliberation.discoveryInsights,
              challenges.find((c) => c.agent === 'Discovery Agent')
                ? `DISCOVERY AGENT CHALLENGE: ${challenges.find((c) => c.agent === 'Discovery Agent')!.feedback}`
                : null,
            ].filter(Boolean).join(' ') || null,
            constraintGaps: [
              deliberation.constraintGaps,
              challenges.find((c) => c.agent === 'Constraint Agent')
                ? `CONSTRAINT AGENT CHALLENGE: ${challenges.find((c) => c.agent === 'Constraint Agent')!.feedback}`
                : null,
            ].filter(Boolean).join(' ') || null,
          };

          // Second pass — Facilitation Agent refines with challenge feedback
          const refinedProposals = await runFacilitationAgent(
            cogState, guidanceState, onConversation, refinedDeliberation,
          );

          if (refinedProposals.length > 0) {
            proposals = refinedProposals;

            onConversation?.({
              timestampMs: Date.now(),
              agent: 'facilitation-agent',
              to: 'orchestrator',
              message: `Refined ${proposals.length} sub-question${proposals.length !== 1 ? 's' : ''} incorporating feedback from ${challenges.map((c) => c.agent).join(', ')}.`,
              type: 'info',
            });
          }
          // If refinement returned nothing, keep original proposals
        } else {
          // No challenges — note the consensus
          onConversation?.({
            timestampMs: Date.now(),
            agent: 'orchestrator',
            to: '',
            message: `All agents agree${builds.length > 0 ? ' (with additions)' : ''}. Proceeding to Guardian verification.`,
            type: 'info',
          });
        }

        // ── GUARDIAN VERIFICATION + EMIT ──────────────────────
        // Final check: Guardian validates grounding before emit
        // ──────────────────────────────────────────────────────

        for (const proposal of proposals) {
          if (validateReferences(proposal.sourceBeliefIds, cogState)) {
            onConversation?.({
              timestampMs: Date.now(),
              agent: 'orchestrator',
              to: 'guardian',
              message: `Facilitation pad${challenges.length > 0 ? ' (refined)' : ''}: "${proposal.pad.prompt.substring(0, 80)}...". Final grounding check.`,
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

              onConversation?.({
                timestampMs: Date.now(),
                agent: 'orchestrator',
                to: '',
                message: `Sub-question approved and surfaced: "${pad.prompt.substring(0, 60)}..."${themeUpdated ? ' (aligned with new theme)' : ''}${challenges.length > 0 ? ' (refined after deliberation)' : ''}`,
                type: 'acknowledgement',
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('[Orchestrator] Pad generation failed:', error instanceof Error ? error.message : error);
    }
  }
}
