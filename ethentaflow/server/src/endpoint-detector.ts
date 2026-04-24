// Endpoint detector - dual-gate with prosodic/syntactic heuristic.
// See docs/03-endpoint-detection.md for the full specification.

import { EventEmitter } from 'node:events';
import type { DeepgramTranscript, DeepgramUtteranceEnd, DeepgramWord } from './types.js';

export interface EndpointConfig {
  gateA_minimumSilenceMs: number;
  gateB_utteranceEndMs: number;     // for reference, Deepgram-side
  gateC_evaluationIntervalMs: number;
  thinkingPauseGraceMs: number;
}

export const DEFAULT_ENDPOINT_CONFIG: EndpointConfig = {
  gateA_minimumSilenceMs: 400,
  gateB_utteranceEndMs: 1000,
  gateC_evaluationIntervalMs: 50,
  thinkingPauseGraceMs: 1200,
};

type DetectorState = 'LISTENING' | 'ACTIVE_SPEECH' | 'PENDING_END' | 'SYSTEM_SPEAKING';

export interface EndpointEventMap {
  endpoint_detected: [{ finalUtterance: string; detectedAt: number; reason: 'gateB' | 'gateC' | 'grace_timeout' }];
  speech_started: [{ timestamp: number }];
  state_changed: [{ from: DetectorState; to: DetectorState }];
}

const SHORT_COMPLETE = /^(yes|no|yeah|nope|okay|ok|sure|maybe|sometimes|exactly|right|correct|wrong|absolutely|never|always)\.?\??$/i;

const CONTINUATION_WORDS = new Set([
  'and', 'but', 'so', 'because', 'or', 'then', 'also', 'plus',
  'which', 'that', 'who', 'when', 'where', 'if', 'though',
  'although', 'however', 'therefore', 'moreover'
]);

export class EndpointDetector extends EventEmitter {
  private detectorState: DetectorState = 'LISTENING';
  private config: EndpointConfig;

  private accumulatedFinals = '';      // finalised Deepgram segments in current turn
  private currentInterim = '';          // latest interim
  private recentWords: DeepgramWord[] = [];  // rolling window for word-rate analysis
  private lastWordEndAt = 0;            // epoch ms of last word
  private lastAudioActivityAt = 0;      // epoch ms of last non-silence signal

  private pendingEndAt: number | null = null;  // when we entered PENDING_END
  private graceTimer: NodeJS.Timeout | null = null;

  constructor(config: EndpointConfig = DEFAULT_ENDPOINT_CONFIG) {
    super();
    this.config = config;
  }

  getState(): DetectorState {
    return this.detectorState;
  }

  /** Call when TTS begins playing to the user. */
  onSystemSpeakingStart(): void {
    this.transitionTo('SYSTEM_SPEAKING');
  }

  /** Call when TTS finishes (or is cancelled). */
  onSystemSpeakingEnd(): void {
    this.resetTurn();
    this.transitionTo('LISTENING');
  }

  /** Feed Deepgram transcript events (both interim and final). */
  onTranscript(msg: DeepgramTranscript): void {
    if (this.detectorState === 'SYSTEM_SPEAKING') {
      // Ignore user transcripts during system speech; barge-in handled elsewhere via SpeechStarted.
      return;
    }

    const alt = msg.channel.alternatives[0];
    if (!alt || !alt.transcript) return;

    if (msg.is_final) {
      this.accumulatedFinals = (this.accumulatedFinals + ' ' + alt.transcript).trim();
      this.currentInterim = '';
      for (const w of alt.words || []) {
        this.recentWords.push(w);
      }
      // Keep only most recent 20 words in rolling window
      if (this.recentWords.length > 20) {
        this.recentWords = this.recentWords.slice(-20);
      }
      if (alt.words && alt.words.length > 0) {
        const lastWord = alt.words[alt.words.length - 1];
        // Deepgram timestamps are seconds-from-stream-start. We approximate epoch:
        this.lastWordEndAt = Date.now();
      }
    } else {
      this.currentInterim = alt.transcript;
    }

    this.lastAudioActivityAt = Date.now();

    if (this.detectorState === 'LISTENING') {
      this.transitionTo('ACTIVE_SPEECH');
    }

    // If we were in PENDING_END and user resumed, bounce back to ACTIVE_SPEECH.
    if (this.detectorState === 'PENDING_END') {
      this.cancelGraceTimer();
      this.pendingEndAt = null;
      this.transitionTo('ACTIVE_SPEECH');
    }

    this.evaluateGates();
  }

  /** Feed Deepgram UtteranceEnd events. */
  onUtteranceEnd(msg: DeepgramUtteranceEnd): void {
    if (this.detectorState === 'SYSTEM_SPEAKING' || this.detectorState === 'LISTENING') return;

    const silenceMs = Date.now() - this.lastWordEndAt;
    if (silenceMs < this.config.gateA_minimumSilenceMs) {
      // Shouldn't happen if Deepgram utterance_end_ms >= gateA, but be safe
      return;
    }

    this.fireEndpoint('gateB');
  }

  /** Feed Deepgram SpeechStarted events (for barge-in and activity tracking). */
  onSpeechStarted(_msg: { timestamp: number }): void {
    this.lastAudioActivityAt = Date.now();
    this.emit('speech_started', { timestamp: Date.now() });

    if (this.detectorState === 'PENDING_END') {
      this.cancelGraceTimer();
      this.pendingEndAt = null;
      this.transitionTo('ACTIVE_SPEECH');
    }
  }

  /** Periodic tick - call every ~50ms from the owning component. */
  tick(): void {
    if (this.detectorState !== 'ACTIVE_SPEECH' && this.detectorState !== 'PENDING_END') return;

    const now = Date.now();
    const silenceMs = now - this.lastWordEndAt;

    // Gate A check - do we have enough silence to consider ending?
    if (silenceMs < this.config.gateA_minimumSilenceMs) return;

    if (this.detectorState === 'ACTIVE_SPEECH') {
      this.transitionTo('PENDING_END');
      this.pendingEndAt = now;

      // Evaluate Gate C immediately
      if (this.evaluateGateC()) {
        this.fireEndpoint('gateC');
        return;
      }

      // Set grace timer - if Gate B doesn't fire within grace window, fire anyway
      this.scheduleGraceTimeout();
    }
  }

  private evaluateGates(): void {
    // Called on every transcript event. Gate evaluation happens in tick() and onUtteranceEnd().
    // Nothing to do here unless we want immediate Gate C check on final:
    if (this.detectorState === 'PENDING_END') {
      if (this.evaluateGateC()) {
        this.fireEndpoint('gateC');
      }
    }
  }

  /** Gate C: prosodic + syntactic completeness check. Pure function of state. */
  private evaluateGateC(): boolean {
    const text = (this.accumulatedFinals + ' ' + this.currentInterim).trim();
    if (!text) return false;

    // Short complete responses
    if (SHORT_COMPLETE.test(text)) return true;

    // Must end with sentence-final punctuation (Deepgram smart_format provides this)
    if (!/[.?!]$/.test(text)) return false;

    const words = text.split(/\s+/);
    if (words.length < 3) return false;

    // Last word must not be a continuation marker
    const lastWord = words[words.length - 1].replace(/[.?!,;:]+$/, '').toLowerCase();
    if (CONTINUATION_WORDS.has(lastWord)) return false;

    // Word-rate analysis
    if (this.recentWords.length >= 5) {
      const last5 = this.recentWords.slice(-5);
      const gaps: number[] = [];
      for (let i = 1; i < last5.length; i++) {
        gaps.push(last5[i].start - last5[i - 1].end);
      }
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const lastGap = gaps[gaps.length - 1];

      // User accelerating - probably not ending
      if (avgGap < 0.2) return false;

      // User slowing down - strong end signal
      if (avgGap > 0.3 && lastGap > 0.5) return true;
    }

    return true;
  }

  private fireEndpoint(reason: 'gateB' | 'gateC' | 'grace_timeout'): void {
    const finalText = (this.accumulatedFinals + ' ' + this.currentInterim).trim();
    if (!finalText) {
      // Nothing to commit, reset to listening
      this.resetTurn();
      this.transitionTo('LISTENING');
      return;
    }

    this.cancelGraceTimer();
    this.emit('endpoint_detected', {
      finalUtterance: finalText,
      detectedAt: Date.now(),
      reason,
    });
    this.resetTurn();
    // Owner of detector transitions to SYSTEM_SPEAKING when TTS starts.
  }

  private scheduleGraceTimeout(): void {
    this.cancelGraceTimer();
    this.graceTimer = setTimeout(() => {
      if (this.detectorState === 'PENDING_END') {
        this.fireEndpoint('grace_timeout');
      }
    }, this.config.thinkingPauseGraceMs);
  }

  private cancelGraceTimer(): void {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }

  private resetTurn(): void {
    this.accumulatedFinals = '';
    this.currentInterim = '';
    this.recentWords = [];
    this.pendingEndAt = null;
    this.cancelGraceTimer();
  }

  private transitionTo(next: DetectorState): void {
    if (this.detectorState === next) return;
    const from = this.detectorState;
    this.detectorState = next;
    this.emit('state_changed', { from, to: next });
  }
}
