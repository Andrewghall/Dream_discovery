/**
 * POST /api/admin/workshops/[id]/export-pdf
 *
 * Generates a professional PDF of the Download Report using the facilitator's
 * chosen layout (section order, enabled/disabled sections, excluded items,
 * custom sections with text and images).
 *
 * Uses @sparticuz/chromium + puppeteer-core (same infrastructure as the
 * existing discovery-report PDF generator).
 *
 * All HTML rendering logic lives in lib/report/html-renderers.ts so it can
 * be shared with the PPTX screenshot export.
 */

import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import type {
  ReportSummary,
  ReportLayout,
} from '@/lib/output-intelligence/types';
import type { WorkshopOutputIntelligence } from '@/lib/output-intelligence/types';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';
import { buildReportHtml, esc } from '@/lib/report/html-renderers';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── Logo helpers ──────────────────────────────────────────────────────────────

function readLogoAsBase64(relativePath: string): string | null {
  try {
    const absPath = path.join(process.cwd(), 'public', relativePath);
    const buf = fs.readFileSync(absPath);
    const ext = path.extname(relativePath).slice(1).toLowerCase().replace('jpg', 'jpeg');
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

async function fetchLogoAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'image/png';
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

interface ExportPdfBody {
  reportSummary: ReportSummary;
  intelligence: WorkshopOutputIntelligence;
  layout: ReportLayout;
  liveJourneyData?: LiveJourneyData | null;
  workshopName?: string;
  orgName?: string;
  clientLogoUrl?: string;   // Client logo for the cover page
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoveryOutput?: any;    // From scratchpad.discoveryOutput — for discovery_* sections
  discoverAnalysis?: DiscoverAnalysis; // Structural analysis data — for structural_* sections
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  const body = await request.json().catch(() => null) as ExportPdfBody | null;
  if (!body?.reportSummary || !body?.intelligence || !body?.layout) {
    return NextResponse.json({ error: 'Missing required fields: reportSummary, intelligence, layout' }, { status: 400 });
  }

  // ── Fetch workshop + org for logos ────────────────────────────────
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { name: true, organization: { select: { name: true, logoUrl: true } } },
  }).catch(() => null);

  const workshopName = body.workshopName ?? workshop?.name ?? 'Workshop';
  const orgName = body.orgName ?? workshop?.organization?.name ?? '';
  const orgLogoUrl = workshop?.organization?.logoUrl ?? null;

  // Load logos as base64 for embedding in HTML (no external requests from puppeteer)
  const dreamLogoBase64 = readLogoAsBase64('Dream.PNG');
  const tenantLogoBase64 = orgLogoUrl
    ? (orgLogoUrl.startsWith('http') ? await fetchLogoAsBase64(orgLogoUrl) : readLogoAsBase64(orgLogoUrl))
    : null;

  // Client logo — supplied by the user at export time
  const clientLogoUrlRaw = body.clientLogoUrl ?? body.layout.clientLogoUrl ?? null;
  const clientLogoBase64 = clientLogoUrlRaw
    ? (clientLogoUrlRaw.startsWith('http') ? await fetchLogoAsBase64(clientLogoUrlRaw) : readLogoAsBase64(clientLogoUrlRaw))
    : null;

  const enrichedBody = { ...body, workshopName, orgName };
  const html = buildReportHtml(enrichedBody, dreamLogoBase64, tenantLogoBase64, clientLogoBase64);

  const footerTemplate = `
    <div style="width:100%;box-sizing:border-box;padding:4px 18mm 0;display:flex;justify-content:space-between;align-items:center;font-size:8px;color:#9ca3af;font-family:Helvetica,Arial,sans-serif;border-top:1px solid #e5e7eb;">
      <span>${esc(workshopName)} — ${esc(orgName)}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '18mm', left: '18mm', right: '18mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
    });

    const filename = `${(body.workshopName ?? 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-discovery-report.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('PDF generation failed:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 502 });
  } finally {
    await browser?.close().catch(() => {});
  }
}
