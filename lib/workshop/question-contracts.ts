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

export interface LensSpecificIntent {
  /** What this lens's surface question must force — distinct from every other lens */
  surface: string;
  /** What this lens's depth question must force — distinct from every other lens */
  depth: string;
  /** What this lens's edge question must force — distinct from every other lens */
  edge: string;
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
  /**
   * Per-lens question intents that OVERRIDE the generic depthLevels.questionIntent.
   * When present for a given lens, these replace the generic intent so each lens
   * forces a genuinely different line of thinking rather than the same template.
   */
  lensSpecificGuidance?: Record<string, LensSpecificIntent>;
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
      questionIntent: 'Surface what people in the room privately doubt or haven\'t committed to — what the proposition would require them to stop doing or what would become unrecognisable.',
      promptIntents: [
        'The version of this that competitors aren\'t doing and couldn\'t quickly copy',
        'What this company would have to fully commit to — and stop hedging on — to make this real',
        'What buyers would say is exactly what they\'ve been looking for if this company offered this',
      ],
    },
  ],
  lensSpecificGuidance: {
    'People': {
      surface: 'Challenge the BEHAVIOUR dimension: if this proposition were real, what would buyers see Capita\'s people doing — or no longer doing — in every commercial conversation? Ask about observable human behaviour, not aspiration.',
      depth: 'Make it concrete: what would a buyer experience differently in a conversation with Capita\'s people versus today? Ground in a specific type of interaction, not a general capability.',
      edge: 'Surface what Capita\'s people privately doubt about their own ability to show up this way — or what they would have to stop doing entirely for this version to be credible.',
    },
    'Commercial': {
      surface: 'Challenge the VALUE dimension: if this proposition existed today, what would a buyer be paying for — and could they explain that value clearly to someone who hadn\'t been in the room? Ask about buyer-side value perception, not internal pricing.',
      depth: 'Make it concrete: how would the commercial relationship itself feel different — the contract, the conversation, the moment a buyer signs? What would a buyer say they got that they couldn\'t get elsewhere?',
      edge: 'Surface the commercial commitment the room privately doubts is achievable — the version of the proposition that would require Capita to walk away from how it currently wins work.',
    },
    'Partners': {
      surface: 'Challenge the ECOSYSTEM dimension: which relationships, partnerships, or third parties would make this proposition more credible than Capita could achieve alone? Ask about who else needs to be part of making this real.',
      depth: 'Make it concrete: what would partners or ecosystem players need to do or commit to for this proposition to be deliverable? Where does Capita currently depend on others in ways buyers don\'t yet see?',
      edge: 'Surface which existing partner relationships would quietly undermine this vision — or what Capita would have to sacrifice in its ecosystem to truly own the proposition rather than share it.',
    },
  },
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
      questionIntent: 'Make the constraint real and specific — what actually happens when this hits, who deals with it, and why does it keep coming back? Use behavioural or grounding question shapes, not academic language about causes.',
      promptIntents: [
        'What it looks like in practice when this constraint surfaces — who is involved and what they have to do',
        'What other parts of the operation depend on this constraint remaining as it is',
        'Where the constraint has gotten worse or better recently and what drove that change',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface the consequence or the trade-off — what is this actually protecting, or what breaks if it stays in place? Use consequence or pressure question shapes. Do NOT ask "what would removing X require" or "what is the real cost of maintaining".',
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
      questionIntent: 'Make the GTM constraint visible — where does this limitation show up in how buyers experience the proposition or how deals progress?',
      promptIntents: [
        'The specific point in the deal cycle or buyer journey where this constraint surfaces',
        'Whether buyers or the internal team feel it first — and what it looks like for each',
        'How often this constraint forces a reshape, a delay, or a qualification loss',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the constraint observable in a live situation — what actually happens, who is involved, and what must be done because of it. Do not ask "what does it look like" generically — name the specific type of failure this lens creates.',
      promptIntents: [
        'What the specific breakdown looks like when this constraint surfaces in a real pursuit or conversation',
        'What internal dependencies keep this constraint in place',
        'Where this constraint has gotten materially worse or better recently',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Force the trade-off or consequence question — what is this protecting, or what does keeping it cost the proposition? Use pressure or consequence shapes. Do NOT reuse "what is it actually protecting" as a template.',
      promptIntents: [
        'What the proposition would have to fundamentally change or stop doing to remove this constraint',
        'Who internally has the most to lose if this constraint is removed',
        'What has stopped this from being resolved every time it has been raised',
      ],
    },
  ],
  lensSpecificGuidance: {
    'Risk/Compliance': {
      surface: 'Ask what gets EXCLUDED from the proposition because of regulatory exposure — not a general compliance challenge, but the specific promise that cannot be made or the specific buyer segment that cannot be pursued.',
      depth: 'Ask what a buyer must accept, qualify, or sign off on because of Capita\'s regulatory position — the specific friction point in the deal, not a generic compliance burden.',
      edge: 'Ask what Capita would have to stop promising entirely if it took this constraint seriously — the specific commitment that\'s being quietly overstated or left ambiguous.',
    },
    'Partners': {
      surface: 'Ask which part of the proposition Capita cannot deliver alone and where that dependency first becomes visible or uncomfortable in a buyer conversation.',
      depth: 'Ask what happens when a partner fails to perform or limits what Capita can guarantee — the specific accountability gap that surfaces in a live deal when Capita cannot answer for a third party.',
      edge: 'Ask what Capita would have to sacrifice in its partner model to truly own the proposition — what is being protected in the ecosystem that limits differentiation.',
    },
    'Technology': {
      surface: 'Ask what Capita can demonstrate versus what it is claiming — where the technology estate limits the credibility of the proposition in front of a buyer, not generically but at a specific moment.',
      depth: 'Ask what a specific technology gap or integration complexity means for what Capita can realistically offer in a live deal — the commitment that becomes harder to honour once the buyer understands the estate.',
      edge: 'Ask what in Capita\'s technology estate would need to be abandoned or replaced before the proposition could scale — what has been left unresolved because the cost of resolving it has been avoided.',
    },
    'Operations': {
      surface: 'Ask where Capita\'s delivery model diverges from the proposition scope — the specific place where what has been sold cannot be operationalised as promised.',
      depth: 'Ask what operational failure or handoff breakdown a buyer eventually discovers — the specific post-sale gap that undermines the proposition and damages renewal or expansion.',
      edge: 'Ask which operational structure is being kept in place even though it limits what can be offered — the model that nobody has publicly challenged because changing it would be disruptive.',
    },
    'Commercial': {
      surface: 'Ask where Capita\'s pricing, packaging, or contract structure makes the proposition harder to position — the specific commercial friction that appears in the GTM motion, not a generic commercial challenge.',
      depth: 'Ask what in the commercial model causes a buyer to question the value claim — the specific point in a live deal where the numbers, terms, or structure create doubt rather than confidence.',
      edge: 'Ask which part of Capita\'s commercial model has become a liability — where the pricing or contract structure actively works against the proposition it is supposed to support.',
    },
    'People': {
      surface: 'Ask where Capita\'s people capability creates a gap between how the proposition is positioned and how buyers actually experience it — the specific conversation that doesn\'t go the way it should.',
      depth: 'Ask what a buyer sees in a live deal when Capita\'s people cannot credibly deliver the proposition — the specific moment that shifts buyer confidence, not a general capability concern.',
      edge: 'Ask what Capita\'s people have privately accepted as their ceiling — the capability limitation that has never been publicly named and that the proposition is quietly written around.',
    },
  },
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
      questionIntent: 'Get specific about what needs to already be working — who or what moves first, what the sequence looks like, and what early signal tells us this is working. Avoid "conditions must be true" language. Use grounding or accountability question shapes.',
      promptIntents: [
        'What has to change in how people work together, hand off, or make decisions for this to stick',
        'What the sequence of change looks like — what enables what, and what can\'t happen until something else does',
        'What evidence within the first 90 days would tell us this is working before we\'ve seen the full outcome',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface where this approach will quietly stall — the failure mode nobody is naming. Use consequence or pressure question shapes. Do NOT ask "what potential resistance might arise" or "what conditions must be true".',
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
      questionIntent: 'Identify the first concrete, real-world step — what already exists today that gives this approach a foothold? Do NOT ask "what existing practices" — ask what happens first.',
      promptIntents: [
        'Where a version of this approach is already working, even partially, in a live deal or conversation today',
        'What the smallest viable version looks like in practice for the team doing the work tomorrow',
        'Who moves first and what they do differently — not a programme, a specific action',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Force the question of what must be PROVEN or STOPPED for this to be executable — not what changes are needed generically, but what specific decision cannot be avoided.',
      promptIntents: [
        'What must change in how people work together, hand off, or make decisions for this to stick',
        'What the sequence of change looks like — what enables what, and what cannot happen until something else does',
        'What early signal within 60-90 days would tell us this is working before the full outcome is visible',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface where this approach will quietly fail — the mode nobody is naming. Do NOT ask "where might this drift or stall" generically — name the specific failure type for this lens.',
      promptIntents: [
        'Where this approach hits its hardest resistance and what form that resistance takes',
        'What the slow failure mode looks like — the version that fails quietly rather than visibly',
        'What is being avoided in this room that would make the approach more honest and more likely to work',
      ],
    },
  ],
  lensSpecificGuidance: {
    'People': {
      surface: 'Ask what the first VISIBLE behaviour change looks like — not a plan or initiative, but a specific conversation that happens differently this week. Force the room to name a person and an action, not a programme.',
      depth: 'Ask what people must STOP doing to make space for this approach — not what must change broadly, but what specific habit or practice must end for this to be credible.',
      edge: 'Ask where this people approach will quietly get deprioritised — who reverts first and why the organisation allows it, not where it might stall generically.',
    },
    'Operations': {
      surface: 'Ask what operational change MUST happen first before anything else can work — the single unlocking step in the delivery model, not the first item on a roadmap.',
      depth: 'Ask what breaks in the operation if this approach is adopted but delivery hasn\'t changed — the specific failure point that emerges when a promise meets an unchanged process.',
      edge: 'Ask which operational structure will prevent this approach from scaling — what nobody has been willing to say needs to go because removing it would be disruptive to people in the room.',
    },
    'Technology': {
      surface: 'Ask what must be demonstrated in a live environment before the proposition can be credibly made — the specific technical proof point that turns a claim into evidence.',
      depth: 'Ask what technical commitment Capita must make that it has not yet made — the decision being avoided that the technology approach actually depends on.',
      edge: 'Ask where the technology dependency quietly becomes untenable at scale — what is being assumed about capability or integration that will not hold when deal volume or complexity increases.',
    },
    'Commercial': {
      surface: 'Ask what the first commercial WIN under the new approach looks like — not a deal type, but a specific buyer conversation that goes differently. What does a buyer say or do that doesn\'t happen today?',
      depth: 'Ask what the commercial model must stop doing to support the proposition — which existing commercial habit (pricing method, contract term, incentive structure) undermines the new approach.',
      edge: 'Ask what the buyer doubts about this commercial approach when they try to justify it internally — the specific point where the value claim does not survive scrutiny in the buyer\'s own organisation.',
    },
    'Risk/Compliance': {
      surface: 'Ask what compliance position must be established BEFORE the proposition can be made at scale — the specific regulatory proof point that unlocks the approach rather than blocking it.',
      depth: 'Ask what Capita is privately limiting in the proposition because the compliance position is not resolved — the specific exclusion or caveat that nobody has named but that buyers will eventually find.',
      edge: 'Ask what this compliance approach makes worse for buyers who need certainty — what is being sacrificed in the name of risk management that buyers would trade for a different offer entirely.',
    },
    'Partners': {
      surface: 'Ask which specific partner dependency must be resolved before the proposition is truly ownable — the third-party reliance that limits what can be promised, not partnerships generically.',
      depth: 'Ask what Capita gives up control of when it depends on partners — the specific accountability gap that a buyer will eventually discover and that Capita cannot fully answer for.',
      edge: 'Ask what Capita quietly sacrifices in proposition differentiation by relying on partners — what would be genuinely different if Capita owned this capability rather than sourcing it.',
    },
  },
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

  // Use lens-specific intents when available — these override the generic questionIntent
  // and force each lens to introduce a distinct line of thinking.
  const lensGuidance = contract.lensSpecificGuidance?.[lens];

  if (compact) {
    const lines: string[] = [
      `[${lens}] Customer: ${sub(contract.customerAnchor)}`,
      `Sub-actors: ${sub(contract.subActorGuidance)}`,
      '',
    ];
    for (const slot of contract.depthLevels) {
      const intent = lensGuidance
        ? sub(lensGuidance[slot.depth])
        : sub(slot.questionIntent);
      lines.push(`  ${slot.depth.toUpperCase()}: ${intent}`);
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
    const intent = lensGuidance
      ? sub(lensGuidance[slot.depth])
      : sub(slot.questionIntent);
    lines.push(`[${slot.depth.toUpperCase()}]`);
    lines.push(`Purpose: ${intent}`);
    if (lensGuidance) {
      lines.push(`NOTE: This intent is specific to the ${lens} lens. Do NOT reuse this question shape for any other lens.`);
    }
    lines.push('Seed prompts must cover:');
    for (const [i, promptIntent] of slot.promptIntents.entries()) {
      lines.push(`  ${i + 1}. ${sub(promptIntent)}`);
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
