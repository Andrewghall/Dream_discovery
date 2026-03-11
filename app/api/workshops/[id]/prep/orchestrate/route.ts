/**
 * POST /api/workshops/[id]/prep/orchestrate
 *
 * Triggers the full Prep Orchestrator chain:
 *   Research Agent → Question Set Agent
 *
 * Streams all agent conversation entries via SSE.
 * Use this for the "Run Full Prep" flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { strictLimiter } from '@/lib/rate-limit';
import { runPrepOrchestrator } from '@/lib/cognition/agents/prep-orchestrator';
import { ResearchClarificationNeededError } from '@/lib/cognition/agents/research-agent';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import { readHistoricalMetricsFromJson } from '@/lib/historical-metrics/types';
import type { PrepContext, AgentConversationEntry } from '@/lib/cognition/agents/agent-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes: deep research (gpt-4o) + question set generation

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
  const rl = await strictLimiter.check(10, `prep-orchestrate:${ip}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now()) / 1000).toString() } }
    );
  }

  const { id: workshopId } = await params;

  // ── Auth ────────────────────────────────────────────
  const user = await getAuthenticatedUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validation = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Load workshop context ──────────────────────────
  const workshop = await prisma.workshop.findUnique({
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
      blueprint: true,
      historicalMetrics: true,
    },
  });

  if (!workshop) {
    return new Response(JSON.stringify({ error: 'Workshop not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
    historicalMetrics: readHistoricalMetricsFromJson(workshop.historicalMetrics),
  };

  // ── SSE stream ─────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch { /* stream closed */ }
      }

      try {
        const result = await runPrepOrchestrator(context, (entry) => {
          sendEvent('agent.conversation', entry);
        });

        if (result.research) {
          sendEvent('research.complete', { research: result.research });
        }

        if (result.questionSet) {
          sendEvent('questions.generated', { questions: result.questionSet });
        }

        sendEvent('prep.complete', {
          success: result.success,
          hasResearch: !!result.research,
          hasQuestions: !!result.questionSet,
        });
      } catch (error) {
        if (error instanceof ResearchClarificationNeededError) {
          sendEvent('agent.conversation', {
            timestampMs: Date.now(),
            agent: 'prep-orchestrator',
            to: '',
            message: `Prep has been paused. The Research Agent could not verify the company. Please update the workshop with the correct company name and official website URL, then try again.`,
            type: 'warning',
          } satisfies AgentConversationEntry);

          sendEvent('clarification_needed', {
            reason: error.message,
            whatWasFound: error.whatWasFound,
            suggestedAction: `Please go back to the workshop setup and provide the official website URL, or correct the company name, then re-run prep.`,
          });
        } else {
          sendEvent('agent.conversation', {
            timestampMs: Date.now(),
            agent: 'prep-orchestrator',
            to: '',
            message: `Prep orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'info',
          } satisfies AgentConversationEntry);

          sendEvent('error', {
            message: error instanceof Error ? error.message : 'Prep orchestration failed',
          });
        }
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
