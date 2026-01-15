import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mask(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 8) return `${'*'.repeat(trimmed.length)}`;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export async function GET() {
  const deepgram = process.env.DEEPGRAM_API_KEY;
  const openai = process.env.OPENAI_API_KEY;

  return NextResponse.json({
    hasDeepgramKey: Boolean(deepgram && deepgram.trim()),
    hasOpenAIKey: Boolean(openai && openai.trim()),
    deepgramKeyMask: mask(deepgram),
    openaiKeyMask: mask(openai),
    nodeEnv: process.env.NODE_ENV || null,
  });
}
