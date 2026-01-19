'use client';

import { use, useEffect, useMemo, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  questionText?: string;
  today: { median: number | null; min?: number | null; max?: number | null; n?: number };
  target: { median: number | null; min?: number | null; max?: number | null; n?: number };
  projected: { median: number | null; min?: number | null; max?: number | null; n?: number };
};

type SpiderApiResponse = {
  ok: boolean;
  axisStats: SpiderAxisStat[];
  error?: string;
};

type Focus = 'MASTER' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5';

const FOCUS_OPTIONS: Array<{ value: Focus; label: string }> = [
  { value: 'MASTER', label: 'Master overview' },
  { value: 'D1', label: 'D1 — People' },
  { value: 'D2', label: 'D2 — Organisation' },
  { value: 'D3', label: 'D3 — Customer' },
  { value: 'D4', label: 'D4 — Technology' },
  { value: 'D5', label: 'D5 — Regulation' },
];

type AssumptionsApiResponse = {
  ok: boolean;
  source: 'openai' | 'rules';
  bullets: Array<{ text: string; drivers: string[] }>;
  error?: string;
};

type DimensionMedians = {
  key: 'People' | 'Organisation' | 'Customer' | 'Technology' | 'Regulation';
  current_median: number;
  target_median: number;
  projected_median: number;
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

function EmphasisedQuestionText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const tokens: Array<{ t: string; k: 'today' | 'target' | 'projected' | 'plain' }> = [];
    const src = text || '';

    const patterns: Array<{ re: RegExp; k: 'today' | 'target' | 'projected' }> = [
      { re: /\btoday\b/gi, k: 'today' },
      { re: /\bshould\b/gi, k: 'target' },
      { re: /\b(if they do nothing differently|if nothing changes)\b/gi, k: 'projected' },
    ];

    let i = 0;
    while (i < src.length) {
      let best: { start: number; end: number; k: 'today' | 'target' | 'projected' } | null = null;
      for (const p of patterns) {
        p.re.lastIndex = i;
        const m = p.re.exec(src);
        if (!m || typeof m.index !== 'number') continue;
        const start = m.index;
        const end = start + m[0].length;
        if (!best || start < best.start) best = { start, end, k: p.k };
      }
      if (!best) {
        tokens.push({ t: src.slice(i), k: 'plain' });
        break;
      }
      if (best.start > i) tokens.push({ t: src.slice(i, best.start), k: 'plain' });
      tokens.push({ t: src.slice(best.start, best.end), k: best.k });
      i = best.end;
    }
    return tokens;
  }, [text]);

  const classFor = (k: 'today' | 'target' | 'projected' | 'plain') => {
    if (k === 'today') return 'text-orange-200 font-medium';
    if (k === 'target') return 'text-emerald-200 font-medium';
    if (k === 'projected') return 'text-slate-100 font-medium';
    return 'text-slate-200';
  };

  return (
    <div className="whitespace-pre-wrap text-[12px] leading-snug">
      {parts.map((p, idx) => (
        <span key={idx} className={classFor(p.k)}>
          {p.t}
        </span>
      ))}
    </div>
  );
}

function axisKeyForFocus(focus: Focus): AxisKey | null {
  if (focus === 'D1') return 'people';
  if (focus === 'D2') return 'corporate';
  if (focus === 'D3') return 'customer';
  if (focus === 'D4') return 'technology';
  if (focus === 'D5') return 'regulation';
  return null;
}

function dimensionKeyForAxis(axis: AxisKey): DimensionMedians['key'] {
  if (axis === 'people') return 'People';
  if (axis === 'corporate') return 'Organisation';
  if (axis === 'customer') return 'Customer';
  if (axis === 'technology') return 'Technology';
  return 'Regulation';
}

export default function WorkshopSpiderPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [focus, setFocus] = useState<Focus>('MASTER');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [axisStats, setAxisStats] = useState<SpiderAxisStat[]>([]);

  const [assumptionsLoading, setAssumptionsLoading] = useState(false);
  const [assumptionsError, setAssumptionsError] = useState<string | null>(null);
  const [assumptionsSource, setAssumptionsSource] = useState<'openai' | 'rules' | null>(null);
  const [assumptionsBullets, setAssumptionsBullets] = useState<Array<{ text: string; drivers: string[] }>>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const spiderRes = await fetch(`/api/admin/workshops/${workshopId}/spider?runType=BASELINE&includeIncomplete=1`, {
          cache: 'no-store',
        });

        const spiderJson = (await spiderRes.json().catch(() => null)) as SpiderApiResponse | null;

        if (!alive) return;

        if (!spiderRes.ok || !spiderJson || !spiderJson.ok) {
          setError((spiderJson && spiderJson.error) || `Failed to load spider (${spiderRes.status})`);
          setAxisStats([]);
          return;
        }

        setAxisStats(spiderJson.axisStats || []);
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : 'Failed to load discovery summary';
        setError(msg);
        setAxisStats([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [workshopId]);

  const chartSize = 430;
  const maxScore = 10;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const radius = 128;

  const axisGeometry = useMemo(() => {
    return AXES.map((a, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
      const end = polar(cx, cy, radius, angle);
      const labelPos = polar(cx, cy, radius + 76, angle);
      const anchor: 'start' | 'middle' | 'end' = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
      return { ...a, angle, end, labelPos, anchor };
    });
  }, [cx, cy, radius]);

  const highlightAxis = axisKeyForFocus(focus);

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

  const dimensionsForAgent = useMemo((): DimensionMedians[] => {
    return AXES.map((a, idx) => {
      return {
        key: dimensionKeyForAxis(a.key),
        current_median: phaseMedian[idx]?.today ?? 0,
        target_median: phaseMedian[idx]?.target ?? 0,
        projected_median: phaseMedian[idx]?.projected ?? 0,
      };
    });
  }, [phaseMedian]);

  const questionTextForFocus = useMemo(() => {
    const k = axisKeyForFocus(focus);
    if (!k) return '';
    const s = axisStats.find((a) => a.phase === k && a.tag === 'triple_rating');
    const t = typeof s?.questionText === 'string' ? s?.questionText : '';
    return (t || '').trim();
  }, [axisStats, focus]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!dimensionsForAgent.length) return;

      setAssumptionsLoading(true);
      setAssumptionsError(null);
      setAssumptionsBullets([]);
      setAssumptionsSource(null);

      try {
        const res = await fetch(`/api/admin/workshops/${workshopId}/assumptions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ focus, dimensions: dimensionsForAgent }),
          cache: 'no-store',
        });

        const json = (await res.json().catch(() => null)) as AssumptionsApiResponse | null;
        if (!alive) return;

        if (!res.ok || !json || !json.ok) {
          setAssumptionsError((json && json.error) || `Failed to load assumptions (${res.status})`);
          setAssumptionsBullets([]);
          setAssumptionsSource(null);
          return;
        }

        const bullets = Array.isArray(json.bullets) ? json.bullets : [];
        setAssumptionsSource(json.source || null);
        setAssumptionsBullets(bullets.slice(0, 6));

        if (!bullets.length) {
          setAssumptionsError(json.error || 'Summary assumptions unavailable');
        }
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : 'Summary assumptions unavailable';
        setAssumptionsError(msg);
        setAssumptionsBullets([]);
        setAssumptionsSource(null);
      } finally {
        if (!alive) return;
        setAssumptionsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [workshopId, focus, dimensionsForAgent]);

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

  return (
    <div className="h-screen overflow-hidden bg-[#05070f] text-slate-100">
      <div className="mx-auto h-full max-w-7xl px-6 py-6">
        <div className="grid h-full grid-cols-[1fr_420px] gap-6">
          <div className="min-h-0 rounded-2xl border border-white/10 bg-black/20 p-5 shadow-sm flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold tracking-widest text-slate-400">DREAM DISCOVERY</div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-slate-100">Master Capability Spider</div>
                <div className="mt-1 text-sm text-slate-300">Aggregated medians across all responses</div>
              </div>

              <div className="w-[240px]">
                <div className="text-[11px] text-slate-400">Discovery focus</div>
                <Select value={focus} onValueChange={(v) => setFocus(v as Focus)}>
                  <SelectTrigger className="mt-1 h-9 w-full border-white/10 bg-black/20 text-slate-200">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {FOCUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 grid min-h-0 grid-cols-[1fr_460px] gap-5">
              <div className="min-h-0 rounded-xl border border-white/10 bg-black/10 p-4 overflow-hidden flex flex-col">
                <div className="text-sm font-semibold text-slate-200">Discovery question</div>
                <div className="mt-2 text-xs text-slate-400">
                  {focus === 'MASTER' ? 'Select a dimension to view its wording.' : 'Question wording for the selected dimension.'}
                </div>
                <div className="mt-3 min-h-0 flex-1 overflow-auto pr-1">
                  {focus !== 'MASTER' && questionTextForFocus ? (
                    <EmphasisedQuestionText text={questionTextForFocus} />
                  ) : (
                    <div className="text-[12px] leading-snug text-slate-300">No dimension selected.</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/10 p-4 overflow-hidden">
                <div className="text-sm font-semibold text-slate-200">Spider chart</div>
                <div className="mt-1 text-xs text-slate-400">Median ratings (1–10): current, target ambition, projected</div>

                <div className="mt-3 flex justify-center">
                  <svg width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`} role="img" className="block">
                    <defs>
                      <radialGradient id="spiderGlow" cx="50%" cy="45%" r="70%">
                        <stop offset="0%" stopColor="rgb(56 189 248)" stopOpacity="0.16" />
                        <stop offset="55%" stopColor="rgb(34 197 94)" stopOpacity="0.10" />
                        <stop offset="100%" stopColor="rgb(2 6 23)" stopOpacity="0" />
                      </radialGradient>
                      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="1.2" stdDeviation="2" floodColor="rgb(0 0 0)" floodOpacity="0.35" />
                      </filter>
                    </defs>

                    <circle cx={cx} cy={cy} r={radius * 1.08} fill="url(#spiderGlow)" />

                    {[0.25, 0.5, 0.75, 1].map((t, idx) => (
                      <circle
                        key={idx}
                        cx={cx}
                        cy={cy}
                        r={t * radius}
                        fill="none"
                        stroke="rgba(148,163,184,0.22)"
                        strokeWidth={1.2}
                      />
                    ))}

                    {axisGeometry.map((a) => (
                      <g key={a.key}>
                        <line
                          x1={cx}
                          y1={cy}
                          x2={a.end.x}
                          y2={a.end.y}
                          stroke={highlightAxis === a.key ? 'rgba(226,232,240,0.55)' : 'rgba(148,163,184,0.18)'}
                          strokeWidth={highlightAxis === a.key ? 1.8 : 1.2}
                        />
                        <text
                          x={clamp(a.labelPos.x, 10, chartSize - 10)}
                          y={clamp(a.labelPos.y, 10, chartSize - 10)}
                          textAnchor={a.anchor}
                          dominantBaseline="middle"
                          fontSize={12}
                          fontWeight={highlightAxis === a.key ? 700 : 500}
                          fill={highlightAxis === a.key ? 'rgba(226,232,240,0.95)' : 'rgba(148,163,184,0.85)'}
                        >
                          {a.labelLines.map((line, idx) => (
                            <tspan key={idx} x={clamp(a.labelPos.x, 10, chartSize - 10)} dy={idx === 0 ? 0 : 14}>
                              {line}
                            </tspan>
                          ))}
                        </text>
                      </g>
                    ))}

                    <path
                      d={targetPath}
                      fill="rgba(34,197,94,0.16)"
                      stroke="rgb(34 197 94)"
                      strokeWidth={2.4}
                      filter="url(#softShadow)"
                    />
                    <path
                      d={currentPath}
                      fill="rgba(249,115,22,0.18)"
                      stroke="rgb(249 115 22)"
                      strokeWidth={2.4}
                      filter="url(#softShadow)"
                    />
                    <path
                      d={projectedPath}
                      fill="rgba(226,232,240,0.06)"
                      stroke="rgb(226 232 240)"
                      strokeOpacity={0.55}
                      strokeWidth={2.2}
                      filter="url(#softShadow)"
                    />

                    <circle cx={cx} cy={cy} r={2.5} fill="rgb(148 163 184)" opacity={0.7} />

                    {AXES.map((ax, i) => {
                      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
                      const pt = polar(cx, cy, (clamp(currentValues[i] || 0, 0, maxScore) / maxScore) * radius, angle);
                      const ptT = polar(cx, cy, (clamp(targetValues[i] || 0, 0, maxScore) / maxScore) * radius, angle);
                      const ptP = polar(cx, cy, (clamp(projectedValues[i] || 0, 0, maxScore) / maxScore) * radius, angle);
                      return (
                        <g key={ax.key}>
                          <circle cx={pt.x} cy={pt.y} r={3.8} fill="rgb(249 115 22)" />
                          <circle cx={ptT.x} cy={ptT.y} r={3.8} fill="rgb(34 197 94)" />
                          <circle cx={ptP.x} cy={ptP.y} r={3.8} fill="rgb(226 232 240)" opacity={0.8} />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-200">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'rgb(249 115 22)' }} />
                    <span className="font-medium">Current</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'rgb(34 197 94)' }} />
                    <span className="font-medium">Target</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'rgb(226 232 240)' }} />
                    <span className="font-medium">Projected</span>
                  </div>
                </div>

                {loading ? <div className="mt-3 text-center text-xs text-slate-400">Loading…</div> : null}
                {error ? <div className="mt-3 text-center text-xs text-rose-300">{error}</div> : null}
              </div>
            </div>
          </div>

          <div className="min-h-0 rounded-2xl border border-white/10 bg-black/20 p-5 shadow-sm flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">Summary assumptions</div>
                <div className="mt-1 text-xs text-slate-400">Rule-backed synthesis from the aggregated medians</div>
              </div>
              <div className="text-[11px] text-slate-400">
                {assumptionsSource ? `Source: ${assumptionsSource}` : 'Source: —'}
              </div>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1">
              {assumptionsLoading ? <div className="text-xs text-slate-400">Generating…</div> : null}
              {!assumptionsLoading && assumptionsError ? <div className="text-xs text-rose-300">{assumptionsError}</div> : null}

              {!assumptionsLoading && assumptionsBullets.length ? (
                <div className="space-y-3">
                  {assumptionsBullets.map((b, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                      <div className="text-[12px] leading-snug text-slate-200">{b.text}</div>
                      {b.drivers?.length ? (
                        <div className="mt-1 text-[10px] text-slate-500">{b.drivers.join(' · ')}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {!assumptionsLoading && !assumptionsBullets.length && !assumptionsError ? (
                <div className="text-xs text-slate-400">No assumptions available yet.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
