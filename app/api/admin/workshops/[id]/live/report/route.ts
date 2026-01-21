import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { generateLiveWorkshopReportPdf } from '@/lib/pdf/live-workshop-report';

export const runtime = 'nodejs';
export const maxDuration = 90;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type LivePhase = 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';

type LiveReportPayload = {
  title: string;
  subtitle: string;
  phaseLabel: string;
  visionStatement: string;
  executiveSummary: string;
  narrative: string;
  domainLenses: {
    People: string;
    Customer: string;
    Technology: string;
    Regulation: string;
    Organisation: string;
  };
  constraints: string;
  opportunities: string;
  approach: string;
  evidenceQuotes: string[];
};

function safePhase(value: string | null): LivePhase | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  if (v === 'REIMAGINE' || v === 'CONSTRAINTS' || v === 'DEFINE_APPROACH') return v as LivePhase;
  return null;
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeArray<T>(value: unknown, mapper: (v: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapper).filter((v): v is T => v !== null);
}

function phaseLabel(phase: LivePhase): string {
  if (phase === 'REIMAGINE') return 'Reimagine (Future Vision)';
  if (phase === 'CONSTRAINTS') return 'Constraints (Limits & Risks)';
  return 'Define Approach (Methods & Enablers)';
}

function extractLiveNotes(payload: unknown) {
  const rec = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  if (!rec) return { utterances: [] as string[], interpreted: [] as string[], themes: [] as string[], pressure: [] as string[] };

  const utterances = safeArray(rec.utterances, (u) => {
    if (!u || typeof u !== 'object') return null;
    const text = safeString((u as Record<string, unknown>).rawText);
    return text || null;
  });

  const interpreted = safeArray(rec.interpreted, (u) => {
    if (!u || typeof u !== 'object') return null;
    const text = safeString((u as Record<string, unknown>).rawText);
    const cls = (u as Record<string, unknown>).classification as Record<string, unknown> | null;
    const primary = safeString(cls?.primaryType);
    if (!text) return null;
    return primary ? `${primary}: ${text}` : text;
  });

  const synthesisByDomain = rec.synthesisByDomain && typeof rec.synthesisByDomain === 'object'
    ? (rec.synthesisByDomain as Record<string, unknown>)
    : null;

  const themes: string[] = [];
  if (synthesisByDomain) {
    for (const [domain, value] of Object.entries(synthesisByDomain)) {
      if (!value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      const push = (key: string) =>
        safeArray(v[key], (x) => {
          if (!x || typeof x !== 'object') return null;
          const label = safeString((x as Record<string, unknown>).label);
          return label ? `${domain}: ${label}` : null;
        });
      themes.push(...push('aspirations'));
      themes.push(...push('constraints'));
      themes.push(...push('enablers'));
      themes.push(...push('opportunities'));
    }
  }

  const pressure = safeArray(rec.pressurePoints, (p) => {
    if (!p || typeof p !== 'object') return null;
    const fromDomain = safeString((p as Record<string, unknown>).fromDomain);
    const toDomain = safeString((p as Record<string, unknown>).toDomain);
    const count = (p as Record<string, unknown>).count;
    const countStr = typeof count === 'number' ? ` (mentions ${count})` : '';
    return fromDomain && toDomain ? `Pressure: ${fromDomain} → ${toDomain}${countStr}` : null;
  });

  return { utterances, interpreted, themes, pressure };
}

function buildPrompt(params: {
  workshopName: string | null;
  phase: LivePhase;
  notes: string;
  themes: string[];
  pressure: string[];
}) {
  const phaseFocus = params.phase === 'REIMAGINE'
    ? 'Anchor the narrative in the future-state vision created in the live session.'
    : params.phase === 'CONSTRAINTS'
      ? 'Emphasize constraints, risks, blockers, and structural limits uncovered in the live session.'
      : 'Emphasize the proposed operating approach, enablers, and methods surfaced in the live session.';

  return `You are writing a long-form, agentic workshop report for a live facilitation session. The report must be detailed, executive-grade, and 2+ A4 pages (aim for 1200-1800 words). ${phaseFocus}

Return ONLY valid JSON with this schema:
{
  "visionStatement": string,
  "executiveSummary": string,
  "narrative": string,
  "domainLenses": {
    "People": string,
    "Customer": string,
    "Technology": string,
    "Regulation": string,
    "Organisation": string
  },
  "constraints": string,
  "opportunities": string,
  "approach": string,
  "evidenceQuotes": string[]
}

Rules:
- Use only the source material below; do not invent facts.
- Write in confident, board-level language.
- The narrative should read like a corporate vision story grounded in evidence.
- Include short direct quotes in evidenceQuotes (verbatim).
- Make each section multiple paragraphs.

Workshop: ${params.workshopName || 'Unknown'}
Phase: ${params.phase}

Themes:
${params.themes.map((t) => `- ${t}`).join('\n') || 'None'}

Pressure signals:
${params.pressure.map((t) => `- ${t}`).join('\n') || 'None'}

Source notes:
${params.notes}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const url = new URL(request.url);
    const phaseParam = safePhase(url.searchParams.get('phase'));
    const format = (url.searchParams.get('format') || 'pdf').toLowerCase();

    if (!phaseParam) {
      return NextResponse.json({ error: 'Missing or invalid phase' }, { status: 400 });
    }

    if (format !== 'pdf' && format !== 'docx') {
      return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { name: true },
    });

    const snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
      where: { workshopId, dialoguePhase: phaseParam },
      orderBy: { createdAt: 'desc' },
      select: { id: true, payload: true, createdAt: true },
    });

    if (!snapshot) {
      return NextResponse.json({ error: 'No live snapshot found for this phase' }, { status: 404 });
    }

    const extracted = extractLiveNotes(snapshot.payload);
    const notes = [...extracted.utterances, ...extracted.interpreted].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: buildPrompt({
            workshopName: workshop?.name ?? null,
            phase: phaseParam,
            notes,
            themes: extracted.themes,
            pressure: extracted.pressure,
          }),
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed: Partial<LiveReportPayload> = {};
    try {
      parsed = JSON.parse(raw) as Partial<LiveReportPayload>;
    } catch {
      parsed = {};
    }

    const domainLenses = parsed.domainLenses && typeof parsed.domainLenses === 'object'
      ? (parsed.domainLenses as Record<string, unknown>)
      : {};

    const reportPayload: LiveReportPayload = {
      title: 'Live Workshop Report',
      subtitle: workshop?.name ?? 'Workshop',
      phaseLabel: phaseLabel(phaseParam),
      visionStatement: safeString(parsed.visionStatement) || 'Agentic synthesis unavailable (invalid model response).',
      executiveSummary: safeString(parsed.executiveSummary) || 'Agentic synthesis unavailable (invalid model response).',
      narrative: safeString(parsed.narrative) || 'Agentic synthesis unavailable (invalid model response).',
      domainLenses: {
        People: safeString(domainLenses.People) || 'Agentic synthesis unavailable (invalid model response).',
        Customer: safeString(domainLenses.Customer) || 'Agentic synthesis unavailable (invalid model response).',
        Technology: safeString(domainLenses.Technology) || 'Agentic synthesis unavailable (invalid model response).',
        Regulation: safeString(domainLenses.Regulation) || 'Agentic synthesis unavailable (invalid model response).',
        Organisation: safeString(domainLenses.Organisation) || 'Agentic synthesis unavailable (invalid model response).',
      },
      constraints: safeString(parsed.constraints),
      opportunities: safeString(parsed.opportunities),
      approach: safeString(parsed.approach),
      evidenceQuotes: Array.isArray(parsed.evidenceQuotes)
        ? parsed.evidenceQuotes.filter((q) => typeof q === 'string')
        : [],
    };

    if (format === 'docx') {
      return NextResponse.json(
        { error: 'DOCX export not configured yet. Please use PDF for now.' },
        { status: 501 }
      );
    }

    const pdf = await generateLiveWorkshopReportPdf(reportPayload);
    const filename = `Live-Workshop-${phaseParam}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate live report';
    console.error('Failed to generate live report:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
