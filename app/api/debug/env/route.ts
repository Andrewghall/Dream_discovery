import { NextResponse } from 'next/server';

 import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mask(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 8) return `${'*'.repeat(trimmed.length)}`;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

function parseDbUrl(value: string | undefined) {
  if (!value) {
    return {
      protocol: null,
      host: null,
      port: null,
      database: null,
      schema: null,
    };
  }

  try {
    const u = new URL(value.trim());
    const pathname = (u.pathname || '').replace(/^\//, '');
    const schema = u.searchParams.get('schema');
    return {
      protocol: u.protocol || null,
      host: u.hostname || null,
      port: u.port || null,
      database: pathname || null,
      schema: schema || null,
    };
  } catch {
    return {
      protocol: null,
      host: null,
      port: null,
      database: null,
      schema: null,
    };
  }
}

export async function GET() {
  const deepgram = process.env.DEEPGRAM_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  const directDatabaseUrl = process.env.DIRECT_DATABASE_URL;

  let db: { ok: boolean; currentSchema: string | null; workshopCount: number | null; error: string | null } = {
    ok: false,
    currentSchema: null,
    workshopCount: null,
    error: null,
  };

  try {
    const schemaRows = await prisma.$queryRaw<Array<{ s: string }>>`select current_schema() as s`;
    const currentSchema = schemaRows?.[0]?.s ?? null;
    const workshopCount = await prisma.workshop.count();
    db = { ok: true, currentSchema, workshopCount, error: null };
  } catch (e) {
    db = {
      ok: false,
      currentSchema: null,
      workshopCount: null,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }

  return NextResponse.json({
    hasDeepgramKey: Boolean(deepgram && deepgram.trim()),
    hasOpenAIKey: Boolean(openai && openai.trim()),
    deepgramKeyMask: mask(deepgram),
    openaiKeyMask: mask(openai),
    databaseUrlMask: mask(databaseUrl),
    directDatabaseUrlMask: mask(directDatabaseUrl),
    databaseUrlInfo: parseDbUrl(databaseUrl),
    directDatabaseUrlInfo: parseDbUrl(directDatabaseUrl),
    db,
    nodeEnv: process.env.NODE_ENV || null,
  });
}
