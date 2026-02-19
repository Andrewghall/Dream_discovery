import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emptyTemplateData } from '@/lib/demo-data/empty-template-data';
import { travelContactCentreData } from '@/lib/demo-data/travel-contact-centre-data';
import { retailTransformationData } from '@/lib/demo-data/retail-transformation-data';

const DEMO_DATASETS: Record<string, any> = {
  travel: travelContactCentreData,
  retail: retailTransformationData,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    // Check if request wants demo data or empty template
    const body = await request.json().catch(() => ({}));
    const useDemoData = body.loadDemoData === true;
    const datasetName = typeof body.dataset === 'string' ? body.dataset : 'travel';

    const dataToLoad = useDemoData
      ? (DEMO_DATASETS[datasetName] || travelContactCentreData)
      : emptyTemplateData;

    // Build the fields to upsert — include potentialSolution and customerJourney if present
    const fields: Record<string, any> = {
      execSummary: dataToLoad.execSummary,
      discoveryOutput: dataToLoad.discoveryOutput,
      reimagineContent: dataToLoad.reimagineContent,
      constraintsContent: dataToLoad.constraintsContent,
      commercialContent: dataToLoad.commercialContent,
      summaryContent: dataToLoad.summaryContent,
    };

    if (dataToLoad.potentialSolution) {
      fields.potentialSolution = dataToLoad.potentialSolution;
    }
    if (dataToLoad.customerJourney) {
      fields.customerJourney = dataToLoad.customerJourney;
    }

    // Update or create scratchpad with selected data
    const scratchpad = await prisma.workshopScratchpad.upsert({
      where: { workshopId },
      update: {
        ...fields,
        status: 'DRAFT',
      },
      create: {
        workshopId,
        ...fields,
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
