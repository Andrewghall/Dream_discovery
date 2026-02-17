import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    // Load the example data
    const examplePath = path.join(process.cwd(), 'example-scratchpad-output.json');
    const exampleData = JSON.parse(await fs.readFile(examplePath, 'utf-8'));

    // Check if scratchpad exists
    const existing = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
    });

    if (existing) {
      // Update existing scratchpad
      const scratchpad = await prisma.workshopScratchpad.update({
        where: { workshopId },
        data: {
          discoveryOutput: exampleData,
          execSummary: {
            visionStatement: 'Transform PAM Wellness into a unified digital care platform that empowers employees, delights employers, and positions the organization as a market leader in preventive wellness.',
            strategicShifts: exampleData.strategicShifts,
          },
          reimagineContent: {
            sections: exampleData.sections.filter((s: any) =>
              s.content.some((c: any) => c.type === 'aspiration' || c.type === 'opportunity')
            ),
          },
          constraintsContent: {
            sections: exampleData.sections.filter((s: any) =>
              s.content.some((c: any) => c.type === 'constraint' || c.type === 'risk')
            ),
          },
          commercialContent: {
            deliveryPhases: [
              {
                phase: 'Discovery & Design Sprint',
                investment: '£20,000',
                timeframe: '2 weeks',
              },
              {
                phase: 'Proof of Value (PoV)',
                investment: '£30,000',
                timeframe: '2 weeks',
              },
              {
                phase: 'Horizon 1: MVP Build',
                investment: '£80,000',
                timeframe: '12 weeks',
              },
              {
                phase: 'Horizon 2: Finalize solution',
                investment: '£50,000',
                timeframe: '12 weeks',
              },
              {
                phase: 'Operate and run costs (£10K per month)',
                investment: '+£50,000',
                timeframe: 'Balance of 52 weeks',
              },
            ],
            totalInvestment: '£400,000',
            ongoingCost: '£10K per month',
          },
          summaryContent: {
            nextSteps: [
              'Executive approval and budget allocation',
              'Form cross-functional product team',
              'Conduct technical architecture review',
              'Initiate vendor selection for key integrations',
            ],
          },
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ scratchpad, message: 'Example data loaded successfully' });
    } else {
      // Create new scratchpad with example data
      const scratchpad = await prisma.workshopScratchpad.create({
        data: {
          workshopId,
          discoveryOutput: exampleData,
          execSummary: {
            visionStatement: 'Transform PAM Wellness into a unified digital care platform that empowers employees, delights employers, and positions the organization as a market leader in preventive wellness.',
            strategicShifts: exampleData.strategicShifts,
          },
          reimagineContent: {
            sections: exampleData.sections.filter((s: any) =>
              s.content.some((c: any) => c.type === 'aspiration' || c.type === 'opportunity')
            ),
          },
          constraintsContent: {
            sections: exampleData.sections.filter((s: any) =>
              s.content.some((c: any) => c.type === 'constraint' || c.type === 'risk')
            ),
          },
          commercialContent: {
            deliveryPhases: [
              {
                phase: 'Discovery & Design Sprint',
                investment: '£20,000',
                timeframe: '2 weeks',
              },
              {
                phase: 'Proof of Value (PoV)',
                investment: '£30,000',
                timeframe: '2 weeks',
              },
              {
                phase: 'Horizon 1: MVP Build',
                investment: '£80,000',
                timeframe: '12 weeks',
              },
              {
                phase: 'Horizon 2: Finalize solution',
                investment: '£50,000',
                timeframe: '12 weeks',
              },
              {
                phase: 'Operate and run costs (£10K per month)',
                investment: '+£50,000',
                timeframe: 'Balance of 52 weeks',
              },
            ],
            totalInvestment: '£400,000',
            ongoingCost: '£10K per month',
          },
          summaryContent: {
            nextSteps: [
              'Executive approval and budget allocation',
              'Form cross-functional product team',
              'Conduct technical architecture review',
              'Initiate vendor selection for key integrations',
            ],
          },
          status: 'DRAFT',
        },
      });

      return NextResponse.json({ scratchpad, message: 'Scratchpad created with example data' });
    }
  } catch (error) {
    console.error('Failed to load example data:', error);
    return NextResponse.json(
      { error: 'Failed to load example data' },
      { status: 500 }
    );
  }
}
