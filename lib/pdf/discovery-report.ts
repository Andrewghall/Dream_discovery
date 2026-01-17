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
  url.searchParams.set('pdf', '1');
  url.searchParams.set('pdf_ts', Date.now().toString());

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

    await page.waitForFunction(
      () => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('pdf') !== '1') return false;
        return !document.querySelector('#discovery-report .print-header') && !document.querySelector('#discovery-report .print-footer');
      },
      { timeout: 120000 }
    );

    await page.evaluate(() => {
      document
        .querySelectorAll('#discovery-report .print-header, #discovery-report .print-footer')
        .forEach((el) => el.remove());
    });

    await page.addStyleTag({
      content: `
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        body { background: #fff !important; }
        #discovery-report { max-width: none !important; margin: 0 auto !important; }
        .report-charts-grid { grid-template-columns: 1fr !important; justify-items: center !important; }
        .report-charts-grid > * { width: 100% !important; max-width: 560px !important; }
        .report-charts-grid svg { margin: 0 auto !important; }
        .report-radar-content { align-items: center !important; text-align: center !important; }
        .report-radar-content svg { display: block !important; margin: 0 auto !important; width: 360px !important; height: 360px !important; }
        .report-radar-content .mt-2 { justify-content: center !important; }
        .word-cloud { justify-content: center !important; }
        .report-domain-grid { gap: 24px !important; }
        .report-phase-card { break-before: page !important; page-break-before: always !important; }
        .report-phase-card:first-of-type { break-before: auto !important; page-break-before: auto !important; }
        .report-phase-card, .report-charts-grid > *, .report-themes-card { break-inside: avoid !important; page-break-inside: avoid !important; }
        .print-header, .print-footer { display: none !important; }
        .print-header-row, .print-footer-row { display: grid !important; grid-template-columns: 1fr auto 1fr !important; font-size: 7pt !important; }
        .print-header-title { text-align: center !important; }
        .print-header-spacer, .print-footer-right { justify-self: end !important; }
        .print-page-number::after { content: "Page " counter(page); }
        #discovery-report { padding-top: 40px !important; padding-bottom: 32px !important; }
      `,
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '14mm', bottom: '14mm', left: '10mm', right: '10mm' },
      headerTemplate: `
        <div style="width:100%; font-size:7pt; font-family:Arial, sans-serif; color:#555; padding:0 24px;">
          <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center;">
            <div style="text-align:left;">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div style="text-align:center; font-weight:600; color:#111;">DREAM DISCOVERY</div>
            <div></div>
          </div>
        </div>
      `,
      footerTemplate: `
        <div style="width:100%; font-size:7pt; font-family:Arial, sans-serif; color:#555; padding:0 24px;">
          <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center;">
            <div style="text-align:left;">Copyright 2026 Ethenta</div>
            <div></div>
            <div style="text-align:right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
          </div>
        </div>
      `,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
