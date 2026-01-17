import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { FIXED_QUESTIONS } from '@/lib/conversation/fixed-questions';

type InputQuality = {
  score: number;
  label: 'high' | 'medium' | 'low';
  rationale: string;
};

type KeyInsight = {
  title: string;
  insight: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
};

type PhaseInsight = {
  phase: string;
  currentScore: number | null;
  targetScore: number | null;
  projectedScore: number | null;
  strengths?: string[];
  working?: string[];
  gaps?: string[];
  painPoints?: string[];
  frictions?: string[];
  barriers?: string[];
  constraint?: string[];
  future?: string[];
  support?: string[];
};

type WordCloudTheme = { text: string; value: number };

const MATURITY_BANDS: Array<{ label: string; bg: string }> = [
  { label: 'Reactive', bg: '#ffcccc' },
  { label: 'Emerging', bg: '#ffe6cc' },
  { label: 'Defined', bg: '#fff2cc' },
  { label: 'Optimised', bg: '#ccffcc' },
  { label: 'Intelligent', bg: '#cce6ff' },
];

function phaseLabel(phase: string): string {
  if (phase === 'people') return 'D1 — People';
  if (phase === 'corporate') return 'D2 — Corporate / Organisational';
  if (phase === 'customer') return 'D3 — Customer';
  if (phase === 'technology') return 'D4 — Technology';
  if (phase === 'regulation') return 'D5 — Regulation';
  return phase;
}

function tripleRatingQuestionForPhase(phase: string): { text: string; maturityScale?: string[] } | null {
  const rec = FIXED_QUESTIONS as unknown as Record<string, Array<{ text: string; tag: string; maturityScale?: string[] }>>;
  const list = rec[phase];
  if (!Array.isArray(list)) return null;
  const triple = list.find((q) => q.tag === 'triple_rating');
  if (!triple) return null;
  return { text: triple.text, maturityScale: triple.maturityScale };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function radarSvg(params: {
  labels: string[];
  series: Array<{ name: string; values: number[]; color: string; fillOpacity: number }>;
  size?: number;
  max?: number;
}) {
  const size = params.size ?? 360;
  const max = params.max ?? 10;
  const padding = 78;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - padding * 2) / 2;
  const labelFontSize = 10;
  const n = params.labels.length;

  const rings = [0.25, 0.5, 0.75, 1].map((t) => t * radius);
  const axes = params.labels.map((label, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const end = polarToCartesian(cx, cy, radius, angle);
    const labelLines = label.includes(' / ') ? label.split(' / ') : [label];
    const labelPos = polarToCartesian(cx, cy, radius + 28, angle);

    const anchor = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
    const longest = Math.max(...labelLines.map((l) => l.length));
    const estWidth = longest * labelFontSize * 0.6;
    const minPad = 6;

    let x = labelPos.x;
    if (anchor === 'start') x = clamp(x, minPad, size - estWidth - minPad);
    else if (anchor === 'end') x = clamp(x, estWidth + minPad, size - minPad);
    else x = clamp(x, estWidth / 2 + minPad, size - estWidth / 2 - minPad);

    const y = clamp(labelPos.y, labelFontSize + minPad, size - minPad);
    const lineHeight = labelFontSize + 2;
    const firstDy = -(lineHeight * (labelLines.length - 1)) / 2;

    const tspans = labelLines
      .map((line, idx) => `<tspan x="${x}" dy="${idx === 0 ? firstDy : lineHeight}">${escapeHtml(line)}</tspan>`)
      .join('');

    return {
      line: `<line x1="${cx}" y1="${cy}" x2="${end.x}" y2="${end.y}" stroke="#e5e7eb" stroke-width="1" />`,
      text: `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${labelFontSize}" fill="#6b7280">${tspans}</text>`,
    };
  });

  const polygons = params.series
    .map((s) => {
      const points = s.values.map((v, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const r = (clamp(v, 0, max) / max) * radius;
        const p = polarToCartesian(cx, cy, r, angle);
        return `${p.x},${p.y}`;
      });
      const dots = points
        .map((pt) => {
          const [x, y] = pt.split(',');
          return `<circle cx="${x}" cy="${y}" r="3" fill="${s.color}" />`;
        })
        .join('');
      return `
        <g>
          <polygon points="${points.join(' ')}" fill="${s.color}" opacity="${s.fillOpacity}" stroke="${s.color}" stroke-width="2" />
          ${dots}
        </g>
      `;
    })
    .join('');

  const ringsSvg = rings
    .map(
      (r) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="1" opacity="0.9" />`
    )
    .join('');

  const axesLines = axes.map((a) => a.line).join('');
  const labels = axes.map((a) => a.text).join('');

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">
      ${ringsSvg}
      ${axesLines}
      ${polygons}
      ${labels}
    </svg>
  `;
}

function listBlock(title: string, items?: string[]) {
  if (!items || !items.length) return '';
  const lis = items.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  return `
    <div class="block">
      <div class="block-title">${escapeHtml(title)}</div>
      <ul class="list">${lis}</ul>
    </div>
  `;
}

export async function generateDiscoveryReportPdf(params: {
  participantName: string;
  workshopName: string | null | undefined;
  discoveryUrl: string;
  executiveSummary: string;
  tone: string | null;
  feedback: string;
  inputQuality?: InputQuality;
  keyInsights?: KeyInsight[];
  phaseInsights: PhaseInsight[];
  wordCloudThemes?: WordCloudTheme[];
}): Promise<Buffer> {
  const reportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const safeWorkshopName = params.workshopName ? escapeHtml(params.workshopName) : 'DREAM Discovery';
  const safeParticipant = escapeHtml(params.participantName);

  const axes = params.phaseInsights.map((p) => p.phase);
  const labels = axes.map((p) => {
    if (p === 'people') return 'D1 — People';
    if (p === 'corporate') return 'D2 — Corporate / Organisational';
    if (p === 'customer') return 'D3 — Customer';
    if (p === 'technology') return 'D4 — Technology';
    if (p === 'regulation') return 'D5 — Regulation';
    return p;
  });

  const current = params.phaseInsights.map((p) => p.currentScore ?? 0);
  const target = params.phaseInsights.map((p) => p.targetScore ?? 0);
  const projected = params.phaseInsights.map((p) => p.projectedScore ?? 0);

  const svg = radarSvg({
    labels,
    series: [
      { name: 'Current capability', values: current, color: '#f97316', fillOpacity: 0.14 },
      { name: 'Target ambition', values: target, color: '#10b981', fillOpacity: 0.12 },
      { name: 'Projected if unchanged', values: projected, color: '#0f172a', fillOpacity: 0.1 },
    ],
  });

  const legend = `
    <div class="legend">
      <div class="legend-item"><span class="swatch" style="background:#f97316"></span><span>Current capability</span></div>
      <div class="legend-item"><span class="swatch" style="background:#10b981"></span><span>Target ambition</span></div>
      <div class="legend-item"><span class="swatch" style="background:#0f172a"></span><span>Projected if unchanged</span></div>
    </div>
  `;

  const insights = Array.isArray(params.keyInsights) && params.keyInsights.length
    ? params.keyInsights
        .map((k, idx) => {
          const evidence = Array.isArray(k.evidence) && k.evidence.length
            ? `<div class="evidence">${k.evidence.map((q) => `<div class="quote">“${escapeHtml(q)}”</div>`).join('')}</div>`
            : '';
          return `
            <div class="insight">
              <div class="insight-title">${idx + 1}. ${escapeHtml(k.title)}</div>
              <div class="muted">Confidence: <span class="strong">${escapeHtml(k.confidence)}</span></div>
              <div class="pre">${escapeHtml(k.insight)}</div>
              ${evidence}
            </div>
          `;
        })
        .join('')
    : '';

  const themeList = Array.isArray(params.wordCloudThemes) && params.wordCloudThemes.length
    ? (() => {
        const themes = params.wordCloudThemes.slice(0, 40);
        const values = themes.map((t) => t.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = Math.max(1, max - min);
        return themes
          .map((t) => {
            const w = (t.value - min) / span;
            const font = 11 + w * 11;
            const opacity = 0.55 + w * 0.35;
            return `<span class="cloud-word" style="font-size:${font.toFixed(1)}px; opacity:${opacity.toFixed(2)}">${escapeHtml(
              t.text
            )}</span>`;
          })
          .join('');
      })()
    : '';

  const phaseBlocks = params.phaseInsights
    .map((p) => {
      const header = `<div class="phase-title">${escapeHtml(phaseLabel(p.phase))}</div>`;
      const scores = `<div class="scores">
        <div><span class="muted">Current:</span> <span class="strong">${p.currentScore ?? '—'}</span></div>
        <div><span class="muted">Target:</span> <span class="strong">${p.targetScore ?? '—'}</span></div>
        <div><span class="muted">Projected:</span> <span class="strong">${p.projectedScore ?? '—'}</span></div>
      </div>`;

      const triple = tripleRatingQuestionForPhase(p.phase);
      const questionText = triple?.text ? `<div class="pre question">${escapeHtml(triple.text)}</div>` : '';

      const maturityScale = Array.isArray(triple?.maturityScale) && triple!.maturityScale!.length === 5
        ? `
          <div class="maturity">
            <div class="maturity-caption muted">Maturity bands: 1–2 Reactive, 3–4 Emerging, 5–6 Defined, 7–8 Optimised, 9–10 Intelligent</div>
            ${triple!.maturityScale!
              .map((t, idx) => {
                const band = MATURITY_BANDS[idx];
                const bg = band?.bg || '#fff';
                const label = band?.label || String(idx + 1);
                return `<div class="band" style="background:${bg}"><span class="band-label">${escapeHtml(label)}:</span> ${escapeHtml(t)}</div>`;
              })
              .join('')}
          </div>
        `
        : '';

      return `
        <div class="card page-break">
          ${header}
          ${questionText}
          ${maturityScale}
          ${scores}
          ${listBlock('Strengths / enablers', p.strengths)}
          ${listBlock("What’s working", p.working)}
          ${listBlock('Gaps / challenges', p.gaps)}
          ${listBlock('Pain points', p.painPoints)}
          ${listBlock('Friction', p.frictions)}
          ${listBlock('Barriers', p.barriers)}
          ${listBlock('Constraints', p.constraint)}
          ${listBlock('Future vision', p.future)}
          ${listBlock('Support needed', p.support)}
        </div>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #111827; margin: 0; padding: 0; }
          .container { padding: 18px 20px; }
          .title { font-size: 18px; font-weight: 700; margin: 0 0 2px; }
          .subtitle { font-size: 12px; color: #6b7280; margin: 0 0 14px; }
          .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin: 0 0 12px; }
          .section-title { font-size: 13px; font-weight: 700; margin: 0 0 8px; }
          .muted { color: #6b7280; }
          .strong { font-weight: 600; color: #111827; }
          .pre { white-space: pre-wrap; line-height: 1.35; font-size: 12px; }
          .insight { margin: 0 0 10px; }
          .insight-title { font-size: 12px; font-weight: 700; margin: 0 0 2px; }
          .quote { font-size: 11px; color: #111827; margin: 2px 0; white-space: pre-wrap; }
          .evidence { margin-top: 6px; padding-left: 8px; border-left: 2px solid #e5e7eb; }
          .chart-wrap { display: flex; justify-content: center; }
          .legend { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; font-size: 11px; color: #6b7280; }
          .legend-item { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
          .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
          .cloud { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; padding-top: 2px; }
          .cloud-word { display: inline-block; color: #374151; line-height: 1.15; }
          .phase-title { font-size: 13px; font-weight: 700; margin: 0 0 6px; }
          .scores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 12px; margin-bottom: 10px; }
          .block { margin-top: 8px; }
          .block-title { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 4px; }
          .list { margin: 0; padding-left: 16px; }
          .list li { font-size: 12px; white-space: pre-wrap; line-height: 1.35; margin: 0 0 2px; }
          .question { margin-bottom: 8px; }
          .maturity { margin: 6px 0 10px; }
          .maturity-caption { font-size: 11px; margin-bottom: 6px; }
          .band { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 11px; margin-bottom: 6px; line-height: 1.25; }
          .band-label { font-weight: 700; }
          .page-break { break-inside: avoid; page-break-inside: avoid; }
          .page-break + .page-break { break-before: page; page-break-before: always; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="title">Discovery Report</div>
          <div class="subtitle">${safeWorkshopName} · ${safeParticipant}</div>

          <div class="card">
            <div class="section-title">Executive Summary</div>
            ${params.tone ? `<div class="muted" style="font-size:11px; margin-bottom:6px;">Tone: <span class="strong">${escapeHtml(params.tone)}</span></div>` : ''}
            <div class="pre">${escapeHtml(params.executiveSummary)}</div>
          </div>

          ${params.inputQuality ? `
            <div class="card">
              <div class="section-title">Input Quality (Evidence Check)</div>
              <div style="font-size:12px; margin-bottom:6px;">Score: <span class="strong">${params.inputQuality.score}/100</span> (<span class="strong">${escapeHtml(params.inputQuality.label)}</span>)</div>
              <div class="pre">${escapeHtml(params.inputQuality.rationale || '')}</div>
            </div>
          ` : ''}

          ${insights ? `
            <div class="card">
              <div class="section-title">Key Insights (Evidence-backed)</div>
              ${insights}
            </div>
          ` : ''}

          <div class="card">
            <div class="section-title">Spider Diagram (Three Scores)</div>
            <div class="muted" style="font-size:11px; margin-bottom:8px;">Current, target, and projected (1–10)</div>
            <div class="chart-wrap">${svg}</div>
            ${legend}
          </div>

          ${(Array.isArray(params.wordCloudThemes) && params.wordCloudThemes.length) ? `
            <div class="card">
              <div class="section-title">Themes & Intent</div>
              <div class="cloud">${themeList}</div>
            </div>
          ` : `
            <div class="card">
              <div class="section-title">Themes & Intent</div>
              <div class="muted" style="font-size:12px;">No themes captured.</div>
            </div>
          `}

          ${phaseBlocks}

          <div class="card">
            <div class="section-title">Feedback to the Interviewee</div>
            <div class="pre">${escapeHtml(params.feedback)}</div>
          </div>
        </div>
      </body>
    </html>
  `;

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
    defaultViewport: { width: 1280, height: 720 },
  });

  try {
    const page = await browser.newPage();
    await page.emulateMediaType('screen');
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '14mm', bottom: '14mm', left: '10mm', right: '10mm' },
      headerTemplate: `
        <div style="width:100%; font-size:7pt; font-family:Arial, sans-serif; color:#555; padding:0 24px;">
          <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center;">
            <div style="text-align:left;">${reportDate}</div>
            <div style="text-align:center; font-weight:600; color:#111;">DREAM DISCOVERY</div>
            <div></div>
          </div>
        </div>
      `,
      footerTemplate: `
        <div style="width:100%; font-size:7pt; font-family:Arial, sans-serif; color:#555; padding:0 24px;">
          <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center;">
            <div style="text-align:left;">Copyright 2026 Ethenta</div>
            <div></div>
            <div style="text-align:right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
          </div>
        </div>
      `,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
