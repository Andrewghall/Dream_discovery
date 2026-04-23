/**
 * Export all Domain Packs to a formatted PDF.
 * Run with: node scripts/export-domain-packs-pdf.mjs
 */

// ── Inline pack data (avoids TS compilation) ────────────────────────────────
// We import the compiled data by parsing the TS source manually via a small
// eval trick, OR we just hard-code the canonical data here from industry-packs.ts.
// Simplest: spin up ts-node or use the data directly.
// We'll use tsx to run this if available, otherwise we inline the data.

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from '/Users/andrewhall/Dream_discovery/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load pack data via dynamic require of the compiled registry ──────────────
// We'll extract the data by parsing the TS source with a regex approach,
// OR just inline a lightweight data extraction. Best option: use tsx.
// Let's try reading and evaling the resolution module.

// Instead: read industry-packs.ts, strip TS, eval the objects
const packsSource = readFileSync(join(__dirname, '../lib/domain-packs/industry-packs.ts'), 'utf8');

// Extract pack data via a simpler approach - build the HTML directly from parsed source
// Parse out each pack constant

function extractPacks(source) {
  const packs = [];

  // Match each industry constant block
  const packRegex = /export const ([A-Z_]+):\s*DomainPack\s*=\s*\{([\s\S]*?)^\};/gm;

  // Better approach: use JSON-like parsing on the individual fields
  // Let's extract structured data field by field

  const lines = source.split('\n');
  let currentPack = null;
  let inLenses = false;
  let inJourneyStages = false;
  let inActors = false;
  let inVariants = false;
  let inVariantBlock = false;
  let currentVariantKey = null;
  let braceDepth = 0;
  let packBraceStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect pack start: "export const AIRLINE_AVIATION: DomainPack = {"
    const packStart = line.match(/^export const ([A-Z_]+):\s*DomainPack\s*=\s*\{/);
    if (packStart) {
      if (currentPack) packs.push(currentPack);
      currentPack = {
        constName: packStart[1],
        key: '',
        label: '',
        description: '',
        lenses: [],
        journeyStages: [],
        actorTaxonomy: [],
        engagementVariants: {},
      };
      braceDepth = 1;
      inLenses = false;
      inJourneyStages = false;
      inActors = false;
      inVariants = false;
      continue;
    }

    if (!currentPack) continue;

    // Track brace depth
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    // Extract key
    const keyMatch = trimmed.match(/^key:\s*['"]([^'"]+)['"]/);
    if (keyMatch && braceDepth === 1) currentPack.key = keyMatch[1];

    // Extract label
    const labelMatch = trimmed.match(/^label:\s*['"]([^'"]+)['"]/);
    if (labelMatch && braceDepth === 1) currentPack.label = labelMatch[1];

    // Extract description
    const descMatch = trimmed.match(/^description:\s*['"]([^'"]+)['"]/);
    if (descMatch && braceDepth === 1) currentPack.description = descMatch[1];

    // Detect lenses array
    if (trimmed.match(/^lenses:\s*\[/) && braceDepth === 1) {
      inLenses = true;
      inJourneyStages = false;
      inActors = false;
      inVariants = false;
    }

    // Detect journeyStages array
    if (trimmed.match(/^journeyStages:\s*\[/) && braceDepth === 1) {
      inJourneyStages = true;
      inLenses = false;
      inActors = false;
      inVariants = false;
    }

    // Detect actorTaxonomy
    if (trimmed.match(/^actorTaxonomy:\s*\[/) && braceDepth === 1) {
      inActors = true;
      inLenses = false;
      inJourneyStages = false;
      inVariants = false;
    }

    // Detect engagementVariants
    if (trimmed.match(/^engagementVariants:\s*\{/) && braceDepth === 1) {
      inVariants = true;
      inLenses = false;
      inJourneyStages = false;
      inActors = false;
    }

    if (inLenses) {
      const lensMatch = trimmed.match(/^['"](.+)['"]/);
      if (lensMatch) currentPack.lenses.push(lensMatch[1]);
      if (trimmed.includes('],')) { inLenses = false; }
    }

    if (inJourneyStages) {
      const stageLabel = trimmed.match(/label:\s*['"]([^'"]+)['"]/);
      const stageDesc = trimmed.match(/description:\s*['"]([^'"]+)['"]/);
      const stageNum = trimmed.match(/stage:\s*(\d+)/);
      if (stageNum) {
        currentPack.journeyStages.push({ stage: parseInt(stageNum[1]), label: '', description: '' });
      }
      if (stageLabel && currentPack.journeyStages.length > 0) {
        currentPack.journeyStages[currentPack.journeyStages.length - 1].label = stageLabel[1];
      }
      if (stageDesc && currentPack.journeyStages.length > 0) {
        currentPack.journeyStages[currentPack.journeyStages.length - 1].description = stageDesc[1];
      }
      if (trimmed === '],') { inJourneyStages = false; }
    }

    if (inActors) {
      const actorLabel = trimmed.match(/label:\s*['"]([^'"]+)['"]/);
      const actorDesc = trimmed.match(/description:\s*['"]([^'"]+)['"]/);
      const actorKey = trimmed.match(/key:\s*['"]([^'"]+)['"]/);
      if (actorKey) {
        currentPack.actorTaxonomy.push({ key: actorKey[1], label: '', description: '' });
      }
      if (actorLabel && currentPack.actorTaxonomy.length > 0) {
        currentPack.actorTaxonomy[currentPack.actorTaxonomy.length - 1].label = actorLabel[1];
      }
      if (actorDesc && currentPack.actorTaxonomy.length > 0) {
        currentPack.actorTaxonomy[currentPack.actorTaxonomy.length - 1].description = actorDesc[1];
      }
      if (trimmed === '],') { inActors = false; }
    }

    if (inVariants) {
      // Detect variant key like "diagnostic_baseline: {"
      const variantKeyMatch = trimmed.match(/^([a-z_]+):\s*\{/);
      if (variantKeyMatch && braceDepth === 2) {
        currentVariantKey = variantKeyMatch[1];
        currentPack.engagementVariants[currentVariantKey] = { lenses: [], addLenses: [], notes: '' };
      }
      if (currentVariantKey) {
        const notesMatch = trimmed.match(/notes:\s*['"]([^'"]+)['"]/);
        if (notesMatch) currentPack.engagementVariants[currentVariantKey].notes = notesMatch[1];

        const addLensMatch = trimmed.match(/^['"](.+)['"]/);
        // Check if we're inside addLenses array
        if (trimmed.match(/^addLenses:\s*\[/)) {
          currentPack.engagementVariants[currentVariantKey]._inAddLenses = true;
        }
        if (currentPack.engagementVariants[currentVariantKey]._inAddLenses && addLensMatch) {
          currentPack.engagementVariants[currentVariantKey].addLenses.push(addLensMatch[1]);
        }
        if (trimmed === '],') {
          currentPack.engagementVariants[currentVariantKey]._inAddLenses = false;
        }
      }
      // End of variants block
      if (trimmed === '},' && braceDepth === 2) {
        currentVariantKey = null;
      }
      if (trimmed === '},' && braceDepth === 1) {
        inVariants = false;
      }
    }

    braceDepth += openBraces - closeBraces;

    // End of pack
    if (braceDepth <= 0 && currentPack) {
      packs.push(currentPack);
      currentPack = null;
      braceDepth = 0;
    }
  }

  if (currentPack) packs.push(currentPack);
  return packs;
}

const ENGAGEMENT_LABELS = {
  diagnostic_baseline: 'Diagnostic Baseline',
  operational_deep_dive: 'Operational Deep Dive',
  ai_enablement: 'AI Enablement',
  transformation_sprint: 'Transformation Sprint',
  cultural_alignment: 'Cultural Alignment',
  go_to_market: 'Go-to-Market',
};

const LENS_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

function lensColor(i) {
  return LENS_COLORS[i % LENS_COLORS.length];
}

function buildHtml(packs) {
  const packSections = packs.map((pack, packIdx) => {
    const lensesHtml = pack.lenses.map((l, i) =>
      `<span class="lens-badge" style="background:${lensColor(i)}20;color:${lensColor(i)};border:1px solid ${lensColor(i)}40">${l}</span>`
    ).join('');

    const journeyHtml = pack.journeyStages.length > 0
      ? `<div class="journey-grid">${pack.journeyStages.map(s =>
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
          `<div class="actor-item"><span class="actor-label">${a.label}</span><span class="actor-desc">${a.description}</span></div>`
        ).join('')}</div>`
      : '<p class="empty">No actors defined.</p>';

    const variantKeys = Object.keys(pack.engagementVariants || {});
    const variantsHtml = variantKeys.length > 0
      ? `<div class="variants-grid">${variantKeys.map(key => {
          const v = pack.engagementVariants[key];
          const extra = v.addLenses && v.addLenses.length > 0
            ? `<div class="variant-lenses">+ ${v.addLenses.join(', ')}</div>` : '';
          return `<div class="variant-card">
            <div class="variant-name">${ENGAGEMENT_LABELS[key] || key}</div>
            ${extra}
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
          <h2 class="section-title">JOURNEY STAGES (${pack.journeyStages.length})</h2>
          ${journeyHtml}
        </section>

        <section class="section">
          <h2 class="section-title">ACTOR TAXONOMY (${pack.actorTaxonomy.length})</h2>
          ${actorsHtml}
        </section>

        <section class="section">
          <h2 class="section-title">ENGAGEMENT VARIANTS</h2>
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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #fff;
    color: #1a1a2e;
    font-size: 11px;
    line-height: 1.5;
  }

  /* ── Cover page ── */
  .cover {
    width: 100%;
    min-height: 100vh;
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
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #5cf28e;
    margin-bottom: 24px;
  }
  .cover-title {
    font-size: 56px;
    font-weight: 900;
    line-height: 1.1;
    margin-bottom: 16px;
    letter-spacing: -1px;
  }
  .cover-subtitle {
    font-size: 20px;
    font-weight: 300;
    color: #a0a0b0;
    max-width: 600px;
    margin-bottom: 48px;
    line-height: 1.6;
  }
  .cover-meta {
    font-size: 12px;
    color: #5cf28e;
    border-top: 1px solid #333;
    padding-top: 24px;
    width: 100%;
    display: flex;
    gap: 48px;
  }
  .cover-meta-item strong { display: block; font-size: 28px; font-weight: 700; color: #fff; }

  /* ── TOC ── */
  .toc {
    padding: 60px;
    page-break-after: always;
  }
  .toc-title {
    font-size: 28px;
    font-weight: 800;
    margin-bottom: 32px;
    color: #0a0a0f;
    letter-spacing: -0.5px;
  }
  .toc-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .toc-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid #e8e8f0;
    border-radius: 8px;
    background: #f8f8fc;
  }
  .toc-num {
    font-size: 20px;
    font-weight: 900;
    color: #c8c8d8;
    min-width: 36px;
  }
  .toc-label { font-size: 13px; font-weight: 600; }
  .toc-sublabel { font-size: 10px; color: #888; margin-top: 2px; }

  /* ── Pack section ── */
  .pack-section {
    padding: 48px 60px;
    border-bottom: 2px solid #0a0a0f;
  }
  .page-break { page-break-before: always; }

  .pack-header {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 36px;
    padding-bottom: 24px;
    border-bottom: 1px solid #e8e8f0;
  }
  .pack-number {
    font-size: 48px;
    font-weight: 900;
    color: #e8e8f0;
    min-width: 60px;
    line-height: 1;
    margin-top: 4px;
  }
  .pack-title-block { flex: 1; }
  .pack-title {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #0a0a0f;
    margin-bottom: 6px;
  }
  .pack-desc {
    font-size: 12px;
    color: #555;
    line-height: 1.6;
    max-width: 600px;
  }
  .pack-key-badge {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    background: #0a0a0f;
    color: #5cf28e;
    padding: 6px 12px;
    border-radius: 4px;
    white-space: nowrap;
    align-self: flex-start;
    margin-top: 4px;
  }

  /* ── Sections ── */
  .section { margin-bottom: 28px; }
  .section-title {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #f0f0f8;
  }

  /* ── Lenses ── */
  .lenses-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
  .lens-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 20px;
  }

  /* ── Journey stages ── */
  .journey-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .journey-card {
    display: flex;
    gap: 10px;
    padding: 10px 14px;
    background: #f8f8fc;
    border-radius: 6px;
    border: 1px solid #eeeef8;
  }
  .stage-num {
    font-size: 16px;
    font-weight: 900;
    color: #d0d0e0;
    min-width: 20px;
    line-height: 1.2;
  }
  .stage-label { font-size: 11px; font-weight: 600; color: #1a1a2e; }
  .stage-desc { font-size: 10px; color: #666; margin-top: 2px; }

  /* ── Actors ── */
  .actors-list { display: flex; flex-direction: column; gap: 6px; }
  .actor-item { display: flex; gap: 12px; align-items: baseline; }
  .actor-label { font-size: 11px; font-weight: 600; min-width: 220px; color: #1a1a2e; }
  .actor-desc { font-size: 10px; color: #666; }

  /* ── Engagement variants ── */
  .variants-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .variant-card {
    padding: 12px 14px;
    background: #f8f8fc;
    border-radius: 6px;
    border: 1px solid #eeeef8;
  }
  .variant-name { font-size: 11px; font-weight: 700; color: #0a0a0f; margin-bottom: 6px; }
  .variant-lenses { font-size: 10px; color: #3b82f6; font-weight: 500; margin-bottom: 4px; }
  .variant-notes { font-size: 10px; color: #666; line-height: 1.4; }

  .empty { font-size: 11px; color: #aaa; font-style: italic; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- Cover -->
<div class="cover">
  <div class="cover-eyebrow">Ethenta · DREAM Platform</div>
  <h1 class="cover-title">Domain Pack<br>Reference</h1>
  <p class="cover-subtitle">Complete catalogue of all industry-specific domain packs — lenses, journey stages, actor taxonomies, and engagement variants for every market and focus type.</p>
  <div class="cover-meta">
    <div class="cover-meta-item">
      <strong>${packs.length}</strong>
      Industry Packs
    </div>
    <div class="cover-meta-item">
      <strong>6</strong>
      Engagement Variants
    </div>
    <div class="cover-meta-item">
      <strong>${packs.reduce((a, p) => a + p.lenses.length, 0)}</strong>
      Total Lenses
    </div>
    <div class="cover-meta-item">
      <strong>${packs.reduce((a, p) => a + p.journeyStages.length, 0)}</strong>
      Journey Stages
    </div>
  </div>
</div>

<!-- Table of Contents -->
<div class="toc">
  <h2 class="toc-title">Contents</h2>
  <div class="toc-grid">
    ${packs.map((p, i) => `
      <div class="toc-item">
        <div class="toc-num">${String(i + 1).padStart(2, '0')}</div>
        <div>
          <div class="toc-label">${p.label}</div>
          <div class="toc-sublabel">${p.lenses.length} lenses · ${p.journeyStages.length} journey stages · ${p.actorTaxonomy.length} actors</div>
        </div>
      </div>
    `).join('')}
  </div>
</div>

<!-- Pack sections -->
${packSections}

</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('Parsing industry packs...');
const packs = extractPacks(packsSource);
console.log(`Found ${packs.length} packs: ${packs.map(p => p.label || p.constName).join(', ')}`);

const html = buildHtml(packs);
const htmlPath = join(__dirname, '../tmp-domain-packs.html');
writeFileSync(htmlPath, html, 'utf8');
console.log('HTML written, launching browser...');

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });

const outputPath = join(__dirname, '../domain-packs-reference.pdf');
await page.pdf({
  path: outputPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});

await browser.close();

// Clean up temp HTML
import { unlinkSync } from 'fs';
unlinkSync(htmlPath);

console.log(`\n✅ PDF saved to: ${outputPath}`);
