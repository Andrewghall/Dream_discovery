/**
 * Export Workshop Report as Static HTML Package
 *
 * Generates a complete, self-contained HTML package that can be uploaded
 * to client's domain (e.g., acme-corp.upstreamworks.com)
 *
 * This export is a PIXEL-PERFECT replica of the on-screen scratchpad:
 * - Single-page tabbed layout matching the scratchpad UI
 * - Interactive JavaScript (accordions, theme selection, tab navigation)
 * - Embedded SVG charts (radar chart, word clouds, three houses)
 * - Base64-embedded images (logos, solution images)
 * - No external dependencies — fully self-contained
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/prisma';
import JSZip from 'jszip';
import fs from 'fs/promises';
import path from 'path';

/* ── Tiny helper: HTML-escape user content ── */
function esc(s: any): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Read a local file from public/ as base64 data URI ── */
async function readLocalImageAsBase64(relativePath: string): Promise<string | null> {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const filePath = path.join(publicDir, relativePath);
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    };
    const contentType = mimeMap[ext] || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/* ── Fetch and base64 encode an image (remote URL or local path) ── */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  // Handle relative URLs by reading from local filesystem
  if (url.startsWith('/')) {
    return readLocalImageAsBase64(url);
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      include: {
        scratchpad: true,
        organization: true,
      },
    });

    if (!workshop) {
      return NextResponse.json(
        { error: 'Workshop not found' },
        { status: 404 }
      );
    }

    if (!workshop.scratchpad) {
      return NextResponse.json(
        { error: 'No scratchpad found for this workshop. Please prepare scratchpad first.' },
        { status: 400 }
      );
    }

    const htmlPackage = await generateStaticHTMLPackage(workshop);

    const zip = new JSZip();
    Object.entries(htmlPackage.files).forEach(([filename, content]) => {
      zip.file(filename, content);
    });

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    const slug = workshop.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `${slug}-report.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('HTML export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate HTML export' },
      { status: 500 }
    );
  }
}

/* ================================================================
   GENERATE STATIC HTML PACKAGE
   ================================================================ */

async function generateStaticHTMLPackage(workshop: any) {
  const sp = workshop.scratchpad;
  const organization = workshop.organization;

  const execSummary = sp.execSummary || {};
  const discoveryOutput = sp.discoveryOutput || {};
  const reimagineContent = sp.reimagineContent || {};
  const constraintsContent = sp.constraintsContent || {};
  const commercialContent = sp.commercialContent || {};
  const summaryContent = sp.summaryContent || {};
  const potentialSolution = sp.potentialSolution || {};
  const customerJourney = sp.customerJourney || {};

  const orgName = organization.name;
  const primaryColor = organization.primaryColor || '#1E40AF';
  const secondaryColor = organization.secondaryColor || '#3B82F6';
  const logoUrl = sp.clientLogoUrl || organization.logoUrl || '';
  const solutionImageUrl = sp.solutionImageUrl || '';

  // Fetch images and embed as base64
  const [logoBase64, solutionBase64, houseOldB64, houseRefreshedB64, houseIdealB64] = await Promise.all([
    fetchImageAsBase64(logoUrl),
    fetchImageAsBase64(solutionImageUrl),
    readLocalImageAsBase64('PAMWellness/house-old.png'),
    readLocalImageAsBase64('PAMWellness/house-refreshed.png'),
    readLocalImageAsBase64('PAMWellness/house-ideal.png'),
  ]);
  const houseImages = { old: houseOldB64, refreshed: houseRefreshedB64, ideal: houseIdealB64 };

  const files: Record<string, string> = {};

  // Build tab content
  const tabsHTML = [
    { id: 'exec-summary', label: 'Exec Summary', content: renderExecutiveSummary(execSummary) },
    { id: 'discovery', label: 'Discovery', content: renderDiscoveryOutput(discoveryOutput) },
    { id: 'reimagine', label: 'Reimagine', content: renderReimag(reimagineContent, customerJourney, houseImages) },
    { id: 'constraints', label: 'Constraints', content: renderConstraints(constraintsContent) },
    { id: 'solution', label: 'Solution', content: renderPotentialSolution(potentialSolution, solutionBase64) },
    { id: 'commercial', label: 'Commercial', content: renderCommercial(commercialContent) },
    { id: 'customer-journey', label: 'Journey Map', content: renderCustomerJourney(customerJourney) },
    { id: 'summary', label: 'Summary', content: renderSummary(summaryContent) },
  ];

  const tabButtons = tabsHTML.map((t, i) =>
    `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${t.id}" onclick="switchTab('${t.id}')">${esc(t.label)}</button>`
  ).join('\n          ');

  const tabPanels = tabsHTML.map((t, i) =>
    `<div id="tab-${t.id}" class="tab-panel${i === 0 ? ' active' : ''}">${t.content}</div>`
  ).join('\n      ');

  files['index.html'] = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(workshop.name)} - Workshop Report</title>
  <style>${generateCSS(primaryColor, secondaryColor)}</style>
</head>
<body>
  <header class="report-header">
    <div class="header-inner">
      ${logoBase64 ? `<img src="${logoBase64}" alt="${esc(orgName)}" class="org-logo">` : `<h1 class="org-name">${esc(orgName)}</h1>`}
      <div class="header-text">
        <h2>${esc(workshop.name)}</h2>
        <p class="header-date">Workshop Report &middot; ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
  </header>

  <nav class="tab-nav">
    <div class="tab-nav-inner">
      ${tabButtons}
    </div>
  </nav>

  <main class="report-main">
    ${tabPanels}
  </main>

  <footer class="report-footer">
    <p>&copy; ${new Date().getFullYear()} ${esc(orgName)}. All rights reserved.</p>
  </footer>

  <script>${generateJS()}</script>
</body>
</html>`;

  // README
  files['README.txt'] = `${workshop.name} - Workshop Report
===============================================

This package contains a complete, self-contained workshop report.

DEPLOYMENT:
-----------
1. Extract this ZIP file
2. Upload the index.html file to your web server
3. Navigate to index.html — that's it!

FEATURES:
---------
- Single self-contained HTML file
- No external dependencies — works offline
- Interactive tabs, accordions, and theme exploration
- All images embedded — no broken links
- Mobile responsive
- Fully white-labeled

Generated: ${new Date().toISOString()}
Workshop: ${workshop.name}
Organization: ${orgName}
`;

  return { files };
}

/* ================================================================
   JAVASCRIPT (Interactive features)
   ================================================================ */

function generateJS(): string {
  return `
// Tab switching
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="' + tabId + '"]').classList.add('active');
  document.getElementById('tab-' + tabId).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Accordion toggle
function toggleAccordion(el) {
  var content = el.nextElementSibling;
  var icon = el.querySelector('.accordion-icon');
  var isOpen = content.classList.contains('open');
  content.classList.toggle('open');
  if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
}

// Theme selection (Reimagine tab)
function selectTheme(type, idx) {
  var container = document.getElementById(type + '-themes-container');
  var panel = document.getElementById(type + '-detail-panel');
  if (!container || !panel) return;
  var cards = container.querySelectorAll('.theme-card');
  var details = panel.querySelectorAll('.theme-detail');
  var defaultPanel = panel.querySelector('.theme-default');

  var clickedCard = cards[idx];
  var wasActive = clickedCard.classList.contains('selected');

  cards.forEach(function(c) { c.classList.remove('selected'); });
  details.forEach(function(d) { d.style.display = 'none'; });

  if (wasActive) {
    if (defaultPanel) defaultPanel.style.display = 'block';
  } else {
    clickedCard.classList.add('selected');
    if (defaultPanel) defaultPanel.style.display = 'none';
    if (details[idx]) details[idx].style.display = 'block';
  }
}
`;
}

/* ================================================================
   CSS
   ================================================================ */

function generateCSS(primaryColor: string, secondaryColor: string): string {
  return `
/* ── Reset & Base ── */
:root {
  --primary: ${primaryColor};
  --secondary: ${secondaryColor};
  --beige: #f8f4ec;
  --accent-teal: #0d9488;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6; color: #333; background: #f5f5f5;
}

/* ── Header ── */
.report-header {
  background: white; border-bottom: 3px solid var(--primary);
  padding: 1.5rem 2rem;
}
.header-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; align-items: center; gap: 1.5rem;
}
.org-logo { max-height: 48px; width: auto; }
.org-name { font-size: 1.5rem; color: var(--primary); font-weight: 700; }
.header-text h2 { font-size: 1.25rem; color: var(--primary); font-weight: 600; }
.header-date { font-size: 0.8rem; color: #6b7280; }

/* ── Tab Navigation ── */
.tab-nav {
  background: white; border-bottom: 1px solid #e5e7eb;
  position: sticky; top: 0; z-index: 50;
}
.tab-nav-inner {
  max-width: 1200px; margin: 0 auto; padding: 0 1rem;
  display: flex; overflow-x: auto; gap: 0;
}
.tab-btn {
  padding: 0.75rem 1.25rem; border: none; background: none;
  font-size: 0.85rem; font-weight: 500; color: #6b7280;
  cursor: pointer; white-space: nowrap; border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab-btn:hover { color: var(--primary); background: #f9fafb; }
.tab-btn.active {
  color: var(--primary); border-bottom-color: var(--primary);
  font-weight: 600;
}

/* ── Main & Tab Panels ── */
.report-main { max-width: 1200px; margin: 0 auto; padding: 2rem 1rem; }
.tab-panel { display: none; }
.tab-panel.active { display: block; animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* ── Footer ── */
.report-footer {
  background: #1f2937; color: #d1d5db; text-align: center;
  padding: 1.5rem; margin-top: 3rem; font-size: 0.85rem;
}

/* ── Section Cards ── */
.section-card {
  background: white; padding: 2rem; margin-bottom: 1.5rem;
  border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  border: 1px solid #e5e7eb;
}
.section-card h2 {
  color: var(--primary); margin-bottom: 1rem; font-size: 1.3rem;
  padding-bottom: 0.5rem; border-bottom: 2px solid #e5e7eb;
}

/* ── Metrics Grid ── */
.metrics-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem; margin-bottom: 1.5rem;
}
.metric-card {
  border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.25rem;
  text-align: center; background: white;
}
.metric-icon { font-size: 1.5rem; margin-bottom: 0.5rem; display: block; }
.metric-value { font-size: 2rem; font-weight: 700; line-height: 1.2; }
.metric-label { font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem; }
.metric-card.blue { border-color: #bfdbfe; background: #eff6ff; }
.metric-card.blue .metric-value { color: #2563eb; }
.metric-card.green { border-color: #bbf7d0; background: #f0fdf4; }
.metric-card.green .metric-value { color: #16a34a; }
.metric-card.orange { border-color: #fed7aa; background: #fff7ed; }
.metric-card.orange .metric-value { color: #ea580c; }
.metric-card.purple { border-color: #e9d5ff; background: #faf5ff; }
.metric-card.purple .metric-value { color: #9333ea; }
.metric-card.indigo { border-color: #c7d2fe; background: #eef2ff; }
.metric-card.indigo .metric-value { color: #4f46e5; }

/* ── Badges ── */
.badge {
  display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px;
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
}
.badge-critical { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
.badge-high { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
.badge-medium { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
.badge-low { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
.badge-transformational { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }

/* ── Accordion ── */
.accordion-trigger {
  width: 100%; background: none; border: none; cursor: pointer;
  display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem;
  font-weight: 600; color: #111827; font-size: 1rem; text-align: left;
}
.accordion-trigger:hover { background: #f9fafb; }
.accordion-icon {
  font-size: 0.7rem; color: #6b7280; transition: transform 0.2s;
  flex-shrink: 0;
}
.accordion-content {
  max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease;
  padding: 0 1.25rem;
}
.accordion-content.open {
  max-height: 5000px; padding: 0 1.25rem 1.25rem;
}
.accordion-item {
  border: 2px solid #e5e7eb; border-radius: 12px; margin-bottom: 0.75rem;
  background: white; overflow: hidden;
}

/* ── Exec Summary Hero ── */
.exec-hero {
  background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
  color: white; padding: 3rem; border-radius: 16px; margin-bottom: 2rem;
}
.exec-hero p { opacity: 0.9; font-size: 1.05rem; max-width: 800px; line-height: 1.7; }

/* ── Key Findings ── */
.finding-card {
  border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.25rem;
  margin-bottom: 0.75rem; background: white;
}
.finding-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.5rem;
}
.finding-title { font-weight: 700; font-size: 1rem; }

/* ── Discovery ── */
.domain-card {
  border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.5rem;
  margin-bottom: 1.5rem; background: white;
}
.domain-header {
  display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;
}
.domain-icon { font-size: 1.8rem; }
.domain-title { font-size: 1.2rem; font-weight: 700; color: var(--primary); }

.consensus-bar-wrap { margin: 0.75rem 0; }
.consensus-bar { height: 8px; border-radius: 4px; background: #e5e7eb; overflow: hidden; }
.consensus-fill { height: 100%; border-radius: 4px; }
.consensus-label { font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem; }

.themes-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.75rem 0; }
.theme-tag {
  background: #eef2ff; color: #4338ca; padding: 0.25rem 0.75rem;
  border-radius: 9999px; font-size: 0.8rem; font-weight: 500;
}

blockquote {
  border-left: 4px solid var(--secondary); padding: 0.75rem 1rem;
  margin: 0.75rem 0; background: #f9fafb; border-radius: 0 8px 8px 0;
  font-style: italic;
}
blockquote cite { display: block; font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem; font-style: normal; }

.sentiment-bar-wrap { margin: 1rem 0; }
.sentiment-bar {
  display: flex; height: 24px; border-radius: 12px; overflow: hidden;
}
.sentiment-segment {
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 600; color: white;
}
.sentiment-optimistic { background: #22c55e; }
.sentiment-neutral { background: #a3a3a3; }
.sentiment-concerned { background: #ef4444; }
.sentiment-legend {
  display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.8rem; color: #6b7280;
}
.sentiment-dot {
  display: inline-block; width: 10px; height: 10px; border-radius: 50%;
  margin-right: 4px; vertical-align: middle;
}

/* ── Word Cloud ── */
.word-cloud-container {
  display: flex; flex-wrap: wrap; gap: 12px 16px;
  align-items: center; justify-content: center;
  min-height: 80px; padding: 1rem;
}
.word-cloud-container.combined {
  min-height: 120px; padding: 1.5rem;
  background: linear-gradient(135deg, #f8fafc, #ede9fe);
  border-radius: 12px;
}

/* ── Reimagine ── */
.beige-page { background: var(--beige); border-radius: 16px; padding: 3rem 2rem; margin: -1rem; }
.reimagine-title-card {
  background: white; border-radius: 24px; padding: 4rem; margin-bottom: 3rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.reimagine-title-card .tag {
  display: inline-block; padding: 0.4rem 1rem; border-radius: 9999px;
  border: 1px solid rgba(0,0,0,0.1); font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.25em; color: rgba(0,0,0,0.4); margin-bottom: 2rem; font-weight: 500;
}
.reimagine-title-card h1 {
  font-family: Georgia, 'Times New Roman', serif; font-size: 3.5rem;
  font-weight: 600; margin-bottom: 2rem; line-height: 1.1; color: #111827;
}
.reimagine-title-card .desc {
  font-size: 1.1rem; color: #374151; line-height: 1.7; max-width: 900px;
}
.reimagine-title-card .note {
  font-size: 0.85rem; color: #6b7280; font-style: italic; margin-top: 1.5rem;
}

/* Three Houses */
.three-houses {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem;
  margin-bottom: 3rem;
}
.house-card {
  border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.house-img {
  height: 192px; display: flex; align-items: center; justify-content: center;
}
.house-card .house-body { padding: 1.5rem; }
.house-card .house-body h3 { font-weight: 700; font-size: 1.1rem; color: #111827; margin-bottom: 0.5rem; }
.house-card .house-body p { font-size: 0.85rem; color: #374151; line-height: 1.6; }
.house-red { background: #fef2f2; border: 2px solid #fecaca; }
.house-red .house-img { background: #fee2e2; }
.house-orange { background: #fff7ed; border: 2px solid #fed7aa; }
.house-orange .house-img { background: #ffedd5; }
.house-green { background: #f0fdf4; border: 2px solid #bbf7d0; }
.house-green .house-img { background: #dcfce7; }

/* Green accent boxes */
.accent-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 3rem; }
.accent-box {
  background: linear-gradient(135deg, #ccfbf1, #d1fae5);
  border-radius: 16px; padding: 2.5rem; border: 2px solid #99f6e4;
}
.accent-box h3 { font-weight: 700; font-size: 1.5rem; margin-bottom: 1rem; color: #111827; }
.accent-box .desc { font-size: 0.85rem; color: #1f2937; margin-bottom: 1.5rem; line-height: 1.6; font-weight: 500; }
.accent-box ul { list-style: none; padding: 0; }
.accent-box li { padding: 0.3rem 0; font-size: 0.85rem; color: #111827; font-weight: 500; }
.accent-box li::before { content: '\\2022'; color: #0f766e; font-weight: 700; font-size: 1.2rem; margin-right: 0.75rem; }

/* Theme cards + detail panel */
.themes-section { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; margin-bottom: 3rem; }
.theme-list { background: white; border-radius: 16px; padding: 2.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.theme-list h3 { font-weight: 700; font-size: 1.75rem; margin-bottom: 2rem; color: #111827; }
.theme-card {
  padding: 1.5rem; border-left: 6px solid; border-radius: 8px;
  margin-bottom: 1.25rem; cursor: pointer; transition: all 0.2s;
  background: #f9fafb;
}
.theme-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.theme-card .theme-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.theme-card .theme-info { display: flex; align-items: flex-start; gap: 1rem; flex: 1; }
.theme-number {
  width: 40px; height: 40px; border-radius: 50%; color: white;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.9rem; flex-shrink: 0;
}
.theme-card .name { font-weight: 600; font-size: 1.05rem; color: #111827; display: block; margin-bottom: 0.35rem; }
.theme-card .weighting { font-size: 0.75rem; color: #6b7280; font-style: italic; }
.theme-badge-pill {
  padding: 0.4rem 1rem; border-radius: 9999px; font-size: 0.7rem;
  font-weight: 700; color: white; text-transform: uppercase;
  letter-spacing: 0.05em; flex-shrink: 0;
}

/* Primary themes: orange */
.theme-card.primary { border-color: #c2410c; }
.theme-card.primary.selected { background: #fff7ed; box-shadow: 0 0 0 2px #fdba74, 0 4px 12px rgba(0,0,0,0.1); }
.theme-card.primary .theme-number { background: #c2410c; }
.theme-card.primary.selected .theme-number { background: #9a3412; transform: scale(1.1); }
.theme-card.primary .theme-badge-pill { background: #c2410c; }

/* Supporting themes: sky blue */
.theme-card.supporting { border-color: #0ea5e9; }
.theme-card.supporting.selected { background: #f0f9ff; box-shadow: 0 0 0 2px #7dd3fc, 0 4px 12px rgba(0,0,0,0.1); }
.theme-card.supporting .theme-number { background: #0ea5e9; }
.theme-card.supporting.selected .theme-number { background: #0284c7; transform: scale(1.1); }
.theme-card.supporting .theme-badge-pill { background: #0ea5e9; }

/* Detail panel */
.detail-panel {
  position: sticky; top: 80px; align-self: start;
}
.detail-card {
  background: white; border-radius: 16px; overflow: hidden;
  border: 2px solid #fcd34d; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.detail-card.supporting-detail { border-color: #7dd3fc; }
.detail-card .detail-header {
  padding: 2rem; background: linear-gradient(135deg, #fef3c7, #fed7aa);
}
.detail-card.supporting-detail .detail-header {
  background: linear-gradient(135deg, #e0f2fe, #bae6fd);
}
.detail-card .detail-header .top-row {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;
}
.detail-card .detail-header .top-row .left {
  display: flex; align-items: center; gap: 0.75rem;
}
.detail-card .detail-header h4 { font-weight: 700; font-size: 1.4rem; color: #111827; line-height: 1.3; }
.detail-card .detail-body { padding: 2rem; }
.detail-card .detail-body .desc { font-size: 0.85rem; color: #1f2937; line-height: 1.7; margin-bottom: 1.25rem; font-weight: 500; }
.detail-card .detail-body ul { list-style: none; padding: 0; }
.detail-card .detail-body li { padding: 0.4rem 0; font-size: 0.85rem; color: #374151; font-weight: 500; }
.detail-card .detail-body li::before { content: '\\2022'; color: #6b7280; font-weight: 500; margin-right: 0.75rem; }

/* Horizon vision */
.horizon-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem; margin-top: 1.5rem;
}
.horizon-col {
  background: white; border-radius: 16px; padding: 2rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.horizon-col h4 {
  color: var(--primary); margin-bottom: 1rem; padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--secondary); font-weight: 700;
}
.horizon-col ul { list-style: none; padding: 0; }
.horizon-col li { padding: 0.35rem 0; font-size: 0.9rem; }
.horizon-col li::before { content: '\\2022'; color: var(--primary); margin-right: 0.5rem; }

/* ── Constraints ── */
.constraint-category { margin-bottom: 2rem; }
.constraint-category-header {
  display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;
  padding-bottom: 0.5rem; border-bottom: 2px solid #e5e7eb;
}
.constraint-category-icon { font-size: 1.5rem; }
.constraint-card {
  border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.25rem;
  margin-bottom: 0.75rem; background: white;
}
.constraint-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.5rem;
}
.constraint-title { font-weight: 700; }
.mitigation-box {
  border-left: 4px solid; padding: 0.75rem; border-radius: 0 8px 8px 0;
  margin-top: 0.75rem; font-size: 0.9rem;
}
.mitigation-box strong { display: block; margin-bottom: 0.25rem; }
.mit-regulatory { background: #f0fdf4; border-color: #22c55e; }
.mit-regulatory strong { color: #166534; }
.mit-technical { background: #faf5ff; border-color: #a855f7; }
.mit-technical strong { color: #6b21a8; }
.mit-commercial { background: #f0fdf4; border-color: #22c55e; }
.mit-commercial strong { color: #166534; }
.mit-organizational { background: #fff7ed; border-color: #f97316; }
.mit-organizational strong { color: #9a3412; }

.cat-blue .accordion-item { border-color: #bfdbfe; background: #eff6ff; }
.cat-purple .accordion-item { border-color: #e9d5ff; background: #faf5ff; }
.cat-green .accordion-item { border-color: #bbf7d0; background: #f0fdf4; }
.cat-orange .accordion-item { border-color: #fed7aa; background: #fff7ed; }

/* ── Solution ── */
.solution-page { background: var(--beige); border-radius: 16px; padding: 3rem 2rem; margin: -1rem; }
.solution-title-card {
  background: white; border-radius: 24px; padding: 4rem; margin-bottom: 3rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.solution-title-card .tag {
  display: inline-block; padding: 0.4rem 1rem; border-radius: 9999px;
  border: 1px solid rgba(0,0,0,0.1); font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.25em; color: rgba(0,0,0,0.4); margin-bottom: 2rem; font-weight: 500;
}
.solution-title-card h1 {
  font-family: Georgia, 'Times New Roman', serif; font-size: 3.5rem;
  font-weight: 600; margin-bottom: 2rem; line-height: 1.1; color: #111827;
}
.solution-title-card .desc { font-size: 1.1rem; color: #374151; line-height: 1.7; max-width: 900px; }

.enabler-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
.enabler-card {
  background: white; border-radius: 16px; padding: 2rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.05);
}
.enabler-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
.enabler-title { font-weight: 600; font-size: 1.1rem; color: #111827; }
.enabler-domain { font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem; }
.priority-badge {
  padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.65rem;
  font-weight: 700; text-transform: uppercase; border: 1px solid;
}
.priority-high { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
.priority-medium { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
.priority-low { background: #dcfce7; color: #166534; border-color: #86efac; }

.deps-list { margin-top: 0.75rem; }
.deps-list span {
  display: inline-block; background: #f3f4f6; padding: 0.15rem 0.5rem;
  border-radius: 4px; font-size: 0.8rem; margin: 0.15rem 0.25rem 0.15rem 0;
  color: #374151;
}

.roadmap-phase {
  border-left: 4px solid var(--primary); padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem; background: white; border-radius: 0 16px 16px 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.roadmap-phase h4 { color: var(--primary); margin-bottom: 0.25rem; font-weight: 700; }
.roadmap-phase .phase-timeframe { font-size: 0.85rem; color: #6b7280; margin-bottom: 0.75rem; }
.roadmap-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 0.75rem; }
.roadmap-col h5 { font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem; color: #374151; }
.roadmap-col ul { list-style: disc; margin-left: 1.25rem; }
.roadmap-col li { margin-bottom: 0.3rem; font-size: 0.85rem; }

/* ── Commercial ── */
.phase-timeline { border-left: 4px solid var(--secondary); padding-left: 1.5rem; margin: 1.5rem 0; }
.phase-item { margin-bottom: 2rem; position: relative; }
.phase-item::before {
  content: ''; position: absolute; left: -1.85rem; top: 0.35rem;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--secondary); border: 3px solid white;
}
.phase-item h4 { color: var(--primary); margin-bottom: 0.15rem; font-weight: 700; }
.phase-meta { font-size: 0.85rem; color: #6b7280; margin-bottom: 0.75rem; }
.outcomes-box {
  background: #f0fdf4; border-left: 4px solid #22c55e; padding: 0.75rem;
  border-radius: 0 8px 8px 0; margin-top: 0.75rem;
}
.outcomes-box p { color: #166534; font-weight: 600; margin-bottom: 0.25rem; }
.outcomes-box li { color: #166534; font-size: 0.85rem; }

.risk-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
.risk-table th {
  background: var(--primary); color: white; padding: 0.75rem 1rem;
  text-align: left; font-size: 0.85rem;
}
.risk-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; }
.risk-table tr:nth-child(even) { background: #f9fafb; }

/* ── Journey Map ── */
.journey-stats {
  background: white; border-radius: 16px; padding: 1.5rem 2rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 1.5rem;
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem;
}
.journey-stat { text-align: center; }
.journey-stat .val { font-size: 1.5rem; font-weight: 700; color: #111827; }
.journey-stat .lbl { font-size: 0.6rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em; }
.journey-stat.red .val { color: #dc2626; }
.journey-stat.amber .val { color: #d97706; }

.journey-grid-wrap {
  background: white; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  overflow-x: auto; border: 1px solid rgba(0,0,0,0.05);
}
.journey-grid { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.journey-grid th {
  background: #f8fafc; padding: 0.75rem; border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #f1f5f9; font-size: 0.65rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em; color: #111827;
  text-align: center;
}
.journey-grid th:first-child { text-align: left; background: #f8fafc; min-width: 140px; }
.journey-grid td {
  padding: 0.35rem; border-bottom: 1px solid #f1f5f9;
  border-right: 1px solid #f1f5f9; vertical-align: top; min-height: 48px;
}
.journey-grid td:first-child { background: #f8fafc; padding: 0.75rem; }
.actor-name { font-size: 0.75rem; font-weight: 600; color: #111827; }
.actor-role { font-size: 0.6rem; color: #9ca3af; }
.interaction-chip {
  position: relative; padding: 0.35rem 0.5rem; border-radius: 6px;
  margin-bottom: 0.25rem; border: 1px solid;
}
.interaction-chip .action { font-size: 0.55rem; font-weight: 500; line-height: 1.3; }
.chip-positive { background: #ecfdf5; border-color: #a7f3d0; }
.chip-positive .action { color: #047857; }
.chip-neutral { background: #f8fafc; border-color: #e2e8f0; }
.chip-neutral .action { color: #475569; }
.chip-concerned { background: #fffbeb; border-color: #fde68a; }
.chip-concerned .action { color: #b45309; }
.chip-critical { background: #fef2f2; border-color: #fecaca; }
.chip-critical .action { color: #b91c1c; }
.pain-marker { font-size: 0.5rem; position: absolute; top: -4px; left: -4px; }
.mot-marker { font-size: 0.5rem; position: absolute; top: -4px; right: -4px; }

.journey-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem; }
.journey-summary-card { background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.journey-summary-card .label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 500; margin-bottom: 0.75rem; }
.journey-summary-card p { font-size: 0.85rem; color: #374151; line-height: 1.6; }

/* ── Summary ── */
.summary-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
.summary-table th {
  background: var(--primary); color: white; padding: 0.75rem 1rem;
  text-align: left; font-size: 0.85rem;
}
.summary-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; }
.summary-table tr:nth-child(even) { background: #f9fafb; }
.findings-category { margin-bottom: 1.5rem; }
.findings-category h3 {
  font-size: 1.1rem; color: var(--primary); margin-bottom: 0.5rem;
  padding-bottom: 0.25rem; border-bottom: 2px solid var(--secondary);
}
.findings-category ul { margin-left: 1.5rem; }
.findings-category li { margin-bottom: 0.35rem; }

/* ── Solution Image ── */
.solution-image-wrap {
  background: white; border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.solution-image-wrap img { width: 100%; max-height: 400px; object-fit: contain; border-radius: 8px; }

/* ── Responsive ── */
@media (max-width: 768px) {
  .three-houses { grid-template-columns: 1fr; }
  .themes-section { grid-template-columns: 1fr; }
  .accent-grid { grid-template-columns: 1fr; }
  .enabler-grid { grid-template-columns: 1fr; }
  .roadmap-actions { grid-template-columns: 1fr; }
  .journey-summary-grid { grid-template-columns: 1fr; }
  .reimagine-title-card h1, .solution-title-card h1 { font-size: 2.25rem; }
}

@media print {
  .tab-nav { display: none; }
  .tab-panel { display: block !important; page-break-before: always; }
  .tab-panel:first-child { page-break-before: avoid; }
  .report-main { max-width: 100%; }
  .beige-page, .solution-page { background: white; }
}
`;
}

/* ================================================================
   1. EXECUTIVE SUMMARY
   ================================================================ */

function renderExecutiveSummary(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="section-card"><p>No executive summary available.</p></div>';
  }

  let html = '';

  // Hero
  if (data.overview) {
    html += `<div class="exec-hero">
      <h2 style="font-size:1.8rem;margin-bottom:1rem">Executive Summary</h2>
      <p>${esc(data.overview)}</p>
    </div>`;
  }

  // Metrics
  if (data.metrics) {
    const m = data.metrics;
    html += `<div class="metrics-grid">
      <div class="metric-card blue">
        <span class="metric-icon">&#128101;</span>
        <div class="metric-value">${esc(m.participantsEngaged ?? '-')}</div>
        <div class="metric-label">Participants Engaged</div>
      </div>
      <div class="metric-card green">
        <span class="metric-icon">&#128269;</span>
        <div class="metric-value">${esc(m.domainsExplored ?? '-')}</div>
        <div class="metric-label">Domains Explored</div>
      </div>
      <div class="metric-card orange">
        <span class="metric-icon">&#128161;</span>
        <div class="metric-value">${esc(m.insightsGenerated ?? '-')}</div>
        <div class="metric-label">Insights Generated</div>
      </div>
      <div class="metric-card purple">
        <span class="metric-icon">&#127775;</span>
        <div class="metric-value">${esc(m.transformationalIdeas ?? '-')}</div>
        <div class="metric-label">Transformational Ideas</div>
      </div>
    </div>`;
  }

  // Key Findings
  if (data.keyFindings && Array.isArray(data.keyFindings) && data.keyFindings.length > 0) {
    html += `<div class="section-card"><h2>Key Findings</h2>`;
    for (const f of data.keyFindings) {
      const badgeClass = (f.impact || '').toLowerCase() === 'critical' ? 'badge-critical'
        : (f.impact || '').toLowerCase() === 'transformational' ? 'badge-transformational'
        : 'badge-high';
      html += `<div class="finding-card">
        <div class="finding-header">
          <span class="finding-title">${esc(f.title)}</span>
          <span class="badge ${badgeClass}">${esc(f.impact)}</span>
        </div>
        <p style="font-size:0.9rem;color:#374151">${esc(f.description)}</p>
      </div>`;
    }
    html += `</div>`;
  }

  // Legacy fields
  if (data.vision) {
    html += `<div class="section-card"><h2>Vision Statement</h2><p>${esc(data.vision)}</p></div>`;
  }
  if (data.strategicShifts) {
    html += `<div class="section-card"><h2>Strategic Shifts</h2><p>${esc(data.strategicShifts)}</p></div>`;
  }
  if (data.todaysChallenge) {
    html += `<div class="section-card"><h2>Today's Challenge</h2><p>${esc(data.todaysChallenge)}</p></div>`;
  }
  if (data.futureStatePrinciples) {
    html += `<div class="section-card"><h2>Future State Principles</h2><p>${esc(data.futureStatePrinciples)}</p></div>`;
  }

  return html || '<div class="section-card"><p>No executive summary data available.</p></div>';
}

/* ================================================================
   2. DISCOVERY OUTPUT
   ================================================================ */

function renderRadarChartSVG(sections: any[]): string {
  const size = 400;
  const cx = size / 2;
  const cy = size / 2;
  const padding = 80;
  const radius = (size - padding * 2) / 2;
  const n = sections.length;
  if (n < 3) return '';

  const colorHex: Record<string, string> = {
    blue: '#2563eb', purple: '#9333ea', green: '#16a34a',
    orange: '#ea580c', indigo: '#4f46e5', pink: '#db2777',
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const maxConsensus = 100;
  const maxUtt = Math.max(...sections.map((s: any) => s.utteranceCount || 0), 1);

  const ptc = (r: number, angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const points = sections.map((s: any, i: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { angle, section: s };
  });

  // Rings
  let svg = `<svg width="100%" viewBox="0 0 ${size} ${size}" style="max-width:500px;margin:0 auto;display:block">`;
  for (const t of rings) {
    svg += `<circle cx="${cx}" cy="${cy}" r="${t * radius}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`;
  }
  // Ring labels
  for (const t of rings) {
    svg += `<text x="${cx + 4}" y="${cy - t * radius + 12}" font-size="9" fill="#9ca3af">${Math.round(t * 100)}%</text>`;
  }
  // Axes
  for (const { angle } of points) {
    const end = ptc(radius, angle);
    svg += `<line x1="${cx}" y1="${cy}" x2="${end.x}" y2="${end.y}" stroke="#d1d5db" stroke-width="1"/>`;
  }
  // Utterance polygon
  const uttPoly = points.map(({ angle, section }) => {
    const v = (section.utteranceCount || 0) / maxUtt;
    const p = ptc(v * radius, angle);
    return `${p.x},${p.y}`;
  }).join(' ');
  svg += `<polygon points="${uttPoly}" fill="#818cf8" fill-opacity="0.1" stroke="#818cf8" stroke-width="1.5" stroke-dasharray="4 2"/>`;
  // Consensus polygon
  const conPoly = points.map(({ angle, section }) => {
    const v = Math.min(section.consensusLevel || 0, maxConsensus);
    const p = ptc((v / maxConsensus) * radius, angle);
    return `${p.x},${p.y}`;
  }).join(' ');
  svg += `<polygon points="${conPoly}" fill="#6366f1" fill-opacity="0.25" stroke="#6366f1" stroke-width="2"/>`;
  // Dots
  for (const { angle, section } of points) {
    const v = Math.min(section.consensusLevel || 0, maxConsensus);
    const p = ptc((v / maxConsensus) * radius, angle);
    svg += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#6366f1" stroke="white" stroke-width="2"/>`;
  }
  // Labels
  for (const { angle, section } of points) {
    const labelR = radius + 36;
    const lp = ptc(labelR, angle);
    const anchor = Math.abs(Math.cos(angle)) < 0.15 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
    const color = colorHex[section.color] || colorHex.blue;
    svg += `<text x="${lp.x}" y="${lp.y - 6}" text-anchor="${anchor}" dominant-baseline="middle" font-size="12" font-weight="600" fill="${color}">${esc(section.domain)}</text>`;
    svg += `<text x="${lp.x}" y="${lp.y + 8}" text-anchor="${anchor}" dominant-baseline="middle" font-size="10" fill="#6b7280">${section.consensusLevel || 0}% · ${section.utteranceCount || 0} insights</text>`;
  }
  // Legend
  svg += `<rect x="10" y="${size - 34}" width="10" height="10" fill="#6366f1" fill-opacity="0.25" stroke="#6366f1" stroke-width="1" rx="2"/>`;
  svg += `<text x="24" y="${size - 25}" font-size="10" fill="#6b7280">Consensus</text>`;
  svg += `<rect x="100" y="${size - 34}" width="10" height="10" fill="#818cf8" fill-opacity="0.15" stroke="#818cf8" stroke-width="1" stroke-dasharray="3 1" rx="2"/>`;
  svg += `<text x="114" y="${size - 25}" font-size="10" fill="#6b7280">Insight Volume</text>`;
  svg += `</svg>`;
  return svg;
}

function renderWordCloud(words: any[], domainColor?: string): string {
  if (!words || words.length === 0) return '';
  const CLOUD_COLORS = ['#2563eb', '#9333ea', '#16a34a', '#ea580c', '#4f46e5', '#db2777', '#0891b2', '#7c3aed', '#059669', '#d97706'];
  let html = '<div class="word-cloud-container">';
  words.forEach((w: any, i: number) => {
    const size = Math.min(w.size || 1, 4);
    const fontSize = 12 + size * 7;
    const fontWeight = size >= 3 ? 700 : size >= 2 ? 600 : 400;
    const rotation = ((i * 37) % 7 - 3) * 4;
    const color = domainColor || CLOUD_COLORS[i % CLOUD_COLORS.length];
    const opacity = 0.55 + size * 0.12;
    html += `<span style="font-size:${fontSize}px;font-weight:${fontWeight};color:${color};opacity:${opacity};transform:rotate(${rotation}deg);display:inline-block;line-height:1.2" title="${esc(w.word)}: size ${size}">${esc(w.word)}</span>`;
  });
  html += '</div>';
  return html;
}

function renderCombinedWordCloud(sections: any[]): string {
  const colorHex: Record<string, string> = {
    blue: '#2563eb', purple: '#9333ea', green: '#16a34a',
    orange: '#ea580c', indigo: '#4f46e5', pink: '#db2777',
  };
  const merged: { word: string; size: number; color: string }[] = [];
  sections.forEach((s: any) => {
    const color = colorHex[s.color] || colorHex.blue;
    (s.wordCloud || []).forEach((w: any) => {
      merged.push({ word: w.word, size: w.size, color });
    });
  });
  if (merged.length === 0) return '';
  merged.sort((a, b) => b.size - a.size);
  const big = merged.filter(w => w.size >= 3);
  const small = merged.filter(w => w.size < 3);
  const result: typeof merged = [];
  let si = 0;
  for (const b of big) {
    result.push(b);
    if (si < small.length) result.push(small[si++]);
    if (si < small.length) result.push(small[si++]);
  }
  while (si < small.length) result.push(small[si++]);

  let html = `<div class="section-card" style="border:2px solid #ede9fe">
    <h3 style="font-weight:700;font-size:1.1rem;margin-bottom:1rem">Combined Theme Cloud — All Domains</h3>
    <div class="word-cloud-container combined">`;
  result.forEach((item, i) => {
    const fontSize = 11 + (item.size || 1) * 7;
    const fontWeight = item.size >= 3 ? 700 : item.size >= 2 ? 600 : 400;
    const rotation = ((i * 31) % 9 - 4) * 3;
    const opacity = 0.5 + (item.size || 1) * 0.13;
    html += `<span style="font-size:${fontSize}px;font-weight:${fontWeight};color:${item.color};opacity:${opacity};transform:rotate(${rotation}deg);display:inline-block;line-height:1.2">${esc(item.word)}</span>`;
  });
  html += '</div></div>';
  return html;
}

function renderDiscoveryOutput(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="section-card"><p>No discovery output available.</p></div>';
  }

  let html = '';
  const sections = data.sections || [];

  // Overview stats
  const consensusPercentage = sections.length > 0
    ? Math.round(sections.reduce((sum: number, s: any) => sum + (s.consensusLevel || 0), 0) / sections.length)
    : 0;

  html += `<div class="section-card">
    <h2>Discovery Interview Synthesis</h2>
    <p style="color:#6b7280;margin-bottom:1.5rem">Synthesized insights from pre-workshop AI discovery conversations with participants.</p>
  </div>`;

  html += `<div class="metrics-grid">
    <div class="metric-card blue">
      <span class="metric-icon">&#128101;</span>
      <div class="metric-value">${data.participants?.length || 0}</div>
      <div class="metric-label">Participants</div>
    </div>
    <div class="metric-card purple">
      <span class="metric-icon">&#128172;</span>
      <div class="metric-value">${data.totalUtterances || 0}</div>
      <div class="metric-label">Insights Captured</div>
    </div>
    <div class="metric-card green">
      <span class="metric-icon">&#129504;</span>
      <div class="metric-value">${sections.length}</div>
      <div class="metric-label">Perspectives</div>
    </div>
    <div class="metric-card orange">
      <span class="metric-icon">&#127919;</span>
      <div class="metric-value">${consensusPercentage}%</div>
      <div class="metric-label">Alignment</div>
    </div>
  </div>`;

  // Radar chart
  if (sections.length >= 3) {
    html += `<div class="section-card"><h2>Domain Coverage &amp; Consensus</h2>${renderRadarChartSVG(sections)}</div>`;
  }

  // Combined word cloud
  html += renderCombinedWordCloud(sections);

  // Domain sections
  const colorHex: Record<string, string> = {
    blue: '#2563eb', purple: '#9333ea', green: '#16a34a',
    orange: '#ea580c', indigo: '#4f46e5', pink: '#db2777',
  };
  const borderColors: Record<string, string> = {
    blue: '#bfdbfe', purple: '#e9d5ff', green: '#bbf7d0',
    orange: '#fed7aa', indigo: '#c7d2fe', pink: '#fbcfe8',
  };

  for (const section of sections) {
    const bColor = borderColors[section.color] || '#e5e7eb';
    const tColor = colorHex[section.color] || '#2563eb';

    html += `<div class="accordion-item" style="border-color:${bColor}">
      <button class="accordion-trigger" onclick="toggleAccordion(this)">
        <span class="accordion-icon">&#9654;</span>
        <span style="font-size:1.5rem">${section.icon || ''}</span>
        <span style="color:${tColor};font-weight:700">${esc(section.domain)}</span>
        <span style="font-size:0.8rem;color:#6b7280;margin-left:auto">${section.utteranceCount || 0} utterances</span>
      </button>
      <div class="accordion-content">`;

    // Consensus bar
    if (section.consensusLevel !== undefined) {
      html += `<div class="consensus-bar-wrap">
        <div class="consensus-bar"><div class="consensus-fill" style="width:${section.consensusLevel}%;background:${tColor}"></div></div>
        <div class="consensus-label">Consensus: ${section.consensusLevel}%</div>
      </div>`;
    }

    // Top themes
    if (section.topThemes && section.topThemes.length > 0) {
      html += `<div class="themes-list">`;
      for (const theme of section.topThemes) {
        html += `<span class="theme-tag">${esc(theme)}</span>`;
      }
      html += `</div>`;
    }

    // Word cloud per domain
    if (section.wordCloud && section.wordCloud.length > 0) {
      html += `<div style="background:white;padding:1rem;border-radius:8px;border:1px solid #e5e7eb;margin:1rem 0">
        <h4 style="font-weight:600;margin-bottom:0.75rem">Key Themes</h4>
        ${renderWordCloud(section.wordCloud, tColor)}
      </div>`;
    }

    // Quotes
    if (section.quotes && section.quotes.length > 0) {
      html += `<div style="margin-top:1rem">`;
      for (const q of section.quotes) {
        html += `<blockquote>${esc(q.text)}<cite>- ${esc(q.author)}</cite></blockquote>`;
      }
      html += `</div>`;
    }

    // Sentiment bar
    if (section.sentiment) {
      const s = section.sentiment;
      const total = (s.optimistic || 0) + (s.neutral || 0) + (s.concerned || 0);
      if (total > 0) {
        const optPct = Math.round(((s.optimistic || 0) / total) * 100);
        const neuPct = Math.round(((s.neutral || 0) / total) * 100);
        const conPct = 100 - optPct - neuPct;
        html += `<div class="sentiment-bar-wrap">
          <div class="sentiment-bar">
            ${optPct > 0 ? `<div class="sentiment-segment sentiment-optimistic" style="width:${optPct}%">${optPct}%</div>` : ''}
            ${neuPct > 0 ? `<div class="sentiment-segment sentiment-neutral" style="width:${neuPct}%">${neuPct}%</div>` : ''}
            ${conPct > 0 ? `<div class="sentiment-segment sentiment-concerned" style="width:${conPct}%">${conPct}%</div>` : ''}
          </div>
          <div class="sentiment-legend">
            <span><span class="sentiment-dot" style="background:#22c55e"></span>Optimistic</span>
            <span><span class="sentiment-dot" style="background:#a3a3a3"></span>Neutral</span>
            <span><span class="sentiment-dot" style="background:#ef4444"></span>Concerned</span>
          </div>
        </div>`;
      }
    }

    html += `</div></div>`; // close accordion-content + accordion-item
  }

  // Participants
  if (data.participants && Array.isArray(data.participants) && data.participants.length > 0) {
    html += `<div class="section-card"><h2>Participants</h2>
    <table class="summary-table">
      <thead><tr><th>Name</th><th>Role</th><th>Experience</th></tr></thead>
      <tbody>`;
    for (const p of data.participants) {
      html += `<tr><td>${esc(p.name)}</td><td>${esc(p.role)}</td><td>${esc(p.yearsExperience)} years</td></tr>`;
    }
    html += `</tbody></table></div>`;
  }

  return html;
}

/* ================================================================
   3. REIMAGINE
   ================================================================ */

function renderThreeHouses(images: { old: string | null; refreshed: string | null; ideal: string | null }): string {
  const oldImg = images.old
    ? `<img src="${images.old}" alt="The Old House" style="width:100%;height:100%;object-fit:contain">`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="none" viewBox="0 0 24 24" stroke="#fca5a5" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4"/></svg>`;
  const refreshedImg = images.refreshed
    ? `<img src="${images.refreshed}" alt="The Refreshed House" style="width:100%;height:100%;object-fit:contain">`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="none" viewBox="0 0 24 24" stroke="#fdba74" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>`;
  const idealImg = images.ideal
    ? `<img src="${images.ideal}" alt="The Ideal House" style="width:100%;height:100%;object-fit:contain">`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="none" viewBox="0 0 24 24" stroke="#86efac" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>`;

  return `<div class="three-houses">
    <div class="house-card house-red">
      <div class="house-img">${oldImg}</div>
      <div class="house-body">
        <h3>The Old House</h3>
        <p style="font-weight:500;color:#7f1d1d;margin-bottom:0.5rem">Today's Constrained Way</p>
        <p style="font-weight:500;font-size:0.85rem;color:#991b1b;margin-bottom:0.5rem">The Noisy, Cluttered Present</p>
        <ul style="list-style:none;padding:0;font-size:0.85rem;color:#991b1b">
          <li style="padding:0.2rem 0">&bull; Full of internal noise and politics</li>
          <li style="padding:0.2rem 0">&bull; Constrained by legacy systems</li>
          <li style="padding:0.2rem 0">&bull; Limited by "how we've always done it"</li>
          <li style="padding:0.2rem 0">&bull; Weighed down by accumulated baggage</li>
        </ul>
        <p style="font-size:0.75rem;font-style:italic;color:#b91c1c;margin-top:0.75rem">This is where we are stuck today.</p>
      </div>
    </div>
    <div class="house-card house-orange">
      <div class="house-img">${refreshedImg}</div>
      <div class="house-body">
        <h3>The Refreshed House</h3>
        <p style="font-weight:500;color:#7c2d12;margin-bottom:0.5rem">Small Incremental Steps</p>
        <p style="font-weight:500;font-size:0.85rem;color:#9a3412;margin-bottom:0.5rem">The Trap of Small Fixes</p>
        <ul style="list-style:none;padding:0;font-size:0.85rem;color:#9a3412">
          <li style="padding:0.2rem 0">&bull; Polish the existing approach</li>
          <li style="padding:0.2rem 0">&bull; Make incremental improvements</li>
          <li style="padding:0.2rem 0">&bull; Optimize what already exists</li>
          <li style="padding:0.2rem 0">&bull; Same house, slightly better paint</li>
        </ul>
        <p style="font-size:0.75rem;font-style:italic;color:#c2410c;margin-top:0.75rem">This makes little material difference — still constrained.</p>
      </div>
    </div>
    <div class="house-card house-green">
      <div class="house-img">${idealImg}</div>
      <div class="house-body">
        <h3>The Ideal House</h3>
        <p style="font-weight:500;color:#14532d;margin-bottom:0.5rem">Transformational Reimagination</p>
        <p style="font-weight:500;font-size:0.85rem;color:#166534;margin-bottom:0.5rem">The Next Level</p>
        <ul style="list-style:none;padding:0;font-size:0.85rem;color:#166534">
          <li style="padding:0.2rem 0">&bull; If we could start from scratch today...</li>
          <li style="padding:0.2rem 0">&bull; With no legacy constraints...</li>
          <li style="padding:0.2rem 0">&bull; Ignoring "how it's always been done"...</li>
          <li style="padding:0.2rem 0">&bull; What would we actually build?</li>
        </ul>
        <p style="font-size:0.75rem;font-style:italic;color:#16a34a;margin-top:0.75rem">This is transformational change — material difference.</p>
      </div>
    </div>
  </div>

  <div style="background:#fefce8;border:2px solid #fef08a;border-radius:16px;padding:2rem;margin-bottom:2rem">
    <h3 style="font-weight:700;font-size:1rem;color:#854d0e;margin-bottom:1rem">The Strategic Choice</h3>
    <p style="font-weight:500;font-size:0.9rem;color:#111827;margin-bottom:1rem">
      Most organizations get stuck in the middle house — making small improvements that feel productive but don't create material change.
    </p>
    <p style="font-size:0.85rem;color:#6b7280;margin-bottom:0.5rem">
      <strong style="color:#7f1d1d">The Old House (Left):</strong> Today's reality is noisy and constrained. Full of internal politics, external pressures, legacy systems, and "how we've always done it."
    </p>
    <p style="font-size:0.85rem;color:#6b7280;margin-bottom:0.5rem">
      <strong style="color:#9a3412">The Refreshed House (Middle) — THE TRAP:</strong> Small incremental steps that polish the existing approach. You're still in the same constrained house, just with slightly better paint.
    </p>
    <p style="font-size:0.85rem;color:#6b7280;margin-bottom:1rem">
      <strong style="color:#166534">The Ideal House (Right) — THE GOAL:</strong> True reimagination. Remove all the noise. Ask: "If we could start from scratch today, with no constraints, what would we build?"
    </p>
    <p style="font-size:0.85rem;font-style:italic;color:#111827;border-top:1px solid #fde047;padding-top:1rem">
      <strong>The point of DREAM workshops:</strong> Force teams to skip the middle house and reimagine without constraints. The agentic AI helps identify which insights are transformational (Ideal House) vs incremental (Refreshed House).
    </p>
  </div>`;
}

function renderJourneyMapCompact(journey: any): string {
  if (!journey || !journey.stages?.length || !journey.actors?.length) return '';
  const stages: string[] = journey.stages;
  const actors: any[] = journey.actors;
  const interactions: any[] = journey.interactions || [];

  const painPointCount = interactions.filter((i: any) => i.isPainPoint).length;
  const motCount = interactions.filter((i: any) => i.isMomentOfTruth).length;

  // Stats bar
  let html = `<div class="journey-stats">
    <div style="display:flex;align-items:center;gap:2rem">
      <div class="journey-stat"><div class="val">${stages.length}</div><div class="lbl">Stages</div></div>
      <div class="journey-stat"><div class="val">${actors.length}</div><div class="lbl">Actors</div></div>
      <div class="journey-stat"><div class="val">${interactions.length}</div><div class="lbl">Interactions</div></div>
      ${painPointCount > 0 ? `<div class="journey-stat red"><div class="val">${painPointCount}</div><div class="lbl">Pain Points</div></div>` : ''}
      ${motCount > 0 ? `<div class="journey-stat amber"><div class="val">${motCount}</div><div class="lbl">Moments of Truth</div></div>` : ''}
    </div>
  </div>`;

  // Grid
  html += `<div class="journey-grid-wrap"><table class="journey-grid"><thead><tr><th>Actor</th>`;
  for (const stage of stages) {
    html += `<th>${esc(stage)}</th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const actor of actors) {
    html += `<tr><td><div class="actor-name">${esc(actor.name)}</div><div class="actor-role">${esc(actor.role)}</div></td>`;
    for (const stage of stages) {
      const cellInteractions = interactions.filter(
        (i: any) => i.actor?.toLowerCase() === actor.name?.toLowerCase() && i.stage?.toLowerCase() === stage?.toLowerCase()
      );
      html += `<td>`;
      for (const interaction of cellInteractions) {
        const chipClass = interaction.sentiment === 'positive' ? 'chip-positive'
          : interaction.sentiment === 'concerned' ? 'chip-concerned'
          : interaction.sentiment === 'critical' ? 'chip-critical'
          : 'chip-neutral';
        html += `<div class="interaction-chip ${chipClass}">
          ${interaction.isPainPoint ? '<span class="pain-marker">&#128308;</span>' : ''}
          ${interaction.isMomentOfTruth ? '<span class="mot-marker">&#11088;</span>' : ''}
          <div class="action">${esc(interaction.action)}</div>
        </div>`;
      }
      html += `</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table></div>`;

  // Summary cards
  if (journey.painPointSummary || journey.momentOfTruthSummary) {
    html += `<div class="journey-summary-grid">`;
    if (journey.painPointSummary) {
      html += `<div class="journey-summary-card"><div class="label" style="color:#f87171">PAIN POINT ANALYSIS</div><p>${esc(journey.painPointSummary)}</p></div>`;
    }
    if (journey.momentOfTruthSummary) {
      html += `<div class="journey-summary-card"><div class="label" style="color:#f59e0b">MOMENTS OF TRUTH</div><p>${esc(journey.momentOfTruthSummary)}</p></div>`;
    }
    html += `</div>`;
  }

  return html;
}

function renderReimag(data: any, customerJourney: any, houseImages?: { old: string | null; refreshed: string | null; ideal: string | null }): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="section-card"><p>No reimagine content available.</p></div>';
  }

  const rc = data.reimagineContent || data;
  let html = '<div class="beige-page">';

  // Title card
  html += `<div class="reimagine-title-card">
    <span class="tag">REIMAGINE OUTPUT</span>
    <h1>${esc(rc.title || 'Reimagine Output')}</h1>
    <p class="desc">${esc(rc.description || '')}</p>
    ${rc.subtitle ? `<p class="desc">${esc(rc.subtitle)}</p>` : ''}
    <p class="note">The themes below are presented in order of importance and emphasis during the session.</p>
  </div>`;

  // Section label
  html += `<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.15em;color:#D4A89A;margin-bottom:2rem;font-weight:500">HOW WE APPROACHED THE REIMAGINE SESSION</div>`;

  // Three Houses
  html += renderThreeHouses(houseImages || { old: null, refreshed: null, ideal: null });

  // Green accent boxes
  const accentSections = [];
  if (rc.supportingSection) accentSections.push(rc.supportingSection);
  if (rc.accordionSections) accentSections.push(...rc.accordionSections);
  if (accentSections.length > 0) {
    html += '<div class="accent-grid">';
    for (const sec of accentSections) {
      html += `<div class="accent-box">
        <h3>${esc(sec.title)}</h3>
        ${sec.description ? `<p class="desc">${esc(sec.description)}</p>` : ''}
        ${sec.points?.length > 0 ? `<ul>${sec.points.map((p: string) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      </div>`;
    }
    html += '</div>';
  }

  // Compact Journey Map
  const journeyData = customerJourney && customerJourney.stages?.length > 0 ? customerJourney : null;
  if (journeyData || rc.journeyMapping) {
    html += `<h3 style="font-weight:700;font-size:1.75rem;margin-bottom:2rem;color:#111827">${rc.journeyMapping?.title || 'Customer Journey Mapping'}</h3>`;
    if (journeyData) {
      html += renderJourneyMapCompact(journeyData);
    }
  }

  // Primary themes
  const primaryThemes = rc.primaryThemes || [];
  if (primaryThemes.length > 0) {
    html += `<div class="themes-section" style="margin-top:3rem">
      <div class="theme-list" id="primary-themes-container">
        <h3>Primary themes</h3>`;
    for (let i = 0; i < primaryThemes.length; i++) {
      const t = primaryThemes[i];
      html += `<div class="theme-card primary" onclick="selectTheme('primary',${i})">
        <div class="theme-head">
          <div class="theme-info">
            <div class="theme-number">${i + 1}</div>
            <div>
              <span class="name">${esc(t.title)}</span>
              ${t.weighting ? `<span class="weighting">${esc(t.weighting)}</span>` : ''}
            </div>
          </div>
          <span class="theme-badge-pill">${esc(t.badge || '')}</span>
        </div>
      </div>`;
    }
    html += `</div>
      <div class="detail-panel" id="primary-detail-panel">`;

    // Default: Shift One
    html += `<div class="detail-card theme-default" style="display:block">
      <div class="detail-header">
        <div class="top-row"><div class="left">
          <div class="theme-number" style="background:#c2410c">1</div>
          <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.15em;color:#78350f;font-weight:700">SHIFT ONE</span>
        </div></div>
        <h4>${esc(rc.shiftOne?.title || 'First Key Shift')}</h4>
      </div>
      <div class="detail-body">
        <p class="desc">${esc(rc.shiftOne?.description || '')}</p>
        ${rc.shiftOne?.details?.length > 0 ? `<ul>${rc.shiftOne.details.map((d: string) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>`;

    // Theme details (hidden by default)
    for (let i = 0; i < primaryThemes.length; i++) {
      const t = primaryThemes[i];
      html += `<div class="detail-card theme-detail" style="display:none">
        <div class="detail-header">
          <div class="top-row"><div class="left">
            <div class="theme-number" style="background:#92400e">${i + 1}</div>
            <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.15em;color:#78350f;font-weight:700">${esc(t.badge || 'THEME')}</span>
          </div></div>
          <h4>${esc(t.title)}</h4>
        </div>
        <div class="detail-body">
          <p class="desc">${esc(t.description || '')}</p>
          ${t.details?.length > 0 ? `<ul>${t.details.map((d: string) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>`;
    }
    html += `</div></div>`; // close detail-panel + themes-section
  }

  // Supporting themes
  const supportingThemes = rc.supportingThemes || [];
  if (supportingThemes.length > 0) {
    html += `<div class="themes-section">
      <div class="theme-list" id="supporting-themes-container">
        <h3>Supporting themes</h3>`;
    for (let i = 0; i < supportingThemes.length; i++) {
      const t = supportingThemes[i];
      html += `<div class="theme-card supporting" onclick="selectTheme('supporting',${i})">
        <div class="theme-head">
          <div class="theme-info">
            <div class="theme-number">${i + 1}</div>
            <div>
              <span class="name">${esc(t.title)}</span>
              ${t.weighting ? `<span class="weighting">${esc(t.weighting)}</span>` : ''}
            </div>
          </div>
          <span class="theme-badge-pill">${esc(t.badge || '')}</span>
        </div>
      </div>`;
    }
    html += `</div>
      <div class="detail-panel" id="supporting-detail-panel">`;

    // Default: Shift Two
    html += `<div class="detail-card supporting-detail theme-default" style="display:block">
      <div class="detail-header">
        <div class="top-row"><div class="left">
          <div class="theme-number" style="background:#0ea5e9">1</div>
          <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.15em;color:#0c4a6e;font-weight:700">SHIFT TWO</span>
        </div></div>
        <h4>${esc(rc.shiftTwo?.title || 'Second Key Shift')}</h4>
      </div>
      <div class="detail-body">
        <p class="desc">${esc(rc.shiftTwo?.description || '')}</p>
        ${rc.shiftTwo?.details?.length > 0 ? `<ul>${rc.shiftTwo.details.map((d: string) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>`;

    for (let i = 0; i < supportingThemes.length; i++) {
      const t = supportingThemes[i];
      html += `<div class="detail-card supporting-detail theme-detail" style="display:none">
        <div class="detail-header">
          <div class="top-row"><div class="left">
            <div class="theme-number" style="background:#0284c7">${i + 1}</div>
            <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.15em;color:#0c4a6e;font-weight:700">${esc(t.badge || 'THEME')}</span>
          </div></div>
          <h4>${esc(t.title)}</h4>
        </div>
        <div class="detail-body">
          <p class="desc">${esc(t.description || '')}</p>
          ${t.details?.length > 0 ? `<ul>${t.details.map((d: string) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>`;
    }
    html += `</div></div>`;
  }

  // Horizon vision
  if (rc.horizonVision) {
    html += `<div style="margin-top:3rem">
      <h3 style="font-weight:700;font-size:1.75rem;margin-bottom:1.5rem;color:#111827">${esc(rc.horizonVision.title || 'Horizon Vision')}</h3>
      <div class="horizon-grid">`;
    if (rc.horizonVision.columns) {
      for (const col of rc.horizonVision.columns) {
        html += `<div class="horizon-col">
          <h4>${esc(col.title)}</h4>
          ${col.points?.length > 0 ? `<ul>${col.points.map((p: string) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        </div>`;
      }
    }
    html += `</div></div>`;
  }

  html += '</div>'; // close beige-page
  return html;
}

/* ================================================================
   4. CONSTRAINTS
   ================================================================ */

function renderConstraints(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="section-card"><p>No constraints defined.</p></div>';
  }

  const categories = [
    { key: 'regulatory', label: 'Regulatory Constraints', icon: '&#128737;', color: 'blue', mit: 'mit-regulatory' },
    { key: 'technical', label: 'Technical Constraints', icon: '&#128187;', color: 'purple', mit: 'mit-technical' },
    { key: 'commercial', label: 'Commercial Constraints', icon: '&#128176;', color: 'green', mit: 'mit-commercial' },
    { key: 'organizational', label: 'Organizational Constraints', icon: '&#128101;', color: 'orange', mit: 'mit-organizational' },
  ];

  let html = '';
  for (const cat of categories) {
    const items = data[cat.key];
    if (!items || !Array.isArray(items) || items.length === 0) continue;

    html += `<div class="cat-${cat.color}">
      <div class="accordion-item">
        <button class="accordion-trigger" onclick="toggleAccordion(this)">
          <span class="accordion-icon">&#9654;</span>
          <span style="font-size:1.5rem">${cat.icon}</span>
          <div style="text-align:left">
            <div style="font-weight:700;font-size:1.05rem">${cat.label}</div>
            <div style="font-size:0.8rem;opacity:0.7">${items.length} ${cat.key} constraints</div>
          </div>
        </button>
        <div class="accordion-content">`;

    for (const item of items) {
      const badgeClass = (item.impact || '').toLowerCase() === 'critical' ? 'badge-critical'
        : (item.impact || '').toLowerCase() === 'high' ? 'badge-high'
        : (item.impact || '').toLowerCase() === 'low' ? 'badge-low'
        : 'badge-medium';

      html += `<div class="constraint-card">
        <div class="constraint-header">
          <span class="constraint-title">${esc(item.title)}</span>
          <span class="badge ${badgeClass}">${esc(item.impact)}</span>
        </div>
        <p style="font-size:0.9rem;color:#6b7280">${esc(item.description)}</p>
        ${item.mitigation ? `<div class="mitigation-box ${cat.mit}">
          <strong>Mitigation:</strong>
          <span>${esc(item.mitigation)}</span>
        </div>` : ''}
      </div>`;
    }

    html += `</div></div></div>`;
  }

  return html || '<div class="section-card"><p>No constraints data available.</p></div>';
}

/* ================================================================
   5. POTENTIAL SOLUTION
   ================================================================ */

function renderPotentialSolution(data: any, solutionBase64: string | null): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="section-card"><p>No solution data available.</p></div>';
  }

  let html = '<div class="solution-page">';

  // Title card
  html += `<div class="solution-title-card">
    <span class="tag">POTENTIAL SOLUTION</span>
    <h1>Solution &amp; Enablers</h1>
    <p class="desc">${esc(data.overview || 'Based on the workshop analysis, the following enablers and implementation path have been identified.')}</p>
  </div>`;

  // Solution image
  if (solutionBase64) {
    html += `<div class="solution-image-wrap">
      <img src="${solutionBase64}" alt="Solution Architecture">
    </div>`;
  }

  // Enablers
  if (data.enablers && Array.isArray(data.enablers) && data.enablers.length > 0) {
    html += `<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.15em;color:#D4A89A;margin-bottom:2rem;font-weight:500">KEY ENABLERS</div>`;
    html += `<div class="enabler-grid">`;
    for (const e of data.enablers) {
      const pClass = (e.priority || '').toUpperCase() === 'HIGH' ? 'priority-high'
        : (e.priority || '').toUpperCase() === 'LOW' ? 'priority-low'
        : 'priority-medium';

      html += `<div class="enabler-card">
        <div class="enabler-header">
          <div>
            <div class="enabler-title">${esc(e.title)}</div>
            ${e.domain ? `<div class="enabler-domain">${esc(e.domain)}</div>` : ''}
          </div>
          <span class="priority-badge ${pClass}">${esc(e.priority || 'MEDIUM')}</span>
        </div>
        <p style="font-size:0.9rem;color:#374151;margin-top:0.5rem">${esc(e.description)}</p>
        ${e.dependencies?.length > 0 ? `<div class="deps-list"><strong style="font-size:0.8rem">Dependencies:</strong> ${e.dependencies.map((d: string) => `<span>${esc(d)}</span>`).join('')}</div>` : ''}
      </div>`;
    }
    html += `</div>`;
  }

  // Implementation roadmap
  if (data.implementationPath && Array.isArray(data.implementationPath) && data.implementationPath.length > 0) {
    html += `<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.15em;color:#D4A89A;margin-bottom:2rem;font-weight:500;margin-top:3rem">IMPLEMENTATION ROADMAP</div>`;
    for (const phase of data.implementationPath) {
      html += `<div class="roadmap-phase">
        <h4>${esc(phase.phase)}</h4>
        <div class="phase-timeframe">${esc(phase.timeframe)}</div>
        <div class="roadmap-actions">`;
      if (phase.actions?.length > 0) {
        html += `<div class="roadmap-col"><h5>Actions</h5><ul>`;
        for (const a of phase.actions) { html += `<li>${esc(a)}</li>`; }
        html += `</ul></div>`;
      }
      if (phase.outcomes?.length > 0) {
        html += `<div class="roadmap-col"><h5>Expected Outcomes</h5><ul>`;
        for (const o of phase.outcomes) { html += `<li>${esc(o)}</li>`; }
        html += `</ul></div>`;
      }
      html += `</div></div>`;
    }
  }

  html += '</div>';
  return html;
}

/* ================================================================
   6. COMMERCIAL
   ================================================================ */

function renderCommercial(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="section-card"><p>No commercial content available.</p></div>';
  }

  let html = '';

  // Sensitive note
  html += `<div style="background:#fff3cd;border-left:4px solid #ffc107;padding:1rem;margin-bottom:1.5rem;border-radius:4px;font-size:0.9rem">
    &#9888;&#65039; Note: This section contains sensitive commercial information.
  </div>`;

  // Investment Summary
  if (data.investmentSummary) {
    const inv = data.investmentSummary;
    html += `<div class="metrics-grid">
      <div class="metric-card blue">
        <span class="metric-icon">&#128176;</span>
        <div class="metric-value">${esc(inv.totalInvestment)}</div>
        <div class="metric-label">Total Investment</div>
      </div>
      <div class="metric-card green">
        <span class="metric-icon">&#128200;</span>
        <div class="metric-value">${esc(inv.fiveYearROI)}</div>
        <div class="metric-label">5-Year ROI</div>
      </div>
      <div class="metric-card orange">
        <span class="metric-icon">&#9200;</span>
        <div class="metric-value">${esc(inv.paybackPeriod)}</div>
        <div class="metric-label">Payback Period</div>
      </div>
      <div class="metric-card purple">
        <span class="metric-icon">&#128178;</span>
        <div class="metric-value">${esc(inv.annualSavings)}</div>
        <div class="metric-label">Annual Savings</div>
      </div>
    </div>`;
  }

  // Delivery Phases
  if (data.deliveryPhases && Array.isArray(data.deliveryPhases) && data.deliveryPhases.length > 0) {
    html += `<div class="section-card"><h2>Delivery Phases</h2><div class="phase-timeline">`;
    for (const phase of data.deliveryPhases) {
      html += `<div class="phase-item">
        <h4>${esc(phase.phase)}</h4>
        <div class="phase-meta">${esc(phase.duration)} &middot; ${esc(phase.investment)}</div>`;

      if (phase.scope?.length > 0) {
        html += `<p style="font-weight:600;margin-bottom:0.25rem">Scope:</p><ul style="margin-left:1.5rem">`;
        for (const s of phase.scope) { html += `<li style="font-size:0.9rem">${esc(s)}</li>`; }
        html += `</ul>`;
      }

      if (phase.outcomes?.length > 0) {
        html += `<div class="outcomes-box">
          <p>Expected Outcomes:</p><ul style="margin-left:1.5rem">`;
        for (const o of phase.outcomes) { html += `<li>${esc(o)}</li>`; }
        html += `</ul></div>`;
      }

      html += `</div>`;
    }
    html += `</div></div>`;
  }

  // Risk Assessment
  if (data.riskAssessment && Array.isArray(data.riskAssessment) && data.riskAssessment.length > 0) {
    html += `<div class="section-card"><h2>Risk Assessment</h2>
    <table class="risk-table">
      <thead><tr><th>Risk</th><th>Probability</th><th>Impact</th><th>Mitigation</th></tr></thead>
      <tbody>`;
    for (const r of data.riskAssessment) {
      const probBadge = (r.probability || '').toLowerCase() === 'high' ? 'badge-critical'
        : (r.probability || '').toLowerCase() === 'medium' ? 'badge-high'
        : 'badge-medium';
      const impactBadge = (r.impact || '').toLowerCase() === 'critical' ? 'badge-critical' : 'badge-high';
      html += `<tr>
        <td><strong>${esc(r.risk)}</strong></td>
        <td><span class="badge ${probBadge}">${esc(r.probability)}</span></td>
        <td><span class="badge ${impactBadge}">${esc(r.impact)}</span></td>
        <td>${esc(r.mitigation)}</td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
  }

  return html || '<div class="section-card"><p>No commercial data available.</p></div>';
}

/* ================================================================
   7. CUSTOMER JOURNEY
   ================================================================ */

function renderCustomerJourney(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="section-card"><p>No customer journey data available.</p></div>';
  }

  let html = '<div class="beige-page">';

  // Title
  html += `<div class="reimagine-title-card" style="margin-bottom:2rem">
    <span class="tag">CUSTOMER JOURNEY</span>
    <h1>Customer Journey Map</h1>
    <p class="desc">A comprehensive view of the customer experience across all stages, actors, and touchpoints.</p>
  </div>`;

  const stages: string[] = data.stages || [];
  const actors: any[] = data.actors || [];
  const interactions: any[] = data.interactions || [];

  if (stages.length > 0 && actors.length > 0) {
    html += renderJourneyMapCompact(data);
  }

  // Pain point summary
  if (data.painPointSummary) {
    html += `<div class="section-card" style="border-left:4px solid #ef4444;margin-top:1.5rem">
      <h2>Pain Point Summary</h2>
      <p>${esc(data.painPointSummary)}</p>
    </div>`;
  }

  // Moment of truth summary
  if (data.momentOfTruthSummary) {
    html += `<div class="section-card" style="border-left:4px solid #eab308">
      <h2>Moments of Truth</h2>
      <p>${esc(data.momentOfTruthSummary)}</p>
    </div>`;
  }

  html += '</div>';
  return html;
}

/* ================================================================
   8. SUMMARY
   ================================================================ */

function renderSummary(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="section-card"><p>No summary available.</p></div>';
  }

  let html = '';

  // Key Findings by category
  if (data.keyFindings && Array.isArray(data.keyFindings) && data.keyFindings.length > 0) {
    html += `<div class="section-card"><h2>Key Findings</h2>`;
    for (const group of data.keyFindings) {
      html += `<div class="findings-category">
        <h3>${esc(group.category)}</h3>
        <ul>`;
      if (group.findings && Array.isArray(group.findings)) {
        for (const finding of group.findings) {
          html += `<li>${esc(finding)}</li>`;
        }
      }
      html += `</ul></div>`;
    }
    html += `</div>`;
  }

  // Recommended Next Steps
  if (data.recommendedNextSteps && Array.isArray(data.recommendedNextSteps) && data.recommendedNextSteps.length > 0) {
    html += `<div class="section-card"><h2>Recommended Next Steps</h2>
    <table class="summary-table">
      <thead><tr><th>Step</th><th>Timeframe</th><th>Owner</th><th>Actions</th></tr></thead>
      <tbody>`;
    for (const step of data.recommendedNextSteps) {
      const actions = step.actions && Array.isArray(step.actions)
        ? `<ul style="margin:0;padding-left:1.25rem">${step.actions.map((a: string) => `<li>${esc(a)}</li>`).join('')}</ul>`
        : '-';
      html += `<tr>
        <td><strong>${esc(step.step)}</strong></td>
        <td>${esc(step.timeframe)}</td>
        <td>${esc(step.owner)}</td>
        <td>${actions}</td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
  }

  // Success Metrics
  if (data.successMetrics && Array.isArray(data.successMetrics) && data.successMetrics.length > 0) {
    html += `<div class="section-card"><h2>Success Metrics</h2>
    <table class="summary-table">
      <thead><tr><th>Metric</th><th>Baseline</th><th>Target</th><th>Measurement</th></tr></thead>
      <tbody>`;
    for (const m of data.successMetrics) {
      html += `<tr>
        <td><strong>${esc(m.metric)}</strong></td>
        <td>${esc(m.baseline)}</td>
        <td>${esc(m.target)}</td>
        <td>${esc(m.measurement)}</td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
  }

  return html || '<div class="section-card"><p>No summary data available.</p></div>';
}
