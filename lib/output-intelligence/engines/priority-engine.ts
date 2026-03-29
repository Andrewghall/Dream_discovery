/**
 * DREAM Priority Engine — Decision-first output layer
 *
 * Deterministic ranking and decision support output derived from TransformationLogicMap.
 * No LLM calls. All output is explainable and evidence-backed.
 *
 * Exports:
 *   computePriorityNodes  — top 7 nodes ranked by actionability
 *   buildWayForward       — 3-phase transformation plan
 *   buildExecSummary      — board-level narrative
 *   formatLabel           — shared label formatter
 *   seniorityWeight       — seniority weighting helper
 */

import type { TransformationLogicMap, TLMNode } from '@/lib/output-intelligence/types';

// ── Shared helpers ────────────────────────────────────────────────────────────

export function formatLabel(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function seniorityWeight(role: string | null | undefined): number {
  if (!role) return 1.0;
  const r = role.toLowerCase();
  if (r.includes('chief') || r.includes('exec') || r.includes('director') ||
      r.includes('ceo') || r.includes('coo') || r.includes('cto')) return 2.0;
  if (r.includes('head of') || r.includes('senior manager') ||
      r.includes('vp') || r.includes('vice president')) return 1.5;
  if (r.includes('manager') || r.includes('lead') || r.includes('supervisor')) return 1.2;
  return 1.0;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriorityNode {
  nodeId: string;
  displayLabel: string;
  layer: TLMNode['layer'];
  rank: number;
  priorityScore: number;
  mentionCount: number;
  senioritySum: number;
  distinctRoles: string[];
  drives: string[];      // directly driven enabler labels
  unlocks: string[];     // reachable reimagination labels (1–2 hops)
  riskLevel: 'critical' | 'high' | 'medium';
  whyMatters: string;
  riskIfIgnored: string;
  suggestedAction: string;
  quotes: TLMNode['quotes'];
  isOrphan: boolean;
  isCoalescent: boolean;
  isCompensating: boolean;
  inValidChain: boolean;
}

export interface WayForwardItem {
  nodeId: string;
  label: string;
  description: string;
  isManual: boolean;
}

export interface WayForwardPhase {
  phase: 1 | 2 | 3;
  name: string;
  timeline: string;
  color: string;
  borderColor: string;
  textColor: string;
  bgColor: string;
  items: WayForwardItem[];
  dependencies: string;
  expectedOutcome: string;
}

export interface ExecSummaryData {
  headline: string;
  pressure: string;
  gap: string;
  action: string;
}

// ── Priority ranking ──────────────────────────────────────────────────────────

/**
 * Rank all TLM nodes by actionability and return top 7.
 *
 * Score formula (raw, unnormalised — used for ranking only):
 *   mentions × 40  +  senioritySum × 20  +  distinctRoles × 15
 *   +  connectionDegree × 10  +  coalescent bonus 25
 *   +  ignored constraint bonus 20
 */
export function computePriorityNodes(data: TransformationLogicMap): PriorityNode[] {
  if (!data.nodes.length) return [];
  const byId = new Map(data.nodes.map(n => [n.nodeId, n]));

  return data.nodes
    .map(node => {
      const mentions     = node.rawFrequency;
      const senioritySum = node.quotes.reduce((s, q) => s + seniorityWeight(q.participantRole), 0);
      const distinctRoles = [...new Set(
        node.quotes.map(q => q.participantRole).filter((r): r is string => Boolean(r)),
      )];

      // Outgoing edges → driven enablers (1-hop)
      const outEdges = data.edges.filter(e => e.fromNodeId === node.nodeId);
      const drives = outEdges
        .map(e => byId.get(e.toNodeId))
        .filter((t): t is TLMNode => Boolean(t) && t!.layer === 'ENABLER')
        .map(t => formatLabel(t.displayLabel))
        .slice(0, 5);

      // Unlocks: constraint→enabler→vision (2-hop) + direct enabler→vision (1-hop)
      const enablerIds = new Set(
        outEdges.map(e => e.toNodeId).filter(id => byId.get(id)?.layer === 'ENABLER'),
      );
      const unlocks = [...new Set([
        // 2-hop for constraints
        ...data.edges
          .filter(e => enablerIds.has(e.fromNodeId) && byId.get(e.toNodeId)?.layer === 'REIMAGINATION')
          .map(e => formatLabel(byId.get(e.toNodeId)!.displayLabel)),
        // 1-hop for enablers
        ...outEdges
          .map(e => byId.get(e.toNodeId))
          .filter((t): t is TLMNode => Boolean(t) && t!.layer === 'REIMAGINATION')
          .map(t => formatLabel(t.displayLabel)),
      ])].slice(0, 4);

      const priorityScore =
        (mentions * 40) +
        (senioritySum * 20) +
        (distinctRoles.length * 15) +
        (node.connectionDegree * 10) +
        (node.isCoalescent ? 25 : 0) +
        (node.isOrphan && node.layer === 'CONSTRAINT' ? 20 : 0);

      const riskLevel: PriorityNode['riskLevel'] =
        (node.isCoalescent || (node.isOrphan && node.layer === 'CONSTRAINT')) ? 'critical'
        : node.connectionDegree >= 3 ? 'high'
        : 'medium';

      // ── Decision text (board-level, no AI language) ──────────────────────
      const label      = formatLabel(node.displayLabel);
      const rolesText  = distinctRoles.slice(0, 3).join(', ');
      let whyMatters   = '';
      let riskIfIgnored = '';
      let suggestedAction = '';

      if (node.layer === 'CONSTRAINT') {
        if (node.isCoalescent) {
          whyMatters      = `${label} is the highest-pressure convergence point in the system — ${node.connectionDegree} nodes connect through it. Unresolved, it acts as a multiplier across every downstream initiative.`;
          riskIfIgnored   = `Every enabler and transformation initiative that depends on resolving this constraint will be delayed or degraded. The compounding effect grows with each phase of the programme.`;
          suggestedAction = `Assign a cross-functional owner this week. Commission a 30-day diagnostic to map sub-causes and establish a resolution roadmap with milestone gates before Phase 2 begins.`;
        } else if (node.isOrphan) {
          whyMatters      = `${label} is a known, high-frequency problem (${mentions} mentions${distinctRoles.length > 1 ? `, ${distinctRoles.length} roles` : ''}) with no planned response. It is currently invisible in the transformation programme.`;
          riskIfIgnored   = `Without intervention this issue continues to absorb capacity while embedding itself as permanent background noise — actively undermining the transformation programme.`;
          suggestedAction = `Assign an accountable owner immediately. Produce a written response plan within 30 days — even if full resolution is long-term. The transformation narrative must acknowledge this issue.`;
        } else {
          whyMatters      = `${label} is consistently raised across ${mentions} moments${rolesText ? ` by ${rolesText}` : ''}, indicating a broadly felt pressure that is not resolving on its own.`;
          riskIfIgnored   = `A partially addressed constraint can be more damaging than an unaddressed one — it creates the impression of progress while the core problem remains live.`;
          suggestedAction = `Review the existing response pathway. Confirm it is sufficient in scope and pace. If this constraint is still generating signals, the current solution is undersized.`;
        }
      } else if (node.layer === 'ENABLER') {
        if (node.isOrphan) {
          whyMatters      = `${label} represents active investment or capability that is currently disconnected from any strategic outcome. Resource is being committed without a clear line to transformation value.`;
          riskIfIgnored   = `Effort and budget continue to flow into an activity with no measurable return. In a constrained environment, this displaces investment from higher-leverage priorities.`;
          suggestedAction = `Either connect this capability to a specific transformation outcome with accountable metrics within 60 days, or pause the investment until the strategic case is established.`;
        } else if (node.isCompensating) {
          whyMatters      = `${label} is functioning as a workaround rather than a fix. It manages visible symptoms but the root constraint remains live and will continue generating the same pressure.`;
          riskIfIgnored   = `The workaround becomes permanent infrastructure. The underlying constraint embeds more deeply and becomes progressively harder and more expensive to address.`;
          suggestedAction = `Document this as a temporary measure with an explicit sunset date. Escalate the root constraint to Phase 1 of the transformation plan with direct ownership.`;
        } else {
          const unlocksText = unlocks.length > 0 ? `, unlocking ${unlocks.slice(0, 2).join(' and ')}` : '';
          whyMatters      = `${label} is a critical enabling capability that, when fully activated, drives transformation outcomes${unlocksText}. Its delivery pace directly determines transformation speed.`;
          riskIfIgnored   = `Delayed activation creates a bottleneck that holds back every dependent vision. Transformation timelines slip in direct proportion to this enabler being underresourced.`;
          suggestedAction = `Confirm this is fully resourced, staffed, and has a named owner. Establish a measurable delivery milestone in the next 90 days.`;
        }
      } else { // REIMAGINATION
        if (node.isOrphan) {
          whyMatters      = `${label} is an articulated strategic aspiration with no current execution path. The vision has been stated but the enabling conditions have not been established.`;
          riskIfIgnored   = `The gap between stated aspiration and operational reality widens. Credibility with the workforce erodes when transformation is announced but the building blocks are absent.`;
          suggestedAction = `Either fund and assign the missing enablers within 60 days, or formally descope this aspiration from the current programme. Ambiguity is more damaging than a clear decision.`;
        } else {
          whyMatters      = `${label} is a stated transformation outcome actively supported by enabling capabilities. It is achievable — but only if the dependencies remain funded and on track.`;
          riskIfIgnored   = `A supported vision can still fail if its enabler dependencies stall. Lack of executive sponsorship and review cadence is the most common cause of failure at this stage.`;
          suggestedAction = `Assign a specific executive sponsor. Establish a quarterly review cadence against the enabling conditions. Confirm this outcome is reflected in budget cycles and business planning.`;
        }
      }

      return {
        nodeId: node.nodeId,
        displayLabel: node.displayLabel,
        layer: node.layer,
        rank: 0,
        priorityScore,
        mentionCount: mentions,
        senioritySum,
        distinctRoles,
        drives,
        unlocks,
        riskLevel,
        whyMatters,
        riskIfIgnored,
        suggestedAction,
        quotes: node.quotes,
        isOrphan: node.isOrphan,
        isCoalescent: node.isCoalescent,
        isCompensating: node.isCompensating,
        inValidChain: node.inValidChain,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 7)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

// ── Way Forward ───────────────────────────────────────────────────────────────

export function buildWayForward(
  data: TransformationLogicMap,
  manualNodeIds: Set<string>,
): WayForwardPhase[] {
  const byId = new Map(data.nodes.map(n => [n.nodeId, n]));

  // Phase 1 — Stabilise
  const p1Auto = [
    ...data.nodes.filter(n => n.isOrphan && n.layer === 'CONSTRAINT')
      .sort((a, b) => b.rawFrequency - a.rawFrequency).slice(0, 5),
    ...data.nodes.filter(n => n.isCoalescent).slice(0, 2),
  ];
  const p1Ids = new Set([
    ...p1Auto.map(n => n.nodeId),
    ...[...manualNodeIds].filter(id => byId.get(id)?.layer === 'CONSTRAINT'),
  ]);

  // Phase 2 — Enable
  const p2Auto = [
    ...data.nodes.filter(n => n.inValidChain && n.layer === 'ENABLER')
      .sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5),
    ...data.nodes.filter(n => n.isCompensating && n.layer === 'ENABLER').slice(0, 2),
  ];
  const p2Ids = new Set([
    ...p2Auto.map(n => n.nodeId).filter(id => !p1Ids.has(id)),
    ...[...manualNodeIds].filter(id => byId.get(id)?.layer === 'ENABLER' && !p1Ids.has(id)),
  ]);

  // Phase 3 — Transform
  const p3Auto = data.nodes
    .filter(n => n.layer === 'REIMAGINATION')
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, 6);
  const p3Ids = new Set([
    ...p3Auto.map(n => n.nodeId).filter(id => !p1Ids.has(id) && !p2Ids.has(id)),
    ...[...manualNodeIds].filter(id => byId.get(id)?.layer === 'REIMAGINATION'),
  ]);

  function toItems(ids: Set<string>): WayForwardItem[] {
    return [...ids].map(id => {
      const n = byId.get(id);
      if (!n) return null;
      let description = '';
      if (n.layer === 'CONSTRAINT') {
        description = n.isCoalescent
          ? `Systemic pressure point — ${n.connectionDegree} dependencies. Assign cross-functional owner, commission 30-day diagnostic.`
          : n.isOrphan
          ? `${n.rawFrequency} mentions, no planned response. Assign owner and produce written response plan within 30 days.`
          : `Active constraint requiring direct intervention and ownership.`;
      } else if (n.layer === 'ENABLER') {
        description = n.isCompensating
          ? `Workaround masking a root constraint. Transition to direct solution once Phase 1 constraints are addressed.`
          : `Key enabling capability. Confirm resourcing, staffing, and 90-day delivery milestone.`;
      } else {
        description = n.isOrphan
          ? `Vision without execution path — fund and assign enablers, or formally descope.`
          : `Strategic outcome with validated enabling conditions. Assign executive sponsor and quarterly review.`;
      }
      return {
        nodeId: id,
        label: formatLabel(n.displayLabel),
        description,
        isManual: manualNodeIds.has(id),
      };
    }).filter((x): x is WayForwardItem => Boolean(x));
  }

  const orphanCount = data.orphanSummary.constraintOrphans;

  return [
    {
      phase: 1, name: 'Stabilise', timeline: '0–90 days',
      color: '#ef4444', borderColor: '#fca5a5', textColor: '#991b1b', bgColor: '#fef2f2',
      items: toItems(p1Ids),
      dependencies: 'No prerequisites — these are the starting conditions.',
      expectedOutcome: orphanCount > 0
        ? `Reduce unaddressed constraints from ${orphanCount} to zero. Every constraint has an assigned owner and a written response plan.`
        : `All active constraints have clear ownership and documented response plans with measurable milestones.`,
    },
    {
      phase: 2, name: 'Enable', timeline: '90–180 days',
      color: '#3b82f6', borderColor: '#bfdbfe', textColor: '#1e40af', bgColor: '#eff6ff',
      items: toItems(p2Ids),
      dependencies: 'Phase 1 constraints must have assigned owners and active response plans before enabling capabilities can operate at full effectiveness.',
      expectedOutcome: `Enabling capabilities active and staffed. Constraints move from Partial to Addressed status. Delivery milestones confirmed and being tracked.`,
    },
    {
      phase: 3, name: 'Transform', timeline: '180+ days',
      color: '#10b981', borderColor: '#a7f3d0', textColor: '#065f46', bgColor: '#f0fdf4',
      items: toItems(p3Ids),
      dependencies: 'Phase 2 enablers must be active. Executive sponsorship and accountability structures must be in place.',
      expectedOutcome: `Strategic outcomes in active delivery. ${Math.min(data.coverageScore + 25, 85)}%+ constraint coverage achieved as a measure of systemic health.`,
    },
  ];
}

// ── Executive summary ─────────────────────────────────────────────────────────

export function buildExecSummary(data: TransformationLogicMap): ExecSummaryData {
  const constraints       = data.nodes.filter(n => n.layer === 'CONSTRAINT');
  const enablers          = data.nodes.filter(n => n.layer === 'ENABLER');
  const orphanConstraints = constraints.filter(n => n.isOrphan);
  const orphanEnablers    = enablers.filter(n => n.isOrphan);
  const coalPoints        = data.coalescencePoints;
  const coverage          = data.coverageScore;

  const headline =
    coverage < 30
      ? `The organisation has identified its problems but has not yet connected them to a transformation pathway.`
      : coverage < 60
      ? `The transformation programme has partial coverage — key constraints remain without a credible response.`
      : `The transformation programme is directionally sound but execution risk is concentrated in specific areas.`;

  const topCoal   = coalPoints[0];
  const pressure  = topCoal
    ? `Pressure is concentrated in "${formatLabel(topCoal.label)}", which connects ${topCoal.outDegree} dependent nodes — this is the highest-leverage intervention point in the system.`
    : `The analysis identified ${constraints.length} constraints across ${data.nodes.length} total signals, with pressure distributed across multiple areas.`;

  const gap = orphanConstraints.length > 0
    ? `${orphanConstraints.length} known problem${orphanConstraints.length !== 1 ? 's are' : ' is'} currently without a planned response.${orphanEnablers.length > 0 ? ` Additionally, ${orphanEnablers.length} enabling activit${orphanEnablers.length !== 1 ? 'ies have' : 'y has'} no connection to a strategic outcome.` : ''}`
    : data.orphanSummary.visionOrphans > 0
    ? `The constraints are addressed but ${data.orphanSummary.visionOrphans} transformation outcome${data.orphanSummary.visionOrphans !== 1 ? 's lack' : ' lacks'} the enabling capabilities to be executable.`
    : `Coverage is strong. Focus should be on execution quality and pace rather than discovering new issues.`;

  const topActionNode = [
    ...data.nodes.filter(n => n.isCoalescent),
    ...data.nodes.filter(n => n.isOrphan && n.layer === 'CONSTRAINT'),
  ].sort((a, b) => b.rawFrequency - a.rawFrequency)[0];

  const action = topActionNode
    ? `The immediate priority is "${formatLabel(topActionNode.displayLabel)}" — assign ownership, establish a 30-day response plan, and ensure this issue is reflected in the transformation programme.`
    : data.strongestChains.length > 0
    ? `The strongest validated pathway runs from "${data.strongestChains[0].constraintLabel}" through "${data.strongestChains[0].enablerLabel}" to "${data.strongestChains[0].reimaginationLabel}" — accelerate this chain first.`
    : `Establish clear ownership for each constraint and create explicit links between known problems and the enabling capabilities in the transformation plan.`;

  return { headline, pressure, gap, action };
}
