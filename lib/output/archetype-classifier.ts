/**
 * Workshop Archetype Classifier
 *
 * Deterministic (no LLM) classifier that examines the structural shape of
 * workshop data to determine the output archetype. This drives which sections
 * appear in the output dashboard and how they are prioritised.
 *
 * Scoring is based on node type distributions, domain weights, diagnostic
 * posture, industry signals, and theme keyword patterns.
 */

// ================================================================
// Types
// ================================================================

export type WorkshopArchetype =
  | 'agentic_tooling_blueprint'
  | 'operational_contact_centre_improvement'
  | 'compliance_risk_remediation'
  | 'hybrid';

export interface ArchetypeClassification {
  primaryArchetype: WorkshopArchetype;
  secondaryArchetypes: WorkshopArchetype[];
  confidence: number;           // 0-1
  rationale: string;            // Human-readable explanation of the classification
  requiredSections: string[];   // Section IDs from section-registry
}

export interface ClassifierInput {
  // From hemisphere data / snapshot aggregation
  nodeTypeCounts: Record<string, number>;   // VISION, BELIEF, CHALLENGE, FRICTION, CONSTRAINT, ENABLER
  domainWeights: Record<string, number>;    // Normalised 0-1 per domain
  diagnosticPosture: string;                // 'expansive', 'defensive', 'aligned', etc.

  // From workshop context
  industry: string | null;
  dreamTrack: string | null;
  targetDomain: string | null;

  // Aggregated counts
  constraintCount: number;
  enablerCount: number;
  themeKeywords: string[];                  // Flattened list of theme keywords
  totalNodes: number;
}

// ================================================================
// Keyword patterns (case-insensitive matching)
// ================================================================

const AGENTIC_KEYWORDS = [
  'automation', 'automat', 'ai', 'artificial intelligence', 'machine learning',
  'platform', 'integration', 'api', 'tooling', 'agent', 'workflow',
  'digital', 'transform', 'orchestrat', 'pipeline', 'self-service',
];

const OPERATIONS_KEYWORDS = [
  'contact', 'centre', 'center', 'operations', 'service', 'efficiency',
  'process', 'sla', 'queue', 'handling', 'throughput', 'capacity',
  'workforce', 'scheduling', 'routing', 'call', 'ticket', 'response time',
];

const COMPLIANCE_KEYWORDS = [
  'compliance', 'regulatory', 'regulation', 'risk', 'audit', 'governance',
  'policy', 'control', 'remediation', 'breach', 'reporting', 'oversight',
  'assurance', 'framework', 'mandate', 'standard', 'gdpr', 'fca',
];

// ================================================================
// Scoring helpers
// ================================================================

function keywordScore(themeKeywords: string[], patterns: string[]): number {
  if (themeKeywords.length === 0) return 0;
  const lower = themeKeywords.map(k => k.toLowerCase());
  let hits = 0;
  for (const pattern of patterns) {
    const p = pattern.toLowerCase();
    if (lower.some(kw => kw.includes(p) || p.includes(kw))) {
      hits++;
    }
  }
  return Math.min(1, hits / Math.max(patterns.length * 0.3, 1));
}

function domainWeight(domainWeights: Record<string, number>, ...names: string[]): number {
  let total = 0;
  const lower = Object.fromEntries(
    Object.entries(domainWeights).map(([k, v]) => [k.toLowerCase(), v])
  );
  for (const name of names) {
    total += lower[name.toLowerCase()] || 0;
  }
  return total;
}

function nodeRatio(counts: Record<string, number>, types: string[], total: number): number {
  if (total === 0) return 0;
  let sum = 0;
  for (const t of types) {
    sum += counts[t] || 0;
  }
  return sum / total;
}

function targetDomainMatch(targetDomain: string | null, ...patterns: string[]): boolean {
  if (!targetDomain) return false;
  const lower = targetDomain.toLowerCase();
  return patterns.some(p => lower.includes(p.toLowerCase()));
}

// ================================================================
// Main classifier
// ================================================================

export function classifyWorkshopArchetype(input: ClassifierInput): ArchetypeClassification {
  const scores: Record<WorkshopArchetype, number> = {
    agentic_tooling_blueprint: 0,
    operational_contact_centre_improvement: 0,
    compliance_risk_remediation: 0,
    hybrid: 0,
  };

  const rationale: string[] = [];

  // ---- Agentic Tooling Blueprint ----
  {
    let score = 0;

    // Technology domain weight
    const techWeight = domainWeight(input.domainWeights, 'technology', 'tech');
    if (techWeight > 0.35) { score += 0.3; rationale.push(`Technology domain weight ${(techWeight * 100).toFixed(0)}% (>35%)`); }
    else if (techWeight > 0.2) { score += 0.15; }

    // Enablers outweigh constraints
    if (input.enablerCount > input.constraintCount && input.enablerCount > 3) {
      score += 0.2;
      rationale.push(`Enablers (${input.enablerCount}) exceed constraints (${input.constraintCount})`);
    }

    // Posture signals
    if (['expansive', 'innovation-dominated', 'aligned'].includes(input.diagnosticPosture)) {
      score += 0.15;
    }

    // Vision-heavy node distribution
    const visionRatio = nodeRatio(input.nodeTypeCounts, ['VISION', 'BELIEF'], input.totalNodes);
    if (visionRatio > 0.3) { score += 0.15; }

    // Theme keywords
    const kwScore = keywordScore(input.themeKeywords, AGENTIC_KEYWORDS);
    score += kwScore * 0.2;

    scores.agentic_tooling_blueprint = Math.min(1, score);
  }

  // ---- Operational Contact Centre Improvement ----
  {
    let score = 0;

    // Target domain match
    if (targetDomainMatch(input.targetDomain, 'contact', 'operations', 'service', 'customer ops')) {
      score += 0.35;
      rationale.push(`Target domain matches operations/contact centre pattern`);
    }

    // Customer domain weight
    const custWeight = domainWeight(input.domainWeights, 'customer', 'client');
    if (custWeight > 0.25) { score += 0.2; }

    // Significant constraint presence
    if (input.constraintCount >= 5) { score += 0.1; }

    // Process/efficiency themes
    const kwScore = keywordScore(input.themeKeywords, OPERATIONS_KEYWORDS);
    score += kwScore * 0.25;

    // Industry signal
    if (input.industry && /contact|telecom|service|retail|insurance/i.test(input.industry)) {
      score += 0.1;
    }

    scores.operational_contact_centre_improvement = Math.min(1, score);
  }

  // ---- Compliance Risk Remediation ----
  {
    let score = 0;

    // Constraint-heavy: more negative than positive nodes
    const negativeRatio = nodeRatio(input.nodeTypeCounts, ['CONSTRAINT', 'CHALLENGE', 'FRICTION'], input.totalNodes);
    const positiveRatio = nodeRatio(input.nodeTypeCounts, ['VISION', 'BELIEF', 'ENABLER'], input.totalNodes);
    if (negativeRatio > positiveRatio && negativeRatio > 0.4) {
      score += 0.3;
      rationale.push(`Negative nodes (${(negativeRatio * 100).toFixed(0)}%) outweigh positive (${(positiveRatio * 100).toFixed(0)}%)`);
    }

    // Defensive/risk posture
    if (['defensive', 'risk-dominated', 'fragmented'].includes(input.diagnosticPosture)) {
      score += 0.2;
      rationale.push(`Diagnostic posture: ${input.diagnosticPosture}`);
    }

    // Regulation domain weight
    const regWeight = domainWeight(input.domainWeights, 'regulation', 'compliance', 'risk', 'legal');
    if (regWeight > 0.25) { score += 0.2; }

    // Theme keywords
    const kwScore = keywordScore(input.themeKeywords, COMPLIANCE_KEYWORDS);
    score += kwScore * 0.2;

    // Industry signal
    if (input.industry && /financial|banking|insurance|pharma|health|energy|legal/i.test(input.industry)) {
      score += 0.1;
    }

    scores.compliance_risk_remediation = Math.min(1, score);
  }

  // ---- Determine primary archetype ----
  const sorted = (Object.entries(scores) as [WorkshopArchetype, number][])
    .filter(([k]) => k !== 'hybrid')
    .sort((a, b) => b[1] - a[1]);

  const topScore = sorted[0][1];
  const secondScore = sorted[1]?.[1] || 0;

  // Hybrid if no strong winner or top two are close
  const isHybrid = topScore < 0.4 || (topScore - secondScore < 0.15 && topScore < 0.7);

  let primaryArchetype: WorkshopArchetype;
  let secondaryArchetypes: WorkshopArchetype[];
  let confidence: number;

  if (isHybrid) {
    primaryArchetype = 'hybrid';
    secondaryArchetypes = sorted.filter(([, s]) => s > 0.2).map(([k]) => k);
    confidence = 1 - Math.abs(topScore - secondScore);
    rationale.push(`Hybrid: top scores are close (${sorted[0][0]}=${topScore.toFixed(2)}, ${sorted[1][0]}=${secondScore.toFixed(2)})`);
  } else {
    primaryArchetype = sorted[0][0];
    secondaryArchetypes = sorted.slice(1).filter(([, s]) => s > 0.25).map(([k]) => k);
    confidence = topScore;
  }

  // Build required sections based on archetype
  const requiredSections = buildRequiredSections(primaryArchetype, secondaryArchetypes);

  return {
    primaryArchetype,
    secondaryArchetypes,
    confidence: Math.round(confidence * 100) / 100,
    rationale: rationale.join('. ') || `Classification based on ${input.totalNodes} nodes across workshop data.`,
    requiredSections,
  };
}

// ================================================================
// Section mapping
// ================================================================

function buildRequiredSections(
  primary: WorkshopArchetype,
  secondaries: WorkshopArchetype[],
): string[] {
  // Core sections always present
  const sections = new Set(['exec-summary', 'discovery', 'summary']);

  // Archetype-specific sections
  const all = [primary, ...secondaries];

  for (const arch of all) {
    switch (arch) {
      case 'agentic_tooling_blueprint':
        sections.add('reimagine');
        sections.add('solution');
        sections.add('hemisphere');
        break;
      case 'operational_contact_centre_improvement':
        sections.add('reimagine');
        sections.add('constraints');
        sections.add('customer-journey');
        sections.add('hemisphere');
        break;
      case 'compliance_risk_remediation':
        sections.add('constraints');
        sections.add('commercial');
        sections.add('hemisphere');
        break;
      case 'hybrid':
        // Include everything for hybrid
        sections.add('reimagine');
        sections.add('constraints');
        sections.add('solution');
        sections.add('commercial');
        sections.add('customer-journey');
        sections.add('hemisphere');
        break;
    }
  }

  return Array.from(sections);
}
