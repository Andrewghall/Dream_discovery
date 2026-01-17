import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

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
  const { discoveryUrl } = params;

  const url = new URL(discoveryUrl);
  if (!url.searchParams.has('pdf')) {
    url.searchParams.set('pdf', '1');
  }

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
    await page.goto(url.toString(), { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForSelector('#discovery-report', { timeout: 120000 });

    await page.addStyleTag({
      content: `
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        body { background: #fff !important; }
        #discovery-report { max-width: none !important; margin: 0 auto !important; }
        .report-charts-grid { grid-template-columns: 1fr !important; justify-items: center !important; }
        .report-charts-grid > * { width: 100% !important; max-width: 520px !important; }
        .report-charts-grid svg { margin: 0 auto !important; }
        .word-cloud { justify-content: center !important; }
        .report-domain-grid { gap: 24px !important; }
        .report-phase-card { break-before: page !important; page-break-before: always !important; }
        .report-phase-card:first-of-type { break-before: auto !important; page-break-before: auto !important; }
        .report-phase-card, .report-charts-grid > *, .report-themes-card { break-inside: avoid !important; page-break-inside: avoid !important; }
        .print-header, .print-footer { position: fixed !important; left: 0; right: 0; background: #fff; z-index: 10; }
        .print-header { top: 0; padding: 6px 24px; border-bottom: 1px solid rgba(0,0,0,0.08); }
        .print-footer { bottom: 0; padding: 6px 24px; border-top: 1px solid rgba(0,0,0,0.08); }
        #discovery-report { padding-top: 40px !important; padding-bottom: 32px !important; }
      `,
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
