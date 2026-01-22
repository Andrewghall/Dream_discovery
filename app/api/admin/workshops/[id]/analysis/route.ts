import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHUNK_SIZE = 150;

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseIso(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

type ChunkSummary = {
  executiveSummary: string;
  keyThemes: string[];
  constraints: string[];
  opportunities: string[];
  evidenceQuotes: string[];
};

function chunkText(list: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

async function summarizeChunk(texts: string[], index: number): Promise<ChunkSummary> {
  const prompt = `Summarize this chunk of live workshop utterances with detailed, evidence-based outputs.

Return ONLY valid JSON with schema:
{
  "executiveSummary": string,
  "keyThemes": string[],
  "constraints": string[],
  "opportunities": string[],
  "evidenceQuotes": string[]
}

Rules:
- Use only the source text; do not invent facts.
- Provide concrete themes; avoid vague generalities.
- Include short verbatim quotes.
- Keep arrays to 3-8 items each.

Chunk ${index + 1} source:
${texts.map((t) => `- ${t}`).join('\n')}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    obj = {};
  }

  const arr = (value: unknown) => (Array.isArray(value) ? value.map((v) => safeString(v)).filter(Boolean) : []);

  return {
    executiveSummary: safeString(obj.executiveSummary),
    keyThemes: arr(obj.keyThemes),
    constraints: arr(obj.constraints),
    opportunities: arr(obj.opportunities),
    evidenceQuotes: arr(obj.evidenceQuotes),
  };
}

async function synthesizeFinal(chunks: ChunkSummary[], workshopName: string | null) {
  const prompt = `Create a detailed, executive-grade report from the chunk summaries.

Return ONLY valid JSON with schema:
{
  "visionStatement": string,
  "executiveSummary": string,
  "detailedNarrative": string,
  "themes": string[],
  "constraints": string[],
  "opportunities": string[],
  "evidenceQuotes": string[]
}

Rules:
- Use only the summaries below.
- Make the narrative long-form and specific.
- Include direct quotes (verbatim) in evidenceQuotes.

Workshop: ${workshopName || 'Unknown'}

Chunk summaries:
${chunks
  .map((c, idx) => `Chunk ${idx + 1}:\n- Summary: ${c.executiveSummary}\n- Themes: ${c.keyThemes.join('; ')}\n- Constraints: ${c.constraints.join('; ')}\n- Opportunities: ${c.opportunities.join('; ')}\n- Quotes: ${c.evidenceQuotes.join(' | ')}`)
  .join('\n\n')}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    obj = {};
  }

  const arr = (value: unknown) => (Array.isArray(value) ? value.map((v) => safeString(v)).filter(Boolean) : []);

  return {
    visionStatement: safeString(obj.visionStatement),
    executiveSummary: safeString(obj.executiveSummary),
    detailedNarrative: safeString(obj.detailedNarrative),
    themes: arr(obj.themes),
    constraints: arr(obj.constraints),
    opportunities: arr(obj.opportunities),
    evidenceQuotes: arr(obj.evidenceQuotes),
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    const { id: workshopId } = await params;
    const url = new URL(request.url);
    const startIso = url.searchParams.get('start');
    const endIso = url.searchParams.get('end');

    const start = parseIso(startIso);
    const end = parseIso(endIso);
    if (!start || !end) {
      return NextResponse.json({ error: 'Missing or invalid start/end query params (ISO strings).' }, { status: 400 });
    }

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { name: true },
    });

    const dataPoints = await prisma.dataPoint.findMany({
      where: {
        workshopId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: { rawText: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const texts = dataPoints.map((d) => safeString(d.rawText)).filter(Boolean);
    if (!texts.length) {
      return NextResponse.json({ error: 'No datapoints found in the requested time range.' }, { status: 404 });
    }

    const chunks = chunkText(texts, CHUNK_SIZE);
    const chunkSummaries: ChunkSummary[] = [];
    for (let i = 0; i < chunks.length; i += 1) {
      // sequential to avoid rate limits; can parallelize if needed
      // eslint-disable-next-line no-await-in-loop
      const summary = await summarizeChunk(chunks[i], i);
      chunkSummaries.push(summary);
    }

    const final = await synthesizeFinal(chunkSummaries, workshop?.name ?? null);

    return NextResponse.json({
      workshopId,
      range: { start: start.toISOString(), end: end.toISOString() },
      datapointCount: texts.length,
      chunkCount: chunks.length,
      chunkSummaries,
      report: final,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate analysis';
    console.error('Analysis error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
