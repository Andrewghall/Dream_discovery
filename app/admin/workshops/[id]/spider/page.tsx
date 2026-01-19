'use client';

import { use, useMemo, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { FIXED_QUESTIONS } from '@/lib/conversation/fixed-questions';

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

type DiscoveryFocus = 'MASTER' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5';

const FOCUS_OPTIONS: Array<{ value: DiscoveryFocus; label: string }> = [
  { value: 'MASTER', label: 'Master overview' },
  { value: 'D1', label: 'D1 — People' },
  { value: 'D2', label: 'D2 — Organisation' },
  { value: 'D3', label: 'D3 — Customer' },
  { value: 'D4', label: 'D4 — Technology' },
  { value: 'D5', label: 'D5 — Regulation' },
];

type SpiderAggregates = {
  collective: number[];
  target: number[];
  projected: number[];
};

type DimensionMedians = {
  today: number;
  target: number;
  projected: number;
};

function tripleRatingQuestionText(phase: keyof typeof FIXED_QUESTIONS): string {
  const list = FIXED_QUESTIONS[phase] || [];
  const q = list.find((x) => x.tag === 'triple_rating');
  return (q && q.text) || '';
}

function capabilityForFocus(focus: DiscoveryFocus): Capability | null {
  if (focus === 'D1') return 'People';
  if (focus === 'D2') return 'Organisation';
  if (focus === 'D3') return 'Customer';
  if (focus === 'D4') return 'Technology';
  if (focus === 'D5') return 'Regulation';
  return null;
}

function phaseForCapability(cap: Capability): keyof typeof FIXED_QUESTIONS {
  if (cap === 'People') return 'people';
  if (cap === 'Organisation') return 'corporate';
  if (cap === 'Customer') return 'customer';
  if (cap === 'Technology') return 'technology';
  return 'regulation';
}

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

function SingleDimensionChart({ values }: { values: DimensionMedians }) {
  const w = 420;
  const h = 320;
  const max = 10;
  const min = 0;
  const top = 18;
  const bottom = 26;
  const left = 54;
  const right = 18;

  const plotW = w - left - right;
  const plotH = h - top - bottom;

  const y = (v: number) => top + (1 - clamp((v - min) / (max - min), 0, 1)) * plotH;
  const barBaseY = top + plotH;
  const barW = 68;
  const gap = 44;
  const x0 = left + (plotW - (barW * 3 + gap * 2)) / 2;

  const bars = [
    { key: 'Today', v: values.today, color: 'rgba(59,130,246,0.90)' },
    { key: 'Target', v: values.target, color: 'rgba(34,197,94,0.85)' },
    { key: 'Projected', v: values.projected, color: 'rgba(226,232,240,0.70)', dashed: true as const },
  ];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" className="block">
      {[2, 4, 6, 8, 10].map((t) => (
        <g key={t}>
          <line x1={left} y1={y(t)} x2={w - right} y2={y(t)} stroke="rgba(148,163,184,0.14)" strokeWidth={1} />
          <text x={left - 10} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="rgba(148,163,184,0.75)">
            {t}
          </text>
        </g>
      ))}

      <line x1={left} y1={top} x2={left} y2={barBaseY} stroke="rgba(148,163,184,0.18)" strokeWidth={1} />

      {bars.map((b, idx) => {
        const x = x0 + idx * (barW + gap);
        const barTop = y(b.v);
        const bh = Math.max(0, barBaseY - barTop);
        return (
          <g key={b.key}>
            <rect x={x} y={barTop} width={barW} height={bh} fill={b.color} opacity={b.dashed ? 0.35 : 0.55} />
            {b.dashed ? (
              <line x1={x} y1={barTop} x2={x + barW} y2={barTop} stroke={b.color} strokeWidth={2} strokeDasharray="4 6" />
            ) : (
              <line x1={x} y1={barTop} x2={x + barW} y2={barTop} stroke={b.color} strokeWidth={2.2} />
            )}
            <text x={x + barW / 2} y={barBaseY + 16} textAnchor="middle" fontSize={12} fill="rgba(226,232,240,0.86)">
              {b.key}
            </text>
          </g>
        );
      })}

      <text x={left} y={h - 6} textAnchor="start" fontSize={11} fill="rgba(148,163,184,0.70)">
        Median rating (1–10)
      </text>
    </svg>
  );
}

export default function WorkshopSpiderPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  const [focus, setFocus] = useState<DiscoveryFocus>('MASTER');

  const aggregates = useMemo((): SpiderAggregates => {
    return {
      collective: [4.8, 5.1, 4.6, 4.3, 4.2],
      target: [8.0, 8.2, 8.0, 7.9, 7.8],
      projected: [4.6, 4.9, 4.4, 4.2, 4.0],
    };
  }, []);

  const activeCapability = capabilityForFocus(focus);

  const activeMedians = useMemo((): DimensionMedians | null => {
    if (!activeCapability) return null;
    const idx = CAPABILITIES.indexOf(activeCapability);
    return {
      today: aggregates.collective[idx] ?? 0,
      target: aggregates.target[idx] ?? 0,
      projected: aggregates.projected[idx] ?? 0,
    };
  }, [activeCapability, aggregates]);

  const dimensionDescriptions = useMemo(() => {
    return {
      People: 'Capability to deliver through skills, capacity, collaboration and day-to-day ways of working.',
      Organisation: 'Clarity and effectiveness of decision-making, ownership, governance, and operating rhythm.',
      Customer: 'Ability to consistently understand, serve and improve customer outcomes and experience.',
      Technology: 'Reliability and fitness of tools, systems, data and integration that enable the work.',
      Regulation: 'Strength of compliance, controls, and readiness for regulatory change and scrutiny.',
    } satisfies Record<Capability, string>;
  }, []);

  const masterConclusions = useMemo(
    () => [
      'Strength is most evident where expectations are shared and teams have a consistent operating rhythm.',
      'Where capability confidence is uneven, handoffs and prioritisation decisions become slow and fragile.',
      'Ambition is broadly aligned, but enablers and ownership are not yet explicit enough to shift trajectory.',
      'Projected stagnation signals constraints being normalised rather than designed out.',
    ],
    []
  );

  const dimensionSummaries = useMemo(() => {
    return {
      People: [
        'Roles and expectations need sharper clarity to reduce duplication and hidden work.',
        'Capability development is not yet systematic; learning is uneven across teams.',
        'Cross-team collaboration is dependent on individuals rather than repeatable mechanisms.',
        'Workload pressure is eroding quality and limiting time for improvement.',
      ],
      Organisation: [
        'Decision rights and ownership are unclear in critical areas, slowing delivery.',
        'Processes are experienced as heavy in some places and absent in others.',
        'Prioritisation lacks a stable cadence, creating reactive switching costs.',
        'Governance signals intent, but follow-through is inconsistent.',
      ],
      Customer: [
        'Customer outcomes are understood locally but not consistently shared across functions.',
        'Feedback loops exist but are not translating into systematic improvement.',
        'Ownership of end-to-end experience breaks at organisational boundaries.',
        'Measures of success vary by team, reducing coherence of focus.',
      ],
      Technology: [
        'Tooling reliability and workarounds are consuming time and attention.',
        'Data quality limits confidence and slows decisions.',
        'Integration gaps create manual steps that accumulate hidden operational risk.',
        'Technology change feels hard to land due to competing priorities and dependencies.',
      ],
      Regulation: [
        'Compliance effort is felt as reactive rather than embedded into delivery.',
        'Regulatory change readiness varies, creating uneven confidence.',
        'Controls and evidence gathering are not consistently repeatable.',
        'Teams want clarity on what “good” looks like to reduce rework and surprises.',
      ],
    } satisfies Record<Capability, string[]>;
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
    () => buildPolygonPath({ values: aggregates.collective, cx, cy, radius, max: maxScore }),
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

  const isMaster = focus === 'MASTER';
  const focusLabel = FOCUS_OPTIONS.find((o) => o.value === focus)?.label || 'Master overview';

  const rightPanelTitle = isMaster ? 'Discovery dimensions' : 'Discovery question';
  const leftPanelTitle = isMaster
    ? 'Collective capability conclusions'
    : activeCapability
      ? `${activeCapability} capability – summary`
      : 'Capability summary';

  const questionText = useMemo(() => {
    if (!activeCapability) return '';
    const phase = phaseForCapability(activeCapability);
    const base = tripleRatingQuestionText(phase);
    const scale = '\n\nScale reference: 1–10';
    return `${base}${scale}`.trim();
  }, [activeCapability]);

  return (
    <div className="h-screen overflow-hidden bg-[#05070f] text-slate-100">
      <div className="mx-auto h-full max-w-7xl px-6 py-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-slate-400">Discovery focus</div>
            <Select value={focus} onValueChange={(v) => setFocus(v as DiscoveryFocus)}>
              <SelectTrigger className="h-9 w-[240px] bg-black/15 border-white/10 text-slate-200">
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

          <div className="pt-1 text-sm text-slate-300">{focusLabel}</div>
        </div>

        <div className="mt-5 grid h-[calc(100%-44px)] grid-cols-[340px_1fr_340px] gap-6">
          <div className="rounded-xl border border-white/10 bg-black/15 p-4">
            <div className="text-sm font-semibold text-slate-200">{leftPanelTitle}</div>
            <div className="mt-3 space-y-2 text-[13px] leading-snug text-slate-200">
              {(isMaster ? masterConclusions : activeCapability ? dimensionSummaries[activeCapability] : []).slice(0, isMaster ? 5 : 6).map((t, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300/60" />
                  <div>{t}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-[460px]">
              <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                {isMaster ? (
                  <div className="text-[13px] leading-snug text-slate-200">
                    Where is the organisation collectively strong or weak?
                  </div>
                ) : activeCapability ? (
                  <div className="text-[13px] leading-snug text-slate-200">
                    {activeCapability}: today, target ambition, and projected (median)
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-center">
                  <div className="relative h-[460px] w-[460px] flex items-center justify-center">
                    {isMaster ? (
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
                    ) : activeMedians ? (
                      <SingleDimensionChart values={activeMedians} />
                    ) : null}
                  </div>
                </div>
              </div>

              {isMaster ? (
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
                      <span className="inline-block w-8 border-t-2 border-dashed" style={{ borderColor: 'rgba(226,232,240,0.72)' }} />
                      <span>Projected (if nothing changes)</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/15 p-4">
            <div className="text-sm font-semibold text-slate-200">{rightPanelTitle}</div>
            <div className="mt-3 space-y-3">
              {isMaster ? (
                CAPABILITIES.map((cap) => (
                  <div key={cap} className="rounded-lg border border-white/10 bg-black/10 p-3">
                    <div className="text-xs font-semibold text-slate-200">{cap}</div>
                    <div className="mt-2 text-[12px] leading-snug text-slate-300">{dimensionDescriptions[cap]}</div>
                  </div>
                ))
              ) : activeCapability ? (
                <div className="rounded-lg border border-white/10 bg-black/10 p-3">
                  <EmphasisedQuestionText text={questionText} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
