/**
 * POST /api/admin/workshops/[id]/preview-report
 *
 * Returns the same HTML used for PDF generation as text/html so the user
 * can preview the full report in a browser tab before clicking Generate PDF.
 * No Puppeteer / Chromium involved — just the HTML string.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import type { ReportSummary, ReportLayout } from '@/lib/output-intelligence/types';
import type { WorkshopOutputIntelligence } from '@/lib/output-intelligence/types';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';
import { buildReportHtml } from '@/lib/report/html-renderers';

export const runtime = 'nodejs';
export const maxDuration = 30;

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

interface PreviewBody {
  reportSummary: ReportSummary;
  intelligence: WorkshopOutputIntelligence;
  layout: ReportLayout;
  liveJourneyData?: LiveJourneyData | null;
  workshopName?: string;
  orgName?: string;
  clientLogoUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoveryOutput?: any;
  discoverAnalysis?: DiscoverAnalysis;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  const body = await request.json().catch(() => null) as PreviewBody | null;
  if (!body?.reportSummary || !body?.intelligence || !body?.layout) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { name: true, organization: { select: { name: true, logoUrl: true } } },
  }).catch(() => null);

  const workshopName = body.workshopName ?? workshop?.name ?? 'Workshop';
  const orgName = body.orgName ?? workshop?.organization?.name ?? '';
  const orgLogoUrl = workshop?.organization?.logoUrl ?? null;

  const dreamLogoBase64 = readLogoAsBase64('Dream.PNG');
  const tenantLogoBase64 = orgLogoUrl
    ? (orgLogoUrl.startsWith('http') ? await fetchLogoAsBase64(orgLogoUrl) : readLogoAsBase64(orgLogoUrl))
    : null;

  const clientLogoUrlRaw = body.clientLogoUrl ?? body.layout.clientLogoUrl ?? null;
  const clientLogoBase64 = clientLogoUrlRaw
    ? (clientLogoUrlRaw.startsWith('http') ? await fetchLogoAsBase64(clientLogoUrlRaw) : readLogoAsBase64(clientLogoUrlRaw))
    : null;

  const houseImages = {
    old:       readLogoAsBase64('framework/house-old.png'),
    refreshed: readLogoAsBase64('framework/house-refreshed.png'),
    ideal:     readLogoAsBase64('framework/house-ideal.png'),
  };

  const enrichedBody = { ...body, workshopName, orgName, houseImages };

  // Wrap the report HTML in a browser-friendly shell with A4 page styling
  const reportHtml = buildReportHtml(enrichedBody, dreamLogoBase64, tenantLogoBase64, clientLogoBase64);

  // Add a thin preview banner + A4-width container so the preview matches PDF scale
  const previewBanner = `
    <div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#1e293b;color:#fff;
      font-family:Helvetica,Arial,sans-serif;font-size:13px;padding:10px 20px;
      display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 12px rgba(0,0,0,0.4)">
      <span>📄 <strong>Report Preview</strong> — ${workshopName}</span>
      <span style="font-size:11px;color:#94a3b8">This is a preview. Use <strong>Generate PDF</strong> in the app to download.</span>
    </div>
    <div style="height:44px"></div>`;

  // Constrain body to A4 width so preview matches PDF scale
  const previewStyle = `<style>
    body { background: #e5e7eb !important; padding: 24px 0 !important; }
    body > *:not([style*="position:fixed"]) { max-width: 794px !important; margin-left: auto !important; margin-right: auto !important; }
    .report-page, section, .cover-page, .toc-page { box-shadow: 0 2px 8px rgba(0,0,0,0.12); margin-bottom: 12px !important; }
  </style>`;

  // Inject banner + style override after <head> closing tag
  const finalHtml = reportHtml
    .replace('</head>', `${previewStyle}</head>`)
    .replace('<body>', `<body>${previewBanner}`);

  return new NextResponse(finalHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
