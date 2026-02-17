import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emptyTemplateData } from '@/lib/demo-data/empty-template-data';
import { travelContactCentreData } from '@/lib/demo-data/travel-contact-centre-data';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    // Check if request wants demo data or empty template
    const body = await request.json().catch(() => ({}));
    const useDemoData = body.loadDemoData === true;

    const dataToLoad = useDemoData ? travelContactCentreData : emptyTemplateData;

    // Update or create scratchpad with selected data
    const scratchpad = await prisma.workshopScratchpad.upsert({
      where: { workshopId },
      update: {
        execSummary: dataToLoad.execSummary,
        discoveryOutput: dataToLoad.discoveryOutput,
        reimagineContent: dataToLoad.reimagineContent,
        constraintsContent: dataToLoad.constraintsContent,
        commercialContent: dataToLoad.commercialContent,
        summaryContent: dataToLoad.summaryContent,
        status: 'DRAFT',
      },
      create: {
        workshopId,
        execSummary: dataToLoad.execSummary,
        discoveryOutput: dataToLoad.discoveryOutput,
        reimagineContent: dataToLoad.reimagineContent,
        constraintsContent: dataToLoad.constraintsContent,
        commercialContent: dataToLoad.commercialContent,
        summaryContent: dataToLoad.summaryContent,
        status: 'DRAFT',
        version: 1,
      },
    });

    return NextResponse.json({ ok: true, scratchpad });
  } catch (error) {
    console.error('Failed to load demo data:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to load demo data' },
      { status: 500 }
    );
  }
}
