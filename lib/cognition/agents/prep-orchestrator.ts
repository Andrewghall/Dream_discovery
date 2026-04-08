/**
 * DREAM Prep Orchestrator
 *
 * Coordinates the pre-workshop agent chain:
 *   Research Agent → Question Set Agent → (later: Discovery Intelligence Agent)
 *
 * All conversations are streamed via SSE to the Agent Orchestration Panel
 * on the prep page.
 *
 * Unlike the individual agent API endpoints, this orchestrator runs the
 * full chain in sequence: research the company → generate tailored questions.
 * The facilitator can also trigger agents individually via their endpoints.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { runResearchAgent } from './research-agent';
import { runQuestionSetAgent } from './question-set-agent';
import { validateQuestionSet } from './question-set-validator';
import type {
  PrepContext,
  AgentConversationCallback,
  WorkshopPrepResearch,
  WorkshopQuestionSet,
} from './agent-types';

// ══════════════════════════════════════════════════════════════
// ORCHESTRATOR RESULT
// ══════════════════════════════════════════════════════════════

export type PrepOrchestrationResult = {
  research: WorkshopPrepResearch | null;
  questionSet: WorkshopQuestionSet | null;
  success: boolean;
  error?: string;
};

// ══════════════════════════════════════════════════════════════
// MAIN ORCHESTRATION FUNCTION
// ══════════════════════════════════════════════════════════════

export async function runPrepOrchestrator(
  context: PrepContext,
  onConversation?: AgentConversationCallback,
): Promise<PrepOrchestrationResult> {
  let research: WorkshopPrepResearch | null = null;
  let questionSet: WorkshopQuestionSet | null = null;

  // ── Opening message ─────────────────────────────────

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const purposeIntro = context.workshopPurpose
    ? `\n\nWORKSHOP PURPOSE (WHY WE ARE HERE): ${context.workshopPurpose}`
    : '';
  const outcomesIntro = context.desiredOutcomes
    ? `\nDESIRED OUTCOMES: ${context.desiredOutcomes}`
    : '';

  onConversation?.({
    timestampMs: Date.now(),
    agent: 'prep-orchestrator',
    to: 'research-agent',
    message: `${timeGreeting}. We're preparing for a workshop with ${context.clientName || 'a client'}${context.industry ? ` in the ${context.industry} industry` : ''}. ${context.dreamTrack === 'DOMAIN' ? `The DREAM track is Domain, focused on ${context.targetDomain || 'a specific area'}.` : 'The DREAM track is Enterprise - full end-to-end assessment.'}${purposeIntro}${outcomesIntro}\n\nResearch Agent, could you begin by investigating the company and providing context that will help us tailor our approach? Keep the workshop purpose and desired outcomes front of mind - all research should serve why we are here.`,
    type: 'handoff',
  });

  // ── Phase 1: Research ───────────────────────────────

  // Clear any existing research before starting fresh
  await prisma.workshop.update({
    where: { id: context.workshopId },
    data: { prepResearch: Prisma.JsonNull },
  });

  try {
    research = await runResearchAgent(context, onConversation);

    // Store research
    await prisma.workshop.update({
      where: { id: context.workshopId },
      data: { prepResearch: JSON.parse(JSON.stringify(research)) },
    });

    const dimensionsNote = research.industryDimensions?.length
      ? ` Research identified ${research.industryDimensions.length} industry-specific dimensions: ${research.industryDimensions.map(d => d.name).join(', ')}. Use these dimensions for question lenses, not generic defaults.`
      : '';

    const metricsNote = context.historicalMetrics
      ? ` Historical performance data is available for ${context.historicalMetrics.series.length} operational metrics -- use get_historical_metrics() to reference real baselines in question grounding.`
      : '';

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'prep-orchestrator',
      to: 'question-set-agent',
      message: `Thank you, Research Agent. The findings have been stored - ${research.keyPublicChallenges.length} key challenges and ${research.recentDevelopments.length} recent developments identified.${dimensionsNote}${metricsNote} Now, Question Set Agent - using the research context, could you design a set of workshop facilitation questions for ${context.clientName || 'the client'}? These questions will guide the facilitator through REIMAGINE, CONSTRAINTS, and DEFINE APPROACH. ${context.dreamTrack === 'DOMAIN' ? `Remember, the focus is ${context.targetDomain || 'the target domain'}.` : 'This is an Enterprise-wide assessment.'}${purposeIntro}${outcomesIntro}\n\nEvery question you design must serve the workshop purpose and drive toward the desired outcomes. These questions are for the live workshop session, not Discovery interviews.`,
      type: 'handoff',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Prep Orchestrator] Research failed:', msg);

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'prep-orchestrator',
      to: 'question-set-agent',
      message: `Unfortunately the Research Agent encountered an issue: ${msg}. Question Set Agent, please proceed with designing workshop facilitation questions based on what we know.${purposeIntro}${outcomesIntro}\n\nEven without research, every question must serve the workshop purpose and drive toward the desired outcomes.`,
      type: 'handoff',
    });
  }

  // ── Phase 2: Question Set ───────────────────────────

  // Step 2a: Run the agent. Agent runtime errors are swallowed so a single-agent
  // failure does not crash the whole orchestration run.
  try {
    questionSet = await runQuestionSetAgent(context, research, onConversation);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Prep Orchestrator] Question set failed:', msg);

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'prep-orchestrator',
      to: '',
      message: `Question generation failed: ${msg}. The facilitator must run question generation again before starting the live session.`,
      type: 'info',
    });
  }

  // Step 2b: Validate and persist — OUTSIDE the catch block so that validation
  // failures cannot be accidentally swallowed. If validation fails, reset
  // questionSet to null so the caller never receives invalid data.
  if (questionSet !== null) {
    const qsValidationError = validateQuestionSet(questionSet);
    if (qsValidationError) {
      console.error('[Prep Orchestrator] Question set failed validation:', qsValidationError);
      questionSet = null; // Reset — do not propagate invalid data to caller

      onConversation?.({
        timestampMs: Date.now(),
        agent: 'prep-orchestrator',
        to: '',
        message: `Question generation failed validation: ${qsValidationError}. The facilitator must run question generation again before starting the live session.`,
        type: 'info',
      });
    } else {
      // Store question set — wrap in try/catch so a transient DB failure
      // does not crash the whole orchestration run (best-effort persistence).
      try {
        await prisma.workshop.update({
          where: { id: context.workshopId },
          data: { customQuestions: JSON.parse(JSON.stringify(questionSet)) },
        });
      } catch (dbErr) {
        const msg = dbErr instanceof Error ? dbErr.message : 'Unknown DB error';
        console.error('[Prep Orchestrator] Failed to persist question set:', msg);
        // Null out questionSet so the caller/SSE route does NOT emit success events
        // for questions that were never actually saved to the DB.
        questionSet = null;
        onConversation?.({
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: '',
          message: `Question set generated but could not be saved (${msg}). Please retry.`,
          type: 'info',
        });
      }
    }

    // Only emit success acknowledgement when the question set was persisted.
    if (questionSet !== null) {
      const totalCount = Object.values(questionSet.phases).reduce(
        (sum, phase) => sum + phase.questions.length,
        0,
      );
      const phaseCount = Object.keys(questionSet.phases).length;

      onConversation?.({
        timestampMs: Date.now(),
        agent: 'prep-orchestrator',
        to: '',
        message: `Excellent work, team. The workshop facilitation questions are now available for the facilitator to review and edit. ${totalCount} questions across ${phaseCount} phases (Reimagine, Constraints, Define Approach). ${questionSet.designRationale}`,
        type: 'acknowledgement',
      });
    }
  }

  return {
    research,
    questionSet,
    success: !!(research || questionSet),
  };
}
