import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ConversationStatus, Prisma } from '@prisma/client';
import { FIXED_QUESTIONS } from '@/lib/conversation/fixed-questions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','but','by','for','from','has','have','i','if','in','into','is','it','its','me','my','no','not','of','on','or','our','so','that','the','their','then','there','these','they','this','to','too','up','us','was','we','were','what','when','where','which','who','why','will','with','you','your',
]);

function extractRatingFromAnswer(answer: string): number | null {
  const m = answer.match(/\b(10|[1-9])\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 10) return null;
  return n;
}

function metaKind(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const rec = meta as Record<string, unknown>;
  return typeof rec.kind === 'string' ? rec.kind : null;
}

function isConversationStatus(value: string): value is ConversationStatus {
  return (Object.values(ConversationStatus) as string[]).includes(value);
}

function isRatingQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return q.includes('scale of 1-10') || q.includes('rate 1-10') || q.includes('rate 1 to 10');
}

function parseQuestionKey(questionKey: string): { phase: string; tag: string; index: number; version: string | null } | null {
  const parts = (questionKey || '').split(':');
  if (parts.length !== 3 && parts.length !== 4) return null;
  const hasVersion = parts.length === 4;
  const [maybeVersion, phase, tag, idxStr] = hasVersion ? parts : [null, parts[0], parts[1], parts[2]];
  const index = Number(idxStr);
  if (!phase || !tag || !Number.isFinite(index)) return null;
  return { phase, tag, index, version: typeof maybeVersion === 'string' && maybeVersion ? maybeVersion : null };
}

function questionTextFromKey(questionKey: string): { phase: string | null; question: string } {
  const parsed = parseQuestionKey(questionKey);
  if (!parsed) return { phase: null, question: '' };

  const phase = parsed.phase as keyof typeof FIXED_QUESTIONS;
  const q = FIXED_QUESTIONS[phase]?.[parsed.index];
  return {
    phase: parsed.phase,
    question: q?.text || '',
  };
}

function buildWordFrequencies(texts: string[], maxWords: number = 60) {
  const counts = new Map<string, number>();

  for (const t of texts) {
    const tokens = t
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((w) => w.length >= 3)
      .filter((w) => !STOPWORDS.has(w));

    for (const w of tokens) {
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxWords)
    .map(([text, value]) => ({ text, value }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const participantId = request.nextUrl.searchParams.get('participantId');
    const status = request.nextUrl.searchParams.get('status');
    const includeIncomplete = request.nextUrl.searchParams.get('includeIncomplete') === '1';

    const where: Prisma.ConversationSessionWhereInput = { workshopId };
    if (sessionId) where.id = sessionId;
    if (participantId) where.participantId = participantId;
    if (status && isConversationStatus(status)) where.status = status;

    // Completion-safe aggregation: only include completed discovery responses unless explicitly overridden.
    if (!includeIncomplete) {
      where.OR = [{ completedAt: { not: null } }, { participant: { responseCompletedAt: { not: null } } }];
    }

    const sessions = await prisma.conversationSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        participant: true,
        dataPoints: {
          where: {
            questionKey: {
              not: null,
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const payload = sessions.map((session) => {
      const qaPairs: Array<{
        phase: string | null;
        question: string;
        questionKey: string;
        answer: string;
        createdAt: Date;
      }> = [];

      const ratingByPhase: Record<string, number> = {};
      const freeTextAnswers: string[] = [];

      for (const dp of session.dataPoints) {
        const key = dp.questionKey || '';
        if (!key) continue;
        const meta = questionTextFromKey(key);
        const question = meta.question;
        const phase = meta.phase;

        qaPairs.push({
          phase,
          question,
          questionKey: key,
          answer: dp.rawText,
          createdAt: dp.createdAt,
        });

        if (question && isRatingQuestion(question)) {
          const rating = extractRatingFromAnswer(dp.rawText);
          if (rating !== null && phase) ratingByPhase[phase] = rating;
        } else {
          freeTextAnswers.push(dp.rawText);
        }
      }

      const wordCloud = buildWordFrequencies(freeTextAnswers);

      return {
        sessionId: session.id,
        status: session.status,
        runType: (session as unknown as { runType?: string | null }).runType ?? null,
        questionSetVersion: (session as unknown as { questionSetVersion?: string | null }).questionSetVersion ?? null,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
        participant: {
          id: session.participantId,
          name: session.participant.name,
          email: session.participant.email,
          role: session.participant.role,
          department: session.participant.department,
        },
        qaPairs,
        ratingByPhase,
        wordCloud,
      };
    });

    return NextResponse.json({ workshopId, sessions: payload });
  } catch (error) {
    console.error('Error fetching workshop answers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch answers' },
      { status: 500 }
    );
  }
}
