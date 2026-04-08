import { NextResponse } from 'next/server';
import { requireExecAuth } from '@/lib/auth/require-exec-auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/executive/data
 * Returns the most recently published workshop with v2Output for the exec's org.
 * Falls back to the most recent workshop with any v2Output if none are published.
 * All data is scoped to execOrgId from the JWT — no client-supplied org ID trusted.
 */
export async function GET() {
  const auth = await requireExecAuth();
  if (auth instanceof NextResponse) return auth;

  const { execOrgId } = auth;

  // Find best workshop: prefer most recently updated scratchpad with v2Output
  const scratchpad = await prisma.workshopScratchpad.findFirst({
    where: {
      workshop: { organizationId: execOrgId },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      workshop: {
        select: {
          id: true,
          name: true,
          organizationId: true,
          evidenceSynthesis: true,
          status: true,
          scheduledDate: true,
        },
      },
    },
  });

  if (!scratchpad) {
    return NextResponse.json({ error: 'No discovery data available yet.' }, { status: 404 });
  }

  // Fetch evidence documents for the workshop
  const evidenceDocuments = await prisma.evidenceDocument.findMany({
    where: { workshopId: scratchpad.workshopId, status: 'ready' },
    select: {
      id: true,
      originalFileName: true,
      sourceCategory: true,
      summary: true,
      signalDirection: true,
      confidence: true,
      crossValidation: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const org = await prisma.organization.findUnique({
    where: { id: execOrgId },
    select: { name: true, logoUrl: true },
  });

  return NextResponse.json({
    scratchpad: {
      v2Output: scratchpad.v2Output,
      outputAssessment: scratchpad.outputAssessment as unknown,
      clientLogoUrl: scratchpad.clientLogoUrl,
      status: scratchpad.status,
    },
    workshop: scratchpad.workshop,
    evidenceDocuments,
    organization: org,
  });
}
