import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { strictLimiter } from '@/lib/rate-limit'

const openai = new OpenAI()

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
}

export async function POST(req: NextRequest) {
  const rl = await strictLimiter.check(20, `speak:${getIp(req)}`).catch(() => null)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now()) / 1000).toString() } }
    )
  }

  try {
    const { text } = await req.json() as { text?: string }
    if (!text?.trim()) return NextResponse.json({ error: 'Missing text' }, { status: 400 })

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text.trim(),
      speed: 0.95,
    })

    const buffer = Buffer.from(await mp3.arrayBuffer())
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
  }
}
