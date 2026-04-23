import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-auth';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
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
  sourceChunkId: string;
  capturedAt: string;
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  confidence: number | null;
  speechFinal: boolean;
  sequence: number;
}

type RawTranscriptSchemaSupport = {
  sourceChunkId: boolean;
  capturedAt: boolean;
  sourcePath: boolean;
};

let rawTranscriptSchemaSupportPromise: Promise<RawTranscriptSchemaSupport> | null = null;

async function getRawTranscriptSchemaSupport(): Promise<RawTranscriptSchemaSupport> {
  if (!rawTranscriptSchemaSupportPromise) {
    rawTranscriptSchemaSupportPromise = prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'raw_transcript_entries'
        AND column_name IN ('source_chunk_id', 'captured_at', 'source_path')
    `.then((rows) => {
      const cols = new Set(rows.map((r) => r.column_name));
      return {
        sourceChunkId: cols.has('source_chunk_id'),
        capturedAt: cols.has('captured_at'),
        sourcePath: cols.has('source_path'),
      };
    }).catch(() => ({
      sourceChunkId: false,
      capturedAt: false,
      sourcePath: false,
    }));
  }
  return rawTranscriptSchemaSupportPromise;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;
  const captureSecret = req.headers.get('x-capture-secret');
  const expectedSecret = process.env.CAPTURE_INGEST_SECRET;
  const isServerToServer = !!(captureSecret && expectedSecret && captureSecret === expectedSecret);

  if (isServerToServer) {
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { id: true },
    });
    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }
  } else {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });
  }

  let entries: RawEntry[];
  try {
    const body = await req.json();
    entries = Array.isArray(body) ? body : [body];
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (entries.length === 0) return NextResponse.json({ ok: true, written: 0 });

  const sourcePath = isServerToServer ? 'CAPTUREAPI_S2S' : 'BROWSER';

  // Validate minimally — reject entries with missing contract fields
  const valid = entries.filter(
    (e) => typeof e.text === 'string'
      && e.text.length > 0
      && typeof e.sourceChunkId === 'string'
      && e.sourceChunkId.length > 0
      && typeof e.capturedAt === 'string'
      && !Number.isNaN(Date.parse(e.capturedAt)),
  );

  if (valid.length === 0) return NextResponse.json({ ok: true, written: 0 });

  const schemaSupport = await getRawTranscriptSchemaSupport();
  let written = 0;

  await prisma.$transaction(async (tx) => {
    for (const e of valid) {
      const values = [
        Prisma.sql`${workshopId}`,
        Prisma.sql`${e.speakerId ?? null}`,
      ];
      const columns = [
        Prisma.sql`"workshopId"`,
        Prisma.sql`"speakerId"`,
      ];

      if (schemaSupport.sourceChunkId) {
        columns.push(Prisma.sql`source_chunk_id`);
        values.push(Prisma.sql`${e.sourceChunkId}`);
      }
      if (schemaSupport.capturedAt) {
        columns.push(Prisma.sql`captured_at`);
        values.push(Prisma.sql`${new Date(e.capturedAt)}`);
      }
      if (schemaSupport.sourcePath) {
        columns.push(Prisma.sql`source_path`);
        values.push(Prisma.sql`CAST(${sourcePath} AS "RawTranscriptSourcePath")`);
      }

      columns.push(
        Prisma.sql`text`,
        Prisma.sql`"startTimeMs"`,
        Prisma.sql`"endTimeMs"`,
        Prisma.sql`confidence`,
        Prisma.sql`"speechFinal"`,
        Prisma.sql`sequence`,
      );
      values.push(
        Prisma.sql`${e.text}`,
        Prisma.sql`${BigInt(Math.round(e.startTimeMs ?? 0))}`,
        Prisma.sql`${BigInt(Math.round(e.endTimeMs ?? 0))}`,
        Prisma.sql`${typeof e.confidence === 'number' ? e.confidence : null}`,
        Prisma.sql`${e.speechFinal ?? false}`,
        Prisma.sql`${e.sequence ?? 0}`,
      );

      const conflictClause = schemaSupport.sourceChunkId
        ? Prisma.sql` ON CONFLICT ("workshopId", source_chunk_id) DO NOTHING`
        : Prisma.empty;

      const inserted = await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO raw_transcript_entries (${Prisma.join(columns, ', ')})
          VALUES (${Prisma.join(values, ', ')})
          ${conflictClause}
        `
      );
      written += inserted;
    }
  });

  return NextResponse.json({
    ok: true,
    written,
    duplicates: valid.length - written,
    sourcePath,
  });
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
