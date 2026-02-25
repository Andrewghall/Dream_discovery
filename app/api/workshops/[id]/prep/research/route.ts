/**
 * POST /api/workshops/[id]/prep/research
 *
 * Triggers the Research Agent for pre-workshop intelligence.
 * Streams agent conversation entries via SSE so the prep page
 * can show the live agent dialogue.
 *
 * Stores research output in Workshop.prepResearch JSON field.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runResearchAgent } from '@/lib/cognition/agents/research-agent';
import type { PrepContext, AgentConversationEntry } from '@/lib/cognition/agents/agent-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for research

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
      clientName: true,
      industry: true,
      companyWebsite: true,
      dreamTrack: true,
      targetDomain: true,
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
    clientName: workshop.clientName,
    industry: workshop.industry,
    companyWebsite: workshop.companyWebsite,
    dreamTrack: workshop.dreamTrack as 'ENTERPRISE' | 'DOMAIN' | null,
    targetDomain: workshop.targetDomain,
  };

  // ── SSE stream ─────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream may have been closed by client
        }
      }

      // Emit opening orchestrator message
      const openingEntry: AgentConversationEntry = {
        timestampMs: Date.now(),
        agent: 'prep-orchestrator',
        to: 'research-agent',
        message: `Good morning. We're preparing for a workshop with ${context.clientName || 'a client'}${context.industry ? ` in the ${context.industry} industry` : ''}. ${context.dreamTrack === 'DOMAIN' ? `The DREAM track is Domain, focused on ${context.targetDomain || 'a specific area'}.` : 'The DREAM track is Enterprise — full end-to-end assessment.'} Could you please research the company and provide context that will help us tailor our approach?`,
        type: 'handoff',
      };
      sendEvent('agent.conversation', openingEntry);

      try {
        // Run the Research Agent with conversation callbacks
        const research = await runResearchAgent(context, (entry) => {
          sendEvent('agent.conversation', entry);
        });

        // Store research in workshop
        await prisma.workshop.update({
          where: { id: workshopId },
          data: { prepResearch: JSON.parse(JSON.stringify(research)) },
        });

        // Emit orchestrator acknowledgement
        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: 'research-agent',
          message: `Thank you, Research Agent. The research findings have been stored. ${research.keyPublicChallenges.length} key challenges and ${research.recentDevelopments.length} recent developments identified. This context will inform our question set tailoring.`,
          type: 'acknowledgement',
        } satisfies AgentConversationEntry);

        // Emit completion event with full research
        sendEvent('research.complete', { research });
      } catch (error) {
        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: '',
          message: `Research encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
          type: 'info',
        } satisfies AgentConversationEntry);

        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Research agent failed',
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
