// Shared types for EthentaFlow server.
// Keep in sync with docs/02-state-engine.md.

export type Lens = 'people' | 'commercial' | 'partners' | 'technology' | 'operations' | 'risk_compliance' | 'customer' | 'open';

export type SignalType =
  | 'people_issue'
  | 'growth_goal'
  | 'icp_definition'
  | 'channel_problem'
  | 'constraint'
  | 'partnership'
  | 'tech_gap'
  | 'operational_friction'
  | 'commercial_model'
  | 'market_position';

export type ProbeStrategy =
  | 'drill_depth' | 'request_example' | 'redirect' | 'transition_lens' | 'sideways'
  | 'open_context' | 'reorient' | 'encourage' | 'onboarding' | 'measure' | 'challenge' | 'steer' | 'close'
  // Generation-sequence strategies (structured per-lens flow)
  | 'gap_probe'      // Q2: Why are you at X and not 5? What's missing?
  | 'evidence_probe' // Q3: Give me a real deal where that showed up.
  | 'barrier_probe'  // Q4: What's actually blocking it?
  | 'impact_probe';  // Q5: What did that cost you?

/**
 * Endpointing lanes — control how the endpoint detector waits for an answer.
 *
 * fast        — name, yes/no, confirmation, single-word facts.
 *               Commits quickly on any short complete phrase.
 * normal      — job title, role, bounded factual answer.
 *               Waits for a reasonably complete thought (3+ words, punctuation).
 * long_thought — open workshop questions, explanations, opinions.
 *               Never commits on fragments; waits for semantic completeness
 *               and refuses to fire if a continuation marker is detected.
 */
export type EndpointingMode = 'fast' | 'normal' | 'long_thought';

/** What kind of answer shape is expected from this prompt. */
export type ExpectedAnswerType =
  | 'name'           // "What's your name?"
  | 'confirmation'   // "Is Andrew OK?" / "Are you alright with…?"
  | 'title'          // "What's your job title?"
  | 'bounded_fact'   // short factual answer, a few words
  | 'open_explanation'; // open-ended workshop answer

export interface Signal {
  type: SignalType;
  confidence: number;
  detectedAt: number;
  sourceSpan: string;
}

export interface Turn {
  turnId: string;
  startedAt: number;
  endedAt: number;
  speaker: 'user' | 'system';
  finalTranscript: string;
  lens: Lens;
  signalsDetected: Signal[];
  depthScore: number;
  exampleProvided: boolean;
  probeAskedAfter: string | null;
}

export interface ProbeCandidate {
  text: string;
  targetSignal: SignalType | null;
  strategy: ProbeStrategy;
  generatedBy: 'haiku_speculative' | 'haiku_sync' | 'template_fallback';
  tokenLatencyMs: number;
  generatedAt: number;
  triggerUtterance: string;
  /** Which endpointing lane to use while waiting for the answer to this probe. */
  endpointingMode: EndpointingMode;
  expectedAnswerType: ExpectedAnswerType;
}

export interface Insight {
  insightId: string;
  lens: Lens;
  signal: SignalType;
  statement: string;
  evidence: string;
  confidence: number;
  extractedAt: number;
  sourceTurnId: string;
}

export interface LensScore {
  coverage: number;
  depthReached: number;
  insightCount: number;
  lastTouchedAt: number;
  status: 'untouched' | 'active' | 'parked' | 'closed';
}

export interface MaturityRating {
  lensId: Lens;
  current: number;        // 1–5
  target: number;         // 1–5
  trajectory: 'improving' | 'flat' | 'declining';
  capturedAt: number;
  rawResponse: string;
}

export interface TruthNode {
  nodeId: string;
  lensId: Lens;
  statement: string;      // concise standalone fact, ≤15 words
  evidence: string;       // verbatim or near-verbatim quote, ≤25 words
  isSpecific: boolean;
  hasEvidence: boolean;
  extractedAt: number;
  sourceTurnId: string;
}

export type SessionMode = 'measure' | 'explore' | 'challenge' | 'steer' | 'close';

export interface LensProgress {
  lens: Lens;
  phase: 'pending' | 'measurement' | 'exploration' | 'complete';
  maturityRating?: MaturityRating;
  truthNodes: TruthNode[];
  hasExample: boolean;
  scoreExplained: boolean;
  explorationTurns: number;
}

export interface ConversationState {
  sessionId: string;
  startedAt: number;
  participantName?: string;

  liveUtterance: string;
  lastPartialAt: number;
  lastWordAt: number;

  currentLens: Lens;
  currentSignal: Signal | null;
  signalStack: Signal[];
  depthScore: 0 | 1 | 2 | 3;
  exampleProvided: boolean;

  pendingProbe: ProbeCandidate | null;

  turns: Turn[];
  insights: Insight[];
  lensScores: Record<Lens, LensScore>;

  // Two-phase per-lens discovery (optional — populated after onboarding)
  maturityRatings?: Partial<Record<Lens, MaturityRating>>;
  truthNodes?: TruthNode[];
  currentMode?: SessionMode;
  lensPhases?: Partial<Record<Lens, LensProgress['phase']>>;
}

// Deepgram event shapes (subset of what we use)
export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word?: string;
  speaker?: number;        // diarization: 0 = primary speaker
  speaker_confidence?: number;
}

export interface DeepgramTranscript {
  type: 'Results';
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: DeepgramWord[];
    }>;
  };
  is_final: boolean;
  speech_final: boolean;
  start: number;
  duration: number;
}

export interface DeepgramUtteranceEnd {
  type: 'UtteranceEnd';
  last_word_end: number;
}

export interface DeepgramSpeechStarted {
  type: 'SpeechStarted';
  timestamp: number;
}

// WebSocket messages (client <-> server)
export type ClientMessage =
  | { type: 'pause' }   // participant pauses session (someone at desk, etc.)
  | { type: 'resume' }  // participant resumes session
  | {
      type: 'start';
      participantName?: string;
      participantTitle?: string;
      /**
       * If set, the server will attempt to restore a previously saved session.
       * The client gets this from the URL param ?resume=<sessionId>.
       */
      resumeSessionId?: string;
      /**
       * Ordered list of lenses for this session, configured by the prep person.
       * Omit to use the default 5-lens sequence (people, operations, technology, commercial, partners).
       * Include 'risk_compliance' to add it between commercial and partners.
       */
      lenses?: Array<Exclude<Lens, 'open'>>;
    }
  | { type: 'interrupt' }
  | { type: 'playback_done' }  // client audio has physically finished (buffer + echo holdoff)
  | { type: 'end' };

export interface LensCoverage {
  lens: Lens;
  label: string;
  sectionIndex: number;   // 1-based position in the session sequence
  isCurrent: boolean;
  pct: number;            // 0–100 weighted coverage score
  questionIndex: number;  // 1–5 current question in generation sequence
  scale: boolean;         // 20% — maturity rating captured
  gap: boolean;           // 20% — gap identified (deep response given)
  evidence: boolean;      // 25% — real deal example captured
  rootCause: boolean;     // 20% — root cause / barrier identified
  impact: boolean;        // 15% — commercial impact described
}

// ── Canonical interview event contract ───────────────────────────────────────
// All workshop types share this payload shape. The lifecycle events
// question_created and question_presented carry the same payload with the same
// questionId; only the moment they fire differs.
//
//   question_created   — server has decided this is the next interview question.
//                        Fires at decision time, even when TTS is deferred.
//   question_presented — client may now render this as the active question.
//                        Fires immediately before TTS for normal questions, or
//                        from the afterTtsCallback chain for intro-deferred ones.

export type PromptKind = 'triple_rating' | 'probe' | 'challenge' | 'closing';

export interface AskQuestionPayload {
  questionId: string;
  workshopType: string;
  phase: string;
  promptKind: PromptKind;
  text: string;
  strategy: ProbeStrategy;
  render: {
    card: boolean;        // show scoring card (triple_rating only)
    transcript: boolean;  // append to chat transcript
    speak: boolean;       // play TTS
  };
  inputMode: {
    endpointingMode: EndpointingMode;
    expectedAnswerType: ExpectedAnswerType;
  };
  metadata?: Record<string, unknown>;
}

export type ServerMessage =
  | { type: 'ready'; sessionId: string }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'state_update'; state: Partial<ConversationState> }
  | { type: 'probe'; text: string; strategy: ProbeStrategy }
  | { type: 'tts_start' }
  | { type: 'tts_end' }
  | { type: 'error'; message: string }
  | { type: 'lens_rating'; lens: Lens; current: number; target: number; trajectory: 'improving' | 'flat' | 'declining' }
  | { type: 'truth_node'; nodeId: string; lensId: Lens; statement: string; evidence: string; isSpecific: boolean; hasEvidence: boolean }
  | { type: 'lens_phase'; lens: Lens; phase: 'pending' | 'measurement' | 'exploration' | 'complete' }
  | {
      type: 'measure_prompt';
      lens: Lens;
      /** The full anchor question text — client renders the coloured scoring card */
      question: string;
    }
  | {
      type: 'coverage_update';
      sections: LensCoverage[];
      currentSection: number;  // 1-based
      totalSections: number;
      totalPct: number;        // average across all sections
      /** Epoch ms when Q1 was first spoken for each of the 5 sections (0 = not started yet). */
      sectionStartTimes: number[];
    }
  | { type: 'session_complete' }
  | { type: 'session_paused' }   // acknowledged pause — client shows visual indicator
  | { type: 'session_resumed' }  // session is live again
  | {
      type: 'interview_progress';
      sectionIndex: number;   // 1-5
      questionIndex: number;  // 1-5
      sectionName: string;
      progressLabel: string;  // "S1/5 Q1/5"
      /** Epoch ms when the current section started (Q1 spoken). */
      sectionStartedAt: number;
    }
  | { type: 'question_created';   payload: AskQuestionPayload }
  | { type: 'question_presented'; payload: AskQuestionPayload };
