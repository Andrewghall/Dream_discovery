// Shared types for EthentaFlow server.
// Keep in sync with docs/02-state-engine.md.

export type Lens = 'people' | 'commercial' | 'partners' | 'technology' | 'operations' | 'open';

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

export type ProbeStrategy = 'drill_depth' | 'request_example' | 'redirect' | 'transition_lens' | 'open_context' | 'reorient' | 'encourage';

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
}

// Deepgram event shapes (subset of what we use)
export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word?: string;
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
  | { type: 'start'; participantName?: string }
  | { type: 'interrupt' }
  | { type: 'end' };

export type ServerMessage =
  | { type: 'ready'; sessionId: string }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'state_update'; state: Partial<ConversationState> }
  | { type: 'probe'; text: string; strategy: ProbeStrategy }
  | { type: 'tts_start' }
  | { type: 'tts_end' }
  | { type: 'error'; message: string };
