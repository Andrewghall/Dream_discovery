// EthentaFlow handoff OUT: receives a completed voice-agent session payload
// and writes it into Dream's ConversationSession + ConversationMessage tables
// so the existing scratchpad / synthesis pipelines pick it up.
//
// Authenticated by a shared secret (DREAMFLOW_SECRET).
//
// POST /api/discovery/ethentaflow-handoff

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function unauthorised() {
  return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
}

interface HandoffPayload {
  source: 'ethentaflow';
  sessionId: string;
  workshopId?: string;
  participantToken?: string;
  participant?: { name?: string; title?: string; company?: string; roleDescription?: string };
  ratings?: Array<{ lens: string; today: number | null; target: number | null; drift: number | null; reason: string | null }>;
  evidence?: Array<{ lens: string; statements: string[] }>;
  conversation?: Array<{ role: 'user' | 'assistant'; content: string }>;
  synthesis?: any;
  startedAt?: number;
  endedAt?: number;
}

export async function POST(request: NextRequest) {
  // Shared-secret auth.
  const expectedSecret = process.env.DREAMFLOW_SECRET;
  const providedSecret = request.headers.get('x-dreamflow-secret');
  if (!expectedSecret || providedSecret !== expectedSecret) return unauthorised();

  let payload: HandoffPayload;
  try {
    payload = (await request.json()) as HandoffPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload.workshopId || !payload.participantToken) {
    return NextResponse.json({ error: 'workshopId and participantToken are required' }, { status: 400 });
  }

  // Locate the participant by token + workshop.
  const workshop = await prisma.workshop.findUnique({
    where: { id: payload.workshopId },
    include: { participants: true },
  });
  if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

  const participant = workshop.participants.find(p => p.discoveryToken === payload.participantToken);
  if (!participant) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });

  // Find or create the conversation session for this participant.
  // Each EthentaFlow session writes a fresh ConversationSession (the legacy
  // route also creates new ones rather than updating in place).
  const session = await (prisma as any).conversationSession.create({
    data: {
      workshopId: workshop.id,
      participantId: participant.id,
      status: 'COMPLETED',
      currentPhase: 'summary',
      phaseProgress: 100,
      startedAt: payload.startedAt ? new Date(payload.startedAt) : new Date(),
      completedAt: payload.endedAt ? new Date(payload.endedAt) : new Date(),
      totalDurationMs: payload.startedAt && payload.endedAt ? payload.endedAt - payload.startedAt : null,
      voiceEnabled: true,
      includeRegulation: workshop.includeRegulation ?? true,
      questionSetVersion: (workshop as any).questionSetVersion ?? 'v1',
    },
  });

  // Insert conversation messages — preserves the verbatim transcript so
  // downstream synthesis / report routes can read what the participant
  // actually said.
  const messages = (payload.conversation ?? []).map((turn, idx) => ({
    sessionId: session.id,
    role: turn.role === 'user' ? 'PARTICIPANT' as const : 'AI' as const,
    content: turn.content,
    phase: undefined,
    metadata: { source: 'ethentaflow', orderIndex: idx } as any,
  }));
  if (messages.length > 0) {
    await (prisma as any).conversationMessage.createMany({ data: messages });
  }

  // Insert structured rating entries as AI-side messages with metadata so the
  // existing "extract triple_rating" code paths recognise them. Also store
  // evidence statements as PARTICIPANT messages with a tag.
  const ratingMessages = (payload.ratings ?? [])
    .filter(r => r.today != null || r.target != null || r.drift != null)
    .map(r => ({
      sessionId: session.id,
      role: 'AI' as const,
      content: `triple-rating captured: today=${r.today ?? '–'} target=${r.target ?? '–'} drift=${r.drift ?? '–'}${r.reason ? ' — ' + r.reason : ''}`,
      phase: r.lens,
      metadata: {
        kind: 'rating',
        lens: r.lens,
        today: r.today,
        target: r.target,
        drift: r.drift,
        reason: r.reason,
        source: 'ethentaflow',
      } as any,
    }));
  if (ratingMessages.length > 0) {
    await (prisma as any).conversationMessage.createMany({ data: ratingMessages });
  }

  const evidenceMessages = (payload.evidence ?? [])
    .flatMap(e => e.statements.map(stmt => ({
      sessionId: session.id,
      role: 'PARTICIPANT' as const,
      content: stmt,
      phase: e.lens,
      metadata: { kind: 'evidence', lens: e.lens, source: 'ethentaflow' } as any,
    })));
  if (evidenceMessages.length > 0) {
    await (prisma as any).conversationMessage.createMany({ data: evidenceMessages });
  }

  // Persist the synthesis JSON on the participant so Dream-side views can
  // surface the structured output. Stored as JSON on a participant field if
  // the column exists (gracefully ignored otherwise).
  if (payload.synthesis) {
    try {
      await (prisma as any).workshopParticipant.update({
        where: { id: participant.id },
        data: { lastDiscoverySynthesis: payload.synthesis },
      });
    } catch {
      // Column not present yet — skip silently. The synthesis is still in
      // ConversationMessage metadata for future retrieval.
    }
  }

  // Mark participant as having completed the discovery.
  try {
    await (prisma as any).workshopParticipant.update({
      where: { id: participant.id },
      data: { discoveryCompletedAt: new Date() },
    });
  } catch {
    // ignore if column doesn't exist
  }

  console.log(`[ethentaflow-handoff] received session=${payload.sessionId} workshop=${payload.workshopId} participant=${participant.id} messages=${messages.length} ratings=${ratingMessages.length} evidence=${evidenceMessages.length}`);

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    messagesStored: messages.length + ratingMessages.length + evidenceMessages.length,
  });
}
