import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RunType = 'BASELINE' | 'FOLLOWUP';

type AxisKey = 'people' | 'corporate' | 'customer' | 'technology' | 'regulation';

type AxisStats = {
  axis: AxisKey;
  label: string;
  today: { mean: number | null; min: number | null; max: number | null; stdev: number | null; n: number };
  target: { mean: number | null; min: number | null; max: number | null; stdev: number | null; n: number };
  projected: { mean: number | null; min: number | null; max: number | null; stdev: number | null; n: number };
};

type IndividualSeries = {
  participantId: string;
  participantName: string;
  role: string | null;
  department: string | null;
  today: Record<AxisKey, number | null>;
  target: Record<AxisKey, number | null>;
  projected: Record<AxisKey, number | null>;
};

type PhaseInsight = {
  phase: string;
  currentScore: number | null;
  targetScore: number | null;
  projectedScore: number | null;
};

const AXIS_ORDER: AxisKey[] = ['people', 'corporate', 'customer', 'technology', 'regulation'];

function safeRunType(value: string | null | undefined): RunType {
  const v = (value || '').trim().toUpperCase();
  if (v === 'FOLLOWUP') return 'FOLLOWUP';
  return 'BASELINE';
}

function clamp10(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function extractRatingFromAnswer(answer: string): number | null {
  const m = (answer || '').match(/\b(10|[1-9])\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 10) return null;
  return n;
}

function extractLabeledRating(answer: string, label: 'current' | 'target' | 'projected'): number | null {
  const re = new RegExp(`\\b${label}\\b\\s*[:=-]?\\s*(10|[1-9])\\b`, 'i');
  const m = (answer || '').match(re);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 10) return null;
  return n;
}

function extractTripleRatings(answer: string): { current: number | null; target: number | null; projected: number | null } {
  return {
    current: extractLabeledRating(answer, 'current'),
    target: extractLabeledRating(answer, 'target'),
    projected: extractLabeledRating(answer, 'projected'),
  };
}

function parseQuestionKey(questionKey: string): { phase: string; tag: string } | null {
  const parts = (questionKey || '').split(':');
  if (parts.length !== 3 && parts.length !== 4) return null;
  const hasVersion = parts.length === 4;
  const [, phase, tag] = hasVersion ? parts : [null, parts[0], parts[1]];
  if (!phase || !tag) return null;
  return { phase, tag };
}

function safePhaseInsights(value: unknown): PhaseInsight[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null))
    .filter((v): v is Record<string, unknown> => !!v)
    .map((v) => {
      const phase = typeof v.phase === 'string' ? v.phase : '';
      const currentScore = typeof v.currentScore === 'number' ? v.currentScore : null;
      const targetScore = typeof v.targetScore === 'number' ? v.targetScore : null;
      const projectedScore = typeof v.projectedScore === 'number' ? v.projectedScore : null;
      return { phase, currentScore, targetScore, projectedScore };
    })
    .filter((p) => !!p.phase);
}

function stats(values: Array<number | null>): { mean: number | null; min: number | null; max: number | null; stdev: number | null; n: number } {
  const xs = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const n = xs.length;
  if (!n) return { mean: null, min: null, max: null, stdev: null, n: 0 };
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const variance = xs.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / n;
  const stdev = n >= 2 ? Math.sqrt(variance) : 0;
  return {
    mean,
    min,
    max,
    stdev,
    n,
  };
}

function axisLabel(axis: AxisKey): string {
  if (axis === 'people') return 'People';
  if (axis === 'corporate') return 'Corporate / Process';
  if (axis === 'customer') return 'Customer';
  if (axis === 'technology') return 'Technology';
  return 'Regulation';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;

    const runType = safeRunType(request.nextUrl.searchParams.get('runType'));
    const includeIncomplete = request.nextUrl.searchParams.get('includeIncomplete') === '1';
    const includeIndividuals = request.nextUrl.searchParams.get('individuals') === '1';

    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) return NextResponse.json({ ok: false, error: 'Workshop not found' }, { status: 404 });

    const includeRegulation = workshop.includeRegulation ?? true;
    const axes = includeRegulation ? AXIS_ORDER : AXIS_ORDER.filter((a) => a !== 'regulation');

    const sessions = await prisma.conversationSession.findMany({
      where: {
        workshopId,
        runType,
        ...(includeIncomplete
          ? {}
          : {
              OR: [{ completedAt: { not: null } }, { participant: { responseCompletedAt: { not: null } } }],
            }),
      },
      include: {
        participant: true,
        report: true,
        dataPoints: {
          where: { questionKey: { not: null } },
          orderBy: { createdAt: 'asc' },
          select: { questionKey: true, rawText: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const individuals: IndividualSeries[] = [];

    const byAxisToday = new Map<AxisKey, Array<number | null>>();
    const byAxisTarget = new Map<AxisKey, Array<number | null>>();
    const byAxisProjected = new Map<AxisKey, Array<number | null>>();

    for (const axis of axes) {
      byAxisToday.set(axis, []);
      byAxisTarget.set(axis, []);
      byAxisProjected.set(axis, []);
    }

    for (const s of sessions) {
      const phaseInsights = safePhaseInsights(s.report?.phaseInsights);

      const today: Record<AxisKey, number | null> = {
        people: null,
        corporate: null,
        customer: null,
        technology: null,
        regulation: null,
      };
      const target: Record<AxisKey, number | null> = {
        people: null,
        corporate: null,
        customer: null,
        technology: null,
        regulation: null,
      };
      const projected: Record<AxisKey, number | null> = {
        people: null,
        corporate: null,
        customer: null,
        technology: null,
        regulation: null,
      };

      for (const p of phaseInsights) {
        const axis = p.phase as AxisKey;
        if (!axes.includes(axis)) continue;
        if (typeof p.currentScore === 'number') today[axis] = clamp10(p.currentScore);
        if (typeof p.targetScore === 'number') target[axis] = clamp10(p.targetScore);
        if (typeof p.projectedScore === 'number') projected[axis] = clamp10(p.projectedScore);
      }

      const missingAny = axes.some((a) => today[a] === null && target[a] === null && projected[a] === null);
      if (missingAny && s.dataPoints.length) {
        const currentByPhase: Partial<Record<AxisKey, number>> = {};
        const targetByPhase: Partial<Record<AxisKey, number>> = {};
        const projectedByPhase: Partial<Record<AxisKey, number>> = {};

        for (const dp of s.dataPoints) {
          const parsed = dp.questionKey ? parseQuestionKey(dp.questionKey) : null;
          if (!parsed) continue;
          const axis = parsed.phase as AxisKey;
          if (!axes.includes(axis)) continue;

          if (parsed.tag === 'triple_rating') {
            const t = extractTripleRatings(dp.rawText);
            if (t.current !== null) currentByPhase[axis] = t.current;
            if (t.target !== null) targetByPhase[axis] = t.target;
            if (t.projected !== null) projectedByPhase[axis] = t.projected;
            continue;
          }

          if (parsed.tag === 'current_score' || parsed.tag === 'awareness_current') {
            const n = extractRatingFromAnswer(dp.rawText);
            if (n !== null) currentByPhase[axis] = n;
            continue;
          }
          if (parsed.tag === 'future_score' || parsed.tag === 'awareness_future' || parsed.tag === 'target_score') {
            const n = extractRatingFromAnswer(dp.rawText);
            if (n !== null) targetByPhase[axis] = n;
            continue;
          }
          if (parsed.tag === 'confidence_score' || parsed.tag === 'projected_score') {
            const n = extractRatingFromAnswer(dp.rawText);
            if (n !== null) projectedByPhase[axis] = n;
            continue;
          }
        }

        for (const axis of axes) {
          if (today[axis] === null && typeof currentByPhase[axis] === 'number') today[axis] = clamp10(currentByPhase[axis]!);
          if (target[axis] === null && typeof targetByPhase[axis] === 'number') target[axis] = clamp10(targetByPhase[axis]!);
          if (projected[axis] === null && typeof projectedByPhase[axis] === 'number') projected[axis] = clamp10(projectedByPhase[axis]!);
        }
      }

      for (const axis of axes) {
        byAxisToday.get(axis)!.push(today[axis]);
        byAxisTarget.get(axis)!.push(target[axis]);
        byAxisProjected.get(axis)!.push(projected[axis]);
      }

      if (includeIndividuals) {
        individuals.push({
          participantId: s.participantId,
          participantName: s.participant?.name || 'Participant',
          role: s.participant?.role || null,
          department: s.participant?.department || null,
          today,
          target,
          projected,
        });
      }
    }

    const axisStats: AxisStats[] = axes.map((axis) => {
      return {
        axis,
        label: axisLabel(axis),
        today: stats(byAxisToday.get(axis) || []),
        target: stats(byAxisTarget.get(axis) || []),
        projected: stats(byAxisProjected.get(axis) || []),
      };
    });

    return NextResponse.json({
      ok: true,
      workshopId,
      runType,
      includeRegulation,
      generatedAt: new Date().toISOString(),
      participantCount: sessions.length,
      axisStats,
      individuals: includeIndividuals ? individuals : [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to build spider';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
