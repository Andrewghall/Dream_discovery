/**
 * POST /api/workshops/[id]/prep/orchestrate
 *
 * Triggers the full Prep Orchestrator chain:
 *   Research Agent → Question Set Agent
 *
 * Streams all agent conversation entries via SSE.
 * Use this for the "Run Full Prep" flow.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runPrepOrchestrator } from '@/lib/cognition/agents/prep-orchestrator';
import type { PrepContext, AgentConversationEntry } from '@/lib/cognition/agents/agent-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes: deep research (gpt-4o) + question set generation

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  // ── Auth ────────────────────────────────────────────
  const user = await getAuthenticatedUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Load workshop context ──────────────────────────
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
    },
  });

  if (!workshop) {
    return new Response(JSON.stringify({ error: 'Workshop not found' }), {
      status: 404,
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
  };

  // ── SSE stream ─────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch { /* stream closed */ }
      }

      try {
        const result = await runPrepOrchestrator(context, (entry) => {
          sendEvent('agent.conversation', entry);
        });

        if (result.research) {
          sendEvent('research.complete', { research: result.research });
        }

        if (result.questionSet) {
          sendEvent('questions.generated', { questions: result.questionSet });
        }

        sendEvent('prep.complete', {
          success: result.success,
          hasResearch: !!result.research,
          hasQuestions: !!result.questionSet,
        });
      } catch (error) {
        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: '',
          message: `Prep orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'info',
        } satisfies AgentConversationEntry);

        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Prep orchestration failed',
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
