import type { NormalizedTranscriptChunk } from '../types';

export type TranscriptChunkHandler = (chunk: NormalizedTranscriptChunk) => void;

export interface TranscriptionProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  onChunk(handler: TranscriptChunkHandler): () => void;
}
