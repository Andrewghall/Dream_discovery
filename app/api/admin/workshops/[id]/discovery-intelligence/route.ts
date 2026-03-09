/**
 * Discovery Intelligence API
 *
 * POST — Generates 4 executive intelligence sections from discovery data alone.
 *        No dependency on hemisphere synthesis or workshop phase data.
 *        Designed to run before the workshop begins.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    // Load scratchpad discoveryOutput — the source signal for this analysis
    const scratchpad = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
      select: {
        discoveryOutput: true,
      },
    });

    if (!scratchpad?.discoveryOutput) {
      return NextResponse.json(
        { error: 'No discovery output data found. Run discovery interviews first.' },
        { status: 400 },
      );
    }

    const discoveryOutput = scratchpad.discoveryOutput as Record<string, unknown>;
    const sections = (discoveryOutput.sections as any[]) || [];
    const aiSummary = (discoveryOutput._aiSummary as string) || '';
    const participants = (discoveryOutput.participants as string[]) || [];
    const totalUtterances = (discoveryOutput.totalUtterances as number) || 0;

    if (sections.length === 0) {
      return NextResponse.json(
        { error: 'No domain sections found in discovery data. Synthesis may be needed.' },
        { status: 400 },
      );
    }

    // Build a compact signal summary from sections for the prompt
    const sectionSignals = sections.map((s: any) => {
      const topThemes = (s.topThemes || []).slice(0, 4).join(', ');
      const quotes = (s.quotes || [])
        .slice(0, 2)
        .map((q: any) => `"${q.text}" — ${q.author}`)
        .join(' | ');
      const sentiment = s.sentiment
        ? `concerned ${s.sentiment.concerned}% / neutral ${s.sentiment.neutral}% / optimistic ${s.sentiment.optimistic}%`
        : '';
      return `Domain: ${s.domain} | ${s.utteranceCount} insights | Consensus: ${s.consensusLevel}%
  Top themes: ${topThemes}
  Sentiment: ${sentiment}
  Sample quotes: ${quotes || 'none'}`;
    }).join('\n\n');

    const prompt = `You are the DREAM Organisational Brain Scanner generating pre-workshop executive intelligence. This analysis is derived purely from pre-workshop discovery conversations — before the workshop has run.

${aiSummary ? `Perception Summary: ${aiSummary}\n` : ''}
Workshop participants: ${participants.length} | Total insights: ${totalUtterances}

Domain signals from discovery conversations:
${sectionSignals}

Generate ONLY the following 4 executive intelligence sections. Each must be grounded in the above domain signals. No generic language. Every sentence must carry diagnostic weight.

Return valid JSON with this exact structure:
{
  "operationalReality": {
    "insight": "3-4 sentences on how this organisation actually operates. Name specific operational patterns, bottlenecks, volume pressures, and workflow gaps revealed by these discovery conversations.",
    "evidence": ["specific signal 1 from domains above", "signal 2", "signal 3", "signal 4"]
  },
  "organisationalMisalignment": {
    "insight": "3-4 sentences on where the organisation is fractured. Actor tensions, cross-domain conflicts, misaligned priorities, siloed knowledge — specific to this discovery data.",
    "evidence": ["signal 1 naming actors or domains in tension", "signal 2", "signal 3", "signal 4"]
  },
  "systemicFriction": {
    "insight": "3-4 sentences on what is actively slowing transformation. Technology gaps, process debt, governance blocks, capability shortfalls — derived from the constraint and sentiment patterns above.",
    "evidence": ["signal 1 citing specific constraints", "signal 2", "signal 3", "signal 4"]
  },
  "transformationReadiness": {
    "insight": "3-4 sentences on whether this organisation is capable of change. Balance positive signals (ambition, readiness, champions) against risk signals (resistance, dependencies, gaps) — as revealed in this discovery data.",
    "evidence": ["signal 1 — readiness indicator or risk", "signal 2", "signal 3", "signal 4"]
  },
  "finalDiscoverySummary": "2-3 sentence executive diagnosis. The single most important thing this discovery data reveals about this organisation and what it means for their transformation journey."
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let generated: Record<string, unknown>;
    try {
      generated = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Failed to parse GPT response' }, { status: 500 });
    }

    // Merge generated sections back into existing discoveryOutput (preserving sections, participants, etc.)
    const updatedDiscoveryOutput = {
      ...discoveryOutput,
      operationalReality: generated.operationalReality ?? null,
      organisationalMisalignment: generated.organisationalMisalignment ?? null,
      systemicFriction: generated.systemicFriction ?? null,
      transformationReadiness: generated.transformationReadiness ?? null,
      finalDiscoverySummary: generated.finalDiscoverySummary ?? null,
    } as Prisma.InputJsonValue;

    // Save back to scratchpad
    await prisma.workshopScratchpad.update({
      where: { workshopId },
      data: {
        discoveryOutput: updatedDiscoveryOutput,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ discoveryOutput: updatedDiscoveryOutput });
  } catch (error) {
    console.error('[Discovery Intelligence POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate discovery intelligence' },
      { status: 500 },
    );
  }
}
