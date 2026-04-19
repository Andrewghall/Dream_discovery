import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/workshops/[id]/raw-transcript
 *
 * Persists verbatim Deepgram isFinal results.
 * This is the source-of-truth transcript — never modified after write.
 * All downstream processing (windowing, splitting, classification) operates
 * on derived copies; it must not alter these records.
 */

interface RawEntry {
  speakerId: string | null;
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  confidence: number | null;
  speechFinal: boolean;
  sequence: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id: workshopId } = await params;
  const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  let entries: RawEntry[];
  try {
    const body = await req.json();
    entries = Array.isArray(body) ? body : [body];
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (entries.length === 0) return NextResponse.json({ ok: true, written: 0 });

  // Validate minimally — reject entries with no text
  const valid = entries.filter(
    (e) => typeof e.text === 'string' && e.text.length > 0,
  );

  if (valid.length === 0) return NextResponse.json({ ok: true, written: 0 });

  await prisma.rawTranscriptEntry.createMany({
    data: valid.map((e) => ({
      workshopId,
      speakerId: e.speakerId ?? null,
      text: e.text,
      startTimeMs: BigInt(Math.round(e.startTimeMs ?? 0)),
      endTimeMs: BigInt(Math.round(e.endTimeMs ?? 0)),
      confidence: typeof e.confidence === 'number' ? e.confidence : null,
      speechFinal: e.speechFinal ?? false,
      sequence: e.sequence ?? 0,
    })),
    skipDuplicates: false,
  });

  return NextResponse.json({ ok: true, written: valid.length });
}

/**
 * GET /api/workshops/[id]/raw-transcript
 *
 * Returns the verbatim Deepgram transcript in arrival order.
 * Used by the trace debugger and export tools.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id: workshopId } = await params;
  const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  const entries = await prisma.rawTranscriptEntry.findMany({
    where: { workshopId },
    orderBy: [{ sequence: 'asc' }, { startTimeMs: 'asc' }],
    select: {
      id: true,
      speakerId: true,
      text: true,
      startTimeMs: true,
      endTimeMs: true,
      confidence: true,
      speechFinal: true,
      sequence: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    workshopId,
    entries: entries.map((e) => ({
      ...e,
      startTimeMs: e.startTimeMs.toString(),
      endTimeMs: e.endTimeMs.toString(),
    })),
    total: entries.length,
  });
}
