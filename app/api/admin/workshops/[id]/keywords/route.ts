import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STOPWORDS = new Set(
  [
    'a',
    'about',
    'above',
    'after',
    'again',
    'against',
    'all',
    'am',
    'an',
    'and',
    'any',
    'are',
    'as',
    'at',
    'be',
    'because',
    'been',
    'before',
    'being',
    'below',
    'between',
    'both',
    'but',
    'by',
    'can',
    'could',
    'did',
    'do',
    'does',
    'doing',
    'down',
    'during',
    'each',
    'few',
    'for',
    'from',
    'further',
    'had',
    'has',
    'have',
    'having',
    'he',
    'her',
    'here',
    'hers',
    'herself',
    'him',
    'himself',
    'his',
    'how',
    'i',
    'if',
    'in',
    'into',
    'is',
    'it',
    'its',
    'itself',
    'just',
    'me',
    'more',
    'most',
    'my',
    'myself',
    'no',
    'nor',
    'not',
    'now',
    'of',
    'off',
    'on',
    'once',
    'only',
    'or',
    'other',
    'our',
    'ours',
    'ourselves',
    'out',
    'over',
    'own',
    'same',
    'she',
    'should',
    'so',
    'some',
    'such',
    'than',
    'that',
    'the',
    'their',
    'theirs',
    'them',
    'themselves',
    'then',
    'there',
    'these',
    'they',
    'this',
    'those',
    'through',
    'to',
    'too',
    'under',
    'until',
    'up',
    'very',
    'was',
    'we',
    'were',
    'what',
    'when',
    'where',
    'which',
    'while',
    'who',
    'why',
    'will',
    'with',
    'would',
    'you',
    'your',
    'yours',
    'yourself',
    'yourselves',
  ].map((x) => x.toLowerCase())
);

function isScoredQuestionKey(questionKey: string | null): boolean {
  const key = (questionKey || '').toLowerCase();
  if (!key) return false;
  if (key.includes(':triple_rating:')) return true;
  if (key.includes(':current_score:')) return true;
  if (key.includes(':future_score:')) return true;
  if (key.includes(':confidence_score:')) return true;
  if (key.includes(':awareness_current:')) return true;
  if (key.includes(':awareness_future:')) return true;
  if (key.includes(':target_score:')) return true;
  if (key.includes(':projected_score:')) return true;
  if (key.includes(':_score:')) return true;
  return false;
}

function normaliseToken(t: string): string {
  let s = t.toLowerCase().trim();
  s = s.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  s = s.replace(/['’]/g, '');
  if (s.endsWith('ing') && s.length > 6) s = s.slice(0, -3);
  else if (s.endsWith('ed') && s.length > 5) s = s.slice(0, -2);
  else if (s.endsWith('es') && s.length > 5) s = s.slice(0, -2);
  else if (s.endsWith('s') && s.length > 4) s = s.slice(0, -1);
  return s;
}

function isPiiLike(s: string): boolean {
  if (!s) return true;
  if (/@/.test(s)) return true;
  if (/\d{5,}/.test(s)) return true;
  if (/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(s)) return true;
  return false;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workshopId } = await params;

    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) return NextResponse.json({ ok: false, error: 'Workshop not found' }, { status: 404 });

    const dps = await prisma.dataPoint.findMany({
      where: {
        workshopId,
        source: 'MANUAL',
        rawText: { not: '' },
      },
      select: { rawText: true, questionKey: true },
      orderBy: { createdAt: 'asc' },
    });

    const counts = new Map<string, number>();

    for (const dp of dps) {
      if (isScoredQuestionKey(dp.questionKey)) continue;
      const src = (dp.rawText || '').toString();
      if (!src.trim()) continue;

      const tokens = src
        .split(/[\s\n\r\t]+/g)
        .map((t) => normaliseToken(t))
        .filter(Boolean)
        .filter((t) => t.length >= 3)
        .filter((t) => !STOPWORDS.has(t))
        .filter((t) => !isPiiLike(t));

      for (const token of tokens) {
        counts.set(token, (counts.get(token) || 0) + 1);
      }
    }

    const terms = [...counts.entries()]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.text.localeCompare(b.text)))
      .slice(0, 200);

    return NextResponse.json({ ok: true, workshopId, terms });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to compute keywords';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
