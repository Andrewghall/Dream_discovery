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
import { runResearchAgent } from './research-agent';
import { runQuestionSetAgent } from './question-set-agent';
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

  onConversation?.({
    timestampMs: Date.now(),
    agent: 'prep-orchestrator',
    to: 'research-agent',
    message: `Good morning, team. We're preparing for a workshop with ${context.clientName || 'a client'}${context.industry ? ` in the ${context.industry} industry` : ''}. ${context.dreamTrack === 'DOMAIN' ? `The DREAM track is Domain, focused on ${context.targetDomain || 'a specific area'}.` : 'The DREAM track is Enterprise — full end-to-end assessment.'} Research Agent, could you begin by investigating the company and providing context that will help us tailor our approach?`,
    type: 'handoff',
  });

  // ── Phase 1: Research ───────────────────────────────

  try {
    research = await runResearchAgent(context, onConversation);

    // Store research
    await prisma.workshop.update({
      where: { id: context.workshopId },
      data: { prepResearch: JSON.parse(JSON.stringify(research)) },
    });

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'prep-orchestrator',
      to: 'question-set-agent',
      message: `Thank you, Research Agent. The findings have been stored — ${research.keyPublicChallenges.length} key challenges and ${research.recentDevelopments.length} recent developments identified. Now, Question Set Agent — using this research context, could you design a set of workshop facilitation questions for the live session? These questions will guide the facilitator through Reimagine, Constraints, and Define Approach. ${context.dreamTrack === 'DOMAIN' ? `Remember, the focus is ${context.targetDomain || 'the target domain'}, so weight the questions accordingly.` : 'This is an Enterprise-wide assessment.'} Discovery interviews are done — build on what participants already told us.`,
      type: 'handoff',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Prep Orchestrator] Research failed:', msg);

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'prep-orchestrator',
      to: 'question-set-agent',
      message: `Unfortunately the Research Agent encountered an issue: ${msg}. Question Set Agent, please proceed with designing workshop facilitation questions based on the industry and client name we have.`,
      type: 'handoff',
    });
  }

  // ── Phase 2: Question Set ───────────────────────────

  try {
    questionSet = await runQuestionSetAgent(context, research, onConversation);

    // Store question set
    await prisma.workshop.update({
      where: { id: context.workshopId },
      data: { customQuestions: JSON.parse(JSON.stringify(questionSet)) },
    });

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
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Prep Orchestrator] Question set failed:', msg);

    onConversation?.({
      timestampMs: Date.now(),
      agent: 'prep-orchestrator',
      to: '',
      message: `The Question Set Agent encountered an issue: ${msg}. The base question set will be used as a fallback. The facilitator can manually edit questions on the prep page.`,
      type: 'info',
    });
  }

  return {
    research,
    questionSet,
    success: !!(research || questionSet),
  };
}
