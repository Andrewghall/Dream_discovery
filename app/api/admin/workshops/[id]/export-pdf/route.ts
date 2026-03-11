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
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';

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
  clientLogoUrl?: string;   // Client logo for the cover page
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoveryOutput?: any;    // From scratchpad.discoveryOutput — for discovery_* sections
  discoverAnalysis?: DiscoverAnalysis; // Structural analysis data — for structural_* sections
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
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Executive Summary</div></div>
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
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Supporting Evidence</div></div>
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
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Root Causes</div></div>
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
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Solution Direction</div></div>
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
          ${esc(int.action.slice(0, 45))}${int.action.length > 45 ? '…' : ''}
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
    <section class="report-section journey-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Customer Journey</div></div>
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

function renderStrategicImpact(intelligence: WorkshopOutputIntelligence, cfg: ReportSectionConfig): string {
  const si = intelligence.strategicImpact;

  const statBoxes = [
    { id: 'automation', label: 'Automation Potential', pct: si.automationPotential.percentage, color: '#ede9fe', text: '#5b21b6' },
    { id: 'ai_assisted', label: 'AI-Assisted Work',    pct: si.aiAssistedWork.percentage,    color: '#e0e7ff', text: '#3730a3' },
    { id: 'human_only', label: 'Human-Only Work',      pct: si.humanOnlyWork.percentage,     color: '#d1fae5', text: '#065f46' },
  ].filter(s => !isExcluded(cfg, s.id));

  const gainRows = si.efficiencyGains.map(g => `
    <tr>
      <td class="gain-metric">${esc(g.metric)}</td>
      <td class="gain-est">${esc(g.estimated)}</td>
      <td class="gain-basis">${esc(g.basis)}</td>
    </tr>`).join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Strategic Impact</div></div>
      <div class="si-summary">${esc(si.businessCaseSummary)}</div>
      <p class="si-confidence">Confidence score: <strong>${si.confidenceScore}%</strong></p>
      ${statBoxes.length ? `<div class="si-stats">${statBoxes.map(s => `
        <div class="si-stat" style="background:${s.color};color:${s.text}">
          <div class="si-stat-pct">${s.pct}%</div>
          <div class="si-stat-label">${esc(s.label)}</div>
        </div>`).join('')}</div>` : ''}
      ${gainRows ? `
      <table class="gain-table">
        <thead><tr>
          <th class="gain-th">Metric</th>
          <th class="gain-th">Estimated</th>
          <th class="gain-th">Basis</th>
        </tr></thead>
        <tbody>${gainRows}</tbody>
      </table>` : ''}
    </section>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderDiscoveryDiagnostic(discoveryOutput: any): string {
  if (!discoveryOutput) return '';

  const DIAG_CARDS = [
    { key: 'operationalReality',         label: 'Operational Reality',       bg: '#eff6ff', border: '#bfdbfe', label_color: '#1e40af' },
    { key: 'organisationalMisalignment', label: 'Leadership Alignment Risk', bg: '#fff1f2', border: '#fecdd3', label_color: '#9f1239' },
    { key: 'systemicFriction',           label: 'Systemic Friction',         bg: '#fffbeb', border: '#fde68a', label_color: '#92400e' },
    { key: 'transformationReadiness',    label: 'Transformation Readiness',  bg: '#f0fdf4', border: '#bbf7d0', label_color: '#065f46' },
  ];

  const cards = DIAG_CARDS.map(({ key, label, bg, border, label_color }) => {
    const card = discoveryOutput[key] as { insight?: string; evidence?: string[] } | undefined;
    if (!card?.insight) return '';
    const evList = (card.evidence ?? []).slice(0, 2).map(e => `<li class="diag-ev">${esc(e)}</li>`).join('');
    return `
      <div class="diag-card" style="background:${bg};border-color:${border}">
        <div class="diag-label" style="color:${label_color}">${esc(label)}</div>
        <p class="diag-insight">${esc(card.insight)}</p>
        ${evList ? `<ul class="diag-ev-list">${evList}</ul>` : ''}
      </div>`;
  }).join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Discovery Diagnostic</div></div>
      ${discoveryOutput.finalDiscoverySummary ? `<p class="diag-summary">${esc(discoveryOutput.finalDiscoverySummary)}</p>` : ''}
      <div class="diag-grid">${cards}</div>
    </section>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderDiscoverySignals(discoveryOutput: any): string {
  if (!discoveryOutput?.sections?.length) return '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sectionRows = (discoveryOutput.sections as any[]).map(s => {
    const concerned = s.sentiment?.concerned ?? 0;
    const neutral = s.sentiment?.neutral ?? 0;
    const optimistic = s.sentiment?.optimistic ?? 0;
    return `
      <div class="sig-row">
        <div class="sig-meta">
          <span class="sig-icon">${esc(s.icon ?? '')}</span>
          <span class="sig-domain">${esc(s.domain)}</span>
          <span class="sig-consensus">${s.consensusLevel}% consensus</span>
        </div>
        <div class="sig-bar-wrap">
          <div class="sig-bar-seg sig-concerned" style="width:${concerned}%"></div>
          <div class="sig-bar-seg sig-neutral" style="width:${neutral}%"></div>
          <div class="sig-bar-seg sig-optimistic" style="width:${optimistic}%"></div>
        </div>
        <div class="sig-legend">
          <span class="sig-c">Concerned ${concerned}%</span>
          <span class="sig-n">Neutral ${neutral}%</span>
          <span class="sig-o">Optimistic ${optimistic}%</span>
        </div>
      </div>`;
  }).join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Discovery Signals</div></div>
      ${discoveryOutput._aiSummary ? `<p class="sig-summary">${esc(discoveryOutput._aiSummary)}</p>` : ''}
      <div class="sig-list">${sectionRows}</div>
    </section>`;
}

function renderInsightSummary(intelligence: WorkshopOutputIntelligence): string {
  const dv = intelligence.discoveryValidation;
  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Insight Map Summary</div></div>
      <p class="insight-summary-text">${esc(dv.summary)}</p>
      <div class="insight-stats">
        <div class="insight-stat"><div class="insight-stat-val indigo">${dv.hypothesisAccuracy}%</div><div class="insight-stat-label">Hypothesis Accuracy</div></div>
        <div class="insight-stat"><div class="insight-stat-val">${dv.confirmedIssues.length}</div><div class="insight-stat-label">Confirmed Issues</div></div>
        <div class="insight-stat"><div class="insight-stat-val blue">${dv.newIssues.length}</div><div class="insight-stat-label">New Issues Surfaced</div></div>
      </div>
    </section>`;
}

// ── Structural Analysis renderers ─────────────────────────────────────────────

function renderStructuralAlignment(discoverAnalysis: DiscoverAnalysis | undefined): string {
  if (!discoverAnalysis?.alignment?.cells?.length) return '';
  const divergent = [...discoverAnalysis.alignment.cells]
    .sort((a, b) => a.alignmentScore - b.alignmentScore)
    .slice(0, 12);
  const rows = divergent.map(cell => {
    const score = cell.alignmentScore;
    const color = score < -0.5 ? '#b91c1c' : score < 0 ? '#b45309' : '#065f46';
    return `<tr>
      <td class="struct-td">${esc(cell.theme)}</td>
      <td class="struct-td-muted">${esc(cell.actor)}</td>
      <td class="struct-td-score" style="color:${color}">${score.toFixed(2)}</td>
    </tr>`;
  }).join('');
  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Domain Misalignment</div></div>
      <p class="struct-subtitle">Top divergent actor × theme pairs — negative scores indicate misalignment</p>
      <div class="struct-table-wrap">
        <table class="struct-table">
          <thead>
            <tr class="struct-thead">
              <th class="struct-th">Theme</th>
              <th class="struct-th">Actor</th>
              <th class="struct-th-right">Score</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function renderStructuralNarrative(discoverAnalysis: DiscoverAnalysis | undefined): string {
  if (!discoverAnalysis?.narrative?.layers?.length) return '';
  const { layers } = discoverAnalysis.narrative;
  const LAYER_BG: Record<string, string> = {
    executive:   '#f5f3ff',
    operational: '#eff6ff',
    frontline:   '#f0fdf4',
  };
  const LAYER_BORDER: Record<string, string> = {
    executive:   '#ddd6fe',
    operational: '#bfdbfe',
    frontline:   '#bbf7d0',
  };
  const SENT_COLOR: Record<string, string> = {
    positive: '#065f46',
    negative: '#b91c1c',
    neutral:  '#6b7280',
    mixed:    '#b45309',
  };
  const cards = layers.map(layer => {
    const bg = LAYER_BG[layer.layer] ?? '#f9fafb';
    const border = LAYER_BORDER[layer.layer] ?? '#e5e7eb';
    const sentColor = SENT_COLOR[layer.dominantSentiment] ?? '#374151';
    const terms = layer.topTerms.slice(0, 5).map(t => `<div class="narr-term">${esc(t.term)}</div>`).join('');
    return `
      <div class="narr-card" style="background:${bg};border-color:${border}">
        <div class="narr-layer">${esc(layer.layer)}</div>
        <div class="narr-sentiment" style="color:${sentColor}">${esc(layer.dominantSentiment)}</div>
        <div class="narr-terms">${terms}</div>
      </div>`;
  }).join('');
  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Narrative Divergence</div></div>
      <p class="struct-subtitle">Language and sentiment differences across organisational layers</p>
      <div class="narr-grid">${cards}</div>
    </section>`;
}

function renderStructuralTensions(discoverAnalysis: DiscoverAnalysis | undefined): string {
  if (!discoverAnalysis?.tensions?.tensions?.length) return '';
  const tensions = discoverAnalysis.tensions.tensions.slice(0, 8);
  const SEV_BG: Record<string, string> = { critical: '#fee2e2', significant: '#fef3c7', moderate: '#f1f5f9' };
  const SEV_TEXT: Record<string, string> = { critical: '#b91c1c', significant: '#b45309', moderate: '#475569' };
  const items = tensions.map((t, i) => {
    const bg = SEV_BG[t.severity] ?? SEV_BG.moderate;
    const text = SEV_TEXT[t.severity] ?? SEV_TEXT.moderate;
    const viewpoints = t.viewpoints.slice(0, 2).map(vp =>
      `<div class="tension-vp"><span class="tension-actor">${esc(vp.actor)}</span> — ${esc(vp.position.slice(0, 80))}${vp.position.length > 80 ? '…' : ''}</div>`
    ).join('');
    return `
      <div class="tension-item">
        <div class="tension-rank">#${i + 1}</div>
        <div class="tension-body">
          <div class="tension-header">
            <span class="tension-topic">${esc(t.topic)}</span>
            <span class="tension-sev" style="background:${bg};color:${text}">${esc(t.severity)}</span>
          </div>
          ${viewpoints}
        </div>
      </div>`;
  }).join('');
  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Transformation Tensions</div></div>
      <p class="struct-subtitle">Ranked unresolved tensions — competing perspectives slowing transformation</p>
      <div class="tension-list">${items}</div>
    </section>`;
}

function renderStructuralBarriers(discoverAnalysis: DiscoverAnalysis | undefined): string {
  if (!discoverAnalysis?.constraints?.constraints?.length) return '';
  const sorted = [...discoverAnalysis.constraints.constraints]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);
  const SEV_BG: Record<string, string> = { critical: '#fee2e2', significant: '#fef3c7', moderate: '#f1f5f9' };
  const SEV_TEXT: Record<string, string> = { critical: '#b91c1c', significant: '#b45309', moderate: '#475569' };
  const rows = sorted.map(c => {
    const bg = SEV_BG[c.severity] ?? SEV_BG.moderate;
    const text = SEV_TEXT[c.severity] ?? SEV_TEXT.moderate;
    const desc = c.description.split(' ').slice(0, 10).join(' ') + (c.description.split(' ').length > 10 ? '…' : '');
    return `<tr>
      <td class="struct-td">${esc(desc)}</td>
      <td class="struct-td-muted">${esc(c.domain)}</td>
      <td class="struct-td"><span class="struct-sev" style="background:${bg};color:${text}">${esc(c.severity)}</span></td>
      <td class="struct-td-score">${c.weight}</td>
    </tr>`;
  }).join('');
  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Structural Barriers</div></div>
      <p class="struct-subtitle">Weighted constraints ranked by severity and frequency</p>
      <div class="struct-table-wrap">
        <table class="struct-table">
          <thead>
            <tr class="struct-thead">
              <th class="struct-th">Barrier</th>
              <th class="struct-th">Domain</th>
              <th class="struct-th">Severity</th>
              <th class="struct-th-right">Weight</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function renderStructuralConfidence(discoverAnalysis: DiscoverAnalysis | undefined): string {
  if (!discoverAnalysis?.confidence) return '';
  const { overall, byDomain, byLayer } = discoverAnalysis.confidence;
  const total = overall.certain + overall.hedging + overall.uncertain;
  if (total === 0) return '';
  const certainPct = Math.round((overall.certain / total) * 100);
  const hedgingPct = Math.round((overall.hedging / total) * 100);
  const uncertainPct = 100 - certainPct - hedgingPct;

  const domainRows = byDomain.slice(0, 8).map(d => {
    const dt = d.distribution.certain + d.distribution.hedging + d.distribution.uncertain;
    const cp = dt > 0 ? Math.round((d.distribution.certain / dt) * 100) : 0;
    const hp = dt > 0 ? Math.round((d.distribution.hedging / dt) * 100) : 0;
    const up = 100 - cp - hp;
    return `
      <div class="conf-row">
        <div class="conf-domain">${esc(d.domain)}</div>
        <div class="conf-bar-wrap">
          <div class="conf-seg conf-certain" style="width:${cp}%"></div>
          <div class="conf-seg conf-hedging" style="width:${hp}%"></div>
          <div class="conf-seg conf-uncertain" style="width:${up}%"></div>
        </div>
        <div class="conf-pct">${dt} responses</div>
      </div>`;
  }).join('');

  const layerRows = byLayer.map(l => {
    const lt = l.distribution.certain + l.distribution.hedging + l.distribution.uncertain;
    const cp = lt > 0 ? Math.round((l.distribution.certain / lt) * 100) : 0;
    const hp = lt > 0 ? Math.round((l.distribution.hedging / lt) * 100) : 0;
    const up = 100 - cp - hp;
    return `
      <div class="conf-row">
        <div class="conf-domain" style="text-transform:capitalize">${esc(l.layer)}</div>
        <div class="conf-bar-wrap">
          <div class="conf-seg conf-certain" style="width:${cp}%"></div>
          <div class="conf-seg conf-hedging" style="width:${hp}%"></div>
          <div class="conf-seg conf-uncertain" style="width:${up}%"></div>
        </div>
        <div class="conf-pct">${lt} responses</div>
      </div>`;
  }).join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Transformation Readiness</div></div>
      <p class="struct-subtitle">Certainty, hedging and uncertainty across domains — signals of organisational confidence to execute change</p>
      <div class="conf-overall">
        <div class="conf-bar-wrap conf-overall-bar">
          <div class="conf-seg conf-certain" style="width:${certainPct}%"></div>
          <div class="conf-seg conf-hedging" style="width:${hedgingPct}%"></div>
          <div class="conf-seg conf-uncertain" style="width:${uncertainPct}%"></div>
        </div>
        <div class="conf-legend">
          <span class="conf-leg-item conf-leg-certain">● ${certainPct}% certain</span>
          <span class="conf-leg-item conf-leg-hedging">● ${hedgingPct}% hedging</span>
          <span class="conf-leg-item conf-leg-uncertain">● ${uncertainPct}% uncertain</span>
        </div>
      </div>
      ${domainRows ? `<div class="conf-section-label">BY DOMAIN</div><div class="conf-list">${domainRows}</div>` : ''}
      ${layerRows ? `<div class="conf-section-label" style="margin-top:14px;">BY NARRATIVE LAYER</div><div class="conf-list">${layerRows}</div>` : ''}
    </section>`;
}

function renderSignalMap(reportSummary: ReportSummary, discoverAnalysis: DiscoverAnalysis | undefined): string {
  const imageUrl = reportSummary.signalMapImageUrl;
  const conf = discoverAnalysis?.confidence;
  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Discovery Signal Map</div></div>
      <p class="struct-subtitle">Distribution of signals across Aspiration, Enablers and Operational Friction — extracted from participant interviews</p>
      ${imageUrl ? `<div class="signal-map-img-wrap"><img src="${esc(imageUrl)}" class="signal-map-img" alt="Discovery Signal Map" /></div>` : `
      <div class="signal-map-placeholder">
        <p class="signal-map-note">Signal map image not yet captured. Visit the Organisational State tab to capture it.</p>
      </div>`}
      <div class="signal-map-legend">
        <div class="signal-map-legend-item"><span style="background:#a78bfa" class="legend-dot"></span>Aspiration — Vision &amp; Beliefs</div>
        <div class="signal-map-legend-item"><span style="background:#34d399" class="legend-dot"></span>Enablers — Actions &amp; Change</div>
        <div class="signal-map-legend-item"><span style="background:#f97316" class="legend-dot"></span>Friction — Constraints &amp; Barriers</div>
        <div class="signal-map-legend-item"><span style="background:#ef4444" class="legend-dot"></span>Constraint</div>
        <div class="signal-map-legend-item"><span style="background:#60a5fa" class="legend-dot"></span>Aligned signal</div>
        <div class="signal-map-legend-item"><span style="background:#94a3b8" class="legend-dot"></span>Participant view</div>
      </div>
      ${conf ? `<p class="signal-map-narrative">The signal distribution across the organisation shows confidence patterns where ${conf.overall.hedging > conf.overall.certain ? 'hedging language dominates' : 'certainty is present in key areas'}, with ${conf.byLayer?.[0]?.layer ?? 'executive'} layer showing distinct sentiment from frontline perspectives. These signals identify where alignment exists and where transformation friction is concentrated.</p>` : ''}
    </section>`;
}

function renderFacilitatorBackPage(reportSummary: ReportSummary, dreamLogoBase64: string | null): string {
  const fc = reportSummary.facilitatorContact;
  if (!fc && !dreamLogoBase64) return '';
  const name = fc?.name ?? '';
  const email = fc?.email ?? '';
  const phone = fc?.phone ?? '';
  const companyName = fc?.companyName ?? '';
  return `
    <div class="back-page">
      <div class="back-page-content">
        ${(fc?.companyLogoUrl || dreamLogoBase64) ? `
        <div class="back-logo-wrap">
          <img src="${esc(fc?.companyLogoUrl ?? dreamLogoBase64 ?? '')}" class="back-logo" alt="Logo" />
        </div>` : ''}
        <div class="back-divider"></div>
        <div class="back-heading">Get in touch</div>
        ${name ? `<div class="back-name">${esc(name)}</div>` : ''}
        ${companyName ? `<div class="back-company">${esc(companyName)}</div>` : ''}
        <div class="back-contacts">
          ${email ? `<div class="back-contact-item"><span class="back-contact-label">Email</span><span class="back-contact-value">${esc(email)}</span></div>` : ''}
          ${phone ? `<div class="back-contact-item"><span class="back-contact-label">Phone</span><span class="back-contact-value">${esc(phone)}</span></div>` : ''}
        </div>
        <div class="back-footer-note">This report was produced using the DREAM Discovery &amp; Transformation Platform</div>
      </div>
    </div>`;
}

function renderCustomSection(cfg: ReportSectionConfig): string {
  const content = cfg.customContent ?? {};
  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">${esc(cfg.title)}</div></div>
      ${content.text ? `<p class="custom-text">${esc(content.text).replace(/\n/g, '<br>')}</p>` : ''}
      ${content.imageUrl ? `<div class="custom-image-wrap"><img src="${esc(content.imageUrl)}" alt="${esc(content.imageAlt ?? '')}" class="custom-image" /></div>` : ''}
    </section>`;
}

// ── Chapter divider ───────────────────────────────────────────────────────────

function renderChapter(cfg: ReportSectionConfig): string {
  return `
    <div class="chapter-divider">
      <div class="chapter-accent"></div>
      <div class="chapter-label">${esc(cfg.title)}</div>
    </div>`;
}

// ── Conclusion section ────────────────────────────────────────────────────────

function renderConclusion(reportSummary: ReportSummary): string {
  const conclusion = reportSummary.reportConclusion;
  if (!conclusion) return '';

  const steps = conclusion.nextSteps
    .map((s, i) => `
      <div class="next-step-item">
        <div class="next-step-num">${i + 1}</div>
        <div class="next-step-content">
          <div class="next-step-title">${esc(s.title)}</div>
          <div class="next-step-desc">${esc(s.description)}</div>
        </div>
      </div>`)
    .join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">${esc('Summary &amp; Next Steps')}</div></div>
      <div class="conclusion-summary">${esc(conclusion.summary)}</div>
      <div class="next-steps-heading">Recommended Next Steps</div>
      <div class="next-step-list">${steps}</div>
    </section>`;
}

// ── Full HTML document ────────────────────────────────────────────────────────

function buildReportHtml(
  body: ExportPdfBody,
  dreamLogoBase64: string | null,
  tenantLogoBase64: string | null,
  clientLogoBase64: string | null,
): string {
  const { reportSummary, intelligence, layout, liveJourneyData, workshopName, orgName, discoveryOutput, discoverAnalysis } = body;

  const enabledSections = layout.sections.filter(s => s.enabled);

  // Table of contents entries — chapters shown as styled dividers, sections as numbered badges
  let tocNum = 0;
  const tocEntries = enabledSections.map((cfg) => {
    if (cfg.type === 'chapter') {
      return `<div class="toc-row toc-chapter">
        <span class="toc-chapter-marker">§</span>
        <span class="toc-chapter-title">${esc(cfg.title)}</span>
      </div>`;
    }
    tocNum++;
    return `<div class="toc-row">
      <span class="toc-num">${tocNum}</span>
      <span class="toc-title">${esc(cfg.title)}</span>
      <span class="toc-dots"></span>
    </div>`;
  }).join('');

  const sectionsHtml = enabledSections.map(cfg => {
    if (cfg.type === 'chapter') return renderChapter(cfg);
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
      case 'strategic_impact':
        return renderStrategicImpact(intelligence, cfg);
      case 'discovery_diagnostic':
        return renderDiscoveryDiagnostic(discoveryOutput);
      case 'discovery_signals':
        return renderDiscoverySignals(discoveryOutput);
      case 'insight_summary':
        return renderInsightSummary(intelligence);
      case 'structural_alignment':
        return renderStructuralAlignment(discoverAnalysis);
      case 'structural_narrative':
        return renderStructuralNarrative(discoverAnalysis);
      case 'structural_tensions':
        return renderStructuralTensions(discoverAnalysis);
      case 'structural_barriers':
        return renderStructuralBarriers(discoverAnalysis);
      case 'structural_confidence':
        return renderStructuralConfidence(discoverAnalysis);
      case 'discovery_signal_map':
        return renderSignalMap(reportSummary, discoverAnalysis);
      case 'facilitator_contact':
        return renderFacilitatorBackPage(reportSummary, dreamLogoBase64);
      case 'report_conclusion':
        return renderConclusion(reportSummary);
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; background: white; line-height: 1.7; padding: 0 12px; }
  @page { size: A4; }
  /* Journey map gets a full landscape page */
  @page landscape-page { size: A4 landscape; margin: 16mm 18mm 14mm; }

  /* ── Cover page ─────────────────────────────────────────────────────────── */
  .cover {
    page-break-after: always;
    min-height: 256mm;
    background: #ffffff;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    padding: 0 44px 40px;
    position: relative;
    overflow: hidden;
  }
  /* 5 px accent strip at top */
  .cover::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 5px;
    background: linear-gradient(90deg, #6366f1 0%, #818cf8 55%, #10b981 100%);
    border-radius: 8px 8px 0 0;
  }
  /* Subtle watermark dot — very faint */
  .cover::after {
    content: '';
    position: absolute;
    bottom: -40px; right: -40px;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%);
    pointer-events: none;
  }
  .cover-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: auto; padding-top: 44px; }
  .cover-client-name {
    font-size: 11pt;
    font-weight: 500;
    letter-spacing: 0.03em;
    color: #374151;
  }
  .cover-client-logo { max-height: 48px; max-width: 160px; object-fit: contain; }
  .cover-dream-logo { max-height: 36px; max-width: 140px; object-fit: contain; opacity: 0.8; }
  .cover-dream-wordmark { font-size: 11pt; font-weight: 800; letter-spacing: 0.2em; color: #374151; }

  .cover-body { padding-top: 68px; }
  .cover-eyebrow {
    font-size: 8.5pt;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #6366f1;
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .cover-eyebrow::after { content: ''; flex: 0 0 40px; height: 1px; background: #6366f1; }
  .cover-title {
    font-size: 30pt;
    font-weight: 800;
    line-height: 1.1;
    color: #0f172a;
    margin-bottom: 14px;
    letter-spacing: -0.02em;
  }
  .cover-subtitle {
    font-size: 12pt;
    font-weight: 400;
    color: #6b7280;
    margin-bottom: 40px;
    line-height: 1.5;
  }
  .cover-divider { width: 48px; height: 3px; background: #6366f1; border-radius: 2px; margin-bottom: 28px; }
  .cover-footer {
    margin-top: auto;
    padding-top: 28px;
    border-top: 1px solid #f1f5f9;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .cover-meta-label { font-size: 7.5pt; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px; }
  .cover-meta-value { font-size: 10pt; font-weight: 600; color: #374151; }
  .cover-prepared-by { text-align: right; }

  /* ── TOC ────────────────────────────────────────────────────────────────── */
  .toc-page { page-break-after: always; }
  .toc-hero {
    background: #0f172a;
    border-radius: 12px;
    padding: 28px 32px;
    margin-bottom: 28px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .toc-hero-sub { font-size: 8.5pt; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 8px; }
  .toc-hero-title { font-size: 20pt; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; line-height: 1.15; max-width: 320px; }
  .toc-hero-meta { text-align: right; flex-shrink: 0; }
  .toc-hero-meta-label { font-size: 7.5pt; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 3px; }
  .toc-hero-meta-value { font-size: 10pt; font-weight: 600; color: rgba(255,255,255,0.65); }
  .toc-list { margin-bottom: 24px; }
  .toc-row { display: flex; align-items: center; gap: 14px; padding: 13px 0; border-bottom: 1px solid #f1f5f9; }
  .toc-num { flex-shrink: 0; width: 28px; height: 28px; background: #0f172a; color: white; border-radius: 50%; font-size: 9pt; font-weight: 700; text-align: center; line-height: 28px; }
  .toc-title { font-size: 11.5pt; font-weight: 600; color: #111827; flex: 1; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #d1d5db; margin: 0 12px 4px; }
  .toc-chapter { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
  .toc-chapter-marker { flex-shrink: 0; width: 28px; height: 28px; background: #1e293b; color: rgba(255,255,255,0.7); border-radius: 6px; font-size: 10pt; font-weight: 700; text-align: center; line-height: 28px; }
  .toc-chapter-title { font-size: 10.5pt; font-weight: 700; color: #374151; }
  .toc-footer { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin-top: 4px; }
  .toc-footer p { font-size: 9.5pt; color: #6b7280; line-height: 1.65; }

  /* ── Journey map — full landscape page ─────────────────────────────────── */
  .journey-section { page: landscape-page; page-break-before: always; page-break-after: always; page-break-inside: avoid; }

  /* ── Section chrome ─────────────────────────────────────────────────────── */
  .report-section { margin-bottom: 28px; }
  /* Title bar stays with the first content item — never orphaned at page bottom */
  .section-title-bar { page-break-after: avoid; }
  /* Individual items avoid mid-card breaks */
  .cause-card, .evidence-row, .finding-item, .lens-row,
  .phase-card, .step-item, .next-step-item, .tension-item,
  .diag-card, .sig-row, .toc-row { page-break-inside: avoid; }
  .section-title-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #e5e7eb;
  }
  .section-accent { width: 4px; height: 22px; border-radius: 2px; background: #6366f1; flex-shrink: 0; }
  .section-title { font-size: 13pt; font-weight: 700; color: #111827; letter-spacing: -0.01em; }

  /* ── Executive summary ──────────────────────────────────────────────────── */
  .qa-card { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .qa-question { font-size: 9pt; font-weight: 500; color: #9ca3af; margin-bottom: 8px; line-height: 1.5; }
  .qa-answer { font-size: 12pt; font-weight: 700; color: #111827; line-height: 1.35; margin-bottom: 10px; }
  .qa-urgency { font-size: 10pt; color: #475569; font-style: italic; line-height: 1.5; }
  .findings-list { margin-bottom: 20px; }
  .finding-item { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  .finding-num { flex-shrink: 0; width: 22px; height: 22px; background: #0f172a; color: white; border-radius: 50%; font-size: 8pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .finding-item p { font-size: 10pt; color: #374151; line-height: 1.6; }
  .lens-grid { display: grid; grid-template-columns: 1fr; gap: 6px; margin-bottom: 20px; }
  .lens-row { display: grid; grid-template-columns: 150px 1fr; gap: 14px; background: #f8fafc; border-left: 3px solid #6366f1; border-radius: 0 8px 8px 0; padding: 9px 14px; }
  .lens-name { font-size: 9pt; font-weight: 700; color: #374151; }
  .lens-finding { font-size: 9pt; color: #6b7280; line-height: 1.5; }
  .transform-block { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; }
  .transform-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #16a34a; margin-bottom: 6px; }
  .solution-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px 18px; }
  .sol-title { font-size: 12pt; font-weight: 700; color: #92400e; margin-bottom: 8px; }
  .sol-rationale { font-size: 9.5pt; color: #78350f; margin-bottom: 10px; line-height: 1.6; }
  .sol-benefit { font-size: 9.5pt; color: #78350f; padding: 3px 0; }

  /* ── Supporting evidence ────────────────────────────────────────────────── */
  .evidence-card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
  .evidence-header { background: #f9fafb; padding: 10px 16px; font-size: 9pt; font-weight: 700; color: #374151; display: flex; justify-content: space-between; align-items: center; }
  .evidence-header.new { background: #eff6ff; color: #1d4ed8; }
  .badge-muted { font-size: 8pt; font-weight: 400; color: #9ca3af; }
  .evidence-row { display: flex; gap: 12px; align-items: flex-start; padding: 10px 16px; border-top: 1px solid #f1f5f9; }
  .confidence-badge { flex-shrink: 0; padding: 2px 7px; border-radius: 5px; font-size: 8pt; font-weight: 600; }
  .confidence-badge.high { background: #fee2e2; color: #b91c1c; }
  .confidence-badge.medium { background: #fef3c7; color: #b45309; }
  .confidence-badge.low, .confidence-badge.new { background: #f1f5f9; color: #475569; }
  .evidence-issue { font-size: 9.5pt; font-weight: 600; color: #111827; }
  .evidence-ev { font-size: 9pt; color: #6b7280; margin-top: 3px; line-height: 1.5; }
  .evidence-sig { font-size: 9pt; color: #2563eb; margin-top: 4px; font-weight: 500; }
  .empty-msg { padding: 12px 16px; font-size: 9pt; color: #9ca3af; font-style: italic; }

  /* ── Root causes ────────────────────────────────────────────────────────── */
  .systemic-pattern { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; font-size: 10.5pt; color: #374151; line-height: 1.7; margin-bottom: 20px; }
  .cause-list { display: grid; gap: 12px; }
  .cause-card { display: flex; gap: 14px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
  .cause-meta { display: flex; flex-direction: column; align-items: center; gap: 5px; flex-shrink: 0; padding-top: 2px; }
  .cause-rank { font-size: 9pt; font-weight: 700; color: #9ca3af; font-family: monospace; }
  .cause-sev { font-size: 7.5pt; font-weight: 600; padding: 2px 6px; border-radius: 5px; white-space: nowrap; }
  .cause-title { font-size: 10.5pt; font-weight: 600; color: #111827; margin-bottom: 3px; }
  .cause-cat { font-size: 8.5pt; color: #9ca3af; margin-bottom: 6px; }
  .cause-ev { font-size: 9pt; color: #6b7280; padding: 2px 0; line-height: 1.5; }

  /* ── Solution direction ─────────────────────────────────────────────────── */
  .sol-vision { font-size: 12pt; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.35; }
  .sol-rationale-text { font-size: 10.5pt; color: #374151; line-height: 1.7; margin-bottom: 20px; }
  .step-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
  .step-item { display: flex; gap: 12px; align-items: flex-start; background: #f8fafc; border-radius: 8px; padding: 10px 14px; }
  .step-num { flex-shrink: 0; width: 22px; height: 22px; background: #0f172a; color: white; border-radius: 50%; font-size: 8pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .step-change { font-size: 9.5pt; color: #6b7280; line-height: 1.5; }
  .phases-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; page-break-inside: avoid; }
  .phase-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; }
  .phase-name { font-size: 9.5pt; font-weight: 700; color: #111827; margin-bottom: 3px; }
  .phase-horizon { font-size: 8pt; color: #9ca3af; margin-bottom: 8px; font-weight: 500; }
  .phase-action { font-size: 9pt; color: #374151; padding: 2px 0; line-height: 1.5; }

  /* ── Journey map ────────────────────────────────────────────────────────── */
  .journey-intro { font-size: 10.5pt; color: #374151; line-height: 1.7; margin-bottom: 16px; }
  .journey-table-wrap { overflow: hidden; border: 1px solid #e5e7eb; border-radius: 10px; }
  .journey-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  .actor-th { background: #f9fafb; padding: 7px 9px; text-align: left; font-weight: 700; color: #374151; border-right: 1px solid #e5e7eb; width: 90px; }
  .stage-th { background: #f9fafb; padding: 7px 9px; text-align: center; font-weight: 700; color: #374151; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
  .actor-td { background: #fafafa; padding: 7px 9px; vertical-align: top; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #f1f5f9; }
  .actor-name { font-weight: 700; color: #111827; font-size: 8pt; }
  .actor-role { color: #9ca3af; font-size: 7pt; margin-top: 1px; }
  .journey-td { padding: 5px 6px; vertical-align: top; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; min-height: 36px; }
  .journey-chip { border-radius: 4px; padding: 2px 5px; margin-bottom: 2px; font-size: 7pt; color: #374151; line-height: 1.4; }
  .pain-dot { color: #ef4444; font-size: 8pt; margin-right: 2px; }

  /* ── Custom sections ────────────────────────────────────────────────────── */
  .custom-text { font-size: 10.5pt; color: #374151; line-height: 1.7; white-space: pre-wrap; margin-bottom: 16px; }
  .custom-image-wrap { margin-top: 14px; }
  .custom-image { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb; }

  /* ── Strategic Impact ───────────────────────────────────────────────────── */
  .si-summary { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; font-size: 10.5pt; color: #374151; line-height: 1.7; margin-bottom: 8px; }
  .si-confidence { font-size: 9pt; color: #6b7280; margin-bottom: 16px; }
  .si-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; page-break-inside: avoid; }
  .si-stat { border-radius: 10px; padding: 14px; text-align: center; border: 1px solid transparent; }
  .si-stat-pct { font-size: 20pt; font-weight: 800; }
  .si-stat-label { font-size: 8.5pt; font-weight: 600; margin-top: 4px; }
  .gain-table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; font-size: 9.5pt; }
  .gain-th { background: #f9fafb; padding: 8px 14px; text-align: left; font-weight: 700; color: #374151; border-bottom: 1px solid #e5e7eb; }
  .gain-metric { padding: 9px 14px; font-weight: 600; color: #111827; border-top: 1px solid #f1f5f9; }
  .gain-est { padding: 9px 14px; font-weight: 700; color: #065f46; border-top: 1px solid #f1f5f9; }
  .gain-basis { padding: 9px 14px; color: #6b7280; border-top: 1px solid #f1f5f9; }

  /* ── Discovery Diagnostic ───────────────────────────────────────────────── */
  .diag-summary { font-size: 10.5pt; color: #374151; line-height: 1.7; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; }
  .diag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; page-break-inside: avoid; }
  .diag-card { border: 1px solid; border-radius: 10px; padding: 14px 16px; }
  .diag-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 8px; }
  .diag-insight { font-size: 9.5pt; color: #374151; line-height: 1.6; margin-bottom: 6px; }
  .diag-ev-list { margin: 0; padding-left: 14px; }
  .diag-ev { font-size: 8.5pt; color: #6b7280; padding: 1px 0; line-height: 1.5; }

  /* ── Discovery Signals ──────────────────────────────────────────────────── */
  .sig-summary { font-size: 10.5pt; color: #374151; line-height: 1.7; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; }
  .sig-list { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
  .sig-row { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
  .sig-row:last-child { border-bottom: none; }
  .sig-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .sig-icon { font-size: 12pt; }
  .sig-domain { font-size: 10pt; font-weight: 600; color: #111827; flex: 1; }
  .sig-consensus { font-size: 8.5pt; color: #6b7280; }
  .sig-bar-wrap { display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 1px; margin-bottom: 5px; }
  .sig-bar-seg { height: 100%; }
  .sig-concerned { background: #f87171; border-radius: 4px 0 0 4px; }
  .sig-neutral { background: #d1d5db; }
  .sig-optimistic { background: #34d399; border-radius: 0 4px 4px 0; }
  .sig-legend { display: flex; gap: 12px; font-size: 8pt; }
  .sig-c { color: #dc2626; }
  .sig-n { color: #6b7280; }
  .sig-o { color: #059669; }

  /* ── Insight Summary ────────────────────────────────────────────────────── */
  .insight-summary-text { font-size: 10.5pt; color: #374151; line-height: 1.7; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; }
  .insight-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .insight-stat { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; text-align: center; }
  .insight-stat-val { font-size: 20pt; font-weight: 800; color: #111827; }
  .insight-stat-val.indigo { color: #4338ca; }
  .insight-stat-val.blue { color: #1d4ed8; }
  .insight-stat-label { font-size: 8.5pt; color: #6b7280; margin-top: 4px; font-weight: 500; }

  /* ── Structural Analysis ────────────────────────────────────────────────── */
  .struct-subtitle { font-size: 9.5pt; color: #6b7280; margin-bottom: 14px; line-height: 1.5; }
  .struct-table-wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
  .struct-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .struct-thead tr { background: #f9fafb; }
  .struct-th { padding: 8px 14px; text-align: left; font-weight: 700; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 8.5pt; }
  .struct-th-right { padding: 8px 14px; text-align: right; font-weight: 700; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 8.5pt; }
  .struct-td { padding: 9px 14px; color: #111827; border-top: 1px solid #f1f5f9; }
  .struct-td-muted { padding: 9px 14px; color: #6b7280; border-top: 1px solid #f1f5f9; }
  .struct-td-score { padding: 9px 14px; text-align: right; font-weight: 700; border-top: 1px solid #f1f5f9; }
  .struct-sev { padding: 2px 6px; border-radius: 4px; font-size: 8pt; font-weight: 600; }
  .narr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; page-break-inside: avoid; }
  .narr-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
  .narr-layer { font-size: 8pt; font-weight: 700; text-transform: capitalize; letter-spacing: 0.1em; color: #374151; margin-bottom: 4px; text-transform: uppercase; }
  .narr-sentiment { font-size: 9.5pt; font-weight: 600; margin-bottom: 10px; text-transform: capitalize; }
  .narr-terms { display: flex; flex-direction: column; gap: 4px; }
  .narr-term { font-size: 9pt; color: #374151; padding: 2px 0; }
  .tension-list { display: flex; flex-direction: column; gap: 10px; }
  .tension-item { display: flex; gap: 12px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; }
  .tension-rank { flex-shrink: 0; font-size: 8.5pt; font-weight: 700; color: #9ca3af; font-family: monospace; width: 22px; padding-top: 2px; }
  .tension-body { flex: 1; }
  .tension-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
  .tension-topic { font-size: 10pt; font-weight: 700; color: #111827; flex: 1; }
  .tension-sev { flex-shrink: 0; padding: 2px 7px; border-radius: 5px; font-size: 8pt; font-weight: 600; white-space: nowrap; }
  .tension-vp { font-size: 9pt; color: #6b7280; line-height: 1.5; padding: 1px 0; }
  .tension-actor { font-weight: 600; color: #374151; }

  /* ── Confidence / Transformation Readiness ──────────────────────────────── */
  .conf-overall { margin-bottom: 16px; }
  .conf-overall-bar { height: 16px; border-radius: 8px; }
  .conf-bar-wrap { display: flex; height: 10px; border-radius: 5px; overflow: hidden; width: 100%; }
  .conf-seg { height: 100%; }
  .conf-certain { background: #334155; }
  .conf-hedging { background: #f59e0b; }
  .conf-uncertain { background: #f87171; }
  .conf-legend { display: flex; gap: 16px; margin-top: 6px; font-size: 8.5pt; }
  .conf-leg-certain { color: #334155; font-weight: 600; }
  .conf-leg-hedging { color: #b45309; font-weight: 600; }
  .conf-leg-uncertain { color: #dc2626; font-weight: 600; }
  .conf-section-label { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #9ca3af; margin-bottom: 8px; margin-top: 16px; }
  .conf-list { display: flex; flex-direction: column; gap: 6px; }
  .conf-row { display: flex; align-items: center; gap: 10px; }
  .conf-domain { font-size: 9pt; font-weight: 500; color: #374151; width: 160px; flex-shrink: 0; }
  .conf-pct { font-size: 8pt; color: #9ca3af; flex-shrink: 0; width: 80px; text-align: right; }

  /* ── Signal Map ─────────────────────────────────────────────────────────── */
  .signal-map-img-wrap { margin-bottom: 14px; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; }
  .signal-map-img { width: 100%; height: auto; display: block; }
  .signal-map-placeholder { background: #f8fafc; border: 1px dashed #d1d5db; border-radius: 10px; padding: 20px; margin-bottom: 14px; text-align: center; }
  .signal-map-note { font-size: 9.5pt; color: #9ca3af; }
  .signal-map-legend { display: flex; flex-wrap: wrap; gap: 10px 20px; margin-bottom: 14px; }
  .signal-map-legend-item { display: flex; align-items: center; gap: 6px; font-size: 8.5pt; color: #374151; }
  .legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .signal-map-narrative { font-size: 10pt; color: #374151; line-height: 1.7; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; }

  /* ── Facilitator back page ──────────────────────────────────────────────── */
  .back-page {
    page-break-before: always;
    min-height: 250mm;
    background: #0f172a;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 44px;
  }
  .back-page-content { text-align: center; max-width: 320px; }
  .back-logo-wrap { margin-bottom: 32px; }
  .back-logo { max-height: 64px; max-width: 200px; object-fit: contain; filter: brightness(0) invert(1); opacity: 0.9; }
  .back-divider { width: 40px; height: 3px; background: #6366f1; border-radius: 2px; margin: 0 auto 28px; }
  .back-heading { font-size: 9pt; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 20px; }
  .back-name { font-size: 20pt; font-weight: 700; color: #ffffff; margin-bottom: 6px; letter-spacing: -0.01em; }
  .back-company { font-size: 11pt; font-weight: 400; color: rgba(255,255,255,0.5); margin-bottom: 24px; }
  .back-contacts { display: flex; flex-direction: column; gap: 10px; margin-bottom: 40px; }
  .back-contact-item { display: flex; justify-content: center; gap: 12px; }
  .back-contact-label { font-size: 8pt; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); width: 40px; text-align: right; padding-top: 2px; }
  .back-contact-value { font-size: 11pt; font-weight: 500; color: rgba(255,255,255,0.8); }
  .back-footer-note { font-size: 8pt; color: rgba(255,255,255,0.2); }

  /* ── Chapter dividers ───────────────────────────────────────────────────── */
  .chapter-divider {
    page-break-before: always;
    background: #1e293b;
    border-radius: 10px;
    padding: 20px 28px;
    margin-bottom: 32px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .chapter-accent { width: 4px; height: 28px; border-radius: 2px; background: #6366f1; flex-shrink: 0; }
  .chapter-label { font-size: 14pt; font-weight: 700; color: #f1f5f9; letter-spacing: -0.01em; }

  /* ── Report Conclusion ──────────────────────────────────────────────────── */
  .conclusion-summary { font-size: 10.5pt; color: #374151; line-height: 1.8; margin-bottom: 24px; white-space: pre-line; }
  .next-steps-heading { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #6b7280; margin-bottom: 14px; }
  .next-step-list { display: flex; flex-direction: column; gap: 10px; }
  .next-step-item { display: flex; gap: 14px; align-items: flex-start; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; }
  .next-step-num { flex-shrink: 0; width: 24px; height: 24px; background: #6366f1; color: white; border-radius: 50%; font-size: 9pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .next-step-content { flex: 1; }
  .next-step-title { font-size: 10.5pt; font-weight: 700; color: #111827; margin-bottom: 3px; }
  .next-step-desc { font-size: 9.5pt; color: #6b7280; line-height: 1.5; }
</style>
</head>
<body>

<!-- Per-page pinstripe border: position:fixed repeats on every printed page -->
<div style="position:fixed;top:0;left:0;width:100%;height:100%;border:0.75pt solid #dde1e7;box-sizing:border-box;pointer-events:none;border-radius:0;z-index:9999;"></div>

<!-- ══ Cover page ══ -->
<div class="cover">
  <div class="cover-top">
    <div>
      ${clientLogoBase64
        ? `<img src="${clientLogoBase64}" class="cover-client-logo" alt="${esc(orgName ?? 'Client')} logo" />`
        : `<div class="cover-client-name">${esc(orgName ?? '')}</div>`}
    </div>
    <div>
      ${dreamLogoBase64
        ? `<img src="${dreamLogoBase64}" class="cover-dream-logo" alt="DREAM" />`
        : `<div class="cover-dream-wordmark">DREAM</div>`}
    </div>
  </div>

  <div class="cover-body">
    <div class="cover-eyebrow">Discovery &amp; Transformation Report</div>
    <div class="cover-title">${esc(workshopName ?? 'Workshop')}</div>
    <div class="cover-subtitle">${esc(orgName ?? '')}</div>
    <div class="cover-divider"></div>
  </div>

  <div class="cover-footer">
    <div>
      <div class="cover-meta-label">Prepared</div>
      <div class="cover-meta-value">${dateStr}</div>
    </div>
    <div class="cover-prepared-by">
      <div class="cover-meta-label">Produced by</div>
      <div class="cover-meta-value">DREAM Discovery Platform</div>
    </div>
  </div>
</div>

<!-- Table of Contents -->
<div class="toc-page">
  <div class="toc-hero">
    <div>
      <div class="toc-hero-sub">Table of Contents</div>
      <div class="toc-hero-title">${esc(workshopName ?? 'Workshop')}</div>
    </div>
    <div class="toc-hero-meta">
      <div class="toc-hero-meta-label">Prepared</div>
      <div class="toc-hero-meta-value">${dateStr}</div>
      <div class="toc-hero-meta-label" style="margin-top:10px;">${enabledSections.filter(s => s.type !== 'chapter').length} sections</div>
    </div>
  </div>
  <div class="toc-list">
    ${tocEntries}
  </div>
  <div class="toc-footer">
    <p>This report has been prepared by the DREAM Discovery Platform and summarises the key findings, root causes, and recommended actions from the Discovery &amp; Transformation workshop with ${esc(orgName ?? 'your organisation')}.</p>
  </div>
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

  // Client logo — supplied by the user at export time
  const clientLogoUrlRaw = body.clientLogoUrl ?? body.layout.clientLogoUrl ?? null;
  const clientLogoBase64 = clientLogoUrlRaw
    ? (clientLogoUrlRaw.startsWith('http') ? await fetchLogoAsBase64(clientLogoUrlRaw) : readLogoAsBase64(clientLogoUrlRaw))
    : null;

  const enrichedBody = { ...body, workshopName, orgName };
  const html = buildReportHtml(enrichedBody, dreamLogoBase64, tenantLogoBase64, clientLogoBase64);

  const footerTemplate = `
    <div style="width:100%;box-sizing:border-box;padding:4px 18mm 0;display:flex;justify-content:space-between;align-items:center;font-size:8px;color:#9ca3af;font-family:Helvetica,Arial,sans-serif;border-top:1px solid #e5e7eb;">
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
