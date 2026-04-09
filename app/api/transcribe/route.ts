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
    const languageRaw = formData.get('language');
    const language = typeof languageRaw === 'string' && languageRaw.trim() ? languageRaw.trim() : 'en';

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
      model: 'gpt-4o-transcribe',  // Significantly better than whisper-1 on mobile audio and accented speech
      language,
      response_format: 'text',
      // Note: gpt-4o-transcribe does not support 'temperature' parameter
      prompt: 'Workshop facilitation discussion about business strategy, digital transformation, customer experience, and organisational change.',
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
  } catch (error: unknown) {
    console.error('❌ Transcription error:', error);
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message)
        : 'Unknown error';
    console.error('Error details:', message);

    const status =
      typeof error === 'object' && error && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : 500;
    if (status === 401) {
      return NextResponse.json(
        {
          error: 'OpenAI authentication failed (invalid OPENAI_API_KEY)',
          detail: message || 'Unauthorized',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to transcribe audio: ' + message },
      { status }
    );
  }
}
