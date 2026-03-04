import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { getDomainPack } from '@/lib/domain-packs';
import { generateBlueprint } from '@/lib/cognition/workshop-blueprint-generator';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import type { EngagementType } from '@prisma/client';
import type { WorkshopPrepResearch } from '@/lib/cognition/agents/agent-types';

export const dynamic = 'force-dynamic';

function toEngagementEnum(value: unknown): EngagementType | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().toUpperCase();
  const valid: EngagementType[] = [
    'DIAGNOSTIC_BASELINE',
    'OPERATIONAL_DEEP_DIVE',
    'AI_ENABLEMENT',
    'TRANSFORMATION_SPRINT',
    'CULTURAL_ALIGNMENT',
  ];
  if (valid.includes(normalized as EngagementType)) {
    return normalized as EngagementType;
  }
  const fromKey = normalized.replace(/[^A-Z0-9_]/g, '_');
  if (valid.includes(fromKey as EngagementType)) {
    return fromKey as EngagementType;
  }
  return null;
}

/**
 * GET /api/admin/workshops/[id]
 *
 * Retrieves complete workshop details including all participants.
 * Access restricted to authenticated users within the workshop's organization.
 *
 * @param request - NextRequest
 * @param params - Route params containing:
 *   - id: string - Workshop ID
 *
 * @returns NextResponse with one of:
 *   - 200: { workshop: {...} } - Workshop details with participants array
 *   - 401: { error: "Unauthorized" } - No valid session
 *   - 403: { error: string } - User lacks access to this workshop (wrong organization)
 *   - 404: { error: "Workshop not found" } - Workshop ID doesn't exist
 *   - 500: { error: string } - Internal server error
 *
 * @security
 * - Requires admin_session JWT cookie (PLATFORM_ADMIN or TENANT_ADMIN role)
 * - TENANT_ADMIN: Can only access workshops in their own organization
 * - PLATFORM_ADMIN: Can access all workshops across all organizations
 * - Organization validation performed via validateWorkshopAccess middleware
 *
 * @example
 * GET /api/admin/workshops/workshop-123
 * Cookie: admin_session=<jwt-token>
 *
 * Response 200:
 * {
 *   "workshop": {
 *     "id": "workshop-123",
 *     "name": "Product Strategy Discovery",
 *     "description": "...",
 *     "businessContext": "...",
 *     "status": "IN_PROGRESS",
 *     "organizationId": "org-123",
 *     "participants": [
 *       {
 *         "id": "participant-1",
 *         "email": "user@example.com",
 *         "name": "John Doe",
 *         "role": "Product Manager",
 *         "responseCompletedAt": "2024-01-15T10:30:00.000Z",
 *         ...
 *       }
 *     ],
 *     ...
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate user
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate workshop access (organization-scoped)
    const validation = await validateWorkshopAccess(id, user.organizationId, user.role, user.userId);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 403 });
    }

    const workshop = await prisma.workshop.findUnique({
      where: { id },
      include: {
        participants: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            workshopId: true,
            email: true,
            name: true,
            role: true,
            department: true,
            discoveryToken: true,
            attributionPreference: true,
            emailSentAt: true,
            doNotSendAgain: true,
            responseStartedAt: true,
            responseCompletedAt: true,
            reminderSentAt: true,
            createdAt: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
          },
        },
      },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    return NextResponse.json(
      { workshop },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error fetching workshop:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workshop' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/workshops/[id]
 *
 * Updates workshop settings. Currently supports updating the includeRegulation flag.
 * Access restricted to authenticated users within the workshop's organization.
 *
 * @param request - NextRequest with JSON body containing:
 *   - includeRegulation: boolean (optional) - Whether to include regulatory context in AI analysis
 *   - Additional workshop fields can be added in future
 *
 * @param params - Route params containing:
 *   - id: string - Workshop ID to update
 *
 * @returns NextResponse with one of:
 *   - 200: { success: true, workshop: {...} } - Workshop successfully updated
 *   - 401: { error: "Unauthorized" } - No valid session
 *   - 403: { error: string } - User lacks access to this workshop (wrong organization)
 *   - 404: { error: "Workshop not found" } - Workshop ID doesn't exist
 *   - 500: { error: string } - Internal server error
 *
 * @security
 * - Requires admin_session JWT cookie (PLATFORM_ADMIN or TENANT_ADMIN role)
 * - TENANT_ADMIN: Can only update workshops in their own organization
 * - PLATFORM_ADMIN: Can update all workshops across all organizations
 * - Organization validation performed via validateWorkshopAccess middleware
 *
 * @example
 * PATCH /api/admin/workshops/workshop-123
 * Cookie: admin_session=<jwt-token>
 * Content-Type: application/json
 *
 * {
 *   "includeRegulation": true
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "workshop": {
 *     "id": "workshop-123",
 *     "name": "Product Strategy Discovery",
 *     "includeRegulation": true,
 *     "updatedAt": "2024-01-15T10:35:00.000Z",
 *     ...
 *   }
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Authenticate user
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate workshop access (organization-scoped)
    const validation = await validateWorkshopAccess(id, user.organizationId, user.role, user.userId);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 403 });
    }

    const workshop = await prisma.workshop.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    // Build update data — only include fields that are explicitly provided
    const updateData: Record<string, unknown> = {};
    if (typeof body.includeRegulation === 'boolean') updateData.includeRegulation = body.includeRegulation;
    if (typeof body.clientName === 'string') updateData.clientName = body.clientName || null;
    if (typeof body.industry === 'string') updateData.industry = body.industry || null;
    if (typeof body.companyWebsite === 'string') updateData.companyWebsite = body.companyWebsite || null;
    if (typeof body.dreamTrack === 'string') updateData.dreamTrack = body.dreamTrack || null;
    if (typeof body.targetDomain === 'string') updateData.targetDomain = body.targetDomain || null;
    if (typeof body.name === 'string') updateData.name = body.name;
    if (typeof body.description === 'string') updateData.description = body.description || null;
    if (typeof body.businessContext === 'string') updateData.businessContext = body.businessContext || null;
    // JSON fields -- stored directly
    if (body.prepResearch !== undefined) updateData.prepResearch = body.prepResearch;
    if (body.customQuestions !== undefined) updateData.customQuestions = body.customQuestions;
    if (body.discoveryBriefing !== undefined) updateData.discoveryBriefing = body.discoveryBriefing;
    // Field Discovery / Diagnostic extension
    if (typeof body.engagementType === 'string') updateData.engagementType = toEngagementEnum(body.engagementType);
    if (typeof body.domainPack === 'string') {
      updateData.domainPack = body.domainPack || null;
      updateData.domainPackConfig = body.domainPack ? (getDomainPack(body.domainPack) as any ?? undefined) : null;
    }

    // Recompose blueprint if any blueprint-relevant field changed
    const blueprintFields = [
      'engagementType', 'domainPack', 'dreamTrack',
      'description', 'businessContext', 'industry',
    ];
    const blueprintFieldChanged = blueprintFields.some((f) => f in body);

    if (blueprintFieldChanged) {
      const current = await prisma.workshop.findUnique({
        where: { id },
        select: {
          industry: true,
          dreamTrack: true,
          engagementType: true,
          domainPack: true,
          description: true,
          businessContext: true,
          prepResearch: true,
          blueprint: true,
        },
      });
      if (current) {
        // Extract research data if available
        const research = current.prepResearch as WorkshopPrepResearch | null;
        const existingBp = readBlueprintFromJson(current.blueprint);

        const merged = {
          industry: (updateData.industry as string | null) ?? current.industry ?? null,
          dreamTrack: ((updateData.dreamTrack as string | null) ?? current.dreamTrack ?? null) as 'ENTERPRISE' | 'DOMAIN' | null,
          engagementType: (updateData.engagementType as string | null)
            ?? (current.engagementType ? current.engagementType.toLowerCase() : null),
          domainPack: (updateData.domainPack as string | null) ?? current.domainPack ?? null,
          purpose: (updateData.description as string | null) ?? current.description ?? null,
          outcomes: (updateData.businessContext as string | null) ?? current.businessContext ?? null,
          researchJourneyStages: research?.journeyStages ?? null,
          researchDimensions: research?.industryDimensions ?? null,
          previousVersion: existingBp?.blueprintVersion ?? 0,
        };
        updateData.blueprint = generateBlueprint(merged) as any;
      }
    }

    const updated = await prisma.workshop.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ workshop: updated });
  } catch (error) {
    console.error('Error updating workshop:', error);
    return NextResponse.json(
      { error: 'Failed to update workshop' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/workshops/[id]
 *
 * Permanently deletes a workshop and all associated data.
 * Access restricted to authenticated users within the workshop's organization.
 *
 * **WARNING: This is a destructive operation that cannot be undone.**
 * Deletes:
 * - Workshop record
 * - All participants
 * - All conversation sessions
 * - All messages, data points, insights, and reports
 * - All consent records
 *
 * @param request - NextRequest
 * @param params - Route params containing:
 *   - id: string - Workshop ID to delete
 *
 * @returns NextResponse with one of:
 *   - 200: { success: true, message: string } - Workshop successfully deleted
 *   - 401: { error: "Unauthorized" } - No valid session
 *   - 403: { error: string } - User lacks access to this workshop (wrong organization)
 *   - 404: { error: "Workshop not found" } - Workshop ID doesn't exist
 *   - 500: { error: string } - Internal server error
 *
 * @security
 * - Requires admin_session JWT cookie (PLATFORM_ADMIN or TENANT_ADMIN role)
 * - TENANT_ADMIN: Can only delete workshops in their own organization
 * - PLATFORM_ADMIN: Can delete all workshops across all organizations
 * - Organization validation performed via validateWorkshopAccess middleware
 * - CASCADE deletion handled by database foreign key constraints
 *
 * @caution
 * - This operation is irreversible
 * - All participant data will be deleted
 * - All AI-generated insights and reports will be lost
 * - Consider data export before deletion if needed
 *
 * @example
 * DELETE /api/admin/workshops/workshop-123
 * Cookie: admin_session=<jwt-token>
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Workshop deleted successfully"
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate user
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate workshop access (organization-scoped)
    const validation = await validateWorkshopAccess(id, user.organizationId, user.role, user.userId);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 403 });
    }

    const workshop = await prisma.workshop.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    await prisma.workshop.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workshop:', error);
    return NextResponse.json(
      { error: 'Failed to delete workshop' },
      { status: 500 }
    );
  }
}
