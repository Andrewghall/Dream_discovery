/**
 * DREAM Capability Maturity Assessment — PDF Report Template
 *
 * Self-contained HTML rendered to A4 PDF by Puppeteer.
 * All styles are inline; SVG radar chart is embedded.
 */

import { renderRadarSvgString } from '@/components/dream-landing/radar-chart';

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

export interface AssessmentPdfData {
  name: string;
  organisation?: string;
  date: string;
  domains: {
    domain: string;
    current: number;
    target: number;
  }[];
  overallReadiness: number;
  transformationDistance: number;
  recommendation: 'Foundation' | 'Acceleration' | 'Optimisation';
}

/* ────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────── */

const DOMAIN_COLOURS: Record<string, string> = {
  People: '#3b82f6',
  Organisation: '#22c55e',
  Customer: '#a855f7',
  Technology: '#f97316',
  Regulation: '#ef4444',
};

const DOMAIN_ADVICE: Record<string, string> = {
  People: 'building leadership alignment and developing the skills capability your organisation needs',
  Organisation: 'strengthening governance agility and cross-functional collaboration to enable faster transformation',
  Customer: 'deepening customer understanding and creating seamless, coherent experiences across touchpoints',
  Technology: 'modernising your technology landscape and building a data-driven decision-making culture',
  Regulation: 'reframing compliance as an enabler of innovation rather than a barrier to progress',
};

const RECOMMENDATIONS: Record<string, { title: string; body: (topDomain: string) => string }> = {
  Foundation: {
    title: 'Foundation Workshop',
    body: (d) =>
      `Your organisation is in the early stages of transformation readiness. The biggest opportunity lies in ${DOMAIN_ADVICE[d] || 'addressing your organisational gaps'}. A DREAM Foundation workshop would help you build the shared understanding and strategic clarity needed to move forward with confidence. Through structured AI-facilitated discovery, DREAM would surface the real perceptions across your teams, identify where alignment is weakest, and create a grounded roadmap for meaningful change.`,
  },
  Acceleration: {
    title: 'Acceleration Workshop',
    body: (d) =>
      `Your organisation has built a solid base but significant gaps remain — particularly in ${DOMAIN_ADVICE[d] || 'key strategic areas'}. A DREAM Acceleration workshop would cut through the noise, align your teams around the gaps that matter most, and build a constraint-aware roadmap for transformation. By capturing every voice and synthesising the collective intelligence of your organisation, DREAM reveals the tensions that derail programmes and builds the shared understanding needed to accelerate change.`,
  },
  Optimisation: {
    title: 'Optimisation Workshop',
    body: (d) =>
      `Your organisation is relatively mature but there are still meaningful gaps — especially in ${DOMAIN_ADVICE[d] || 'areas of strategic importance'}. A DREAM Optimisation workshop would help you fine-tune your strategy, identify the constraints holding you back from the next level, and design a focused path forward. At this stage, the value of DREAM lies in surfacing the subtle misalignments and blind spots that prevent organisations from reaching their full potential.`,
  },
};

/* ────────────────────────────────────────────────────────────
   Generator
   ──────────────────────────────────────────────────────────── */

export function generateAssessmentPdfHtml(data: AssessmentPdfData): string {
  const domainNames = data.domains.map((d) => d.domain);
  const currentScores = data.domains.map((d) => d.current);
  const targetScores = data.domains.map((d) => d.target);

  const radarSvg = renderRadarSvgString(domainNames, currentScores, targetScores, 340);

  // Sort domains by gap (largest first)
  const sorted = [...data.domains]
    .map((d) => ({ ...d, gap: Math.round((d.target - d.current) * 10) / 10 }))
    .sort((a, b) => b.gap - a.gap);

  const topDomain = sorted[0]?.domain || 'People';
  const rec = RECOMMENDATIONS[data.recommendation] || RECOMMENDATIONS.Acceleration;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', -apple-system, Arial, sans-serif;
    color: #1e293b;
    font-size: 13px;
    line-height: 1.6;
    padding: 0;
  }

  .page { padding: 36px 42px; }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 20px;
    border-bottom: 3px solid #5cf28e;
    margin-bottom: 28px;
  }
  .header-left h1 {
    font-size: 22px;
    font-weight: 800;
    color: #0d0d0d;
    margin-bottom: 2px;
  }
  .header-left p {
    font-size: 11px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .header-right {
    text-align: right;
    font-size: 11px;
    color: #64748b;
  }
  .header-right .org { font-weight: 600; color: #0d0d0d; }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #0d0d0d;
    margin-bottom: 4px;
  }
  .brand-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #5cf28e;
  }

  .section-title {
    font-size: 15px;
    font-weight: 700;
    color: #0d0d0d;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .radar-container {
    display: flex;
    justify-content: center;
    margin-bottom: 8px;
  }

  .legend {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-bottom: 24px;
    font-size: 11px;
    color: #64748b;
  }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-solid { width: 20px; height: 3px; border-radius: 2px; background: #5cf28e; }
  .legend-dashed { width: 20px; height: 3px; border-radius: 2px; border-top: 2px dashed #5cf28e; }

  .scores-grid {
    display: flex;
    justify-content: center;
    gap: 32px;
    margin-bottom: 28px;
  }
  .score-box { text-align: center; }
  .score-box .num {
    font-size: 32px;
    font-weight: 800;
    line-height: 1;
    margin-bottom: 2px;
  }
  .score-box .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
  }

  .domain-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 28px;
  }
  .domain-table th {
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94a3b8;
    padding: 6px 8px;
    border-bottom: 1px solid #e2e8f0;
  }
  .domain-table td {
    padding: 10px 8px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 12px;
  }
  .domain-table tr:last-child td { border-bottom: none; }
  .domain-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }
  .domain-dot { width: 8px; height: 8px; border-radius: 50%; }
  .bar-bg {
    height: 6px;
    background: #f1f5f9;
    border-radius: 3px;
    width: 100%;
    position: relative;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 3px;
    position: absolute;
    left: 0;
    top: 0;
  }
  .bar-target {
    position: absolute;
    top: -1px;
    width: 2px;
    height: 8px;
    background: #0d0d0d;
    border-radius: 1px;
  }

  .rec-box {
    background: #0d0d0d;
    color: #fff;
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 28px;
  }
  .rec-box .tag {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #5cf28e;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .rec-box h3 {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .rec-box p {
    font-size: 12px;
    line-height: 1.7;
    color: rgba(255,255,255,0.7);
  }

  .footer {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    font-size: 11px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer a { color: #5cf28e; text-decoration: none; font-weight: 600; }

  .gap-rank { margin-bottom: 28px; }
  .gap-item {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    padding: 8px 12px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #f1f5f9;
  }
  .gap-rank-num {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .gap-item-name { font-weight: 600; font-size: 12px; flex: 1; }
  .gap-item-val { font-weight: 700; font-size: 12px; }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="brand"><span class="brand-dot"></span> ETHENTA DREAM</div>
      <h1>Capability Maturity Assessment</h1>
      <p>Readiness Report</p>
    </div>
    <div class="header-right">
      <div class="org">${escHtml(data.name)}</div>
      ${data.organisation ? `<div>${escHtml(data.organisation)}</div>` : ''}
      <div>${escHtml(data.date)}</div>
    </div>
  </div>

  <!-- Radar Chart -->
  <div class="section-title">Your Maturity Profile</div>
  <div class="radar-container">${radarSvg}</div>
  <div class="legend">
    <div class="legend-item"><span class="legend-solid"></span> Current State</div>
    <div class="legend-item"><span class="legend-dashed"></span> Target State</div>
  </div>

  <!-- Overall Scores -->
  <div class="scores-grid">
    <div class="score-box">
      <div class="num" style="color:#0d0d0d;">${data.overallReadiness.toFixed(1)}</div>
      <div class="label">Overall Readiness</div>
    </div>
    <div class="score-box">
      <div class="num" style="color:#5cf28e;">${data.transformationDistance.toFixed(1)}</div>
      <div class="label">Avg. Gap</div>
    </div>
  </div>

  <!-- Domain Breakdown -->
  <div class="section-title">Domain Breakdown</div>
  <table class="domain-table">
    <thead>
      <tr>
        <th style="width:28%;">Domain</th>
        <th style="width:12%; text-align:center;">Current</th>
        <th style="width:12%; text-align:center;">Target</th>
        <th style="width:10%; text-align:center;">Gap</th>
        <th style="width:38%;">Progress</th>
      </tr>
    </thead>
    <tbody>
${data.domains
  .map((d) => {
    const col = DOMAIN_COLOURS[d.domain] || '#6b7280';
    const gap = Math.round((d.target - d.current) * 10) / 10;
    return `      <tr>
        <td><div class="domain-name"><span class="domain-dot" style="background:${col}"></span> ${escHtml(d.domain)}</div></td>
        <td style="text-align:center; font-weight:600;">${d.current.toFixed(1)}</td>
        <td style="text-align:center; font-weight:600;">${d.target.toFixed(1)}</td>
        <td style="text-align:center; font-weight:700; color:${col};">+${gap.toFixed(1)}</td>
        <td>
          <div class="bar-bg">
            <div class="bar-fill" style="width:${(d.current / 10) * 100}%; background:${col}; opacity:0.6;"></div>
            <div class="bar-target" style="left:${(d.target / 10) * 100}%;"></div>
          </div>
        </td>
      </tr>`;
  })
  .join('\n')}
    </tbody>
  </table>

  <!-- Gap Ranking -->
  <div class="section-title">Top Gaps by Priority</div>
  <div class="gap-rank">
${sorted
  .map(
    (d, i) =>
      `    <div class="gap-item">
      <div class="gap-rank-num" style="background:${DOMAIN_COLOURS[d.domain] || '#6b7280'}">${i + 1}</div>
      <div class="gap-item-name">${escHtml(d.domain)}</div>
      <div class="gap-item-val" style="color:${DOMAIN_COLOURS[d.domain] || '#6b7280'}">+${d.gap.toFixed(1)}</div>
    </div>`,
  )
  .join('\n')}
  </div>

  <!-- Recommendation -->
  <div class="rec-box">
    <div class="tag">Recommended Approach</div>
    <h3>${escHtml(rec.title)}</h3>
    <p>${escHtml(rec.body(topDomain))}</p>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>Generated by <strong>DREAM</strong> — Ethenta&rsquo;s Capability Maturity Assessment</div>
    <div>Book a demo: <a href="mailto:hello@ethenta.com">hello@ethenta.com</a></div>
  </div>
</div>
</body>
</html>`;
}

/* HTML entity escaping */
function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
