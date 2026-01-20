'use client';

import { memo, useMemo, useRef, useState } from 'react';

export type HemispherePrimaryType =
  | 'VISIONARY'
  | 'OPPORTUNITY'
  | 'CONSTRAINT'
  | 'RISK'
  | 'ENABLER'
  | 'ACTION'
  | 'QUESTION'
  | 'INSIGHT';

export type HemisphereDialoguePhase = 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';

export type HemisphereNodeDatum = {
  dataPointId: string;
  createdAtMs: number;
  rawText: string;
  dataPointSource: string;
  dialoguePhase: HemisphereDialoguePhase | null;
  intent?: string | null;
  themeId?: string | null;
  themeLabel?: string | null;
  transcriptChunk: {
    startTimeMs: number;
    endTimeMs: number;
    confidence: number | null;
    source: string;
  } | null;
  classification: {
    primaryType: HemispherePrimaryType;
    confidence: number;
    keywords: string[];
    suggestedArea: string | null;
    updatedAt: string;
  } | null;
};

type PositionedNode = HemisphereNodeDatum & {
  x: number;
  y: number;
  r: number;
  fill: string;
  stroke: string;
  label: string;
  conf: number | null;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function primaryColor(type: HemispherePrimaryType | null) {
  switch (type) {
    case 'VISIONARY':
      return '#8b5cf6';
    case 'OPPORTUNITY':
      return '#3b82f6';
    case 'CONSTRAINT':
      return '#f97316';
    case 'RISK':
      return '#ef4444';
    case 'ENABLER':
      return '#14b8a6';
    case 'INSIGHT':
      return '#10b981';
    case 'ACTION':
      return '#f59e0b';
    case 'QUESTION':
      return '#0ea5e9';
    default:
      return '#94a3b8';
  }
}

function intentColor(intent: string) {
  const palette = [
    '#a855f7',
    '#3b82f6',
    '#14b8a6',
    '#22c55e',
    '#f59e0b',
    '#f97316',
    '#ef4444',
    '#06b6d4',
  ];
  const i = Math.floor(hash01(intent) * palette.length);
  return palette[Math.max(0, Math.min(palette.length - 1, i))];
}

export const HemisphereNodes = memo(function HemisphereNodes(props: {
  nodes: HemisphereNodeDatum[];
  originTimeMs: number | null;
  timeScaleMs?: number;
  onNodeClick?: (node: HemisphereNodeDatum) => void;
  themeAttractors?: Record<string, { x: number; y: number; strength: number; label: string }>;
  links?: Array<{
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    strength: number;
    color?: string;
    width?: number;
  }>;
  className?: string;
}) {
  const { nodes, originTimeMs, timeScaleMs = 10 * 60 * 1000, onNodeClick, themeAttractors, links, className } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const tooltipRafRef = useRef<number | null>(null);
  const [tooltip, setTooltip] = useState<{ label: string; conf: number | null } | null>(null);

  const scheduleTooltipPositionUpdate = (attempt = 0) => {
    if (tooltipRafRef.current != null) return;
    tooltipRafRef.current = requestAnimationFrame(() => {
      tooltipRafRef.current = null;
      const el = tooltipRef.current;
      if (!el) {
        if (attempt < 2) scheduleTooltipPositionUpdate(attempt + 1);
        return;
      }
      const pos = tooltipPosRef.current;
      el.style.left = `${pos.x + 10}px`;
      el.style.top = `${pos.y + 10}px`;
    });
  };

  const positioned = useMemo<PositionedNode[]>(() => {
    const W = 1000;
    const H = 520;
    const pad = 32;
    const cx = W / 2;
    const cy = H - pad;
    const R = Math.min(cx - pad, cy - pad);
    const rMin = R * 0.25;

    const t0 = originTimeMs ?? Math.min(...nodes.map((n) => n.createdAtMs));

    return nodes.map((n) => {
      const dt = Math.max(0, n.createdAtMs - t0);
      const u = 1 - Math.exp(-dt / Math.max(1, timeScaleMs));
      const baseTheta = Math.PI - clamp01(u) * Math.PI;

      // Dialogue phase bias (future utterances only). If phase is null, keep base layout unchanged.
      // Right = REIMAGINE, Left = CONSTRAINTS, Center = DEFINE_APPROACH.
      const phaseStrength = n.dialoguePhase ? 0.22 : 0;
      const targetTheta =
        n.dialoguePhase === 'CONSTRAINTS'
          ? (5 * Math.PI) / 6
          : n.dialoguePhase === 'DEFINE_APPROACH'
            ? Math.PI / 2
            : n.dialoguePhase === 'REIMAGINE'
              ? Math.PI / 6
              : baseTheta;

      const theta = lerp(baseTheta, targetTheta, phaseStrength);

      const clsType = n.classification?.primaryType ?? null;
      const clsConf = typeof n.classification?.confidence === 'number' ? n.classification.confidence : null;
      const radialConf = clamp01(clsConf ?? 0.35);

      const jitter = (hash01(n.dataPointId) - 0.5) * 18;
      const radial = rMin + radialConf * (R - rMin) + jitter;

      const baseX = cx + radial * Math.cos(theta);
      const baseY = cy - radial * Math.sin(theta);

      const attractor = n.themeId && themeAttractors ? themeAttractors[n.themeId] : null;
      const pull = attractor ? clamp01(0.08 + 0.12 * Math.log1p(Math.max(0, attractor.strength))) : 0;
      const microJitter = (hash01(`theme:${n.dataPointId}`) - 0.5) * 10;
      const x = attractor ? lerp(baseX, attractor.x, pull) + microJitter : baseX;
      const y = attractor ? lerp(baseY, attractor.y, pull) + microJitter : baseY;

      const fill = clsType ? primaryColor(clsType) : n.intent ? intentColor(n.intent) : primaryColor(null);
      const stroke = 'rgba(15,23,42,0.22)';

      return {
        ...n,
        x,
        y,
        r: 6,
        fill,
        stroke,
        label: (n.themeLabel || n.intent)?.toUpperCase() || (clsType ?? 'UNCLASSIFIED'),
        conf: clsConf,
      };
    });
  }, [nodes, originTimeMs, timeScaleMs, themeAttractors]);

  const convergenceLinks = useMemo(() => {
    if (!themeAttractors) return [] as Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      opacity: number;
    }>;

    const now = Date.now();
    const recent = positioned.slice(Math.max(0, positioned.length - 96));

    const out: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; opacity: number }> = [];
    for (const n of recent) {
      if (!n.themeId) continue;
      const t = themeAttractors[n.themeId];
      if (!t) continue;
      if (t.strength < 2) continue;

      const ageMs = Math.max(0, now - n.createdAtMs);
      const age01 = clamp01(ageMs / (3 * 60 * 1000));
      const opacity = clamp01(0.22 * (1 - age01));
      if (opacity <= 0.02) continue;

      out.push({
        id: `theme:${n.dataPointId}`,
        x1: n.x,
        y1: n.y,
        x2: t.x,
        y2: t.y,
        opacity,
      });
    }
    return out;
  }, [positioned, themeAttractors]);

  const intraThemeLinks = useMemo(() => {
    if (!themeAttractors) {
      return [] as Array<{ id: string; x1: number; y1: number; x2: number; y2: number; opacity: number }>;
    }

    const now = Date.now();
    const recent = positioned.slice(Math.max(0, positioned.length - 140));

    const byTheme: Record<string, PositionedNode[]> = {};
    for (const n of recent) {
      if (!n.themeId) continue;
      const t = themeAttractors[n.themeId];
      if (!t || t.strength < 2) continue;
      (byTheme[n.themeId] ||= []).push(n);
    }

    const out: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; opacity: number }> = [];
    for (const [themeId, group] of Object.entries(byTheme)) {
      group.sort((a, b) => a.createdAtMs - b.createdAtMs);
      const tail = group.slice(Math.max(0, group.length - 10));
      for (let i = 1; i < tail.length; i++) {
        const a = tail[i - 1];
        const b = tail[i];
        const ageMs = Math.max(0, now - Math.max(a.createdAtMs, b.createdAtMs));
        const age01 = clamp01(ageMs / (3 * 60 * 1000));
        const opacity = clamp01(0.16 * (1 - age01));
        if (opacity <= 0.02) continue;
        out.push({
          id: `theme-chain:${themeId}:${a.dataPointId}:${b.dataPointId}`,
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          opacity,
        });
      }
    }

    return out;
  }, [positioned, themeAttractors]);

  const backdrop = useMemo(() => {
    const W = 1000;
    const H = 520;
    const pad = 32;
    const cx = W / 2;
    const cy = H - pad;
    const R = Math.min(cx - pad, cy - pad);

    const arc = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
    const rings = [0.25, 0.5, 0.75].map((p) => {
      const r = R * p;
      return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
    });

    const spokes = [0.2, 0.4, 0.6, 0.8].map((p) => {
      const theta = Math.PI - p * Math.PI;
      const x = cx + R * Math.cos(theta);
      const y = cy - R * Math.sin(theta);
      return `M ${cx} ${cy} L ${x} ${y}`;
    });

    return { W, H, cx, cy, R, arc, rings, spokes };
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${backdrop.W} ${backdrop.H}`} className="w-full h-full">
        <path d={backdrop.arc} fill="none" stroke="rgba(148,163,184,0.6)" strokeWidth={2} />
        {backdrop.rings.map((d) => (
          <path key={d} d={d} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth={1} />
        ))}
        {backdrop.spokes.map((d) => (
          <path key={d} d={d} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth={1} />
        ))}

        <g pointerEvents="none">
          <text
            x={backdrop.cx - backdrop.R}
            y={backdrop.cy + 18}
            fontSize={11}
            fill="rgba(15,23,42,0.55)"
            textAnchor="start"
          >
            Earlier
          </text>
          <text
            x={backdrop.cx + backdrop.R}
            y={backdrop.cy + 18}
            fontSize={11}
            fill="rgba(15,23,42,0.55)"
            textAnchor="end"
          >
            Later
          </text>

          {(
            [
              { theta: (5 * Math.PI) / 6, label: 'Constraints' },
              { theta: Math.PI / 2, label: 'Define approach' },
              { theta: Math.PI / 6, label: 'Reimagine' },
            ] as const
          ).map((p) => {
            const r = backdrop.R * 0.92;
            const x = backdrop.cx + r * Math.cos(p.theta);
            const y = backdrop.cy - r * Math.sin(p.theta);
            return (
              <text
                key={p.label}
                x={x}
                y={y}
                fontSize={12}
                fill="rgba(15,23,42,0.62)"
                textAnchor="middle"
              >
                {p.label}
              </text>
            );
          })}

          {(
            [
              { p: 0.25, label: 'Low confidence' },
              { p: 0.5, label: 'Mid' },
              { p: 0.75, label: 'High confidence' },
            ] as const
          ).map((r) => (
            <text
              key={r.label}
              x={backdrop.cx + backdrop.R * r.p}
              y={backdrop.cy - 10}
              fontSize={10}
              fill="rgba(15,23,42,0.45)"
              textAnchor="middle"
            >
              {r.label}
            </text>
          ))}
        </g>

        {links
          ? links.map((l) => (
              <line
                key={l.id}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={
                  l.color
                    ? l.color
                    : `rgba(99,102,241,${clamp01(0.10 + 0.18 * clamp01(l.strength))})`
                }
                strokeWidth={
                  typeof l.width === 'number'
                    ? l.width
                    : Math.max(1, Math.min(3.5, 1 + 2.5 * clamp01(l.strength)))
                }
              />
            ))
          : null}

        {intraThemeLinks.map((l) => (
          <line
            key={l.id}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={`rgba(148,163,184,${l.opacity})`}
            strokeWidth={1}
          />
        ))}

        {convergenceLinks.map((l) => (
          <line
            key={l.id}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={`rgba(148,163,184,${l.opacity})`}
            strokeWidth={1}
          />
        ))}

        {themeAttractors
          ? Object.entries(themeAttractors).map(([id, t]) => (
              t.strength < 2 ? null : (
                <circle
                  key={id}
                  cx={t.x}
                  cy={t.y}
                  r={Math.max(6, Math.min(18, 6 + 2 * Math.log1p(Math.max(0, t.strength))))}
                  fill="rgba(148,163,184,0.12)"
                  stroke="rgba(148,163,184,0.35)"
                  strokeWidth={1}
                >
                  <title>{`${t.label} (${t.strength})`}</title>
                </circle>
              )
            ))
          : null}

        {positioned.map((n) => (
          <circle
            key={n.dataPointId}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.fill}
            stroke={n.stroke}
            strokeWidth={1}
            onMouseEnter={(e) => {
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              tooltipPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
              scheduleTooltipPositionUpdate();
              setTooltip({ label: n.label, conf: n.conf });
            }}
            onMouseMove={(e) => {
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              tooltipPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
              scheduleTooltipPositionUpdate();
            }}
            onMouseLeave={() => setTooltip(null)}
            onClick={() => onNodeClick?.(n)}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </svg>

      {tooltip ? (
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            pointerEvents: 'none',
          }}
          className="rounded-md border bg-background px-2 py-1 text-xs shadow-md"
        >
          <div className="font-medium">{tooltip.label}</div>
          <div className="text-muted-foreground">
            {tooltip.conf == null ? 'Confidence: —' : `Confidence: ${(tooltip.conf * 100).toFixed(0)}%`}
          </div>
        </div>
      ) : null}
    </div>
  );
});
