import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FIXED_QUESTIONS, getPhaseOrder } from '@/lib/conversation/fixed-questions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function questionKeyForFixedQuestion(params: {
  questionSetVersion: string;
  phase: keyof typeof FIXED_QUESTIONS;
  tag: string;
  index: number;
}): string {
  const v = (params.questionSetVersion || '').trim();
  if (!v) return `${params.phase}:${params.tag}:${params.index}`;
  return `${v}:${params.phase}:${params.tag}:${params.index}`;
}

function buildExpectedKeys(params: {
  includeRegulation: boolean;
  questionSetVersion: string;
}): string[] {
  const phases = getPhaseOrder(params.includeRegulation).filter((p) => p !== 'summary');
  const keys: string[] = [];

  for (const phase of phases) {
    const qs = FIXED_QUESTIONS[phase];
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      keys.push(
        questionKeyForFixedQuestion({
          questionSetVersion: params.questionSetVersion,
          phase,
          tag: q.tag,
          index: i,
        })
      );
    }
  }

  return keys;
}

function parseBool(value: string | null): boolean {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const session = await prisma.conversationSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        workshopId: true,
        participantId: true,
        includeRegulation: true,
      },
    });

    if (!session) {
      return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
    }

    const questionSetVersion =
      (session as unknown as { questionSetVersion?: string | null }).questionSetVersion || 'v1';

    const existingKeys = await prisma.dataPoint.findMany({
      where: { sessionId, questionKey: { not: null } },
      select: { questionKey: true },
    });

    const existingKeySet = new Set(existingKeys.map((r) => r.questionKey).filter(Boolean) as string[]);

    const expected = buildExpectedKeys({
      includeRegulation: session.includeRegulation,
      questionSetVersion,
    });

    const available = expected.filter((k) => !existingKeySet.has(k));

    const missing = await prisma.dataPoint.findMany({
      where: { sessionId, questionKey: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, rawText: true },
    });

    const preview = missing.slice(0, 10).map((dp, idx) => ({
      dataPointId: dp.id,
      createdAt: dp.createdAt,
      questionKey: available[idx] || null,
      rawText: dp.rawText,
    }));

    return NextResponse.json(
      {
        ok: true,
        session: {
          id: session.id,
          workshopId: session.workshopId,
          participantId: session.participantId,
          includeRegulation: session.includeRegulation,
          questionSetVersion,
        },
        counts: {
          expectedKeys: expected.length,
          existingQuestionKeys: existingKeySet.size,
          missingQuestionKeys: missing.length,
          assignable: Math.min(available.length, missing.length),
        },
        preview,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to preview backfill';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const dryRun = parseBool(request.nextUrl.searchParams.get('dryRun'));

    const session = await prisma.conversationSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        includeRegulation: true,
      },
    });

    if (!session) {
      return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
    }

    const questionSetVersion =
      (session as unknown as { questionSetVersion?: string | null }).questionSetVersion || 'v1';

    const existingKeys = await prisma.dataPoint.findMany({
      where: { sessionId, questionKey: { not: null } },
      select: { questionKey: true },
    });

    const existingKeySet = new Set(existingKeys.map((r) => r.questionKey).filter(Boolean) as string[]);

    const expected = buildExpectedKeys({
      includeRegulation: session.includeRegulation,
      questionSetVersion,
    });

    const available = expected.filter((k) => !existingKeySet.has(k));

    const missing = await prisma.dataPoint.findMany({
      where: { sessionId, questionKey: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    const assignCount = Math.min(available.length, missing.length);
    const assignments = missing.slice(0, assignCount).map((dp, idx) => ({
      id: dp.id,
      questionKey: available[idx],
    }));

    if (dryRun) {
      return NextResponse.json(
        {
          ok: true,
          dryRun: true,
          sessionId,
          assignCount,
          assignments: assignments.slice(0, 25),
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const a of assignments) {
        await tx.dataPoint.update({
          where: { id: a.id },
          data: { questionKey: a.questionKey },
        });
      }
    });

    return NextResponse.json(
      {
        ok: true,
        sessionId,
        updated: assignments.length,
        skipped: missing.length - assignments.length,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to run backfill';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
