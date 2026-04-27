// Semantic completeness checker.
// The question is not "did they say a grammatically complete sentence?"
// The question is "have they finished their complete thought and are ready for a response?"
//
// Key distinction: "We've got around 14,000 people in the business" is a complete
// sentence but NOT a complete thought — it's the beginning of an explanation.
// A person who says that is about to continue. We must not interrupt them.

import OpenAI from 'openai';

// ── Answer contracts ─────────────────────────────────────────────────────────
// Each contract describes what a COMPLETE answer to a specific question type
// must contain. Checked before the LLM to prevent the model saying YES to
// a partial answer (e.g. "Three" to a question that needs three scores).
//
// Returns:
//   'NO'      — contract detectable and not met (skip LLM, return NO)
//   'YES'     — contract detectable and fully met (skip LLM, return YES)
//   'unknown' — no contract applies; fall through to LLM

// Detects triple-rating questions (asks for today / target / 18-month drift).
const TRIPLE_RATING_PROBE_RE =
  /scale of.{0,20}(one|1).{0,10}(five|5)|three.{0,15}(number|score)|one.{0,5}to.{0,5}five.{0,30}(today|rate|where)|where.*today.*where.*need|today.*target.{0,30}(eighteen|nothing changes|18)/i;

// Detects deal-example demand ("walk me through", "give me a real deal", etc.)
const DEAL_DEMAND_PROBE_RE =
  /walk me through.{0,20}(deal|last|loss|win|case)|give me.{0,15}(real deal|example|deal where)|which deal|real deal where|last deal|recent deal/i;

function checkAnswerContract(
  transcript: string,
  lastProbe: string,
): 'NO' | 'YES' | 'unknown' {
  // ── Triple-rating contract ──────────────────────────────────────────────
  // Question asks for three scores on a 1–5 scale.
  // "Three" or a single number cannot satisfy this — all three scores required.
  if (TRIPLE_RATING_PROBE_RE.test(lastProbe)) {
    const normalised = transcript
      .replace(/\bone\b/gi, '1').replace(/\btwo\b/gi, '2').replace(/\bthree\b/gi, '3')
      .replace(/\bfour\b/gi, '4').replace(/\bfive\b/gi, '5');
    const count = [...normalised.matchAll(/\b([1-5])\b/g)].length;
    if (count < 3) {
      console.log(`[semantic] contract FAIL — triple-rating needs 3 numbers, got ${count}`);
      return 'NO';
    }
    console.log(`[semantic] contract OK — triple-rating has ${count} numbers`);
    return 'YES';
  }

  // ── Deal-example contract ────────────────────────────────────────────────
  // Question demands a concrete deal reference. A vague description of < 15 words
  // is almost certainly not a deal example.
  if (DEAL_DEMAND_PROBE_RE.test(lastProbe)) {
    const wordCount = transcript.trim().split(/\s+/).length;
    if (wordCount < 15) {
      console.log(`[semantic] contract FAIL — deal demand needs ≥15 words, got ${wordCount}`);
      return 'NO';
    }
    // Has enough words — still let LLM confirm it's actually a deal example.
    return 'unknown';
  }

  return 'unknown';
}

// Fast-path NO: these tail patterns almost always mean the user is mid-sentence.
// Catches dangling articles, prepositions, conjunctions, and incomplete phrases
// without needing an LLM call.
const DANGLING_TAIL_RE = /\b(a|an|the|and|or|but|nor|so|yet|for|of|with|by|in|on|at|to|from|into|onto|that|which|who|whom|this|these|those|some|any|all|both|each|my|our|your|their|its|we|they|is|are|was|were|has|have|had|not|just|also|even|still|only|very|quite|really|when|where|because|if|although|though|since|after|before|until|unless|about|over|under|through|between|among|against|within|without|during|across|behind|beyond|beside|along)\s*$/i;

// Catches sentences that end abruptly with a partial word (e.g. "Some genuinely sharp operate")
// where the last "word" is unusually short to end a thought on, or clearly a stem not a full word.
// We check for very short tails that aren't common complete words.
const ABRUPT_END_RE = /\s+[a-z]{2,5}$/i;
const COMPLETE_SHORT_WORDS = /\b(go|do|be|so|to|up|in|on|me|us|we|it|is|am|are|can|may|say|see|get|let|try|run|end|now|yet|due|set|cut|put|got|did|had|was|yes|no|ok)\s*$/i;

const SYSTEM = `You are a conversation monitor deciding whether a speaker has FULLY finished their turn and is ready for a response.

You will be given the question that was asked and the speaker's transcript so far.

Reply with exactly one word:
- YES   — the speaker has FULLY completed their answer and is genuinely done speaking
- NO    — the speaker has only started their answer, is mid-explanation, paused mid-thought, or their sentence is incomplete
- NOISE — the transcript is background audio, a TV, a different person, or completely unrelated to the conversation

Rules — apply strictly:

ALWAYS return NO if:
- The transcript ends with an incomplete word or truncated phrase (e.g. "Some genuinely sharp operate" — "operate" is incomplete, the speaker was going to say "operators" or "operatives")
- The transcript ends with an incomplete noun phrase (e.g. "with a financial service" — clearly going to say "financial services firm" or similar)
- The speaker introduced a new topic or clause but did not finish it ("We've got pockets of real talent. Some genuinely sharp...")
- The last sentence opens a new thread but doesn't land ("And what's interesting is that...")
- The speaker used "So" or "Right" as an opener and has clearly started their story but not finished it
- A number or rating was given but no supporting context followed yet for an open-ended question
- The transcript ends with a preposition, article, conjunction, or incomplete clause

ALWAYS return YES if:
- The speaker has given a direct, complete answer to a specific question (e.g. "Yes" / "Three" / "About five million")
- The speaker has told a complete story with a clear ending or conclusion
- The speaker has given their full assessment with supporting evidence and a clear closing statement
- The speaker has explicitly signalled completion ("That's it" / "That's the story" / "Nothing more to add")

When genuinely unsure → return NO. It is always better to wait than to interrupt.

Examples:
- "I'd say we're at a two today. We've got pockets of real talent. Some genuinely sharp operate" → NO (incomplete word at end, clearly mid-sentence)
- "We had a deals team that closed a major outsourcing contract with a financial service" → NO (incomplete noun phrase — clearly going to name a firm)
- "We've got around 14,000 people in the business" → NO (opening of an explanation, not a complete answer)
- "Three. Today we're at three, target is five, and if nothing changes we'll drift to two." → YES (direct complete answer with all three numbers)
- "We lost the deal because the proposal arrived two days late and the client had already moved on" → YES (complete story with clear ending)
- "The issue is the team lack" → NO (incomplete — mid-sentence)
- "We need to be at a four" → NO (partial answer to a three-part question — still needs target and trajectory)`;

export type SemanticResult = 'YES' | 'NO' | 'NOISE';

export class SemanticCompletenessChecker {
  private client: OpenAI;
  private cache = new Map<string, SemanticResult>();

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async check(transcript: string, lastProbe: string): Promise<SemanticResult> {
    const trimmed = transcript.trim();
    if (!trimmed) return 'NO';

    // Fast-path NO: dangling tail detected without LLM
    if (DANGLING_TAIL_RE.test(trimmed)) {
      console.log(`[semantic] dangling tail → NO (fast path): "${trimmed.slice(-30)}"`);
      return 'NO';
    }

    // Fast-path NO: suspiciously abrupt ending (likely mid-word)
    // Check if the last ~word looks incomplete for a sentence ending
    if (ABRUPT_END_RE.test(trimmed) && !COMPLETE_SHORT_WORDS.test(trimmed)) {
      // Count words — only apply this check on longer transcripts where an abrupt stop is suspicious
      const wordCount = trimmed.split(/\s+/).length;
      if (wordCount > 6) {
        console.log(`[semantic] abrupt end → NO (fast path): "${trimmed.slice(-30)}"`);
        return 'NO';
      }
    }

    // Answer-contract check — lens-aware, runs before LLM to enforce structural
    // requirements (e.g. triple-rating question needs 3 numbers, not just one).
    const contractResult = checkAnswerContract(trimmed, lastProbe);
    if (contractResult !== 'unknown') return contractResult;

    const key = `${lastProbe}|||${trimmed}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 5,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Question asked: "${lastProbe}"\nSpeaker said: "${trimmed}"` },
        ],
      });

      const text = (response.choices[0]?.message?.content ?? '').trim().toUpperCase();

      let result: SemanticResult = 'NO';
      if (text.startsWith('YES')) result = 'YES';
      else if (text.startsWith('NOISE')) result = 'NOISE';

      console.log(`[semantic] "${trimmed.slice(0, 60)}" → ${result}`);

      this.cache.set(key, result);
      if (this.cache.size > 50) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) this.cache.delete(firstKey);
      }
      return result;
    } catch (err) {
      console.error('[semantic] check failed', err);
      return 'NO';
    }
  }

  reset(): void {
    this.cache.clear();
  }
}
