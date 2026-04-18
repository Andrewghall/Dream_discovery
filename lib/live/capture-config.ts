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
  thoughtCommitSilenceMs: 2500,
} as const;
