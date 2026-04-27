// MeasurementAgent — structured maturity measurement per lens.
// Each lens opens with a transition into the area, then asks three explicit questions:
//   1. Current score today (1–5)
//   2. Target score (1–5)
//   3. Where they end up in 18 months if nothing changes (sets trajectory)
// The participant states numbers directly; extraction prioritises explicit figures
// and falls back to qualitative inference only where numbers weren't given.

import OpenAI from 'openai';
import type { Lens, MaturityRating } from './types.js';

// ---------------------------------------------------------------------------
// Spoken measurement questions — one structured prompt per lens.
//
// Design:
//   - Opens by naming the area naturally ("Let's move into the people area...")
//   - Frames the scoring card visually before asking (participant sees 1–5 on screen)
//   - Asks three explicit dimensions in a single spoken flow:
//       current state today / where they need to be / 18-month do-nothing scenario
//   - The 18-month do-nothing answer gives trajectory directly:
//       lower than current → declining  |  same → flat  |  higher → improving
//   - Participant states numbers; extraction reads them off the answer.
//   - These numbers anchor and drive all the exploration questions that follow.
// ---------------------------------------------------------------------------
const SPOKEN_MEASUREMENT_QUESTIONS: Partial<Record<Lens, string>> = {
  people:
    "Let's move into the people side of the business. Before we dig into the detail, I'd like to get your honest read. On a scale of 1 to 5 — where 1 is poor and 5 is excellent — where would you rate the capability and effectiveness of your people today? Where do you need to be? And if you do nothing over the next 18 months, where do you realistically end up?",
  operations:
    "Let's move into operations and delivery. On a scale of 1 to 5, where would you rate how well your operations actually support what you're selling and delivering today? Where does it need to be? And if nothing changes over the next 18 months, where do you land?",
  technology:
    "Let's move into the technology side of the business. On a scale of 1 to 5, where would you rate your technology — in terms of what you can credibly demonstrate to buyers today? Where does it need to be? And if nothing changes in the next 18 months, where do you end up?",
  commercial:
    "Let's move into the commercial picture. On a scale of 1 to 5, where would you rate your commercial positioning — your ability to win the right deals, at the right price, with the right buyers, today? Where does it need to be? And if nothing changes over the next 18 months, where are you?",
  risk_compliance:
    "Let's move into risk and compliance. On a scale of 1 to 5, where would you rate your ability to navigate risk and compliance through a deal today — without it killing the timeline or the outcome? Where does it need to be? And if nothing changes in the next 18 months, where do you end up?",
  partners:
    "Let's move into the partner side of the business. On a scale of 1 to 5, where would you rate the strength and effectiveness of your partner relationships today — in terms of what they actually deliver in deals? Where does it need to be? And if nothing changes over the next 18 months, where do you end up?",
};

const EXTRACTION_SYSTEM_PROMPT = `You extract structured maturity ratings from a business discovery conversation.

Rating scale (for context):
  1 = Poor, weak, high risk, not credible
  2 = Fragile, inconsistent, some capability but not trusted enough
  3 = Solid and functional but not differentiated
  4 = Strong, trusted, credible and improving
  5 = Market-leading, proactive, differentiated and value-creating

The interviewer asked the participant THREE explicit questions:
  1. Where do you rate [area] TODAY on a scale of 1–5?
  2. Where do you NEED TO BE (target)?
  3. Where do you end up in 18 MONTHS IF NOTHING CHANGES?

Extract:
- current: the number they gave for TODAY (1–5 integer). If they said "about a 3" or "probably a 2", use that number.
- target: the number they gave for where they NEED TO BE (1–5 integer).
- trajectory: derived from their 18-month do-nothing answer vs current:
    • 18-month number < current → 'declining'
    • 18-month number = current → 'flat'
    • 18-month number > current → 'improving'
    If they didn't give an explicit 18-month number, infer from language:
    "getting worse" / "heading south" / "eroding" / "it'll decline" → declining
    "staying the same" / "not changing" / "stuck" / "plateauing" → flat
    "naturally improving" / "on its own" / "trending up" → improving

Priority rules:
- ALWAYS prefer explicit numbers the participant stated over inferred scores.
- If they gave all three numbers clearly, use them directly.
- Only fall back to qualitative inference if a number was not given.
- If current is genuinely ambiguous, default: current=3, target=4, trajectory='flat'

Return ONLY valid JSON with exactly these fields: current, target, trajectory`;

interface ExtractionResult {
  current: number;
  target: number;
  trajectory: 'improving' | 'flat' | 'declining';
}

export class MeasurementAgent {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  /** Returns the structured measurement prompt for the given lens.
   *
   * Each prompt transitions into the lens area, frames the 1–5 scale,
   * and asks current / target / 18-month-do-nothing in a single spoken flow.
   * The scoring card on screen anchors the scale visually so the voice
   * prompt doesn't need to explain 1–5 in detail.
   */
  getQuestion(lens: Lens): string {
    return SPOKEN_MEASUREMENT_QUESTIONS[lens]
      ?? "Let's move into this area of the business. On a scale of 1 to 5 — where 1 is poor and 5 is excellent — where would you rate where things stand today? Where do you need to be? And if nothing changes over the next 18 months, where do you end up?";
  }

  /** Extracts current/target/trajectory from the participant's response.
   *
   * Prioritises explicit numbers stated by the participant (e.g. "I'd say a 2 today,
   * I want to be at 4, and if we do nothing we'll be at 1"). Falls back to qualitative
   * inference only where numbers weren't given.
   */
  async extractRating(lens: Lens, response: string, turnId: string): Promise<MaturityRating> {
    const defaultRating: MaturityRating = {
      lensId: lens,
      current: 3,
      target: 4,
      trajectory: 'flat',
      capturedAt: Date.now(),
      rawResponse: response,
    };

    if (!response.trim()) return defaultRating;

    // Fast path: if the participant gave all three numbers explicitly, grab them directly.
    const fast = fastExtract(response);
    if (fast) {
      console.log(`[measurement] ${lens}: fast-extract current=${fast.current} target=${fast.target} trajectory=${fast.trajectory} turn=${turnId}`);
      return { lensId: lens, ...fast, capturedAt: Date.now(), rawResponse: response };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 80,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Lens: ${lens}\n\nParticipant response:\n"${response}"`,
          },
        ],
      }, { signal: controller.signal });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as Partial<ExtractionResult>;

      const current = clampScore(parsed.current ?? 3);
      const target = clampScore(parsed.target ?? 4);
      const trajectory = validateTrajectory(parsed.trajectory);

      console.log(`[measurement] ${lens}: current=${current} target=${target} trajectory=${trajectory} turn=${turnId}`);

      return {
        lensId: lens,
        current,
        target,
        trajectory,
        capturedAt: Date.now(),
        rawResponse: response,
      };
    } catch (err) {
      console.error(`[measurement] extraction failed for ${lens}, using default`, err);
      return {
        ...defaultRating,
        ...simpleRegexExtract(response),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (isNaN(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function validateTrajectory(v: unknown): 'improving' | 'flat' | 'declining' {
  if (v === 'improving' || v === 'flat' || v === 'declining') return v;
  return 'flat';
}

/**
 * Fast extraction when the participant gave all three numbers explicitly
 * in a clear pattern, e.g. "I'd say a 2 today, target is 4, and we'd be at 1
 * in 18 months." Avoids an LLM call when the data is obvious.
 *
 * Returns null if the pattern isn't clear enough to be confident.
 */
function fastExtract(text: string): ExtractionResult | null {
  // Match isolated digits 1–5 (not part of a larger number)
  const digits = [...text.matchAll(/\b([1-5])\b/g)].map(m => parseInt(m[1]!, 10));
  if (digits.length < 2) return null;

  // Need at least current + target. If three digits found in order, use them.
  // Heuristic: first = current, second = target, third (if present) = 18-month.
  if (digits.length >= 3) {
    const [current, target, eighteenMonth] = digits as [number, number, number, ...number[]];
    const trajectory = eighteenMonth < current ? 'declining' : eighteenMonth > current ? 'improving' : 'flat';
    return { current: clampScore(current), target: clampScore(target), trajectory };
  }

  // Only two numbers: current + target — trajectory from language
  if (digits.length === 2) {
    const [current, target] = digits as [number, number, ...number[]];
    const trajectory = simpleRegexExtract(text).trajectory ?? 'flat';
    return { current: clampScore(current), target: clampScore(target), trajectory };
  }

  return null;
}

/** Regex fallback for trajectory keywords and obvious single-score patterns. */
function simpleRegexExtract(text: string): Partial<ExtractionResult> {
  const result: Partial<ExtractionResult> = {};

  // Look for patterns like "a 3", "maybe 2", "probably a 4 out of 5"
  const scoreMatch = text.match(/\b(?:a\s+)?([1-5])\s*(?:out\s+of\s+5)?\b/);
  if (scoreMatch) result.current = clampScore(parseInt(scoreMatch[1]!, 10));

  // Trajectory keywords
  if (/improv|getting better|moving\s+(in\s+the\s+right\s+direction|forward)/i.test(text)) {
    result.trajectory = 'improving';
  } else if (/declin|getting worse|slipping|going backward|heading south|eroding/i.test(text)) {
    result.trajectory = 'declining';
  } else if (/stuck|stall|flat|tread|not\s+chang|same\s+place|staying the same/i.test(text)) {
    result.trajectory = 'flat';
  }

  return result;
}
