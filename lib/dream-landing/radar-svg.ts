/**
 * Static SVG radar chart generator  -  server-safe (no React, no 'use client')
 *
 * Used by the PDF report generator. Kept separate from the React RadarChart
 * component which lives in a 'use client' file.
 */

const DOMAIN_COLOURS: Record<string, string> = {
  People: '#3b82f6',
  Organisation: '#22c55e',
  Customer: '#a855f7',
  Technology: '#f97316',
  Regulation: '#ef4444',
};

export function renderRadarSvgString(
  domains: string[],
  current: number[],
  target?: number[],
  size = 360,
  maxValue = 5,
): string {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const n = domains.length;
  const angleOffset = -Math.PI / 2;

  const pt = (i: number, val: number): [number, number] => {
    const angle = angleOffset + (2 * Math.PI * i) / n;
    const r = (val / maxValue) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const poly = (values: number[]): string =>
    values.map((v, i) => pt(i, v)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  const rings = Array.from({ length: maxValue }, (_, i) => i + 1);

  let svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`;

  // Grid rings
  for (const ring of rings) {
    const pts = Array.from({ length: n }, (_, i) => {
      const angle = angleOffset + (2 * Math.PI * i) / n;
      const r = (ring / maxValue) * radius;
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
    }).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="#d1d5db" stroke-width="${ring === maxValue ? 1.2 : 0.6}" opacity="0.5"/>`;
  }

  // Ring labels
  for (const ring of rings) {
    const angle = angleOffset;
    const r = (ring / maxValue) * radius;
    const lx = cx + r * Math.cos(angle) + 4;
    const ly = cy + r * Math.sin(angle) - 4;
    svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="9" font-family="Arial,sans-serif" fill="#94a3b8">${ring}</text>`;
  }

  // Axis lines
  for (let i = 0; i < n; i++) {
    const angle = angleOffset + (2 * Math.PI * i) / n;
    const ex = cx + radius * Math.cos(angle);
    const ey = cy + radius * Math.sin(angle);
    svg += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#d1d5db" stroke-width="0.6" opacity="0.3"/>`;
  }

  // Target polygon (only if provided)
  if (target) {
    svg += `<polygon points="${poly(target)}" fill="rgba(92,242,142,0.08)" stroke="#5cf28e" stroke-width="1.5" stroke-dasharray="6 3" opacity="0.7"/>`;
  }

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
    const col = DOMAIN_COLOURS[domains[i]] || '#6b7280';
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
