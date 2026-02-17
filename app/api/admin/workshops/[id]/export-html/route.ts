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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    // Get workshop with scratchpad and organization
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

    // Generate static HTML package
    const htmlPackage = await generateStaticHTMLPackage(workshop);

    // Create ZIP file
    const zip = new JSZip();

    // Add all files to ZIP
    Object.entries(htmlPackage.files).forEach(([filename, content]) => {
      zip.file(filename, content);
    });

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    // Generate filename
    const slug = workshop.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `${slug}-report.zip`;

    // Return ZIP file
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

/**
 * Generate complete static HTML package
 */
async function generateStaticHTMLPackage(workshop: any) {
  const scratchpad = workshop.scratchpad;
  const organization = workshop.organization;

  // Extract data
  const execSummary = scratchpad.execSummary || {};
  const discoveryOutput = scratchpad.discoveryOutput || {};
  const reimagineContent = scratchpad.reimagineContent || {};
  const constraintsContent = scratchpad.constraintsContent || {};
  const commercialContent = scratchpad.commercialContent || {};
  const summaryContent = scratchpad.summaryContent || {};

  // Organization branding
  const orgName = organization.name;
  const primaryColor = organization.primaryColor || '#1E40AF';
  const secondaryColor = organization.secondaryColor || '#3B82F6';
  const logo = organization.logo || '';

  const files: Record<string, string> = {};

  // ============================================
  // MAIN CSS FILE
  // ============================================
  files['assets/styles.css'] = generateCSS(primaryColor, secondaryColor);

  // ============================================
  // INDEX.HTML - Main Navigation Page
  // ============================================
  files['index.html'] = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${workshop.name} - Workshop Report</title>
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <header class="report-header">
    ${logo ? `<img src="${logo}" alt="${orgName}" class="org-logo">` : `<h1>${orgName}</h1>`}
    <h2>${workshop.name}</h2>
  </header>

  <nav class="report-nav">
    <a href="executive-summary.html" class="nav-item">Executive Summary</a>
    <a href="discovery-output.html" class="nav-item">Discovery Output</a>
    <a href="reimagine.html" class="nav-item">Reimagine</a>
    <a href="constraints.html" class="nav-item">Constraints</a>
    <a href="commercial.html" class="nav-item">Commercial</a>
    <a href="summary.html" class="nav-item">Summary</a>
  </nav>

  <main class="report-main">
    <div class="welcome-card">
      <h1>Workshop Report</h1>
      <p>This report contains insights and outputs from the ${workshop.name} workshop.</p>
      <p>Use the navigation above to explore different sections of the report.</p>
      <p class="report-date">Generated: ${new Date().toLocaleDateString()}</p>
    </div>
  </main>

  <footer class="report-footer">
    <p>&copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.</p>
  </footer>
</body>
</html>`;

  // ============================================
  // EXECUTIVE SUMMARY
  // ============================================
  files['executive-summary.html'] = generatePageHTML(
    'Executive Summary',
    workshop.name,
    orgName,
    logo,
    renderExecutiveSummary(execSummary)
  );

  // ============================================
  // DISCOVERY OUTPUT
  // ============================================
  files['discovery-output.html'] = generatePageHTML(
    'Discovery Output',
    workshop.name,
    orgName,
    logo,
    renderDiscoveryOutput(discoveryOutput)
  );

  // ============================================
  // REIMAGINE
  // ============================================
  files['reimagine.html'] = generatePageHTML(
    'Reimagine',
    workshop.name,
    orgName,
    logo,
    renderReimag(reimagineContent)
  );

  // ============================================
  // CONSTRAINTS
  // ============================================
  files['constraints.html'] = generatePageHTML(
    'Constraints',
    workshop.name,
    orgName,
    logo,
    renderConstraints(constraintsContent)
  );

  // ============================================
  // COMMERCIAL
  // ============================================
  files['commercial.html'] = generatePageHTML(
    'Commercial',
    workshop.name,
    orgName,
    logo,
    renderCommercial(commercialContent),
    true // Password protected
  );

  // ============================================
  // SUMMARY
  // ============================================
  files['summary.html'] = generatePageHTML(
    'Summary',
    workshop.name,
    orgName,
    logo,
    renderSummary(summaryContent)
  );

  // ============================================
  // README
  // ============================================
  files['README.txt'] = `
${workshop.name} - Workshop Report
===============================================

This package contains a complete, self-contained workshop report
that can be uploaded to your website.

CONTENTS:
---------
- index.html          : Main navigation page
- executive-summary.html
- discovery-output.html
- reimagine.html
- constraints.html
- commercial.html     : Password protected
- summary.html
- assets/styles.css   : Styling

HOW TO DEPLOY:
--------------
1. Extract this ZIP file
2. Upload all files to your web server
   (e.g., acme-corp.upstreamworks.com)
3. Ensure folder structure is maintained
4. Navigate to index.html

NOTES:
------
- No external dependencies required
- Works offline
- Fully white-labeled (no references to external systems)
- Mobile responsive

Generated: ${new Date().toISOString()}
Workshop: ${workshop.name}
Organization: ${orgName}
`;

  return { files };
}

/**
 * Generate base page HTML with navigation
 */
function generatePageHTML(
  title: string,
  workshopName: string,
  orgName: string,
  logo: string,
  content: string,
  passwordProtected: boolean = false
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${workshopName}</title>
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <header class="report-header">
    ${logo ? `<img src="${logo}" alt="${orgName}" class="org-logo">` : `<h1>${orgName}</h1>`}
    <h2>${workshopName}</h2>
  </header>

  <nav class="report-nav">
    <a href="index.html" class="nav-item">Home</a>
    <a href="executive-summary.html" class="nav-item ${title === 'Executive Summary' ? 'active' : ''}">Executive Summary</a>
    <a href="discovery-output.html" class="nav-item ${title === 'Discovery Output' ? 'active' : ''}">Discovery Output</a>
    <a href="reimagine.html" class="nav-item ${title === 'Reimagine' ? 'active' : ''}">Reimagine</a>
    <a href="constraints.html" class="nav-item ${title === 'Constraints' ? 'active' : ''}">Constraints</a>
    <a href="commercial.html" class="nav-item ${title === 'Commercial' ? 'active' : ''}">Commercial</a>
    <a href="summary.html" class="nav-item ${title === 'Summary' ? 'active' : ''}">Summary</a>
  </nav>

  <main class="report-main">
    <h1 class="page-title">${title}</h1>
    ${passwordProtected ? '<p class="password-note">⚠️ Note: This section contains sensitive commercial information.</p>' : ''}
    ${content}
  </main>

  <footer class="report-footer">
    <p>&copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.</p>
  </footer>
</body>
</html>`;
}

/**
 * Generate CSS with client branding
 */
function generateCSS(primaryColor: string, secondaryColor: string): string {
  return `
/* Workshop Report Styles - Self-Contained */
:root {
  --primary-color: ${primaryColor};
  --secondary-color: ${secondaryColor};
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: #333;
  background: #f5f5f5;
}

.report-header {
  background: white;
  padding: 2rem;
  border-bottom: 3px solid var(--primary-color);
  text-align: center;
}

.org-logo {
  max-width: 200px;
  max-height: 80px;
  margin-bottom: 1rem;
}

.report-header h2 {
  color: var(--primary-color);
  font-size: 1.5rem;
}

.report-nav {
  background: var(--primary-color);
  padding: 1rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.nav-item {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background 0.3s;
}

.nav-item:hover {
  background: var(--secondary-color);
}

.nav-item.active {
  background: var(--secondary-color);
  font-weight: bold;
}

.report-main {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.page-title {
  font-size: 2rem;
  color: var(--primary-color);
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--secondary-color);
}

.welcome-card {
  background: white;
  padding: 3rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  text-align: center;
}

.welcome-card h1 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.report-date {
  color: #666;
  font-size: 0.9rem;
  margin-top: 1rem;
}

.password-note {
  background: #fff3cd;
  border-left: 4px solid #ffc107;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border-radius: 4px;
}

.content-section {
  background: white;
  padding: 2rem;
  margin-bottom: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.content-section h2 {
  color: var(--primary-color);
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e5e5;
}

.content-section h3 {
  color: var(--secondary-color);
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

.report-footer {
  background: #333;
  color: white;
  text-align: center;
  padding: 2rem;
  margin-top: 3rem;
}

/* Responsive */
@media (max-width: 768px) {
  .report-nav {
    flex-direction: column;
  }

  .nav-item {
    width: 100%;
    text-align: center;
  }

  .report-main {
    padding: 0 0.5rem;
  }

  .welcome-card {
    padding: 1.5rem;
  }
}

/* Print Styles */
@media print {
  .report-nav {
    display: none;
  }

  .report-main {
    max-width: 100%;
  }
}
`;
}

/**
 * Render Executive Summary content
 */
function renderExecutiveSummary(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No executive summary available.</p></div>';
  }

  return `
<div class="content-section">
  <h2>Vision Statement</h2>
  <p>${data.vision || 'No vision statement provided.'}</p>

  <h2>Strategic Shifts</h2>
  ${data.strategicShifts ? `<p>${data.strategicShifts}</p>` : '<p>No strategic shifts defined.</p>'}

  <h2>Today's Challenge</h2>
  <p>${data.todaysChallenge || 'No challenge statement provided.'}</p>

  <h2>Future State Principles</h2>
  ${data.futureStatePrinciples ? `<p>${data.futureStatePrinciples}</p>` : '<p>No principles defined.</p>'}
</div>
`;
}

/**
 * Render Discovery Output content
 */
function renderDiscoveryOutput(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No discovery output available.</p></div>';
  }

  return `
<div class="content-section">
  <h2>Discovery Output</h2>
  <p>${JSON.stringify(data, null, 2)}</p>
</div>
`;
}

/**
 * Render Reimagine content
 */
function renderReimag(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No reimagine content available.</p></div>';
  }

  return `
<div class="content-section">
  <h2>Reimagine Content</h2>
  <p>${JSON.stringify(data, null, 2)}</p>
</div>
`;
}

/**
 * Render Constraints content
 */
function renderConstraints(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No constraints defined.</p></div>';
  }

  return `
<div class="content-section">
  <h2>Constraints</h2>
  <p>${JSON.stringify(data, null, 2)}</p>
</div>
`;
}

/**
 * Render Commercial content
 */
function renderCommercial(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No commercial content available.</p></div>';
  }

  return `
<div class="content-section">
  <h2>Commercial Information</h2>
  <p>${JSON.stringify(data, null, 2)}</p>
</div>
`;
}

/**
 * Render Summary content
 */
function renderSummary(data: any): string {
  if (!data || Object.keys(data).length === 0) {
    return '<div class="content-section"><p>No summary available.</p></div>';
  }

  return `
<div class="content-section">
  <h2>Summary</h2>
  <p>${JSON.stringify(data, null, 2)}</p>
</div>
`;
}
