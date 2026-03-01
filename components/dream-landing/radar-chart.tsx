'use client';

import { useEffect, useState } from 'react';

/* ────────────────────────────────────────────────────────────
   RadarChart — Pure SVG pentagon radar/spider chart
   Shows current vs. target maturity across 5 DREAM domains.
   ──────────────────────────────────────────────────────────── */

const DOMAIN_COLOURS: Record<string, string> = {
  People: '#3b82f6',       // blue-500
  Organisation: '#22c55e', // green-500
  Customer: '#a855f7',     // purple-500
  Technology: '#f97316',   // orange-500
  Regulation: '#ef4444',   // red-500
};

interface RadarChartProps {
  domains: string[];
  current: number[];
  target: number[];
  size?: number;
  animated?: boolean;
}

export function RadarChart({
  domains,
  current,
  target,
  size = 320,
  animated = true,
}: RadarChartProps) {
  const [scale, setScale] = useState(animated ? 0 : 1);

  useEffect(() => {
    if (!animated) return;
    // Small delay so the animation is visible after mount
    const t = setTimeout(() => setScale(1), 120);
    return () => clearTimeout(t);
  }, [animated]);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38; // main chart radius
  const n = domains.length;
  const angleOffset = -Math.PI / 2; // start at top

  // Get the (x, y) for a vertex at index i, scaled to val (0–10)
  const point = (i: number, val: number): [number, number] => {
    const angle = angleOffset + (2 * Math.PI * i) / n;
    const r = (val / 10) * radius * scale;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  // Build polygon path from an array of values (one per domain)
  const polygon = (values: number[]): string =>
    values.map((v, i) => point(i, v)).map(([x, y]) => `${x},${y}`).join(' ');

  // Concentric grid rings at 2, 4, 6, 8, 10
  const rings = [2, 4, 6, 8, 10];

  // Axis label positions (pushed outward)
  const labelPos = (i: number): [number, number] => {
    const angle = angleOffset + (2 * Math.PI * i) / n;
    const r = radius + 28;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="overflow-visible"
      aria-label="Maturity radar chart"
    >
      {/* ── Grid rings ── */}
      {rings.map((ring) => (
        <polygon
          key={`ring-${ring}`}
          points={Array.from({ length: n }, (_, i) => {
            const angle = angleOffset + (2 * Math.PI * i) / n;
            const r = (ring / 10) * radius;
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
          }).join(' ')}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={ring === 10 ? 1.5 : 0.8}
          opacity={0.6}
        />
      ))}

      {/* ── Axis lines ── */}
      {domains.map((_, i) => {
        const [ex, ey] = point(i, 10);
        // Don't apply scale to axis lines
        const angle = angleOffset + (2 * Math.PI * i) / n;
        const axX = cx + radius * Math.cos(angle);
        const axY = cy + radius * Math.sin(angle);
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={axX}
            y2={axY}
            stroke="#e2e8f0"
            strokeWidth={0.8}
            opacity={0.4}
          />
        );
      })}

      {/* ── Target polygon (dashed outline) ── */}
      <polygon
        points={polygon(target)}
        fill="rgba(92, 242, 142, 0.06)"
        stroke="#5cf28e"
        strokeWidth={1.5}
        strokeDasharray="6 3"
        opacity={0.7}
        className="transition-all duration-700 ease-out"
      />

      {/* ── Current polygon (solid fill) ── */}
      <polygon
        points={polygon(current)}
        fill="rgba(92, 242, 142, 0.2)"
        stroke="#5cf28e"
        strokeWidth={2}
        className="transition-all duration-700 ease-out"
      />

      {/* ── Current score dots ── */}
      {current.map((val, i) => {
        const [px, py] = point(i, val);
        return (
          <circle
            key={`dot-${i}`}
            cx={px}
            cy={py}
            r={4}
            fill="#5cf28e"
            stroke="#0d0d0d"
            strokeWidth={1.5}
            className="transition-all duration-700 ease-out"
          />
        );
      })}

      {/* ── Domain labels with colour dots ── */}
      {domains.map((domain, i) => {
        const [lx, ly] = labelPos(i);
        const colour = DOMAIN_COLOURS[domain] || '#94a3b8';
        // Adjust text anchor based on position
        const angle = angleOffset + (2 * Math.PI * i) / n;
        const normAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        if (normAngle > 0.3 && normAngle < Math.PI - 0.3) textAnchor = 'start';
        if (normAngle > Math.PI + 0.3 && normAngle < 2 * Math.PI - 0.3) textAnchor = 'end';

        return (
          <g key={`label-${i}`}>
            <circle cx={lx - (textAnchor === 'start' ? 8 : textAnchor === 'end' ? -8 : 0)} cy={ly - 1} r={4} fill={colour} />
            <text
              x={lx + (textAnchor === 'start' ? 2 : textAnchor === 'end' ? -2 : 0)}
              y={ly + 4}
              textAnchor={textAnchor}
              className="text-[10px] sm:text-xs font-medium fill-slate-600"
            >
              {domain}
            </text>
          </g>
        );
      })}

      {/* ── Centre dot ── */}
      <circle cx={cx} cy={cy} r={2} fill="#94a3b8" opacity={0.4} />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
   Static SVG generator for the PDF report (no React/animation)
   ──────────────────────────────────────────────────────────── */

export function renderRadarSvgString(
  domains: string[],
  current: number[],
  target: number[],
  size = 360,
): string {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const n = domains.length;
  const angleOffset = -Math.PI / 2;

  const pt = (i: number, val: number): [number, number] => {
    const angle = angleOffset + (2 * Math.PI * i) / n;
    const r = (val / 10) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const poly = (values: number[]): string =>
    values.map((v, i) => pt(i, v)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  const rings = [2, 4, 6, 8, 10];
  const domainColours: Record<string, string> = {
    People: '#3b82f6',
    Organisation: '#22c55e',
    Customer: '#a855f7',
    Technology: '#f97316',
    Regulation: '#ef4444',
  };

  let svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`;

  // Grid rings
  for (const ring of rings) {
    const pts = Array.from({ length: n }, (_, i) => {
      const angle = angleOffset + (2 * Math.PI * i) / n;
      const r = (ring / 10) * radius;
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
    }).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="#d1d5db" stroke-width="${ring === 10 ? 1.2 : 0.6}" opacity="0.5"/>`;
  }

  // Axis lines
  for (let i = 0; i < n; i++) {
    const angle = angleOffset + (2 * Math.PI * i) / n;
    const ex = cx + radius * Math.cos(angle);
    const ey = cy + radius * Math.sin(angle);
    svg += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#d1d5db" stroke-width="0.6" opacity="0.3"/>`;
  }

  // Target polygon
  svg += `<polygon points="${poly(target)}" fill="rgba(92,242,142,0.08)" stroke="#5cf28e" stroke-width="1.5" stroke-dasharray="6 3" opacity="0.7"/>`;

  // Current polygon
  svg += `<polygon points="${poly(current)}" fill="rgba(92,242,142,0.22)" stroke="#5cf28e" stroke-width="2"/>`;

  // Current dots
  for (let i = 0; i < n; i++) {
    const [px, py] = pt(i, current[i]);
    svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="#5cf28e" stroke="#0d0d0d" stroke-width="1.5"/>`;
  }

  // Labels
  for (let i = 0; i < n; i++) {
    const angle = angleOffset + (2 * Math.PI * i) / n;
    const lr = radius + 26;
    const lx = cx + lr * Math.cos(angle);
    const ly = cy + lr * Math.sin(angle);
    const col = domainColours[domains[i]] || '#6b7280';
    const normAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let anchor = 'middle';
    if (normAngle > 0.3 && normAngle < Math.PI - 0.3) anchor = 'start';
    if (normAngle > Math.PI + 0.3 && normAngle < 2 * Math.PI - 0.3) anchor = 'end';
    const dotOff = anchor === 'start' ? -8 : anchor === 'end' ? 8 : 0;
    svg += `<circle cx="${(lx + dotOff).toFixed(1)}" cy="${(ly - 1).toFixed(1)}" r="4" fill="${col}"/>`;
    svg += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-family="Arial,sans-serif" fill="#475569">${domains[i]}</text>`;
  }

  svg += '</svg>';
  return svg;
}
