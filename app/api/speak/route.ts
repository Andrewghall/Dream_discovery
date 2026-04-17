import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession } from '@/lib/auth/session';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const getTtsSpeed = () => {
  const raw = Number(process.env.OPENAI_TTS_SPEED ?? '1.15');
  if (!Number.isFinite(raw)) return 1.15;
  return clamp(raw, 0.25, 4);
};

export async function POST(request: NextRequest) {
  // Auth guard — must be an authenticated admin session
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // Hard cap to prevent abuse of OpenAI quota
    if (text.length > 4096) {
      return NextResponse.json(
        { error: 'Text exceeds maximum length of 4096 characters' },
        { status: 400 }
      );
    }

    console.log('🔊 Generating speech with OpenAI TTS...');
    console.log('Text length:', text.length, 'characters');

    const speed = getTtsSpeed();

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova', // Female, clear, natural voice
      input: text,
      speed,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    console.log('✅ Speech generated, size:', buffer.length, 'bytes');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('❌ TTS error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
