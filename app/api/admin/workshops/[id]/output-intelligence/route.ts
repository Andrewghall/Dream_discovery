/**
 * DREAM Output Intelligence API
 *
 * GET  — Returns stored intelligence (or null if not yet generated)
 * POST — Generates intelligence via 5 parallel GPT-4o agents with SSE streaming
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { aggregateWorkshopSignals, computeSignalsHash } from '@/lib/output-intelligence/signal-aggregator';
import { runIntelligencePipeline } from '@/lib/output-intelligence/pipeline';
import type { StoredOutputIntelligence, EngineKey } from '@/lib/output-intelligence/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

// ── Engine metadata ───────────────────────────────────────────────────────────

const ENGINE_LABELS: Record<EngineKey, string> = {
  discoveryValidation: 'Discovery Validation',
  rootCause: 'Root Cause Intelligence',
  futureState: 'Future State Design',
  roadmap: 'Execution Roadmap',
  strategicImpact: 'Strategic Impact',
};

// ── GET: Return stored intelligence ──────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { outputIntelligence: true },
    });

    if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

    if (!workshop.outputIntelligence) {
      return NextResponse.json({ intelligence: null });
    }

    const stored = workshop.outputIntelligence as unknown as StoredOutputIntelligence;
    return NextResponse.json({ intelligence: stored });
  } catch (error) {
    console.error('[Output Intelligence GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch intelligence' },
      { status: 500 }
    );
  }
}

// ── POST: Generate intelligence with SSE streaming ────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workshopId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Client disconnected
        }
      }

      try {
        // 1. Aggregate signals
        sendEvent('status', { message: 'Collecting workshop signals…' });
        const signals = await aggregateWorkshopSignals(workshopId);
        const signalsHash = computeSignalsHash(signals);

        sendEvent('status', {
          message: `Signals collected. Lenses: ${signals.context.lenses.join(', ')}. Launching 5 intelligence agents…`,
        });

        // 2. Run all 5 engines in parallel with SSE progress
        const { intelligence, errors } = await runIntelligencePipeline(
          signals,
          (engine: EngineKey, event: 'started' | 'complete' | 'error', detail?: string) => {
            const label = ENGINE_LABELS[engine];
            if (event === 'started') {
              sendEvent('engine.started', { engine, label });
            } else if (event === 'complete') {
              sendEvent('engine.complete', { engine, label });
            } else {
              sendEvent('engine.error', { engine, label, error: detail ?? 'Unknown error' });
            }
          }
        );

        // 3. Store to DB
        const stored: StoredOutputIntelligence = {
          version: 1,
          generatedAtMs: intelligence.generatedAtMs,
          lensesUsed: intelligence.lensesUsed,
          signalsHash,
          intelligence,
        };

        await prisma.workshop.update({
          where: { id: workshopId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { outputIntelligence: stored as any },
        });

        // 4. Report any engine errors
        if (Object.keys(errors).length > 0) {
          sendEvent('partial.errors', { errors });
        }

        // 5. Complete
        sendEvent('complete', {
          intelligence,
          lensesUsed: intelligence.lensesUsed,
          generatedAtMs: intelligence.generatedAtMs,
        });
      } catch (error) {
        console.error('[Output Intelligence POST] Error:', error);
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Intelligence generation failed',
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
