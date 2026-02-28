/**
 * Discover Analysis Inquiry API
 *
 * POST — GPT-powered inquiry bar for facilitator questions about the analysis.
 * Streams responses via SSE with full analysis context.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';

export const maxDuration = 60;

const MODEL = 'gpt-4o';

interface InquiryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const body = await request.json();
    const question = String(body.question || '').trim();
    const history: InquiryMessage[] = Array.isArray(body.history) ? body.history : [];

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Fetch analysis data
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        name: true,
        discoverAnalysis: true,
        discoveryBriefing: true,
      },
    });

    if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

    const analysis = workshop.discoverAnalysis as DiscoverAnalysis | null;
    if (!analysis) {
      return NextResponse.json({ error: 'No analysis available. Generate the analysis first.' }, { status: 400 });
    }

    // Build system prompt with analysis context
    const systemPrompt = buildInquirySystemPrompt(workshop.name || 'Workshop', analysis);

    // Build messages
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (max 10 turns)
    for (const msg of history.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content });
    }

    messages.push({ role: 'user', content: question });

    // Stream response
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const stream = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      messages,
      stream: true,
      max_tokens: 2000,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
              );
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (error) {
          console.error('[Inquiry] Stream error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Inquiry POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Inquiry failed' },
      { status: 500 },
    );
  }
}

// ── System prompt ────────────────────────────────────────────

function buildInquirySystemPrompt(workshopName: string, analysis: DiscoverAnalysis): string {
  // Summarise key data points for context window efficiency
  const tensionSummary = analysis.tensions.tensions
    .slice(0, 8)
    .map((t) => `- [${t.severity}] ${t.topic}: ${t.viewpoints.map((v) => `${v.actor} says "${v.position}"`).join('; ')}`)
    .join('\n');

  const alignmentSummary = `${analysis.alignment.themes.length} themes x ${analysis.alignment.actors.length} actors analysed`;

  const narrativeSummary = analysis.narrative.layers
    .map((l) => `${l.layer}: ${l.participantCount} participants, ${l.dominantSentiment} sentiment, top terms: ${l.topTerms.slice(0, 5).map((t) => t.term).join(', ')}`)
    .join('\n');

  const constraintSummary = analysis.constraints.constraints
    .slice(0, 10)
    .map((c) => `- [${c.severity}] ${c.description} (${c.domain}, weight: ${c.weight})`)
    .join('\n');

  const confidenceSummary = `Overall: ${analysis.confidence.overall.certain} certain, ${analysis.confidence.overall.hedging} hedging, ${analysis.confidence.overall.uncertain} uncertain`;

  const divergenceSummary = analysis.narrative.divergencePoints
    .slice(0, 5)
    .map((d) => `- ${d.topic}: ${d.layerPositions.map((p) => `${p.layer}=${p.sentiment}`).join(', ')}`)
    .join('\n');

  return `You are an executive organisational analyst helping a facilitator understand the Discover Analysis for workshop "${workshopName}".

You have access to the full analysis data. Answer questions precisely, citing specific data points. Use confident, executive-grade language. Be concise but thorough.

## Analysis Data (generated ${analysis.generatedAt})

**Participants:** ${analysis.participantCount}

### Alignment Heatmap
${alignmentSummary}
Themes: ${analysis.alignment.themes.join(', ')}
Actors: ${analysis.alignment.actors.join(', ')}

### Tensions (${analysis.tensions.tensions.length} identified)
${tensionSummary || '(none identified)'}

### Narrative Divergence
${narrativeSummary}

Divergence points:
${divergenceSummary || '(none identified)'}

### Constraints (${analysis.constraints.constraints.length} identified)
${constraintSummary || '(none identified)'}

### Confidence
${confidenceSummary}

## Guidelines
- Ground every answer in the data above
- When asked about tensions, reference specific viewpoints and actors
- When asked about alignment, reference specific theme×actor cells
- When asked about narratives, compare across layers with concrete examples
- If the data doesn't support an answer, say so clearly
- Format responses with markdown for readability`;
}
