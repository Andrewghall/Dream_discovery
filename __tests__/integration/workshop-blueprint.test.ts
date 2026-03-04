/**
 * Workshop Blueprint Tests
 *
 * Covers:
 *  - DEFAULT_BLUEPRINT schema validation and structure
 *  - composeBlueprint with empty, engagement-only, pack-only, and layered inputs
 *  - readBlueprintFromJson for null, invalid, and valid JSON
 *  - getBlueprint fallback behaviour
 */

import { describe, it, expect } from 'vitest';
import {
  composeBlueprint,
  readBlueprintFromJson,
  getBlueprint,
  DEFAULT_BLUEPRINT,
  WorkshopBlueprintSchema,
  type WorkshopBlueprint,
  type ComposeInput,
} from '@/lib/workshop/blueprint';

// ================================================================
// 1. DEFAULT_BLUEPRINT
// ================================================================

describe('DEFAULT_BLUEPRINT', () => {
  it('passes schema validation', () => {
    const patched = { ...DEFAULT_BLUEPRINT, composedAtMs: Date.now() };
    const result = WorkshopBlueprintSchema.safeParse(patched);
    expect(result.success).toBe(true);
  });

  it('has version 1', () => {
    expect(DEFAULT_BLUEPRINT.version).toBe(1);
  });

  it('has 5 default lenses', () => {
    expect(DEFAULT_BLUEPRINT.lenses).toHaveLength(5);
    const names = DEFAULT_BLUEPRINT.lenses.map((l) => l.name);
    expect(names).toContain('People');
    expect(names).toContain('Operations');
    expect(names).toContain('Customer');
    expect(names).toContain('Technology');
    expect(names).toContain('Regulation');
  });

  it('each lens has keywords and a colour', () => {
    for (const lens of DEFAULT_BLUEPRINT.lenses) {
      expect(lens.keywords.length).toBeGreaterThan(0);
      expect(lens.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('has 6 default journey stages', () => {
    expect(DEFAULT_BLUEPRINT.journeyStages).toHaveLength(6);
    expect(DEFAULT_BLUEPRINT.journeyStages[0].name).toBe('Discovery');
    expect(DEFAULT_BLUEPRINT.journeyStages[5].name).toBe('Growth');
  });

  it('REIMAGINE lens policy is limited to 3 lenses', () => {
    expect(DEFAULT_BLUEPRINT.phaseLensPolicy.REIMAGINE).toHaveLength(3);
    expect(DEFAULT_BLUEPRINT.phaseLensPolicy.REIMAGINE).not.toContain('Technology');
    expect(DEFAULT_BLUEPRINT.phaseLensPolicy.REIMAGINE).not.toContain('Regulation');
  });

  it('CONSTRAINTS and DEFINE_APPROACH use all 5 lenses', () => {
    expect(DEFAULT_BLUEPRINT.phaseLensPolicy.CONSTRAINTS).toHaveLength(5);
    expect(DEFAULT_BLUEPRINT.phaseLensPolicy.DEFINE_APPROACH).toHaveLength(5);
  });

  it('has empty actor taxonomy by default', () => {
    expect(DEFAULT_BLUEPRINT.actorTaxonomy).toHaveLength(0);
  });

  it('has 7 agent chain entries', () => {
    expect(DEFAULT_BLUEPRINT.agentChain).toHaveLength(7);
    const ids = DEFAULT_BLUEPRINT.agentChain.map((a) => a.agentId);
    expect(ids).toContain('research');
    expect(ids).toContain('question_set');
    expect(ids).toContain('facilitation_orchestrator');
  });

  it('all agent chain entries are enabled', () => {
    for (const agent of DEFAULT_BLUEPRINT.agentChain) {
      expect(agent.enabled).toBe(true);
    }
  });

  it('has all 7 signal types enabled', () => {
    expect(DEFAULT_BLUEPRINT.signalPolicy.enabledSignalTypes).toHaveLength(7);
    expect(DEFAULT_BLUEPRINT.signalPolicy.enabledSignalTypes).toContain('repeated_theme');
    expect(DEFAULT_BLUEPRINT.signalPolicy.enabledSignalTypes).toContain('risk_cluster');
  });

  it('has 4 finding types enabled', () => {
    expect(DEFAULT_BLUEPRINT.findingPolicy.enabledFindingTypes).toHaveLength(4);
    expect(DEFAULT_BLUEPRINT.findingPolicy.enabledFindingTypes).toContain('CONSTRAINT');
    expect(DEFAULT_BLUEPRINT.findingPolicy.enabledFindingTypes).toContain('OPPORTUNITY');
  });

  it('has empty default question constraints', () => {
    expect(DEFAULT_BLUEPRINT.questionConstraints).toEqual({
      requiredTopics: [],
      forbiddenTopics: [],
      focusAreas: [],
      domainMetrics: [],
    });
  });

  it('pacing values match facilitation-orchestrator constants', () => {
    expect(DEFAULT_BLUEPRINT.pacing.minEmissionIntervalMs).toBe(120_000);
    expect(DEFAULT_BLUEPRINT.pacing.padGenerationIntervalMs).toBe(45_000);
    expect(DEFAULT_BLUEPRINT.pacing.padUtteranceThreshold).toBe(6);
    expect(DEFAULT_BLUEPRINT.pacing.maxVisiblePads).toBe(4);
  });

  it('confidence thresholds are 0.4', () => {
    expect(DEFAULT_BLUEPRINT.confidenceRules.classificationThreshold).toBe(0.4);
    expect(DEFAULT_BLUEPRINT.confidenceRules.beliefStabilisationThreshold).toBe(0.4);
  });
});

// ================================================================
// 2. composeBlueprint
// ================================================================

describe('composeBlueprint', () => {
  const emptyInput: ComposeInput = {
    industry: null,
    dreamTrack: null,
    engagementType: null,
    domainPack: null,
    purpose: null,
    outcomes: null,
  };

  it('returns a valid blueprint with all-null input', () => {
    const bp = composeBlueprint(emptyInput);
    const result = WorkshopBlueprintSchema.safeParse(bp);
    expect(result.success).toBe(true);
    expect(bp.composedAtMs).toBeGreaterThan(0);
  });

  it('preserves workshop identity scalars', () => {
    const bp = composeBlueprint({
      industry: 'Financial Services',
      dreamTrack: 'ENTERPRISE',
      engagementType: null,
      domainPack: null,
      purpose: 'Improve operational efficiency',
      outcomes: 'Actionable transformation roadmap',
    });
    expect(bp.industry).toBe('Financial Services');
    expect(bp.dreamTrack).toBe('ENTERPRISE');
    expect(bp.purpose).toBe('Improve operational efficiency');
    expect(bp.outcomes).toBe('Actionable transformation roadmap');
  });

  it('stamps composedAtMs', () => {
    const before = Date.now();
    const bp = composeBlueprint(emptyInput);
    expect(bp.composedAtMs).toBeGreaterThanOrEqual(before);
  });

  // -- Engagement type overrides --

  it('applies operational_deep_dive engagement type', () => {
    const bp = composeBlueprint({
      ...emptyInput,
      engagementType: 'operational_deep_dive',
    });
    expect(bp.diagnosticFocus).toBeTruthy();
    expect(bp.diagnosticFocus).toContain('Root cause');
    expect(bp.dataRequirements.typicalInterviewCount).toBe('35-55');
    expect(bp.outputEmphasis.length).toBeGreaterThan(0);
  });

  it('applies ai_enablement engagement type', () => {
    const bp = composeBlueprint({
      ...emptyInput,
      engagementType: 'ai_enablement',
    });
    expect(bp.diagnosticFocus).toBeTruthy();
    expect(bp.dataRequirements.typicalInterviewCount).toBe('25-45');
  });

  it('handles uppercase engagement type keys (Prisma enum format)', () => {
    const bp = composeBlueprint({
      ...emptyInput,
      engagementType: 'OPERATIONAL_DEEP_DIVE',
    });
    expect(bp.diagnosticFocus).toBeTruthy();
    expect(bp.diagnosticFocus).toContain('Root cause');
  });

  it('handles unknown engagement type gracefully', () => {
    const bp = composeBlueprint({
      ...emptyInput,
      engagementType: 'nonexistent_type',
    });
    // Falls back to defaults
    expect(bp.diagnosticFocus).toBeNull();
    expect(bp.dataRequirements.typicalInterviewCount).toBe('30-50');
  });

  // -- Domain pack overrides --

  it('applies contact_centre domain pack lenses and actors', () => {
    const bp = composeBlueprint({
      ...emptyInput,
      domainPack: 'contact_centre',
    });
    expect(bp.lenses.length).toBeGreaterThan(0);
    expect(bp.actorTaxonomy.length).toBeGreaterThan(0);
    // Contact centre pack has actors like 'agent', 'team_leader'
    const actorKeys = bp.actorTaxonomy.map((a) => a.key);
    expect(actorKeys.length).toBeGreaterThan(3);
  });

  it('applies enterprise domain pack', () => {
    const bp = composeBlueprint({
      ...emptyInput,
      domainPack: 'enterprise',
    });
    expect(bp.actorTaxonomy.length).toBeGreaterThan(0);
    expect(bp.lenses.length).toBeGreaterThan(0);
  });

  it('handles unknown domain pack gracefully', () => {
    const bp = composeBlueprint({
      ...emptyInput,
      domainPack: 'nonexistent_pack',
    });
    // Falls back to defaults
    expect(bp.lenses).toHaveLength(5);
    expect(bp.actorTaxonomy).toHaveLength(0);
  });

  // -- Layered composition --

  it('layers engagement type + domain pack correctly', () => {
    const bp = composeBlueprint({
      industry: 'Insurance',
      dreamTrack: 'DOMAIN',
      engagementType: 'ai_enablement',
      domainPack: 'contact_centre',
      purpose: 'AI readiness assessment',
      outcomes: 'Use case catalogue and implementation roadmap',
    });
    // Engagement type sets data requirements
    expect(bp.dataRequirements.typicalInterviewCount).toBe('25-45');
    // Domain pack sets actors
    expect(bp.actorTaxonomy.length).toBeGreaterThan(0);
    // Workshop scalars preserved
    expect(bp.industry).toBe('Insurance');
    expect(bp.purpose).toBe('AI readiness assessment');
    // Pacing unchanged (no override source)
    expect(bp.pacing.minEmissionIntervalMs).toBe(120_000);
  });

  // -- Phase lens policy --

  it('updates phase lens policy from domain pack', () => {
    const bp = composeBlueprint({
      ...emptyInput,
      domainPack: 'contact_centre',
    });
    // REIMAGINE should be filtered to people/customer/organisation-like lenses
    expect(bp.phaseLensPolicy.REIMAGINE.length).toBeGreaterThan(0);
    expect(bp.phaseLensPolicy.REIMAGINE.length).toBeLessThanOrEqual(3);
    // CONSTRAINTS and DEFINE_APPROACH should include all pack lenses
    expect(bp.phaseLensPolicy.CONSTRAINTS.length).toBe(bp.lenses.length);
    expect(bp.phaseLensPolicy.DEFINE_APPROACH.length).toBe(bp.lenses.length);
  });
});

// ================================================================
// 3. readBlueprintFromJson
// ================================================================

describe('readBlueprintFromJson', () => {
  it('returns null for null input', () => {
    expect(readBlueprintFromJson(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(readBlueprintFromJson(undefined)).toBeNull();
  });

  it('returns null for invalid JSON shape', () => {
    expect(readBlueprintFromJson({ foo: 'bar' })).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(readBlueprintFromJson({})).toBeNull();
  });

  it('returns valid blueprint from correct JSON', () => {
    const bp = composeBlueprint({
      industry: null,
      dreamTrack: null,
      engagementType: null,
      domainPack: null,
      purpose: null,
      outcomes: null,
    });
    const result = readBlueprintFromJson(bp);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.lenses).toHaveLength(5);
  });

  it('round-trips through JSON serialization', () => {
    const original = composeBlueprint({
      industry: 'Healthcare',
      dreamTrack: 'ENTERPRISE',
      engagementType: 'ai_enablement',
      domainPack: 'contact_centre',
      purpose: 'Test',
      outcomes: 'Test outcomes',
    });
    // Simulate database round-trip
    const json = JSON.parse(JSON.stringify(original));
    const restored = readBlueprintFromJson(json);
    expect(restored).not.toBeNull();
    expect(restored!.industry).toBe('Healthcare');
    expect(restored!.actorTaxonomy.length).toBeGreaterThan(0);
  });
});

// ================================================================
// 4. getBlueprint
// ================================================================

describe('getBlueprint', () => {
  it('returns default shape when given null', () => {
    const bp = getBlueprint(null);
    expect(bp.version).toBe(1);
    expect(bp.lenses).toHaveLength(5);
    expect(bp.composedAtMs).toBeGreaterThan(0);
  });

  it('returns default shape when given undefined', () => {
    const bp = getBlueprint(undefined);
    expect(bp.version).toBe(1);
  });

  it('returns default shape when given invalid data', () => {
    const bp = getBlueprint({ broken: true });
    expect(bp.version).toBe(1);
    expect(bp.lenses).toHaveLength(5);
  });

  it('returns stored blueprint when valid', () => {
    const stored = composeBlueprint({
      industry: 'Retail',
      dreamTrack: 'DOMAIN',
      engagementType: null,
      domainPack: null,
      purpose: 'Improve CX',
      outcomes: 'Customer journey map',
    });
    const bp = getBlueprint(stored);
    expect(bp.industry).toBe('Retail');
    expect(bp.purpose).toBe('Improve CX');
  });

  it('returns independent clones (no shared references)', () => {
    const bp1 = getBlueprint(null);
    const bp2 = getBlueprint(null);
    bp1.lenses[0].name = 'MUTATED';
    expect(bp2.lenses[0].name).not.toBe('MUTATED');
  });
});
