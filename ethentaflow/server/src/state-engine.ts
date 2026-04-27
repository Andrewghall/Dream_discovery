// State engine - rolling conversation state, single mutation queue per session.
// See docs/02-state-engine.md.

import { randomUUID } from 'node:crypto';
import type {
  ConversationState,
  Lens,
  LensScore,
  MaturityRating,
  ProbeCandidate,
  Signal,
  SignalType,
  TruthNode,
  Turn,
} from './types.js';

const ALL_LENSES: Lens[] = ['people', 'commercial', 'partners', 'technology', 'operations', 'risk_compliance', 'open'];

function initialLensScores(): Record<Lens, LensScore> {
  const scores = {} as Record<Lens, LensScore>;
  for (const l of ALL_LENSES) {
    scores[l] = {
      coverage: 0,
      depthReached: 0,
      insightCount: 0,
      lastTouchedAt: 0,
      status: 'untouched',
    };
  }
  return scores;
}

export class SessionState {
  private state: ConversationState;
  private mutationQueue: Promise<void> = Promise.resolve();
  private _confusionCount = 0;
  private _recentProbes: string[] = [];
  private _openingDone = false;
  private _onboardingDone = false;
  private _maturityRatings: Map<Lens, MaturityRating> = new Map();
  private _truthNodes: TruthNode[] = [];
  /** Number of consecutive probes on the current thread within the active lens.
   *  Resets on sideways move or lens transition. Used to trigger sideways pivots. */
  private _threadProbeCount = 0;

  constructor(participantName?: string) {
    this.state = {
      sessionId: randomUUID(),
      startedAt: Date.now(),
      participantName,
      liveUtterance: '',
      lastPartialAt: 0,
      lastWordAt: 0,
      currentLens: 'open',
      currentSignal: null,
      signalStack: [],
      depthScore: 0,
      exampleProvided: false,
      pendingProbe: null,
      turns: [],
      insights: [],
      lensScores: initialLensScores(),
    };
  }

  get sessionId(): string {
    return this.state.sessionId;
  }

  get openingDone(): boolean { return this._openingDone; }
  markOpeningDone(): void { this._openingDone = true; }

  get confusionCount(): number { return this._confusionCount; }
  incrementConfusion(): void { this._confusionCount++; }
  resetConfusion(): void { this._confusionCount = 0; }

  /** Register a probe as sent; returns true if it was a duplicate of a recent one. */
  trackProbe(text: string): boolean {
    const isDuplicate = this._recentProbes.slice(-5).includes(text);
    this._recentProbes.push(text);
    if (this._recentProbes.length > 10) this._recentProbes = this._recentProbes.slice(-10);
    return isDuplicate;
  }

  getRecentProbes(): string[] { return [...this._recentProbes]; }

  // --- Onboarding ---
  get onboardingDone(): boolean { return this._onboardingDone; }
  markOnboardingDone(): void { this._onboardingDone = true; }

  // --- Thread probe tracking (board model) ---
  get threadProbeCount(): number { return this._threadProbeCount; }
  incrementThreadProbe(): void { this._threadProbeCount++; }
  resetThreadProbe(): void { this._threadProbeCount = 0; }

  addMaturityRating(lens: Lens, rating: MaturityRating): void {
    this._maturityRatings.set(lens, rating);
    void this.mutate(s => {
      if (!s.maturityRatings) s.maturityRatings = {};
      s.maturityRatings[lens] = rating;
    });
  }

  addTruthNode(node: TruthNode): void {
    this._truthNodes.push(node);
    void this.mutate(s => {
      if (!s.truthNodes) s.truthNodes = [];
      s.truthNodes.push(node);
    });
  }

  getMaturityRating(lens: Lens): MaturityRating | undefined {
    return this._maturityRatings.get(lens);
  }

  snapshot(): ConversationState {
    return structuredClone(this.state);
  }

  /** Queue a mutation. Serialised per session. */
  async mutate(fn: (s: ConversationState) => void | Promise<void>): Promise<void> {
    const next = this.mutationQueue.then(() => fn(this.state));
    // Swallow errors on the queue but re-throw to caller.
    this.mutationQueue = next.catch(() => {});
    return next;
  }

  // ---------- Convenience mutators ----------

  async updateLiveUtterance(text: string): Promise<void> {
    return this.mutate(s => {
      s.liveUtterance = text;
      s.lastPartialAt = Date.now();
    });
  }

  async mergeSignals(newSignals: Signal[], triggerUtterance: string): Promise<void> {
    return this.mutate(s => {
      // Divergence check: discard if liveUtterance has materially diverged from trigger.
      if (!isRelatedUtterance(triggerUtterance, s.liveUtterance)) return;

      const byType = new Map<SignalType, Signal>();
      for (const sig of s.signalStack) byType.set(sig.type, sig);
      for (const sig of newSignals) {
        const existing = byType.get(sig.type);
        if (!existing || sig.confidence > existing.confidence) {
          byType.set(sig.type, sig);
        }
      }
      // Sort by recency then confidence
      s.signalStack = Array.from(byType.values()).sort((a, b) => {
        if (b.detectedAt !== a.detectedAt) return b.detectedAt - a.detectedAt;
        return b.confidence - a.confidence;
      });
      s.currentSignal = s.signalStack[0] ?? null;
    });
  }

  async setPendingProbe(probe: ProbeCandidate): Promise<void> {
    return this.mutate(s => {
      // Divergence check
      if (!isRelatedUtterance(probe.triggerUtterance, s.liveUtterance)) return;
      s.pendingProbe = probe;
    });
  }

  async clearPendingProbe(): Promise<void> {
    return this.mutate(s => {
      s.pendingProbe = null;
    });
  }

  async commitTurn(finalTranscript: string, depthScore: 0|1|2|3, exampleProvided: boolean, probeAskedAfter: string | null): Promise<Turn> {
    let committed!: Turn;
    await this.mutate(s => {
      const turn: Turn = {
        turnId: `t_${s.turns.length + 1}`,
        startedAt: s.lastPartialAt || Date.now(),
        endedAt: Date.now(),
        speaker: 'user',
        finalTranscript,
        lens: s.currentLens,
        signalsDetected: [...s.signalStack],
        depthScore,
        exampleProvided,
        probeAskedAfter,
      };
      s.turns.push(turn);
      s.depthScore = depthScore;
      s.exampleProvided = exampleProvided;

      // Update lens score
      const ls = s.lensScores[s.currentLens];
      ls.lastTouchedAt = Date.now();
      ls.status = 'active';
      if (depthScore > ls.depthReached) ls.depthReached = depthScore;
      ls.coverage = computeLensCoverage(s, s.currentLens);

      // Clear live state for next turn
      s.liveUtterance = '';
      s.signalStack = [];
      s.currentSignal = null;
      s.pendingProbe = null;

      committed = turn;
    });
    return committed;
  }

  async setLens(lens: Lens): Promise<void> {
    const lensChanged = this.state.currentLens !== lens;
    if (lensChanged) this._threadProbeCount = 0;
    return this.mutate(s => {
      if (s.currentLens !== lens) {
        // Park the outgoing lens if it was active
        if (s.currentLens !== 'open' && s.lensScores[s.currentLens].status === 'active') {
          s.lensScores[s.currentLens].status = 'parked';
        }
        s.currentLens = lens;
        if (s.lensScores[lens].status === 'untouched' || s.lensScores[lens].status === 'parked') {
          s.lensScores[lens].status = 'active';
        }
      }
    });
  }

  async recordSystemProbe(probeText: string): Promise<void> {
    return this.mutate(s => {
      const turn: Turn = {
        turnId: `t_${s.turns.length + 1}`,
        startedAt: Date.now(),
        endedAt: Date.now(),
        speaker: 'system',
        finalTranscript: probeText,
        lens: s.currentLens,
        signalsDetected: [],
        depthScore: 0,
        exampleProvided: false,
        probeAskedAfter: null,
      };
      s.turns.push(turn);
    });
  }
}

function isRelatedUtterance(trigger: string, current: string): boolean {
  if (!trigger) return true;
  if (!current) return false;
  // Same or current extends trigger
  if (current === trigger) return true;
  if (current.startsWith(trigger)) return true;
  // Otherwise check Levenshtein-ish distance via length delta
  const deltaLen = Math.abs(current.length - trigger.length);
  if (deltaLen > 40) return false;
  // Cheap containment check
  const shortLen = Math.min(trigger.length, current.length);
  const prefix = trigger.substring(0, Math.min(shortLen, 30));
  return current.includes(prefix);
}

function computeLensCoverage(s: ConversationState, lens: Lens): number {
  const lensTurns = s.turns.filter(t => t.lens === lens && t.speaker === 'user');
  const lensInsights = s.insights.filter(i => i.lens === lens);
  const ls = s.lensScores[lens];
  const turnContribution = Math.min(1, lensTurns.length * 0.2);
  const insightContribution = Math.min(1, lensInsights.length * 0.3);
  const depthContribution = ls.depthReached / 3;
  return Math.min(1, turnContribution * 0.3 + insightContribution * 0.3 + depthContribution * 0.4);
}
