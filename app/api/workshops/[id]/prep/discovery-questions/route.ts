/**
 * /api/workshops/[id]/prep/discovery-questions
 *
 * GET   - Returns current Discovery interview questions
 * POST  - Triggers the Discovery Question Agent to generate questions (SSE)
 * PUT   - Facilitator edits/saves the Discovery question set
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import {
  runDiscoveryQuestionAgent,
  sanitizeDiscoveryQuestionSet,
} from '@/lib/cognition/agents/discovery-question-agent';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import type { AgentConversationEntry } from '@/lib/cognition/agents/agent-types';
import {
  assertWorkshopContextIntegrity,
  decryptWorkshopContext,
  WorkshopContextIntegrityError,
} from '@/lib/workshop/context-integrity';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function loadDiscoveryWorkshop(workshopId: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: 'Unauthorized', status: 401, workshop: null };

  const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!validation.valid) return { error: validation.error, status: 403, workshop: null };

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true,
      workshopType: true,
      clientName: true,
      businessContext: true,
      industry: true,
      companyWebsite: true,
      dreamTrack: true,
      targetDomain: true,
      prepResearch: true,
      domainPack: true,
      domainPackConfig: true,
      blueprint: true,
      discoveryQuestions: true,
    },
  });

  if (!workshop) return { error: 'Workshop not found', status: 404, workshop: null };
  return { error: null, status: 200, workshop };
}

// ══════════════════════════════════════════════════════════════
// GET - Return current Discovery question set
// ══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;
  const { error, status, workshop } = await loadDiscoveryWorkshop(workshopId);
  if (error || !workshop) {
    return NextResponse.json({ error }, { status });
  }

  const decryptedWorkshop = decryptWorkshopContext(workshop);
  const blueprint = readBlueprintFromJson(decryptedWorkshop.blueprint);
  try {
    assertWorkshopContextIntegrity({
      clientName: decryptedWorkshop.clientName,
      industry: decryptedWorkshop.industry,
      desiredOutcomes: decryptedWorkshop.businessContext,
      prepResearch: decryptedWorkshop.prepResearch as any,
      blueprint,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Workshop context failed integrity checks' },
      { status: error instanceof WorkshopContextIntegrityError ? 422 : 500 },
    );
  }
  const sanitizedDiscoveryQuestions = sanitizeDiscoveryQuestionSet(
    decryptedWorkshop.discoveryQuestions as any,
    blueprint,
  );

  return NextResponse.json({
    discoveryQuestions: sanitizedDiscoveryQuestions,
  });
}

// ══════════════════════════════════════════════════════════════
// POST - Generate Discovery questions via SSE
// ══════════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;
  const { error, status, workshop } = await loadDiscoveryWorkshop(workshopId);
  if (error || !workshop) {
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse optional facilitator direction from request body
  let direction: string | null = null;
  try {
    const body = await request.json();
    direction = typeof body?.direction === 'string' && body.direction.trim()
      ? body.direction.trim()
      : null;
  } catch {
    // No body or invalid JSON -- direction stays null
  }

  const decryptedWorkshop = decryptWorkshopContext(workshop);
  const blueprint = readBlueprintFromJson(decryptedWorkshop.blueprint);

  try {
    assertWorkshopContextIntegrity({
      clientName: decryptedWorkshop.clientName,
      industry: decryptedWorkshop.industry,
      desiredOutcomes: decryptedWorkshop.businessContext,
      prepResearch: decryptedWorkshop.prepResearch as any,
      blueprint,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Workshop context failed integrity checks' }), {
      status: error instanceof WorkshopContextIntegrityError ? 422 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!blueprint?.lenses?.length && !decryptedWorkshop.domainPack && !decryptedWorkshop.domainPackConfig) {
    return new Response(JSON.stringify({ error: 'Workshop has no blueprint lenses or domain pack configured' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch { /* stream closed */ }
      }

      sendEvent('discovery-questions.generating', {
        workshopId,
        clientName: decryptedWorkshop.clientName,
      });

      // Opening handoff from orchestrator
      sendEvent('agent.conversation', {
        timestampMs: Date.now(),
        agent: 'prep-orchestrator',
        to: 'discovery-question-agent',
        message: `Discovery Question Agent, please generate tailored interview questions for ${decryptedWorkshop.clientName || 'the client'}. Use the blueprint lenses, research findings, and workshop context to produce specific, grounded questions for each lens.${direction ? `\n\nFacilitator direction: "${direction}"` : ''}`,
        type: 'handoff',
      } satisfies AgentConversationEntry);

      try {
        const questionSet = await runDiscoveryQuestionAgent(workshopId, (entry) => {
          const mapped: AgentConversationEntry = {
            timestampMs: Date.now(),
            agent: 'discovery-question-agent',
            to: 'prep-orchestrator',
            message: entry.content,
            type: (entry.role === 'proposal' ? 'proposal' : entry.role === 'request' ? 'request' : 'info') as AgentConversationEntry['type'],
          };
          sendEvent('agent.conversation', mapped);
        }, {
          direction,
          blueprint,
        });

        // Orchestrator acknowledgement
        const totalQs = questionSet.lenses.reduce((sum, l) => sum + l.questions.length, 0);
        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: 'discovery-question-agent',
          message: `Thank you, Discovery Question Agent. ${totalQs} questions across ${questionSet.lenses.length} lenses have been stored. These will be used in participant Discovery interviews.`,
          type: 'acknowledgement',
        } satisfies AgentConversationEntry);

        sendEvent('discovery-questions.generated', { discoveryQuestions: questionSet });
      } catch (error) {
        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: '',
          message: `Discovery question generation encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
          type: 'info',
        } satisfies AgentConversationEntry);

        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Discovery question agent failed',
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
// PUT - Facilitator edits/saves Discovery question set
// ══════════════════════════════════════════════════════════════

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;
  const { error, status, workshop } = await loadDiscoveryWorkshop(workshopId);
  if (error || !workshop) {
    return NextResponse.json({ error }, { status });
  }

  const body = await request.json();
  const blueprint = readBlueprintFromJson(decryptWorkshopContext(workshop).blueprint);
  const sanitizedDiscoveryQuestions = sanitizeDiscoveryQuestionSet(
    body.discoveryQuestions,
    blueprint,
  );

  await prisma.workshop.update({
    where: { id: workshopId },
    data: {
      discoveryQuestions: JSON.parse(JSON.stringify(sanitizedDiscoveryQuestions)) as any,
    },
  });

  return NextResponse.json({ success: true });
}
