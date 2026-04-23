export type CanonicalWorkshopType =
  | 'TRANSFORMATION'
  | 'OPERATIONS'
  | 'AI'
  | 'GO_TO_MARKET'
  | 'FINANCE';

export type CanonicalEngagementType =
  | 'DIAGNOSTIC_BASELINE'
  | 'DEEP_DIVE'
  | 'SPRINT'
  | 'ALIGNMENT';

export type WorkshopRuntimeType = CanonicalWorkshopType | 'SALES';

export type WorkshopTypeProfile = {
  key: CanonicalWorkshopType;
  label: string;
  description: string;
  tooltip: string;
  deliverables: string;
  structuralFocus: string;
  outputEmphasis: string[];
};

export type EngagementTypeProfile = {
  key: CanonicalEngagementType;
  label: string;
  description: string;
  tooltip: string;
  depthModifier: string;
  outputEmphasis: string[];
  typicalDurationDays: number;
  typicalInterviewCount: string;
  suggestedSessionMix: Array<{
    captureType: string;
    minSessions: number;
    idealSessions: number;
    description: string;
  }>;
  researchPromptModifier: string;
  questionPromptModifier: string;
};

export const CANONICAL_WORKSHOP_TYPES: readonly CanonicalWorkshopType[] = [
  'TRANSFORMATION',
  'OPERATIONS',
  'AI',
  'GO_TO_MARKET',
  'FINANCE',
] as const;

export const CANONICAL_ENGAGEMENT_TYPES: readonly CanonicalEngagementType[] = [
  'DIAGNOSTIC_BASELINE',
  'DEEP_DIVE',
  'SPRINT',
  'ALIGNMENT',
] as const;

export const WORKSHOP_TYPE_PROFILES: Record<CanonicalWorkshopType, WorkshopTypeProfile> = {
  TRANSFORMATION: {
    key: 'TRANSFORMATION',
    label: 'Transformation',
    description: 'Strategic change, operating model redesign, and future-state definition.',
    tooltip: 'Redesign how the business operates. Defines the future state, identifies what’s holding it back, and sets a clear transformation roadmap.',
    deliverables: 'This workshop will deliver a clear future-state view, the key blockers to change, and a sequenced transformation roadmap.',
    structuralFocus: 'Transformation structure: future-state definition, operating model shifts, strategic dependencies, and change sequencing.',
    outputEmphasis: [
      'Future-state operating model',
      'Transformation priorities',
      'Dependencies and blockers',
      'Sequenced roadmap',
    ],
  },
  OPERATIONS: {
    key: 'OPERATIONS',
    label: 'Operations',
    description: 'Functional diagnosis, bottlenecks, execution quality, and operational improvement.',
    tooltip: 'Fix how the business runs today. Diagnoses operational issues, bottlenecks, and inefficiencies to improve performance and execution.',
    deliverables: 'This workshop will deliver an operational diagnosis, the main bottlenecks and inefficiencies, and the priority actions to improve execution.',
    structuralFocus: 'Operations structure: current execution issues, bottlenecks, root causes, and practical service improvement.',
    outputEmphasis: [
      'Operational bottlenecks',
      'Root causes and workarounds',
      'Execution improvements',
      'Improvement plan',
    ],
  },
  AI: {
    key: 'AI',
    label: 'AI',
    description: 'AI readiness, use-case prioritisation, architecture implications, and implementation direction.',
    tooltip: 'Define how AI should be applied. Identifies where AI can assist, automate, or transform processes, and outlines a practical implementation path.',
    deliverables: 'This workshop will deliver priority AI opportunities, the key readiness and enablement gaps, and a practical implementation path.',
    structuralFocus: 'AI structure: readiness, use-case identification, enablement gaps, and implementation direction.',
    outputEmphasis: [
      'AI readiness assessment',
      'Use-case prioritisation',
      'Architecture and data implications',
      'Implementation roadmap',
    ],
  },
  GO_TO_MARKET: {
    key: 'GO_TO_MARKET',
    label: 'Go-To-Market / Strategy',
    description: 'ICP, positioning, value proposition, commercial strategy, and growth priorities.',
    tooltip: 'Clarify how to grow and compete. Shapes target customers, positioning, and growth strategy to improve market traction and performance.',
    deliverables: 'This workshop will deliver sharper target-customer focus, clearer positioning, and a stronger growth strategy to improve traction and performance.',
    structuralFocus: 'Go-to-market structure: ICP clarity, proposition, market positioning, revenue motions, and growth priorities.',
    outputEmphasis: [
      'ICP and segment clarity',
      'Positioning and proposition',
      'Commercial growth priorities',
      'Go-to-market plan',
    ],
  },
  FINANCE: {
    key: 'FINANCE',
    label: 'Finance / Value Optimisation',
    description: 'Value leakage, cost structure, margin improvement, and financial prioritisation.',
    tooltip: 'Improve financial performance and value. Identifies cost inefficiencies, value leakage, and opportunities to optimise margin and investment.',
    deliverables: 'This workshop will deliver a view of value leakage and cost inefficiency, plus the highest-priority opportunities to improve margin and investment return.',
    structuralFocus: 'Finance structure: value leakage, financial performance, cost-to-serve, and prioritised value improvement.',
    outputEmphasis: [
      'Value leakage assessment',
      'Cost and margin priorities',
      'Financial trade-offs',
      'Value realisation plan',
    ],
  },
};

export const ENGAGEMENT_TYPE_PROFILES: Record<CanonicalEngagementType, EngagementTypeProfile> = {
  DIAGNOSTIC_BASELINE: {
    key: 'DIAGNOSTIC_BASELINE',
    label: 'Diagnostic Baseline',
    description: 'Lighter, directional, current-state baseline.',
    tooltip: 'Quickly establish what’s really going on. Provides a high-level view of current performance, key issues, and priority areas to focus on.',
    depthModifier: 'Diagnostic baseline modifier: establish the current state clearly, identify headline issues, and size the biggest gaps without over-designing the answer.',
    outputEmphasis: [
      'Current-state baseline',
      'Severity-ranked findings',
      'Priority gaps',
      'Near-term quick wins',
    ],
    typicalDurationDays: 2,
    typicalInterviewCount: '30-50',
    suggestedSessionMix: [
      { captureType: 'executive_interview', minSessions: 3, idealSessions: 5, description: 'Senior leadership perspective' },
      { captureType: 'manager_interview', minSessions: 5, idealSessions: 10, description: 'Middle management operational view' },
      { captureType: 'operational_interview', minSessions: 10, idealSessions: 25, description: 'Front-line staff reality' },
      { captureType: 'walkaround', minSessions: 2, idealSessions: 5, description: 'Physical observation and ad-hoc capture' },
    ],
    researchPromptModifier: 'Research for a current-state baseline. Surface benchmark signals, the likely severity of current issues, and where the gap between narrative and operational reality is likely to be widest.',
    questionPromptModifier: 'Design questions to establish current-state truth. Make them evidence-seeking, grounded in day-to-day reality, and useful for scoring severity and maturity today.',
  },
  DEEP_DIVE: {
    key: 'DEEP_DIVE',
    label: 'Deep Dive',
    description: 'Detailed, evidence-heavy, root-cause-oriented diagnosis.',
    tooltip: 'Understand why things are happening. Delivers detailed analysis and root-cause insight to explain problems and define where change is needed.',
    depthModifier: 'Deep dive modifier: go beyond symptoms, surface root causes, dependencies, contradictions, and the operational evidence behind them.',
    outputEmphasis: [
      'Detailed evidence base',
      'Root-cause analysis',
      'Cross-functional dependencies',
      'More complete diagnostic logic',
    ],
    typicalDurationDays: 3,
    typicalInterviewCount: '40-60',
    suggestedSessionMix: [
      { captureType: 'executive_interview', minSessions: 3, idealSessions: 5, description: 'Strategic context and sponsorship view' },
      { captureType: 'manager_interview', minSessions: 6, idealSessions: 12, description: 'Process ownership and dependency view' },
      { captureType: 'operational_interview', minSessions: 15, idealSessions: 30, description: 'Detailed execution reality' },
      { captureType: 'walkaround', minSessions: 3, idealSessions: 8, description: 'Observe work as it happens' },
    ],
    researchPromptModifier: 'Research for a deep dive. Surface evidence-heavy patterns, likely root causes, repeat failure modes, and the structural dependencies that explain current performance.',
    questionPromptModifier: 'Design questions for root-cause depth. Push past symptoms, expose process friction and evidence, and reveal why problems persist.',
  },
  SPRINT: {
    key: 'SPRINT',
    label: 'Sprint',
    description: 'Action-focused, urgent, and execution-oriented.',
    tooltip: 'Move rapidly to action. Focuses on prioritised actions, sequencing, and immediate next steps to drive progress quickly.',
    depthModifier: 'Sprint modifier: keep the structure the same, but bias toward urgency, practical sequencing, owners, and the fastest path to meaningful movement.',
    outputEmphasis: [
      '30/60/90 day priorities',
      'Owner-ready actions',
      'Execution sequencing',
      'Critical blockers to immediate movement',
    ],
    typicalDurationDays: 2,
    typicalInterviewCount: '25-40',
    suggestedSessionMix: [
      { captureType: 'executive_interview', minSessions: 2, idealSessions: 4, description: 'Mandate, urgency, and sponsorship' },
      { captureType: 'manager_interview', minSessions: 5, idealSessions: 10, description: 'Implementation reality and dependencies' },
      { captureType: 'operational_interview', minSessions: 8, idealSessions: 16, description: 'Execution blockers and practical constraints' },
      { captureType: 'walkaround', minSessions: 1, idealSessions: 3, description: 'Quick operational observation' },
    ],
    researchPromptModifier: 'Research for a sprint. Focus on urgency, practical constraints, likely blockers to momentum, and what can realistically move in the next 30/60/90 days.',
    questionPromptModifier: 'Design questions for actionability and speed. Bias toward what can move now, who must own it, and what dependencies will slow delivery.',
  },
  ALIGNMENT: {
    key: 'ALIGNMENT',
    label: 'Alignment',
    description: 'Alignment-focused, only where stakeholder coherence is the core issue.',
    tooltip: 'Get everyone on the same page. Builds shared understanding and agreement on key issues, direction, and priorities across stakeholders.',
    depthModifier: 'Alignment modifier: surface perception gaps, decision-right clarity, stakeholder alignment, and where the room is not operating from shared truth.',
    outputEmphasis: [
      'Alignment gaps',
      'Decision-right clarity',
      'Shared priority setting',
      'Commitment risks',
    ],
    typicalDurationDays: 2,
    typicalInterviewCount: '20-35',
    suggestedSessionMix: [
      { captureType: 'executive_interview', minSessions: 3, idealSessions: 5, description: 'Leadership alignment view' },
      { captureType: 'manager_interview', minSessions: 4, idealSessions: 8, description: 'Cross-functional interpretation and accountability' },
      { captureType: 'operational_interview', minSessions: 6, idealSessions: 12, description: 'Reality of execution alignment' },
      { captureType: 'walkaround', minSessions: 1, idealSessions: 2, description: 'Ground-truth observation' },
    ],
    researchPromptModifier: 'Research for alignment. Surface stakeholder tensions, conflicting signals, organisational fault lines, and where priorities or interpretations are likely to diverge.',
    questionPromptModifier: 'Design questions that surface disagreement, ambiguity, and alignment gaps without turning the session into abstract strategy talk.',
  },
};

const LEGACY_WORKSHOP_TYPE_TO_RUNTIME: Record<string, WorkshopRuntimeType> = {
  SALES: 'SALES',
  STRATEGY: 'TRANSFORMATION',
  CHANGE: 'TRANSFORMATION',
  PROCESS: 'OPERATIONS',
  TEAM: 'OPERATIONS',
  INNOVATION: 'AI',
  CUSTOMER: 'GO_TO_MARKET',
  CULTURE: 'TRANSFORMATION',
  CUSTOM: 'TRANSFORMATION',
};

const LEGACY_ENGAGEMENT_TO_RUNTIME_WORKSHOP: Record<string, CanonicalWorkshopType> = {
  DIAGNOSTIC_BASELINE: 'TRANSFORMATION',
  OPERATIONAL_DEEP_DIVE: 'OPERATIONS',
  AI_ENABLEMENT: 'AI',
  TRANSFORMATION_SPRINT: 'TRANSFORMATION',
  CULTURAL_ALIGNMENT: 'TRANSFORMATION',
  GO_TO_MARKET: 'GO_TO_MARKET',
};

const LEGACY_ENGAGEMENT_TO_RUNTIME_ENGAGEMENT: Record<string, CanonicalEngagementType> = {
  DIAGNOSTIC_BASELINE: 'DIAGNOSTIC_BASELINE',
  OPERATIONAL_DEEP_DIVE: 'DEEP_DIVE',
  AI_ENABLEMENT: 'DEEP_DIVE',
  TRANSFORMATION_SPRINT: 'SPRINT',
  CULTURAL_ALIGNMENT: 'ALIGNMENT',
  GO_TO_MARKET: 'DEEP_DIVE',
};

const CANONICAL_WORKSHOP_SYNONYMS: Record<string, WorkshopRuntimeType> = {
  transformation: 'TRANSFORMATION',
  operations: 'OPERATIONS',
  ai: 'AI',
  go_to_market: 'GO_TO_MARKET',
  go_to_market_strategy: 'GO_TO_MARKET',
  gtm: 'GO_TO_MARKET',
  finance: 'FINANCE',
  value_optimisation: 'FINANCE',
  value_optimization: 'FINANCE',
  sales: 'SALES',
};

const CANONICAL_ENGAGEMENT_SYNONYMS: Record<string, CanonicalEngagementType> = {
  diagnostic_baseline: 'DIAGNOSTIC_BASELINE',
  deep_dive: 'DEEP_DIVE',
  sprint: 'SPRINT',
  alignment: 'ALIGNMENT',
};

export function normalizeWorkshopRuntimeType(value: string | null | undefined): WorkshopRuntimeType | null {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (!normalized) return null;
  if (normalized in LEGACY_WORKSHOP_TYPE_TO_RUNTIME) {
    return LEGACY_WORKSHOP_TYPE_TO_RUNTIME[normalized];
  }
  return CANONICAL_WORKSHOP_SYNONYMS[normalized.toLowerCase()] ?? (normalized === 'SALES' ? 'SALES' : null);
}

export function normalizeCanonicalEngagementType(value: string | null | undefined): CanonicalEngagementType | null {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (!normalized) return null;
  if (normalized in LEGACY_ENGAGEMENT_TO_RUNTIME_ENGAGEMENT) {
    return LEGACY_ENGAGEMENT_TO_RUNTIME_ENGAGEMENT[normalized];
  }
  return CANONICAL_ENGAGEMENT_SYNONYMS[normalized.toLowerCase()] ?? null;
}

export function inferWorkshopRuntimeType(input: {
  workshopType?: string | null;
  engagementType?: string | null;
}): WorkshopRuntimeType {
  const explicitWorkshopType = normalizeWorkshopRuntimeType(input.workshopType);
  if (explicitWorkshopType) return explicitWorkshopType;

  const engagementKey = String(input.engagementType ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (engagementKey && LEGACY_ENGAGEMENT_TO_RUNTIME_WORKSHOP[engagementKey]) {
    return LEGACY_ENGAGEMENT_TO_RUNTIME_WORKSHOP[engagementKey];
  }

  return 'TRANSFORMATION';
}

export function inferCanonicalWorkshopType(input: {
  workshopType?: string | null;
  engagementType?: string | null;
}): CanonicalWorkshopType {
  const runtimeType = inferWorkshopRuntimeType(input);
  return runtimeType === 'SALES' ? 'TRANSFORMATION' : runtimeType;
}

export function inferCanonicalEngagementType(input: {
  engagementType?: string | null;
}): CanonicalEngagementType {
  return normalizeCanonicalEngagementType(input.engagementType) ?? 'DIAGNOSTIC_BASELINE';
}

export function toLegacyStoredWorkshopType(runtimeType: WorkshopRuntimeType): string {
  switch (runtimeType) {
    case 'SALES':
      return 'SALES';
    case 'TRANSFORMATION':
      return 'CHANGE';
    case 'OPERATIONS':
      return 'PROCESS';
    case 'AI':
      return 'INNOVATION';
    case 'GO_TO_MARKET':
      return 'CUSTOMER';
    case 'FINANCE':
      return 'STRATEGY';
  }
}

export function toLegacyStoredEngagementType(value: string | null | undefined): string | null {
  const canonical = normalizeCanonicalEngagementType(value);
  if (!canonical) {
    const normalized = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    return normalized || null;
  }

  switch (canonical) {
    case 'DIAGNOSTIC_BASELINE':
      return 'DIAGNOSTIC_BASELINE';
    case 'DEEP_DIVE':
      return 'OPERATIONAL_DEEP_DIVE';
    case 'SPRINT':
      return 'TRANSFORMATION_SPRINT';
    case 'ALIGNMENT':
      return 'CULTURAL_ALIGNMENT';
  }
}

export function getWorkshopTypeProfile(value: string | null | undefined): WorkshopTypeProfile {
  const key = inferCanonicalWorkshopType({ workshopType: value });
  return WORKSHOP_TYPE_PROFILES[key];
}

export function getEngagementTypeProfile(value: string | null | undefined): EngagementTypeProfile {
  const key = inferCanonicalEngagementType({ engagementType: value });
  return ENGAGEMENT_TYPE_PROFILES[key];
}

export function listCanonicalWorkshopTypes(): Array<{ key: CanonicalWorkshopType; label: string; description: string; tooltip: string; deliverables: string }> {
  return CANONICAL_WORKSHOP_TYPES.map((key) => {
    const profile = WORKSHOP_TYPE_PROFILES[key];
    return {
      key,
      label: profile.label,
      description: profile.description,
      tooltip: profile.tooltip,
      deliverables: profile.deliverables,
    };
  });
}

export function listCanonicalEngagementTypes(): Array<{ key: CanonicalEngagementType; label: string; description: string; tooltip: string }> {
  return CANONICAL_ENGAGEMENT_TYPES.map((key) => {
    const profile = ENGAGEMENT_TYPE_PROFILES[key];
    return { key, label: profile.label, description: profile.description, tooltip: profile.tooltip };
  });
}
