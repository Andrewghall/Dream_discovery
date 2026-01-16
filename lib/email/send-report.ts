import { Resend } from 'resend';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type RgbColor = ReturnType<typeof rgb>;

type FontMetrics = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

export async function sendDiscoveryReportEmail(params: {
  to: string;
  participantName: string;
  workshopName: string | null | undefined;
  discoveryUrl: string;
  executiveSummary: string;
  tone: string | null;
  feedback: string;
  inputQuality?: {
    score: number;
    label: 'high' | 'medium' | 'low';
    rationale: string;
  };
  keyInsights?: Array<{
    title: string;
    insight: string;
    confidence: 'high' | 'medium' | 'low';
    evidence: string[];
  }>;
  phaseInsights: Array<{
    phase: string;
    currentScore: number | null;
    targetScore: number | null;
    projectedScore: number | null;
  }>;
}) {
  const {
    to,
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

  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    throw new Error('Email is not configured (missing RESEND_API_KEY or FROM_EMAIL)');
  }

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

  const margin = 48;
  const fontSize = 11;
  const titleSize = 18;
  const sectionTitleSize = 13;
  const cardPad = 14;

  const colors = {
    ink: rgb(0.10, 0.10, 0.18),
    body: rgb(0.22, 0.25, 0.32),
    muted: rgb(0.40, 0.44, 0.50),
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

  const newPage = () => {
    page = pdfDoc.addPage([a4.width, a4.height]);
    const size = page.getSize();
    y = size.height - margin;
    return size;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      newPage();
    }
  };

  const drawHeader = () => {
    const logoTargetH = 22;
    const logoScale = logoTargetH / ethentaLogo.height;
    const logoW = ethentaLogo.width * logoScale;
    ensureSpace(logoTargetH + 10);
    page.drawImage(ethentaLogo, {
      x: margin,
      y: y - logoTargetH,
      width: logoW,
      height: logoTargetH,
    });
    y -= logoTargetH + 10;

    const bannerMaxH = 70;
    const bannerScale = Math.min(contentWidth / dreamBanner.width, bannerMaxH / dreamBanner.height);
    const bannerW = dreamBanner.width * bannerScale;
    const bannerH = dreamBanner.height * bannerScale;
    ensureSpace(bannerH + 14);
    page.drawImage(dreamBanner, {
      x: margin + (contentWidth - bannerW) / 2,
      y: y - bannerH,
      width: bannerW,
      height: bannerH,
    });
    y -= bannerH + 14;
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
      color: colors.card,
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
        ensureSpace(size + lineGap + 6);
        page.drawText(line, { x, y: y - size, size, font, color });
        y -= size + lineGap;
      }
      y -= 6;
    }
  };

  drawHeader();

  ensureSpace(titleSize + 8);
  page.drawText('Discovery Report', { x: margin, y: y - titleSize, size: titleSize, font: bold, color: colors.ink });
  y -= titleSize + 4;
  page.drawText('Interviewee view of the organisation and operating environment', {
    x: margin,
    y: y - fontSize,
    size: fontSize,
    font,
    color: colors.muted,
  });
  y -= fontSize + 14;

  const metaLine = `Workshop: ${safeWorkshopName}  |  Participant: ${participantName}${tone ? `  |  Tone: ${tone}` : ''}`;
  drawWrapped(metaLine, margin, contentWidth, 10, 3, colors.body);

  y = drawCard('Executive Summary', (x, yTop, w) => {
    y = yTop - sectionTitleSize - 10;
    drawWrapped(executiveSummary || '', x, w, fontSize, 4, colors.body);
    return y;
  });

  if (inputQuality) {
    y = drawCard('Input Quality (Evidence Check)', (x, yTop, w) => {
      y = yTop - sectionTitleSize - 10;
      const scoreLine = `Score: ${Math.round(inputQuality.score)}/100 (${inputQuality.label})`;
      drawWrapped(scoreLine, x, w, fontSize, 4, colors.body);
      if (inputQuality.rationale) drawWrapped(inputQuality.rationale, x, w, fontSize, 4, colors.body);
      return y;
    });
  }

  if (Array.isArray(keyInsights) && keyInsights.length > 0) {
    y = drawCard('Key Insights (Evidence-backed)', (x, yTop, w) => {
      y = yTop - sectionTitleSize - 10;

      for (const [idx, k] of keyInsights.slice(0, 6).entries()) {
        const heading = `${idx + 1}. ${k.title} (confidence: ${k.confidence})`;
        drawWrapped(heading, x, w, fontSize, 4, colors.ink);
        drawWrapped(k.insight, x, w, fontSize, 4, colors.body);
        if (Array.isArray(k.evidence) && k.evidence.length > 0) {
          const ev = k.evidence.slice(0, 3).map((q) => `“${q}”`).join('  ');
          drawWrapped(ev, x, w, 10, 3, colors.muted);
        }
        y -= 6;
      }
      return y;
    });
  }

  y = drawCard('Scores by Domain (1–10)', (x, yTop, w) => {
    y = yTop - sectionTitleSize - 12;
    const col1 = x;
    const col2 = x + w * 0.42;
    const col3 = x + w * 0.67;

    page.drawText('Domain', { x: col1, y: y - 10, size: 10, font: bold, color: colors.ink });
    page.drawText('Current', { x: col2, y: y - 10, size: 10, font: bold, color: colors.ink });
    page.drawText('Target', { x: col3, y: y - 10, size: 10, font: bold, color: colors.ink });
    page.drawText('Projected', { x: x + w - 56, y: y - 10, size: 10, font: bold, color: colors.ink });
    y -= 16;

    for (const p of phaseInsights) {
      ensureSpace(18 + cardPad);
      page.drawText(toTitleCase(p.phase), { x: col1, y: y - 10, size: 10, font, color: colors.body });
      page.drawText(scoreText(p.currentScore), { x: col2, y: y - 10, size: 10, font, color: colors.body });
      page.drawText(scoreText(p.targetScore), { x: col3, y: y - 10, size: 10, font, color: colors.body });
      page.drawText(scoreText(p.projectedScore), { x: x + w - 56, y: y - 10, size: 10, font, color: colors.body });
      y -= 16;
    }

    return y;
  });

  y = drawCard('Feedback to the Interviewee', (x, yTop, w) => {
    y = yTop - sectionTitleSize - 10;
    drawWrapped(feedback || '', x, w, fontSize, 4, colors.body);
    y -= 8;
    drawWrapped(`Report link: ${discoveryUrl}`, x, w, 10, 3, colors.muted);
    return y;
  });

  const pdfBytes = await pdfDoc.save();
  const attachmentContent = Buffer.from(pdfBytes);

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <p>Hi ${participantName},</p>
  <p>Thank you for participating in the DREAM Discovery questionnaire. Attached is your summary report (PDF).</p>
  <p>Kind regards,<br/>Ethenta</p>
</body>
</html>
`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to,
    subject: `Your DREAM Discovery Summary — ${safeWorkshopName}`,
    html,
    attachments: [
      {
        filename: 'DREAM-Discovery-Summary-Report.pdf',
        content: attachmentContent,
        contentType: 'application/pdf',
      },
    ],
  });

  const maybeResult: unknown = result;
  if (maybeResult && typeof maybeResult === 'object' && 'error' in maybeResult) {
    const error = (maybeResult as { error?: unknown }).error;
    if (error) {
      const message =
        typeof error === 'string'
          ? error
          : typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message)
            : JSON.stringify(error);
      throw new Error(message);
    }
  }

  return result;
}
