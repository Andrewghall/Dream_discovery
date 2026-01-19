'use client';

import { use, useEffect, useMemo, useState } from 'react';

type PageProps = {
  params: Promise<{ id: string }>;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

type AxisKey = 'people' | 'corporate' | 'customer' | 'technology' | 'regulation';

const AXES: Array<{ key: AxisKey; labelLines: string[] }> = [
  { key: 'people', labelLines: ['D1 — People'] },
  { key: 'corporate', labelLines: ['D2 — Corporate', 'Organisational'] },
  { key: 'customer', labelLines: ['D3 — Customer'] },
  { key: 'technology', labelLines: ['D4 — Technology'] },
  { key: 'regulation', labelLines: ['D5 — Regulation'] },
];

type SpiderAxisStat = {
  phase: string;
  tag: string;
  today: { median: number | null };
  target: { median: number | null };
  projected: { median: number | null };
};

type SpiderApiResponse = {
  ok: boolean;
  axisStats: SpiderAxisStat[];
  error?: string;
};

type KeywordApiResponse = {
  ok: boolean;
  terms: Array<{ text: string; count: number }>;
  error?: string;
};

function buildPolygonPath(params: { values: number[]; cx: number; cy: number; radius: number; max: number }) {
  const n = AXES.length;
  const pts = params.values.map((v, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = (clamp(v, 0, params.max) / params.max) * params.radius;
    return polar(params.cx, params.cy, r, angle);
  });
  if (!pts.length) return '';
  const first = pts[0];
  const rest = pts.slice(1);
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')} Z`;
}

export default function WorkshopSpiderPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [axisStats, setAxisStats] = useState<SpiderAxisStat[]>([]);
  const [terms, setTerms] = useState<Array<{ text: string; count: number }>>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const [spiderRes, keywordRes] = await Promise.all([
          fetch(`/api/admin/workshops/${workshopId}/spider?runType=BASELINE&includeIncomplete=1`, { cache: 'no-store' }),
          fetch(`/api/admin/workshops/${workshopId}/keywords`, { cache: 'no-store' }),
        ]);

        const spiderJson = (await spiderRes.json().catch(() => null)) as SpiderApiResponse | null;
        const keywordJson = (await keywordRes.json().catch(() => null)) as KeywordApiResponse | null;

        if (!alive) return;

        if (!spiderRes.ok || !spiderJson || !spiderJson.ok) {
          setError((spiderJson && spiderJson.error) || `Failed to load spider (${spiderRes.status})`);
          setAxisStats([]);
          setTerms([]);
          return;
        }

        if (!keywordRes.ok || !keywordJson || !keywordJson.ok) {
          setError((keywordJson && keywordJson.error) || `Failed to load keywords (${keywordRes.status})`);
          setAxisStats(spiderJson.axisStats || []);
          setTerms([]);
          return;
        }

        setAxisStats(spiderJson.axisStats || []);
        setTerms(keywordJson.terms || []);
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : 'Failed to load discovery summary';
        setError(msg);
        setAxisStats([]);
        setTerms([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [workshopId]);

  const chartSize = 640;
  const maxScore = 10;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const radius = 170;

  const axisGeometry = useMemo(() => {
    return AXES.map((a, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
      const end = polar(cx, cy, radius, angle);
      const labelPos = polar(cx, cy, radius + 104, angle);
      const anchor: 'start' | 'middle' | 'end' = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
      return { ...a, angle, end, labelPos, anchor };
    });
  }, [cx, cy, radius]);

  const phaseMedian = useMemo(() => {
    const pick = (phase: AxisKey) => axisStats.find((a) => a.phase === phase && a.tag === 'triple_rating') || null;
    return AXES.map((a) => {
      const s = pick(a.key);
      return {
        today: typeof s?.today?.median === 'number' ? s!.today.median! : 0,
        target: typeof s?.target?.median === 'number' ? s!.target.median! : 0,
        projected: typeof s?.projected?.median === 'number' ? s!.projected.median! : 0,
      };
    });
  }, [axisStats]);

  const currentValues = useMemo(() => phaseMedian.map((x) => x.today), [phaseMedian]);
  const targetValues = useMemo(() => phaseMedian.map((x) => x.target), [phaseMedian]);
  const projectedValues = useMemo(() => phaseMedian.map((x) => x.projected), [phaseMedian]);

  const currentPath = useMemo(
    () => buildPolygonPath({ values: currentValues, cx, cy, radius, max: maxScore }),
    [currentValues, cx, cy, radius]
  );
  const targetPath = useMemo(
    () => buildPolygonPath({ values: targetValues, cx, cy, radius, max: maxScore }),
    [targetValues, cx, cy, radius]
  );
  const projectedPath = useMemo(
    () => buildPolygonPath({ values: projectedValues, cx, cy, radius, max: maxScore }),
    [projectedValues, cx, cy, radius]
  );

  const wordCloud = useMemo(() => {
    const xs = (terms || []).slice(0, 80);
    if (!xs.length) return [];
    const max = Math.max(1, ...xs.map((t) => t.count));
    const min = Math.min(max, ...xs.map((t) => t.count));

    const fontSize = (count: number) => {
      if (max === min) return 18;
      const denom = Math.max(0.0001, Math.log(max) - Math.log(min));
      const t = (Math.log(Math.max(1, count)) - Math.log(Math.max(1, min))) / denom;
      return 14 + t * 28;
    };

    const color = (count: number) => {
      const t = max === min ? 0.5 : (count - min) / (max - min);
      if (t > 0.75) return 'rgb(15 23 42)';
      if (t > 0.5) return 'rgb(51 65 85)';
      return 'rgb(100 116 139)';
    };

    return xs.map((t) => ({ ...t, size: fontSize(t.count), color: color(t.count) }));
  }, [terms]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="text-center text-xs font-semibold tracking-widest text-slate-500">DREAM DISCOVERY</div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white px-8 py-8">
          <div className="text-center text-sm font-medium text-slate-600">Master capability spider</div>

          <div className="mt-6 flex justify-center">
            <svg
              width={chartSize}
              height={chartSize}
              viewBox={`0 0 ${chartSize} ${chartSize}`}
              role="img"
              className="block"
              style={{ overflow: 'visible' }}
            >
              {[0.25, 0.5, 0.75, 1].map((t, idx) => (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r={t * radius}
                  fill="none"
                  stroke="rgb(203 213 225)"
                  strokeWidth={1.4}
                />
              ))}

              {axisGeometry.map((a) => (
                <g key={a.key}>
                  <line x1={cx} y1={cy} x2={a.end.x} y2={a.end.y} stroke="rgb(203 213 225)" strokeWidth={1.6} />
                  <text
                    x={clamp(a.labelPos.x, 32, chartSize - 32)}
                    y={clamp(a.labelPos.y, 32, chartSize - 32)}
                    textAnchor={a.anchor}
                    dominantBaseline="middle"
                    fontSize={15}
                    fontWeight={500}
                    fill="rgb(51 65 85)"
                  >
                    {a.labelLines.map((line, idx) => (
                      <tspan key={idx} x={clamp(a.labelPos.x, 32, chartSize - 32)} dy={idx === 0 ? 0 : 18}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              ))}

              <path d={targetPath} fill="rgba(34,197,94,0.12)" stroke="rgb(34 197 94)" strokeWidth={2.2} />
              <path d={currentPath} fill="rgba(249,115,22,0.14)" stroke="rgb(249 115 22)" strokeWidth={2.2} />
              <path d={projectedPath} fill="rgba(15,23,42,0.06)" stroke="rgb(15 23 42)" strokeWidth={2.2} />

              {AXES.map((ax, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
                const pt = polar(cx, cy, (clamp(currentValues[i] || 0, 0, maxScore) / maxScore) * radius, angle);
                const ptT = polar(cx, cy, (clamp(targetValues[i] || 0, 0, maxScore) / maxScore) * radius, angle);
                const ptP = polar(cx, cy, (clamp(projectedValues[i] || 0, 0, maxScore) / maxScore) * radius, angle);
                return (
                  <g key={ax.key}>
                    <circle cx={pt.x} cy={pt.y} r={4} fill="rgb(249 115 22)" />
                    <circle cx={ptT.x} cy={ptT.y} r={4} fill="rgb(34 197 94)" />
                    <circle cx={ptP.x} cy={ptP.y} r={4} fill="rgb(15 23 42)" />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'rgb(249 115 22)' }} />
              <span>Current capability</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'rgb(34 197 94)' }} />
              <span>Target ambition</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'rgb(15 23 42)' }} />
              <span>Projected if unchanged</span>
            </div>
          </div>

          {loading ? <div className="mt-6 text-center text-sm text-slate-500">Loading…</div> : null}
          {error ? <div className="mt-6 text-center text-sm text-rose-700">{error}</div> : null}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white px-8 py-8">
          <div className="text-center text-sm font-medium text-slate-600">Themes &amp; Intent</div>

          <div className="mt-6">
            {wordCloud.length ? (
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-3">
                {wordCloud.map((t) => (
                  <span
                    key={t.text}
                    className="leading-none"
                    style={{ fontSize: `${t.size}px`, color: t.color }}
                    title={`${t.text} (${t.count})`}
                  >
                    {t.text}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-slate-500">No keyword data available yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
