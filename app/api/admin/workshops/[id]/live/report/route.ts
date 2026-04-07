import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { generateLiveWorkshopReportPdf } from '@/lib/pdf/live-workshop-report';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import { getDimensionNames } from '@/lib/cognition/workshop-dimensions';

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
  domainLenses: Record<string, string>;
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

function extractDomainLens(byDomain: Record<string, any>, domain: string): string {
  if (!byDomain || !byDomain[domain]) {
    return `No ${domain} insights available from synthesis.`;
  }

  const domainData = byDomain[domain];
  const insights: string[] = [];

  const categories = ['aspirations', 'constraints', 'enablers', 'opportunities'];
  for (const category of categories) {
    if (domainData[category] && Array.isArray(domainData[category])) {
      const items = domainData[category];
      if (items.length > 0) {
        insights.push(`**${category.charAt(0).toUpperCase() + category.slice(1)}:**`);
        for (const item of items.slice(0, 3)) { // Top 3 per category
          // Agent returns 'label' not 'insight'
          const text = item.label || item.insight || '';
          if (text) {
            insights.push(`• ${text}`);
          }
        }
      }
    }
  }

  return insights.length > 0
    ? insights.join('\n')
    : `No ${domain} insights available from synthesis.`;
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
  lensNames: string[];
}) {
  const phaseFocus = params.phase === 'REIMAGINE'
    ? 'Anchor the narrative in the future-state vision created in the live session.'
    : params.phase === 'CONSTRAINTS'
      ? 'Emphasize constraints, risks, blockers, and structural limits uncovered in the live session.'
      : 'Emphasize the proposed operating approach, enablers, and methods surfaced in the live session.';

  const lensSchemaLines = params.lensNames.map((n) => `    "${n}": string`).join(',\n');

  return `You are writing a long-form, agentic workshop report for a live facilitation session. The report must be detailed, executive-grade, and 2+ A4 pages (aim for 1200-1800 words). ${phaseFocus}

Return ONLY valid JSON with this schema:
{
  "visionStatement": string,
  "executiveSummary": string,
  "narrative": string,
  "domainLenses": {
${lensSchemaLines}
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
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }
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
      select: { name: true, blueprint: true, prepResearch: true },
    });

    // Derive lens names from blueprint → research → default dimensions
    const blueprint = readBlueprintFromJson(workshop?.blueprint ?? null);
    const lensNames: string[] = blueprint?.lenses?.length
      ? blueprint.lenses.map((l) => l.name)
      : getDimensionNames((workshop as any)?.prepResearch as Parameters<typeof getDimensionNames>[0]);

    const snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
      where: { workshopId, dialoguePhase: phaseParam },
      orderBy: { createdAt: 'desc' },
      select: { id: true, payload: true, createdAt: true },
    });

    if (!snapshot) {
      return NextResponse.json({ error: 'No live snapshot found for this phase' }, { status: 404 });
    }

    // NEW: Call agentic synthesis endpoint to get real workshop data
    console.log('[Live Report] Calling agentic synthesis for workshop:', workshopId);

    let agenticSynthesis: any = null;
    try {
      const synthesisUrl = new URL(`/api/admin/workshops/${workshopId}/synthesize`, request.url);
      const forwardedCookie = request.headers.get('cookie');
      const forwardedAuthorization = request.headers.get('authorization');
      const synthesisResponse = await fetch(synthesisUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(forwardedCookie ? { cookie: forwardedCookie } : {}),
          ...(forwardedAuthorization ? { authorization: forwardedAuthorization } : {}),
        },
        body: JSON.stringify({ phase: phaseParam }),
      });

      if (synthesisResponse.ok) {
        agenticSynthesis = await synthesisResponse.json();
        console.log('[Live Report] Agentic synthesis received:', agenticSynthesis.utteranceCount, 'utterances analyzed');
      } else {
        console.warn('[Live Report] Synthesis failed, falling back to snapshot data');
      }
    } catch (synthError) {
      console.warn('[Live Report] Synthesis error, falling back to snapshot data:', synthError);
    }

    // If we have agentic synthesis, use it; otherwise fall back to old method
    let parsed: Partial<LiveReportPayload> = {};

    if (agenticSynthesis?.synthesis) {
      // Use agentic synthesis results directly
      console.log('[Live Report] Using agentic synthesis for report generation');
      const synthesis = agenticSynthesis.synthesis;

      // Transform synthesizedThemes array into byDomain object
      const byDomain: Record<string, any> = {};
      if (synthesis.synthesizedThemes && Array.isArray(synthesis.synthesizedThemes)) {
        for (const theme of synthesis.synthesizedThemes) {
          if (theme.domain) {
            byDomain[theme.domain] = theme;
          }
        }
      }

      // Build vision statement from aspirations across all domains
      const aspirations: string[] = [];
      for (const theme of synthesis.synthesizedThemes || []) {
        if (theme.aspirations && Array.isArray(theme.aspirations)) {
          aspirations.push(...theme.aspirations.map((a: any) => a.label || '').filter(Boolean));
        }
      }

      // Build constraints from synthesis
      const constraints: string[] = [];
      for (const theme of synthesis.synthesizedThemes || []) {
        if (theme.constraints && Array.isArray(theme.constraints)) {
          constraints.push(...theme.constraints.map((c: any) => c.label || '').filter(Boolean));
        }
      }

      // Build opportunities from synthesis
      const opportunities: string[] = [];
      for (const theme of synthesis.synthesizedThemes || []) {
        if (theme.opportunities && Array.isArray(theme.opportunities)) {
          opportunities.push(...theme.opportunities.map((o: any) => o.label || '').filter(Boolean));
        }
      }

      // Extract evidence quotes from synthesis
      const evidenceQuotes: string[] = [];
      for (const theme of synthesis.synthesizedThemes || []) {
        const categories = ['aspirations', 'constraints', 'enablers', 'opportunities'];
        for (const category of categories) {
          if (category in theme) {
            const items = (theme as any)[category] || [];
            for (const item of items) {
              if (item.evidence && Array.isArray(item.evidence)) {
                evidenceQuotes.push(...item.evidence.filter((e: any) => typeof e === 'string'));
              }
            }
          }
        }
      }

      parsed = {
        visionStatement: aspirations.length > 0
          ? `The workshop participants envision a future where:\n\n${aspirations.slice(0, 5).map((a, i) => `${i + 1}. ${a}`).join('\n\n')}`
          : 'Vision statement not available from synthesis.',
        executiveSummary: synthesis.crossDomainInsights && synthesis.crossDomainInsights.length > 0
          ? `Key insights from the workshop:\n\n${synthesis.crossDomainInsights.slice(0, 3).map((i: any) => `• ${i.insight || ''}`).join('\n\n')}`
          : 'Executive summary not available from synthesis.',
        narrative: `This workshop explored themes across ${Object.keys(byDomain).length} key domains, revealing ${aspirations.length} aspirations, ${constraints.length} constraints, and ${opportunities.length} opportunities.`,
        domainLenses: Object.fromEntries(
          lensNames.map((name) => [name, extractDomainLens(byDomain, name)]),
        ),
        constraints: constraints.length > 0
          ? constraints.map((c, i) => `${i + 1}. ${c}`).join('\n\n')
          : 'No constraints identified in synthesis.',
        opportunities: opportunities.length > 0
          ? opportunities.map((o, i) => `${i + 1}. ${o}`).join('\n\n')
          : 'No opportunities identified in synthesis.',
        approach: 'Approach recommendations based on agentic analysis.',
        evidenceQuotes: evidenceQuotes.slice(0, 10), // Top 10 evidence quotes
      };
    } else {
      // Fall back to old OpenAI synthesis from snapshot
      console.log('[Live Report] Falling back to snapshot-based synthesis');
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
              lensNames,
            }),
          },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices?.[0]?.message?.content || '{}';
      try {
        parsed = JSON.parse(raw) as Partial<LiveReportPayload>;
      } catch {
        parsed = {};
      }
    }

    const rawDomainLenses = parsed.domainLenses && typeof parsed.domainLenses === 'object'
      ? (parsed.domainLenses as Record<string, unknown>)
      : {};

    const reportPayload: LiveReportPayload = {
      title: 'Live Workshop Report',
      subtitle: workshop?.name ?? 'Workshop',
      phaseLabel: phaseLabel(phaseParam),
      visionStatement: safeString(parsed.visionStatement) || 'Agentic synthesis unavailable (invalid model response).',
      executiveSummary: safeString(parsed.executiveSummary) || 'Agentic synthesis unavailable (invalid model response).',
      narrative: safeString(parsed.narrative) || 'Agentic synthesis unavailable (invalid model response).',
      domainLenses: Object.fromEntries(
        lensNames.map((name) => [
          name,
          safeString(rawDomainLenses[name]) || 'Agentic synthesis unavailable (invalid model response).',
        ]),
      ),
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
