/**
 * Participant-accessible TTS endpoint for GTM free-flow discovery.
 *
 * Uses tts-1-hd + nova voice (warm, natural, conversational).
 * Validates that the caller holds a real discovery token — no admin
 * session required, so participants can use it without being logged in.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

export async function POST(request: NextRequest) {
  if (!openai) {
    return NextResponse.json({ error: 'TTS not configured' }, { status: 500 });
  }

  let text: string;
  let token: string;

  try {
    const body = await request.json() as { text?: string; token?: string };
    text  = (body.text  ?? '').trim();
    token = (body.token ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!text)  return NextResponse.json({ error: 'No text provided' },  { status: 400 });
  if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 400 });
  if (text.length > 4096) return NextResponse.json({ error: 'Text too long' }, { status: 400 });

  // Validate token — must belong to a real participant
  const participant = await (prisma as any).workshopParticipant.findUnique({
    where: { discoveryToken: token },
    select: { id: true },
  }).catch(() => null);

  if (!participant) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',    // High-fidelity — eliminates the robotic quality
      voice: 'nova',         // Warm, expressive, conversational
      input: text,
      speed: 0.97,           // Slightly relaxed — feels natural, not rushed
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[speak-discovery] TTS error:', err);
    return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
  }
}
