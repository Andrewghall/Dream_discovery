import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { getDomainPack } from '@/lib/domain-packs';
import { generateBlueprint } from '@/lib/cognition/workshop-blueprint-generator';
import { readBlueprintFromJson, WorkshopBlueprintSchema } from '@/lib/workshop/blueprint';
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

function isLikelySchemaDriftError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('unknown arg') ||
    message.includes('invalid invocation') ||
    message.includes('column') ||
    message.includes('engagement_type') ||
    message.includes('domain_pack') ||
    message.includes('blueprint') ||
    message.includes('historical_metrics')
  );
}

function isLikelyFkDeleteError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const code = (error as { code?: string } | null)?.code;
  return (
    code === 'P2003' ||
    message.includes('foreign key') ||
    message.includes('constraint') ||
    message.includes('violates')
  );
}

function isSafeIdent(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

async function runDeleteStep(
  label: string,
  step: () => Promise<unknown>
): Promise<void> {
  try {
    await step();
  } catch (error: unknown) {
    if (!isLikelySchemaDriftError(error)) throw error;
    console.warn(`[workshop-delete] skipped step due to schema drift: ${label}`, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

type WorkshopFkRefRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  constraint_name: string;
};

async function listWorkshopFkRefs(): Promise<WorkshopFkRefRow[]> {
  return prisma.$queryRaw<WorkshopFkRefRow[]>`
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'workshops'
      AND ccu.table_schema = 'public'
      AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
  `;
}

async function cleanupUnknownWorkshopRefs(workshopId: string): Promise<void> {
  const refs = await listWorkshopFkRefs();

  for (const ref of refs) {
    const schema = ref.table_schema;
    const table = ref.table_name;
    const column = ref.column_name;
    if (table === 'workshops') continue;
    if (!isSafeIdent(schema) || !isSafeIdent(table) || !isSafeIdent(column)) continue;
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "${schema}"."${table}" WHERE "${column}" = $1`,
        workshopId
      );
    } catch (error: unknown) {
      // Keep trying other refs; parent delete pass will decide if anything still blocks.
      console.warn('[workshop-delete] failed to clean discovered FK ref', {
        schema,
        table,
        column,
        constraint: ref.constraint_name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

type WorkshopDeleteBlocker = {
  schema: string;
  table: string;
  column: string;
  constraint: string;
  count: number;
};

async function detectWorkshopDeleteBlockers(workshopId: string): Promise<WorkshopDeleteBlocker[]> {
  const refs = await listWorkshopFkRefs();
  const blockers: WorkshopDeleteBlocker[] = [];
  for (const ref of refs) {
    const schema = ref.table_schema;
    const table = ref.table_name;
    const column = ref.column_name;
    if (table === 'workshops') continue;
    if (!isSafeIdent(schema) || !isSafeIdent(table) || !isSafeIdent(column)) continue;
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
        `SELECT COUNT(*)::bigint AS count FROM "${schema}"."${table}" WHERE "${column}" = $1`,
        workshopId
      );
      const raw = rows?.[0]?.count ?? 0;
      const count = typeof raw === 'bigint' ? Number(raw) : Number(raw);
      if (Number.isFinite(count) && count > 0) {
        blockers.push({
          schema,
          table,
          column,
          constraint: ref.constraint_name,
          count,
        });
      }
    } catch {
      // Ignore unreadable refs.
    }
  }
  return blockers;
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
// ── Select shapes for field-selective GET ─────────────────────────────────────

const LIGHT_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  description: true,
  businessContext: true,
  includeRegulation: true,
  workshopType: true,
  status: true,
  scheduledDate: true,
  responseDeadline: true,
  clientName: true,
  industry: true,
  companyWebsite: true,
  dreamTrack: true,
  targetDomain: true,
  customQuestions: true,
  engagementType: true,
  domainPack: true,
  domainPackConfig: true,
  blueprint: true,
  discoveryQuestions: true,
} as const;

const FULL_EXTRA = {
  // Large blobs only needed by the prep page (~150KB combined)
  prepResearch: true,
  discoveryBriefing: true,
  historicalMetrics: true,
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const isFull = request.nextUrl.searchParams.get('full') === 'true';

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

    let workshop: Record<string, unknown> | null = null;
    try {
      workshop = await prisma.workshop.findUnique({
        where: { id },
        select: {
          ...LIGHT_SELECT,
          ...(isFull ? FULL_EXTRA : {}),
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
      }) as unknown as Record<string, unknown> | null;
    } catch (error: unknown) {
      if (!isLikelySchemaDriftError(error)) throw error;
      // Legacy DB compatibility: load only older fields then hydrate missing new fields as null.
      const legacy = await prisma.workshop.findUnique({
        where: { id },
        select: {
          id: true,
          organizationId: true,
          name: true,
          description: true,
          businessContext: true,
          includeRegulation: true,
          workshopType: true,
          status: true,
          scheduledDate: true,
          responseDeadline: true,
          createdAt: true,
          updatedAt: true,
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
              emailSentAt: true,
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
      if (!legacy) {
        workshop = null;
      } else {
        workshop = {
          ...legacy,
          clientName: null,
          industry: null,
          companyWebsite: null,
          dreamTrack: null,
          targetDomain: null,
          customQuestions: null,
          engagementType: null,
          domainPack: null,
          domainPackConfig: null,
          blueprint: null,
          discoveryQuestions: null,
          ...(isFull ? {
            prepResearch: null,
            discoveryBriefing: null,
            historicalMetrics: null,
          } : {}),
          participants: (legacy.participants || []).map((p) => ({
            ...p,
            attributionPreference: 'NAMED',
            doNotSendAgain: false,
          })),
        };
      }
    }

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

    // Direct blueprint override -- user edited the blueprint manually
    const hasDirectBlueprint = body.blueprint && typeof body.blueprint === 'object' && !Array.isArray(body.blueprint);
    if (hasDirectBlueprint) {
      const parsed = WorkshopBlueprintSchema.safeParse(body.blueprint);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid blueprint', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }
      updateData.blueprint = parsed.data as any;
    }

    // Recompose blueprint if any blueprint-relevant field changed (skip if direct override provided)
    const blueprintFields = [
      'engagementType', 'domainPack', 'dreamTrack',
      'description', 'businessContext', 'industry', 'clientName',
    ];
    const blueprintFieldChanged = blueprintFields.some((f) => f in body);

    if (blueprintFieldChanged && !hasDirectBlueprint) {
      const current = await prisma.workshop.findUnique({
        where: { id },
        select: {
          clientName: true,
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
          clientName: (updateData.clientName as string | null) ?? current.clientName ?? null,
          researchJourneyStages: research?.journeyStages ?? null,
          researchDimensions: research?.industryDimensions ?? null,
          researchActors: research?.actorTaxonomy ?? null,
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
    const message = error instanceof Error ? error.message : String(error);
    const isSchemaError = message.toLowerCase().includes('does not exist in the current database')
      || message.toLowerCase().includes('unknown field')
      || message.toLowerCase().includes('unknown argument');
    console.error('[workshop-update]', isSchemaError ? 'SCHEMA DRIFT DETECTED' : 'Error updating workshop:', message);
    return NextResponse.json(
      {
        error: 'Failed to update workshop',
        details: {
          message,
          ...(isSchemaError && {
            schemaDrift: true,
            hint: 'The database schema is out of sync with the application. Run pending migrations.',
          }),
        },
      },
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

    // Defensive cleanup for environments where FK cascades or tables may lag schema.
    // Deletes are ordered child -> parent. Missing-table/schema-drift errors are skipped.
    await runDeleteStep('dataPointClassification', () =>
      prisma.dataPointClassification.deleteMany({ where: { dataPoint: { workshopId: id } } })
    );
    await runDeleteStep('dataPointAnnotation', () =>
      prisma.dataPointAnnotation.deleteMany({ where: { dataPoint: { workshopId: id } } })
    );
    await runDeleteStep('agenticAnalysis', () =>
      prisma.agenticAnalysis.deleteMany({ where: { dataPoint: { workshopId: id } } })
    );
    await runDeleteStep('conversationMessage', () =>
      prisma.conversationMessage.deleteMany({ where: { session: { workshopId: id } } })
    );
    await runDeleteStep('conversationInsight', () =>
      prisma.conversationInsight.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('conversationReport', () =>
      prisma.conversationReport.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('dataPoint', () =>
      prisma.dataPoint.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('transcriptChunk', () =>
      prisma.transcriptChunk.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('workshopEventOutbox', () =>
      prisma.workshopEventOutbox.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('liveWorkshopSnapshot', () =>
      prisma.liveWorkshopSnapshot.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('discoveryTheme', () =>
      prisma.discoveryTheme.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('diagnosticSynthesis', () =>
      prisma.diagnosticSynthesis.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('finding', () =>
      prisma.finding.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('captureSegment', () =>
      prisma.captureSegment.deleteMany({ where: { captureSession: { workshopId: id } } })
    );
    await runDeleteStep('captureSession', () =>
      prisma.captureSession.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('conversationSession', () =>
      prisma.conversationSession.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('workshopParticipant', () =>
      prisma.workshopParticipant.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('workshopScratchpad', () =>
      prisma.workshopScratchpad.deleteMany({ where: { workshopId: id } })
    );
    await runDeleteStep('workshopShare', () =>
      prisma.workshopShare.deleteMany({ where: { workshopId: id } })
    );

    // Final parent delete. Use deleteMany (not delete) for legacy-schema compatibility:
    // delete() returns the deleted row and can fail if newer columns (e.g. blueprint) are absent.
    // deleteMany() only executes DELETE ... WHERE and returns count.
    try {
      const deleted = await prisma.workshop.deleteMany({ where: { id } });
      if (deleted.count === 0) {
        return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
      }
    } catch (error: unknown) {
      if (!isLikelyFkDeleteError(error)) throw error;
      await cleanupUnknownWorkshopRefs(id);
      try {
        const deleted = await prisma.workshop.deleteMany({ where: { id } });
        if (deleted.count === 0) {
          return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
        }
      } catch (retryError: unknown) {
        if (!isLikelyFkDeleteError(retryError)) throw retryError;
        const blockers = await detectWorkshopDeleteBlockers(id);
        const summary = blockers.length
          ? `Delete blocked by FK refs: ${blockers.map((b) => `${b.schema}.${b.table}.${b.column}(${b.count})`).join(', ')}`
          : (retryError instanceof Error ? retryError.message : String(retryError));
        return NextResponse.json(
          { error: 'Failed to delete workshop', details: { message: summary, blockers } },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting workshop:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete workshop', details: { message } },
      { status: 500 }
    );
  }
}
