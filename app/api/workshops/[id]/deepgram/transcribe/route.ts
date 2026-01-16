import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeContentType(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return 'application/octet-stream';
  const semi = raw.indexOf(';');
  if (semi >= 0) return raw.slice(0, semi).trim();
  return raw;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const referer = request.headers.get('referer');
    const origin = request.headers.get('origin');
    const userAgent = request.headers.get('user-agent');

    await params; // reserved for future use; keeps the URL workshop-scoped

    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramKey) {
      return NextResponse.json(
        { error: 'Deepgram is not configured (missing DEEPGRAM_API_KEY)' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (audioFile.size < 1000) {
      return NextResponse.json(
        { error: 'Audio chunk too short or empty' },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await audioFile.arrayBuffer());
    const headerHex = buf.subarray(0, 16).toString('hex');
    const normalizedContentType = normalizeContentType(audioFile.type);

    console.log('🎧 /deepgram/transcribe called', {
      referer,
      origin,
      userAgent,
      fileType: audioFile.type,
      normalizedContentType,
      size: audioFile.size,
      headerHex,
    });

    const url = new URL('https://api.deepgram.com/v1/listen');
    url.searchParams.set('model', 'nova-2');
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('diarize', 'false');

    const dgRes = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Token ${deepgramKey}`,
        'Content-Type': normalizedContentType,
      },
      body: buf,
    });

    const upstreamText = await dgRes.text();
    let payload: unknown = {};
    try {
      payload = upstreamText ? (JSON.parse(upstreamText) as unknown) : {};
    } catch {
      payload = { raw: upstreamText };
    }

    const payloadRec: Record<string, unknown> =
      payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};

    if (!dgRes.ok) {
      console.error('Deepgram transcription failed', {
        status: dgRes.status,
        statusText: dgRes.statusText,
        body: payload,
        normalizedContentType,
        size: audioFile.size,
        headerHex,
      });
      return NextResponse.json(
        {
          error: 'Deepgram transcription failed',
          upstreamStatus: dgRes.status,
          upstreamStatusText: dgRes.statusText,
          upstreamBody: payload,
          debug: {
            normalizedContentType,
            size: audioFile.size,
            headerHex,
          },
        },
        { status: dgRes.status }
      );
    }

    const results =
      payloadRec.results && typeof payloadRec.results === 'object'
        ? (payloadRec.results as Record<string, unknown>)
        : null;
    const channels =
      results && Array.isArray((results as { channels?: unknown }).channels)
        ? (((results as { channels?: unknown }).channels as unknown[]) || [])
        : Array.isArray(payloadRec.channels)
          ? (payloadRec.channels as unknown[])
          : [];
    const channel0 = channels[0] && typeof channels[0] === 'object' ? (channels[0] as Record<string, unknown>) : null;
    const alternatives =
      channel0 && Array.isArray(channel0.alternatives) ? (channel0.alternatives as unknown[]) : [];
    const alt0 = alternatives[0] && typeof alternatives[0] === 'object' ? (alternatives[0] as Record<string, unknown>) : null;

    const transcript = alt0 && typeof alt0.transcript === 'string' ? alt0.transcript : '';
    const text = String(transcript || '').trim();

    console.log('✅ Deepgram transcript extracted', {
      length: text.length,
      preview: text.slice(0, 140),
    });
    const confidence = alt0 && typeof alt0.confidence === 'number' ? alt0.confidence : null;

    return NextResponse.json({ text, confidence });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to transcribe audio', detail: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
