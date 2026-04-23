'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';

export type HemispherePrimaryType =
  | 'VISIONARY'
  | 'OPPORTUNITY'
  | 'CONSTRAINT'
  | 'RISK'
  | 'ENABLER'
  | 'ACTION'
  | 'QUESTION'
  | 'INSIGHT';

export type HemisphereDialoguePhase = 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';

export type HemisphereNodeDatum = {
  dataPointId: string;
  createdAtMs: number;
  rawText: string;
  semanticUnits?: string[];
  dataPointSource: string;
  speakerId?: string | null;
  dialoguePhase: HemisphereDialoguePhase | null;
  intent?: string | null;
  themeId?: string | null;
  themeLabel?: string | null;
  domainLearningSource?: 'saved_feedback' | null;
  // Deterministic confidence from EthentaFlow domain scorer.
  // Set once at commit time; never overwritten by LLM updates.
  // Drives initial radial placement before LLM agenticAnalysis arrives.
  ethentaflowConfidence?: number | null;
  transcriptChunk: {
    speakerId?: string | null;
    startTimeMs: number;
    endTimeMs: number;
    confidence: number | null;
    source: string;
  } | null;
  classification: {
    primaryType: HemispherePrimaryType;
    confidence: number;
    keywords: string[];
    suggestedArea: string | null;
    updatedAt: string;
  } | null;
  agenticAnalysis?: {
    domains: Array<{domain: string; relevance: number; reasoning: string}>;
    themes: Array<{label: string; category: string; confidence: number; reasoning: string}>;
    actors: Array<{
      name: string;
      role: string;
      interactions: Array<{
        withActor: string;
        action: string;
        sentiment: string;
        context: string;
      }>;
    }>;
    semanticMeaning: string;
    sentimentTone: string;
    // 0 = LLM pending (placeholder); >0 = LLM has returned a real confidence value.
    // When >0, supersedes ethentaflowConfidence for radial placement.
    overallConfidence: number;
  } | null;
};

type PositionedNode = HemisphereNodeDatum & {
  x: number;
  y: number;
  r: number;
  fill: string;
  stroke: string;
  label: string;
  conf: number | null;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function primaryColor(type: HemispherePrimaryType | null) {
  switch (type) {
    case 'VISIONARY':
      return '#8b5cf6';
    case 'OPPORTUNITY':
      return '#3b82f6';
    case 'CONSTRAINT':
      return '#f97316';
    case 'RISK':
      return '#ef4444';
    case 'ENABLER':
      return '#14b8a6';
    case 'INSIGHT':
      return '#10b981';
    case 'ACTION':
      return '#f59e0b';
    case 'QUESTION':
      return '#0ea5e9';
    default:
      return '#94a3b8';
  }
}

function intentColor(intent: string) {
  const palette = [
    '#a855f7',
    '#3b82f6',
    '#14b8a6',
    '#22c55e',
    '#f59e0b',
    '#f97316',
    '#ef4444',
    '#06b6d4',
  ];
  const i = Math.floor(hash01(intent) * palette.length);
  return palette[Math.max(0, Math.min(palette.length - 1, i))];
}

function buildDomainAngles(lensNames: string[]): Record<string, number> {
  const angles: Record<string, number> = {};
  const count = lensNames.length;
  if (count === 0) return angles;
  lensNames.forEach((name, i) => {
    // Domain centers sit BETWEEN the sector boundary lines.
    angles[name] = Math.PI - ((i + 0.5) / count) * Math.PI;
  });
  return angles;
}

function buildDomainSpokeAngles(lensNames: string[]): number[] {
  const count = lensNames.length;
  if (count <= 1) return count === 1 ? [Math.PI / 2] : [];

  return Array.from({ length: count + 1 }, (_, i) => Math.PI - (i / count) * Math.PI);
}

function getDomainLabelLayout(
  name: string,
  theta: number
): {
  radiusMultiplier: number;
  dx: number;
  dy: number;
  anchor: 'start' | 'middle' | 'end';
  fontSize: number;
  lines: string[];
} {
  const normalized = name.toLowerCase();
  const anchor: 'start' | 'middle' | 'end' =
    theta > (2 * Math.PI) / 3 ? 'start' : theta < Math.PI / 3 ? 'end' : 'middle';

  if (normalized === 'risk/compliance') {
    return {
      radiusMultiplier: 1.09,
      dx: 14,
      dy: 0,
      anchor: 'start',
      fontSize: 10,
      lines: ['Risk/', 'Compliance'],
    };
  }
  if (normalized === 'operations') {
    return {
      radiusMultiplier: 1.095,
      dx: -18,
      dy: -2,
      anchor: 'end',
      fontSize: 10,
      lines: ['Operations'],
    };
  }
  if (normalized === 'technology') {
    return {
      radiusMultiplier: 1.08,
      dx: 0,
      dy: -4,
      anchor: 'middle',
      fontSize: 10,
      lines: ['Technology'],
    };
  }
  if (normalized === 'commercial') {
    return {
      radiusMultiplier: 1.08,
      dx: 0,
      dy: -4,
      anchor: 'middle',
      fontSize: 10,
      lines: ['Commercial'],
    };
  }
  if (normalized === 'partners') {
    return {
      radiusMultiplier: 1.095,
      dx: 18,
      dy: -2,
      anchor: 'start',
      fontSize: 10,
      lines: ['Partners'],
    };
  }
  if (normalized === 'people') {
    return {
      radiusMultiplier: 1.095,
      dx: -18,
      dy: -2,
      anchor: 'end',
      fontSize: 10,
      lines: ['People'],
    };
  }

  return {
    radiusMultiplier: 1.065,
    dx: 0,
    dy: 0,
    anchor,
    fontSize: 11,
    lines: [name],
  };
}

/**
 * Fuzzy domain → angle lookup:
 * 1. Exact match (case-insensitive)
 * 2. One is a prefix of the other (e.g. "Customer" ↔ "Customer Experience")
 * 3. Best word-overlap match (e.g. "Operations" ↔ "Operations & Oversight")
 */
function findAngleForDomain(domain: string | null | undefined, domainAngles: Record<string, number>): number | undefined {
  if (!domain) return undefined;
  const lower = domain.toLowerCase().trim();
  // 1. Exact case-insensitive
  for (const [key, angle] of Object.entries(domainAngles)) {
    if (key.toLowerCase() === lower) return angle;
  }
  // 2. Prefix (either direction)
  for (const [key, angle] of Object.entries(domainAngles)) {
    const kl = key.toLowerCase();
    if (kl.startsWith(lower) || lower.startsWith(kl)) return angle;
  }
  // 3. Word overlap (ignore short words / stop words)
  const skip = new Set(['&', 'and', 'the', 'of', 'in', 'for']);
  const domWords = new Set(lower.split(/[\s&+]+/).filter(w => w.length > 2 && !skip.has(w)));
  let bestScore = 0;
  let bestAngle: number | undefined;
  for (const [key, angle] of Object.entries(domainAngles)) {
    const kWords = key.toLowerCase().split(/[\s&+]+/).filter(w => w.length > 2 && !skip.has(w));
    let hits = 0;
    for (const w of kWords) if (domWords.has(w)) hits++;
    if (hits > bestScore) { bestScore = hits; bestAngle = angle; }
  }
  return bestScore > 0 ? bestAngle : undefined;
}

function normalizeDomainKey(domain: string | null | undefined): string {
  return String(domain ?? '').toLowerCase().trim().replace(/[^a-z]+/g, ' ');
}

function getDomainSectorBounds(
  domain: string | null | undefined,
  domainAngles: Record<string, number>
): { min: number; max: number; center: number } | null {
  const center = findAngleForDomain(domain, domainAngles);
  if (center == null) return null;

  const sortedAngles = Array.from(
    new Set(Object.values(domainAngles).filter((angle) => Number.isFinite(angle)))
  ).sort((a, b) => a - b);
  const index = sortedAngles.findIndex((angle) => angle === center);
  if (index === -1) return null;

  const min = index > 0 ? (sortedAngles[index - 1] + center) / 2 : 0;
  const max = index < sortedAngles.length - 1 ? (center + sortedAngles[index + 1]) / 2 : Math.PI;
  return { min, max, center };
}

function getPrimaryDomain(domains: Array<{ domain: string; relevance: number }>) {
  return domains.reduce((best, current) => {
    if (!best) return current;
    return current.relevance > best.relevance ? current : best;
  }, null as { domain: string; relevance: number } | null);
}

const PEOPLE_INTENT_CUES = [
  'enable',
  'enables',
  'enabled',
  'enablement',
  'capability',
  'capabilities',
  'skills',
  'skill',
  'coach',
  'coaching',
  'training',
  'guidance',
  'guide',
  'guided',
  'support leaders',
  'support team leaders',
  'team leaders',
  'leaders',
  'leadership',
  'behaviour',
  'behaviors',
  'behavioural',
  'learning',
  'development',
  'decision support',
  'confidence',
  'adoption',
  'literacy',
  'upskill',
  'upskilling',
];

const OPERATIONS_INTENT_CUES = [
  'workflow',
  'workflows',
  'routing',
  'process',
  'processes',
  'queue',
  'queues',
  'handoff',
  'handoffs',
  'triage',
  'escalation',
  'escalations',
  'throughput',
  'sla',
  'case flow',
  'operating model',
  'execution',
  'execution path',
  'task',
  'tasks',
  'runbook',
  'dispatch',
  'capacity plan',
];

function countIntentCueHits(text: string, cues: string[]) {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const cue of cues) {
    if (lower.includes(cue)) hits++;
  }
  return hits;
}

function getPlacementIntentBias(text: string) {
  const peopleHits = countIntentCueHits(text, PEOPLE_INTENT_CUES);
  const operationsHits = countIntentCueHits(text, OPERATIONS_INTENT_CUES);
  const total = peopleHits + operationsHits;
  if (total === 0) {
    return { people: 0, operations: 0 };
  }
  return {
    people: peopleHits / total,
    operations: operationsHits / total,
  };
}

type PlacementDomainWeight = {
  angle: number;
  weight: number;
};

export function getIntentAwarePlacementWeights(
  text: string,
  domains: Array<{ domain: string; relevance: number }>,
  domainAngles: Record<string, number>
): PlacementDomainWeight[] {
  const bias = getPlacementIntentBias(text);
  const weightedDomains: PlacementDomainWeight[] = [];

  for (const domain of domains) {
    const angle = findAngleForDomain(domain.domain, domainAngles);
    if (angle == null) continue;

    const normalized = normalizeDomainKey(domain.domain);
    let multiplier = 1;

    if (normalized.includes('people')) {
      multiplier += bias.people * 0.55;
      multiplier -= bias.operations * 0.15;
    } else if (normalized.includes('operation')) {
      multiplier += bias.operations * 0.55;
      multiplier -= bias.people * 0.25;
    }

    weightedDomains.push({
      angle,
      weight: clamp(domain.relevance * Math.max(0.2, multiplier), 0.01, 2),
    });
  }

  return weightedDomains;
}

export function getIntentAwareDomainTheta(
  _text: string,
  domains: Array<{ domain: string; relevance: number }>,
  domainAngles: Record<string, number>
): { theta: number | null; strength: number } {
  if (domains.length === 0) {
    return { theta: null, strength: 0 };
  }

  const primaryDomain = domains.reduce((best, current) => {
    if (!best) return current;
    return current.relevance > best.relevance ? current : best;
  }, null as { domain: string; relevance: number } | null);

  if (!primaryDomain) {
    return { theta: null, strength: 0 };
  }

  const primaryAngle = findAngleForDomain(primaryDomain.domain, domainAngles);
  if (primaryAngle == null) {
    return { theta: null, strength: 0 };
  }

  return {
    theta: primaryAngle,
    strength: 0.72,
  };
}

export type PendingHemisphereNode = {
  /** Stable utterance id from ThoughtStateMachine.attempt.id. */
  id: string;
  speakerId?: string | null;
  /** Domain string from interpretLiveUtterance — drives angular position. */
  domain: string;
  /** Live semantic phase from the evolving working passage. */
  dialoguePhase?: HemisphereDialoguePhase | null;
  /** Live semantic intent label for provisional-node motion and tooltip context. */
  intent?: string | null;
  /** Timestamp when accumulation started — drives radial/time-axis position. */
  startedAtMs: number;
  /** Cleaned in-memory working passage for tooltip/label only. */
  workingText: string;
  /** Deterministic domain confidence while the utterance is still provisional. */
  domainConfidence?: number | null;
  /** Interpretation confidence from the live semantic pass. */
  semanticConfidence?: number | null;
};

export const HemisphereNodes = memo(function HemisphereNodes(props: {
  nodes: HemisphereNodeDatum[];
  originTimeMs: number | null;
  timeScaleMs?: number;
  onNodeClick?: (node: HemisphereNodeDatum) => void;
  themeAttractors?: Record<string, { x: number; y: number; strength: number; label: string }>;
  links?: Array<{
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    strength: number;
    color?: string;
    width?: number;
  }>;
  lensNames?: string[];
  className?: string;
  /** Live in-progress utterances — displayed as provisional grey nodes, never stored as nodes. */
  pendingNodes?: PendingHemisphereNode[];
}) {
  const { nodes, originTimeMs, timeScaleMs = 10 * 60 * 1000, onNodeClick, themeAttractors, links, lensNames, className, pendingNodes } = props;
  const activeLenses = lensNames ?? [];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const tooltipRafRef = useRef<number | null>(null);
  const [tooltip, setTooltip] = useState<{ label: string; conf: number | null } | null>(null);

  // SSR-safe "now" — starts at 0 on server so link-opacity useMemos produce a deterministic
  // element count (all links render at full opacity when nowRef=0).  Updated once on mount.
  // This prevents React #418 hydration mismatch: if nodes were ever pre-populated on SSR,
  // Date.now() would differ between server and client, changing how many links pass the
  // opacity > 0.02 threshold → different element count → structural HTML mismatch.
  const nowRef = useRef(0);
  useEffect(() => {
    nowRef.current = Date.now();
  }, []);

  const scheduleTooltipPositionUpdate = (attempt = 0) => {
    if (tooltipRafRef.current != null) return;
    tooltipRafRef.current = requestAnimationFrame(() => {
      tooltipRafRef.current = null;
      const el = tooltipRef.current;
      if (!el) {
        if (attempt < 2) scheduleTooltipPositionUpdate(attempt + 1);
        return;
      }
      const pos = tooltipPosRef.current;
      el.style.left = `${pos.x + 10}px`;
      el.style.top = `${pos.y + 10}px`;
    });
  };

  const positioned = useMemo<PositionedNode[]>(() => {
    const W = 1200;
    const H = 530;
    const pad = 32;
    const cx = W / 2;
    const cy = H - pad;
    const R = Math.min(cx - pad, cy - pad);
    const rMin = R * 0.25;

    const t0 = originTimeMs ?? Math.min(...nodes.map((n) => n.createdAtMs));
    // Scale timeScaleMs to 1/4 of the actual session span so nodes spread across the arc
    const tMax = Math.max(...nodes.map((n) => n.createdAtMs));
    const sessionSpan = Math.max(tMax - t0, 1);
    const effectiveTimeScale = Math.max(timeScaleMs, sessionSpan / 4);

    // Domain angles — nodes are pulled toward their classified domain zone
    const domainAngles = buildDomainAngles(activeLenses);

    return nodes.map((n) => {
      const dt = Math.max(0, n.createdAtMs - t0);
      const u = 1 - Math.exp(-dt / effectiveTimeScale);
      const baseTheta = Math.PI - clamp01(u) * Math.PI;

      // Layer 1: Dialogue phase bias
      // Right = REIMAGINE, Left = CONSTRAINTS, Center = DEFINE_APPROACH.
      const phaseStrength = n.dialoguePhase ? 0.35 : 0;
      const phaseTarget =
        n.dialoguePhase === 'CONSTRAINTS'
          ? (5 * Math.PI) / 6
          : n.dialoguePhase === 'DEFINE_APPROACH'
            ? Math.PI / 2
            : n.dialoguePhase === 'REIMAGINE'
              ? Math.PI / 6
              : baseTheta;
      const thetaAfterPhase = lerp(baseTheta, phaseTarget, phaseStrength);

      // Layer 2: Domain bias — preserve multi-domain shape, then apply a narrow
      // intent-aware bias so enablement statements land nearer People than Operations.
      const allDomains = n.agenticAnalysis?.domains ?? [];
      let theta = thetaAfterPhase;
      if (allDomains.length > 0) {
        const primaryDomain = getPrimaryDomain(allDomains);
        const sector = getDomainSectorBounds(primaryDomain?.domain, domainAngles);
        if (sector) {
          // Keep nodes visibly inside their owning domain zone by using the
          // central band of the sector rather than the full boundary span.
          const spreadU = hash01(`sector:${n.dataPointId}`);
          const halfWidth = (sector.max - sector.min) / 2;
          const centralBandHalfWidth = halfWidth * 0.45;
          const sectorMin = sector.center - centralBandHalfWidth;
          const sectorMax = sector.center + centralBandHalfWidth;
          theta = lerp(sectorMin, sectorMax, spreadU);
        } else {
          const placement = getIntentAwareDomainTheta(n.rawText, allDomains, domainAngles);
          if (placement.theta != null) {
            theta = placement.theta;
          }
        }
      }

      // Angular jitter is only applied when no committed domain is available.
      const angularJitter = allDomains.length > 0
        ? 0
        : (hash01(`aj:${n.dataPointId}`) - 0.5) * 0.38;
      theta += angularJitter;

      const clsType = n.classification?.primaryType ?? null;

      // Placement confidence chain — temporal priority:
      //   1. agenticAnalysis.overallConfidence > 0  → LLM has returned; use its verdict
      //   2. ethentaflowConfidence                  → deterministic scorer result (immediate at commit)
      //   3. classification.confidence              → legacy path (loaded snapshots)
      //   4. 0.35                                   → neutral fallback
      const llmConf = typeof n.agenticAnalysis?.overallConfidence === 'number' && n.agenticAnalysis.overallConfidence > 0
        ? n.agenticAnalysis.overallConfidence
        : null;
      const clsConf = llmConf
        ?? (typeof n.ethentaflowConfidence === 'number' ? n.ethentaflowConfidence : null)
        ?? (typeof n.classification?.confidence === 'number' ? n.classification.confidence : null);
      const radialConf = clamp01(clsConf ?? 0.35);

      // Clamp theta to valid semicircle range [0.05, π-0.05] to prevent dots escaping
      theta = Math.max(0.05, Math.min(Math.PI - 0.05, theta));

      const jitter = (hash01(n.dataPointId) - 0.5) * 28;
      const radial = Math.min(R, rMin + radialConf * (R - rMin) + jitter);

      const baseX = cx + radial * Math.cos(theta);
      const baseY = cy - radial * Math.sin(theta);

      const attractor = n.themeId && themeAttractors ? themeAttractors[n.themeId] : null;
      const pull = attractor ? clamp01(0.08 + 0.12 * Math.log1p(Math.max(0, attractor.strength))) : 0;
      const microJitter = (hash01(`theme:${n.dataPointId}`) - 0.5) * 10;
      const rawX = attractor ? lerp(baseX, attractor.x, pull) + microJitter : baseX;
      const rawY = attractor ? lerp(baseY, attractor.y, pull) + microJitter : baseY;
      // Clamp to semicircle boundary (not just rectangular viewport)
      let x = rawX;
      let y = rawY;
      // Ensure dot is above the baseline (in the hemisphere, not below)
      y = Math.min(y, cy);
      // Radial clamp — dot must not exceed hemisphere radius from center
      const dx = x - cx;
      const dy = cy - y; // y increases downward, hemisphere extends upward
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > R - 4) { // 4px margin inside the arc
        const scale = (R - 4) / dist;
        x = cx + dx * scale;
        y = cy - dy * scale;
      }
      // Final rectangular safety clamp
      x = Math.max(pad, Math.min(W - pad, x));
      y = Math.max(pad, Math.min(H - pad, y));

      const fill = clsType ? primaryColor(clsType) : n.intent ? intentColor(n.intent) : primaryColor(null);
      const stroke = 'rgba(15,23,42,0.22)';

      return {
        ...n,
        x,
        y,
        r: 6,
        fill,
        stroke,
        label: (n.themeLabel || n.intent)?.toUpperCase() || (clsType ?? 'UNCLASSIFIED'),
        conf: clsConf,
      };
    });
  }, [nodes, originTimeMs, timeScaleMs, themeAttractors, activeLenses]);

  const convergenceLinks = useMemo(() => {
    if (!themeAttractors) return [] as Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      opacity: number;
    }>;

    const now = nowRef.current;
    const recent = positioned.slice(Math.max(0, positioned.length - 96));

    const out: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; opacity: number }> = [];
    for (const n of recent) {
      if (!n.themeId) continue;
      const t = themeAttractors[n.themeId];
      if (!t) continue;
      if (t.strength < 2) continue;

      const ageMs = Math.max(0, now - n.createdAtMs);
      const age01 = clamp01(ageMs / (3 * 60 * 1000));
      const opacity = clamp01(0.22 * (1 - age01));
      if (opacity <= 0.02) continue;

      out.push({
        id: `theme:${n.dataPointId}`,
        x1: n.x,
        y1: n.y,
        x2: t.x,
        y2: t.y,
        opacity,
      });
    }
    return out;
  }, [positioned, themeAttractors]);

  const intraThemeLinks = useMemo(() => {
    if (!themeAttractors) {
      return [] as Array<{ id: string; x1: number; y1: number; x2: number; y2: number; opacity: number }>;
    }

    const now = nowRef.current;
    const recent = positioned.slice(Math.max(0, positioned.length - 140));

    const byTheme: Record<string, PositionedNode[]> = {};
    for (const n of recent) {
      if (!n.themeId) continue;
      const t = themeAttractors[n.themeId];
      if (!t || t.strength < 2) continue;
      (byTheme[n.themeId] ||= []).push(n);
    }

    const out: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; opacity: number }> = [];
    for (const [themeId, group] of Object.entries(byTheme)) {
      group.sort((a, b) => a.createdAtMs - b.createdAtMs);
      const tail = group.slice(Math.max(0, group.length - 10));
      for (let i = 1; i < tail.length; i++) {
        const a = tail[i - 1];
        const b = tail[i];
        const ageMs = Math.max(0, now - Math.max(a.createdAtMs, b.createdAtMs));
        const age01 = clamp01(ageMs / (3 * 60 * 1000));
        const opacity = clamp01(0.16 * (1 - age01));
        if (opacity <= 0.02) continue;
        out.push({
          id: `theme-chain:${themeId}:${a.dataPointId}:${b.dataPointId}`,
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          opacity,
        });
      }
    }

    return out;
  }, [positioned, themeAttractors]);

  const backdrop = useMemo(() => {
    const W = 1200;
    const H = 530;
    const pad = 32;
    const cx = W / 2;
    const cy = H - pad;
    const R = Math.min(cx - pad, cy - pad);

    const arc = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
    const rings = [0.25, 0.5, 0.75].map((p) => {
      const r = R * p;
      return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
    });

    // Domain boundary spokes — visually define the sector edges
    const domainSpokeAngles = buildDomainSpokeAngles(activeLenses);
    const spokes = domainSpokeAngles.map((theta) => {
      const x = cx + R * Math.cos(theta);
      const y = cy - R * Math.sin(theta);
      return `M ${cx} ${cy} L ${x} ${y}`;
    });

    return { W, H, cx, cy, R, arc, rings, spokes };
  }, [activeLenses]);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${backdrop.W} ${backdrop.H}`} className="w-full" style={{ display: 'block' }}>
        <defs>
          <style>{`
            @keyframes hemispherePulse {
              0%, 100% { opacity: 0.85; r: 8; }
              50% { opacity: 0.5; r: 12; }
            }
            .hemisphere-live-dot { animation: hemispherePulse 1.5s ease-in-out infinite; }
            @keyframes pendingRingPulse {
              0%   { r: 10; opacity: 0.9; }
              50%  { r: 16; opacity: 0.4; }
              100% { r: 10; opacity: 0.9; }
            }
            @keyframes pendingRingOuter {
              0%   { r: 18; opacity: 0.35; }
              50%  { r: 26; opacity: 0.1; }
              100% { r: 18; opacity: 0.35; }
            }
            .pending-ring-inner { animation: pendingRingPulse 1.2s ease-in-out infinite; }
            .pending-ring-outer { animation: pendingRingOuter 1.2s ease-in-out infinite; }
          `}</style>
        </defs>
        <path d={backdrop.arc} fill="none" stroke="rgba(148,163,184,0.6)" strokeWidth={2} />
        {backdrop.rings.map((d) => (
          <path key={d} d={d} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth={1} />
        ))}
        {backdrop.spokes.map((d) => (
          <path key={d} d={d} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth={1} />
        ))}

        <g pointerEvents="none">
          <text
            x={backdrop.cx - backdrop.R}
            y={backdrop.cy + 28}
            fontSize={11}
            fill="rgba(15,23,42,0.55)"
            textAnchor="start"
          >
            Earlier
          </text>
          <text
            x={backdrop.cx + backdrop.R}
            y={backdrop.cy + 28}
            fontSize={11}
            fill="rgba(15,23,42,0.55)"
            textAnchor="end"
          >
            Later
          </text>

          {/* Domain zone labels — positioned along the arc with smart anchoring */}
          {Object.entries(buildDomainAngles(activeLenses)).map(([name, theta]) => {
            const layout = getDomainLabelLayout(name, theta);
            const labelR = backdrop.R * layout.radiusMultiplier;
            const x = backdrop.cx + labelR * Math.cos(theta) + layout.dx;
            const y = backdrop.cy - labelR * Math.sin(theta) + layout.dy;
            return (
              <text
                key={`domain-${name}`}
                x={x}
                y={y}
                fontSize={layout.fontSize}
                fill="rgba(99,102,241,0.8)"
                textAnchor={layout.anchor}
                fontWeight={600}
              >
                {layout.lines.length > 1 ? (
                  <>
                    <tspan x={x} dy={0}>{layout.lines[0]}</tspan>
                    <tspan x={x} dy={12}>{layout.lines[1]}</tspan>
                  </>
                ) : (
                  layout.lines[0]
                )}
              </text>
            );
          })}

          {(
            [
              { p: 0.25, label: 'Low confidence' },
              { p: 0.5, label: 'Mid' },
              { p: 0.75, label: 'High confidence' },
            ] as const
          ).map((r) => (
            <text
              key={r.label}
              x={backdrop.cx + backdrop.R * r.p}
              y={backdrop.cy - 10}
              fontSize={10}
              fill="rgba(15,23,42,0.45)"
              textAnchor="middle"
            >
              {r.label}
            </text>
          ))}
        </g>

        {links
          ? links.map((l) => (
              <line
                key={l.id}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={
                  l.color
                    ? l.color
                    : `rgba(99,102,241,${clamp01(0.10 + 0.18 * clamp01(l.strength))})`
                }
                strokeWidth={
                  typeof l.width === 'number'
                    ? l.width
                    : Math.max(1, Math.min(3.5, 1 + 2.5 * clamp01(l.strength)))
                }
              />
            ))
          : null}

        {intraThemeLinks.map((l) => (
          <line
            key={l.id}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={`rgba(148,163,184,${l.opacity})`}
            strokeWidth={1}
          />
        ))}

        {convergenceLinks.map((l) => (
          <line
            key={l.id}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={`rgba(148,163,184,${l.opacity})`}
            strokeWidth={1}
          />
        ))}

        {themeAttractors
          ? Object.entries(themeAttractors).map(([id, t]) => (
              t.strength < 2 ? null : (
                <circle
                  key={id}
                  cx={t.x}
                  cy={t.y}
                  r={Math.max(6, Math.min(18, 6 + 2 * Math.log1p(Math.max(0, t.strength))))}
                  fill="rgba(148,163,184,0.12)"
                  stroke="rgba(148,163,184,0.35)"
                  strokeWidth={1}
                >
                  <title>{`${t.label} (${t.strength})`}</title>
                </circle>
              )
            ))
          : null}

        {positioned.map((n) => {
          const isLive = n.dataPointId.startsWith('live:');
          return (
          <circle
            key={n.dataPointId}
            cx={n.x}
            cy={n.y}
            r={isLive ? 8 : n.r}
            fill={n.fill}
            stroke={isLive ? 'rgba(59,130,246,0.7)' : n.stroke}
            strokeWidth={isLive ? 2 : 1}
            opacity={isLive ? 0.85 : 1}
            onMouseEnter={(e) => {
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              tooltipPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
              scheduleTooltipPositionUpdate();
              setTooltip({ label: isLive ? 'STREAMING...' : n.label, conf: n.conf });
            }}
            onMouseMove={(e) => {
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              tooltipPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
              scheduleTooltipPositionUpdate();
            }}
            onMouseLeave={() => setTooltip(null)}
            onClick={() => !isLive && onNodeClick?.(n)}
            className={isLive ? 'hemisphere-live-dot' : undefined}
            style={{ cursor: isLive ? 'default' : 'pointer', transition: 'cx 0.3s ease, cy 0.3s ease' }}
          />
          );
        })}

        {/* Pending nodes — live accumulating utterances, visual only, never committed */}
        {(pendingNodes ?? []).map((pn) => {
          const W = 1200; const H = 530; const pad = 32;
          const cx = W / 2; const cy = H - pad;
          const R = Math.min(cx - pad, cy - pad);
          const domainAngles = buildDomainAngles(activeLenses);
          const baseTheta = findAngleForDomain(pn.domain, domainAngles) ?? Math.PI / 2;
          const phaseStrength = pn.dialoguePhase ? 0.35 : 0;
          const phaseTarget =
            pn.dialoguePhase === 'CONSTRAINTS'
              ? (5 * Math.PI) / 6
              : pn.dialoguePhase === 'DEFINE_APPROACH'
                ? Math.PI / 2
                : pn.dialoguePhase === 'REIMAGINE'
                  ? Math.PI / 6
                  : baseTheta;
          let theta = lerp(baseTheta, phaseTarget, phaseStrength);
          const intentJitterSeed = pn.intent || pn.workingText || pn.id;
          theta += (hash01(`pending:${intentJitterSeed}`) - 0.5) * 0.26;
          theta = Math.max(0.05, Math.min(Math.PI - 0.05, theta));
          const provisionalConfidence = clamp01(
            Math.max(pn.domainConfidence ?? 0, pn.semanticConfidence ?? 0, 0.35)
          );
          const radial = R * lerp(0.28, 0.72, provisionalConfidence);
          const px = cx + radial * Math.cos(theta);
          const py = cy - radial * Math.sin(theta);
          const transStyle = { transition: 'cx 0.6s ease, cy 0.6s ease' } as React.CSSProperties;
          const label = pn.workingText.trim().split(/\s+/).slice(0, 6).join(' ');
          return (
            <g key={`pending:${pn.id}`}>
              <circle
                cx={px} cy={py} r={16}
                fill="rgba(161,161,170,0.12)"
                stroke="rgba(161,161,170,0.55)"
                strokeWidth={1.25}
                className="pending-ring-outer"
                style={transStyle}
              />
              <circle
                cx={px} cy={py} r={8}
                fill="rgba(212,212,216,0.78)"
                stroke="rgba(244,244,245,0.9)"
                strokeWidth={1.5}
                className="pending-ring-inner"
                style={transStyle}
              />
              <circle cx={px} cy={py} r={2.5} fill="rgba(255,255,255,0.95)" style={transStyle} />
              {label ? (
                <text
                  x={px}
                  y={py - 22}
                  textAnchor="middle"
                  fill="rgba(228,228,231,0.88)"
                  fontSize="10"
                  style={{ transition: 'x 0.6s ease, y 0.6s ease' }}
                >
                  {label}
                </text>
              ) : null}
              <title>{pn.workingText || 'Resolving thought…'}</title>
            </g>
          );
        })}
      </svg>

      {tooltip ? (
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            pointerEvents: 'none',
          }}
          className="rounded-md border bg-background px-2 py-1 text-xs shadow-md"
        >
          <div className="font-medium">{tooltip.label}</div>
          <div className="text-muted-foreground">
            {tooltip.conf == null ? 'Confidence: —' : `Confidence: ${(tooltip.conf * 100).toFixed(0)}%`}
          </div>
        </div>
      ) : null}
    </div>
  );
});
