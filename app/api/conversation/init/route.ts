import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { strictLimiter } from '@/lib/rate-limit';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import { normalizeConversationPhase } from '@/lib/types/conversation';
import { inferWorkshopRuntimeType } from '@/lib/workshop/workshop-definition';
import {
  getFixedQuestion,
  getFixedQuestionObject,
  buildQuestionsFromDiscoverySet,
  buildQuestionsFromBlueprint,
  includeRegulationFromBlueprint,
  type FixedQuestion,
} from '@/lib/conversation/fixed-questions';

function sessionNeedsRestart(session: any): boolean {
  const canonicalCurrentPhase = normalizeConversationPhase(session?.currentPhase);
  if (!session || canonicalCurrentPhase !== session?.currentPhase) {
    return true;
  }

  const messages = Array.isArray(session?.messages) ? session.messages : [];
  const firstAiQuestion = messages.find((message: any) => {
    if (message?.role !== 'AI' || !message?.metadata || typeof message.metadata !== 'object') return false;
    const meta = message.metadata as Record<string, unknown>;
    return meta.kind === 'question';
  });

  if (!firstAiQuestion || !firstAiQuestion.metadata || typeof firstAiQuestion.metadata !== 'object') {
    return true;
  }

  const firstMeta = firstAiQuestion.metadata as Record<string, unknown>;
  if (firstMeta.phase !== 'intro' || firstMeta.index !== 0) {
    return true;
  }

  return messages.some((message: any) => {
    const normalizedMessagePhase = normalizeConversationPhase(message?.phase);
    if (message?.phase && normalizedMessagePhase !== message.phase) {
      return true;
    }

    if (!message?.metadata || typeof message.metadata !== 'object') return false;
    const meta = message.metadata as Record<string, unknown>;
    if (meta.kind !== 'question' || typeof meta.phase !== 'string') return false;
    return normalizeConversationPhase(meta.phase) !== meta.phase;
  });
}

/**
 * Resolve the question configuration for a new session using the
 * three-tier cascade: discoveryQuestions > blueprint > legacy.
 */
function getLensLabels(workshop: any): Array<{ key: string; label: string }> | null {
  const lenses = workshop?.discoveryQuestions?.lenses;
  if (!Array.isArray(lenses) || lenses.length === 0) return null;
  return lenses.map((l: any) => ({
    key: l.key,
    label: l.label,
    questionCount: Array.isArray(l.questions) ? l.questions.length : 0,
  }));
}

function computeDisplayedPhaseProgress(params: {
  currentPhase: string;
  messages: Array<{ role: string; metadata?: unknown }>;
  workshop: any;
  questionSetVersion: string;
}): number {
  const currentPhase = String(params.currentPhase || '').trim();
  if (!currentPhase) return 0;

  const customQs = buildQuestionsFromDiscoverySet(params.workshop.discoveryQuestions);
  const blueprint = readBlueprintFromJson(params.workshop.blueprint);
  const blueprintQs =
    !customQs && blueprint
      ? buildQuestionsFromBlueprint(blueprint, params.questionSetVersion)
      : null;
  const qs = customQs || blueprintQs;
  const totalQuestions = qs?.[currentPhase]?.length ?? 0;
  if (totalQuestions === 0) return 0;

  const lastAiQuestion = [...params.messages]
    .reverse()
    .find((message) => {
      if (message.role !== 'AI' || !message.metadata || typeof message.metadata !== 'object') return false;
      const meta = message.metadata as Record<string, unknown>;
      return meta.kind === 'question' && meta.phase === currentPhase && typeof meta.index === 'number';
    });

  if (!lastAiQuestion || !lastAiQuestion.metadata || typeof lastAiQuestion.metadata !== 'object') return 0;
  const meta = lastAiQuestion.metadata as Record<string, unknown>;
  const index = typeof meta.index === 'number' ? meta.index : 0;
  return Math.max(0, Math.min(100, Math.round(((index + 1) / totalQuestions) * 100)));
}

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
  // Rate limit: 10 inits per minute per IP — generous for genuine use, blocks automated abuse
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const rl = await strictLimiter.check(10, `conv-init:${ipAddress}`).catch(() => null);
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now()) / 1000).toString() } },
    );
  }

  try {
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const body = await request.json();
    const { workshopId, token } = body as {
      workshopId: string;
      token: string;
      restart?: boolean;
      runType?: 'BASELINE' | 'FOLLOWUP';
      questionSetVersion?: string;
      consentGranted?: boolean;
      consentText?: string;
      consentVersion?: string;
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
        phaseProgress: computeDisplayedPhaseProgress({
          currentPhase: refetchedSession.currentPhase,
          messages: refetchedSession.messages || [],
          workshop: participant.workshop,
          questionSetVersion,
        }),
        language: refetchedSession.language,
        voiceEnabled: refetchedSession.voiceEnabled,
        includeRegulation: refetchedSession.includeRegulation,
        lensLabels: getLensLabels(participant.workshop),
        organization: participant.workshop.organization,
        workshopType: inferWorkshopRuntimeType({
          workshopType: participant.workshop.workshopType,
          engagementType: participant.workshop.engagementType,
        }),
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

    if (session?.status === 'IN_PROGRESS' && sessionNeedsRestart(session)) {
      await (prisma as any).conversationSession.deleteMany({
        where: {
          id: session.id,
        },
      });
      session = null;
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

        // Write consent record for GDPR Art.7 accountability.
        // The participant must have clicked "I Agree" in the UI before this init
        // call is made. We record the consent here against the participant record.
        // consentGranted must be explicitly true — GDPR Art.7 requires affirmative action.
        // Default is false (deny) so an omitted field does not generate a spurious consent record.
        const grantedValue = body?.consentGranted === true;
        await prisma.consentRecord.create({
          data: {
            participantId: participant.id,
            email: participant.email,
            workshopId,
            purpose: 'DISCOVERY_CONVERSATION',
            channel: 'WEB_FORM',
            consentText: body?.consentText ||
              'I agree to my responses being recorded and used to prepare workshop insights. ' +
              'I understand my data will be processed as described in the Privacy Policy.',
            consentVersion: body?.consentVersion || '1.0',
            granted: grantedValue,
            grantedAt: grantedValue ? new Date() : null,
            ipAddress,
            userAgent,
          },
        }).catch(err => {
          // Non-fatal: log but do not block the conversation. A missed consent
          // record is preferable to blocking the participant. Ops team will be
          // alerted and can backfill from audit logs.
          console.error('[consent] Failed to write ConsentRecord for participant', participant.id, err);
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
      currentPhase: normalizeConversationPhase(session.currentPhase),
      phaseProgress: computeDisplayedPhaseProgress({
        currentPhase: normalizeConversationPhase(session.currentPhase),
        messages: ((session as any).messages || []) as Array<{ role: string; metadata?: unknown }>,
        workshop: participant.workshop,
        questionSetVersion,
      }),
      language: session.language,
      voiceEnabled: session.voiceEnabled,
      includeRegulation: session.includeRegulation,
      lensLabels: getLensLabels(participant.workshop),
      organization: participant.workshop.organization,
      workshopType: inferWorkshopRuntimeType({
        workshopType: participant.workshop.workshopType,
        engagementType: participant.workshop.engagementType,
      }),
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
