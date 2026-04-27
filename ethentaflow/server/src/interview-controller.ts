// InterviewController — deterministic 6×5 state machine for EthentaFlow.
//
// 6 sections (People, Operations, Technology, Commercial, Customer, Partners)
// 5 questions per section (Q1: Score → Q2: Gap → Q3: Evidence → Q4: Root Cause → Q5: Impact)
// Hard transition after Q5 — no summaries, no validation, just "Good. Moving on."
// Max 25 words per probe (prefer 10–18), max 15 words for LLM-generated questions.

import OpenAI from 'openai';
import type { Lens } from './types.js';

export interface InterviewSection {
  index: number;
  lens: Exclude<Lens, 'open'>;
  name: string;
  shortLabel: string;
}

export const INTERVIEW_SECTIONS: InterviewSection[] = [
  { index: 1, lens: 'people',     name: 'People and Capability',   shortLabel: 'People' },
  { index: 2, lens: 'operations', name: 'Operations and Delivery', shortLabel: 'Operations' },
  { index: 3, lens: 'technology', name: 'Technology Credibility',  shortLabel: 'Technology' },
  { index: 4, lens: 'commercial', name: 'Commercial Positioning',  shortLabel: 'Commercial' },
  { index: 5, lens: 'customer',   name: 'Customer Relationships',  shortLabel: 'Customer' },
  { index: 6, lens: 'partners',   name: 'Partner Relationships',   shortLabel: 'Partners' },
];

export type QuestionType = 'score' | 'gap' | 'evidence' | 'root_cause' | 'impact';

export const QUESTION_TYPES: QuestionType[] = ['score', 'gap', 'evidence', 'root_cause', 'impact'];

export interface SectionCapture {
  currentScore?: number;
  targetScore?: number;
  driftScore?: number;
  trajectory?: 'improving' | 'flat' | 'declining';
  mainGap?: string;
  evidenceExample?: string;
  rootCause?: string;
  impact?: string;
}

// ---------------------------------------------------------------------------
// Q1 — specific, natural per-lens opening questions that ask for
// three scores: today / target / 18-month do-nothing scenario.
// These are the same questions the MeasurementAgent used — tested and human-sounding.
// ---------------------------------------------------------------------------
const Q1_QUESTIONS: Record<Exclude<Lens, 'open'>, string> = {
  people:
    "Let's move into the people side of the business. On a scale of 1 to 5 — where 1 is poor and 5 is excellent — where would you rate the capability and effectiveness of your people today? Where do you need to be? And if you do nothing over the next 18 months, where do you realistically end up?",
  operations:
    "Let's move into operations and delivery. On a scale of 1 to 5, where would you rate how well your operations actually support what you're selling and delivering today? Where does it need to be? And if nothing changes over the next 18 months, where do you land?",
  technology:
    "Let's move into the technology side of the business. On a scale of 1 to 5, where would you rate your technology — in terms of what you can credibly demonstrate to buyers today? Where does it need to be? And if nothing changes in the next 18 months, where do you end up?",
  commercial:
    "Let's move into the commercial picture. On a scale of 1 to 5, where would you rate your commercial positioning — your ability to win the right deals, at the right price, with the right buyers, today? Where does it need to be? And if nothing changes over the next 18 months, where are you?",
  customer:
    "Let's move into the customer side of the business. On a scale of 1 to 5 — where 1 is poor and 5 is excellent — where would you rate how well you understand, retain, and grow your customers today? Where do you need to be? And if nothing changes over the next 18 months, where do you end up?",
  risk_compliance:
    "Let's move into risk and compliance. On a scale of 1 to 5, where would you rate your ability to navigate risk and compliance through a deal today — without it killing the timeline or the outcome? Where does it need to be? And if nothing changes in the next 18 months, where do you end up?",
  partners:
    "Let's move into the partner side of the business. On a scale of 1 to 5, where would you rate the strength and effectiveness of your partner relationships today — in terms of what they actually deliver in deals? Where does it need to be? And if nothing changes over the next 18 months, where do you end up?",
};

const Q1_TEMPLATE = (section: InterviewSection): string =>
  Q1_QUESTIONS[section.lens] ??
  `On a scale of 1 to 5 — where do you rate ${section.name} today? Where do you need to be? And if nothing changes in 18 months, where do you end up?`;

// ---------------------------------------------------------------------------
// Q2 — why the gap exists (specific to each lens area)
// ---------------------------------------------------------------------------
const Q2_TEMPLATES: Record<Exclude<Lens, 'open'>, string> = {
  people:          "What's the specific capability missing in your team right now that's keeping you at that number?",
  operations:      "Where does delivery actually break down — is it process, ownership, or tooling?",
  technology:      "What can't you credibly demonstrate to a buyer today that you know you should be able to?",
  commercial:      "Is this a positioning problem, an ICP problem, or a GTM execution problem?",
  customer:        "How do you currently find out what customers actually value, and where is that understanding weakest?",
  risk_compliance: "What's the compliance gap that's most likely to kill a deal or slow it down?",
  partners:        "What are partners failing to deliver that they should be?",
};

// ---------------------------------------------------------------------------
// Q3 — evidence (real example, not necessarily about cost)
// ---------------------------------------------------------------------------
const Q3_TEMPLATES: Record<Exclude<Lens, 'open'>, string> = {
  people:          "Give me a real hire, project, or deal where that gap showed up.",
  operations:      "Give me a real delivery failure or near-miss where that broke down.",
  technology:      "Walk me through a deal where the technology story didn't hold up in front of a buyer.",
  commercial:      "Walk me through your current ICP — who are you actually selling to today?",
  customer:        "Walk me through the last customer you lost. What actually happened?",
  risk_compliance: "Give me a real deal where a compliance issue slowed you down or killed the outcome.",
  partners:        "Give me a deal where a partner gap directly hurt you.",
};

// ---------------------------------------------------------------------------
// Q4 — root cause (what specifically broke)
// ---------------------------------------------------------------------------
const Q4_TEMPLATES: Record<Exclude<Lens, 'open'>, string> = {
  people:          "What specifically broke — was it skills, leadership, or the structure around them?",
  operations:      "What was the actual root cause — process design, tools, or who owned it?",
  technology:      "What specifically couldn't you show or prove in that conversation?",
  commercial:      "Where does your GTM actually break down — top of funnel, close, or price?",
  customer:        "What specifically drove them away — value gap, service failure, or a competitor?",
  risk_compliance: "What specifically created the problem — policy gaps, process, or people?",
  partners:        "Was it misalignment, poor enablement, or the wrong partner profile?",
};

// ---------------------------------------------------------------------------
// Q5 — impact (varied per lens — not all about cost)
// ---------------------------------------------------------------------------
const Q5_TEMPLATES: Record<Exclude<Lens, 'open'>, string> = {
  people:          "What have you lost because of that — a deal, a key person, or a client relationship?",
  operations:      "What did it cost you — a renewal, a relationship, or time you didn't have?",
  technology:      "What was the real consequence — you lost the deal, lost credibility, or had to discount?",
  commercial:      "What's the deal size or revenue you know you're leaving on the table because of that gap?",
  customer:        "What did losing that customer actually cost you — revenue, referrals, or market credibility?",
  risk_compliance: "What was the outcome — delayed close, lost deal, or reputational damage?",
  partners:        "What did that cost you — a market opportunity, a deal, or a key relationship?",
};

const TRANSITION_PHRASES = [
  "Good. Moving on.",
  "That's enough there. Next section.",
  "Clear. Moving on.",
  "Right. Next section.",
  "Noted. Moving on.",
];

const BANNED_PHRASES = [
  "tell me more",
  "can you expand",
  "that's insightful",
  "thanks for sharing",
  "does that capture",
  "ready to move on",
  "would you like",
  "that tracks",
  "there it is",
  "makes sense",
  "i hear you",
  "absolutely",
  "great point",
  "interesting",
  "fascinating",
];

function validateLlmQuestion(text: string): boolean {
  if (!text.endsWith('?')) return false;
  const words = text.trim().split(/\s+/);
  if (words.length < 4 || words.length > 18) return false;
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) return false;
  }
  if (/[—–]/.test(text)) return false;
  const questionMarkCount = (text.match(/\?/g) ?? []).length;
  if (questionMarkCount !== 1) return false;
  return true;
}

export interface InterviewControllerJSON {
  sectionIndex: number;
  questionIndex: number;
  captures: Partial<SectionCapture>[];
  transitionCounter: number;
  sectionStartTimes?: number[]; // epoch ms when Q1 was spoken for each section (0 = not started)
}

// 4 min 30 sec hard cap per section — aim for 4–4.5 min, 22.5 min total (ms)
export const SECTION_OVERTIME_MS = 4.5 * 60 * 1000;

export class InterviewController {
  private _sectionIndex = 1; // 1–N (N = INTERVIEW_SECTIONS.length)
  private _questionIndex = 1; // 1–5
  private _captures: Partial<SectionCapture>[] = Array.from({ length: INTERVIEW_SECTIONS.length }, () => ({}));
  private _transitionCounter = 0;
  private _sectionStartTimes: number[] = Array(INTERVIEW_SECTIONS.length).fill(0); // epoch ms, 0 = not started
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  get sectionIdx(): number { return this._sectionIndex; }
  get questionIdx(): number { return this._questionIndex; }

  /** All section start timestamps (0 = not yet started). */
  get sectionStartTimes(): number[] { return [...this._sectionStartTimes]; }

  /** Record the moment Q1 was spoken for the current section. Idempotent — only sets once. */
  markSectionStart(): void {
    const idx = this._sectionIndex - 1;
    if (idx >= 0 && idx < INTERVIEW_SECTIONS.length && this._sectionStartTimes[idx] === 0) {
      this._sectionStartTimes[idx] = Date.now();
    }
  }

  /** Elapsed ms for a section (1-based index, default = current section). */
  sectionElapsedMs(sectionIdx?: number): number {
    const idx = (sectionIdx ?? this._sectionIndex) - 1;
    const start = this._sectionStartTimes[idx] ?? 0;
    return start === 0 ? 0 : Date.now() - start;
  }

  /** Whether the current section has exceeded the overtime cap (and we're past Q1). */
  get isOvertime(): boolean {
    return this._questionIndex > 1 && this.sectionElapsedMs() > SECTION_OVERTIME_MS;
  }

  /**
   * Force-advance to the next section immediately (skip remaining questions).
   * Returns same shape as advance().
   */
  forceAdvanceToNextSection(): { transitioned: boolean; complete: boolean } {
    this._questionIndex = 5; // position at Q5 so advance() will transition
    return this.advance();
  }

  get currentSection(): InterviewSection {
    return INTERVIEW_SECTIONS[this._sectionIndex - 1]!;
  }

  get currentQuestionType(): QuestionType {
    return QUESTION_TYPES[this._questionIndex - 1]!;
  }

  get isComplete(): boolean {
    return this._sectionIndex > INTERVIEW_SECTIONS.length;
  }

  get progressLabel(): string {
    if (this.isComplete) return 'S5/5 Q5/5';
    return `S${this._sectionIndex}/${INTERVIEW_SECTIONS.length} Q${this._questionIndex}/5`;
  }

  // ── Question generation ────────────────────────────────────────────────────

  /**
   * Generate the current question. For Q1 returns fixed template.
   * For Q2–Q5 attempts LLM generation with template fallback.
   */
  async generateCurrentQuestion(lastUtterance?: string): Promise<string> {
    if (this.isComplete) return '';
    const section = this.currentSection;
    const qType = this.currentQuestionType;

    if (qType === 'score') {
      return Q1_TEMPLATE(section);
    }

    return this.generateExplorationQuestion(section, qType, lastUtterance);
  }

  /**
   * Generate transition phrase + Q1 of the new (current) section.
   * Call AFTER advance() has moved to the new section.
   */
  generateTransitionAndQ1(): string {
    const phrase = TRANSITION_PHRASES[this._transitionCounter % TRANSITION_PHRASES.length]!;
    this._transitionCounter++;
    const section = this.currentSection;
    return `${phrase} ${Q1_TEMPLATE(section)}`;
  }

  // ── Signal extraction ──────────────────────────────────────────────────────

  async extractSignals(utterance: string, qType: QuestionType): Promise<Partial<SectionCapture>> {
    if (qType === 'score') {
      return this.extractScoreSignals(utterance);
    }
    return this.extractTextSignal(utterance, qType);
  }

  private extractScoreSignals(utterance: string): Partial<SectionCapture> {
    const digits = extractScoreDigits(utterance);
    if (digits.length === 0) return {};

    const result: Partial<SectionCapture> = {};

    if (digits.length >= 1) result.currentScore = digits[0];
    if (digits.length >= 2) result.targetScore = digits[1];
    if (digits.length >= 3) {
      result.driftScore = digits[2];
      const drift = digits[2]!;
      const current = digits[0]!;
      result.trajectory = drift < current ? 'declining' : drift > current ? 'improving' : 'flat';
    }

    // Infer trajectory from language if no 3rd number
    if (!result.trajectory) {
      const lower = utterance.toLowerCase();
      if (/improv|getting better|moving in the right|trending up/i.test(lower)) {
        result.trajectory = 'improving';
      } else if (/declin|getting worse|slipping|going backward|heading south|eroding/i.test(lower)) {
        result.trajectory = 'declining';
      } else {
        result.trajectory = 'flat';
      }
    }

    return result;
  }

  private async extractTextSignal(utterance: string, qType: QuestionType): Promise<Partial<SectionCapture>> {
    const fieldMap: Record<QuestionType, keyof SectionCapture> = {
      score: 'currentScore',
      gap: 'mainGap',
      evidence: 'evidenceExample',
      root_cause: 'rootCause',
      impact: 'impact',
    };
    const field = fieldMap[qType];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const prompt = buildSignalExtractionPrompt(qType, utterance);
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 60,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Extract a concise phrase (max 12 words) from the participant\'s answer. Return JSON with a single field "value" containing the extracted text, or null if nothing extractable.' },
          { role: 'user', content: prompt },
        ],
      }, { signal: controller.signal });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as { value?: string | null };
      if (parsed.value && typeof parsed.value === 'string' && parsed.value.trim().length > 0) {
        const trimmed = parsed.value.trim().slice(0, 120);
        return { [field]: trimmed };
      }
    } catch {
      // timeout or parse error — return empty
    } finally {
      clearTimeout(timer);
    }

    return {};
  }

  // ── State management ───────────────────────────────────────────────────────

  storeCapture(data: Partial<SectionCapture>): void {
    const idx = this._sectionIndex - 1;
    if (idx < 0 || idx >= 5) return;
    this._captures[idx] = { ...this._captures[idx], ...data };
  }

  /**
   * Advance the interview state by one question.
   * Returns { transitioned: true } if we moved to a new section,
   * { complete: true } if all sections are done.
   */
  advance(): { transitioned: boolean; complete: boolean } {
    if (this.isComplete) return { transitioned: false, complete: true };

    if (this._questionIndex < 5) {
      this._questionIndex++;
      return { transitioned: false, complete: false };
    }

    // Q5 done — advance to next section
    this._sectionIndex++;
    this._questionIndex = 1;

    if (this._sectionIndex > INTERVIEW_SECTIONS.length) {
      return { transitioned: true, complete: true };
    }

    return { transitioned: true, complete: false };
  }

  // ── Final synthesis ────────────────────────────────────────────────────────

  async generateFinalSynthesis(): Promise<string> {
    const lines: string[] = [];

    // Build context for synthesis
    const sectionSummaries: string[] = [];
    for (let i = 0; i < 5; i++) {
      const section = INTERVIEW_SECTIONS[i]!;
      const cap = this._captures[i] ?? {};
      const scoreStr = cap.currentScore !== undefined
        ? `${cap.currentScore} today, target ${cap.targetScore ?? '?'}, ${cap.trajectory ?? 'flat'}`
        : 'no score captured';
      sectionSummaries.push(`${section.shortLabel}: ${scoreStr}. Gap: ${cap.mainGap ?? 'not captured'}. Evidence: ${cap.evidenceExample ?? 'not captured'}. Root cause: ${cap.rootCause ?? 'not captured'}. Impact: ${cap.impact ?? 'not captured'}.`);
    }

    const contextBlock = sectionSummaries.join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `You are a business diagnostic interviewer. Produce a concise spoken synthesis covering:
1. A scores table (one line per section: "People: 2.5 today, target 4, declining")
2. Biggest gaps (one line per section)
3. Evidence examples (key deals or events mentioned)
4. Top 3 priority actions

End with exactly: "That's the full diagnostic. A written summary will follow."

Keep it tight — this will be spoken aloud. No filler phrases. No markdown.`,
          },
          {
            role: 'user',
            content: `Diagnostic data:\n${contextBlock}\n\nProduce the spoken synthesis.`,
          },
        ],
      }, { signal: controller.signal });

      const text = completion.choices[0]?.message?.content?.trim() ?? '';
      if (text.length > 20) return text;
    } catch {
      // fallback to template
    } finally {
      clearTimeout(timer);
    }

    // Template fallback
    lines.push("Here's what we've covered.");
    lines.push('');
    for (let i = 0; i < 5; i++) {
      const section = INTERVIEW_SECTIONS[i]!;
      const cap = this._captures[i] ?? {};
      if (cap.currentScore !== undefined) {
        lines.push(`${section.shortLabel}: ${cap.currentScore} today, target ${cap.targetScore ?? '?'}, ${cap.trajectory ?? 'flat'}.`);
      }
    }
    lines.push('');
    lines.push("That's the full diagnostic. A written summary will follow.");
    return lines.join('\n');
  }

  // ── Serialisation ──────────────────────────────────────────────────────────

  toJSON(): InterviewControllerJSON {
    return {
      sectionIndex: this._sectionIndex,
      questionIndex: this._questionIndex,
      captures: this._captures.map(c => ({ ...c })),
      transitionCounter: this._transitionCounter,
      sectionStartTimes: [...this._sectionStartTimes],
    };
  }

  static fromJSON(apiKey: string, data: InterviewControllerJSON): InterviewController {
    const ctrl = new InterviewController(apiKey);
    ctrl._sectionIndex = data.sectionIndex;
    ctrl._questionIndex = data.questionIndex;
    ctrl._captures = data.captures.map(c => ({ ...c }));
    ctrl._transitionCounter = data.transitionCounter;
    if (data.sectionStartTimes) ctrl._sectionStartTimes = [...data.sectionStartTimes];
    return ctrl;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async generateExplorationQuestion(
    section: InterviewSection,
    qType: QuestionType,
    lastUtterance?: string,
  ): Promise<string> {
    const templateMap: Record<QuestionType, Record<Exclude<Lens, 'open'>, string>> = {
      score:      Q2_TEMPLATES, // won't be used for score
      gap:        Q2_TEMPLATES,
      evidence:   Q3_TEMPLATES,
      root_cause: Q4_TEMPLATES,
      impact:     Q5_TEMPLATES,
    };

    const fallback = (templateMap[qType] as Record<string, string>)[section.lens]
      ?? (templateMap[qType] as Record<string, string>)[section.lens]
      ?? 'What else can you tell me about that?';

    const capture = this._captures[this._sectionIndex - 1] ?? {};

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    try {
      const systemPrompt = buildQuestionPrompt(section, qType, capture);
      const userMsg = lastUtterance
        ? `Participant just said: "${lastUtterance.slice(0, 200)}"\n\nTemplate question: "${fallback}"\n\nGenerate a sharper version that follows from what they said. Return ONLY the question. Max 18 words. Must end with ?. Never start with "Can you", "Could you", "So", "And", or "Well".`
        : `Template question: "${fallback}"\n\nReturn it as-is or sharpened. Max 18 words. Must end with ?. Never start with "Can you" or "Could you".`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 40,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
      }, { signal: controller.signal });

      const raw = (completion.choices[0]?.message?.content ?? '').trim();
      const cleaned = raw.replace(/^["']|["']$/g, '').trim();

      if (validateLlmQuestion(cleaned)) {
        return cleaned;
      }
    } catch {
      // timeout or LLM error — use template
    } finally {
      clearTimeout(timer);
    }

    return fallback;
  }
}

// ── Helper functions ───────────────────────────────────────────────────────

function buildQuestionPrompt(section: InterviewSection, qType: QuestionType, capture: Partial<SectionCapture>): string {
  const qDescriptions: Record<QuestionType, string> = {
    score: 'Ask for current score, target score, and 18-month trajectory',
    gap: 'Ask specifically what is holding them back from their target score',
    evidence: 'Ask for a specific real example — a deal, hire, project, or situation where the gap showed up',
    root_cause: 'Ask what specifically broke — drill into the precise failure point, referencing their example',
    impact: 'Ask what the consequence was — vary from cost/money; could be time, relationships, credibility, market',
  };

  const lines = [
    `You are a direct, experienced business interviewer. Section: "${section.name}".`,
    `Task: ${qDescriptions[qType]}`,
    '',
  ];

  // Build context chain — each question should feel like it follows naturally from what was said
  if (capture.currentScore !== undefined) {
    lines.push(`Their score: ${capture.currentScore}/5 (target: ${capture.targetScore ?? '?'}, trajectory: ${capture.trajectory ?? 'unknown'}).`);
  }
  if (capture.mainGap) {
    lines.push(`Gap they named: "${capture.mainGap}".`);
  }
  if (capture.evidenceExample) {
    lines.push(`Example they gave: "${capture.evidenceExample}".`);
  }
  if (capture.rootCause) {
    lines.push(`Root cause they identified: "${capture.rootCause}".`);
  }

  lines.push('');
  lines.push('Generate ONE sharp question that follows directly from what they said.');
  lines.push('Rules: max 18 words, end with ?, no em-dashes, no filler, no fluff, no validation.');
  lines.push('Never start with "So", "And", "Well", or "Now". Be direct.');

  return lines.join('\n');
}

/**
 * Extract 1–5 score digits from a transcript that may use word-form numbers.
 * Deepgram smart_format doesn't always convert spoken ratings to digits in
 * conversational speech — "a three out of five" stays as words, not "3 out of 5".
 * This normalises word forms before running the digit regex.
 */
function extractScoreDigits(text: string): number[] {
  // Replace written-out number words with their digit equivalents (whole word only)
  const normalised = text
    .replace(/\bone\b/gi, '1')
    .replace(/\btwo\b/gi, '2')
    .replace(/\bthree\b/gi, '3')
    .replace(/\bfour\b/gi, '4')
    .replace(/\bfive\b/gi, '5');
  return [...normalised.matchAll(/\b([1-5])\b/g)].map(m => parseInt(m[1]!, 10));
}

function buildSignalExtractionPrompt(qType: QuestionType, utterance: string): string {
  const fieldDescriptions: Record<QuestionType, string> = {
    score: 'Extract the current score number (1–5)',
    gap: 'Extract the main capability or performance gap mentioned (max 12 words)',
    evidence: 'Extract the key deal or event example given (max 12 words)',
    root_cause: 'Extract the root cause or specific failure described (max 12 words)',
    impact: 'Extract the business impact described — deal lost, margin, trust (max 12 words)',
  };

  return `Task: ${fieldDescriptions[qType]}\n\nParticipant said: "${utterance.slice(0, 400)}"\n\nReturn JSON: {"value": "extracted text or null"}`;
}
