'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

type RunType = 'BASELINE' | 'FOLLOWUP';

type AxisKey = 'people' | 'corporate' | 'customer' | 'technology' | 'regulation';

type StatPack = { mean: number | null; min: number | null; max: number | null; stdev: number | null; n: number };

type AxisStats = {
  axis: AxisKey;
  label: string;
  today: StatPack;
  target: StatPack;
  projected: StatPack;
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

type SpiderResponse = {
  ok: boolean;
  workshopId: string;
  runType: RunType;
  includeRegulation: boolean;
  generatedAt: string;
  participantCount: number;
  axisStats: AxisStats[];
  individuals: IndividualSeries[];
  error?: string;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

type HoverAxis = {
  axis: AxisKey;
  label: string;
  today: StatPack;
  target: StatPack;
  projected: StatPack;
  participantCount: number;
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
  const [hoverAxis, setHoverAxis] = useState<HoverAxis | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

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

  const axes = useMemo(() => (data?.axisStats || []).map((a) => ({ axis: a.axis, label: a.label })), [data]);

  const maxScore = 10;
  const size = 560;
  const padding = 84;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - padding * 2) / 2;
  const n = axes.length || 1;

  const meanSeries = useMemo(() => {
    const byAxis = new Map((data?.axisStats || []).map((a) => [a.axis, a]));
    const today = axes.map((a) => ({
      axis: a.axis,
      label: a.label,
      value: clamp(typeof byAxis.get(a.axis)?.today.mean === 'number' ? byAxis.get(a.axis)!.today.mean! : 0, 0, maxScore),
    }));
    const target = axes.map((a) => ({
      axis: a.axis,
      label: a.label,
      value: clamp(typeof byAxis.get(a.axis)?.target.mean === 'number' ? byAxis.get(a.axis)!.target.mean! : 0, 0, maxScore),
    }));
    const projected = axes.map((a) => ({
      axis: a.axis,
      label: a.label,
      value: clamp(typeof byAxis.get(a.axis)?.projected.mean === 'number' ? byAxis.get(a.axis)!.projected.mean! : 0, 0, maxScore),
    }));
    return { today, target, projected };
  }, [axes, data]);

  const varianceSegments = useMemo(() => {
    const byAxis = new Map((data?.axisStats || []).map((a) => [a.axis, a]));
    return axes
      .map((a, idx) => {
        const s = byAxis.get(a.axis);
        const min = s?.today.min ?? null;
        const max = s?.today.max ?? null;
        if (typeof min !== 'number' || typeof max !== 'number') return null;
        const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / n;
        const r0 = (clamp(min, 0, maxScore) / maxScore) * radius;
        const r1 = (clamp(max, 0, maxScore) / maxScore) * radius;
        const p0 = polar(cx, cy, r0, angle);
        const p1 = polar(cx, cy, r1, angle);
        return { axis: a.axis, label: a.label, p0, p1 };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }, [axes, data, n, radius, cx, cy]);

  const polygons = useMemo(() => {
    const build = (values: Array<{ value: number }>) => {
      const pts = values.map((d, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const r = (clamp(d.value, 0, maxScore) / maxScore) * radius;
        return polar(cx, cy, r, angle);
      });
      return pts.map((p) => `${p.x},${p.y}`).join(' ');
    };
    return {
      today: build(meanSeries.today),
      target: build(meanSeries.target),
      projected: build(meanSeries.projected),
    };
  }, [meanSeries, n, radius, cx, cy]);

  const individualPolygons = useMemo(() => {
    if (!showIndividuals || !data?.individuals?.length) return [] as Array<{ id: string; label: string; polygon: string }>;

    const axesOrder = axes.map((a) => a.axis);
    return data.individuals.map((ind) => {
      const pts = axesOrder.map((axis, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const v = ind.today?.[axis];
        const r = (clamp(typeof v === 'number' ? v : 0, 0, maxScore) / maxScore) * radius;
        return polar(cx, cy, r, angle);
      });
      return {
        id: ind.participantId,
        label: ind.participantName,
        polygon: pts.map((p) => `${p.x},${p.y}`).join(' '),
      };
    });
  }, [showIndividuals, data, axes, n, radius, cx, cy]);

  const activeOpacity = (layer: 'today' | 'target' | 'projected') => {
    if (!hoverLayer) return layer === 'today' ? 0.18 : layer === 'target' ? 0.14 : 0.10;
    if (hoverLayer === layer) return 0.22;
    return 0.05;
  };

  const activeStrokeWidth = (layer: 'today' | 'target' | 'projected') => {
    if (!hoverLayer) return layer === 'today' ? 2.4 : 2.0;
    return hoverLayer === layer ? 3.2 : 1.2;
  };

  const onMove = (evt: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCursor({ x: evt.clientX - rect.left, y: evt.clientY - rect.top });
  };

  const clearHover = () => {
    setHoverAxis(null);
    setCursor(null);
  };

  const byAxisStats = useMemo(() => new Map((data?.axisStats || []).map((a) => [a.axis, a])), [data]);

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
                <div className="text-sm text-slate-200">How strong do we believe we are today — and where should we be?</div>
                <div className="text-xs text-slate-400">
                  {loading ? 'Loading…' : error ? error : data ? `Participants: ${data.participantCount}` : ''}
                </div>
              </div>

              <div className="mt-4">
                <svg width="100%" viewBox={`0 0 ${size} ${size}`} role="img">
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
                      <g key={a.axis}>
                        <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(148,163,184,0.22)" strokeWidth={1} />
                        <line
                          x1={cx}
                          y1={cy}
                          x2={end.x}
                          y2={end.y}
                          stroke="transparent"
                          strokeWidth={18}
                          onMouseEnter={() => {
                            const s = byAxisStats.get(a.axis);
                            if (!s || !data) return;
                            setHoverAxis({
                              axis: a.axis,
                              label: a.label,
                              today: s.today,
                              target: s.target,
                              projected: s.projected,
                              participantCount: data.participantCount,
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

                  {varianceSegments.map((seg) => (
                    <line
                      key={seg.axis}
                      x1={seg.p0.x}
                      y1={seg.p0.y}
                      x2={seg.p1.x}
                      y2={seg.p1.y}
                      stroke="rgba(59,130,246,0.14)"
                      strokeWidth={10}
                      strokeLinecap="round"
                    />
                  ))}

                  {showIndividuals
                    ? individualPolygons.map((p) => (
                        <polygon
                          key={p.id}
                          points={p.polygon}
                          fill="none"
                          stroke="rgba(148,163,184,0.14)"
                          strokeWidth={1}
                          opacity={0.55}
                        />
                      ))
                    : null}

                  <polygon
                    points={polygons.projected}
                    fill="rgba(226,232,240,1)"
                    opacity={activeOpacity('projected')}
                    stroke="rgba(226,232,240,0.72)"
                    strokeWidth={activeStrokeWidth('projected')}
                    onMouseEnter={() => setHoverLayer('projected')}
                    onMouseLeave={() => setHoverLayer(null)}
                  />
                  <polygon
                    points={polygons.target}
                    fill="rgba(34,197,94,1)"
                    opacity={activeOpacity('target')}
                    stroke="rgba(34,197,94,0.85)"
                    strokeWidth={activeStrokeWidth('target')}
                    onMouseEnter={() => setHoverLayer('target')}
                    onMouseLeave={() => setHoverLayer(null)}
                  />
                  <polygon
                    points={polygons.today}
                    fill="rgba(59,130,246,1)"
                    opacity={activeOpacity('today')}
                    stroke="rgba(59,130,246,0.9)"
                    strokeWidth={activeStrokeWidth('today')}
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
                <div className="mt-1 text-slate-300">Participants: {hoverAxis.participantCount}</div>
                <div className="mt-2 grid grid-cols-1 gap-1">
                  <div>
                    <span className="text-slate-400">Today:</span> {round1(hoverAxis.today.mean)} ({formatRange(hoverAxis.today.min, hoverAxis.today.max)})
                  </div>
                  <div>
                    <span className="text-slate-400">Target:</span> {round1(hoverAxis.target.mean)} ({formatRange(hoverAxis.target.min, hoverAxis.target.max)})
                  </div>
                  <div>
                    <span className="text-slate-400">Projected:</span> {round1(hoverAxis.projected.mean)} ({formatRange(hoverAxis.projected.min, hoverAxis.projected.max)})
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold text-slate-200">Legend</div>
            <div className="mt-3 space-y-2 text-xs text-slate-200">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'rgba(59,130,246,0.9)' }} />
                <div className="min-w-0">
                  <div className="font-medium">Today</div>
                  <div className="text-slate-400">Current average perception.</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'rgba(34,197,94,0.9)' }} />
                <div className="min-w-0">
                  <div className="font-medium">Target</div>
                  <div className="text-slate-400">Target average perception.</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'rgba(226,232,240,0.9)' }} />
                <div className="min-w-0">
                  <div className="font-medium">Projected</div>
                  <div className="text-slate-400">If nothing changes.</div>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="text-sm font-semibold text-slate-200">Variance</div>
              <div className="mt-2 text-xs text-slate-400">
                Each axis shows the range of opinions for Today (min–max) as a subtle blue band.
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="text-sm font-semibold text-slate-200">Controls</div>
              <div className="mt-2 text-xs text-slate-400">
                Toggle individuals to reveal faint per-participant outlines (default off).
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
