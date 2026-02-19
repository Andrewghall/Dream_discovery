/**
 * Pipeline Sniffer — Diagnostic Types
 *
 * Tracks timing of each utterance through the transcription pipeline:
 * Mic → Queue → CaptureAPI → Server → DB → SSE → Render
 */

export interface DiagnosticTrace {
  traceId: string;
  textPreview: string; // First 40 chars of transcribed text

  // Browser timestamps (Date.now())
  t_audioCaptured: number;
  t_captureApiSent: number;
  t_captureApiReceived: number;
  t_serverPostSent: number;
  t_sseReceived: number;
  t_uiRendered: number;

  // Server timestamps (Date.now()) — delivered via SSE _serverTimings
  t_serverReceived: number;
  t_dbWriteComplete: number;
  t_sseEmitted: number;

  // CaptureAPI's self-reported processing time
  captureApiReportedMs: number;

  // Computed segments (ms)
  queueWaitMs: number;       // t_captureApiSent - t_audioCaptured
  captureApiMs: number;       // t_captureApiReceived - t_captureApiSent
  serverProcessingMs: number; // t_sseEmitted - t_serverReceived (server clock, skew-free)
  dbWriteMs: number;          // t_dbWriteComplete - t_serverReceived (server clock, skew-free)
  totalE2eMs: number;         // t_uiRendered - t_audioCaptured (browser clock, skew-free)
}

export interface DiagnosticStats {
  count: number;
  avgE2eMs: number;
  p95E2eMs: number;
  minE2eMs: number;
  maxE2eMs: number;
  avgCaptureApiMs: number;
  avgServerProcessingMs: number;
  avgDbWriteMs: number;
  avgQueueWaitMs: number;
}

/** Server-side timing data included in SSE transcript.new events */
export interface ServerTimings {
  traceId: string;
  t_serverReceived: number;
  t_dbWriteComplete: number;
  t_sseEmitted: number;
}
