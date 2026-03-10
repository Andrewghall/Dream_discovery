/**
 * DREAM Download Report — Report Summary API
 *
 * GET  — Returns stored reportSummary (or null if not yet generated)
 * POST — Generates Executive Summary + Solution Summary via single GPT-4o call
 *        Streams progress via SSE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { runReportSummaryPipeline } from '@/lib/output-intelligence/pipeline';
import type { ReportSummary } from '@/lib/output-intelligence/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── GET: Return stored report summary ────────────────────────────────────────

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
      select: { reportSummary: true },
    });

    if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });

    const summary = workshop.reportSummary as ReportSummary | null;
    return NextResponse.json({ reportSummary: summary ?? null });
  } catch (error) {
    console.error('[Report Summary GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch report summary' },
      { status: 500 }
    );
  }
}

// ── PATCH: Save manually-edited report summary ────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

    const body = await request.json() as { reportSummary: ReportSummary };
    if (!body.reportSummary) {
      return NextResponse.json({ error: 'reportSummary is required' }, { status: 400 });
    }

    await prisma.workshop.update({
      where: { id: workshopId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { reportSummary: body.reportSummary as any },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Report Summary PATCH] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save report summary' },
      { status: 500 }
    );
  }
}

// ── POST: Generate report summary with SSE streaming ─────────────────────────

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
        sendEvent('status', { message: 'Loading workshop intelligence…' });

        const reportSummary = await runReportSummaryPipeline(
          workshopId,
          (msg: string) => sendEvent('status', { message: msg })
        );

        sendEvent('complete', { reportSummary });
      } catch (error) {
        console.error('[Report Summary POST] Error:', error);
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Report summary generation failed',
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
