import type { CommitCandidate, LensPack, ThoughtAttempt, ThoughtState, ValidityResult } from './types';
import { extractFeatures } from './thought-feature-extractor';
import { scoreValidity } from './thought-validity-engine';
import { runCommitGuard, logGuardResult } from './thought-guard';
import { scoreDomains, createDomainCluster, updateDomainCluster, type DomainCluster } from './domain-scoring-engine';

// Timing constants
const SILENCE_WINDOW_MS = 4000;
const SPEECH_FINAL_WINDOW_MS = 800;
const MERGE_WAIT_MS = 12000;
const CONTINUATION_WINDOW_MS = 2500;

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
  private continuationTimer: ReturnType<typeof setTimeout> | null = null;
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

  static isContinuationChunk(text: string): boolean {
    const t = text.trim().toLowerCase();
    return /^(and|but|so|because|which|that|then|also|however|although|or|if|when|where|while|since|as|though|yet|nor|either|neither|plus|even|still|besides|furthermore|moreover|additionally|therefore|thus|hence|consequently|meanwhile|afterwards|later|next|finally|eventually|after|before|once|until|unless|whereas)\b/.test(t) ||
      /^(it|this|that|those|these|he|she|they|we)\s+(is|are|was|were|will|would|could|should|has|have|had|does|do|did|means|meant|shows|showed|leads|led)\b/.test(t) ||
      /^(the (result|reason|issue|problem|point|question|goal|idea|plan|challenge|risk|solution|answer|outcome|impact|effect|cause|driver|factor))\b/.test(t);
  }

  chunkArrived(text: string, speechFinal: boolean): void {
    if (this.destroyed) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    this.clearSilenceTimer();

    if (this.current?.state === 'resolved_candidate' && ThoughtStateMachine.isContinuationChunk(trimmed)) {
      // Speaker continued — re-open the emerging thought and keep accumulating
      this.clearContinuationTimer();
      this.appendChunk(trimmed);
      this.current.state = 'capturing';
      this.evaluateCurrent();
    } else if (!this.current || this.current.state === 'committed' || this.current.state === 'discarded') {
      this.startNew(trimmed);
      this.evaluateCurrent();
    } else if (this.current.state === 'resolved_candidate') {
      // New speech that isn't a continuation — commit the resolved thought first, then start fresh
      this.clearContinuationTimer();
      this.commit(this.current, false);
      this.startNew(trimmed);
      this.evaluateCurrent();
    } else {
      this.appendChunk(trimmed);
      this.evaluateCurrent();
    }

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
    this.clearContinuationTimer();
    if (this.current && this.current.state !== 'committed' && this.current.state !== 'discarded') {
      if (this.current.state === 'resolved_candidate') {
        this.commit(this.current, false);
      } else {
        this.attemptCommit(true);
      }
    }
  }

  destroy(): void {
    this.clearSilenceTimer();
    this.clearMergeTimer();
    this.clearContinuationTimer();
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
    if (this.current.state === 'resolved_candidate') return; // continuation timer handles this

    this.current.state = 'possible_pause';
    this.attemptCommit(wasSpeechFinal);
  }

  private attemptCommit(forceDecide: boolean, fromMergeTimer = false): void {
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

    // Route via thought_completeness for the thought integrity layer
    if (validity.thought_completeness === 'complete') {
      this.enterResolvedCandidate(attempt, forceDecide);
      return;
    }

    if (validity.thought_completeness === 'developing') {
      if (validity.decision === 'commit') {
        // Validity says commit but thought is still developing — hold for continuation
        this.enterResolvedCandidate(attempt, forceDecide);
        return;
      }
      // Fall through to standard hold/merge_wait logic
    }

    // fragment or developing with low validity
    if (validity.decision === 'discard') {
      this.discard(attempt);
      return;
    }

    // hold or escalate — no score-based promotion; held material must pass the guard
    if (forceDecide || this.holdCycles >= MAX_HOLD_CYCLES) {
      // Let commit() run the shared guard; it will discard if blocked
      this.commit(attempt, fromMergeTimer);
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
        this.attemptCommit(true, true);
      }, MERGE_WAIT_MS);
    }
  }

  private enterResolvedCandidate(attempt: ThoughtAttempt, skipWindow: boolean): void {
    this.clearMergeTimer();
    attempt.state = 'resolved_candidate';

    if (skipWindow) {
      this.commit(attempt, false);
      return;
    }

    // Open a short continuation window — if speaker adds to this thought, we re-open
    this.continuationTimer = setTimeout(() => {
      if (!this.current || this.current.id !== attempt.id || this.destroyed) return;
      this.clearContinuationTimer();
      if (this.current.state === 'resolved_candidate') {
        this.commit(this.current, false);
      }
    }, CONTINUATION_WINDOW_MS);
  }

  private commit(attempt: ThoughtAttempt, mergeExpired: boolean): void {
    this.clearMergeTimer();

    // ─── Shared commit guard ──────────────────────────────────────────────────
    // Re-extract from current full_text — cached features may lag behind the
    // latest appended material. runCommitGuard is the single enforcement point:
    // no score, continuity bonus, force-decide, or expiry can bypass it.
    const gf = extractFeatures(attempt.full_text, this.lensPack);
    const guard = runCommitGuard(attempt.full_text, gf);
    logGuardResult('FinalGate', attempt.full_text, gf, guard);

    if (guard.blocked) {
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

  private clearContinuationTimer(): void {
    if (this.continuationTimer !== null) {
      clearTimeout(this.continuationTimer);
      this.continuationTimer = null;
    }
  }
}
