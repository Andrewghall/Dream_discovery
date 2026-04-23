import financeDataset from './finance-discovery-gold.json';

type FinanceQuestionArchetype = {
  signal: string;
  examples: string[];
};

type FinanceGoldDataset = {
  workshop_type: 'FINANCE';
  purpose: string;
  generation_sequence: string[];
  rules: {
    must_anchor_to: string[];
    single_signal_only: boolean;
    force_decision: string[];
    must_force_evidence: boolean;
    must_link: string[];
    prohibit_context_leakage: boolean;
    invalid_if_generic: boolean;
  };
  signals: string[];
  question_archetypes: FinanceQuestionArchetype[];
  anti_patterns: string[];
  validation: string[];
};

const GOLD = financeDataset as FinanceGoldDataset;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getFinanceGoldDataset(): FinanceGoldDataset {
  return GOLD;
}

export function buildFinanceGoldReferenceBlock(): string {
  const archetypeLines = GOLD.question_archetypes.map((archetype) => [
    `${archetype.signal}:`,
    ...archetype.examples.map((example) => `  - ${example}`),
  ].join('\n')).join('\n\n');

  return [
    `GOLD REFERENCE DATASET: ${GOLD.workshop_type}`,
    `Purpose: ${GOLD.purpose}`,
    `Generation sequence: ${GOLD.generation_sequence.join(' -> ')}`,
    `Must anchor to: ${GOLD.rules.must_anchor_to.join(', ')}`,
    `Force decisions: ${GOLD.rules.force_decision.join(', ')}`,
    `Must link: ${GOLD.rules.must_link.join(', ')}`,
    'Use these as behavioural calibration examples only.',
    'Do not copy the wording verbatim into the final workshop output.',
    'Signals:',
    ...GOLD.signals.map((signal) => `- ${signal}`),
    'Anti-patterns:',
    ...GOLD.anti_patterns.map((pattern) => `- ${pattern}`),
    'Validation:',
    ...GOLD.validation.map((rule) => `- ${rule}`),
    'Reference question archetypes:',
    archetypeLines,
  ].join('\n');
}

export function isExactFinanceGoldQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return GOLD.question_archetypes.some((archetype) =>
    archetype.examples.some((example) => normalizeText(example) === normalized),
  );
}

export function getFinanceGoldSignals(): string[] {
  return [...GOLD.signals];
}
