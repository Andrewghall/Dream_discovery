import type { DomainPack, EngagementVariant } from './registry';
import { INDUSTRY_PACKS } from './industry-packs';

/**
 * Resolve the appropriate domain pack for a given industry + engagement type + dream track.
 * Returns the industry-specific pack if found, otherwise falls back to legacy packs.
 */
export function resolveIndustryPack(
  industry: string | null | undefined,
  engagementType: string | null | undefined,
  dreamTrack: string | null | undefined,
): DomainPack | null {
  if (!industry) return null;

  const key = industryToPackKey(industry);
  const pack = INDUSTRY_PACKS[key];
  if (!pack) return null;

  // If engagement type has variant overrides, apply them
  if (engagementType && pack.engagementVariants) {
    const variant = pack.engagementVariants[engagementType.toLowerCase()];
    if (variant) {
      return applyEngagementVariant(pack, variant);
    }
  }

  return pack;
}

function applyEngagementVariant(pack: DomainPack, variant: EngagementVariant): DomainPack {
  // Canonical lens structure is fixed platform-wide.
  // Engagement variants may still carry practitioner notes, but they must not
  // alter the lens array at runtime.
  return { ...pack, engagementVariants: pack.engagementVariants };
}

/**
 * Map industry string to pack key.
 */
export function industryToPackKey(industry: string): string {
  const map: Record<string, string> = {
    'airline & aviation': 'airline_aviation',
    'agriculture & environmental': 'agriculture_environmental',
    'automotive & mobility': 'automotive_mobility',
    'bpo & outsourcing': 'bpo_outsourcing',
    'construction & facilities': 'construction_facilities',
    'education': 'education',
    'energy & utilities': 'energy_utilities',
    'financial services': 'financial_services',
    'healthcare': 'healthcare',
    'home services': 'home_services',
    'manufacturing': 'manufacturing',
    'media & entertainment': 'media_entertainment',
    'professional services': 'professional_services',
    'public sector': 'public_sector',
    'real estate & property': 'real_estate_property',
    'retail': 'retail',
    'technology': 'technology',
    'telecommunications': 'telecommunications',
    'transport & logistics': 'transport_logistics',
    'waste management': 'waste_management',
  };
  return map[industry.toLowerCase()] ?? industry.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
