/**
 * Export all Domain Packs to a formatted PDF.
 * Run with: npx tsx scripts/export-domain-packs-pdf.ts
 */

import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import puppeteer from 'puppeteer';
import { INDUSTRY_PACKS } from '../lib/domain-packs/industry-packs';
import type { DomainPack } from '../lib/domain-packs/registry';

const ENGAGEMENT_LABELS: Record<string, string> = {
  diagnostic_baseline: 'Diagnostic Baseline',
  operational_deep_dive: 'Operational Deep Dive',
  ai_enablement: 'AI Enablement',
  transformation_sprint: 'Transformation Sprint',
  cultural_alignment: 'Cultural Alignment',
  go_to_market: 'Go-to-Market',
};

const LENS_COLORS = [
  ['#3b82f6', '#eff6ff'],
  ['#10b981', '#f0fdf4'],
  ['#8b5cf6', '#faf5ff'],
  ['#f59e0b', '#fffbeb'],
  ['#ef4444', '#fef2f2'],
  ['#06b6d4', '#ecfeff'],
  ['#ec4899', '#fdf2f8'],
  ['#84cc16', '#f7fee7'],
  ['#f97316', '#fff7ed'],
  ['#6366f1', '#eef2ff'],
];

function lensColor(i: number) { return LENS_COLORS[i % LENS_COLORS.length]; }

function buildHtml(packs: DomainPack[]): string {
  const totalLenses = packs.reduce((a, p) => a + p.lenses.length, 0);
  const totalStages = packs.reduce((a, p) => a + (p.journeyStages?.length || 0), 0);
  const totalActors = packs.reduce((a, p) => a + p.actorTaxonomy.length, 0);

  const packSections = packs.map((pack, packIdx) => {
    const lensesHtml = pack.lenses.map((l, i) => {
      const [fg, bg] = lensColor(i);
      return `<span class="lens-badge" style="background:${bg};color:${fg};border:1px solid ${fg}30">${l}</span>`;
    }).join('');

    const journeyStages = pack.journeyStages || [];
    const journeyHtml = journeyStages.length > 0
      ? `<div class="journey-grid">${journeyStages.map(s =>
          `<div class="journey-card">
            <div class="stage-num">${s.stage}</div>
            <div class="stage-body">
              <div class="stage-label">${s.label}</div>
              <div class="stage-desc">${s.description}</div>
            </div>
          </div>`
        ).join('')}</div>`
      : '<p class="empty">No journey stages defined.</p>';

    const actorsHtml = pack.actorTaxonomy.length > 0
      ? `<div class="actors-list">${pack.actorTaxonomy.map(a =>
          `<div class="actor-item">
            <span class="actor-label">${a.label}</span>
            <span class="actor-desc">${a.description}</span>
          </div>`
        ).join('')}</div>`
      : '<p class="empty">No actors defined.</p>';

    const variants = pack.engagementVariants || {};
    const variantKeys = Object.keys(variants);
    const variantsHtml = variantKeys.length > 0
      ? `<div class="variants-grid">${variantKeys.map(key => {
          const v = variants[key] as any;
          const addLenses = v.addLenses?.length > 0
            ? `<div class="variant-lenses">+ ${v.addLenses.join(', ')}</div>` : '';
          const overrideLenses = v.lenses?.length > 0
            ? `<div class="variant-lenses override">Uses: ${v.lenses.join(', ')}</div>` : '';
          return `<div class="variant-card">
            <div class="variant-name">${ENGAGEMENT_LABELS[key] || key}</div>
            ${addLenses}${overrideLenses}
            ${v.notes ? `<div class="variant-notes">${v.notes}</div>` : ''}
          </div>`;
        }).join('')}</div>`
      : '<p class="empty">No engagement variants defined.</p>';

    return `
      <div class="pack-section ${packIdx > 0 ? 'page-break' : ''}">
        <div class="pack-header">
          <div class="pack-number">${String(packIdx + 1).padStart(2, '0')}</div>
          <div class="pack-title-block">
            <h1 class="pack-title">${pack.label}</h1>
            <p class="pack-desc">${pack.description}</p>
          </div>
          <div class="pack-key-badge">${pack.key}</div>
        </div>

        <section class="section">
          <h2 class="section-title">LENSES (${pack.lenses.length})</h2>
          <div class="lenses-wrap">${lensesHtml}</div>
        </section>

        <section class="section">
          <h2 class="section-title">JOURNEY STAGES (${journeyStages.length})</h2>
          ${journeyHtml}
        </section>

        <section class="section">
          <h2 class="section-title">ACTOR TAXONOMY (${pack.actorTaxonomy.length})</h2>
          ${actorsHtml}
        </section>

        <section class="section last">
          <h2 class="section-title">ENGAGEMENT VARIANTS (${variantKeys.length})</h2>
          ${variantsHtml}
        </section>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DREAM Domain Packs — Complete Reference</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    background: #fff;
    color: #1a1a2e;
    font-size: 11px;
    line-height: 1.5;
  }

  /* Cover */
  .cover {
    width: 100%;
    height: 100vh;
    background: #0a0a0f;
    color: #fff;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 80px;
    page-break-after: always;
  }
  .cover-eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #5cf28e;
    margin-bottom: 28px;
  }
  .cover-title {
    font-size: 60px;
    font-weight: 900;
    line-height: 1.05;
    margin-bottom: 20px;
    letter-spacing: -2px;
  }
  .cover-subtitle {
    font-size: 18px;
    font-weight: 300;
    color: #a0a0b0;
    max-width: 580px;
    margin-bottom: 56px;
    line-height: 1.7;
  }
  .cover-rule { width: 100%; height: 1px; background: #2a2a3a; margin-bottom: 28px; }
  .cover-meta { display: flex; gap: 60px; }
  .cover-meta-item { }
  .cover-meta-item strong { display: block; font-size: 36px; font-weight: 900; color: #fff; letter-spacing: -1px; }
  .cover-meta-item span { font-size: 11px; color: #5cf28e; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }

  /* TOC */
  .toc {
    padding: 60px;
    page-break-after: always;
    min-height: 100vh;
  }
  .toc-title { font-size: 32px; font-weight: 900; margin-bottom: 8px; letter-spacing: -1px; }
  .toc-sub { font-size: 12px; color: #888; margin-bottom: 32px; }
  .toc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .toc-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    border: 1px solid #eeeef8;
    border-radius: 8px;
    background: #fafafe;
  }
  .toc-num { font-size: 22px; font-weight: 900; color: #dddde8; min-width: 40px; }
  .toc-label { font-size: 13px; font-weight: 700; color: #1a1a2e; }
  .toc-sublabel { font-size: 10px; color: #999; margin-top: 1px; }

  /* Pack sections */
  .pack-section { padding: 44px 60px 32px; }
  .page-break { page-break-before: always; }

  .pack-header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 2px solid #f0f0f8;
  }
  .pack-number { font-size: 52px; font-weight: 900; color: #ebebf5; min-width: 64px; line-height: 1; padding-top: 2px; }
  .pack-title-block { flex: 1; }
  .pack-title { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #0a0a0f; margin-bottom: 6px; }
  .pack-desc { font-size: 12px; color: #666; line-height: 1.6; max-width: 580px; }
  .pack-key-badge {
    font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
    background: #0a0a0f; color: #5cf28e;
    padding: 6px 12px; border-radius: 4px;
    white-space: nowrap; align-self: flex-start; margin-top: 4px;
  }

  /* Sections */
  .section { margin-bottom: 24px; }
  .section.last { margin-bottom: 0; }
  .section-title {
    font-size: 9px; font-weight: 700; letter-spacing: 0.18em;
    text-transform: uppercase; color: #aaa;
    margin-bottom: 10px; padding-bottom: 5px;
    border-bottom: 1px solid #f0f0f8;
  }

  /* Lenses */
  .lenses-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
  .lens-badge { font-size: 11px; font-weight: 600; padding: 5px 13px; border-radius: 20px; }

  /* Journey stages */
  .journey-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; }
  .journey-card {
    display: flex; gap: 10px; padding: 9px 13px;
    background: #fafafe; border-radius: 6px; border: 1px solid #eeeef8;
    align-items: flex-start;
  }
  .stage-num { font-size: 18px; font-weight: 900; color: #dddde8; min-width: 20px; line-height: 1.1; }
  .stage-label { font-size: 11px; font-weight: 700; color: #1a1a2e; }
  .stage-desc { font-size: 10px; color: #777; margin-top: 2px; line-height: 1.4; }

  /* Actors */
  .actors-list { display: flex; flex-direction: column; gap: 5px; }
  .actor-item { display: flex; gap: 12px; align-items: baseline; padding: 4px 0; border-bottom: 1px solid #f5f5fc; }
  .actor-item:last-child { border-bottom: none; }
  .actor-label { font-size: 11px; font-weight: 600; min-width: 200px; color: #1a1a2e; }
  .actor-desc { font-size: 10px; color: #777; }

  /* Variants */
  .variants-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .variant-card {
    padding: 11px 14px; background: #fafafe;
    border-radius: 6px; border: 1px solid #eeeef8;
  }
  .variant-name { font-size: 11px; font-weight: 800; color: #0a0a0f; margin-bottom: 5px; }
  .variant-lenses { font-size: 10px; color: #3b82f6; font-weight: 500; margin-bottom: 4px; line-height: 1.4; }
  .variant-lenses.override { color: #8b5cf6; }
  .variant-notes { font-size: 10px; color: #666; line-height: 1.4; }

  .empty { font-size: 11px; color: #bbb; font-style: italic; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-eyebrow">Ethenta · DREAM Platform</div>
  <h1 class="cover-title">Domain Pack<br>Reference</h1>
  <p class="cover-subtitle">Complete catalogue of all industry-specific domain packs — lenses, journey stages, actor taxonomies, and engagement variants for every market and workshop focus.</p>
  <div class="cover-rule"></div>
  <div class="cover-meta">
    <div class="cover-meta-item"><strong>${packs.length}</strong><span>Industry Packs</span></div>
    <div class="cover-meta-item"><strong>6</strong><span>Engagement Variants</span></div>
    <div class="cover-meta-item"><strong>${totalLenses}</strong><span>Total Lenses</span></div>
    <div class="cover-meta-item"><strong>${totalStages}</strong><span>Journey Stages</span></div>
    <div class="cover-meta-item"><strong>${totalActors}</strong><span>Actor Roles</span></div>
  </div>
</div>

<div class="toc">
  <h2 class="toc-title">Contents</h2>
  <p class="toc-sub">20 industries · each with specific lenses, journey stages, actors, and 6 engagement variants</p>
  <div class="toc-grid">
    ${packs.map((p, i) => `
      <div class="toc-item">
        <div class="toc-num">${String(i + 1).padStart(2, '0')}</div>
        <div>
          <div class="toc-label">${p.label}</div>
          <div class="toc-sublabel">${p.lenses.length} lenses · ${(p.journeyStages || []).length} journey stages · ${p.actorTaxonomy.length} actors</div>
        </div>
      </div>
    `).join('')}
  </div>
</div>

${packSections}

</body>
</html>`;
}

// Main
async function main() {
  const packs = Object.values(INDUSTRY_PACKS);
  console.log(`Found ${packs.length} industry packs`);

  const html = buildHtml(packs);
  const htmlPath = join(__dirname, 'tmp-domain-packs.html');
  writeFileSync(htmlPath, html, 'utf8');

  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });

  const outputPath = join(process.cwd(), 'domain-packs-reference.pdf');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
  });

  await browser.close();
  unlinkSync(htmlPath);

  console.log(`\n✅ PDF saved to: ${outputPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
