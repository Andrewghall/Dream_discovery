/**
 * POST /api/admin/workshops/[id]/export-pptx
 *
 * Generates a PowerPoint presentation from the Download Report.
 *
 * Each section is rendered via the shared HTML renderers (lib/report/html-renderers.ts),
 * screenshotted by Puppeteer at 1200px wide, then embedded as a full-slide
 * image in pptxgenjs — producing the same rich, styled visuals as the PDF.
 *
 * This replaces the previous pptxgenjs text/table approach with pixel-perfect
 * screenshots of the exact same HTML that the PDF uses.
 */

import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';
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
  ReportSectionConfig,
  WorkshopOutputIntelligence,
} from '@/lib/output-intelligence/types';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';
import {
  PDF_STYLES,
  esc,
  renderExecutiveSummary,
  renderSupportingEvidence,
  renderRootCauses,
  renderSolutionDirection,
  renderJourneyMap,
  renderStrategicImpact,
  renderDiscoveryDiagnostic,
  renderDiscoverySignals,
  renderInsightSummary,
  renderStructuralAlignment,
  renderStructuralNarrative,
  renderStructuralTensions,
  renderStructuralBarriers,
  renderStructuralConfidence,
  renderSignalMap,
  renderFacilitatorBackPage,
  renderCustomSection,
  renderChapter,
  renderConclusion,
} from '@/lib/report/html-renderers';

export const runtime = 'nodejs';
export const maxDuration = 120;

// ── Slide dimensions (widescreen 13.33" × 7.5" = 16:9) ───────────────────────
const SW = 13.33;
const SH = 7.5;

// ── Screenshot viewport ───────────────────────────────────────────────────────
const VIEWPORT_W = 1200; // px — section screenshots
const COVER_W    = 1920; // px
const COVER_H    = 1080; // px

// ── Body type ─────────────────────────────────────────────────────────────────

interface ExportPptxBody {
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

// ── Fit image dimensions into slide (preserving aspect ratio, centred) ────────

function fitInSlide(imgW: number, imgH: number): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(SW / imgW, SH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return {
    x: (SW - w) / 2,
    y: (SH - h) / 2,
    w,
    h,
  };
}

// ── HTML wrapper for section screenshots ─────────────────────────────────────

/**
 * Wraps a single section's HTML in a self-contained page at VIEWPORT_W px.
 * fullPage screenshots will capture the full content height.
 */
function wrapSectionHtml(sectionHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${PDF_STYLES}
/* Slide-specific overrides */
body {
  padding: 36px 48px 44px !important;
  width: ${VIEWPORT_W}px !important;
  background: #ffffff !important;
}
.report-section { page-break-after: unset !important; break-after: unset !important; }
@page { size: auto; margin: 0; }
</style>
</head>
<body>
${sectionHtml}
</body>
</html>`;
}

// ── Cover slide HTML (dark themed, landscape 1920×1080) ───────────────────────

function buildCoverSlideHtml(
  workshopName: string,
  orgName: string,
  dreamLogoBase64: string | null,
  clientLogoBase64: string | null,
): string {
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${COVER_W}px; height: ${COVER_H}px; overflow: hidden; }
body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: #0f172a;
}
.cover {
  width: 100%; height: 100%;
  background: #0f172a;
  display: flex; flex-direction: column;
  padding: 72px 96px 60px;
  position: relative;
  overflow: hidden;
}
.cover::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 6px;
  background: linear-gradient(90deg, #6366f1 0%, #818cf8 55%, #10b981 100%);
}
.cover::after {
  content: '';
  position: absolute;
  bottom: -60px; right: -60px;
  width: 320px; height: 320px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%);
  pointer-events: none;
}
.cover-top {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: auto;
}
.cover-client-name {
  font-size: 28pt; font-weight: 300; color: rgba(255,255,255,0.65);
  letter-spacing: -0.01em;
}
.cover-client-logo {
  max-height: 80px; max-width: 260px;
  object-fit: contain;
  filter: brightness(0) invert(1); opacity: 0.88;
}
.cover-dream-logo {
  max-height: 52px; max-width: 180px;
  object-fit: contain;
  filter: brightness(0) invert(1); opacity: 0.55;
}
.cover-body { margin-bottom: 56px; }
.cover-eyebrow {
  font-size: 10pt; font-weight: 600;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: #818cf8; margin-bottom: 22px;
}
.cover-title {
  font-size: 54pt; font-weight: 800;
  color: #ffffff; line-height: 1.03;
  letter-spacing: -0.025em; margin-bottom: 16px;
}
.cover-subtitle {
  font-size: 22pt; font-weight: 300;
  color: rgba(255,255,255,0.45);
}
.cover-divider {
  width: 64px; height: 4px;
  background: #6366f1; border-radius: 2px; margin-top: 36px;
}
.cover-footer {
  display: flex; align-items: flex-end; justify-content: space-between;
}
.cover-meta-label {
  font-size: 8pt; font-weight: 600;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: rgba(255,255,255,0.28); margin-bottom: 4px;
}
.cover-meta-value {
  font-size: 11pt; font-weight: 400;
  color: rgba(255,255,255,0.65);
}
</style>
</head>
<body>
<div class="cover">
  <div class="cover-top">
    <div>
      ${clientLogoBase64
        ? `<img src="${clientLogoBase64}" class="cover-client-logo" alt="${esc(orgName)} logo" />`
        : `<div class="cover-client-name">${esc(orgName)}</div>`}
    </div>
    <div>
      ${dreamLogoBase64
        ? `<img src="${dreamLogoBase64}" class="cover-dream-logo" alt="DREAM" />`
        : `<div style="font-size:18pt;font-weight:800;color:rgba(255,255,255,0.35)">DREAM</div>`}
    </div>
  </div>
  <div class="cover-body">
    <div class="cover-eyebrow">Discovery &amp; Transformation Report</div>
    <div class="cover-title">${esc(workshopName)}</div>
    <div class="cover-subtitle">${esc(orgName)}</div>
    <div class="cover-divider"></div>
  </div>
  <div class="cover-footer">
    <div>
      <div class="cover-meta-label">Prepared</div>
      <div class="cover-meta-value">${dateStr}</div>
    </div>
    <div>
      <div class="cover-meta-label">Produced by</div>
      <div class="cover-meta-value">DREAM Discovery Platform</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── Section HTML resolver ─────────────────────────────────────────────────────

function resolveSectionHtml(
  cfg: ReportSectionConfig,
  reportSummary: ReportSummary,
  intelligence: WorkshopOutputIntelligence,
  liveJourneyData: LiveJourneyData | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoveryOutput: any,
  discoverAnalysis: DiscoverAnalysis | undefined,
  dreamLogoBase64: string | null,
): string {
  if (cfg.type === 'chapter') return renderChapter(cfg);
  if (cfg.type === 'custom')  return renderCustomSection(cfg);
  switch (cfg.id) {
    case 'executive_summary':    return renderExecutiveSummary(reportSummary, cfg);
    case 'supporting_evidence':  return renderSupportingEvidence(intelligence, cfg);
    case 'root_causes':          return renderRootCauses(intelligence, cfg);
    case 'solution_direction':   return renderSolutionDirection(reportSummary, intelligence, cfg);
    case 'journey_map':          return liveJourneyData ? renderJourneyMap(liveJourneyData, reportSummary.journeyIntro, cfg) : '';
    case 'strategic_impact':     return renderStrategicImpact(intelligence, cfg);
    case 'discovery_diagnostic': return renderDiscoveryDiagnostic(discoveryOutput);
    case 'discovery_signals':    return renderDiscoverySignals(discoveryOutput);
    case 'insight_summary':      return renderInsightSummary(intelligence);
    case 'structural_alignment': return renderStructuralAlignment(discoverAnalysis);
    case 'structural_narrative': return renderStructuralNarrative(discoverAnalysis);
    case 'structural_tensions':  return renderStructuralTensions(discoverAnalysis);
    case 'structural_barriers':  return renderStructuralBarriers(discoverAnalysis);
    case 'structural_confidence':return renderStructuralConfidence(discoverAnalysis);
    case 'discovery_signal_map': return renderSignalMap(reportSummary, discoverAnalysis);
    case 'facilitator_contact':  return renderFacilitatorBackPage(reportSummary, dreamLogoBase64);
    case 'report_conclusion':    return renderConclusion(reportSummary);
    default: return '';
  }
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

  const body = await request.json().catch(() => null) as ExportPptxBody | null;
  if (!body?.reportSummary || !body?.intelligence || !body?.layout) {
    return NextResponse.json({ error: 'Missing required fields: reportSummary, intelligence, layout' }, { status: 400 });
  }

  const { reportSummary, intelligence, layout, liveJourneyData, discoveryOutput, discoverAnalysis } = body;

  // ── Fetch workshop / org ───────────────────────────────────────────────────
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { name: true, organization: { select: { name: true, logoUrl: true } } },
  }).catch(() => null);

  const workshopName = body.workshopName ?? workshop?.name ?? 'Workshop';
  const orgName      = body.orgName      ?? workshop?.organization?.name ?? '';
  const orgLogoUrl   = workshop?.organization?.logoUrl ?? null;

  // ── Logos as base64 ────────────────────────────────────────────────────────
  const dreamLogoBase64  = readLogoAsBase64('Dream.PNG');
  const tenantLogoBase64 = orgLogoUrl
    ? (orgLogoUrl.startsWith('http') ? await fetchLogoAsBase64(orgLogoUrl) : readLogoAsBase64(orgLogoUrl))
    : null;
  void tenantLogoBase64; // available for future use

  const clientLogoUrlRaw = body.clientLogoUrl ?? layout.clientLogoUrl ?? null;
  const clientLogoBase64 = clientLogoUrlRaw
    ? (clientLogoUrlRaw.startsWith('http') ? await fetchLogoAsBase64(clientLogoUrlRaw) : readLogoAsBase64(clientLogoUrlRaw))
    : null;

  const enabledSections = layout.sections.filter(s => s.enabled);

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    // ── Launch Puppeteer ────────────────────────────────────────────────────
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: VIEWPORT_W, height: 900 },
      executablePath,
      headless: true,
    });

    // ── Screenshot: cover slide (1920×1080 = 16:9 exact) ──────────────────
    const coverPage = await browser.newPage();
    await coverPage.setViewport({ width: COVER_W, height: COVER_H, deviceScaleFactor: 1 });
    const coverHtml = buildCoverSlideHtml(workshopName, orgName, dreamLogoBase64, clientLogoBase64);
    await coverPage.setContent(coverHtml, { waitUntil: 'networkidle0' });
    const coverBuf = Buffer.from(await coverPage.screenshot({ type: 'jpeg', quality: 92 }));
    await coverPage.close();

    // ── Screenshot: each enabled section ───────────────────────────────────
    const sectionScreenshots: Array<{ cfg: ReportSectionConfig; buf: Buffer; imgH: number }> = [];

    const contentPage = await browser.newPage();
    await contentPage.setViewport({ width: VIEWPORT_W, height: 900, deviceScaleFactor: 1 });

    for (const cfg of enabledSections) {
      const sectionHtml = resolveSectionHtml(
        cfg, reportSummary, intelligence, liveJourneyData,
        discoveryOutput, discoverAnalysis, dreamLogoBase64,
      );
      if (!sectionHtml) continue;

      const wrappedHtml = wrapSectionHtml(sectionHtml);
      await contentPage.setContent(wrappedHtml, { waitUntil: 'networkidle0' });

      // Get the natural rendered height so we can centre the image correctly
      const imgH = await contentPage.evaluate(
        () => document.documentElement.scrollHeight,
      );

      const buf = Buffer.from(await contentPage.screenshot({
        type: 'jpeg',
        quality: 88,
        fullPage: true,
      }));

      sectionScreenshots.push({ cfg, buf, imgH });
    }

    await contentPage.close();

    // ── Assemble pptxgenjs ─────────────────────────────────────────────────
    const pptx = new PptxGenJS();
    pptx.layout  = 'LAYOUT_WIDE';   // 13.33" × 7.5"
    pptx.title   = workshopName;
    pptx.subject = 'Discovery & Transformation Report';
    pptx.author  = 'DREAM Discovery Platform';

    // Cover slide — 16:9 screenshot fills entire slide perfectly
    const coverSlide = pptx.addSlide();
    coverSlide.addImage({
      data: `data:image/jpeg;base64,${coverBuf.toString('base64')}`,
      x: 0, y: 0, w: SW, h: SH,
    });

    // Content slides — each section screenshot fitted and centred
    for (const { buf, imgH } of sectionScreenshots) {
      const pos = fitInSlide(VIEWPORT_W, imgH);

      const slide = pptx.addSlide();
      slide.background = { color: 'FFFFFF' };

      slide.addImage({
        data: `data:image/jpeg;base64,${buf.toString('base64')}`,
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
      });
    }

    // ── Write buffer ───────────────────────────────────────────────────────
    const data   = await pptx.write({ outputType: 'nodebuffer' });
    const outBuf = Buffer.from(data as ArrayBuffer);
    const safeName = workshopName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

    return new NextResponse(outBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${safeName}-report.pptx"`,
        'Content-Length': String(outBuf.length),
      },
    });

  } catch (error) {
    console.error('[Export PPTX] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PPTX generation failed' },
      { status: 500 },
    );
  } finally {
    await browser?.close().catch(() => {});
  }
}
