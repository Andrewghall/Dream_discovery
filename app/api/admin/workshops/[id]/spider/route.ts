import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fixedQuestionsForVersion, getPhaseOrder } from '@/lib/conversation/fixed-questions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RunType = 'BASELINE' | 'FOLLOWUP';

type Focus = 'MASTER' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5';

type SpiderAxis = {
  axisId: string;
  questionSetVersion: string;
  phase: string;
  tag: string;
  questionIndex: number;
  questionText: string;
};

type StatPack = { median: number | null; min: number | null; max: number | null; n: number };

type AxisStats = {
  axisId: string;
  label: string;
  questionText: string;
  phase: string;
  tag: string;
  questionIndex: number;
  today: StatPack;
  target: StatPack;
  projected: StatPack;
};

type IndividualSeries = {
  participantId: string;
  participantName: string;
  role: string | null;
  department: string | null;
  today: Record<string, number | null>;
  target: Record<string, number | null>;
  projected: Record<string, number | null>;
};

type QuestionMeta = { kind: 'question'; phase: string; tag: string; index: number };

function safeRunType(value: string | null | undefined): RunType {
  const v = (value || '').trim().toUpperCase();
  if (v === 'FOLLOWUP') return 'FOLLOWUP';
  return 'BASELINE';
}

function safeFocus(value: string | null | undefined): Focus {
  const v = (value || '').trim().toUpperCase();
  if (v === 'D1' || v === 'D2' || v === 'D3' || v === 'D4' || v === 'D5') return v;
  return 'MASTER';
}

function focusKeywords(focus: Focus): string[] {
  if (focus === 'D1') return ['people'];
  if (focus === 'D2') return ['organisation', 'organization', 'corporate', 'process', 'processes'];
  if (focus === 'D3') return ['customer', 'client'];
  if (focus === 'D4') return ['technology', 'tech', 'system', 'systems', 'tool', 'tools'];
  if (focus === 'D5') return ['regulation', 'regulatory', 'compliance'];
  return [];
}

function matchesFocusFromText(text: string, focus: Focus): boolean {
  const t = (text || '').toLowerCase();
  if (!t) return false;
  const kws = focusKeywords(focus);
  if (!kws.length) return true;
  return kws.some((k) => t.includes(k));
}

function clamp10(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function shortLabel(text: string, maxWords: number = 6): string {
  const w = (text || '').trim().split(/\s+/).filter(Boolean);
  if (w.length <= maxWords) return w.join(' ');
  return `${w.slice(0, maxWords).join(' ')}…`;
}

function axisLabelFromQuestionText(questionText: string): string {
  const raw = (questionText || '').replace(/\s+$/g, '');
  const blocks = raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const candidate = (blocks[blocks.length - 1] || raw).trim();
  const cleaned = candidate
    .replace(/^rate\s+/i, '')
    .replace(/^how\s+well\s+/i, '')
    .replace(/^the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return shortLabel(cleaned, 6);
}

function questionMetaFromMessage(meta: unknown): QuestionMeta | null {
  if (!meta || typeof meta !== 'object') return null;
  const rec = meta as Record<string, unknown>;
  if (rec.kind !== 'question') return null;
  if (typeof rec.phase !== 'string' || typeof rec.index !== 'number' || typeof rec.tag !== 'string') return null;
  return { kind: 'question', phase: rec.phase, tag: rec.tag, index: rec.index };
}

function isScoredTag(tag: string): boolean {
  const t = (tag || '').trim().toLowerCase();
  if (!t) return false;
  if (t === 'triple_rating') return true;
  if (t.endsWith('_score')) return true;
  if (t === 'awareness_current' || t === 'awareness_future') return true;
  if (t === 'current_score' || t === 'future_score' || t === 'confidence_score') return true;
  return false;
}

function scoreLayerFromTag(tag: string): 'today' | 'target' | 'projected' | null {
  const t = (tag || '').trim().toLowerCase();
  if (!t) return null;
  if (t === 'current_score' || t === 'awareness_current') return 'today';
  if (t === 'future_score' || t === 'awareness_future' || t === 'target_score') return 'target';
  if (t === 'confidence_score' || t === 'projected_score') return 'projected';
  return null;
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

function parseQuestionKey(questionKey: string): { version: string | null; phase: string; tag: string; index: number } | null {
  const parts = (questionKey || '').split(':');
  if (parts.length !== 3 && parts.length !== 4) return null;
  const hasVersion = parts.length === 4;
  const [maybeVersion, phase, tag, idxStr] = hasVersion ? parts : [null, parts[0], parts[1], parts[2]];
  const index = Number(idxStr);
  if (!phase || !tag || !Number.isFinite(index)) return null;
  return { version: typeof maybeVersion === 'string' && maybeVersion ? maybeVersion : null, phase, tag, index };
}

function medianSorted(xs: number[]): number {
  const n = xs.length;
  if (!n) return 0;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return xs[mid];
  return (xs[mid - 1] + xs[mid]) / 2;
}

function stats(values: Array<number | null>): StatPack {
  const xs = values
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .map((v) => clamp10(v));
  const n = xs.length;
  if (!n) return { median: null, min: null, max: null, n: 0 };
  xs.sort((a, b) => a - b);
  return {
    median: medianSorted(xs),
    min: xs[0],
    max: xs[n - 1],
    n,
  };
}

function axisIdFor(params: { questionSetVersion: string; phase: string; tag: string; index: number }): string {
  const v = (params.questionSetVersion || '').trim() || 'v1';
  return `${v}:${params.phase}:${params.tag}:${params.index}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;

    const runType = safeRunType(request.nextUrl.searchParams.get('runType'));
    const focus = safeFocus(request.nextUrl.searchParams.get('focus'));
    const includeIncomplete = request.nextUrl.searchParams.get('includeIncomplete') === '1';
    const includeIndividuals = request.nextUrl.searchParams.get('individuals') === '1';

    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) return NextResponse.json({ ok: false, error: 'Workshop not found' }, { status: 404 });

    const includeRegulation = workshop.includeRegulation ?? true;
    const phases = getPhaseOrder(includeRegulation).filter((p) => p !== 'summary');

    const sessionsAll = await prisma.conversationSession.findMany({
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
        messages: {
          where: { role: 'AI' },
          orderBy: { createdAt: 'asc' },
          select: { content: true, phase: true, metadata: true },
        },
        dataPoints: {
          where: { questionKey: { not: null } },
          orderBy: { createdAt: 'asc' },
          select: { questionKey: true, rawText: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sessions =
      focus === 'MASTER'
        ? sessionsAll
        : sessionsAll.filter((s) => {
            const dps = (s.dataPoints || []) as Array<{ questionKey: string | null; rawText: string }>;
            for (const dp of dps) {
              const parsed = dp.questionKey ? parseQuestionKey(dp.questionKey) : null;
              if (!parsed) continue;
              if (parsed.phase !== 'prioritization') continue;
              if (matchesFocusFromText(dp.rawText || '', focus)) return true;
            }
            return false;
          });

    const axisById = new Map<string, SpiderAxis>();
    const byAxisToday = new Map<string, Array<number | null>>();
    const byAxisTarget = new Map<string, Array<number | null>>();
    const byAxisProjected = new Map<string, Array<number | null>>();

    const ensureAxis = (axis: SpiderAxis) => {
      if (axisById.has(axis.axisId)) return;
      axisById.set(axis.axisId, axis);
      byAxisToday.set(axis.axisId, []);
      byAxisTarget.set(axis.axisId, []);
      byAxisProjected.set(axis.axisId, []);
    };

    const questionTextFromFixed = (questionSetVersion: string, phase: string, index: number): string | null => {
      const qs = fixedQuestionsForVersion(questionSetVersion);
      const list = (qs as any)?.[phase] as Array<{ text?: unknown }> | undefined;
      const q = list && list[index] ? list[index] : null;
      const t = q && typeof q.text === 'string' ? q.text : null;
      return t && t.trim() ? t.trim() : null;
    };

    const questionTextFromMessages = (session: (typeof sessions)[number], phase: string, index: number, tag: string): string | null => {
      const msgs = (session as any).messages as Array<{ content: string; metadata: unknown; phase: string | null }>;
      for (const m of msgs || []) {
        const meta = questionMetaFromMessage(m.metadata);
        if (!meta) continue;
        if (meta.phase === phase && meta.index === index && meta.tag === tag) {
          const t = typeof m.content === 'string' ? m.content.trim() : '';
          if (t) return t;
        }
      }
      for (const m of msgs || []) {
        const meta = questionMetaFromMessage(m.metadata);
        if (!meta) continue;
        if (meta.phase === phase && meta.index === index) {
          const t = typeof m.content === 'string' ? m.content.trim() : '';
          if (t) return t;
        }
      }
      return null;
    };

    const allQuestionSetVersions = new Set(
      sessions
        .map((s) => ((s as unknown as { questionSetVersion?: string | null }).questionSetVersion || 'v1').trim() || 'v1')
        .filter(Boolean)
    );

    for (const questionSetVersion of allQuestionSetVersions) {
      const qs = fixedQuestionsForVersion(questionSetVersion);
      for (const phase of phases) {
        const list = qs[phase] || [];
        for (let index = 0; index < list.length; index++) {
          const q = list[index];
          const tag = String((q as any).tag || '');
          const hasScale = Array.isArray((q as any).maturityScale) && (q as any).maturityScale.length > 0;
          if (!hasScale && !isScoredTag(tag)) continue;
          const axisId = axisIdFor({ questionSetVersion, phase, tag: tag || 'score', index });
          ensureAxis({
            axisId,
            questionSetVersion,
            phase,
            tag: tag || 'score',
            questionIndex: index,
            questionText: q.text,
          });
        }
      }
    }

    for (const s of sessions) {
      const questionSetVersion = ((s as unknown as { questionSetVersion?: string | null }).questionSetVersion || 'v1').trim() || 'v1';
      for (const dp of s.dataPoints) {
        const parsed = dp.questionKey ? parseQuestionKey(dp.questionKey) : null;
        if (!parsed) continue;
        const tag = String(parsed.tag || '');
        if (!isScoredTag(tag)) continue;
        if (!includeRegulation && parsed.phase === 'regulation') continue;
        const v = parsed.version ? String(parsed.version).trim() : questionSetVersion;
        const questionText =
          questionTextFromFixed(v, parsed.phase, parsed.index) ||
          questionTextFromMessages(s as any, parsed.phase, parsed.index, parsed.tag) ||
          '';
        const axisId = axisIdFor({ questionSetVersion: v, phase: parsed.phase, tag: parsed.tag, index: parsed.index });
        ensureAxis({
          axisId,
          questionSetVersion: v,
          phase: parsed.phase,
          tag: parsed.tag,
          questionIndex: parsed.index,
          questionText: questionText || `${parsed.phase} ${parsed.tag} ${parsed.index + 1}`,
        });
      }
    }

    const individuals: IndividualSeries[] = [];

    for (const s of sessions) {
      const today: Record<string, number | null> = {};
      const target: Record<string, number | null> = {};
      const projected: Record<string, number | null> = {};
      for (const axisId of axisById.keys()) {
        today[axisId] = null;
        target[axisId] = null;
        projected[axisId] = null;
      }

      const questionSetVersion = ((s as unknown as { questionSetVersion?: string | null }).questionSetVersion || 'v1').trim() || 'v1';

      for (const dp of s.dataPoints) {
        const parsed = dp.questionKey ? parseQuestionKey(dp.questionKey) : null;
        if (!parsed) continue;
        if (!includeRegulation && parsed.phase === 'regulation') continue;

        const v = parsed.version ? String(parsed.version).trim() : questionSetVersion;
        const axisId = axisIdFor({ questionSetVersion: v, phase: parsed.phase, tag: parsed.tag, index: parsed.index });
        if (!axisById.has(axisId)) continue;

        if (parsed.tag === 'triple_rating') {
          const t = extractTripleRatings(dp.rawText);
          if (t.current !== null) today[axisId] = clamp10(t.current);
          if (t.target !== null) target[axisId] = clamp10(t.target);
          if (t.projected !== null) projected[axisId] = clamp10(t.projected);
          continue;
        }

        const triple = extractTripleRatings(dp.rawText);
        if (triple.current !== null || triple.target !== null || triple.projected !== null) {
          if (triple.current !== null) today[axisId] = clamp10(triple.current);
          if (triple.target !== null) target[axisId] = clamp10(triple.target);
          if (triple.projected !== null) projected[axisId] = clamp10(triple.projected);
          continue;
        }

        if (!isScoredTag(parsed.tag)) continue;
        const layer = scoreLayerFromTag(parsed.tag);
        const n = extractRatingFromAnswer(dp.rawText);
        if (layer && n !== null) {
          if (layer === 'today') today[axisId] = clamp10(n);
          if (layer === 'target') target[axisId] = clamp10(n);
          if (layer === 'projected') projected[axisId] = clamp10(n);
        }
      }

      for (const axisId of axisById.keys()) {
        byAxisToday.get(axisId)!.push(today[axisId]);
        byAxisTarget.get(axisId)!.push(target[axisId]);
        byAxisProjected.get(axisId)!.push(projected[axisId]);
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

    const axisStats: AxisStats[] = [...axisById.values()]
      .sort((a, b) => {
        const pa = phases.indexOf(a.phase as any);
        const pb = phases.indexOf(b.phase as any);
        if (pa !== pb) return pa - pb;
        return a.questionIndex - b.questionIndex;
      })
      .map((axis) => {
        return {
          axisId: axis.axisId,
          label: axisLabelFromQuestionText(axis.questionText),
          questionText: axis.questionText,
          phase: axis.phase,
          tag: axis.tag,
          questionIndex: axis.questionIndex,
          today: stats(byAxisToday.get(axis.axisId) || []),
          target: stats(byAxisTarget.get(axis.axisId) || []),
          projected: stats(byAxisProjected.get(axis.axisId) || []),
        };
      });

    return NextResponse.json({
      ok: true,
      workshopId,
      runType,
      focus,
      includeRegulation,
      generatedAt: new Date().toISOString(),
      participantCount: sessions.length,
      axisStats,
      individuals: includeIndividuals ? individuals : [],
      aggregation: {
        method: 'median',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to build spider';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
