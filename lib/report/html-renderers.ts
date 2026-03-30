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
  ExecutionRoadmap,
} from '@/lib/output-intelligence/types';
import {
  computePriorityNodes,
  buildWayForward,
  buildExecSummary,
  formatLabel,
  type WayForwardPhase,
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
  houseImages?: { old: string | null; refreshed: string | null; ideal: string | null };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function isExcluded(config: ReportSectionConfig, id: string): boolean {
  return config.excludedItems.includes(id);
}

// ── Section intro helper ──────────────────────────────────────────────────────

function sectionIntro(text: string): string {
  return `<div class="section-intro"><span class="section-intro-label">Section Overview</span><p>${esc(text)}</p></div>`;
}

// ── TOC section descriptions ──────────────────────────────────────────────────

const TOC_DESCRIPTIONS: Record<string, string> = {
  executive_summary:         'The ask, the answer, what we found, and the recommended direction',
  discovery_diagnostic:      'Operational reality, leadership alignment, and systemic friction signals',
  discovery_signals:         'Sentiment by domain, agreement levels, and tension areas',
  discovery_signal_map:      'Visual distribution of workshop signals across themes and lenses',
  structural_alignment:      'Where leadership narratives diverge from frontline experience',
  structural_narrative:      'Competing stories and perspective divergence across actor groups',
  structural_tensions:       'Active tensions and severity ranking across the organisation',
  structural_barriers:       'Systemic blockers that surface repeatedly across lenses and roles',
  structural_confidence:     'Readiness assessment and confidence levels by capability domain',
  journey_map:               'Customer touchpoints, pain concentration, and actor involvement',
  supporting_evidence:       'Confirmed issues and new problems surfaced during the workshop',
  root_causes:               'Primary root causes ranked by severity and their lens breakdown',
  solution_direction:        'Transformation direction, Three Houses framework, and roadmap phases',
  strategic_impact:          'Automation potential, efficiency gains, and business case summary',
  way_forward:               'Stabilise → Enable → Transform — phased delivery plan and Gantt',
  report_conclusion:         'Agreed next steps, responsibilities, and 90-day priorities',
  facilitator_contact:       'Contact details for the facilitating team',
  transformation_priorities: 'Priority nodes ranked by significance and systemic impact',
  connected_model:           'Causal chain and enabler pathways from evidence to outcome',
  insight_summary:           'Hypothesis accuracy, confirmed issues, and insight distribution',
};

// ── TOC phase groups — defines the 6 workshop-aligned chapter headers ─────────
// Sections are assigned to phases in this order; layout ordering is preserved
// within each phase. Any enabled section not matched falls into "Other".

interface TocPhaseGroup {
  name: string;
  desc: string;
  sectionIds: string[];
}

const TOC_PHASE_GROUPS: TocPhaseGroup[] = [
  {
    name: 'Executive Summary',
    desc: 'The ask, the answer, and what the workshop revealed',
    sectionIds: ['executive_summary'],
  },
  {
    name: 'Discovery Diagnostic',
    desc: 'Structural signals, alignment gaps, and diagnostic findings from the live workshop',
    sectionIds: ['discovery_diagnostic', 'discovery_signals', 'discovery_signal_map', 'structural_alignment', 'structural_narrative', 'journey_map', 'insight_summary'],
  },
  {
    name: 'Reimagine',
    desc: 'Future state design, transformation direction, and strategic opportunity',
    sectionIds: ['solution_direction', 'strategic_impact'],
  },
  {
    name: 'Constraints',
    desc: 'Where the organisation is blocked — root causes, barriers, tensions, and evidence',
    sectionIds: ['structural_tensions', 'structural_barriers', 'structural_confidence', 'supporting_evidence', 'root_causes'],
  },
  {
    name: 'Way Forward',
    desc: 'Phased delivery plan, Gantt timeline, ROI, and agreed next steps',
    sectionIds: ['way_forward', 'report_conclusion', 'facilitator_contact'],
  },
  {
    name: 'Connected Model',
    desc: 'Causal chain, enabler pathways, and the full transformation logic map',
    sectionIds: ['transformation_priorities', 'connected_model'],
  },
];

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

export function renderExecutiveSummary(summary: ReportSummary, intelligence: WorkshopOutputIntelligence, cfg: ReportSectionConfig, orgName?: string, workshopName?: string): string {
  const es = summary.executiveSummary;
  const ss = summary.solutionSummary;
  if (!es) return '';

  // ── Block 0: Context intro ────────────────────────────────────────────────
  const clientLabel = orgName || 'the organisation';
  const workshopLabel = workshopName || 'Contact Centre Transformation';
  const contextIntro = `
    <div class="es-context-intro">
      This report summarises the findings from the <strong>${esc(workshopLabel)}</strong> discovery workshop conducted for <strong>${esc(clientLabel)}</strong>. The analysis draws on structured workshop signals, participant evidence, and five intelligence engines to surface root causes, alignment gaps, and a recommended transformation path.
    </div>`;

  // ── Block 1: What We Were Asked ──────────────────────────────────────────
  const askText = es.theAsk || summary.workshopAsk || '';
  const askBand = askText ? `
    <div class="es-ask-band">
      <div class="es-band-label">What We Were Asked</div>
      <p class="es-ask-text">${esc(askText)}</p>
    </div>` : '';

  // ── Block 2: The Answer (hero) ────────────────────────────────────────────
  const answerBand = es.theAnswer ? `
    <div class="es-answer-band">
      <div class="es-band-label es-band-label-primary">The Answer</div>
      <p class="es-answer-text">${esc(es.theAnswer)}</p>
    </div>` : '';

  // ── Block 3: What We Found ────────────────────────────────────────────────
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
      <div class="lens-card">
        <div class="lens-name">${esc(lf.lens)}</div>
        <div class="lens-finding">${esc(lf.finding)}</div>
      </div>`).join('');

  // ── Block 4: Approach to Resolve ─────────────────────────────────────────
  const approachBlock = (ss?.direction || es.whyItMatters || es.opportunityOrRisk) ? `
    <div class="es-section-label">Approach to Resolve</div>
    ${ss?.direction ? `<div class="es-solution-preview" style="margin-bottom:12px">
      <div class="es-band-label" style="color:#10b981">Transformation Direction</div>
      <div class="sol-title">${esc(ss.direction)}</div>
      ${ss?.rationale ? `<div class="sol-rationale">${esc(ss.rationale)}</div>` : ''}
    </div>` : ''}
    ${(es.whyItMatters || es.opportunityOrRisk) ? `<div class="es-two-col">
      ${es.whyItMatters ? `<div class="es-muted-card">
        <div class="es-band-label">Why It Matters</div>
        <p class="es-body-text">${esc(es.whyItMatters)}</p>
      </div>` : '<div></div>'}
      ${es.opportunityOrRisk ? `<div class="es-amber-card">
        <div class="es-band-label es-band-label-amber">Opportunity / Risk</div>
        <p class="es-amber-text">${esc(es.opportunityOrRisk)}</p>
      </div>` : '<div></div>'}
    </div>` : ''}` : '';

  // ── Block 5: Timeline + Gantt ─────────────────────────────────────────────
  const roadmapPhases = intelligence.roadmap?.phases ?? [];
  const phaseColorsEs = [
    { color: '#6366f1', borderColor: '#a5b4fc', textColor: '#4338ca', bgColor: '#eff6ff' },
    { color: '#10b981', borderColor: '#6ee7b7', textColor: '#065f46', bgColor: '#ecfdf5' },
    { color: '#8b5cf6', borderColor: '#c4b5fd', textColor: '#6d28d9', bgColor: '#f5f3ff' },
  ];
  const esGanttPhases: WayForwardPhase[] = roadmapPhases.slice(0, 3).map((p, i) => {
    const c = phaseColorsEs[i] ?? phaseColorsEs[0];
    return {
      phase: ((i + 1) as 1 | 2 | 3),
      name: p.phase ?? `Phase ${i + 1}`,
      timeline: p.timeframe ?? '',
      color: c.color,
      borderColor: c.borderColor,
      textColor: c.textColor,
      bgColor: c.bgColor,
      items: (p.initiatives ?? []).slice(0, 3).map(init => ({
        nodeId: `es:${i}:${init.title ?? ''}`,
        label: init.title ?? '',
        description: init.outcome ?? init.description ?? '',
        isManual: false,
      })),
      dependencies: (p.dependencies ?? []).join(', '),
      expectedOutcome: p.initiatives?.[0]?.outcome ?? '',
    };
  });
  const timelineCards = esGanttPhases.map((phase, i) => `
      <div class="es-timeline-card" style="border-top:3px solid ${phase.color}">
        <div class="es-timeline-num" style="color:${phase.color}">${i + 1}</div>
        <div class="es-timeline-phase">${esc(phase.name)}</div>
        ${phase.timeline ? `<div class="es-timeline-tf">${esc(phase.timeline)}</div>` : ''}
      </div>`).join('');

  // Full initiative-level Gantt (with cost/benefit curves) — same as Brain Scan
  const esGanttHtml = intelligence.roadmap
    ? renderPdfRoadmapGantt(intelligence.roadmap)
    : (esGanttPhases.length > 0 ? renderWayForwardGantt(esGanttPhases) : '');

  const urgencyBand = es.urgency ? `
    <div class="es-urgency-band" style="margin-top:12px">
      <div class="es-urgency-icon">⚠</div>
      <div>
        <div class="es-band-label">Why Act Now</div>
        <p class="es-body-text">${esc(es.urgency)}</p>
      </div>
    </div>` : '';

  const timelineBlock = (esGanttHtml || timelineCards || urgencyBand) ? `
    <div class="es-section-label">Delivery Timeline &amp; ROI</div>
    ${esGanttHtml}
    ${timelineCards ? `<div class="es-timeline-grid">${timelineCards}</div>` : ''}
    ${urgencyBand}` : '';

  // ── Block 6: Indicative ROI ───────────────────────────────────────────────
  const roi = intelligence.roadmap?.roiSummary;
  let roiBlock = '';
  if (roi) {
    const stats = [
      roi.totalProgrammeCost   ? `<div class="es-roi-stat"><div class="es-roi-val">${esc(roi.totalProgrammeCost)}</div><div class="es-roi-lbl">Investment</div></div>` : '',
      roi.totalThreeYearBenefit ? `<div class="es-roi-stat"><div class="es-roi-val" style="color:#10b981">${esc(roi.totalThreeYearBenefit)}</div><div class="es-roi-lbl">3-Year Benefit</div></div>` : '',
      roi.paybackPeriod        ? `<div class="es-roi-stat"><div class="es-roi-val" style="color:#6366f1">${esc(roi.paybackPeriod)}</div><div class="es-roi-lbl">Payback Period</div></div>` : '',
    ].filter(Boolean).join('');
    roiBlock = `
      <div class="es-section-label">Indicative ROI</div>
      <div class="es-roi-box">
        ${stats ? `<div class="es-roi-stats">${stats}</div>` : ''}
        ${roi.narrative ? `<p class="es-roi-narrative">${esc(roi.narrative)}</p>` : ''}
      </div>`;
  } else if (intelligence.strategicImpact?.businessCaseSummary) {
    roiBlock = `
      <div class="es-section-label">Indicative ROI</div>
      <div class="es-roi-box">
        <p class="es-roi-narrative">${esc(intelligence.strategicImpact.businessCaseSummary)}</p>
      </div>`;
  }

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Executive Summary</div></div>
      ${contextIntro}
      ${askBand}
      ${answerBand}
      ${findings ? `<div class="es-section-label">What We Found</div><div class="findings-list">${findings}</div>` : ''}
      ${lensRows ? `<div class="es-section-label">Evidence to Address</div><div class="lens-grid">${lensRows}</div>` : ''}
      ${approachBlock}
      ${timelineBlock}
      ${roiBlock}
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
      ${sectionIntro('What the data confirms — validated issues with confidence levels and evidence drawn directly from the discovery process.')}
      ${discoveryValidation.summary ? `<div class="narrative-lead">${esc(discoveryValidation.summary)}</div>` : ''}
      <div class="evidence-card">
        <div class="evidence-header">
          Confirmed Issues
          <span class="badge-muted">Hypothesis accuracy: ${discoveryValidation.hypothesisAccuracy != null ? `${discoveryValidation.hypothesisAccuracy}%` : '—'}</span>
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
      const lenses = (rc.affectedLenses ?? []).map(l => `<span class="cause-lens">${esc(l)}</span>`).join('');
      return `
        <div class="cause-card">
          <div class="cause-meta">
            <span class="cause-rank">#${rc.rank}</span>
            <span class="cause-sev" style="background:${col.bg};color:${col.text}">${esc(rc.severity)}</span>
          </div>
          <div class="cause-body">
            <div class="cause-title">${esc(rc.cause)}</div>
            <div class="cause-cat">${esc(rc.category)}</div>
            ${(rc.evidence ?? []).slice(0, 2).map(e => `<div class="cause-ev">· ${esc(e)}</div>`).join('')}
            ${lenses ? `<div class="cause-lenses">${lenses}</div>` : ''}
          </div>
        </div>`;
    }).join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Root Causes</div></div>
      ${rootCause.forceFieldHeadline ? `<div class="force-field-headline">${esc(rootCause.forceFieldHeadline)}</div>` : ''}
      ${sectionIntro('The underlying drivers behind the symptoms. These are the structural causes that, if unaddressed, will regenerate the same problems regardless of the solution applied.')}
      ${rootCause.systemicPattern ? `<div class="narrative-lead">${esc(rootCause.systemicPattern)}</div>` : ''}
      <div class="cause-list">${causes}</div>
    </section>`;
}

export function renderSolutionDirection(
  summary: ReportSummary,
  intelligence: WorkshopOutputIntelligence,
  cfg: ReportSectionConfig,
  houseImages?: { old: string | null; refreshed: string | null; ideal: string | null },
): string {
  const ss = summary.solutionSummary;
  const { roadmap, futureState } = intelligence;

  // ── Three Houses framework ────────────────────────────────────────────────
  const defaultHouses = {
    current:    { label: 'The Noisy, Cluttered Present',  description: "Today's constrained reality — legacy systems, accumulated baggage, and internal noise that prevents forward movement." },
    transition: { label: 'The Trap of Small Fixes',       description: 'Incremental improvements that look like progress but leave the fundamental system unchanged. Feels like running in place.' },
    future:     { label: 'True Reimagination',             description: 'A fundamentally different operating model where structural constraints are removed and the vision can actually be delivered.' },
  };
  const houses = futureState?.threeHouses ?? defaultHouses;
  const houseCards = [
    { key: 'current',    img: houseImages?.old,       cls: 'house-current',    h: houses.current },
    { key: 'transition', img: houseImages?.refreshed, cls: 'house-transition', h: houses.transition },
    { key: 'future',     img: houseImages?.ideal,     cls: 'house-future',     h: houses.future },
  ].map(({ img, cls, h }) => `
    <div class="house-card ${cls}">
      ${img ? `<div class="house-img-wrap"><img src="${img}" alt="${esc(h.label)}" class="house-img" /></div>` : ''}
      <div class="house-label">${esc(h.label)}</div>
      <p class="house-desc">${esc(h.description)}</p>
    </div>`).join('');

  const threeHousesBlock = `
    <div class="sd-section-label">The Reimagination Framework</div>
    <div class="house-grid">${houseCards}</div>`;

  // ── Direction hero ────────────────────────────────────────────────────────
  const directionHero = ss.direction ? `
    <div class="sd-direction-hero">
      <div class="sd-direction-label">Transformation Direction</div>
      <div class="sd-direction-text">${esc(ss.direction)}</div>
    </div>` : '';

  // ── Rationale ─────────────────────────────────────────────────────────────
  const rationaleBlock = ss.rationale ? `
    <div class="sd-section-card">
      <div class="sd-sub-label">The Rationale</div>
      <p class="sd-body-text">${esc(ss.rationale)}</p>
    </div>` : '';

  // ── What Must Change — Today's Reality vs Required Change ─────────────────
  const wmc = (ss.whatMustChange ?? [])
    .filter((_, i) => !isExcluded(cfg, `step:${i}`))
    .map((s) => `
      <div class="wmc-item">
        <div class="wmc-area-label">${esc(s.area)}</div>
        <div class="wmc-split">
          <div class="wmc-today">
            <div class="wmc-split-label wmc-today-label">Today&apos;s Reality</div>
            <p class="wmc-split-text">${esc(s.currentState ?? '')}</p>
          </div>
          <div class="wmc-required">
            <div class="wmc-split-label wmc-required-label">Required Change</div>
            <p class="wmc-split-text">${esc(s.requiredChange ?? '')}</p>
          </div>
        </div>
      </div>`).join('');

  // ── Target Operating Model ────────────────────────────────────────────────
  const tomBlock = futureState?.targetOperatingModel ? `
    <div class="sd-section-card">
      <div class="sd-sub-label">Target Operating Model</div>
      <p class="sd-body-text">${esc(futureState.targetOperatingModel)}</p>
    </div>` : '';

  // ── Redesign Principles ───────────────────────────────────────────────────
  const principles = (futureState?.redesignPrinciples ?? []);
  const principlesBlock = principles.length > 0 ? `
    <div class="sd-principles-grid">
      ${principles.map(p => `
        <div class="sd-principle-item">
          <span class="sd-principle-check">✓</span>
          <span class="sd-principle-text">${esc(p)}</span>
        </div>`).join('')}
    </div>` : '';

  // ── Roadmap phases ────────────────────────────────────────────────────────
  const PHASE_COLORS_PDF = [
    { border: '#6366f1', bg: '#eff2ff', numBg: '#6366f1', label: '#4338ca' },
    { border: '#10b981', bg: '#ecfdf5', numBg: '#10b981', label: '#065f46' },
    { border: '#8b5cf6', bg: '#f5f3ff', numBg: '#8b5cf6', label: '#6d28d9' },
  ];

  const phases = (roadmap?.phases ?? [])
    .filter((_, i) => !isExcluded(cfg, `phase:${i}`))
    .map((p, i) => {
      const c = PHASE_COLORS_PDF[i] ?? PHASE_COLORS_PDF[0];
      const initiatives = (p.initiatives ?? []).slice(0, 5).map(init =>
        `<div class="sd-phase-init">· <span class="sd-phase-init-title">${esc(init.title)}</span>${init.outcome ? ` — ${esc(init.outcome)}` : ''}</div>`
      ).join('');
      const caps = (p.capabilities ?? []).map(cap => `<span class="sd-phase-cap">${esc(cap)}</span>`).join('');
      return `
        <div class="sd-phase-card" style="border-color:${c.border};background:${c.bg}">
          <div class="sd-phase-header">
            <div class="sd-phase-num" style="background:${c.numBg}">${i + 1}</div>
            <div class="sd-phase-title-wrap">
              <div class="sd-phase-name" style="color:${c.label}">${esc(p.phase ?? '')}</div>
              ${p.timeframe ? `<div class="sd-phase-timeframe">${esc(p.timeframe)}</div>` : ''}
            </div>
          </div>
          ${initiatives ? `<div class="sd-phase-initiatives">${initiatives}</div>` : ''}
          ${caps ? `<div class="sd-phase-caps">${caps}</div>` : ''}
        </div>`;
    }).join('');

  const criticalPath = roadmap?.criticalPath ? `
    <div class="sd-section-card">
      <div class="sd-sub-label">Critical Path</div>
      <p class="sd-body-text">${esc(roadmap.criticalPath)}</p>
    </div>` : '';

  const keyRisks = (roadmap?.keyRisks ?? []);
  const risksBlock = keyRisks.length > 0 ? `
    <div class="sd-risks-card">
      <div class="sd-risks-label">Key Risks</div>
      ${keyRisks.map(r => `<div class="sd-risk-item">· ${esc(r)}</div>`).join('')}
    </div>` : '';

  // ── Starting Point + Success Indicators ──────────────────────────────────
  const startSuccessBlock = (ss.startingPoint || (ss.successIndicators ?? []).length > 0) ? `
    <div class="sd-start-success-grid">
      ${ss.startingPoint ? `
        <div class="sd-section-card">
          <div class="sd-sub-label">Starting Point</div>
          <p class="sd-body-text">${esc(ss.startingPoint)}</p>
        </div>` : '<div></div>'}
      ${(ss.successIndicators ?? []).length > 0 ? `
        <div class="sd-section-card">
          <div class="sd-sub-label">Success Looks Like</div>
          ${(ss.successIndicators ?? []).map(s => `
            <div class="sd-success-item">
              <span class="sd-success-check">✓</span>
              <span class="sd-success-text">${esc(s)}</span>
            </div>`).join('')}
        </div>` : '<div></div>'}
    </div>` : '';

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Solution Direction</div></div>
      ${sectionIntro('The recommended transformation path — what must change, how to approach it, and the reimagined future state the organisation is working towards.')}
      ${directionHero}
      ${rationaleBlock}
      ${threeHousesBlock}
      ${wmc ? `<div class="sd-section-label">What Must Change</div><div class="sd-wmc-list">${wmc}</div>` : ''}
      ${tomBlock}
      ${principlesBlock ? `<div class="sd-section-label">Redesign Principles</div>${principlesBlock}` : ''}
      ${phases ? `<div class="sd-section-label">Transformation Roadmap</div><div class="sd-phases-list">${phases}</div>` : ''}
      ${criticalPath}
      ${risksBlock}
      ${startSuccessBlock}
    </section>`;
}

export function renderJourneyMap(journey: LiveJourneyData, intro: string | undefined, cfg: ReportSectionConfig): string {
  void cfg;

  const totalInteractions = journey.interactions.length;
  const painPoints = journey.interactions.filter(i => i.isPainPoint);
  const totalPainPoints = painPoints.length;
  const totalActors = journey.actors.length;
  const totalStages = journey.stages.length;

  // ── Stage flow bar ─────────────────────────────────────────────────────────
  const stageFlow = journey.stages.map((s, i) => `
    <div class="jsum-stage">
      <div class="jsum-stage-num">${i + 1}</div>
      <div class="jsum-stage-name">${esc(s)}</div>
    </div>
    ${i < journey.stages.length - 1 ? '<div class="jsum-stage-arrow">›</div>' : ''}`
  ).join('');

  // ── Pain points grouped by stage ──────────────────────────────────────────
  const stagesWithPain = journey.stages
    .map(stage => {
      const stagePains = painPoints.filter(p => p.stage.toLowerCase() === stage.toLowerCase());
      return { stage, pains: stagePains };
    })
    .filter(s => s.pains.length > 0);

  const painByStage = stagesWithPain.map(({ stage, pains }) => `
    <div class="jsum-pain-group" style="break-inside:avoid;page-break-inside:avoid">
      <div class="jsum-pain-stage">${esc(stage)}</div>
      ${pains.map(p => `
        <div class="jsum-pain-item">
          <span class="jsum-pain-dot">●</span>
          <span class="jsum-pain-actor">${esc(p.actor)}</span>
          <span class="jsum-pain-action">${esc(p.action)}</span>
        </div>`).join('')}
    </div>`).join('');

  // ── Actor involvement summary ──────────────────────────────────────────────
  const actorRows = journey.actors.map(actor => {
    const actorInts = journey.interactions.filter(i => i.actor.toLowerCase() === actor.name.toLowerCase());
    const actorPains = actorInts.filter(i => i.isPainPoint).length;
    const negCount = actorInts.filter(i => ['negative', 'critical', 'frustrated'].includes(i.sentiment)).length;
    const posCount = actorInts.filter(i => ['positive', 'satisfied'].includes(i.sentiment)).length;
    const sentiment = negCount > posCount ? '⚠ friction dominant' : posCount > negCount ? '✓ generally positive' : '~ mixed signals';
    const sentColor = negCount > posCount ? '#b91c1c' : posCount > negCount ? '#065f46' : '#92400e';
    return `<tr style="break-inside:avoid;page-break-inside:avoid">
      <td class="jsum-actor-name">${esc(actor.name)}</td>
      <td class="jsum-actor-role">${esc(actor.role)}</td>
      <td class="jsum-actor-count">${actorInts.length}</td>
      <td class="jsum-actor-pain" style="color:#b91c1c;font-weight:700">${actorPains > 0 ? actorPains : '—'}</td>
      <td class="jsum-actor-sent" style="color:${sentColor};font-size:8pt">${sentiment}</td>
    </tr>`;
  }).join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Customer Journey</div></div>
      ${sectionIntro('The customer experience mapped across all touchpoints — where friction concentrates, which actors carry the most pain, and where intervention will deliver the greatest improvement.')}
      ${intro ? `<div class="narrative-lead">${esc(intro)}</div>` : ''}

      <!-- Stats bar -->
      <div class="jsum-stats">
        <div class="jsum-stat"><div class="jsum-stat-val">${totalActors}</div><div class="jsum-stat-lbl">Actors</div></div>
        <div class="jsum-stat"><div class="jsum-stat-val">${totalStages}</div><div class="jsum-stat-lbl">Stages</div></div>
        <div class="jsum-stat"><div class="jsum-stat-val">${totalInteractions}</div><div class="jsum-stat-lbl">Interactions</div></div>
        <div class="jsum-stat jsum-stat-pain"><div class="jsum-stat-val">${totalPainPoints}</div><div class="jsum-stat-lbl">Pain Points</div></div>
      </div>

      <!-- Stage flow -->
      <div class="jsum-section-label">Journey Stages</div>
      <div class="jsum-stage-flow">${stageFlow}</div>

      <!-- Pain points by stage -->
      ${painByStage ? `
      <div class="jsum-section-label" style="margin-top:18px">Where Pain Concentrates — by Stage</div>
      <div class="jsum-pain-grid">${painByStage}</div>` : ''}

      <!-- Actor table -->
      <div class="jsum-section-label" style="margin-top:18px">Actor Involvement Summary</div>
      <div class="jsum-table-wrap">
        <table class="jsum-table">
          <thead>
            <tr>
              <th class="jsum-th">Actor</th>
              <th class="jsum-th">Role</th>
              <th class="jsum-th" style="text-align:center">Interactions</th>
              <th class="jsum-th" style="text-align:center">Pain Points</th>
              <th class="jsum-th">Signal</th>
            </tr>
          </thead>
          <tbody>${actorRows}</tbody>
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
      ${sectionIntro('The measurable business case for change — automation potential, efficiency gains, and customer experience improvements derived from workshop signals.')}
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
      ${sectionIntro('How the organisation is performing across four critical diagnostic dimensions — Operational Reality, Leadership Alignment, Systemic Friction, and Transformation Readiness — derived from participant signals.')}
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
    const level      = s.consensusLevel ?? 0;
    const agreementLabel = level >= 70 ? 'aligned' : level >= 50 ? 'mixed views' : 'contested';
    const dominantTone = concerned > optimistic + 15 ? 'Tension area' : optimistic > concerned + 15 ? 'Opportunity area' : '';
    return `
      <div class="sig-row">
        <div class="sig-meta">
          <span class="sig-icon">${esc(s.icon ?? '')}</span>
          <span class="sig-domain">${esc(s.domain)}</span>
          ${dominantTone ? `<span class="sig-tone-badge ${concerned > optimistic + 15 ? 'sig-tone-tension' : 'sig-tone-opportunity'}">${dominantTone}</span>` : ''}
          <span class="sig-consensus">${level}% agreement <span class="sig-agreement-label">${agreementLabel}</span></span>
        </div>
        <div class="sig-bar-wrap">
          <div class="sig-bar-seg sig-concerned"  style="width:${concerned}%"></div>
          <div class="sig-bar-seg sig-neutral"     style="width:${neutral}%"></div>
          <div class="sig-bar-seg sig-optimistic"  style="width:${optimistic}%"></div>
        </div>
        <div class="sig-legend">
          <span class="sig-c">⚠ Friction ${concerned}%</span>
          <span class="sig-n">Neutral ${neutral}%</span>
          <span class="sig-o">✓ Opportunity ${optimistic}%</span>
        </div>
      </div>`;
  }).join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Discovery Signals</div></div>
      ${discoveryOutput._aiSummary ? `<div class="narrative-lead">${esc(discoveryOutput._aiSummary)}</div>` : ''}
      ${sectionIntro('The emotional tone and agreement levels across each organisational lens — surfacing where concern concentrates and where genuine opportunity exists.')}
      <p class="sig-bar-intro">How participants feel about each area — and how aligned they are in that view</p>
      <div class="sig-list">${sectionRows}</div>
      <p class="sig-key-note">High friction + high agreement = a confirmed, shared problem. High friction + low agreement = a contested tension worth exploring.</p>
    </section>`;
}

export function renderInsightSummary(intelligence: WorkshopOutputIntelligence): string {
  const dv = intelligence.discoveryValidation;
  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Insight Map Summary</div></div>
      <p class="insight-summary-text">${esc(dv.summary)}</p>
      <div class="insight-stats">
        <div class="insight-stat"><div class="insight-stat-val indigo">${dv.hypothesisAccuracy != null ? `${dv.hypothesisAccuracy}%` : '—'}</div><div class="insight-stat-label">Hypothesis Accuracy</div></div>
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
  const allScores = divergent.map(c => c.alignmentScore);
  const allIdentical = allScores.length > 1 && allScores.every(s => s === allScores[0]);
  const uniformNote = allIdentical
    ? `<div class="struct-uniform-note">⚠ All measured actor–theme combinations returned the same score (${allScores[0].toFixed(2)}), indicating systemic misalignment across every dimension — not isolated pockets of tension. This is the most severe misalignment pattern: the organisation disagrees uniformly with itself.</div>`
    : '';
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
      ${sectionIntro('Where leadership narratives diverge from frontline experience — the alignment gap that undermines execution and creates invisible drag on organisational performance.')}
      <div class="narrative-lead">The alignment analysis reveals where different organisational layers hold fundamentally different views on the same themes. Negative alignment scores indicate that what leadership believes is happening differs materially from what frontline participants experience. These divergence points are the invisible failure modes in any transformation — strategies fail not because the logic is wrong, but because the organisation isn't aligned on the problem in the first place.</div>
      ${uniformNote}
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

  const LAYER_BG:     Record<string, string> = { executive: '#f5f3ff', operational: '#eff6ff', frontline: '#fffbeb' };
  const LAYER_BORDER: Record<string, string> = { executive: '#ddd6fe', operational: '#bfdbfe', frontline: '#fde68a' };
  const LAYER_BAR:    Record<string, string> = { executive: '#6366f1', operational: '#10b981', frontline: '#f59e0b' };
  const LAYER_LABEL:  Record<string, string> = { executive: 'Executive', operational: 'Operational', frontline: 'Frontline' };
  const SENT_COLOR:   Record<string, string> = { positive: '#065f46', negative: '#b91c1c', neutral: '#6b7280', mixed: '#b45309' };
  const SENT_LABEL:   Record<string, string> = { positive: 'Positive sentiment', negative: 'Negative sentiment', neutral: 'Neutral sentiment', mixed: 'Mixed sentiment' };

  const cards = layers.map(layer => {
    const bg        = LAYER_BG[layer.layer]     ?? '#f9fafb';
    const border    = LAYER_BORDER[layer.layer] ?? '#e5e7eb';
    const barColor  = LAYER_BAR[layer.layer]    ?? '#6366f1';
    const sentColor = SENT_COLOR[layer.dominantSentiment] ?? '#374151';
    const sentLabel = SENT_LABEL[layer.dominantSentiment] ?? layer.dominantSentiment;
    const layerLabel = LAYER_LABEL[layer.layer] ?? layer.layer;

    // Term rows with horizontal bars + counts (matching app chart)
    // Fall back to count-relative width if normalised is missing/zero
    const maxCount = Math.max(...layer.topTerms.map(t => t.count ?? 0), 1);
    const terms = layer.topTerms.slice(0, 8).map(tt => {
      const pct = tt.normalised
        ? Math.round(tt.normalised * 100)
        : Math.round(((tt.count ?? 0) / maxCount) * 100);
      return `
        <div class="narr-term-row">
          <span class="narr-term-name">${esc(tt.term)}</span>
          <div class="narr-bar-wrap">
            <div class="narr-bar" style="width:${pct}%;background:${barColor}"></div>
          </div>
          <span class="narr-term-count">${tt.count}</span>
        </div>`;
    }).join('');

    // Temporal focus bar
    const tf = layer.temporalFocus ?? { past: 33, present: 34, future: 33 };
    const total = (tf.past ?? 0) + (tf.present ?? 0) + (tf.future ?? 0) || 100;
    const pastPct    = Math.round(((tf.past    ?? 0) / total) * 100);
    const presentPct = Math.round(((tf.present ?? 0) / total) * 100);
    const futurePct  = Math.round(((tf.future  ?? 0) / total) * 100);

    // Sample phrase (first one, truncated)
    const phrase = (layer.samplePhrases ?? [])[0] ?? '';
    const phraseHtml = phrase
      ? `<p class="narr-phrase">&ldquo;${esc(phrase.slice(0, 120))}${phrase.length > 120 ? '…' : ''}&rdquo;</p>`
      : '';

    return `
      <div class="narr-card" style="background:${bg};border-color:${border}">
        <div class="narr-header">
          <div class="narr-layer" style="color:${barColor}">${esc(layerLabel)}</div>
          <div class="narr-count">${layer.participantCount ?? ''} people</div>
        </div>
        <div class="narr-sentiment" style="color:${sentColor}">${esc(sentLabel)}</div>
        <div class="narr-terms">${terms}</div>
        <div class="narr-temporal-wrap">
          <div class="narr-temporal-label">Temporal focus</div>
          <div class="narr-temporal-bar">
            <div style="width:${pastPct}%;background:#cbd5e1"></div>
            <div style="width:${presentPct}%;background:#94a3b8"></div>
            <div style="width:${futurePct}%;background:#334155"></div>
          </div>
          <div class="narr-temporal-ticks"><span>Past</span><span>Present</span><span>Future</span></div>
        </div>
        ${phraseHtml}
      </div>`;
  }).join('');

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Narrative Divergence</div></div>
      ${sectionIntro('Competing stories in the organisation — identified through divergent participant perspectives on the same challenges, revealing where leadership and frontline narratives pull apart.')}
      <p class="struct-subtitle">Language and sentiment differences across organisational layers — executive vs operational vs frontline</p>
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
      ${sectionIntro('The unresolved tensions that create drag on progress — areas where the organisation is simultaneously pulling in different directions, making consistent execution difficult.')}
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
      ${sectionIntro('The structural inhibitors to transformation — systemic blockers that surface repeatedly across multiple lenses and roles, indicating deep-rooted organisational constraints.')}
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
      ${sectionIntro("The organisation's own assessment of its readiness to transform — confidence levels across change capabilities, leadership alignment, and execution capacity.")}
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

  // Build data-driven signal distribution chart from discoverAnalysis
  let signalChart = '';
  if (conf) {
    const total = conf.overall.certain + conf.overall.hedging + conf.overall.uncertain;
    const certainPct  = total > 0 ? Math.round((conf.overall.certain  / total) * 100) : 0;
    const hedgingPct  = total > 0 ? Math.round((conf.overall.hedging  / total) * 100) : 0;
    const uncertainPct = 100 - certainPct - hedgingPct;

    const domainRows = (conf.byDomain ?? []).slice(0, 10).map(d => {
      const dt = d.distribution.certain + d.distribution.hedging + d.distribution.uncertain;
      const cp = dt > 0 ? Math.round((d.distribution.certain  / dt) * 100) : 0;
      const hp = dt > 0 ? Math.round((d.distribution.hedging  / dt) * 100) : 0;
      const up = 100 - cp - hp;
      return `
        <div class="smap-row">
          <div class="smap-domain">${esc(d.domain)}</div>
          <div class="conf-bar-wrap" style="flex:1">
            <div class="conf-seg conf-certain"    style="width:${cp}%"></div>
            <div class="conf-seg conf-hedging"    style="width:${hp}%"></div>
            <div class="conf-seg conf-uncertain"  style="width:${up}%"></div>
          </div>
          <div class="smap-pct">${cp}%</div>
        </div>`;
    }).join('');

    signalChart = `
      <div class="smap-chart-wrap">
        <div class="smap-overall-label">Overall Signal Certainty</div>
        <div class="conf-bar-wrap conf-overall-bar" style="margin-bottom:6px">
          <div class="conf-seg conf-certain"    style="width:${certainPct}%"></div>
          <div class="conf-seg conf-hedging"    style="width:${hedgingPct}%"></div>
          <div class="conf-seg conf-uncertain"  style="width:${uncertainPct}%"></div>
        </div>
        <div class="conf-legend" style="margin-bottom:16px">
          <span class="conf-leg-item conf-leg-certain">● ${certainPct}% certain</span>
          <span class="conf-leg-item conf-leg-hedging">● ${hedgingPct}% hedging</span>
          <span class="conf-leg-item conf-leg-uncertain">● ${uncertainPct}% uncertain</span>
        </div>
        ${domainRows ? `<div class="smap-domain-label">BY DOMAIN</div><div class="smap-rows">${domainRows}</div>` : ''}
      </div>`;
  }

  const narrative = conf
    ? `Signal certainty across the organisation shows ${conf.overall.hedging > conf.overall.certain ? 'hedging language dominates' : 'certainty is present in key areas'}. ${conf.byDomain?.[0] ? `The "${conf.byDomain[0].domain}" domain shows the ${conf.byDomain[0].distribution.certain > conf.byDomain[0].distribution.hedging ? 'highest confidence' : 'most hedging'}, indicating ${conf.byDomain[0].distribution.certain > conf.byDomain[0].distribution.hedging ? 'alignment' : 'uncertainty'} in this area.` : ''}`
    : '';

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Discovery Signal Map</div></div>
      ${sectionIntro("Distribution of participant signals across the discovery — showing where certainty, hedging, and uncertainty concentrate across organisational domains.")}
      ${imageUrl ? `<div class="signal-map-img-wrap"><img src="${esc(imageUrl)}" class="signal-map-img" alt="Discovery Signal Map" /></div>` : signalChart || `
      <div class="signal-map-placeholder">
        <p class="signal-map-note">No signal distribution data available for this workshop.</p>
      </div>`}
      <div class="signal-map-legend">
        <div class="signal-map-legend-item"><span style="background:#10b981" class="legend-dot"></span>Certain — clear, confident language</div>
        <div class="signal-map-legend-item"><span style="background:#f59e0b" class="legend-dot"></span>Hedging — qualified, uncertain language</div>
        <div class="signal-map-legend-item"><span style="background:#f87171" class="legend-dot"></span>Uncertain — contradictory or unclear signals</div>
      </div>
      ${narrative ? `<p class="signal-map-narrative">${esc(narrative)}</p>` : ''}
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

// ── TLM Graph SVG ─────────────────────────────────────────────────────────────

export function renderTLMGraph(tlm: TransformationLogicMap | undefined): string {
  if (!tlm || !tlm.nodes?.length) return '';

  const constraints   = tlm.nodes.filter(n => n.layer === 'CONSTRAINT');
  const enablers      = tlm.nodes.filter(n => n.layer === 'ENABLER');
  const visions       = tlm.nodes.filter(n => n.layer === 'REIMAGINATION');

  // SVG dimensions
  const W = 760;
  const COL_W = W / 3;
  const NODE_R = 18;
  const ROW_H = 48;
  const HEADER_H = 38;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 20;

  const maxRows = Math.max(constraints.length, enablers.length, visions.length, 1);
  const H = HEADER_H + PAD_TOP + maxRows * ROW_H + PAD_BOTTOM;

  // Build node position map
  type NodePos = { cx: number; cy: number; r: number; layer: string; label: string; isCoalescent: boolean; isOrphan: boolean; freq: number };
  const positions = new Map<string, NodePos>();

  const maxFreq = Math.max(...tlm.nodes.map(n => n.rawFrequency ?? 0), 1);

  const placeNodes = (nodes: typeof tlm.nodes, colIndex: number) => {
    nodes.forEach((n, i) => {
      const freqBoost = Math.round(((n.rawFrequency ?? 0) / maxFreq) * 5);
      const r = (n.isCoalescent ? NODE_R + 4 : n.isOrphan ? NODE_R - 3 : NODE_R) + freqBoost;
      const cx = colIndex * COL_W + COL_W / 2;
      const cy = HEADER_H + PAD_TOP + i * ROW_H + ROW_H / 2;
      positions.set(n.nodeId, { cx, cy, r, layer: n.layer, label: n.displayLabel, isCoalescent: n.isCoalescent ?? false, isOrphan: n.isOrphan ?? false, freq: n.rawFrequency ?? 0 });
    });
  };

  placeNodes(constraints, 0);
  placeNodes(enablers,    1);
  placeNodes(visions,     2);

  // Edge lines
  const edgeSvg = (tlm.edges ?? []).map(e => {
    const src = positions.get(e.fromNodeId);
    const tgt = positions.get(e.toNodeId);
    if (!src || !tgt) return '';
    const strength = (e.score ?? 50) / 100;
    const opacity = 0.12 + strength * 0.45;
    const stroke = e.relationshipType === 'enables' ? '#6366f1'
      : e.relationshipType === 'constrains' || e.relationshipType === 'blocks' ? '#ef4444'
      : '#94a3b8';
    const sw = e.isChainEdge ? 2.5 : 1 + strength * 1.5;
    return `<line x1="${src.cx}" y1="${src.cy}" x2="${tgt.cx}" y2="${tgt.cy}" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${opacity}" />`;
  }).join('');

  // Node circles
  const nodeSvg = Array.from(positions.values()).map(p => {
    const fill  = p.layer === 'CONSTRAINT' ? '#fef2f2' : p.layer === 'ENABLER' ? '#eff6ff' : '#f0fdf4';
    const stroke = p.layer === 'CONSTRAINT' ? '#ef4444' : p.layer === 'ENABLER' ? '#6366f1' : '#10b981';
    const textColor = p.layer === 'CONSTRAINT' ? '#b91c1c' : p.layer === 'ENABLER' ? '#3730a3' : '#065f46';
    const label = p.label.length > 14 ? p.label.slice(0, 13) + '…' : p.label;

    const coalRing = p.isCoalescent
      ? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r + 8}" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-opacity="0.5" stroke-dasharray="4 3" />`
      : '';
    const orphanDot = p.isOrphan
      ? `<circle cx="${p.cx + p.r - 2}" cy="${p.cy - p.r + 2}" r="4" fill="#ef4444" />`
      : '';

    return `
      ${coalRing}
      <circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />
      ${orphanDot}
      <text x="${p.cx}" y="${p.cy + 3}" text-anchor="middle" font-size="6" font-family="Inter,sans-serif" fill="${textColor}" font-weight="600">${esc(label)}</text>`;
  }).join('');

  // Column headers
  const headers = [
    { label: 'Challenges', count: constraints.length, color: '#ef4444', bg: '#fef2f2' },
    { label: 'Enablers',   count: enablers.length,    color: '#6366f1', bg: '#eff6ff' },
    { label: 'Vision',     count: visions.length,     color: '#10b981', bg: '#f0fdf4' },
  ].map((h, i) => `
    <rect x="${i * COL_W}" y="0" width="${COL_W}" height="${HEADER_H}" fill="${h.bg}" />
    <rect x="${i * COL_W}" y="0" width="${COL_W}" height="3" fill="${h.color}" />
    <text x="${i * COL_W + COL_W / 2}" y="${HEADER_H / 2 + 2}" text-anchor="middle" font-size="8" font-family="Inter,sans-serif" font-weight="700" fill="${h.color}">${h.label}</text>
    <text x="${i * COL_W + COL_W / 2}" y="${HEADER_H / 2 + 13}" text-anchor="middle" font-size="7" font-family="Inter,sans-serif" fill="${h.color}" opacity="0.7">${h.count} node${h.count !== 1 ? 's' : ''}</text>
  `).join('');

  // Column separator lines
  const dividers = [1, 2].map(i =>
    `<line x1="${i * COL_W}" y1="${HEADER_H}" x2="${i * COL_W}" y2="${H}" stroke="#e2e8f0" stroke-width="1" />`
  ).join('');

  const coverageBar = tlm.coverageScore != null ? (() => {
    const pct = Math.round((tlm.coverageScore ?? 0) * 100);
    const barW = Math.round((pct / 100) * (W - 160));
    return `
      <rect x="0" y="${H - 18}" width="${W}" height="18" fill="#f8fafc" />
      <text x="8" y="${H - 6}" font-size="7" font-family="Inter,sans-serif" fill="#94a3b8" font-weight="600">COVERAGE</text>
      <rect x="80" y="${H - 14}" width="${W - 160}" height="6" rx="3" fill="#e2e8f0" />
      <rect x="80" y="${H - 14}" width="${barW}" height="6" rx="3" fill="#10b981" />
      <text x="${W - 70}" y="${H - 6}" font-size="7" font-family="Inter,sans-serif" fill="#10b981" font-weight="700">${pct}% addressed</text>`;
  })() : '';

  const svgH = H + (tlm.coverageScore != null ? 0 : 0);

  return `
    <div class="tlm-graph-wrap">
      <svg viewBox="0 0 ${W} ${svgH}" xmlns="http://www.w3.org/2000/svg" class="tlm-graph-svg" style="width:100%;height:auto;display:block;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
        <rect width="${W}" height="${svgH}" fill="#ffffff" />
        ${headers}
        ${dividers}
        <g class="edges">${edgeSvg}</g>
        <g class="nodes">${nodeSvg}</g>
        ${coverageBar}
      </svg>
      <div class="tlm-legend">
        <div class="tlm-legend-item"><span class="tlm-leg-dot" style="background:#ef4444"></span>Challenge</div>
        <div class="tlm-legend-item"><span class="tlm-leg-dot" style="background:#6366f1"></span>Enabler</div>
        <div class="tlm-legend-item"><span class="tlm-leg-dot" style="background:#10b981"></span>Vision</div>
        <div class="tlm-legend-item"><span style="display:inline-block;width:10px;height:10px;border:1.5px dashed #f59e0b;border-radius:50%;margin-right:4px;vertical-align:middle"></span>Pressure point</div>
        <div class="tlm-legend-item"><span class="tlm-leg-dot" style="background:#ef4444;width:7px;height:7px"></span>Orphan</div>
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
      ${sectionIntro('The highest-leverage nodes in the system — ranked by structural significance and cross-role impact, not just frequency of mention. These are the issues to act on first.')}
      <div class="tp-summary-bar">
        <p class="tp-summary-headline">${esc(execSum.headline)}</p>
        ${execSum.pressure ? `<p class="tp-summary-sub">${esc(execSum.pressure)}</p>` : ''}
      </div>
      <div class="tp-cards">${cards}</div>
    </section>`;
}

// ── Way Forward ───────────────────────────────────────────────────────────────

// ── Simple 3-phase bar (used in Executive Summary timeline block) ─────────────
function renderWayForwardGantt(phases: WayForwardPhase[]): string {
  if (!phases.length) return '';
  const W = 700; const H = 72; const BAR_H = 34; const Y = 22;
  const segW = Math.round(W / phases.length);

  const bars = phases.map((p, i) => {
    const x = i * segW;
    const w = i === phases.length - 1 ? W - x : segW;
    return `
      <rect x="${x}" y="${Y}" width="${w}" height="${BAR_H}" rx="0" fill="${p.color}22" />
      <rect x="${x}" y="${Y}" width="${w}" height="3" fill="${p.color}" />
      <text x="${x + w / 2}" y="${Y + BAR_H / 2 - 3}" text-anchor="middle" font-size="9" font-family="Inter,Helvetica,sans-serif" font-weight="700" fill="${p.color}">${esc(p.name.toUpperCase())}</text>
      <text x="${x + w / 2}" y="${Y + BAR_H / 2 + 10}" text-anchor="middle" font-size="7.5" font-family="Inter,Helvetica,sans-serif" fill="${p.color}bb">${esc(p.timeline)}</text>`;
  }).join('');

  const dividers = phases.slice(0, -1).map((_, i) => {
    const x = (i + 1) * segW;
    return `<line x1="${x}" y1="${Y}" x2="${x}" y2="${Y + BAR_H}" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="3 2" />`;
  }).join('');

  const ticks = phases.map((p, i) => {
    const x = i * segW;
    const label = i === 0 ? 'Now' : p.timeline.split('–')[0].trim().split('-')[0].trim();
    return `<text x="${x + 4}" y="${Y - 5}" font-size="6.5" font-family="Inter,Helvetica,sans-serif" fill="#94a3b8">${esc(label)}</text>`;
  }).join('');

  return `
    <div class="wf-gantt-wrap">
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
        <rect width="${W}" height="${H}" fill="#f8fafc" />
        ${ticks}${bars}${dividers}
      </svg>
    </div>`;
}

// ── Parse £k/£m mid-point (for PDF ROI curves) ───────────────────────────────
function parseMidKForPdf(s: string): number {
  if (!s) return 0;
  const matches = [...(s.matchAll(/£?\s*(\d+(?:\.\d+)?)\s*(k|m)?/gi))];
  if (!matches.length) return 0;
  const vals = matches.slice(0, 2).map(m => {
    const n = parseFloat(m[1]);
    const unit = (m[2] ?? '').toLowerCase();
    return unit === 'm' ? n * 1000 : unit === 'k' ? n : n;
  });
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ── Full initiative-level Gantt (used in Way Forward section) ────────────────
// Mirrors the Brain Scan Gantt: initiative bars by phase + cumulative cost/benefit curves
export function renderPdfRoadmapGantt(roadmap: ExecutionRoadmap): string {
  const phases = roadmap?.phases ?? [];
  if (!phases.length) return '';

  // Phase windows in real weeks (matching the fixed ExecutionRoadmapPanel)
  const PHASE_WINS = [[0, 13], [13, 39], [39, 78]];
  const TOTAL_W_CHART = 156; // 3 years
  const PHASE_COLORS = ['#2563eb', '#7e22ce', '#047857'];
  const PHASE_COLORS_LIGHT = ['#dbeafe', '#ede9fe', '#d1fae5'];

  // SVG layout constants
  const SVG_W = 700;
  const LABEL_W = 210;
  const RIGHT_M = 44; // space for right-side £ axis
  const CHART_W = SVG_W - LABEL_W - RIGHT_M;
  const TOP_H = 34;   // phase header band
  const BOT_H = 22;   // week label row
  const BAR_H = 15;
  const BAR_GAP = 4;

  const toX = (w: number) => LABEL_W + (w / TOTAL_W_CHART) * CHART_W;

  // Build initiative rows
  const rows: Array<{ label: string; pi: number; x1w: number; x2w: number }> = [];
  phases.slice(0, 3).forEach((phase, pi) => {
    const win = PHASE_WINS[pi] ?? PHASE_WINS[2];
    const inits = phase.initiatives ?? [];
    const count = Math.max(inits.length, 1);
    const span  = win[1] - win[0];
    inits.forEach((init, ii) => {
      const seg   = Math.floor(span / count);
      const x1w   = win[0] + ii * seg;
      const x2w   = ii === count - 1 ? win[1] : x1w + seg;
      rows.push({ label: init.title ?? '', pi, x1w, x2w });
    });
  });
  if (!rows.length) return '';

  const CHART_H = TOP_H + rows.length * (BAR_H + BAR_GAP) + BAR_GAP + BOT_H;

  // Phase band backgrounds + headers
  const phaseBands = PHASE_WINS.slice(0, phases.length).map((win, pi) => {
    const x = toX(win[0]);
    const bw = toX(win[1]) - x;
    const mid = toX((win[0] + win[1]) / 2);
    const costLbl = roadmap.roiSummary?.phases?.[pi]?.estimatedCost ?? '';
    const phLabel = `Phase ${pi + 1}`;
    return `
      <rect x="${x.toFixed(1)}" y="${TOP_H}" width="${bw.toFixed(1)}" height="${CHART_H - TOP_H - BOT_H}" fill="${PHASE_COLORS_LIGHT[pi]}" opacity="0.45"/>
      <rect x="${x.toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${TOP_H}" fill="${PHASE_COLORS[pi]}" opacity="0.1"/>
      <text x="${mid.toFixed(1)}" y="12" text-anchor="middle" font-size="8" font-weight="700" font-family="Inter,Helvetica,sans-serif" fill="${PHASE_COLORS[pi]}">${phLabel}</text>
      ${costLbl ? `<text x="${mid.toFixed(1)}" y="26" text-anchor="middle" font-size="7" font-family="Inter,Helvetica,sans-serif" fill="${PHASE_COLORS[pi]}">£ ${esc(costLbl)}</text>` : ''}`;
  }).join('');

  // Initiative bars
  const barRows = rows.map((r, i) => {
    const y   = TOP_H + BAR_GAP + i * (BAR_H + BAR_GAP);
    const x   = toX(r.x1w);
    const bw  = Math.max(toX(r.x2w) - x - 1, 12);
    const col = PHASE_COLORS[r.pi] ?? '#6366f1';
    const lbl = r.label;
    return `
      <text x="${(LABEL_W - 5).toFixed(1)}" y="${(y + BAR_H / 2 + 3.5).toFixed(1)}" text-anchor="end" font-size="7.5" font-family="Inter,Helvetica,sans-serif" fill="#475569">${esc(lbl)}</text>
      <rect x="${x.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${BAR_H}" rx="3" fill="${col}" opacity="0.82"/>`;
  }).join('');

  // Grid lines at phase boundaries
  const gridLines = [13, 39, 78].map(w => {
    const x = toX(w);
    return `<line x1="${x.toFixed(1)}" y1="${TOP_H}" x2="${x.toFixed(1)}" y2="${CHART_H - BOT_H}" stroke="#94a3b8" stroke-width="0.75" stroke-dasharray="3,3"/>`;
  }).join('');

  // Axis tick marks + labels at bottom
  const axisTicks = [
    { w: 0,   lbl: 'Now'  },
    { w: 13,  lbl: '3 mo' },
    { w: 39,  lbl: '9 mo' },
    { w: 78,  lbl: '18 mo' },
    { w: 104, lbl: '2 yr'  },
    { w: 130, lbl: '2.5 yr' },
    { w: 156, lbl: '3 yr'  },
  ].map(({ w, lbl }) => {
    const x = toX(w);
    const anchor = w === 0 ? 'start' : w === TOTAL_W_CHART ? 'end' : 'middle';
    return `
      <line x1="${x.toFixed(1)}" y1="${TOP_H}" x2="${x.toFixed(1)}" y2="${CHART_H - BOT_H + 4}" stroke="#cbd5e1" stroke-width="0.5"/>
      <text x="${x.toFixed(1)}" y="${CHART_H - 5}" text-anchor="${anchor}" font-size="6.5" font-family="Inter,Helvetica,sans-serif" fill="#94a3b8">${lbl}</text>`;
  }).join('');

  // Build cumulative cost / benefit curves from roiSummary
  let roiOverlay = '';
  const roi = roadmap.roiSummary;
  if (roi?.phases?.length) {
    const costs    = roi.phases.map(p => parseMidKForPdf(p.estimatedCost));
    const benefits = roi.phases.map(p => parseMidKForPdf(p.estimatedAnnualBenefit) / 52);
    // Break-even weeks: phase end (real weeks) + post-delivery months
    const breakEvens = roi.phases.map((p, pi) => {
      const phaseEnd = PHASE_WINS[pi]?.[1] ?? 78;
      const m = p.breakEvenTimeline?.match(/(\d+)\s*[-–]\s*(\d+)\s*months?/i);
      if (m) return phaseEnd + ((parseInt(m[1]) + parseInt(m[2])) / 2) * 4.33;
      const s = p.breakEvenTimeline?.match(/(\d+)\s*months?/i);
      return s ? phaseEnd + parseInt(s[1]) * 4.33 : phaseEnd + 26;
    });

    // Build curve points 0–156 in steps of 4
    const pts: Array<{ w: number; cost: number; ben: number }> = [];
    let cCost = 0, cBen = 0;
    for (let w = 0; w <= TOTAL_W_CHART; w += 4) {
      for (let ph = 0; ph < roi.phases.length; ph++) {
        const [ws, we] = PHASE_WINS[ph] ?? [0, 13];
        if (w > ws && w <= we) cCost += (costs[ph] / (we - ws)) * 4;
      }
      for (let ph = 0; ph < roi.phases.length; ph++) {
        if (w >= (breakEvens[ph] ?? 999)) cBen += benefits[ph] * 4;
      }
      pts.push({ w, cost: Math.round(cCost), ben: Math.round(cBen) });
    }

    const maxVal = Math.max(...pts.map(p => Math.max(p.cost, p.ben)), 100);
    const yMax   = maxVal * 1.15;
    const chartH = CHART_H - TOP_H - BOT_H;
    const toY    = (v: number) => TOP_H + chartH * (1 - v / yMax);

    const costPath    = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.w).toFixed(1)},${toY(p.cost).toFixed(1)}`).join(' ');
    const benPath     = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.w).toFixed(1)},${toY(p.ben).toFixed(1)}`).join(' ');

    // Right-axis £ labels
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => {
      const val = yMax * pct;
      const y   = toY(val);
      const lbl = val >= 1000 ? `£${(val / 1000).toFixed(1)}m` : val === 0 ? '£0' : `£${Math.round(val)}k`;
      return `<text x="${(LABEL_W + CHART_W + 6).toFixed(1)}" y="${y.toFixed(1)}" font-size="6.5" font-family="Inter,Helvetica,sans-serif" fill="#94a3b8" dominant-baseline="middle">${lbl}</text>`;
    }).join('');

    // Payback crossover marker
    let paybackMarker = '';
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].ben >= pts[i].cost && pts[i - 1].ben < pts[i - 1].cost) {
        const px = toX(pts[i].w);
        const py = toY(pts[i].cost);
        paybackMarker = `
          <line x1="${px.toFixed(1)}" y1="${TOP_H}" x2="${px.toFixed(1)}" y2="${(CHART_H - BOT_H).toFixed(1)}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.7"/>
          <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="#f59e0b" stroke="#fff" stroke-width="1.5"/>
          <rect x="${(px + 5).toFixed(1)}" y="${(py - 16).toFixed(1)}" width="58" height="14" rx="3" fill="#fef3c7" stroke="#f59e0b" stroke-width="0.75" fill-opacity="0.95"/>
          <text x="${(px + 8).toFixed(1)}" y="${(py - 5).toFixed(1)}" font-size="6.5" font-weight="700" font-family="Inter,Helvetica,sans-serif" fill="#b45309">Payback ~${pts[i].w}w</text>`;
        break;
      }
    }

    // Benefit area fill
    const benAreaPath = [
      `M${toX(0).toFixed(1)},${toY(0).toFixed(1)}`,
      ...pts.map(p => `L${toX(p.w).toFixed(1)},${toY(p.ben).toFixed(1)}`),
      `L${toX(TOTAL_W_CHART).toFixed(1)},${toY(0).toFixed(1)} Z`,
    ].join(' ');

    roiOverlay = `
      <defs><linearGradient id="pdf-ben-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.02"/>
      </linearGradient></defs>
      <path d="${benAreaPath}" fill="url(#pdf-ben-grad)"/>
      <path d="${costPath}" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="7,4" opacity="0.85"/>
      <path d="${benPath}" fill="none" stroke="#059669" stroke-width="2" opacity="0.85"/>
      ${paybackMarker}
      ${yTicks}`;
  }

  // Legend row
  const legend = `
    <div style="display:flex;flex-wrap:wrap;gap:10px 20px;margin-top:6px;padding:0 2px;font-size:7.5pt;font-family:Inter,Helvetica,sans-serif;color:#64748b">
      ${phases.slice(0, 3).map((ph, pi) => `
        <span style="display:inline-flex;align-items:center;gap:5px">
          <span style="display:inline-block;width:12px;height:10px;border-radius:2px;background:${PHASE_COLORS[pi]}"></span>
          Phase ${pi + 1}${ph.timeframe ? ` · ${esc(ph.timeframe)}` : ''}${roadmap.roiSummary?.phases?.[pi]?.estimatedCost ? ` · ${esc(roadmap.roiSummary.phases[pi].estimatedCost)}` : ''}
        </span>`).join('')}
      <span style="display:inline-flex;align-items:center;gap:5px;border-left:1px solid #e2e8f0;margin-left:4px;padding-left:12px">
        <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="#dc2626" stroke-width="2" stroke-dasharray="5,3"/></svg> Cumul. cost
      </span>
      <span style="display:inline-flex;align-items:center;gap:5px">
        <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="#059669" stroke-width="2.5"/></svg> Cumul. benefit
      </span>
    </div>`;

  return `
    <div class="wf-gantt-wrap" style="padding:0">
      <svg viewBox="0 0 ${SVG_W} ${CHART_H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
        <rect width="${SVG_W}" height="${CHART_H}" fill="#f8fafc" rx="8"/>
        ${phaseBands}
        ${gridLines}
        ${axisTicks}
        ${barRows}
        ${roiOverlay}
      </svg>
      ${legend}
    </div>`;
}

export function renderWayForward(
  tlm: TransformationLogicMap | undefined,
  intelligence?: WorkshopOutputIntelligence,
): string {
  // Try TLM-derived phases first
  let phases: WayForwardPhase[] = [];
  if (tlm) {
    phases = buildWayForward(tlm, new Set());
  }

  // Fallback: derive phases from intelligence.roadmap.phases when TLM absent or yields nothing
  if (phases.length === 0 && intelligence?.roadmap?.phases?.length) {
    const phaseColors = [
      { color: '#6366f1', borderColor: '#a5b4fc', textColor: '#4338ca', bgColor: '#eff6ff' },
      { color: '#10b981', borderColor: '#6ee7b7', textColor: '#065f46', bgColor: '#ecfdf5' },
      { color: '#8b5cf6', borderColor: '#c4b5fd', textColor: '#6d28d9', bgColor: '#f5f3ff' },
    ];
    phases = intelligence.roadmap.phases.slice(0, 3).map((p, i) => {
      const c = phaseColors[i] ?? phaseColors[0];
      return {
        phase: ((i + 1) as 1 | 2 | 3),
        name: p.phase ?? `Phase ${i + 1}`,
        timeline: p.timeframe ?? '',
        color: c.color,
        borderColor: c.borderColor,
        textColor: c.textColor,
        bgColor: c.bgColor,
        items: (p.initiatives ?? []).slice(0, 5).map(init => ({
          nodeId: `roadmap:${i}:${init.title ?? ''}`,
          label: init.title ?? '',
          description: init.outcome ?? init.description ?? '',
          isManual: false,
        })),
        dependencies: (p.dependencies ?? []).join(', '),
        expectedOutcome: p.initiatives?.[0]?.outcome ?? p.initiatives?.[0]?.description ?? '',
      };
    });
  }

  const totalItems = phases.reduce((s, p) => s + p.items.length, 0);
  if (phases.length === 0 && totalItems === 0) return '';

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
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;align-items:start">
          <div>
            <div class="wf-phase-header">
              <div class="wf-phase-num" style="background:${phase.color}">${phase.phase}</div>
              <div>
                <div class="wf-phase-name" style="color:${phase.textColor}">${esc(phase.name)}</div>
                <div class="wf-phase-timeline">${esc(phase.timeline)}</div>
              </div>
            </div>
            <div class="wf-items">${items}</div>
          </div>
          <div>
            <div class="wf-outcome-box" style="border-color:${phase.borderColor}">
              <div class="wf-outcome-label" style="color:${phase.color}">Expected outcome</div>
              <p class="wf-outcome-text">${esc(phase.expectedOutcome)}</p>
            </div>
            <p class="wf-dependencies"><strong>Requires:</strong> ${esc(phase.dependencies)}</p>
          </div>
        </div>
      </div>`;
  }).join('');

  // Use the full initiative-level Gantt (with cost/benefit curves) when roadmap data is available
  const fullGantt = intelligence?.roadmap ? renderPdfRoadmapGantt(intelligence.roadmap) : renderWayForwardGantt(phases);

  return `
    <section class="report-section">
      <div class="section-title-bar"><div class="section-accent"></div><div class="section-title">Way Forward</div></div>
      ${sectionIntro('A sequenced, three-phase plan derived from the transformation logic map — ordered by structural dependency, not urgency, to ensure each phase builds on solid foundations.')}
      <p class="wf-intro">Delivery timeline — initiative bars by phase with cumulative cost and benefit curves.</p>
      ${fullGantt}
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
      ${sectionIntro('How the root causes, enablers, and outcomes connect — the causal chain showing how current constraints block the vision, and what pathways exist to resolve them.')}
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
      ${sectionIntro('Agreed actions and the critical next decisions coming out of this discovery engagement — what happens now, who owns it, and what success looks like in the next 90 days.')}
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
  .cover { page-break-after: always; min-height: 256mm; background: #ffffff; border-radius: 8px; display: flex; flex-direction: column; padding: 0 0 40px; position: relative; overflow: hidden; }
  .cover::after { content: ''; position: absolute; bottom: -40px; right: -40px; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%); pointer-events: none; }
  .cover-banner { width: 100%; border-radius: 8px; overflow: hidden; margin-top: 28px; }
  .cover-banner img { width: 100%; height: auto; display: block; }
  .cover-top { display: flex; align-items: center; justify-content: space-between; padding: 20px 44px; border-bottom: 1px solid #f1f5f9; margin-bottom: auto; }
  .cover-top-dream { font-size: 9pt; font-weight: 800; letter-spacing: 0.28em; color: #6366f1; text-transform: uppercase; flex: 1; }
  .cover-top-title { font-size: 9pt; font-weight: 600; color: #374151; text-align: center; flex: 2; padding: 0 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cover-top-client { flex: 1; display: flex; justify-content: flex-end; align-items: center; }
  .cover-client-name { font-size: 9pt; font-weight: 500; color: #374151; text-align: right; }
  .cover-client-logo { max-height: 36px; max-width: 120px; object-fit: contain; }
  .cover-body { padding: 48px 44px 0; }
  .cover-eyebrow { font-size: 8.5pt; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #6366f1; margin-bottom: 18px; display: flex; align-items: center; gap: 10px; }
  .cover-eyebrow::after { content: ''; flex: 0 0 40px; height: 1px; background: #6366f1; }
  .cover-title { font-size: 30pt; font-weight: 800; line-height: 1.1; color: #0f172a; margin-bottom: 14px; letter-spacing: -0.02em; }
  .cover-subtitle { font-size: 12pt; font-weight: 400; color: #6b7280; margin-bottom: 40px; line-height: 1.5; }
  .cover-divider { width: 48px; height: 3px; background: #6366f1; border-radius: 2px; margin-bottom: 28px; }
  .cover-footer { margin-top: auto; padding: 28px 44px 0; border-top: 1px solid #f1f5f9; display: flex; align-items: flex-end; justify-content: space-between; }
  .cover-meta-label { font-size: 7.5pt; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px; }
  .cover-meta-value { font-size: 10pt; font-weight: 600; color: #374151; }
  .cover-prepared-by { text-align: right; }

  /* ── TOC ─── */
  .toc-page { page-break-after: always; }
  .toc-masthead { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 13px; border-bottom: 1.5px solid #0f172a; margin-bottom: 22px; }
  .toc-masthead-eyebrow { font-size: 5.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.32em; color: #94a3b8; margin-bottom: 6px; }
  .toc-masthead-title { font-size: 16pt; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; line-height: 1.15; }
  .toc-masthead-right { text-align: right; padding-bottom: 2px; }
  .toc-masthead-date { font-size: 8pt; font-weight: 600; color: #1e293b; letter-spacing: 0.04em; }
  .toc-masthead-meta { font-size: 6pt; color: #94a3b8; margin-top: 4px; letter-spacing: 0.08em; text-transform: uppercase; }
  .toc-columns { display: flex; gap: 0; align-items: flex-start; }
  .toc-col { flex: 1; min-width: 0; }
  .toc-col:first-child { padding-right: 20px; border-right: 1px solid #e2e8f0; }
  .toc-col:last-child { padding-left: 20px; }
  .toc-chapter-block { margin-top: 16px; }
  .toc-chapter-block:first-child { margin-top: 0; }
  .toc-chapter-hd { border-left: 3px solid #6366f1; padding: 5px 0 5px 10px; margin-bottom: 7px; }
  .toc-chapter-hd-name { font-size: 7pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.22em; color: #4338ca; line-height: 1.2; }
  .toc-chapter-hd-desc { font-size: 5.5pt; color: #94a3b8; line-height: 1.5; margin-top: 3px; font-style: italic; }
  .toc-item { display: flex; gap: 10px; padding: 5px 0; border-bottom: 1px dashed #e8edf3; align-items: flex-start; }
  .toc-item:last-child { border-bottom: none; }
  .toc-item-solo { margin-bottom: 6px; }
  .toc-n { font-size: 6pt; font-weight: 700; color: #c7d2e0; min-width: 18px; flex-shrink: 0; padding-top: 2px; font-variant-numeric: tabular-nums; letter-spacing: 0.03em; }
  .toc-item-body { flex: 1; min-width: 0; }
  .toc-t { font-size: 8.5pt; font-weight: 700; color: #1e293b; display: block; line-height: 1.25; }
  .toc-d { font-size: 6pt; color: #94a3b8; line-height: 1.4; margin-top: 2px; display: block; }

  /* ── Section chrome ─── */
  .journey-section { page: landscape-page; page-break-before: always; page-break-after: always; page-break-inside: avoid; }
  .report-section { margin-bottom: 28px; }
  .cause-card, .evidence-row, .finding-item, .lens-row, .phase-card, .step-item, .next-step-item, .tension-item, .diag-card, .sig-row, .toc-row { page-break-inside: avoid; break-inside: avoid; }
  .section-title-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; page-break-after: avoid; break-after: avoid; }
  .sd-sub-label { break-after: avoid; page-break-after: avoid; }
  .section-intro { break-after: avoid; page-break-after: avoid; }
  table { break-inside: avoid; page-break-inside: avoid; }
  thead { break-inside: avoid; page-break-inside: avoid; display: table-header-group; }
  .section-accent { width: 4px; height: 22px; border-radius: 2px; background: #6366f1; flex-shrink: 0; }
  .section-title { font-size: 13pt; font-weight: 700; color: #111827; letter-spacing: -0.01em; }

  /* ── Executive summary ─── */
  /* legacy classes kept for any old snapshots */
  .qa-card { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .qa-question { font-size: 9pt; font-weight: 500; color: #9ca3af; margin-bottom: 8px; line-height: 1.5; }
  .qa-answer { font-size: 12pt; font-weight: 700; color: #111827; line-height: 1.35; margin-bottom: 10px; }
  .qa-urgency { font-size: 10pt; color: #475569; font-style: italic; line-height: 1.5; }
  /* new banded layout */
  .es-ask-band { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; }
  .es-ask-text { font-size: 10.5pt; color: #374151; line-height: 1.7; margin: 0; }
  .es-answer-band { background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%); border-radius: 10px; padding: 18px 22px; margin-bottom: 18px; }
  .es-band-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: #6b7280; margin-bottom: 6px; }
  .es-band-label-primary { color: rgba(255,255,255,0.6); }
  .es-band-label-amber { color: #b45309; }
  .es-answer-text { font-size: 13pt; font-weight: 700; color: #ffffff; line-height: 1.35; margin: 0; }
  .es-section-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: #9ca3af; margin-bottom: 10px; margin-top: 18px; break-after: avoid; page-break-after: avoid; }
  .findings-list { margin-bottom: 6px; }
  .finding-item { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  .finding-num { flex-shrink: 0; width: 22px; height: 22px; background: #0f172a; color: white; border-radius: 50%; font-size: 8pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .finding-item p { font-size: 10pt; color: #374151; line-height: 1.6; }
  .lens-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px; break-inside: avoid; page-break-inside: avoid; }
  .lens-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #6366f1; border-radius: 0 8px 8px 0; padding: 10px 14px; }
  .lens-row { display: grid; grid-template-columns: 150px 1fr; gap: 14px; background: #f8fafc; border-left: 3px solid #6366f1; border-radius: 0 8px 8px 0; padding: 9px 14px; }
  .lens-name { font-size: 8.5pt; font-weight: 700; color: #374151; margin-bottom: 3px; }
  .lens-finding { font-size: 9pt; color: #6b7280; line-height: 1.5; }
  .es-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; margin-top: 6px; }
  .es-muted-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; }
  .es-amber-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; }
  .es-amber-text { font-size: 10pt; color: #78350f; line-height: 1.6; margin: 0; }
  .es-body-text { font-size: 10pt; color: #374151; line-height: 1.6; margin: 0; }
  .es-urgency-band { display: flex; gap: 12px; align-items: flex-start; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; }
  .es-urgency-icon { font-size: 16pt; line-height: 1; flex-shrink: 0; color: #d97706; margin-top: 1px; }
  .es-solution-preview { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px 18px; margin-top: 12px; }
  .transform-block { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; margin-top: 6px; }
  .transform-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #16a34a; margin-bottom: 6px; }
  .solution-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px 18px; }
  .sol-title { font-size: 12pt; font-weight: 700; color: #065f46; margin-bottom: 6px; }
  .sol-rationale { font-size: 9.5pt; color: #374151; margin-bottom: 10px; line-height: 1.6; }
  .sol-rationale-text { font-size: 10.5pt; color: #374151; line-height: 1.7; margin-bottom: 20px; }
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
  .narrative-lead { font-size: 11pt; color: #1e293b; line-height: 1.75; margin-bottom: 20px; padding: 16px 20px; background: #f8fafc; border-left: 4px solid #6366f1; border-radius: 0 8px 8px 0; }
  .force-field-headline { font-size: 16pt; font-weight: 800; color: #0f172a; line-height: 1.3; margin-bottom: 20px; padding: 20px 24px; background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); border-radius: 12px; text-align: center; letter-spacing: -0.02em; }
  .cause-list { display: grid; gap: 12px; }
  .cause-card { display: flex; gap: 14px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
  .cause-meta { display: flex; flex-direction: column; align-items: center; gap: 5px; flex-shrink: 0; padding-top: 2px; }
  .cause-rank { font-size: 9pt; font-weight: 700; color: #9ca3af; font-family: monospace; }
  .cause-sev { font-size: 7.5pt; font-weight: 600; padding: 2px 6px; border-radius: 5px; white-space: nowrap; }
  .cause-title { font-size: 10.5pt; font-weight: 600; color: #111827; margin-bottom: 3px; }
  .cause-cat { font-size: 8.5pt; color: #9ca3af; margin-bottom: 6px; }
  .cause-ev { font-size: 9pt; color: #6b7280; padding: 2px 0; line-height: 1.5; }
  .cause-lenses { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
  .cause-lens { font-size: 7.5pt; color: #64748b; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 20px; padding: 1px 7px; }

  /* ── Solution direction ─── */
  .sol-vision { font-size: 12pt; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.35; }
  .sol-rationale-text { font-size: 10.5pt; color: #374151; line-height: 1.7; margin-bottom: 20px; }
  .step-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
  .step-item { display: flex; gap: 12px; align-items: flex-start; background: #f8fafc; border-radius: 8px; padding: 10px 14px; }
  .step-num { flex-shrink: 0; width: 22px; height: 22px; background: #0f172a; color: white; border-radius: 50%; font-size: 8pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .step-change { font-size: 9.5pt; color: #6b7280; line-height: 1.5; }
  .phases-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; page-break-inside: avoid; break-inside: avoid; }
  .phase-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; }
  .phase-name { font-size: 9.5pt; font-weight: 700; color: #111827; margin-bottom: 3px; }
  .phase-horizon { font-size: 8pt; color: #9ca3af; margin-bottom: 8px; font-weight: 500; }
  .phase-action { font-size: 9pt; color: #374151; padding: 2px 0; line-height: 1.5; }
  /* new solution direction layout */
  .sd-direction-hero { background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%); border-radius: 12px; padding: 20px 24px; margin-bottom: 14px; }
  .sd-direction-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: rgba(255,255,255,0.6); margin-bottom: 6px; }
  .sd-direction-text { font-size: 13pt; font-weight: 700; color: #ffffff; line-height: 1.35; }
  .sd-section-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; }
  .sd-sub-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: #9ca3af; margin-bottom: 8px; }
  .sd-body-text { font-size: 10pt; color: #374151; line-height: 1.7; margin: 0; }
  .sd-section-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: #9ca3af; margin-bottom: 10px; margin-top: 18px; }
  .sd-wmc-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 6px; }
  .wmc-item { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; background: #ffffff; }
  .wmc-area-label { font-size: 9pt; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
  .wmc-split { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .wmc-today { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; break-inside: avoid; page-break-inside: avoid; }
  .wmc-required { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 12px; break-inside: avoid; page-break-inside: avoid; }
  .wmc-split-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; }
  .wmc-today-label { color: #dc2626; }
  .wmc-required-label { color: #16a34a; }
  .wmc-split-text { font-size: 9pt; line-height: 1.6; margin: 0; }
  .wmc-today .wmc-split-text { color: #7f1d1d; }
  .wmc-required .wmc-split-text { color: #14532d; }
  .sd-principles-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px; }
  .sd-principle-item { display: flex; gap: 8px; align-items: flex-start; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; }
  .sd-principle-check { color: #6366f1; font-weight: 700; font-size: 10pt; flex-shrink: 0; }
  .sd-principle-text { font-size: 9pt; color: #374151; line-height: 1.5; }
  .sd-phases-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 6px; }
  .sd-phase-card { border: 1px solid; border-radius: 10px; padding: 14px 16px; }
  .sd-phase-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
  .sd-phase-num { width: 28px; height: 28px; border-radius: 50%; color: white; font-size: 10pt; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sd-phase-title-wrap { flex: 1; }
  .sd-phase-name { font-size: 10.5pt; font-weight: 700; line-height: 1.2; margin-bottom: 2px; }
  .sd-phase-timeframe { font-size: 8pt; color: #94a3b8; }
  .sd-phase-initiatives { display: flex; flex-direction: column; gap: 4px; }
  .sd-phase-init { font-size: 9pt; color: #374151; line-height: 1.5; }
  .sd-phase-init-title { font-weight: 600; }
  .sd-phase-caps { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .sd-phase-cap { font-size: 7.5pt; color: #64748b; background: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.9); border-radius: 20px; padding: 1px 7px; }
  .sd-risks-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; }
  .sd-risks-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #b45309; margin-bottom: 8px; }
  .sd-risk-item { font-size: 9.5pt; color: #78350f; line-height: 1.6; padding: 2px 0; }
  .sd-start-success-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 6px; }
  .sd-success-item { display: flex; gap: 8px; align-items: flex-start; padding: 3px 0; }
  .sd-success-check { color: #10b981; font-weight: 700; font-size: 10pt; flex-shrink: 0; }
  .sd-success-text { font-size: 9.5pt; color: #374151; line-height: 1.5; }

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
  .si-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid; }
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
  .diag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; page-break-inside: avoid; break-inside: avoid; }
  .diag-card { border: 1px solid; border-radius: 10px; padding: 14px 16px; }
  .diag-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 8px; }
  .diag-insight { font-size: 9.5pt; color: #374151; line-height: 1.6; margin-bottom: 6px; }
  .diag-ev-list { margin: 0; padding-left: 14px; }
  .diag-ev { font-size: 8.5pt; color: #6b7280; padding: 1px 0; line-height: 1.5; }

  /* ── Discovery Signals ─── */
  .sig-perception-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; }
  .sig-perception-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #94a3b8; margin-bottom: 6px; }
  .sig-summary { font-size: 10pt; color: #374151; line-height: 1.7; margin: 0 0 6px; }
  .sig-perception-note { font-size: 8pt; color: #9ca3af; font-style: italic; margin: 0; }
  .sig-bar-intro { font-size: 8.5pt; color: #64748b; margin-bottom: 8px; }
  .sig-key-note { font-size: 8pt; color: #94a3b8; font-style: italic; margin-top: 10px; line-height: 1.5; }
  .sig-list { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
  .sig-row { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
  .sig-row:last-child { border-bottom: none; }
  .sig-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  .sig-icon { font-size: 12pt; }
  .sig-domain { font-size: 10pt; font-weight: 600; color: #111827; }
  .sig-tone-badge { font-size: 7.5pt; font-weight: 600; padding: 2px 7px; border-radius: 4px; }
  .sig-tone-tension { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .sig-tone-opportunity { background: #f0fdf4; color: #059669; border: 1px solid #bbf7d0; }
  .sig-consensus { font-size: 8pt; color: #6b7280; margin-left: auto; }
  .sig-agreement-label { color: #9ca3af; font-style: italic; }
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
  .struct-uniform-note { font-size: 9pt; color: #92400e; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; line-height: 1.6; break-inside: avoid; page-break-inside: avoid; }
  .struct-table-wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
  .struct-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; break-inside: avoid; page-break-inside: avoid; }
  .struct-thead tr { background: #f9fafb; }
  .struct-th { padding: 8px 14px; text-align: left; font-weight: 700; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 8.5pt; }
  .struct-th-right { padding: 8px 14px; text-align: right; font-weight: 700; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 8.5pt; }
  .struct-td { padding: 9px 14px; color: #111827; border-top: 1px solid #f1f5f9; }
  .struct-td-muted { padding: 9px 14px; color: #6b7280; border-top: 1px solid #f1f5f9; }
  .struct-td-score { padding: 9px 14px; text-align: right; font-weight: 700; border-top: 1px solid #f1f5f9; }
  .struct-sev { padding: 2px 6px; border-radius: 4px; font-size: 8pt; font-weight: 600; }
  .narr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .narr-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; break-inside: avoid; page-break-inside: avoid; }
  .narr-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
  .narr-layer { font-size: 7.5pt; font-weight: 700; text-transform: capitalize; }
  .narr-count { font-size: 6.5pt; color: #9ca3af; }
  .narr-sentiment { font-size: 7.5pt; font-weight: 500; margin-bottom: 7px; text-transform: capitalize; }
  .narr-terms { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; }
  .narr-term-row { display: flex; align-items: center; gap: 5px; }
  .narr-term-name { font-size: 7pt; color: #374151; width: 60px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .narr-bar-wrap { flex: 1; height: 5px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
  .narr-bar { height: 100%; border-radius: 3px; transition: none; }
  .narr-term-count { font-size: 6.5pt; color: #6b7280; width: 14px; text-align: right; flex-shrink: 0; }
  .narr-temporal-wrap { margin-top: 7px; }
  .narr-temporal-label { font-size: 6pt; color: #94a3b8; text-transform: capitalize; margin-bottom: 3px; }
  .narr-temporal-bar { display: flex; height: 4px; border-radius: 3px; overflow: hidden; width: 100%; }
  .narr-temporal-bar > div { height: 100%; }
  .narr-temporal-ticks { display: flex; justify-content: space-between; font-size: 6pt; color: #cbd5e1; margin-top: 2px; }
  .narr-phrase { font-size: 6.5pt; color: #64748b; font-style: italic; line-height: 1.45; margin-top: 6px; border-top: 1px solid #f1f5f9; padding-top: 5px; }
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

  /* ── Signal Map data chart ─── */
  .smap-chart-wrap { margin-bottom: 16px; }
  .smap-overall-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 6px; }
  .smap-domain-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 8px; margin-top: 4px; }
  .smap-rows { display: flex; flex-direction: column; gap: 6px; }
  .smap-row { display: flex; align-items: center; gap: 8px; }
  .smap-domain { font-size: 8pt; color: #475569; width: 140px; flex-shrink: 0; }
  .smap-pct { font-size: 7.5pt; color: #64748b; width: 30px; text-align: right; flex-shrink: 0; }

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

  /* ── TLM Graph ─── */
  .tlm-graph-wrap { margin-bottom: 20px; }
  .tlm-graph-svg { max-height: 320px; }
  .tlm-legend { display: flex; flex-wrap: wrap; gap: 10px 20px; margin-top: 8px; }
  .tlm-legend-item { display: flex; align-items: center; gap: 5px; font-size: 8pt; color: #374151; }
  .tlm-leg-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }

  /* ── Transformation Priorities ─── */
  .tp-summary-bar { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; }
  .tp-summary-headline { font-size: 10.5pt; font-weight: 600; color: #1e293b; line-height: 1.6; margin-bottom: 6px; }
  .tp-summary-sub { font-size: 9.5pt; color: #64748b; line-height: 1.6; margin: 0; }
  .tp-cards { display: flex; flex-direction: column; gap: 14px; }
  .tp-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; background: #ffffff; break-inside: avoid; page-break-inside: avoid; }
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
  .wf-gantt-wrap { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
  .wf-grid { display: flex; flex-direction: column; gap: 20px; }
  .wf-phase { border-radius: 10px; border: 1px solid #e2e8f0; padding: 20px 24px; background: #ffffff; break-inside: avoid; page-break-inside: avoid; }
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

  /* ── Section intro ─── */
  .section-intro { background: #f8fafc; border-left: 3px solid #6366f1; border-radius: 0 8px 8px 0; padding: 10px 14px; margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid; }
  .section-intro-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; display: block; margin-bottom: 4px; }
  .section-intro p { font-size: 9.5pt; color: #475569; line-height: 1.65; margin: 0; }

  /* ── Executive Summary — new blocks ─── */
  .es-approach-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
  .es-timeline-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }
  .es-timeline-card { border-radius: 8px; border: 1px solid #e2e8f0; padding: 12px 14px; background: #ffffff; break-inside: avoid; page-break-inside: avoid; }
  .es-timeline-num { font-size: 18pt; font-weight: 800; line-height: 1; margin-bottom: 4px; }
  .es-timeline-phase { font-size: 8.5pt; font-weight: 600; color: #0f172a; line-height: 1.3; margin-bottom: 4px; }
  .es-timeline-tf { font-size: 8pt; color: #94a3b8; }
  .es-roi-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 18px; break-inside: avoid; page-break-inside: avoid; }
  .es-roi-stats { display: flex; gap: 24px; margin-bottom: 10px; }
  .es-roi-stat { flex: 1; }
  .es-roi-val { font-size: 14pt; font-weight: 800; color: #0f172a; line-height: 1.1; }
  .es-roi-lbl { font-size: 7.5pt; font-weight: 500; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.08em; }
  .es-roi-narrative { font-size: 9.5pt; color: #334155; line-height: 1.7; margin: 0; }

  /* toc-subitems removed — 2-col compact layout replaces hierarchy */

  /* ── Executive Summary context intro ─── */
  .es-context-intro { font-size: 9.5pt; color: #475569; line-height: 1.7; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; break-inside: avoid; page-break-inside: avoid; }
  .es-context-intro strong { color: #0f172a; font-weight: 600; }

  /* ── Journey Summary ─── */
  .jsum-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid; }
  .jsum-stat { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; text-align: center; background: #ffffff; }
  .jsum-stat-pain { border-color: #fca5a5; background: #fff7f7; }
  .jsum-stat-val { font-size: 18pt; font-weight: 800; color: #0f172a; line-height: 1; }
  .jsum-stat-pain .jsum-stat-val { color: #b91c1c; }
  .jsum-stat-lbl { font-size: 7.5pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 3px; }
  .jsum-section-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: #9ca3af; margin-bottom: 10px; break-after: avoid; page-break-after: avoid; }
  .jsum-stage-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 6px; break-inside: avoid; page-break-inside: avoid; }
  .jsum-stage { display: flex; align-items: center; gap: 5px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 5px 9px; }
  .jsum-stage-num { width: 16px; height: 16px; border-radius: 50%; background: #3b82f6; color: #fff; font-size: 7.5pt; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .jsum-stage-name { font-size: 8pt; font-weight: 600; color: #1e3a8a; line-height: 1.2; }
  .jsum-stage-arrow { font-size: 12pt; color: #94a3b8; padding: 0 1px; }
  .jsum-pain-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .jsum-pain-group { background: #fff7f7; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; }
  .jsum-pain-stage { font-size: 8pt; font-weight: 700; color: #991b1b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
  .jsum-pain-item { display: flex; gap: 6px; align-items: flex-start; margin-bottom: 4px; }
  .jsum-pain-dot { color: #ef4444; font-size: 7pt; flex-shrink: 0; margin-top: 2px; }
  .jsum-pain-actor { font-size: 7.5pt; font-weight: 600; color: #374151; flex-shrink: 0; }
  .jsum-pain-action { font-size: 7.5pt; color: #6b7280; line-height: 1.4; }
  .jsum-table-wrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
  .jsum-table { width: 100%; border-collapse: collapse; font-size: 9pt; break-inside: avoid; page-break-inside: avoid; }
  .jsum-th { padding: 7px 12px; background: #f9fafb; text-align: left; font-size: 8pt; font-weight: 700; color: #374151; border-bottom: 1px solid #e5e7eb; }
  .jsum-actor-name { padding: 8px 12px; font-weight: 600; color: #0f172a; border-top: 1px solid #f1f5f9; }
  .jsum-actor-role { padding: 8px 12px; color: #6b7280; font-size: 8.5pt; border-top: 1px solid #f1f5f9; }
  .jsum-actor-count { padding: 8px 12px; text-align: center; color: #374151; border-top: 1px solid #f1f5f9; }
  .jsum-actor-pain { padding: 8px 12px; text-align: center; border-top: 1px solid #f1f5f9; }
  .jsum-actor-sent { padding: 8px 12px; border-top: 1px solid #f1f5f9; }

  /* ── Three Houses ─── */
  .house-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 12px 0 22px; break-inside: avoid; page-break-inside: avoid; }
  .house-card { border-radius: 10px; border: 1px solid #e2e8f0; padding: 12px 14px; background: #ffffff; break-inside: avoid; page-break-inside: avoid; }
  .house-current { border-top: 3px solid #ef4444; }
  .house-transition { border-top: 3px solid #f59e0b; }
  .house-future { border-top: 3px solid #10b981; }
  .house-img-wrap { width: 100%; border-radius: 6px; margin-bottom: 10px; overflow: hidden; background: #f8fafc; }
  .house-img { width: 100%; height: auto; display: block; object-fit: contain; }
  .house-label { font-size: 9.5pt; font-weight: 700; color: #0f172a; margin-bottom: 5px; line-height: 1.3; }
  .house-desc { font-size: 8.5pt; color: #64748b; line-height: 1.6; margin: 0; }
`;

// ── buildReportHtml ───────────────────────────────────────────────────────────

export function buildReportHtml(
  body: ReportHtmlBody,
  dreamLogoBase64: string | null,
  tenantLogoBase64: string | null,
  clientLogoBase64: string | null,
): string {
  void tenantLogoBase64; // reserved for future use
  const { reportSummary, intelligence, layout, liveJourneyData, workshopName, orgName, discoveryOutput, discoverAnalysis, houseImages } = body;

  const enabledSections = layout.sections.filter(s => s.enabled);

  // ── 2-column TOC: grouped by workshop phase ──────────────────────────────────
  // Assign enabled sections to phase groups; preserve layout ordering within phases.
  // Left col: Executive Summary + Discovery Diagnostic
  // Right col: Constraints + Reimagine + Way Forward + Connected Model
  const sectionItems = enabledSections.filter(s => s.type !== 'chapter');
  const sectionIdIndex = new Map(sectionItems.map((s, i) => [s.id, i]));

  const tocLeft: string[] = [];
  const tocRight: string[] = [];
  let tocNum = 0;
  const LEFT_PHASES = new Set(['Executive Summary', 'Discovery Diagnostic', 'Reimagine']);

  for (const phase of TOC_PHASE_GROUPS) {
    // Find enabled sections that belong to this phase, in layout order
    const phaseItems = phase.sectionIds
      .map(id => sectionItems.find(s => s.id === id))
      .filter((s): s is ReportSectionConfig => s !== undefined && sectionIdIndex.has(s.id))
      .sort((a, b) => (sectionIdIndex.get(a.id) ?? 0) - (sectionIdIndex.get(b.id) ?? 0));

    if (phaseItems.length === 0) continue; // skip empty phases

    const col = LEFT_PHASES.has(phase.name) ? tocLeft : tocRight;

    // Phase header
    let html = `<div class="toc-chapter-block"><div class="toc-chapter-hd">
      <div class="toc-chapter-hd-name">${esc(phase.name)}</div>
      <div class="toc-chapter-hd-desc">${esc(phase.desc)}</div>
    </div>`;

    for (const item of phaseItems) {
      tocNum++;
      const desc = TOC_DESCRIPTIONS[item.id] ?? '';
      html += `<div class="toc-item">
        <span class="toc-n">${String(tocNum).padStart(2, '0')}</span>
        <div class="toc-item-body">
          <span class="toc-t">${esc(item.title)}</span>
          ${desc ? `<span class="toc-d">${esc(desc)}</span>` : ''}
        </div>
      </div>`;
    }

    html += '</div>'; // close toc-chapter-block
    col.push(html);
  }

  // ── Body section rendering — ordered by TOC phase groups ───────────────────
  // The body must match the TOC order regardless of how layout.sections is stored in the DB.
  // Strategy: for each content section ID in TOC_PHASE_GROUPS order, render it if enabled.
  // Chapters are inserted before whichever content section immediately follows them
  // in the original layout (so they stay semantically attached to what they introduce).
  const renderOneCfg = (cfg: ReportSectionConfig): string => {
    if (cfg.type === 'chapter') return renderChapter(cfg);
    if (cfg.type === 'custom')  return renderCustomSection(cfg);
    switch (cfg.id) {
      case 'executive_summary':    return renderExecutiveSummary(reportSummary, intelligence, cfg, orgName, workshopName);
      case 'supporting_evidence':  return renderSupportingEvidence(intelligence, cfg);
      case 'root_causes':          return renderRootCauses(intelligence, cfg);
      case 'solution_direction':   return renderSolutionDirection(reportSummary, intelligence, cfg, houseImages);
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
      case 'way_forward':                return renderWayForward(intelligence.transformationLogicMap, intelligence);
      case 'connected_model':            return renderConnectedModel(intelligence.causalIntelligence, cfg);
      default: return '';
    }
  };

  // Map: sectionId → config (for fast lookup)
  const sectionById = new Map(enabledSections.map(s => [s.id, s]));

  // For each chapter: record which content section immediately follows it in original layout
  const chapterNextContentId = new Map<string, string>();
  for (let i = 0; i < enabledSections.length; i++) {
    const cfg = enabledSections[i];
    if (cfg.type !== 'chapter') continue;
    const nextContent = enabledSections.slice(i + 1).find(s => s.type !== 'chapter');
    if (nextContent) chapterNextContentId.set(cfg.id, nextContent.id);
  }

  // Build body order: walk TOC_PHASE_GROUPS, inserting chapters before their attached section
  const bodyOrder: ReportSectionConfig[] = [];
  const insertedIds = new Set<string>();

  const phaseContentIds = TOC_PHASE_GROUPS.flatMap(p => p.sectionIds);
  for (const id of phaseContentIds) {
    const cfg = sectionById.get(id);
    if (!cfg) continue; // section not enabled
    // Insert any chapters whose next-content is this section
    for (const [chapId, nextId] of chapterNextContentId) {
      if (nextId === id && !insertedIds.has(chapId)) {
        const chapCfg = sectionById.get(chapId);
        if (chapCfg) { bodyOrder.push(chapCfg); insertedIds.add(chapId); }
      }
    }
    bodyOrder.push(cfg);
    insertedIds.add(id);
  }
  // Append any chapters that weren't placed (orphaned — no following content section)
  for (const cfg of enabledSections) {
    if (cfg.type === 'chapter' && !insertedIds.has(cfg.id)) {
      bodyOrder.push(cfg); insertedIds.add(cfg.id);
    }
  }
  // Append custom sections in original order
  for (const cfg of enabledSections) {
    if (cfg.type === 'custom' && !insertedIds.has(cfg.id)) {
      bodyOrder.push(cfg); insertedIds.add(cfg.id);
    }
  }

  const sectionsHtml = bodyOrder.map(renderOneCfg).join('\n');

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
  <div style="height:5px;background:linear-gradient(90deg,#6366f1,#818cf8 55%,#10b981);border-radius:8px 8px 0 0;"></div>
  <div class="cover-top">
    <div class="cover-top-dream">DREAM</div>
    <div class="cover-top-title">${esc(workshopName ?? '')}</div>
    <div class="cover-top-client">
      ${clientLogoBase64
        ? `<img src="${clientLogoBase64}" class="cover-client-logo" alt="${esc(orgName ?? 'Client')} logo" />`
        : `<div class="cover-client-name">${esc(orgName ?? '')}</div>`}
    </div>
  </div>
  <div class="cover-body">
    <div class="cover-eyebrow">Discovery &amp; Transformation Report</div>
    <div class="cover-title">${esc(workshopName ?? 'Workshop')}</div>
    <div class="cover-subtitle">${esc(orgName ?? '')}</div>
    <div class="cover-divider"></div>
    ${dreamLogoBase64 ? `<div class="cover-banner"><img src="${dreamLogoBase64}" alt="DREAM Discovery Platform" /></div>` : ''}
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
  <div class="toc-masthead">
    <div>
      <div class="toc-masthead-eyebrow">Discovery Report — Contents</div>
      <div class="toc-masthead-title">${esc(workshopName ?? 'Workshop')}</div>
    </div>
    <div class="toc-masthead-right">
      <div class="toc-masthead-date">${dateStr}</div>
      <div class="toc-masthead-meta">${sectionItems.length}&nbsp;sections &nbsp;·&nbsp; ${esc(orgName ?? 'DREAM Discovery')}</div>
    </div>
  </div>
  <div class="toc-columns">
    <div class="toc-col">${tocLeft.join('')}</div>
    <div class="toc-col">${tocRight.join('')}</div>
  </div>
</div>

${sectionsHtml}

</body>
</html>`;
}
