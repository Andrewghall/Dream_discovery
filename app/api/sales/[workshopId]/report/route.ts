import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { generateSalesReport } from '@/lib/sales/sales-report-generator';

export const dynamic = 'force-dynamic';

// GET — fetch existing report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workshopId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workshopId } = await params;

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { salesReport: true, salesActions: true, organizationId: true, meetingPlan: true, name: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (session.role !== 'PLATFORM_ADMIN' && workshop.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      report: workshop.salesReport,
      actions: workshop.salesActions,
      workshopName: workshop.name,
    });
  } catch (error) {
    console.error('Error fetching sales report:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}

// POST — generate report from transcript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workshopId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workshopId } = await params;

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { organizationId: true, workshopType: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (session.role !== 'PLATFORM_ADMIN' && workshop.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const report = await generateSalesReport(workshopId);

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Error generating sales report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
