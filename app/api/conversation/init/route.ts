import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiLimiter } from '@/lib/rate-limit';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import {
  getFixedQuestion,
  getFixedQuestionObject,
  buildQuestionsFromDiscoverySet,
  buildQuestionsFromBlueprint,
  includeRegulationFromBlueprint,
  type FixedQuestion,
} from '@/lib/conversation/fixed-questions';

/**
 * Resolve the question configuration for a new session using the
 * three-tier cascade: discoveryQuestions > blueprint > legacy.
 */
function resolveSessionConfig(workshop: any, questionSetVersion: string) {
  const customQs = buildQuestionsFromDiscoverySet(workshop.discoveryQuestions);
  const blueprint = readBlueprintFromJson(workshop.blueprint);
  const blueprintQs =
    !customQs && blueprint
      ? buildQuestionsFromBlueprint(blueprint, questionSetVersion)
      : null;

  const includeRegulation = blueprint
    ? includeRegulationFromBlueprint(blueprint)
    : (workshop.includeRegulation ?? true);

  // First question is always intro[0]
  const introQs = customQs?.intro || blueprintQs?.intro;
  const firstMessage = introQs
    ? introQs[0].text
    : getFixedQuestion('intro', 0, includeRegulation, questionSetVersion);
  const firstQuestionObj: FixedQuestion | null = introQs
    ? introQs[0]
    : getFixedQuestionObject('intro', 0, includeRegulation, questionSetVersion);

  return { includeRegulation, firstMessage, firstQuestionObj };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 session inits per minute per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await apiLimiter.check(10, `conv-init:${ip}`);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { workshopId, token } = body as {
      workshopId: string;
      token: string;
      restart?: boolean;
      runType?: 'BASELINE' | 'FOLLOWUP';
      questionSetVersion?: string;
    };
    const restart = body?.restart === true;
    const runType = body?.runType === 'FOLLOWUP' ? 'FOLLOWUP' : 'BASELINE';
    const questionSetVersion = typeof body?.questionSetVersion === 'string' && body.questionSetVersion.trim()
      ? body.questionSetVersion.trim()
      : 'v1';

    // Validate token and get participant
    const participant = await prisma.workshopParticipant.findUnique({
      where: { discoveryToken: token },
      include: {
        workshop: {
          include: {
            organization: {
              select: { name: true, logoUrl: true, primaryColor: true },
            },
          },
        },
      },
    });

    if (!participant || participant.workshopId !== workshopId) {
      return NextResponse.json(
        { error: 'Invalid token or workshop ID' },
        { status: 401 }
      );
    }

    if (restart) {
      await (prisma as any).conversationSession.deleteMany({
        where: {
          workshopId,
          participantId: participant.id,
          runType,
          questionSetVersion,
        },
      });

      if (runType === 'BASELINE') {
        await prisma.workshopParticipant.update({
          where: { id: participant.id },
          data: {
            responseStartedAt: new Date(),
            responseCompletedAt: null,
          },
        });
      }

      const { includeRegulation, firstMessage, firstQuestionObj } =
        resolveSessionConfig(participant.workshop, questionSetVersion);

      const createdSession = await (prisma as any).conversationSession.create({
        data: {
          workshopId,
          participantId: participant.id,
          runType,
          questionSetVersion,
          currentPhase: 'intro',
          phaseProgress: 0,
          voiceEnabled: true,
          includeRegulation,
        },
        include: {
          messages: true,
        },
      });

      await prisma.conversationMessage.create({
        data: {
          sessionId: createdSession.id,
          role: 'AI',
          content: firstMessage,
          phase: 'intro',
          metadata: firstQuestionObj
            ? {
                kind: 'question',
                tag: firstQuestionObj.tag,
                index: 0,
                phase: 'intro',
                maturityScale: firstQuestionObj.maturityScale,
              }
            : undefined,
        },
      });

      const refetchedSession = await (prisma as any).conversationSession.findUnique({
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
        organization: participant.workshop.organization,
        messages: (refetchedSession.messages || []).map((msg: any) => ({
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
    let session = await (prisma as any).conversationSession.findFirst({
      where: {
        workshopId,
        participantId: participant.id,
        runType,
        questionSetVersion,
        status: 'IN_PROGRESS', // Only resume if not completed
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      session = await (prisma as any).conversationSession.findFirst({
        where: {
          workshopId,
          participantId: participant.id,
          runType,
          questionSetVersion,
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

    // Create new session if no session exists for this run type.
    if (!session) {
      const { includeRegulation, firstMessage, firstQuestionObj } =
        resolveSessionConfig(participant.workshop, questionSetVersion);

      session = await (prisma as any).conversationSession.create({
        data: {
          workshopId,
          participantId: participant.id,
          runType,
          questionSetVersion,
          currentPhase: 'intro',
          phaseProgress: 0,
          voiceEnabled: true,
          includeRegulation,
        },
        include: {
          messages: true,
        },
      });

      if (runType === 'BASELINE') {
        await prisma.workshopParticipant.update({
          where: { id: participant.id },
          data: { responseStartedAt: new Date() },
        });
      }

      await prisma.conversationMessage.create({
        data: {
          sessionId: session.id,
          role: 'AI',
          content: firstMessage,
          phase: 'intro',
          metadata: firstQuestionObj
            ? {
                kind: 'question',
                tag: firstQuestionObj.tag,
                index: 0,
                phase: 'intro',
                maturityScale: firstQuestionObj.maturityScale,
              }
            : undefined,
        },
      });

      // Refetch session with messages
      session = await (prisma as any).conversationSession.findUnique({
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
    if (runType === 'BASELINE' && session?.status === 'COMPLETED' && !participant.responseCompletedAt) {
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
      organization: participant.workshop.organization,
      messages: ((session as any).messages || []).map((msg: any) => ({
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
