/**
 * DREAM POCTR Capability Maturity Assessment  -  PDF Report Template
 *
 * Self-contained HTML rendered to A4 PDF by Puppeteer.
 * All styles are inline; SVG radar chart is embedded.
 */

import { renderRadarSvgString } from '@/lib/dream-landing/radar-svg';

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

export interface AssessmentPdfData {
  name: string;
  organisation?: string;
  date: string;
  domains: {
    domain: string;
    score: number;
    levelName: string;
    levelDescriptor: string;
    nextLevelName: string;
    nextLevelDescriptor: string;
  }[];
  overallScore: number;
  overallLevelName: string;
  recommendation: 'Foundation' | 'Acceleration' | 'Optimisation';
}

/* ────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────── */

const DOMAIN_COLOURS: Record<string, string> = {
  People: '#3b82f6',
  'Organisation & Partners': '#22c55e',
  Customer: '#a855f7',
  Technology: '#f97316',
  Regulation: '#ef4444',
};

const DOMAIN_ADVICE: Record<string, string> = {
  People: 'building leadership alignment and developing the skills capability your organisation needs',
  'Organisation & Partners': 'strengthening governance agility, cross-functional collaboration, and partner ecosystem alignment to enable faster transformation',
  Customer: 'deepening customer understanding and creating seamless, coherent experiences across touchpoints',
  Technology: 'modernising your technology landscape and building a data-driven decision-making culture',
  Regulation: 'reframing compliance as an enabler of innovation rather than a barrier to progress',
};

const RECOMMENDATIONS: Record<string, { title: string; body: (topDomain: string, levelName: string) => string }> = {
  Foundation: {
    title: 'Foundation Workshop',
    body: (d, lvl) =>
      `Your organisation assessed at maturity level ${lvl}. The biggest opportunity lies in ${DOMAIN_ADVICE[d] || 'addressing your organisational gaps'}. A DREAM Foundation workshop would help you build the shared understanding and strategic clarity needed to move forward with confidence. Through structured AI-facilitated discovery, DREAM would surface the real perceptions across your teams, identify where alignment is weakest, and create a grounded roadmap for meaningful change.`,
  },
  Acceleration: {
    title: 'Acceleration Workshop',
    body: (d, lvl) =>
      `Your organisation assessed at maturity level ${lvl}  -  a solid base, but significant gaps remain, particularly in ${DOMAIN_ADVICE[d] || 'key strategic areas'}. A DREAM Acceleration workshop would cut through the noise, align your teams around the gaps that matter most, and build a constraint-aware roadmap for transformation. By capturing every voice and synthesising the collective intelligence of your organisation, DREAM reveals the tensions that derail programmes and builds the shared understanding needed to accelerate change.`,
  },
  Optimisation: {
    title: 'Optimisation Workshop',
    body: (d, lvl) =>
      `Your organisation assessed at maturity level ${lvl}. There are still meaningful opportunities  -  especially in ${DOMAIN_ADVICE[d] || 'areas of strategic importance'}. A DREAM Optimisation workshop would help you fine-tune your strategy, identify the constraints holding you back from the next level, and design a focused path forward. At this stage, the value of DREAM lies in surfacing the subtle misalignments and blind spots that prevent organisations from reaching their full potential.`,
  },
};

/* ────────────────────────────────────────────────────────────
   Generator
   ──────────────────────────────────────────────────────────── */

export function generateAssessmentPdfHtml(data: AssessmentPdfData): string {
  const domainNames = data.domains.map((d) => d.domain);
  const currentScores = data.domains.map((d) => d.score);

  const radarSvg = renderRadarSvgString(domainNames, currentScores, undefined, 340, 5);

  // Sort domains by score (lowest first = highest priority)
  const sorted = [...data.domains].sort((a, b) => a.score - b.score);

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
  .header-left .methodology {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 4px;
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
  .score-box .level-name {
    font-size: 14px;
    font-weight: 700;
    color: #5cf28e;
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
    background: #e2e8f0;
    border-radius: 3px;
    width: 100%;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 3px;
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

  .priority-rank { margin-bottom: 28px; }
  .priority-item {
    margin-bottom: 10px;
    padding: 10px 14px;
    background: #f8fafc;
    border-radius: 10px;
    border: 1px solid #f1f5f9;
  }
  .priority-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .priority-rank-num {
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
  .priority-item-name { font-weight: 600; font-size: 12px; flex: 1; }
  .priority-item-level { font-weight: 700; font-size: 11px; }
  .priority-next {
    margin-left: 34px;
    padding-left: 10px;
    border-left: 2px solid #e2e8f0;
    font-size: 11px;
    color: #64748b;
    line-height: 1.5;
  }
  .priority-next strong {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="brand"><span class="brand-dot"></span> ETHENTA DREAM</div>
      <h1>Capability Maturity Assessment</h1>
      <p>Transformation Readiness Report</p>
      <div class="methodology">Assessed using the POCTR Capability Maturity Model</div>
    </div>
    <div class="header-right">
      <div class="org">${escHtml(data.name)}</div>
      ${data.organisation ? `<div>${escHtml(data.organisation)}</div>` : ''}
      <div>${escHtml(data.date)}</div>
    </div>
  </div>

  <!-- Radar Chart -->
  <div class="section-title">Maturity Profile</div>
  <div class="radar-container">${radarSvg}</div>

  <!-- Overall Score -->
  <div class="scores-grid">
    <div class="score-box">
      <div class="num" style="color:#0d0d0d;">Level ${Math.round(data.overallScore)}</div>
      <div class="level-name">${escHtml(data.overallLevelName)}</div>
      <div class="label">${data.overallScore.toFixed(1)} / 5  -  Overall Maturity</div>
    </div>
  </div>

  <!-- Domain Breakdown -->
  <div class="section-title">Domain Breakdown</div>
  <table class="domain-table">
    <thead>
      <tr>
        <th style="width:24%;">Domain</th>
        <th style="width:14%; text-align:center;">Score</th>
        <th style="width:24%;">Level</th>
        <th style="width:38%;">Maturity</th>
      </tr>
    </thead>
    <tbody>
${data.domains
  .map((d) => {
    const col = DOMAIN_COLOURS[d.domain] || '#6b7280';
    return `      <tr>
        <td><div class="domain-name"><span class="domain-dot" style="background:${col}"></span> ${escHtml(d.domain)}</div></td>
        <td style="text-align:center; font-weight:600;">${d.score.toFixed(1)}</td>
        <td style="font-weight:600; color:${col};">L${Math.round(d.score)}  -  ${escHtml(d.levelName)}</td>
        <td>
          <div class="bar-bg">
            <div class="bar-fill" style="width:${(d.score / 5) * 100}%; background:${col}; opacity:0.7;"></div>
          </div>
        </td>
      </tr>`;
  })
  .join('\n')}
    </tbody>
  </table>

  <!-- Priority Development Areas -->
  <div class="section-title">Priority Development Areas</div>
  <div class="priority-rank">
${sorted
  .map(
    (d, i) =>
      `    <div class="priority-item">
      <div class="priority-header">
        <div class="priority-rank-num" style="background:${DOMAIN_COLOURS[d.domain] || '#6b7280'}">${i + 1}</div>
        <div class="priority-item-name">${escHtml(d.domain)}</div>
        <div class="priority-item-level" style="color:${DOMAIN_COLOURS[d.domain] || '#6b7280'}">L${Math.round(d.score)}  -  ${escHtml(d.levelName)}</div>
      </div>
      ${Math.round(d.score) < 5 ? `<div class="priority-next"><strong>Next: ${escHtml(d.nextLevelName)}</strong><br/>${escHtml(d.nextLevelDescriptor)}</div>` : ''}
    </div>`,
  )
  .join('\n')}
  </div>

  <!-- Recommendation -->
  <div class="rec-box">
    <div class="tag">Recommended Approach</div>
    <h3>${escHtml(rec.title)}</h3>
    <p>${escHtml(rec.body(topDomain, data.overallLevelName))}</p>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>Generated by <strong>DREAM</strong>  -  POCTR Transformation Readiness Assessment</div>
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
