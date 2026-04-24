// Minimal UI for EthentaFlow. Transcript pane + debug panel.

export class UI {
  private transcriptEl: HTMLElement;
  private debugEl: HTMLElement;
  private statusEl: HTMLElement;
  private statusDotEl: HTMLElement;
  private partialEl: HTMLElement | null = null;

  constructor() {
    this.transcriptEl = document.getElementById('transcript')!;
    this.debugEl = document.getElementById('debug')!;
    this.statusEl = document.getElementById('status')!;
    this.statusDotEl = document.getElementById('statusDot')!;
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
