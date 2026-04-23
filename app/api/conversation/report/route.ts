import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { sendDiscoveryReportEmail } from '@/lib/email/send-report';
import { fixedQuestionsForVersion, FixedQuestion, buildQuestionsFromDiscoverySet } from '@/lib/conversation/fixed-questions';
import { readBlueprintFromJson } from '@/lib/workshop/blueprint';
import { getDimensionNames } from '@/lib/cognition/workshop-dimensions';
import { canonicalizeConversationPhase } from '@/lib/workshop/canonical-lenses';
import { createHash } from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function stableFingerprint(value: unknown): string {
  const json = JSON.stringify(value);
  return createHash('sha256').update(json).digest('hex');
}

function countNarrativeEntries(phaseInsights: Array<{
  strengths?: string[];
  working?: string[];
  gaps?: string[];
  painPoints?: string[];
  frictions?: string[];
  barriers?: string[];
  constraint?: string[];
  future?: string[];
  support?: string[];
}> | null | undefined): number {
  if (!Array.isArray(phaseInsights)) return 0;

  return phaseInsights.reduce((count, phase) => {
    return count
      + (Array.isArray(phase?.strengths) ? phase.strengths.length : 0)
      + (Array.isArray(phase?.working) ? phase.working.length : 0)
      + (Array.isArray(phase?.gaps) ? phase.gaps.length : 0)
      + (Array.isArray(phase?.painPoints) ? phase.painPoints.length : 0)
      + (Array.isArray(phase?.frictions) ? phase.frictions.length : 0)
      + (Array.isArray(phase?.barriers) ? phase.barriers.length : 0)
      + (Array.isArray(phase?.constraint) ? phase.constraint.length : 0)
      + (Array.isArray(phase?.future) ? phase.future.length : 0)
      + (Array.isArray(phase?.support) ? phase.support.length : 0);
  }, 0);
}

function isAgenticUnavailableText(text: unknown): boolean {
  return typeof text === 'string' && text.trim().toLowerCase().startsWith('agentic synthesis unavailable');
}

function normalizeLensLookupKey(key: string | null | undefined): string {
  const raw = String(key ?? '').trim();
  if (!raw) return '';
  return canonicalizeConversationPhase(raw) ?? raw;
}

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','but','by','for','from','has','have','i','if','in','into','is','it','its','me','my','no','not','of','on','or','our','so','that','the','their','then','there','these','they','this','to','too','up','us','was','we','were','what','when','where','which','who','why','will','with','you','your',
]);

function extractRatingFromAnswer(answer: string): number | null {
  const m = answer.match(/\b(10|[1-9])\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 10) return null;
  return n;
}

function extractLabeledRating(answer: string, label: 'current' | 'target' | 'projected'): number | null {
  const re = new RegExp(`\\b${label}\\b\\s*[:=-]?\\s*(10|[1-9])\\b`, 'i');
  const m = answer.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 10) return null;
  return n;
}

function extractTripleRatings(answer: string): { current: number | null; target: number | null; projected: number | null } {
  return {
    current: extractLabeledRating(answer, 'current'),
    target: extractLabeledRating(answer, 'target'),
    projected: extractLabeledRating(answer, 'projected'),
  };
}

type QuestionMeta = {
  kind: 'question';
  tag: string;
  index: number;
  phase: string;
};

function getQuestionMeta(m: unknown): QuestionMeta | null {
  const meta =
    m && typeof m === 'object' && 'metadata' in m
      ? (m as { metadata?: unknown }).metadata
      : null;
  const rec = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : null;
  if (!rec) return null;
  if (rec.kind !== 'question') return null;
  if (typeof rec.tag !== 'string' || typeof rec.phase !== 'string' || typeof rec.index !== 'number') return null;
  return { kind: 'question', tag: rec.tag, index: rec.index, phase: rec.phase };
}

function inferTagFromQuestionText(question: string, phase: string | null): string | null {
  const q = (question || '').toLowerCase();
  const p = (phase || '').toLowerCase();
  if (!q) return null;

  // Ratings
  const hasScale = q.includes('1-10') || q.includes('1–10') || q.includes('scale') || q.includes('rate');
  const isConfidence = q.includes('confiden');
  if (hasScale && isConfidence) return 'confidence_score';

  if (p === 'risk_compliance') {
    if (q.includes('awareness') && hasScale && (q.includes('upcoming') || q.includes('current'))) return 'awareness_current';
    if (q.includes('awareness') && (q.includes('1.5') || q.includes('future') || q.includes('years'))) return 'awareness_future';
    if (q.includes('materially constrain') || q.includes('constrain your ability')) return 'constraint';
  }

  if (hasScale && (q.includes('today') || q.includes('current') || q.includes('how would you rate'))) return 'current_score';
  if (hasScale && (q.includes('1.5') || q.includes('years') || q.includes('future') || q.includes('where should'))) return 'future_score';

  // Prioritisation
  if (p === 'prioritization') {
    if (q.includes('constrain') && (q.includes('most') || q.includes('day-to-day'))) return 'biggest_constraint';
    if (q.includes('biggest') && q.includes('impact')) return 'high_impact';
    if (q.includes('optimistic') || q.includes('skeptical') || q.includes('sceptical')) return 'optimism';
    if (q.includes('other insights') || q.includes('anything else') || q.includes('final')) return 'final_thoughts';
  }

  // Intro
  if (p === 'intro') return 'context';

  // Narrative buckets
  if (q.includes('strength') || q.includes('behaviour') || q.includes('enabler')) return 'strengths';
  if (q.includes("what's working") || q.includes('working well') || q.includes('genuinely help') || q.includes('actually help') || q.includes('appreciate')) return 'working';
  if (q.includes('pain') || q.includes('frustrat') || q.includes('struggle')) return 'pain_points';
  if (q.includes('friction') || q.includes('slow you down') || q.includes('create friction')) return 'friction';
  if (q.includes('gap') || q.includes('challenge') || q.includes('frustration') || q.includes('hold your team back')) return 'gaps';
  if (q.includes('barrier') || q.includes('prevent') || q.includes('holding back')) return 'barrier';
  if (q.includes('support') || q.includes('training') || q.includes('resources')) return 'support';
  if (q.includes('looking ahead') || q.includes('in 1.5') || q.includes('in 3') || q.includes('future') || q.includes('how would you like')) return 'future';

  return null;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((w) => w.length >= 3)
    .filter((w) => !STOPWORDS.has(w));
}

function buildWordFrequencies(texts: string[], maxWords: number = 60) {
  const counts = new Map<string, number>();

  for (const t of texts) {
    for (const w of tokenize(t)) {
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxWords)
    .map(([text, value]) => ({ text, value }));
}

function parseQuestionKey(questionKey: string): { phase: string; tag: string; index: number; version: string | null } | null {
  const parts = (questionKey || '').split(':');
  if (parts.length !== 3 && parts.length !== 4) return null;

  const hasVersion = parts.length === 4;
  const [maybeVersion, phase, tag, idxStr] = hasVersion ? parts : [null, parts[0], parts[1], parts[2]];
  const index = Number(idxStr);
  if (!phase || !tag || !Number.isFinite(index)) return null;
  return { phase, tag, index, version: typeof maybeVersion === 'string' && maybeVersion ? maybeVersion : null };
}

function questionTextFromKey(
  questionKey: string,
  customQs?: Record<string, FixedQuestion[]> | null,
): { phase: string | null; question: string; tag: string | null } {
  const parsed = parseQuestionKey(questionKey);
  if (!parsed) return { phase: null, question: '', tag: null };

  // Try custom questions first (for domain-pack Discovery), then fall back to versioned set
  const customQ = customQs?.[parsed.phase]?.[parsed.index];
  if (customQ) {
    return {
      phase: parsed.phase,
      question: customQ.text,
      tag: parsed.tag,
    };
  }

  const qs = fixedQuestionsForVersion(parsed.version);
  const phaseKey = parsed.phase as keyof typeof qs;
  const q = qs[phaseKey]?.[parsed.index];
  return {
    phase: parsed.phase,
    question: q?.text || '',
    tag: parsed.tag,
  };
}

type InputQualityLabel = 'high' | 'medium' | 'low';

type KeyInsight = {
  title: string;
  insight: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
};

function safeInputQuality(value: unknown): ReportInputQuality | null {
  const rec = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  if (!rec) return null;
  const score = typeof rec.score === 'number' && Number.isFinite(rec.score) ? clampScore(rec.score) : null;
  const label = rec.label === 'high' || rec.label === 'medium' || rec.label === 'low' ? (rec.label as InputQualityLabel) : null;
  const rationale = typeof rec.rationale === 'string' ? rec.rationale.trim() : '';
  const missingInfoSuggestions = Array.isArray(rec.missingInfoSuggestions)
    ? rec.missingInfoSuggestions.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
    : [];
  if (score === null || !label || !rationale) return null;
  return { score, label, rationale, missingInfoSuggestions };
}

function safeKeyInsights(value: unknown): KeyInsight[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((rec) => {
      const title = typeof rec!.title === 'string' ? rec!.title.trim() : '';
      const insight = typeof rec!.insight === 'string' ? rec!.insight.trim() : '';
      const confidence = rec!.confidence === 'high' || rec!.confidence === 'medium' || rec!.confidence === 'low'
        ? (rec!.confidence as 'high' | 'medium' | 'low')
        : null;
      const evidence = Array.isArray(rec!.evidence)
        ? rec!.evidence.filter((e) => typeof e === 'string' && e.trim()).map((e) => e.trim())
        : [];
      if (!title || !insight || !confidence) return null;
      return { title, insight, confidence, evidence };
    })
    .filter(Boolean) as KeyInsight[];
}

type ReportInputQuality = {
  score: number;
  label: InputQualityLabel;
  rationale: string;
  missingInfoSuggestions: string[];
};

type ReviewedReportText = {
  executiveSummary: string;
  feedback: string;
  tone: string | null;
  inputQuality: ReportInputQuality;
  keyInsights: KeyInsight[];
};

function getTripleRatingConfigForLens(
  discoveryQs: { lenses?: Array<{ key: string; questions?: Array<{ tag?: string; text?: string; maturityScale?: string[] }> }> } | null | undefined,
  lensKey: string,
): { overrideQuestion?: string; overrideMaturityScale?: string[] } {
  const normalizedLensKey = normalizeLensLookupKey(lensKey);
  const lens = discoveryQs?.lenses?.find((entry) => normalizeLensLookupKey(entry.key) === normalizedLensKey);
  const triple = lens?.questions?.find((question) => question?.tag === 'triple_rating');

  return {
    ...(typeof triple?.text === 'string' && triple.text.trim() ? { overrideQuestion: triple.text.trim() } : {}),
    ...(Array.isArray(triple?.maturityScale) && triple.maturityScale.length === 5
      ? { overrideMaturityScale: triple.maturityScale }
      : {}),
  };
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function labelFromScore(score: number): InputQualityLabel {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function reviewDiscoveryNotes(params: {
  notes: string;
}): Promise<ReportInputQuality & { keyInsights: KeyInsight[] }> {
  const notes = (params.notes || '').trim();
  const wordCount = notes.split(/\s+/).filter(Boolean).length;

  if (!process.env.OPENAI_API_KEY) {
    const score = clampScore(wordCount >= 250 ? 70 : wordCount >= 140 ? 55 : wordCount >= 60 ? 35 : 15);
    return {
      score,
      label: labelFromScore(score),
      rationale:
        'Automatic assessment (no AI configured). Enable OPENAI_API_KEY for evidence-based review and higher quality synthesis.',
      missingInfoSuggestions: [
        'Provide concrete examples (what happened, how often, which teams/systems were involved).',
        'Describe specific blockers, dependencies, and decision points.',
        'Include measurable impacts (time, cost, risk, customer outcomes).',
      ],
      keyInsights: [],
    };
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content:
          'You are a strict reviewer of discovery interview notes. Your job is to evaluate whether the notes contain meaningful, specific, internally consistent information. Be skeptical and do NOT reward vague filler.\n\nReturn ONLY valid JSON with this schema:\n{\n  "score": number (0-100),\n  "label": "high"|"medium"|"low",\n  "rationale": string,\n  "missingInfoSuggestions": string[] (3-8 items),\n  "keyInsights": [\n    {\n      "title": string,\n      "insight": string,\n      "confidence": "high"|"medium"|"low",\n      "evidence": string[] (1-4 short verbatim quotes from the notes)\n    }\n  ]\n}\n\nRules:\n- Neutral system mirror tone: no blame, no praise, no solutions, no prioritisation.\n- Prefer insights that describe operational mechanisms (handoffs, approvals, queues, rework, unclear ownership, tooling constraints).\n- Evidence MUST be copied verbatim from the notes.\n- If you cannot find evidence quotes, set confidence="low" and keep keyInsights minimal.' ,
      },
      {
        role: 'user',
        content: `Discovery notes (source of truth):\n\n${notes}`,
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || '';
  const parsed = safeParseJson<{
    score: number;
    label: InputQualityLabel;
    rationale: string;
    missingInfoSuggestions: string[];
    keyInsights: KeyInsight[];
  }>(raw);

  if (!parsed) {
    const score = clampScore(wordCount >= 250 ? 65 : wordCount >= 140 ? 50 : wordCount >= 60 ? 30 : 10);
    return {
      score,
      label: labelFromScore(score),
      rationale: 'Reviewer returned an invalid response; using a conservative heuristic assessment.',
      missingInfoSuggestions: [
        'Provide concrete examples (what happened, how often, which teams/systems were involved).',
        'Describe specific blockers, dependencies, and decision points.',
        'Include measurable impacts (time, cost, risk, customer outcomes).',
      ],
      keyInsights: [],
    };
  }

  const score = clampScore(parsed.score);
  const label = parsed.label || labelFromScore(score);
  const keyInsights = Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [];

  return {
    score,
    label,
    rationale: (parsed.rationale || '').trim(),
    missingInfoSuggestions: Array.isArray(parsed.missingInfoSuggestions) ? parsed.missingInfoSuggestions : [],
    keyInsights,
  };
}

async function generateReviewedReportText(params: {
  workshopName: string | null | undefined;
  participantName: string | null | undefined;
  phaseInsights: Array<{
    phase: string;
    currentScore: number | null;
    targetScore: number | null;
    projectedScore: number | null;
    strengths: string[];
    working: string[];
    barriers: string[];
    frictions: string[];
    gaps: string[];
    future: string[];
    support: string[];
    constraint: string[];
    painPoints: string[];
  }>;
  prioritization: {
    biggestConstraint?: string;
    highImpact?: string;
    optimism?: string;
    finalThoughts?: string;
  };
}): Promise<ReviewedReportText> {
  const lines: string[] = [];
  if (params.participantName) lines.push(`Participant: ${params.participantName}`);
  if (params.workshopName) lines.push(`Workshop: ${params.workshopName}`);

  for (const p of params.phaseInsights) {
    lines.push(`\n${p.phase.toUpperCase()}`);
    if (p.currentScore !== null) lines.push(`- Current score: ${p.currentScore}/10`);
    if (p.targetScore !== null) lines.push(`- Target score: ${p.targetScore}/10`);
    if (p.projectedScore !== null) lines.push(`- Projected score: ${p.projectedScore}/10`);
    if (p.strengths.length) lines.push(`- Strengths: ${p.strengths.join(' | ')}`);
    if (p.working.length) lines.push(`- What's working: ${p.working.join(' | ')}`);
    if (p.gaps.length) lines.push(`- Gaps: ${p.gaps.join(' | ')}`);
    if (p.painPoints.length) lines.push(`- Pain points: ${p.painPoints.join(' | ')}`);
    if (p.frictions.length) lines.push(`- Friction: ${p.frictions.join(' | ')}`);
    if (p.barriers.length) lines.push(`- Barriers: ${p.barriers.join(' | ')}`);
    if (p.constraint.length) lines.push(`- Constraints: ${p.constraint.join(' | ')}`);
    if (p.future.length) lines.push(`- Future vision: ${p.future.join(' | ')}`);
    if (p.support.length) lines.push(`- Support needed: ${p.support.join(' | ')}`);
  }

  if (
    params.prioritization.biggestConstraint ||
    params.prioritization.highImpact ||
    params.prioritization.optimism ||
    params.prioritization.finalThoughts
  ) {
    lines.push(`\nPRIORITISATION`);
    if (params.prioritization.biggestConstraint)
      lines.push(`- Biggest constraint: ${params.prioritization.biggestConstraint}`);
    if (params.prioritization.highImpact)
      lines.push(`- High-impact improvement: ${params.prioritization.highImpact}`);
    if (params.prioritization.optimism)
      lines.push(`- Change sentiment: ${params.prioritization.optimism}`);
    if (params.prioritization.finalThoughts)
      lines.push(`- Final thoughts: ${params.prioritization.finalThoughts}`);
  }

  const notes = lines.join('\n').trim();
  const review = await reviewDiscoveryNotes({ notes });

  if (!process.env.OPENAI_API_KEY) {
    return {
      executiveSummary: 'Agentic synthesis unavailable. Enable OPENAI_API_KEY to generate a report summary.',
      feedback: 'Agentic synthesis unavailable. Enable OPENAI_API_KEY to generate report feedback.',
      tone: null,
      inputQuality: {
        score: review.score,
        label: review.label,
        rationale: review.rationale,
        missingInfoSuggestions: review.missingInfoSuggestions,
      },
      keyInsights: [],
    };
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.15,
    messages: [
      {
        role: 'system',
        content:
          'You are writing a discovery interview report that mirrors today\'s operating reality. Do NOT judge the individual or the organisation.\n\nYou MUST follow these rules:\n- Neutral, factual tone; no blame, no praise.\n- No solutions/recommendations/prioritisation language (avoid "should", "need to", "must").\n- Be strict and evidence-based. Do not add positivity unless supported by the notes.\n- If input quality is low, explicitly state that insights are limited/insufficient and do not invent conclusions.\n- Prefer concrete mechanisms (handoffs, approvals, queues, rework, unclear ownership, tooling constraints).\n- Do not introduce facts not present in the notes.\n\nReturn ONLY valid JSON with this schema:\n{\n  "executiveSummary": string,\n  "tone": null | "hopeful" | "optimistic" | "neutral" | "skeptical" | "frustrated" | "mixed",\n  "feedback": string\n}\n',
      },
      {
        role: 'user',
        content:
          `Notes (source of truth):\n\n${notes}\n\nInput quality assessment (must be respected):\n- score: ${review.score}\n- label: ${review.label}\n- rationale: ${review.rationale}\n\nEvidence-backed key insights (use these; do not invent):\n${(review.keyInsights || [])
            .map((k, idx) => {
              const ev = (k.evidence || []).map((e) => `"${e}"`).join(' | ');
              return `${idx + 1}. ${k.title} (${k.confidence})\n   Insight: ${k.insight}\n   Evidence: ${ev}`;
            })
            .join('\n\n')}`,
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || '';
  const parsed = safeParseJson<{ executiveSummary: string; tone: string | null; feedback: string }>(raw);

  if (!parsed) {
    return {
      executiveSummary: 'Agentic synthesis unavailable. The model returned an invalid response.',
      feedback: 'Agentic synthesis unavailable. The model returned an invalid response.',
      tone: null,
      inputQuality: {
        score: review.score,
        label: review.label,
        rationale: review.rationale,
        missingInfoSuggestions: review.missingInfoSuggestions,
      },
      keyInsights: review.keyInsights,
    };
  }

  return {
    executiveSummary:
      (parsed.executiveSummary || '').trim() || 'Agentic synthesis unavailable. The model returned an empty summary.',
    tone: (parsed.tone || '').trim() || null,
    feedback:
      (parsed.feedback || '').trim() || 'Agentic synthesis unavailable. The model returned an empty feedback message.',
    inputQuality: {
      score: review.score,
      label: review.label,
      rationale: review.rationale,
      missingInfoSuggestions: review.missingInfoSuggestions,
    },
    keyInsights: review.keyInsights,
  };
}

async function generateReportText(params: {
  workshopName: string | null | undefined;
  participantName: string | null | undefined;
  phaseInsights: Array<{
    phase: string;
    currentScore: number | null;
    targetScore: number | null;
    projectedScore: number | null;
    strengths: string[];
    working: string[];
    barriers: string[];
    frictions: string[];
    gaps: string[];
    future: string[];
    support: string[];
    constraint: string[];
    painPoints: string[];
  }>;
  prioritization: {
    biggestConstraint?: string;
    highImpact?: string;
    optimism?: string;
    finalThoughts?: string;
  };
}): Promise<{
  executiveSummary: string;
  feedback: string;
  tone: string | null;
}> {
  const reviewed = await generateReviewedReportText(params);
  return { executiveSummary: reviewed.executiveSummary, feedback: reviewed.feedback, tone: reviewed.tone };
}

function buildSyntheticResponse(includeRegulation: boolean) {
  const phases = ['people', 'operations', 'technology', 'commercial', 'risk_compliance', 'partners'];

  const phaseInsights = phases.map((phase) => {
    const base = phase === 'technology' ? 4 : phase === 'commercial' ? 6 : 5;
    return {
      phase,
      currentScore: base,
      targetScore: 8,
      projectedScore: 5,
      strengths: phase === 'people' ? ['Strong peer collaboration and resilience.'] : [],
      working: phase === 'commercial' ? ['Frontline teams are responsive when issues are escalated.'] : [],
      gaps: phase === 'technology' ? ['Fragmented systems and inconsistent data quality.'] : [],
      painPoints: phase === 'commercial' ? ['Slow resolution for complex requests across channels.'] : [],
      frictions: phase === 'operations' ? ['Approvals and governance add delay and uncertainty.'] : [],
      barriers: phase === 'technology' ? ['Legacy platforms and unclear ownership of integration.'] : [],
      constraint: phase === 'risk_compliance' ? ['Compliance checks create rework and slow delivery.'] : [],
      future: phase === 'technology' ? ['Integrated data, AI-assisted workflows, and real-time reporting.'] : ['Clearer decision rights and faster execution.'],
      support: phase === 'people' ? ['Role clarity, targeted training, and capacity uplift.'] : [],
    };
  });

  const prioritization = {
    biggestConstraint: 'Technology',
    highImpact: 'Operations',
    optimism: 'Mixed — optimistic about the vision, skeptical about the pace of change without clearer ownership.',
    finalThoughts: 'Focus on simplifying decisions and making data trustworthy and accessible.',
  };

  const narrativeTexts = phaseInsights.flatMap((p) => [
    ...p.strengths,
    ...p.working,
    ...p.gaps,
    ...p.painPoints,
    ...p.frictions,
    ...p.barriers,
    ...p.constraint,
    ...p.future,
    ...p.support,
  ]);

  return {
    participant: { name: 'Demo Participant', role: 'Manager', department: 'Operations' },
    phaseInsights,
    prioritization,
    narrativeTexts,
  };
}

// ── AI lens scoring for discovery sessions with narrative-only DataPoints ────────
// Called when a session has no per-lens DataPoint scores (e.g. discovery sessions
// where all DataPoints use generic "discovery" / "intro" phase tags).
// Reads the conversation transcript and asks GPT-4o to infer current + target
// maturity scores for every configured lens. Fully dynamic — lens list comes
// from discoveryQuestions.lenses, never hardcoded.
async function synthesiseLensScores(params: {
  lenses: Array<{ key: string; label?: string }>;
  transcript: string;
}): Promise<Array<{ key: string; currentScore: number; targetScore: number }>> {
  if (!process.env.OPENAI_API_KEY || !params.transcript.trim()) return [];

  const lensListStr = params.lenses
    .map((l) => `- key: "${l.key}", label: "${l.label || l.key}"`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are analysing a discovery interview transcript to infer current-state and target-state maturity scores for specific organisational lenses. ' +
          'Score each lens on a 1–10 scale based solely on evidence in the transcript. ' +
          'Omit any lens for which there is no relevant evidence. ' +
          'Return ONLY valid JSON: { "scores": [ { "key": string, "currentScore": number, "targetScore": number } ] }. ' +
          'currentScore = where the organisation is today. targetScore = where the participant wants or expects to be. ' +
          'Scores must be integers 1–10. Do not invent scores.',
      },
      {
        role: 'user',
        content: `Lenses to score:\n${lensListStr}\n\nTranscript:\n${params.transcript.slice(0, 12000)}`,
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || '';
  const parsed = safeParseJson<{ scores: Array<{ key: string; currentScore: number; targetScore: number }> }>(raw);
  if (!parsed?.scores || !Array.isArray(parsed.scores)) return [];

  return parsed.scores.filter(
    (s) =>
      typeof s.key === 'string' &&
      Number.isInteger(s.currentScore) && s.currentScore >= 1 && s.currentScore <= 10 &&
      Number.isInteger(s.targetScore) && s.targetScore >= 1 && s.targetScore <= 10,
  );
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const demo = request.nextUrl.searchParams.get('demo');
    const skipEmail = request.nextUrl.searchParams.get('skipEmail') === '1';
    const force = request.nextUrl.searchParams.get('force') === '1';

    if (demo === '1') {
      const includeRegulation = request.nextUrl.searchParams.get('includeRegulation') !== '0';
      const synthetic = buildSyntheticResponse(includeRegulation);

      const reviewed = await generateReviewedReportText({
        workshopName: 'Demo Workshop',
        participantName: synthetic.participant.name,
        phaseInsights: synthetic.phaseInsights,
        prioritization: synthetic.prioritization,
      });

      const wordCloudThemes = buildWordFrequencies(synthetic.narrativeTexts);

      return NextResponse.json({
        sessionId: 'demo',
        status: 'COMPLETED',
        includeRegulation,
        participant: synthetic.participant,
        executiveSummary: reviewed.executiveSummary,
        tone: reviewed.tone,
        feedback: reviewed.feedback,
        inputQuality: reviewed.inputQuality,
        keyInsights: reviewed.keyInsights,
        phaseInsights: synthetic.phaseInsights,
        wordCloudThemes,
      });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // ── Auth: admin cookie OR participant token ──────────────
    const token = request.nextUrl.searchParams.get('token');
    const adminUser = await getAuthenticatedUser();

    if (!adminUser && !token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await prisma.conversationSession.findUnique({
      where: { id: sessionId },
      include: {
        workshop: true,
        participant: true,
        report: true,
        messages: { orderBy: { createdAt: 'asc' } },
        dataPoints: {
          where: {
            questionKey: { not: null },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Participant token path: verify token matches session owner
    if (!adminUser && token) {
      if (
        !session.participant ||
        session.participant.discoveryToken !== token
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const qaPairs: Array<{ phase: string | null; question: string; answer: string; createdAt: Date; tag: string | null }> = [];

    const currentByPhase: Record<string, number> = {};
    const targetByPhase: Record<string, number> = {};
    const projectedByPhase: Record<string, number> = {};

    const strengthsByPhase: Record<string, string[]> = {};
    const workingByPhase: Record<string, string[]> = {};
    const gapsByPhase: Record<string, string[]> = {};
    const painPointsByPhase: Record<string, string[]> = {};
    const frictionsByPhase: Record<string, string[]> = {};
    const barriersByPhase: Record<string, string[]> = {};
    const constraintByPhase: Record<string, string[]> = {};
    const futureTextByPhase: Record<string, string[]> = {};
    const supportByPhase: Record<string, string[]> = {};

    const narrativeTexts: string[] = [];
    let introContext: string | null = null;
    let introWorking: string | null = null;
    let introPainPoints: string | null = null;

    // Build custom Discovery questions for question-text lookups (null if not configured)
    const reportCustomQs = buildQuestionsFromDiscoverySet((session.workshop as any)?.discoveryQuestions);

    if (session.dataPoints.length > 0) {
      for (const dp of session.dataPoints) {
        const key = dp.questionKey || '';
        if (!key) continue;
        const meta = questionTextFromKey(key, reportCustomQs);
        const question = meta.question;
        const phase = meta.phase;
        const tag = meta.tag;

        const answerText = dp.rawText;
        qaPairs.push({ phase, question, answer: answerText, createdAt: dp.createdAt, tag });

        if (phase === 'intro' && tag === 'context') {
          introContext = answerText;
          narrativeTexts.push(answerText);
          continue;
        }
        if (phase === 'intro' && tag === 'working') {
          introWorking = answerText;
          narrativeTexts.push(answerText);
          continue;
        }
        if (phase === 'intro' && tag === 'pain_points') {
          introPainPoints = answerText;
          narrativeTexts.push(answerText);
          continue;
        }

        if (phase && tag) {
          if (tag === 'triple_rating') {
            const t = extractTripleRatings(answerText);
            if (t.current !== null) currentByPhase[phase] = t.current;
            if (t.target !== null) targetByPhase[phase] = t.target;
            if (t.projected !== null) projectedByPhase[phase] = t.projected;
            continue;
          }

          // Backward compatibility for older tag schemes
          if (tag === 'current_score' || tag === 'awareness_current') {
            const n = extractRatingFromAnswer(answerText);
            if (n !== null) currentByPhase[phase] = n;
            continue;
          }
          if (tag === 'future_score' || tag === 'awareness_future' || tag === 'target_score') {
            const n = extractRatingFromAnswer(answerText);
            if (n !== null) targetByPhase[phase] = n;
            continue;
          }
          if (tag === 'confidence_score' || tag === 'projected_score') {
            const n = extractRatingFromAnswer(answerText);
            if (n !== null) projectedByPhase[phase] = n;
            continue;
          }

          narrativeTexts.push(answerText);

          if (tag === 'strengths') strengthsByPhase[phase] = [...(strengthsByPhase[phase] || []), answerText];
          else if (tag === 'working') workingByPhase[phase] = [...(workingByPhase[phase] || []), answerText];
          else if (tag === 'helpful') workingByPhase[phase] = [...(workingByPhase[phase] || []), answerText];
          else if (tag === 'gaps') gapsByPhase[phase] = [...(gapsByPhase[phase] || []), answerText];
          else if (tag === 'pain_points') painPointsByPhase[phase] = [...(painPointsByPhase[phase] || []), answerText];
          else if (tag === 'friction') frictionsByPhase[phase] = [...(frictionsByPhase[phase] || []), answerText];
          else if (tag === 'barrier') barriersByPhase[phase] = [...(barriersByPhase[phase] || []), answerText];
          else if (tag === 'constraint') constraintByPhase[phase] = [...(constraintByPhase[phase] || []), answerText];
          else if (tag === 'future') futureTextByPhase[phase] = [...(futureTextByPhase[phase] || []), answerText];
          else if (tag === 'support') supportByPhase[phase] = [...(supportByPhase[phase] || []), answerText];
        }

        if (!tag) {
          narrativeTexts.push(answerText);
        }
      }
    } else {
      const messages = session.messages;

      for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        if (m.role !== 'PARTICIPANT') continue;

        const metaRec =
          m.metadata && typeof m.metadata === 'object' && !Array.isArray(m.metadata)
            ? (m.metadata as Record<string, unknown>)
            : null;
        const kind = metaRec && typeof metaRec.kind === 'string' ? metaRec.kind : null;
        if (kind === 'clarification') continue;

        let questionMsg: (typeof messages)[number] | null = null;
        for (let j = i - 1; j >= 0; j--) {
          const prev = messages[j];
          if (prev.role !== 'AI') continue;
          const prevMetaRec =
            prev.metadata && typeof prev.metadata === 'object' && !Array.isArray(prev.metadata)
              ? (prev.metadata as Record<string, unknown>)
              : null;
          const prevKind = prevMetaRec && typeof prevMetaRec.kind === 'string' ? prevMetaRec.kind : null;
          if (prevKind === 'clarification_response') continue;
          questionMsg = prev;
          break;
        }

        const question = questionMsg?.content || '';
        const phase = (m.phase || questionMsg?.phase || null) as string | null;
        const meta = getQuestionMeta(questionMsg);
        const tag = meta?.tag || inferTagFromQuestionText(question, phase) || null;

        const translation =
          metaRec && metaRec.translation && typeof metaRec.translation === 'object' && !Array.isArray(metaRec.translation)
            ? (metaRec.translation as Record<string, unknown>)
            : null;
        const translatedEn = translation && typeof translation.en === 'string' ? translation.en : null;
        const answerText = typeof translatedEn === 'string' && translatedEn.trim() ? translatedEn : m.content;

        qaPairs.push({ phase, question, answer: answerText, createdAt: m.createdAt, tag });

        if (phase === 'intro' && tag === 'context') {
          introContext = answerText;
          narrativeTexts.push(answerText);
          continue;
        }
        if (phase === 'intro' && tag === 'working') {
          introWorking = answerText;
          narrativeTexts.push(answerText);
          continue;
        }
        if (phase === 'intro' && tag === 'pain_points') {
          introPainPoints = answerText;
          narrativeTexts.push(answerText);
          continue;
        }

        if (phase && tag) {
          if (tag === 'triple_rating') {
            const t = extractTripleRatings(answerText);
            if (t.current !== null) currentByPhase[phase] = t.current;
            if (t.target !== null) targetByPhase[phase] = t.target;
            if (t.projected !== null) projectedByPhase[phase] = t.projected;
            continue;
          }

          // Backward compatibility for older sessions
          if (tag === 'current_score' || tag === 'awareness_current') {
            const n = extractRatingFromAnswer(answerText);
            if (n !== null) currentByPhase[phase] = n;
            continue;
          }
          if (tag === 'future_score' || tag === 'awareness_future' || tag === 'target_score') {
            const n = extractRatingFromAnswer(answerText);
            if (n !== null) targetByPhase[phase] = n;
            continue;
          }
          if (tag === 'confidence_score' || tag === 'projected_score') {
            const n = extractRatingFromAnswer(answerText);
            if (n !== null) projectedByPhase[phase] = n;
            continue;
          }

          narrativeTexts.push(answerText);

          if (tag === 'strengths') strengthsByPhase[phase] = [...(strengthsByPhase[phase] || []), answerText];
          else if (tag === 'working') workingByPhase[phase] = [...(workingByPhase[phase] || []), answerText];
          else if (tag === 'helpful') workingByPhase[phase] = [...(workingByPhase[phase] || []), answerText];
          else if (tag === 'gaps') gapsByPhase[phase] = [...(gapsByPhase[phase] || []), answerText];
          else if (tag === 'pain_points') painPointsByPhase[phase] = [...(painPointsByPhase[phase] || []), answerText];
          else if (tag === 'friction') frictionsByPhase[phase] = [...(frictionsByPhase[phase] || []), answerText];
          else if (tag === 'barrier') barriersByPhase[phase] = [...(barriersByPhase[phase] || []), answerText];
          else if (tag === 'constraint') constraintByPhase[phase] = [...(constraintByPhase[phase] || []), answerText];
          else if (tag === 'future') futureTextByPhase[phase] = [...(futureTextByPhase[phase] || []), answerText];
          else if (tag === 'support') supportByPhase[phase] = [...(supportByPhase[phase] || []), answerText];
        }

        // Backwards-compatible fallback: if we couldn't infer a tag, still include text in the themes cloud.
        if (!tag) {
          narrativeTexts.push(answerText);
        }
      }
    }

    const includeRegulation = session.includeRegulation ?? session.workshop?.includeRegulation ?? true;

    // ── AI synthesis scoring for discovery sessions ───────────────────────────────
    // Build a flat transcript from the collected Q&A pairs. Used only when the
    // session has no per-lens DataPoint scores (all-narrative discovery sessions).
    const transcriptForScoring = qaPairs
      .filter((qa) => qa.answer?.trim())
      .map((qa) => (qa.question ? `Q: ${qa.question}\nA: ${qa.answer}` : qa.answer))
      .join('\n\n');

    // Read discoveryQuestions early so the guard below can check it before the
    // main phaseInsights block reads it again further down.
    const workshopForScoring = session.workshop as any;
    const discoveryQsForScoring = workshopForScoring?.discoveryQuestions as {
      lenses?: Array<{ key: string; label?: string }>;
    } | null | undefined;

    // Fire AI scoring only when:
    //  1. The workshop has discoveryQuestions lenses (Path 1 will run below)
    //  2. No per-lens DataPoint scores exist for ANY configured lens
    //  3. OPENAI_API_KEY is available
    // The guard is all-or-nothing: if even one lens already has a score we leave
    // the DataPoint-derived values intact and skip synthesis entirely.
    if (
      discoveryQsForScoring?.lenses?.length &&
      process.env.OPENAI_API_KEY &&
      discoveryQsForScoring.lenses.every((lens) => currentByPhase[normalizeLensLookupKey(lens.key)] == null)
    ) {
      try {
        const aiScores = await synthesiseLensScores({
          lenses: discoveryQsForScoring.lenses,
          transcript: transcriptForScoring,
        });
        for (const score of aiScores) {
          if (currentByPhase[score.key] == null) currentByPhase[score.key] = score.currentScore;
          if (targetByPhase[score.key] == null) targetByPhase[score.key] = score.targetScore;
        }
      } catch (err) {
        console.error('[report] AI lens scoring failed (non-fatal):', err);
      }
    }

    // ── Build phaseInsights from the workshop's dynamic lens definition ──────────
    //
    // Priority (mirrors session init / message routing):
    //
    // 1. discoveryQuestions lenses  — the authoritative source when present.
    //    Each lens has a .key (the phase tag used in sessions, e.g. "Customer")
    //    and a .label (the display name, e.g. "Customer Experience").
    //    We read collected data by key and store phaseInsights under the label.
    //    No mapping or fuzzy-matching needed.
    //
    // 2. Blueprint lenses only      — blueprint exists but no discoveryQuestions.
    //    LENS_NAME_TO_PHASE maps standard lens names to conversation phase keys.
    //    Custom lens names that don't match keep their name as the phase label
    //    and attempt an exact / prefix lookup in collected data.
    //
    // 3. Legacy fallback            — no blueprint, no discoveryQuestions.
    //    Uses the hardcoded default dimension names from getDimensionNames().
    //    Data is keyed by the old hardcoded phase keys; we still do prefix
    //    matching so 'people'→People, 'customer'→Customer, etc.

    const workshopForReport = session.workshop as any;
    const discoveryQs = workshopForReport?.discoveryQuestions as {
      lenses?: Array<{ key: string; label?: string }>;
    } | null | undefined;

    const reportBlueprint = readBlueprintFromJson(workshopForReport?.blueprint);

    function dataFor(key: string) {
      return {
        currentScore: currentByPhase[key] ?? null,
        targetScore: targetByPhase[key] ?? null,
        projectedScore: projectedByPhase[key] ?? null,
        strengths: strengthsByPhase[key] || [],
        working: workingByPhase[key] || [],
        gaps: gapsByPhase[key] || [],
        painPoints: painPointsByPhase[key] || [],
        frictions: frictionsByPhase[key] || [],
        barriers: barriersByPhase[key] || [],
        constraint: constraintByPhase[key] || [],
        future: futureTextByPhase[key] || [],
        support: supportByPhase[key] || [],
      };
    }

    let phaseInsights: Array<ReturnType<typeof dataFor> & { phase: string }>;

    if (discoveryQs?.lenses?.length) {
      // ── Path 1: discoveryQuestions — fully dynamic, no mapping ──────────────
      // lens.key is exactly what the session tagged messages with; lens.label is
      // the display name to store. Direct lookup, zero fuzzy matching.
      phaseInsights = discoveryQs.lenses.map((lens) => ({
        phase: lens.label || lens.key,
        ...getTripleRatingConfigForLens(discoveryQs, lens.key),
        ...dataFor(normalizeLensLookupKey(lens.key)),
      }));

    } else if (reportBlueprint?.lenses?.length) {
      // ── Path 2: blueprint-only — best-effort match of lens name to data key ──
      // Covers workshops that have a blueprint but haven't had discoveryQuestions
      // generated yet.  Includes a first-word prefix check so "People & Workforce"
      // finds data under the key "people", etc.
      const collectedKeys = Object.keys(currentByPhase);
      phaseInsights = reportBlueprint.lenses.map((lens: { name: string }) => {
        const ll = lens.name.toLowerCase();
        const firstWord = ll.split(/[\s&]/)[0];
        const key =
          collectedKeys.find((k) => k.toLowerCase() === ll) ??
          collectedKeys.find((k) => {
            const kl = k.toLowerCase();
            return ll.startsWith(kl) || kl.startsWith(ll);
          }) ??
          collectedKeys.find((k) => {
            const kl = k.toLowerCase();
            return kl.startsWith(firstWord) || firstWord.startsWith(kl);
          }) ??
          null;
        return { phase: lens.name, ...dataFor(key ?? '') };
      });

    } else {
      // ── Path 3: legacy — hardcoded dimension names, prefix match to old keys ──
      const legacyNames = getDimensionNames(workshopForReport?.prepResearch);
      const collectedKeys = Object.keys(currentByPhase);
      phaseInsights = legacyNames.map((name) => {
        const ll = name.toLowerCase();
        const firstWord = ll.split(/[\s&]/)[0];
        const key =
          collectedKeys.find((k) => k.toLowerCase() === ll) ??
          collectedKeys.find((k) => {
            const kl = k.toLowerCase();
            return ll.startsWith(kl) || kl.startsWith(ll) || kl.startsWith(firstWord) || firstWord.startsWith(kl);
          }) ??
          null;
        return { phase: name, ...dataFor(key ?? '') };
      });
    }

    const prioritization: {
      biggestConstraint?: string;
      highImpact?: string;
      optimism?: string;
      finalThoughts?: string;
    } = {};
    for (const qa of qaPairs) {
      if (qa.phase !== 'prioritization') continue;
      if (qa.tag === 'biggest_constraint') prioritization.biggestConstraint = qa.answer;
      else if (qa.tag === 'high_impact') prioritization.highImpact = qa.answer;
      else if (qa.tag === 'optimism') prioritization.optimism = qa.answer;
      else if (qa.tag === 'final_thoughts') prioritization.finalThoughts = qa.answer;
    }

    const inputFingerprint = stableFingerprint({
      reportContractVersion: '2026-04-22-narrative-phase-insights-v2',
      sessionId: session.id,
      includeRegulation,
      qaPairs: qaPairs.map((q) => ({
        phase: q.phase ?? null,
        question: q.question,
        answer: q.answer,
        tag: q.tag ?? null,
      })),
    });

    const storedInputQuality = safeInputQuality(session.report?.inputQuality);
    const storedKeyInsights = safeKeyInsights(session.report?.keyInsights);
    // Read fingerprint from the raw stored JSON (safeInputQuality strips extra fields)
    const rawInputQuality =
      session.report?.inputQuality &&
      typeof session.report.inputQuality === 'object' &&
      !Array.isArray(session.report.inputQuality)
        ? (session.report.inputQuality as Record<string, unknown>)
        : null;
    const storedFingerprint =
      rawInputQuality && typeof rawInputQuality.agenticFingerprint === 'string'
        ? String(rawInputQuality.agenticFingerprint)
        : null;

    const agenticConfigured = !!process.env.OPENAI_API_KEY;
    const existingUnavailable =
      isAgenticUnavailableText(session.report?.executiveSummary) || isAgenticUnavailableText(session.report?.feedback);
    const currentNarrativeCount = countNarrativeEntries(phaseInsights);
    const storedNarrativeCount = countNarrativeEntries(
      Array.isArray(session.report?.phaseInsights) ? (session.report?.phaseInsights as Array<Record<string, unknown>>) : null,
    );
    const staleNarrativeShape = currentNarrativeCount > 0 && storedNarrativeCount === 0;
    const phaseInsightsFingerprint = stableFingerprint(phaseInsights);
    const storedPhaseInsightsFingerprint = stableFingerprint(session.report?.phaseInsights ?? null);
    const staleDerivedArtifacts = staleNarrativeShape || storedPhaseInsightsFingerprint !== phaseInsightsFingerprint;

    const canReuse =
      !force &&
      !!session.report &&
      storedFingerprint === inputFingerprint &&
      (!agenticConfigured || !existingUnavailable) &&
      !!storedInputQuality &&
      !staleNarrativeShape;

    const reviewed = canReuse
      ? {
          executiveSummary: session.report!.executiveSummary,
          tone: session.report!.tone ?? null,
          feedback: session.report!.feedback,
          inputQuality: storedInputQuality!,
          keyInsights: storedKeyInsights,
        }
      : await generateReviewedReportText({
          workshopName: session.workshop?.name,
          participantName: session.participant?.name,
          phaseInsights,
          prioritization,
        });

    const wordCloudThemes = buildWordFrequencies(narrativeTexts);

    // Persist report so the reuse path activates on subsequent calls
    if (!canReuse || staleDerivedArtifacts) {
      try {
        const persistedInputQuality = {
          ...reviewed.inputQuality,
          agenticFingerprint: inputFingerprint,
        };
        const jsonKeyInsights = JSON.parse(JSON.stringify(reviewed.keyInsights));
        const jsonPhaseInsights = JSON.parse(JSON.stringify(phaseInsights));
        const jsonWordCloudThemes = JSON.parse(JSON.stringify(wordCloudThemes));
        await prisma.conversationReport.upsert({
          where: { sessionId: session.id },
          create: {
            sessionId: session.id,
            workshopId: session.workshopId,
            participantId: session.participantId,
            executiveSummary: reviewed.executiveSummary,
            tone: reviewed.tone,
            feedback: reviewed.feedback,
            inputQuality: persistedInputQuality,
            keyInsights: jsonKeyInsights,
            phaseInsights: jsonPhaseInsights,
            wordCloudThemes: jsonWordCloudThemes,
          },
          update: {
            executiveSummary: reviewed.executiveSummary,
            tone: reviewed.tone,
            feedback: reviewed.feedback,
            inputQuality: persistedInputQuality,
            keyInsights: jsonKeyInsights,
            phaseInsights: jsonPhaseInsights,
            wordCloudThemes: jsonWordCloudThemes,
          },
        });
      } catch (persistErr) {
        console.error('Failed to persist report:', persistErr);
        // Non-fatal: report is still returned in the response
      }
    }

    if (!skipEmail) {
      try {
        const participantEmail = session.participant?.email || null;
        const participantName = session.participant?.name || 'Participant';
        const participantToken = session.participant?.discoveryToken;
        const hasEmailConfig = !!process.env.RESEND_API_KEY && !!process.env.FROM_EMAIL;

        const alreadyEmailed = (session.messages || []).some((m) => {
          const meta =
            m.metadata && typeof m.metadata === 'object' && !Array.isArray(m.metadata)
              ? (m.metadata as Record<string, unknown>)
              : null;
          if (!meta) return false;

          const reportEmail =
            meta.reportEmail && typeof meta.reportEmail === 'object' && !Array.isArray(meta.reportEmail)
              ? (meta.reportEmail as Record<string, unknown>)
              : null;
          if (reportEmail && reportEmail.sentAt) return true;
          if (meta.kind === 'report_email' && meta.sentAt) return true;
          return false;
        });

        if (
          session.status === 'COMPLETED' &&
          hasEmailConfig &&
          participantEmail &&
          participantToken &&
          !alreadyEmailed
        ) {
          const appUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
          const discoveryUrl = `${appUrl}/discovery/${session.workshopId}/${participantToken}`;

          const emailResult = await sendDiscoveryReportEmail({
            to: participantEmail,
            participantName,
            workshopName: session.workshop?.name,
            discoveryUrl,
            executiveSummary: reviewed.executiveSummary,
            tone: reviewed.tone,
            feedback: reviewed.feedback,
            inputQuality: reviewed.inputQuality,
            keyInsights: reviewed.keyInsights,
            phaseInsights: phaseInsights.map((p) => ({
              phase: p.phase,
              currentScore: p.currentScore,
              targetScore: p.targetScore,
              projectedScore: p.projectedScore,
            })),
          });

          const maybe: unknown = emailResult;
          const obj =
            maybe && typeof maybe === 'object' && !Array.isArray(maybe)
              ? (maybe as Record<string, unknown>)
              : null;
          const data =
            obj && obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
              ? (obj.data as Record<string, unknown>)
              : null;
          const resendId =
            (data && typeof data.id === 'string' ? data.id : null) ??
            (obj && typeof obj.id === 'string' ? obj.id : null) ??
            (data && typeof data.messageId === 'string' ? data.messageId : null) ??
            (obj && typeof obj.messageId === 'string' ? obj.messageId : null);

          const latestAi = [...(session.messages || [])].reverse().find((m) => m?.role === 'AI');

          const marker = {
            kind: 'report_email',
            sentAt: new Date().toISOString(),
            resendId,
          };

          if (latestAi?.id) {
            const prevMeta =
              latestAi.metadata && typeof latestAi.metadata === 'object' && !Array.isArray(latestAi.metadata)
                ? (latestAi.metadata as Record<string, unknown>)
                : {};
            await prisma.conversationMessage.update({
              where: { id: latestAi.id },
              data: {
                metadata: {
                  ...prevMeta,
                  reportEmail: marker,
                },
              },
            });
          } else {
            await prisma.conversationMessage.create({
              data: {
                sessionId: session.id,
                role: 'AI',
                content: '',
                phase: 'summary',
                metadata: marker,
              },
            });
          }
        }
      } catch (e) {
        console.error('Failed to email discovery report:', e);
      }
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      includeRegulation,
      workshopName: session.workshop?.name || null,
      participantName: session.participant?.name || null,
      participant: {
        name: session.participant?.name || null,
        role: session.participant?.role || null,
        department: session.participant?.department || null,
      },
      aboutYou: {
        roleContext: introContext,
        bestThing: introWorking,
        frustration: introPainPoints,
      },
      questionSetVersion: session.questionSetVersion || 'v1',
      executiveSummary: reviewed.executiveSummary,
      tone: reviewed.tone,
      feedback: reviewed.feedback,
      inputQuality: reviewed.inputQuality,
      keyInsights: canReuse && session.report?.keyInsights ? session.report.keyInsights : reviewed.keyInsights,
      introContext,
      phaseInsights,
      wordCloudThemes,
      qaPairs,
    });
  } catch (error) {
    console.error('Error generating conversation report:', error);
    const details =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown error';

    const skipEmail = request.nextUrl.searchParams.get('skipEmail') === '1';
    return NextResponse.json(
      skipEmail ? { error: 'Failed to generate report', details } : { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
