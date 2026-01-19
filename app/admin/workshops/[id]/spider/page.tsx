'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

type RunType = 'BASELINE' | 'FOLLOWUP';

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

type Capability = 'People' | 'Organisation' | 'Customer' | 'Technology' | 'Regulation';

const CAPABILITIES: Capability[] = ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'];

type SpiderAggregates = {
  baseline: number[];
  target: number[];
  projected: number[];
};

function buildPolygonPath(params: { values: number[]; cx: number; cy: number; radius: number; max: number }) {
  const n = CAPABILITIES.length;
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
    if (k === 'today') return 'text-blue-300 font-medium';
    if (k === 'target') return 'text-emerald-300 font-medium';
    if (k === 'projected') return 'text-slate-200 font-medium';
    return 'text-slate-300';
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

export default function WorkshopSpiderPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [runType, setRunType] = useState<RunType>('BASELINE');
  const aggregates = useMemo((): SpiderAggregates => {
    if (runType === 'FOLLOWUP') {
      return {
        baseline: [5.2, 5.8, 5.4, 5.1, 5.0],
        target: [8.0, 8.3, 8.2, 8.1, 8.0],
        projected: [5.1, 5.6, 5.2, 5.0, 4.9],
      };
    }
    return {
      baseline: [4.8, 5.1, 4.6, 4.3, 4.2],
      target: [8.0, 8.2, 8.0, 7.9, 7.8],
      projected: [4.6, 4.9, 4.4, 4.2, 4.0],
    };
  }, [runType]);

  const questionsByCapability = useMemo(() => {
    return {
      People:
        'State where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently. Rate how well-equipped you and your colleagues are to do your jobs effectively.',
      Organisation:
        "State where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently. Rate how well the organisation’s processes and decision-making help you do your job.",
      Customer:
        'State where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently. Rate how well the organisation meets customer needs and expectations.',
      Technology:
        'State where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently. Rate the technology, systems, and tools you use in terms of reliability and ease of use.',
      Regulation:
        'State where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently. Rate how well the organisation handles regulatory and compliance requirements.',
    } satisfies Record<Capability, string>;
  }, []);

  const chartSize = 460;
  const maxScore = 10;
  const padding = 54;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const radius = (chartSize - padding * 2) / 2;

  const axisGeometry = useMemo(() => {
    return CAPABILITIES.map((label, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / CAPABILITIES.length;
      const end = polar(cx, cy, radius, angle);
      const labelPos = polar(cx, cy, radius + 28, angle);
      const anchor: 'start' | 'middle' | 'end' = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
      return { label, angle, end, labelPos, anchor };
    });
  }, [cx, cy, radius]);

  const baselinePath = useMemo(
    () => buildPolygonPath({ values: aggregates.baseline, cx, cy, radius, max: maxScore }),
    [aggregates, cx, cy, radius]
  );
  const targetPath = useMemo(
    () => buildPolygonPath({ values: aggregates.target, cx, cy, radius, max: maxScore }),
    [aggregates, cx, cy, radius]
  );
  const projectedPath = useMemo(
    () => buildPolygonPath({ values: aggregates.projected, cx, cy, radius, max: maxScore }),
    [aggregates, cx, cy, radius]
  );

  return (
    <div className="h-screen overflow-hidden bg-[#05070f] text-slate-100">
      <div className="mx-auto h-full max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Discovery</div>
            <div className="text-xl font-semibold">Master Capability Spider – Discovery Synthesis View</div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/admin/workshops/${workshopId}/hemisphere`}>
              <Button variant="outline" className="h-8 px-3 bg-black/20 text-slate-200 border-white/15 hover:bg-white/10">
                Hemisphere
              </Button>
            </Link>
            <div className="flex items-center rounded-md border border-white/10 bg-black/20 p-0.5">
              <Button
                variant={runType === 'BASELINE' ? 'default' : 'outline'}
                className={runType === 'BASELINE' ? 'h-7 px-3' : 'h-7 px-3 bg-transparent text-slate-200 border-white/0 hover:bg-white/10'}
                onClick={() => setRunType('BASELINE')}
              >
                Baseline
              </Button>
              <Button
                variant={runType === 'FOLLOWUP' ? 'default' : 'outline'}
                className={runType === 'FOLLOWUP' ? 'h-7 px-3' : 'h-7 px-3 bg-transparent text-slate-200 border-white/0 hover:bg-white/10'}
                onClick={() => setRunType('FOLLOWUP')}
              >
                Follow-up
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid h-[calc(100%-44px)] grid-cols-[340px_1fr_340px] gap-6">
          <div className="rounded-xl border border-white/10 bg-black/15 p-4">
            <div className="text-sm font-semibold text-slate-200">Collective capability conclusions</div>
            <div className="mt-3 space-y-2 text-[13px] leading-snug text-slate-200">
              <div className="flex gap-2">
                <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300/60" />
                <div>Alignment is strongest where teams share a clear definition of success and consistent ways of working.</div>
              </div>
              <div className="flex gap-2">
                <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300/60" />
                <div>Capability confidence appears uneven across functions, creating friction at handoffs and decision points.</div>
              </div>
              <div className="flex gap-2">
                <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300/60" />
                <div>Target ambition is broadly shared, but the pathway feels unclear without concrete enablers and ownership.</div>
              </div>
              <div className="flex gap-2">
                <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300/60" />
                <div>Where the projected view is flat, the organisation may be normalising constraints that need redesign.</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-[460px]">
              <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                <div className="text-[13px] leading-snug text-slate-200">
                  How strong do we believe our capabilities are today — and where do we believe they need to be?
                </div>

                <div className="mt-3 flex items-center justify-center">
                  <div className="relative h-[460px] w-[460px]">
                    <svg width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`} role="img" className="block">
                      {[0.2, 0.4, 0.6, 0.8, 1].map((t, idx) => (
                        <circle
                          key={idx}
                          cx={cx}
                          cy={cy}
                          r={t * radius}
                          fill="none"
                          stroke="rgba(148,163,184,0.16)"
                          strokeWidth={1}
                        />
                      ))}

                      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(226,232,240,0.12)" strokeWidth={1.4} />

                      {axisGeometry.map((a) => (
                        <g key={a.label}>
                          <line x1={cx} y1={cy} x2={a.end.x} y2={a.end.y} stroke="rgba(148,163,184,0.14)" strokeWidth={1} />
                          <text
                            x={clamp(a.labelPos.x, 10, chartSize - 10)}
                            y={clamp(a.labelPos.y, 12, chartSize - 12)}
                            textAnchor={a.anchor}
                            dominantBaseline="middle"
                            fontSize={12}
                            fill="rgba(226,232,240,0.86)"
                          >
                            {a.label}
                          </text>
                        </g>
                      ))}

                      <path d={projectedPath} fill="none" stroke="rgba(226,232,240,0.72)" strokeWidth={2} strokeDasharray="4 6" />
                      <path d={targetPath} fill="none" stroke="rgba(34,197,94,0.88)" strokeWidth={2.2} />
                      <path d={baselinePath} fill="none" stroke="rgba(59,130,246,0.94)" strokeWidth={2.6} />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                <div className="grid grid-cols-1 gap-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 border-t-2" style={{ borderColor: 'rgba(59,130,246,0.94)' }} />
                    <span>Collective (median)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 border-t-2" style={{ borderColor: 'rgba(34,197,94,0.88)' }} />
                    <span>Target ambition</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-8 border-t-2 border-dashed"
                      style={{ borderColor: 'rgba(226,232,240,0.72)' }}
                    />
                    <span>Projected (if nothing changes)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/15 p-4">
            <div className="text-sm font-semibold text-slate-200">Discovery questions</div>
            <div className="mt-3 space-y-3">
              {CAPABILITIES.map((cap) => (
                <div key={cap} className="rounded-lg border border-white/10 bg-black/10 p-3">
                  <div className="text-xs font-semibold text-slate-200">{cap}</div>
                  <div className="mt-2">
                    <EmphasisedQuestionText text={questionsByCapability[cap]} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
