import type { LensPack, ThoughtFeatures, ThoughtTypeHint } from './types';

// External pronoun opener — depends on prior context (first-person excluded: 'we'/'I' are self-anchoring)
const EXTERNAL_PRONOUN_OPENER = /^(it|this|that|those|these|he|she|they)\b/i;

// Dangling conjunction at end — speaker was mid-thought
const DANGLING_END = /\b(but|and|because|which|to|or|so|if|when|that|for|as|although|however|yet|whereas|since|unless|until)\s*[,.]?\s*$/i;

// Narrative bridges — mid-thought phrases that signal the idea is still unfolding
const NARRATIVE_BRIDGE = /\b(and then|after that|from there|at that point|that's when|which led|which caused|which meant|it didn't take long|so then|but then|throughout this|during this period|following this|at the same time|and at the same time)\b/i;

// Soft trailing connectors — ends with a multi-word phrase implying continuation
// (single-word cases are covered by DANGLING_END above)
const SOFT_TRAILING_CONNECTOR = /\b(and so|and because|but because|meaning that|leading to|which means|and we|and they|and it|and this|and that|so we|so they|so that|which then|and also|but also)\s*[,.]?\s*$/i;

// Open comparison — likening started but not resolved
const OPEN_COMPARISON = /\b(it('s| is| was) (like|similar to|comparable to)|kind of like|sort of like|in the same way|similar to what)\b/i;

// Open recommendation — recommendation opened without landing a conclusion
const OPEN_RECOMMENDATION = /\b(we should (probably|maybe|consider|think about|look at)|we might (want to|need to)|it (might|could|would) be worth|it would be good to|we could (probably|try to|think about))\b/i;

// External reference phrases — anchors outside this utterance
const EXTERNAL_REFERENCE_PHRASES = [
  /\b(after those|after the|after that|after he|after she|after they)\b/i,
  /\b(since that|since the|like I said|as I mentioned|as we discussed)\b/i,
  /\b(following the|during the|on those calls|about those calls|about that call|that meeting|from that|from those)\b/i,
  /\b(those calls|that issue|that problem|that conversation|that discussion)\b/i,
];

// Predicate verbs
const VERB_PATTERN = /\b(is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|can|need|want|think|know|see|say|said|mean|means|get|got|make|makes|take|takes|keep|kept|run|runs|goes|went|come|comes|work|works|use|uses|feel|feels|bring|brings|show|shows|tell|tells|build|built|create|creates|find|found|give|gives|move|moves|stop|stops|start|starts|help|helps|change|changes|allow|allows|require|requires|prevent|prevents|cause|causes|need|needs|fail|fails|break|breaks|lack|lacks|drive|drives|block|blocks|limit|limits|increase|increases|decrease|decreases|reduce|reduces|improve|improves|affect|affects|impact|impacts|depend|depends|scale|scales|support|supports|enable|enables|integrate|integrates)\b/i;

// Subject indicators
const SUBJECT_PATTERNS = /\b(the|our|this|that|we|I|they|it|there|one|each|every|a|an)\s+\w+/i;

// Business object indicators
const BUSINESS_OBJECT_PATTERNS = /\b(system|process|team|customer|client|budget|cost|revenue|data|platform|service|product|strategy|compliance|risk|performance|workflow|resource|contract|policy|vendor|supplier|partner|stakeholder|project|programme|initiative|capability|capacity)\b/i;

// Vague intensifiers — no business signal
const VAGUE_INTENSIFIER_TERMS = [
  'really', 'very', 'quite', 'pretty', 'honestly', 'actually', 'basically', 'literally',
  'absolutely', 'totally', 'completely', 'definitely', 'certainly', 'obviously',
  'clearly', 'frankly', 'truly', 'incredibly', 'amazingly', 'exciting', 'great', 'good',
  'bad', 'nice', 'interesting', 'important', 'significant', 'massive', 'huge', 'big',
];
const VAGUE_INTENSIFIER_PATTERN = new RegExp(`\\b(${VAGUE_INTENSIFIER_TERMS.join('|')})\\b`, 'gi');

// Proper nouns — title-case words not at sentence start
const PROPER_NOUN_PATTERN = /(?<!\.\s)(?<![A-Z][a-z]+\s)([A-Z][a-z]{2,})(?:\s[A-Z][a-z]+)*/g;

// Numeric references
const NUMERIC_PATTERN = /\b(\d+(?:[.,]\d+)?(?:\s*%|\s*percent|\s*million|\s*billion|\s*k\b)?|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bten\b|\bhundred\b|\bthousand\b)\b/i;

// Causal signals
const CAUSAL_PATTERNS = [
  /\b(because|due to|caused by|as a result of|leading to|results in|stems from|driven by|root cause|underlying|contributes to|triggers|creates)\b/i,
];

// Action signals
const ACTION_PATTERNS = [
  /\b(need to|should|must|have to|going to|plan to|will|intend to|want to|looking to|aim to|trying to)\s+\w+/i,
  /\b(we need|we should|we must|we have to|we are going to|we plan to|we want to)\b/i,
];

// Constraint signals
const CONSTRAINT_PATTERNS = [
  /\b(cannot|can't|won't|unable to|blocked by|prevented from|limited by|constrained by|lack|lacking|no capacity|no budget|no time|not enough|insufficient|shortage of|barrier|obstacle|blocker)\b/i,
];

// Problem signals
const PROBLEM_PATTERNS = [
  /\b(problem|issue|challenge|struggle|pain|failing|broken|not working|doesn't work|doesn't scale|risk|concern|gap|missing|absent|unclear|ambiguous|inconsistent|unreliable|slow|expensive|manual|error-prone|fragile)\b/i,
];

// Decision signals
const DECISION_PATTERNS = [
  /\b(decided|decision|agreed|chosen|selected|approved|rejected|going with|not going with|opted for|ruled out|committing to|we will not)\b/i,
];

// Target state signals
const TARGET_STATE_PATTERNS = [
  /\b(goal is|objective is|aim is|target is|vision is|want to achieve|need to get to|by end of|within \d|ideally|should look like|future state|to be|end state)\b/i,
];

// Specificity: named entities, numbers, percentages
const SPECIFICITY_INDICATORS = [
  NUMERIC_PATTERN,
  /\b[A-Z]{2,}\b/g, // acronyms
  /"[^"]+"/,         // quoted terms
  /\d{4}/,           // years
];

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(new RegExp(pattern.source, 'gi'));
  return matches ? matches.length : 0;
}

function scorePattern(text: string, patterns: RegExp[]): number {
  return Math.min(patterns.reduce((acc, p) => acc + (p.test(text) ? 1 : 0), 0) / patterns.length, 1);
}

export function extractFeatures(text: string, lensPack: LensPack): ThoughtFeatures {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean);
  const word_count = words.length;

  // Sentence count (approximate)
  const sentence_count = (t.match(/[.!?]+/g) || []).length || 1;

  // Structural
  const has_predicate = VERB_PATTERN.test(t);
  const has_subject = SUBJECT_PATTERNS.test(t);
  const has_business_object = BUSINESS_OBJECT_PATTERNS.test(t);

  // Referential dependency
  const externalPronouncMatch = EXTERNAL_PRONOUN_OPENER.exec(t);
  const opening_pronoun = externalPronouncMatch ? externalPronouncMatch[1].toLowerCase() : null;
  const has_external_reference = EXTERNAL_REFERENCE_PHRASES.some(p => p.test(t));

  let referential_dependency_score = 0;
  if (opening_pronoun) referential_dependency_score += 0.6;
  if (has_external_reference) referential_dependency_score += 0.4;
  referential_dependency_score = Math.min(referential_dependency_score, 1);

  const has_dangling_end = DANGLING_END.test(t);

  // Domain term hits
  const domain_term_hits: Record<string, number> = {};
  let total_domain_hits = 0;

  for (const domain of lensPack.domains) {
    let hits = 0;
    const allTerms = [
      ...domain.synonyms,
      ...domain.ontology_terms,
      ...domain.causal_markers,
      ...domain.action_targets,
      ...domain.business_objects,
    ];
    for (const term of allTerms) {
      if (t.toLowerCase().includes(term.toLowerCase())) hits++;
    }
    domain_term_hits[domain.id] = hits;
    total_domain_hits += hits;
  }

  const max_domain_hits = Math.max(...Object.values(domain_term_hits), 0);
  const business_anchor_score = Math.min(total_domain_hits / 3.0, 1.0);

  // Signal scores
  const causal_signal_score = scorePattern(t, CAUSAL_PATTERNS);
  const action_signal_score = scorePattern(t, ACTION_PATTERNS);
  const constraint_signal_score = scorePattern(t, CONSTRAINT_PATTERNS);
  const problem_signal_score = scorePattern(t, PROBLEM_PATTERNS);
  const decision_signal_score = scorePattern(t, DECISION_PATTERNS);
  const target_state_signal_score = scorePattern(t, TARGET_STATE_PATTERNS);

  // Specificity
  let specificity_score = 0;
  const has_numeric_reference = NUMERIC_PATTERN.test(t);
  if (has_numeric_reference) specificity_score += 0.4;

  const has_proper_nouns = (() => {
    const candidates = t.match(PROPER_NOUN_PATTERN) || [];
    // Filter out common non-proper words that start sentences
    const filtered = candidates.filter(c => !['The', 'Our', 'This', 'That', 'We', 'There', 'It', 'They'].includes(c));
    return filtered.length > 0;
  })();
  if (has_proper_nouns) specificity_score += 0.3;

  const acronymCount = (t.match(/\b[A-Z]{2,}\b/g) || []).length;
  if (acronymCount > 0) specificity_score += 0.2;

  specificity_score = Math.min(specificity_score, 1.0);

  // Vague intensifiers
  const vague_intensifiers: string[] = [];
  let m: RegExpExecArray | null;
  const vagueRegex = new RegExp(VAGUE_INTENSIFIER_PATTERN.source, 'gi');
  while ((m = vagueRegex.exec(t)) !== null) {
    vague_intensifiers.push(m[0].toLowerCase());
  }

  // Ambiguity score: vague intensifiers + low specificity + no business object
  const ambiguity_score = Math.min(
    (vague_intensifiers.length * 0.2) +
    (specificity_score < 0.2 ? 0.3 : 0) +
    (!has_business_object ? 0.2 : 0),
    1.0,
  );

  // Primary type hint
  let primary_type_hint: ThoughtTypeHint | null = null;
  const signalScores: [ThoughtTypeHint, number][] = [
    ['problem', problem_signal_score],
    ['constraint', constraint_signal_score],
    ['causal', causal_signal_score],
    ['action', action_signal_score],
    ['decision', decision_signal_score],
    ['target_state', target_state_signal_score],
  ];
  const topSignal = signalScores.reduce((best, cur) => cur[1] > best[1] ? cur : best, ['observation', 0] as [ThoughtTypeHint, number]);
  if (topSignal[1] > 0) primary_type_hint = topSignal[0];
  // fallback: if domain anchor but no signal, it's an observation
  if (!primary_type_hint && business_anchor_score > 0.2) primary_type_hint = 'observation';

  // Thought integrity signals
  const has_continuation_signal =
    NARRATIVE_BRIDGE.test(t) ||
    SOFT_TRAILING_CONNECTOR.test(t) ||
    OPEN_COMPARISON.test(t) ||
    OPEN_RECOMMENDATION.test(t);

  const sig_strength_local = Math.max(
    causal_signal_score, action_signal_score, constraint_signal_score,
    problem_signal_score, decision_signal_score, target_state_signal_score,
  );
  const is_structurally_complete = has_subject && has_predicate && has_business_object;
  const is_self_contained = referential_dependency_score < 0.4;

  const has_resolution_signal =
    !has_continuation_signal &&
    is_self_contained &&
    (business_anchor_score > 0 || has_business_object) &&
    (
      (is_structurally_complete && sig_strength_local > 0) ||
      (sig_strength_local > 0 && (specificity_score > 0 || has_proper_nouns || has_numeric_reference) && business_anchor_score > 0.2)
    );

  return {
    word_count,
    sentence_count,
    has_subject,
    has_predicate,
    has_business_object,
    referential_dependency_score,
    opening_pronoun,
    has_external_reference,
    has_dangling_end,
    business_anchor_score,
    domain_term_hits,
    max_domain_hits,
    causal_signal_score,
    action_signal_score,
    constraint_signal_score,
    problem_signal_score,
    decision_signal_score,
    target_state_signal_score,
    specificity_score,
    has_proper_nouns,
    has_numeric_reference,
    vague_intensifiers,
    ambiguity_score,
    primary_type_hint,
    has_continuation_signal,
    has_resolution_signal,
  };
}
