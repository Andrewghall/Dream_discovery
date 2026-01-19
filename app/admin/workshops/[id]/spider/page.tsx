'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

type RunType = 'BASELINE' | 'FOLLOWUP';

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

type SpiderResponse = {
  ok: boolean;
  workshopId: string;
  runType: RunType;
  includeRegulation: boolean;
  generatedAt: string;
  participantCount: number;
  axisStats: AxisStats[];
  individuals: IndividualSeries[];
  aggregation?: { method?: string };
  error?: string;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

type HoverAxis = {
  axisId: string;
  label: string;
  questionText: string;
  today: StatPack;
  target: StatPack;
  projected: StatPack;
  participantCount: number;
  aggregationMethod: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number | null): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return (Math.round(n * 10) / 10).toFixed(1);
}

function formatRange(min: number | null, max: number | null): string {
  if (typeof min !== 'number' || typeof max !== 'number') return '—';
  return `${min.toFixed(0)}–${max.toFixed(0)}`;
}

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

export default function WorkshopSpiderPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [runType, setRunType] = useState<RunType>('BASELINE');
  const [showIndividuals, setShowIndividuals] = useState(false);
  const [hoverLayer, setHoverLayer] = useState<'today' | 'target' | 'projected' | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SpiderResponse | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverAxis, setHoverAxis] = useState<HoverAxis | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [svgCursor, setSvgCursor] = useState<{ x: number; y: number } | null>(null);
  const [hoverParticipant, setHoverParticipant] = useState<IndividualSeries | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set('runType', runType);
        if (showIndividuals) qs.set('individuals', '1');
        const r = await fetch(`/api/admin/workshops/${workshopId}/spider?${qs.toString()}`, { cache: 'no-store' });
        const j = (await r.json().catch(() => null)) as SpiderResponse | null;
        if (!alive) return;
        if (!r.ok || !j || !j.ok) {
          setError((j && typeof j.error === 'string' && j.error) || `Failed to load spider (${r.status})`);
          setData(null);
          return;
        }
        setData(j);
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : 'Failed to load spider';
        setError(msg);
        setData(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [workshopId, runType, showIndividuals]);

  const axes = useMemo(() => (data?.axisStats || []).map((a) => ({ axisId: a.axisId, label: a.label })), [data]);

  const maxScore = 10;
  const size = 560;
  const padding = 84;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - padding * 2) / 2;
  const n = axes.length || 1;

  const medianSeries = useMemo(() => {
    const byAxis = new Map((data?.axisStats || []).map((a) => [a.axisId, a]));
    const today = axes.map((a) => ({
      axisId: a.axisId,
      label: a.label,
      value: clamp(typeof byAxis.get(a.axisId)?.today.median === 'number' ? byAxis.get(a.axisId)!.today.median! : 0, 0, maxScore),
    }));
    const target = axes.map((a) => ({
      axisId: a.axisId,
      label: a.label,
      value: clamp(typeof byAxis.get(a.axisId)?.target.median === 'number' ? byAxis.get(a.axisId)!.target.median! : 0, 0, maxScore),
    }));
    const projected = axes.map((a) => ({
      axisId: a.axisId,
      label: a.label,
      value: clamp(typeof byAxis.get(a.axisId)?.projected.median === 'number' ? byAxis.get(a.axisId)!.projected.median! : 0, 0, maxScore),
    }));
    return { today, target, projected };
  }, [axes, data]);

  const linePaths = useMemo(() => {
    const build = (values: Array<{ value: number }>) => {
      const pts = values.map((d, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const r = (clamp(d.value, 0, maxScore) / maxScore) * radius;
        return polar(cx, cy, r, angle);
      });
      if (!pts.length) return '';
      const first = pts[0];
      const rest = pts.slice(1);
      return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')} Z`;
    };
    return {
      today: build(medianSeries.today),
      target: build(medianSeries.target),
      projected: build(medianSeries.projected),
    };
  }, [medianSeries, n, radius, cx, cy]);

  const envelopePaths = useMemo(() => {
    const byAxis = new Map((data?.axisStats || []).map((a) => [a.axisId, a]));
    const build = (layer: 'today' | 'target' | 'projected') => {
      const mins = axes.map((a) => {
        const s = byAxis.get(a.axisId);
        const v = s?.[layer]?.min ?? null;
        return clamp(typeof v === 'number' ? v : 0, 0, maxScore);
      });
      const maxs = axes.map((a) => {
        const s = byAxis.get(a.axisId);
        const v = s?.[layer]?.max ?? null;
        return clamp(typeof v === 'number' ? v : 0, 0, maxScore);
      });
      const ptsOuter = maxs.map((v, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const r = (v / maxScore) * radius;
        return polar(cx, cy, r, angle);
      });
      const ptsInner = mins.map((v, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const r = (v / maxScore) * radius;
          return polar(cx, cy, r, angle);
        });
      if (!ptsOuter.length) return { max: '', min: '' };
      const o0 = ptsOuter[0];
      const oRest = ptsOuter.slice(1);
      const i0 = ptsInner[0];
      const iRest = ptsInner.slice(1);
      return {
        max: `M ${o0.x} ${o0.y} ${oRest.map((p) => `L ${p.x} ${p.y}`).join(' ')} Z`,
        min: `M ${i0.x} ${i0.y} ${iRest.map((p) => `L ${p.x} ${p.y}`).join(' ')} Z`,
      };
    };
    return {
      today: build('today'),
      target: build('target'),
      projected: build('projected'),
    };
  }, [axes, data, n, radius, cx, cy]);

  const individualPaths = useMemo(() => {
    if (!showIndividuals || !data?.individuals?.length) return [] as Array<{ id: string; label: string; d: string; series: IndividualSeries }>;

    const axesOrder = axes.map((a) => a.axisId);
    const build = (values: Array<number>) => {
      const pts = values.map((v, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const r = (clamp(v, 0, maxScore) / maxScore) * radius;
        return polar(cx, cy, r, angle);
      });
      if (!pts.length) return '';
      const first = pts[0];
      const rest = pts.slice(1);
      return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')} Z`;
    };

    return data.individuals
      .map((ind) => {
        const values = axesOrder.map((axis) => {
          const v = ind.today?.[axis];
          return clamp(typeof v === 'number' ? v : 0, 0, maxScore);
        });
        return {
          id: ind.participantId,
          label: ind.participantName,
          d: build(values),
          series: ind,
        };
      })
      .filter((p) => Boolean(p.d));
  }, [showIndividuals, data, axes, n, radius, cx, cy]);

  const nearestAxis = useMemo(() => {
    if (!svgCursor || !axes.length) return null;
    const dx = svgCursor.x - cx;
    const dy = svgCursor.y - cy;
    const ang = Math.atan2(dy, dx);
    const normalized = ((ang + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI));
    const idx = Math.round((normalized / (2 * Math.PI)) * n) % n;
    const axis = axes[idx];
    if (!axis) return null;
    return { index: idx, axisId: axis.axisId, label: axis.label };
  }, [svgCursor, axes, cx, cy, n]);

  const activeStrokeWidth = (layer: 'today' | 'target' | 'projected') => {
    if (!hoverLayer) return layer === 'today' ? 2.4 : 2.0;
    return hoverLayer === layer ? 3.2 : 1.2;
  };

  const onMove = (evt: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCursor({ x: evt.clientX - rect.left, y: evt.clientY - rect.top });

    const svg = svgRef.current;
    if (!svg) return;
    const srect = svg.getBoundingClientRect();
    const sx = ((evt.clientX - srect.left) / Math.max(1, srect.width)) * size;
    const sy = ((evt.clientY - srect.top) / Math.max(1, srect.height)) * size;
    setSvgCursor({ x: sx, y: sy });
  };

  const clearHover = () => {
    setHoverAxis(null);
    setCursor(null);
    setSvgCursor(null);
    setHoverParticipant(null);
  };

  const byAxisStats = useMemo(() => new Map((data?.axisStats || []).map((a) => [a.axisId, a])), [data]);

  return (
    <div className="min-h-screen bg-[#05070f] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-400">Discovery</div>
            <div className="text-xl font-semibold">Master Capability Spider</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/workshops/${workshopId}/hemisphere`}>
              <Button variant="outline" className="bg-black/20 text-slate-200 border-white/15 hover:bg-white/10">
                Hemisphere
              </Button>
            </Link>
            <Button
              variant={runType === 'BASELINE' ? 'default' : 'outline'}
              className={
                runType === 'BASELINE'
                  ? 'h-9 px-3'
                  : 'h-9 px-3 bg-black/20 text-slate-200 border-white/15 hover:bg-white/10'
              }
              onClick={() => setRunType('BASELINE')}
            >
              Baseline
            </Button>
            <Button
              variant={runType === 'FOLLOWUP' ? 'default' : 'outline'}
              className={
                runType === 'FOLLOWUP'
                  ? 'h-9 px-3'
                  : 'h-9 px-3 bg-black/20 text-slate-200 border-white/15 hover:bg-white/10'
              }
              onClick={() => setRunType('FOLLOWUP')}
            >
              Follow-up
            </Button>
            <Button
              variant={showIndividuals ? 'default' : 'outline'}
              className={
                showIndividuals
                  ? 'h-9 px-3'
                  : 'h-9 px-3 bg-black/20 text-slate-200 border-white/15 hover:bg-white/10'
              }
              onClick={() => setShowIndividuals((v) => !v)}
            >
              {showIndividuals ? 'Individuals on' : 'Individuals off'}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr,340px]">
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30"
            onMouseMove={onMove}
            onMouseLeave={clearHover}
          >
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-200">How strong do we believe our capabilities are today — and where do we believe they need to be?</div>
                <div className="text-xs text-slate-400">
                  {loading ? 'Loading…' : error ? error : data ? `Participants: ${data.participantCount}` : ''}
                </div>
              </div>

              <div className="mt-4">
                <svg ref={svgRef} width="100%" viewBox={`0 0 ${size} ${size}`} role="img">
                  {[0.2, 0.4, 0.6, 0.8, 1].map((t, idx) => (
                    <circle
                      key={idx}
                      cx={cx}
                      cy={cy}
                      r={t * radius}
                      fill="none"
                      stroke="rgba(148,163,184,0.22)"
                      strokeWidth={1}
                    />
                  ))}

                  {axes.map((a, i) => {
                    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
                    const end = polar(cx, cy, radius, angle);
                    const labelPos = polar(cx, cy, radius + 42, angle);

                    const anchor = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
                    const x = clamp(labelPos.x, 12, size - 12);
                    const y = clamp(labelPos.y, 16, size - 16);

                    return (
                      <g key={a.axisId}>
                        <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(148,163,184,0.22)" strokeWidth={1} />
                        <line
                          x1={cx}
                          y1={cy}
                          x2={end.x}
                          y2={end.y}
                          stroke="transparent"
                          strokeWidth={18}
                          onMouseEnter={() => {
                            const s = byAxisStats.get(a.axisId);
                            if (!s || !data) return;
                            const method =
                              typeof data.aggregation?.method === 'string' && data.aggregation.method
                                ? data.aggregation.method
                                : 'median';
                            const answered = Math.max(s.today.n, s.target.n, s.projected.n);
                            setHoverAxis({
                              axisId: a.axisId,
                              label: a.label,
                              questionText: s.questionText,
                              today: s.today,
                              target: s.target,
                              projected: s.projected,
                              participantCount: answered,
                              aggregationMethod: method,
                            });
                          }}
                        />
                        <text
                          x={x}
                          y={y}
                          textAnchor={anchor}
                          dominantBaseline="middle"
                          fontSize={12}
                          fill="rgba(226,232,240,0.92)"
                        >
                          {a.label}
                        </text>
                      </g>
                    );
                  })}

                  <path d={envelopePaths.target.max} fill="none" stroke="rgba(34,197,94,0.22)" strokeWidth={1.1} />
                  <path d={envelopePaths.target.min} fill="none" stroke="rgba(34,197,94,0.22)" strokeWidth={1.1} />

                  <path
                    d={envelopePaths.projected.max}
                    fill="none"
                    stroke="rgba(226,232,240,0.18)"
                    strokeWidth={1.1}
                    strokeDasharray="4 6"
                  />
                  <path
                    d={envelopePaths.projected.min}
                    fill="none"
                    stroke="rgba(226,232,240,0.18)"
                    strokeWidth={1.1}
                    strokeDasharray="4 6"
                  />

                  {showIndividuals
                    ? individualPaths.map((p) => (
                        <g key={p.id}>
                          <path d={p.d} fill="none" stroke="rgba(148,163,184,0.20)" strokeWidth={1} opacity={0.55} />
                          <path
                            d={p.d}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={14}
                            onMouseEnter={() => setHoverParticipant(p.series)}
                            onMouseLeave={() => setHoverParticipant(null)}
                          />
                        </g>
                      ))
                    : null}

                  <path
                    d={linePaths.projected}
                    fill="none"
                    opacity={hoverLayer && hoverLayer !== 'projected' ? 0.25 : 1}
                    stroke="rgba(226,232,240,0.70)"
                    strokeWidth={activeStrokeWidth('projected')}
                    strokeDasharray="4 6"
                    onMouseEnter={() => setHoverLayer('projected')}
                    onMouseLeave={() => setHoverLayer(null)}
                  />
                  <path
                    d={linePaths.target}
                    fill="none"
                    opacity={hoverLayer && hoverLayer !== 'target' ? 0.25 : 1}
                    stroke="rgba(34,197,94,0.85)"
                    strokeWidth={activeStrokeWidth('target')}
                    onMouseEnter={() => setHoverLayer('target')}
                    onMouseLeave={() => setHoverLayer(null)}
                  />
                  <path
                    d={linePaths.today}
                    fill="none"
                    opacity={hoverLayer && hoverLayer !== 'today' ? 0.25 : 1}
                    stroke="rgba(59,130,246,0.92)"
                    strokeWidth={activeStrokeWidth('today') + 0.6}
                    onMouseEnter={() => setHoverLayer('today')}
                    onMouseLeave={() => setHoverLayer(null)}
                  />
                </svg>
              </div>
            </div>

            {hoverAxis && cursor ? (
              <div
                className="pointer-events-none absolute z-20 rounded-md border border-white/10 bg-black/70 px-3 py-2 text-xs text-slate-200"
                style={{ left: clamp(cursor.x + 14, 12, 560 - 12), top: clamp(cursor.y + 14, 12, 560 - 12) }}
              >
                <div className="font-semibold">{hoverAxis.label}</div>
                <div className="mt-1 text-slate-300">Answered: {hoverAxis.participantCount}</div>
                <div className="mt-1 text-slate-400">Aggregation: {hoverAxis.aggregationMethod}</div>
                <div className="mt-2 text-slate-200">{hoverAxis.questionText}</div>
                <div className="mt-2 grid grid-cols-1 gap-1">
                  <div>
                    <span className="text-slate-400">Today:</span> {round1(hoverAxis.today.median)} ({formatRange(hoverAxis.today.min, hoverAxis.today.max)}) n={hoverAxis.today.n}
                  </div>
                  <div>
                    <span className="text-slate-400">Target:</span> {round1(hoverAxis.target.median)} ({formatRange(hoverAxis.target.min, hoverAxis.target.max)}) n={hoverAxis.target.n}
                  </div>
                  <div>
                    <span className="text-slate-400">Projected:</span> {round1(hoverAxis.projected.median)} ({formatRange(hoverAxis.projected.min, hoverAxis.projected.max)}) n={hoverAxis.projected.n}
                  </div>
                </div>
              </div>
            ) : null}

            {hoverParticipant && cursor && nearestAxis ? (
              <div
                className="pointer-events-none absolute z-20 rounded-md border border-white/10 bg-black/70 px-3 py-2 text-xs text-slate-200"
                style={{ left: clamp(cursor.x + 14, 12, 560 - 12), top: clamp(cursor.y + 14, 12, 560 - 12) }}
              >
                <div className="font-semibold">{hoverParticipant.participantName}</div>
                <div className="mt-1 text-slate-400">{nearestAxis.label}</div>
                <div className="mt-2 grid grid-cols-1 gap-1">
                  <div>
                    <span className="text-slate-400">Today:</span> {round1(hoverParticipant.today[nearestAxis.axisId] ?? null)}
                  </div>
                  <div>
                    <span className="text-slate-400">Target:</span> {round1(hoverParticipant.target[nearestAxis.axisId] ?? null)}
                  </div>
                  <div>
                    <span className="text-slate-400">Projected:</span> {round1(hoverParticipant.projected[nearestAxis.axisId] ?? null)}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold text-slate-200">Legend</div>
            <div className="mt-3 space-y-2 text-xs text-slate-200">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'rgba(148,163,184,0.30)' }} />
                <div className="min-w-0">
                  <div className="font-medium">Individuals</div>
                  <div className="text-slate-400">Each thin line is one participant’s view (today).</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'rgba(59,130,246,0.92)' }} />
                <div className="min-w-0">
                  <div className="font-medium">Collective (median)</div>
                  <div className="text-slate-400">Bold line is the group’s median today.</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'rgba(34,197,94,0.85)' }} />
                <div className="min-w-0">
                  <div className="font-medium">Target ambition</div>
                  <div className="text-slate-400">Outer envelope shows the range of target answers; the line is the target median.</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'rgba(226,232,240,0.70)' }} />
                <div className="min-w-0">
                  <div className="font-medium">Projected (if nothing changes)</div>
                  <div className="text-slate-400">Dashed envelope shows the range of projected answers; dashed line is the projected median.</div>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="text-sm font-semibold text-slate-200">Controls</div>
              <div className="mt-2 text-xs text-slate-400">
                Toggle individuals to reveal faint per-participant lines (default off). Hover an axis to see the question and how many answered.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 text-xs text-slate-400">
          {loading ? 'Loading…' : error ? error : data ? `Generated ${new Date(data.generatedAt).toLocaleString()}` : ''}
        </div>
      </div>
    </div>
  );
}
