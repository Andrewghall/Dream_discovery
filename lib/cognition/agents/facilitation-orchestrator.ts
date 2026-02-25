/**
 * DREAM Facilitation Orchestrator — Deliberation Architecture
 *
 * Called at the end of each utterance processing (in the `after()` block
 * of the transcript route). Orchestrates a multi-agent deliberation loop
 * where agents confer before surfacing sub-questions to the facilitator.
 *
 * Pattern: assess → deliberate → propose → verify → emit
 *
 * Deliberation flow:
 * 1. Theme Agent assesses the conversational landscape → feeds recommendation
 * 2. Constraint Agent (CONSTRAINTS phase) identifies gaps → feeds gap analysis
 * 3. Orchestrator builds deliberation context (theme + constraints + research + Discovery)
 * 4. Facilitation Agent receives the collective assessment and generates
 *    goal-aligned sub-questions scoped to the current main question
 * 5. Guardian validates grounding → emit pad.generated
 *
 * The entire deliberation is visible in the Agent Conversation Panel.
 */

import type { CognitiveState } from '../cognitive-state';
import {
  getGuidanceState,
  getOrCreateGuidanceState,
  type GuidanceState,
} from '../guidance-state';
import { runThemeAgent } from './theme-agent';
import { runFacilitationAgent, type DeliberationContext } from './facilitation-agent';
import { runConstraintAgent } from './constraint-agent';
import { runGuardianAgent, validateReferences } from './guardian-agent';
import type { AgentConversationCallback } from './agent-types';

// ── Timing thresholds ───────────────────────────────────────

const THEME_CHECK_INTERVAL_MS = 60_000;    // Check theme every 60s at most
const THEME_STALE_MS = 15 * 60_000;        // Suggest new theme after 15min
const PAD_GENERATION_INTERVAL_MS = 30_000; // Generate pads every 30s
const PAD_UTTERANCE_THRESHOLD = 5;         // Or every 5 utterances

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
  // DELIBERATION LOOP — agents confer before emitting
  //
  // Flow:
  //   1. Theme Agent assesses the conversational landscape
  //   2. Constraint Agent (CONSTRAINTS phase) identifies gaps
  //   3. Orchestrator builds a deliberation context from 1+2
  //      plus research/Discovery intelligence
  //   4. Facilitation Agent receives the collective assessment
  //      and generates goal-aligned sub-questions
  //   5. Guardian validates → emit
  //
  // The agents' deliberation is visible in the conversation panel.
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
      const proposals = await runFacilitationAgent(cogState, guidanceState, onConversation, deliberation);

      for (const proposal of proposals) {
        if (validateReferences(proposal.sourceBeliefIds, cogState)) {
          onConversation?.({
            timestampMs: Date.now(),
            agent: 'orchestrator',
            to: 'guardian',
            message: `Facilitation pad proposed: "${proposal.pad.prompt.substring(0, 80)}...". Verifying grounding and alignment with${mainQ ? ` main question goal` : ' current phase'}.`,
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
              message: `Sub-question approved and surfaced: "${pad.prompt.substring(0, 60)}..."${themeUpdated ? ' (aligned with new theme)' : ''}`,
              type: 'acknowledgement',
            });
          }
        }
      }
    } catch (error) {
      console.error('[Orchestrator] Pad generation failed:', error instanceof Error ? error.message : error);
    }
  }
}
