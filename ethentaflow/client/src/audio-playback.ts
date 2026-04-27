// Audio playback for TTS audio streaming from server.
// Expects linear16 PCM at the configured sample rate.
// Supports immediate stop for barge-in.

export class AudioPlayback {
  private sampleRate: number;
  private ctx: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private playing = false;

  /** Called when the last queued audio chunk has finished playing naturally. */
  onEnded: (() => void) | null = null;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  async init(): Promise<void> {
    this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  push(chunk: ArrayBuffer): void {
    if (!this.ctx) return;

    // Browsers suspend the AudioContext when the page has been idle or lost focus.
    // Scheduling audio on a suspended context queues it but nothing plays until resumed.
    // Kick resume() here so the first chunk of every probe actually plays.
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(err => console.warn('[audio] resume failed:', err));
    }

    const int16 = new Int16Array(chunk);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 0x8000;
    }
    const buffer = this.ctx.createBuffer(1, float32.length, this.sampleRate);
    buffer.copyToChannel(float32, 0);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    // Guard against stale nextStartTime (gap between probes, context was reset, etc.)
    if (this.nextStartTime < now) this.nextStartTime = now;
    const startAt = this.nextStartTime;
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.activeSources.push(source);
    this.playing = true;

    source.onended = () => {
      this.activeSources = this.activeSources.filter(s => s !== source);
      if (this.activeSources.length === 0) {
        this.playing = false;
        this.onEnded?.();
      }
    };
  }

  stop(): void {
    const wasPlaying = this.playing;
    for (const source of this.activeSources) {
      try { source.stop(); } catch { /* ignore */ }
    }
    this.activeSources = [];
    this.nextStartTime = this.ctx?.currentTime ?? 0;
    this.playing = false;
    // Fire onEnded if we were playing — callers (barge-in, interrupt) depend on this
    // to reopen the mic gate. Without it, the gate stays closed for the rest of the session.
    if (wasPlaying) this.onEnded?.();
  }

  isPlaying(): boolean {
    return this.playing;
  }
}
