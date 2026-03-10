/**
 * POST /api/admin/workshops/[id]/export-pdf
 *
 * Generates a professional PDF of the Download Report using the facilitator's
 * chosen layout (section order, enabled/disabled sections, excluded items,
 * custom sections with text and images).
 *
 * Uses @sparticuz/chromium + puppeteer-core (same infrastructure as the
 * existing discovery-report PDF generator).
 */

import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import type {
  ReportSummary,
  ReportLayout,
  ReportSectionConfig,
} from '@/lib/output-intelligence/types';
import type { WorkshopOutputIntelligence } from '@/lib/output-intelligence/types';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── Logo helpers ──────────────────────────────────────────────────────────────

function readLogoAsBase64(relativePath: string): string | null {
  try {
    const absPath = path.join(process.cwd(), 'public', relativePath);
    const buf = fs.readFileSync(absPath);
    const ext = path.extname(relativePath).slice(1).toLowerCase().replace('jpg', 'jpeg');
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

async function fetchLogoAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'image/png';
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

interface ExportPdfBody {
  reportSummary: ReportSummary;
  intelligence: WorkshopOutputIntelligence;
  layout: ReportLayout;
  liveJourneyData?: LiveJourneyData | null;
  workshopName?: string;
  orgName?: string;
}

// ── Colour helpers ────────────────────────────────────────────────────────────

const SENTIMENT_COLORS: Record<string, string> = {
  critical:  '#fee2e2',
  concerned: '#fef3c7',
  positive:  '#dcfce7',
  neutral:   '#f1f5f9',
};
const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical:    { bg: '#fee2e2', text: '#b91c1c' },
  significant: { bg: '#fef3c7', text: '#b45309' },
  moderate:    { bg: '#f1f5f9', text: '#475569' },
};

// ── HTML builder helpers ──────────────────────────────────────────────────────

function esc(s: string): string {
  return (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function isExcluded(config: ReportSectionConfig, id: string): boolean {
  return config.excludedItems.includes(id);
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderExecutiveSummary(summary: ReportSummary, cfg: ReportSectionConfig): string {
  const es = summary.executiveSummary;
  const ss = summary.solutionSummary;

  const findings = (es.whatWeFound ?? [])
    .filter((_, i) => !isExcluded(cfg, `finding:${i}`))
    .map((f, i) => `
      <div class="finding-item">
        <span class="finding-num">${i + 1}</span>
        <p>${esc(f)}</p>
      </div>`).join('');

  const lensRows = (es.lensFindings ?? [])
    .filter(lf => !isExcluded(cfg, `lens:${lf.lens}`))
    .map(lf => `
      <div class="lens-row">
        <div class="lens-name">${esc(lf.lens)}</div>
        <div class="lens-finding">${esc(lf.finding)}</div>
      </div>`).join('');

  const qaBlock = !isExcluded(cfg, 'qa') ? `
    <div class="qa-card">
      <div class="qa-question">${esc(es.theAsk ?? '')}</div>
      <div class="qa-answer">${esc(es.theAnswer ?? '')}</div>
      <div class="qa-urgency">${esc(es.urgency ?? '')}</div>
    </div>` : '';

  const transformDir = !isExcluded(cfg, 'transformation') ? `
    <div class="transform-block">
      <div class="transform-label">Transformation Direction</div>
      <div>${esc(summary.transformationDirection ?? '')}</div>
    </div>` : '';

  const solutionBlock = ss && !isExcluded(cfg, 'solution') ? `
    <div class="solution-card">
      <div class="sol-title">${esc(ss.direction ?? '')}</div>
      <div class="sol-rationale">${esc(ss.rationale ?? '')}</div>
      ${(ss.successIndicators ?? []).filter((_, i) => !isExcluded(cfg, `benefit:${i}`)).map((b: string) => `<div class="sol-benefit">✓ ${esc(b)}</div>`).join('')}
    </div>` : '';

  return `
    <section class="report-section">
      <h2 class="section-title">Executive Summary</h2>
      ${qaBlock}
      ${findings ? `<div class="findings-list">${findings}</div>` : ''}
      ${lensRows ? `<div class="lens-grid">${lensRows}</div>` : ''}
      ${transformDir}
      ${solutionBlock}
    </section>`;
}

function renderSupportingEvidence(intelligence: WorkshopOutputIntelligence, cfg: ReportSectionConfig): string {
  const { discoveryValidation } = intelligence;

  const confirmed = (discoveryValidation.confirmedIssues ?? [])
    .filter((_, i) => !isExcluded(cfg, `confirmed:${i}`))
    .map(ci => `
      <div class="evidence-row">
        <span class="confidence-badge ${ci.confidence}">${esc(ci.confidence)}</span>
        <div>
          <div class="evidence-issue">${esc(ci.issue)}</div>
          <div class="evidence-ev">${esc(ci.workshopEvidence)}</div>
        </div>
      </div>`).join('');

  const newIssues = (discoveryValidation.newIssues ?? [])
    .filter((_, i) => !isExcluded(cfg, `new:${i}`))
    .map(ni => `
      <div class="evidence-row">
        <span class="confidence-badge new">new</span>
        <div>
          <div class="evidence-issue">${esc(ni.issue)}</div>
          <div class="evidence-ev">${esc(ni.workshopEvidence)}</div>
          <div class="evidence-sig">→ ${esc(ni.significance)}</div>
        </div>
      </div>`).join('');

  return `
    <section class="report-section">
      <h2 class="section-title">Supporting Evidence</h2>
      <div class="evidence-card">
        <div class="evidence-header">
          Confirmed Issues
          <span class="badge-muted">Hypothesis accuracy: ${discoveryValidation.hypothesisAccuracy}%</span>
        </div>
        ${confirmed || '<p class="empty-msg">No confirmed issues recorded.</p>'}
      </div>
      ${newIssues ? `
      <div class="evidence-card new-issues">
        <div class="evidence-header new">New Issues — Surfaced in Workshop</div>
        ${newIssues}
      </div>` : ''}
    </section>`;
}

function renderRootCauses(intelligence: WorkshopOutputIntelligence, cfg: ReportSectionConfig): string {
  const { rootCause } = intelligence;

  const causes = (rootCause.rootCauses ?? [])
    .filter(rc => !isExcluded(cfg, `cause:${rc.rank}`))
    .map(rc => {
      const col = SEVERITY_COLORS[rc.severity] ?? SEVERITY_COLORS.moderate;
      return `
        <div class="cause-card">
          <div class="cause-meta">
            <span class="cause-rank">#${rc.rank}</span>
            <span class="cause-sev" style="background:${col.bg};color:${col.text}">${esc(rc.severity)}</span>
          </div>
          <div class="cause-body">
            <div class="cause-title">${esc(rc.cause)}</div>
            <div class="cause-cat">${esc(rc.category)}</div>
            ${(rc.evidence ?? []).slice(0, 2).map(e => `<div class="cause-ev">• ${esc(e)}</div>`).join('')}
          </div>
        </div>`;
    }).join('');

  return `
    <section class="report-section">
      <h2 class="section-title">Root Causes</h2>
      <div class="systemic-pattern">${esc(rootCause.systemicPattern ?? '')}</div>
      <div class="cause-list">${causes}</div>
    </section>`;
}

function renderSolutionDirection(summary: ReportSummary, intelligence: WorkshopOutputIntelligence, cfg: ReportSectionConfig): string {
  const ss = summary.solutionSummary;
  const { futureState, roadmap } = intelligence;

  const steps = (ss.whatMustChange ?? [])
    .filter((_, i) => !isExcluded(cfg, `step:${i}`))
    .map((s, i) => `<div class="step-item"><span class="step-num">${i + 1}</span><div><strong>${esc(s.area)}</strong><br/><span class="step-change">${esc(s.requiredChange)}</span></div></div>`).join('');

  const phases = (roadmap?.phases ?? [])
    .filter((_, i) => !isExcluded(cfg, `phase:${i}`))
    .map(p => `
      <div class="phase-card">
        <div class="phase-name">${esc(p.phase ?? '')}</div>
        <div class="phase-horizon">${esc(p.timeframe ?? '')}</div>
        ${(p.initiatives ?? []).slice(0, 3).map(a => `<div class="phase-action">• ${esc(a.title)}</div>`).join('')}
      </div>`).join('');

  return `
    <section class="report-section">
      <h2 class="section-title">Solution Direction</h2>
      <div class="sol-vision">${esc(ss.direction ?? '')}</div>
      <p class="sol-rationale-text">${esc(ss.rationale ?? '')}</p>
      ${steps ? `<div class="step-list">${steps}</div>` : ''}
      ${phases ? `<div class="phases-grid">${phases}</div>` : ''}
    </section>`;
}

function renderJourneyMap(journey: LiveJourneyData, intro: string | undefined, cfg: ReportSectionConfig): string {
  const stageHeaders = journey.stages.map(s => `<th class="stage-th">${esc(s)}</th>`).join('');

  const rows = journey.actors.map(actor => {
    const cells = journey.stages.map(stage => {
      const interactions = journey.interactions.filter(
        i => i.actor.toLowerCase() === actor.name.toLowerCase() &&
             i.stage.toLowerCase() === stage.toLowerCase()
      );
      const chips = interactions.map(int => {
        const bg = SENTIMENT_COLORS[int.sentiment] ?? '#f1f5f9';
        return `<div class="journey-chip" style="background:${bg}">
          ${int.isPainPoint ? '<span class="pain-dot">●</span>' : ''}
          ${esc(int.action.slice(0, 60))}${int.action.length > 60 ? '…' : ''}
        </div>`;
      }).join('');
      return `<td class="journey-td">${chips}</td>`;
    }).join('');

    return `<tr>
      <td class="actor-td">
        <div class="actor-name">${esc(actor.name)}</div>
        <div class="actor-role">${esc(actor.role)}</div>
      </td>
      ${cells}
    </tr>`;
  }).join('');

  return `
    <section class="report-section">
      <h2 class="section-title">Customer Journey</h2>
      ${intro ? `<p class="journey-intro">${esc(intro)}</p>` : ''}
      <div class="journey-table-wrap">
        <table class="journey-table">
          <thead>
            <tr>
              <th class="actor-th">Actor</th>
              ${stageHeaders}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function renderCustomSection(cfg: ReportSectionConfig): string {
  const content = cfg.customContent ?? {};
  return `
    <section class="report-section">
      <h2 class="section-title">${esc(cfg.title)}</h2>
      ${content.text ? `<p class="custom-text">${esc(content.text).replace(/\n/g, '<br>')}</p>` : ''}
      ${content.imageUrl ? `<div class="custom-image-wrap"><img src="${esc(content.imageUrl)}" alt="${esc(content.imageAlt ?? '')}" class="custom-image" /></div>` : ''}
    </section>`;
}

// ── Full HTML document ────────────────────────────────────────────────────────

function buildReportHtml(
  body: ExportPdfBody,
  dreamLogoBase64: string | null,
  tenantLogoBase64: string | null,
): string {
  const { reportSummary, intelligence, layout, liveJourneyData, workshopName, orgName } = body;

  const enabledSections = layout.sections.filter(s => s.enabled);

  // Table of contents entries
  const tocEntries = enabledSections.map((cfg, i) => `
    <div class="toc-row">
      <span class="toc-num">${i + 1}</span>
      <span class="toc-title">${esc(cfg.title)}</span>
      <span class="toc-dots"></span>
    </div>`).join('');

  const sectionsHtml = enabledSections.map(cfg => {
    if (cfg.type === 'custom') return renderCustomSection(cfg);
    switch (cfg.id) {
      case 'executive_summary':   return renderExecutiveSummary(reportSummary, cfg);
      case 'supporting_evidence': return renderSupportingEvidence(intelligence, cfg);
      case 'root_causes':         return renderRootCauses(intelligence, cfg);
      case 'solution_direction':  return renderSolutionDirection(reportSummary, intelligence, cfg);
      case 'journey_map':
        return liveJourneyData
          ? renderJourneyMap(liveJourneyData, reportSummary.journeyIntro, cfg)
          : '';
      default: return '';
    }
  }).join('\n');

  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(workshopName ?? 'Discovery Report')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background: white; }
  @page { size: A4; margin: 20mm 18mm; }

  /* Cover */
  .cover { page-break-after: always; min-height: 100vh; display: flex; flex-direction: column; padding: 0; }
  .cover-logos { display: flex; align-items: center; justify-content: space-between; padding: 32px 0 0; margin-bottom: auto; }
  .cover-logo-tenant { max-height: 48px; max-width: 160px; object-fit: contain; }
  .cover-logo-dream { max-height: 32px; max-width: 120px; object-fit: contain; opacity: 0.7; }
  .cover-body { padding: 80px 0 48px; border-top: 3px solid #111827; margin-top: auto; }
  .cover-tag { font-size: 9pt; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #6b7280; margin-bottom: 16px; }
  .cover-title { font-size: 28pt; font-weight: 800; line-height: 1.1; color: #111827; margin-bottom: 8px; }
  .cover-sub { font-size: 13pt; color: #6b7280; margin-bottom: 32px; }
  .cover-meta { font-size: 9pt; color: #9ca3af; }
  /* TOC */
  .toc-page { page-break-after: always; padding-top: 16px; }
  .toc-heading { font-size: 8pt; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #9ca3af; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 20px; }
  .toc-row { display: flex; align-items: baseline; gap: 6px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .toc-num { flex-shrink: 0; font-size: 9pt; font-weight: 700; color: #9ca3af; width: 20px; }
  .toc-title { font-size: 11pt; font-weight: 600; color: #111827; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #d1d5db; margin: 0 6px 4px; }

  /* Sections */
  .report-section { page-break-inside: avoid; margin-bottom: 32px; }
  .section-title { font-size: 8pt; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #9ca3af; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 16px; }

  /* Executive summary */
  .qa-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .qa-question { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 6px; }
  .qa-answer { font-size: 14pt; font-weight: 700; color: #111827; line-height: 1.3; margin-bottom: 8px; }
  .qa-urgency { font-size: 10pt; color: #475569; font-style: italic; }
  .validation-test { font-size: 9pt; color: #64748b; background: #f8fafc; border-left: 3px solid #cbd5e1; padding: 8px 12px; margin-bottom: 12px; border-radius: 0 4px 4px 0; }
  .findings-list { margin-bottom: 16px; }
  .finding-item { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  .finding-num { flex-shrink: 0; width: 20px; height: 20px; background: #1a1a1a; color: white; border-radius: 50%; font-size: 8pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .finding-item p { font-size: 10pt; color: #374151; line-height: 1.5; }
  .lens-grid { display: grid; grid-template-columns: 1fr; gap: 6px; margin-bottom: 16px; }
  .lens-row { display: grid; grid-template-columns: 140px 1fr; gap: 12px; background: #f8fafc; border-radius: 6px; padding: 8px 12px; }
  .lens-name { font-size: 9pt; font-weight: 700; color: #374151; }
  .lens-finding { font-size: 9pt; color: #6b7280; }
  .transform-block { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
  .transform-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #16a34a; margin-bottom: 4px; }
  .solution-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; }
  .sol-title { font-size: 12pt; font-weight: 700; color: #92400e; margin-bottom: 6px; }
  .sol-rationale { font-size: 9pt; color: #78350f; margin-bottom: 8px; }
  .sol-benefit { font-size: 9pt; color: #78350f; padding: 2px 0; }

  /* Supporting evidence */
  .evidence-card { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 12px; }
  .evidence-header { background: #f9fafb; padding: 8px 14px; font-size: 9pt; font-weight: 700; color: #374151; display: flex; justify-content: space-between; align-items: center; }
  .evidence-header.new { background: #eff6ff; color: #1d4ed8; }
  .badge-muted { font-size: 8pt; font-weight: 400; color: #9ca3af; }
  .evidence-row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 14px; border-top: 1px solid #f1f5f9; }
  .confidence-badge { flex-shrink: 0; padding: 1px 6px; border-radius: 4px; font-size: 8pt; font-weight: 600; }
  .confidence-badge.high { background: #fee2e2; color: #b91c1c; }
  .confidence-badge.medium { background: #fef3c7; color: #b45309; }
  .confidence-badge.low, .confidence-badge.new { background: #f1f5f9; color: #475569; }
  .evidence-issue { font-size: 9pt; font-weight: 600; color: #111827; }
  .evidence-ev { font-size: 8.5pt; color: #6b7280; margin-top: 2px; }
  .evidence-sig { font-size: 8.5pt; color: #2563eb; margin-top: 3px; font-weight: 500; }
  .empty-msg { padding: 10px 14px; font-size: 9pt; color: #9ca3af; font-style: italic; }

  /* Root causes */
  .systemic-pattern { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; font-size: 10pt; color: #374151; line-height: 1.6; margin-bottom: 16px; }
  .cause-list { display: grid; gap: 10px; }
  .cause-card { display: flex; gap: 12px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
  .cause-meta { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; padding-top: 2px; }
  .cause-rank { font-size: 9pt; font-weight: 700; color: #9ca3af; font-family: monospace; }
  .cause-sev { font-size: 7.5pt; font-weight: 600; padding: 2px 5px; border-radius: 4px; white-space: nowrap; }
  .cause-title { font-size: 10pt; font-weight: 600; color: #111827; margin-bottom: 2px; }
  .cause-cat { font-size: 8pt; color: #9ca3af; margin-bottom: 4px; }
  .cause-ev { font-size: 8.5pt; color: #6b7280; padding: 2px 0; }

  /* Solution direction */
  .sol-vision { font-size: 13pt; font-weight: 700; color: #111827; margin-bottom: 6px; }
  .sol-rationale-text { font-size: 10pt; color: #374151; line-height: 1.6; margin-bottom: 16px; }
  .step-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .step-item { display: flex; gap: 10px; align-items: flex-start; background: #f8fafc; border-radius: 6px; padding: 8px 12px; }
  .step-num { flex-shrink: 0; width: 20px; height: 20px; background: #111827; color: white; border-radius: 50%; font-size: 8pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .phases-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .phase-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
  .phase-name { font-size: 9pt; font-weight: 700; color: #111827; margin-bottom: 2px; }
  .phase-horizon { font-size: 8pt; color: #9ca3af; margin-bottom: 6px; }
  .phase-action { font-size: 8.5pt; color: #374151; padding: 1.5px 0; }

  /* Journey map */
  .journey-intro { font-size: 10pt; color: #374151; line-height: 1.6; margin-bottom: 14px; }
  .journey-table-wrap { overflow: hidden; border: 1px solid #e5e7eb; border-radius: 8px; }
  .journey-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  .actor-th { background: #f9fafb; padding: 6px 8px; text-align: left; font-weight: 700; color: #374151; border-right: 1px solid #e5e7eb; width: 90px; }
  .stage-th { background: #f9fafb; padding: 6px 8px; text-align: center; font-weight: 700; color: #374151; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.05em; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
  .actor-td { background: #fafafa; padding: 6px 8px; vertical-align: top; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #f1f5f9; }
  .actor-name { font-weight: 700; color: #111827; font-size: 8pt; }
  .actor-role { color: #9ca3af; font-size: 7pt; margin-top: 1px; }
  .journey-td { padding: 4px 5px; vertical-align: top; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; min-height: 36px; }
  .journey-chip { border-radius: 4px; padding: 3px 5px; margin-bottom: 3px; font-size: 7.5pt; color: #374151; line-height: 1.4; }
  .pain-dot { color: #ef4444; font-size: 8pt; margin-right: 2px; }

  /* Custom sections */
  .custom-text { font-size: 10pt; color: #374151; line-height: 1.7; white-space: pre-wrap; margin-bottom: 16px; }
  .custom-image-wrap { margin-top: 12px; }
  .custom-image { max-width: 100%; height: auto; border-radius: 6px; border: 1px solid #e5e7eb; }
</style>
</head>
<body>

<!-- Cover page -->
<div class="cover">
  <div class="cover-logos">
    ${tenantLogoBase64 ? `<img src="${tenantLogoBase64}" class="cover-logo-tenant" alt="${esc(orgName ?? 'Client')} logo" />` : `<div style="font-size:13pt;font-weight:700;color:#111827">${esc(orgName ?? '')}</div>`}
    ${dreamLogoBase64 ? `<img src="${dreamLogoBase64}" class="cover-logo-dream" alt="DREAM" />` : '<div style="font-size:10pt;font-weight:700;letter-spacing:0.1em;color:#9ca3af">DREAM</div>'}
  </div>
  <div class="cover-body">
    <div class="cover-tag">Discovery Report</div>
    <div class="cover-title">${esc(workshopName ?? 'Workshop')}</div>
    <div class="cover-sub">${esc(orgName ?? '')}</div>
    <div class="cover-meta">Prepared ${dateStr}</div>
  </div>
</div>

<!-- Table of Contents -->
<div class="toc-page">
  <div class="toc-heading">Contents</div>
  ${tocEntries}
</div>

${sectionsHtml}

</body>
</html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  const body = await request.json().catch(() => null) as ExportPdfBody | null;
  if (!body?.reportSummary || !body?.intelligence || !body?.layout) {
    return NextResponse.json({ error: 'Missing required fields: reportSummary, intelligence, layout' }, { status: 400 });
  }

  // ── Fetch workshop + org for logos ────────────────────────────────
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { name: true, organization: { select: { name: true, logoUrl: true } } },
  }).catch(() => null);

  const workshopName = body.workshopName ?? workshop?.name ?? 'Workshop';
  const orgName = body.orgName ?? workshop?.organization?.name ?? '';
  const orgLogoUrl = workshop?.organization?.logoUrl ?? null;

  // Load logos as base64 for embedding in HTML (no external requests from puppeteer)
  const dreamLogoBase64 = readLogoAsBase64('Dream.PNG');
  const tenantLogoBase64 = orgLogoUrl
    ? (orgLogoUrl.startsWith('http') ? await fetchLogoAsBase64(orgLogoUrl) : readLogoAsBase64(orgLogoUrl))
    : null;

  const enrichedBody = { ...body, workshopName, orgName };
  const html = buildReportHtml(enrichedBody, dreamLogoBase64, tenantLogoBase64);

  const footerTemplate = `
    <div style="width:100%;padding:0 18mm;display:flex;justify-content:space-between;align-items:center;font-size:8pt;color:#9ca3af;font-family:-apple-system,sans-serif;">
      <span>${esc(workshopName)} — ${esc(orgName)}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '18mm', left: '18mm', right: '18mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
    });

    const filename = `${(body.workshopName ?? 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-discovery-report.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('PDF generation failed:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 502 });
  } finally {
    await browser?.close().catch(() => {});
  }
}
