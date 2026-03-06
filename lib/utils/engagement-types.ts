import type { EngagementType } from '@prisma/client';

const VALID_ENGAGEMENT_TYPES: EngagementType[] = [
  'DIAGNOSTIC_BASELINE',
  'OPERATIONAL_DEEP_DIVE',
  'AI_ENABLEMENT',
  'TRANSFORMATION_SPRINT',
  'CULTURAL_ALIGNMENT',
];

/**
 * Safely coerce an unknown value to a valid EngagementType enum member.
 * Accepts both exact enum values and UI-style keys (e.g. "operational_deep_dive").
 * Returns null for any unrecognised value.
 */
export function toEngagementEnum(value: unknown): EngagementType | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().toUpperCase();
  if (VALID_ENGAGEMENT_TYPES.includes(normalized as EngagementType)) {
    return normalized as EngagementType;
  }
  // Accept UI keys like "operational_deep_dive"
  const fromKey = normalized.replace(/[^A-Z0-9_]/g, '_');
  if (VALID_ENGAGEMENT_TYPES.includes(fromKey as EngagementType)) {
    return fromKey as EngagementType;
  }
  return null;
}
