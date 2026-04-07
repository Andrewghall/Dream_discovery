/**
 * app/api/admin/workshops/[id]/behavioural-interventions/route.ts
 *
 * GET  — Returns stored behaviouralInterventions from workshop record (or null)
 * POST — Generates COM-B behavioural interventions and stores to workshop
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { generateBehaviouralInterventions } from '@/lib/behavioural-interventions/agent';
import type { BehaviouralInterventionsOutput } from '@/lib/behavioural-interventions/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;
    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { behaviouralInterventions: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    return NextResponse.json({
      behaviouralInterventions: workshop.behaviouralInterventions ?? null,
    });
  } catch (err) {
    console.error('[behavioural-interventions] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;
    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // Fetch workshop data
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: {
        name: true,
        outputIntelligence: true,
        blueprint: true,
      },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    // Validate: outputIntelligence must be populated
    if (!workshop.outputIntelligence) {
      return NextResponse.json(
        { error: 'Output Intelligence not yet generated. Run Generate Analysis first.' },
        { status: 422 }
      );
    }

    // Extract lenses from blueprint
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blueprint = workshop.blueprint as Record<string, any> | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lensesRaw: any[] = Array.isArray(blueprint?.lenses) ? blueprint!.lenses : [];
    const lenses: string[] = lensesRaw
      .map((l) => (typeof l === 'string' ? l : l?.name ?? ''))
      .filter(Boolean);

    // If no blueprint lenses, derive from OI rootCauses affectedLenses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oi = workshop.outputIntelligence as Record<string, any>;
    const effectiveLenses =
      lenses.length > 0
        ? lenses
        : deriveDefaultLenses(oi);

    // Fetch evidence cross-validation data (optional — one ready doc is sufficient)
    const evidenceDoc = await prisma.evidenceDocument.findFirst({
      where: { workshopId, status: 'ready' },
      select: { crossValidation: true },
      orderBy: { updatedAt: 'desc' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cv = evidenceDoc?.crossValidation as Record<string, any> | null;
    const evidenceValidation = cv
      ? {
          corroborated: Array.isArray(cv.corroborated) ? (cv.corroborated as string[]) : [],
          contradicted: Array.isArray(cv.contradicted) ? (cv.contradicted as string[]) : [],
          perceptionGaps: Array.isArray(cv.perceptionGaps) ? (cv.perceptionGaps as string[]) : [],
          blindSpots: Array.isArray(cv.blindSpots) ? (cv.blindSpots as string[]) : [],
          conclusionImpact: typeof cv.conclusionImpact === 'string' ? cv.conclusionImpact : undefined,
        }
      : undefined;

    // Generate
    const result = await generateBehaviouralInterventions(
      workshop.name,
      effectiveLenses,
      oi,
      evidenceValidation
    );

    // Store result
    await prisma.workshop.update({
      where: { id: workshopId },
      data: { behaviouralInterventions: result as object },
    });

    return NextResponse.json({ behaviouralInterventions: result });
  } catch (err) {
    console.error('[behavioural-interventions] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive a deduplicated list of lenses from OI output when blueprint is absent.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deriveDefaultLenses(oi: Record<string, any>): string[] {
  const seen = new Set<string>();
  const collect = (arr: unknown[]) => {
    arr.forEach((item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lensArr = (item as any)?.affectedLenses ?? (item as any)?.lenses ?? [];
      if (Array.isArray(lensArr)) {
        lensArr.forEach((l: unknown) => {
          if (typeof l === 'string' && l.trim()) seen.add(l.trim());
        });
      }
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootCauses = (oi.rootCause as any)?.rootCauses ?? [];
  if (Array.isArray(rootCauses)) collect(rootCauses);

  return seen.size > 0
    ? Array.from(seen)
    : ['People', 'Process', 'Technology', 'Organisation'];
}
