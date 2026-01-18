import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RunType = 'BASELINE' | 'FOLLOWUP';

type HemisphereNode = {
  id: string;
  label: string;
  kind: 'insight_type' | 'key_insight' | 'theme';
  category: 'BUSINESS' | 'TECHNOLOGY' | 'PEOPLE' | 'CUSTOMER' | 'REGULATION' | null;
  weight: number;
  severity: number | null;
  participants: string[];
  exampleQuotes: string[];
};

function safeCategory(value: unknown): HemisphereNode['category'] {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!s) return null;
  if (s === 'BUSINESS' || s === 'TECHNOLOGY' || s === 'PEOPLE' || s === 'CUSTOMER' || s === 'REGULATION') return s;
  return null;
}

function safeRunType(value: string | null | undefined): RunType {
  const v = (value || '').trim().toUpperCase();
  if (v === 'FOLLOWUP') return 'FOLLOWUP';
  return 'BASELINE';
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function uniq(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;
    const runType = safeRunType(request.nextUrl.searchParams.get('runType'));

    const allSessions = (await (prisma as any).conversationSession.findMany({
      where: {
        workshopId,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        participantId: true,
        createdAt: true,
        completedAt: true,
        runType: true,
        questionSetVersion: true,
        participant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })) as Array<{
      id: string;
      participantId: string;
      createdAt: Date;
      completedAt: Date | null;
      runType?: string | null;
      questionSetVersion?: string | null;
      participant: { id: string; name: string; email: string };
    }>;

    const sessions = allSessions.filter((s) => safeRunType(s.runType) === runType);

    const sessionIds = sessions.map((s) => s.id);

    const reports = sessionIds.length
      ? ((await (prisma as any).conversationReport.findMany({
          where: { sessionId: { in: sessionIds } },
          select: {
            sessionId: true,
            keyInsights: true,
            wordCloudThemes: true,
          },
        })) as Array<{ sessionId: string; keyInsights: unknown; wordCloudThemes: unknown }>)
      : [];

    const insights = sessionIds.length
      ? await prisma.conversationInsight.findMany({
          where: { sessionId: { in: sessionIds } },
          select: {
            id: true,
            sessionId: true,
            participantId: true,
            insightType: true,
            category: true,
            text: true,
            severity: true,
            confidence: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const reportBySession = new Map(reports.map((r) => [r.sessionId, r]));

    const nodeMap = new Map<string, HemisphereNode>();

    for (const ins of insights) {
      const cat = safeCategory(ins.category);
      const it = String(ins.insightType || '').trim();
      if (!it) continue;
      const nodeId = `insight_type:${cat || 'none'}:${it}`;
      const prev = nodeMap.get(nodeId);

      const participantId = String(ins.participantId || '');
      const text = String(ins.text || '').trim();
      const severity = typeof ins.severity === 'number' ? ins.severity : null;

      if (!prev) {
        nodeMap.set(nodeId, {
          id: nodeId,
          label: it,
          kind: 'insight_type',
          category: cat,
          weight: 1,
          severity,
          participants: participantId ? [participantId] : [],
          exampleQuotes: text ? [text] : [],
        });
      } else {
        prev.weight += 1;
        prev.participants = uniq([...prev.participants, ...(participantId ? [participantId] : [])]);
        if (text && prev.exampleQuotes.length < 3) prev.exampleQuotes.push(text);
        if (severity !== null) {
          const cur = typeof prev.severity === 'number' ? prev.severity : severity;
          prev.severity = Math.round((cur + severity) / 2);
        }
      }
    }

    for (const s of sessions) {
      const report = reportBySession.get(s.id);
      if (!report) continue;

      const participantId = s.participantId;

      for (const ki of safeArray(report.keyInsights)) {
        const rec = ki && typeof ki === 'object' && !Array.isArray(ki) ? (ki as Record<string, unknown>) : null;
        const title = rec && typeof rec.title === 'string' ? rec.title.trim() : '';
        if (!title) continue;

        const nodeId = `key_insight:${title.toLowerCase()}`;
        const prev = nodeMap.get(nodeId);
        const evidence = rec ? safeArray(rec.evidence).filter((e) => typeof e === 'string').map((e) => String(e).trim()) : [];

        if (!prev) {
          nodeMap.set(nodeId, {
            id: nodeId,
            label: title,
            kind: 'key_insight',
            category: null,
            weight: 1,
            severity: null,
            participants: participantId ? [participantId] : [],
            exampleQuotes: evidence.slice(0, 2),
          });
        } else {
          prev.weight += 1;
          prev.participants = uniq([...prev.participants, ...(participantId ? [participantId] : [])]);
          for (const q of evidence) {
            if (q && prev.exampleQuotes.length < 3 && !prev.exampleQuotes.includes(q)) prev.exampleQuotes.push(q);
          }
        }
      }

      for (const t of safeArray(report.wordCloudThemes)) {
        const rec = t && typeof t === 'object' && !Array.isArray(t) ? (t as Record<string, unknown>) : null;
        const text = rec && typeof rec.text === 'string' ? rec.text.trim() : '';
        const value = rec && typeof rec.value === 'number' ? rec.value : null;
        if (!text || value === null) continue;
        if (value < 2) continue;

        const nodeId = `theme:${text.toLowerCase()}`;
        const prev = nodeMap.get(nodeId);
        if (!prev) {
          nodeMap.set(nodeId, {
            id: nodeId,
            label: text,
            kind: 'theme',
            category: null,
            weight: value,
            severity: null,
            participants: participantId ? [participantId] : [],
            exampleQuotes: [],
          });
        } else {
          prev.weight += value;
          prev.participants = uniq([...prev.participants, ...(participantId ? [participantId] : [])]);
        }
      }
    }

    const nodes = [...nodeMap.values()].sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      const as = typeof a.severity === 'number' ? a.severity : -1;
      const bs = typeof b.severity === 'number' ? b.severity : -1;
      return bs - as;
    });

    const participants = sessions.map((s) => ({
      participantId: s.participant.id,
      name: s.participant.name,
      baselineSessionId: runType === 'BASELINE' ? s.id : null,
      followupSessionIds: runType === 'FOLLOWUP' ? [s.id] : [],
      questionSetVersion: s.questionSetVersion || null,
    }));

    return NextResponse.json({
      ok: true,
      workshopId,
      runType,
      generatedAt: new Date().toISOString(),
      sessionCount: sessions.length,
      participantCount: uniq(sessions.map((s) => s.participantId)).length,
      nodes,
      edges: [],
      participants,
    });
  } catch (error) {
    console.error('Error building hemisphere snapshot:', error);
    return NextResponse.json({ ok: false, error: 'Failed to build hemisphere snapshot' }, { status: 500 });
  }
}
