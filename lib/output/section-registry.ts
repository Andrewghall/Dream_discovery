/**
 * Section Registry
 *
 * Defines sections for the Download Report.
 * Sections are filtered by archetype and context, then ordered by priority.
 */

import type { WorkshopArchetype } from './archetype-classifier';

// ================================================================
// Types
// ================================================================

export interface SectionContext {
  hasExecSummary: boolean;
  hasDiscoveryOutput: boolean;
  hasReimagineContent: boolean;
  hasConstraintsContent: boolean;
  hasPotentialSolution: boolean;
  hasCommercialContent: boolean;
  hasCustomerJourney: boolean;
  hasSummaryContent: boolean;
  hasHemisphereData: boolean;
  constraintCount: number;
  enablerCount: number;
}

export interface SectionDefinition {
  id: string;
  title: string;
  dataKey: string;
  priority: number;
  core: boolean;
  when: (archetype: WorkshopArchetype, context: SectionContext) => boolean;
}

// ================================================================
// Registry — sections with conditional rules
// ================================================================

export const SECTION_REGISTRY: SectionDefinition[] = [
  {
    id: 'exec-summary',
    title: 'Executive Summary',
    dataKey: 'execSummary',
    priority: 0,
    core: true,
    when: () => true,
  },
  {
    id: 'discovery',
    title: 'Discovery',
    dataKey: 'discoveryOutput',
    priority: 10,
    core: true,
    when: () => true,
  },
  {
    id: 'reimagine',
    title: 'Reimagine',
    dataKey: 'reimagineContent',
    priority: 20,
    core: false,
    // Compliance workshops skip the aspirational Reimagine section
    when: (archetype) => archetype !== 'compliance_risk_remediation',
  },
  {
    id: 'constraints',
    title: 'Constraints',
    dataKey: 'constraintsContent',
    priority: 30,
    core: true,
    when: () => true,
  },
  {
    id: 'solution',
    title: 'Solution Output',
    dataKey: 'potentialSolution',
    priority: 40,
    core: true,
    when: () => true,
  },
  {
    id: 'hemisphere',
    title: 'Insight Hemisphere',
    dataKey: 'hemisphereData',
    priority: 50,
    core: false,
    when: (_archetype, context) => context.hasHemisphereData,
  },
  {
    id: 'customer-journey',
    title: 'Journey Map',
    dataKey: 'customerJourney',
    priority: 60,
    core: false,
    // Only relevant for customer-facing / operational archetypes
    when: (archetype) =>
      archetype === 'operational_contact_centre_improvement' || archetype === 'hybrid',
  },
  {
    id: 'commercial',
    title: 'Commercial',
    dataKey: 'commercialContent',
    priority: 70,
    core: false,
    when: (_archetype, context) => context.hasCommercialContent,
  },
  {
    id: 'summary',
    title: 'Summary',
    dataKey: 'summaryContent',
    priority: 100,
    core: true,
    when: () => true,
  },
];

// ================================================================
// Output Composer
// ================================================================

/**
 * Returns sections active for the given archetype and context, sorted by priority.
 */
export function composeActiveSections(
  archetype: WorkshopArchetype,
  context: SectionContext,
): SectionDefinition[] {
  return SECTION_REGISTRY
    .filter((s) => s.when(archetype, context))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Builds a SectionContext from scratchpad data.
 */
export function buildSectionContext(
  scratchpadData: Record<string, unknown>,
  hemisphereAvailable: boolean,
  constraintCount = 0,
  enablerCount = 0,
): SectionContext {
  const hasData = (key: string): boolean => {
    const val = scratchpadData[key];
    if (val === null || val === undefined) return false;
    if (typeof val === 'object' && Object.keys(val as object).length === 0) return false;
    return true;
  };

  return {
    hasExecSummary: hasData('execSummary'),
    hasDiscoveryOutput: hasData('discoveryOutput'),
    hasReimagineContent: hasData('reimagineContent'),
    hasConstraintsContent: hasData('constraintsContent'),
    hasPotentialSolution: hasData('potentialSolution'),
    hasCommercialContent: hasData('commercialContent'),
    hasCustomerJourney: hasData('customerJourney'),
    hasSummaryContent: hasData('summaryContent'),
    hasHemisphereData: hemisphereAvailable,
    constraintCount,
    enablerCount,
  };
}
