import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFixedQuestion, getFixedQuestionObject } from '@/lib/conversation/fixed-questions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workshopId, token } = body as { workshopId: string; token: string; restart?: boolean };
    const restart = body?.restart === true;

    // Validate token and get participant
    const participant = await prisma.workshopParticipant.findUnique({
      where: { discoveryToken: token },
      include: {
        workshop: true,
      },
    });

    if (!participant || participant.workshopId !== workshopId) {
      return NextResponse.json(
        { error: 'Invalid token or workshop ID' },
        { status: 401 }
      );
    }

    if (restart) {
      await prisma.conversationSession.deleteMany({
        where: {
          workshopId,
          participantId: participant.id,
        },
      });

      await prisma.workshopParticipant.update({
        where: { id: participant.id },
        data: {
          responseStartedAt: new Date(),
          responseCompletedAt: null,
        },
      });

      const includeRegulation = participant.workshop.includeRegulation ?? true;

      const createdSession = await prisma.conversationSession.create({
        data: {
          workshopId,
          participantId: participant.id,
          currentPhase: 'intro',
          phaseProgress: 0,
          voiceEnabled: true,
          includeRegulation,
        },
        include: {
          messages: true,
        },
      });

      const firstMessage = getFixedQuestion('intro', 0, includeRegulation);
      const qObj = getFixedQuestionObject('intro', 0, includeRegulation);

      await prisma.conversationMessage.create({
        data: {
          sessionId: createdSession.id,
          role: 'AI',
          content: firstMessage,
          phase: 'intro',
          metadata: qObj
            ? {
                kind: 'question',
                tag: qObj.tag,
                index: 0,
                phase: 'intro',
                maturityScale: qObj.maturityScale,
              }
            : undefined,
        },
      });

      const refetchedSession = await prisma.conversationSession.findUnique({
        where: { id: createdSession.id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!refetchedSession) {
        return NextResponse.json(
          { error: 'Failed to initialize session' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        sessionId: refetchedSession.id,
        status: refetchedSession.status,
        currentPhase: refetchedSession.currentPhase,
        phaseProgress: refetchedSession.phaseProgress,
        language: refetchedSession.language,
        voiceEnabled: refetchedSession.voiceEnabled,
        includeRegulation: refetchedSession.includeRegulation,
        messages: (refetchedSession.messages || []).map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          phase: msg.phase,
          metadata: msg.metadata,
          createdAt: msg.createdAt,
        })),
      });
    }

    // Check if an active (incomplete) session already exists
    let session = await prisma.conversationSession.findFirst({
      where: {
        workshopId,
        participantId: participant.id,
        status: 'IN_PROGRESS', // Only resume if not completed
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      session = await prisma.conversationSession.findFirst({
        where: {
          workshopId,
          participantId: participant.id,
          status: 'COMPLETED',
        },
        orderBy: { createdAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    // Create new session if doesn't exist or previous was completed
    if (!session) {
      const includeRegulation = participant.workshop.includeRegulation ?? true;
      session = await prisma.conversationSession.create({
        data: {
          workshopId,
          participantId: participant.id,
          currentPhase: 'intro',
          phaseProgress: 0,
          voiceEnabled: true,
          includeRegulation,
        },
        include: {
          messages: true,
        },
      });

      // Update participant response started timestamp
      await prisma.workshopParticipant.update({
        where: { id: participant.id },
        data: { responseStartedAt: new Date() },
      });

      const firstMessage = getFixedQuestion('intro', 0, includeRegulation);
      const qObj = getFixedQuestionObject('intro', 0, includeRegulation);

      await prisma.conversationMessage.create({
        data: {
          sessionId: session.id,
          role: 'AI',
          content: firstMessage,
          phase: 'intro',
          metadata: qObj
            ? {
                kind: 'question',
                tag: qObj.tag,
                index: 0,
                phase: 'intro',
                maturityScale: qObj.maturityScale,
              }
            : undefined,
        },
      });

      // Refetch session with messages
      session = await prisma.conversationSession.findUnique({
        where: { id: session.id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    // Safety backfill: if we have a completed session but the participant timestamp is missing,
    // set responseCompletedAt so admin screens reflect completion.
    if (session?.status === 'COMPLETED' && !participant.responseCompletedAt) {
      await prisma.workshopParticipant.update({
        where: { id: participant.id },
        data: { responseCompletedAt: session.completedAt || new Date() },
      });
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Failed to initialize session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      currentPhase: session.currentPhase,
      phaseProgress: session.phaseProgress,
      language: session.language,
      voiceEnabled: session.voiceEnabled,
      includeRegulation: session.includeRegulation,
      messages: (session.messages || []).map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        phase: msg.phase,
        metadata: msg.metadata,
        createdAt: msg.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error initializing conversation:', error);
    return NextResponse.json(
      { error: 'Failed to initialize conversation' },
      { status: 500 }
    );
  }
}
