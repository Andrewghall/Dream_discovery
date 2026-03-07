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

function chartColor(idx: number): string {
  if (idx === 0) return 'var(--chart-1)';
  if (idx === 1) return 'var(--chart-2)';
  if (idx === 2) return 'var(--chart-3)';
  if (idx === 3) return 'var(--chart-4)';
  return 'var(--chart-5)';
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
  const padding = 90;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - padding * 2) / 2;
  const labelFontSize = 10;

  const baseData = (series?.[0]?.data?.length ? series[0].data : data) || [];
  const n = baseData.length;

  if (n < 1) {
    return (
      <div className={cn('w-full flex items-center justify-center text-muted-foreground text-sm py-8', className)}>
        No data available
      </div>
    );
  }

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
      <svg width="100%" style={{ aspectRatio: '1 / 1', maxWidth: size }} viewBox={`0 0 ${size} ${size}`} role="img">
        {rings.map((r, idx) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--border)"
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
              stroke="var(--border)"
              strokeWidth={1}
              opacity={0.7}
            />
          );
        })}

        {/* Pass 1: fills only, forward order (Today under Target under Projected) */}
        {seriesPolygons.map((s, idx) => {
          const fill = chartColor(idx);
          const fo = idx === 0 ? 0.18 : idx === 1 ? 0.14 : 0.08;
          return <polygon key={`fill-${s.name}`} points={s.polygon} fill={fill} fillOpacity={fo} stroke="none" />;
        })}

        {/* Pass 2: strokes only, reverse order (Today stroke on top) */}
        {[...seriesPolygons].reverse().map((s, ridx) => {
          const idx = seriesPolygons.length - 1 - ridx;
          const stroke = chartColor(idx);
          const so = idx === 0 ? 0.9 : idx === 1 ? 0.85 : 0.65;
          return <polygon key={`stroke-${s.name}`} points={s.polygon} fill="none" stroke={stroke} strokeWidth={2} strokeOpacity={so} />;
        })}

        {/* Pass 3: dots, forward order (Projected on top of Today when values overlap) */}
        {seriesPolygons.map((s, idx) => {
          const fill = chartColor(idx);
          return s.points.map((p, i) => (
            <circle key={`dot-${s.name}-${i}`} cx={p.x} cy={p.y} r={idx === 0 ? 4 : 3} fill={fill} />
          ));
        })}

        {baseData.map((d, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const labelLines = d.label.includes(' / ') ? d.label.split(' / ') : [d.label];
          const labelPos = polarToCartesian(cx, cy, radius + 26, angle);
          const anchor =
            Math.abs(Math.cos(angle)) < 0.2
              ? 'middle'
              : Math.cos(angle) > 0
                ? 'start'
                : 'end';

          // Keep labels inside the SVG bounds to avoid clipping on small screens.
          // Approx width estimate: ~0.6em per character.
          const longest = Math.max(...labelLines.map((l) => l.length));
          const estWidth = longest * labelFontSize * 0.6;
          const minPad = 6;

          let x = labelPos.x;
          if (anchor === 'start') {
            x = clamp(x, minPad, size - estWidth - minPad);
          } else if (anchor === 'end') {
            x = clamp(x, estWidth + minPad, size - minPad);
          } else {
            x = clamp(x, estWidth / 2 + minPad, size - estWidth / 2 - minPad);
          }

          const y = clamp(labelPos.y, labelFontSize + minPad, size - minPad);

          const lineHeight = labelFontSize + 2;
          const firstDy = -(lineHeight * (labelLines.length - 1)) / 2;

          return (
            <text
              key={d.label}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={labelFontSize}
              fill="var(--muted-foreground)"
            >
              {labelLines.map((line, idx) => (
                <tspan key={`${d.label}-${idx}`} x={x} dy={idx === 0 ? firstDy : lineHeight}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>

      {series && series.length > 1 && (
        <div className="mt-2 mx-auto flex max-w-[520px] flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {series.map((s, idx) => {
            const color = chartColor(idx);
            return (
              <div key={s.name} className="flex items-center gap-2 whitespace-nowrap">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
                <span>{s.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
