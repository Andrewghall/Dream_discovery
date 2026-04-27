// Endpoint detector — utterance-first turn detection.
//
// The detector is ONLY responsible for:
//   - Tracking speech state (LISTENING / ACTIVE_SPEECH / PENDING_END / SYSTEM_SPEAKING)
//   - Detecting when the user has paused (silence timers + Deepgram utterance_end)
//   - Emitting pause candidates to the DecisionController via a callback
//
// ALL commit/wait/discard logic lives in DecisionController. The detector
// just fires a callback and waits to be told what to do via:
//   - commit()      → emit endpoint_detected
//   - cancelPause() → return to ACTIVE_SPEECH (controller said WAIT)
//   - discard()     → reset all state, return to LISTENING (noise)
//
// Mode summary:
//   long_thought — Deepgram utterance_end is the primary trigger
//                  2500ms silence fallback if utterance_end doesn't arrive
//                  longThoughtGraceMs backstop (absolute maximum)
//   fast/normal  — minimumSilenceMs silence → trigger callback
//                  graceFallbackMs backstop
//
// After controller returns 'wait', a recheckMs timer fires the callback again
// in case the user genuinely stopped but the controller was too cautious.

import { EventEmitter } from 'node:events';
import type { DeepgramTranscript, DeepgramUtteranceEnd, DeepgramWord, EndpointingMode } from './types.js';

export interface EndpointConfig {
  minimumSilenceMs: number;         // fast/normal: min silence before considering end
  graceFallbackMs: number;          // fast/normal: absolute max silence before force-firing
  longThoughtGraceMs: number;       // long_thought: backstop (utterance_end is primary trigger)
  longThoughtRecheckMs: number;     // long_thought: after callback WAIT, wait this long then fire again
  longThoughtMinSilenceMs: number;  // long_thought: min silence required even on utterance_end — prevents mid-breath interruptions
}

export const DEFAULT_ENDPOINT_CONFIG: EndpointConfig = {
  minimumSilenceMs: 400,
  graceFallbackMs: 4000,
  longThoughtGraceMs: 5000,
  longThoughtRecheckMs: 1400,     // was 2500 — recheck sooner after a 'wait' response
  longThoughtMinSilenceMs: 500,   // was 1000 — commit after 500ms true silence (was causing 2.5s gap)
};

type DetectorState = 'LISTENING' | 'ACTIVE_SPEECH' | 'PENDING_END' | 'SYSTEM_SPEAKING';

export interface EndpointEventMap {
  endpoint_detected: [{ finalUtterance: string; detectedAt: number; reason: 'semantic' | 'fast_lane' | 'grace_timeout' | 'utterance_end' }];
  speech_started: [{ timestamp: number }];
  state_changed: [{ from: DetectorState; to: DetectorState }];
}

/** Callback type: controller evaluates transcript and decides commit/wait/discard */
export type PauseCallback = (transcript: string, source: string) => Promise<'commit' | 'wait' | 'discard'>;

export class EndpointDetector extends EventEmitter {
  private detectorState: DetectorState = 'LISTENING';
  private config: EndpointConfig;
  private endpointingMode: EndpointingMode = 'long_thought';

  /** Callback injected by owner — called when pause is detected */
  private pauseCallback: PauseCallback | null = null;

  private accumulatedFinals = '';
  private currentInterim = '';
  private recentWords: DeepgramWord[] = [];
  private lastWordEndAt = 0;

  private graceTimer: NodeJS.Timeout | null = null;
  private recheckTimer: NodeJS.Timeout | null = null;
  private callbackInFlight = false;
  private lastCallbackText = '';  // avoid re-triggering on identical text

  constructor(config: EndpointConfig = DEFAULT_ENDPOINT_CONFIG) {
    super();
    this.config = config;
  }

  /**
   * Inject the pause callback. When the detector determines the user has paused,
   * it calls cb(transcript, source) and then:
   *   'commit'  → emit endpoint_detected
   *   'wait'    → arm recheck timer; if user doesn't resume, fire callback again
   *   'discard' → reset all state, return to LISTENING
   */
  setPauseCallback(cb: PauseCallback): void {
    this.pauseCallback = cb;
  }

  setEndpointingMode(mode: EndpointingMode): void {
    this.endpointingMode = mode;
  }

  getEndpointingMode(): EndpointingMode { return this.endpointingMode; }
  getState(): DetectorState { return this.detectorState; }

  onSystemSpeakingStart(): void {
    this.cancelGraceTimer();
    this.cancelRecheckTimer();
    this.callbackInFlight = false;
    this.transitionTo('SYSTEM_SPEAKING');
  }

  onSystemSpeakingEnd(): void {
    this.resetTurn();
    this.transitionTo('LISTENING');
  }

  onTranscript(msg: DeepgramTranscript): void {
    if (this.detectorState === 'SYSTEM_SPEAKING') return;

    const alt = msg.channel.alternatives[0];
    if (!alt || !alt.transcript) return;

    if (msg.is_final) {
      this.accumulatedFinals = (this.accumulatedFinals + ' ' + alt.transcript).trim();
      this.currentInterim = '';
      for (const w of alt.words ?? []) this.recentWords.push(w);
      if (this.recentWords.length > 20) this.recentWords = this.recentWords.slice(-20);
      if ((alt.words?.length ?? 0) > 0) this.lastWordEndAt = Date.now();
    } else {
      this.currentInterim = alt.transcript;
    }

    if (this.detectorState === 'LISTENING') this.transitionTo('ACTIVE_SPEECH');

    // If user resumes speaking while we were in PENDING_END, cancel all timers and go back to active
    if (this.detectorState === 'PENDING_END') {
      this.cancelGraceTimer();
      this.cancelRecheckTimer();
      this.callbackInFlight = false;
      this.lastCallbackText = '';
      this.transitionTo('ACTIVE_SPEECH');
    }

    // In long_thought mode: as soon as we have speech, start the grace timer.
    // This is the only timer running — it's a backstop, not a trigger.
    if (this.endpointingMode === 'long_thought' && this.detectorState === 'ACTIVE_SPEECH') {
      this.ensureLongThoughtGrace();
    }
  }

  onUtteranceEnd(_msg: DeepgramUtteranceEnd): void {
    if (this.detectorState === 'SYSTEM_SPEAKING' || this.detectorState === 'LISTENING') return;

    const silenceMs = Date.now() - this.lastWordEndAt;

    // long_thought: utterance_end is the primary trigger, but requires minimum silence.
    // Deepgram fires utterance_end on mid-breath pauses; without a silence gate we cut
    // in while the user is still mid-sentence.
    if (this.endpointingMode === 'long_thought') {
      if (silenceMs < this.config.longThoughtMinSilenceMs) {
        console.log(`[endpoint] utterance_end ignored (long_thought, silence only ${silenceMs}ms < ${this.config.longThoughtMinSilenceMs}ms)`);
        return;
      }
      console.log(`[endpoint] utterance_end (long_thought, silence=${silenceMs}ms) — triggering pause evaluation`);
      this.transitionTo('PENDING_END');
      this.triggerPauseEvaluation('utterance_end');
      return;
    }

    // fast/normal: utterance_end as supporting signal — only if silence threshold met
    if (silenceMs < this.config.minimumSilenceMs) return;
    this.triggerPauseEvaluation('utterance_end');
  }

  onSpeechStarted(_msg: { timestamp: number }): void {
    this.emit('speech_started', { timestamp: Date.now() });
    if (this.detectorState === 'PENDING_END') {
      this.cancelGraceTimer();
      this.cancelRecheckTimer();
      this.callbackInFlight = false;
      this.lastCallbackText = '';
      this.transitionTo('ACTIVE_SPEECH');
    }
  }

  /**
   * Call every ~50ms.
   * long_thought: 2500ms silence fallback (utterance_end is primary).
   * fast/normal: silence timer drives PENDING_END transition.
   */
  tick(): void {
    if (this.detectorState !== 'ACTIVE_SPEECH' && this.detectorState !== 'PENDING_END') return;

    const silenceMs = Date.now() - this.lastWordEndAt;
    if (!this.lastWordEndAt) return;

    if (this.endpointingMode === 'long_thought') {
      if (this.detectorState === 'ACTIVE_SPEECH' && silenceMs >= 2200) {
        console.log(`[endpoint] long_thought silence fallback (${silenceMs}ms, no utterance_end)`);
        this.transitionTo('PENDING_END');
        this.triggerPauseEvaluation('tick_fallback');
      }
      return;
    }

    if (silenceMs < this.config.minimumSilenceMs) return;

    if (this.detectorState === 'ACTIVE_SPEECH') {
      this.transitionTo('PENDING_END');
      this.triggerPauseEvaluation('tick');
      return;
    }
    // Already PENDING_END — grace timer handles timeout.
  }

  /**
   * Called by the DecisionController when it decides the transcript is a complete
   * turn. Emits `endpoint_detected` with the accumulated text.
   */
  commit(): void {
    this.fireEndpoint('semantic');
  }

  /**
   * Called by the DecisionController when it wants to wait for more speech
   * (semantic said NO / continuation detected). Arms the recheck timer so we
   * don't wait forever if the user genuinely stopped.
   */
  cancelPause(): void {
    if (this.detectorState !== 'PENDING_END') return;
    this.lastCallbackText = '';  // allow re-check when user resumes and pauses again
    if (this.endpointingMode === 'long_thought') {
      console.log(`[endpoint] WAIT → arming recheck (${this.config.longThoughtRecheckMs}ms)`);
      this.cancelRecheckTimer();
      this.recheckTimer = setTimeout(() => {
        this.recheckTimer = null;
        if (this.detectorState === 'PENDING_END') {
          console.log(`[endpoint] recheck timeout → firing (controller was too cautious)`);
          this.fireEndpoint('grace_timeout');
        }
      }, this.config.longThoughtRecheckMs);
    }
    // For fast/normal, the grace timer already running will handle the timeout.
  }

  /**
   * Called by the DecisionController when the transcript is noise.
   * Resets all state, returns to LISTENING.
   */
  discard(): void {
    console.log(`[endpoint] DISCARD — resetting to LISTENING`);
    this.cancelGraceTimer();
    this.cancelRecheckTimer();
    this.accumulatedFinals = '';
    this.currentInterim = '';
    this.lastCallbackText = '';
    this.callbackInFlight = false;
    this.transitionTo('LISTENING');
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private triggerPauseEvaluation(source: string): void {
    const text = (this.accumulatedFinals + ' ' + this.currentInterim).trim();
    if (!text) return;

    // Guard: don't fire if callback is already in-flight for the same text
    if (this.callbackInFlight || text === this.lastCallbackText) {
      this.ensureGraceFallback();
      return;
    }

    if (!this.pauseCallback) {
      // No callback injected — fall back to grace timer
      this.ensureGraceFallback();
      return;
    }

    this.callbackInFlight = true;
    this.lastCallbackText = text;
    this.ensureGraceFallback();

    console.log(`[endpoint] pause evaluation (${source}): "${text.slice(0, 80)}"`);

    // Fire and track — do NOT await (detector must not block)
    this.pauseCallback(text, source)
      .then(decision => {
        this.callbackInFlight = false;
        if (this.detectorState !== 'PENDING_END') return;

        if (decision === 'commit') {
          this.commit();
        } else if (decision === 'discard') {
          this.discard();
        } else {
          // 'wait'
          this.cancelPause();
        }
      })
      .catch(err => {
        this.callbackInFlight = false;
        console.error('[endpoint] pause callback error — relying on grace timer', err);
      });
  }

  /** Grace fallback for fast/normal modes. */
  private ensureGraceFallback(): void {
    if (this.graceTimer) return;
    this.graceTimer = setTimeout(() => {
      if (this.detectorState === 'PENDING_END') {
        const text = (this.accumulatedFinals + ' ' + this.currentInterim).trim();
        if (text) {
          console.log(`[endpoint] grace timeout → committing`);
          this.fireEndpoint('grace_timeout');
        } else {
          this.resetTurn();
          this.transitionTo('LISTENING');
        }
      }
    }, this.config.graceFallbackMs);
  }

  /**
   * Long_thought backstop: starts when speech begins.
   * If longThoughtGraceMs pass with no commit (e.g. Deepgram VAD issue), force-commit.
   */
  private ensureLongThoughtGrace(): void {
    this.cancelGraceTimer();
    this.graceTimer = setTimeout(() => {
      if (
        this.detectorState === 'ACTIVE_SPEECH' ||
        this.detectorState === 'PENDING_END'
      ) {
        const text = (this.accumulatedFinals + ' ' + this.currentInterim).trim();
        if (text) {
          console.log(`[endpoint] long_thought grace timeout → committing`);
          this.fireEndpoint('grace_timeout');
        } else {
          this.resetTurn();
          this.transitionTo('LISTENING');
        }
      }
    }, this.config.longThoughtGraceMs);
  }

  private fireEndpoint(reason: 'semantic' | 'fast_lane' | 'grace_timeout' | 'utterance_end'): void {
    const finalText = (this.accumulatedFinals + ' ' + this.currentInterim).trim();
    if (!finalText) {
      this.resetTurn();
      this.transitionTo('LISTENING');
      return;
    }
    this.cancelGraceTimer();
    this.cancelRecheckTimer();
    this.callbackInFlight = false;
    this.emit('endpoint_detected', { finalUtterance: finalText, detectedAt: Date.now(), reason });
    this.resetTurn();
  }

  private cancelGraceTimer(): void {
    if (this.graceTimer) { clearTimeout(this.graceTimer); this.graceTimer = null; }
  }

  private cancelRecheckTimer(): void {
    if (this.recheckTimer) { clearTimeout(this.recheckTimer); this.recheckTimer = null; }
  }

  private resetTurn(): void {
    this.accumulatedFinals = '';
    this.currentInterim = '';
    this.recentWords = [];
    this.lastWordEndAt = 0;
    this.lastCallbackText = '';
    this.callbackInFlight = false;
    this.cancelGraceTimer();
    this.cancelRecheckTimer();
  }

  private transitionTo(next: DetectorState): void {
    if (this.detectorState === next) return;
    const from = this.detectorState;
    this.detectorState = next;
    this.emit('state_changed', { from, to: next });
  }
}
