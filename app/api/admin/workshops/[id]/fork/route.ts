/**
 * POST /api/admin/workshops/[id]/fork
 *
 * Forks an example workshop (isExample = true) into the requesting user's
 * organisation. The fork is a deep copy of the base workshop data including
 * all synthesis outputs so users can see the full platform output and then
 * re-run agents on their own isolated copy without affecting the shared example.
 *
 * Only works on workshops where isExample = true.
 * If the user already has a fork of this example they get the existing fork ID back
 * (idempotent).
 *
 * Returns: { workshopId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Load the source workshop — must be an example
    const source = await prisma.workshop.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        isExample: true,
        name: true,
        description: true,
        businessContext: true,
        workshopType: true,
        status: true,
        includeRegulation: true,
        scheduledDate: true,
        responseDeadline: true,
        clientName: true,
        industry: true,
        companyWebsite: true,
        dreamTrack: true,
        targetDomain: true,
        engagementType: true,
        domainPack: true,
        domainPackConfig: true,
        blueprint: true,
        prepResearch: true,
        customQuestions: true,
        discoveryQuestions: true,
        discoveryBriefing: true,
        discoverAnalysis: true,
        discoverySummary: true,
        outputIntelligence: true,
        reportSummary: true,
        historicalMetrics: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (!source.isExample) {
      return NextResponse.json(
        { error: 'Only example workshops can be forked.' },
        { status: 400 }
      );
    }

    // Idempotent: return existing fork if user already has one
    const existingFork = await prisma.workshop.findFirst({
      where: {
        exampleSourceId: sourceId,
        createdById: user.userId,
      },
      select: { id: true },
    });

    if (existingFork) {
      return NextResponse.json({ workshopId: existingFork.id, existing: true });
    }

    // Create the fork in the user's organisation
    // Name: strip " (Example)" suffix if present, append " — My Copy"
    const baseName = source.name.replace(/\s*\(Example\)\s*$/i, '').trim();
    const forkName = `${baseName} (My Copy)`;

    const fork = await prisma.workshop.create({
      data: {
        organizationId: user.organizationId,
        createdById: user.userId,
        name: forkName,
        description: source.description,
        businessContext: source.businessContext,
        workshopType: source.workshopType,
        // Start fork as DRAFT regardless of source status
        status: 'DRAFT',
        includeRegulation: source.includeRegulation,
        scheduledDate: null,
        responseDeadline: null,
        clientName: source.clientName,
        industry: source.industry,
        companyWebsite: source.companyWebsite,
        dreamTrack: source.dreamTrack ?? undefined,
        targetDomain: source.targetDomain,
        engagementType: source.engagementType ?? undefined,
        domainPack: source.domainPack,
        domainPackConfig: source.domainPackConfig ?? undefined,
        blueprint: source.blueprint ?? undefined,
        // Copy all synthesis outputs so users see the full populated state
        prepResearch: source.prepResearch ?? undefined,
        customQuestions: source.customQuestions ?? undefined,
        discoveryQuestions: source.discoveryQuestions ?? undefined,
        discoveryBriefing: source.discoveryBriefing ?? undefined,
        discoverAnalysis: source.discoverAnalysis ?? undefined,
        discoverySummary: source.discoverySummary ?? undefined,
        outputIntelligence: source.outputIntelligence ?? undefined,
        reportSummary: source.reportSummary ?? undefined,
        historicalMetrics: source.historicalMetrics ?? undefined,
        // Track provenance
        isExample: false,
        exampleSourceId: sourceId,
      },
      select: { id: true },
    });

    return NextResponse.json({ workshopId: fork.id });
  } catch (error) {
    console.error('[workshop-fork]', error);
    return NextResponse.json({ error: 'Failed to fork workshop' }, { status: 500 });
  }
}
