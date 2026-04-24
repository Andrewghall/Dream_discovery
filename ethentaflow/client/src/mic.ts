// Mic capture at 16kHz linear PCM using AudioWorklet.
// Produces Int16 PCM chunks and delivers them to the callback.

export class MicCapture {
  private targetSampleRate: number;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private worklet: AudioWorkletNode | null = null;
  private level = 0;

  constructor(targetSampleRate: number) {
    this.targetSampleRate = targetSampleRate;
  }

  async start(onFrame: (pcm: ArrayBuffer) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Note: AudioContext sample rate is set by the browser (often 44100 or 48000).
    // We downsample in the worklet.
    this.ctx = new AudioContext({ sampleRate: this.targetSampleRate });
    // If the browser couldn't give us 16kHz directly, we'll still resample via the worklet.
    const workletCode = this.buildWorkletCode(this.ctx.sampleRate, this.targetSampleRate);
    const blobUrl = URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' }));
    await this.ctx.audioWorklet.addModule(blobUrl);
    URL.revokeObjectURL(blobUrl);

    const source = this.ctx.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.ctx, 'pcm-encoder');
    this.worklet.port.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { pcm: ArrayBuffer; level: number };
      this.level = data.level;
      onFrame(data.pcm);
    };
    source.connect(this.worklet);
    // Do not connect to destination - we don't want playback of own mic.
  }

  stop(): void {
    this.worklet?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    this.ctx?.close();
    this.worklet = null;
    this.stream = null;
    this.ctx = null;
  }

  currentLevel(): number {
    return this.level;
  }

  private buildWorkletCode(inputRate: number, targetRate: number): string {
    // If inputRate === targetRate, no resampling needed. Otherwise linear interpolation.
    return `
      class PcmEncoder extends AudioWorkletProcessor {
        constructor() {
          super();
          this.inputRate = ${inputRate};
          this.targetRate = ${targetRate};
          this.ratio = this.inputRate / this.targetRate;
          this.buffer = [];
        }
        process(inputs) {
          const input = inputs[0];
          if (!input || input.length === 0) return true;
          const channel = input[0];
          if (!channel) return true;

          // Compute RMS level for barge-in detection
          let sumSq = 0;
          for (let i = 0; i < channel.length; i++) sumSq += channel[i] * channel[i];
          const level = Math.sqrt(sumSq / channel.length);

          // Resample if needed
          let samples;
          if (this.ratio === 1) {
            samples = channel;
          } else {
            const outLen = Math.floor(channel.length / this.ratio);
            samples = new Float32Array(outLen);
            for (let i = 0; i < outLen; i++) {
              const srcIdx = i * this.ratio;
              const lo = Math.floor(srcIdx);
              const hi = Math.min(lo + 1, channel.length - 1);
              const frac = srcIdx - lo;
              samples[i] = channel[lo] * (1 - frac) + channel[hi] * frac;
            }
          }

          // Convert Float32 [-1,1] to Int16
          const pcm = new Int16Array(samples.length);
          for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          this.port.postMessage({ pcm: pcm.buffer, level }, [pcm.buffer]);
          return true;
        }
      }
      registerProcessor('pcm-encoder', PcmEncoder);
    `;
  }
}
