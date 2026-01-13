'use client';

import { cn } from '@/lib/utils';

export interface RadarDatum {
  label: string;
  value: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

export function RadarChart({
  data,
  size = 320,
  max = 10,
  className,
}: {
  data: RadarDatum[];
  size?: number;
  max?: number;
  className?: string;
}) {
  const padding = 52;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - padding * 2) / 2;

  const n = data.length;
  const points = data.map((d, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = (clamp(d.value, 0, max) / max) * radius;
    return polarToCartesian(cx, cy, r, angle);
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');

  const rings = [0.25, 0.5, 0.75, 1].map((t) => t * radius);

  return (
    <div className={cn('w-full', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        {rings.map((r, idx) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={1}
            opacity={0.7}
          />
        ))}

        {data.map((d, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const end = polarToCartesian(cx, cy, radius, angle);
          return (
            <line
              key={d.label}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              opacity={0.7}
            />
          );
        })}

        <polygon
          points={polygon}
          fill="hsl(var(--primary))"
          opacity={0.18}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
        />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="hsl(var(--primary))"
          />
        ))}

        {data.map((d, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const labelPos = polarToCartesian(cx, cy, radius + 18, angle);
          const anchor =
            Math.abs(Math.cos(angle)) < 0.2
              ? 'middle'
              : Math.cos(angle) > 0
                ? 'start'
                : 'end';

          return (
            <text
              key={d.label}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={12}
              fill="hsl(var(--muted-foreground))"
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
