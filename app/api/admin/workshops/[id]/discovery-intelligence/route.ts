/**
 * POST /api/admin/workshops/[id]/discovery-intelligence
 *
 * Agentic discovery diagnostic — copied from the Jo Air pattern.
 *
 * Pipeline:
 *   1. runDiscoveryIntelligenceAgent → WorkshopIntelligence (cached in discoveryBriefing)
 *   2. GPT-4o turns that structured briefing into 4 executive diagnostic sections
 *   3. Merged into scratchpad.discoveryOutput and persisted
 *
 * Streams SSE progress events: progress → complete (or error).
 * No dependency on discoverAnalysis — the agent is the sole signal source.
 */

import type { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runDiscoveryIntelligenceAgent } from '@/lib/cognition/agents/discovery-intelligence-agent';
import { hasDiscoveryData } from '@/lib/cognition/agents/agent-types';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import type { PrepContext, WorkshopPrepResearch, WorkshopIntelligence } from '@/lib/cognition/agents/agent-types';

export const runtime = 'nodejs';
export const maxDuration = 90;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Diagnostic prompt built from the agent's structured output ────────────────

function buildDiagnosticPrompt(
  intelligence: WorkshopIntelligence,
  sections: any[],
): string {
  const themes = intelligence.discoveryThemes
    ?.slice(0, 8)
    .map(t => `  • [${t.domain}] "${t.title}" — sentiment: ${t.sentiment}, freq: ${t.frequency}`)
    .join('\n') ?? '';

  const painPoints = intelligence.painPoints
    ?.slice(0, 6)
    .map(p => `  • [${p.domain}] ${p.description} — severity: ${p.severity}`)
    .join('\n') ?? '';

  const consensus = intelligence.consensusAreas?.slice(0, 5).map(a => `  • ${a}`).join('\n') ?? '';

  const divergence = intelligence.divergenceAreas
    ?.slice(0, 4)
    .map(d => `  • "${d.topic}": ${d.perspectives?.join(' vs ') ?? ''}`)
    .join('\n') ?? '';

  const aspirations = intelligence.aspirations?.slice(0, 5).map(a => `  • ${a}`).join('\n') ?? '';
  const watchPoints = intelligence.watchPoints?.slice(0, 4).map(w => `  • ${w}`).join('\n') ?? '';

  const domainSignals = sections
    .slice(0, 8)
    .map((s: any) => {
      const topThemes = (s.topThemes ?? []).slice(0, 5).join(', ');
      const quotes = (s.quotes ?? [])
        .slice(0, 2)
        .map((q: any) => `"${q.text}" — ${q.author}`)
        .join(' | ');
      const sentiment = s.sentiment
        ? `concerned ${s.sentiment.concerned ?? 0}% / neutral ${s.sentiment.neutral ?? 0}% / optimistic ${s.sentiment.optimistic ?? 0}%`
        : '';
      return `Domain: ${s.domain} | ${s.utteranceCount ?? 0} insights | Consensus: ${s.consensusLevel ?? 0}%\n  Themes: ${topThemes}\n  Sentiment: ${sentiment}\n  Quotes: ${quotes || 'none'}`;
    })
    .join('\n\n');

  return `You are the DREAM Organisational Brain Scanner. Interpret these discovery signals and produce clear executive intelligence.

This is pre-workshop discovery intelligence for ${intelligence.participantCount ?? 'multiple'} participants.

─── AGENT SYNTHESIS ───
Summary: ${intelligence.briefingSummary ?? 'No summary available.'}

Discovery Themes:
${themes || '  (none)'}

Pain Points:
${painPoints || '  (none)'}

Consensus Areas:
${consensus || '  (none)'}

Divergence Areas:
${divergence || '  (none)'}

Aspirations:
${aspirations || '  (none)'}

Watch Points:
${watchPoints || '  (none)'}

─── DOMAIN SIGNALS ───
${domainSignals || '(no domain data)'}

─── YOUR TASK ───

Generate 4 executive intelligence sections. Every insight must be grounded in the signals above. No filler language. Every sentence must carry diagnostic weight.

Return valid JSON:
{
  "operationalReality": {
    "insight": "3-4 sentences. How this organisation actually operates — workflow patterns, decision pathways, information flow, reliance on experience vs systems.",
    "evidence": [
      "Specific domain signal, theme, or quote revealing how work flows",
      "Actor behaviour or sentiment pattern from domain analysis",
      "Pain point or friction signal showing operational constraint",
      "A watch point or divergence signal if relevant"
    ]
  },
  "organisationalMisalignment": {
    "insight": "3-4 sentences. Where the organisation is fractured — perception gaps, cross-team tensions, conflicting actor priorities.",
    "evidence": [
      "Specific divergence area with actor positions",
      "A pain point revealing cross-team or leadership tension",
      "Domain sentiment contrast showing where perspectives split",
      "A theme with negative sentiment and high frequency"
    ]
  },
  "systemicFriction": {
    "insight": "3-4 sentences. Structural friction preventing effective operation — process bottlenecks, technology limitations, knowledge fragmentation.",
    "evidence": [
      "The highest-severity pain point: description and domain",
      "A second pain point that compounds the first",
      "A domain signal with high concerned sentiment",
      "A watch point flagging systemic risk"
    ]
  },
  "transformationReadiness": {
    "insight": "3-4 sentences. Capability for change — maturity signals, ambition vs structural limitations. State whether transformation looks easy, difficult, or constrained.",
    "evidence": [
      "Aspiration signals and which domains they appear in",
      "Consensus areas showing where alignment exists",
      "Watch points as readiness risk signals",
      "A divergence area that complicates transformation"
    ]
  },
  "finalDiscoverySummary": "2-3 sentences. Executive diagnosis: how the organisation operates, the most important tensions, the primary friction, and readiness for transformation. Direct and specific."
}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) {
    return new Response(JSON.stringify({ error: access.error }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        try { controller.enqueue(encoder.encode(payload)); } catch { /* stream closed */ }
      }

      try {
        // ── 1. Load workshop + scratchpad ──────────────────────────────────
        const [workshop, scratchpad] = await Promise.all([
          prisma.workshop.findUnique({
            where: { id: workshopId },
            select: {
              id: true,
              description: true,
              businessContext: true,
              clientName: true,
              industry: true,
              companyWebsite: true,
              dreamTrack: true,
              targetDomain: true,
              prepResearch: true,
              blueprint: true,
              discoveryBriefing: true,
            },
          }),
          prisma.workshopScratchpad.findUnique({
            where: { workshopId },
            select: { discoveryOutput: true },
          }),
        ]);

        if (!workshop) {
          sendEvent('error', { message: 'Workshop not found.' });
          controller.close();
          return;
        }

        // ── 2. Ensure discoveryBriefing exists (agentic step) ─────────────
        const existingBriefing = workshop.discoveryBriefing as Record<string, unknown> | null;
        let intelligence: WorkshopIntelligence;

        if (!hasDiscoveryData(existingBriefing)) {
          sendEvent('progress', { step: 'agent', message: 'Running discovery intelligence agent…' });

          const context: PrepContext = {
            workshopId,
            workshopPurpose: workshop.description,
            desiredOutcomes: workshop.businessContext,
            clientName: workshop.clientName,
            industry: workshop.industry,
            companyWebsite: workshop.companyWebsite,
            dreamTrack: workshop.dreamTrack as 'ENTERPRISE' | 'DOMAIN' | null,
            targetDomain: workshop.targetDomain,
            blueprint: readBlueprintFromJson(workshop.blueprint),
          };

          const research = workshop.prepResearch as WorkshopPrepResearch | null;
          intelligence = await runDiscoveryIntelligenceAgent(context, research);

          await prisma.workshop.update({
            where: { id: workshopId },
            data: { discoveryBriefing: JSON.parse(JSON.stringify(intelligence)) },
          });
        } else {
          intelligence = existingBriefing as unknown as WorkshopIntelligence;
        }

        // ── 3. Validate scratchpad discovery data ─────────────────────────
        if (!scratchpad?.discoveryOutput) {
          sendEvent('error', { message: 'No discovery output data found. Run discovery interviews first.' });
          controller.close();
          return;
        }

        const discoveryOutput = scratchpad.discoveryOutput as Record<string, unknown>;
        const sections = (discoveryOutput.sections as any[]) ?? [];

        if (sections.length === 0) {
          sendEvent('error', { message: 'No domain sections in discovery data. Hemisphere synthesis may be needed.' });
          controller.close();
          return;
        }

        // ── 4. Generate 4 executive diagnostic sections ───────────────────
        sendEvent('progress', { step: 'diagnostic', message: 'Generating executive diagnostic…' });

        const prompt = buildDiagnosticPrompt(intelligence, sections);

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.35,
        });

        const raw = completion.choices[0]?.message?.content ?? '{}';
        let generated: Record<string, unknown>;
        try {
          generated = JSON.parse(raw);
        } catch {
          sendEvent('error', { message: 'Failed to parse diagnostic response from GPT.' });
          controller.close();
          return;
        }

        // ── 5. Merge into scratchpad and persist ──────────────────────────
        const updatedDiscoveryOutput = {
          ...discoveryOutput,
          operationalReality:         generated.operationalReality         ?? null,
          organisationalMisalignment: generated.organisationalMisalignment ?? null,
          systemicFriction:           generated.systemicFriction           ?? null,
          transformationReadiness:    generated.transformationReadiness    ?? null,
          finalDiscoverySummary:      generated.finalDiscoverySummary      ?? null,
        } as Prisma.InputJsonValue;

        await prisma.workshopScratchpad.update({
          where: { workshopId },
          data: { discoveryOutput: updatedDiscoveryOutput, updatedAt: new Date() },
        });

        sendEvent('complete', { discoveryOutput: updatedDiscoveryOutput });

      } catch (error) {
        console.error('[Discovery Intelligence] Error:', error);
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Failed to generate discovery intelligence',
        });
      } finally {
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
}
