'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

type HemisphereResponse = {
  ok: boolean;
  workshopId: string;
  runType: 'BASELINE' | 'FOLLOWUP';
  generatedAt: string;
  sessionCount: number;
  participantCount: number;
  nodes: HemisphereNode[];
  error?: string;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

const CATEGORY_ORDER: Array<HemisphereNode['category']> = ['PEOPLE', 'CUSTOMER', 'TECHNOLOGY', 'BUSINESS', 'REGULATION', null];

function categoryLabel(cat: HemisphereNode['category']) {
  if (!cat) return 'Other';
  return cat[0] + cat.slice(1).toLowerCase();
}

export default function WorkshopHemispherePage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [runType, setRunType] = useState<'BASELINE' | 'FOLLOWUP'>('BASELINE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HemisphereResponse | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(
          `/api/admin/workshops/${encodeURIComponent(workshopId)}/hemisphere?runType=${encodeURIComponent(runType)}&bust=${Date.now()}`,
          { cache: 'no-store' }
        );
        const json = (await r.json().catch(() => null)) as HemisphereResponse | null;
        if (!r.ok || !json || !json.ok) {
          setData(null);
          setError(json && typeof json.error === 'string' ? json.error : 'Failed to load hemisphere');
          return;
        }
        setData(json);
      } catch (e) {
        setData(null);
        setError(e instanceof Error ? e.message : 'Failed to load hemisphere');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [workshopId, runType]);

  const grouped = useMemo(() => {
    const nodes = data?.nodes || [];
    const by = new Map<string, HemisphereNode[]>();
    for (const n of nodes) {
      const key = n.category || 'OTHER';
      const list = by.get(key) || [];
      list.push(n);
      by.set(key, list);
    }
    for (const [k, list] of by.entries()) {
      list.sort((a, b) => b.weight - a.weight);
      by.set(k, list);
    }
    return by;
  }, [data?.nodes]);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href={`/admin/workshops/${encodeURIComponent(workshopId)}`}>
            <Button variant="ghost">Back</Button>
          </Link>
          <div className="flex gap-2">
            <Button variant={runType === 'BASELINE' ? 'default' : 'outline'} onClick={() => setRunType('BASELINE')}>
              Baseline
            </Button>
            <Button variant={runType === 'FOLLOWUP' ? 'default' : 'outline'} onClick={() => setRunType('FOLLOWUP')}>
              Follow-up
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Hemisphere Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : data ? (
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>Run type: {data.runType}</div>
                <div>Generated: {new Date(data.generatedAt).toLocaleString()}</div>
                <div>Sessions: {data.sessionCount}</div>
                <div>Participants: {data.participantCount}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {data ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_ORDER.map((cat) => {
              const key = cat || 'OTHER';
              const list = grouped.get(key) || [];
              return (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{categoryLabel(cat)}</span>
                      <Badge variant="outline">{list.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {list.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No nodes.</div>
                    ) : (
                      <div className="space-y-3">
                        {list.slice(0, 12).map((n) => (
                          <div key={n.id} className="rounded-md border p-3">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{n.kind}</Badge>
                              <Badge variant="outline">w={n.weight}</Badge>
                              {typeof n.severity === 'number' ? <Badge variant="outline">sev={n.severity}</Badge> : null}
                              <span className="text-xs text-muted-foreground">p={n.participants.length}</span>
                            </div>
                            <div className="text-sm font-medium">{n.label}</div>
                            {n.exampleQuotes.length ? (
                              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                {n.exampleQuotes.slice(0, 2).map((q) => (
                                  <div key={q} className="line-clamp-3">
                                    {q}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {list.length > 12 ? (
                          <div className="text-xs text-muted-foreground">Showing top 12 of {list.length}</div>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
