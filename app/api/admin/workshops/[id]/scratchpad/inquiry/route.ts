/**
 * Scratchpad Output Inquiry API
 *
 * POST - GPT-powered inquiry bar for facilitator questions about
 * the synthesised workshop output. Streams responses via SSE with
 * full scratchpad context including all tab summaries, archetype
 * classification, and hemisphere diagnostic data.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

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

    // Fetch workshop + scratchpad data
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        name: true,
        description: true,
        businessContext: true,
        industry: true,
        dreamTrack: true,
        targetDomain: true,
      },
    });

    if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

    const scratchpad = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
    });

    if (!scratchpad) {
      return NextResponse.json({ error: 'No scratchpad output available. Generate the report first.' }, { status: 400 });
    }

    // Build system prompt with scratchpad context
    const systemPrompt = buildScratchpadInquiryPrompt(workshop, scratchpad);

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
          console.error('[Scratchpad Inquiry] Stream error:', error);
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
    console.error('[Scratchpad Inquiry POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Inquiry failed' },
      { status: 500 },
    );
  }
}

// ── System prompt builder ─────────────────────────────────────

function buildScratchpadInquiryPrompt(
  workshop: { name: string | null; description: string | null; businessContext: string | null; industry: string | null; dreamTrack: string | null; targetDomain: string | null },
  scratchpad: Record<string, unknown>,
): string {
  const sections: string[] = [];

  // Workshop context
  sections.push(`Workshop: "${workshop.name || 'Workshop'}"`);
  if (workshop.description) sections.push(`Purpose: ${workshop.description}`);
  if (workshop.businessContext) sections.push(`Desired Outcomes: ${workshop.businessContext}`);
  if (workshop.industry) sections.push(`Industry: ${workshop.industry}`);
  if (workshop.dreamTrack) sections.push(`DREAM Track: ${workshop.dreamTrack}${workshop.targetDomain ? ` (${workshop.targetDomain})` : ''}`);

  // Exec summary
  const execSummary = scratchpad.execSummary as Record<string, unknown> | null;
  if (execSummary) {
    sections.push('\n### Executive Summary');
    if (execSummary.overview) sections.push(String(execSummary.overview));
    if (Array.isArray(execSummary.keyFindings)) {
      const findings = execSummary.keyFindings as Array<{ title?: string; description?: string }>;
      sections.push('Key Findings:\n' + findings.slice(0, 7).map(f => `- ${f.title || ''}: ${f.description || ''}`).join('\n'));
    }
  }

  // AI Summaries from each tab
  const tabSummaries: Array<{ name: string; key: string }> = [
    { name: 'Discovery', key: 'discoveryOutput' },
    { name: 'Reimagine', key: 'reimagineContent' },
    { name: 'Constraints', key: 'constraintsContent' },
    { name: 'Solution', key: 'potentialSolution' },
    { name: 'Commercial', key: 'commercialContent' },
    { name: 'Customer Journey', key: 'customerJourney' },
    { name: 'Summary', key: 'summaryContent' },
  ];

  for (const tab of tabSummaries) {
    const data = scratchpad[tab.key] as Record<string, unknown> | null;
    if (!data) continue;
    const aiSummary = data._aiSummary as string | undefined;
    if (aiSummary) {
      sections.push(`\n### ${tab.name} (AI Summary)\n${aiSummary}`);
    }
  }

  // Summary tab details
  const summaryContent = scratchpad.summaryContent as Record<string, unknown> | null;
  if (summaryContent) {
    if (Array.isArray(summaryContent.keyFindings)) {
      const kf = summaryContent.keyFindings as Array<{ category?: string; findings?: string[] }>;
      sections.push('\n### Summary Key Findings\n' + kf.map(f => `${f.category}: ${(f.findings || []).join('; ')}`).join('\n'));
    }
    if (Array.isArray(summaryContent.recommendedNextSteps)) {
      const steps = summaryContent.recommendedNextSteps as Array<{ step?: string; timeframe?: string }>;
      sections.push('\n### Recommended Next Steps\n' + steps.map(s => `- ${s.step} (${s.timeframe || 'TBD'})`).join('\n'));
    }
  }

  // Archetype classification
  const assessment = scratchpad.outputAssessment as Record<string, unknown> | null;
  if (assessment) {
    sections.push(`\n### Output Assessment`);
    sections.push(`Archetype: ${String(assessment.primaryArchetype || 'unknown').replace(/_/g, ' ')}`);
    if (assessment.confidence) sections.push(`Confidence: ${Number(assessment.confidence) * 100}%`);
    if (assessment.rationale) sections.push(`Rationale: ${assessment.rationale}`);
  }

  // Constraints detail
  const constraintsData = scratchpad.constraintsContent as Record<string, unknown> | null;
  if (constraintsData) {
    const categories = ['regulatory', 'technical', 'commercial', 'organizational'];
    const constraintLines: string[] = [];
    for (const cat of categories) {
      const items = constraintsData[cat] as Array<{ title?: string; impact?: string; mitigation?: string }> | undefined;
      if (items?.length) {
        constraintLines.push(`${cat}: ${items.map(i => `${i.title} (${i.impact})`).join(', ')}`);
      }
    }
    if (constraintLines.length > 0) {
      sections.push('\n### Constraint Details\n' + constraintLines.join('\n'));
    }
  }

  return `You are a senior strategy consultant helping a facilitator understand the workshop output report for "${workshop.name || 'this workshop'}".

You have access to the full synthesised output data. Answer questions precisely, citing specific data points from the report. Use confident, executive-grade language. Be concise but thorough.

## Workshop Output Data

${sections.join('\n')}

## Guidelines
- Ground every answer in the data above
- When asked about strategy, reference specific findings, constraints, and recommendations
- When asked about priorities, reference the archetype assessment and constraint severity
- When asked about implementation, reference delivery phases and success metrics
- If the data does not support an answer, say so clearly
- Format responses with markdown for readability
- Never invent data that is not present in the output above`;
}
