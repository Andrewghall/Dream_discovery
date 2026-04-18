/**
 * EthentaFlow live capture configuration.
 *
 * thoughtCommitSilenceMs: duration of silence (ms) after the last speech fragment
 * before a thought is considered resolved and committed to the hemisphere.
 *
 * This must be long enough to distinguish a breath/clause pause from a genuine
 * end-of-thought. Typical values: 2000–3000ms.
 * speechFinal from CaptureAPI does NOT trigger immediate commit — it only
 * confirms a pause occurred. The silence window still runs to completion so
 * that continuation of the same thought resets the timer naturally.
 *
 * Not exposed in the live UI — tune here only.
 */
export const LIVE_CAPTURE_CONFIG = {
  // How long silence must persist after the last isFinal chunk before a thought
  // is committed. Long enough to allow natural mid-thought pauses and inhales.
  thoughtCommitSilenceMs: 4000,

  // When Deepgram sends speechFinal AND the accumulated text ends with terminal
  // punctuation (thought is semantically resolved), the remaining silence window
  // is trimmed to this value. This lets clearly-finished thoughts commit quickly
  // without waiting the full 4 seconds.
  speechFinalResolvedMs: 800,
} as const;
