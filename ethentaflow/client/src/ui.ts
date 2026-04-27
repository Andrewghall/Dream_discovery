// Minimal UI for EthentaFlow. Transcript pane + debug panel.

declare const html2pdf: any; // loaded via CDN in index.html

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip "data:application/pdf;base64," prefix
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ── Discovery report helpers ────────────────────────────────────────────────

function pageHeader(date: string, page: number, total: number): string {
  return `<div class="ddr-hdr"><span>${escapeHtml(date)}</span><span class="ddr-hdr-mid">DREAM DISCOVERY</span><span></span></div>`;
}
function pageFooter(page: number, total: number): string {
  return `<div class="ddr-ftr"><span>Copyright ${new Date().getFullYear()} DREAM Discovery</span><span>Page ${page} of ${total}</span></div>`;
}
function categorySection(title: string, items: string[] | undefined): string {
  if (!items || items.length === 0) return '';
  return `<div class="ddr-cat-title">${escapeHtml(title)}</div>
    <ul class="ddr-cat-list">${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

const LENS_MATURITY: Record<string, string[]> = {
  people: [
    "Skills gaps everywhere. People leave frequently. Teams don't talk to each other.",
    'Roles defined but overlap confusing. Some training exists. Collaboration when pushed.',
    'Clear expectations and development paths. People work across teams. Learning encouraged.',
    'Skills planning proactive. AI helps with routine work. Continuous learning normal.',
    'People and AI work seamlessly. Humans focus on judgement and relationships.',
  ],
  operations: [
    'Work is fragmented. Handoffs fail. Ownership unclear. Constant firefighting.',
    'Core processes exist but execution is inconsistent. Bottlenecks are common.',
    'Roles and workflows are clear. Delivery is reasonably reliable and accountable.',
    'Operations adapt quickly. Governance helps decisions move with control.',
    'Execution is seamless. The operating model scales without unnecessary friction.',
  ],
  technology: [
    'Old systems everywhere. Manual workarounds constant. Data unreliable.',
    'Core systems work but inflexible. Some automation. Data improving but patchy.',
    'Systems talk to each other. Data trustworthy. AI handles routine tasks.',
    'Modern flexible systems. AI assists decisions. Self-service works.',
    'Technology just works. AI handles complexity. Innovation fast.',
  ],
  commercial: [
    'Value is leaking. Customer demand is poorly understood. Growth feels reactive.',
    'There is some commercial discipline, but pricing, proposition, and demand signals are inconsistent.',
    'Customer value and commercial outcomes are mostly aligned. Teams can see what drives performance.',
    'The organisation anticipates demand, sharpens value delivery, and makes better commercial decisions quickly.',
    'Commercial strategy is clear, evidence-led, and consistently translated into sustainable growth.',
  ],
  customer: [
    'Customer needs are poorly understood. Experience is inconsistent. Trust is fragile and easily lost.',
    'Some customer insight exists, but journeys break down and service quality varies too much.',
    'The organisation understands core customer needs and usually delivers a dependable experience.',
    'Customer insight shapes decisions quickly. Journeys improve proactively and trust is strengthened deliberately.',
    'The organisation is deeply customer-led. Experience, loyalty, and advocacy reinforce each other consistently.',
  ],
  partners: [
    'Critical external dependencies are poorly managed. Partner performance creates repeated surprises.',
    'Key partners are known, but accountability, integration, and escalation are inconsistent.',
    'Important partners are managed with reasonable clarity, governance, and visibility.',
    'The organisation works with partners strategically and resolves dependency issues early.',
    'Partner ecosystems operate as an aligned extension of the business with clear value, accountability, and control.',
  ],
  risk_compliance: [
    'Compliance reactive. Regulatory changes surprise us. Control gaps emerge too late.',
    'A framework exists, but oversight and accountability are inconsistent.',
    'Risks and obligations are tracked systematically. Controls are usually embedded into delivery.',
    'Changes are anticipated. Assurance is timely. Control burden is better targeted.',
    'Risk and compliance are disciplined, transparent, and built into how the organisation operates.',
  ],
};
function maturityBandsForLens(lens: string): string {
  const bands = LENS_MATURITY[lens];
  if (!bands) return '';
  const labels = ['Reactive', 'Emerging', 'Defined', 'Optimised', 'Intelligent'];
  return bands.map((d, i) =>
    `<div class="ddr-band ddr-band-${i + 1}"><strong>${labels[i]}:</strong> ${escapeHtml(d)}</div>`
  ).join('');
}

/** Inline SVG radar chart with three series (current/target/projected). */
function renderSpiderChart(lenses: any[]): string {
  if (!lenses || lenses.length === 0) {
    return '<div style="text-align:center;color:#8a96b0;padding:40px;font-size:13px;">No lens data captured yet.</div>';
  }
  const W = 580, H = 360;
  const cx = W / 2, cy = H / 2 + 6;
  const radius = 130;
  const n = lenses.length;
  const angle = (i: number) => (-Math.PI / 2) + (i / n) * Math.PI * 2;
  const point = (i: number, val: number) => {
    const r = (val / 10) * radius;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };
  // Concentric grid (5 rings)
  const rings = [2, 4, 6, 8, 10].map(v => {
    const pts = lenses.map((_, i) => point(i, v).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#e3e6ee" stroke-width="0.8" />`;
  }).join('');
  // Spokes
  const spokes = lenses.map((_, i) => {
    const [x, y] = point(i, 10);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e3e6ee" stroke-width="0.8" />`;
  }).join('');
  // Series polygons + dots
  const series = (key: 'current' | 'target' | 'projected', stroke: string, fill: string) => {
    const pts = lenses.map((l, i) => {
      const v = typeof l[key] === 'number' ? l[key] : 0;
      return point(i, v).join(',');
    }).join(' ');
    const dots = lenses.map((l, i) => {
      const v = typeof l[key] === 'number' ? l[key] : null;
      if (v == null) return '';
      const [x, y] = point(i, v);
      return `<circle cx="${x}" cy="${y}" r="3.5" fill="${stroke}" />`;
    }).join('');
    return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />${dots}`;
  };
  // Axis labels
  const labels = lenses.map((l, i) => {
    const [x, y] = point(i, 11.4);
    const anchor = Math.abs(x - cx) < 8 ? 'middle' : (x > cx ? 'start' : 'end');
    const lines = [`D${i + 1} — ${l.label}`];
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11" fill="#3b4a6b" font-family="Inter,sans-serif">${escapeHtml(lines[0])}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;">
    ${rings}${spokes}
    ${series('target', '#10b981', 'rgba(16,185,129,0.18)')}
    ${series('current', '#f97316', 'rgba(249,115,22,0.22)')}
    ${series('projected', '#1a1d2b', 'rgba(26,29,43,0.10)')}
    ${labels}
    <g transform="translate(${cx - 200}, ${H - 18})" font-size="11" font-family="Inter,sans-serif" fill="#3b4a6b">
      <rect x="0" y="-9" width="10" height="10" fill="#f97316" /><text x="14" y="0">Current capability</text>
      <rect x="140" y="-9" width="10" height="10" fill="#10b981" /><text x="154" y="0">Target ambition</text>
      <rect x="280" y="-9" width="10" height="10" fill="#1a1d2b" /><text x="294" y="0">Projected if unchanged</text>
    </g>
  </svg>`;
}

/** Compact dark-theme spider/radar chart for the live panel. Falls back to
 *  a horizontal bar layout when there are fewer than 3 lenses (a polygon
 *  with 2 points is a line — not useful). */
function renderLiveSpider(lenses: any[]): string {
  if (!lenses || lenses.length === 0) return '';
  if (lenses.length < 3) {
    return lenses.map((l: any) => {
      const today = typeof l.current === 'number' ? l.current : 0;
      const target = typeof l.target === 'number' ? l.target : 0;
      const projected = typeof l.projected === 'number' ? l.projected : 0;
      const bar = (val: number, color: string) =>
        `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,0.78);">
          <span style="width:80px;color:rgba(255,255,255,0.6);">${escapeHtml(l.label)}</span>
          <span style="flex:1;height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;"><span style="display:block;height:100%;width:${(val/10)*100}%;background:${color};"></span></span>
          <span style="width:18px;text-align:right;">${val}</span>
        </div>`;
      return `<div style="margin:6px 0;">
        <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.92);margin-bottom:4px;">${escapeHtml(l.label)}</div>
        ${bar(today, '#f97316')}
        ${bar(target, '#10b981')}
        ${bar(projected, '#cbd5e1')}
      </div>`;
    }).join('') + `<div style="display:flex;gap:14px;font-size:10px;color:rgba(255,255,255,0.65);justify-content:center;margin-top:8px;">
      <span><span style="display:inline-block;width:8px;height:8px;background:#f97316;margin-right:4px;"></span>Current</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:#10b981;margin-right:4px;"></span>Target</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:#cbd5e1;margin-right:4px;"></span>Projected</span>
    </div>`;
  }
  const W = 260, H = 200;
  const cx = W / 2, cy = H / 2 + 4;
  const radius = 72;
  const n = lenses.length;
  const angle = (i: number) => (-Math.PI / 2) + (i / n) * Math.PI * 2;
  const point = (i: number, val: number) => {
    const r = (val / 10) * radius;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };
  const rings = [2, 4, 6, 8, 10].map(v => {
    const pts = lenses.map((_, i) => point(i, v).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.7" />`;
  }).join('');
  const spokes = lenses.map((_, i) => {
    const [x, y] = point(i, 10);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="0.7" />`;
  }).join('');
  const series = (key: 'current' | 'target' | 'projected', stroke: string, fill: string) => {
    const pts = lenses.map((l, i) => {
      const v = typeof l[key] === 'number' ? l[key] : 0;
      return point(i, v).join(',');
    }).join(' ');
    return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" />`;
  };
  const labels = lenses.map((l, i) => {
    const [x, y] = point(i, 11.6);
    const anchor = Math.abs(x - cx) < 6 ? 'middle' : (x > cx ? 'start' : 'end');
    const short = l.label.length > 12 ? l.label.slice(0, 11) + '…' : l.label;
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="9" fill="rgba(255,255,255,0.65)" font-family="Inter,sans-serif">${escapeHtml(short)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:8px;">
    ${rings}${spokes}
    ${series('target', '#10b981', 'rgba(16,185,129,0.18)')}
    ${series('current', '#f97316', 'rgba(249,115,22,0.22)')}
    ${series('projected', '#cbd5e1', 'rgba(203,213,225,0.10)')}
    ${labels}
  </svg>
  <div style="display:flex;gap:14px;font-size:10px;color:rgba(255,255,255,0.65);justify-content:center;margin-top:4px;">
    <span><span style="display:inline-block;width:8px;height:8px;background:#f97316;margin-right:4px;"></span>Current</span>
    <span><span style="display:inline-block;width:8px;height:8px;background:#10b981;margin-right:4px;"></span>Target</span>
    <span><span style="display:inline-block;width:8px;height:8px;background:#cbd5e1;margin-right:4px;"></span>Projected</span>
  </div>`;
}

/** Variable-size term cloud with rotating colours, deterministic by index. */
function renderWordCloud(terms: Array<{ term: string; weight: number }>): string {
  if (!terms || terms.length === 0) {
    return '<div style="text-align:center;color:#8a96b0;padding:24px;font-size:13px;">No themes captured yet.</div>';
  }
  const palette = ['#3b82f6', '#10b981', '#f97316', '#a855f7', '#ef4444', '#0ea5e9', '#d4a84c', '#84cc16', '#ec4899', '#6366f1'];
  const sorted = [...terms].sort((a, b) => b.weight - a.weight);
  return sorted.map((t, i) => {
    const fontSize = 11 + Math.round(t.weight * 1.6); // weight 1 → 12.6px, weight 10 → 27px
    const colour = palette[i % palette.length];
    const fontWeight = t.weight >= 7 ? 700 : t.weight >= 5 ? 600 : 400;
    return `<span class="ddr-cloud-term" style="font-size:${fontSize}px;color:${colour};font-weight:${fontWeight};">${escapeHtml(t.term)}</span>`;
  }).join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format milliseconds as M:SS (no leading zero on minutes). */
function formatMs(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Lens colours — dark-theme tones that work against #0a0e1a
const LENS_COLOURS: Record<string, { accent: string; bg: string; label: string }> = {
  people:          { accent: '#3b82f6', bg: '#1e3a5f', label: 'People & Capability' },
  operations:      { accent: '#10b981', bg: '#0d3b2e', label: 'Operations & Delivery' },
  technology:      { accent: '#f97316', bg: '#3b1f0a', label: 'Technology' },
  commercial:      { accent: '#a855f7', bg: '#2e1650', label: 'Commercial' },
  risk_compliance: { accent: '#ef4444', bg: '#3b1010', label: 'Risk & Compliance' },
  partners:        { accent: '#14b8a6', bg: '#0a3030', label: 'Partners' },
};

const SCORE_LABELS: Record<number, string> = {
  1: 'Poor / high risk',
  2: 'Fragile / inconsistent',
  3: 'Solid, functional',
  4: 'Strong, trusted',
  5: 'Market-leading',
};

// Maturity band labels + pastel backgrounds — same as Dream Discovery's
// TripleRatingInput component (lib: components/chat/triple-rating-input.tsx).
const MATURITY_BANDS: Array<{ label: string; bg: string }> = [
  { label: 'Reactive',    bg: '#ffcccc' },
  { label: 'Emerging',    bg: '#ffe6cc' },
  { label: 'Defined',     bg: '#fff2cc' },
  { label: 'Optimised',   bg: '#ccffcc' },
  { label: 'Intelligent', bg: '#cce6ff' },
];

export class UI {
  private transcriptEl: HTMLElement;
  private debugEl: HTMLElement;
  private coverageEl: HTMLElement;
  private synthesisEl: HTMLElement;
  private statusEl: HTMLElement;
  private statusDotEl: HTMLElement;
  private partialEl: HTMLElement | null = null;
  private scoringCardEl: HTMLElement | null = null;
  private progressEl: HTMLElement | null = null;
  private sessionTimerEl: HTMLElement | null = null;
  private latestSynthesis: any = null;
  private sessionFinalised = false;
  private participantEmail: string | undefined;
  private emailAutoSent = false;

  // Timer state
  private sectionStartTimes: number[] = Array(6).fill(0); // epoch ms, 0 = not started
  private sectionEndTimes: number[] = Array(6).fill(0);   // epoch ms, 0 = still in progress
  private sessionStartedAt = 0;
  private paused = false;
  private pausedAtMs = 0;        // wall-clock when pause began
  private accumulatedPauseMs = 0; // total ms spent in pauses since session start
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private lastCoverageData: Parameters<UI['updateCoverage']>[0] | null = null;

  constructor() {
    this.transcriptEl = document.getElementById('transcript')!;
    this.debugEl = document.getElementById('debug')!;
    this.coverageEl = document.getElementById('coverage')!;
    this.synthesisEl = document.getElementById('synthesis')!;
    this.statusEl = document.getElementById('status')!;
    this.statusDotEl = document.getElementById('statusDot')!;
    this.progressEl = document.getElementById('interview-progress');
    this.sessionTimerEl = document.getElementById('session-timer');
  }

  setParticipantEmail(email: string | undefined): void {
    this.participantEmail = email;
  }

  notifyEmailSent(to: string): void {
    const banner = document.createElement('div');
    banner.style.cssText = 'background:#10b981;color:#fff;padding:8px 12px;border-radius:6px;margin:8px 0;font-size:12px;';
    banner.textContent = `Report emailed to ${to}.`;
    if (this.synthesisEl.firstChild) {
      this.synthesisEl.insertBefore(banner, this.synthesisEl.firstChild);
    } else {
      this.synthesisEl.appendChild(banner);
    }
    setTimeout(() => banner.remove(), 6000);
  }

  /** Render the synthesis panel — full structured view as it populates. */
  updateSynthesis(synthesis: any, wsClient?: any): void {
    this.latestSynthesis = synthesis;

    const root = this.synthesisEl;
    root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'synth-header';
    const headerTitle = document.createElement('span');
    headerTitle.textContent = synthesis.scope === 'final' ? 'SESSION SYNTHESIS' : 'LIVE SYNTHESIS';
    header.appendChild(headerTitle);
    root.appendChild(header);

    // PDF download button — ONLY shows at session end. No mid-session buttons.
    // Email is auto-sent on session end if an email is on file (no button).
    if (synthesis.scope === 'final' && Object.keys(synthesis.perLens || {}).length > 0) {
      const dlBtn = document.createElement('button');
      dlBtn.className = 'synth-download synth-download-top';
      dlBtn.textContent = 'Download PDF report';
      dlBtn.style.marginBottom = '14px';
      dlBtn.addEventListener('click', () => this.downloadPdf(dlBtn));
      root.appendChild(dlBtn);

      // Auto-email if we have an email and haven't already sent it.
      if (this.participantEmail && !this.emailAutoSent && wsClient) {
        this.emailAutoSent = true;
        // Fire-and-forget — banner shows when server confirms email_sent.
        void this.autoEmailPdf(wsClient);
      }
    }

    // Inline spider/radar chart for the lenses captured so far.
    const lensList = Object.values(synthesis.perLens || {});
    if (lensList.length > 0) {
      const chartBox = document.createElement('div');
      chartBox.className = 'synth-chart';
      const t = document.createElement('div');
      t.className = 'synth-section-title';
      t.textContent = 'Spider — current / target / projected';
      chartBox.appendChild(t);
      chartBox.insertAdjacentHTML('beforeend', renderLiveSpider(lensList));
      root.appendChild(chartBox);
    }

    // ── Executive summary + tone ─────────────────────────────────────────
    if (synthesis.executiveSummary) {
      const exec = document.createElement('div');
      exec.className = 'synth-exec';
      if (synthesis.executiveTone) {
        const tone = document.createElement('div');
        tone.className = 'synth-tone';
        tone.innerHTML = `Tone: <strong>${escapeHtml(synthesis.executiveTone)}</strong>`;
        exec.appendChild(tone);
      }
      const body = document.createElement('div');
      body.textContent = synthesis.executiveSummary;
      exec.appendChild(body);
      root.appendChild(exec);
    }

    // ── Input quality ─────────────────────────────────────────────────────
    if (typeof synthesis.inputQualityScore === 'number') {
      const iq = document.createElement('div');
      iq.className = 'synth-iq';
      iq.innerHTML = `<div class="synth-section-title">Input quality</div>
        <div class="synth-iq-score"><strong>${synthesis.inputQualityScore}/100</strong> (${escapeHtml(synthesis.inputQualityLabel || 'medium')})</div>
        ${synthesis.inputQualityDescription ? `<div class="synth-summary">${escapeHtml(synthesis.inputQualityDescription)}</div>` : ''}`;
      root.appendChild(iq);
    }

    // ── Key insights ──────────────────────────────────────────────────────
    if (Array.isArray(synthesis.keyInsights) && synthesis.keyInsights.length > 0) {
      const insightsBox = document.createElement('div');
      insightsBox.className = 'synth-insights';
      const t = document.createElement('div');
      t.className = 'synth-section-title';
      t.textContent = 'Key insights';
      insightsBox.appendChild(t);
      synthesis.keyInsights.forEach((i: any) => {
        const block = document.createElement('div');
        block.className = 'synth-insight';
        const title = document.createElement('div');
        title.className = 'synth-insight-title';
        title.textContent = i.title || '';
        block.appendChild(title);
        const conf = document.createElement('div');
        conf.className = 'synth-insight-conf';
        conf.innerHTML = `Confidence: <strong>${escapeHtml(i.confidence || 'medium')}</strong>`;
        block.appendChild(conf);
        if (i.description) {
          const d = document.createElement('div');
          d.className = 'synth-summary';
          d.textContent = i.description;
          block.appendChild(d);
        }
        (i.quotes || []).forEach((q: string) => {
          const blockquote = document.createElement('div');
          blockquote.className = 'synth-quote';
          blockquote.textContent = `"${q.replace(/^["']|["']$/g, '')}"`;
          block.appendChild(blockquote);
        });
        insightsBox.appendChild(block);
      });
      root.appendChild(insightsBox);
    }

    // ── Cross-cutting themes ──────────────────────────────────────────────
    if (Array.isArray(synthesis.crossLensThemes) && synthesis.crossLensThemes.length > 0) {
      const cross = document.createElement('div');
      cross.className = 'synth-cross';
      const crossTitle = document.createElement('div');
      crossTitle.className = 'synth-section-title';
      crossTitle.textContent = 'Cross-cutting themes';
      cross.appendChild(crossTitle);
      const tagWrap = document.createElement('div');
      tagWrap.className = 'synth-tags';
      synthesis.crossLensThemes.forEach((t: string) => {
        const tag = document.createElement('span');
        tag.className = 'synth-tag';
        tag.textContent = t;
        tagWrap.appendChild(tag);
      });
      cross.appendChild(tagWrap);
      root.appendChild(cross);
    }

    // ── Per-lens detailed structured view ─────────────────────────────────
    Object.values(synthesis.perLens || {}).forEach((lens: any) => {
      const section = document.createElement('div');
      section.className = 'synth-section';

      const title = document.createElement('div');
      title.className = 'synth-section-title';
      const ratingLabel = lens.current != null && lens.target != null
        ? ` — ${lens.current}/${lens.target}${lens.projected != null ? ` (proj ${lens.projected})` : ''}`
        : '';
      title.textContent = lens.label + ratingLabel;
      section.appendChild(title);

      if (lens.headline) {
        const h = document.createElement('div');
        h.className = 'synth-headline';
        h.textContent = lens.headline;
        section.appendChild(h);
      }
      if (lens.summary) {
        const s = document.createElement('div');
        s.className = 'synth-summary';
        s.textContent = lens.summary;
        section.appendChild(s);
      }

      // Structured categories — render only those with content.
      const categories: Array<[string, string[]]> = [
        ['Strengths / enablers', lens.strengths || []],
        ["What's working", lens.whatsWorking || []],
        ['Gaps / challenges', lens.gaps || []],
        ['Pain points', lens.painPoints || []],
        ['Friction', lens.friction || []],
        ['Barriers', lens.barriers || []],
        ['Constraints', lens.constraints || []],
        ['Future vision', lens.futureVision || []],
        ['Support needed', lens.supportNeeded || []],
      ];
      categories.forEach(([catTitle, items]) => {
        if (!items || items.length === 0) return;
        const catTitleEl = document.createElement('div');
        catTitleEl.className = 'synth-cat-title';
        catTitleEl.textContent = catTitle;
        section.appendChild(catTitleEl);
        const ul = document.createElement('ul');
        ul.className = 'synth-cat-list';
        items.forEach(it => {
          const li = document.createElement('li');
          li.textContent = it;
          ul.appendChild(li);
        });
        section.appendChild(ul);
      });

      if (lens.themes && lens.themes.length > 0) {
        const tagWrap = document.createElement('div');
        tagWrap.className = 'synth-tags';
        tagWrap.style.marginTop = '8px';
        lens.themes.forEach((t: string) => {
          const tag = document.createElement('span');
          tag.className = 'synth-tag';
          tag.textContent = t;
          tagWrap.appendChild(tag);
        });
        section.appendChild(tagWrap);
      }

      root.appendChild(section);
    });

    // ── Themes & intent (word-cloud-lite) ─────────────────────────────────
    if (Array.isArray(synthesis.themesAndIntent) && synthesis.themesAndIntent.length > 0) {
      const tic = document.createElement('div');
      tic.className = 'synth-cloud-live';
      const t = document.createElement('div');
      t.className = 'synth-section-title';
      t.textContent = 'Themes & intent';
      tic.appendChild(t);
      synthesis.themesAndIntent.slice(0, 24).forEach((term: any) => {
        const span = document.createElement('span');
        span.className = 'synth-cloud-term';
        const w = Math.max(1, Math.min(10, term.weight || 5));
        span.style.fontSize = `${10 + w}px`;
        span.style.fontWeight = String(w >= 7 ? 700 : w >= 5 ? 600 : 400);
        span.textContent = term.term;
        tic.appendChild(span);
      });
      root.appendChild(tic);
    }

    // ── Feedback (final synthesis only) ───────────────────────────────────
    if (synthesis.feedbackToInterviewee && synthesis.scope === 'final') {
      const fb = document.createElement('div');
      fb.className = 'synth-feedback';
      const t = document.createElement('div');
      t.className = 'synth-section-title';
      t.textContent = 'Feedback to interviewee';
      fb.appendChild(t);
      const body = document.createElement('div');
      body.className = 'synth-summary';
      body.textContent = synthesis.feedbackToInterviewee;
      fb.appendChild(body);
      root.appendChild(fb);
    }

  }

  /** Called on session_complete — re-render so the top button shows the
   *  final state ("Download PDF report"). */
  markSessionComplete(): void {
    this.sessionFinalised = true;
    if (this.latestSynthesis) {
      this.updateSynthesis(this.latestSynthesis);
    }
  }

  /** Silently generate the PDF + post to server for auto-email at session end. */
  private async autoEmailPdf(wsClient: any): Promise<void> {
    if (!this.latestSynthesis || !this.participantEmail) return;
    if (typeof html2pdf === 'undefined') return;
    try {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-99999px';
      wrapper.style.top = '0';
      wrapper.style.width = '720px';
      wrapper.style.background = '#ffffff';
      wrapper.innerHTML = this.buildSummaryDocument();
      document.body.appendChild(wrapper);
      const filename = `dreamflow-summary-${new Date().toISOString().slice(0, 10)}.pdf`;
      const blob: Blob = await html2pdf()
        .set({
          margin: [12, 14, 14, 14],
          filename,
          image: { type: 'jpeg', quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(wrapper.querySelector('.ddr') as HTMLElement)
        .outputPdf('blob');
      document.body.removeChild(wrapper);
      const base64 = await blobToBase64(blob);
      if (typeof wsClient.sendEmailPdf === 'function') {
        wsClient.sendEmailPdf({ to: this.participantEmail, base64, filename });
      }
    } catch (err) {
      console.error('[auto-email] error', err);
    }
  }

  /** Generate the PDF and POST it (base64) to the server, which forwards
   *  via Resend. */
  private async emailPdf(button: HTMLButtonElement, wsClient: any): Promise<void> {
    if (!this.latestSynthesis) return;
    if (typeof html2pdf === 'undefined') {
      alert('PDF library not loaded — try the download button instead.');
      return;
    }
    let to = this.participantEmail;
    if (!to) {
      to = (prompt('Send the PDF to which email address?') ?? '').trim();
      if (!to) return;
      this.participantEmail = to;
    }
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Generating + sending…';
    try {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-99999px';
      wrapper.style.top = '0';
      wrapper.style.width = '720px';
      wrapper.style.background = '#ffffff';
      wrapper.innerHTML = this.buildSummaryDocument();
      document.body.appendChild(wrapper);
      const filename = `dreamflow-summary-${new Date().toISOString().slice(0, 10)}.pdf`;
      const blob: Blob = await html2pdf()
        .set({
          margin: [12, 14, 14, 14],
          filename,
          image: { type: 'jpeg', quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(wrapper.querySelector('.ddr') as HTMLElement)
        .outputPdf('blob');
      document.body.removeChild(wrapper);
      const base64 = await blobToBase64(blob);
      if (wsClient && typeof wsClient.sendEmailPdf === 'function') {
        wsClient.sendEmailPdf({ to, base64, filename });
      }
    } catch (err) {
      console.error('[email-pdf] error', err);
      alert('Sorry, sending the email failed.');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  /** Render the synthesis as a styled HTML fragment off-screen, then ask
   *  html2pdf to produce a PDF blob and trigger the browser download. */
  private async downloadPdf(button: HTMLButtonElement): Promise<void> {
    if (!this.latestSynthesis) return;
    if (typeof html2pdf === 'undefined') {
      console.warn('[pdf] html2pdf not loaded — falling back to HTML download');
      this.downloadHtml();
      return;
    }
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Generating PDF…';
    try {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-99999px';
      wrapper.style.top = '0';
      wrapper.style.width = '720px';
      wrapper.style.background = '#ffffff';
      wrapper.innerHTML = this.buildSummaryDocument();
      document.body.appendChild(wrapper);
      const filename = `dreamflow-summary-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
      await html2pdf()
        .set({
          margin: [12, 14, 14, 14],
          filename,
          image: { type: 'jpeg', quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(wrapper.querySelector('.ddr') as HTMLElement)
        .save();
      document.body.removeChild(wrapper);
    } catch (err) {
      console.error('[pdf] generation failed', err);
      this.downloadHtml();
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  /** Fallback: HTML download, used if html2pdf isn't available or fails. */
  private downloadHtml(): void {
    if (!this.latestSynthesis) return;
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>DREAMflow session summary</title></head>
<body>${this.buildSummaryDocument()}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dreamflow-summary-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Build the full styled summary HTML — multi-page Dream Discovery report
   *  layout matching the canonical Dream PDF format (header/footer per page,
   *  executive summary + input quality + key insights, spider chart + word
   *  cloud, one detailed page per lens). */
  private buildSummaryDocument(): string {
    const s = this.latestSynthesis;
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const lensList = Object.values(s.perLens) as any[];
    const totalPages = 2 + lensList.length; // page 1 = exec, page 2 = chart+cloud, then 1 per lens

    return `
<style>
  .ddr { font-family: Inter, system-ui, -apple-system, sans-serif; color: #1a1d2b; line-height: 1.55; background: #ffffff; }
  .ddr-page { width: 720px; margin: 0 auto 0; padding: 28px 36px 56px; position: relative; min-height: 980px; box-sizing: border-box; page-break-after: always; }
  .ddr-page:last-child { page-break-after: auto; }
  .ddr-hdr { display: flex; justify-content: space-between; font-size: 11px; color: #5b6b8a; padding-bottom: 14px; border-bottom: 1px solid #e3e6ee; margin-bottom: 20px; }
  .ddr-hdr-mid { font-weight: 700; color: #1a1d2b; letter-spacing: 0.08em; }
  .ddr-ftr { position: absolute; left: 36px; right: 36px; bottom: 18px; display: flex; justify-content: space-between; font-size: 10px; color: #8a96b0; }
  .ddr-section { border: 1px solid #e3e6ee; border-radius: 10px; padding: 18px 22px; margin-bottom: 18px; page-break-inside: avoid; }
  .ddr-h1 { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
  .ddr-h2 { font-size: 16px; font-weight: 700; margin: 0 0 10px; }
  .ddr-sub { font-size: 12px; color: #5b6b8a; margin-bottom: 14px; }
  .ddr-tone { font-size: 12px; color: #5b6b8a; margin-bottom: 6px; }
  .ddr-tone strong { color: #1a1d2b; }
  .ddr-para { font-size: 13px; margin: 8px 0; }
  .ddr-quote { border-left: 3px solid #d4a84c; padding: 4px 12px; margin: 6px 0 6px 4px; font-size: 12.5px; color: #3b4a6b; font-style: italic; }
  .ddr-conf { font-size: 16px; font-weight: 700; margin: 4px 0 6px; }
  .ddr-conf-label { color: #5b6b8a; font-weight: 400; font-size: 13px; }
  .ddr-band { padding: 6px 12px; border-radius: 6px; margin: 4px 0; font-size: 12.5px; }
  .ddr-band-1 { background: #ffe1e1; }
  .ddr-band-2 { background: #ffeed1; }
  .ddr-band-3 { background: #fff5cc; }
  .ddr-band-4 { background: #d6f5d6; }
  .ddr-band-5 { background: #d6e7ff; }
  .ddr-scores { display: flex; gap: 32px; margin: 12px 0 10px; font-size: 13px; color: #5b6b8a; }
  .ddr-scores strong { color: #1a1d2b; font-size: 14px; margin-left: 4px; }
  .ddr-cat-title { font-size: 11px; font-weight: 700; color: #5b6b8a; text-transform: uppercase; letter-spacing: 0.04em; margin: 10px 0 4px; }
  .ddr-cat-list { margin: 0 0 4px 18px; padding: 0; font-size: 12.5px; color: #1a1d2b; }
  .ddr-cat-list li { margin: 2px 0; }
  .ddr-q { font-size: 13px; color: #3b4a6b; margin-bottom: 6px; }
  .ddr-bands-key { font-size: 11px; color: #8a96b0; margin: 4px 0 8px; }
  .ddr-cloud { padding: 18px 22px; border: 1px solid #e3e6ee; border-radius: 10px; line-height: 2.1; }
  .ddr-cloud-term { display: inline-block; margin: 0 8px; vertical-align: middle; }
</style>
<div class="ddr">

  <!-- ───────────── PAGE 1: HEADER + EXEC SUMMARY + INPUT QUALITY + INSIGHTS ───────────── -->
  <div class="ddr-page">
    ${pageHeader(date, 1, totalPages)}

    <h1 class="ddr-h1">Discovery Report</h1>
    <div class="ddr-sub">${escapeHtml(s.participantCompany ?? 'Capita')} — Go-To-Market &amp; ICP Strategy${s.participantName ? ` · ${escapeHtml(s.participantName)}` : ''}${s.participantTitle ? ` · ${escapeHtml(s.participantTitle)}` : ''}</div>

    ${s.executiveSummary ? `
    <div class="ddr-section">
      <h2 class="ddr-h2">Executive Summary</h2>
      <div class="ddr-tone">Tone: <strong>${escapeHtml(s.executiveTone || 'pragmatic')}</strong></div>
      ${s.executiveSummary.split(/\n{2,}|(?<=\.)\s+(?=[A-Z][^.]{30,})/).slice(0, 3).map((p: string) => `<p class="ddr-para">${escapeHtml(p.trim())}</p>`).join('')}
    </div>` : ''}

    <div class="ddr-section">
      <h2 class="ddr-h2">Input Quality (Evidence Check)</h2>
      <div class="ddr-para">Score: <strong>${s.inputQualityScore}/100</strong> (${escapeHtml(s.inputQualityLabel || 'medium')})</div>
      ${s.inputQualityDescription ? `<div class="ddr-para">${escapeHtml(s.inputQualityDescription)}</div>` : ''}
    </div>

    ${s.keyInsights?.length ? `
    <div class="ddr-section">
      <h2 class="ddr-h2">Key Insights (Evidence-backed)</h2>
      ${s.keyInsights.map((i: any, idx: number) => `
        <div style="margin-bottom: 14px;">
          <div style="font-weight: 700; font-size: 13.5px;">${escapeHtml(i.title || `${idx + 1}. Insight`)}</div>
          <div class="ddr-conf">Confidence: <span class="ddr-conf-label">${escapeHtml(i.confidence || 'medium')}</span></div>
          ${i.description ? `<div class="ddr-para">${escapeHtml(i.description)}</div>` : ''}
          ${(i.quotes || []).map((q: string) => `<div class="ddr-quote">${escapeHtml(`"${q.replace(/^["']|["']$/g, '')}"`)}</div>`).join('')}
        </div>`).join('')}
    </div>` : ''}

    ${pageFooter(1, totalPages)}
  </div>

  <!-- ───────────── PAGE 2: SPIDER DIAGRAM + WORD CLOUD ───────────── -->
  <div class="ddr-page">
    ${pageHeader(date, 2, totalPages)}

    <div class="ddr-section">
      <h2 class="ddr-h2">Spider Diagram (Three Scores)</h2>
      <div class="ddr-sub">Current, target, and projected (1–10)</div>
      ${renderSpiderChart(lensList)}
    </div>

    <div class="ddr-section">
      <h2 class="ddr-h2">Themes &amp; Intent</h2>
      <div class="ddr-cloud">
        ${renderWordCloud(s.themesAndIntent || [])}
      </div>
    </div>

    ${pageFooter(2, totalPages)}
  </div>

  <!-- ───────────── PAGES 3+: PER-LENS DETAIL ───────────── -->
  ${lensList.map((l: any, idx: number) => `
  <div class="ddr-page">
    ${pageHeader(date, 3 + idx, totalPages)}

    <div class="ddr-section">
      <h2 class="ddr-h2">D${idx + 1} — ${escapeHtml(l.label)}</h2>
      ${l.question ? `<div class="ddr-q">${escapeHtml(l.question)}</div>` : ''}
      <div class="ddr-bands-key">Maturity bands: 1–2 Reactive, 3–4 Emerging, 5–6 Defined, 7–8 Optimised, 9–10 Intelligent</div>

      ${maturityBandsForLens(l.lens)}

      <div class="ddr-scores">
        <div>Current: <strong>${l.current ?? '—'}</strong></div>
        <div>Target: <strong>${l.target ?? '—'}</strong></div>
        <div>Projected: <strong>${l.projected ?? '—'}</strong></div>
      </div>

      ${categorySection('Strengths / enablers', l.strengths)}
      ${categorySection("What's working", l.whatsWorking)}
      ${categorySection('Gaps / challenges', l.gaps)}
      ${categorySection('Pain points', l.painPoints)}
      ${categorySection('Friction', l.friction)}
      ${categorySection('Barriers', l.barriers)}
      ${categorySection('Constraints', l.constraints)}
      ${categorySection('Future vision', l.futureVision)}
      ${categorySection('Support needed', l.supportNeeded)}
    </div>

    ${idx === lensList.length - 1 && s.feedbackToInterviewee ? `
    <div class="ddr-section">
      <h2 class="ddr-h2">Feedback to the Interviewee</h2>
      <div class="ddr-para">${escapeHtml(s.feedbackToInterviewee)}</div>
    </div>` : ''}

    ${pageFooter(3 + idx, totalPages)}
  </div>`).join('')}

</div>`;
  }

  /** Start the session-level clock. Called when server emits 'ready'. */
  startSessionTimer(): void {
    this.sessionStartedAt = Date.now();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.tickTimers(), 1000);
  }

  /** Stop all timers (session ended or disconnected). */
  stopSessionTimer(): void {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    this.sessionStartedAt = 0;
    this.paused = false;
    this.pausedAtMs = 0;
    this.accumulatedPauseMs = 0;
  }

  /** Freeze / unfreeze all timers (per-section + session total) when paused. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    if (paused) {
      this.paused = true;
      this.pausedAtMs = Date.now();
    } else {
      this.paused = false;
      if (this.pausedAtMs > 0) {
        this.accumulatedPauseMs += Date.now() - this.pausedAtMs;
        this.pausedAtMs = 0;
      }
    }
  }

  /** Effective "now" — Date.now() with paused intervals subtracted. Used by
   *  the per-section timer so frozen sections stay frozen and the running
   *  section's display freezes during pause. */
  private effectiveNow(): number {
    if (this.paused) {
      // While paused, freeze at the moment pause began (minus any prior pause time).
      return this.pausedAtMs - this.accumulatedPauseMs;
    }
    return Date.now() - this.accumulatedPauseMs;
  }

  private tickTimers(): void {
    // Session total — freezes during pause via effectiveNow().
    if (this.sessionTimerEl && this.sessionStartedAt > 0) {
      const total = this.effectiveNow() - this.sessionStartedAt;
      this.sessionTimerEl.textContent = formatMs(total);
      // Colour the total time: amber at 20 min, red at 25 min
      this.sessionTimerEl.classList.remove('timer-warn', 'timer-over');
      if (total >= 25 * 60 * 1000) this.sessionTimerEl.classList.add('timer-over');
      else if (total >= 20 * 60 * 1000) this.sessionTimerEl.classList.add('timer-warn');
    }

    // Per-section timers (update in-place — just the .section-timer spans).
    // - Not started: no time displayed.
    // - In progress (no end time): live tick.
    // - Completed (end time set): frozen at endTime - startTime.
    const timerSpans = this.coverageEl.querySelectorAll<HTMLElement>('.section-timer');
    timerSpans.forEach((span) => {
      const idx = parseInt(span.dataset['sectionIdx'] ?? '-1', 10);
      if (idx < 0) return;
      const start = this.sectionStartTimes[idx] ?? 0;
      if (start === 0) {
        span.textContent = '';
        span.classList.remove('timer-warn', 'timer-over');
        return;
      }
      const end = this.sectionEndTimes[idx] ?? 0;
      // Use effectiveNow() so the running section's timer freezes during pause.
      const elapsed = (end > 0 ? end : this.effectiveNow()) - start;
      span.textContent = formatMs(elapsed);

      // Colour thresholds — amber at 4:00, red at 4:30. Frozen sections keep
      // whatever colour they finished on.
      span.classList.remove('timer-warn', 'timer-over');
      if (elapsed >= 4.5 * 60 * 1000)    span.classList.add('timer-over');
      else if (elapsed >= 4 * 60 * 1000) span.classList.add('timer-warn');
    });
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  setLive(live: boolean): void {
    this.statusDotEl.classList.toggle('live', live);
  }

  setPartial(text: string): void {
    if (!this.partialEl) {
      this.partialEl = document.createElement('div');
      this.partialEl.className = 'turn user partial';
      this.transcriptEl.appendChild(this.partialEl);
    }
    this.partialEl.textContent = text;
    this.scroll();
  }

  appendFinalUser(text: string): void {
    if (this.partialEl) {
      this.partialEl.classList.remove('partial');
      this.partialEl.textContent = text;
      this.partialEl = null;
    } else {
      const div = document.createElement('div');
      div.className = 'turn user';
      div.textContent = text;
      this.transcriptEl.appendChild(div);
    }
    this.scroll();
  }

  appendSystemProbe(text: string, _strategy: string): void {
    const div = document.createElement('div');
    div.className = 'turn system';
    div.textContent = text;
    this.transcriptEl.appendChild(div);
    this.scroll();
  }

  /** Append text to the most recent system bubble (used for streaming —
   *  multiple sentences in the same agent turn render as one bubble). */
  appendToLastSystemProbe(text: string): void {
    const bubbles = this.transcriptEl.querySelectorAll('.turn.system');
    const last = bubbles[bubbles.length - 1] as HTMLElement | undefined;
    if (last) {
      last.textContent = (last.textContent ?? '') + text;
      this.scroll();
    } else {
      // No bubble to append to — fall back to creating one.
      this.appendSystemProbe(text.trimStart(), 'drill_depth');
    }
  }

  updateCoverage(data: {
    sections: Array<{ lens: string; label: string; sectionIndex: number; isCurrent: boolean; pct: number; questionIndex: number }>;
    currentSection: number;
    totalSections: number;
    totalPct: number;
    sectionStartTimes?: number[];
    sectionEndTimes?: number[];
  }): void {
    // Store timing data so the ticker can update spans in-place
    if (data.sectionStartTimes) {
      this.sectionStartTimes = data.sectionStartTimes;
    }
    if (data.sectionEndTimes) {
      this.sectionEndTimes = data.sectionEndTimes;
    }
    this.lastCoverageData = data;

    this.coverageEl.innerHTML = '';

    // Header row
    const header = document.createElement('div');
    header.className = 'coverage-header';
    header.textContent = `SECTION COVERAGE — ${data.currentSection}/${data.totalSections}`;
    this.coverageEl.appendChild(header);

    // Section rows
    data.sections.forEach((s, idx) => {
      const row = document.createElement('div');
      row.className = 'coverage-row' + (s.isCurrent ? ' coverage-row-current' : '');

      const label = document.createElement('div');
      label.className = 'coverage-label';
      const qTag = s.isCurrent ? ` <span class="coverage-qtag">Q${s.questionIndex}/5</span>` : '';
      label.innerHTML = s.label + qTag;

      const bar = document.createElement('div');
      bar.className = 'coverage-bar';
      const fill = document.createElement('div');
      fill.className = 'coverage-fill';
      fill.style.width = `${s.pct}%`;
      if (s.pct >= 85) fill.classList.add('coverage-fill-complete');
      bar.appendChild(fill);

      const pctEl = document.createElement('div');
      pctEl.className = 'coverage-pct';
      pctEl.textContent = `${s.pct}%`;

      // Timer column — shows elapsed time for this section.
      //   start == 0: not yet started → blank
      //   end == 0:   in progress → ticks live in the timer interval
      //   end > 0:    completed → frozen at end - start
      const timerEl = document.createElement('div');
      timerEl.className = 'section-timer';
      timerEl.dataset['sectionIdx'] = String(idx);
      const start = this.sectionStartTimes[idx] ?? 0;
      const end = this.sectionEndTimes[idx] ?? 0;
      if (start === 0) {
        timerEl.textContent = '';
      } else {
        const elapsed = (end > 0 ? end : this.effectiveNow()) - start;
        timerEl.textContent = formatMs(elapsed);
        if (elapsed >= 4.5 * 60 * 1000)    timerEl.classList.add('timer-over');
        else if (elapsed >= 4 * 60 * 1000) timerEl.classList.add('timer-warn');
      }

      row.appendChild(label);
      row.appendChild(bar);
      row.appendChild(pctEl);
      row.appendChild(timerEl);
      this.coverageEl.appendChild(row);
    });

    // Total row — no timer, just spans the last column with empty cell
    const total = document.createElement('div');
    total.className = 'coverage-total';

    const totalLabel = document.createElement('div');
    totalLabel.className = 'coverage-label';
    totalLabel.textContent = 'TOTAL';

    const totalBar = document.createElement('div');
    totalBar.className = 'coverage-bar';
    const totalFill = document.createElement('div');
    totalFill.className = 'coverage-fill';
    totalFill.style.width = `${data.totalPct}%`;
    if (data.totalPct >= 85) totalFill.classList.add('coverage-fill-complete');
    totalBar.appendChild(totalFill);

    const totalPct = document.createElement('div');
    totalPct.className = 'coverage-pct';
    totalPct.textContent = `${data.totalPct}%`;

    // Empty spacer for the timer column
    const totalSpacer = document.createElement('div');

    total.appendChild(totalLabel);
    total.appendChild(totalBar);
    total.appendChild(totalPct);
    total.appendChild(totalSpacer);
    this.coverageEl.appendChild(total);
  }

  updateDebug(state: any): void {
    this.debugEl.innerHTML = '';
    this.addKV('LENS', state.currentLens ?? '-');
    const sig = state.currentSignal;
    this.addKV('SIGNAL', sig ? `${sig.type} (${sig.confidence.toFixed(2)})` : 'none');
    this.addKV('DEPTH', String(state.depthScore ?? 0));
    this.addKV('EXAMPLE', state.exampleProvided ? 'yes' : 'no');

    if (state.signalStack && state.signalStack.length > 0) {
      this.addSection('STACK');
      for (const s of state.signalStack.slice(0, 3)) {
        this.addKV(s.type, s.confidence.toFixed(2));
      }
    }

    if (state.pendingProbe) {
      this.addSection('PENDING PROBE');
      const div = document.createElement('div');
      div.textContent = state.pendingProbe.text;
      div.style.fontStyle = 'italic';
      div.style.color = 'var(--accent)';
      this.debugEl.appendChild(div);
    }

    if (state.liveUtterance) {
      this.addSection('LIVE');
      const div = document.createElement('div');
      div.textContent = state.liveUtterance;
      div.style.color = 'var(--muted)';
      this.debugEl.appendChild(div);
    }
  }

  /** Show the rating card for a lens measurement question — Dream Discovery
   * layout: vertical pastel-banded rows (Reactive→Intelligent), each showing
   * the lens-specific maturity description. Below: Today / Target / 18m
   * prompt rows.
   */
  showScoringCard(lens: string, _question: string, maturityScale: string[] | null = null): void {
    this.hideScoringCard();

    const theme = LENS_COLOURS[lens] ?? { accent: '#d4a84c', bg: '#2a1f0a', label: lens };

    const card = document.createElement('div');
    card.className = 'scoring-card';
    card.setAttribute('data-lens', lens);
    card.style.setProperty('--lens-accent', theme.accent);
    card.style.setProperty('--lens-bg', theme.bg);

    // Lens label
    const labelEl = document.createElement('div');
    labelEl.className = 'scoring-card-label';
    labelEl.textContent = theme.label;
    card.appendChild(labelEl);

    // 5 vertical pastel-banded rows — one per maturity level.
    const bandsEl = document.createElement('div');
    bandsEl.className = 'scoring-card-bands';

    const scale = (Array.isArray(maturityScale) && maturityScale.length === 5) ? maturityScale : null;

    for (let i = 1; i <= 5; i++) {
      const band = MATURITY_BANDS[i - 1]!;
      const row = document.createElement('div');
      row.className = 'scoring-card-band';
      row.style.background = band.bg;
      row.setAttribute('data-band', String(i));

      const numEl = document.createElement('span');
      numEl.className = 'scoring-card-band-num';
      numEl.textContent = String(i);

      const labelLineEl = document.createElement('span');
      labelLineEl.className = 'scoring-card-band-text';

      const labelStrong = document.createElement('strong');
      labelStrong.className = 'scoring-card-band-label';
      labelStrong.textContent = band.label + ':';

      const descSpan = document.createElement('span');
      descSpan.className = 'scoring-card-band-desc';
      descSpan.textContent = ' ' + (scale ? scale[i - 1]! : SCORE_LABELS[i]!);

      labelLineEl.appendChild(labelStrong);
      labelLineEl.appendChild(descSpan);

      row.appendChild(numEl);
      row.appendChild(labelLineEl);
      bandsEl.appendChild(row);
    }

    card.appendChild(bandsEl);

    // Three rating prompts — visual anchor for what the participant is being asked
    const promptsEl = document.createElement('div');
    promptsEl.className = 'scoring-card-prompts';

    const prompts = [
      { key: 'Today', desc: 'Where are you now?' },
      { key: 'Target', desc: 'Where do you need to be?' },
      { key: '18 months', desc: 'Where do you end up if nothing changes?' },
    ];

    for (const p of prompts) {
      const row = document.createElement('div');
      row.className = 'scoring-card-prompt-row';

      const key = document.createElement('span');
      key.className = 'scoring-card-prompt-key';
      key.textContent = p.key;

      const desc = document.createElement('span');
      desc.className = 'scoring-card-prompt-desc';
      desc.textContent = p.desc;

      row.appendChild(key);
      row.appendChild(desc);
      promptsEl.appendChild(row);
    }

    card.appendChild(promptsEl);
    this.transcriptEl.appendChild(card);
    this.scoringCardEl = card;
    this.scroll();
  }

  /** Update the rating card to highlight the captured current score. */
  highlightScore(current: number): void {
    if (!this.scoringCardEl) return;
    const bands = this.scoringCardEl.querySelectorAll('.scoring-card-band');
    bands.forEach((band, idx) => {
      band.classList.toggle('active', idx + 1 === current);
    });
  }

  /** Remove the scoring card from the transcript. */
  hideScoringCard(): void {
    if (this.scoringCardEl) {
      this.scoringCardEl.remove();
      this.scoringCardEl = null;
    }
  }

  updateInterviewProgress(data: { sectionIndex: number; questionIndex: number; sectionName: string; progressLabel: string; sectionStartedAt?: number }): void {
    if (!this.progressEl) return;
    this.progressEl.textContent = `${data.progressLabel} — ${data.sectionName}`;
    // Update section start time if the server just told us when this section began
    if (data.sectionStartedAt && data.sectionStartedAt > 0) {
      const idx = data.sectionIndex - 1;
      if (idx >= 0 && idx < this.sectionStartTimes.length && this.sectionStartTimes[idx] === 0) {
        this.sectionStartTimes[idx] = data.sectionStartedAt;
      }
    }
  }

  private addSection(title: string): void {
    const h = document.createElement('h2');
    h.textContent = title;
    this.debugEl.appendChild(h);
  }

  private addKV(key: string, value: string): void {
    const row = document.createElement('div');
    row.className = 'kv';
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = key;
    const v = document.createElement('span');
    v.textContent = value;
    row.appendChild(k);
    row.appendChild(v);
    this.debugEl.appendChild(row);
  }

  private scroll(): void {
    this.transcriptEl.scrollTop = this.transcriptEl.scrollHeight;
  }
}
