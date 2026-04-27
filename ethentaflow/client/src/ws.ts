// WebSocket client - sends audio binary, JSON control, receives JSON events and binary audio.

type ServerMessage =
  | { type: 'ready'; sessionId: string }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'state_update'; state: any }
  | { type: 'probe'; text: string; strategy: string }
  | { type: 'tts_start' }
  | { type: 'tts_end' }
  | { type: 'error'; message: string }
  | { type: 'measure_prompt'; lens: string; question: string }
  | { type: 'lens_rating'; lens: string; current: number; target: number; trajectory: string }
  | { type: 'lens_phase'; lens: string; phase: string }
  | { type: 'truth_node'; nodeId: string; lensId: string; statement: string; evidence: string; isSpecific: boolean; hasEvidence: boolean }
  | { type: 'session_paused' }
  | { type: 'session_resumed' }
  | { type: 'session_complete' }
  | {
      type: 'coverage_update';
      sections: Array<{
        lens: string;
        label: string;
        sectionIndex: number;
        isCurrent: boolean;
        pct: number;
        questionIndex: number;
        scale: boolean;
        gap: boolean;
        evidence: boolean;
        rootCause: boolean;
        impact: boolean;
      }>;
      currentSection: number;
      totalSections: number;
      totalPct: number;
      /** Epoch ms when Q1 was spoken for each section (0 = not started). 5-element array. */
      sectionStartTimes: number[];
    }
  | {
      type: 'interview_progress';
      sectionIndex: number;
      questionIndex: number;
      sectionName: string;
      progressLabel: string;
      /** Epoch ms when the current section started. */
      sectionStartedAt: number;
    };

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;

  onMessage: (msg: ServerMessage) => void = () => {};
  onAudio: (chunk: ArrayBuffer) => void = () => {};
  onClose: () => void = () => {};

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));
      this.ws.onclose = () => this.onClose();
      this.ws.onmessage = (ev: MessageEvent) => {
        if (typeof ev.data === 'string') {
          try {
            const msg = JSON.parse(ev.data) as ServerMessage;
            this.onMessage(msg);
          } catch (err) {
            console.error('Failed to parse server message', err);
          }
        } else if (ev.data instanceof ArrayBuffer) {
          this.onAudio(ev.data);
        }
      };
    });
  }

  sendAudio(chunk: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  sendStart(participantName?: string, participantTitle?: string, resumeSessionId?: string, lenses?: string[]): void {
    this.sendJson({ type: 'start', participantName, participantTitle, resumeSessionId, ...(lenses?.length ? { lenses } : {}) });
  }

  sendPlaybackDone(): void {
    this.sendJson({ type: 'playback_done' });
  }

  sendInterrupt(): void {
    this.sendJson({ type: 'interrupt' });
  }

  sendEnd(): void {
    this.sendJson({ type: 'end' });
  }

  close(): void {
    this.ws?.close();
  }

  private sendJson(obj: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }
}
