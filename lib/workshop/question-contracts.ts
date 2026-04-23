/**
 * Contract-driven question generation system for DREAM workshops.
 *
 * Each phase × workshop-type combination has a typed contract that defines:
 *   - What the question at each depth level (Surface → Depth → Edge) must achieve
 *   - What each of the 3 seed prompts must cover (coverage or onion-peel)
 *
 * The contracts drive the LLM generation — the agent fills contract slots with
 * company-specific content rather than free-generating questions.
 *
 * REIMAGINE: 100% vision — no constraint language of any kind.
 * CONSTRAINTS: What stands between today and the vision.
 * DEFINE_APPROACH: Practical path from today to the vision.
 */

import type { CanonicalWorkshopType } from '@/lib/workshop/workshop-definition';

export type DepthLevel = 'surface' | 'depth' | 'edge';

export interface DepthContract {
  depth: DepthLevel;
  /** What the main question must achieve — the purpose this slot serves */
  questionIntent: string;
  /** What each of the 3 seed prompts must target — coverage angle or onion-peel probe */
  promptIntents: [string, string, string];
}

export interface PhaseQuestionContract {
  phase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';
  workshopType: CanonicalWorkshopType | 'DEFAULT';
  /**
   * Who the primary customer/beneficiary is for this workshop type.
   * Used to anchor questions in the right perspective.
   */
  customerAnchor: string;
  /**
   * How sub-actors (roles in the room, operational roles) should appear in seed prompts.
   * The LLM uses this to personalise prompts to the actual actors in this workshop.
   */
  subActorGuidance: string;
  /** Phase-level framing instruction — what this phase is for */
  phaseFocus: string;
  /** Three depth levels — always [surface, depth, edge] */
  depthLevels: [DepthContract, DepthContract, DepthContract];
}

// ══════════════════════════════════════════════════════════════
// REIMAGINE CONTRACTS
// Pure vision — zero constraint language at any depth level.
// Customer is north star. Sub-actors appear in seed prompts.
// ══════════════════════════════════════════════════════════════

const REIMAGINE_DEFAULT: PhaseQuestionContract = {
  phase: 'REIMAGINE',
  workshopType: 'DEFAULT',
  customerAnchor: 'the people who use, depend on, or are served by this operation',
  subActorGuidance: 'Seed prompts should draw out specific sub-actors (operational roles, frontline teams, partners) whose work shapes the customer experience through this lens.',
  phaseFocus: 'Pure unconstrained vision. If everything that currently prevents this from being great was removed, what would it look like? No mention of barriers, gaps, or what needs to change — only what becomes possible.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Open the unconstrained vision through this lens — if every constraint was removed, what would the customer\'s experience look like for this company?',
      promptIntents: [
        'The specific moment or touchpoint where this vision would feel most different to the customer',
        'What the key people doing this work would do differently — or no longer have to do',
        'What someone external (customer, partner, new joiner) would notice or say about this company if the vision were real',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the vision concrete — what would actually be different day-to-day for the people doing the work and the customers they serve?',
      promptIntents: [
        'What a typical operational role would experience differently in their working day',
        'Where the interaction between operational roles and the customer would change most visibly',
        'What would exist or be routinely available that doesn\'t exist today',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface the most ambitious, unspoken version — what\'s the transformative possibility nobody in the room has fully committed to yet?',
      promptIntents: [
        'The version of this that would make this company genuinely different from every competitor in this space',
        'What participants would say is "too ambitious" but secretly believe is the right direction',
        'What this vision would make completely obsolete or unnecessary',
      ],
    },
  ],
};

const REIMAGINE_GTM: PhaseQuestionContract = {
  phase: 'REIMAGINE',
  workshopType: 'GO_TO_MARKET',
  customerAnchor: 'the buyers this company most wants to win',
  subActorGuidance: 'Seed prompts should reference commercial, presales, and delivery roles — the sub-actors whose positioning and execution determines whether the proposition lands with buyers.',
  phaseFocus: 'Market-level vision — given how fast the market is moving and how buyer needs are changing, what does a genuinely relevant, differentiated proposition look like? Not deal mechanics — the proposition and positioning itself.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Open the market-level vision — given how buyer needs are changing, what does a genuinely relevant and differentiated proposition look like through this lens?',
      promptIntents: [
        'What buyers in this market actually need right now that this company\'s current offer doesn\'t fully deliver',
        'Where the market is moving that current positioning doesn\'t yet speak to',
        'What a proposition through this lens would look like that made this company the obvious choice for the buyers they most want to win',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the proposition concrete — what would this mean for how buyers experience this company, how the commercial team positions, and how value is delivered?',
      promptIntents: [
        'What a buyer would say to a peer the week after signing if this proposition were real',
        'What the commercial and presales team would do differently in how they engage and position',
        'What delivery or fulfilment would need to look like to genuinely match what\'s being promised',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface the most ambitious version of the proposition — the one nobody has fully committed to yet that would make this company genuinely different',
      promptIntents: [
        'The version of this that competitors aren\'t doing and couldn\'t quickly copy',
        'What this company would have to fully commit to — and stop hedging on — to make this real',
        'What buyers would say is exactly what they\'ve been looking for if this company offered this',
      ],
    },
  ],
};

// ══════════════════════════════════════════════════════════════
// CONSTRAINTS CONTRACTS
// What stands between today and the vision.
// Works from visible → structural → what it protects.
// ══════════════════════════════════════════════════════════════

const CONSTRAINTS_DEFAULT: PhaseQuestionContract = {
  phase: 'CONSTRAINTS',
  workshopType: 'DEFAULT',
  customerAnchor: 'the people who use, depend on, or are served by this operation',
  subActorGuidance: 'Seed prompts should identify which sub-actors feel the constraint most acutely, who depends on it, and who would be most affected by its removal.',
  phaseFocus: 'Map what stands between today and the reimagined vision through this lens. Work from visible surface constraints to the structural roots that maintain them.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Make the constraint visible and concrete — where does this limitation show up most clearly through this lens today?',
      promptIntents: [
        'The specific moment or situation where this constraint is felt most acutely by people doing the work',
        'Whether the customer or the operational team feels it first — and what that looks like for each',
        'How frequently and how visibly this constraint surfaces, and whether it\'s getting better or worse',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Expose what creates and maintains this constraint — what\'s structural about it, not just symptomatic?',
      promptIntents: [
        'What originally created this constraint and what keeps it in place today',
        'What other parts of the operation depend on this constraint remaining as it is',
        'Where the constraint has gotten worse or better recently and what drove that change',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface the real cost and what removal would require — what is this constraint actually protecting?',
      promptIntents: [
        'What the business would have to fundamentally change or stop doing to remove this constraint',
        'Who in the organisation has the most to lose if this constraint is removed',
        'What this constraint is actually protecting — the real reason it persists beyond the obvious one',
      ],
    },
  ],
};

const CONSTRAINTS_GTM: PhaseQuestionContract = {
  phase: 'CONSTRAINTS',
  workshopType: 'GO_TO_MARKET',
  customerAnchor: 'the buyers this company most wants to win',
  subActorGuidance: 'Seed prompts should identify which commercial roles (sales, presales, commercial leadership) feel the constraint most and how it shows up in live deals or positioning.',
  phaseFocus: 'Map what stands between this company\'s current proposition and the market-level vision — in live deals, in positioning, in how buyers experience the commercial process.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Make the commercial constraint visible — where does this limitation show up in how buyers experience the proposition or how deals move?',
      promptIntents: [
        'The specific point in the deal cycle or buyer journey where this constraint is felt most acutely',
        'Whether buyers or the internal commercial team hit this first — and what it looks like for each',
        'How often this constraint forces a reshape, a delay, or a lost deal',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Expose what creates and maintains this commercial constraint — what\'s structural about it?',
      promptIntents: [
        'What in the current go-to-market model creates this constraint and what keeps it in place',
        'What internal dependencies or ways of working depend on this constraint remaining',
        'Where this constraint has gotten worse or better recently and what drove that',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface what removing this constraint would actually require — what is it protecting?',
      promptIntents: [
        'What the commercial model or proposition would have to fundamentally change to remove this constraint',
        'Who internally has the most to lose if this constraint is removed',
        'What this constraint is actually protecting — the real commercial or organisational reason it persists',
      ],
    },
  ],
};

// ══════════════════════════════════════════════════════════════
// DEFINE_APPROACH CONTRACTS
// Practical path from today to the vision.
// Works from concrete first step → conditions for success → failure modes.
// ══════════════════════════════════════════════════════════════

const DEFINE_APPROACH_DEFAULT: PhaseQuestionContract = {
  phase: 'DEFINE_APPROACH',
  workshopType: 'DEFAULT',
  customerAnchor: 'the people who use, depend on, or are served by this operation',
  subActorGuidance: 'Seed prompts should identify which specific sub-actors move first, what they do differently, and where the approach depends on their behaviour changing.',
  phaseFocus: 'Build the practical path from today to the vision through this lens. Start with what exists and what moves first — build outward to conditions for success and honest failure modes.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Identify the first concrete, real-world step — what exists today that gives this approach a foothold?',
      promptIntents: [
        'Where something like this already works, even partially, in this company today',
        'What the smallest viable version of this approach looks like in practice for real people doing the work',
        'Who needs to move first and what they would actually do differently from tomorrow',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Map what needs to be true for this approach to hold — what conditions, changes, and dependencies are required?',
      promptIntents: [
        'What has to change in how people work together, hand off, or make decisions for this to stick',
        'What the sequence of change looks like — what enables what, and what can\'t happen until something else does',
        'What evidence within the first 90 days would tell us this is working before we\'ve seen the full outcome',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface where this approach will stall and what the failure mode looks like — what is nobody saying?',
      promptIntents: [
        'Where this approach will hit its hardest resistance and what form that resistance will take',
        'What the slow failure mode looks like — the version that fails quietly rather than visibly',
        'What we\'re avoiding saying about this approach that would make it more honest and more likely to succeed',
      ],
    },
  ],
};

const DEFINE_APPROACH_GTM: PhaseQuestionContract = {
  phase: 'DEFINE_APPROACH',
  workshopType: 'GO_TO_MARKET',
  customerAnchor: 'the buyers this company most wants to win',
  subActorGuidance: 'Seed prompts should identify which commercial roles move first, what changes in how they engage buyers, and where the approach depends on internal alignment.',
  phaseFocus: 'Build the practical go-to-market path from today toward the market vision. Start with what exists commercially and what the commercial team does differently first.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Identify the first concrete commercial step — what exists today in how this company goes to market that gives this approach a foothold?',
      promptIntents: [
        'Where a version of this commercial approach is already working, even partially, today',
        'What the smallest viable version looks like for the commercial team in their next live deal or conversation',
        'Who in the commercial team moves first and what they do differently from tomorrow',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Map what needs to be true commercially for this approach to hold — what internal and external conditions are required?',
      promptIntents: [
        'What has to change internally (proposition clarity, commercial model, pricing, enablement) for this to be executable',
        'What the sequence looks like — what commercial changes enable others, and what can\'t happen until something else does',
        'What early commercial signal within 60-90 days would tell us this is working',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface where this commercial approach will stall — what is nobody saying about why it might not work?',
      promptIntents: [
        'Where this approach will hit its hardest internal or market resistance and what form that takes',
        'What the slow commercial failure mode looks like — the version where it drifts rather than fails clearly',
        'What we\'re not saying about this approach that would make it more honest and more executable',
      ],
    },
  ],
};

// ══════════════════════════════════════════════════════════════
// CONTRACT REGISTRY
// ══════════════════════════════════════════════════════════════

/**
 * All available phase contracts, indexed by phase + workshop type.
 * Contracts not explicitly defined fall back to DEFAULT.
 */
const CONTRACT_REGISTRY: PhaseQuestionContract[] = [
  // REIMAGINE
  REIMAGINE_DEFAULT,
  REIMAGINE_GTM,
  // CONSTRAINTS
  CONSTRAINTS_DEFAULT,
  CONSTRAINTS_GTM,
  // DEFINE_APPROACH
  DEFINE_APPROACH_DEFAULT,
  DEFINE_APPROACH_GTM,
];

/**
 * Retrieve the contract for a given phase and workshop type.
 * Falls back to DEFAULT if no specific contract exists for the workshop type.
 */
export function getQuestionContract(
  phase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH',
  workshopType: CanonicalWorkshopType | null | undefined,
): PhaseQuestionContract {
  const normalised = workshopType ?? 'DEFAULT';

  // Try exact match first
  const exact = CONTRACT_REGISTRY.find(
    (c) => c.phase === phase && c.workshopType === normalised,
  );
  if (exact) return exact;

  // Fall back to DEFAULT for this phase
  const fallback = CONTRACT_REGISTRY.find(
    (c) => c.phase === phase && c.workshopType === 'DEFAULT',
  );
  if (fallback) return fallback;

  throw new Error(`No question contract found for phase "${phase}" — this should never happen.`);
}

/**
 * Build a formatted contract block for inclusion in the LLM system prompt.
 * Describes exactly what to generate for each depth level for a given lens.
 */
export function buildLensContractBlock(
  contract: PhaseQuestionContract,
  lens: string,
  clientName: string,
  compact = false,
): string {
  function sub(s: string): string {
    return s.replace(/this company/g, clientName).replace(/this lens/g, lens);
  }

  if (compact) {
    // Compact form: one line per depth, seeds as short list
    const lines: string[] = [
      `[${lens}] Customer: ${sub(contract.customerAnchor)}`,
      `Sub-actors: ${sub(contract.subActorGuidance)}`,
      '',
    ];
    for (const slot of contract.depthLevels) {
      lines.push(`  ${slot.depth.toUpperCase()}: ${sub(slot.questionIntent)}`);
      lines.push(`    Seeds: ${slot.promptIntents.map((p, i) => `(${i + 1}) ${sub(p)}`).join(' | ')}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  const lines: string[] = [
    `CONTRACT FOR LENS: ${lens}`,
    `Customer anchor: ${sub(contract.customerAnchor)}`,
    `Sub-actor guidance: ${sub(contract.subActorGuidance)}`,
    '',
    `Generate exactly 3 questions for ${lens} in this order:`,
    '',
  ];

  for (const slot of contract.depthLevels) {
    lines.push(`[${slot.depth.toUpperCase()}]`);
    lines.push(`Purpose: ${sub(slot.questionIntent)}`);
    lines.push('Seed prompts must cover:');
    for (const [i, intent] of slot.promptIntents.entries()) {
      lines.push(`  ${i + 1}. ${sub(intent)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check whether a set of questions for a given lens has all three depth levels covered.
 * Returns the missing depth levels, or an empty array if complete.
 */
export function getMissingDepthLevels(
  questions: Array<{ depth?: string }>,
): DepthLevel[] {
  const required: DepthLevel[] = ['surface', 'depth', 'edge'];
  const present = new Set(questions.map((q) => q.depth).filter(Boolean));
  return required.filter((d) => !present.has(d));
}
