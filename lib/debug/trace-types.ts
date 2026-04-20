export type TraceOutcome =
  | 'rendered'
  | 'blocked_at_commit'
  | 'rejected_in_extraction'
  | 'persisted_not_emitted'
  | 'emitted_not_rendered'
  | 'in_flight';

export type TraceStageStatus = 'pass' | 'blocked' | 'partial' | 'unknown';

export interface TraceRawChunk {
  id: string;
  sequence: number;
  speakerId: string | null;
  text: string;
  startTimeMs: string;
  endTimeMs: string;
  speechFinal: boolean;
  confidence: number | null;
}

export interface TraceDataPointUnit {
  id: string;
  rawText: string;
  sequenceIndex: number | null;
  reasoningRole: string | null;
  sourceWindowId: string | null;
  createdAt: string;
  primaryType: string | null;
  primaryDomain: string | null;
  confidence: number | null;
}

export interface TraceEmitEvent {
  id: string;
  type: string;
  dataPointId: string;
  createdAt: string;
}

export interface TraceTiming {
  firstChunkTs: string | null;
  lastChunkTs: string | null;
  windowOpenTs: string;
  windowCloseTs: string | null;
  dataPointCreateTs: string | null;
  eventEmitTs: string | null;
  firstChunkToCommitMs: number | null;
  lastChunkToCommitMs: number | null;
  commitToDataPointMs: number | null;
  dataPointToEmitMs: number | null;
  totalEndToEndMs: number | null;
}

export interface TraceEntry {
  windowId: string;
  speakerId: string | null;
  windowState: string;
  rawChunks: TraceRawChunk[];
  windowOpenTs: string;
  windowCloseTs: string | null;
  windowFullText: string;
  windowResolvedText: string | null;
  windowChunkCount: number;
  commitPass: boolean;
  commitBlockReason: string | null;
  commitWordCount: number;
  commitTrigger: string;
  committedText: string | null;
  commitTs: string | null;
  extractionInputText: string | null;
  extractionUnitsProduced: number;
  extractionUnits: TraceDataPointUnit[];
  extractionNote: string | null;
  dataPoints: TraceDataPointUnit[];
  persistenceSkipped: boolean;
  persistenceSkippedReason: string | null;
  emitEvents: TraceEmitEvent[];
  emitted: boolean;
  hemisphereNodeIds: string[];
  hemisphereRendered: boolean;
  hemisphereNote: string | null;
  timing: TraceTiming;
  summary: string;
  outcome: TraceOutcome;
}

export interface TraceResponse {
  workshopName: string;
  traces: TraceEntry[];
  totalTraces: number;
  totalRendered: number;
  totalBlocked: number;
  totalRejected: number;
  totalInFlight: number;
  sessionStartMs: string | null;
}
