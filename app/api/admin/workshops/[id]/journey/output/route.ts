/**
 * GET  /api/admin/workshops/[id]/journey/output
 * PUT  /api/admin/workshops/[id]/journey/output
 *
 * Persists the post-workshop editable Actor Journey in WorkshopScratchpad.customerJourney.
 *
 * Stored shape:
 *   { data: LiveJourneyData, userEdited: boolean, lastSynthesisedAt: string|null, lastEditedAt: string|null }
 *
 * GET: Returns the stored journey, or falls back to the latest LiveWorkshopSnapshot / LiveSessionVersion.
 * PUT: Saves journey with userEdited: true.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';

export const runtime = 'nodejs';

export type StoredOutputJourney = {
  data: LiveJourneyData;
  userEdited: boolean;
  lastSynthesisedAt: string | null;
  lastEditedAt: string | null;
};

// ── Auth helper ────────────────────────────────────────────────────────────────

async function authenticate(workshopId: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: 'Unauthorized', status: 401 } as const;
  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return { error: access.error ?? 'Forbidden', status: 403 } as const;
  return { user } as const;
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const auth = await authenticate(workshopId);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // 1. Try scratchpad first
  const scratchpad = await prisma.workshopScratchpad.findUnique({
    where: { workshopId },
    select: { customerJourney: true },
  });

  if (scratchpad?.customerJourney) {
    const stored = scratchpad.customerJourney as unknown as StoredOutputJourney;
    // Validate it has the expected shape
    if (stored?.data?.stages && stored?.data?.interactions) {
      return NextResponse.json({ ok: true, journey: stored });
    }
  }

  // 2. Fallback: load from latest LiveSessionVersion
  const version = await (prisma as any).liveSessionVersion.findFirst({
    where: { workshopId },
    orderBy: { createdAt: 'desc' },
    select: { payload: true, createdAt: true },
  });

  if (version?.payload) {
    const payload = version.payload as Record<string, unknown>;
    const liveJourney = payload.liveJourney as LiveJourneyData | undefined;
    if (liveJourney?.stages && liveJourney?.interactions) {
      const stored: StoredOutputJourney = {
        data: liveJourney,
        userEdited: false,
        lastSynthesisedAt: (version.createdAt as Date).toISOString(),
        lastEditedAt: null,
      };
      return NextResponse.json({ ok: true, journey: stored });
    }
  }

  // 3. Fallback: load from latest LiveWorkshopSnapshot
  const snapshot = await (prisma as any).liveWorkshopSnapshot.findFirst({
    where: { workshopId },
    orderBy: { createdAt: 'desc' },
    select: { payload: true, createdAt: true },
  });

  if (snapshot?.payload) {
    const payload = snapshot.payload as Record<string, unknown>;
    const liveJourney = payload.liveJourney as LiveJourneyData | undefined;
    if (liveJourney?.stages && liveJourney?.interactions) {
      const stored: StoredOutputJourney = {
        data: liveJourney,
        userEdited: false,
        lastSynthesisedAt: (snapshot.createdAt as Date).toISOString(),
        lastEditedAt: null,
      };
      return NextResponse.json({ ok: true, journey: stored });
    }
  }

  // No journey data found
  return NextResponse.json({ ok: true, journey: null });
}

// ── PUT ────────────────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const auth = await authenticate(workshopId);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { data: LiveJourneyData; lastSynthesisedAt?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.data?.stages || !body?.data?.interactions) {
    return NextResponse.json({ error: 'Missing journey data' }, { status: 400 });
  }

  const stored: StoredOutputJourney = {
    data: body.data,
    userEdited: true,
    lastSynthesisedAt: body.lastSynthesisedAt ?? null,
    lastEditedAt: new Date().toISOString(),
  };

  await prisma.workshopScratchpad.upsert({
    where: { workshopId },
    create: { workshopId, customerJourney: stored as unknown as object },
    update: { customerJourney: stored as unknown as object },
  });

  return NextResponse.json({ ok: true });
}
