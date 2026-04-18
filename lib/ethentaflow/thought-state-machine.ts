import type { CommitCandidate, LensPack, ThoughtAttempt, ThoughtState, ValidityResult } from './types';
import { extractFeatures } from './thought-feature-extractor';
import { scoreValidity } from './thought-validity-engine';

// Timing constants
const SILENCE_WINDOW_MS = 4000;
const SPEECH_FINAL_WINDOW_MS = 800;
const MERGE_WAIT_MS = 12000;

// Max hold cycles before forcing a validity decision
const MAX_HOLD_CYCLES = 3;

let _attemptCounter = 0;
function nextAttemptId(): string {
  return `attempt_${Date.now()}_${++_attemptCounter}`;
}

export interface StateMachineCallbacks {
  onPendingUpdate: (attempt: ThoughtAttempt) => void;
  onCommitCandidate: (candidate: CommitCandidate) => void;
  onDiscard: (attempt: ThoughtAttempt) => void;
}

export class ThoughtStateMachine {
  private speakerId: string;
  private lensPack: LensPack;
  private callbacks: StateMachineCallbacks;

  private current: ThoughtAttempt | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private mergeTimer: ReturnType<typeof setTimeout> | null = null;
  private holdCycles = 0;
  private continuityScore = 0;
  private destroyed = false;

  constructor(speakerId: string, lensPack: LensPack, callbacks: StateMachineCallbacks) {
    this.speakerId = speakerId;
    this.lensPack = lensPack;
    this.callbacks = callbacks;
  }

  chunkArrived(text: string, speechFinal: boolean): void {
    if (this.destroyed) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    this.clearSilenceTimer();

    if (!this.current || this.current.state === 'committed' || this.current.state === 'discarded') {
      this.startNew(trimmed);
    } else {
      this.appendChunk(trimmed);
    }

    // Re-evaluate features on each chunk
    this.evaluateCurrent();

    if (speechFinal) {
      // Short window — terminal punctuation detected, speaker likely done
      this.silenceTimer = setTimeout(() => this.onSilence(true), SPEECH_FINAL_WINDOW_MS);
    } else {
      this.silenceTimer = setTimeout(() => this.onSilence(false), SILENCE_WINDOW_MS);
    }
  }

  forceFlush(): void {
    if (this.destroyed) return;
    this.clearSilenceTimer();
    this.clearMergeTimer();
    if (this.current && this.current.state !== 'committed' && this.current.state !== 'discarded') {
      this.attemptCommit(true);
    }
  }

  destroy(): void {
    this.clearSilenceTimer();
    this.clearMergeTimer();
    this.destroyed = true;
  }

  getState(): ThoughtState {
    return this.current?.state ?? 'idle';
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private startNew(text: string): void {
    this.holdCycles = 0;
    this.current = {
      id: nextAttemptId(),
      version: 1,
      speaker_id: this.speakerId,
      chunks: [text],
      full_text: text,
      merged_from: [],
      start_time_ms: Date.now(),
      last_chunk_time_ms: Date.now(),
      state: 'capturing',
      features: null,
      validity: null,
      domain: null,
      hold_started_ms: null,
      flagged_for_escalation: false,
    };
  }

  private appendChunk(text: string): void {
    if (!this.current) return;
    this.current.chunks.push(text);
    this.current.full_text = this.current.chunks.join(' ');
    this.current.last_chunk_time_ms = Date.now();
    this.current.version++;
    this.current.state = 'capturing';
  }

  private evaluateCurrent(): void {
    if (!this.current) return;

    const features = extractFeatures(this.current.full_text, this.lensPack);
    this.current.features = features;

    // Compute validity (domain scoring is Phase 2 — for now pass null domain)
    const validity = scoreValidity(features, this.continuityScore);
    this.current.validity = validity;

    // Notify UI with latest domain hint (even during capturing)
    this.callbacks.onPendingUpdate({ ...this.current });
  }

  private onSilence(wasSpeechFinal: boolean): void {
    if (!this.current || this.destroyed) return;
    this.silenceTimer = null;

    if (this.current.state === 'committed' || this.current.state === 'discarded') return;

    this.current.state = 'possible_pause';
    this.attemptCommit(wasSpeechFinal);
  }

  private attemptCommit(forceDecide: boolean): void {
    if (!this.current) return;

    const attempt = this.current;

    // Ensure features are current
    if (!attempt.features) {
      attempt.features = extractFeatures(attempt.full_text, this.lensPack);
    }
    if (!attempt.validity) {
      attempt.validity = scoreValidity(attempt.features, this.continuityScore);
    }

    const validity = attempt.validity as ValidityResult;

    if (validity.decision === 'commit') {
      this.commit(attempt, false);
      return;
    }

    if (validity.decision === 'discard') {
      this.discard(attempt);
      return;
    }

    // hold or escalate
    if (forceDecide || this.holdCycles >= MAX_HOLD_CYCLES) {
      // After max hold cycles, make a final call
      if (validity.validity_score >= 0.38) {
        // Close enough — commit with lower confidence
        this.commit(attempt, true);
      } else {
        this.discard(attempt);
      }
      return;
    }

    // Enter merge_wait — give speaker a chance to continue
    if (attempt.state !== 'merge_wait') {
      attempt.state = 'merge_wait';
      attempt.hold_started_ms = Date.now();
      this.holdCycles++;

      this.mergeTimer = setTimeout(() => {
        if (!this.current || this.current.id !== attempt.id || this.destroyed) return;
        this.clearMergeTimer();
        // No new speech arrived — force decide
        this.attemptCommit(true);
      }, MERGE_WAIT_MS);
    }
  }

  private commit(attempt: ThoughtAttempt, mergeExpired: boolean): void {
    this.clearMergeTimer();
    attempt.state = 'committed';
    this.continuityScore = Math.min(this.continuityScore + 0.15, 1.0);

    this.callbacks.onCommitCandidate({
      attempt: { ...attempt },
      merge_expired: mergeExpired,
      flagged_for_escalation: attempt.flagged_for_escalation,
    });

    this.current = null;
  }

  private discard(attempt: ThoughtAttempt): void {
    this.clearMergeTimer();
    attempt.state = 'discarded';
    this.continuityScore = Math.max(this.continuityScore - 0.05, 0);

    this.callbacks.onDiscard({ ...attempt });
    this.current = null;
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private clearMergeTimer(): void {
    if (this.mergeTimer !== null) {
      clearTimeout(this.mergeTimer);
      this.mergeTimer = null;
    }
  }
}
