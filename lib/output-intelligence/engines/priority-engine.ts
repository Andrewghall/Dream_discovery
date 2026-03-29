/**
 * DREAM Priority Engine — Decision-first output layer
 *
 * Deterministic ranking and decision support output derived from TransformationLogicMap.
 * No LLM calls. All output is explainable and evidence-backed.
 *
 * Weighted Significance Model (replaces raw frequency ranking):
 *   Actor seniority        35%  — who raised it drives importance most
 *   Cross-actor spread     25%  — breadth across the organisation
 *   Connection density     20%  — structural embeddedness in the map
 *   Structural position    15%  — root cause vs symptom vs compensating
 *   Mention frequency       5%  — lowest weight; volume alone ≠ importance
 *
 * Exports:
 *   weightedSignificance  — score + classify a single node against the full set
 *   computePriorityNodes  — top 7 nodes ranked by weighted significance
 *   buildWayForward       — 3-phase transformation plan
 *   buildExecSummary      — board-level narrative
 *   formatLabel           — shared label formatter
 *   seniorityWeight       — seniority weighting helper
 */

import type { TransformationLogicMap, TLMNode } from '@/lib/output-intelligence/types';

// ── Normalization — fill all defaults so downstream code never sees undefined ─

/**
 * Normalise a single TLMNode from stored data.
 * Older snapshots may be missing fields added after initial creation.
 * After this function every field is safe to access without nullish guards.
 */
export function normalizeNode(raw: Partial<TLMNode>): TLMNode {
  return {
    nodeId:           raw.nodeId          ?? '',
    displayLabel:     raw.displayLabel    ?? '',
    layer:            raw.layer           ?? 'CONSTRAINT',
    isCoalescent:     raw.isCoalescent    ?? false,
    isOrphan:         raw.isOrphan        ?? false,
    orphanType:       raw.orphanType,
    inValidChain:     raw.inValidChain    ?? false,
    isCompensating:   raw.isCompensating  ?? false,
    compositeScore:   raw.compositeScore  ?? 0,
    rawFrequency:     raw.rawFrequency    ?? 0,
    connectionDegree: raw.connectionDegree ?? 0,
    quotes:           Array.isArray(raw.quotes) ? raw.quotes : [],
  };
}

/**
 * Normalise a full TransformationLogicMap from stored data.
 * Returns a structurally complete object — every array and sub-object is
 * guaranteed to exist so no consumer needs its own nullish guards.
 */
export function normalizeTLM(raw: Partial<TransformationLogicMap> | null | undefined): TransformationLogicMap {
  const nodes = Array.isArray(raw?.nodes) ? raw!.nodes.filter(Boolean).map(n => normalizeNode(n as Partial<TLMNode>)) : [];
  const edges = Array.isArray(raw?.edges) ? raw!.edges.filter(Boolean) : [];
  return {
    nodes,
    edges,
    coalescencePoints: Array.isArray(raw?.coalescencePoints) ? raw!.coalescencePoints : [],
    orphanSummary: raw?.orphanSummary ?? {
      constraintOrphans: 0, enablerOrphans: 0, visionOrphans: 0, topOrphanLabels: [],
    },
    strongestChains:       Array.isArray(raw?.strongestChains) ? raw!.strongestChains : [],
    coverageScore:         raw?.coverageScore         ?? 0,
    interpretationSummary: raw?.interpretationSummary ?? '',
  };
}

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

const GENERIC_LABELS = new Set([
  'customer', 'system', 'process', 'team', 'people', 'issue', 'problem',
  'thing', 'area', 'work', 'staff', 'data', 'service', 'time', 'way',
  'information', 'support', 'change', 'business', 'day',
]);

function isGenericLabel(label: string): boolean {
  const l = label.toLowerCase().trim();
  return GENERIC_LABELS.has(l) || l.length <= 3;
}

// ── Weighted Significance Model ───────────────────────────────────────────────

export type SignificanceLevel  = 'critical' | 'high' | 'medium';
export type ConfidenceLevel    = 'high' | 'medium' | 'low';
export type NodeClassification = 'systemic' | 'structural' | 'local' | 'symptomatic';

export interface NodeSignificance {
  score:                number;   // 0–100 composite weighted score
  significance:         SignificanceLevel;
  confidence:           ConfidenceLevel;
  classification:       NodeClassification;
  classificationReason: string;
}

/**
 * Score and classify a single node using the Weighted Significance Model.
 * All normalisations are relative to the full population (allNodes).
 */
export function weightedSignificance(
  node: TLMNode,
  allNodes: TLMNode[],
): NodeSignificance {
  // Defensive: older stored nodes may be missing fields added after initial creation
  const safeNodes = allNodes.filter(Boolean);
  const maxFreq   = Math.max(...safeNodes.map(n => n.rawFrequency  ?? 0), 1);
  const maxDegree = Math.max(...safeNodes.map(n => n.connectionDegree ?? 0), 1);
  const maxDistinctRoles = Math.max(
    ...safeNodes.map(n => new Set((n.quotes ?? []).map(q => q.participantRole).filter(Boolean)).size),
    1,
  );

  const quotes = node.quotes ?? [];

  // 1. Actor seniority — average weight per quote, normalised to max possible (2.0)
  const senioritySum  = quotes.reduce((s, q) => s + seniorityWeight(q.participantRole), 0);
  const seniorityNorm = quotes.length > 0 ? Math.min(senioritySum / (quotes.length * 2.0), 1) : 0;

  // 2. Cross-actor distribution — distinct roles as fraction of max seen in this dataset
  const distinctRoles = [...new Set(
    quotes.map(q => q.participantRole).filter((r): r is string => Boolean(r)),
  )];
  const actorSpreadNorm = distinctRoles.length / maxDistinctRoles;

  // 3. Connection density — node degree relative to most-connected node
  const densityNorm = (node.connectionDegree ?? 0) / maxDegree;

  // 4. Structural position — coalescent > orphan constraint > in valid chain > compensating > default
  const structuralScore =
    (node.isCoalescent ?? false)                                    ? 1.00
    : (node.isOrphan ?? false) && node.layer === 'CONSTRAINT'       ? 0.80
    : (node.inValidChain ?? false)                                  ? 0.60
    : (node.isCompensating ?? false)                               ? 0.55
    : (node.isOrphan ?? false)                                     ? 0.25
    : 0.35;

  // 5. Mention frequency (lowest weight — volume alone ≠ importance)
  const freqNorm = (node.rawFrequency ?? 0) / maxFreq;

  // Weighted composite
  const raw =
    seniorityNorm  * 0.35 +
    actorSpreadNorm * 0.25 +
    densityNorm    * 0.20 +
    structuralScore * 0.15 +
    freqNorm       * 0.05;

  // Generic label penalty (placeholder terms carry no insight)
  const baseScore = Math.round(raw * 100);
  const score     = isGenericLabel(node.displayLabel) ? Math.round(baseScore * 0.60) : baseScore;

  // Significance tier
  const significance: SignificanceLevel =
    score >= 62 ? 'critical' :
    score >= 35 ? 'high'     :
                  'medium';

  // Confidence — derived from evidence quality: seniority quality + actor spread
  const evidenceStrength = seniorityNorm * 0.60 + actorSpreadNorm * 0.40;
  const confidence: ConfidenceLevel =
    evidenceStrength > 0.50 ? 'high'   :
    evidenceStrength > 0.22 ? 'medium' :
                              'low';

  // Classification
  let classification: NodeClassification;
  let classificationReason: string;

  if (densityNorm > 0.45 && actorSpreadNorm > 0.30) {
    classification = 'systemic';
    classificationReason =
      `Raised across ${distinctRoles.length} distinct role${distinctRoles.length !== 1 ? 's' : ''} and connected to ${node.connectionDegree ?? 0} other factors — a system-wide pattern, not an isolated issue.`;
  } else if (seniorityNorm > 0.50 && structuralScore >= 0.55) {
    classification = 'structural';
    classificationReason =
      `Driven by senior voices and sits at a structural junction in the transformation map — embedded in how the organisation operates, not a surface complaint.`;
  } else if (freqNorm > 0.55 && seniorityNorm < 0.35 && densityNorm < 0.30) {
    classification = 'symptomatic';
    classificationReason =
      `Frequently raised but concentrated in one actor group with few structural connections — likely a visible symptom of a deeper root cause elsewhere.`;
  } else {
    classification = 'local';
    classificationReason =
      `Specific to a defined area or function. Meaningful within scope but not a primary driver of organisation-wide transformation risk.`;
  }

  return { score, significance, confidence, classification, classificationReason };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriorityNode {
  nodeId:               string;
  displayLabel:         string;
  layer:                TLMNode['layer'];
  rank:                 number;
  priorityScore:        number;        // weighted significance score 0–100
  significance:         SignificanceLevel;
  confidence:           ConfidenceLevel;
  classification:       NodeClassification;
  classificationReason: string;
  distinctRoles:        string[];
  drives:               string[];      // directly driven enabler labels
  unlocks:              string[];      // reachable reimagination labels (1–2 hops)
  whyMatters:           string;
  riskIfIgnored:        string;
  suggestedAction:      string;
  quotes:               TLMNode['quotes'];
  isOrphan:             boolean;
  isCoalescent:         boolean;
  isCompensating:       boolean;
  inValidChain:         boolean;
}

export interface WayForwardItem {
  nodeId:      string;
  label:       string;
  description: string;
  isManual:    boolean;
}

export interface WayForwardPhase {
  phase:           1 | 2 | 3;
  name:            string;
  timeline:        string;
  color:           string;
  borderColor:     string;
  textColor:       string;
  bgColor:         string;
  items:           WayForwardItem[];
  dependencies:    string;
  expectedOutcome: string;
}

export interface ExecSummaryData {
  headline: string;
  pressure: string;
  gap:      string;
  action:   string;
}

// ── Priority ranking ──────────────────────────────────────────────────────────

/**
 * Rank all TLM nodes by weighted significance and return top 7.
 * Sorted by composite score (seniority 35%, spread 25%, density 20%,
 * structural position 15%, frequency 5%) — not by raw mention count.
 */
export function computePriorityNodes(data: TransformationLogicMap): PriorityNode[] {
  const safe  = normalizeTLM(data);
  const nodes = safe.nodes;
  const edges = safe.edges;
  if (!nodes.length) return [];
  const byId = new Map(nodes.map(n => [n.nodeId, n]));

  // Pre-compute all significance scores for ranking
  const sigMap = new Map(nodes.map(n => [n.nodeId, weightedSignificance(n, nodes)]));

  return nodes
    .map(node => {
      const sig = sigMap.get(node.nodeId)!;

      const nodeQuotes = node.quotes ?? [];
      const distinctRoles = [...new Set(
        nodeQuotes.map(q => q.participantRole).filter((r): r is string => Boolean(r)),
      )];

      // Outgoing edges → driven enablers (1-hop)
      const outEdges = edges.filter(e => e.fromNodeId === node.nodeId);
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
        ...edges
          .filter(e => enablerIds.has(e.fromNodeId) && byId.get(e.toNodeId)?.layer === 'REIMAGINATION')
          .map(e => formatLabel(byId.get(e.toNodeId)!.displayLabel)),
        ...outEdges
          .map(e => byId.get(e.toNodeId))
          .filter((t): t is TLMNode => Boolean(t) && t!.layer === 'REIMAGINATION')
          .map(t => formatLabel(t.displayLabel)),
      ])].slice(0, 4);

      // ── Decision text (business-impact focused, no raw counts) ──────────────
      const label      = formatLabel(node.displayLabel);
      const rolesText  = distinctRoles.slice(0, 3).join(', ');
      const spreadDesc = distinctRoles.length >= 3 ? 'multiple levels of the organisation'
                       : distinctRoles.length === 2 ? `${distinctRoles[0]} and ${distinctRoles[1]}`
                       : rolesText || 'the workshop participants';
      let whyMatters   = '';
      let riskIfIgnored = '';
      let suggestedAction = '';

      if (node.layer === 'CONSTRAINT') {
        if (node.isCoalescent ?? false) {
          whyMatters      = `${label} is the highest-pressure convergence point in the system — ${node.connectionDegree ?? 0} factors connect through it. Unresolved, it acts as a multiplier across every downstream initiative, degrading the value of every response built on top.`;
          riskIfIgnored   = `Every enabler and transformation initiative dependent on resolving this constraint will be delayed or degraded. The compounding effect grows with each phase of the programme.`;
          suggestedAction = `Assign a cross-functional owner this week. Commission a 30-day diagnostic to map sub-causes and establish a resolution roadmap with milestone gates before Phase 2 begins.`;
        } else if (node.isOrphan ?? false) {
          whyMatters      = `${label} is a confirmed problem raised by ${spreadDesc} — and the transformation programme has no planned response to it. It is being managed around, not resolved.`;
          riskIfIgnored   = `Without intervention this issue continues to absorb capacity while embedding itself as permanent background noise — actively undermining the transformation programme.`;
          suggestedAction = `Assign an accountable owner immediately. Produce a written response plan within 30 days — even if full resolution is long-term. The transformation narrative must acknowledge this issue.`;
        } else {
          whyMatters      = `${label} is consistently raised by ${spreadDesc}, indicating a broadly felt organisational pressure that is not resolving on its own and requires a deliberate response.`;
          riskIfIgnored   = `A partially addressed constraint can be more damaging than an unaddressed one — it creates the impression of progress while the core pressure remains live.`;
          suggestedAction = `Review the existing response pathway. Confirm it is sufficient in scope and pace. If this constraint is still generating signals, the current solution is undersized.`;
        }
      } else if (node.layer === 'ENABLER') {
        if (node.isOrphan ?? false) {
          whyMatters      = `${label} represents active investment or capability that is currently disconnected from any strategic outcome. Resource is being committed without a clear line to transformation value.`;
          riskIfIgnored   = `Effort and budget continue to flow into an activity with no measurable return. In a constrained environment, this displaces investment from higher-leverage priorities.`;
          suggestedAction = `Either connect this capability to a specific transformation outcome with accountable metrics within 60 days, or pause the investment until the strategic case is established.`;
        } else if (node.isCompensating ?? false) {
          whyMatters      = `${label} is functioning as a workaround rather than a fix. It manages visible symptoms but the root constraint remains live and will continue generating the same organisational pressure.`;
          riskIfIgnored   = `The workaround becomes permanent infrastructure. The underlying constraint embeds more deeply and becomes progressively harder and more expensive to address.`;
          suggestedAction = `Document this as a temporary measure with an explicit sunset date. Escalate the root constraint to Phase 1 of the transformation plan with direct ownership.`;
        } else {
          const unlocksText = unlocks.length > 0 ? `, unlocking ${unlocks.slice(0, 2).join(' and ')}` : '';
          whyMatters      = `${label} is a critical enabling capability that, when fully activated, drives transformation outcomes${unlocksText}. Its delivery pace directly determines transformation speed.`;
          riskIfIgnored   = `Delayed activation creates a bottleneck that holds back every dependent vision. Transformation timelines slip in direct proportion to this enabler being underresourced.`;
          suggestedAction = `Confirm this is fully resourced, staffed, and has a named owner. Establish a measurable delivery milestone in the next 90 days.`;
        }
      } else { // REIMAGINATION
        if (node.isOrphan ?? false) {
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
        nodeId:               node.nodeId,
        displayLabel:         node.displayLabel,
        layer:                node.layer,
        rank:                 0,
        priorityScore:        sig.score,
        significance:         sig.significance,
        confidence:           sig.confidence,
        classification:       sig.classification,
        classificationReason: sig.classificationReason,
        distinctRoles,
        drives,
        unlocks,
        whyMatters,
        riskIfIgnored,
        suggestedAction,
        quotes:         nodeQuotes,
        isOrphan:       node.isOrphan       ?? false,
        isCoalescent:   node.isCoalescent   ?? false,
        isCompensating: node.isCompensating ?? false,
        inValidChain:   node.inValidChain   ?? false,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 7)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

// ── Way Forward ───────────────────────────────────────────────────────────────

export function buildWayForward(
  data: TransformationLogicMap,
  manualNodeIds: Set<string> = new Set(),
): WayForwardPhase[] {
  const safe    = normalizeTLM(data);
  const wfNodes = safe.nodes;
  const byId    = new Map(wfNodes.map(n => [n.nodeId, n]));
  const sigMap  = new Map(wfNodes.map(n => [n.nodeId, weightedSignificance(n, wfNodes)]));

  // Phase 1 — Stabilise: highest-significance orphan constraints + coalescent nodes
  const p1Auto = [
    ...wfNodes
      .filter(n => (n.isOrphan ?? false) && n.layer === 'CONSTRAINT')
      .sort((a, b) => (sigMap.get(b.nodeId)?.score ?? 0) - (sigMap.get(a.nodeId)?.score ?? 0))
      .slice(0, 5),
    ...wfNodes.filter(n => n.isCoalescent ?? false).slice(0, 2),
  ];
  const p1Ids = new Set([
    ...p1Auto.map(n => n.nodeId),
    ...[...manualNodeIds].filter(id => byId.get(id)?.layer === 'CONSTRAINT'),
  ]);

  // Phase 2 — Enable: highest-significance chain enablers + compensating behaviours
  const p2Auto = [
    ...wfNodes
      .filter(n => (n.inValidChain ?? false) && n.layer === 'ENABLER')
      .sort((a, b) => (sigMap.get(b.nodeId)?.score ?? 0) - (sigMap.get(a.nodeId)?.score ?? 0))
      .slice(0, 5),
    ...wfNodes.filter(n => (n.isCompensating ?? false) && n.layer === 'ENABLER').slice(0, 2),
  ];
  const p2Ids = new Set([
    ...p2Auto.map(n => n.nodeId).filter(id => !p1Ids.has(id)),
    ...[...manualNodeIds].filter(id => byId.get(id)?.layer === 'ENABLER' && !p1Ids.has(id)),
  ]);

  // Phase 3 — Transform: reimagination nodes by significance
  const p3Auto = wfNodes
    .filter(n => n.layer === 'REIMAGINATION')
    .sort((a, b) => (sigMap.get(b.nodeId)?.score ?? 0) - (sigMap.get(a.nodeId)?.score ?? 0))
    .slice(0, 6);
  const p3Ids = new Set([
    ...p3Auto.map(n => n.nodeId).filter(id => !p1Ids.has(id) && !p2Ids.has(id)),
    ...[...manualNodeIds].filter(id => byId.get(id)?.layer === 'REIMAGINATION'),
  ]);

  function toItems(ids: Set<string>): WayForwardItem[] {
    return [...ids].map(id => {
      const n   = byId.get(id);
      const sig = sigMap.get(id);
      if (!n) return null;
      const sigLabel = sig?.significance === 'critical' ? 'Critical significance'
                     : sig?.significance === 'high'     ? 'High significance'
                     :                                    'Medium significance';
      let description = '';
      if (n.layer === 'CONSTRAINT') {
        description = (n.isCoalescent ?? false)
          ? `Systemic pressure point — ${n.connectionDegree ?? 0} dependencies converge here. Assign cross-functional owner; commission 30-day diagnostic.`
          : (n.isOrphan ?? false)
          ? `${sigLabel} unaddressed constraint. Assign an owner and produce a written response plan within 30 days.`
          : `Active constraint requiring direct intervention and a named owner.`;
      } else if (n.layer === 'ENABLER') {
        description = (n.isCompensating ?? false)
          ? `Workaround masking a root constraint. Transition to direct solution once Phase 1 constraints are addressed.`
          : `Key enabling capability — ${sigLabel}. Confirm resourcing, staffing, and 90-day delivery milestone.`;
      } else {
        description = (n.isOrphan ?? false)
          ? `Strategic aspiration without an execution path — fund and assign enablers, or formally descope.`
          : `Strategic outcome with validated enabling conditions. Assign executive sponsor and quarterly review.`;
      }
      return {
        nodeId:   id,
        label:    formatLabel(n.displayLabel),
        description,
        isManual: manualNodeIds.has(id),
      };
    }).filter((x): x is WayForwardItem => Boolean(x));
  }

  const orphanCount = safe.orphanSummary.constraintOrphans;

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
      expectedOutcome: `Enabling capabilities active and staffed. Constraints move from partial to addressed status. Delivery milestones confirmed and being tracked.`,
    },
    {
      phase: 3, name: 'Transform', timeline: '180+ days',
      color: '#10b981', borderColor: '#a7f3d0', textColor: '#065f46', bgColor: '#f0fdf4',
      items: toItems(p3Ids),
      dependencies: 'Phase 2 enablers must be active. Executive sponsorship and accountability structures must be in place.',
      expectedOutcome: `Strategic outcomes in active delivery. ${Math.min(safe.coverageScore + 25, 85)}%+ constraint coverage achieved as a measure of systemic health.`,
    },
  ];
}

// ── Executive summary ─────────────────────────────────────────────────────────

export function buildExecSummary(data: TransformationLogicMap): ExecSummaryData {
  const safe              = normalizeTLM(data);
  const esNodes           = safe.nodes;
  const constraints       = esNodes.filter(n => n.layer === 'CONSTRAINT');
  const enablers          = esNodes.filter(n => n.layer === 'ENABLER');
  const orphanConstraints = constraints.filter(n => n.isOrphan);
  const orphanEnablers    = enablers.filter(n => n.isOrphan);
  const coalPoints        = safe.coalescencePoints;
  const coverage          = safe.coverageScore;

  const headline =
    coverage < 30
      ? `The organisation has identified its problems but has not yet connected them to a transformation pathway.`
      : coverage < 60
      ? `The transformation programme has partial coverage — key constraints remain without a credible response.`
      : `The transformation programme is directionally sound but execution risk is concentrated in specific areas.`;

  const topCoal  = coalPoints[0];
  const pressure = topCoal
    ? `Pressure is concentrated in "${formatLabel(topCoal.label)}", which connects ${topCoal.outDegree} dependent nodes — this is the highest-leverage intervention point in the system.`
    : `The analysis identified ${constraints.length} constraints across ${esNodes.length} total signals, with pressure distributed across multiple areas.`;

  const visionOrphans = safe.orphanSummary.visionOrphans;
  const gap = orphanConstraints.length > 0
    ? `${orphanConstraints.length} known problem${orphanConstraints.length !== 1 ? 's are' : ' is'} currently without a planned response.${orphanEnablers.length > 0 ? ` Additionally, ${orphanEnablers.length} enabling activit${orphanEnablers.length !== 1 ? 'ies have' : 'y has'} no connection to a strategic outcome.` : ''}`
    : visionOrphans > 0
    ? `The constraints are addressed but ${visionOrphans} transformation outcome${visionOrphans !== 1 ? 's lack' : ' lacks'} the enabling capabilities to be executable.`
    : `Coverage is strong. Focus should be on execution quality and pace rather than discovering new issues.`;

  // Highest-significance action point — ranked by weighted score, not frequency
  const esSigMap = new Map(esNodes.map(n => [n.nodeId, weightedSignificance(n, esNodes)]));
  const topActionNode = [
    ...esNodes.filter(n => n.isCoalescent),
    ...esNodes.filter(n => n.isOrphan && n.layer === 'CONSTRAINT'),
  ].sort((a, b) => (esSigMap.get(b.nodeId)?.score ?? 0) - (esSigMap.get(a.nodeId)?.score ?? 0))[0];

  const strongestChains = safe.strongestChains;
  const action = topActionNode
    ? `The immediate priority is "${formatLabel(topActionNode.displayLabel)}" — assign ownership, establish a 30-day response plan, and ensure this issue is reflected in the transformation programme.`
    : strongestChains.length > 0
    ? `The strongest validated pathway runs from "${strongestChains[0].constraintLabel}" through "${strongestChains[0].enablerLabel}" to "${strongestChains[0].reimaginationLabel}" — accelerate this chain first.`
    : `Establish clear ownership for each constraint and create explicit links between known problems and the enabling capabilities in the transformation plan.`;

  return { headline, pressure, gap, action };
}
