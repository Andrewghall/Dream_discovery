/**
 * EthentaFlow live capture configuration.
 *
 * silenceCommitThresholdMs: how long (ms) of silence after the last isFinal=true
 * chunk before an in-progress utterance is committed to the hemisphere.
 * This acts as the primary commit gate alongside speechFinal=true from CaptureAPI.
 * Not exposed in the live UI — tune here.
 */
export const LIVE_CAPTURE_CONFIG = {
  silenceCommitThresholdMs: 1500,
} as const;
