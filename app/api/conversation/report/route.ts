import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { sendDiscoveryReportEmail } from '@/lib/email/send-report';

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

type QuestionMeta =
  | {
      kind: 'question';
      tag: string;
      index: number;
      phase: string;
    }
  | { kind: string; [k: string]: any };

function getQuestionMeta(m: any): QuestionMeta | null {
  const meta = (m?.metadata as any) || null;
  if (!meta) return null;
  if (meta.kind !== 'question') return null;
  if (!meta.tag || !meta.phase) return null;
  return meta as QuestionMeta;
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

  const fallback = lines.join('\n').trim();

  if (!process.env.OPENAI_API_KEY) {
    return {
      executiveSummary: fallback,
      feedback:
        'Thank you for candidly sharing your experiences. Your input will help shape the Dream session and ensure we focus on what most helps (and most constrains) your work.',
      tone: null,
    };
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are writing a discovery interview report focused on the interviewee\'s view of the organisation and operating environment. Do NOT judge the individual. Start with an Executive Summary that captures tone (hopeful/skeptical/neutral/frustrated, etc.) and key themes. Then provide D1–D5 domain summaries with: Current state, Ambition, Barriers/enablers, Confidence. End with a short appreciative feedback paragraph to the interviewee that highlights actionable opportunities and support. Use only the provided notes. Keep language concrete and grounded in what was said; avoid generic filler. Output in the following format:\n\nExecutive Summary:\n<1 short paragraph>\n\nTone:\n<one of: hopeful | optimistic | neutral | skeptical | frustrated | mixed>\n\nFeedback to interviewee:\n<1 short paragraph>',
      },
      {
        role: 'user',
        content: `Notes (source of truth):\n\n${fallback}`,
      },
    ],
  });

  const text = completion.choices?.[0]?.message?.content?.trim() || '';

  const execMatch = text.match(/Executive Summary:\s*([\s\S]*?)(?:\n\nTone:|$)/i);
  const toneMatch = text.match(/Tone:\s*([^\n]+)/i);
  const feedbackMatch = text.match(/Feedback to interviewee:\s*([\s\S]*?)$/i);

  const executiveSummary = (execMatch?.[1] || fallback).trim();
  const tone = (toneMatch?.[1] || '').trim() || null;
  const feedback = (feedbackMatch?.[1] || '').trim() ||
    'Thank you for candidly sharing your experiences. Your input will help shape the Dream session and ensure we focus on what most helps (and most constrains) your work.';

  return { executiveSummary, feedback, tone };
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

    if (demo === '1') {
      const includeRegulation = request.nextUrl.searchParams.get('includeRegulation') !== '0';
      const synthetic = buildSyntheticResponse(includeRegulation);

      const reportText = await generateReportText({
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
        executiveSummary: reportText.executiveSummary,
        tone: reportText.tone,
        feedback: reportText.feedback,
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

    const messages = session.messages;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== 'PARTICIPANT') continue;

      const kind = (m.metadata as any)?.kind;
      if (kind === 'clarification') continue;

      let questionMsg: (typeof messages)[number] | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const prev = messages[j];
        if (prev.role !== 'AI') continue;
        const prevKind = (prev.metadata as any)?.kind;
        if (prevKind === 'clarification_response') continue;
        questionMsg = prev;
        break;
      }

      const question = questionMsg?.content || '';
      const phase = (m.phase || questionMsg?.phase || null) as string | null;
      const meta = getQuestionMeta(questionMsg);
      const tag = meta?.tag || inferTagFromQuestionText(question, phase) || null;

      qaPairs.push({ phase, question, answer: m.content, createdAt: m.createdAt, tag });

      if (phase === 'intro' && tag === 'context') {
        introContext = m.content;
        narrativeTexts.push(m.content);
        continue;
      }

      if (phase && tag) {
        if (tag === 'triple_rating') {
          const t = extractTripleRatings(m.content);
          if (t.current !== null) currentByPhase[phase] = t.current;
          if (t.target !== null) targetByPhase[phase] = t.target;
          if (t.projected !== null) projectedByPhase[phase] = t.projected;
          continue;
        }

        // Backward compatibility for older sessions
        if (tag === 'current_score' || tag === 'awareness_current') {
          const n = extractRatingFromAnswer(m.content);
          if (n !== null) currentByPhase[phase] = n;
          continue;
        }
        if (tag === 'future_score' || tag === 'awareness_future' || tag === 'target_score') {
          const n = extractRatingFromAnswer(m.content);
          if (n !== null) targetByPhase[phase] = n;
          continue;
        }
        if (tag === 'confidence_score' || tag === 'projected_score') {
          const n = extractRatingFromAnswer(m.content);
          if (n !== null) projectedByPhase[phase] = n;
          continue;
        }

        narrativeTexts.push(m.content);

        if (tag === 'strengths') strengthsByPhase[phase] = [...(strengthsByPhase[phase] || []), m.content];
        else if (tag === 'working') workingByPhase[phase] = [...(workingByPhase[phase] || []), m.content];
        else if (tag === 'helpful') workingByPhase[phase] = [...(workingByPhase[phase] || []), m.content];
        else if (tag === 'gaps') gapsByPhase[phase] = [...(gapsByPhase[phase] || []), m.content];
        else if (tag === 'pain_points') painPointsByPhase[phase] = [...(painPointsByPhase[phase] || []), m.content];
        else if (tag === 'friction') frictionsByPhase[phase] = [...(frictionsByPhase[phase] || []), m.content];
        else if (tag === 'barrier') barriersByPhase[phase] = [...(barriersByPhase[phase] || []), m.content];
        else if (tag === 'constraint') constraintByPhase[phase] = [...(constraintByPhase[phase] || []), m.content];
        else if (tag === 'future') futureTextByPhase[phase] = [...(futureTextByPhase[phase] || []), m.content];
        else if (tag === 'support') supportByPhase[phase] = [...(supportByPhase[phase] || []), m.content];
      }

      // Backwards-compatible fallback: if we couldn't infer a tag, still include text in the themes cloud.
      if (!tag) {
        narrativeTexts.push(m.content);
      }
    }

    const includeRegulation =
      (session as any).includeRegulation ?? (session.workshop as any)?.includeRegulation ?? true;
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

    const reportText = await generateReportText({
      workshopName: session.workshop?.name,
      participantName: session.participant?.name,
      phaseInsights,
      prioritization,
    });

    const wordCloudThemes = buildWordFrequencies(narrativeTexts);

    try {
      const participantEmail = session.participant?.email || null;
      const participantName = session.participant?.name || 'Participant';
      const participantToken = (session.participant as any)?.discoveryToken as string | undefined;
      const hasEmailConfig = !!process.env.RESEND_API_KEY && !!process.env.FROM_EMAIL;

      const alreadyEmailed = (session.messages || []).some((m: any) => {
        const meta = (m?.metadata as any) || null;
        if (!meta) return false;
        if (meta?.reportEmail?.sentAt) return true;
        if (meta?.kind === 'report_email' && meta?.sentAt) return true;
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
          executiveSummary: reportText.executiveSummary,
          tone: reportText.tone,
          feedback: reportText.feedback,
          phaseInsights: phaseInsights.map((p) => ({
            phase: p.phase,
            currentScore: p.currentScore,
            targetScore: p.targetScore,
            projectedScore: p.projectedScore,
          })),
        });

        const maybe = emailResult as any;
        const resendId =
          maybe?.data?.id ??
          maybe?.id ??
          maybe?.data?.messageId ??
          maybe?.messageId ??
          null;

        const latestAi = [...(session.messages || [])]
          .reverse()
          .find((m: any) => m?.role === 'AI');

        const marker = {
          kind: 'report_email',
          sentAt: new Date().toISOString(),
          resendId,
        };

        if (latestAi?.id) {
          const prevMeta = (latestAi.metadata as any) || {};
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

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      includeRegulation,
      participant: {
        name: session.participant?.name || null,
        role: session.participant?.role || null,
        department: session.participant?.department || null,
      },
      executiveSummary: reportText.executiveSummary,
      tone: reportText.tone,
      feedback: reportText.feedback,
      introContext,
      phaseInsights,
      wordCloudThemes,
      qaPairs,
    });
  } catch (error) {
    console.error('Error generating conversation report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
