/**
 * /api/workshops/[id]/prep/questions
 *
 * POST  — Triggers the Question Set Agent to generate tailored questions (SSE)
 * GET   — Returns current custom question set
 * PUT   — Facilitator edits/saves the question set
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runQuestionSetAgent } from '@/lib/cognition/agents/question-set-agent';
import type { PrepContext, AgentConversationEntry, WorkshopPrepResearch } from '@/lib/cognition/agents/agent-types';

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
      clientName: true,
      industry: true,
      companyWebsite: true,
      dreamTrack: true,
      targetDomain: true,
      prepResearch: true,
      customQuestions: true,
    },
  });

  if (!workshop) return { error: 'Workshop not found', status: 404, workshop: null };
  return { error: null, status: 200, workshop };
}

// ══════════════════════════════════════════════════════════════
// POST — Generate tailored questions via SSE
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
    clientName: workshop.clientName,
    industry: workshop.industry,
    companyWebsite: workshop.companyWebsite,
    dreamTrack: workshop.dreamTrack as 'ENTERPRISE' | 'DOMAIN' | null,
    targetDomain: workshop.targetDomain,
  };

  const research = workshop.prepResearch as unknown as WorkshopPrepResearch | null;
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
      sendEvent('agent.conversation', {
        timestampMs: Date.now(),
        agent: 'prep-orchestrator',
        to: 'question-set-agent',
        message: `Thank you, Research Agent. Now, Question Set Agent — could you take the research context and generate a tailored Discovery question set for ${context.clientName || 'this client'}? ${context.dreamTrack === 'DOMAIN' ? `Remember, the focus is ${context.targetDomain || 'the target domain'}.` : 'This is an Enterprise-wide assessment.'}`,
        type: 'handoff',
      } satisfies AgentConversationEntry);

      try {
        const questionSet = await runQuestionSetAgent(context, research, (entry) => {
          sendEvent('agent.conversation', entry);
        });

        // Store in workshop
        await prisma.workshop.update({
          where: { id: workshopId },
          data: { customQuestions: JSON.parse(JSON.stringify(questionSet)) },
        });

        // Orchestrator acknowledgement
        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: 'question-set-agent',
          message: `Excellent work. The tailored question set is now stored and ready for the facilitator to review and edit. ${questionSet.tailoringSummary}`,
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
// GET — Return current custom question set
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
// PUT — Facilitator edits/saves question set
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

  await prisma.workshop.update({
    where: { id: workshopId },
    data: { customQuestions: body.customQuestions },
  });

  return NextResponse.json({ success: true });
}
