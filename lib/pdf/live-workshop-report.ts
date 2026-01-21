import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

type DomainLens = {
  People: string;
  Customer: string;
  Technology: string;
  Regulation: string;
  Organisation: string;
};

type LiveWorkshopReport = {
  title: string;
  subtitle: string;
  phaseLabel: string;
  visionStatement: string;
  executiveSummary: string;
  narrative: string;
  domainLenses: DomainLens;
  constraints: string;
  opportunities: string;
  approach: string;
  evidenceQuotes: string[];
};

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function paragraphBlock(title: string, body: string) {
  if (!body.trim()) return '';
  return `
    <div class="section">
      <div class="section-title">${escapeHtml(title)}</div>
      <div class="section-body">${escapeHtml(body)}</div>
    </div>
  `;
}

function lensBlock(title: string, body: string) {
  if (!body.trim()) return '';
  return `
    <div class="lens">
      <div class="lens-title">${escapeHtml(title)}</div>
      <div class="lens-body">${escapeHtml(body)}</div>
    </div>
  `;
}

export async function generateLiveWorkshopReportPdf(params: LiveWorkshopReport): Promise<Buffer> {
  const quoteList = params.evidenceQuotes
    .filter((q) => q.trim())
    .slice(0, 8)
    .map((q) => `<div class="quote">“${escapeHtml(q)}”</div>`)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #111827; margin: 0; padding: 0; }
          .container { padding: 18px 22px; }
          .title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
          .subtitle { font-size: 12px; color: #6b7280; margin: 0 0 16px; }
          .section { margin: 0 0 18px; }
          .section-title { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
          .section-body { font-size: 12.5px; line-height: 1.5; white-space: pre-wrap; }
          .lens-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
          .lens { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
          .lens-title { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
          .lens-body { font-size: 12px; line-height: 1.45; white-space: pre-wrap; }
          .quotes { margin-top: 8px; }
          .quote { font-size: 11px; color: #374151; border-left: 2px solid #e5e7eb; padding-left: 8px; margin: 6px 0; white-space: pre-wrap; }
          .rule { border-top: 1px solid #e5e7eb; margin: 16px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="title">${escapeHtml(params.title)}</div>
          <div class="subtitle">${escapeHtml(params.subtitle)} · ${escapeHtml(params.phaseLabel)}</div>

          ${paragraphBlock('Vision Statement', params.visionStatement)}
          ${paragraphBlock('Executive Summary', params.executiveSummary)}
          ${paragraphBlock('Narrative Overview', params.narrative)}

          <div class="section">
            <div class="section-title">Domain Lenses</div>
            <div class="lens-grid">
              ${lensBlock('People', params.domainLenses.People)}
              ${lensBlock('Customer', params.domainLenses.Customer)}
              ${lensBlock('Technology', params.domainLenses.Technology)}
              ${lensBlock('Regulation', params.domainLenses.Regulation)}
              ${lensBlock('Organisation', params.domainLenses.Organisation)}
            </div>
          </div>

          ${paragraphBlock('Constraints & Risks', params.constraints)}
          ${paragraphBlock('Opportunities & Ambitions', params.opportunities)}
          ${paragraphBlock('Define Approach', params.approach)}

          ${quoteList ? `
            <div class="section">
              <div class="section-title">Evidence from Live Session</div>
              <div class="quotes">${quoteList}</div>
            </div>
          ` : ''}
        </div>
      </body>
    </html>
  `;

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
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
      headerTemplate: `
        <div style="width:100%; font-size:7pt; font-family:Arial, sans-serif; color:#555; padding:0 24px;">
          <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center;">
            <div style="text-align:left;">${escapeHtml(params.subtitle)}</div>
            <div style="text-align:center; font-weight:600; color:#111;">DREAM LIVE REPORT</div>
            <div></div>
          </div>
        </div>
      `,
      footerTemplate: `
        <div style="width:100%; font-size:7pt; font-family:Arial, sans-serif; color:#555; padding:0 24px;">
          <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center;">
            <div style="text-align:left;">Confidential</div>
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
