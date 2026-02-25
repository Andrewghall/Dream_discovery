/**
 * DREAM Facilitation Orchestrator
 *
 * Called at the end of each utterance processing (in the `after()` block
 * of the transcript route). Reads CognitiveState + GuidanceState, decides
 * which agents to invoke, and passes all outputs through the Guardian
 * before emitting SSE events.
 *
 * Pattern: propose → verify → emit
 *
 * Agent chain:
 * 1. Theme Agent → Guardian → emit theme.suggested
 * 2. Facilitation Agent → Guardian → emit pad.generated
 * 3. Constraint Agent → Guardian → emit constraint.mapped (CONSTRAINTS phase only)
 */

import type { CognitiveState } from '../cognitive-state';
import {
  getGuidanceState,
  getOrCreateGuidanceState,
  type GuidanceState,
} from '../guidance-state';
import { runThemeAgent } from './theme-agent';
import { runFacilitationAgent } from './facilitation-agent';
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

  // ── 1. Theme Agent → Guardian → emit ──────────────

  if (shouldCheckTheme(cogState, guidanceState)) {
    guidanceState.lastThemeCheckAtMs = now;

    onConversation?.({
      timestampMs: now,
      agent: 'orchestrator',
      to: 'theme-agent',
      message: `We've accumulated ${cogState.beliefs.size} beliefs. ${guidanceState.activeThemeId ? 'The current theme may need reviewing.' : 'No active theme — should we suggest one?'} Could you review whether a new theme is warranted?`,
      type: 'handoff',
    });

    try {
      const proposal = await runThemeAgent(cogState, guidanceState, onConversation);

      if (proposal) {
        // Layer 2: validate belief references exist
        if (validateReferences(proposal.sourceBeliefIds, cogState)) {
          // Layer 3: Guardian verification
          onConversation?.({
            timestampMs: Date.now(),
            agent: 'orchestrator',
            to: 'guardian',
            message: `The Theme Agent has proposed a new theme: "${proposal.theme.title}". Could you please verify this against the ${proposal.sourceBeliefIds.length} cited beliefs?`,
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

            onConversation?.({
              timestampMs: Date.now(),
              agent: 'orchestrator',
              to: '',
              message: `Theme verified and ${verdict.verdict === 'modify' ? 'modified' : 'approved'}. Surfacing "${theme.title}" to the facilitator.`,
              type: 'acknowledgement',
            });
          } else {
            onConversation?.({
              timestampMs: Date.now(),
              agent: 'orchestrator',
              to: '',
              message: `Theme rejected by Guardian: ${verdict.reasoning}. Not surfacing.`,
              type: 'info',
            });
          }
        } else {
          console.warn('[Orchestrator] Theme proposal failed reference validation — skipped Guardian');
        }
      }
    } catch (error) {
      console.error('[Orchestrator] Theme check failed:', error instanceof Error ? error.message : error);
    }
  }

  // ── 2. Facilitation Agent → Guardian → emit ───────

  if (shouldGeneratePads(cogState, guidanceState)) {
    guidanceState.lastPadGenerationAtMs = now;
    guidanceState.utterancesSinceLastPad = 0;

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'orchestrator',
      to: 'facilitation-agent',
      message: `Please generate relevant facilitation prompts based on the accumulated beliefs${guidanceState.activeThemeId ? ' and current active theme' : ''}.`,
      type: 'handoff',
    });

    try {
      const proposals = await runFacilitationAgent(cogState, guidanceState, onConversation);

      for (const proposal of proposals) {
        if (validateReferences(proposal.sourceBeliefIds, cogState)) {
          onConversation?.({
            timestampMs: Date.now(),
            agent: 'orchestrator',
            to: 'guardian',
            message: `Facilitation pad proposed: "${proposal.pad.prompt.substring(0, 80)}...". Please verify grounding.`,
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
          }
        }
      }
    } catch (error) {
      console.error('[Orchestrator] Pad generation failed:', error instanceof Error ? error.message : error);
    }
  }

  // ── 3. Constraint Agent → Guardian → emit (CONSTRAINTS only) ──

  if (guidanceState.dialoguePhase === 'CONSTRAINTS') {
    // Only run if new constraint/risk beliefs since last check
    const recentConstraints = Array.from(cogState.beliefs.values()).filter(
      (b) => ['constraint', 'risk'].includes(b.category) && b.createdAtMs > now - 60_000,
    );

    if (recentConstraints.length > 0) {
      onConversation?.({
        timestampMs: Date.now(),
        agent: 'orchestrator',
        to: 'constraint-agent',
        message: `${recentConstraints.length} new constraint/risk beliefs detected. Please map them.`,
        type: 'handoff',
      });

      try {
        const proposals = await runConstraintAgent(cogState, guidanceState, onConversation);

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
            }
          }
        }
      } catch (error) {
        console.error('[Orchestrator] Constraint mapping failed:', error instanceof Error ? error.message : error);
      }
    }
  }
}
