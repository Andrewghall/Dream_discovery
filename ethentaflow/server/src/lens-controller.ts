// LensController — manages the ordered lens sequence and per-lens progress.
//
// Default sequence (no risk_compliance): people → operations → technology → commercial → partners
// Full sequence (risk_compliance included): people → operations → technology → commercial → risk_compliance → partners
//
// risk_compliance is opt-in — only included when the prep person explicitly adds it.
// Pass the lens list at construction time via the constructor argument.
//
// Two phases per lens:
//   Phase A (measurement): one anchor question → MaturityRating
//   Phase B (exploration): dynamic probing → TruthNodes
//
// Completion gate: ≥2 strong truth nodes + hasExample + (scoreExplained OR explorationTurns≥4)

import type { Lens, LensCoverage, LensProgress, MaturityRating, SessionMode, TruthNode } from './types.js';

/** Standard 5-lens sequence — risk_compliance excluded unless explicitly opted in. */
export const DEFAULT_LENS_SEQUENCE: Exclude<Lens, 'open'>[] = [
  'people',
  'operations',
  'technology',
  'commercial',
  'customer',
  'partners',
];

/** Full 6-lens sequence including risk_compliance (opt-in only). */
export const FULL_LENS_SEQUENCE: Exclude<Lens, 'open'>[] = [
  'people',
  'operations',
  'technology',
  'commercial',
  'customer',
  'risk_compliance',
  'partners',
];

/** @deprecated Use DEFAULT_LENS_SEQUENCE or FULL_LENS_SEQUENCE */
export const LENS_SEQUENCE = DEFAULT_LENS_SEQUENCE;

/** A "strong" truth node: isSpecific AND hasEvidence (both must be true). */
function isStrongNode(n: TruthNode): boolean {
  return n.isSpecific && n.hasEvidence;
}

export class LensController {
  private progress: Map<Lens, LensProgress> = new Map();
  private sequenceIndex = 0;
  private readonly sequence: Exclude<Lens, 'open'>[];

  /**
   * @param lenses Ordered lens list for this session. Defaults to DEFAULT_LENS_SEQUENCE.
   *               Pass FULL_LENS_SEQUENCE (or a custom list) to include risk_compliance.
   */
  constructor(lenses: Exclude<Lens, 'open'>[] = DEFAULT_LENS_SEQUENCE) {
    this.sequence = lenses;
    // Initialise all lenses — first is measurement, rest are pending
    for (let i = 0; i < this.sequence.length; i++) {
      const lens = this.sequence[i]!;
      this.progress.set(lens, {
        lens,
        phase: i === 0 ? 'measurement' : 'pending',
        truthNodes: [],
        hasExample: false,
        scoreExplained: false,
        explorationTurns: 0,
      });
    }
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  get currentLens(): Lens {
    return this.sequence[this.sequenceIndex]!;
  }

  get allLensesComplete(): boolean {
    return this.sequenceIndex >= this.sequence.length;
  }

  getProgress(lens: Lens): LensProgress {
    const p = this.progress.get(lens);
    if (!p) throw new Error(`Unknown lens: ${lens}`);
    return { ...p, truthNodes: [...p.truthNodes] };
  }

  getAllProgress(): LensProgress[] {
    return this.sequence.map(l => this.getProgress(l));
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  /** Called when maturity rating is extracted — transitions phase to exploration. */
  setMaturityRating(lens: Lens, rating: MaturityRating): void {
    const p = this.getProgressMutable(lens);
    p.maturityRating = rating;
    if (p.phase === 'measurement') {
      p.phase = 'exploration';
    }
    console.log(`[lens] ${lens}: maturity set — current=${rating.current} target=${rating.target} → exploration`);
  }

  /** Add a truth node, deduplicating by statement prefix (first 30 chars). */
  addTruthNode(lens: Lens, node: TruthNode): void {
    const p = this.getProgressMutable(lens);
    const prefix = node.statement.slice(0, 30).toLowerCase();
    const isDuplicate = p.truthNodes.some(n => n.statement.slice(0, 30).toLowerCase() === prefix);
    if (isDuplicate) {
      console.log(`[lens] ${lens}: dedup — skipping node "${node.statement.slice(0, 40)}"`);
      return;
    }
    p.truthNodes.push(node);

    // Infer hasExample from evidence pattern (contains "when", "for example", specific event)
    if (!p.hasExample && hasExamplePattern(node.evidence)) {
      p.hasExample = true;
    }

    console.log(`[lens] ${lens}: truth node added (total=${p.truthNodes.length}, strong=${p.truthNodes.filter(isStrongNode).length})`);
  }

  /** Record an exploration turn. depthScore >= 2 counts as score understood. */
  recordExplorationTurn(lens: Lens, deepResponse: boolean): void {
    const p = this.getProgressMutable(lens);
    p.explorationTurns++;
    if (deepResponse && !p.scoreExplained) {
      p.scoreExplained = true;
    }
    console.log(`[lens] ${lens}: exploration turn ${p.explorationTurns}, scoreExplained=${p.scoreExplained}`);
  }

  /** Compute weighted coverage score (0–100) for a lens.
   *  Based on 5 criteria: scale(20) + gap(20) + evidence(25) + rootCause(20) + impact(15). */
  getLensCoverage(lens: Lens): { pct: number; scale: boolean; gap: boolean; evidence: boolean; rootCause: boolean; impact: boolean } {
    const p = this.progress.get(lens);
    if (!p) return { pct: 0, scale: false, gap: false, evidence: false, rootCause: false, impact: false };

    const scale    = !!p.maturityRating;
    const gap      = p.scoreExplained;
    const evidence = p.hasExample;
    const rootCause = p.explorationTurns >= 3;
    const impact   = p.truthNodes.some(n => n.isSpecific && n.hasEvidence);

    const pct = (scale ? 20 : 0) + (gap ? 20 : 0) + (evidence ? 25 : 0) + (rootCause ? 20 : 0) + (impact ? 15 : 0);
    return { pct, scale, gap, evidence, rootCause, impact };
  }

  /** Returns coverage snapshot for all lenses — used to emit coverage_update to client. */
  getAllCoverage(): LensCoverage[] {
    return this.sequence.map((lens, idx) => {
      const { pct, scale, gap, evidence, rootCause, impact } = this.getLensCoverage(lens);
      const p = this.progress.get(lens)!;
      const explorationTurns = p.explorationTurns ?? 0;
      const questionIndex = p.phase === 'measurement' ? 1
        : explorationTurns === 0 ? 2
        : explorationTurns === 1 ? 3
        : explorationTurns === 2 ? 4
        : 5;
      return {
        lens,
        label: COVERAGE_LENS_LABELS[lens] ?? lens,
        sectionIndex: idx + 1,
        isCurrent: idx === this.sequenceIndex,
        pct,
        questionIndex,
        scale,
        gap,
        evidence,
        rootCause,
        impact,
      };
    });
  }

  /** True if current lens coverage is below the low-coverage threshold (60%). */
  isCurrentLensLowCoverage(): boolean {
    const { pct } = this.getLensCoverage(this.currentLens);
    const p = this.progress.get(this.currentLens)!;
    return p.explorationTurns >= 2 && pct < 60;
  }

  /** Completion gate: coverage ≥ 85% OR (≥2 strong nodes + hasExample + scoreExplained/turns≥4). */
  isCompletionGatePassed(lens: Lens): boolean {
    const p = this.getProgressMutable(lens);
    if (p.phase !== 'exploration' && p.phase !== 'complete') return false;
    const { pct } = this.getLensCoverage(lens);
    if (pct >= 85) {
      console.log(`[lens] ${lens}: completion gate PASS (coverage=${pct}%)`);
      return true;
    }
    const strongCount = p.truthNodes.filter(isStrongNode).length;
    const gate = strongCount >= 2 && p.hasExample && (p.scoreExplained || p.explorationTurns >= 4);
    console.log(`[lens] ${lens}: completion gate — coverage=${pct}% strong=${strongCount} hasExample=${p.hasExample} scoreExplained=${p.scoreExplained} turns=${p.explorationTurns} → ${gate ? 'PASS' : 'fail'}`);
    return gate;
  }

  /**
   * Mark the current lens complete and advance to the next.
   * Returns the new current lens, or null if all lenses are done.
   */
  advanceLens(): Lens | null {
    const currentProgress = this.getProgressMutable(this.currentLens);
    currentProgress.phase = 'complete';
    this.sequenceIndex++;

    if (this.sequenceIndex >= this.sequence.length) {
      console.log('[lens] all lenses complete');
      return null;
    }

    const nextLens = this.sequence[this.sequenceIndex]!;
    const nextProgress = this.getProgressMutable(nextLens);
    nextProgress.phase = 'measurement';
    console.log(`[lens] advanced to ${nextLens}`);
    return nextLens;
  }

  /**
   * Decide the current session mode.
   *
   * Priority:
   * 1. If in measurement phase → 'measure'
   * 2. If all lenses done OR completion gate passed → 'close'
   * 3. If 3+ exploration turns with 0 strong nodes → 'challenge'
   * 4. If 4+ exploration turns with no example yet → 'steer'
   * 5. Otherwise → 'explore'
   */
  decideMode(): SessionMode {
    if (this.allLensesComplete) return 'close';

    const p = this.getProgressMutable(this.currentLens);

    if (p.phase === 'measurement') return 'measure';
    if (p.phase === 'complete') return 'close';

    // In exploration phase
    if (this.isCompletionGatePassed(this.currentLens)) return 'close';

    const strongCount = p.truthNodes.filter(isStrongNode).length;
    if (p.explorationTurns >= 3 && strongCount === 0) return 'challenge';
    if (p.explorationTurns >= 4 && !p.hasExample) return 'steer';

    return 'explore';
  }

  /**
   * Build a natural spoken close/summary for the lens.
   * References the score and the top truth nodes.
   */
  buildCloseSummary(lens: Lens): string {
    const p = this.getProgressMutable(lens);
    const rating = p.maturityRating;

    // Pick up to 2 strongest nodes (both specific and evidence-based first, then others)
    const strong = p.truthNodes.filter(isStrongNode).slice(0, 2);
    const weak = p.truthNodes.filter(n => !isStrongNode(n)).slice(0, 2 - strong.length);
    const topNodes = [...strong, ...weak];

    const scoreText = rating
      ? `You've rated your ${lensLabel(lens)} at ${rating.current} out of 5 with a target of ${rating.target}.`
      : `We've covered a fair bit on the ${lensLabel(lens)} side.`;

    let nodeText = '';
    if (topNodes.length === 1) {
      nodeText = ` The main thing I picked up was ${topNodes[0]!.statement}.`;
    } else if (topNodes.length >= 2) {
      nodeText = ` The key things I picked up were ${topNodes[0]!.statement} and ${topNodes[1]!.statement}.`;
    }

    return `${scoreText}${nodeText} Does that capture the picture you were painting, or is there something important I've missed?`;
  }

  /** Number of lenses not yet complete (including current). */
  getRemainingLensCount(): number {
    return this.sequence.length - this.sequenceIndex;
  }

  /** Current position in the lens sequence (0-based). */
  getSequenceIndex(): number {
    return this.sequenceIndex;
  }

  /** The ordered lens sequence for this session. */
  getSequence(): Exclude<Lens, 'open'>[] {
    return [...this.sequence];
  }

  /** Serialize lens progress for session save. */
  toJSON(): object {
    const progressObj: Record<string, LensProgress> = {};
    for (const [lens, prog] of this.progress.entries()) {
      progressObj[lens] = { ...prog, truthNodes: [...prog.truthNodes] };
    }
    return {
      sequence: this.sequence,
      sequenceIndex: this.sequenceIndex,
      progress: progressObj,
    };
  }

  /** Restore a LensController from a previously serialized snapshot. */
  static fromJSON(data: { sequence: Exclude<Lens, 'open'>[]; sequenceIndex: number; progress: Record<string, LensProgress> }): LensController {
    const ctrl = new LensController(data.sequence);
    ctrl.sequenceIndex = data.sequenceIndex;
    for (const [lens, prog] of Object.entries(data.progress)) {
      ctrl.progress.set(lens as Lens, { ...prog, truthNodes: prog.truthNodes ?? [] });
    }
    return ctrl;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private getProgressMutable(lens: Lens): LensProgress {
    const p = this.progress.get(lens);
    if (!p) throw new Error(`Unknown lens: ${lens}`);
    return p;
  }
}

const COVERAGE_LENS_LABELS: Partial<Record<Lens, string>> = {
  people:          'People',
  operations:      'Operations',
  technology:      'Technology',
  commercial:      'Commercial',
  risk_compliance: 'Risk',
  partners:        'Partners',
};

/** Heuristic: evidence contains example markers. */
function hasExamplePattern(evidence: string): boolean {
  return /\b(when|for example|for instance|once|last (year|month|quarter|week)|specifically|in \d{4}|\d{4}|we had|there was|it happened)\b/i.test(evidence);
}

function lensLabel(lens: Lens): string {
  const labels: Record<Lens, string> = {
    commercial: 'go-to-market',
    people: 'people and talent',
    operations: 'operations',
    technology: 'technology',
    customer: 'customer relationships',
    partners: 'partner ecosystem',
    risk_compliance: 'risk and compliance',
    open: 'business',
  };
  return labels[lens] ?? lens;
}
