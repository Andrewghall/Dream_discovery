'use client';

import { cn } from '@/lib/utils';

export interface RadarDatum {
  label: string;
  value: number;
}

export interface RadarSeries {
  name: string;
  data: RadarDatum[];
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
  series,
  size = 320,
  max = 10,
  className,
}: {
  data: RadarDatum[];
  series?: RadarSeries[];
  size?: number;
  max?: number;
  className?: string;
}) {
  const padding = 52;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - padding * 2) / 2;

  const baseData = (series?.[0]?.data?.length ? series[0].data : data) || [];
  const n = baseData.length;

  const normalizedSeries: RadarSeries[] =
    series && series.length
      ? series
      : [
          {
            name: 'Value',
            data,
          },
        ];

  const seriesPolygons = normalizedSeries.map((s) => {
    const points = s.data.map((d, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const r = (clamp(d.value, 0, max) / max) * radius;
      return polarToCartesian(cx, cy, r, angle);
    });

    return {
      name: s.name,
      points,
      polygon: points.map((p) => `${p.x},${p.y}`).join(' '),
    };
  });

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

        {baseData.map((d, i) => {
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

        {seriesPolygons.map((s, idx) => {
          const stroke =
            idx === 0
              ? 'hsl(var(--chart-1))'
              : idx === 1
                ? 'hsl(var(--chart-2))'
                : idx === 2
                  ? 'hsl(var(--chart-3))'
                  : 'hsl(var(--primary))';
          const fillOpacity = idx === 0 ? 0.18 : idx === 1 ? 0.14 : 0.1;
          return (
            <g key={s.name}>
              <polygon
                points={s.polygon}
                fill={stroke}
                opacity={fillOpacity}
                stroke={stroke}
                strokeWidth={2}
              />
              {s.points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={stroke} />
              ))}
            </g>
          );
        })}

        {baseData.map((d, i) => {
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

      {series && series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s, idx) => {
            const colorClass =
              idx === 0
                ? 'text-[hsl(var(--chart-1))]'
                : idx === 1
                  ? 'text-[hsl(var(--chart-2))]'
                  : idx === 2
                    ? 'text-[hsl(var(--chart-3))]'
                    : 'text-[hsl(var(--primary))]';
            return (
              <div key={s.name} className="flex items-center gap-2">
                <span className={cn('inline-block h-2 w-2 rounded-sm', colorClass)} style={{ background: 'currentColor' }} />
                <span>{s.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
