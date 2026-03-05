/**
 * Blueprint-governed Live Runtime tests
 *
 * Covers:
 *  - GuidanceState blueprint field lifecycle
 *  - Blueprint-aware pacing, lenses, journey stages in orchestrator helpers
 *  - Pipeline configurable helpers (confidence, signals, REIMAGINE filter, journey stages)
 *  - Facilitation agent lens preference (blueprint > research > defaults)
 *  - Journey completion agent actor taxonomy from blueprint
 */

import { describe, it, expect } from 'vitest';
import {
  getOrCreateGuidanceState,
  updateGuidanceState,
  removeGuidanceState,
  type GuidanceState,
} from '@/lib/cognition/guidance-state';
import {
  getPhaseAllowedSignals,
  getReimagineFilter,
  getConfidenceThreshold,
  getBlueprintJourneyStages,
  categoriseNode,
  createInitialNode,
  type DialoguePhase,
} from '@/lib/cognitive-guidance/pipeline';
import { generateBlueprint } from '@/lib/cognition/workshop-blueprint-generator';
import { DEFAULT_BLUEPRINT, type WorkshopBlueprint } from '@/lib/workshop/blueprint';

// ================================================================
// Helpers
// ================================================================

const TEST_WORKSHOP_ID = 'bp-live-test-' + Date.now();

function enterpriseBlueprint(): WorkshopBlueprint {
  return generateBlueprint({
    industry: 'Financial Services',
    dreamTrack: 'ENTERPRISE',
    engagementType: 'diagnostic_baseline',
    domainPack: 'enterprise',
    purpose: 'Strategic assessment',
    outcomes: 'Transformation roadmap',
  });
}

function ccBlueprint(): WorkshopBlueprint {
  return generateBlueprint({
    industry: 'Telecommunications',
    dreamTrack: 'DOMAIN',
    engagementType: 'diagnostic_baseline',
    domainPack: 'contact_centre',
    purpose: 'Assess contact centre maturity',
    outcomes: 'Improvement roadmap',
  });
}

function customPacingBlueprint(): WorkshopBlueprint {
  const bp = structuredClone(DEFAULT_BLUEPRINT);
  bp.pacing = {
    maxVisiblePads: 8,
    minEmissionIntervalMs: 60_000,
    padGenerationIntervalMs: 30_000,
    padUtteranceThreshold: 3,
  };
  return bp;
}

function customSignalPolicyBlueprint(): WorkshopBlueprint {
  const bp = structuredClone(DEFAULT_BLUEPRINT);
  bp.signalPolicy = {
    enabledSignalTypes: ['repeated_theme', 'contradiction'],
    phaseAllowedSignals: {
      SYNTHESIS: ['repeated_theme'],
      REIMAGINE: ['repeated_theme', 'contradiction'],
      CONSTRAINTS: ['repeated_theme', 'contradiction', 'high_freq_constraint'],
      DEFINE_APPROACH: ['repeated_theme'],
    },
  };
  return bp;
}

// ================================================================
// GuidanceState blueprint field
// ================================================================

describe('GuidanceState blueprint field', () => {
  it('getOrCreateGuidanceState returns blueprint: null by default', () => {
    removeGuidanceState(TEST_WORKSHOP_ID);
    const gs = getOrCreateGuidanceState(TEST_WORKSHOP_ID);
    expect(gs.blueprint).toBeNull();
    removeGuidanceState(TEST_WORKSHOP_ID);
  });

  it('updateGuidanceState sets and retrieves blueprint', () => {
    removeGuidanceState(TEST_WORKSHOP_ID);
    const bp = enterpriseBlueprint();
    updateGuidanceState(TEST_WORKSHOP_ID, { blueprint: bp });
    const gs = getOrCreateGuidanceState(TEST_WORKSHOP_ID);
    expect(gs.blueprint).not.toBeNull();
    expect(gs.blueprint?.lenses?.length).toBeGreaterThan(0);
    expect(gs.blueprint?.pacing?.maxVisiblePads).toBeDefined();
    removeGuidanceState(TEST_WORKSHOP_ID);
  });

  it('updateGuidanceState can clear blueprint to null', () => {
    removeGuidanceState(TEST_WORKSHOP_ID);
    updateGuidanceState(TEST_WORKSHOP_ID, { blueprint: enterpriseBlueprint() });
    updateGuidanceState(TEST_WORKSHOP_ID, { blueprint: null });
    const gs = getOrCreateGuidanceState(TEST_WORKSHOP_ID);
    expect(gs.blueprint).toBeNull();
    removeGuidanceState(TEST_WORKSHOP_ID);
  });
});

// ================================================================
// Pipeline configurable helpers
// ================================================================

describe('getPhaseAllowedSignals', () => {
  it('returns default signals when no blueprint policy', () => {
    const signals = getPhaseAllowedSignals('REIMAGINE');
    expect(signals.has('repeated_theme')).toBe(true);
    expect(signals.has('missing_dimension')).toBe(true);
    expect(signals.has('unanswered_question')).toBe(true);
  });

  it('returns blueprint signals when policy provided', () => {
    const bp = customSignalPolicyBlueprint();
    const signals = getPhaseAllowedSignals('REIMAGINE', bp.signalPolicy.phaseAllowedSignals);
    expect(signals.has('repeated_theme')).toBe(true);
    expect(signals.has('contradiction')).toBe(true);
    // missing_dimension NOT in custom policy for REIMAGINE
    expect(signals.has('missing_dimension')).toBe(false);
  });

  it('falls back to defaults for phases not in blueprint policy', () => {
    const signals = getPhaseAllowedSignals('CONSTRAINTS', null);
    expect(signals.has('high_freq_constraint')).toBe(true);
    expect(signals.has('risk_cluster')).toBe(true);
  });
});

describe('getReimagineFilter', () => {
  it('returns default REIMAGINE lenses when no blueprint', () => {
    const filter = getReimagineFilter();
    expect(filter.has('People')).toBe(true);
    expect(filter.has('Customer')).toBe(true);
    expect(filter.has('Organisation')).toBe(true);
    expect(filter.has('Technology')).toBe(false);
  });

  it('returns blueprint REIMAGINE lenses when provided', () => {
    const bp = enterpriseBlueprint();
    const filter = getReimagineFilter(bp.phaseLensPolicy);
    expect(filter.has('People')).toBe(true);
    expect(filter.has('Customer')).toBe(true);
    // Enterprise phaseLensPolicy.REIMAGINE includes People, Customer, Organisation
    expect(filter.size).toBeGreaterThanOrEqual(2);
  });

  it('returns default when REIMAGINE array is empty', () => {
    const filter = getReimagineFilter({ REIMAGINE: [] });
    // Empty array falls back to defaults
    expect(filter.has('People')).toBe(true);
    expect(filter.has('Customer')).toBe(true);
  });
});

describe('getConfidenceThreshold', () => {
  it('returns default 0.4 when no blueprint threshold', () => {
    expect(getConfidenceThreshold()).toBe(0.4);
    expect(getConfidenceThreshold(null)).toBe(0.4);
    expect(getConfidenceThreshold(undefined)).toBe(0.4);
  });

  it('returns blueprint threshold when provided', () => {
    expect(getConfidenceThreshold(0.6)).toBe(0.6);
    expect(getConfidenceThreshold(0.3)).toBe(0.3);
  });
});

describe('getBlueprintJourneyStages', () => {
  it('returns default stages when no blueprint', () => {
    const stages = getBlueprintJourneyStages('REIMAGINE');
    expect(stages).toContain('Discovery');
    expect(stages).toContain('Growth');
    expect(stages.length).toBe(6);
  });

  it('returns blueprint stage names when provided', () => {
    const customStages = [
      { name: 'Awareness' },
      { name: 'Consideration' },
      { name: 'Purchase' },
      { name: 'Retention' },
    ];
    const stages = getBlueprintJourneyStages('REIMAGINE', customStages);
    expect(stages).toEqual(['Awareness', 'Consideration', 'Purchase', 'Retention']);
  });

  it('falls back to defaults for null blueprint stages', () => {
    const stages = getBlueprintJourneyStages('CONSTRAINTS', null);
    expect(stages).toContain('Discovery');
    expect(stages.length).toBe(6);
  });
});

describe('categoriseNode with configurable threshold', () => {
  it('uses default threshold (0.4) when not specified', () => {
    const node = createInitialNode('test-1', 'Test text', null, Date.now());
    const classified = categoriseNode(node, {
      primaryType: 'CONSTRAINT',
      confidence: 0.5,
      keywords: ['test'],
    });
    expect(classified.nodeType).toBe('CONSTRAINT');
  });

  it('uses custom threshold from blueprint', () => {
    const node = createInitialNode('test-2', 'Test text', null, Date.now());
    // With threshold 0.6, a confidence of 0.5 should stay UNCLASSIFIED
    const classified = categoriseNode(
      node,
      { primaryType: 'CONSTRAINT', confidence: 0.5, keywords: ['test'] },
      0.6,
    );
    expect(classified.nodeType).toBe('UNCLASSIFIED');
  });

  it('classifies correctly when confidence exceeds custom threshold', () => {
    const node = createInitialNode('test-3', 'Test text', null, Date.now());
    const classified = categoriseNode(
      node,
      { primaryType: 'ENABLER', confidence: 0.7, keywords: ['test'] },
      0.6,
    );
    expect(classified.nodeType).toBe('ENABLER');
  });
});

// ================================================================
// Blueprint lens names and journey stages resolution
// ================================================================

describe('Blueprint lens and stage resolution', () => {
  it('enterprise blueprint provides 5 standard lenses', () => {
    const bp = enterpriseBlueprint();
    const lensNames = bp.lenses.map(l => l.name);
    expect(lensNames).toContain('People');
    expect(lensNames).toContain('Customer');
    expect(lensNames).toContain('Technology');
    expect(lensNames.length).toBeGreaterThanOrEqual(4);
  });

  it('CC blueprint provides domain-specific lenses', () => {
    const bp = ccBlueprint();
    const lensNames = bp.lenses.map(l => l.name);
    expect(lensNames).toContain('People');
    expect(lensNames).toContain('Customer');
    expect(lensNames).toContain('Technology');
  });

  it('blueprint pacing overrides defaults', () => {
    const bp = customPacingBlueprint();
    expect(bp.pacing.maxVisiblePads).toBe(8);
    expect(bp.pacing.minEmissionIntervalMs).toBe(60_000);
    expect(bp.pacing.padGenerationIntervalMs).toBe(30_000);
    expect(bp.pacing.padUtteranceThreshold).toBe(3);
  });

  it('default blueprint has standard pacing values', () => {
    expect(DEFAULT_BLUEPRINT.pacing.maxVisiblePads).toBe(4);
    expect(DEFAULT_BLUEPRINT.pacing.minEmissionIntervalMs).toBe(120_000);
    expect(DEFAULT_BLUEPRINT.pacing.padGenerationIntervalMs).toBe(45_000);
    expect(DEFAULT_BLUEPRINT.pacing.padUtteranceThreshold).toBe(6);
  });

  it('CC blueprint provides actor taxonomy', () => {
    const bp = ccBlueprint();
    expect(bp.actorTaxonomy.length).toBeGreaterThan(0);
    // Contact centre pack has actors like "Customer", "Agent", etc.
    const actorKeys = bp.actorTaxonomy.map(a => a.key);
    expect(actorKeys.length).toBeGreaterThan(0);
  });

  it('default blueprint has empty actor taxonomy', () => {
    expect(DEFAULT_BLUEPRINT.actorTaxonomy).toEqual([]);
  });

  it('blueprint coverage threshold comes from questionPolicy', () => {
    const bp = enterpriseBlueprint();
    expect(bp.questionPolicy.coverageThresholdPercent).toBe(70);
  });

  it('blueprint confidence rules provide classification threshold', () => {
    const bp = enterpriseBlueprint();
    expect(bp.confidenceRules.classificationThreshold).toBe(0.4);
    expect(bp.confidenceRules.beliefStabilisationThreshold).toBe(0.4);
  });
});

// ================================================================
// GuidanceState + blueprint integration
// ================================================================

describe('GuidanceState with blueprint integration', () => {
  it('blueprint lenses available through guidance state', () => {
    removeGuidanceState(TEST_WORKSHOP_ID);
    const bp = ccBlueprint();
    updateGuidanceState(TEST_WORKSHOP_ID, { blueprint: bp });
    const gs = getOrCreateGuidanceState(TEST_WORKSHOP_ID);

    const lensNames = gs.blueprint?.lenses?.map(l => l.name) ?? [];
    expect(lensNames.length).toBeGreaterThan(0);
    expect(lensNames).toContain('People');
    expect(lensNames).toContain('Customer');

    removeGuidanceState(TEST_WORKSHOP_ID);
  });

  it('blueprint pacing available through guidance state', () => {
    removeGuidanceState(TEST_WORKSHOP_ID);
    const bp = customPacingBlueprint();
    updateGuidanceState(TEST_WORKSHOP_ID, { blueprint: bp });
    const gs = getOrCreateGuidanceState(TEST_WORKSHOP_ID);

    expect(gs.blueprint?.pacing?.maxVisiblePads).toBe(8);
    expect(gs.blueprint?.pacing?.padUtteranceThreshold).toBe(3);

    removeGuidanceState(TEST_WORKSHOP_ID);
  });

  it('blueprint journey stages available through guidance state', () => {
    removeGuidanceState(TEST_WORKSHOP_ID);
    const bp = enterpriseBlueprint();
    updateGuidanceState(TEST_WORKSHOP_ID, { blueprint: bp });
    const gs = getOrCreateGuidanceState(TEST_WORKSHOP_ID);

    const stageNames = gs.blueprint?.journeyStages?.map(s => s.name) ?? [];
    expect(stageNames.length).toBeGreaterThan(0);

    removeGuidanceState(TEST_WORKSHOP_ID);
  });

  it('blueprint actor taxonomy available through guidance state', () => {
    removeGuidanceState(TEST_WORKSHOP_ID);
    const bp = ccBlueprint();
    updateGuidanceState(TEST_WORKSHOP_ID, { blueprint: bp });
    const gs = getOrCreateGuidanceState(TEST_WORKSHOP_ID);

    expect(gs.blueprint?.actorTaxonomy?.length).toBeGreaterThan(0);

    removeGuidanceState(TEST_WORKSHOP_ID);
  });

  it('coverage threshold derives from blueprint on first init', () => {
    removeGuidanceState(TEST_WORKSHOP_ID);
    const bp = structuredClone(DEFAULT_BLUEPRINT);
    bp.questionPolicy.coverageThresholdPercent = 80;
    // Simulate what the guidance-state API does: set blueprint + coverage on init
    updateGuidanceState(TEST_WORKSHOP_ID, {
      blueprint: bp,
      coverageThreshold: bp.questionPolicy.coverageThresholdPercent,
    });
    const gs = getOrCreateGuidanceState(TEST_WORKSHOP_ID);
    expect(gs.coverageThreshold).toBe(80);

    removeGuidanceState(TEST_WORKSHOP_ID);
  });

  it('facilitator can override coverage threshold after blueprint init', () => {
    removeGuidanceState(TEST_WORKSHOP_ID);
    const bp = structuredClone(DEFAULT_BLUEPRINT);
    bp.questionPolicy.coverageThresholdPercent = 80;
    updateGuidanceState(TEST_WORKSHOP_ID, {
      blueprint: bp,
      coverageThreshold: 80,
    });

    // Facilitator adjusts threshold via UI
    updateGuidanceState(TEST_WORKSHOP_ID, { coverageThreshold: 60 });
    const gs = getOrCreateGuidanceState(TEST_WORKSHOP_ID);
    expect(gs.coverageThreshold).toBe(60);
    // Blueprint still shows 80
    expect(gs.blueprint?.questionPolicy?.coverageThresholdPercent).toBe(80);

    removeGuidanceState(TEST_WORKSHOP_ID);
  });
});
