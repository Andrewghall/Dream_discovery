import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { PatchScratchpadSchema, zodError } from '@/lib/validation/schemas';

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

    const scratchpad = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
    });

    // Return null scratchpad if not found (instead of 404)
    // This allows the UI to handle creation
    if (scratchpad) {
      // Strip the bcrypt hash — never send it to the client
      const { commercialPassword, ...rest } = scratchpad;
      return NextResponse.json({
        scratchpad: rest,
        hasCommercialPassword: !!commercialPassword,
      });
    }
    return NextResponse.json({ scratchpad: null, hasCommercialPassword: false });
  } catch (error) {
    console.error('Failed to fetch scratchpad:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scratchpad' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
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

    const rawBody = await request.json().catch(() => null);
    const parsed = PatchScratchpadSchema.safeParse(rawBody);
    if (!parsed.success) return zodError(parsed.error);
    const body = parsed.data;

    // Cast to any for Prisma JSON fields — Zod validates structure, Prisma handles storage
    const b = body as Record<string, any>;
    const scratchpad = await prisma.workshopScratchpad.update({
      where: { workshopId },
      data: {
        execSummary: b.execSummary,
        discoveryOutput: b.discoveryOutput,
        reimagineContent: b.reimagineContent,
        constraintsContent: b.constraintsContent,
        potentialSolution: b.potentialSolution,
        commercialContent: b.commercialContent,
        customerJourney: b.customerJourney,
        summaryContent: b.summaryContent,
        ...(b.outputAssessment !== undefined ? { outputAssessment: b.outputAssessment } : {}),
        updatedAt: new Date(),
      },
    });

    if (auth.organizationId) {
      logAuditEvent({ organizationId: auth.organizationId, userId: auth.userId ?? undefined, action: 'UPDATE_OUTPUT', resourceType: 'workshop', resourceId: workshopId, success: true }).catch(err => console.error('[audit] update_output:', err));
    }

    return NextResponse.json({ scratchpad });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[scratchpad-update] Failed to update scratchpad:', message);
    return NextResponse.json(
      { error: 'Failed to update scratchpad', details: { message } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
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

    const rawBodyPost = await request.json().catch(() => null);
    const parsedPost = PatchScratchpadSchema.safeParse(rawBodyPost);
    if (!parsedPost.success) return zodError(parsedPost.error);
    const body = parsedPost.data;

    // Check if scratchpad already exists
    const existing = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Scratchpad already exists for this workshop' },
        { status: 400 }
      );
    }

    // Hash commercial password if provided
    const bp = body as Record<string, any>;
    let hashedPassword = null;
    if (bp.commercialPassword) {
      hashedPassword = await bcrypt.hash(bp.commercialPassword, 10);
    }

    // Create new scratchpad
    const scratchpad = await prisma.workshopScratchpad.create({
      data: {
        workshopId,
        execSummary: bp.execSummary || null,
        discoveryOutput: bp.discoveryOutput || null,
        reimagineContent: bp.reimagineContent || null,
        constraintsContent: bp.constraintsContent || null,
        potentialSolution: bp.potentialSolution || null,
        commercialContent: bp.commercialContent || null,
        commercialPassword: hashedPassword,
        customerJourney: bp.customerJourney || null,
        summaryContent: bp.summaryContent || null,
        generatedFromSnapshot: bp.generatedFromSnapshot || null,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({ scratchpad });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[scratchpad-create] Failed to create scratchpad:', message);
    return NextResponse.json(
      { error: 'Failed to create scratchpad', details: { message } },
      { status: 500 }
    );
  }
}
