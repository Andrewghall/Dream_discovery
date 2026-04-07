/**
 * app/api/admin/workshops/[id]/generate-analysis/route.ts
 *
 * POST — Orchestrates the full analysis pipeline in sequence, streaming
 *         Server-Sent Events (SSE) progress back to the client.
 *
 * Sequence:
 *   1. Hemisphere synthesis (Discovery Synthesis)
 *   2. Output Intelligence pipeline
 *   3. Evidence Cross-Validation (skipped gracefully if no ready docs)
 *   4. Evidence Cross-Document Synthesis (skipped gracefully if < 2 ready docs)
 *   5. Behavioural Interventions (skipped gracefully if no OI output yet)
 *
 * Each pipeline is called as an internal HTTP fetch so that existing route
 * logic, rate limiting, and DB writes remain untouched.  Auth cookie is
 * forwarded so downstream routes can authenticate the request.
 *
 * SSE event format:
 *   { type: 'step_start',    step: number, total: number, label: string }
 *   { type: 'step_complete', step: number, label: string }
 *   { type: 'step_error',    step: number, label: string, error: string }
 *   { type: 'step_skipped',  step: number, label: string, reason: string }
 *   { type: 'done',          stepsCompleted: number, stepsFailed: number, stepsSkipped: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — all five pipelines can be slow

// ── Helpers ───────────────────────────────────────────────────────────────────

function ssePayload(event: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Consume an SSE stream from an internal route until it closes, then return
 * whether the stream ended with a terminal success or error event.
 *
 * successEvent: the SSE event type that signals the pipeline completed OK.
 * errorEvent:   the SSE event type that signals the pipeline failed.
 */
async function consumeSSEStream(
  response: Response,
  successEvent: string,
  errorEvent: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!response.body) {
    return { ok: false, error: 'No response body from pipeline' };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: { ok: boolean; error?: string } = { ok: true };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          // Check for error events in the various SSE formats used by pipelines
          if (
            line.includes(`"${errorEvent}"`) ||
            parsed?.error ||
            parsed?.type === 'error'
          ) {
            result = {
              ok: false,
              error:
                parsed?.error ??
                parsed?.message ??
                'Pipeline reported an error',
            };
          }
        } catch {
          // non-JSON line — skip
        }
      }
    }
  } catch (err) {
    result = {
      ok: false,
      error: err instanceof Error ? err.message : 'Stream read error',
    };
  } finally {
    reader.releaseLock();
  }

  return result;
}

/** Derive the internal base URL for server-side fetch calls. */
function internalBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') ?? 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

/** Forward cookies so downstream routes can authenticate. */
function forwardCookieHeader(request: NextRequest): string {
  return request.headers.get('cookie') ?? '';
}

// ── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id: workshopId } = await params;
  const access = await validateWorkshopAccess(
    workshopId,
    auth.organizationId,
    auth.role,
    auth.userId,
  );
  if (!access.valid) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  // Check evidence doc count up-front so we can decide whether steps 3 & 4 run
  const readyDocCount = await prisma.evidenceDocument.count({
    where: { workshopId, status: 'ready' },
  });

  const baseUrl = internalBaseUrl(request);
  const cookieHeader = forwardCookieHeader(request);
  const fetchHeaders = { Cookie: cookieHeader, 'Content-Type': 'application/json' };

  const TOTAL_STEPS = 5;
  let stepsCompleted = 0;
  let stepsFailed = 0;
  let stepsSkipped = 0;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        try {
          controller.enqueue(ssePayload(event));
        } catch {
          // client disconnected
        }
      }

      async function runStep(
        step: number,
        label: string,
        run: () => Promise<{ ok: boolean; error?: string; skipped?: string }>,
      ) {
        send({ type: 'step_start', step, total: TOTAL_STEPS, label });
        try {
          const result = await run();
          if (result.skipped) {
            stepsSkipped++;
            send({ type: 'step_skipped', step, label, reason: result.skipped });
          } else if (result.ok) {
            stepsCompleted++;
            send({ type: 'step_complete', step, label });
          } else {
            stepsFailed++;
            send({ type: 'step_error', step, label, error: result.error ?? 'Unknown error' });
          }
        } catch (err) {
          stepsFailed++;
          send({
            type: 'step_error',
            step,
            label,
            error: err instanceof Error ? err.message : 'Step threw unexpectedly',
          });
        }
      }

      try {
        // ── Step 1: Hemisphere / Discovery Synthesis ────────────────────────
        await runStep(1, 'Discovery Synthesis', async () => {
          const resp = await fetch(
            `${baseUrl}/api/admin/workshops/${workshopId}/hemisphere/synthesise`,
            { method: 'POST', headers: fetchHeaders, body: JSON.stringify({}) },
          );

          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            // 400 = no snapshot yet — treat as a skip, not a hard failure
            if (resp.status === 400) {
              return { ok: true, skipped: body.error ?? 'No snapshot data available' };
            }
            return { ok: false, error: body.error ?? `HTTP ${resp.status}` };
          }

          // Consume the SSE stream to completion
          return consumeSSEStream(resp, 'synthesis.complete', 'synthesis.error');
        });

        // ── Step 2: Output Intelligence ─────────────────────────────────────
        await runStep(2, 'Output Intelligence', async () => {
          const resp = await fetch(
            `${baseUrl}/api/admin/workshops/${workshopId}/output-intelligence`,
            { method: 'POST', headers: fetchHeaders, body: JSON.stringify({}) },
          );

          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            return { ok: false, error: body.error ?? `HTTP ${resp.status}` };
          }

          return consumeSSEStream(resp, 'complete', 'error');
        });

        // ── Step 3: Evidence Cross-Validation ───────────────────────────────
        await runStep(3, 'Evidence Cross-Validation', async () => {
          if (readyDocCount === 0) {
            return { ok: true, skipped: 'No evidence documents uploaded' };
          }

          const resp = await fetch(
            `${baseUrl}/api/admin/workshops/${workshopId}/evidence/cross-validate`,
            { method: 'POST', headers: fetchHeaders, body: JSON.stringify({}) },
          );

          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            if (resp.status === 400 || resp.status === 422) {
              return { ok: true, skipped: body.error ?? 'Cross-validation not available' };
            }
            return { ok: false, error: body.error ?? `HTTP ${resp.status}` };
          }

          // This route returns JSON (not SSE)
          await resp.json().catch(() => null);
          return { ok: true };
        });

        // ── Step 4: Evidence Synthesis ──────────────────────────────────────
        await runStep(4, 'Evidence Synthesis', async () => {
          if (readyDocCount < 2) {
            return {
              ok: true,
              skipped:
                readyDocCount === 0
                  ? 'No evidence documents uploaded'
                  : 'Need at least 2 evidence documents for synthesis',
            };
          }

          const resp = await fetch(
            `${baseUrl}/api/admin/workshops/${workshopId}/evidence/synthesise`,
            { method: 'POST', headers: fetchHeaders, body: JSON.stringify({}) },
          );

          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            if (resp.status === 400) {
              return { ok: true, skipped: body.error ?? 'Evidence synthesis not available' };
            }
            return { ok: false, error: body.error ?? `HTTP ${resp.status}` };
          }

          await resp.json().catch(() => null);
          return { ok: true };
        });
        // ── Step 5: Behavioural Interventions ───────────────────────────────
        await runStep(5, 'Behavioural Interventions', async () => {
          const resp = await fetch(
            `${baseUrl}/api/admin/workshops/${workshopId}/behavioural-interventions`,
            { method: 'POST', headers: fetchHeaders, body: JSON.stringify({}) },
          );

          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            // 422 = no OI output yet — skip gracefully
            if (resp.status === 422) {
              return { ok: true, skipped: body.error ?? 'Output Intelligence not yet available' };
            }
            return { ok: false, error: body.error ?? `HTTP ${resp.status}` };
          }

          await resp.json().catch(() => null);
          return { ok: true };
        });
      } finally {
        send({ type: 'done', stepsCompleted, stepsFailed, stepsSkipped });
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
