/**
 * lib/report/html-renderers.ts
 *
 * Shared HTML section renderer functions used by:
 *   - export-pdf  (renders full HTML → Puppeteer → PDF)
 *   - export-pptx (renders per-section HTML → Puppeteer screenshot → slide image)
 */

import type {
  ReportSummary,
  ReportLayout,
  ReportSectionConfig,
  WorkshopOutputIntelligence,
  TransformationLogicMap,
  CausalIntelligence,
  CausalFinding,
} from '@/lib/output-intelligence/types';
import {
  computePriorityNodes,
  buildWayForward,
  buildExecSummary,
  formatLabel,
} from '@/lib/output-intelligence/engines/priority-engine';
import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';
import type { DiscoverAnalysis } from '@/lib/types/discover-analysis';

// ── Shared body type ──────────────────────────────────────────────────────────

export interface ReportHtmlBody {
  reportSummary: ReportSummary;
  intelligence: WorkshopOutputIntelligence;
  layout: ReportLayout;
  liveJourneyData?: LiveJourneyData | null;
  workshopName?: string;
  orgName?: string;
  clientLogoUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discoveryOutput?: any;
  discoverAnalysis?: DiscoverAnalysis;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function isExcluded(config: ReportSectionConfig, id: string): boolean {
  return config.excludedItems.includes(id);
}

// ── Colour constants ──────────────────────────────────────────────────────────

export const SENTIMENT_COLORS: Record<string, string> = {
  critical:  '#fee2e2',
  concerned: '#fef3c7',
  positive:  '#dcfce7',
  neutral:   '#f1f5f9',
};

export const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical:    { bg: '#fee2e2', text: '#b91c1c' },
  significant: { bg: '#fef3c7', text: '#b45309' },
  moderate:    { bg: '#f1f5f9', text: '#475569' },
};

// ── Section renderers ─────────────────────────────────────────────────────────

export function renderExecutiveSummary(summary: ReportSummary, cfg: ReportSectionConfig): string {
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

export function renderSupportingEvidence(intelligence: WorkshopOutputIntelligence, cfg: ReportSectionConfig): string {
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

export function renderRootCauses(intelligence: WorkshopOutputIntelligence, cfg: ReportSectionConfig): string {
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

export function renderSolutionDirection(summary: ReportSummary, intelligence: WorkshopOutputIntelligence, cfg: ReportSectionConfig): string {
  const ss = summary.solutionSummary;
  const { roadmap } = intelligence;

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

export function renderJourneyMap(journey: LiveJourneyData, intro: string | undefined, cfg: ReportSectionConfig): string {
  void cfg; // used for future per-item exclusion
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

export function renderStrategicImpact(intelligence: WorkshopOutputIntelligence, cfg: ReportSectionConfig): string {
  const si = intelligence.strategicImpact;

  const statBoxes = [
    { id: 'automation',  label: 'Automation Potential', pct: si.automationPotential?.percentage ?? null, color: '#ede9fe', text: '#5b21b6' },
    { id: 'ai_assisted', label: 'AI-Assisted Work',     pct: si.aiAssistedWork?.percentage ?? null,    color: '#e0e7ff', text: '#3730a3' },
    { id: 'human_only',  label: 'Human-Only Work',      pct: si.humanOnlyWork?.percentage ?? null,     color: '#d1fae5', text: '#065f46' },
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
      <p class="si-confidence">Confidence score: <strong>${si.confidenceScore !== null ? `${si.confidenceScore}%` : '—'}</strong></p>
      ${statBoxes.length ? `<div class="si-stats">${statBoxes.map(s => `
        <div class="si-stat" style="background:${s.color};color:${s.text}">
          <div class="si-stat-pct">${s.pct !== null ? `${s.pct}%` : '—'}</div>
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
export function renderDiscoveryDiagnostic(discoveryOutput: any): string {
  if (!discoveryOutput) return '';

  const DIAG_CARDS = [
    { key: 'operationalReality',         label: 'Operational Reality',       bg: '#eff6ff', border: '#bfdbfe', label_color: '#1e40af' },
    { key: 'organisationalMisalignment', label: 'Leadership Alignment Risk', bg: '#fff1f2', border: '#fecdd3', label_color: '#9f1239' },
    { key: 'systemicFriction',           label: 'Systemic Friction',         bg: '#fffbeb', border: '#fde68a', label_color: '#92400e' },
    { key: 'transformationReadiness',    label: 'Transformation Readiness',  bg: '#f0fdf4', border: '#bbf7d0', label_color: '#065f46' },
  ];

  const cards = DIAG_CARDS.map(({ key, label, bg, border, label_color }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
export function renderDiscoverySignals(discoveryOutput: any): string {
  if (!discoveryOutput?.sections?.length) return '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sectionRows = (discoveryOutput.sections as any[]).map(s => {
    const concerned  = s.sentiment?.concerned  ?? 0;
    const neutral    = s.sentiment?.neutral    ?? 0;
    const optimistic = s.sentiment?.optimistic ?? 0;
    return `
      <div class="sig-row">
        <div class="sig-meta">
          <span class="sig-icon">${esc(s.icon ?? '')}</span>
          <span class="sig-domain">${esc(s.domain)}</span>
          <span class="sig-consensus">${s.consensusLevel}% consensus</span>
        </div>
        <div class="sig-bar-wrap">
          <div class="sig-bar-seg sig-concerned"  style="width:${concerned}%"></div>
          <div class="sig-bar-seg sig-neutral"     style="width:${neutral}%"></div>
          <div class="sig-bar-seg sig-optimistic"  style="width:${optimistic}%"></div>
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

export function renderInsightSummary(intelligence: WorkshopOutputIntelligence): string {
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

export function renderStructuralAlignment(discoverAnalysis: DiscoverAnalysis | undefined): string {
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

export function renderStructuralNarrative(discoverAnalysis: DiscoverAnalysis | undefined): string {
  if (!discoverAnalysis?.narrative?.layers?.length) return '';
  const { layers } = discoverAnalysis.narrative;
  const LAYER_BG: Record<string, string>     = { executive: '#f5f3ff', operational: '#eff6ff', frontline: '#f0fdf4' };
  const LAYER_BORDER: Record<string, string> = { executive: '#ddd6fe', operational: '#bfdbfe', frontline: '#bbf7d0' };
  const SENT_COLOR: Record<string, string>   = { positive: '#065f46', negative: '#b91c1c', neutral: '#6b7280', mixed: '#b45309' };
  const cards = layers.map(layer => {
    const bg        = LAYER_BG[layer.layer]        ?? '#f9fafb';
    const border    = LAYER_BORDER[layer.layer]    ?? '#e5e7eb';
    const sentColor = SENT_COLOR[layer.dominantSentiment] ?? '#374151';
    const terms     = layer.topTerms.slice(0, 5).map(tt => `<div class="narr-term">${esc(tt.term)}</div>`).join('');
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

export function renderStructuralTensions(discoverAnalysis: DiscoverAnalysis | undefined): string {
  if (!discoverAnalysis?.tensions?.tensions?.length) return '';
  const tensions = discoverAnalysis.tensions.tensions.slice(0, 8);
  const SEV_BG:   Record<string, string> = { critical: '#fee2e2', significant: '#fef3c7', moderate: '#f1f5f9' };
  const SEV_TEXT: Record<string, string> = { critical: '#b91c1c', significant: '#b45309', moderate: '#475569' };
  const items = tensions.map((ten, i) => {
    const bg   = SEV_BG[ten.severity]   ?? SEV_BG.moderate;
    const text = SEV_TEXT[ten.severity] ?? SEV_TEXT.moderate;
    const viewpoints = ten.viewpoints.slice(0, 2).map(vp =>
      `<div class="tension-vp"><span class="tension-actor">${esc(vp.actor)}</span> — ${esc(vp.position.slice(0, 80))}${vp.position.length > 80 ? '…' : ''}</div>`
    ).join('');
    return `
      <div class="tension-item">
        <div class="tension-rank">#${i + 1}</div>
        <div class="tension-body">
          <div class="tension-header">
            <span class="tension-topic">${esc(ten.topic)}</span>
            <span class="tension-sev" style="background:${bg};color:${text}">${esc(ten.severity)}</span>
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

export function renderStructuralBarriers(discoverAnalysis: DiscoverAnalysis | undefined): string {
  if (!discoverAnalysis?.constraints?.constraints?.length) return '';
  const sorted = [...discoverAnalysis.constraints.constraints]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);
  const SEV_BG:   Record<string, string> = { critical: '#fee2e2', significant: '#fef3c7', moderate: '#f1f5f9' };
  const SEV_TEXT: Record<string, string> = { critical: '#b91c1c', significant: '#b45309', moderate: '#475569' };
  const rows = sorted.map(c => {
    const bg   = SEV_BG[c.severity]   ?? SEV_BG.moderate;
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

export function renderStructuralConfidence(discoverAnalysis: DiscoverAnalysis | undefined): string {
  if (!discoverAnalysis?.confidence) return '';
  const { overall, byDomain, byLayer } = discoverAnalysis.confidence;
  const total = overall.certain + overall.hedging + overall.uncertain;
  if (total === 0) return '';
  const certainPct  = Math.round((overall.certain  / total) * 100);
  const hedgingPct  = Math.round((overall.hedging  / total) * 100);
  const uncertainPct = 100 - certainPct - hedgingPct;

  const domainRows = byDomain.slice(0, 8).map(d => {
    const dt = d.distribution.certain + d.distribution.hedging + d.distribution.uncertain;
    const cp = dt > 0 ? Math.round((d.distribution.certain  / dt) * 100) : 0;
    const hp = dt > 0 ? Math.round((d.distribution.hedging  / dt) * 100) : 0;
    const up = 100 - cp - hp;
    return `
      <div class="conf-row">
        <div class="conf-domain">${esc(d.domain)}</div>
        <div class="conf-bar-wrap">
          <div class="conf-seg conf-certain"   style="width:${cp}%"></div>
          <div class="conf-seg conf-hedging"   style="width:${hp}%"></div>
          <div class="conf-seg conf-uncertain" style="width:${up}%"></div>
        </div>
        <div class="conf-pct">${dt} responses</div>
      </div>`;
  }).join('');

  const layerRows = byLayer.map(l => {
    const lt = l.distribution.certain + l.distribution.hedging + l.distribution.uncertain;
    const cp = lt > 0 ? Math.round((l.distribution.certain  / lt) * 100) : 0;
    const hp = lt > 0 ? Math.round((l.distribution.hedging  / lt) * 100) : 0;
    const up = 100 - cp - hp;
    return `
      <div class="conf-row">
        <div class="conf-domain" style="text-transform:capitalize">${esc(l.layer)}</div>
        <div class="conf-bar-wrap">
          <div class="conf-seg conf-certain"   style="width:${cp}%"></div>
          <div class="conf-seg conf-hedging"   style="width:${hp}%"></div>
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
          <div class="conf-seg conf-certain"   style="width:${certainPct}%"></div>
          <div class="conf-seg conf-hedging"   style="width:${hedgingPct}%"></div>
          <div class="conf-seg conf-uncertain" style="width:${uncertainPct}%"></div>
        </div>
        <div class="conf-legend">
          <span class="conf-leg-item conf-leg-certain">● ${certainPct}% certain</span>
          <span class="conf-leg-item conf-leg-hedging">● ${hedgingPct}% hedging</span>
          <span class="conf-leg-item conf-leg-uncertain">● ${uncertainPct}% uncertain</span>
        </div>
      </div>
      ${domainRows ? `<div class="conf-section-label">BY DOMAIN</div><div class="conf-list">${domainRows}</div>` : ''}
      ${layerRows  ? `<div class="conf-section-label" style="margin-top:14px;">BY NARRATIVE LAYER</div><div class="conf-list">${layerRows}</div>` : ''}
    </section>`;
}

export function renderSignalMap(reportSummary: ReportSummary, discoverAnalysis: DiscoverAnalysis | undefined): string {
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
      ${conf ? `<p class="signal-map-narrative">The signal distribution across the organisation shows confidence patterns where ${conf.overall.hedging > conf.overall.certain ? 'hedging language dominates' : 'certainty is present in key areas'}, with ${conf.byLayer?.[0]?.layer ?? 'executive'} layer showing distinct sentiment from frontline perspectives.</p>` : ''}
    </section>`;
}

export function renderFacilitatorBackPage(reportSummary: ReportSummary, dreamLogoBase64: string | null): string {
  const fc = reportSummary.facilitatorContact;
  if (!fc && !dreamLogoBase64) return '';
  const name        = fc?.name        ?? '';
  const email       = fc?.email       ?? '';
  const phone       = fc?.phone       ?? '';
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
        ${name        ? `<div class="back-name">${esc(name)}</div>`               : ''}
        ${companyName ? `<div class="back-company">${esc(companyName)}</div>`     : ''}
        <div class="back-contacts">
          ${email ? `<div class="back-contact-item"><span class="back-contact-label">Email</span><span class="back-contact-value">${esc(email)}</span></div>` : ''}
          ${phone ? `<div class="back-contact-item"><span class="back-contact-label">Phone</span><span class="back-contact-value">${esc(phone)}</span></div>` : ''}
        </div>
        <div class="back-footer-note">This report was produced using the DREAM Discovery &amp; Transformation Platform</div>
      </div>
    </div>`;
}

// ── Transformation Priorities ─────────────────────────────────────────────────

export function renderTransformationPriorities(tlm: TransformationLogicMap | undefined): string {
  if (!tlm) return '';
  const priorities = computePriorityNodes(tlm);
  if (!priorities.length) return '';

  const sigColor: Record<string, string> = {
    critical: '#b91c1c', high: '#9a3412', medium: '#475569',
  };
  const sigBg: Record<string, string> = {
    critical: '#fef2f2', high: '#fff7ed', medium: '#f8fafc',
  };
  const clsColor: Record<string, string> = {
    systemic: '#1e40af', structural: '#5b21b6', local: '#166534', symptomatic: '#9a3412',
  };
  const clsBg: Record<string, string> = {
    systemic: '#eff6ff', structural: '#f5f3ff', local: '#f0fdf4', symptomatic: '#fff7ed',
  };

  const execSum = buildExecSummary(tlm);

  const cards = priorities.map(p => {
    const layerLabel = p.layer === 'REIMAGINATION' ? 'Vision' : p.layer === 'ENABLER' ? 'Enabler' : 'Challenge';
    const layerColor = p.layer === 'REIMAGINATION' ? '#10b981' : p.layer === 'ENABLER' ? '#3b82f6' : '#ef4444';
    const rolesList  = p.distinctRoles.length > 0
      ? p.distinctRoles.slice(0, 4).map(r => `<span class="tp-role">${esc(r)}</span>`).join('')
      : '';
    return `
      <div class="tp-card">
        <div class="tp-card-header">
          <div class="tp-rank">${String(p.rank).padStart(2, '0')}</div>
          <div class="tp-card-meta">
            <div class="tp-card-title">${esc(formatLabel(p.displayLabel))}</div>
            <div class="tp-badges">
              <span class="tp-badge" style="background:${sigBg[p.significance]};color:${sigColor[p.significance]};border:1px solid ${sigColor[p.significance]}44">${esc(p.significance.charAt(0).toUpperCase() + p.significance.slice(1))}</span>
              <span class="tp-badge" style="background:${clsBg[p.classification]};color:${clsColor[p.classification]};border:1px solid ${clsColor[p.classification]}44">${esc(p.classification)}</span>
              <span class="tp-badge" style="background:${layerColor}18;color:${layerColor};border:1px solid ${layerColor}40">${layerLabel}</span>
              ${p.isCoalescent ? '<span class="tp-badge" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d">Pressure point</span>' : ''}
            </div>
          </div>
        </div>
        <p class="tp-classification-reason">${esc(p.classificationReason)}</p>
        <div class="tp-body-label">Why this matters to the business</div>
        <p class="tp-why">${esc(p.whyMatters)}</p>
        ${p.riskIfIgnored ? `<div class="tp-body-label tp-risk-label">Risk if ignored</div><p class="tp-risk">${esc(p.riskIfIgnored)}</p>` : ''}
        ${p.suggestedAction ? `<div class="tp-action-box"><div class="tp-body-label tp-action-label">Suggested action</div><p class="tp-action-text">${esc(p.suggestedAction)}</p></div>` : ''}
        ${rolesList ? `<div class="tp-roles">${rolesList}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Transformation Priorities</div></div>
      <div class="tp-summary-bar">
        <p class="tp-summary-headline">${esc(execSum.headline)}</p>
        ${execSum.pressure ? `<p class="tp-summary-sub">${esc(execSum.pressure)}</p>` : ''}
      </div>
      <div class="tp-cards">${cards}</div>
    </section>`;
}

// ── Way Forward ───────────────────────────────────────────────────────────────

export function renderWayForward(tlm: TransformationLogicMap | undefined): string {
  if (!tlm) return '';
  const phases = buildWayForward(tlm, new Set());
  const totalItems = phases.reduce((s, p) => s + p.items.length, 0);
  if (totalItems === 0) return '';

  const phaseHtml = phases.map(phase => {
    const items = phase.items.map(item => `
      <div class="wf-item">
        <div class="wf-item-dot" style="background:${phase.color}"></div>
        <div class="wf-item-body">
          <div class="wf-item-label">${esc(item.label)}</div>
          <div class="wf-item-desc">${esc(item.description)}</div>
        </div>
      </div>`).join('');

    return `
      <div class="wf-phase" style="border-top:3px solid ${phase.color}">
        <div class="wf-phase-header">
          <div class="wf-phase-num" style="background:${phase.color}">${phase.phase}</div>
          <div>
            <div class="wf-phase-name" style="color:${phase.textColor}">${esc(phase.name)}</div>
            <div class="wf-phase-timeline">${esc(phase.timeline)}</div>
          </div>
        </div>
        <div class="wf-items">${items}</div>
        <div class="wf-outcome-box" style="border-color:${phase.borderColor}">
          <div class="wf-outcome-label" style="color:${phase.color}">Expected outcome</div>
          <p class="wf-outcome-text">${esc(phase.expectedOutcome)}</p>
        </div>
        <p class="wf-dependencies"><strong>Requires:</strong> ${esc(phase.dependencies)}</p>
      </div>`;
  }).join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Way Forward</div></div>
      <p class="wf-intro">A sequenced, three-phase plan derived from the transformation logic map — ordered by structural dependency, not urgency.</p>
      <div class="wf-grid">${phaseHtml}</div>
    </section>`;
}

// ── Connected Model ───────────────────────────────────────────────────────────

export function renderConnectedModel(
  causal: CausalIntelligence | undefined,
  cfg: ReportSectionConfig,
): string {
  if (!causal) return '';

  const allFindings: CausalFinding[] = [
    ...(causal.organisationalIssues ?? []),
    ...(causal.reinforcedFindings   ?? []),
    ...(causal.emergingPatterns     ?? []),
  ].filter(f => !cfg.excludedItems.includes(f.findingId));

  if (!allFindings.length) return '';

  const catLabel: Record<string, string> = {
    ORGANISATIONAL_ISSUE: 'Organisational Issue',
    REINFORCED_FINDING:   'Reinforced Finding',
    EMERGING_PATTERN:     'Emerging Pattern',
    CONTRADICTION:        'Contradiction',
    EVIDENCE_GAP:         'Evidence Gap',
  };
  const catColor: Record<string, { bg: string; text: string; border: string }> = {
    ORGANISATIONAL_ISSUE: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
    REINFORCED_FINDING:   { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
    EMERGING_PATTERN:     { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
    CONTRADICTION:        { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
    EVIDENCE_GAP:         { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
  };

  const cards = allFindings.map((f, i) => {
    const c = catColor[f.category] ?? catColor.EVIDENCE_GAP;
    const chain = f.causalChain
      ? `<div class="cm-chain">${esc(f.causalChain.constraintLabel)} → ${esc(f.causalChain.enablerLabel)} → ${esc(f.causalChain.reimaginationLabel)}</div>`
      : '';
    const quote = f.evidenceQuotes?.[0]
      ? `<div class="cm-quote">"${esc(f.evidenceQuotes[0].text)}"${f.evidenceQuotes[0].participantRole ? ` <span class="cm-quote-role">— ${esc(f.evidenceQuotes[0].participantRole)}</span>` : ''}</div>`
      : '';
    return `
      <div class="cm-card" style="border-left:3px solid ${c.border}">
        <div class="cm-card-header">
          <span class="cm-rank">${i + 1}</span>
          <div class="cm-card-meta">
            <div class="cm-badge" style="background:${c.bg};color:${c.text};border:1px solid ${c.border}">${catLabel[f.category] ?? f.category}</div>
            <div class="cm-title">${esc(f.issueTitle)}</div>
          </div>
        </div>
        ${f.whyItMatters  ? `<p class="cm-why">${esc(f.whyItMatters)}</p>` : ''}
        ${chain}
        ${f.operationalImplication ? `<div class="cm-impl-label">Operational implication</div><p class="cm-impl">${esc(f.operationalImplication)}</p>` : ''}
        ${f.recommendedAction ? `<div class="cm-action-box"><div class="cm-action-label">Recommended action</div><p class="cm-action-text">${esc(f.recommendedAction)}</p></div>` : ''}
        ${f.whoItAffects ? `<p class="cm-who"><strong>Owner:</strong> ${esc(f.whoItAffects)}</p>` : ''}
        ${quote}
      </div>`;
  }).join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Connected Model</div></div>
      <p class="cm-intro">Causal chains, bottlenecks and unlock paths derived from the hemisphere graph — ${allFindings.length} finding${allFindings.length !== 1 ? 's' : ''}.</p>
      <div class="cm-cards">${cards}</div>
    </section>`;
}

export function renderCustomSection(cfg: ReportSectionConfig): string {
  const content = cfg.customContent ?? {};
  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">${esc(cfg.title)}</div></div>
      ${content.text      ? `<p class="custom-text">${esc(content.text).replace(/\n/g, '<br>')}</p>` : ''}
      ${content.imageUrl  ? `<div class="custom-image-wrap"><img src="${esc(content.imageUrl)}" alt="${esc(content.imageAlt ?? '')}" class="custom-image" /></div>` : ''}
    </section>`;
}

export function renderChapter(cfg: ReportSectionConfig): string {
  return `
    <div class="chapter-divider">
      <div class="chapter-accent"></div>
      <div class="chapter-label">${esc(cfg.title)}</div>
    </div>`;
}

export function renderConclusion(reportSummary: ReportSummary): string {
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
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Summary &amp; Next Steps</div></div>
      <div class="conclusion-summary">${esc(conclusion.summary)}</div>
      <div class="next-steps-heading">Recommended Next Steps</div>
      <div class="next-step-list">${steps}</div>
    </section>`;
}

// ── Shared CSS (used by both PDF and slide renderers) ─────────────────────────

export const PDF_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; background: white; line-height: 1.7; padding: 0 12px; }
  @page { size: A4; }
  @page landscape-page { size: A4 landscape; margin: 16mm 18mm 14mm; }

  /* ── Cover ─── */
  .cover { page-break-after: always; min-height: 256mm; background: #ffffff; border-radius: 8px; display: flex; flex-direction: column; padding: 0 44px 40px; position: relative; overflow: hidden; }
  .cover::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #6366f1 0%, #818cf8 55%, #10b981 100%); border-radius: 8px 8px 0 0; }
  .cover::after { content: ''; position: absolute; bottom: -40px; right: -40px; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%); pointer-events: none; }
  .cover-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: auto; padding-top: 44px; }
  .cover-client-name { font-size: 11pt; font-weight: 500; letter-spacing: 0.03em; color: #374151; }
  .cover-client-logo { max-height: 48px; max-width: 160px; object-fit: contain; }
  .cover-dream-logo  { max-height: 36px; max-width: 140px; object-fit: contain; opacity: 0.8; }
  .cover-dream-wordmark { font-size: 11pt; font-weight: 800; letter-spacing: 0.2em; color: #374151; }
  .cover-body { padding-top: 68px; }
  .cover-eyebrow { font-size: 8.5pt; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #6366f1; margin-bottom: 18px; display: flex; align-items: center; gap: 10px; }
  .cover-eyebrow::after { content: ''; flex: 0 0 40px; height: 1px; background: #6366f1; }
  .cover-title { font-size: 30pt; font-weight: 800; line-height: 1.1; color: #0f172a; margin-bottom: 14px; letter-spacing: -0.02em; }
  .cover-subtitle { font-size: 12pt; font-weight: 400; color: #6b7280; margin-bottom: 40px; line-height: 1.5; }
  .cover-divider { width: 48px; height: 3px; background: #6366f1; border-radius: 2px; margin-bottom: 28px; }
  .cover-footer { margin-top: auto; padding-top: 28px; border-top: 1px solid #f1f5f9; display: flex; align-items: flex-end; justify-content: space-between; }
  .cover-meta-label { font-size: 7.5pt; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px; }
  .cover-meta-value { font-size: 10pt; font-weight: 600; color: #374151; }
  .cover-prepared-by { text-align: right; }

  /* ── TOC ─── */
  .toc-page { page-break-after: always; }
  .toc-hero { background: #0f172a; border-radius: 12px; padding: 28px 32px; margin-bottom: 28px; display: flex; align-items: flex-end; justify-content: space-between; }
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

  /* ── Section chrome ─── */
  .journey-section { page: landscape-page; page-break-before: always; page-break-after: always; page-break-inside: avoid; }
  .report-section { margin-bottom: 28px; }
  .section-title-bar { page-break-after: avoid; }
  .cause-card, .evidence-row, .finding-item, .lens-row, .phase-card, .step-item, .next-step-item, .tension-item, .diag-card, .sig-row, .toc-row { page-break-inside: avoid; }
  .section-title-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
  .section-accent { width: 4px; height: 22px; border-radius: 2px; background: #6366f1; flex-shrink: 0; }
  .section-title { font-size: 13pt; font-weight: 700; color: #111827; letter-spacing: -0.01em; }

  /* ── Executive summary ─── */
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

  /* ── Supporting evidence ─── */
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

  /* ── Root causes ─── */
  .systemic-pattern { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; font-size: 10.5pt; color: #374151; line-height: 1.7; margin-bottom: 20px; }
  .cause-list { display: grid; gap: 12px; }
  .cause-card { display: flex; gap: 14px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
  .cause-meta { display: flex; flex-direction: column; align-items: center; gap: 5px; flex-shrink: 0; padding-top: 2px; }
  .cause-rank { font-size: 9pt; font-weight: 700; color: #9ca3af; font-family: monospace; }
  .cause-sev { font-size: 7.5pt; font-weight: 600; padding: 2px 6px; border-radius: 5px; white-space: nowrap; }
  .cause-title { font-size: 10.5pt; font-weight: 600; color: #111827; margin-bottom: 3px; }
  .cause-cat { font-size: 8.5pt; color: #9ca3af; margin-bottom: 6px; }
  .cause-ev { font-size: 9pt; color: #6b7280; padding: 2px 0; line-height: 1.5; }

  /* ── Solution direction ─── */
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

  /* ── Journey map ─── */
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

  /* ── Custom sections ─── */
  .custom-text { font-size: 10.5pt; color: #374151; line-height: 1.7; white-space: pre-wrap; margin-bottom: 16px; }
  .custom-image-wrap { margin-top: 14px; }
  .custom-image { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb; }

  /* ── Strategic Impact ─── */
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

  /* ── Discovery Diagnostic ─── */
  .diag-summary { font-size: 10.5pt; color: #374151; line-height: 1.7; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; }
  .diag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; page-break-inside: avoid; }
  .diag-card { border: 1px solid; border-radius: 10px; padding: 14px 16px; }
  .diag-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 8px; }
  .diag-insight { font-size: 9.5pt; color: #374151; line-height: 1.6; margin-bottom: 6px; }
  .diag-ev-list { margin: 0; padding-left: 14px; }
  .diag-ev { font-size: 8.5pt; color: #6b7280; padding: 1px 0; line-height: 1.5; }

  /* ── Discovery Signals ─── */
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

  /* ── Insight Summary ─── */
  .insight-summary-text { font-size: 10.5pt; color: #374151; line-height: 1.7; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; }
  .insight-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .insight-stat { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; text-align: center; }
  .insight-stat-val { font-size: 20pt; font-weight: 800; color: #111827; }
  .insight-stat-val.indigo { color: #4338ca; }
  .insight-stat-val.blue { color: #1d4ed8; }
  .insight-stat-label { font-size: 8.5pt; color: #6b7280; margin-top: 4px; font-weight: 500; }

  /* ── Structural Analysis ─── */
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
  .narr-layer { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #374151; margin-bottom: 4px; }
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

  /* ── Confidence ─── */
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

  /* ── Signal Map ─── */
  .signal-map-img-wrap { margin-bottom: 14px; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; }
  .signal-map-img { width: 100%; height: auto; display: block; }
  .signal-map-placeholder { background: #f8fafc; border: 1px dashed #d1d5db; border-radius: 10px; padding: 20px; margin-bottom: 14px; text-align: center; }
  .signal-map-note { font-size: 9.5pt; color: #9ca3af; }
  .signal-map-legend { display: flex; flex-wrap: wrap; gap: 10px 20px; margin-bottom: 14px; }
  .signal-map-legend-item { display: flex; align-items: center; gap: 6px; font-size: 8.5pt; color: #374151; }
  .legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .signal-map-narrative { font-size: 10pt; color: #374151; line-height: 1.7; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; }

  /* ── Facilitator back page ─── */
  .back-page { page-break-before: always; min-height: 250mm; background: #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 60px 44px; }
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

  /* ── Chapter dividers ─── */
  .chapter-divider { page-break-before: always; background: #1e293b; border-radius: 10px; padding: 20px 28px; margin-bottom: 32px; display: flex; align-items: center; gap: 14px; }
  .chapter-accent { width: 4px; height: 28px; border-radius: 2px; background: #6366f1; flex-shrink: 0; }
  .chapter-label { font-size: 14pt; font-weight: 700; color: #f1f5f9; letter-spacing: -0.01em; }

  /* ── Report Conclusion ─── */
  .conclusion-summary { font-size: 10.5pt; color: #374151; line-height: 1.8; margin-bottom: 24px; white-space: pre-line; }
  .next-steps-heading { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #6b7280; margin-bottom: 14px; }
  .next-step-list { display: flex; flex-direction: column; gap: 10px; }
  .next-step-item { display: flex; gap: 14px; align-items: flex-start; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; }
  .next-step-num { flex-shrink: 0; width: 24px; height: 24px; background: #6366f1; color: white; border-radius: 50%; font-size: 9pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .next-step-content { flex: 1; }
  .next-step-title { font-size: 10.5pt; font-weight: 700; color: #111827; margin-bottom: 3px; }
  .next-step-desc { font-size: 9.5pt; color: #6b7280; line-height: 1.5; }

  /* ── Transformation Priorities ─── */
  .tp-summary-bar { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; }
  .tp-summary-headline { font-size: 10.5pt; font-weight: 600; color: #1e293b; line-height: 1.6; margin-bottom: 6px; }
  .tp-summary-sub { font-size: 9.5pt; color: #64748b; line-height: 1.6; margin: 0; }
  .tp-cards { display: flex; flex-direction: column; gap: 14px; }
  .tp-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; background: #ffffff; }
  .tp-card-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 10px; }
  .tp-rank { flex-shrink: 0; width: 28px; height: 28px; background: #0f172a; color: white; border-radius: 8px; font-size: 9pt; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .tp-card-meta { flex: 1; }
  .tp-card-title { font-size: 11pt; font-weight: 700; color: #0f172a; margin-bottom: 7px; }
  .tp-badges { display: flex; flex-wrap: wrap; gap: 5px; }
  .tp-badge { font-size: 7.5pt; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: capitalize; letter-spacing: 0.02em; }
  .tp-classification-reason { font-size: 8.5pt; color: #64748b; line-height: 1.65; margin-bottom: 10px; background: #f8fafc; border-radius: 6px; padding: 8px 10px; border: 1px solid #f1f5f9; }
  .tp-body-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #94a3b8; margin-bottom: 5px; }
  .tp-risk-label { color: #b45309; margin-top: 10px; }
  .tp-why { font-size: 9.5pt; color: #334155; line-height: 1.7; margin-bottom: 0; }
  .tp-risk { font-size: 9.5pt; color: #78350f; line-height: 1.7; margin-bottom: 0; }
  .tp-action-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; margin-top: 10px; }
  .tp-action-label { color: #d97706; margin-bottom: 5px; }
  .tp-action-text { font-size: 9.5pt; color: #92400e; line-height: 1.7; margin: 0; }
  .tp-roles { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
  .tp-role { font-size: 7.5pt; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 20px; padding: 2px 8px; }

  /* ── Way Forward ─── */
  .wf-intro { font-size: 9.5pt; color: #64748b; line-height: 1.7; margin-bottom: 20px; }
  .wf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .wf-phase { border-radius: 10px; border: 1px solid #e2e8f0; padding: 16px; background: #ffffff; }
  .wf-phase-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .wf-phase-num { width: 30px; height: 30px; border-radius: 8px; color: white; font-size: 12pt; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .wf-phase-name { font-size: 11pt; font-weight: 700; line-height: 1.2; }
  .wf-phase-timeline { font-size: 8pt; color: #94a3b8; margin-top: 2px; }
  .wf-items { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
  .wf-item { display: flex; gap: 8px; align-items: flex-start; }
  .wf-item-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
  .wf-item-body { flex: 1; }
  .wf-item-label { font-size: 9pt; font-weight: 600; color: #1e293b; margin-bottom: 2px; }
  .wf-item-desc { font-size: 8pt; color: #64748b; line-height: 1.55; }
  .wf-outcome-box { border: 1px solid; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; background: #ffffff; }
  .wf-outcome-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 5px; }
  .wf-outcome-text { font-size: 8.5pt; color: #475569; line-height: 1.6; margin: 0; }
  .wf-dependencies { font-size: 8pt; color: #94a3b8; line-height: 1.55; margin: 0; }

  /* ── Connected Model ─── */
  .cm-intro { font-size: 9.5pt; color: #64748b; line-height: 1.7; margin-bottom: 20px; }
  .cm-cards { display: flex; flex-direction: column; gap: 14px; }
  .cm-card { padding: 14px 16px 14px 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; }
  .cm-card-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
  .cm-rank { flex-shrink: 0; width: 22px; height: 22px; background: #1e293b; color: white; border-radius: 6px; font-size: 8pt; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .cm-card-meta { flex: 1; }
  .cm-badge { display: inline-block; font-size: 7.5pt; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-bottom: 6px; }
  .cm-title { font-size: 10.5pt; font-weight: 700; color: #0f172a; line-height: 1.35; }
  .cm-why { font-size: 9.5pt; color: #334155; line-height: 1.7; margin-bottom: 8px; }
  .cm-chain { font-size: 8pt; color: #6366f1; font-weight: 600; background: #eef2ff; border-radius: 4px; padding: 4px 8px; margin-bottom: 8px; }
  .cm-impl-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #b45309; margin-bottom: 4px; }
  .cm-impl { font-size: 9pt; color: #78350f; line-height: 1.65; margin-bottom: 8px; }
  .cm-action-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
  .cm-action-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #d97706; margin-bottom: 4px; }
  .cm-action-text { font-size: 9pt; color: #92400e; line-height: 1.65; margin: 0; }
  .cm-who { font-size: 8.5pt; color: #64748b; margin-bottom: 6px; }
  .cm-quote { font-size: 8.5pt; color: #64748b; font-style: italic; border-left: 2px solid #e2e8f0; padding-left: 10px; margin-top: 8px; line-height: 1.6; }
  .cm-quote-role { font-style: normal; font-weight: 500; color: #94a3b8; }
`;

// ── buildReportHtml ───────────────────────────────────────────────────────────

export function buildReportHtml(
  body: ReportHtmlBody,
  dreamLogoBase64: string | null,
  tenantLogoBase64: string | null,
  clientLogoBase64: string | null,
): string {
  void tenantLogoBase64; // reserved for future use
  const { reportSummary, intelligence, layout, liveJourneyData, workshopName, orgName, discoveryOutput, discoverAnalysis } = body;

  const enabledSections = layout.sections.filter(s => s.enabled);

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
    if (cfg.type === 'custom')  return renderCustomSection(cfg);
    switch (cfg.id) {
      case 'executive_summary':    return renderExecutiveSummary(reportSummary, cfg);
      case 'supporting_evidence':  return renderSupportingEvidence(intelligence, cfg);
      case 'root_causes':          return renderRootCauses(intelligence, cfg);
      case 'solution_direction':   return renderSolutionDirection(reportSummary, intelligence, cfg);
      case 'journey_map':          return liveJourneyData ? renderJourneyMap(liveJourneyData, reportSummary.journeyIntro, cfg) : '';
      case 'strategic_impact':     return renderStrategicImpact(intelligence, cfg);
      case 'discovery_diagnostic': return renderDiscoveryDiagnostic(discoveryOutput);
      case 'discovery_signals':    return renderDiscoverySignals(discoveryOutput);
      case 'insight_summary':      return renderInsightSummary(intelligence);
      case 'structural_alignment': return renderStructuralAlignment(discoverAnalysis);
      case 'structural_narrative': return renderStructuralNarrative(discoverAnalysis);
      case 'structural_tensions':  return renderStructuralTensions(discoverAnalysis);
      case 'structural_barriers':  return renderStructuralBarriers(discoverAnalysis);
      case 'structural_confidence':      return renderStructuralConfidence(discoverAnalysis);
      case 'discovery_signal_map':       return renderSignalMap(reportSummary, discoverAnalysis);
      case 'facilitator_contact':        return renderFacilitatorBackPage(reportSummary, dreamLogoBase64);
      case 'report_conclusion':          return renderConclusion(reportSummary);
      case 'transformation_priorities':  return renderTransformationPriorities(intelligence.transformationLogicMap);
      case 'way_forward':                return renderWayForward(intelligence.transformationLogicMap);
      case 'connected_model':            return renderConnectedModel(intelligence.causalIntelligence, cfg);
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
<style>${PDF_STYLES}</style>
</head>
<body>
<div style="position:fixed;top:0;left:0;width:100%;height:100%;border:0.75pt solid #dde1e7;box-sizing:border-box;pointer-events:none;border-radius:0;z-index:9999;"></div>

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
  <div class="toc-list">${tocEntries}</div>
  <div class="toc-footer">
    <p>This report has been prepared by the DREAM Discovery Platform and summarises the key findings, root causes, and recommended actions from the Discovery &amp; Transformation workshop with ${esc(orgName ?? 'your organisation')}.</p>
  </div>
</div>

${sectionsHtml}

</body>
</html>`;
}
