// Minimal UI for EthentaFlow. Transcript pane + debug panel.

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

export class UI {
  private transcriptEl: HTMLElement;
  private debugEl: HTMLElement;
  private coverageEl: HTMLElement;
  private statusEl: HTMLElement;
  private statusDotEl: HTMLElement;
  private partialEl: HTMLElement | null = null;
  private scoringCardEl: HTMLElement | null = null;
  private progressEl: HTMLElement | null = null;
  private sessionTimerEl: HTMLElement | null = null;

  // Timer state
  private sectionStartTimes: number[] = Array(6).fill(0); // epoch ms, 0 = not started — 6 sections
  private sessionStartedAt = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private lastCoverageData: Parameters<UI['updateCoverage']>[0] | null = null;

  constructor() {
    this.transcriptEl = document.getElementById('transcript')!;
    this.debugEl = document.getElementById('debug')!;
    this.coverageEl = document.getElementById('coverage')!;
    this.statusEl = document.getElementById('status')!;
    this.statusDotEl = document.getElementById('statusDot')!;
    this.progressEl = document.getElementById('interview-progress');
    this.sessionTimerEl = document.getElementById('session-timer');
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
  }

  private tickTimers(): void {
    // Session total
    if (this.sessionTimerEl && this.sessionStartedAt > 0) {
      const total = Date.now() - this.sessionStartedAt;
      this.sessionTimerEl.textContent = formatMs(total);
      // Colour the total time: amber at 20 min, red at 25 min
      this.sessionTimerEl.classList.remove('timer-warn', 'timer-over');
      if (total >= 25 * 60 * 1000) this.sessionTimerEl.classList.add('timer-over');
      else if (total >= 20 * 60 * 1000) this.sessionTimerEl.classList.add('timer-warn');
    }

    // Per-section timers (update in-place — just the .section-timer spans)
    const timerSpans = this.coverageEl.querySelectorAll<HTMLElement>('.section-timer');
    timerSpans.forEach((span) => {
      const idx = parseInt(span.dataset['sectionIdx'] ?? '-1', 10);
      if (idx < 0 || idx >= 5) return;
      const start = this.sectionStartTimes[idx] ?? 0;
      if (start === 0) return; // not started

      const elapsed = Date.now() - start;
      span.textContent = formatMs(elapsed);

      // Colour thresholds — amber at 4:00, red at 4:30 (matches server SECTION_OVERTIME_MS)
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

  updateCoverage(data: {
    sections: Array<{ lens: string; label: string; sectionIndex: number; isCurrent: boolean; pct: number; questionIndex: number }>;
    currentSection: number;
    totalSections: number;
    totalPct: number;
    sectionStartTimes?: number[];
  }): void {
    // Store timing data so the ticker can update spans in-place
    if (data.sectionStartTimes) {
      this.sectionStartTimes = data.sectionStartTimes;
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

      // Timer column — shows elapsed time for this section, ticks live
      const timerEl = document.createElement('div');
      timerEl.className = 'section-timer';
      timerEl.dataset['sectionIdx'] = String(idx);
      const start = this.sectionStartTimes[idx] ?? 0;
      if (start === 0) {
        timerEl.textContent = '—';
      } else {
        const elapsed = Date.now() - start;
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

  /** Show the coloured 1–5 scoring card for a lens measurement question. */
  showScoringCard(lens: string, _question: string): void {
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

    // Score cells 1–5
    const cellsEl = document.createElement('div');
    cellsEl.className = 'scoring-card-cells';

    for (let i = 1; i <= 5; i++) {
      const cell = document.createElement('div');
      cell.className = 'scoring-card-cell';

      const num = document.createElement('span');
      num.className = 'scoring-card-num';
      num.textContent = String(i);

      const lbl = document.createElement('span');
      lbl.className = 'scoring-card-cell-label';
      lbl.textContent = SCORE_LABELS[i]!;

      cell.appendChild(num);
      cell.appendChild(lbl);
      cellsEl.appendChild(cell);
    }

    card.appendChild(cellsEl);

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

  /** Update the scoring card to highlight the captured current score. */
  highlightScore(current: number): void {
    if (!this.scoringCardEl) return;
    const cells = this.scoringCardEl.querySelectorAll('.scoring-card-cell');
    cells.forEach((cell, idx) => {
      cell.classList.toggle('active', idx + 1 === current);
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
