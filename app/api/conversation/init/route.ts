import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFixedQuestion, getFixedQuestionObject } from '@/lib/conversation/fixed-questions';

export async function POST(request: NextRequest) {
  try {
    const { workshopId, token } = await request.json();

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

    // Check if an active (incomplete) session already exists
    let session: any = await prisma.conversationSession.findFirst({
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
      const includeRegulation = (participant.workshop as any).includeRegulation ?? true;
      session = await prisma.conversationSession.create({
        data: {
          workshopId,
          participantId: participant.id,
          currentPhase: 'intro',
          phaseProgress: 0,
          voiceEnabled: true,
          includeRegulation,
        } as any,
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

    if (!session) {
      return NextResponse.json(
        { error: 'Failed to initialize session' },
        { status: 500 }
      );
    }

    const safeSession = session as any;

    return NextResponse.json({
      sessionId: safeSession.id,
      status: safeSession.status,
      currentPhase: safeSession.currentPhase,
      phaseProgress: safeSession.phaseProgress,
      language: safeSession.language,
      voiceEnabled: safeSession.voiceEnabled,
      includeRegulation: safeSession.includeRegulation,
      messages: (safeSession.messages || []).map((msg: any) => ({
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
