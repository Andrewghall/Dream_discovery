import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error); } catch { return 'Unknown error'; }
}

export async function POST(request: NextRequest) {
  try {
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramKey) {
      return NextResponse.json(
        { error: 'Deepgram is not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (audioFile.size < 1000) {
      return NextResponse.json({ text: '' });
    }

    const buf = Buffer.from(await audioFile.arrayBuffer());

    // Normalise content type — strip codecs param so Deepgram accepts it
    const rawType = (audioFile.type || '').trim();
    const contentType = rawType.includes(';') ? rawType.slice(0, rawType.indexOf(';')).trim() : rawType || 'audio/webm';

    const url = new URL('https://api.deepgram.com/v1/listen');
    url.searchParams.set('model', 'nova-3');
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('filler_words', 'false');
    url.searchParams.set('language', 'en');

    const dgRes = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Token ${deepgramKey}`,
        'Content-Type': contentType,
      },
      body: buf,
    });

    if (!dgRes.ok) {
      const body = await dgRes.text();
      console.error('Deepgram error', { status: dgRes.status, body });
      return NextResponse.json(
        { error: 'Transcription service error', upstreamStatus: dgRes.status },
        { status: dgRes.status >= 500 ? 502 : dgRes.status }
      );
    }

    const payload = await dgRes.json() as Record<string, unknown>;
    const results = payload.results as Record<string, unknown> | undefined;
    const channels = Array.isArray((results as { channels?: unknown })?.channels)
      ? ((results as { channels: unknown[] }).channels)
      : [];
    const ch0 = channels[0] as Record<string, unknown> | undefined;
    const alts = Array.isArray(ch0?.alternatives) ? (ch0.alternatives as unknown[]) : [];
    const alt0 = alts[0] as Record<string, unknown> | undefined;
    const text = typeof alt0?.transcript === 'string' ? alt0.transcript.trim() : '';

    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to transcribe audio', detail: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
