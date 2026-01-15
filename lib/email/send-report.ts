import { Resend } from 'resend';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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

  const margin = 48;
  const fontSize = 11;
  const lineHeight = 15;
  const titleSize = 18;

  const wrapLines = (text: string, maxWidth: number, f: any, size: number) => {
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

  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const contentWidth = width - margin * 2;
  let y = height - margin;

  const newPage = () => {
    page = pdfDoc.addPage();
    const size = page.getSize();
    y = size.height - margin;
    return size;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      newPage();
    }
  };

  const drawHeading = (text: string) => {
    ensureSpace(titleSize + 12);
    page.drawText(text, { x: margin, y: y - titleSize, size: titleSize, font: bold, color: rgb(0.07, 0.09, 0.16) });
    y -= titleSize + 18;
  };

  const drawLabel = (text: string) => {
    ensureSpace(lineHeight + 6);
    page.drawText(text, { x: margin, y: y - fontSize, size: fontSize, font: bold, color: rgb(0.11, 0.11, 0.18) });
    y -= lineHeight;
  };

  const drawParagraph = (text: string) => {
    const paragraphs = (text || '').split(/\n+/);
    for (const p of paragraphs) {
      const lines = wrapLines(p, contentWidth, font, fontSize);
      for (const line of lines) {
        ensureSpace(lineHeight + 2);
        page.drawText(line, { x: margin, y: y - fontSize, size: fontSize, font, color: rgb(0.22, 0.25, 0.32) });
        y -= lineHeight;
      }
      y -= 6;
    }
  };

  drawHeading('DREAM Discovery Summary Report');
  drawParagraph(`Workshop: ${safeWorkshopName}`);
  drawParagraph(`Participant: ${participantName}`);
  if (tone) drawParagraph(`Tone: ${tone}`);

  drawLabel('Executive Summary');
  drawParagraph(executiveSummary || '');

  if (inputQuality) {
    drawLabel('Input Quality (Evidence Check)');
    drawParagraph(`Score: ${Math.round(inputQuality.score)}/100 (${inputQuality.label})`);
    if (inputQuality.rationale) drawParagraph(inputQuality.rationale);
  }

  if (Array.isArray(keyInsights) && keyInsights.length > 0) {
    drawLabel('Key Insights (Evidence-backed)');
    for (const k of keyInsights.slice(0, 6)) {
      drawParagraph(`${k.title} (confidence: ${k.confidence})`);
      drawParagraph(k.insight);
      if (Array.isArray(k.evidence) && k.evidence.length > 0) {
        drawParagraph(`Evidence: ${k.evidence.slice(0, 3).map((q) => `"${q}"`).join(' | ')}`);
      }
      y -= 4;
    }
  }

  drawLabel('Scores by domain');
  for (const p of phaseInsights) {
    ensureSpace(lineHeight * 4 + 10);
    page.drawText(toTitleCase(p.phase), { x: margin, y: y - fontSize, size: fontSize, font: bold, color: rgb(0.11, 0.11, 0.18) });
    y -= lineHeight;
    page.drawText(`Current: ${scoreText(p.currentScore)}`, { x: margin, y: y - fontSize, size: fontSize, font, color: rgb(0.22, 0.25, 0.32) });
    y -= lineHeight;
    page.drawText(`Target: ${scoreText(p.targetScore)}`, { x: margin, y: y - fontSize, size: fontSize, font, color: rgb(0.22, 0.25, 0.32) });
    y -= lineHeight;
    page.drawText(`Projected: ${scoreText(p.projectedScore)}`, { x: margin, y: y - fontSize, size: fontSize, font, color: rgb(0.22, 0.25, 0.32) });
    y -= lineHeight + 6;
  }

  drawLabel('Feedback');
  drawParagraph(feedback || '');

  ensureSpace(lineHeight + 6);
  drawParagraph(`Report link: ${discoveryUrl}`);

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
    from: process.env.FROM_EMAIL as string,
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

  const maybeResult = result as any;
  if (maybeResult?.error) {
    const message =
      typeof maybeResult.error === 'string'
        ? maybeResult.error
        : maybeResult.error?.message || JSON.stringify(maybeResult.error);
    throw new Error(message);
  }

  return result;
}
