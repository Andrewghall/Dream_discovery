/**
 * Discover Analysis API
 *
 * GET  — Returns cached analysis if exists
 * POST — Generates full analysis with SSE progress streaming
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { computeAlignment } from '@/lib/discover-analysis/compute-alignment';
import { computeNarrative } from '@/lib/discover-analysis/compute-narrative';
import { computeConfidence } from '@/lib/discover-analysis/compute-confidence';
import { computeConstraints } from '@/lib/discover-analysis/compute-constraints';
import { rankTensionsDeterministic } from '@/lib/discover-analysis/compute-tensions';
import { runDiscoverAnalysisAgent } from '@/lib/cognition/agents/discover-analysis-agent';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';
import type { NarrativeLayer } from '@/lib/types/discover-analysis';

export const maxDuration = 120;

// ── GET: Return cached analysis ──────────────────────────────

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { discoverAnalysis: true },
    });

    if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

    if (!workshop.discoverAnalysis) {
      return NextResponse.json({ analysis: null });
    }

    return NextResponse.json({ analysis: workshop.discoverAnalysis });
  } catch (error) {
    console.error('[Discover Analysis GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch analysis' },
      { status: 500 },
    );
  }
}

// ── POST: Generate analysis with SSE progress ────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    // Parse optional layer overrides from body
    let layerOverrides: Record<string, NarrativeLayer> | undefined;
    try {
      const body = await request.json();
      if (body.layerOverrides && typeof body.layerOverrides === 'object') {
        layerOverrides = body.layerOverrides;
      }
    } catch {
      // No body or invalid JSON — that's fine
    }

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        id: true,
        name: true,
        discoveryBriefing: true,
      },
    });

    if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function emit(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        }

        try {
          emit('progress', { step: 'starting', message: 'Starting organisational analysis...' });

          // ── Step 1: Deterministic computations in parallel ──
          emit('progress', { step: 'computing', message: 'Computing alignment, narrative, confidence, and constraints...' });

          const [alignment, narrative, constraintsBase] = await Promise.all([
            computeAlignment(workshopId),
            computeNarrative(workshopId, layerOverrides),
            computeConstraints(workshopId),
          ]);

          // Build layer lookup from narrative assignments for confidence computation
          const layerLookup = new Map<string, NarrativeLayer>();
          for (const a of narrative.layerAssignments) {
            layerLookup.set(a.participantId, a.layer);
          }

          const confidence = await computeConfidence(workshopId, layerLookup);

          emit('progress', { step: 'deterministic_done', message: 'Base computations complete. Running GPT analysis...' });

          // ── Step 2: GPT agent for tensions + constraint deps ──
          const intelligence = workshop.discoveryBriefing as Record<string, unknown> | null;
          const divergenceAreas = extractDivergenceAreas(intelligence);
          const watchPoints = extractWatchPoints(intelligence);
          const painPoints = extractPainPoints(intelligence);
          const themeQuotes = extractThemeQuotes(intelligence);

          // Count participants
          const participantCount = await prisma.workshopParticipant.count({
            where: { workshopId, responseCompletedAt: { not: null } },
          });

          let tensions = { tensions: [] as DiscoverAnalysis['tensions']['tensions'] };
          let updatedConstraints = constraintsBase;

          // Only run GPT agent if there's meaningful data
          if (divergenceAreas.length > 0 || constraintsBase.constraints.length > 0) {
            try {
              const agentResult = await runDiscoverAnalysisAgent(
                {
                  workshopName: workshop.name || 'Workshop',
                  divergenceAreas,
                  watchPoints,
                  themeQuotes,
                  constraintNodes: constraintsBase.constraints,
                  painPoints,
                },
                (message) => emit('progress', { step: 'agent', message }),
              );

              // Apply deterministic ranking formula to override GPT ordering
              tensions = rankTensionsDeterministic(agentResult.tensions);
              updatedConstraints = {
                constraints: agentResult.updatedConstraints,
                relationships: agentResult.constraintRelationships,
              };
            } catch (error) {
              console.error('[Discover Analysis] GPT agent failed, using base data:', error);
              emit('progress', { step: 'agent_fallback', message: 'GPT analysis unavailable — using base data' });
            }
          }

          // ── Step 3: Compose and store ──
          const analysis: DiscoverAnalysis = {
            workshopId,
            generatedAt: new Date().toISOString(),
            participantCount,
            alignment,
            tensions,
            narrative,
            constraints: updatedConstraints,
            confidence,
          };

          await prisma.workshop.update({
            where: { id: workshopId },
            data: { discoverAnalysis: JSON.parse(JSON.stringify(analysis)) },
          });

          emit('analysis.complete', { analysis });
          emit('done', { success: true });
        } catch (error) {
          console.error('[Discover Analysis] Pipeline failed:', error);
          emit('error', {
            message: error instanceof Error ? error.message : 'Analysis pipeline failed',
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
  } catch (error) {
    console.error('[Discover Analysis POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate analysis' },
      { status: 500 },
    );
  }
}

// ── Data extraction helpers ──────────────────────────────────

function extractDivergenceAreas(
  intelligence: Record<string, unknown> | null,
): Array<{ topic: string; perspectives: string[] }> {
  if (!intelligence) return [];
  const raw = intelligence.divergenceAreas;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .map((d) => ({
      topic: String(d.topic || ''),
      perspectives: Array.isArray(d.perspectives) ? d.perspectives.map(String) : [],
    }))
    .filter((d) => d.topic);
}

function extractWatchPoints(intelligence: Record<string, unknown> | null): string[] {
  if (!intelligence) return [];
  const raw = intelligence.watchPoints;
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

function extractPainPoints(
  intelligence: Record<string, unknown> | null,
): Array<{ description: string; domain: string; severity: string }> {
  if (!intelligence) return [];
  const raw = intelligence.painPoints;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => ({
      description: String(p.description || ''),
      domain: String(p.domain || 'General'),
      severity: String(p.severity || 'moderate'),
    }))
    .filter((p) => p.description);
}

function extractThemeQuotes(
  intelligence: Record<string, unknown> | null,
): Record<string, string[]> {
  if (!intelligence) return {};
  const themes = intelligence.discoveryThemes;
  if (!Array.isArray(themes)) return {};

  const result: Record<string, string[]> = {};
  for (const t of themes) {
    if (!t || typeof t !== 'object') continue;
    const theme = t as Record<string, unknown>;
    const title = String(theme.title || '');
    const quotes = Array.isArray(theme.keyQuotes) ? theme.keyQuotes.map(String) : [];
    if (title && quotes.length > 0) {
      result[title] = quotes;
    }
  }
  return result;
}
