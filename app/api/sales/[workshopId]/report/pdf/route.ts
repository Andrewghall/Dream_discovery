import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { generateSalesReportHtml } from '@/lib/sales/sales-pdf';
import type { SalesReportData } from '@/lib/sales/sales-report-generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
      select: { salesReport: true, organizationId: true, name: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (session.role !== 'PLATFORM_ADMIN' && workshop.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!workshop.salesReport) {
      return NextResponse.json({ error: 'No report generated yet' }, { status: 404 });
    }

    const report = workshop.salesReport as unknown as SalesReportData;
    const html = generateSalesReportHtml(report);

    const reportDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
      defaultViewport: { width: 1280, height: 720 },
    });

    try {
      const page = await browser.newPage();
      await page.emulateMediaType('screen');
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        margin: { top: '14mm', bottom: '14mm', left: '10mm', right: '10mm' },
        headerTemplate: `
          <div style="width:100%; font-size:7pt; font-family:Arial, sans-serif; color:#555; padding:0 24px;">
            <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center;">
              <div style="text-align:left;">${reportDate}</div>
              <div style="text-align:center; font-weight:600; color:#111;">SALES CALL REPORT</div>
              <div></div>
            </div>
          </div>
        `,
        footerTemplate: `
          <div style="width:100%; font-size:7pt; font-family:Arial, sans-serif; color:#555; padding:0 24px;">
            <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center;">
              <div style="text-align:left;">Sales Call Intelligence</div>
              <div></div>
              <div style="text-align:right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
            </div>
          </div>
        `,
      });

      const pdfBuffer = Buffer.from(pdf);
      const safeName = (workshop.name || 'sales-report').replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeName}-report.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('Error generating sales PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
