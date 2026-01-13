import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

function isRatingQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return q.includes('scale of 1-10') || q.includes('rate 1-10') || q.includes('rate 1 to 10');
}

function isConfidenceQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return q.includes('how confident') && (q.includes('rate 1-10') || q.includes('rate 1 to 10') || q.includes('1-10'));
}

function isAmbitionQuestion(question: string): boolean {
  return /\bin\s*3\s*years\b/i.test(question) || /what should customers say/i.test(question);
}

function isRealityQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return (
    q.includes('biggest') ||
    q.includes('challenge') ||
    q.includes('holding back') ||
    q.includes('preventing') ||
    q.includes('barrier') ||
    q.includes('constrain') ||
    q.includes('cost') ||
    q.includes('delay') ||
    q.includes('risk')
  );
}

function isStrengthQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return q.includes("what's working well") || q.includes('actually help') || q.includes('genuinely help');
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((w) => w.length >= 3)
    .filter((w) => !STOPWORDS.has(w));
}

function buildWordFrequencies(texts: string[], maxWords: number = 60) {
  const counts = new Map<string, number>();

  for (const t of texts) {
    for (const w of tokenize(t)) {
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxWords)
    .map(([text, value]) => ({ text, value }));
}

async function generateSummary(params: {
  workshopName: string | null | undefined;
  participantName: string | null | undefined;
  phaseInsights: Array<{
    phase: string;
    rating: number | null;
    confidence: number | null;
    strengths: string[];
    reality: string[];
    ambition: string[];
  }>;
  prioritization: { mostConstraining?: string; biggestImpact?: string; optimism?: string };
}): Promise<string> {
  const lines: string[] = [];
  if (params.participantName) lines.push(`Participant: ${params.participantName}`);
  if (params.workshopName) lines.push(`Workshop: ${params.workshopName}`);

  for (const p of params.phaseInsights) {
    const parts: string[] = [];
    if (p.rating !== null) parts.push(`rating ${p.rating}/10`);
    if (p.confidence !== null) parts.push(`confidence ${p.confidence}/10`);

    lines.push(`\n${p.phase.toUpperCase()}${parts.length ? ` (${parts.join(', ')})` : ''}`);
    if (p.strengths.length) lines.push(`- Strengths: ${p.strengths.join(' | ')}`);
    if (p.reality.length) lines.push(`- Reality: ${p.reality.join(' | ')}`);
    if (p.ambition.length) lines.push(`- Ambition: ${p.ambition.join(' | ')}`);
  }

  if (params.prioritization.mostConstraining || params.prioritization.biggestImpact || params.prioritization.optimism) {
    lines.push(`\nPRIORITIZATION`);
    if (params.prioritization.mostConstraining) lines.push(`- Most constraining: ${params.prioritization.mostConstraining}`);
    if (params.prioritization.biggestImpact) lines.push(`- Biggest impact if improved: ${params.prioritization.biggestImpact}`);
    if (params.prioritization.optimism) lines.push(`- Change sentiment: ${params.prioritization.optimism}`);
  }

  const fallback = lines.join('\n').trim();

  if (!process.env.OPENAI_API_KEY) return fallback;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You produce a concise end-of-interview report. Use only the provided content. Emphasize ambition vs reality and the biggest gaps. Keep it to 8-14 short bullet points plus a 2-3 sentence narrative summary.',
      },
      {
        role: 'user',
        content: `Create the report from these extracted notes:\n\n${fallback}`,
      },
    ],
  });

  return completion.choices?.[0]?.message?.content?.trim() || fallback;
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const session = await prisma.conversationSession.findUnique({
      where: { id: sessionId },
      include: {
        workshop: true,
        participant: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const qaPairs: Array<{ phase: string | null; question: string; answer: string; createdAt: Date }> = [];

    const ratingByPhase: Record<string, number> = {};
    const confidenceByPhase: Record<string, number> = {};

    const realityTexts: string[] = [];
    const ambitionTexts: string[] = [];
    const allFreeText: string[] = [];

    const strengthsByPhase: Record<string, string[]> = {};
    const realityByPhase: Record<string, string[]> = {};
    const ambitionByPhase: Record<string, string[]> = {};

    const messages = session.messages;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== 'PARTICIPANT') continue;

      const kind = (m.metadata as any)?.kind;
      if (kind === 'clarification') continue;

      let questionMsg: (typeof messages)[number] | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const prev = messages[j];
        if (prev.role !== 'AI') continue;
        const prevKind = (prev.metadata as any)?.kind;
        if (prevKind === 'clarification_response') continue;
        questionMsg = prev;
        break;
      }

      const question = questionMsg?.content || '';
      const phase = (m.phase || questionMsg?.phase || null) as string | null;

      qaPairs.push({ phase, question, answer: m.content, createdAt: m.createdAt });

      if (question && isRatingQuestion(question)) {
        const n = extractRatingFromAnswer(m.content);
        if (n !== null && phase) {
          if (isConfidenceQuestion(question)) confidenceByPhase[phase] = n;
          else ratingByPhase[phase] = n;
        }
        continue;
      }

      allFreeText.push(m.content);

      if (question && isAmbitionQuestion(question)) {
        ambitionTexts.push(m.content);
        if (phase) ambitionByPhase[phase] = [...(ambitionByPhase[phase] || []), m.content];
      } else if (question && isRealityQuestion(question)) {
        realityTexts.push(m.content);
        if (phase) realityByPhase[phase] = [...(realityByPhase[phase] || []), m.content];
      }

      if (question && isStrengthQuestion(question) && phase) {
        strengthsByPhase[phase] = [...(strengthsByPhase[phase] || []), m.content];
      }
    }

    const includeRegulation =
      (session as any).includeRegulation ?? (session.workshop as any)?.includeRegulation ?? true;
    const phases = includeRegulation
      ? ['people', 'corporate', 'customer', 'technology', 'regulation']
      : ['people', 'corporate', 'customer', 'technology'];

    const phaseInsights = phases.map((phase) => ({
      phase,
      rating: ratingByPhase[phase] ?? null,
      confidence: confidenceByPhase[phase] ?? null,
      strengths: strengthsByPhase[phase] || [],
      reality: realityByPhase[phase] || [],
      ambition: ambitionByPhase[phase] || [],
    }));

    const prioritization: { mostConstraining?: string; biggestImpact?: string; optimism?: string } = {};
    for (const qa of qaPairs) {
      if (qa.phase !== 'prioritization') continue;
      const q = qa.question.toLowerCase();
      if (q.includes('constrains you most')) prioritization.mostConstraining = qa.answer;
      else if (q.includes('biggest impact')) prioritization.biggestImpact = qa.answer;
      else if (q.includes('optimistic') || q.includes('skeptical')) prioritization.optimism = qa.answer;
    }

    const summary = await generateSummary({
      workshopName: session.workshop?.name,
      participantName: session.participant?.name,
      phaseInsights,
      prioritization,
    });

    const ambitionWordCloud = buildWordFrequencies(ambitionTexts);
    const realityWordCloud = buildWordFrequencies(realityTexts);

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      includeRegulation,
      participant: {
        name: session.participant?.name || null,
        role: session.participant?.role || null,
        department: session.participant?.department || null,
      },
      summary,
      phaseInsights,
      ambitionWordCloud,
      realityWordCloud,
      qaPairs,
      wordCloudAll: buildWordFrequencies(allFreeText),
    });
  } catch (error) {
    console.error('Error generating conversation report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
