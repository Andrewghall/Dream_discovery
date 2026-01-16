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
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.emulateMedia({ media: 'screen' });
    await page.goto(url.toString(), { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForSelector('#discovery-report', { timeout: 120000 });

    await page.addStyleTag({
      content: `
        .no-print { display: none !important; }
        .print-only { display: none !important; }
        body { background: #fff !important; }
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
