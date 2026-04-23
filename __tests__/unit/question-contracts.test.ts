/**
 * Question Contracts -- Comprehensive Test Suite
 *
 * Proves:
 *   1. All 6 contract instances are valid and complete
 *   2. getQuestionContract returns the correct contract for every phase x workshop type
 *   3. getQuestionContract falls back to DEFAULT for unknown workshop types
 *   4. buildLensContractBlock produces well-formed output for all phase x lens combinations
 *   5. getMissingDepthLevels correctly identifies missing depths
 *   6. REIMAGINE contracts contain zero constraint language at any depth level
 *   7. Each contract specifies exactly 3 promptIntents per depth level
 *   8. Depth levels are always [surface, depth, edge] in that order
 *
 * Workshop types tested: DEFAULT, GO_TO_MARKET (and implicit fallback for others)
 * Phases tested: REIMAGINE, CONSTRAINTS, DEFINE_APPROACH
 */

import { describe, it, expect } from 'vitest';
import {
  getQuestionContract,
  buildLensContractBlock,
  getMissingDepthLevels,
} from '@/lib/workshop/question-contracts';
import type {
  DepthLevel,
  PhaseQuestionContract,
} from '@/lib/workshop/question-contracts';
import type { CanonicalWorkshopType } from '@/lib/workshop/workshop-definition';

// ================================================================
// Helpers
// ================================================================

const ALL_PHASES = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'] as const;
type Phase = typeof ALL_PHASES[number];

const EXPLICIT_WORKSHOP_TYPES: Array<CanonicalWorkshopType | 'DEFAULT'> = [
  'DEFAULT',
  'GO_TO_MARKET',
];

const FALLBACK_WORKSHOP_TYPES: CanonicalWorkshopType[] = [
  'TRANSFORMATION',
  'OPERATIONS',
  'AI',
  'FINANCE',
];

// Phrases that IDENTIFY constraints as real barriers -- must never appear in REIMAGINE question specs.
// Note: "if every constraint was removed" is valid vision framing so "constraint" alone is NOT banned.
// These are phrases only found in CONSTRAINTS/DEFINE_APPROACH contracts, not REIMAGINE.
const REIMAGINE_FORBIDDEN_QUESTION_PHRASES = [
  'what stands in the way',
  'what stands between',
  'map what stands',
  'stands between today',
  'what are the barriers',
  'what prevents you',
  'what limits you',
  'what holds back',
  'what gets in the way',
  'expose what creates',
  'surface the real cost',
  'what creates and maintains',
  'structural about it',
];

// ================================================================
// 1. All contracts are structurally valid
// ================================================================

describe('Contract structural validity -- all phase x workshop type combinations', () => {
  for (const phase of ALL_PHASES) {
    for (const workshopType of EXPLICIT_WORKSHOP_TYPES) {
      const label = `${phase} x ${workshopType}`;

      it(`${label}: contract has required top-level fields`, () => {
        const contract = getQuestionContract(phase, workshopType === 'DEFAULT' ? null : workshopType);
        expect(contract.phase).toBe(phase);
        expect(typeof contract.customerAnchor).toBe('string');
        expect(contract.customerAnchor.length).toBeGreaterThan(10);
        expect(typeof contract.subActorGuidance).toBe('string');
        expect(contract.subActorGuidance.length).toBeGreaterThan(10);
        expect(typeof contract.phaseFocus).toBe('string');
        expect(contract.phaseFocus.length).toBeGreaterThan(10);
      });

      it(`${label}: has exactly 3 depth levels in order [surface, depth, edge]`, () => {
        const contract = getQuestionContract(phase, workshopType === 'DEFAULT' ? null : workshopType);
        expect(contract.depthLevels).toHaveLength(3);
        expect(contract.depthLevels[0].depth).toBe('surface');
        expect(contract.depthLevels[1].depth).toBe('depth');
        expect(contract.depthLevels[2].depth).toBe('edge');
      });

      it(`${label}: each depth has non-empty questionIntent`, () => {
        const contract = getQuestionContract(phase, workshopType === 'DEFAULT' ? null : workshopType);
        for (const depthSlot of contract.depthLevels) {
          expect(typeof depthSlot.questionIntent).toBe('string');
          expect(depthSlot.questionIntent.length).toBeGreaterThan(20);
        }
      });

      it(`${label}: each depth has exactly 3 promptIntents`, () => {
        const contract = getQuestionContract(phase, workshopType === 'DEFAULT' ? null : workshopType);
        for (const depthSlot of contract.depthLevels) {
          expect(depthSlot.promptIntents).toHaveLength(3);
          for (const intent of depthSlot.promptIntents) {
            expect(typeof intent).toBe('string');
            expect(intent.length).toBeGreaterThan(10);
          }
        }
      });
    }
  }
});

// ================================================================
// 2. getQuestionContract -- lookup and fallback behaviour
// ================================================================

describe('getQuestionContract -- lookup and fallback', () => {
  it('returns REIMAGINE_DEFAULT when phase=REIMAGINE, workshopType=null', () => {
    const contract = getQuestionContract('REIMAGINE', null);
    expect(contract.phase).toBe('REIMAGINE');
    expect(contract.workshopType).toBe('DEFAULT');
  });

  it('returns REIMAGINE_DEFAULT when phase=REIMAGINE, workshopType=undefined', () => {
    const contract = getQuestionContract('REIMAGINE', undefined);
    expect(contract.phase).toBe('REIMAGINE');
    expect(contract.workshopType).toBe('DEFAULT');
  });

  it('returns REIMAGINE_GTM when phase=REIMAGINE, workshopType=GO_TO_MARKET', () => {
    const contract = getQuestionContract('REIMAGINE', 'GO_TO_MARKET');
    expect(contract.phase).toBe('REIMAGINE');
    expect(contract.workshopType).toBe('GO_TO_MARKET');
  });

  it('returns CONSTRAINTS_DEFAULT when phase=CONSTRAINTS, workshopType=null', () => {
    const contract = getQuestionContract('CONSTRAINTS', null);
    expect(contract.phase).toBe('CONSTRAINTS');
    expect(contract.workshopType).toBe('DEFAULT');
  });

  it('returns CONSTRAINTS_GTM when phase=CONSTRAINTS, workshopType=GO_TO_MARKET', () => {
    const contract = getQuestionContract('CONSTRAINTS', 'GO_TO_MARKET');
    expect(contract.phase).toBe('CONSTRAINTS');
    expect(contract.workshopType).toBe('GO_TO_MARKET');
  });

  it('returns DEFINE_APPROACH_DEFAULT when phase=DEFINE_APPROACH, workshopType=null', () => {
    const contract = getQuestionContract('DEFINE_APPROACH', null);
    expect(contract.phase).toBe('DEFINE_APPROACH');
    expect(contract.workshopType).toBe('DEFAULT');
  });

  it('returns DEFINE_APPROACH_GTM when phase=DEFINE_APPROACH, workshopType=GO_TO_MARKET', () => {
    const contract = getQuestionContract('DEFINE_APPROACH', 'GO_TO_MARKET');
    expect(contract.phase).toBe('DEFINE_APPROACH');
    expect(contract.workshopType).toBe('GO_TO_MARKET');
  });

  // Fallback: all canonical types without explicit contracts use DEFAULT
  for (const workshopType of FALLBACK_WORKSHOP_TYPES) {
    for (const phase of ALL_PHASES) {
      it(`falls back to DEFAULT for phase=${phase}, workshopType=${workshopType}`, () => {
        const contract = getQuestionContract(phase, workshopType);
        expect(contract.phase).toBe(phase);
        expect(contract.workshopType).toBe('DEFAULT');
      });
    }
  }
});

// ================================================================
// 3. REIMAGINE contracts contain ZERO constraint language
// ================================================================

describe('REIMAGINE contracts -- no constraint-identification language in question specs', () => {
  // Note: phaseFocus is instructional meta-text and may mention forbidden terms as examples
  // of what to avoid. Only questionIntents and promptIntents are checked here.
  for (const workshopType of EXPLICIT_WORKSHOP_TYPES) {
    const contract = getQuestionContract('REIMAGINE', workshopType === 'DEFAULT' ? null : workshopType as CanonicalWorkshopType);

    for (const depthSlot of contract.depthLevels) {
      it(`${workshopType} ${depthSlot.depth}: questionIntent has no constraint-identification phrases`, () => {
        const text = depthSlot.questionIntent.toLowerCase();
        for (const phrase of REIMAGINE_FORBIDDEN_QUESTION_PHRASES) {
          expect(text, `[${depthSlot.depth}] questionIntent must not contain "${phrase}"`).not.toContain(phrase);
        }
      });

      for (const [i, intent] of depthSlot.promptIntents.entries()) {
        it(`${workshopType} ${depthSlot.depth} promptIntent[${i}] has no constraint-identification phrases`, () => {
          const text = intent.toLowerCase();
          for (const phrase of REIMAGINE_FORBIDDEN_QUESTION_PHRASES) {
            expect(text, `promptIntent[${i}] must not contain "${phrase}"`).not.toContain(phrase);
          }
        });
      }
    }
  }
});

// ================================================================
// 4. CONSTRAINTS/DEFINE_APPROACH contracts DO reference barriers (sanity check)
// ================================================================

describe('CONSTRAINTS contract -- references barriers (sanity check)', () => {
  it('DEFAULT CONSTRAINTS phaseFocus mentions what stands in the way', () => {
    const contract = getQuestionContract('CONSTRAINTS', null);
    // phaseFocus should reference barriers/constraints explicitly
    const text = contract.phaseFocus.toLowerCase();
    const hasBarrierLanguage = text.includes('constraint') || text.includes('stand') ||
      text.includes('limitation') || text.includes('what stands');
    expect(hasBarrierLanguage).toBe(true);
  });

  it('GTM CONSTRAINTS phaseFocus references commercial barriers', () => {
    const contract = getQuestionContract('CONSTRAINTS', 'GO_TO_MARKET');
    const text = contract.phaseFocus.toLowerCase();
    const hasBarrierLanguage = text.includes('constraint') || text.includes('stand') ||
      text.includes('limitation');
    expect(hasBarrierLanguage).toBe(true);
  });
});

// ================================================================
// 5. GTM contracts are differentiated from DEFAULT
// ================================================================

describe('GTM contracts are meaningfully differentiated from DEFAULT', () => {
  for (const phase of ALL_PHASES) {
    it(`${phase}: GTM and DEFAULT have different customerAnchors`, () => {
      const gtm = getQuestionContract(phase, 'GO_TO_MARKET');
      const def = getQuestionContract(phase, null);
      expect(gtm.customerAnchor).not.toBe(def.customerAnchor);
    });

    it(`${phase}: GTM and DEFAULT have different phaseFocus`, () => {
      const gtm = getQuestionContract(phase, 'GO_TO_MARKET');
      const def = getQuestionContract(phase, null);
      expect(gtm.phaseFocus).not.toBe(def.phaseFocus);
    });

    it(`${phase}: GTM customerAnchor references buyers/market`, () => {
      const contract = getQuestionContract(phase, 'GO_TO_MARKET');
      const text = contract.customerAnchor.toLowerCase();
      expect(text.includes('buyer') || text.includes('market') || text.includes('client')).toBe(true);
    });
  }
});

// ================================================================
// 6. buildLensContractBlock -- output format and substitution
// ================================================================

describe('buildLensContractBlock -- output format', () => {
  const testLens = 'Commercial';
  const testClient = 'Acme Corp';

  for (const phase of ALL_PHASES) {
    it(`${phase}: block starts with CONTRACT FOR LENS`, () => {
      const contract = getQuestionContract(phase, null);
      const block = buildLensContractBlock(contract, testLens, testClient);
      expect(block).toContain(`CONTRACT FOR LENS: ${testLens}`);
    });

    it(`${phase}: block includes customer anchor`, () => {
      const contract = getQuestionContract(phase, null);
      const block = buildLensContractBlock(contract, testLens, testClient);
      expect(block).toContain('Customer anchor:');
    });

    it(`${phase}: block includes all 3 depth sections`, () => {
      const contract = getQuestionContract(phase, null);
      const block = buildLensContractBlock(contract, testLens, testClient);
      expect(block).toContain('[SURFACE]');
      expect(block).toContain('[DEPTH]');
      expect(block).toContain('[EDGE]');
    });

    it(`${phase}: block has "Seed prompts must cover" sections`, () => {
      const contract = getQuestionContract(phase, null);
      const block = buildLensContractBlock(contract, testLens, testClient);
      // 3 depths x "Seed prompts must cover" = 3 occurrences
      const count = (block.match(/Seed prompts must cover:/g) || []).length;
      expect(count).toBe(3);
    });

    it(`${phase}: block substitutes clientName for "this company"`, () => {
      const contract = getQuestionContract(phase, null);
      const block = buildLensContractBlock(contract, testLens, testClient);
      // If the contract had "this company", it should be replaced with testClient
      expect(block).not.toContain('this company');
    });

    it(`${phase}: block substitutes lens name for "this lens"`, () => {
      const contract = getQuestionContract(phase, null);
      const block = buildLensContractBlock(contract, testLens, testClient);
      expect(block).not.toContain('this lens');
    });
  }

  it('block format is consistent across different lenses', () => {
    const contract = getQuestionContract('REIMAGINE', null);
    const block1 = buildLensContractBlock(contract, 'People', 'Acme');
    const block2 = buildLensContractBlock(contract, 'Technology', 'Acme');
    // Both should start with CONTRACT FOR LENS
    expect(block1).toContain('CONTRACT FOR LENS: People');
    expect(block2).toContain('CONTRACT FOR LENS: Technology');
    // Structure should be the same (both have SURFACE, DEPTH, EDGE)
    expect(block1.includes('[SURFACE]')).toBe(true);
    expect(block2.includes('[SURFACE]')).toBe(true);
  });

  // Compact form
  for (const phase of ALL_PHASES) {
    it(`${phase} compact: includes depth level headers`, () => {
      const contract = getQuestionContract(phase, null);
      const block = buildLensContractBlock(contract, testLens, testClient, true);
      expect(block).toContain('SURFACE:');
      expect(block).toContain('DEPTH:');
      expect(block).toContain('EDGE:');
    });

    it(`${phase} compact: includes seeds for each depth`, () => {
      const contract = getQuestionContract(phase, null);
      const block = buildLensContractBlock(contract, testLens, testClient, true);
      const seedCount = (block.match(/Seeds:/g) || []).length;
      expect(seedCount).toBe(3);
    });

    it(`${phase} compact: substitutes clientName for "this company"`, () => {
      const contract = getQuestionContract(phase, null);
      const block = buildLensContractBlock(contract, testLens, testClient, true);
      expect(block).not.toContain('this company');
    });

    it(`${phase} compact: substitutes lens name for "this lens"`, () => {
      const contract = getQuestionContract(phase, null);
      const block = buildLensContractBlock(contract, testLens, testClient, true);
      expect(block).not.toContain('this lens');
    });

    it(`${phase} compact: is shorter than full form`, () => {
      const contract = getQuestionContract(phase, null);
      const full = buildLensContractBlock(contract, testLens, testClient, false);
      const compact = buildLensContractBlock(contract, testLens, testClient, true);
      expect(compact.length).toBeLessThan(full.length);
    });
  }
});

// ================================================================
// 7. getMissingDepthLevels
// ================================================================

describe('getMissingDepthLevels', () => {
  it('returns all 3 levels when questions array is empty', () => {
    expect(getMissingDepthLevels([])).toEqual(['surface', 'depth', 'edge']);
  });

  it('returns empty array when all 3 depths are present', () => {
    const questions = [
      { depth: 'surface' },
      { depth: 'depth' },
      { depth: 'edge' },
    ];
    expect(getMissingDepthLevels(questions)).toEqual([]);
  });

  it('returns missing depths when only surface is present', () => {
    const questions = [{ depth: 'surface' }];
    const missing = getMissingDepthLevels(questions);
    expect(missing).toContain('depth');
    expect(missing).toContain('edge');
    expect(missing).not.toContain('surface');
  });

  it('returns missing depths when surface and depth are present', () => {
    const questions = [{ depth: 'surface' }, { depth: 'depth' }];
    const missing = getMissingDepthLevels(questions);
    expect(missing).toEqual(['edge']);
  });

  it('returns missing depths when only edge is present', () => {
    const questions = [{ depth: 'edge' }];
    const missing = getMissingDepthLevels(questions);
    expect(missing).toContain('surface');
    expect(missing).toContain('depth');
    expect(missing).not.toContain('edge');
  });

  it('handles questions without depth field (treated as absent)', () => {
    const questions = [{ depth: undefined }, { depth: null as unknown as string }, {}];
    const missing = getMissingDepthLevels(questions);
    expect(missing).toEqual(['surface', 'depth', 'edge']);
  });

  it('handles duplicate depths correctly (still considers a level covered)', () => {
    const questions = [
      { depth: 'surface' },
      { depth: 'surface' }, // duplicate
      { depth: 'depth' },
    ];
    const missing = getMissingDepthLevels(questions);
    expect(missing).toEqual(['edge']);
  });

  it('is order-independent', () => {
    const questions = [
      { depth: 'edge' },
      { depth: 'surface' },
      { depth: 'depth' },
    ];
    expect(getMissingDepthLevels(questions)).toEqual([]);
  });
});

// ================================================================
// 8. Contract depth progression is coherent
// ================================================================

describe('Depth progression coherence', () => {
  for (const phase of ALL_PHASES) {
    for (const workshopType of EXPLICIT_WORKSHOP_TYPES) {
      it(`${phase} x ${workshopType}: edge questionIntent is notably more ambitious than surface`, () => {
        const contract = getQuestionContract(phase, workshopType === 'DEFAULT' ? null : workshopType as CanonicalWorkshopType);
        const surfaceIntent = contract.depthLevels[0].questionIntent.toLowerCase();
        const edgeIntent = contract.depthLevels[2].questionIntent.toLowerCase();
        // Edge should contain more challenging language
        const edgeChallengeWords = ['ambitious', 'unspoken', 'nobody', 'transformative',
          'protecting', 'actually protecting', 'stall', 'failure', 'quiet', 'honest',
          'not saying', 'real reason', 'what is it protecting'];
        const hasEdgeCharacter = edgeChallengeWords.some(w => edgeIntent.includes(w));
        expect(hasEdgeCharacter).toBe(true);
        // Surface should be more observational
        expect(surfaceIntent.length).toBeGreaterThan(20);
      });
    }
  }
});

// ================================================================
// 9. DEFINE_APPROACH contracts reference practical steps
// ================================================================

describe('DEFINE_APPROACH contracts reference practical execution', () => {
  for (const workshopType of EXPLICIT_WORKSHOP_TYPES) {
    it(`${workshopType}: surface depth references first/concrete step`, () => {
      const contract = getQuestionContract('DEFINE_APPROACH', workshopType === 'DEFAULT' ? null : workshopType as CanonicalWorkshopType);
      const surfaceIntent = contract.depthLevels[0].questionIntent.toLowerCase();
      const hasPracticalLanguage = surfaceIntent.includes('first') ||
        surfaceIntent.includes('concrete') ||
        surfaceIntent.includes('foothold') ||
        surfaceIntent.includes('exists today');
      expect(hasPracticalLanguage).toBe(true);
    });

    it(`${workshopType}: edge depth references failure mode or honest challenge`, () => {
      const contract = getQuestionContract('DEFINE_APPROACH', workshopType === 'DEFAULT' ? null : workshopType as CanonicalWorkshopType);
      const edgeIntent = contract.depthLevels[2].questionIntent.toLowerCase();
      const hasFailureLanguage = edgeIntent.includes('stall') || edgeIntent.includes('failure') ||
        edgeIntent.includes('nobody') || edgeIntent.includes('not saying');
      expect(hasFailureLanguage).toBe(true);
    });
  }
});

// ================================================================
// 10. Contract completeness -- no empty strings anywhere
// ================================================================

describe('Contract completeness -- no empty or trivially short strings', () => {
  for (const phase of ALL_PHASES) {
    for (const workshopType of EXPLICIT_WORKSHOP_TYPES) {
      it(`${phase} x ${workshopType}: all string fields are meaningful (>20 chars)`, () => {
        const contract = getQuestionContract(phase, workshopType === 'DEFAULT' ? null : workshopType as CanonicalWorkshopType);
        expect(contract.customerAnchor.trim().length).toBeGreaterThan(20);
        expect(contract.subActorGuidance.trim().length).toBeGreaterThan(20);
        expect(contract.phaseFocus.trim().length).toBeGreaterThan(30);

        for (const depthSlot of contract.depthLevels) {
          expect(depthSlot.questionIntent.trim().length).toBeGreaterThan(30);
          for (const intent of depthSlot.promptIntents) {
            expect(intent.trim().length).toBeGreaterThan(15);
          }
        }
      });
    }
  }
});
