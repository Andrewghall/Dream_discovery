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
import { Prisma } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runResearchAgent, ResearchClarificationNeededError } from '@/lib/cognition/agents/research-agent';
import { generateBlueprint } from '@/lib/cognition/workshop-blueprint-generator';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import type { PrepContext, AgentConversationEntry } from '@/lib/cognition/agents/agent-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 180; // 3 minutes for deep research with gpt-4o

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
      description: true,
      businessContext: true,
      clientName: true,
      industry: true,
      companyWebsite: true,
      dreamTrack: true,
      targetDomain: true,
      // Blueprint-relevant fields for regeneration after research
      engagementType: true,
      domainPack: true,
      blueprint: true,
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
      const purposeBlock = context.workshopPurpose
        ? `\n\nWORKSHOP PURPOSE (WHY WE ARE HERE): ${context.workshopPurpose}`
        : '';
      const outcomesBlock = context.desiredOutcomes
        ? `\nDESIRED OUTCOMES: ${context.desiredOutcomes}`
        : '';
      const openingEntry: AgentConversationEntry = {
        timestampMs: Date.now(),
        agent: 'prep-orchestrator',
        to: 'research-agent',
        message: `We're preparing for a workshop with ${context.clientName || 'a client'}${context.industry ? ` in the ${context.industry} industry` : ''}. ${context.dreamTrack === 'DOMAIN' ? `The DREAM track is Domain, focused on ${context.targetDomain || 'a specific area'}.` : 'The DREAM track is Enterprise - full end-to-end assessment.'}${purposeBlock}${outcomesBlock}\n\nResearch Agent, could you please research the company and provide context that will help us tailor our approach? Keep the workshop purpose and desired outcomes front of mind - all research should serve why we are here.`,
        type: 'handoff',
      };
      sendEvent('agent.conversation', openingEntry);

      try {
        // Clear any existing research before starting fresh
        await prisma.workshop.update({
          where: { id: workshopId },
          data: { prepResearch: Prisma.JsonNull },
        });

        // Run the Research Agent with conversation callbacks
        const research = await runResearchAgent(context, (entry) => {
          sendEvent('agent.conversation', entry);
        });

        // Regenerate blueprint with research-derived journey stages and dimensions
        const existingBp = readBlueprintFromJson(workshop.blueprint);
        const updatedBlueprint = generateBlueprint({
          industry: workshop.industry ?? null,
          dreamTrack: (workshop.dreamTrack as 'ENTERPRISE' | 'DOMAIN' | null) ?? null,
          engagementType: workshop.engagementType?.toLowerCase() ?? null,
          domainPack: workshop.domainPack ?? null,
          purpose: workshop.description ?? null,
          outcomes: workshop.businessContext ?? null,
          clientName: workshop.clientName ?? null,
          researchJourneyStages: research.journeyStages ?? null,
          researchDimensions: research.industryDimensions ?? null,
          researchActors: research.actorTaxonomy ?? null,
          previousVersion: existingBp?.blueprintVersion ?? 0,
        });

        // Store research and regenerated blueprint
        await prisma.workshop.update({
          where: { id: workshopId },
          data: {
            prepResearch: JSON.parse(JSON.stringify(research)),
            blueprint: updatedBlueprint as any,
          },
        });

        // Emit orchestrator acknowledgement
        sendEvent('agent.conversation', {
          timestampMs: Date.now(),
          agent: 'prep-orchestrator',
          to: 'research-agent',
          message: `Thank you, Research Agent. The research findings have been stored. ${research.keyPublicChallenges.length} key challenges and ${research.recentDevelopments.length} recent developments identified. This context will inform our question set tailoring.`,
          type: 'acknowledgement',
        } satisfies AgentConversationEntry);

        // Emit completion event with full research and updated blueprint
        sendEvent('research.complete', { research, blueprint: updatedBlueprint });
      } catch (error) {
        if (error instanceof ResearchClarificationNeededError) {
          // ── Company could not be verified — surface this cleanly to the UI ──
          sendEvent('agent.conversation', {
            timestampMs: Date.now(),
            agent: 'prep-orchestrator',
            to: '',
            message: `Research has been paused. The Research Agent could not verify that "${context.clientName}" exists as a known company. Please update the workshop with the correct company name and official website URL, then try again.`,
            type: 'warning',
          } satisfies AgentConversationEntry);

          sendEvent('clarification_needed', {
            reason: error.message,
            whatWasFound: error.whatWasFound,
            suggestedAction: `Please go back to the workshop setup and provide the official website URL for "${context.clientName}", or correct the company name, then re-run research.`,
          });
        } else {
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
