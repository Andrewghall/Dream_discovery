// WebSocket client - sends audio binary, JSON control, receives JSON events and binary audio.

type ServerMessage =
  | { type: 'ready'; sessionId: string }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'state_update'; state: any }
  | { type: 'probe'; text: string; strategy: string }
  | { type: 'tts_start' }
  | { type: 'tts_end' }
  | { type: 'error'; message: string };

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

  sendStart(participantName?: string): void {
    this.sendJson({ type: 'start', participantName });
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
