// synthesiser-v2: a separate LLM agent that turns the raw session state
// (ratings + evidence + role context + transcript) into the structured Dream
// Discovery report — per-lens structured sections, executive summary,
// key insights with verbatim quotes, input quality score, themes for the
// word cloud, and feedback to the interviewee.
//
// Runs in the background after each lens advance and at session end.
// Doesn't block the interview agent.

import OpenAI from 'openai';
import type { AgentState } from './agent-v2.js';
import { lensLabel } from './agent-v2.js';
import { getDiscoveryQuestion } from './discovery-questions.js';
import type { Lens } from './types.js';

export interface PerLensSynthesis {
  lens: Lens;
  label: string;
  question: string;
  /** 1-10 scale (the in-session 1-5 score is doubled to map to bands). */
  current: number | null;
  target: number | null;
  projected: number | null;
  strengths: string[];
  whatsWorking: string[];
  gaps: string[];
  painPoints: string[];
  friction: string[];
  barriers: string[];
  constraints: string[];
  futureVision: string[];
  supportNeeded: string[];
  /** Short summary headline for live-panel display. */
  headline?: string;
  summary?: string;
  themes: string[];
}

export interface KeyInsight {
  title: string;
  confidence: 'low' | 'medium' | 'high';
  description: string;
  /** Verbatim quotes from the participant's transcript supporting this insight. */
  quotes: string[];
}

export interface SynthesisOutput {
  perLens: Partial<Record<Lens, PerLensSynthesis>>;
  crossLensThemes: string[];
  executiveSummary: string;
  executiveTone: 'optimistic' | 'pragmatic' | 'cautious' | 'frustrated' | 'mixed';
  keyInsights: KeyInsight[];
  inputQualityScore: number; // 0-100
  inputQualityLabel: 'low' | 'medium' | 'high';
  inputQualityDescription: string;
  feedbackToInterviewee: string;
  /** Word-cloud terms with weight (frequency / importance) for size-varying display. */
  themesAndIntent: Array<{ term: string; weight: number }>;
  generatedAt: number;
  scope: 'partial' | 'final';
}

// ── Prompts ─────────────────────────────────────────────────────────────────

const PARTIAL_SYSTEM = `You synthesise raw discovery-interview state into a structured JSON object describing what the participant said, lens by lens.

Return ONLY valid JSON of this shape:
{
  "perLens": {
    "<lensKey>": {
      "headline": "single short line — the punch from this lens",
      "summary": "1-2 sentences capturing what they said",
      "themes": ["short phrase", ...],
      "strengths":     ["bullet — strengths or enablers in their words"],
      "whatsWorking":  ["bullet — what is working today"],
      "gaps":          ["bullet — gaps or challenges"],
      "painPoints":    ["bullet — pain points"],
      "friction":      ["bullet — friction or process drag"],
      "barriers":      ["bullet — barriers (e.g. budget, capability)"],
      "constraints":   ["bullet — hard constraints (regulation, policy)"],
      "futureVision":  ["bullet — what good looks like in their words"],
      "supportNeeded": ["bullet — what would help"]
    }
  },
  "crossLensThemes": ["short phrase", ...]
}

Rules:
- Stick to what the participant actually said. Don't invent.
- Bullet items are short — 6-15 words each. Use the participant's framing where possible.
- Themes: 2-4 word phrases — usable as word-cloud tags. 5-8 themes per lens.
- crossLensThemes: only the patterns that show up in 2+ lenses. Empty array if none yet.
- Empty arrays for any section the participant didn't address. Don't fabricate.`;

const FINAL_SYSTEM = `You synthesise the full discovery interview into a structured JSON object that will populate a multi-page Dream Discovery report.

Return ONLY valid JSON of this shape:
{
  "perLens": {
    "<lensKey>": {
      "headline": "single short headline — the punch from this lens",
      "summary": "2-3 sentences capturing the heart of what they said",
      "themes": ["short phrase", ...],
      "strengths":     ["bullet — strengths or enablers (3-5 bullets)"],
      "whatsWorking":  ["bullet — what is working today (2-4 bullets)"],
      "gaps":          ["bullet — gaps or challenges (3-5 bullets)"],
      "painPoints":    ["bullet — concrete pain points (1-3 bullets)"],
      "friction":      ["bullet — process or workflow friction (1-3 bullets)"],
      "barriers":      ["bullet — barriers like budget, capability (1-2 bullets)"],
      "constraints":   ["bullet — hard constraints e.g. regulation (1-2 bullets)"],
      "futureVision":  ["bullet — what good looks like in their words (2-3 bullets)"],
      "supportNeeded": ["bullet — what would help (1-3 bullets)"]
    }
  },
  "crossLensThemes": ["short phrase", ...],
  "executiveSummary": "2 paragraphs — what the role-holder is dealing with, where strengths sit, where gaps and risks sit. Reference their actual words and examples.",
  "executiveTone": "optimistic | pragmatic | cautious | frustrated | mixed",
  "keyInsights": [
    {
      "title": "1. <punchy title>",
      "confidence": "low | medium | high",
      "description": "1-2 sentences explaining the insight",
      "quotes": ["VERBATIM quote 1 from the transcript", "VERBATIM quote 2"]
    }
  ],
  "inputQualityScore": <integer 0-100>,
  "inputQualityLabel": "low | medium | high",
  "inputQualityDescription": "1-2 sentences on whether the responses were detailed and grounded in examples",
  "feedbackToInterviewee": "1 paragraph thanking them, briefly noting the value of what they shared, framed for delivery to the participant",
  "themesAndIntent": [{ "term": "data", "weight": 9 }, { "term": "handoffs", "weight": 8 }, ...]
}

Rules:
- Stick to what the participant actually said. Don't invent. Pull verbatim quotes only from real transcript content.
- Provide 3-5 keyInsights. Each must have at least 1 verbatim quote.
- inputQualityScore: 80+ if grounded with specific examples and numbers; 60-79 if mostly opinion-led; below 60 if vague or missing.
- themesAndIntent: 15-25 terms total across the whole session. Weight 1-10 indicating prominence in their answers.
- crossLensThemes: 4-8 patterns appearing across 2+ lenses.
- Bullet sections: keep terse (6-15 words), use their framing. If they didn't address a section, return an empty array — never fabricate.
- The bullet sections MUST be derived from what they said, not generic best practice. If they didn't mention barriers, leave barriers empty.`;

const PER_LENS_SYSTEM = `You synthesise a SINGLE lens of a discovery interview into a structured JSON object.

Return ONLY valid JSON of this shape:
{
  "headline": "single short headline — the punch from this lens",
  "summary": "1-2 sentences capturing the heart of what they said",
  "themes": ["short phrase", ...],
  "strengths":     ["bullet — strengths or enablers (3-5 bullets)"],
  "whatsWorking":  ["bullet — what is working today (2-4 bullets)"],
  "gaps":          ["bullet — gaps or challenges (3-5 bullets)"],
  "painPoints":    ["bullet — concrete pain points (1-3 bullets)"],
  "friction":      ["bullet — process or workflow friction (1-3 bullets)"],
  "barriers":      ["bullet — barriers like budget, capability (1-2 bullets)"],
  "constraints":   ["bullet — hard constraints e.g. regulation (1-2 bullets)"],
  "futureVision":  ["bullet — what good looks like in their words (2-3 bullets)"],
  "supportNeeded": ["bullet — what would help (1-3 bullets)"]
}

Rules:
- Stick to what the participant actually said for THIS lens. Don't invent.
- Bullet items are short — 6-15 words each. Use the participant's framing where possible.
- Themes: 2-4 word phrases. 5-8 themes per lens.
- Empty arrays for any section the participant didn't address. Don't fabricate.`;

/** Synthesise one lens. Fast — single LLM call against just that lens's data. */
export async function synthesiseOneLens(args: {
  client: OpenAI;
  state: AgentState;
  lens: Lens;
  model?: string;
}): Promise<PerLensSynthesis | null> {
  const { state, lens } = args;
  const r = state.ratings.get(lens);
  const e = state.evidence.get(lens) ?? [];
  const q = getDiscoveryQuestion(lens);
  // Even without captured rating or explicit evidence, synthesise from the
  // transcript if the lens label was discussed. Empty conversations still
  // produce a structured (mostly empty) lens block — better than skipping.
  const conversationText = state.conversation.map(c => c.content).join(' ').toLowerCase();
  const lensMentioned = conversationText.includes(lensLabel(lens).toLowerCase()) || conversationText.includes(lens.toLowerCase());
  if (!r && e.length === 0 && !lensMentioned) return null;

  const lensTranscript = state.conversation.filter((_, idx) => {
    // Rough heuristic: include conversation turns that mention the lens or
    // happened after it became current. For simplicity, send all transcript —
    // gpt-4o-mini handles it fine and the model picks out the relevant bits.
    return true;
  });

  const userPayload = {
    participant: {
      name: state.participantName,
      title: state.participantTitle,
      company: state.participantCompany,
      roleDescription: state.participantRoleDescription,
    },
    lens: {
      key: lens,
      label: lensLabel(lens),
      question: q?.text ?? '',
      today: r?.today ?? null,
      target: r?.target ?? null,
      drift: r?.drift ?? null,
      reason: r?.reason ?? null,
      evidence: e,
    },
    transcript: lensTranscript,
  };

  const completion = await args.client.chat.completions.create({
    model: args.model ?? 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PER_LENS_SYSTEM },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
  });

  let parsed: any = {};
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
  } catch {
    console.warn(`[synthesiser] failed to parse lens=${lens} response`);
  }

  const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const toTen = (v: number | null | undefined) => v == null ? null : Math.max(1, Math.min(10, v * 2));

  return {
    lens,
    label: lensLabel(lens),
    question: q?.text ?? '',
    current: toTen(r?.today),
    target: toTen(r?.target),
    projected: toTen(r?.drift),
    strengths: arr(parsed.strengths),
    whatsWorking: arr(parsed.whatsWorking),
    gaps: arr(parsed.gaps),
    painPoints: arr(parsed.painPoints),
    friction: arr(parsed.friction),
    barriers: arr(parsed.barriers),
    constraints: arr(parsed.constraints),
    futureVision: arr(parsed.futureVision),
    supportNeeded: arr(parsed.supportNeeded),
    headline: typeof parsed.headline === 'string' ? parsed.headline : undefined,
    summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
    themes: arr(parsed.themes).slice(0, 10),
  };
}

const SESSION_LEVEL_SYSTEM = `You produce the SESSION-LEVEL synthesis: executive summary, key insights with verbatim quotes, input quality assessment, themes/intent for the word cloud, and feedback to the interviewee. Per-lens content has already been processed separately — focus on the cross-cutting picture.

Return ONLY valid JSON of this shape:
{
  "crossLensThemes": ["short phrase", ...],
  "executiveSummary": "2 paragraphs — what the role-holder is dealing with, where strengths sit, where gaps and risks sit. Reference their actual words.",
  "executiveTone": "optimistic | pragmatic | cautious | frustrated | mixed",
  "keyInsights": [
    { "title": "1. <punchy title>", "confidence": "low | medium | high", "description": "1-2 sentences", "quotes": ["VERBATIM quote 1", "VERBATIM quote 2"] }
  ],
  "inputQualityScore": <integer 0-100>,
  "inputQualityLabel": "low | medium | high",
  "inputQualityDescription": "1-2 sentences on whether responses were grounded in examples",
  "feedbackToInterviewee": "1 paragraph addressed to them",
  "themesAndIntent": [{ "term": "data", "weight": 9 }, ...]
}

Rules:
- Pull verbatim quotes only from real transcript content.
- 3-5 keyInsights, each with at least 1 verbatim quote.
- inputQualityScore: 80+ if grounded with specific examples and numbers; 60-79 if mostly opinion-led; below 60 if vague.
- themesAndIntent: 15-25 terms total. Weight 1-10 indicating prominence.
- crossLensThemes: 4-8 patterns appearing across 2+ lenses.`;

export interface SessionLevelSynthesis {
  crossLensThemes: string[];
  executiveSummary: string;
  executiveTone: 'optimistic' | 'pragmatic' | 'cautious' | 'frustrated' | 'mixed';
  keyInsights: KeyInsight[];
  inputQualityScore: number;
  inputQualityLabel: 'low' | 'medium' | 'high';
  inputQualityDescription: string;
  feedbackToInterviewee: string;
  themesAndIntent: Array<{ term: string; weight: number }>;
}

/** Run the session-level synthesis (exec summary, key insights, etc.) using
 *  a higher-quality model. Called at session end. */
export async function synthesiseSessionLevel(args: {
  client: OpenAI;
  state: AgentState;
  model?: string;
}): Promise<SessionLevelSynthesis> {
  const { state } = args;
  const lensSummaries = state.lensSequence.map(l => {
    const r = state.ratings.get(l);
    const e = state.evidence.get(l) ?? [];
    return {
      lens: l,
      label: lensLabel(l),
      today: r?.today ?? null,
      target: r?.target ?? null,
      drift: r?.drift ?? null,
      reason: r?.reason ?? null,
      evidence: e,
    };
  });

  const userPayload = {
    participant: {
      name: state.participantName,
      title: state.participantTitle,
      company: state.participantCompany,
      roleDescription: state.participantRoleDescription,
    },
    lenses: lensSummaries,
    transcript: state.conversation,
  };

  const completion = await args.client.chat.completions.create({
    model: args.model ?? 'gpt-4o',
    temperature: 0.25,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SESSION_LEVEL_SYSTEM },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
  });

  let parsed: any = {};
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
  } catch {
    console.warn('[synthesiser] failed to parse session-level response');
  }
  const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  const insights: KeyInsight[] = Array.isArray(parsed.keyInsights)
    ? parsed.keyInsights.slice(0, 5).map((i: any) => ({
        title: typeof i.title === 'string' ? i.title : '',
        confidence: ['low', 'medium', 'high'].includes(i.confidence) ? i.confidence : 'medium',
        description: typeof i.description === 'string' ? i.description : '',
        quotes: arr(i.quotes).slice(0, 3),
      }))
    : [];

  const themesAndIntent: Array<{ term: string; weight: number }> = Array.isArray(parsed.themesAndIntent)
    ? parsed.themesAndIntent
        .map((t: any) => ({
          term: typeof t.term === 'string' ? t.term : (typeof t === 'string' ? t : ''),
          weight: typeof t.weight === 'number' ? Math.max(1, Math.min(10, t.weight)) : 5,
        }))
        .filter((t: any) => t.term.length > 0)
        .slice(0, 30)
    : [];

  return {
    crossLensThemes: arr(parsed.crossLensThemes).slice(0, 12),
    executiveSummary: typeof parsed.executiveSummary === 'string' ? parsed.executiveSummary : '',
    executiveTone: ['optimistic', 'pragmatic', 'cautious', 'frustrated', 'mixed'].includes(parsed.executiveTone)
      ? parsed.executiveTone : 'pragmatic',
    keyInsights: insights,
    inputQualityScore: typeof parsed.inputQualityScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.inputQualityScore))) : 70,
    inputQualityLabel: ['low', 'medium', 'high'].includes(parsed.inputQualityLabel) ? parsed.inputQualityLabel : 'medium',
    inputQualityDescription: typeof parsed.inputQualityDescription === 'string' ? parsed.inputQualityDescription : '',
    feedbackToInterviewee: typeof parsed.feedbackToInterviewee === 'string' ? parsed.feedbackToInterviewee : '',
    themesAndIntent,
  };
}

// ── Synthesiser entry point ─────────────────────────────────────────────────

export async function synthesiseSession(args: {
  client: OpenAI;
  state: AgentState;
  scope: 'partial' | 'final';
  model?: string;
}): Promise<SynthesisOutput> {
  const { state, scope } = args;
  const completedLenses = state.lensSequence.filter(l => {
    if (scope === 'final') return state.ratings.has(l) || (state.evidence.get(l)?.length ?? 0) > 0;
    return l !== state.currentLens && (state.ratings.has(l) || (state.evidence.get(l)?.length ?? 0) > 0);
  });

  const lensData = completedLenses.map(lens => {
    const r = state.ratings.get(lens);
    const e = state.evidence.get(lens) ?? [];
    const q = getDiscoveryQuestion(lens);
    return {
      lens,
      label: lensLabel(lens),
      question: q?.text ?? '',
      today: r?.today ?? null,
      target: r?.target ?? null,
      drift: r?.drift ?? null,
      reason: r?.reason ?? null,
      evidence: e,
    };
  });

  const userPayload = {
    participant: {
      name: state.participantName,
      title: state.participantTitle,
      company: state.participantCompany,
      roleDescription: state.participantRoleDescription,
    },
    lenses: lensData,
    transcript: state.conversation,
    scope,
  };

  const completion = await args.client.chat.completions.create({
    model: args.model ?? 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: scope === 'final' ? FINAL_SYSTEM : PARTIAL_SYSTEM },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
  });

  let parsed: any = {};
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
  } catch {
    console.warn('[synthesiser] failed to parse JSON response');
  }

  const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const numOrNull = (v: unknown): number | null => typeof v === 'number' ? v : null;
  // 1-5 in-session score → 1-10 report score for visual consistency with
  // the existing Dream Discovery PDF format (which uses 1-10 maturity bands).
  const toTen = (v: number | null) => v == null ? null : Math.max(1, Math.min(10, v * 2));

  const perLens: Partial<Record<Lens, PerLensSynthesis>> = {};
  for (const ld of lensData) {
    const raw = parsed.perLens?.[ld.lens] ?? {};
    perLens[ld.lens] = {
      lens: ld.lens,
      label: ld.label,
      question: ld.question,
      current: toTen(ld.today),
      target: toTen(ld.target),
      projected: toTen(ld.drift),
      strengths: arr(raw.strengths),
      whatsWorking: arr(raw.whatsWorking),
      gaps: arr(raw.gaps),
      painPoints: arr(raw.painPoints),
      friction: arr(raw.friction),
      barriers: arr(raw.barriers),
      constraints: arr(raw.constraints),
      futureVision: arr(raw.futureVision),
      supportNeeded: arr(raw.supportNeeded),
      headline: typeof raw.headline === 'string' ? raw.headline : undefined,
      summary: typeof raw.summary === 'string' ? raw.summary : undefined,
      themes: arr(raw.themes).slice(0, 10),
    };
  }

  const insights: KeyInsight[] = Array.isArray(parsed.keyInsights)
    ? parsed.keyInsights.slice(0, 5).map((i: any) => ({
        title: typeof i.title === 'string' ? i.title : '',
        confidence: ['low', 'medium', 'high'].includes(i.confidence) ? i.confidence : 'medium',
        description: typeof i.description === 'string' ? i.description : '',
        quotes: arr(i.quotes).slice(0, 3),
      }))
    : [];

  const themesAndIntent: Array<{ term: string; weight: number }> = Array.isArray(parsed.themesAndIntent)
    ? parsed.themesAndIntent
        .map((t: any) => ({
          term: typeof t.term === 'string' ? t.term : (typeof t === 'string' ? t : ''),
          weight: typeof t.weight === 'number' ? Math.max(1, Math.min(10, t.weight)) : 5,
        }))
        .filter((t: any) => t.term.length > 0)
        .slice(0, 30)
    : [];

  return {
    perLens,
    crossLensThemes: arr(parsed.crossLensThemes).slice(0, 12),
    executiveSummary: typeof parsed.executiveSummary === 'string' ? parsed.executiveSummary : '',
    executiveTone: ['optimistic', 'pragmatic', 'cautious', 'frustrated', 'mixed'].includes(parsed.executiveTone)
      ? parsed.executiveTone
      : 'pragmatic',
    keyInsights: insights,
    inputQualityScore: typeof parsed.inputQualityScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.inputQualityScore)))
      : 70,
    inputQualityLabel: ['low', 'medium', 'high'].includes(parsed.inputQualityLabel) ? parsed.inputQualityLabel : 'medium',
    inputQualityDescription: typeof parsed.inputQualityDescription === 'string' ? parsed.inputQualityDescription : '',
    feedbackToInterviewee: typeof parsed.feedbackToInterviewee === 'string' ? parsed.feedbackToInterviewee : '',
    themesAndIntent,
    generatedAt: Date.now(),
    scope,
  };
}

// ── Dream Discovery handoff ─────────────────────────────────────────────────
// At session end, the captured data is POSTed to Dream so it can land in the
// workshop scratchpad / HTML export pipeline.

export interface DreamHandoffPayload {
  source: 'ethentaflow';
  sessionId: string;
  participant: {
    name?: string;
    title?: string;
    company?: string;
    roleDescription?: string;
  };
  workshopId?: string;
  participantToken?: string;
  ratings: Array<{ lens: string; today: number | null; target: number | null; drift: number | null; reason: string | null }>;
  evidence: Array<{ lens: string; statements: string[] }>;
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>;
  synthesis: SynthesisOutput;
  startedAt: number;
  endedAt: number;
}

export function buildDreamHandoff(args: {
  state: AgentState;
  sessionId: string;
  workshopId?: string;
  participantToken?: string;
  synthesis: SynthesisOutput;
}): DreamHandoffPayload {
  const { state, sessionId, workshopId, participantToken, synthesis } = args;
  return {
    source: 'ethentaflow',
    sessionId,
    workshopId,
    participantToken,
    participant: {
      name: state.participantName,
      title: state.participantTitle,
      company: state.participantCompany,
      roleDescription: state.participantRoleDescription,
    },
    ratings: state.lensSequence.map(lens => {
      const r = state.ratings.get(lens);
      return {
        lens,
        today: r?.today ?? null,
        target: r?.target ?? null,
        drift: r?.drift ?? null,
        reason: r?.reason ?? null,
      };
    }),
    evidence: state.lensSequence.map(lens => ({
      lens,
      statements: state.evidence.get(lens) ?? [],
    })),
    conversation: state.conversation.map(t => ({ role: t.role, content: t.content })),
    synthesis,
    startedAt: state.startedAt,
    endedAt: Date.now(),
  };
}

export async function postToDream(args: {
  payload: DreamHandoffPayload;
  endpoint?: string;
  secret?: string;
}): Promise<boolean> {
  const endpoint = args.endpoint ?? process.env.DREAM_API_URL;
  const secret = args.secret ?? process.env.DREAMFLOW_SECRET;
  if (!endpoint) {
    console.warn('[dream-handoff] DREAM_API_URL not configured — skipping');
    return false;
  }
  try {
    const url = `${endpoint.replace(/\/$/, '')}/api/discovery/ethentaflow-handoff`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-dreamflow-secret': secret } : {}),
      },
      body: JSON.stringify(args.payload),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[dream-handoff] failed (${response.status}): ${body.slice(0, 200)}`);
      return false;
    }
    console.log(`[dream-handoff] POSTed session ${args.payload.sessionId} to Dream`);
    return true;
  } catch (err) {
    console.error('[dream-handoff] error', err);
    return false;
  }
}
