import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type RgbColor = ReturnType<typeof rgb>;

type FontMetrics = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

type InputQuality = {
  score: number;
  label: 'high' | 'medium' | 'low';
  rationale: string;
};

type KeyInsight = {
  title: string;
  insight: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
};

type PhaseInsight = {
  phase: string;
  currentScore: number | null;
  targetScore: number | null;
  projectedScore: number | null;
};

export async function generateDiscoveryReportPdf(params: {
  participantName: string;
  workshopName: string | null | undefined;
  discoveryUrl: string;
  executiveSummary: string;
  tone: string | null;
  feedback: string;
  inputQuality?: InputQuality;
  keyInsights?: KeyInsight[];
  phaseInsights: PhaseInsight[];
}): Promise<Buffer> {
  const {
    participantName,
    workshopName,
    discoveryUrl,
    executiveSummary,
    tone,
    feedback,
    inputQuality,
    keyInsights,
    phaseInsights,
  } = params;

  const safeWorkshopName = workshopName || 'DREAM Discovery';
  const toTitleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const scoreText = (n: number | null) => (typeof n === 'number' ? `${n}/10` : '—');

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const safeReadPublic = async (relativePublicPath: string) => {
    const full = path.join(process.cwd(), 'public', relativePublicPath);
    return await readFile(full);
  };

  const ethentaLogo = await pdfDoc.embedPng(await safeReadPublic('ethenta-logo.png'));
  const dreamBanner = await pdfDoc.embedPng(await safeReadPublic('Dream.PNG'));

  const a4 = { width: 595.28, height: 841.89 };

  const margin = 40;
  const fontSize = 9.5;
  const titleSize = 16;
  const sectionTitleSize = 12;
  const cardPad = 11;

  const tableFontSize = 9;
  const tableLine = 14;

  const colors = {
    ink: rgb(0.1, 0.1, 0.18),
    body: rgb(0.22, 0.25, 0.32),
    muted: rgb(0.4, 0.44, 0.5),
    border: rgb(0.88, 0.89, 0.92),
    card: rgb(0.98, 0.98, 0.99),
  };

  const wrapLines = (text: string, maxWidth: number, f: FontMetrics, size: number) => {
    const words = (text || '').replace(/\r\n/g, '\n').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      const width = f.widthOfTextAtSize(candidate, size);
      if (width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  let page = pdfDoc.addPage([a4.width, a4.height]);
  const { width, height } = page.getSize();
  const contentWidth = width - margin * 2;
  let y = height - margin;

  const reportDate = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

  const headerTitle = 'DREAM DISCOVERY';

  const newPage = () => {
    page = pdfDoc.addPage([a4.width, a4.height]);
    const size = page.getSize();
    y = size.height - margin;
    return size;
  };

  const drawHeaderFooter = (p: PDFPage, pageIndex: number) => {
    const { width: pw, height: ph } = p.getSize();

    const headerY = ph - 26;
    p.drawText(reportDate, {
      x: margin,
      y: headerY,
      size: 9,
      font,
      color: colors.muted,
    });

    const titleW = bold.widthOfTextAtSize(headerTitle, 9);
    p.drawText(headerTitle, {
      x: Math.max(margin, (pw - titleW) / 2),
      y: headerY,
      size: 9,
      font: bold,
      color: colors.ink,
    });

    const footerY = margin - 26;
    p.drawText('Copyright 2026 Ethenta', {
      x: margin,
      y: footerY,
      size: 9,
      font,
      color: colors.muted,
    });

    const pageLabel = `Page ${pageIndex + 1}`;
    const pageW = font.widthOfTextAtSize(pageLabel, 9);
    p.drawText(pageLabel, {
      x: pw - margin - pageW,
      y: footerY,
      size: 9,
      font,
      color: colors.muted,
    });
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      newPage();
    }
  };

  const drawHeader = () => {
    const logoTargetH = 18;
    const logoScale = logoTargetH / ethentaLogo.height;
    const logoW = ethentaLogo.width * logoScale;
    ensureSpace(logoTargetH + 8);
    page.drawImage(ethentaLogo, {
      x: margin,
      y: y - logoTargetH,
      width: logoW,
      height: logoTargetH,
    });
    y -= logoTargetH + 8;

    const bannerMaxH = 56;
    const bannerScale = Math.min(contentWidth / dreamBanner.width, bannerMaxH / dreamBanner.height);
    const bannerW = dreamBanner.width * bannerScale;
    const bannerH = dreamBanner.height * bannerScale;
    ensureSpace(bannerH + 10);
    page.drawImage(dreamBanner, {
      x: margin + (contentWidth - bannerW) / 2,
      y: y - bannerH,
      width: bannerW,
      height: bannerH,
    });
    y -= bannerH + 10;
  };

  const drawCard = (title: string, drawBody: (x: number, yTop: number, w: number) => number) => {
    ensureSpace(48);
    const cardX = margin;
    const cardW = contentWidth;
    const cardTopY = y;

    const innerTop = cardTopY - cardPad;
    const usedAfter = drawBody(cardX + cardPad, innerTop, cardW - cardPad * 2);
    const cardH = cardTopY - usedAfter + cardPad;

    page.drawRectangle({
      x: cardX,
      y: cardTopY - cardH,
      width: cardW,
      height: cardH,
      borderColor: colors.border,
      borderWidth: 1,
    });

    page.drawText(title, {
      x: cardX + cardPad,
      y: cardTopY - cardPad - sectionTitleSize + 2,
      size: sectionTitleSize,
      font: bold,
      color: colors.ink,
    });

    return cardTopY - cardH - 14;
  };

  const drawWrapped = (
    text: string,
    x: number,
    maxW: number,
    size: number,
    lineGap: number,
    color: RgbColor
  ) => {
    const paragraphs = (text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
    for (const p of paragraphs) {
      const lines = wrapLines(p, maxW, font, size);
      for (const line of lines) {
        ensureSpace(size + lineGap + 2);
        page.drawText(line, { x, y: y - size, size, font, color });
        y -= size + lineGap;
      }
      y -= 4;
    }
  };

  drawHeader();

  ensureSpace(titleSize + 14);
  page.drawText(reportDate, { x: margin, y: y - 9, size: 9, font, color: colors.muted });
  y -= 12;

  page.drawText(headerTitle, { x: margin, y: y - titleSize, size: titleSize, font: bold, color: colors.ink });
  y -= titleSize + 4;

  page.drawText('Interviewee view of the organisation and operating environment', {
    x: margin,
    y: y - fontSize,
    size: fontSize,
    font,
    color: colors.muted,
  });
  y -= fontSize + 10;

  const metaLine = `Workshop: ${safeWorkshopName}  |  Participant: ${participantName}${tone ? `  |  Tone: ${tone}` : ''}`;
  drawWrapped(metaLine, margin, contentWidth, 9, 2, colors.body);

  y = drawCard('Executive Summary', (x, yTop, w) => {
    y = yTop - sectionTitleSize - 10;
    drawWrapped(executiveSummary || '', x, w, fontSize, 3, colors.body);
    return y;
  });

  if (inputQuality) {
    y = drawCard('Input Quality (Evidence Check)', (x, yTop, w) => {
      y = yTop - sectionTitleSize - 10;
      const scoreLine = `Score: ${Math.round(inputQuality.score)}/100 (${inputQuality.label})`;
      drawWrapped(scoreLine, x, w, fontSize, 3, colors.body);
      if (inputQuality.rationale) drawWrapped(inputQuality.rationale, x, w, fontSize, 3, colors.body);
      return y;
    });
  }

  if (Array.isArray(keyInsights) && keyInsights.length > 0) {
    y = drawCard('Key Insights (Evidence-backed)', (x, yTop, w) => {
      y = yTop - sectionTitleSize - 10;

      for (const [idx, k] of keyInsights.slice(0, 6).entries()) {
        const heading = `${idx + 1}. ${k.title} (confidence: ${k.confidence})`;
        drawWrapped(heading, x, w, fontSize, 3, colors.ink);
        drawWrapped(k.insight, x, w, fontSize, 3, colors.body);
        if (Array.isArray(k.evidence) && k.evidence.length > 0) {
          const ev = k.evidence.slice(0, 3).map((q) => `“${q}”`).join('  ');
          drawWrapped(ev, x, w, 9, 2, colors.muted);
        }
        y -= 4;
      }
      return y;
    });
  }

  const scoresTableNeeded =
    sectionTitleSize + 12 + cardPad * 2 + 18 + 16 + phaseInsights.length * tableLine + 34;
  ensureSpace(scoresTableNeeded);

  y = drawCard('Scores by Domain (1–10)', (x, yTop, w) => {
    y = yTop - sectionTitleSize - 12;
    const col1 = x;
    const col2 = x + w * 0.42;
    const col3 = x + w * 0.67;

    drawWrapped(
      'Current = where the company is today. Target = where it should be. Projected = where it will be if nothing changes.',
      x,
      w,
      8.5,
      2,
      colors.muted
    );

    page.drawText('Domain', { x: col1, y: y - 10, size: tableFontSize, font: bold, color: colors.ink });
    page.drawText('Current', { x: col2, y: y - 10, size: tableFontSize, font: bold, color: colors.ink });
    page.drawText('Target', { x: col3, y: y - 10, size: tableFontSize, font: bold, color: colors.ink });
    page.drawText('Projected', { x: x + w - 52, y: y - 10, size: tableFontSize, font: bold, color: colors.ink });
    y -= tableLine;

    for (const p of phaseInsights) {
      page.drawText(toTitleCase(p.phase), { x: col1, y: y - 10, size: tableFontSize, font, color: colors.body });
      page.drawText(scoreText(p.currentScore), { x: col2, y: y - 10, size: tableFontSize, font, color: colors.body });
      page.drawText(scoreText(p.targetScore), { x: col3, y: y - 10, size: tableFontSize, font, color: colors.body });
      page.drawText(scoreText(p.projectedScore), { x: x + w - 52, y: y - 10, size: tableFontSize, font, color: colors.body });
      y -= tableLine;
    }

    return y;
  });

  y = drawCard('Feedback to the Interviewee', (x, yTop, w) => {
    y = yTop - sectionTitleSize - 10;
    drawWrapped(feedback || '', x, w, fontSize, 3, colors.body);
    y -= 6;
    drawWrapped(`Report link: ${discoveryUrl}`, x, w, 9, 2, colors.muted);
    return y;
  });

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    drawHeaderFooter(pages[i], i);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
