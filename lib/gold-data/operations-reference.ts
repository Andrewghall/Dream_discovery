import operationsDataset from './operations-discovery-gold.json';

type OperationsQuestionArchetype = {
  signal: string;
  examples: string[];
};

type OperationsDatasetContract = {
  data_inputs: string[];
  derived_views: string[];
  expected_outputs: string[];
};

type OperationsDatasetRules = {
  must_use_at_least: string[];
  preferred_supporting_inputs: string[];
  invalid_if_missing_required_dataset: boolean;
  invalid_if_questions_not_grounded_in_dataset: boolean;
  require_evidence_reference: boolean;
};

type OperationsGoldDataset = {
  workshop_type: 'OPERATIONS';
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
    invalid_if_reusable_without_context_change: boolean;
    invalid_if_answerable_without_dataset: boolean;
  };
  signals: string[];
  question_archetypes: OperationsQuestionArchetype[];
  workshop_dataset: OperationsDatasetContract;
  dataset_rules: OperationsDatasetRules;
  anti_patterns: string[];
  validation: string[];
};

const GOLD = operationsDataset as OperationsGoldDataset;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getOperationsGoldDataset(): OperationsGoldDataset {
  return GOLD;
}

export function buildOperationsGoldReferenceBlock(): string {
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
    `Required dataset inputs: ${GOLD.dataset_rules.must_use_at_least.join(', ')}`,
    `Preferred supporting inputs: ${GOLD.dataset_rules.preferred_supporting_inputs.join(', ')}`,
    'Use these as behavioural calibration examples only.',
    'Do not copy the wording verbatim into the final workshop output.',
    'Signals:',
    ...GOLD.signals.map((signal) => `- ${signal}`),
    'Dataset inputs:',
    ...GOLD.workshop_dataset.data_inputs.map((item) => `- ${item}`),
    'Derived views:',
    ...GOLD.workshop_dataset.derived_views.map((item) => `- ${item}`),
    'Expected outputs:',
    ...GOLD.workshop_dataset.expected_outputs.map((item) => `- ${item}`),
    'Anti-patterns:',
    ...GOLD.anti_patterns.map((pattern) => `- ${pattern}`),
    'Validation:',
    ...GOLD.validation.map((rule) => `- ${rule}`),
    'Reference question archetypes:',
    archetypeLines,
  ].join('\n');
}

export function isExactOperationsGoldQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return GOLD.question_archetypes.some((archetype) =>
    archetype.examples.some((example) => normalizeText(example) === normalized),
  );
}

export function getOperationsGoldSignals(): string[] {
  return [...GOLD.signals];
}

export function getOperationsGoldDatasetRules(): OperationsDatasetRules {
  return GOLD.dataset_rules;
}
