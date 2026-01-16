import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ConversationPhase } from '@/lib/types/conversation';
import OpenAI from 'openai';
import { FIXED_QUESTIONS, getFixedQuestion, getFixedQuestionObject, getNextPhase, getPhaseProgressPercent } from '@/lib/conversation/fixed-questions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function translateToEnglish(params: {
  text: string;
  sourceLanguage: string;
}): Promise<string> {
  const text = (params.text || '').trim();
  const sourceLanguage = (params.sourceLanguage || 'en').trim() || 'en';

  if (!text) return '';
  if (sourceLanguage === 'en') return text;
  if (!process.env.OPENAI_API_KEY) return text;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'Translate the user text to English. Preserve meaning, intent, and any numbers/ratings exactly. Return ONLY the translated text (no quotes, no preface).',
      },
      {
        role: 'user',
        content: `Source language: ${sourceLanguage}\n\nText:\n${text}`,
      },
    ],
  });

  return (completion.choices?.[0]?.message?.content || '').trim() || text;
}

function isClarificationQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (t.length > 220) return false;
  if (!t.includes('?') && !/^(what|why|how|can you|could you|would you|when you|what do you|do you mean|clarify|explain)\b/.test(t)) {
    return false;
  }
  if (/\b(rate\b|scale\b|1-10\b)/.test(t) && !t.includes('?')) return false;
  return true;
}

type QuestionMeta = { kind: 'question'; tag: string; index: number; phase: string };

function questionMetaFromMessage(meta: unknown): QuestionMeta | null {
  if (!meta || typeof meta !== 'object') return null;
  const rec = meta as Record<string, unknown>;
  if (rec.kind !== 'question') return null;
  if (typeof rec.tag !== 'string' || typeof rec.phase !== 'string' || typeof rec.index !== 'number') return null;
  return { kind: 'question', tag: rec.tag, phase: rec.phase, index: rec.index };
}

function questionKeyFromMeta(q: QuestionMeta): string {
  return `${q.phase}:${q.tag}:${q.index}`;
}

async function generateClarificationAnswer(params: {
  questionAsked: string;
  userQuestion: string;
  workshopContext: string | null | undefined;
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return "I can clarify. Please interpret the question in the way that best matches your role and experience, and answer in your own words.";
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful facilitator. Answer the participant\'s clarification question concisely and practically. Do not introduce new discovery questions. Do not change the question sequence.',
      },
      {
        role: 'user',
        content:
          `Workshop context (optional): ${params.workshopContext || 'N/A'}\n\nQuestion asked by the facilitator:\n${params.questionAsked}\n\nParticipant clarification question:\n${params.userQuestion}\n\nProvide a short clarification answer in 1-4 sentences.`,
      },
    ],
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  return text || 'I can clarify. Please answer based on your experience and what you see day-to-day.';
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, userMessage } = await request.json();

    // Get session with all context
    const session = await prisma.conversationSession.findUnique({
      where: { id: sessionId },
      include: {
        workshop: true,
        participant: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        insights: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'This discovery is already completed.' },
        { status: 409 }
      );
    }

    const currentPhase = session.currentPhase as ConversationPhase;
    let newPhase: ConversationPhase = currentPhase;
    let newProgress = session.phaseProgress;
    const includeRegulation = session.includeRegulation ?? session.workshop.includeRegulation ?? true;

    const lastAiMessage = [...session.messages].reverse().find((m) => m.role === 'AI');
    const questionAsked = lastAiMessage?.content || '';

    // If user sent a message, save it and analyze
    if (userMessage) {
      const sessionLanguage = session.language || 'en';
      const translatedToEnglish = await translateToEnglish({ text: userMessage, sourceLanguage: sessionLanguage }).catch(
        () => userMessage
      );

      const clarification = isClarificationQuestion(translatedToEnglish);
      const normalizedOriginal = userMessage.trim().toLowerCase();
      const normalizedTranslated = translatedToEnglish.trim().toLowerCase();
      const isSkipRegulation =
        (normalizedOriginal === 'skip' || normalizedTranslated === 'skip') && currentPhase === 'regulation';

      // Save user message
      await prisma.conversationMessage.create({
        data: {
          sessionId: session.id,
          role: 'PARTICIPANT',
          content: userMessage,
          phase: session.currentPhase,
          metadata: {
            ...(isSkipRegulation ? { kind: 'skip' } : clarification ? { kind: 'clarification' } : {}),
            ...(sessionLanguage && sessionLanguage !== 'en'
              ? {
                  translation: {
                    sourceLanguage: sessionLanguage,
                    en: translatedToEnglish,
                  },
                }
              : {}),
          },
        },
      });

      // Persist canonical answer snapshot for this question (session-scoped + stable key)
      if (!isSkipRegulation && !clarification) {
        const questionMessage = [...session.messages]
          .reverse()
          .find((m) => m.role === 'AI' && questionMetaFromMessage(m.metadata));
        const qMeta = questionMessage ? questionMetaFromMessage(questionMessage.metadata) : null;
        if (qMeta) {
          const questionKey = questionKeyFromMeta(qMeta);
          await prisma.dataPoint.upsert({
            where: {
              sessionId_questionKey: {
                sessionId: session.id,
                questionKey,
              },
            },
            create: {
              workshopId: session.workshopId,
              sessionId: session.id,
              participantId: session.participantId,
              questionKey,
              rawText: translatedToEnglish,
              source: 'MANUAL',
              speakerId: null,
            },
            update: {
              rawText: translatedToEnglish,
              participantId: session.participantId,
              workshopId: session.workshopId,
            },
          });
        }
      }

      if (isSkipRegulation) {
        const nextIncludeRegulation = false;
        const nextPhase = getNextPhase('regulation', nextIncludeRegulation);
        const nextQuestionIndex = 0;

        const aiResponse = `No problem — skipping regulation.\n\n${getFixedQuestion(
          nextPhase,
          nextQuestionIndex,
          nextIncludeRegulation
        )}`;
        const qObj = getFixedQuestionObject(nextPhase, nextQuestionIndex, nextIncludeRegulation);

        const aiMessage = await prisma.conversationMessage.create({
          data: {
            sessionId: session.id,
            role: 'AI',
            content: aiResponse,
            phase: nextPhase,
            metadata: qObj
              ? {
                  kind: 'question',
                  tag: qObj.tag,
                  index: nextQuestionIndex,
                  phase: nextPhase,
                  maturityScale: qObj.maturityScale,
                }
              : undefined,
          },
        });

        await prisma.conversationSession.update({
          where: { id: session.id },
          data: {
            includeRegulation: nextIncludeRegulation,
            currentPhase: nextPhase,
            phaseProgress: 0,
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({
          message: {
            id: aiMessage.id,
            role: aiMessage.role,
            content: aiMessage.content,
            phase: aiMessage.phase,
            metadata: aiMessage.metadata,
            createdAt: aiMessage.createdAt,
          },
          currentPhase: nextPhase,
          phaseProgress: 0,
          includeRegulation: nextIncludeRegulation,
          status: session.status,
        });
      }

      if (clarification) {
        const clarificationText = await generateClarificationAnswer({
          questionAsked,
          userQuestion: userMessage,
          workshopContext: session.workshop.businessContext,
        }).catch(() =>
          'I can clarify. Please answer based on your experience and what you see day-to-day.'
        );

        const content =
          `${clarificationText}\n\nTo continue: ${questionAsked || 'Please answer the last question.'}`.trim();

        const aiMessage = await prisma.conversationMessage.create({
          data: {
            sessionId: session.id,
            role: 'AI',
            content,
            phase: currentPhase,
            metadata: { kind: 'clarification_response' },
          },
        });

        await prisma.conversationSession.update({
          where: { id: session.id },
          data: {
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({
          message: {
            id: aiMessage.id,
            role: aiMessage.role,
            content: aiMessage.content,
            phase: aiMessage.phase,
            metadata: aiMessage.metadata,
            createdAt: aiMessage.createdAt,
          },
          currentPhase,
          phaseProgress: session.phaseProgress,
          includeRegulation,
        });
      }
    }

    const totalParticipantCountCurrentPhase = await prisma.conversationMessage.count({
      where: {
        sessionId: session.id,
        role: 'PARTICIPANT',
        phase: currentPhase,
      },
    });

    const clarificationCountCurrentPhase = await prisma.conversationMessage.count({
      where: {
        sessionId: session.id,
        role: 'PARTICIPANT',
        phase: currentPhase,
        metadata: {
          equals: { kind: 'clarification' },
        },
      },
    });

    const answeredCountCurrentPhase = Math.max(
      0,
      totalParticipantCountCurrentPhase - clarificationCountCurrentPhase
    );

    const totalQuestionsInPhase = FIXED_QUESTIONS[currentPhase].length;
    let nextQuestionIndex = answeredCountCurrentPhase;

    if (answeredCountCurrentPhase >= totalQuestionsInPhase) {
      newPhase = getNextPhase(currentPhase, includeRegulation);
      nextQuestionIndex = 0;
      newProgress = 0;
    } else {
      newPhase = currentPhase;
      newProgress = getPhaseProgressPercent(currentPhase, answeredCountCurrentPhase);
    }

    const aiResponse = getFixedQuestion(newPhase, nextQuestionIndex, includeRegulation);
    const qObj = getFixedQuestionObject(newPhase, nextQuestionIndex, includeRegulation);
    const isFinalClosingLine =
      newPhase === 'summary' && nextQuestionIndex === FIXED_QUESTIONS.summary.length - 1;

    if (isFinalClosingLine) {
      newProgress = 100;
    }

    // Save AI message
    const aiMessage = await prisma.conversationMessage.create({
      data: {
        sessionId: session.id,
        role: 'AI',
        content: aiResponse,
        phase: newPhase,
        metadata: qObj
          ? {
              kind: 'question',
              tag: qObj.tag,
              index: nextQuestionIndex,
              phase: newPhase,
              maturityScale: qObj.maturityScale,
            }
          : undefined,
      },
    });

    // Update session
    await prisma.conversationSession.update({
      where: { id: session.id },
      data: {
        currentPhase: newPhase,
        phaseProgress: newProgress,
        status: isFinalClosingLine ? 'COMPLETED' : session.status,
        completedAt: isFinalClosingLine ? new Date() : session.completedAt,
        totalDurationMs: isFinalClosingLine ? Date.now() - session.startedAt.getTime() : session.totalDurationMs,
        updatedAt: new Date(),
      },
    });

    if (isFinalClosingLine) {
      await prisma.workshopParticipant.update({
        where: { id: session.participantId },
        data: { responseCompletedAt: new Date() },
      });
    }

    return NextResponse.json({
      message: {
        id: aiMessage.id,
        role: aiMessage.role,
        content: aiMessage.content,
        phase: aiMessage.phase,
        metadata: aiMessage.metadata,
        createdAt: aiMessage.createdAt,
      },
      currentPhase: newPhase,
      phaseProgress: newProgress,
      includeRegulation,
      status: isFinalClosingLine ? 'COMPLETED' : session.status,
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
