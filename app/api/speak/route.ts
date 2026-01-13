import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    console.log('🔊 Generating speech with OpenAI TTS...');
    console.log('Text length:', text.length, 'characters');

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova', // Female, clear, natural voice
      input: text,
      speed: 1.1, // Good conversational pace
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
