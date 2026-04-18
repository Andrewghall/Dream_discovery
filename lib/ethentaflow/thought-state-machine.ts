import type { CommitCandidate, LensPack, ThoughtAttempt, ThoughtState, ValidityResult } from './types';
import { extractFeatures } from './thought-feature-extractor';
import { scoreValidity, CLEAN_IMPERATIVE } from './thought-validity-engine';
import { scoreDomains, createDomainCluster, updateDomainCluster, type DomainCluster } from './domain-scoring-engine';

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
  // Optional — fires when the machine enters merge_wait (held for more speech).
  // Provides visibility into borderline decisions without requiring a commit.
  onHold?: (attempt: ThoughtAttempt, holdCycle: number) => void;
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
  // Per-speaker domain cluster — decays on each commit, boosts toward the committed domain.
  // Provides the cluster_continuity signal so a speaker discussing Technology for 5 minutes
  // gets Technology continuity credit on ambiguous utterances.
  private domainCluster: DomainCluster = createDomainCluster();
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

    this.evaluateCurrent();

    if (speechFinal) {
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

  getDomainCluster(): DomainCluster {
    return this.domainCluster;
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

    const validity = scoreValidity(features, this.continuityScore);
    this.current.validity = validity;

    // Domain scoring runs on every chunk — cheap, pure, <1ms.
    // Cluster continuity gives the speaker's conversational history weight.
    const domain = scoreDomains(features, this.lensPack, this.domainCluster);
    this.current.domain = domain;

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

    if (!attempt.features) {
      attempt.features = extractFeatures(attempt.full_text, this.lensPack);
    }
    if (!attempt.validity) {
      attempt.validity = scoreValidity(attempt.features, this.continuityScore);
    }
    if (!attempt.domain) {
      attempt.domain = scoreDomains(attempt.features, this.lensPack, this.domainCluster);
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
      if (validity.validity_score >= 0.38) {
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

      this.callbacks.onHold?.({ ...attempt }, this.holdCycles);

      this.mergeTimer = setTimeout(() => {
        if (!this.current || this.current.id !== attempt.id || this.destroyed) return;
        this.clearMergeTimer();
        this.attemptCommit(true);
      }, MERGE_WAIT_MS);
    }
  }

  private commit(attempt: ThoughtAttempt, mergeExpired: boolean): void {
    this.clearMergeTimer();

    // ─── Final pre-commit guard ───────────────────────────────────────────────
    // Re-extract features from current full_text — cached validity on the attempt
    // may have been evaluated against an earlier chunk version (before the text
    // that triggered the final silence/merge timer was appended). This guard is
    // the absolute last gate: no score, force-decide, silence expiry, or
    // continuity bonus can bypass it.
    const gf = extractFeatures(attempt.full_text, this.lensPack);
    const sigStrength = Math.max(
      gf.causal_signal_score, gf.action_signal_score, gf.constraint_signal_score,
      gf.problem_signal_score, gf.decision_signal_score, gf.target_state_signal_score,
    );

    let guardBlocked = false;
    let guardReason: string | null = null;

    if (gf.has_dangling_end) {
      guardBlocked = true;
      guardReason = 'FINAL_GUARD:DANGLING_END';
    } else if (!gf.has_predicate && !CLEAN_IMPERATIVE.test(attempt.full_text)) {
      guardBlocked = true;
      guardReason = 'FINAL_GUARD:NO_PREDICATE';
    } else if (gf.business_anchor_score < 0.15 && sigStrength === 0) {
      guardBlocked = true;
      guardReason = 'FINAL_GUARD:NO_ANCHOR_NO_SIGNAL';
    }

    console.log('[EthentaFlow:FinalGate]', JSON.stringify({
      text: attempt.full_text.substring(0, 80),
      has_dangling_end: gf.has_dangling_end,
      has_predicate: gf.has_predicate,
      business_anchor_score: +gf.business_anchor_score.toFixed(3),
      signal_strength: +sigStrength.toFixed(3),
      validity_score: attempt.validity?.validity_score != null ? +attempt.validity.validity_score.toFixed(3) : null,
      final_decision: guardBlocked ? 'BLOCKED' : 'COMMIT',
      blocked_by_final_guard: guardBlocked,
      reason: guardReason,
    }));

    if (guardBlocked) {
      attempt.state = 'discarded';
      this.continuityScore = Math.max(this.continuityScore - 0.05, 0);
      this.callbacks.onDiscard({ ...attempt });
      this.current = null;
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    attempt.state = 'committed';
    this.continuityScore = Math.min(this.continuityScore + 0.15, 1.0);

    // Update the domain cluster so future utterances from this speaker
    // inherit continuity toward the domain that just committed.
    this.domainCluster = updateDomainCluster(this.domainCluster, attempt.domain?.primary_domain ?? null);

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
