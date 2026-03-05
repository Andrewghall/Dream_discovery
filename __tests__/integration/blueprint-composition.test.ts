/**
 * Tests for blueprint generation correctness by workshop style.
 *
 * Verifies that composeBlueprint() produces correct output for different
 * combinations of domain pack, engagement type, dream track, and industry.
 */

import { describe, it, expect } from 'vitest';
import {
  composeBlueprint,
  DEFAULT_BLUEPRINT,
  readBlueprintFromJson,
  getBlueprint,
  WorkshopBlueprintSchema,
  type ComposeInput,
  type WorkshopBlueprint,
} from '@/lib/workshop/blueprint';

// ── Helpers ──────────────────────────────────────────────────

function makeInput(overrides: Partial<ComposeInput> = {}): ComposeInput {
  return {
    industry: null,
    dreamTrack: null,
    engagementType: null,
    domainPack: null,
    purpose: null,
    outcomes: null,
    ...overrides,
  };
}

// ── DEFAULT_BLUEPRINT sanity ─────────────────────────────────

describe('DEFAULT_BLUEPRINT', () => {
  it('passes Zod validation', () => {
    const result = WorkshopBlueprintSchema.safeParse(DEFAULT_BLUEPRINT);
    expect(result.success).toBe(true);
  });

  it('has 5 default lenses', () => {
    expect(DEFAULT_BLUEPRINT.lenses.length).toBeGreaterThanOrEqual(5);
    const names = DEFAULT_BLUEPRINT.lenses.map((l) => l.name);
    expect(names).toContain('People');
    expect(names).toContain('Customer');
  });

  it('has REIMAGINE restricted to 3 lenses', () => {
    expect(DEFAULT_BLUEPRINT.phaseLensPolicy.REIMAGINE).toHaveLength(3);
    expect(DEFAULT_BLUEPRINT.phaseLensPolicy.REIMAGINE).toContain('People');
    expect(DEFAULT_BLUEPRINT.phaseLensPolicy.REIMAGINE).toContain('Customer');
    expect(DEFAULT_BLUEPRINT.phaseLensPolicy.REIMAGINE).toContain('Organisation');
  });

  it('has safe question policy defaults', () => {
    expect(DEFAULT_BLUEPRINT.questionPolicy.questionsPerPhase).toBe(5);
    expect(DEFAULT_BLUEPRINT.questionPolicy.subQuestionsPerMain).toBe(3);
    expect(DEFAULT_BLUEPRINT.questionPolicy.coverageThresholdPercent).toBe(70);
  });

  it('has agent chain with 7 agents', () => {
    expect(DEFAULT_BLUEPRINT.agentChain.length).toBe(7);
    const ids = DEFAULT_BLUEPRINT.agentChain.map((a) => a.agentId);
    expect(ids).toContain('research');
    expect(ids).toContain('question_set');
    expect(ids).toContain('facilitation_orchestrator');
  });

  it('has empty actor taxonomy (populated by domain pack)', () => {
    expect(DEFAULT_BLUEPRINT.actorTaxonomy).toHaveLength(0);
  });
});

// ── composeBlueprint: no overrides (bare defaults) ───────────

describe('composeBlueprint with no overrides', () => {
  it('returns valid blueprint', () => {
    const bp = composeBlueprint(makeInput());
    const result = WorkshopBlueprintSchema.safeParse(bp);
    expect(result.success).toBe(true);
  });

  it('sets identity fields to null', () => {
    const bp = composeBlueprint(makeInput());
    expect(bp.industry).toBeNull();
    expect(bp.dreamTrack).toBeNull();
    expect(bp.engagementType).toBeNull();
    expect(bp.domainPack).toBeNull();
  });

  it('stamps composedAtMs', () => {
    const before = Date.now();
    const bp = composeBlueprint(makeInput());
    expect(bp.composedAtMs).toBeGreaterThanOrEqual(before);
  });
});

// ── composeBlueprint: contact_centre domain pack ─────────────

describe('composeBlueprint with contact_centre pack', () => {
  const bp = composeBlueprint(makeInput({ domainPack: 'contact_centre' }));

  it('returns valid blueprint', () => {
    const result = WorkshopBlueprintSchema.safeParse(bp);
    expect(result.success).toBe(true);
  });

  it('sets domainPack field', () => {
    expect(bp.domainPack).toBe('contact_centre');
  });

  it('includes domain-specific lenses', () => {
    const names = bp.lenses.map((l) => l.name);
    expect(names).toContain('People');
    expect(names).toContain('Customer');
  });

  it('lenses have colors from workshop-dimensions', () => {
    for (const lens of bp.lenses) {
      expect(lens.color).toBeTruthy();
      expect(lens.color).toMatch(/^#/);
    }
  });

  it('populates actor taxonomy from pack', () => {
    expect(bp.actorTaxonomy.length).toBeGreaterThan(0);
    const keys = bp.actorTaxonomy.map((a) => a.key);
    expect(keys).toContain('team_leader');
    expect(keys).toContain('agent');
  });

  it('REIMAGINE excludes Technology and Regulation', () => {
    expect(bp.phaseLensPolicy.REIMAGINE).not.toContain('Technology');
    expect(bp.phaseLensPolicy.REIMAGINE).not.toContain('Regulation');
  });

  it('CONSTRAINTS includes all lenses', () => {
    const lensNames = bp.lenses.map((l) => l.name);
    for (const name of lensNames) {
      expect(bp.phaseLensPolicy.CONSTRAINTS).toContain(name);
    }
  });

  it('DEFINE_APPROACH includes all lenses', () => {
    const lensNames = bp.lenses.map((l) => l.name);
    for (const name of lensNames) {
      expect(bp.phaseLensPolicy.DEFINE_APPROACH).toContain(name);
    }
  });
});

// ── composeBlueprint: customer_engagement domain pack ────────

describe('composeBlueprint with customer_engagement pack', () => {
  const bp = composeBlueprint(makeInput({ domainPack: 'customer_engagement' }));

  it('returns valid blueprint', () => {
    expect(WorkshopBlueprintSchema.safeParse(bp).success).toBe(true);
  });

  it('sets domainPack to customer_engagement', () => {
    expect(bp.domainPack).toBe('customer_engagement');
  });

  it('has customer_engagement-specific actors', () => {
    const keys = bp.actorTaxonomy.map((a) => a.key);
    expect(keys).toContain('journey_owner');
  });
});

// ── composeBlueprint: engagement type overrides ──────────────

describe('composeBlueprint with engagement types', () => {
  it('diagnostic_baseline sets diagnosticFocus', () => {
    const bp = composeBlueprint(makeInput({ engagementType: 'diagnostic_baseline' }));
    expect(bp.diagnosticFocus).toBeTruthy();
    expect(bp.outputEmphasis.length).toBeGreaterThan(0);
  });

  it('ai_enablement sets AI-specific output emphasis', () => {
    const bp = composeBlueprint(makeInput({ engagementType: 'ai_enablement' }));
    expect(bp.diagnosticFocus).toBeTruthy();
    expect(bp.outputEmphasis.length).toBeGreaterThan(0);
  });

  it('operational_deep_dive overrides data requirements', () => {
    const bp = composeBlueprint(makeInput({ engagementType: 'operational_deep_dive' }));
    expect(bp.dataRequirements.typicalDurationDays).toBeGreaterThan(0);
    expect(bp.dataRequirements.sessionMix.length).toBeGreaterThan(0);
  });

  it('unknown engagement type keeps defaults', () => {
    const bp = composeBlueprint(makeInput({ engagementType: 'nonexistent_type' }));
    expect(bp.diagnosticFocus).toBeNull();
    expect(bp.dataRequirements.typicalDurationDays).toBe(DEFAULT_BLUEPRINT.dataRequirements.typicalDurationDays);
  });
});

// ── composeBlueprint: combined pack + engagement type ────────

describe('composeBlueprint with domain pack + engagement type', () => {
  it('domain pack actors + engagement type data requirements', () => {
    const bp = composeBlueprint(makeInput({
      domainPack: 'contact_centre',
      engagementType: 'ai_enablement',
    }));

    // Actors from domain pack
    const actorKeys = bp.actorTaxonomy.map((a) => a.key);
    expect(actorKeys).toContain('agent');

    // Data requirements from engagement type
    expect(bp.diagnosticFocus).toBeTruthy();
    expect(bp.outputEmphasis.length).toBeGreaterThan(0);
  });

  it('identity scalars override both', () => {
    const bp = composeBlueprint(makeInput({
      domainPack: 'contact_centre',
      engagementType: 'operational_deep_dive',
      industry: 'Financial Services',
      dreamTrack: 'DOMAIN',
      purpose: 'Improve CX in banking',
    }));

    expect(bp.industry).toBe('Financial Services');
    expect(bp.dreamTrack).toBe('DOMAIN');
    expect(bp.purpose).toBe('Improve CX in banking');
  });
});

// ── composeBlueprint: DOMAIN track ───────────────────────────

describe('composeBlueprint with DOMAIN track', () => {
  it('sets dreamTrack field', () => {
    const bp = composeBlueprint(makeInput({ dreamTrack: 'DOMAIN' }));
    expect(bp.dreamTrack).toBe('DOMAIN');
  });

  it('ENTERPRISE track sets dreamTrack', () => {
    const bp = composeBlueprint(makeInput({ dreamTrack: 'ENTERPRISE' }));
    expect(bp.dreamTrack).toBe('ENTERPRISE');
  });
});

// ── readBlueprintFromJson ────────────────────────────────────

describe('readBlueprintFromJson', () => {
  it('returns null for null', () => {
    expect(readBlueprintFromJson(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(readBlueprintFromJson(undefined)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(readBlueprintFromJson({ version: 'bad' })).toBeNull();
  });

  it('parses valid blueprint JSON', () => {
    const bp = composeBlueprint(makeInput({ domainPack: 'contact_centre' }));
    const parsed = readBlueprintFromJson(JSON.parse(JSON.stringify(bp)));
    expect(parsed).not.toBeNull();
    expect(parsed!.domainPack).toBe('contact_centre');
  });
});

// ── getBlueprint ─────────────────────────────────────────────

describe('getBlueprint', () => {
  it('returns default for null', () => {
    const bp = getBlueprint(null);
    expect(bp.version).toBe(1);
    expect(bp.composedAtMs).toBeGreaterThan(0);
  });

  it('returns parsed blueprint for valid JSON', () => {
    const original = composeBlueprint(makeInput({ domainPack: 'contact_centre' }));
    const bp = getBlueprint(JSON.parse(JSON.stringify(original)));
    expect(bp.domainPack).toBe('contact_centre');
  });

  it('falls back to default for invalid JSON', () => {
    const bp = getBlueprint({ broken: true });
    expect(bp.version).toBe(1);
    expect(bp.domainPack).toBeNull();
  });
});

// ── Validation: all domain packs produce valid blueprints ────

describe('all domain packs produce valid blueprints', () => {
  const packs = ['contact_centre', 'customer_engagement', 'hr_people', 'sales', 'compliance'];

  for (const pack of packs) {
    it(`${pack} produces a valid blueprint`, () => {
      const bp = composeBlueprint(makeInput({ domainPack: pack }));
      const result = WorkshopBlueprintSchema.safeParse(bp);
      expect(result.success).toBe(true);
      expect(bp.domainPack).toBe(pack);
      expect(bp.actorTaxonomy.length).toBeGreaterThan(0);
      expect(bp.lenses.length).toBeGreaterThan(0);
    });
  }
});

// ── Validation: all engagement types produce valid blueprints ──

describe('all engagement types produce valid blueprints', () => {
  const types = ['diagnostic_baseline', 'operational_deep_dive', 'ai_enablement', 'transformation_sprint', 'cultural_alignment'];

  for (const et of types) {
    it(`${et} produces a valid blueprint`, () => {
      const bp = composeBlueprint(makeInput({ engagementType: et }));
      const result = WorkshopBlueprintSchema.safeParse(bp);
      expect(result.success).toBe(true);
      expect(bp.diagnosticFocus).toBeTruthy();
      expect(bp.dataRequirements.sessionMix.length).toBeGreaterThan(0);
    });
  }
});

// ── Cross-product: all packs * all engagement types ──────────

describe('cross-product: all domain packs x engagement types', () => {
  const packs = ['contact_centre', 'customer_engagement', 'hr_people', 'sales', 'compliance'];
  const types = ['diagnostic_baseline', 'operational_deep_dive', 'ai_enablement'];

  for (const pack of packs) {
    for (const et of types) {
      it(`${pack} + ${et} produces a valid blueprint`, () => {
        const bp = composeBlueprint(makeInput({ domainPack: pack, engagementType: et }));
        expect(WorkshopBlueprintSchema.safeParse(bp).success).toBe(true);
        expect(bp.domainPack).toBe(pack);
        expect(bp.diagnosticFocus).toBeTruthy();
      });
    }
  }
});
