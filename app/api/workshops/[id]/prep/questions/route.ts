/**
 * /api/workshops/[id]/prep/questions
 *
 * POST  - Triggers the Question Set Agent to generate workshop facilitation questions (SSE)
 * GET   - Returns current custom question set
 * PUT   - Facilitator edits/saves the question set
 *
 * NOTE: These are WORKSHOP FACILITATION questions for REIMAGINE / CONSTRAINTS / DEFINE APPROACH,
 * NOT Discovery interview questions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runQuestionSetAgent } from '@/lib/cognition/agents/question-set-agent';
import { hasDiscoveryData } from '@/lib/cognition/agents/agent-types';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import type { PrepContext, AgentConversationEntry, WorkshopPrepResearch } from '@/lib/cognition/agents/agent-types';
import { validateQuestionSet } from '@/lib/cognition/agents/question-set-validator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Helper: auth + load workshop ──────────────────────────

async function loadWorkshopPrep(workshopId: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: 'Unauthorized', status: 401, workshop: null };

  const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!validation.valid) return { error: validation.error, status: 403, workshop: null };

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true,
      description: true,
      businessContext: true,
      clientName: true,
      industry: true,
      companyWebsite: true,
      dreamTrack: true,
      targetDomain: true,
      prepResearch: true,
      customQuestions: true,
      discoveryBriefing: true,
      blueprint: true,
    },
  });

  if (!workshop) return { error: 'Workshop not found', status: 404, workshop: null };
  return { error: null, status: 200, workshop };
}

// ══════════════════════════════════════════════════════════════
// POST - Generate tailored questions via SSE
// ══════════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;
  const { error, status, workshop } = await loadWorkshopPrep(workshopId);

  if (error || !workshop) {
    return new Response(JSON.stringify({ error }), {
      status: status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const context: PrepContext = {
    workshopId,
    workshopPurpose: workshop.description,
    desiredOutcomes: workshop.businessContext,
    clientName: workshop.clientName,
    industry: workshop.industry,
    companyWebsite: workshop.companyWebsite,
    dreamTrack: workshop.dreamTrack as 'ENTERPRISE' | 'DOMAIN' | null,
    targetDomain: workshop.targetDomain,
    blueprint: readBlueprintFromJson(workshop.blueprint),
  };

  const research = workshop.prepResearch as unknown as WorkshopPrepResearch | null;
  const discoveryBriefing = workshop.discoveryBriefing as Record<string, unknown> | null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch { /* stream closed */ }
      }

      // Opening orchestrator message
      const purposeBlock = context.workshopPurpose
        ? `\n\nWORKSHOP PURPOSE (WHY WE ARE HERE): ${context.workshopPurpose}`
        : '';
      const outcomesBlock = context.desiredOutcomes
        ? `\nDESIRED OUTCOMES: ${context.desiredOutcomes}`
        : '';
      const discoveryAvailable = hasDiscoveryData(discoveryBriefing);
      sendEvent('agent.conversation', {
        timestampMs: Date.now(),
        agent: 'prep-orchestrator',
        to: 'question-set-agent',
        message: `Thank you, Research Agent. Now, Question Set Agent - using the research context${discoveryAvailable ? ' and Discovery interview insights' : ''}, could you design a set of workshop facilitation questions for ${context.clientName || 'this client'}? These questions will guide the facilitator through REIMAGINE, CONSTRAINTS, and DEFINE APPROACH. ${context.dreamTrack === 'DOMAIN' ? `Remember, the focus is ${context.targetDomain || 'the target domain'}.` : 'This is an Enterprise-wide assessment.'}${purposeBlock}${outcomesBlock}\n\nEvery question you design must serve the workshop purpose and drive toward the desired outcomes. ${discoveryAvailable ? 'Discovery interviews have been completed. Use those insights to inform your questions, but do not repeat Discovery questions.' : 'Discovery interviews have not been completed yet. Design questions based on research context alone.'} These questions are for the live workshop session.`,
        type: 'handoff',
      } satisfies AgentConversationEntry);

      try {
        const questionSet = await runQuestionSetAgent(context, research, (entry) => {
          sendEvent('agent.conversation', entry);
        }, discoveryBriefing);

        // Validate before persisting — defence-in-depth over TypeScript type guarantees
        const qsValidationError = validateQuestionSet(questionSet);
        if (qsValidationError) {
          throw new Error(`Question set failed validation before save: ${qsValidationError}`);
        }

        // Store in workshop
        await prisma.workshop.update({
          where: { id: workshopId },
          data: { customQuestions: JSON.parse(JSON.stringify(questionSet)) },
        });

        // Count total questions
        const totalQuestions = Object.values(questionSet.phases).reduce(
          (sum, p) => sum + p.questions.length, 0
        );

        // Orchestrator acknowledgement
        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: 'question-set-agent',
          message: `Excellent work. The workshop facilitation questions are now stored and ready for the facilitator to review and edit. ${totalQuestions} questions across 3 phases. ${questionSet.designRationale}`,
          type: 'acknowledgement',
        } satisfies AgentConversationEntry);

        sendEvent('questions.generated', { questions: questionSet });
      } catch (error) {
        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: '',
          message: `Question generation encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
          type: 'info',
        } satisfies AgentConversationEntry);

        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Question set agent failed',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ══════════════════════════════════════════════════════════════
// GET - Return current custom question set
// ══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;
  const { error, status, workshop } = await loadWorkshopPrep(workshopId);

  if (error || !workshop) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({
    customQuestions: workshop.customQuestions || null,
  });
}

// ══════════════════════════════════════════════════════════════
// PUT - Facilitator edits/saves question set
// ══════════════════════════════════════════════════════════════

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;
  const { error, status, workshop } = await loadWorkshopPrep(workshopId);

  if (error || !workshop) {
    return NextResponse.json({ error }, { status });
  }

  const body = await request.json();

  const validationError = validateQuestionSet(body.customQuestions);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
  }

  await prisma.workshop.update({
    where: { id: workshopId },
    data: { customQuestions: body.customQuestions },
  });

  return NextResponse.json({ success: true });
}
