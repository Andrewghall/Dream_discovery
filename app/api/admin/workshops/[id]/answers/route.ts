import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ConversationStatus, Prisma } from '@prisma/client';

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

    const where: Prisma.ConversationSessionWhereInput = { workshopId };
    if (sessionId) where.id = sessionId;
    if (participantId) where.participantId = participantId;
    if (status && isConversationStatus(status)) where.status = status;

    const sessions = await prisma.conversationSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        participant: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const payload = sessions.map((session) => {
      const qaPairs: Array<{
        phase: string | null;
        question: string;
        answer: string;
        createdAt: Date;
      }> = [];

      const ratingByPhase: Record<string, number> = {};
      const freeTextAnswers: string[] = [];

      const messages = session.messages;

      for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        if (m.role !== 'PARTICIPANT') continue;

        const kind = metaKind(m.metadata);
        if (kind === 'clarification') continue;

        // Find the most recent AI question before this answer.
        let questionMsg: (typeof messages)[number] | null = null;
        for (let j = i - 1; j >= 0; j--) {
          const prev = messages[j];
          if (prev.role !== 'AI') continue;
          const prevKind = metaKind(prev.metadata);
          if (prevKind === 'clarification_response') continue;
          questionMsg = prev;
          break;
        }

        const question = questionMsg?.content || '';
        const phase = (m.phase || questionMsg?.phase || null) as string | null;

        qaPairs.push({
          phase,
          question,
          answer: m.content,
          createdAt: m.createdAt,
        });

        if (question && isRatingQuestion(question)) {
          const rating = extractRatingFromAnswer(m.content);
          if (rating !== null && phase) ratingByPhase[phase] = rating;
        } else {
          freeTextAnswers.push(m.content);
        }
      }

      const wordCloud = buildWordFrequencies(freeTextAnswers);

      return {
        sessionId: session.id,
        status: session.status,
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
