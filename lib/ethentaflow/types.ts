export interface DomainDefinition {
  id: string;
  name: string;
  synonyms: string[];
  ontology_terms: string[];
  causal_markers: string[];
  action_targets: string[];
  business_objects: string[];
  impact_surfaces: string[];
}

export interface LensPack {
  id: string;
  name: string;
  context: string;
  domains: DomainDefinition[];
}

export type ThoughtTypeHint =
  | 'problem'
  | 'constraint'
  | 'decision'
  | 'action'
  | 'target_state'
  | 'causal'
  | 'observation';

export interface ThoughtFeatures {
  word_count: number;
  sentence_count: number;
  has_subject: boolean;
  has_predicate: boolean;
  has_business_object: boolean;
  referential_dependency_score: number;
  opening_pronoun: string | null;
  has_external_reference: boolean;
  has_dangling_end: boolean;
  business_anchor_score: number;
  domain_term_hits: Record<string, number>;
  max_domain_hits: number;
  causal_signal_score: number;
  action_signal_score: number;
  constraint_signal_score: number;
  problem_signal_score: number;
  decision_signal_score: number;
  target_state_signal_score: number;
  specificity_score: number;
  has_proper_nouns: boolean;
  has_numeric_reference: boolean;
  vague_intensifiers: string[];
  ambiguity_score: number;
  primary_type_hint: ThoughtTypeHint | null;
  // Thought integrity signals
  has_continuation_signal: boolean;
  has_resolution_signal: boolean;
}

export interface ValidityResult {
  validity_score: number;
  decision: 'commit' | 'hold' | 'discard' | 'escalate';
  confidence: number;
  reasons: string[];
  hard_rule_applied: string | null;
  thought_completeness: 'complete' | 'developing' | 'fragment';
  score_breakdown: {
    self_containment: number;
    structural_completeness: number;
    business_anchor: number;
    signal_strength: number;
    specificity: number;
    continuity: number;
    referential_penalty: number;
    ambiguity_penalty: number;
    raw: number;
  };
}

export interface DomainScoreBreakdown {
  problem_location: number;
  causal_driver: number;
  action_target: number;
  ontology_match: number;
  cluster_continuity: number;
  impact_surface_penalty: number;
  final: number;
}

export interface DomainResult {
  primary_domain: string | null;
  secondary_domain: string | null;
  domain_scores: Record<string, number>;
  score_breakdown: Record<string, DomainScoreBreakdown>;
  confidence: number;
  evidence: Record<string, string[]>;
  decision_path: string;
}

export type ThoughtState =
  | 'idle'
  | 'capturing'
  | 'possible_pause'
  | 'merge_wait'
  | 'resolved_candidate'
  | 'committed'
  | 'discarded';

export interface ThoughtAttempt {
  id: string;
  version: number;
  speaker_id: string;
  chunks: string[];
  chunk_times: number[];   // arrival time (ms) for each chunk, parallel to chunks[]
  full_text: string;
  merged_from: string[];
  start_time_ms: number;
  last_chunk_time_ms: number;
  state: ThoughtState;
  features: ThoughtFeatures | null;
  validity: ValidityResult | null;
  domain: DomainResult | null;
  hold_started_ms: number | null;
  flagged_for_escalation: boolean;
}

export interface CommitCandidate {
  attempt: ThoughtAttempt;
  merge_expired: boolean;
  flagged_for_escalation: boolean;
}
