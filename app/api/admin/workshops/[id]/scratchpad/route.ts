import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logAuditEvent } from '@/lib/audit/audit-logger';

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

    const body = await request.json();

    const scratchpad = await prisma.workshopScratchpad.update({
      where: { workshopId },
      data: {
        execSummary: body.execSummary,
        discoveryOutput: body.discoveryOutput,
        reimagineContent: body.reimagineContent,
        constraintsContent: body.constraintsContent,
        potentialSolution: body.potentialSolution,
        commercialContent: body.commercialContent,
        customerJourney: body.customerJourney,
        summaryContent: body.summaryContent,
        ...(body.outputAssessment !== undefined ? { outputAssessment: body.outputAssessment } : {}),
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

    const body = await request.json();

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
    let hashedPassword = null;
    if (body.commercialPassword) {
      hashedPassword = await bcrypt.hash(body.commercialPassword, 10);
    }

    // Create new scratchpad
    const scratchpad = await prisma.workshopScratchpad.create({
      data: {
        workshopId,
        execSummary: body.execSummary || null,
        discoveryOutput: body.discoveryOutput || null,
        reimagineContent: body.reimagineContent || null,
        constraintsContent: body.constraintsContent || null,
        potentialSolution: body.potentialSolution || null,
        commercialContent: body.commercialContent || null,
        commercialPassword: hashedPassword,
        customerJourney: body.customerJourney || null,
        summaryContent: body.summaryContent || null,
        generatedFromSnapshot: body.generatedFromSnapshot || null,
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
