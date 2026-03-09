/**
 * Discovery Search API
 *
 * POST — Answers a natural-language question using ALL available discovery knowledge:
 *   1. discoveryOutput.sections  — domain themes, quotes, sentiment, consensus
 *   2. discoveryOutput executive intelligence — Operational Reality, Misalignment, etc.
 *   3. discoverAnalysis           — alignment heatmap, tensions, constraints, narrative
 *   4. ConversationReport[]       — per-participant summaries, tone, key insights
 *   5. Finding[]                  — Stream A (remote) + Stream B (field discovery)
 *   6. DiagnosticSynthesis        — cross-lens summary + structural weaknesses
 *
 * Returns a Server-Sent Events stream with text chunks.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';

export const maxDuration = 90;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Context builders ──────────────────────────────────────────

function compactAlignment(analysis: DiscoverAnalysis): string {
  const cells = analysis.alignment?.cells ?? [];
  const divergent = cells
    .filter(c => c.alignmentScore < -0.05 && c.utteranceCount >= 2)
    .sort((a, b) => a.alignmentScore - b.alignmentScore)
    .slice(0, 8);
  if (divergent.length === 0) return '';
  return 'ALIGNMENT DIVERGENCE:\n' + divergent.map(c =>
    `  ${c.actor} / "${c.theme}": score ${c.alignmentScore.toFixed(2)} (${c.utteranceCount} signals)${c.sampleQuotes?.[0] ? ` — "${c.sampleQuotes[0]}"` : ''}`
  ).join('\n');
}

function compactTensions(analysis: DiscoverAnalysis): string {
  const tensions = (analysis.tensions?.tensions ?? []).slice(0, 6);
  if (tensions.length === 0) return '';
  return 'TENSIONS:\n' + tensions.map(t => {
    const vp = (t.viewpoints ?? []).slice(0, 3).map(v =>
      `    [${v.actor}] (${v.sentiment}): ${v.position}${v.evidenceQuote ? ` — "${v.evidenceQuote}"` : ''}`
    ).join('\n');
    return `  [${t.severity.toUpperCase()}] "${t.topic}" (${t.domain}, index ${t.tensionIndex.toFixed(1)})\n${vp}`;
  }).join('\n');
}

function compactConstraints(analysis: DiscoverAnalysis): string {
  const constraints = (analysis.constraints?.constraints ?? [])
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);
  if (constraints.length === 0) return '';
  return 'CONSTRAINTS:\n' + constraints.map(c =>
    `  [${c.severity.toUpperCase()}] ${c.description} (${c.domain}, freq ${c.frequency}, weight ${c.weight.toFixed(1)})`
  ).join('\n');
}

function compactNarrative(analysis: DiscoverAnalysis): string {
  const layers = analysis.narrative?.layers ?? [];
  const divPoints = (analysis.narrative?.divergencePoints ?? []).slice(0, 4);
  if (layers.length === 0) return '';
  const layerLines = layers.map(l => {
    const terms = (l.topTerms ?? []).slice(0, 5).map((t: any) => t.term).join(', ');
    const focus = l.temporalFocus
      ? `past ${Math.round(l.temporalFocus.past * 100)}% / present ${Math.round(l.temporalFocus.present * 100)}% / future ${Math.round(l.temporalFocus.future * 100)}%`
      : '';
    return `  ${l.layer.toUpperCase()} (${l.participantCount}p): ${l.dominantSentiment}, ${focus}, terms: ${terms}${l.samplePhrases?.[0] ? ` — e.g. "${l.samplePhrases[0]}"` : ''}`;
  }).join('\n');
  const divLines = divPoints.length > 0
    ? '\n  Divergence points:\n' + divPoints.map(d =>
        `    "${d.topic}": ` + (d.layerPositions ?? []).map((lp: any) => `${lp.layer}=${lp.sentiment}`).join(', ')
      ).join('\n')
    : '';
  return 'NARRATIVE DIVERGENCE:\n' + layerLines + divLines;
}

function compactConfidence(analysis: DiscoverAnalysis): string {
  const overall = analysis.confidence?.overall;
  if (!overall) return '';
  const t = (overall.certain + overall.hedging + overall.uncertain) || 1;
  return `CONFIDENCE: certain ${Math.round(overall.certain / t * 100)}% / hedging ${Math.round(overall.hedging / t * 100)}% / uncertain ${Math.round(overall.uncertain / t * 100)}%`;
}

// ── Main handler ──────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const query = (body.query as string)?.trim();
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

    // ── Load all discovery knowledge in parallel ──────────────

    const [workshop, scratchpad, reports, findings, synthesis] = await Promise.all([
      prisma.workshop.findUnique({
        where: { id: workshopId },
        select: {
          name: true,
          status: true,
          discoverAnalysis: true,
          participants: {
            select: {
              id: true,
              name: true,
              role: true,
              department: true,
              responseCompletedAt: true,
            },
          },
        },
      }),
      prisma.workshopScratchpad.findUnique({
        where: { workshopId },
        select: { discoveryOutput: true },
      }),
      prisma.conversationReport.findMany({
        where: { workshopId },
        select: {
          executiveSummary: true,
          tone: true,
          keyInsights: true,
          phaseInsights: true,
          participant: {
            select: { name: true, role: true, department: true },
          },
        },
      }),
      prisma.finding.findMany({
        where: { workshopId },
        select: {
          lens: true,
          type: true,
          title: true,
          description: true,
          severityScore: true,
          frequencyCount: true,
          roleCoverage: true,
          sourceStream: true,
          supportingQuotes: true,
        },
        orderBy: [{ severityScore: 'desc' }, { frequencyCount: 'desc' }],
        take: 60,
      }),
      prisma.diagnosticSynthesis.findUnique({
        where: { workshopId },
        select: { lensSummaries: true, crossLens: true, streamComparison: true },
      }),
    ]);

    if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

    const discoveryOutput = scratchpad?.discoveryOutput as Record<string, unknown> | null;
    const analysis = workshop.discoverAnalysis as DiscoverAnalysis | null;
    const sections = (discoveryOutput?.sections as any[]) ?? [];
    const completed = workshop.participants.filter(p => p.responseCompletedAt).length;

    // ── Build knowledge context ───────────────────────────────

    const blocks: string[] = [];

    // 1. Workshop overview
    blocks.push(
      `WORKSHOP: ${workshop.name} | Status: ${workshop.status}`,
      `PARTICIPANTS: ${workshop.participants.length} total, ${completed} completed discovery`,
      workshop.participants.length > 0
        ? 'PARTICIPANT ROSTER:\n' + workshop.participants.map(p =>
            `  ${p.name}${p.role ? ` (${p.role})` : ''}${p.department ? `, ${p.department}` : ''}${p.responseCompletedAt ? '' : ' [not completed]'}`
          ).join('\n')
        : '',
    );

    // 2. Domain section signals
    if (sections.length > 0) {
      blocks.push(
        'DOMAIN SIGNALS:\n' + sections.map((s: any) => {
          const quotes = (s.quotes ?? []).slice(0, 3).map((q: any) => `    "${q.text}" — ${q.author}`).join('\n');
          return `  ${s.domain}: ${s.utteranceCount} insights, consensus ${s.consensusLevel}%, concerned ${s.sentiment?.concerned ?? 0}% / optimistic ${s.sentiment?.optimistic ?? 0}%\n  Themes: ${(s.topThemes ?? []).join(', ')}\n${quotes}`;
        }).join('\n\n')
      );
    }

    // 3. Executive intelligence (4 sections)
    if (discoveryOutput?.operationalReality) {
      const sections4 = ['operationalReality', 'organisationalMisalignment', 'systemicFriction', 'transformationReadiness'] as const;
      const labels: Record<string, string> = {
        operationalReality: 'OPERATIONAL REALITY',
        organisationalMisalignment: 'ORGANISATIONAL MISALIGNMENT',
        systemicFriction: 'SYSTEMIC FRICTION',
        transformationReadiness: 'TRANSFORMATION READINESS',
      };
      const execBlocks = sections4.map(key => {
        const s = discoveryOutput[key] as any;
        if (!s?.insight) return null;
        const evidence = (s.evidence ?? []).map((e: string) => `    · ${e}`).join('\n');
        return `${labels[key]}:\n  ${s.insight}\n  Evidence:\n${evidence}`;
      }).filter(Boolean);
      if (execBlocks.length > 0) blocks.push('EXECUTIVE INTELLIGENCE:\n' + execBlocks.join('\n\n'));
      if (discoveryOutput.finalDiscoverySummary) {
        blocks.push(`DISCOVERY THESIS: ${discoveryOutput.finalDiscoverySummary}`);
      }
    }

    // 4. Analyse signals from discoverAnalysis
    if (analysis) {
      const alignment = compactAlignment(analysis);
      const tensions = compactTensions(analysis);
      const constraints = compactConstraints(analysis);
      const narrative = compactNarrative(analysis);
      const confidence = compactConfidence(analysis);
      [alignment, tensions, constraints, narrative, confidence].filter(Boolean).forEach(b => blocks.push(b));
    }

    // 5. Per-participant conversation reports
    if (reports.length > 0) {
      const reportLines = reports.map(r => {
        const insights = (r.keyInsights as any[])?.slice(0, 3).map((i: any) =>
          `    · ${i.text || i.insight || i.title || JSON.stringify(i).slice(0, 100)}`
        ).join('\n') ?? '';
        return `  ${r.participant.name}${r.participant.role ? ` (${r.participant.role})` : ''} — tone: ${r.tone ?? 'n/a'}\n  ${r.executiveSummary ?? ''}\n${insights}`;
      }).join('\n\n');
      blocks.push('PARTICIPANT REPORTS:\n' + reportLines);
    }

    // 6. Findings (Stream A remote + Stream B field)
    if (findings.length > 0) {
      const streamA = findings.filter(f => f.sourceStream === 'STREAM_A');
      const streamB = findings.filter(f => f.sourceStream === 'STREAM_B');

      const fmtFindings = (list: typeof findings) =>
        list.map(f => {
          const quotes = (f.supportingQuotes as any[])?.slice(0, 1).map((q: any) => q.text || q).join('') ?? '';
          return `  [${f.lens}] [${f.type}] ${f.title}: ${f.description}${f.severityScore ? ` (severity ${f.severityScore.toFixed(1)})` : ''}${quotes ? ` — "${quotes}"` : ''}`;
        }).join('\n');

      if (streamA.length > 0) blocks.push(`STREAM A FINDINGS (remote discovery, ${streamA.length} total):\n` + fmtFindings(streamA.slice(0, 25)));
      if (streamB.length > 0) blocks.push(`STREAM B FINDINGS (field discovery, ${streamB.length} total):\n` + fmtFindings(streamB.slice(0, 25)));
    }

    // 7. Diagnostic synthesis
    if (synthesis?.lensSummaries || synthesis?.crossLens) {
      const lensText = synthesis.lensSummaries
        ? 'LENS SUMMARIES:\n' + Object.entries(synthesis.lensSummaries as Record<string, any>).map(([lens, s]) =>
            `  ${lens}: ${typeof s === 'object' ? (s.summary || s.themes?.join(', ') || JSON.stringify(s).slice(0, 120)) : s}`
          ).join('\n')
        : '';
      const crossText = synthesis.crossLens
        ? 'CROSS-LENS ANALYSIS:\n' + (() => {
            const cl = synthesis.crossLens as any;
            const weaknesses = (cl.structuralWeaknesses ?? cl.structural_weaknesses ?? []).slice(0, 4).map((w: any) => `  · ${w.description || w}`).join('\n');
            const risks = (cl.systemicRisks ?? cl.systemic_risks ?? []).slice(0, 3).map((r: any) => `  · ${r.description || r}`).join('\n');
            return [weaknesses && `Structural weaknesses:\n${weaknesses}`, risks && `Systemic risks:\n${risks}`].filter(Boolean).join('\n');
          })()
        : '';
      [lensText, crossText].filter(Boolean).forEach(b => blocks.push(b));
    }

    const knowledgeContext = blocks.filter(Boolean).join('\n\n');

    // ── Stream GPT response ───────────────────────────────────

    const systemPrompt = `You are the DREAM Discovery Intelligence assistant for the workshop "${workshop.name}". You have access to the complete discovery knowledge base for this organisation.

Your role is to answer questions from facilitators and consultants about the organisation's discovery data.

Rules:
- Ground every answer in the specific data provided. Name actors, domains, findings, or participants by name when relevant.
- If asked about something not in the data, say so clearly — do not speculate beyond the signals.
- Be direct and executive in tone. No filler. No generic statements.
- For specific questions about individuals, reference their ConversationReport tone and insights.
- For questions about themes, tensions, or constraints — cite specific entries from the data.
- Keep answers focused and actionable. Structure with short paragraphs, not long walls of text.

DISCOVERY KNOWLEDGE BASE:
${knowledgeContext}`;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query },
            ],
            temperature: 0.3,
            stream: true,
            max_tokens: 1200,
          });

          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Stream error' })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Discovery Search POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search discovery knowledge' },
      { status: 500 },
    );
  }
}
