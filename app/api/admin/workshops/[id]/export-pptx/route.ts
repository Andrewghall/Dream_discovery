/**
 * POST /api/admin/workshops/[id]/export-pptx
 *
 * Generates a professional PowerPoint presentation from the Download Report
 * using the same layout/section configuration as the PDF export.
 * Uses pptxgenjs (pure-JS, no native deps) — safe on Vercel Edge.
 */

import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import type {
  ReportSummary,
  ReportLayout,
  ReportSectionConfig,
  WorkshopOutputIntelligence,
  ReportConclusion,
  FacilitatorContact,
} from '@/lib/output-intelligence/types';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── Body type (mirrors export-pdf) ───────────────────────────────────────────

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

// ── Layout constants (inches, 16:9 widescreen) ───────────────────────────────

const SW = 10;         // slide width
const SH = 5.63;       // slide height
const ML = 0.4;        // left margin
const MR = 0.4;        // right margin
const CW = SW - ML - MR; // content width
const HDR = 0.52;      // header bar height
const CY = HDR + 0.12; // content start Y
const FY = SH - 0.26;  // footer line Y
const CH = FY - CY;    // content height

// ── Colour palette (hex without #) ───────────────────────────────────────────

const C = {
  primary:   '4F46E5',
  primaryDk: '3730A3',
  dark:      '0F172A',
  text:      '1E293B',
  muted:     '64748B',
  light:     'F1F5F9',
  border:    'E2E8F0',
  white:     'FFFFFF',
  green:     '065F46',
  greenBg:   'D1FAE5',
  amber:     'B45309',
  amberBg:   'FEF3C7',
  red:       'B91C1C',
  redBg:     'FEE2E2',
  purple:    '5B21B6',
  purpleBg:  'EDE9FE',
  blue:      '1D4ED8',
  blueBg:    'DBEAFE',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Sanitise text for PPTX — strip control characters */
function t(v: unknown): string {
  return String(v ?? '').replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').trim();
}

/** Truncate with ellipsis */
function tr(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/** Load a file from /public as a base64 data URL */
function readFileBase64(relativePath: string): string | null {
  try {
    const absPath = path.join(process.cwd(), 'public', relativePath);
    const buf = fs.readFileSync(absPath);
    const ext = path.extname(relativePath).slice(1).toLowerCase().replace('jpg', 'jpeg');
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

/** Fetch a remote URL as a base64 data URL */
async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') ?? 'image/png';
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

// ── Slide building utilities ─────────────────────────────────────────────────

type Slide = PptxGenJS.Slide;

/** Add the coloured section header bar at the top of every content slide */
function addHeader(slide: Slide, title: string, hexColor = C.primary) {
  slide.addShape('rect', {
    x: 0, y: 0, w: SW, h: HDR,
    fill: { color: hexColor },
    line: { color: hexColor, width: 0 },
  });
  slide.addText(title.toUpperCase(), {
    x: ML, y: 0.05, w: CW, h: HDR - 0.1,
    fontSize: 10.5, bold: true, color: C.white, fontFace: 'Calibri',
    valign: 'middle',
  });
}

/** Add footer line + labels */
function addFooter(slide: Slide, left: string) {
  slide.addShape('line', {
    x: ML, y: FY, w: CW, h: 0,
    line: { color: C.border, width: 0.5 },
  });
  slide.addText(t(tr(left, 100)), {
    x: ML, y: FY + 0.03, w: CW * 0.75, h: 0.2,
    fontSize: 7, color: C.muted, fontFace: 'Calibri',
  });
}

/** Colour-filled rectangle */
function box(
  slide: Slide,
  x: number, y: number, w: number, h: number,
  fill: string, stroke = fill, radius = 0,
) {
  slide.addShape('rect', {
    x, y, w, h,
    fill: { color: fill },
    line: stroke ? { color: stroke, width: 0.5 } : undefined,
    rectRadius: radius,
  });
}

// ── Cover slide ───────────────────────────────────────────────────────────────

async function addCoverSlide(
  pptx: PptxGenJS,
  workshopName: string,
  orgName: string,
  summary: ReportSummary,
  clientLogoUrl: string | undefined,
  dreamLogoB64: string | null,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.dark };

  // Top accent strip
  box(slide, 0, 0, SW, 0.07, C.primary, C.primary);

  // DREAM logo
  if (dreamLogoB64) {
    slide.addImage({ x: ML, y: 0.2, w: 1.4, h: 0.42, data: dreamLogoB64 });
  } else {
    slide.addText('DREAM', {
      x: ML, y: 0.18, w: 2.0, h: 0.45,
      fontSize: 22, bold: true, color: 'A5B4FC', fontFace: 'Calibri',
    });
  }

  // Client logo (top right)
  if (clientLogoUrl) {
    const b64 = await fetchBase64(clientLogoUrl).catch(() => null);
    if (b64) slide.addImage({ x: SW - MR - 1.9, y: 0.18, w: 1.9, h: 0.45, data: b64 });
  }

  // Divider
  slide.addShape('line', {
    x: ML, y: 0.82, w: CW, h: 0,
    line: { color: '334155', width: 0.75 },
  });

  // Workshop name headline
  slide.addText(t(workshopName), {
    x: ML, y: 0.98, w: CW, h: 1.35,
    fontSize: 30, bold: true, color: C.white, fontFace: 'Calibri',
    valign: 'top', wrap: true,
  });

  // Subtitle
  slide.addText('Discovery & Transformation Report', {
    x: ML, y: 2.38, w: CW, h: 0.38,
    fontSize: 14, color: 'A5B4FC', fontFace: 'Calibri',
  });

  // Key insight
  if (summary.keyInsight) {
    slide.addText(`"${t(tr(summary.keyInsight, 180))}"`, {
      x: ML, y: 2.88, w: CW * 0.82, h: 0.7,
      fontSize: 10, color: '94A3B8', fontFace: 'Calibri',
      italic: true, wrap: true,
    });
  }

  // Org + date
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  slide.addText(`${t(orgName)}  ·  ${dateStr}`, {
    x: ML, y: SH - 0.62, w: CW, h: 0.28,
    fontSize: 9, color: '64748B', fontFace: 'Calibri',
  });
}

// ── Table of contents slide ───────────────────────────────────────────────────

function addTocSlide(
  pptx: PptxGenJS,
  sections: ReportSectionConfig[],
  workshopName: string,
  orgName: string,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, 'Contents');
  addFooter(slide, `${workshopName} — ${orgName}`);

  const enabled = sections.filter(s => s.enabled);
  const half = Math.ceil(enabled.length / 2);
  const cols = [enabled.slice(0, half), enabled.slice(half)];
  const rowH = Math.min(0.36, CH / Math.max(half, 1) - 0.04);

  cols.forEach((col, ci) => {
    const colX = ML + ci * (CW / 2 + 0.1);
    col.forEach((sec, ri) => {
      const numIdx = ci * half + ri + 1;
      const ry = CY + 0.05 + ri * (rowH + 0.04);
      // Circle badge
      slide.addShape('ellipse', {
        x: colX, y: ry + (rowH - 0.22) / 2, w: 0.22, h: 0.22,
        fill: { color: C.primary },
        line: { color: C.primary, width: 0 },
      });
      slide.addText(String(numIdx), {
        x: colX, y: ry + (rowH - 0.22) / 2, w: 0.22, h: 0.22,
        fontSize: 7.5, bold: true, color: C.white, fontFace: 'Calibri',
        align: 'center', valign: 'middle',
      });
      // Title
      slide.addText(t(sec.title), {
        x: colX + 0.28, y: ry, w: CW / 2 - 0.32, h: rowH,
        fontSize: 10, color: C.text, fontFace: 'Calibri',
        valign: 'middle',
      });
    });
  });
}

// ── Chapter / divider slide ───────────────────────────────────────────────────

function addChapterSlide(pptx: PptxGenJS, title: string, idx: number) {
  const slide = pptx.addSlide();
  slide.background = { color: 'F8FAFC' };

  // Left accent bar
  box(slide, 0, 0, 0.18, SH, C.primary, C.primary);

  slide.addText(t(title), {
    x: 0.45, y: SH / 2 - 0.45, w: CW + ML - 0.05, h: 0.85,
    fontSize: 26, bold: true, color: C.dark, fontFace: 'Calibri',
    valign: 'middle',
  });
  slide.addText(`Section ${idx}`, {
    x: 0.45, y: SH / 2 + 0.48, w: CW, h: 0.28,
    fontSize: 11, color: C.muted, fontFace: 'Calibri',
  });
}

// ── Executive Summary slides ──────────────────────────────────────────────────

function addExecutiveSummarySlides(
  pptx: PptxGenJS,
  summary: ReportSummary,
  cfg: ReportSectionConfig,
  workshopName: string,
  orgName: string,
) {
  const es = summary.executiveSummary;
  const footer = `${workshopName} — ${orgName}`;
  const excl = (id: string) => cfg.excludedItems.includes(id);

  // ── Slide 1: The Ask + Key Findings ────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    addHeader(slide, 'Executive Summary');
    addFooter(slide, footer);

    let y = CY + 0.05;

    // Q&A card — tall enough for wrapping answer
    const qaH = 1.1;
    if (!excl('qa')) {
      box(slide, ML, y, CW, qaH, 'EEF2FF', 'C7D2FE', 0.05);
      slide.addText(t(tr(es.theAsk ?? '', 220)), {
        x: ML + 0.15, y: y + 0.06, w: CW - 0.3, h: 0.22,
        fontSize: 8.5, color: C.muted, fontFace: 'Calibri', wrap: true,
      });
      slide.addText(t(tr(es.theAnswer ?? '', 400)), {
        x: ML + 0.15, y: y + 0.3, w: CW - 0.3, h: 0.52,
        fontSize: 10.5, bold: true, color: C.text, fontFace: 'Calibri',
        wrap: true,
      });
      if (es.urgency) {
        slide.addText(`⚡ ${t(tr(es.urgency, 200))}`, {
          x: ML + 0.15, y: y + 0.86, w: CW - 0.3, h: 0.2,
          fontSize: 8.5, color: C.amber, fontFace: 'Calibri', wrap: true,
        });
      }
      y += qaH + 0.1;
    }

    // Key findings — dynamic heights filling remaining space
    const findings = (es.whatWeFound ?? [])
      .filter((_, i) => !excl(`finding:${i}`))
      .slice(0, 7);
    if (findings.length) {
      const labelH = 0.26;
      const gapH = 0.05;
      const availH = FY - y - labelH - 0.05;
      const findH = Math.max(0.46, (availH - gapH * (findings.length - 1)) / findings.length);

      slide.addText('KEY FINDINGS', {
        x: ML, y, w: CW, h: 0.22,
        fontSize: 7.5, bold: true, color: C.muted, fontFace: 'Calibri',
      });
      y += labelH;

      findings.forEach((f, i) => {
        const fy = y + i * (findH + gapH);
        box(slide, ML, fy, 0.3, findH, C.primary, C.primary, 0.03);
        slide.addText(String(i + 1), {
          x: ML, y: fy, w: 0.3, h: findH,
          fontSize: 9, bold: true, color: C.white, fontFace: 'Calibri',
          align: 'center', valign: 'middle',
        });
        slide.addText(t(tr(f, 350)), {
          x: ML + 0.37, y: fy + 0.04, w: CW - 0.37, h: findH - 0.08,
          fontSize: 9.5, color: C.text, fontFace: 'Calibri',
          wrap: true, valign: 'top',
        });
      });
    }
  }

  // ── Slide 2: Lens Findings (if any) ────────────────────────────────────────
  const lensFindings = (es.lensFindings ?? []).filter(lf => !excl(`lens:${lf.lens}`));
  if (lensFindings.length) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    addHeader(slide, 'Executive Summary — Lens Analysis');
    addFooter(slide, footer);

    const perRow = 2;
    const itemW = (CW - 0.12) / perRow;
    const visibleFindings = lensFindings.slice(0, 6);
    const rows = Math.ceil(visibleFindings.length / perRow);
    const hasTD = !excl('transformation') && !!summary.transformationDirection;
    const tdH = hasTD ? 0.72 : 0;
    const tdGap = hasTD ? 0.1 : 0;
    const labelH = 0.26;
    const rowGap = 0.08;
    const startY = CY + 0.05;
    const availForGrid = FY - startY - labelH - tdH - tdGap - 0.05;
    const cardH = Math.max(0.7, (availForGrid - rowGap * (rows - 1)) / rows);

    slide.addText('LENS FINDINGS', {
      x: ML, y: startY, w: CW, h: 0.22,
      fontSize: 7.5, bold: true, color: C.muted, fontFace: 'Calibri',
    });

    visibleFindings.forEach((lf, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const lx = ML + col * (itemW + 0.12);
      const ly = startY + labelH + row * (cardH + rowGap);
      box(slide, lx, ly, itemW, cardH, 'F8FAFC', C.border, 0.05);
      slide.addText(t(lf.lens).toUpperCase(), {
        x: lx + 0.1, y: ly + 0.08, w: itemW - 0.2, h: 0.2,
        fontSize: 7.5, bold: true, color: C.primary, fontFace: 'Calibri',
      });
      slide.addText(t(tr(lf.finding, 500)), {
        x: lx + 0.1, y: ly + 0.3, w: itemW - 0.2, h: cardH - 0.38,
        fontSize: 9, color: C.text, fontFace: 'Calibri',
        wrap: true, valign: 'top',
      });
    });

    // Transformation direction — positioned directly after the grid
    if (hasTD) {
      const gridEndY = startY + labelH + rows * (cardH + rowGap) - rowGap;
      const tdY = gridEndY + tdGap;
      box(slide, ML, tdY, CW, tdH, 'F0FDF4', 'BBF7D0', 0.05);
      slide.addText('TRANSFORMATION DIRECTION', {
        x: ML + 0.15, y: tdY + 0.06, w: CW, h: 0.18,
        fontSize: 7.5, bold: true, color: C.green, fontFace: 'Calibri',
      });
      slide.addText(t(tr(summary.transformationDirection ?? '', 350)), {
        x: ML + 0.15, y: tdY + 0.26, w: CW - 0.3, h: tdH - 0.32,
        fontSize: 9.5, color: C.text, fontFace: 'Calibri',
        wrap: true, valign: 'top',
      });
    }
  }
}

// ── Supporting Evidence slide ─────────────────────────────────────────────────

function addSupportingEvidenceSlide(
  pptx: PptxGenJS,
  intelligence: WorkshopOutputIntelligence,
  cfg: ReportSectionConfig,
  workshopName: string,
  orgName: string,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, 'Supporting Evidence');
  addFooter(slide, `${workshopName} — ${orgName}`);

  const { discoveryValidation: dv } = intelligence;
  let y = CY + 0.05;

  slide.addText(`Hypothesis Accuracy: ${dv.hypothesisAccuracy}%`, {
    x: ML, y, w: 3.0, h: 0.28,
    fontSize: 9.5, bold: true, color: C.primary, fontFace: 'Calibri',
  });
  y += 0.36;

  const confBg: Record<string, string> = { high: C.greenBg, medium: C.amberBg, low: 'F1F5F9' };
  const confFg: Record<string, string> = { high: C.green,   medium: C.amber,   low: C.muted };

  const confirmed = (dv.confirmedIssues ?? [])
    .filter((_, i) => !cfg.excludedItems.includes(`confirmed:${i}`))
    .slice(0, 5);

  const newIssues = (dv.newIssues ?? [])
    .filter((_, i) => !cfg.excludedItems.includes(`new:${i}`))
    .slice(0, 3);

  // Pre-compute uniform dynamic card height so all items fill the slide
  {
    const gapH = 0.05;
    const ciLabelH = confirmed.length ? 0.24 : 0;
    const niLabelH = newIssues.length ? 0.24 : 0;
    const totalGaps =
      gapH * Math.max(confirmed.length - 1, 0) +
      gapH * Math.max(newIssues.length - 1, 0);
    const totalAvail = FY - y - ciLabelH - niLabelH - totalGaps - 0.1;
    const totalItems = confirmed.length + newIssues.length;
    const cardH = totalItems > 0 ? Math.max(0.4, totalAvail / totalItems) : 0.4;

    if (confirmed.length) {
      slide.addText('CONFIRMED ISSUES', {
        x: ML, y, w: CW, h: 0.22,
        fontSize: 7.5, bold: true, color: C.muted, fontFace: 'Calibri',
      });
      y += 0.24;
      confirmed.forEach(ci => {
        box(slide, ML, y, CW, cardH, 'F8FAFC', C.border, 0.03);
        // Badge — centred vertically in card
        box(slide, ML + 0.1, y + (cardH - 0.22) / 2, 0.58, 0.22, confBg[ci.confidence] ?? 'F1F5F9', confBg[ci.confidence] ?? 'F1F5F9', 0.03);
        slide.addText(ci.confidence, {
          x: ML + 0.1, y: y + (cardH - 0.22) / 2, w: 0.58, h: 0.22,
          fontSize: 7, bold: true, color: confFg[ci.confidence] ?? C.muted,
          fontFace: 'Calibri', align: 'center', valign: 'middle',
        });
        // Issue title — upper half of right area
        slide.addText(t(tr(ci.issue, 280)), {
          x: ML + 0.78, y: y + 0.05, w: CW - 0.88, h: (cardH - 0.1) * 0.52,
          fontSize: 9, bold: true, color: C.text, fontFace: 'Calibri',
          wrap: true, valign: 'top',
        });
        // Evidence — lower half of right area
        slide.addText(t(tr(ci.workshopEvidence, 320)), {
          x: ML + 0.78, y: y + 0.05 + (cardH - 0.1) * 0.52, w: CW - 0.88, h: (cardH - 0.1) * 0.45,
          fontSize: 8, color: C.muted, fontFace: 'Calibri',
          wrap: true, valign: 'top',
        });
        y += cardH + gapH;
      });
    }

    if (newIssues.length) {
      slide.addText('NEW ISSUES — SURFACED IN WORKSHOP', {
        x: ML, y, w: CW, h: 0.22,
        fontSize: 7.5, bold: true, color: C.muted, fontFace: 'Calibri',
      });
      y += 0.24;
      newIssues.forEach(ni => {
        box(slide, ML, y, CW, cardH, 'FFF7ED', 'FED7AA', 0.03);
        slide.addText(t(tr(ni.issue, 280)), {
          x: ML + 0.15, y: y + 0.05, w: CW - 0.3, h: (cardH - 0.1) * 0.52,
          fontSize: 9, bold: true, color: 'C2410C', fontFace: 'Calibri',
          wrap: true, valign: 'top',
        });
        slide.addText(t(tr(ni.significance, 320)), {
          x: ML + 0.15, y: y + 0.05 + (cardH - 0.1) * 0.52, w: CW - 0.3, h: (cardH - 0.1) * 0.45,
          fontSize: 8, color: C.text, fontFace: 'Calibri',
          wrap: true, valign: 'top',
        });
        y += cardH + gapH;
      });
    }
  }
}

// ── Root Causes slide ─────────────────────────────────────────────────────────

function addRootCausesSlide(
  pptx: PptxGenJS,
  intelligence: WorkshopOutputIntelligence,
  cfg: ReportSectionConfig,
  workshopName: string,
  orgName: string,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, 'Root Causes');
  addFooter(slide, `${workshopName} — ${orgName}`);

  const { rootCause } = intelligence;
  let y = CY + 0.05;

  if (rootCause.systemicPattern) {
    box(slide, ML, y, CW, 0.54, 'EEF2FF', 'C7D2FE', 0.05);
    slide.addText(t(tr(rootCause.systemicPattern, 420)), {
      x: ML + 0.15, y: y + 0.07, w: CW - 0.3, h: 0.42,
      fontSize: 9.5, italic: true, color: C.text, fontFace: 'Calibri',
      wrap: true,
    });
    y += 0.64;
  }

  const sevBg: Record<string, string> = { critical: C.redBg, significant: C.amberBg, moderate: 'F1F5F9' };
  const sevFg: Record<string, string> = { critical: C.red,   significant: C.amber,   moderate: C.muted };

  const causes = (rootCause.rootCauses ?? [])
    .filter(rc => !cfg.excludedItems.includes(`cause:${rc.rank}`))
    .slice(0, 5);

  // Dynamic card height — fill the available slide space evenly across all causes
  const rcGapH = 0.06;
  const iH = causes.length > 0
    ? Math.max(0.56, (FY - y - rcGapH * (causes.length - 1) - 0.08) / causes.length)
    : 0.56;

  causes.forEach(rc => {
    box(slide, ML, y, CW, iH, 'F8FAFC', C.border, 0.04);

    // Rank — fixed top position
    box(slide, ML + 0.08, y + 0.12, 0.28, 0.28, C.primary, C.primary, 0.03);
    slide.addText(`#${rc.rank}`, {
      x: ML + 0.08, y: y + 0.12, w: 0.28, h: 0.28,
      fontSize: 8.5, bold: true, color: C.white, fontFace: 'Calibri',
      align: 'center', valign: 'middle',
    });

    // Severity
    box(slide, ML + 0.44, y + 0.12, 0.78, 0.22, sevBg[rc.severity] ?? 'F1F5F9', sevBg[rc.severity] ?? 'F1F5F9', 0.03);
    slide.addText(rc.severity, {
      x: ML + 0.44, y: y + 0.12, w: 0.78, h: 0.22,
      fontSize: 7.5, bold: true, color: sevFg[rc.severity] ?? C.muted,
      fontFace: 'Calibri', align: 'center', valign: 'middle',
    });

    // Cause — fills from top, leaving room for category and evidence at bottom
    const causeH = Math.max(0.22, iH - 0.38);
    slide.addText(t(tr(rc.cause, 280)), {
      x: ML + 1.3, y: y + 0.07, w: CW - 1.38, h: causeH,
      fontSize: 9.5, bold: true, color: C.text, fontFace: 'Calibri',
      wrap: true, valign: 'top',
    });

    // Category — just above the evidence line
    slide.addText(t(rc.category), {
      x: ML + 1.3, y: y + iH - 0.30, w: CW - 1.38, h: 0.16,
      fontSize: 8, color: C.muted, fontFace: 'Calibri',
    });

    // Top evidence — bottom strip
    const ev = (rc.evidence ?? []).slice(0, 1);
    if (ev[0]) {
      slide.addText(`• ${t(tr(ev[0], 220))}`, {
        x: ML + 0.15, y: y + iH - 0.18, w: CW - 0.25, h: 0.16,
        fontSize: 7.5, color: C.muted, fontFace: 'Calibri',
        wrap: true,
      });
    }
    y += iH + rcGapH;
  });
}

// ── Solution Direction slides ─────────────────────────────────────────────────

function addSolutionDirectionSlides(
  pptx: PptxGenJS,
  summary: ReportSummary,
  intelligence: WorkshopOutputIntelligence,
  cfg: ReportSectionConfig,
  workshopName: string,
  orgName: string,
) {
  const ss = summary.solutionSummary;
  const { roadmap } = intelligence;
  const footer = `${workshopName} — ${orgName}`;
  const excl = (id: string) => cfg.excludedItems.includes(id);

  // ── Slide 1: Vision + What Must Change ─────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    addHeader(slide, 'Solution Direction');
    addFooter(slide, footer);

    let y = CY + 0.05;

    if (ss.direction) {
      box(slide, ML, y, CW, 0.58, 'F0FDF4', 'BBF7D0', 0.05);
      slide.addText(t(tr(ss.direction, 280)), {
        x: ML + 0.15, y: y + 0.07, w: CW - 0.3, h: 0.46,
        fontSize: 11, bold: true, color: '0F4C2A', fontFace: 'Calibri',
        wrap: true,
      });
      y += 0.68;
    }

    const steps = (ss.whatMustChange ?? [])
      .filter((_, i) => !excl(`step:${i}`))
      .slice(0, 4);

    if (steps.length) {
      const sdLabelH = 0.24;
      const sdGapH = 0.06;
      const sdAvail = FY - y - sdLabelH - sdGapH * (steps.length - 1) - 0.08;
      const sdH = Math.max(0.48, sdAvail / steps.length);

      slide.addText('WHAT MUST CHANGE', {
        x: ML, y, w: CW, h: 0.22,
        fontSize: 7.5, bold: true, color: C.muted, fontFace: 'Calibri',
      });
      y += sdLabelH;
      steps.forEach((step, i) => {
        box(slide, ML, y, CW, sdH, 'F8FAFC', C.border, 0.04);
        box(slide, ML, y, 0.06, sdH, C.primary, C.primary);
        slide.addText(String(i + 1), {
          x: ML + 0.12, y: y + (sdH - 0.22) / 2, w: 0.22, h: 0.22,
          fontSize: 10, bold: true, color: C.primary, fontFace: 'Calibri',
          align: 'center',
        });
        // Area title — upper portion
        slide.addText(t(step.area), {
          x: ML + 0.42, y: y + 0.05, w: CW - 0.52, h: (sdH - 0.1) * 0.45,
          fontSize: 9.5, bold: true, color: C.text, fontFace: 'Calibri',
          wrap: true, valign: 'top',
        });
        // Required change — lower portion
        slide.addText(t(tr(step.requiredChange, 300)), {
          x: ML + 0.42, y: y + 0.05 + (sdH - 0.1) * 0.45, w: CW - 0.52, h: (sdH - 0.1) * 0.52,
          fontSize: 8.5, color: C.muted, fontFace: 'Calibri',
          wrap: true, valign: 'top',
        });
        y += sdH + sdGapH;
      });
    }
  }

  // ── Slide 2: Roadmap phases ─────────────────────────────────────────────────
  const phases = (roadmap?.phases ?? [])
    .filter((_, i) => !excl(`phase:${i}`))
    .slice(0, 3);

  if (phases.length) {
    const slide = pptx.addSlide();
    slide.background = { color: C.white };
    addHeader(slide, 'Solution Direction — Roadmap');
    addFooter(slide, footer);

    const phCols = ['4F46E5', '0891B2', '059669'];
    const colW = (CW - 0.2) / 3;
    const startY = CY + 0.08;
    const phH = FY - startY - 0.12;

    phases.forEach((phase, i) => {
      const px = ML + i * (colW + 0.1);
      const col = phCols[i] ?? C.primary;

      // Header
      box(slide, px, startY, colW, 0.5, col, col, 0.05);
      const shortTitle = t(phase.phase ?? `Phase ${i + 1}`)
        .replace(/^Phase \d+ — /, '');
      slide.addText(shortTitle, {
        x: px + 0.1, y: startY + 0.04, w: colW - 0.2, h: 0.24,
        fontSize: 9, bold: true, color: C.white, fontFace: 'Calibri',
        wrap: true,
      });
      slide.addText(t(phase.timeframe ?? ''), {
        x: px + 0.1, y: startY + 0.28, w: colW - 0.2, h: 0.18,
        fontSize: 7.5, color: 'E0E7FF', fontFace: 'Calibri',
      });

      // Body card
      box(slide, px, startY + 0.5, colW, phH - 0.5, 'F8FAFC', C.border, 0.05);

      let iy = startY + 0.62;
      (phase.initiatives ?? []).slice(0, 5).forEach(init => {
        if (iy + 0.3 > startY + phH - 0.05) return;
        slide.addText(`• ${t(tr(init.title, 52))}`, {
          x: px + 0.1, y: iy, w: colW - 0.2, h: 0.3,
          fontSize: 8, color: C.text, fontFace: 'Calibri',
          wrap: true,
        });
        iy += 0.32;
      });
    });
  }
}

// ── Customer Journey slide ────────────────────────────────────────────────────

function addJourneyMapSlide(
  pptx: PptxGenJS,
  journey: LiveJourneyData,
  intro: string | undefined,
  workshopName: string,
  orgName: string,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, 'Customer Journey');
  addFooter(slide, `${workshopName} — ${orgName}`);

  let y = CY + 0.05;

  if (intro) {
    slide.addText(t(tr(intro, 200)), {
      x: ML, y, w: CW, h: 0.28,
      fontSize: 9, color: C.muted, fontFace: 'Calibri',
      wrap: true,
    });
    y += 0.34;
  }

  const stages = journey.stages.slice(0, 6);
  const actors = journey.actors.slice(0, 5);

  const SENTI_BG: Record<string, string> = {
    critical:  'FEE2E2',
    concerned: 'FEF3C7',
    positive:  'DCFCE7',
    neutral:   'F1F5F9',
  };

  // Build header row
  const headerRow = [
    { text: 'Actor', options: { bold: true, fill: { color: C.primary }, color: C.white, fontSize: 8, fontFace: 'Calibri' } },
    ...stages.map(s => ({ text: t(tr(s, 18)), options: { bold: true, fill: { color: C.primary }, color: C.white, fontSize: 8, fontFace: 'Calibri' } })),
  ];

  // Build data rows
  const dataRows = actors.map(actor => {
    const actorCell = {
      text: `${t(actor.name)}\n${t(actor.role)}`,
      options: { bold: true, fontSize: 7.5, color: C.text, fill: { color: 'F8FAFC' }, fontFace: 'Calibri', valign: 'top' as const },
    };
    const stageCells = stages.map(stage => {
      const interactions = journey.interactions.filter(
        ix => ix.actor.toLowerCase() === actor.name.toLowerCase() &&
              ix.stage.toLowerCase() === stage.toLowerCase()
      ).slice(0, 2);
      const cellText = interactions.map(ix => `${ix.isPainPoint ? '⚠ ' : ''}${t(tr(ix.action, 38))}`).join('\n');
      const sentiment = interactions[0]?.sentiment ?? 'neutral';
      return {
        text: cellText,
        options: { fontSize: 7, color: C.text, fill: { color: SENTI_BG[sentiment] ?? 'F8FAFC' }, fontFace: 'Calibri', valign: 'top' as const },
      };
    });
    return [actorCell, ...stageCells];
  });

  const actorColW = CW * 0.18;
  const stageColW = (CW - actorColW) / Math.max(stages.length, 1);
  const colWidths = [actorColW, ...stages.map(() => stageColW)];

  try {
    slide.addTable([headerRow as Parameters<Slide['addTable']>[0][number], ...dataRows as Parameters<Slide['addTable']>[0]], {
      x: ML, y, w: CW,
      colW: colWidths,
      rowH: 0.56,
      fontFace: 'Calibri',
      border: { type: 'solid', color: C.border, pt: 0.5 },
    });
  } catch {
    // Fallback: just list actors if table fails
    slide.addText('Journey map available in the full PDF report', {
      x: ML, y: CY + 0.5, w: CW, h: 0.3,
      fontSize: 9, color: C.muted, fontFace: 'Calibri', italic: true,
    });
  }
}

// ── Strategic Impact slide ────────────────────────────────────────────────────

function addStrategicImpactSlide(
  pptx: PptxGenJS,
  intelligence: WorkshopOutputIntelligence,
  cfg: ReportSectionConfig,
  workshopName: string,
  orgName: string,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, 'Strategic Impact');
  addFooter(slide, `${workshopName} — ${orgName}`);

  const si = intelligence.strategicImpact;
  let y = CY + 0.05;

  // Business case summary
  if (si.businessCaseSummary) {
    slide.addText(t(tr(si.businessCaseSummary, 220)), {
      x: ML, y, w: CW, h: 0.36,
      fontSize: 9.5, color: C.text, fontFace: 'Calibri',
      wrap: true,
    });
    y += 0.44;
  }

  // 3 stat boxes
  const stats = [
    { id: 'automation',  label: 'Automation Potential', pct: si.automationPotential.percentage, bg: C.purpleBg, fg: C.purple },
    { id: 'ai_assisted', label: 'AI-Assisted Work',     pct: si.aiAssistedWork.percentage,    bg: 'E0E7FF',   fg: C.primaryDk },
    { id: 'human_only',  label: 'Human-Only Work',      pct: si.humanOnlyWork.percentage,     bg: C.greenBg,  fg: C.green },
  ].filter(s => !cfg.excludedItems.includes(s.id));

  if (stats.length) {
    const bW = (CW - 0.2 * (stats.length - 1)) / stats.length;
    stats.forEach((stat, i) => {
      const bx = ML + i * (bW + 0.2);
      box(slide, bx, y, bW, 0.85, stat.bg, stat.bg, 0.06);
      slide.addText(`${stat.pct}%`, {
        x: bx + 0.08, y: y + 0.04, w: bW - 0.16, h: 0.48,
        fontSize: 28, bold: true, color: stat.fg, fontFace: 'Calibri',
        align: 'center',
      });
      slide.addText(t(stat.label), {
        x: bx + 0.08, y: y + 0.54, w: bW - 0.16, h: 0.28,
        fontSize: 8, color: stat.fg, fontFace: 'Calibri',
        align: 'center', wrap: true,
      });
    });
    y += 0.95;
  }

  slide.addText(`Confidence score: ${si.confidenceScore}%`, {
    x: ML, y, w: 2.5, h: 0.24,
    fontSize: 8, color: C.muted, fontFace: 'Calibri',
  });
  y += 0.3;

  // Efficiency gains table
  const gains = si.efficiencyGains.slice(0, 7);
  if (gains.length) {
    slide.addText('EFFICIENCY GAINS', {
      x: ML, y, w: CW, h: 0.22,
      fontSize: 7.5, bold: true, color: C.muted, fontFace: 'Calibri',
    });
    y += 0.24;

    const headerRow = [
      { text: 'Metric',    options: { bold: true, fill: { color: C.primary }, color: C.white, fontSize: 8, fontFace: 'Calibri' } },
      { text: 'Estimated', options: { bold: true, fill: { color: C.primary }, color: C.white, fontSize: 8, fontFace: 'Calibri' } },
      { text: 'Basis',     options: { bold: true, fill: { color: C.primary }, color: C.white, fontSize: 8, fontFace: 'Calibri' } },
    ];
    const dataRows = gains.map((g, i) => [
      { text: t(g.metric),    options: { fontSize: 8, color: C.text,    fill: { color: i % 2 === 0 ? 'F8FAFC' : C.white }, fontFace: 'Calibri' } },
      { text: t(g.estimated), options: { fontSize: 8, bold: true, color: C.primary, fill: { color: i % 2 === 0 ? 'F8FAFC' : C.white }, fontFace: 'Calibri' } },
      { text: t(g.basis),     options: { fontSize: 7.5, color: C.muted, fill: { color: i % 2 === 0 ? 'F8FAFC' : C.white }, fontFace: 'Calibri' } },
    ]);
    try {
      slide.addTable([headerRow as Parameters<Slide['addTable']>[0][number], ...dataRows as Parameters<Slide['addTable']>[0]], {
        x: ML, y, w: CW,
        colW: [CW * 0.3, CW * 0.2, CW * 0.5],
        rowH: 0.3,
        fontFace: 'Calibri',
        border: { type: 'solid', color: C.border, pt: 0.5 },
      });
    } catch { /* ignore */ }
  }
}

// ── Discovery Diagnostic slide ────────────────────────────────────────────────

function addDiscoveryDiagnosticSlide(
  pptx: PptxGenJS,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoveryOutput: any,
  workshopName: string,
  orgName: string,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, 'Discovery Diagnostic');
  addFooter(slide, `${workshopName} — ${orgName}`);

  const CARDS = [
    { key: 'operationalReality',         label: 'Operational Reality',       bg: 'EFF6FF', border: 'BFDBFE', fg: '1E40AF' },
    { key: 'organisationalMisalignment', label: 'Leadership Alignment Risk', bg: 'FFF1F2', border: 'FECDD3', fg: '9F1239' },
    { key: 'systemicFriction',           label: 'Systemic Friction',         bg: 'FFFBEB', border: 'FDE68A', fg: '92400E' },
    { key: 'transformationReadiness',    label: 'Transformation Readiness',  bg: 'F0FDF4', border: 'BBF7D0', fg: '065F46' },
  ];

  const colW = (CW - 0.15) / 2;
  const rowH = (CH - 0.1) / 2;

  CARDS.forEach(({ key, label, bg, border, fg }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = ML + col * (colW + 0.15);
    const cy = CY + 0.05 + row * (rowH + 0.1);
    const card = discoveryOutput?.[key] as { insight?: string } | undefined;

    box(slide, cx, cy, colW, rowH, bg, border, 0.06);
    slide.addText(t(label), {
      x: cx + 0.12, y: cy + 0.1, w: colW - 0.24, h: 0.22,
      fontSize: 8.5, bold: true, color: fg, fontFace: 'Calibri',
    });
    slide.addText(t(tr(card?.insight ?? 'No data available', 180)), {
      x: cx + 0.12, y: cy + 0.34, w: colW - 0.24, h: rowH - 0.46,
      fontSize: 9, color: card?.insight ? C.text : C.muted, fontFace: 'Calibri',
      wrap: true, italic: !card?.insight,
    });
  });
}

// ── Discovery Signals slide ───────────────────────────────────────────────────

function addDiscoverySignalsSlide(
  pptx: PptxGenJS,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoveryOutput: any,
  workshopName: string,
  orgName: string,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, 'Discovery Signals');
  addFooter(slide, `${workshopName} — ${orgName}`);

  const SIGNALS = [
    { key: 'perception',  label: 'PERCEPTION',  color: '3B82F6' },
    { key: 'inhibition',  label: 'INHIBITION',  color: 'EF4444' },
    { key: 'imagination', label: 'IMAGINATION', color: '8B5CF6' },
    { key: 'vision',      label: 'VISION',      color: '10B981' },
    { key: 'execution',   label: 'EXECUTION',   color: 'F59E0B' },
  ];

  const barMaxW = CW - 1.9;
  const startY = CY + 0.12;
  const rowH = (FY - startY - 0.08) / SIGNALS.length;

  SIGNALS.forEach(({ key, label, color }, sigIdx) => {
    const scores = discoveryOutput?.[key] as { score?: number; description?: string } | undefined;
    const score = Math.min(Math.max(scores?.score ?? 0, 0), 100);
    const pct = score / 100;
    const ry = startY + sigIdx * rowH;

    slide.addText(t(label), {
      x: ML, y: ry + (rowH - 0.26) / 2, w: 1.2, h: 0.26,
      fontSize: 8.5, bold: true, color, fontFace: 'Calibri',
    });
    slide.addText(String(Math.round(score)), {
      x: ML + 1.25, y: ry + (rowH - 0.22) / 2, w: 0.42, h: 0.22,
      fontSize: 11, bold: true, color, fontFace: 'Calibri',
      align: 'center',
    });
    // Track
    box(slide, ML + 1.72, ry + rowH / 2 - 0.06, barMaxW, 0.12, 'E2E8F0', 'E2E8F0', 0.06);
    // Fill
    if (pct > 0.01) {
      box(slide, ML + 1.72, ry + rowH / 2 - 0.06, Math.max(barMaxW * pct, 0.12), 0.12, color, color, 0.06);
    }
    // Description
    if (scores?.description) {
      slide.addText(t(tr(scores.description, 90)), {
        x: ML + 1.72, y: ry + rowH / 2 + 0.1, w: barMaxW, h: 0.18,
        fontSize: 7.5, color: C.muted, fontFace: 'Calibri',
      });
    }
  });
}

// ── Insight Summary slide ─────────────────────────────────────────────────────

function addInsightSummarySlide(
  pptx: PptxGenJS,
  intelligence: WorkshopOutputIntelligence,
  workshopName: string,
  orgName: string,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, 'Insight Map Summary');
  addFooter(slide, `${workshopName} — ${orgName}`);

  const summary = intelligence.discoveryValidation.summary;
  slide.addText(t(tr(summary ?? 'No summary available.', 600)), {
    x: ML, y: CY + 0.1, w: CW, h: CH - 0.2,
    fontSize: 10, color: C.text, fontFace: 'Calibri',
    wrap: true,
  });
}

// ── Report Conclusion slide ───────────────────────────────────────────────────

function addReportConclusionSlide(
  pptx: PptxGenJS,
  conclusion: ReportConclusion,
  workshopName: string,
  orgName: string,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, 'Summary & Next Steps');
  addFooter(slide, `${workshopName} — ${orgName}`);

  let y = CY + 0.05;

  // Summary paragraph — tall enough to wrap comfortably
  const sumH = conclusion.summary ? 0.78 : 0;
  if (conclusion.summary) {
    box(slide, ML, y, CW, sumH, 'F0F9FF', 'BAE6FD', 0.05);
    slide.addText(t(tr(conclusion.summary, 520)), {
      x: ML + 0.15, y: y + 0.08, w: CW - 0.3, h: sumH - 0.14,
      fontSize: 9.5, color: C.text, fontFace: 'Calibri',
      wrap: true,
    });
    y += sumH + 0.1;
  }

  const steps = (conclusion.nextSteps ?? []).slice(0, 5);
  if (steps.length) {
    const rcLabelH = 0.24;
    const rcGapH = 0.06;
    const rcAvail = FY - y - rcLabelH - rcGapH * (steps.length - 1) - 0.08;
    const rcH = Math.max(0.46, rcAvail / steps.length);

    slide.addText('RECOMMENDED NEXT STEPS', {
      x: ML, y, w: CW, h: 0.22,
      fontSize: 7.5, bold: true, color: C.muted, fontFace: 'Calibri',
    });
    y += rcLabelH;

    steps.forEach((step, i) => {
      box(slide, ML, y, CW, rcH, 'F8FAFC', C.border, 0.04);

      // Circle number — vertically centred
      slide.addShape('ellipse', {
        x: ML + 0.1, y: y + (rcH - 0.26) / 2, w: 0.26, h: 0.26,
        fill: { color: C.primary },
        line: { color: C.primary, width: 0 },
      });
      slide.addText(String(i + 1), {
        x: ML + 0.1, y: y + (rcH - 0.26) / 2, w: 0.26, h: 0.26,
        fontSize: 9, bold: true, color: C.white, fontFace: 'Calibri',
        align: 'center', valign: 'middle',
      });

      // Title — upper portion
      slide.addText(t(step.title), {
        x: ML + 0.46, y: y + 0.05, w: CW - 0.56, h: (rcH - 0.1) * 0.42,
        fontSize: 9.5, bold: true, color: C.text, fontFace: 'Calibri',
        wrap: true, valign: 'top',
      });
      // Description — lower portion
      slide.addText(t(tr(step.description, 320)), {
        x: ML + 0.46, y: y + 0.05 + (rcH - 0.1) * 0.42, w: CW - 0.56, h: (rcH - 0.1) * 0.55,
        fontSize: 8.5, color: C.muted, fontFace: 'Calibri',
        wrap: true, valign: 'top',
      });
      y += rcH + rcGapH;
    });
  }
}

// ── Facilitator Contact slide ─────────────────────────────────────────────────

async function addFacilitatorContactSlide(
  pptx: PptxGenJS,
  contact: FacilitatorContact,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.dark };

  // Accent strip
  box(slide, 0, 0, SW, 0.07, C.primary, C.primary);

  // Company logo
  if (contact.companyLogoUrl) {
    const b64 = await fetchBase64(contact.companyLogoUrl).catch(() => null);
    if (b64) slide.addImage({ x: ML, y: 0.35, w: 2.0, h: 0.6, data: b64 });
  }

  slide.addText('GET IN TOUCH', {
    x: ML, y: 1.3, w: CW, h: 0.28,
    fontSize: 9, bold: true, color: '64748B', fontFace: 'Calibri',
  });
  slide.addText(t(contact.name), {
    x: ML, y: 1.6, w: CW, h: 0.58,
    fontSize: 28, bold: true, color: C.white, fontFace: 'Calibri',
  });
  if (contact.companyName) {
    slide.addText(t(contact.companyName), {
      x: ML, y: 2.22, w: CW, h: 0.3,
      fontSize: 13, color: 'A5B4FC', fontFace: 'Calibri',
    });
  }

  const lines = [
    contact.email && `📧  ${contact.email}`,
    contact.phone && `📞  ${contact.phone}`,
  ].filter(Boolean) as string[];

  lines.forEach((line, i) => {
    slide.addText(t(line), {
      x: ML, y: 2.72 + i * 0.46, w: CW, h: 0.4,
      fontSize: 12, color: 'CBD5E1', fontFace: 'Calibri',
    });
  });

  // Divider
  slide.addShape('line', {
    x: ML, y: SH - 1.05, w: CW, h: 0,
    line: { color: '334155', width: 0.75 },
  });
  slide.addText('Dream Discovery & Transformation', {
    x: ML, y: SH - 0.98, w: CW, h: 0.26,
    fontSize: 9, color: '475569', fontFace: 'Calibri',
  });
}

// ── Custom section slide ──────────────────────────────────────────────────────

async function addCustomSlide(
  pptx: PptxGenJS,
  cfg: ReportSectionConfig,
  workshopName: string,
  orgName: string,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, cfg.title, '334155');
  addFooter(slide, `${workshopName} — ${orgName}`);

  let y = CY + 0.1;

  if (cfg.customContent?.imageUrl) {
    const b64 = await fetchBase64(cfg.customContent.imageUrl).catch(() => null);
    if (b64) {
      const imgH = Math.min(CH * 0.58, 2.9);
      slide.addImage({ x: ML, y, w: CW, h: imgH, data: b64 });
      y += imgH + 0.1;
    }
  }

  if (cfg.customContent?.text) {
    slide.addText(t(tr(cfg.customContent.text, 600)), {
      x: ML, y, w: CW, h: FY - y - 0.08,
      fontSize: 9.5, color: C.text, fontFace: 'Calibri',
      wrap: true,
    });
  }
}

// ── Structural data slides ────────────────────────────────────────────────────

function addStructuralSlide(
  pptx: PptxGenJS,
  cfg: ReportSectionConfig,
  discoverAnalysis: DiscoverAnalysis | undefined,
  reportSummary: ReportSummary,
  workshopName: string,
  orgName: string,
) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, cfg.title);
  addFooter(slide, `${workshopName} — ${orgName}`);

  // Signal map: show image if captured, otherwise placeholder
  if (cfg.id === 'discovery_signal_map') {
    if (reportSummary.signalMapImageUrl) {
      slide.addText('Signal map captured from Discovery Output', {
        x: ML, y: CY + 0.1, w: CW, h: 0.26,
        fontSize: 9, color: C.muted, fontFace: 'Calibri', italic: true,
      });
      // Note: remote image embedding happens via fetchBase64 but we skip here
      // to avoid async complexity; image is noted for facilitator reference
    } else {
      slide.addText('Signal map not yet captured. Enable and save from the Discovery Output page.', {
        x: ML, y: CY + 0.2, w: CW, h: 0.28,
        fontSize: 9, color: C.muted, fontFace: 'Calibri', italic: true,
      });
    }
    return;
  }

  if (!discoverAnalysis) {
    slide.addText('No structural analysis data available.', {
      x: ML, y: CY + 0.2, w: CW, h: 0.28,
      fontSize: 9, color: C.muted, fontFace: 'Calibri', italic: true,
    });
    return;
  }

  let y = CY + 0.1;

  switch (cfg.id) {
    case 'structural_tensions': {
      const tensions = discoverAnalysis.tensions?.tensions ?? [];
      tensions.slice(0, 6).forEach(ten => {
        if (y + 0.46 > FY - 0.05) return;
        box(slide, ML, y, CW, 0.44, 'FFFBEB', 'FDE68A', 0.04);
        slide.addText(t(tr(ten.topic ?? '', 90)), {
          x: ML + 0.12, y: y + 0.05, w: CW - 0.24, h: 0.18,
          fontSize: 9.5, bold: true, color: C.text, fontFace: 'Calibri',
        });
        if (ten.viewpoints?.[0]?.position) {
          slide.addText(t(tr(ten.viewpoints[0].position, 130)), {
            x: ML + 0.12, y: y + 0.24, w: CW - 0.24, h: 0.16,
            fontSize: 8, color: C.muted, fontFace: 'Calibri',
          });
        }
        y += 0.5;
      });
      break;
    }
    case 'structural_barriers': {
      const constraints = discoverAnalysis.constraints?.constraints ?? [];
      constraints.slice(0, 6).forEach(c => {
        if (y + 0.44 > FY - 0.05) return;
        box(slide, ML, y, CW, 0.42, 'FFF1F2', 'FECDD3', 0.04);
        slide.addText(t(tr(c.description ?? '', 90)), {
          x: ML + 0.12, y: y + 0.05, w: CW - 0.24, h: 0.18,
          fontSize: 9.5, bold: true, color: C.red, fontFace: 'Calibri',
        });
        slide.addText(`${t(c.domain)}  ·  ${t(c.severity)}`, {
          x: ML + 0.12, y: y + 0.24, w: CW - 0.24, h: 0.15,
          fontSize: 8, color: C.text, fontFace: 'Calibri',
        });
        y += 0.48;
      });
      break;
    }
    case 'structural_alignment': {
      const cells = discoverAnalysis.alignment?.cells ?? [];
      const sorted = [...cells].sort((a, b) => Math.abs(a.alignmentScore) - Math.abs(b.alignmentScore)).slice(0, 6);
      sorted.forEach(cell => {
        if (y + 0.42 > FY - 0.05) return;
        const score = cell.alignmentScore;
        const isDiv = score < -0.2;
        box(slide, ML, y, CW, 0.4, isDiv ? 'FFF1F2' : 'F0FDF4', isDiv ? 'FECDD3' : 'BBF7D0', 0.04);
        slide.addText(`${t(cell.actor)} × ${t(cell.theme)}`, {
          x: ML + 0.12, y: y + 0.05, w: CW - 0.5, h: 0.18,
          fontSize: 9.5, bold: true, color: C.text, fontFace: 'Calibri',
        });
        slide.addText(score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2), {
          x: SW - MR - 0.5, y: y + 0.05, w: 0.5, h: 0.3,
          fontSize: 11, bold: true, color: isDiv ? C.red : C.green,
          fontFace: 'Calibri', align: 'right',
        });
        y += 0.46;
      });
      break;
    }
    case 'structural_narrative': {
      const layers = discoverAnalysis.narrative?.layers ?? [];
      layers.slice(0, 3).forEach(layer => {
        if (y + 0.6 > FY - 0.05) return;
        box(slide, ML, y, CW, 0.58, 'F8FAFC', C.border, 0.04);
        slide.addText(t(layer.layer).toUpperCase(), {
          x: ML + 0.12, y: y + 0.06, w: CW - 0.24, h: 0.18,
          fontSize: 8.5, bold: true, color: C.primary, fontFace: 'Calibri',
        });
        const terms = (layer.topTerms ?? []).slice(0, 5).map(term => term.term).join('  ·  ');
        slide.addText(t(tr(terms, 120)), {
          x: ML + 0.12, y: y + 0.26, w: CW - 0.24, h: 0.16,
          fontSize: 8.5, color: C.text, fontFace: 'Calibri',
        });
        slide.addText(`Sentiment: ${t(layer.dominantSentiment)}`, {
          x: ML + 0.12, y: y + 0.4, w: CW - 0.24, h: 0.14,
          fontSize: 8, color: C.muted, fontFace: 'Calibri',
        });
        y += 0.64;
      });
      break;
    }
    case 'structural_confidence': {
      const conf = discoverAnalysis.confidence;
      if (conf) {
        const overall = conf.overall;
        const certPct = overall ? Math.round(overall.certain / (overall.certain + overall.hedging + overall.uncertain) * 100) : 0;
        slide.addText(`Certainty: ${certPct}% certain  ·  ${overall?.hedging ?? 0} hedging  ·  ${overall?.uncertain ?? 0} uncertain`, {
          x: ML, y, w: CW, h: 0.28,
          fontSize: 10, bold: true, color: C.text, fontFace: 'Calibri',
          wrap: true,
        });
        y += 0.36;
        // Domain breakdown
        (conf.byDomain ?? []).slice(0, 5).forEach(d => {
          if (y + 0.38 > FY - 0.05) return;
          box(slide, ML, y, CW, 0.36, 'F8FAFC', C.border, 0.03);
          slide.addText(t(d.domain), {
            x: ML + 0.12, y: y + 0.06, w: CW * 0.35, h: 0.22,
            fontSize: 8.5, bold: true, color: C.text, fontFace: 'Calibri',
          });
          const dom = d.distribution;
          slide.addText(`Certain: ${dom.certain}  Hedging: ${dom.hedging}  Uncertain: ${dom.uncertain}`, {
            x: ML + CW * 0.38, y: y + 0.06, w: CW * 0.6, h: 0.22,
            fontSize: 8, color: C.muted, fontFace: 'Calibri',
          });
          y += 0.42;
        });
      } else {
        slide.addText('Confidence index data not available.', {
          x: ML, y: y + 0.1, w: CW, h: 0.28,
          fontSize: 9, color: C.muted, fontFace: 'Calibri', italic: true,
        });
      }
      break;
    }
    default: {
      slide.addText(`${t(cfg.title)} data available in the full report.`, {
        x: ML, y: CY + 0.2, w: CW, h: 0.28,
        fontSize: 9, color: C.muted, fontFace: 'Calibri', italic: true,
      });
    }
  }
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  const body = await request.json() as ExportPptxBody;
  const { reportSummary, intelligence, layout, liveJourneyData, discoveryOutput, discoverAnalysis } = body;
  const workshopName = body.workshopName ?? 'Workshop';
  const orgName = body.orgName ?? '';

  if (!reportSummary || !intelligence || !layout) {
    return NextResponse.json({ error: 'Missing required fields: reportSummary, intelligence, layout' }, { status: 400 });
  }

  try {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'DREAM Discovery';
    pptx.company = 'DREAM';
    pptx.title = `${workshopName} — Discovery & Transformation Report`;
    pptx.subject = 'Discovery & Transformation Report';

    // Load DREAM logo
    const dreamLogoB64 = readFileBase64('Dream.PNG');

    // Load client logo
    const clientLogoUrl = body.clientLogoUrl ?? layout.clientLogoUrl;

    // ── Cover ───────────────────────────────────────────────────────────
    await addCoverSlide(pptx, workshopName, orgName, reportSummary, clientLogoUrl, dreamLogoB64);

    // ── Table of Contents ────────────────────────────────────────────────
    const enabledSections = layout.sections.filter(s => s.enabled);
    if (enabledSections.length > 1) {
      addTocSlide(pptx, layout.sections, workshopName, orgName);
    }

    // ── Section slides ───────────────────────────────────────────────────
    let chapterIdx = 1;
    for (const cfg of layout.sections) {
      if (!cfg.enabled) continue;

      if (cfg.type === 'chapter') {
        addChapterSlide(pptx, cfg.title, chapterIdx++);
        continue;
      }

      if (cfg.type === 'custom') {
        await addCustomSlide(pptx, cfg, workshopName, orgName);
        continue;
      }

      // Builtin sections
      switch (cfg.id) {
        case 'executive_summary':
          addExecutiveSummarySlides(pptx, reportSummary, cfg, workshopName, orgName);
          break;
        case 'supporting_evidence':
          addSupportingEvidenceSlide(pptx, intelligence, cfg, workshopName, orgName);
          break;
        case 'root_causes':
          addRootCausesSlide(pptx, intelligence, cfg, workshopName, orgName);
          break;
        case 'solution_direction':
          addSolutionDirectionSlides(pptx, reportSummary, intelligence, cfg, workshopName, orgName);
          break;
        case 'journey_map':
          if (liveJourneyData?.actors?.length && liveJourneyData?.stages?.length) {
            addJourneyMapSlide(pptx, liveJourneyData, reportSummary.journeyIntro, workshopName, orgName);
          }
          break;
        case 'strategic_impact':
          addStrategicImpactSlide(pptx, intelligence, cfg, workshopName, orgName);
          break;
        case 'discovery_diagnostic':
          if (discoveryOutput) addDiscoveryDiagnosticSlide(pptx, discoveryOutput, workshopName, orgName);
          break;
        case 'discovery_signals':
          if (discoveryOutput) addDiscoverySignalsSlide(pptx, discoveryOutput, workshopName, orgName);
          break;
        case 'insight_summary':
          addInsightSummarySlide(pptx, intelligence, workshopName, orgName);
          break;
        case 'report_conclusion':
          if (reportSummary.reportConclusion) {
            addReportConclusionSlide(pptx, reportSummary.reportConclusion, workshopName, orgName);
          }
          break;
        case 'facilitator_contact':
          if (reportSummary.facilitatorContact) {
            await addFacilitatorContactSlide(pptx, reportSummary.facilitatorContact);
          }
          break;
        case 'structural_alignment':
        case 'structural_narrative':
        case 'structural_tensions':
        case 'structural_barriers':
        case 'structural_confidence':
        case 'discovery_signal_map':
          addStructuralSlide(pptx, cfg, discoverAnalysis, reportSummary, workshopName, orgName);
          break;
        default:
          break;
      }
    }

    // ── Write buffer ─────────────────────────────────────────────────────
    const data = await pptx.write({ outputType: 'nodebuffer' });
    const buf = Buffer.from(data as ArrayBuffer);
    const safeName = workshopName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${safeName}-report.pptx"`,
        'Content-Length': String(buf.length),
      },
    });
  } catch (error) {
    console.error('[Export PPTX] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PPTX generation failed' },
      { status: 500 },
    );
  }
}
