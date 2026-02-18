/**
 * Export Workshop Report as Static HTML Package
 *
 * Generates a complete, self-contained HTML package that can be uploaded
 * to client's domain (e.g., acme-corp.upstreamworks.com)
 *
 * No references to dream.ethenta.com - fully white-labeled
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import JSZip from 'jszip';

/* ── Tiny helper: HTML-escape user content ── */
function esc(s: any): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
  // Use client logo (per-workshop) if available, else org logo (tenant)
  const logo = sp.clientLogoUrl || organization.logoUrl || '';

  const files: Record<string, string> = {};

  // CSS
  files['assets/styles.css'] = generateCSS(primaryColor, secondaryColor);

  // Navigation pages list
  const NAV_PAGES = [
    { href: 'executive-summary.html', label: 'Executive Summary' },
    { href: 'discovery-output.html', label: 'Discovery Output' },
    { href: 'reimagine.html', label: 'Reimagine' },
    { href: 'constraints.html', label: 'Constraints' },
    { href: 'solution.html', label: 'Solution' },
    { href: 'commercial.html', label: 'Commercial' },
    { href: 'journey-map.html', label: 'Journey Map' },
    { href: 'summary.html', label: 'Summary' },
  ];

  const navHTML = (activeTitle: string) => NAV_PAGES.map(p =>
    `<a href="${p.href}" class="nav-item${p.label === activeTitle ? ' active' : ''}">${esc(p.label)}</a>`
  ).join('\n    ');

  // INDEX
  files['index.html'] = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(workshop.name)} - Workshop Report</title>
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <header class="report-header">
    ${logo ? `<img src="${esc(logo)}" alt="${esc(orgName)}" class="org-logo">` : `<h1>${esc(orgName)}</h1>`}
    <h2>${esc(workshop.name)}</h2>
  </header>
  <nav class="report-nav">
    ${navHTML('')}
  </nav>
  <main class="report-main">
    <div class="welcome-card">
      <h1>Workshop Report</h1>
      <p>This report contains insights and outputs from the ${esc(workshop.name)} workshop.</p>
      <p>Use the navigation above to explore different sections of the report.</p>
      <p class="report-date">Generated: ${new Date().toLocaleDateString()}</p>
    </div>
  </main>
  <footer class="report-footer">
    <p>&copy; ${new Date().getFullYear()} ${esc(orgName)}. All rights reserved.</p>
  </footer>
</body>
</html>`;

  // Helper to build a full page
  const page = (title: string, content: string, pw = false) => generatePageHTML(title, workshop.name, orgName, logo, navHTML(title), content, pw);

  files['executive-summary.html'] = page('Executive Summary', renderExecutiveSummary(execSummary));
  files['discovery-output.html'] = page('Discovery Output', renderDiscoveryOutput(discoveryOutput));
  files['reimagine.html'] = page('Reimagine', renderReimag(reimagineContent));
  files['constraints.html'] = page('Constraints', renderConstraints(constraintsContent));
  files['solution.html'] = page('Solution', renderPotentialSolution(potentialSolution));
  files['commercial.html'] = page('Commercial', renderCommercial(commercialContent), true);
  files['journey-map.html'] = page('Journey Map', renderCustomerJourney(customerJourney));
  files['summary.html'] = page('Summary', renderSummary(summaryContent));

  // README
  files['README.txt'] = `
${workshop.name} - Workshop Report
===============================================

This package contains a complete, self-contained workshop report
that can be uploaded to your website.

CONTENTS:
---------
- index.html               : Main navigation page
- executive-summary.html
- discovery-output.html
- reimagine.html
- constraints.html
- solution.html
- commercial.html           : Contains sensitive commercial information
- journey-map.html
- summary.html
- assets/styles.css          : Styling

HOW TO DEPLOY:
--------------
1. Extract this ZIP file
2. Upload all files to your web server
3. Ensure folder structure is maintained
4. Navigate to index.html

NOTES:
------
- No external dependencies required
- Works offline
- Fully white-labeled
- Mobile responsive

Generated: ${new Date().toISOString()}
Workshop: ${workshop.name}
Organization: ${orgName}
`;

  return { files };
}

/* ================================================================
   PAGE TEMPLATE
   ================================================================ */

function generatePageHTML(
  title: string,
  workshopName: string,
  orgName: string,
  logo: string,
  navHTML: string,
  content: string,
  passwordProtected: boolean = false
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} - ${esc(workshopName)}</title>
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <header class="report-header">
    ${logo ? `<img src="${esc(logo)}" alt="${esc(orgName)}" class="org-logo">` : `<h1>${esc(orgName)}</h1>`}
    <h2>${esc(workshopName)}</h2>
  </header>

  <nav class="report-nav">
    <a href="index.html" class="nav-item">Home</a>
    ${navHTML}
  </nav>

  <main class="report-main">
    <h1 class="page-title">${esc(title)}</h1>
    ${passwordProtected ? '<p class="password-note">&#9888;&#65039; Note: This section contains sensitive commercial information.</p>' : ''}
    ${content}
  </main>

  <footer class="report-footer">
    <p>&copy; ${new Date().getFullYear()} ${esc(orgName)}. All rights reserved.</p>
  </footer>
</body>
</html>`;
}

/* ================================================================
   CSS
   ================================================================ */

function generateCSS(primaryColor: string, secondaryColor: string): string {
  return `
/* Workshop Report Styles - Self-Contained */
:root {
  --primary: ${primaryColor};
  --secondary: ${secondaryColor};
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: #333;
  background: #f5f5f5;
}

/* ── Header & Nav ── */
.report-header {
  background: white;
  padding: 2rem;
  border-bottom: 3px solid var(--primary);
  text-align: center;
}
.org-logo { max-width: 200px; max-height: 80px; margin-bottom: 1rem; }
.report-header h2 { color: var(--primary); font-size: 1.5rem; }

.report-nav {
  background: var(--primary);
  padding: 1rem;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem;
}
.nav-item {
  color: white; text-decoration: none; padding: 0.5rem 1rem;
  border-radius: 4px; transition: background 0.3s; font-size: 0.9rem;
}
.nav-item:hover { background: var(--secondary); }
.nav-item.active { background: var(--secondary); font-weight: bold; }

/* ── Layout ── */
.report-main { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
.page-title {
  font-size: 2rem; color: var(--primary); margin-bottom: 1.5rem;
  padding-bottom: 0.5rem; border-bottom: 2px solid var(--secondary);
}
.report-footer {
  background: #333; color: white; text-align: center; padding: 2rem; margin-top: 3rem;
}

/* ── Cards & Sections ── */
.welcome-card {
  background: white; padding: 3rem; border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center;
}
.welcome-card h1 { color: var(--primary); margin-bottom: 1rem; }
.report-date { color: #666; font-size: 0.9rem; margin-top: 1rem; }

.password-note {
  background: #fff3cd; border-left: 4px solid #ffc107;
  padding: 1rem; margin-bottom: 1.5rem; border-radius: 4px;
}

.content-section {
  background: white; padding: 2rem; margin-bottom: 2rem;
  border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.content-section h2 {
  color: var(--primary); margin-bottom: 1rem;
  padding-bottom: 0.5rem; border-bottom: 1px solid #e5e5e5;
}
.content-section h3 {
  color: var(--secondary); margin-top: 1.5rem; margin-bottom: 0.75rem;
}

/* ── Metric Cards Grid ── */
.metrics-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem; margin-bottom: 2rem;
}
.metric-card {
  background: white; border: 2px solid #e5e7eb; border-radius: 12px;
  padding: 1.5rem; text-align: center;
}
.metric-card .metric-value { font-size: 2.2rem; font-weight: 700; }
.metric-card .metric-label { font-size: 0.85rem; color: #6b7280; margin-top: 0.25rem; }
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

/* ── Impact / Priority Badges ── */
.badge {
  display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px;
  font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
}
.badge-critical { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
.badge-high { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
.badge-medium { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
.badge-low { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
.badge-transformational { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }

/* ── Discovery domain sections ── */
.domain-card {
  border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.5rem;
  margin-bottom: 1.5rem; background: white;
}
.domain-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.domain-icon { font-size: 1.8rem; }
.domain-title { font-size: 1.25rem; font-weight: 700; color: var(--primary); }

.consensus-bar-wrapper { margin: 0.75rem 0; }
.consensus-bar {
  height: 8px; border-radius: 4px; background: #e5e7eb; overflow: hidden;
}
.consensus-fill { height: 100%; border-radius: 4px; background: var(--secondary); }
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

.sentiment-bar-wrapper { margin: 1rem 0; }
.sentiment-bar {
  display: flex; height: 24px; border-radius: 12px; overflow: hidden;
}
.sentiment-segment { display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; color: white; }
.sentiment-optimistic { background: #22c55e; }
.sentiment-neutral { background: #a3a3a3; }
.sentiment-concerned { background: #ef4444; }
.sentiment-legend {
  display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.8rem; color: #6b7280;
}
.sentiment-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }

/* ── Reimagine ── */
.reimagine-hero {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  color: white; padding: 3rem 2rem; border-radius: 12px; margin-bottom: 2rem;
  text-align: center;
}
.reimagine-hero h2 { font-size: 2rem; margin-bottom: 0.5rem; }
.reimagine-hero p { opacity: 0.9; font-size: 1.1rem; max-width: 700px; margin: 0.25rem auto; }

.theme-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem; margin: 1.5rem 0;
}
.theme-card {
  border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.25rem; background: white;
}
.theme-card h4 { margin-bottom: 0.25rem; color: var(--primary); }
.theme-card .theme-badge { font-size: 0.75rem; color: #6b7280; }

.shift-card {
  border: 2px solid #c7d2fe; background: #eef2ff; border-radius: 12px;
  padding: 1.5rem; margin: 1.5rem 0;
}
.shift-card h3 { color: #4338ca; margin-bottom: 0.5rem; }
.shift-card p { margin-bottom: 0.75rem; }
.shift-card ul { margin-left: 1.5rem; }
.shift-card li { margin-bottom: 0.25rem; }

.horizon-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem; margin: 1.5rem 0;
}
.horizon-col {
  border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.25rem; background: white;
}
.horizon-col h4 { color: var(--primary); margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--secondary); }
.horizon-col li { margin-bottom: 0.35rem; margin-left: 1rem; }

/* ── Constraints ── */
.constraint-card {
  border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.25rem;
  margin-bottom: 1rem; background: white;
}
.constraint-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.constraint-title { font-weight: 700; font-size: 1rem; }
.mitigation-box {
  background: #eff6ff; border-left: 4px solid #3b82f6; padding: 0.75rem;
  border-radius: 0 8px 8px 0; margin-top: 0.75rem;
}
.mitigation-box strong { color: #1e40af; }

/* ── Solution ── */
.enabler-card {
  border: 2px solid #e5e7eb; border-radius: 12px; padding: 1.25rem;
  margin-bottom: 1rem; background: white;
}
.enabler-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.enabler-title { font-weight: 700; }
.enabler-domain { font-size: 0.8rem; color: #6b7280; }
.deps-list { margin-top: 0.5rem; }
.deps-list span {
  display: inline-block; background: #f3f4f6; padding: 0.15rem 0.5rem;
  border-radius: 4px; font-size: 0.8rem; margin: 0.15rem 0.25rem 0.15rem 0;
}

.roadmap-phase {
  border-left: 4px solid var(--primary); padding: 1rem 1.5rem;
  margin-bottom: 1.5rem; background: white; border-radius: 0 12px 12px 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.roadmap-phase h4 { color: var(--primary); margin-bottom: 0.25rem; }
.roadmap-phase .phase-timeframe { font-size: 0.85rem; color: #6b7280; margin-bottom: 0.75rem; }

/* ── Commercial ── */
.phase-timeline {
  border-left: 4px solid var(--secondary); padding-left: 1.5rem;
  margin: 1.5rem 0;
}
.phase-item { margin-bottom: 2rem; position: relative; }
.phase-item::before {
  content: ''; position: absolute; left: -1.85rem; top: 0.35rem;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--secondary); border: 3px solid white;
}
.phase-item h4 { color: var(--primary); margin-bottom: 0.15rem; }
.phase-meta { font-size: 0.85rem; color: #6b7280; margin-bottom: 0.75rem; }

.risk-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
.risk-table th {
  background: var(--primary); color: white; padding: 0.75rem 1rem;
  text-align: left; font-size: 0.85rem;
}
.risk-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; }
.risk-table tr:nth-child(even) { background: #f9fafb; }

/* ── Journey Map ── */
.journey-grid {
  width: 100%; border-collapse: collapse; margin-top: 1rem;
  font-size: 0.85rem;
}
.journey-grid th {
  background: var(--primary); color: white; padding: 0.6rem 0.75rem;
  text-align: center; font-weight: 600; min-width: 120px;
}
.journey-grid th:first-child { text-align: left; min-width: 100px; background: #374151; }
.journey-grid td {
  padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb;
  vertical-align: top; text-align: center;
}
.journey-grid td:first-child { font-weight: 600; background: #f3f4f6; text-align: left; }
.journey-cell { padding: 0.25rem; }
.journey-cell .action { font-size: 0.85rem; }
.journey-cell .context { font-size: 0.75rem; color: #6b7280; margin-top: 0.2rem; }
.sentiment-positive { background: #f0fdf4; }
.sentiment-neutral-cell { background: #f9fafb; }
.sentiment-concerned-cell { background: #fff7ed; }
.sentiment-critical { background: #fef2f2; }
.pain-point-marker { color: #ef4444; font-weight: 700; font-size: 0.7rem; }
.mot-marker { color: #eab308; font-weight: 700; font-size: 0.7rem; }

/* ── Summary tables ── */
.summary-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
.summary-table th {
  background: var(--primary); color: white; padding: 0.75rem 1rem;
  text-align: left; font-size: 0.85rem;
}
.summary-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; }
.summary-table tr:nth-child(even) { background: #f9fafb; }

.findings-category {
  margin-bottom: 1.5rem;
}
.findings-category h3 {
  font-size: 1.1rem; color: var(--primary); margin-bottom: 0.5rem;
  padding-bottom: 0.25rem; border-bottom: 2px solid var(--secondary);
}
.findings-category ul { margin-left: 1.5rem; }
.findings-category li { margin-bottom: 0.35rem; }

/* ── Accordion (details/summary) ── */
details {
  border: 2px solid #e5e7eb; border-radius: 12px; margin-bottom: 1rem;
  background: white; overflow: hidden;
}
details summary {
  padding: 1rem 1.25rem; cursor: pointer; font-weight: 600;
  color: var(--primary); list-style: none; display: flex; align-items: center; gap: 0.5rem;
}
details summary::before { content: '\\25B6'; font-size: 0.7rem; transition: transform 0.2s; }
details[open] summary::before { transform: rotate(90deg); }
details .details-content { padding: 0 1.25rem 1.25rem; }

/* ── Responsive ── */
@media (max-width: 768px) {
  .report-nav { flex-direction: column; }
  .nav-item { width: 100%; text-align: center; }
  .report-main { padding: 0 0.5rem; }
  .metrics-grid { grid-template-columns: repeat(2, 1fr); }
  .theme-grid { grid-template-columns: 1fr; }
  .horizon-grid { grid-template-columns: 1fr; }
  .journey-grid { font-size: 0.75rem; }
  .journey-grid th, .journey-grid td { padding: 0.35rem 0.5rem; min-width: 90px; }
}

@media print {
  .report-nav { display: none; }
  .report-main { max-width: 100%; }
  details { break-inside: avoid; }
  details[open] summary::before { content: ''; }
}
`;
}

/* ================================================================
   1. EXECUTIVE SUMMARY
   ================================================================ */

function renderExecutiveSummary(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No executive summary available.</p></div>';
  }

  let html = '';

  // Overview
  if (data.overview) {
    html += `
<div class="content-section">
  <h2>Overview</h2>
  <p>${esc(data.overview)}</p>
</div>`;
  }

  // Metrics
  if (data.metrics) {
    const m = data.metrics;
    html += `
<div class="metrics-grid">
  <div class="metric-card blue">
    <div class="metric-value">${esc(m.participantsEngaged ?? '-')}</div>
    <div class="metric-label">Participants Engaged</div>
  </div>
  <div class="metric-card green">
    <div class="metric-value">${esc(m.domainsExplored ?? '-')}</div>
    <div class="metric-label">Domains Explored</div>
  </div>
  <div class="metric-card orange">
    <div class="metric-value">${esc(m.insightsGenerated ?? '-')}</div>
    <div class="metric-label">Insights Generated</div>
  </div>
  <div class="metric-card purple">
    <div class="metric-value">${esc(m.transformationalIdeas ?? '-')}</div>
    <div class="metric-label">Transformational Ideas</div>
  </div>
</div>`;
  }

  // Key Findings
  if (data.keyFindings && Array.isArray(data.keyFindings) && data.keyFindings.length > 0) {
    html += `<div class="content-section"><h2>Key Findings</h2>`;
    for (const f of data.keyFindings) {
      const badgeClass = (f.impact || '').toLowerCase() === 'critical' ? 'badge-critical'
        : (f.impact || '').toLowerCase() === 'transformational' ? 'badge-transformational'
        : 'badge-high';
      html += `
      <div class="constraint-card">
        <div class="constraint-header">
          <span class="constraint-title">${esc(f.title)}</span>
          <span class="badge ${badgeClass}">${esc(f.impact)}</span>
        </div>
        <p>${esc(f.description)}</p>
      </div>`;
    }
    html += `</div>`;
  }

  // Vision / Strategic Shifts / Challenge (legacy fields)
  if (data.vision) {
    html += `<div class="content-section"><h2>Vision Statement</h2><p>${esc(data.vision)}</p></div>`;
  }
  if (data.strategicShifts) {
    html += `<div class="content-section"><h2>Strategic Shifts</h2><p>${esc(data.strategicShifts)}</p></div>`;
  }
  if (data.todaysChallenge) {
    html += `<div class="content-section"><h2>Today's Challenge</h2><p>${esc(data.todaysChallenge)}</p></div>`;
  }
  if (data.futureStatePrinciples) {
    html += `<div class="content-section"><h2>Future State Principles</h2><p>${esc(data.futureStatePrinciples)}</p></div>`;
  }

  return html || '<div class="content-section"><p>No executive summary data available.</p></div>';
}

/* ================================================================
   2. DISCOVERY OUTPUT
   ================================================================ */

function renderDiscoveryOutput(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No discovery output available.</p></div>';
  }

  let html = '';

  // Overview stats
  if (data.totalUtterances || data.overallConsensus) {
    html += `<div class="metrics-grid">`;
    if (data.totalUtterances) {
      html += `<div class="metric-card blue"><div class="metric-value">${esc(data.totalUtterances)}</div><div class="metric-label">Total Utterances</div></div>`;
    }
    if (data.overallConsensus !== undefined) {
      html += `<div class="metric-card green"><div class="metric-value">${esc(data.overallConsensus)}%</div><div class="metric-label">Overall Consensus</div></div>`;
    }
    if (data.sections && Array.isArray(data.sections)) {
      html += `<div class="metric-card purple"><div class="metric-value">${data.sections.length}</div><div class="metric-label">Domains Explored</div></div>`;
    }
    html += `</div>`;
  }

  // Sections / Domains
  if (data.sections && Array.isArray(data.sections)) {
    for (const section of data.sections) {
      const borderColor = section.color === 'blue' ? '#bfdbfe'
        : section.color === 'purple' ? '#e9d5ff'
        : section.color === 'green' ? '#bbf7d0'
        : section.color === 'orange' ? '#fed7aa'
        : '#e5e7eb';

      html += `<div class="domain-card" style="border-color:${borderColor}">`;
      html += `<div class="domain-header">
        <span class="domain-icon">${section.icon || ''}</span>
        <span class="domain-title">${esc(section.domain)}</span>
        ${section.utteranceCount ? `<span style="font-size:0.85rem;color:#6b7280">${esc(section.utteranceCount)} utterances</span>` : ''}
      </div>`;

      // Consensus bar
      if (section.consensusLevel !== undefined) {
        html += `<div class="consensus-bar-wrapper">
          <div class="consensus-bar"><div class="consensus-fill" style="width:${section.consensusLevel}%"></div></div>
          <div class="consensus-label">Consensus: ${esc(section.consensusLevel)}%</div>
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
          html += `<div class="sentiment-bar-wrapper">
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

      html += `</div>`; // close domain-card
    }
  }

  // Participants
  if (data.participants && Array.isArray(data.participants) && data.participants.length > 0) {
    html += `<div class="content-section"><h2>Participants</h2>
    <table class="summary-table">
      <thead><tr><th>Name</th><th>Role</th><th>Experience</th></tr></thead>
      <tbody>`;
    for (const p of data.participants) {
      html += `<tr><td>${esc(p.name)}</td><td>${esc(p.role)}</td><td>${esc(p.yearsExperience)} years</td></tr>`;
    }
    html += `</tbody></table></div>`;
  }

  return html || '<div class="content-section"><p>No discovery output data available.</p></div>';
}

/* ================================================================
   3. REIMAGINE
   ================================================================ */

function renderReimag(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No reimagine content available.</p></div>';
  }

  let html = '';

  // Hero block
  if (data.title || data.description) {
    html += `<div class="reimagine-hero">
      <h2>${esc(data.title)}</h2>
      ${data.description ? `<p>${esc(data.description)}</p>` : ''}
      ${data.subtitle ? `<p style="font-size:0.95rem;opacity:0.8;margin-top:0.5rem">${esc(data.subtitle)}</p>` : ''}
    </div>`;
  }

  // Supporting section
  if (data.supportingSection) {
    const ss = data.supportingSection;
    html += `<div class="content-section">
      <h2>${esc(ss.title)}</h2>
      ${ss.description ? `<p>${esc(ss.description)}</p>` : ''}
      ${ss.points && ss.points.length > 0 ? `<ul style="margin-left:1.5rem;margin-top:0.75rem">${ss.points.map((p: string) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  // Accordion sections
  if (data.accordionSections && data.accordionSections.length > 0) {
    for (const sec of data.accordionSections) {
      html += `<details>
        <summary>${esc(sec.title)}</summary>
        <div class="details-content">
          ${sec.description ? `<p>${esc(sec.description)}</p>` : ''}
          ${sec.points && sec.points.length > 0 ? `<ul style="margin-left:1.5rem;margin-top:0.75rem">${sec.points.map((p: string) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        </div>
      </details>`;
    }
  }

  // Primary themes
  if (data.primaryThemes && data.primaryThemes.length > 0) {
    html += `<div class="content-section"><h2>Primary Themes</h2><div class="theme-grid">`;
    for (const t of data.primaryThemes) {
      html += `<div class="theme-card">
        <h4>${esc(t.title)}</h4>
        <div class="theme-badge">${esc(t.badge)} &middot; ${esc(t.weighting)}</div>
      </div>`;
    }
    html += `</div></div>`;
  }

  // Shift One
  if (data.shiftOne) {
    html += `<div class="shift-card">
      <h3>${esc(data.shiftOne.title)}</h3>
      <p>${esc(data.shiftOne.description)}</p>
      ${data.shiftOne.details && data.shiftOne.details.length > 0 ? `<ul>${data.shiftOne.details.map((d: string) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  // Supporting themes
  if (data.supportingThemes && data.supportingThemes.length > 0) {
    html += `<div class="content-section"><h2>Supporting Themes</h2><div class="theme-grid">`;
    for (const t of data.supportingThemes) {
      html += `<div class="theme-card">
        <h4>${esc(t.title)}</h4>
        <div class="theme-badge">${esc(t.badge)} &middot; ${esc(t.weighting)}</div>
      </div>`;
    }
    html += `</div></div>`;
  }

  // Shift Two
  if (data.shiftTwo) {
    html += `<div class="shift-card">
      <h3>${esc(data.shiftTwo.title)}</h3>
      <p>${esc(data.shiftTwo.description)}</p>
      ${data.shiftTwo.details && data.shiftTwo.details.length > 0 ? `<ul>${data.shiftTwo.details.map((d: string) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  // Horizon vision
  if (data.horizonVision) {
    html += `<div class="content-section">
      <h2>${esc(data.horizonVision.title || 'Horizon Vision')}</h2>
      <div class="horizon-grid">`;
    if (data.horizonVision.columns) {
      for (const col of data.horizonVision.columns) {
        html += `<div class="horizon-col">
          <h4>${esc(col.title)}</h4>
          ${col.points && col.points.length > 0 ? `<ul>${col.points.map((p: string) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        </div>`;
      }
    }
    html += `</div></div>`;
  }

  return html || '<div class="content-section"><p>No reimagine data available.</p></div>';
}

/* ================================================================
   4. CONSTRAINTS
   ================================================================ */

function renderConstraints(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No constraints defined.</p></div>';
  }

  const categories = [
    { key: 'regulatory', label: 'Regulatory Constraints', icon: '&#9878;' },
    { key: 'technical', label: 'Technical Constraints', icon: '&#9881;' },
    { key: 'commercial', label: 'Commercial Constraints', icon: '&#128176;' },
    { key: 'organizational', label: 'Organizational Constraints', icon: '&#127970;' },
  ];

  let html = '';
  for (const cat of categories) {
    const items = data[cat.key];
    if (!items || !Array.isArray(items) || items.length === 0) continue;

    html += `<div class="content-section">
      <h2>${cat.icon} ${cat.label}</h2>`;

    for (const item of items) {
      const badgeClass = (item.impact || '').toLowerCase() === 'critical' ? 'badge-critical'
        : (item.impact || '').toLowerCase() === 'high' ? 'badge-high'
        : 'badge-medium';

      html += `<div class="constraint-card">
        <div class="constraint-header">
          <span class="constraint-title">${esc(item.title)}</span>
          <span class="badge ${badgeClass}">${esc(item.impact)}</span>
        </div>
        <p>${esc(item.description)}</p>
        ${item.mitigation ? `<div class="mitigation-box"><strong>Mitigation:</strong> ${esc(item.mitigation)}</div>` : ''}
      </div>`;
    }

    html += `</div>`;
  }

  return html || '<div class="content-section"><p>No constraints data available.</p></div>';
}

/* ================================================================
   5. POTENTIAL SOLUTION
   ================================================================ */

function renderPotentialSolution(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No solution data available.</p></div>';
  }

  let html = '';

  // Overview
  if (data.overview) {
    html += `<div class="content-section"><h2>Solution Overview</h2><p>${esc(data.overview)}</p></div>`;
  }

  // Enablers
  if (data.enablers && Array.isArray(data.enablers) && data.enablers.length > 0) {
    html += `<div class="content-section"><h2>Key Enablers</h2>`;
    for (const e of data.enablers) {
      const badgeClass = (e.priority || '').toLowerCase() === 'high' ? 'badge-critical'
        : (e.priority || '').toLowerCase() === 'medium' ? 'badge-high'
        : 'badge-medium';

      html += `<div class="enabler-card">
        <div class="enabler-header">
          <div>
            <span class="enabler-title">${esc(e.title)}</span>
            ${e.domain ? `<div class="enabler-domain">${esc(e.domain)}</div>` : ''}
          </div>
          <span class="badge ${badgeClass}">${esc(e.priority)}</span>
        </div>
        <p>${esc(e.description)}</p>
        ${e.dependencies && e.dependencies.length > 0 ? `<div class="deps-list"><strong>Dependencies:</strong> ${e.dependencies.map((d: string) => `<span>${esc(d)}</span>`).join('')}</div>` : ''}
      </div>`;
    }
    html += `</div>`;
  }

  // Implementation path
  if (data.implementationPath && Array.isArray(data.implementationPath) && data.implementationPath.length > 0) {
    html += `<div class="content-section"><h2>Implementation Roadmap</h2>`;
    for (const phase of data.implementationPath) {
      html += `<div class="roadmap-phase">
        <h4>${esc(phase.phase)}</h4>
        <div class="phase-timeframe">${esc(phase.timeframe)}</div>`;

      if (phase.actions && phase.actions.length > 0) {
        html += `<p><strong>Actions:</strong></p><ul style="margin-left:1.5rem">`;
        for (const a of phase.actions) {
          html += `<li>${esc(a)}</li>`;
        }
        html += `</ul>`;
      }

      if (phase.outcomes && phase.outcomes.length > 0) {
        html += `<p style="margin-top:0.5rem"><strong>Expected Outcomes:</strong></p><ul style="margin-left:1.5rem">`;
        for (const o of phase.outcomes) {
          html += `<li>${esc(o)}</li>`;
        }
        html += `</ul>`;
      }

      html += `</div>`;
    }
    html += `</div>`;
  }

  return html || '<div class="content-section"><p>No solution data available.</p></div>';
}

/* ================================================================
   6. COMMERCIAL
   ================================================================ */

function renderCommercial(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No commercial content available.</p></div>';
  }

  let html = '';

  // Investment Summary
  if (data.investmentSummary) {
    const inv = data.investmentSummary;
    html += `<div class="metrics-grid">
      <div class="metric-card blue">
        <div class="metric-value">${esc(inv.totalInvestment)}</div>
        <div class="metric-label">Total Investment</div>
      </div>
      <div class="metric-card green">
        <div class="metric-value">${esc(inv.fiveYearROI)}</div>
        <div class="metric-label">5-Year ROI</div>
      </div>
      <div class="metric-card orange">
        <div class="metric-value">${esc(inv.paybackPeriod)}</div>
        <div class="metric-label">Payback Period</div>
      </div>
      <div class="metric-card purple">
        <div class="metric-value">${esc(inv.annualSavings)}</div>
        <div class="metric-label">Annual Savings</div>
      </div>
    </div>`;
  }

  // Delivery Phases
  if (data.deliveryPhases && Array.isArray(data.deliveryPhases) && data.deliveryPhases.length > 0) {
    html += `<div class="content-section"><h2>Delivery Phases</h2><div class="phase-timeline">`;
    for (const phase of data.deliveryPhases) {
      html += `<div class="phase-item">
        <h4>${esc(phase.phase)}</h4>
        <div class="phase-meta">${esc(phase.duration)} &middot; ${esc(phase.investment)}</div>`;

      if (phase.scope && phase.scope.length > 0) {
        html += `<p><strong>Scope:</strong></p><ul style="margin-left:1.5rem">`;
        for (const s of phase.scope) { html += `<li>${esc(s)}</li>`; }
        html += `</ul>`;
      }

      if (phase.outcomes && phase.outcomes.length > 0) {
        html += `<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:0.75rem;border-radius:0 8px 8px 0;margin-top:0.75rem">
          <p style="color:#166534;font-weight:600">Expected Outcomes:</p><ul style="margin-left:1.5rem">`;
        for (const o of phase.outcomes) { html += `<li style="color:#166534">${esc(o)}</li>`; }
        html += `</ul></div>`;
      }

      html += `</div>`;
    }
    html += `</div></div>`;
  }

  // Risk Assessment
  if (data.riskAssessment && Array.isArray(data.riskAssessment) && data.riskAssessment.length > 0) {
    html += `<div class="content-section"><h2>Risk Assessment</h2>
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

  return html || '<div class="content-section"><p>No commercial data available.</p></div>';
}

/* ================================================================
   7. CUSTOMER JOURNEY
   ================================================================ */

function renderCustomerJourney(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No customer journey data available.</p></div>';
  }

  let html = '';

  const stages: string[] = data.stages || [];
  const actors: any[] = data.actors || [];
  const interactions: any[] = data.interactions || [];

  if (stages.length > 0 && actors.length > 0) {
    html += `<div class="content-section" style="overflow-x:auto">
      <h2>Customer Journey Map</h2>
      <table class="journey-grid">
        <thead><tr>
          <th>Actor</th>
          ${stages.map((s: string) => `<th>${esc(s)}</th>`).join('')}
        </tr></thead>
        <tbody>`;

    for (const actor of actors) {
      html += `<tr><td>${esc(actor.name)}<br><span style="font-weight:normal;font-size:0.75rem;color:#6b7280">${esc(actor.role)}</span></td>`;
      for (const stage of stages) {
        const interaction = interactions.find((i: any) => i.actor === actor.name && i.stage === stage);
        if (interaction) {
          const sentClass = interaction.sentiment === 'positive' ? 'sentiment-positive'
            : interaction.sentiment === 'concerned' ? 'sentiment-concerned-cell'
            : interaction.sentiment === 'critical' ? 'sentiment-critical'
            : 'sentiment-neutral-cell';
          html += `<td class="${sentClass}">
            <div class="journey-cell">
              <div class="action">${esc(interaction.action)}</div>
              ${interaction.context ? `<div class="context">${esc(interaction.context)}</div>` : ''}
              ${interaction.isPainPoint ? '<div class="pain-point-marker">&#9888; Pain Point</div>' : ''}
              ${interaction.isMomentOfTruth ? '<div class="mot-marker">&#9733; Moment of Truth</div>' : ''}
            </div>
          </td>`;
        } else {
          html += `<td>-</td>`;
        }
      }
      html += `</tr>`;
    }

    html += `</tbody></table></div>`;
  }

  // Pain point summary
  if (data.painPointSummary) {
    html += `<div class="content-section" style="border-left:4px solid #ef4444">
      <h2>Pain Point Summary</h2>
      <p>${esc(data.painPointSummary)}</p>
    </div>`;
  }

  // Moment of truth summary
  if (data.momentOfTruthSummary) {
    html += `<div class="content-section" style="border-left:4px solid #eab308">
      <h2>Moments of Truth</h2>
      <p>${esc(data.momentOfTruthSummary)}</p>
    </div>`;
  }

  return html || '<div class="content-section"><p>No customer journey data available.</p></div>';
}

/* ================================================================
   8. SUMMARY
   ================================================================ */

function renderSummary(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No summary available.</p></div>';
  }

  let html = '';

  // Key Findings by category
  if (data.keyFindings && Array.isArray(data.keyFindings) && data.keyFindings.length > 0) {
    html += `<div class="content-section"><h2>Key Findings</h2>`;
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
    html += `<div class="content-section"><h2>Recommended Next Steps</h2>
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
    html += `<div class="content-section"><h2>Success Metrics</h2>
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

  return html || '<div class="content-section"><p>No summary data available.</p></div>';
}
