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
  className?: string;
}) {
  const { nodes, originTimeMs, timeScaleMs = 10 * 60 * 1000, onNodeClick, themeAttractors, className } = props;

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

      const fill = n.intent ? intentColor(n.intent) : primaryColor(clsType);
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

    return { W, H, arc, rings, spokes };
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

        {themeAttractors
          ? Object.entries(themeAttractors).map(([id, t]) => (
              <circle
                key={id}
                cx={t.x}
                cy={t.y}
                r={Math.max(6, Math.min(18, 6 + 2 * Math.log1p(Math.max(0, t.strength))))}
                fill="rgba(148,163,184,0.12)"
                stroke="rgba(148,163,184,0.35)"
                strokeWidth={1}
              />
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
