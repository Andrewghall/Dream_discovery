import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { sendDiscoveryReportEmail } from '@/lib/email/send-report';
import { fixedQuestionsForVersion } from '@/lib/conversation/fixed-questions';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  if (p === 'regulation') {
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

function questionTextFromKey(questionKey: string): { phase: string | null; question: string; tag: string | null } {
  const parsed = parseQuestionKey(questionKey);
  if (!parsed) return { phase: null, question: '', tag: null };

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
          'You are a strict reviewer of discovery interview notes. Your job is to evaluate whether the notes contain meaningful, specific, internally consistent information. Be skeptical and do NOT reward nonsense.\n\nReturn ONLY valid JSON with this schema:\n{\n  "score": number (0-100),\n  "label": "high"|"medium"|"low",\n  "rationale": string,\n  "missingInfoSuggestions": string[] (3-8 items),\n  "keyInsights": [\n    {\n      "title": string,\n      "insight": string,\n      "confidence": "high"|"medium"|"low",\n      "evidence": string[] (1-4 short verbatim quotes from the notes)\n    }\n  ]\n}\n\nRules:\n- If notes are nonsense, repetitive filler, or too vague, score low and provide missingInfoSuggestions.\n- Evidence MUST be copied verbatim from the notes.\n- If you cannot find evidence quotes, set confidence="low" and keep keyInsights minimal.' ,
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
          'You are writing a discovery interview report focused on the interviewee\'s view of the organisation and operating environment. Do NOT judge the individual.\n\nYou MUST follow these rules:\n- Be strict and evidence-based. Do not add positivity unless supported by the notes.\n- If input quality is low, explicitly state that insights are limited/insufficient and do not invent conclusions.\n- Do not introduce facts not present in the notes.\n\nReturn ONLY valid JSON with this schema:\n{\n  "executiveSummary": string,\n  "tone": null | "hopeful" | "optimistic" | "neutral" | "skeptical" | "frustrated" | "mixed",\n  "feedback": string\n}\n',
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
  const phases = includeRegulation
    ? ['people', 'corporate', 'customer', 'technology', 'regulation']
    : ['people', 'corporate', 'customer', 'technology'];

  const phaseInsights = phases.map((phase) => {
    const base = phase === 'technology' ? 4 : phase === 'customer' ? 6 : 5;
    return {
      phase,
      currentScore: base,
      targetScore: 8,
      projectedScore: 5,
      strengths: phase === 'people' ? ['Strong peer collaboration and resilience.'] : [],
      working: phase === 'customer' ? ['Frontline teams are responsive when issues are escalated.'] : [],
      gaps: phase === 'technology' ? ['Fragmented systems and inconsistent data quality.'] : [],
      painPoints: phase === 'customer' ? ['Slow resolution for complex requests across channels.'] : [],
      frictions: phase === 'corporate' ? ['Approvals and governance add delay and uncertainty.'] : [],
      barriers: phase === 'technology' ? ['Legacy platforms and unclear ownership of integration.'] : [],
      constraint: phase === 'regulation' ? ['Compliance checks create rework and slow delivery.'] : [],
      future: phase === 'technology' ? ['Integrated data, AI-assisted workflows, and real-time reporting.'] : ['Clearer decision rights and faster execution.'],
      support: phase === 'people' ? ['Role clarity, targeted training, and capacity uplift.'] : [],
    };
  });

  const prioritization = {
    biggestConstraint: 'Technology',
    highImpact: 'Corporate/Organisational',
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

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const demo = request.nextUrl.searchParams.get('demo');
    const skipEmail = request.nextUrl.searchParams.get('skipEmail') === '1';

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

    const session = await prisma.conversationSession.findUnique({
      where: { id: sessionId },
      include: {
        workshop: true,
        participant: true,
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

    if (session.dataPoints.length > 0) {
      for (const dp of session.dataPoints) {
        const key = dp.questionKey || '';
        if (!key) continue;
        const meta = questionTextFromKey(key);
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
    const phases = includeRegulation
      ? ['people', 'corporate', 'customer', 'technology', 'regulation']
      : ['people', 'corporate', 'customer', 'technology'];

    const phaseInsights = phases.map((phase) => ({
      phase,
      currentScore: currentByPhase[phase] ?? null,
      targetScore: targetByPhase[phase] ?? null,
      projectedScore: projectedByPhase[phase] ?? null,
      strengths: strengthsByPhase[phase] || [],
      working: workingByPhase[phase] || [],
      gaps: gapsByPhase[phase] || [],
      painPoints: painPointsByPhase[phase] || [],
      frictions: frictionsByPhase[phase] || [],
      barriers: barriersByPhase[phase] || [],
      constraint: constraintByPhase[phase] || [],
      future: futureTextByPhase[phase] || [],
      support: supportByPhase[phase] || [],
    }));

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

    const reviewed = await generateReviewedReportText({
      workshopName: session.workshop?.name,
      participantName: session.participant?.name,
      phaseInsights,
      prioritization,
    });

    const wordCloudThemes = buildWordFrequencies(narrativeTexts);

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
      executiveSummary: reviewed.executiveSummary,
      tone: reviewed.tone,
      feedback: reviewed.feedback,
      inputQuality: reviewed.inputQuality,
      keyInsights: reviewed.keyInsights,
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
