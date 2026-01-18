import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ConversationStatus, Prisma } from '@prisma/client';
import { fixedQuestionsForVersion } from '@/lib/conversation/fixed-questions';

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

type QuestionMeta = {
  kind: 'question';
  tag: string;
  index: number;
  phase: string;
};

function getQuestionMeta(m: unknown): QuestionMeta | null {
  const meta = m && typeof m === 'object' && 'metadata' in m ? (m as { metadata?: unknown }).metadata : null;
  const rec = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : null;
  if (!rec) return null;
  if (rec.kind !== 'question') return null;
  if (typeof rec.tag !== 'string' || typeof rec.phase !== 'string' || typeof rec.index !== 'number') return null;
  return { kind: 'question', tag: rec.tag, index: rec.index, phase: rec.phase };
}

function inferTagFromQuestionText(question: string, phase: string | null): string | null {
  const q = (question || '').toLowerCase();
  const p = (phase || '').toLowerCase();
  if (!q) return null;

  const hasScale = q.includes('1-10') || q.includes('1–10') || q.includes('scale') || q.includes('rate');
  const isConfidence = q.includes('confiden');
  if (hasScale && isConfidence) return 'confidence_score';

  if (p === 'prioritization') {
    if (q.includes('constrain') && (q.includes('most') || q.includes('day-to-day'))) return 'biggest_constraint';
    if (q.includes('biggest') && q.includes('impact')) return 'high_impact';
    if (q.includes('optimistic') || q.includes('skeptical') || q.includes('sceptical')) return 'optimism';
    if (q.includes('other insights') || q.includes('anything else') || q.includes('final')) return 'final_thoughts';
  }

  if (p === 'intro') return 'context';

  if (q.includes('strength') || q.includes('behaviour') || q.includes('enabler')) return 'strengths';
  if (q.includes("what's working") || q.includes('working well') || q.includes('help') || q.includes('appreciate')) return 'working';
  if (q.includes('pain') || q.includes('frustrat') || q.includes('struggle')) return 'pain_points';
  if (q.includes('friction') || q.includes('slow you down') || q.includes('create friction')) return 'friction';
  if (q.includes('gap') || q.includes('challenge') || q.includes('hold your team back')) return 'gaps';
  if (q.includes('barrier') || q.includes('prevent') || q.includes('holding back')) return 'barrier';
  if (q.includes('support') || q.includes('training') || q.includes('resources')) return 'support';
  if (q.includes('future') || q.includes('looking ahead') || q.includes('in 1.5') || q.includes('in 3')) return 'future';

  return null;
}

function translatedAnswerText(meta: unknown, fallback: string): string {
  const rec = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : null;
  const translation =
    rec && rec.translation && typeof rec.translation === 'object' && !Array.isArray(rec.translation)
      ? (rec.translation as Record<string, unknown>)
      : null;
  const en = translation && typeof translation.en === 'string' ? translation.en : null;
  return typeof en === 'string' && en.trim() ? en : fallback;
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

  const qs = fixedQuestionsForVersion(parsed.version);
  const phase = parsed.phase as keyof typeof qs;
  const q = qs[phase]?.[parsed.index];
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
        messages: { orderBy: { createdAt: 'asc' } },
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

      if (qaPairs.length === 0 && session.messages.length > 0) {
        const messages = session.messages;

        for (let i = 0; i < messages.length; i++) {
          const m = messages[i];
          if (m.role !== 'PARTICIPANT') continue;
          if (metaKind(m.metadata) === 'clarification') continue;

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
          const qm = getQuestionMeta(questionMsg);
          const tag = qm?.tag || inferTagFromQuestionText(question, phase);
          const answerText = translatedAnswerText(m.metadata, m.content);
          const questionKey = qm
            ? `${qm.phase}:${qm.tag}:${qm.index}`
            : `${phase || 'unknown'}:${tag || 'unknown'}:${i}`;

          qaPairs.push({
            phase,
            question,
            questionKey,
            answer: answerText,
            createdAt: m.createdAt,
          });

          if (question && isRatingQuestion(question)) {
            const rating = extractRatingFromAnswer(answerText);
            if (rating !== null && phase) ratingByPhase[phase] = rating;
          } else {
            freeTextAnswers.push(answerText);
          }
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
          discoveryToken: session.participant.discoveryToken,
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
