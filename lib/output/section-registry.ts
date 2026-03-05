/**
 * Section Registry
 *
 * Defines the available output sections and their inclusion rules.
 * The output composer uses the archetype classification + section context
 * to determine which tabs appear in the scratchpad dashboard.
 *
 * Each section has:
 *  - A stable ID that maps to the scratchpad data field
 *  - A display title for the tab
 *  - A priority (lower = shown first)
 *  - A core flag (always included regardless of archetype)
 *  - A when() predicate for conditional inclusion
 */

import type { WorkshopArchetype } from './archetype-classifier';

// ================================================================
// Types
// ================================================================

export interface SectionContext {
  /** Whether the scratchpad has any data in this field */
  hasExecSummary: boolean;
  hasDiscoveryOutput: boolean;
  hasReimagineContent: boolean;
  hasConstraintsContent: boolean;
  hasPotentialSolution: boolean;
  hasCommercialContent: boolean;
  hasCustomerJourney: boolean;
  hasSummaryContent: boolean;
  hasHemisphereData: boolean;

  /** Counts from the classifier input */
  constraintCount: number;
  enablerCount: number;
}

export interface SectionDefinition {
  id: string;
  title: string;
  /** Maps to the ScratchpadData field key */
  dataKey: string;
  priority: number;
  /** Core sections are always shown regardless of archetype */
  core: boolean;
  /** Returns true if this section should be included */
  when: (archetype: WorkshopArchetype, context: SectionContext) => boolean;
}

// ================================================================
// Registry
// ================================================================

/**
 * Master section registry. Priority determines tab order (ascending).
 * Core sections appear for all archetypes. Non-core sections use the
 * when() predicate to determine visibility.
 */
export const SECTION_REGISTRY: SectionDefinition[] = [
  {
    id: 'exec-summary',
    title: 'Exec Summary',
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
    when: (archetype, ctx) => {
      // Reimagine is relevant for all archetypes except pure compliance remediation
      if (archetype === 'compliance_risk_remediation') return false;
      return ctx.hasReimagineContent;
    },
  },
  {
    id: 'constraints',
    title: 'Constraints',
    dataKey: 'constraintsContent',
    priority: 30,
    core: false,
    when: (_archetype, ctx) => {
      return ctx.constraintCount > 0 || ctx.hasConstraintsContent;
    },
  },
  {
    id: 'solution',
    title: 'Solution',
    dataKey: 'potentialSolution',
    priority: 40,
    core: false,
    when: (archetype, ctx) => {
      // Solution tab most relevant for agentic blueprints and hybrid
      if (archetype === 'agentic_tooling_blueprint' || archetype === 'hybrid') return true;
      return ctx.hasPotentialSolution;
    },
  },
  {
    id: 'commercial',
    title: 'Commercial',
    dataKey: 'commercialContent',
    priority: 50,
    core: false,
    when: (_archetype, ctx) => {
      return ctx.hasCommercialContent;
    },
  },
  {
    id: 'customer-journey',
    title: 'Journey Map',
    dataKey: 'customerJourney',
    priority: 60,
    core: false,
    when: (archetype, ctx) => {
      // Journey map most relevant for operational and hybrid archetypes
      if (!ctx.hasCustomerJourney) return false;
      return archetype === 'operational_contact_centre_improvement' || archetype === 'hybrid';
    },
  },
  {
    id: 'hemisphere',
    title: 'Hemisphere',
    dataKey: '_hemisphere',
    priority: 65,
    core: false,
    when: (_archetype, ctx) => {
      return ctx.hasHemisphereData;
    },
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
 * Computes the active sections for the output dashboard based on
 * the workshop archetype and available data context.
 *
 * Returns sections sorted by priority (ascending), with core sections
 * always included and conditional sections filtered by their when() predicate.
 */
export function composeActiveSections(
  archetype: WorkshopArchetype,
  context: SectionContext,
): SectionDefinition[] {
  return SECTION_REGISTRY
    .filter((section) => section.core || section.when(archetype, context))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Builds a SectionContext from scratchpad data.
 * Checks each field for non-null, non-empty content.
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
