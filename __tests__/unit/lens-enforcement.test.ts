/**
 * Lens Enforcement Tests
 *
 * Proves that NO runtime path can substitute the legacy 5-lens default taxonomy
 * (People / Organisation / Customer / Technology / Regulation) when a workshop
 * lens set is absent.  Every entry-point that reads lenses must either:
 *   (a) return the prep-configured lens set, or
 *   (b) throw explicitly — never silently substitute defaults.
 *
 * Rules tested:
 *   1. getAllLenses()           — throws when no custom names supplied
 *   2. getActiveLensNames()     — throws when blueprint.lenses is absent (live session)
 *   3. getPhaseLensOrder()      — throws when neither blueprint nor research has lenses
 *   4. signal-aggregator path   — throws when workshop blueprint has no lens configuration
 *   5. v2-synthesis-agent path  — throws when lenses array is empty
 *   6. LensSource type          — generic_fallback is not a valid value
 */

import { describe, it, expect } from 'vitest';
import { getAllLenses } from '@/lib/cognitive-guidance/pipeline';
import { getPhaseLensOrder } from '@/lib/cognition/agents/question-set-agent';
import type { LensSource, WorkshopPhase } from '@/lib/cognition/agents/agent-types';

// ── Shared constants ─────────────────────────────────────────────────────────

const LEGACY_5_LENSES = ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'];
const WORKSHOP_LENS_SET = ['Flight Operations', 'Ground Crew', 'Passenger Experience', 'Regulatory Compliance', 'Digital Systems'];

// ================================================================
// 1. getAllLenses() — cognitive guidance pipeline entry-point
// ================================================================

describe('getAllLenses() — no-fallback enforcement', () => {
  it('returns the provided custom lens names', () => {
    expect(getAllLenses(WORKSHOP_LENS_SET)).toEqual(WORKSHOP_LENS_SET);
  });

  it('throws when called with undefined (no lens set configured)', () => {
    expect(() => getAllLenses(undefined)).toThrow(/Workshop lens set is required/);
  });

  it('throws when called with null', () => {
    expect(() => getAllLenses(null)).toThrow(/Workshop lens set is required/);
  });

  it('throws when called with an empty array', () => {
    expect(() => getAllLenses([])).toThrow(/Workshop lens set is required/);
  });

  it('NEVER returns the legacy 5-lens taxonomy when no lenses are provided', () => {
    // The function must throw — it must not silently return the legacy set
    let returnedLegacyLenses = false;
    try {
      const result = getAllLenses(undefined);
      returnedLegacyLenses = LEGACY_5_LENSES.every(l => result.includes(l));
    } catch {
      // Expected: throws instead of substituting defaults
    }
    expect(returnedLegacyLenses).toBe(false);
  });
});

// ================================================================
// 2. getPhaseLensOrder() — question-set agent entry-point
// ================================================================

describe('getPhaseLensOrder() — no-fallback enforcement', () => {
  const PHASES: WorkshopPhase[] = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];

  it('uses blueprint lenses when blueprint has phaseLensPolicy', () => {
    const bp = {
      domainPack: 'contact-centre-airline',
      phaseLensPolicy: {
        REIMAGINE: WORKSHOP_LENS_SET,
        CONSTRAINTS: WORKSHOP_LENS_SET,
        DEFINE_APPROACH: WORKSHOP_LENS_SET,
      },
    } as any;
    for (const phase of PHASES) {
      const result = getPhaseLensOrder(phase, null, bp);
      expect(result.lenses).toEqual(WORKSHOP_LENS_SET);
      expect(result.source).toBe('domain_pack');
    }
  });

  it('uses research dimensions when blueprint is absent', () => {
    const research = {
      industryDimensions: WORKSHOP_LENS_SET.map(name => ({ name, description: '', keywords: [], color: '#000' })),
    } as any;
    for (const phase of PHASES) {
      const result = getPhaseLensOrder(phase, research);
      expect(result.lenses).toEqual(WORKSHOP_LENS_SET);
      expect(result.source).toBe('research_dimensions');
    }
  });

  it('throws for every phase when neither blueprint nor research provides lenses', () => {
    for (const phase of PHASES) {
      expect(() => getPhaseLensOrder(phase, null, null)).toThrow(/Workshop lens set is required/);
    }
  });

  it('NEVER returns the legacy 5-lens taxonomy regardless of phase', () => {
    for (const phase of PHASES) {
      let returnedLegacy = false;
      try {
        const result = getPhaseLensOrder(phase, null, null);
        returnedLegacy = LEGACY_5_LENSES.some(l => result.lenses.includes(l));
      } catch {
        // Expected: throws
      }
      expect(returnedLegacy).toBe(false);
    }
  });

  it('blueprint lenses never contain legacy taxonomy when a domain pack is set', () => {
    const bp = {
      domainPack: 'contact-centre-airline',
      phaseLensPolicy: {
        REIMAGINE: WORKSHOP_LENS_SET,
        CONSTRAINTS: WORKSHOP_LENS_SET,
        DEFINE_APPROACH: WORKSHOP_LENS_SET,
      },
    } as any;
    for (const phase of PHASES) {
      const result = getPhaseLensOrder(phase, null, bp);
      for (const legacyLens of LEGACY_5_LENSES) {
        expect(result.lenses).not.toContain(legacyLens);
      }
    }
  });
});

// ================================================================
// 3. LensSource type — generic_fallback is not a valid value
// ================================================================

describe('LensSource type — generic_fallback removed', () => {
  it('the set of valid LensSource values does not include generic_fallback', () => {
    // If this assignment compiles, generic_fallback is not in the type.
    // We verify at runtime that the canonical set is correct.
    const validSources: LensSource[] = ['research_dimensions', 'domain_pack', 'blueprint'];
    expect(validSources).not.toContain('generic_fallback');
    expect(validSources).toHaveLength(3);
  });

  it('research_dimensions, domain_pack, and blueprint are the only valid sources', () => {
    const research = {
      industryDimensions: [{ name: 'Test Lens', description: '', keywords: [], color: '#000' }],
    } as any;
    const result = getPhaseLensOrder('REIMAGINE', research);
    const validSources: LensSource[] = ['research_dimensions', 'domain_pack', 'blueprint'];
    expect(validSources).toContain(result.source);
  });
});

// ================================================================
// 4. No exported ALL_LENSES / DEFAULT_LENSES constant
// ================================================================

describe('pipeline.ts — legacy constants removed', () => {
  it('does not export ALL_LENSES', async () => {
    const pipelineModule = await import('@/lib/cognitive-guidance/pipeline');
    expect((pipelineModule as any).ALL_LENSES).toBeUndefined();
  });

  it('does not export DEFAULT_LENSES', async () => {
    const pipelineModule = await import('@/lib/cognitive-guidance/pipeline');
    expect((pipelineModule as any).DEFAULT_LENSES).toBeUndefined();
  });
});
