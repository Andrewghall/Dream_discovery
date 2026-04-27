/**
 * Public endpoint for EthentaFlow — returns prep questions for a workshop.
 *
 * GET /api/public/workshops/[id]/dreamflow-questions
 *
 * Called by the Railway-hosted EthentaFlow server at session start to load
 * the DREAM prep questions as context for the agentic interview engine.
 * Returns { questions: Record<lens, string[]> }.
 *
 * The questions are used by the engine to orient the conversation — they are
 * NOT read out verbatim; EthentaFlow conducts a natural engaged conversation.
 *
 * Auth: DREAMFLOW_SECRET header must match the DREAMFLOW_SECRET env var.
 * Unauthenticated requests receive 401 (prevents scraping).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type PrepQuestion = {
  id: string;
  phase: string;
  lens: string | null;
  text: string;
  purpose: string;
  grounding: string;
  order: number;
};

type PrepPhaseData = {
  label: string;
  description: string;
  lensOrder: string[];
  questions: PrepQuestion[];
};

type PrepQuestionSet = {
  phases: Record<string, PrepPhaseData>;
  designRationale: string;
  generatedAtMs: number;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Validate shared secret — EthentaFlow server must send this header.
  // If DREAMFLOW_SECRET is not set, the endpoint is disabled.
  const secret = process.env['DREAMFLOW_SECRET'];
  if (!secret) {
    return NextResponse.json({ error: 'Endpoint not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('x-dreamflow-secret');
  if (authHeader !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workshopId } = await params;
  if (!workshopId) {
    return NextResponse.json({ error: 'Missing workshop ID' }, { status: 400 });
  }

  try {
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { customQuestions: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (!workshop.customQuestions) {
      // No prep questions — EthentaFlow will use built-in PHASE_QUESTIONS
      return NextResponse.json({ questions: {} });
    }

    // Parse PrepQuestionSet and convert to Record<lens, string[]>
    const prepQs = workshop.customQuestions as PrepQuestionSet;
    const questions: Record<string, string[]> = {};

    for (const phase of Object.values(prepQs.phases ?? {})) {
      for (const q of (phase.questions ?? [])) {
        const lens = q.lens;
        if (!lens || !q.text) continue;
        if (!questions[lens]) questions[lens] = [];
        questions[lens].push(q.text);
      }
    }

    // Sort each lens's questions by their natural order (already in order from the query)
    return NextResponse.json({ questions });
  } catch (err) {
    console.error('[dreamflow-questions] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
