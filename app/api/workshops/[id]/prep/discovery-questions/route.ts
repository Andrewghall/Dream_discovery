/**
 * /api/workshops/[id]/prep/discovery-questions
 *
 * GET   - Returns current Discovery interview questions
 * POST  - Triggers the Discovery Question Agent to generate questions (SSE)
 * PUT   - Facilitator edits/saves the Discovery question set
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { runDiscoveryQuestionAgent } from '@/lib/cognition/agents/discovery-question-agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ══════════════════════════════════════════════════════════════
// GET - Return current Discovery question set
// ══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workshopId } = await params;

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { discoveryQuestions: true },
  });

  if (!workshop) {
    return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
  }

  return NextResponse.json({
    discoveryQuestions: workshop.discoveryQuestions || null,
  });
}

// ══════════════════════════════════════════════════════════════
// POST - Generate Discovery questions via SSE
// ══════════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id: workshopId } = await params;

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true,
      clientName: true,
      domainPack: true,
    },
  });

  if (!workshop) {
    return new Response(JSON.stringify({ error: 'Workshop not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!workshop.domainPack) {
    return new Response(JSON.stringify({ error: 'Workshop has no domain pack configured' }), {
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
        clientName: workshop.clientName,
      });

      try {
        const questionSet = await runDiscoveryQuestionAgent(workshopId, (entry) => {
          sendEvent('agent.conversation', entry);
        });

        sendEvent('discovery-questions.generated', { discoveryQuestions: questionSet });
      } catch (error) {
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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workshopId } = await params;

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { id: true },
  });

  if (!workshop) {
    return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
  }

  const body = await request.json();

  await prisma.workshop.update({
    where: { id: workshopId },
    data: {
      discoveryQuestions: JSON.parse(JSON.stringify(body.discoveryQuestions)) as any,
    },
  });

  return NextResponse.json({ success: true });
}
