/**
 * Reasoning role classifier — deterministic, no LLM.
 *
 * Assigns each extracted meaning unit a structural role in the speaker's argument:
 *
 *   context     — establishes setting, background, or current state
 *   observation — describes what was seen, found, or noticed
 *   implication — draws a conclusion, consequence, or "so what"
 *   example     — gives a concrete instance illustrating a point
 *   correction  — corrects a misconception or challenges an assumption
 *
 * Priority order: correction → example → implication → context → observation (default).
 * Text is never modified.
 */

export type ReasoningRole = 'context' | 'observation' | 'implication' | 'example' | 'correction';

// Correction: challenges or corrects a misconception or wrong assumption
const CORRECTION_RE = /\b(but actually|the truth is|it turns out|not because|people (think|assume|believe)|the assumption is|what (people|they) (get wrong|miss|forget)|actually (no|that'?s|the)|in reality|contrary to|that'?s not (really|actually|quite|how)|actually that|actually what|not (really|quite|actually)|the reality is|misconception|it'?s not about)\b/i;

// Example: gives a concrete instance
const EXAMPLE_RE = /\b(for example|for instance|like when|imagine|let'?s say|take the case|i had|there was a|last (week|month|year|quarter)|one time|one case|in one (situation|case)|i (remember|recall)|i was (in|at|working)|we had a (case|situation|example)|a customer|a client|an agent|picture (this|a)|here'?s (an?|one))\b/i;

// Implication: draws a conclusion or consequence
const IMPLICATION_RE = /\b(which means|so what this means|the implication|therefore|this (tells|shows|means) us|so if (we|you)|what this (tells|shows|suggests)|the (lesson|takeaway|point) is|this is why|that'?s why|so (we|you) need|this is the reason|what matters (here|is)|the upshot|what that means|which suggests|meaning that|so the question (becomes|is)|what this points to)\b/i;

// Context: establishes background or current state
const CONTEXT_RE = /\b(currently|at the moment|right now (the|we|our)|in our (case|org|team|company|industry|world)|the (situation|context|background|landscape) (is|was)|we (have|are|operate|work in)|in terms of (the|our)|when it comes to|the (current|existing) (state|system|process|setup|model)|historically|traditionally|typically (what|when|the)|the way (it|we|things) (work(s)?|is|are)|at (this point|the moment))\b/i;

export function classifyReasoningRole(text: string): ReasoningRole {
  if (CORRECTION_RE.test(text)) return 'correction';
  if (EXAMPLE_RE.test(text))    return 'example';
  if (IMPLICATION_RE.test(text)) return 'implication';
  if (CONTEXT_RE.test(text))    return 'context';
  return 'observation';
}
