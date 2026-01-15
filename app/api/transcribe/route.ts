import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { env } from '@/lib/env';

export async function POST(request: NextRequest) {
  try {
    const referer = request.headers.get('referer');
    const origin = request.headers.get('origin');
    const userAgent = request.headers.get('user-agent');
    console.log('🎤 /api/transcribe called', { referer, origin, userAgent });

    if (!env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI is not configured (missing OPENAI_API_KEY)' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('🎤 Transcribing audio with Whisper...');
    console.log('Audio file size:', audioFile.size, 'bytes');
    console.log('Audio file type:', audioFile.type);
    console.log('Audio file name:', audioFile.name);

    // Check if audio file is too small (likely empty or corrupted)
    if (audioFile.size < 1000) {
      console.warn('⚠️ Audio file too small, likely empty');
      return NextResponse.json(
        { error: 'Audio recording too short or empty' },
        { status: 400 }
      );
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text',
      temperature: 0.2, // Lower temperature for more accurate transcription
    });

    console.log('✅ Transcription:', transcription);

    // Check if transcription is empty or too short
    if (!transcription || transcription.length < 2) {
      console.warn('⚠️ Transcription too short or empty');
      return NextResponse.json(
        { error: 'Could not transcribe audio. Please speak clearly and try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      text: transcription,
    });
  } catch (error: any) {
    console.error('❌ Transcription error:', error);
    console.error('Error details:', error.message);

    const status = typeof error?.status === 'number' ? error.status : 500;
    if (status === 401) {
      return NextResponse.json(
        {
          error: 'OpenAI authentication failed (invalid OPENAI_API_KEY)',
          detail: error?.message || 'Unauthorized',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to transcribe audio: ' + error.message },
      { status }
    );
  }
}
