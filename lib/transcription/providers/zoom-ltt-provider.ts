'use client';

import type { NormalizedTranscriptChunk } from '../types';
import type { TranscriptionProvider, TranscriptChunkHandler } from './transcription-provider';

type ZoomCaptionMessagePayload = {
  displayName?: string;
  text?: string;
  language?: string;
};

type ZoomLttClient = {
  startLiveTranscription: () => unknown;
  disableCaptions: (disable: boolean) => unknown;
};

type ZoomVideoSdkClient = {
  getLiveTranscriptionClient: () => ZoomLttClient;
  on: (event: string, handler: (payload: unknown) => void) => void;
  off: (event: string, handler: (payload: unknown) => void) => void;
};

export class ZoomLttTranscriptionProvider implements TranscriptionProvider {
  private client: ZoomVideoSdkClient;
  private handlers: Set<TranscriptChunkHandler> = new Set();
  private t0: number = 0;
  private boundOnCaption: ((payload: unknown) => void) | null = null;
  private ltt: ZoomLttClient | null = null;

  constructor(client: ZoomVideoSdkClient) {
    this.client = client;
  }

  onChunk(handler: TranscriptChunkHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async start(): Promise<void> {
    this.t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.ltt = this.client.getLiveTranscriptionClient();
    await Promise.resolve(this.ltt.startLiveTranscription());

    const onCaption = (payload: unknown) => {
      const p = payload as ZoomCaptionMessagePayload;
      const text = (p?.text || '').trim();
      if (!text) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const t = Math.max(0, Math.round(now - this.t0));

      const chunk: NormalizedTranscriptChunk = {
        speakerId: p?.displayName || null,
        startTime: t,
        endTime: t,
        text,
        confidence: null,
        source: 'zoom',
      };

      for (const h of this.handlers) {
        try {
          h(chunk);
        } catch {
          // ignore handler errors
        }
      }
    };

    this.boundOnCaption = onCaption;
    this.client.on('caption-message', onCaption);
  }

  async stop(): Promise<void> {
    if (this.boundOnCaption) {
      this.client.off('caption-message', this.boundOnCaption);
      this.boundOnCaption = null;
    }

    if (this.ltt) {
      // Some SDK versions type this as disableCaptions(disable: boolean)
      await Promise.resolve(this.ltt.disableCaptions(true));
      this.ltt = null;
    }
  }
}
