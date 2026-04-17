import { NextRequest, NextResponse } from 'next/server';
import { requireExecAuth } from '@/lib/auth/require-exec-auth';
import { prisma } from '@/lib/prisma';
import { retrieveRelevant } from '@/lib/embeddings/retrieve';
import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI();

const AskSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000).trim(),
});

export async function POST(request: NextRequest) {
  const auth = await requireExecAuth();
  if (auth instanceof NextResponse) return auth;

  const { execOrgId } = auth;

  const rawBody = await request.json().catch(() => null);
  const parsed = AskSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { message } = parsed.data;

  // Load workshop data
  const scratchpad = await prisma.workshopScratchpad.findFirst({
    where: { workshop: { organizationId: execOrgId } },
    orderBy: { updatedAt: 'desc' },
    include: {
      workshop: {
        select: { id: true, name: true, evidenceSynthesis: true },
      },
    },
  });

  if (!scratchpad?.v2Output) {
    return NextResponse.json({ error: 'No discovery data available.' }, { status: 404 });
  }

  const workshopId = scratchpad.workshopId;
  const v2 = scratchpad.v2Output as Record<string, unknown>;
  const evidenceSynthesis = scratchpad.workshop?.evidenceSynthesis;

  const org = await prisma.organization.findUnique({
    where: { id: execOrgId },
    select: { name: true },
  });

  // Vector retrieval for relevant chunks
  let vectorContext = '';
  try {
    const chunks = await retrieveRelevant(message.trim(), {
      organizationId: execOrgId,
      workshopId,
      topK: 6,
      sources: ['conversation_insights', 'discovery_themes', 'document_chunks', 'workshop_scratchpads'],
    });
    if (chunks.length) {
      vectorContext = '\n\n=== RETRIEVED SUPPORTING EVIDENCE ===\n' +
        chunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
    }
  } catch {
    // vector retrieval is best-effort
  }

  // Build system prompt
  const systemPrompt = `You are an expert strategic advisor with exclusive access to ${org?.name ?? 'this organisation'}'s DREAM Discovery workshop results. You help executives understand their findings, constraints, and recommended path forward.

You must answer factually using only the data below. Never invent findings, metrics, or recommendations not present in the data. Be direct, precise, and commercially astute. Speak as a trusted advisor — not a chatbot.

=== WORKSHOP: ${scratchpad.workshop?.name ?? 'DREAM Discovery'} ===
Organisation: ${org?.name ?? 'Unknown'}

=== KEY DISCOVERY FINDINGS ===
${JSON.stringify((v2?.discover as Record<string, unknown>)?.truths ?? [], null, 2)}

=== CONSTRAINTS ===
${JSON.stringify((v2?.constraints as Record<string, unknown>)?.clusters ?? [], null, 2)}

=== PATH FORWARD ===
${JSON.stringify((v2?.pathForward as Record<string, unknown>)?.steps ?? [], null, 2)}

=== TARGET OUTCOMES ===
${JSON.stringify((v2?.outcomes as Record<string, unknown>)?.items ?? [], null, 2)}

=== FUTURE STATES (REIMAGINE) ===
${JSON.stringify((v2?.reimagine as Record<string, unknown>)?.futureStates ?? [], null, 2)}

${evidenceSynthesis ? `=== EVIDENCE SYNTHESIS ===\n${JSON.stringify(evidenceSynthesis, null, 2)}` : ''}
${vectorContext}`;

  // Stream response
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message.trim() },
    ],
    stream: true,
  });

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          controller.enqueue(new TextEncoder().encode(delta));
        }
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
