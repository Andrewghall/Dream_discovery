import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    if (!env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 503 });
    }

    const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const truncated = text.length > 2500 ? text.slice(0, 2500) : text;

    const resp = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: truncated,
    });

    const embedding = resp.data?.[0]?.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      return NextResponse.json({ error: 'Embedding unavailable' }, { status: 500 });
    }

    return NextResponse.json({ embedding }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Embedding failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
