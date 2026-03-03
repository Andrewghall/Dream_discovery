/**
 * POST /api/workshops/[id]/prep/discovery-briefing
 *
 * Triggers the Discovery Intelligence Agent to synthesize
 * participant interview responses into a workshop briefing.
 * Streams agent conversation via SSE.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runDiscoveryIntelligenceAgent } from '@/lib/cognition/agents/discovery-intelligence-agent';
import type { PrepContext, AgentConversationEntry, WorkshopPrepResearch } from '@/lib/cognition/agents/agent-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

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
      prepResearch: true,
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
  };

  const research = workshop.prepResearch as unknown as WorkshopPrepResearch | null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        try { controller.enqueue(encoder.encode(payload)); } catch { /* closed */ }
      }

      sendEvent('agent.conversation', {
        timestampMs: Date.now(),
        agent: 'prep-orchestrator',
        to: 'discovery-intelligence-agent',
        message: `Participants have completed their Discovery interviews. Discovery Intelligence Agent — could you synthesize their responses into a workshop briefing? This will seed the live facilitation agents with pre-workshop knowledge.`,
        type: 'handoff',
      } satisfies AgentConversationEntry);

      try {
        const intelligence = await runDiscoveryIntelligenceAgent(context, research, (entry) => {
          sendEvent('agent.conversation', entry);
        });

        // Store briefing
        await prisma.workshop.update({
          where: { id: workshopId },
          data: { discoveryBriefing: JSON.parse(JSON.stringify(intelligence)) },
        });

        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: 'discovery-intelligence-agent',
          message: `Thank you. The workshop briefing has been stored. ${intelligence.discoveryThemes.length} themes, ${intelligence.painPoints.length} pain points, ${intelligence.aspirations.length} aspirations identified. This intelligence will seed the live workshop agents.`,
          type: 'acknowledgement',
        } satisfies AgentConversationEntry);

        sendEvent('briefing.complete', { intelligence });
      } catch (error) {
        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: '',
          message: `Discovery synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'info',
        } satisfies AgentConversationEntry);

        sendEvent('error', { message: error instanceof Error ? error.message : 'Synthesis failed' });
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
