/**
 * Workshop Dimensions — Central getter module
 *
 * Every consumer that needs journey stages or domain/dimension names
 * calls these functions instead of importing hardcoded constants.
 *
 * When a workshop has research with industryDimensions and journeyStages,
 * those are used. Otherwise, the hardcoded defaults (current 5 domains +
 * generic 6 journey stages) are returned.
 *
 * This is the SINGLE SOURCE OF TRUTH for "what dimensions does this workshop use?"
 */

import type { WorkshopPrepResearch, IndustryDimension, JourneyStageResearch } from './agents/agent-types';
import {
  CANONICAL_LENSES,
  canonicalizeLensName,
} from '@/lib/workshop/canonical-lenses';

// ══════════════════════════════════════════════════════════════
// DEFAULT FALLBACKS — current hardcoded values
// ══════════════════════════════════════════════════════════════

export const DEFAULT_DIMENSIONS: IndustryDimension[] = CANONICAL_LENSES.map((lens) => ({
  name: lens.name,
  description: lens.description,
  keywords: [...lens.keywords],
  color: lens.color,
}));

export const DEFAULT_JOURNEY_STAGES: string[] = [
  'Discovery', 'Engagement', 'Commitment', 'Fulfilment', 'Support', 'Growth',
];

// ══════════════════════════════════════════════════════════════
// GETTERS — research-first, defaults as fallback
// ══════════════════════════════════════════════════════════════

/**
 * Get the full dimension objects for a workshop.
 * The lens structure is always canonical.
 * Research may enrich descriptions and keywords, but it may not add, remove,
 * rename, or substitute workshop lenses.
 */
export function getWorkshopDimensions(
  research: WorkshopPrepResearch | null | undefined,
): IndustryDimension[] {
  const researchByLens = new Map<string, IndustryDimension>();
  for (const dimension of research?.industryDimensions ?? []) {
    const canonicalName = canonicalizeLensName(dimension.name);
    if (!canonicalName) continue;
    researchByLens.set(canonicalName, dimension);
  }

  return DEFAULT_DIMENSIONS.map((dimension) => {
    const researchDimension = researchByLens.get(dimension.name);
    if (!researchDimension) return dimension;

    const mergedKeywords = new Set([
      ...dimension.keywords,
      ...(Array.isArray(researchDimension.keywords) ? researchDimension.keywords : []),
    ]);

    return {
      ...dimension,
      description: researchDimension.description?.trim() || dimension.description,
      keywords: Array.from(mergedKeywords).filter(Boolean),
    };
  });
}

/**
 * Get just the dimension names (for tool enums, prompt sections, etc.).
 */
export function getDimensionNames(
  research: WorkshopPrepResearch | null | undefined,
): string[] {
  return getWorkshopDimensions(research).map(d => d.name);
}

/**
 * Build a color map for lens/dimension rendering.
 * Returns the same shape as the current LENS_COLORS for backward compatibility.
 */
export function getDimensionColors(
  research: WorkshopPrepResearch | null | undefined,
): Record<string, { bg: string; text: string; accent: string; label: string }> {
  const dims = getWorkshopDimensions(research);
  const colors: Record<string, { bg: string; text: string; accent: string; label: string }> = {};

  for (const d of dims) {
    colors[d.name] = {
      bg: d.color,
      text: darkenHex(d.color),
      accent: lightenHex(d.color),
      label: d.name,
    };
  }

  // Always include General fallback
  colors['General'] = { bg: '#e2e8f0', text: '#1e293b', accent: '#cbd5e1', label: 'Explore' };

  return colors;
}

/**
 * Get journey stage names for a workshop.
 * Research-driven if available, otherwise the 6 generic defaults.
 */
export function getJourneyStages(
  research: WorkshopPrepResearch | null | undefined,
): string[] {
  if (research?.journeyStages?.length) return research.journeyStages.map(s => s.name);
  return DEFAULT_JOURNEY_STAGES;
}

/**
 * Get full journey stage research objects (with descriptions + touchpoints).
 * Returns null if no research-driven stages exist.
 */
export function getJourneyStageDetails(
  research: WorkshopPrepResearch | null | undefined,
): JourneyStageResearch[] | null {
  if (research?.journeyStages?.length) return research.journeyStages;
  return null;
}

/**
 * Build the ## Dimensions prompt section for GPT system prompts.
 * Uses research dimensions with descriptions when available.
 */
export function buildDomainPromptSection(
  research: WorkshopPrepResearch | null | undefined,
): string {
  const dims = getWorkshopDimensions(research);
  return '## Dimensions\n' + dims.map(d => `- ${d.name}: ${d.description}`).join('\n');
}

/**
 * Build keyword-to-dimension regex map for automatic utterance classification.
 * When research provides dimension keywords, those are used.
 * Otherwise falls back to the hardcoded patterns.
 */
export function buildKeywordDimensionMap(
  research: WorkshopPrepResearch | null | undefined,
): Array<[string, RegExp]> {
  const dims = getWorkshopDimensions(research);
  return dims.map(d => [
    d.name,
    new RegExp(`\\b(${d.keywords.map(escapeRegex).join('|')})`, 'i'),
  ] as [string, RegExp]);
}

// ══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Darken a hex color by mixing with black.
 * Used for text color on colored backgrounds.
 */
export function darkenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const factor = 0.3;
  return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`;
}

/**
 * Lighten a hex color by mixing with white.
 * Used for accent/border colors.
 */
export function lightenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const factor = 0.7;
  return `#${Math.round(r + (255 - r) * factor).toString(16).padStart(2, '0')}${Math.round(g + (255 - g) * factor).toString(16).padStart(2, '0')}${Math.round(b + (255 - b) * factor).toString(16).padStart(2, '0')}`;
}
