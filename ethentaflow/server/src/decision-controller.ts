// Decision Controller — the ONLY authority on commit/probe decisions.
//
// Priority chain (strictly enforced, in order):
// 1. Continuation markers  → always WAIT, overrides everything
// 2. Expected answer type  → fast lane eligibility
// 3. Semantic completeness → has the user finished their complete thought?
// 4. Depth scoring         → enough substance to move on?
// 5. Probe engine          → only activates if rules 1-4 allow commit

import type { EndpointingMode, ExpectedAnswerType, ConversationState, ProbeStrategy } from './types.js';
import type { ProbeCandidate } from './types.js';
import type { DepthScore } from './depth-scorer.js';
import { SemanticCompletenessChecker } from './semantic-completeness.js';
import { DepthScorer } from './depth-scorer.js';
import { ProbeEngine } from './probe-engine.js';

// Regex shared with endpoint-detector — keep in sync
const CONTINUATION_TAIL_RE = /\b(because|of those|of the|and then|which means|but then|so then|and so|in that|for example|for instance|in other words|that is|such as|like when|especially|particularly|except|unless|until|although|even though|as well|as a result|due to|given that|assuming|provided that|in addition|on top of that|not only|as long as|in terms of|with regard to|when it comes to|the thing is|the point is|what i mean is|but i|and i|so i|because i)\b\s*$/i;

const SHORT_COMPLETE = /^(yes|no|yeah|nope|okay|ok|sure|maybe|sometimes|exactly|right|correct|wrong|absolutely|never|always|fine|great)\.?\??$/i;

const SENTENCE_OPENER = /^(i |you |we |they |he |she |it |there |this |that |what |how |why |when |where |so |but |and |the )/i;

export interface DecisionContext {
  transcript: string;
  endpointingMode: EndpointingMode;
  expectedAnswerType: ExpectedAnswerType;
  lastProbe: string | null;
  state: ConversationState;
  source: string;         // 'utterance_end' | 'tick_fallback' | 'grace' etc.
  isOnboarding: boolean;  // skip depth/probe; onboarding agent handles its own probe
  elapsedMinutes?: number;
  /** Number of consecutive probes drilled on the current thread within the active lens.
   *  When this reaches the sideways threshold, the strategy pivots laterally. */
  threadProbeCount?: number;
  /** Number of exploration turns completed in the current lens — drives the generation sequence. */
  explorationTurns?: number;
}

export interface DecisionOutcome {
  action: 'commit' | 'wait' | 'discard';
  probe: ProbeCandidate | null;    // pre-generated; null during onboarding or wait/discard
  depthResult: DepthScore | null;  // null during onboarding or wait/discard
  reason: string;
}

export class DecisionController {
  constructor(
    private semanticChecker: SemanticCompletenessChecker,
    private depthScorer: DepthScorer,
    private probeEngine: ProbeEngine,
  ) {}

  async evaluate(ctx: DecisionContext): Promise<DecisionOutcome> {
    const { transcript, endpointingMode, lastProbe, state, isOnboarding, elapsedMinutes = 0 } = ctx;

    // ── RULE 1: Continuation markers — absolute override ─────────────────────
    if (CONTINUATION_TAIL_RE.test(transcript)) {
      console.log(`[decision] WAIT — continuation marker detected`);
      return { action: 'wait', probe: null, depthResult: null, reason: 'continuation_marker' };
    }

    if (!transcript.trim()) {
      return { action: 'discard', probe: null, depthResult: null, reason: 'empty_transcript' };
    }

    // ── RULE 2: Expected answer type — fast lane eligibility ─────────────────
    if (SHORT_COMPLETE.test(transcript)) {
      console.log(`[decision] COMMIT — short complete answer`);
      const probe = isOnboarding ? null : await this.safeProbe(state, 'drill_depth');
      return { action: 'commit', probe, depthResult: null, reason: 'short_complete' };
    }

    if (endpointingMode === 'fast') {
      const words = transcript.split(/\s+/);
      if (words.length >= 1 && words.length <= 3 && !SENTENCE_OPENER.test(transcript)) {
        console.log(`[decision] COMMIT — fast lane short fact`);
        const probe = isOnboarding ? null : await this.safeProbe(state, 'drill_depth');
        return { action: 'commit', probe, depthResult: null, reason: 'fast_lane' };
      }
    }

    // ── RULE 3: Semantic completeness ─────────────────────────────────────────
    const semantic = await this.safeSemanticCheck(transcript, lastProbe ?? 'Tell me about your business.');

    if (semantic === 'NOISE') {
      console.log(`[decision] DISCARD — noise detected`);
      return { action: 'discard', probe: null, depthResult: null, reason: 'noise' };
    }

    if (semantic === 'NO') {
      console.log(`[decision] WAIT — semantic incomplete`);
      return { action: 'wait', probe: null, depthResult: null, reason: 'semantic_incomplete' };
    }

    // semantic === 'YES' — complete thought confirmed

    // ── RULES 4 & 5: Depth scoring → Probe engine ────────────────────────────
    // Skipped for onboarding — agent handles its own probe
    if (isOnboarding) {
      console.log(`[decision] COMMIT — onboarding (semantic YES)`);
      return { action: 'commit', probe: null, depthResult: null, reason: 'onboarding_complete' };
    }

    const depthResult = await this.safeDepthScore(transcript, state.currentSignal?.type ?? null, lastProbe);
    const strategy = this.strategyFromDepth(depthResult, state, ctx.threadProbeCount ?? 0, ctx.explorationTurns ?? 0);
    const probe = await this.safeProbe(state, strategy, elapsedMinutes);

    console.log(`[decision] COMMIT — depth=${depthResult.depth} strategy=${strategy}`);
    return { action: 'commit', probe, depthResult, reason: `depth_${depthResult.depth}_${strategy}` };
  }

  // ── Safe wrappers — never throw, always return a sane default ────────────

  private async safeSemanticCheck(transcript: string, probe: string): Promise<'YES' | 'NO' | 'NOISE'> {
    try {
      return await this.semanticChecker.check(transcript, probe);
    } catch (err) {
      console.error('[decision] semantic check failed — defaulting to NO (conservative)', err);
      return 'NO';
    }
  }

  private async safeDepthScore(
    transcript: string,
    signal: string | null,
    lastProbe: string | null,
  ): Promise<DepthScore> {
    try {
      return await this.depthScorer.score(transcript, signal, lastProbe);
    } catch (err) {
      console.error('[decision] depth score failed — defaulting to depth 1', err);
      return { depth: 1, exampleProvided: false, reasoning: 'fallback' };
    }
  }

  private async safeProbe(state: ConversationState, strategy: ProbeStrategy, elapsedMinutes = 0): Promise<ProbeCandidate | null> {
    try {
      return await this.probeEngine.generate(state, strategy, 'sync', elapsedMinutes);
    } catch (err) {
      console.error('[decision] probe generation failed', err);
      return null;
    }
  }

  private strategyFromDepth(depth: DepthScore, _state: ConversationState, threadProbeCount: number, explorationTurns: number): ProbeStrategy {
    // Generation sequence — structured per-lens flow drives the first 4 exploration turns.
    // After that, fall through to depth/coverage-based logic.
    switch (explorationTurns) {
      case 0: return 'gap_probe';      // Q2: why are you at X and not 5?
      case 1: return depth.exampleProvided ? 'barrier_probe' : 'evidence_probe'; // Q3
      case 2: return depth.exampleProvided ? 'barrier_probe' : 'evidence_probe'; // Q4
      case 3: return 'impact_probe';   // Q5: what did that cost you?
    }

    // After Q5: depth and board-coverage logic takes over
    const canProgress = depth.depth >= 3 && depth.exampleProvided;
    if (canProgress) return 'transition_lens';

    const SIDEWAYS_THRESHOLD = 3;
    if (threadProbeCount >= SIDEWAYS_THRESHOLD && depth.depth >= 2) return 'sideways';
    if (!depth.exampleProvided) return 'evidence_probe';

    return 'impact_probe'; // keep extracting commercial impact until gate passes
  }
}
