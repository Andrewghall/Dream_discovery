// EthentaFlow server entry point.
// Wires Deepgram + agentic turn engine + endpoint detector + TTS + capture
// per WebSocket session.
//
// Architecture: fully agentic — the LLM (via generateAgenticTurn) decides
// whether to probe deeper or advance to the next lens. No fixed question
// sequence. Role-aware, time-aware, and sufficiency-driven.
//
// Run with: OPENAI_API_KEY=... DEEPGRAM_API_KEY=... ELEVENLABS_API_KEY=... npm run dev

import dotenv from 'dotenv';
dotenv.config({ override: true });
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { EndpointDetector } from './endpoint-detector.js';
import { SessionState } from './state-engine.js';
import { createDeepgramConnection } from './deepgram.js';
import { SignalClassifier } from './signal-classifier.js';
import { ProbeEngine, isConfused, buildWelcome } from './probe-engine.js';
import { OnboardingAgent } from './onboarding-agent.js';
import { TruthExtractor } from './truth-extractor.js';
import { LensController, DEFAULT_LENS_SEQUENCE } from './lens-controller.js';
import { DepthScorer } from './depth-scorer.js';
import { synthesiseStream } from './tts.js';
import { startCapture } from './capture.js';
import { SemanticCompletenessChecker } from './semantic-completeness.js';
import { DecisionController } from './decision-controller.js';
import { relaxText } from './relax-text.js';
import { checkTranscriptSanity } from './transcript-sanity.js';
import {
  generateAgenticTurn,
  agenticGenerateFinalSynthesis,
  extractTripleRatings,
  formatTripleRatingPrompt,
  isClarificationRequest,
  rephraseLastProbe,
  liveEval,
  type LiveEval,
  type SessionMessage,
} from './agentic-turn.js';
import { PHASE_QUESTIONS } from './phase-questions.js';
import type {
  ClientMessage, EndpointingMode, ExpectedAnswerType, ServerMessage, Lens, ProbeStrategy, ProbeCandidate,
  AskQuestionPayload,
} from './types.js';

// ── Canonical question event helpers ─────────────────────────────────────────
// Sources that represent genuine interview questions (not system acks, not
// onboarding chatter, not session-control copy). Only these fire question_created.
const CANONICAL_SOURCES = new Set([
  'onboarding-bridge',
  'measure-prompt',
  'agentic-decision',
  'agentic-transition',
  'cascade-1',
  'cascade-2',
  'cascade-3',
  'live-eval-challenge',
  'final-synthesis',
  'frustration-advance',
  'reorient',
  'clarification',
]);

function sourceToPromptKind(source: string): AskQuestionPayload['promptKind'] {
  switch (source) {
    case 'onboarding-bridge':
    case 'measure-prompt':
    case 'agentic-transition':
    case 'cascade-2':
    case 'frustration-advance':
      return 'triple_rating';
    case 'live-eval-challenge':
      return 'challenge';
    case 'cascade-3':
    case 'final-synthesis':
      return 'closing';
    default:
      return 'probe';
  }
}

function buildQuestionPayload(
  source: string,
  text: string,
  strategy: ProbeStrategy,
  endpointMode: EndpointingMode,
  answerType: ExpectedAnswerType,
  persist: { phase: string; metadata: unknown; content?: string },
  questionId?: string,
): AskQuestionPayload {
  const promptKind = sourceToPromptKind(source);
  const contentText = persist.content ?? text;
  return {
    questionId: questionId ?? randomUUID(),
    workshopType: 'ethentaflow',
    phase: persist.phase,
    promptKind,
    text: contentText,
    strategy,
    render: {
      card: promptKind === 'triple_rating',
      transcript: true,
      speak: true,
    },
    inputMode: {
      endpointingMode: endpointMode,
      expectedAnswerType: answerType,
    },
    metadata: persist.metadata != null
      ? (persist.metadata as Record<string, unknown>)
      : undefined,
  };
}

const PORT = Number(process.env.PORT ?? 3001);
const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');
const DEEPGRAM_API_KEY = requireEnv('DEEPGRAM_API_KEY');
const ELEVENLABS_API_KEY = requireEnv('ELEVENLABS_API_KEY');

// Shared OpenAI client — one instance for all sessions (API key is constant)
const openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Session save/resume ──────────────────────────────────────────────────────
const SESSION_SAVE_DIR = '/tmp/dreamflow-sessions';

// ── Reactive openers — minimal spoken acknowledgment before exploration probes ─
const REACTIVE_OPENER_POOL: Partial<Record<ProbeStrategy, string[]>> = {
  gap_probe:      ['Right.', 'Okay.', 'Got it.'],
  evidence_probe: ['Right.', 'Okay.', 'Got it.'],
  barrier_probe:  ['Noted.', 'Right.', 'Okay.'],
  impact_probe:   ['Got it.', 'Right.', 'Noted.'],
  sideways:       ['Let me come at this differently.', 'Different angle —', 'Shifting focus slightly —'],
  challenge:      ['Give me the specifics.', 'Be more concrete.', 'Back to the example —'],
  steer:          ['Let me pull on something else.', "There's another thread here.", ''],
  drill_depth:    ['Go tighter on that.', 'Be more specific.', 'Drill into that —'],
};
const NEUTRAL_OPENERS = ['Right.', 'Got it.', 'Okay.', 'Noted.', 'Clear.'];
let _openerTurnIndex = 0;
function pickReactiveOpener(strategy: ProbeStrategy): string {
  const pool = REACTIVE_OPENER_POOL[strategy] ?? NEUTRAL_OPENERS;
  return pool[(_openerTurnIndex++) % pool.length]!;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env var: ${name}`); process.exit(1); }
  return v;
}

// ── Session control intent detection ────────────────────────────────────────

type SessionControlIntent = 'pause' | 'resume' | 'finish_later' | 'end_now' | null;

function detectSessionControlIntent(text: string): SessionControlIntent {
  const t = text.toLowerCase().trim();

  // "finish later / come back tomorrow / continue another time"
  if (
    /\b(finish (this |it )?(later|tomorrow|another (time|day))|come back (later|tomorrow|another (time|day))|continue (later|tomorrow|another (time|day))|pick (this |it )?up (later|tomorrow|another (time|day))|do (this |it )?(later|another time|tomorrow)|pick up (where|this) .*(later|tomorrow)|resume (later|tomorrow))\b/.test(t) ||
    /(save (my |our )?(progress|place)|save (where|this)|i'll (be back|continue later|finish (this |it )?later|come back))\b/.test(t)
  ) {
    return 'finish_later';
  }

  // "stop / end / that's enough / we're done"
  if (
    /\b(stop (the |this )?(session|interview|call|recording)|end (the |this )?(session|interview|call)|i('?m| am) done|we('?re| are) done|that'?s enough|let'?s (stop|end|wrap up|finish (here|now|up))|i want to stop|i('?d| would) like to stop|finish (here|now|up)|no more questions)\b/.test(t)
  ) {
    return 'end_now';
  }

  // "pause / take a break / give me a minute / hold on"
  if (
    /\b(pause|take a break|need a break|give me a (minute|moment|second|sec)|hold on|just a (minute|moment|second|sec)|one (minute|moment|second|sec)|i need to (step away|stop for a moment|take a break)|can we (pause|take a break|stop for a (minute|moment))|be right back|brb)\b/.test(t)
  ) {
    return 'pause';
  }

  // "ready to continue / let's go again / pick it back up"
  if (
    /\b(ready to (continue|go|start again|pick up|resume)|let'?s (continue|go again|pick (it |this )?back up|carry on|resume)|i'?m back|back now|ready when you are|let'?s (get back|go back) (to it|to this))\b/.test(t)
  ) {
    return 'resume';
  }

  return null;
}

// Phase display names for progress labels
const PHASE_DISPLAY_NAMES: Record<string, string> = {
  people:          'People and Capability',
  operations:      'Operations and Delivery',
  technology:      'Technology Credibility',
  commercial:      'Commercial Positioning',
  customer:        'Customer Relationships',
  risk_compliance: 'Risk and Compliance',
  partners:        'Partner Relationships',
};

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('EthentaFlow server. Connect via WebSocket at /ws.\n');
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws, req) => {
  const wsUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const workshopId = wsUrl.searchParams.get('workshop_id') ?? undefined;
  console.log('[conn] new session', workshopId ? `workshop=${workshopId}` : '(no workshop)');
  void handleSession(ws, workshopId).catch(err => console.error('[session] fatal', err));
});

/**
 * Fetch prep questions from the DREAM app for a given workshop.
 * Returns a map of lens → question texts, or null if unavailable.
 */
async function fetchDreamPrepQuestions(workshopId: string): Promise<Record<string, string[]> | null> {
  const dreamUrl = process.env['DREAM_API_URL'];
  const dreamSecret = process.env['DREAMFLOW_SECRET'];
  if (!dreamUrl || !dreamSecret) return null;
  try {
    const url = `${dreamUrl.replace(/\/$/, '')}/api/public/workshops/${workshopId}/dreamflow-questions`;
    const res = await fetch(url, {
      headers: { 'x-dreamflow-secret': dreamSecret },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[dream] prep-questions fetch failed: ${res.status}`);
      return null;
    }
    const json = await res.json() as { questions?: Record<string, string[]> };
    return json.questions ?? null;
  } catch (err) {
    console.warn('[dream] prep-questions fetch error:', err);
    return null;
  }
}

async function handleSession(ws: WebSocket, workshopId?: string): Promise<void> {
  const state = new SessionState();
  const detector = new EndpointDetector();
  const classifier = new SignalClassifier(OPENAI_API_KEY);
  const probeEngine = new ProbeEngine(OPENAI_API_KEY);
  const depthScorer = new DepthScorer(OPENAI_API_KEY);
  const onboardingAgent = new OnboardingAgent(OPENAI_API_KEY);
  const truthExtractor = new TruthExtractor(OPENAI_API_KEY);
  let lensController = new LensController(DEFAULT_LENS_SEQUENCE);
  const semanticChecker = new SemanticCompletenessChecker(OPENAI_API_KEY);
  // Used for the onboarding phase only — the agentic interview path bypasses this entirely.
  const controller = new DecisionController(semanticChecker, depthScorer, probeEngine);
  const capture = startCapture(state.sessionId);

  const sessionStartedAt = Date.now();
  function elapsedMinutes(): number {
    return (Date.now() - sessionStartedAt) / 60000;
  }

  // ── Agentic session state ──────────────────────────────────────────────────
  let agenticCurrentPhase = 'people';
  let agenticPhaseOrder: string[] = ['people', 'operations', 'technology', 'commercial', 'customer', 'partners', 'summary'];
  let agenticSessionMessages: SessionMessage[] = [];
  let agenticSessionComplete = false;
  let agenticPhaseStartTimes = new Map<string, number>();
  let agenticIncludeRegulation = false;
  // Per-lens questions from DREAM prep — overrides PHASE_QUESTIONS when set.
  let sessionQuestions: Partial<Record<string, import('./phase-questions.js').FixedQuestion[]>> = {};

  /**
   * Returns true if the current phase has NOT yet received a participant answer.
   * Used as the Q1 measurement gate — we wait for triple rating numbers before advancing.
   */
  function isWaitingForTripleRating(): boolean {
    return agenticSessionMessages.filter(
      m => m.role === 'PARTICIPANT' && m.phase === agenticCurrentPhase,
    ).length === 0;
  }

  /** Returns the question list for a lens — custom prep questions take priority over built-ins. */
  function lensQuestions(lens: string): import('./phase-questions.js').FixedQuestion[] {
    return (sessionQuestions[lens] ?? PHASE_QUESTIONS[lens as keyof typeof PHASE_QUESTIONS]) ?? [];
  }

  /** Build sectionStartTimes array aligned to agenticPhaseOrder (excluding 'summary'). */
  function getSectionStartTimes(): number[] {
    return agenticPhaseOrder
      .filter(p => p !== 'summary')
      .map(p => agenticPhaseStartTimes.get(p) ?? 0);
  }

  /** Emit a coverage_update message to the client. */
  function emitCoverageUpdate(): void {
    const sections = lensController.getAllCoverage();
    const totalPct = sections.length > 0
      ? Math.round(sections.reduce((sum, s) => sum + s.pct, 0) / sections.length)
      : 0;
    const currentIdx = sections.findIndex(s => s.isCurrent);
    send({
      type: 'coverage_update',
      sections,
      currentSection: currentIdx >= 0 ? currentIdx + 1 : 1,
      totalSections: sections.length,
      totalPct,
      sectionStartTimes: getSectionStartTimes(),
    });
  }

  /** Emit an interview_progress message to the client. */
  function emitProgressUpdate(): void {
    if (agenticSessionComplete) return;
    const lensPhases = agenticPhaseOrder.filter(p => p !== 'summary');
    const phaseIdx = lensPhases.indexOf(agenticCurrentPhase);
    const sectionIndex = Math.max(1, phaseIdx + 1);
    const participantAnswersInPhase = agenticSessionMessages.filter(
      m => m.role === 'PARTICIPANT' && m.phase === agenticCurrentPhase,
    ).length;
    const questionIndex = participantAnswersInPhase + 1;
    const sectionName = PHASE_DISPLAY_NAMES[agenticCurrentPhase] ?? agenticCurrentPhase;
    const progressLabel = `S${sectionIndex}/${lensPhases.length} Q${questionIndex}`;
    const sectionStartedAt = agenticPhaseStartTimes.get(agenticCurrentPhase) ?? 0;
    send({
      type: 'interview_progress',
      sectionIndex,
      questionIndex,
      sectionName,
      progressLabel,
      sectionStartedAt,
    });
  }

  let lastProbeText: string | null = null;
  let lastProbeStrategy: ProbeStrategy = 'onboarding';
  let currentEndpointingMode: EndpointingMode = 'long_thought';
  let currentExpectedAnswerType: ExpectedAnswerType = 'open_explanation';
  let activeTts: { abort: () => void } | null = null;
  let ttsStartedAt = 0;               // wall-clock ms when current TTS stream began
  let lastTtsEndedAt = 0;             // wall-clock ms when the most recent TTS stream stopped
  const BARGEIN_GRACE_MS = 2000;      // hard floor: no interruptions in the first 2s of TTS
  const POST_TTS_BARGEIN_TAIL_MS = 1500;
  const INTENTIONAL_INTERRUPT_RE = /\b(stop|wait|hold on|pause|move on|next (question|topic|one)|skip (this|that|it)|i don'?t know|i'?ve answered|let'?s move|enough|that'?s enough|never mind|nevermind|i('?ve)? told you|i already (said|told|answered))\b/i;
  const REPEAT_RE = /\b(say (that|it|the question)? again|repeat( that| it| the question| please)?|come again|could you repeat|can you repeat|once more|one more time|what did you say|i didn'?t (catch|hear|get) (that|it)|sorry,? what|sorry,? again|pardon( me)?|run that by me again)\b/i;
  const FILLER_RE = /^(uh+|um+|hm+|mm+|ah+|oh+|er+|the|a|an|and|so|you know|like|right|okay)(\s+(uh+|um+|hm+|mm+|ah+|oh+|er+|the|a|an|and|so|like))*[.,!?]?$/i;
  let consecutiveBargeinAborts = 0;
  let strictBargeinConfidenceFloor = 0.75;
  let endpointHandling = false;
  // Optional callback fired once the current TTS stream ends naturally (not on abort).
  // Used to chain a follow-on probe (e.g. Q1 after the intro) without combining them
  // into a single TTS block.
  let afterTtsCallback: (() => void) | null = null;
  // When afterTtsCallback is set, we do NOT fire it when the server TTS stream ends.
  // Instead, we park it here and fire it only when the client sends 'playback_done'
  // (i.e. audio has actually finished playing, including buffer draining + 350ms echo holdoff).
  // This ensures Q1 text/scoring card appear on screen at the moment Q1 audio starts,
  // not 20-30 seconds early while intro is still playing.
  let pendingAfterTtsCallback: (() => void) | null = null;

  // Live eval cache — computed in the pause callback WHILE the speaker pauses,
  // consumed in the endpoint handler with zero additional latency.
  let cachedLiveEval: LiveEval | null = null;

  // ── Streaming cognition ─────────────────────────────────────────────────────
  // As Deepgram finals accumulate, we start liveEval() in background as soon as
  // we have enough words. By the time the speaker pauses, the LLM decision is
  // often already done — the pause callback just awaits the already-running promise
  // instead of starting a cold LLM call.
  let earlyEvalPromise: Promise<LiveEval> | null = null;
  let earlyEvalTranscript = '';   // what we sent to the early eval
  let streamTranscriptBuffer = ''; // running finals from Deepgram

  // ── Speculative turn-decision pre-fire ──────────────────────────────────────
  // generateAgenticTurn (gpt-4o) is the main latency bottleneck — 1–3 s cold.
  // We start it in the pause callback once liveEval confirms the answer is
  // complete, using a snapshot of session messages that includes the current
  // transcript as the (not-yet-committed) participant answer.
  // The endpoint handler awaits the cached promise instead of starting a new call.
  // Hard timeout: 2 s — if the LLM hasn't replied by then we fall through to a
  // synchronous call so TTS never waits more than 2 s for this cache.
  const SPECULATIVE_TIMEOUT_MS = 2000;
  let speculativeAgenticPromise: Promise<import('./agentic-turn.js').AgenticTurnResult | null> | null = null;
  let speculativeAgenticTranscript = ''; // transcript that seeded the pre-fire
  let speculativeAgenticStale = false;   // true when new speech arrived after pre-fire

  // ── Settle window state ─────────────────────────────────────────────────────
  let settleActive = false;       // true while the 1500ms settle window is running
  let settleAbortedFlag = false;  // set when new speech arrives during settle
  // When settle aborts, we park the pending probe here so a retry timer can
  // speak it if no new endpoint fires within SETTLE_RETRY_MS.
  let pendingSettleProbe: {
    text: string; strategy: ProbeStrategy;
    endpointingMode: EndpointingMode; expectedAnswerType: ExpectedAnswerType;
    source: string; persist: boolean;
    meta?: { phase: string; metadata: Record<string, unknown> } | undefined;
  } | null = null;
  let settleRetryTimer: NodeJS.Timeout | null = null;
  const SETTLE_RETRY_MS = 4000; // if no new endpoint after abort, speak the probe

  function markTtsEnded(resetBargeinCounter = false): void {
    lastTtsEndedAt = Date.now();
    if (resetBargeinCounter) consecutiveBargeinAborts = 0;
  }

  function finishTtsPlayback(resetBargeinCounter = false): void {
    markTtsEnded(resetBargeinCounter);
    send({ type: 'tts_end' });
    detector.onSystemSpeakingEnd();
  }

  function confirmBargeinAbort(logLine: string): void {
    if (!activeTts) return;
    console.log(logLine);
    activeTts.abort();
    activeTts = null;
    finishTtsPlayback(false);
    endpointHandling = false;
    consecutiveBargeinAborts += 1;
    if (consecutiveBargeinAborts >= 2 && strictBargeinConfidenceFloor < 0.85) {
      strictBargeinConfidenceFloor = 0.85;
      console.log('[bargein] strict floor escalated to 0.85');
    }
  }

  function evaluateBargeinTranscript(
    transcript: string,
    words: Array<{ word?: string; confidence?: number }>,
  ): { intercept: boolean; abortConfirmed: boolean } {
    const trimmed = transcript.trim();
    if (!trimmed) return { intercept: false, abortConfirmed: false };

    const now = Date.now();
    const inActiveTtsWindow = activeTts !== null;
    const inPostTtsTail = !inActiveTtsWindow && lastTtsEndedAt > 0 && now - lastTtsEndedAt <= POST_TTS_BARGEIN_TAIL_MS;
    if (!inActiveTtsWindow && !inPostTtsTail) {
      return { intercept: false, abortConfirmed: false };
    }

    if (inActiveTtsWindow && now - ttsStartedAt < BARGEIN_GRACE_MS) {
      console.log('[bargein] within 2s grace — ignored');
      return { intercept: true, abortConfirmed: false };
    }

    const transcriptWords = trimmed
      .split(/\s+/)
      .map(word => word.replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, ''))
      .filter(Boolean);
    const wordCount = transcriptWords.length;
    const confidenceValues = words
      .filter(word => /[a-z0-9]/i.test(word.word ?? '') && typeof word.confidence === 'number')
      .map(word => word.confidence as number);
    const averageWordConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length
      : 0;
    const confLabel = averageWordConfidence.toFixed(2);

    if (INTENTIONAL_INTERRUPT_RE.test(trimmed)) {
      const logLine = `[bargein] intentional stop: ${JSON.stringify(trimmed)}`;
      if (inActiveTtsWindow) {
        confirmBargeinAbort(logLine);
        return { intercept: false, abortConfirmed: true };
      }
      console.log(logLine);
      return { intercept: false, abortConfirmed: false };
    }

    if (wordCount >= 3 && averageWordConfidence >= strictBargeinConfidenceFloor && !FILLER_RE.test(trimmed)) {
      const logLine = `[bargein] substantive speech (words=${wordCount} conf=${confLabel}): ${JSON.stringify(trimmed)}`;
      if (inActiveTtsWindow) {
        confirmBargeinAbort(logLine);
        return { intercept: false, abortConfirmed: true };
      }
      console.log(logLine);
      return { intercept: false, abortConfirmed: false };
    }

    console.log(`[bargein] rejected — ambient or below threshold (words=${wordCount} conf=${confLabel}): ${JSON.stringify(trimmed)}`);
    return { intercept: true, abortConfirmed: false };
  }

  // ── Per-turn & frustration state ────────────────────────────────────────────
  let frustrationPending = false; // set by pause callback; cleared by endpoint handler
  let currentTurnId = 0;          // incremented each endpoint — guards single-speak

  // ── Liveness watchdog timestamps ────────────────────────────────────────────
  let lastUserSpeechAt = 0;   // ms since epoch; updated on every non-empty transcript
  let lastAgentSpeechAt = 0;  // ms since epoch; updated when TTS audio starts and ends
  let livenessInterval: NodeJS.Timeout | null = null;

  // ── Canonical question tracking ──────────────────────────────────────────────
  // Holds the last emitted canonical payload so watchdog re-presentations can
  // reuse the same questionId without rebuilding.
  let lastCanonicalPayload: AskQuestionPayload | null = null;

  const lensExplorationStartedAt = new Map<string, number>();

  function saveSessionToDisk(): void {
    try {
      mkdirSync(SESSION_SAVE_DIR, { recursive: true });
      const data = {
        sessionId: state.sessionId,
        savedAt: Date.now(),
        participantName,
        participantTitle,
        progressSnapshot: lensController.toJSON(),
        agenticState: {
          currentPhase: agenticCurrentPhase,
          phaseOrder: agenticPhaseOrder,
          phaseStartTimes: Object.fromEntries(agenticPhaseStartTimes),
          messageCount: agenticSessionMessages.length,
          messages: agenticSessionMessages,
        },
        lastProbeText,
      };
      writeFileSync(`${SESSION_SAVE_DIR}/${state.sessionId}.json`, JSON.stringify(data, null, 2));
      console.log(`[session] saved → ${SESSION_SAVE_DIR}/${state.sessionId}.json`);
    } catch (err) {
      console.error('[session] save failed', err);
    }
  }

  let sessionPaused = false;

  let silenceWatchdogTimer: NodeJS.Timeout | null = null;
  const SILENCE_WATCHDOG_MS = 10000; // 10s — intervene faster if user goes silent

  function normaliseSpokenRatingDigits(text: string): string {
    return text
      .replace(/\bone\b/gi, '1')
      .replace(/\btwo\b/gi, '2')
      .replace(/\bthree\b/gi, '3')
      .replace(/\bfour\b/gi, '4')
      .replace(/\bfive\b/gi, '5');
  }

  function extractRatingDigits(text: string): number[] {
    return [...normaliseSpokenRatingDigits(text).matchAll(/\b([1-5])\b/g)].map(match => parseInt(match[1]!, 10));
  }

  function armSilenceWatchdog(): void {
    // Disabled — agent never re-asks unprompted. Only re-speaks on explicit user request.
  }

  function cancelSilenceWatchdog(): void {
    if (silenceWatchdogTimer) { clearTimeout(silenceWatchdogTimer); silenceWatchdogTimer = null; }
  }

  // ── safeSpeak — single chokepoint in front of TTS ───────────────────────────
  // Maintains a ring of the last 3 spoken strings. If the proposed text is a
  // near-duplicate (bigram Jaccard > 0.85) of any entry spoken within 20s:
  //   isRecovery=true  → prefix "Let me ask that again — " and speak
  //   isRecovery=false → suppress entirely and log
  // Otherwise delegates to speakProbe and pushes to the ring.

  type SpokenEntry = { norm: string; time: number };
  const recentSpokenRing: SpokenEntry[] = [];
  const RING_SIZE = 3;
  const RING_WINDOW_MS = 20_000;
  const DEDUP_SIM_THRESHOLD = 0.85;

  function normForRing(text: string): string {
    return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  function bigramJaccard(a: string, b: string): number {
    const bigrams = (s: string): Set<string> => {
      const result = new Set<string>();
      const words = s.split(' ');
      for (let i = 0; i < words.length - 1; i++) result.add(`${words[i]} ${words[i + 1]}`);
      if (result.size === 0 && words.length === 1) result.add(words[0]!);
      return result;
    };
    const sa = bigrams(a); const sb = bigrams(b);
    let inter = 0;
    for (const g of sa) if (sb.has(g)) inter++;
    const union = sa.size + sb.size - inter;
    return union === 0 ? 0 : inter / union;
  }

  async function safeSpeak(
    text: string,
    strategy: ProbeStrategy,
    endpointMode: EndpointingMode,
    answerType: ExpectedAnswerType,
    source: string,
    isRecovery = false,
    persist?: { phase: string; metadata: unknown; content?: string },
    prebuiltPayload?: AskQuestionPayload,
  ): Promise<void> {
    const now = Date.now();
    const norm = normForRing(text);
    const recent = recentSpokenRing.filter(e => now - e.time < RING_WINDOW_MS);
    const maxSim = recent.reduce((max, e) => Math.max(max, bigramJaccard(norm, e.norm)), 0);

    console.log(`[speak] source=${source} id=t${currentTurnId} sim=${maxSim.toFixed(2)} persist=${!!persist} text="${text.slice(0, 60)}"`);

    if (maxSim > DEDUP_SIM_THRESHOLD) {
      if (isRecovery) {
        const prefixed = text.startsWith('Let me ask that again') ? text : `Let me ask that again — ${text}`;
        const prefixedNorm = normForRing(prefixed);
        recentSpokenRing.push({ norm: prefixedNorm, time: now });
        if (recentSpokenRing.length > RING_SIZE) recentSpokenRing.shift();
        if (persist) {
          agenticSessionMessages.push({ role: 'AI', content: persist.content ?? prefixed, phase: persist.phase, metadata: persist.metadata, createdAt: new Date() });
        }
        // Re-presentation of same question: emit question_presented with the existing
        // canonical payload (same questionId — not a new question, just re-asked).
        const repayload = prebuiltPayload ?? lastCanonicalPayload;
        if (repayload) {
          send({ type: 'question_presented', payload: repayload });
        }
        await speakProbe(prefixed, strategy, endpointMode, answerType, true);
      } else {
        console.log(`[safeSpeak] SUPPRESSED near-duplicate (sim=${maxSim.toFixed(2)}) text="${text.slice(0, 60)}"`);
      }
      return;
    }

    recentSpokenRing.push({ norm, time: now });
    if (recentSpokenRing.length > RING_SIZE) recentSpokenRing.shift();
    if (persist) {
      agenticSessionMessages.push({ role: 'AI', content: persist.content ?? text, phase: persist.phase, metadata: persist.metadata, createdAt: new Date() });
    }

    // ── Canonical lifecycle events ──────────────────────────────────────────
    if (prebuiltPayload) {
      // Deferred intro path: question_created already fired at decision time;
      // safeSpeak fires question_presented now that audio is about to play.
      lastCanonicalPayload = prebuiltPayload;
      send({ type: 'question_presented', payload: prebuiltPayload });
    } else if (persist && CANONICAL_SOURCES.has(source)) {
      // Normal canonical question: build payload, create, then present.
      const payload = buildQuestionPayload(source, text, strategy, endpointMode, answerType, persist);
      lastCanonicalPayload = payload;
      send({ type: 'question_created',   payload });
      send({ type: 'question_presented', payload });
    } else if ((source === 'silence-watchdog' || source === 'liveness-watchdog') && lastCanonicalPayload) {
      // Watchdog re-presentation of the most recent canonical question.
      // Skip question_created — the question already exists; only re-present it.
      // If there is no prior canonical question, emit nothing.
      send({ type: 'question_presented', payload: lastCanonicalPayload });
    }
    // All other sources (session-control, onboarding-followup, resume-welcome,
    // liveness-watchdog ack path): no canonical emission.

    // safeSpeak is the authoritative dedup layer (bigram ring); always force
    // speakProbe to deliver — state.trackProbe's exact-string gate must not
    // silently drop a call that the ring already permitted.
    await speakProbe(text, strategy, endpointMode, answerType, true);
  }

  // ── Liveness recovery ───────────────────────────────────────────────────────
  // Called by the 250ms watchdog when the participant has spoken but the agent
  // has not responded within 6s. Bypasses ALL gates (settle, dedup, noise, LLM).
  async function forceLivenessRecovery(): Promise<void> {
    const sinceUser = Date.now() - lastUserSpeechAt;
    const sinceAgent = Date.now() - lastAgentSpeechAt;
    console.error(`[liveness] INVARIANT VIOLATED — forcing recovery (${sinceUser}ms since user, ${sinceAgent}ms since agent)`);

    // Update timestamps immediately so the watchdog doesn't double-fire.
    lastAgentSpeechAt = Date.now();
    lastUserSpeechAt = lastAgentSpeechAt;

    // Clear all in-flight state so speakProbe can proceed.
    speculativeAgenticPromise = null;
    speculativeAgenticStale = false;
    endpointHandling = false;
    settleAbortedFlag = true;
    settleActive = false;
    detector.discard();

    // Recovery cascade:
    // Rule: NEVER repeat a probe the participant has already answered.
    //   "nothing said" = no participant turns in this phase yet.
    //   If the participant has spoken, always move forward — not backwards.
    const participantTurnsInPhase = agenticSessionMessages.filter(
      m => m.role === 'PARTICIPANT' && m.phase === agenticCurrentPhase,
    ).length;
    const nothingSaidYet = participantTurnsInPhase === 0;

    // (1) repeat last probe ONLY if the participant hasn't answered yet
    if (lastProbeText && !agenticSessionComplete && nothingSaidYet) {
      console.log('[liveness] recovery=repeat (nothing said yet)');
      await safeSpeak(lastProbeText, lastProbeStrategy, currentEndpointingMode, currentExpectedAnswerType, 'liveness-watchdog', true);
      return;
    }
    // (2) next unused guide question in current phase
    const usedAiIndexes = new Set(
      agenticSessionMessages
        .filter((m) => m.role === 'AI' && m.phase === agenticCurrentPhase)
        .map((m) => { const meta = m.metadata as Record<string, unknown> | null; return typeof meta?.index === 'number' ? meta.index : -1; }),
    );
    const nextQ = (lensQuestions(agenticCurrentPhase) ?? []).find((_, i) => i > 0 && !usedAiIndexes.has(i));
    if (nextQ) {
      console.log('[liveness] recovery=next-q');
      await safeSpeak(nextQ.text, 'drill_depth', 'long_thought', 'open_explanation', 'cascade-1', false,
        { phase: agenticCurrentPhase, metadata: { kind: 'question', deliveryMode: 'liveness-recovery' } });
      return;
    }
    // (3) next phase opener
    const nextPhaseIdx = agenticPhaseOrder.indexOf(agenticCurrentPhase) + 1;
    if (nextPhaseIdx > 0 && nextPhaseIdx < agenticPhaseOrder.length) {
      const nextPhase = agenticPhaseOrder[nextPhaseIdx]!;
      const nextOpener = lensQuestions(nextPhase)?.[0];
      if (nextOpener && nextPhase !== 'summary') {
        console.log(`[liveness] recovery=next-phase (${nextPhase})`);
        const nextText = formatTripleRatingPrompt(nextOpener.text);
        lensController.advanceLens();
        agenticCurrentPhase = nextPhase;
        agenticPhaseStartTimes.set(nextPhase, Date.now());
        await state.setLens(nextPhase as Lens);
        send({ type: 'lens_phase', lens: nextPhase as Lens, phase: 'measurement' });
        send({ type: 'measure_prompt', lens: nextPhase as Lens, question: nextText });
        emitProgressUpdate(); emitCoverageUpdate();
        await safeSpeak(`Let me move on. ${nextText}`, 'measure', 'long_thought', 'open_explanation', 'cascade-2', false,
          { phase: nextPhase, metadata: { kind: 'question', tag: 'triple_rating', index: 0, phase: nextPhase, deliveryMode: 'liveness-recovery' }, content: nextText });
        return;
      }
    }
    // (4) acknowledge and close
    console.log('[liveness] recovery=acknowledge');
    await safeSpeak("Got it — let me move on.", 'close', 'long_thought', 'open_explanation', 'liveness-watchdog');
  }

  let participantName: string | undefined;
  let participantTitle: string | undefined;

  let deepgramReady = false;
  let startReceived = false;

  function fireWelcome(): void {
    if (state.openingDone) return;
    state.markOpeningDone();

    // ── Resume path ─────────────────────────────────────────────────────────
    if (state.onboardingDone) {
      const currentLensLabel = lensController.currentLens.replace('_', ' and ');
      const resumeText = participantName
        ? `Welcome back ${participantName}. We left off on ${currentLensLabel}. Let's pick up from there — just carry on when you're ready.`
        : `Welcome back. We left off on ${currentLensLabel}. Let's pick up from there — just carry on when you're ready.`;
      void safeSpeak(resumeText, 'onboarding', 'long_thought', 'open_explanation', 'resume-welcome');
      console.log(`[opening] resume welcome sent, phase=${agenticCurrentPhase}`);
      return;
    }

    // ── Known-participant fast path ──────────────────────────────────────────
    // If name and title arrived via URL params we already have everything we
    // need. Skip the full onboarding LLM loop (which adds ~30 s of welcome
    // speech before Q1 starts) and go straight to the first lens question.
    if (participantName && participantTitle) {
      console.log(`[opening] known-participant fast path — skipping onboarding, participant=${participantName}, title=${participantTitle}`);
      state.markOnboardingDone();
      onboardingAgent.setParticipantContext({ name: participantName, jobTitle: participantTitle });
      onboardingAgent.setLenses(lensController.getAllProgress().map(p => p.lens as Exclude<Lens, 'open'>));

      const firstLens = lensController.currentLens;
      agenticCurrentPhase = firstLens;
      void state.setLens(firstLens);
      send({ type: 'lens_phase', lens: firstLens as Lens, phase: 'measurement' });

      const q1Text = formatTripleRatingPrompt(lensQuestions(firstLens)?.[0]?.text ?? '');
      agenticPhaseStartTimes.set(firstLens, Date.now());
      // Emit question_created NOW (decision time) before intro audio starts.
      // question_presented fires later from inside the afterTtsCallback, at the
      // moment the client is ready to render (after playback_done).
      const q1Persist = { phase: firstLens, metadata: { kind: 'question', tag: 'triple_rating', index: 0, phase: firstLens, deliveryMode: 'agentic' } };
      const q1Payload = buildQuestionPayload('onboarding-bridge', q1Text, 'measure', 'long_thought', 'open_explanation', q1Persist);
      send({ type: 'question_created', payload: q1Payload });
      // Greeting: voice-only (no on-screen transcript entry).
      // measure_prompt + Q1 are deferred to afterTtsCallback so they appear on screen
      // only when client playback of the intro has actually finished (not when the server
      // stream ends, which can be 20-30s before the audio finishes playing on the client).
      const firstName = participantName?.split(' ')[0] ?? participantName;
      const intro = `Hi ${firstName}, thanks for making the time. I really appreciate it. We'll work through five areas of your business today. It should take around twenty to thirty minutes. There are no right answers here, just honest ones. Let's get started.`;
      afterTtsCallback = () => {
        send({ type: 'measure_prompt', lens: firstLens as Lens, question: q1Text });
        emitProgressUpdate();
        emitCoverageUpdate();
        void safeSpeak(q1Text, 'measure', 'long_thought', 'open_explanation', 'onboarding-bridge', false, q1Persist, q1Payload);
      };
      void speakIntro(intro);
      return;
    }

    // ── Full onboarding path (name/title unknown) ────────────────────────────
    const welcome = buildWelcome(participantName, lensController.getAllProgress().map(p => p.lens as Exclude<Lens, 'open'>));
    onboardingAgent.setParticipantContext({ name: participantName, jobTitle: participantTitle });
    onboardingAgent.setLenses(lensController.getAllProgress().map(p => p.lens as Exclude<Lens, 'open'>));
    onboardingAgent.recordOpening(welcome);
    void safeSpeak(welcome, 'onboarding', 'long_thought', 'open_explanation', 'onboarding-followup');
    console.log('[opening] welcome sent, participant=' + (participantName ?? '(anon)'));
  }

  let primarySpeakerId: number | null = null;

  function isFromPrimarySpeaker(words: Array<{ speaker?: number }>): boolean {
    if (!words.length) return true;

    const counts = new Map<number, number>();
    for (const w of words) {
      if (w.speaker !== undefined) {
        counts.set(w.speaker, (counts.get(w.speaker) ?? 0) + 1);
      }
    }
    if (counts.size === 0) return true;

    let majoritySpeaker = 0;
    let maxCount = 0;
    for (const [id, count] of counts) {
      if (count > maxCount) { maxCount = count; majoritySpeaker = id; }
    }

    if (primarySpeakerId === null) {
      primarySpeakerId = majoritySpeaker;
      console.log(`[speaker] locked onto speaker ${primarySpeakerId}`);
    }

    if (majoritySpeaker !== primarySpeakerId) {
      console.log(`[speaker] ignoring speaker ${majoritySpeaker} (locked on ${primarySpeakerId})`);
      return false;
    }
    return true;
  }

  const send = (msg: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  const sendBinary = (chunk: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(chunk, { binary: true });
    }
  };

  let lastStateEmit = 0;
  const emitStateUpdate = () => {
    const now = Date.now();
    if (now - lastStateEmit < 200) return;
    lastStateEmit = now;
    const snap = state.snapshot();
    send({
      type: 'state_update',
      state: {
        currentLens: snap.currentLens,
        currentSignal: snap.currentSignal,
        signalStack: snap.signalStack,
        depthScore: snap.depthScore,
        exampleProvided: snap.exampleProvided,
        pendingProbe: snap.pendingProbe,
        liveUtterance: snap.liveUtterance,
      },
    });
  };

  const OPENER_STRATEGIES: ReadonlySet<ProbeStrategy> = new Set([
    'gap_probe', 'evidence_probe', 'barrier_probe', 'impact_probe',
    'drill_depth', 'challenge', 'steer', 'sideways',
  ]);

  /**
   * Speak a voice-only intro (greeting / preamble).
   * Does NOT emit a 'probe' event so nothing appears in the on-screen transcript.
   * Does NOT update lastProbeText / dedup state — the watchdog will re-ask the
   * FIRST real probe, not the greeting.
   * Fires afterTtsCallback when audio ends (same as speakProbe).
   */
  async function speakIntro(text: string): Promise<void> {
    const spokenText = relaxText(text);
    send({ type: 'tts_start' });
    ttsStartedAt = Date.now();
    detector.onSystemSpeakingStart();
    semanticChecker.reset();
    const tts = synthesiseStream(ELEVENLABS_API_KEY, spokenText, chunk => {
      sendBinary(chunk);
      capture.writeSystemAudio(chunk);
    });
    activeTts = tts;
    tts.done.then(() => {
      if (activeTts === tts) {
        activeTts = null;
        finishTtsPlayback(true);
        primarySpeakerId = null;
        if (afterTtsCallback) {
          const fn = afterTtsCallback;
          afterTtsCallback = null;
          // Park until client signals audio has actually finished playing.
          pendingAfterTtsCallback = fn;
        } else {
          armSilenceWatchdog();
        }
      }
    });
  }

  async function speakProbe(
    probeText: string,
    probeStrategy: ProbeStrategy,
    endpointingMode: EndpointingMode = 'long_thought',
    expectedAnswerType: ExpectedAnswerType = 'open_explanation',
    forceResend = false,
  ): Promise<void> {
    // Relax BEFORE dedup check so trackProbe always sees the canonical spoken form.
    // Previously trackProbe saw raw text, but lastProbeText stored relaxed text —
    // the watchdog re-call would pass relaxed text which never matched the raw entry.
    probeText = relaxText(probeText);
    // Always register in recentProbes; skip delivery only if it's a duplicate AND
    // we're not forcing a resend (watchdog re-asks must always go through).
    const isDuplicate = state.trackProbe(probeText);
    if (isDuplicate && !forceResend) {
      console.log('[probe] skipping duplicate probe');
      return;
    }
    lastProbeText = probeText;
    lastProbeStrategy = probeStrategy;
    currentEndpointingMode = endpointingMode;
    currentExpectedAnswerType = expectedAnswerType;

    const addOpener = OPENER_STRATEGIES.has(probeStrategy) && state.snapshot().turns.length >= 3;
    const spokenText = addOpener ? `${pickReactiveOpener(probeStrategy)} ${probeText}` : probeText;

    send({ type: 'probe', text: probeText, strategy: probeStrategy });
    send({ type: 'tts_start' });
    ttsStartedAt = Date.now();
    detector.onSystemSpeakingStart();
    semanticChecker.reset();
    detector.setEndpointingMode(endpointingMode);
    const tts = synthesiseStream(ELEVENLABS_API_KEY, spokenText, chunk => {
      if (lastAgentSpeechAt === 0 || lastAgentSpeechAt < ttsStartedAt) lastAgentSpeechAt = Date.now();
      sendBinary(chunk);
      capture.writeSystemAudio(chunk);
    });
    activeTts = tts;
    tts.done.then(() => {
      lastAgentSpeechAt = Date.now();
      if (activeTts === tts) {
        activeTts = null;
        finishTtsPlayback(true);
        // Reset speaker lock — Deepgram may reassign speaker IDs during TTS.
        primarySpeakerId = null;
        // Fire any chained follow-on probe BEFORE arming the watchdog so the
        // watchdog timer starts from the end of the follow-on, not this one.
        if (afterTtsCallback) {
          const fn = afterTtsCallback;
          afterTtsCallback = null;
          // Park until client signals audio has actually finished playing.
          pendingAfterTtsCallback = fn;
        } else {
          armSilenceWatchdog();
        }
      }
    });
  }

  // Wire the DecisionController into the detector via the pause callback
  detector.setPauseCallback(async (transcript: string, source: string): Promise<'commit' | 'wait' | 'discard'> => {
    if (endpointHandling) {
      console.log(`[decision] DROPPED pause callback (endpoint handler busy): "${transcript.slice(0, 60)}"`);
      return 'discard';
    }

    const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 1).length;
    // Short utterances are noise unless they're defensive/reactive short answers.
    // "I've just told you", "yes", "no", "same", "move on" are complete turns,
    // not background noise — they must reach the decision layer.
    // ── Frustration: checked BEFORE noise filter so short phrases aren't discarded ─
    const FRUSTRATION_RE = /\b(you('?re| are) killing me|stop drilling|enough( already)?|next question|i('?ve)?( already)? answered|stop( it)?|got it already|i told you|asked already|answered already|that'?s enough|please move on|come on|jesus|christ|for fuck'?s sake)\b/i;
    if (state.onboardingDone && FRUSTRATION_RE.test(transcript.trim())) {
      console.log(`[frustration] detected — will force-advance: "${transcript.slice(0, 60)}"`);
      frustrationPending = true;
      return 'commit';
    }

    const DEFENSIVE_UTT_RE =
      /\b(i('?ve)?( just)? (told|said|answered|covered|explained|addressed)|i already (said|told|answered|covered)|i just (said|told|answered)|move on|next (question|topic)|let'?s move|skip (this|that|it)|pass|i don'?t know|not sure|nothing (else|more|to add)|that'?s (all|it)|same (as before|thing)|yes|no|nope|yeah|sure|agreed|already|exactly)\b/i;
    const isDefensiveUtt = DEFENSIVE_UTT_RE.test(transcript.trim());
    const waitingForTripleRating = isWaitingForTripleRating() && state.onboardingDone;
    if (wordCount < 5 && state.onboardingDone && !isDefensiveUtt && !waitingForTripleRating) {
      console.log(`[decision] DISCARD noise (${wordCount} words): "${transcript}"`);
      return 'discard';
    }

    // Measurement completeness guard — first answer per lens must contain triple ratings.
    // Handles both digit form ("3") and word form ("three").
    if (waitingForTripleRating) {
      const measureDigits = extractRatingDigits(transcript);
      // Require all three scores: today / target / 18-months-if-nothing-changes
      if (measureDigits.length < 3) {
        console.log(`[decision] WAIT (measure: only ${measureDigits.length}/3 number(s) given): "${transcript.slice(0, 60)}"`);
        return 'wait';
      }
    }

    // ── INTERVIEW PHASE: live evaluation at the pause point ──────────────────
    // Primary path: the earlyEvalPromise was started at ~20 words while the
    // speaker was still talking. We just await it here — if timing worked out
    // it's already resolved. If the transcript grew a lot since the early eval
    // started (speaker kept going), we discard it and run a fresh call on the
    // full transcript.
    if (state.onboardingDone) {
      const priorAnswers = agenticSessionMessages
        .filter(m => m.role === 'PARTICIPANT' && m.phase === agenticCurrentPhase)
        .map(m => m.content);
      const isTripleRating = priorAnswers.length === 0; // first answer in phase

      let eval_: LiveEval;

      if (earlyEvalPromise && !isTripleRating) {
        const earlyWords  = earlyEvalTranscript.split(/\s+/).filter(w => w.length > 1).length;
        const currentWords = transcript.split(/\s+/).filter(w => w.length > 1).length;
        const growthFactor = currentWords / Math.max(earlyWords, 1);

        if (growthFactor < 1.6) {
          // Transcript is close to what we analysed — await the parallel promise.
          // If the LLM already finished, this returns instantly.
          console.log(`[stream-cognition] awaiting parallel eval (${earlyWords}w → ${currentWords}w, ×${growthFactor.toFixed(1)})`);
          eval_ = await earlyEvalPromise;
        } else {
          // Speaker kept talking — early analysis covers too little context.
          // Discard and re-evaluate the full transcript now.
          console.log(`[stream-cognition] transcript grew ×${growthFactor.toFixed(1)} — fresh eval on ${currentWords}w`);
          earlyEvalPromise = null;
          earlyEvalTranscript = '';
          eval_ = await liveEval(openaiClient, lastProbeText ?? '', transcript, agenticCurrentPhase, priorAnswers, isTripleRating);
        }
      } else {
        // No early eval running (e.g. triple-rating turn, or speech started
        // before threshold) — fall through to normal on-pause evaluation.
        eval_ = await liveEval(openaiClient, lastProbeText ?? '', transcript, agenticCurrentPhase, priorAnswers, isTripleRating);
      }

      // Always clear early eval state after the pause decision
      earlyEvalPromise = null;
      earlyEvalTranscript = '';

      cachedLiveEval = eval_;
      console.log(`[live-eval] complete=${eval_.complete} verdict=${eval_.verdict} source=${source}: "${transcript.slice(0, 60)}"`);

      if (!eval_.complete) return 'wait';

      // ── Speculative pre-fire of generateAgenticTurn ──────────────────────
      // liveEval confirmed the answer is complete. Start the LLM turn-decision
      // NOW (before the endpoint fires) so it's already running — or done —
      // when the endpoint handler needs the result.
      //
      // Construct a temporary snapshot of session messages that includes the
      // current transcript as the participant's latest answer. This matches
      // what the endpoint handler will have after agenticSessionMessages.push().
      // We do NOT mutate the real array here — just pass a snapshot.
      //
      // Skip if: waiting for triple ratings (separate path), session paused/done,
      // or a speculative call is already running on THIS same transcript.
      if (
        !isWaitingForTripleRating() &&
        !sessionPaused &&
        !agenticSessionComplete &&
        speculativeAgenticTranscript !== transcript
      ) {
        speculativeAgenticTranscript = transcript;
        const speculativeMessages: SessionMessage[] = [
          ...agenticSessionMessages,
          {
            role: 'PARTICIPANT',
            content: transcript,
            phase: agenticCurrentPhase,
            metadata: null,
            createdAt: new Date(),
          },
        ];
        const timeoutPromise = new Promise<null>(resolve =>
          setTimeout(() => resolve(null), SPECULATIVE_TIMEOUT_MS),
        );
        speculativeAgenticPromise = Promise.race([
          generateAgenticTurn({
            openai: openaiClient,
            sessionStartedAt: new Date(sessionStartedAt),
            currentPhase: agenticCurrentPhase,
            phaseOrder: agenticPhaseOrder,
            sessionMessages: speculativeMessages,
            workshopContext: null,
            workshopName: null,
            participantName,
            participantRole: participantTitle,
            participantDepartment: undefined,
            includeRegulation: agenticIncludeRegulation,
            preferredInteractionMode: 'VOICE',
            sessionQuestions,
          }).catch(() => null),
          timeoutPromise,
        ]);
        console.log('[speculative] generateAgenticTurn pre-fired');
      }

      return 'commit';
    }

    // ── ONBOARDING PHASE: existing controller (handles its own probe logic) ──
    const pauseLens = state.snapshot().currentLens;
    const pauseExplorationTurns = pauseLens !== 'open'
      ? (() => { try { return lensController.getProgress(pauseLens).explorationTurns; } catch { return 0; } })()
      : 0;

    const outcome = await controller.evaluate({
      transcript,
      endpointingMode: currentEndpointingMode,
      expectedAnswerType: currentExpectedAnswerType,
      lastProbe: lastProbeText,
      state: state.snapshot(),
      source,
      isOnboarding: true,
      elapsedMinutes: elapsedMinutes(),
      threadProbeCount: state.threadProbeCount,
      explorationTurns: pauseExplorationTurns,
    });

    console.log(`[decision] ${outcome.action} (${outcome.reason}): "${transcript.slice(0, 60)}"`);
    return outcome.action;
  });

  const dg = createDeepgramConnection(DEEPGRAM_API_KEY, {
    onOpen: () => {
      console.log(`[dg] open (${state.sessionId})`);
      send({ type: 'ready', sessionId: state.sessionId });
      deepgramReady = true;
      if (startReceived) {
        setTimeout(() => fireWelcome(), 400);
      } else {
        setTimeout(() => fireWelcome(), 2500);
      }
    },
    onTranscript: msg => {
      if (sessionPaused) return;

      const alt = msg.channel.alternatives[0];
      if (!alt?.transcript) return;

      if (!isFromPrimarySpeaker(alt.words ?? [])) return;

      // Mark speculative stale when any new transcript arrives after pre-fire.
      // onSpeechStarted (VAD) is not always reliable for continuous speech;
      // transcript events are the ground truth for "more words came in".
      if (speculativeAgenticPromise !== null && !speculativeAgenticStale) {
        console.warn('[speculative] marking stale — new transcript arrived after pre-fire');
        speculativeAgenticStale = true;
      }

      // Settle window: any new confirmed speech aborts the queued probe
      if (settleActive && msg.is_final && alt.transcript.trim()) {
        settleAbortedFlag = true;
      }

      const bargeinDecision = evaluateBargeinTranscript(alt.transcript, alt.words ?? []);
      if (bargeinDecision.intercept) return;

      detector.onTranscript(msg);
      capture.writeFinalTranscript(msg);

      if (msg.is_final) {
        // Keep liveness watchdog from firing during continuous speech — stamp on
        // every confirmed final so the 6s window only starts after the user stops.
        if (alt.transcript.trim()) lastUserSpeechAt = Date.now();

        // ── Transcript sanity: per-word confidence + phantom-number detection ─
        // Logs word:confidence pairs for every final. Emits a warning if any
        // numeric token has confidence < ASR_NUMBER_CONFIDENCE_THRESHOLD (0.6).
        // The transcript itself is never modified — this is advisory only.
        checkTranscriptSanity(alt.words ?? [], alt.transcript, true);
        // ─────────────────────────────────────────────────────────────────────

        send({ type: 'final', text: alt.transcript });

        // ── Streaming cognition: start liveEval early in the background ─────
        // Accumulate Deepgram finals into a running buffer. Once we have ≥20
        // words of substance in an interview turn, kick off liveEval() in
        // parallel — the agent synthesises meaning as the person speaks rather
        // than waiting for them to stop.
        if (state.onboardingDone && !earlyEvalPromise && !sessionPaused && !isWaitingForTripleRating()) {
          streamTranscriptBuffer = (streamTranscriptBuffer + ' ' + alt.transcript).trim();
          const wordCount = streamTranscriptBuffer.split(/\s+/).filter(w => w.length > 1).length;

          if (wordCount >= 20) {
            const capturedTranscript = streamTranscriptBuffer;
            const capturedPhase = agenticCurrentPhase;
            const capturedProbe = lastProbeText ?? '';
            const priorAnswers = agenticSessionMessages
              .filter(m => m.role === 'PARTICIPANT' && m.phase === capturedPhase)
              .map(m => m.content);

            earlyEvalTranscript = capturedTranscript;
            earlyEvalPromise = liveEval(
              openaiClient,
              capturedProbe,
              capturedTranscript,
              capturedPhase,
              priorAnswers,
              false, // not triple-rating — those are handled separately
            ).catch(() => ({ complete: true, verdict: 'ok' as const }));

            console.log(`[stream-cognition] early eval started at ${wordCount} words: "${capturedTranscript.slice(0, 50)}"`);
          }
        }
        // ────────────────────────────────────────────────────────────────────
      } else {
        const snap = state.snapshot();
        const combined = (snap.liveUtterance + ' ' + alt.transcript).trim();
        void state.updateLiveUtterance(combined).then(() => {
          send({ type: 'partial', text: alt.transcript });
          void classifier.classify(state.snapshot(), (signals, trigger) => {
            if (signals.length === 0) return;
            void state.mergeSignals(signals, trigger).then(() => {
              emitStateUpdate();
              maybeSpeculativeProbe();
            });
          });
          emitStateUpdate();
        });
      }
    },
    onUtteranceEnd: msg => {
      if (sessionPaused) return;
      detector.onUtteranceEnd(msg);
    },
    onSpeechStarted: msg => {
      if (sessionPaused) return;
      cancelSilenceWatchdog();
      if (settleActive) {
        settleAbortedFlag = true;
        if (!activeTts && detector.getState() === 'SYSTEM_SPEAKING') {
          detector.onSystemSpeakingEnd();
        }
      }
      detector.onSpeechStarted(msg);
      // New utterance starting — reset streaming cognition and speculative state
      // so we build fresh context for this new speech turn.
      earlyEvalPromise = null;
      earlyEvalTranscript = '';
      streamTranscriptBuffer = '';
      // Discard any speculative result from the previous turn — it's for a
      // different answer and will give wrong context if reused.
      speculativeAgenticPromise = null;
      speculativeAgenticTranscript = '';
      speculativeAgenticStale = false;
    },
    onClose: () => console.log(`[dg] closed (${state.sessionId})`),
    onError: err => {
      console.error('[dg] error', err);
      send({ type: 'error', message: 'transcription error' });
    },
  });

  const tickInterval = setInterval(() => detector.tick(), 50);

  // ── Liveness watchdog: 250ms invariant check ─────────────────────────────
  // INVARIANT: if the participant has spoken and the agent has not responded
  // within 6s, forceLivenessRecovery() fires unconditionally, bypassing every
  // gate (noise filter, settle window, dedup, LLM decision).
  const LIVENESS_TIMEOUT_MS = 6000;
  livenessInterval = setInterval(() => {
    if (
      lastUserSpeechAt > 0 &&
      lastUserSpeechAt > lastAgentSpeechAt &&
      !agenticSessionComplete &&
      !activeTts &&
      !endpointHandling &&
      Date.now() - lastUserSpeechAt > LIVENESS_TIMEOUT_MS
    ) {
      void forceLivenessRecovery();
    }
  }, 250);

  detector.on('endpoint_detected', async ({ finalUtterance, reason }: { finalUtterance: string; reason: string }) => {
    if (endpointHandling) {
      console.log(`[endpoint] DROPPED (handler busy): "${finalUtterance}"`);
      return;
    }
    endpointHandling = true;
    const thisTurnId = ++currentTurnId;
    let perTurnSpoken = false;
    detector.onSystemSpeakingStart();
    lastUserSpeechAt = Date.now();

    // New endpoint fired — cancel any settle-retry probe so we don't speak
    // the parked probe on top of processing this new utterance.
    if (settleRetryTimer) { clearTimeout(settleRetryTimer); settleRetryTimer = null; }
    pendingSettleProbe = null;

    // Clear streaming cognition state — this utterance is committed, next
    // speech turn will build fresh context.
    earlyEvalPromise = null;
    earlyEvalTranscript = '';
    streamTranscriptBuffer = '';
    // Snapshot the speculative promise and clear the module-level ref immediately
    // so a concurrent onSpeechStarted can't race with our await below.
    const pendingSpeculative = speculativeAgenticPromise;
    const speculativeSeed = speculativeAgenticTranscript;
    const isSpeculativeStale = speculativeAgenticStale;
    speculativeAgenticPromise = null;
    speculativeAgenticTranscript = '';
    speculativeAgenticStale = false;

    console.log(`[endpoint] ${reason}: "${finalUtterance}"`);

    try {
      // ================================================================
      // ONBOARDING PHASE — free-flowing LLM conversation
      // ================================================================
      if (!state.onboardingDone) {
        console.log(`[onboarding] user: "${finalUtterance}"`);

        // Repeat request during onboarding — re-speak last probe, don't commit as turn.
        if (REPEAT_RE.test(finalUtterance) && lastProbeText) {
          console.log('[repeat] user requested repeat during onboarding — re-speaking');
          await safeSpeak(lastProbeText, lastProbeStrategy, currentEndpointingMode, currentExpectedAnswerType, 'user-repeat-request', true);
          emitStateUpdate();
          return;
        }

        const turn = await state.commitTurn(finalUtterance, 0, false, lastProbeText);
        capture.writeTurn(turn);

        try {
          const result = await onboardingAgent.respond(finalUtterance, elapsedMinutes());
          await state.recordSystemProbe(result.text);

          // Capture name/title extracted by the agent during onboarding.
          if (result.extractedName) {
            participantName = result.extractedName;
            console.log(`[onboarding] learned name: ${participantName}`);
          }
          if (result.extractedTitle) {
            participantTitle = result.extractedTitle;
            console.log(`[onboarding] learned title: ${participantTitle}`);
          }

          if (result.done) {
            state.markOnboardingDone();
            console.log('[onboarding] complete — entering agentic interview');
            const firstLens = lensController.currentLens;
            agenticCurrentPhase = firstLens;
            await state.setLens(firstLens);
            send({ type: 'lens_phase', lens: firstLens, phase: 'measurement' });

            // Get Q1 (triple_rating) for the first lens
            const q1Text = formatTripleRatingPrompt(
              lensQuestions(firstLens)?.[0]?.text ?? '',
            );
            agenticPhaseStartTimes.set(firstLens, Date.now());

            send({ type: 'measure_prompt', lens: firstLens, question: q1Text });
            emitProgressUpdate();
            emitCoverageUpdate();

            const measureProbe: ProbeCandidate = {
              text: q1Text, targetSignal: null, strategy: 'measure',
              generatedBy: 'template_fallback', tokenLatencyMs: 0,
              generatedAt: Date.now(), triggerUtterance: finalUtterance,
              endpointingMode: 'long_thought', expectedAnswerType: 'open_explanation',
            };
            capture.writeProbe(measureProbe);
            await state.recordSystemProbe(q1Text);

            // Combine onboarding bridge text + Q1 into one TTS call
            const bridgeText = result.text ? result.text.replace(/[?]$/, '.').trim() : '';
            const combinedText = bridgeText ? `${bridgeText} ${q1Text}` : q1Text;

            await safeSpeak(combinedText, 'measure', 'long_thought', 'open_explanation', 'onboarding-bridge', false, { phase: firstLens, metadata: { kind: 'question', tag: 'triple_rating', index: 0, phase: firstLens, deliveryMode: 'agentic' }, content: q1Text });
          } else {
            await safeSpeak(result.text, 'onboarding', result.endpointingMode, result.expectedAnswerType, 'onboarding-followup');
          }
        } catch (err) {
          console.error('[onboarding] agent error', err);
          state.markOnboardingDone();
          const firstLens = lensController.currentLens;
          agenticCurrentPhase = firstLens;
          await state.setLens(firstLens);
          send({ type: 'lens_phase', lens: firstLens, phase: 'measurement' });
          const q1Text = formatTripleRatingPrompt(lensQuestions(firstLens)?.[0]?.text ?? '');
          agenticPhaseStartTimes.set(firstLens, Date.now());
          send({ type: 'measure_prompt', lens: firstLens, question: q1Text });
          emitProgressUpdate();
          emitCoverageUpdate();
          await safeSpeak(q1Text, 'measure', 'long_thought', 'open_explanation', 'onboarding-bridge', false, { phase: firstLens, metadata: { kind: 'question', tag: 'triple_rating', index: 0, phase: firstLens, deliveryMode: 'agentic' } });
        }

        emitStateUpdate();
        return;
      }

      // ================================================================
      // INTERVIEW PHASE — agentic LLM-driven conversation
      // ================================================================

      // --- Acknowledgment / readiness filter ---
      const trimmedUtt = finalUtterance.trim();
      // Acknowledgment filter: suppress pure readiness signals that are not content answers.
      // After the participant has given at least one real answer in this phase,
      // single-word responses like "yes" / "no" / "sure" are CONTENT answers,
      // not readiness acknowledgments — do NOT filter them out.
      const participantAnswerCountInPhase = agenticSessionMessages.filter(
        (m) => m.role === 'PARTICIPANT' && m.phase === agenticCurrentPhase,
      ).length;
      const hasAnsweredOpener = participantAnswerCountInPhase > 0;

      const isAcknowledgment = (() => {
        // Participant echoed start of a rating question (barge-in artifact) — always suppress
        if (isWaitingForTripleRating() && /let'?s move into|on a scale|where would you rate/i.test(trimmedUtt)) return true;
        // Barge-in echo: starts with ack word + more text from agent question
        if (/^(okay|ok|k|great|sure|yes|yeah|right|alright|ready)[,.\s!]+/i.test(trimmedUtt)) return true;
        // Filler with connector phrase (e.g. "understood, let's move on")
        if (/^(understood|got it|sure|sounds good|ok|okay|right|noted)[,.\s]+(?:those|i'm|i am|let's|lets|ready|noted|carrying|moving|moving on|when|that's|that is|carry)/i.test(trimmedUtt)) return true;
        // Pure multi-word readiness signal (always suppress — these are never content)
        if (/^(i'?m ready|yes i'?m ready|yeah i'?m ready|let'?s (do this|get (into|started|going)|go)|i'?m (good|set|here)|ok(ay)?[,.]?\s*(great|let'?s|go|ready|i'?m))[\s.,!]*$/i.test(trimmedUtt)) return true;
        // Single-word / short filler — only suppress BEFORE first answer.
        // After first answer, "yes"/"no"/"same" are valid content responses.
        if (!hasAnsweredOpener) {
          if (/^(okay|ok|k|great|sure|yes|yeah|yep|mm|hmm|got it|i see|fair enough|alright|fine|go on|of course|let'?s go|let'?s start|let'?s do it|ready|go ahead|start|sounds good|understood|clear|makes sense|no|nope|absolutely|perfect|noted|carry on|moving on)[\s.,!]*$/i.test(trimmedUtt)) return true;
          if (trimmedUtt.split(/\s+/).length <= 3 && /^(just|only|so|well|and|k|great)\b/i.test(trimmedUtt)) return true;
        }
        return false;
      })();

      if (isAcknowledgment) {
        console.log(`[interview] acknowledgment detected — waiting for substance: "${finalUtterance}"`);
        emitStateUpdate();
        return;
      }

      // --- Repeat request gate — participant asks to hear the last question again ---
      // Meta-utterance: do NOT commit to session history or advance the conversation.
      if (REPEAT_RE.test(trimmedUtt) && lastProbeText) {
        console.log('[repeat] user requested repeat — re-speaking');
        await safeSpeak(lastProbeText, lastProbeStrategy, currentEndpointingMode, currentExpectedAnswerType, 'user-repeat-request', true);
        emitStateUpdate();
        return;
      }

      // --- Session control gate — spoken pause / break / end requests ---
      // Check before clarification and confusion gates so "can we stop?" is never
      // mis-routed into the interview as an answer.
      const sessionControlIntent = detectSessionControlIntent(finalUtterance);

      if (sessionControlIntent === 'pause') {
        console.log(`[session-control] spoken pause request: "${finalUtterance.slice(0, 60)}"`);
        sessionPaused = true;
        cancelSilenceWatchdog();
        saveSessionToDisk();
        const pauseAck = participantName
          ? `No problem ${participantName}. Take your time. I've saved where we are. Just say "ready" or "let's continue" when you want to pick back up.`
          : `No problem. Take your time. I've saved where we are. Just say "ready" or "let's continue" when you want to pick back up.`;
        await safeSpeak(pauseAck, 'onboarding', 'long_thought', 'open_explanation', 'session-control');
        send({ type: 'session_paused' });
        emitStateUpdate();
        return;
      }

      if (sessionControlIntent === 'resume') {
        // They said something like "ready" while paused — handled by the acknowledgment
        // filter above for single-word cases, but catch multi-word "let's continue" here.
        if (sessionPaused) {
          sessionPaused = false;
          send({ type: 'session_resumed' });
          console.log(`[session-control] spoken resume`);
          if (lastProbeText) {
            await safeSpeak(lastProbeText, lastProbeStrategy, currentEndpointingMode, currentExpectedAnswerType, 'session-control');
          }
          emitStateUpdate();
          return;
        }
      }

      if (sessionControlIntent === 'finish_later') {
        console.log(`[session-control] finish later request: "${finalUtterance.slice(0, 60)}"`);
        saveSessionToDisk();
        const lensPhasesDone = agenticPhaseOrder
          .filter(p => p !== 'summary' && agenticPhaseStartTimes.has(p))
          .map(p => PHASE_DISPLAY_NAMES[p] ?? p);
        const coveredText = lensPhasesDone.length > 0
          ? `We've covered ${lensPhasesDone.join(', ')} so far.`
          : `We're early in the session.`;
        const saveAck = participantName
          ? `Of course ${participantName}. ${coveredText} I've saved your progress. When you're ready to continue, just reconnect and we'll pick up from where we left off.`
          : `Of course. ${coveredText} I've saved your progress. When you're ready to continue, just reconnect and we'll pick up from where we left off.`;
        await safeSpeak(saveAck, 'close', 'long_thought', 'open_explanation', 'session-control');
        send({ type: 'session_paused' });
        emitStateUpdate();
        return;
      }

      if (sessionControlIntent === 'end_now') {
        console.log(`[session-control] end session request: "${finalUtterance.slice(0, 60)}"`);
        agenticSessionComplete = true;
        saveSessionToDisk();
        const phasesCompleted = agenticPhaseOrder
          .filter(p => p !== 'summary' && agenticPhaseStartTimes.has(p))
          .length;
        const endAck = phasesCompleted >= 2
          ? `That works. We've covered good ground today. I'll wrap up what we have and a written summary will follow shortly.`
          : `Understood. We'll stop here. Whatever you've shared will still be useful — a written summary will follow.`;
        await safeSpeak(endAck, 'close', 'long_thought', 'open_explanation', 'session-control');
        send({ type: 'session_complete' });
        emitStateUpdate();
        return;
      }

      // --- Clarification gate — participant asking to explain the last question ---
      // Must check BEFORE the generic confusion gate, as "what do you mean" is a clarification
      // about the probe, not confusion about the session.
      if (isClarificationRequest(finalUtterance) && lastProbeText) {
        console.log(`[clarify] participant asked for clarification: "${finalUtterance.slice(0, 60)}"`);
        const rephrased = await rephraseLastProbe(openaiClient, lastProbeText, agenticCurrentPhase);
        const clarifyProbe: ProbeCandidate = {
          text: rephrased, targetSignal: null, strategy: 'reorient',
          generatedBy: 'template_fallback', tokenLatencyMs: 0,
          generatedAt: Date.now(), triggerUtterance: finalUtterance,
          endpointingMode: 'long_thought', expectedAnswerType: 'open_explanation',
        };
        capture.writeProbe(clarifyProbe);
        await state.recordSystemProbe(rephrased);
        await safeSpeak(rephrased, 'reorient', 'long_thought', 'open_explanation', 'clarification');
        emitStateUpdate();
        return;
      }

      // --- Confusion gate — participant lost or disengaged from the session ---
      const confused = isConfused(finalUtterance);

      if (confused) {
        state.incrementConfusion();
        const confCount = state.confusionCount;
        const confTurn = await state.commitTurn(finalUtterance, 0, false, lastProbeText);
        capture.writeTurn(confTurn);

        const reorientText = confCount <= 1
          ? probeEngine.getReorientProbe(0)
          : confCount <= 3
          ? probeEngine.getReorientProbe(confCount - 1)
          : probeEngine.getEncourageProbe(confCount - 4);

        console.log(`[reorient] confusion=${confCount}`);

        const reorientProbe: ProbeCandidate = {
          text: reorientText, targetSignal: null, strategy: 'reorient',
          generatedBy: 'template_fallback', tokenLatencyMs: 0,
          generatedAt: Date.now(), triggerUtterance: finalUtterance,
          endpointingMode: 'normal', expectedAnswerType: 'open_explanation',
        };
        capture.writeProbe(reorientProbe);
        await state.recordSystemProbe(reorientText);
        await safeSpeak(reorientText, 'reorient', 'normal', 'open_explanation', 'reorient');
        emitStateUpdate();
        return;
      }

      state.resetConfusion();

      // ── Frustration force-advance ──────────────────────────────────────────
      if (frustrationPending) {
        frustrationPending = false;
        console.log('[frustration] force-advancing');
        await state.commitTurn(finalUtterance, 0, false, lastProbeText);
        const frustIdx = agenticPhaseOrder.indexOf(agenticCurrentPhase) + 1;
        if (frustIdx > 0 && frustIdx < agenticPhaseOrder.length && agenticPhaseOrder[frustIdx] !== 'summary') {
          const frustPhase = agenticPhaseOrder[frustIdx]!;
          const frustOpener = lensQuestions(frustPhase)?.[0];
          if (frustOpener) {
            const frustText = formatTripleRatingPrompt(frustOpener.text);
            lensController.advanceLens();
            agenticCurrentPhase = frustPhase;
            agenticPhaseStartTimes.set(frustPhase, Date.now());
            await state.setLens(frustPhase as Lens);
            send({ type: 'lens_phase', lens: frustPhase as Lens, phase: 'measurement' });
            send({ type: 'measure_prompt', lens: frustPhase as Lens, question: frustText });
            emitProgressUpdate();
            emitCoverageUpdate();
            await safeSpeak(`Understood — let me move on. ${frustText}`, 'measure', 'long_thought', 'open_explanation', 'frustration-advance', false, { phase: frustPhase, metadata: { kind: 'question', tag: 'triple_rating', index: 0, phase: frustPhase, deliveryMode: 'agentic' }, content: frustText });
            emitStateUpdate();
            return;
          }
        }
        await safeSpeak('Understood — let me move on.', 'close', 'long_thought', 'open_explanation', 'frustration-advance');
        emitStateUpdate();
        return;
      }

      const currentLens = agenticCurrentPhase as Lens;

      console.log(`[interview] phase=${agenticCurrentPhase} (agentic): "${finalUtterance.slice(0, 60)}"`);

      // 1. Commit the turn
      const turn = await state.commitTurn(finalUtterance, 1, false, lastProbeText);
      capture.writeTurn(turn);

      // 2. Q1 guard — first answer in phase must contain all three scores (today / target / 18m)
      if (isWaitingForTripleRating()) {
        const measureDigits = extractRatingDigits(finalUtterance);
        if (measureDigits.length < 3) {
          console.log(`[interview] Q1 only ${measureDigits.length}/3 numbers — re-asking with nudge`);
          const q1Nudge =
            "I need three numbers from you: where you are today on a scale of one to five, where you need to be, and where you end up in eighteen months if nothing changes.";
          await state.recordSystemProbe(q1Nudge);
          await safeSpeak(q1Nudge, 'measure', 'long_thought', 'open_explanation', 'measure-prompt');
          emitStateUpdate();
          return;
        }
      }

      // 3. Add participant answer to session messages
      agenticSessionMessages.push({
        role: 'PARTICIPANT',
        content: finalUtterance,
        phase: agenticCurrentPhase,
        metadata: null,
        createdAt: new Date(),
      });

      // 4. Extract triple ratings from first answer in phase for coverage tracking
      const participantAnswersInPhase = agenticSessionMessages.filter(
        m => m.role === 'PARTICIPANT' && m.phase === agenticCurrentPhase,
      );
      if (participantAnswersInPhase.length === 1) {
        // This is the Q1 (triple rating) answer — extract and store maturity rating
        const normalisedForScores = normaliseSpokenRatingDigits(finalUtterance);
        const scoreDigits = [...normalisedForScores.matchAll(/\b([1-5])\b/g)].map(m => parseInt(m[1]!, 10));

        if (scoreDigits.length >= 3) {
          const currentScore = scoreDigits[0]!;
          const targetScore = scoreDigits[1]!;  // must be present — gate requires 3 numbers
          const driftScore = scoreDigits[2];
          let trajectory: 'improving' | 'flat' | 'declining' = 'flat';
          if (driftScore !== undefined) {
            trajectory = driftScore < currentScore ? 'declining' : driftScore > currentScore ? 'improving' : 'flat';
          } else {
            // Infer trajectory from language
            const lower = finalUtterance.toLowerCase();
            if (/improv|getting better|moving in the right|trending up/i.test(lower)) {
              trajectory = 'improving';
            } else if (/declin|getting worse|slipping|going backward|heading south|eroding/i.test(lower)) {
              trajectory = 'declining';
            }
          }

          const rating = {
            lensId: currentLens,
            current: currentScore,
            target: targetScore,
            trajectory,
            capturedAt: Date.now(),
            rawResponse: finalUtterance,
          };
          state.addMaturityRating(currentLens, rating);
          lensController.setMaturityRating(currentLens, rating);
          send({ type: 'lens_rating', lens: currentLens, current: rating.current, target: rating.target, trajectory: rating.trajectory });
        }
      }

      // 5. Use cached live eval (computed in pause callback — zero latency here)
      // Clear the cache immediately so stale evals don't leak into the next turn.
      const eval_ = cachedLiveEval;
      cachedLiveEval = null;

      // 5b. Silent truth extraction — fire in background
      const maturityRating = state.getMaturityRating(currentLens);
      const truthsPromise = truthExtractor.extract(
        currentLens, finalUtterance, lastProbeText,
        `t_${state.snapshot().turns.length}`, maturityRating,
      );

      // If live eval caught a problem, challenge/redirect now — no LLM call needed
      if (eval_ && eval_.verdict !== 'ok' && eval_.probe) {
        console.log(`[live-eval] ${eval_.verdict} → "${eval_.probe.slice(0, 60)}"`);
        lensController.recordExplorationTurn(currentLens, false);
        emitCoverageUpdate();
        emitProgressUpdate();
        const truths = await truthsPromise;
        for (const truth of truths) {
          lensController.addTruthNode(currentLens, truth);
          state.addTruthNode(truth);
          send({ type: 'truth_node', nodeId: truth.nodeId, lensId: truth.lensId, statement: truth.statement, evidence: truth.evidence, isSpecific: truth.isSpecific, hasEvidence: truth.hasEvidence });
        }
        const challengeProbe: ProbeCandidate = {
          text: eval_.probe, targetSignal: null, strategy: 'challenge',
          generatedBy: 'template_fallback', tokenLatencyMs: 0,
          generatedAt: Date.now(), triggerUtterance: finalUtterance,
          endpointingMode: 'long_thought', expectedAnswerType: 'open_explanation',
        };
        capture.writeProbe(challengeProbe);
        await state.recordSystemProbe(eval_.probe);
        await safeSpeak(eval_.probe, 'challenge', 'long_thought', 'open_explanation', 'live-eval-challenge', false, { phase: agenticCurrentPhase, metadata: { kind: 'challenge', verdict: eval_.verdict, deliveryMode: 'agentic' } });
        emitStateUpdate();
        return;
      }

      // 6. Call generateAgenticTurn() — use speculative pre-fire if available
      // The pause callback started this call speculatively using a snapshot of
      // agenticSessionMessages that included the participant's transcript. By the
      // time we arrive here, the call is often already resolved or very close.
      // If the speculative call timed out (resolved null) or the transcript changed
      // (user kept speaking and onSpeechStarted discarded it), we fall through to
      // a fresh synchronous call.
      let agenticResult;
      try {
        let speculativeResult: import('./agentic-turn.js').AgenticTurnResult | null = null;

        if (pendingSpeculative !== null) {
          if (isSpeculativeStale) {
            console.warn(`[speculative] STALE — discarding (new speech arrived after pre-fire): seed="${speculativeSeed.slice(0, 50)}"`);
          } else {
            // Accept speculative if length delta is ≤ 30% — anything more means
            // the user kept talking and the pre-fire saw too little context.
            const seedWords  = speculativeSeed.trim().split(/\s+/).length;
            const finalWords = finalUtterance.trim().split(/\s+/).length;
            const lengthDelta = Math.abs(finalWords - seedWords) / Math.max(seedWords, 1);
            if (lengthDelta <= 0.30) {
              console.log(`[speculative] awaiting pre-fired result (seed=${seedWords}w final=${finalWords}w delta=${(lengthDelta * 100).toFixed(0)}%)`);
              speculativeResult = await pendingSpeculative;
            } else {
              console.warn(`[speculative] discarding — length delta ${(lengthDelta * 100).toFixed(0)}% > 30% (seed=${seedWords}w final=${finalWords}w)`);
            }
          }
        }

        if (speculativeResult !== null) {
          console.log('[speculative] HIT — using pre-fired generateAgenticTurn result');
          agenticResult = speculativeResult;
        } else {
          // Cache miss or timeout — run synchronously now.
          if (pendingSpeculative !== null) console.log('[speculative] MISS (timeout or discard) — running synchronously');
          agenticResult = await generateAgenticTurn({
            openai: openaiClient,
            sessionStartedAt: new Date(sessionStartedAt),
            currentPhase: agenticCurrentPhase,
            phaseOrder: agenticPhaseOrder,
            sessionMessages: agenticSessionMessages,
            workshopContext: null,
            workshopName: null,
            participantName,
            participantRole: participantTitle,
            participantDepartment: undefined,
            includeRegulation: agenticIncludeRegulation,
            preferredInteractionMode: 'VOICE',
            sessionQuestions,
          });
        }
      } catch (err) {
        console.error('[interview] generateAgenticTurn failed', err);
        // Cascade fallback — never go silent:
        // (1) ask the next unused guide question in this lens
        const usedAiIndexes = new Set(
          agenticSessionMessages
            .filter((m) => m.role === 'AI' && m.phase === agenticCurrentPhase)
            .map((m) => {
              const meta = m.metadata as Record<string, unknown> | null;
              return typeof meta?.index === 'number' ? meta.index : -1;
            }),
        );
        const nextQ = (lensQuestions(agenticCurrentPhase) ?? []).find(
          (_, i) => i > 0 && !usedAiIndexes.has(i),
        );
        if (nextQ) {
          console.log(`[fallback:1] generateAgenticTurn failed — next guide question: "${nextQ.text.slice(0, 50)}"`);
          await safeSpeak(nextQ.text, 'drill_depth', 'long_thought', 'open_explanation', 'cascade-1');
          emitStateUpdate();
          return;
        }
        // (2) advance to the next lens opener
        const nextPhaseIdx = agenticPhaseOrder.indexOf(agenticCurrentPhase) + 1;
        if (nextPhaseIdx > 0 && nextPhaseIdx < agenticPhaseOrder.length) {
          const nextPhase = agenticPhaseOrder[nextPhaseIdx]!;
          const nextOpener = lensQuestions(nextPhase)?.[0];
          if (nextOpener) {
            const nextText = formatTripleRatingPrompt(nextOpener.text);
            console.log(`[fallback:2] generateAgenticTurn failed — advancing to ${nextPhase}`);
            lensController.advanceLens();
            agenticCurrentPhase = nextPhase;
            agenticPhaseStartTimes.set(nextPhase, Date.now());
            await state.setLens(nextPhase as Lens);
            send({ type: 'lens_phase', lens: nextPhase as Lens, phase: 'measurement' });
            await safeSpeak(nextText, 'measure', 'long_thought', 'open_explanation', 'cascade-2', false, { phase: nextPhase, metadata: { kind: 'question', tag: 'triple_rating', index: 0, phase: nextPhase, deliveryMode: 'agentic' } });
            emitStateUpdate();
            return;
          }
        }
        // (3) acknowledge and move on
        console.log('[fallback:3] generateAgenticTurn failed — no more phases, acknowledging');
        await safeSpeak("Got it — let me move on.", 'close', 'long_thought', 'open_explanation', 'cascade-3');
        emitStateUpdate();
        return;
      }

      // 7. Apply truth extraction results
      const truths = await truthsPromise;
      for (const truth of truths) {
        lensController.addTruthNode(currentLens, truth);
        state.addTruthNode(truth);
        send({ type: 'truth_node', nodeId: truth.nodeId, lensId: truth.lensId, statement: truth.statement, evidence: truth.evidence, isSpecific: truth.isSpecific, hasEvidence: truth.hasEvidence });
      }

      // 8. Record exploration turn for coverage
      lensController.recordExplorationTurn(currentLens, false);

      // 9. Handle phase transition
      const prevPhase = agenticCurrentPhase;
      if (agenticResult.nextPhase !== agenticCurrentPhase && !agenticResult.completeSession) {
        const nextPhase = agenticResult.nextPhase;
        console.log(`[interview] phase transition: ${agenticCurrentPhase} → ${nextPhase}`);
        // Advance the LensController so sequenceIndex, phase ('pending'→'measurement'),
        // and coverage tracking all stay coherent with the agentic phase transition.
        lensController.advanceLens();
        agenticCurrentPhase = nextPhase;
        agenticPhaseStartTimes.set(nextPhase, Date.now());
        await state.setLens(nextPhase as Lens);
        send({ type: 'lens_phase', lens: nextPhase as Lens, phase: 'measurement' });
        lensExplorationStartedAt.set(nextPhase, Date.now());
      }

      emitCoverageUpdate();
      emitProgressUpdate();

      // 10. Complete session — generate synthesis and close
      if (agenticResult.completeSession) {
        agenticSessionComplete = true;
        console.log('[interview] session complete — generating synthesis');

        const synthesis = await agenticGenerateFinalSynthesis(
          openaiClient,
          agenticSessionMessages,
          agenticPhaseOrder,
          participantName,
        );

        const finalProbe: ProbeCandidate = {
          text: synthesis, targetSignal: null, strategy: 'close',
          generatedBy: 'template_fallback', tokenLatencyMs: 0,
          generatedAt: Date.now(), triggerUtterance: finalUtterance,
          endpointingMode: 'long_thought', expectedAnswerType: 'open_explanation',
        };
        capture.writeProbe(finalProbe);
        await state.recordSystemProbe(synthesis);
        await safeSpeak(synthesis, 'close', 'long_thought', 'open_explanation', 'final-synthesis');
        send({ type: 'session_complete' });
      } else {
        // 11. Speak next probe
        const nextText = agenticResult.assistantMessage;
        const isTransition = agenticResult.nextPhase !== prevPhase;
        const nextStrategy: ProbeStrategy = isTransition ? 'measure' : 'drill_depth';

        // Show scoring card on phase transition
        if (isTransition) {
          send({ type: 'measure_prompt', lens: agenticCurrentPhase as Lens, question: nextText });
        }

        const nextProbe: ProbeCandidate = {
          text: nextText, targetSignal: null, strategy: nextStrategy,
          generatedBy: 'template_fallback', tokenLatencyMs: 0,
          generatedAt: Date.now(), triggerUtterance: finalUtterance,
          endpointingMode: 'long_thought', expectedAnswerType: 'open_explanation',
        };
        capture.writeProbe(nextProbe);
        await state.recordSystemProbe(nextText);

        // Update lastProbeText NOW — before the settle window — so liveness
        // recovery always has the correct probe even if settle aborts.
        lastProbeText = nextText;
        lastProbeStrategy = nextStrategy;

        // ── Settle window: 1500ms after decision before speaking ────────────
        // If the user resumes mid-sentence (natural pause between bursts), abort
        // the probe silently. Their continued speech will produce a fresh endpoint.
        // If the resumed speech turns out to be noise (discarded), a retry timer
        // will speak the probe after SETTLE_RETRY_MS to prevent the session
        // going silent on late-arriving Deepgram words.
        if (thisTurnId === currentTurnId && !perTurnSpoken) {
          settleActive = true;
          settleAbortedFlag = false;
          await new Promise<void>(resolve => setTimeout(resolve, 1500));
          settleActive = false;
          if (settleAbortedFlag) {
            console.log('[settle] aborted — user resumed speaking during settle window');
            // Park the probe for retry. If no new endpoint fires within
            // SETTLE_RETRY_MS, the retry timer will speak it automatically.
            pendingSettleProbe = {
              text: nextText,
              strategy: nextStrategy,
              endpointingMode: 'long_thought',
              expectedAnswerType: 'open_explanation',
              source: isTransition ? 'agentic-transition' : 'agentic-decision',
              persist: false,
              meta: { phase: agenticCurrentPhase, metadata: agenticResult.metadata as Record<string, unknown> },
            };
            if (settleRetryTimer) clearTimeout(settleRetryTimer);
            settleRetryTimer = setTimeout(async () => {
              settleRetryTimer = null;
              if (!pendingSettleProbe || endpointHandling || activeTts) return;
              const probe = pendingSettleProbe;
              pendingSettleProbe = null;
              // Honour the "never repeat if something was said" rule.
              // If participant has already answered in this phase, don't repeat — liveness
              // watchdog will handle recovery with a forward-moving question instead.
              const phaseTurns = agenticSessionMessages.filter(
                m => m.role === 'PARTICIPANT' && m.phase === agenticCurrentPhase,
              ).length;
              if (phaseTurns > 0 && probe.strategy === 'measure') {
                console.log('[settle] retry suppressed — participant has already answered (measure probe)');
                return;
              }
              console.log(`[settle] retry — speaking parked probe: "${probe.text.slice(0, 60)}"`);
              await safeSpeak(probe.text, probe.strategy, probe.endpointingMode, probe.expectedAnswerType, probe.source, probe.persist, probe.meta);
            }, SETTLE_RETRY_MS);
            armSilenceWatchdog();
            emitStateUpdate();
            return;
          }
        }

        // Settle completed normally — cancel any outstanding retry timer and probe
        if (settleRetryTimer) { clearTimeout(settleRetryTimer); settleRetryTimer = null; }
        pendingSettleProbe = null;

        if (perTurnSpoken) {
          console.warn('[per-turn] double-speak prevented — dropping additional probe');
        } else {
          perTurnSpoken = true;
          const agenticSource = isTransition ? 'agentic-transition' : 'agentic-decision';
          await safeSpeak(nextText, nextStrategy, 'long_thought', 'open_explanation', agenticSource, false, { phase: agenticCurrentPhase, metadata: agenticResult.metadata });
        }
      }

      emitStateUpdate();
      return;
      // ── END INTERVIEW PHASE ───────────────────────────────────────────────
    } finally {
      endpointHandling = false;
      if (!activeTts && detector.getState() === 'SYSTEM_SPEAKING') {
        detector.onSystemSpeakingEnd();
      }
      if (!activeTts && !agenticSessionComplete) {
        armSilenceWatchdog();
      }
    }
  });

  async function maybeSpeculativeProbe(): Promise<void> {
    const snap = state.snapshot();
    if (!snap.currentSignal) return;
    if (snap.currentSignal.confidence < 0.7) return;
    if (snap.pendingProbe) {
      if (snap.pendingProbe.targetSignal === snap.currentSignal.type) return;
    }
    probeEngine.generate(snap, 'drill_depth', 'speculative')
      .then(probe => state.setPendingProbe(probe))
      .then(() => emitStateUpdate())
      .catch(err => console.error('[spec probe] error', err));
  }

  ws.on('message', async (data, isBinary) => {
    if (isBinary) {
      const buf = data as Buffer;
      dg.sendAudio(buf);
      capture.writeUserAudio(buf);
      return;
    }

    try {
      const msg = JSON.parse((data as Buffer).toString('utf-8')) as ClientMessage;
      switch (msg.type) {
        case 'start': {
          participantName = msg.participantName;
          participantTitle = msg.participantTitle;
          startReceived = true;

          let resumed = false;
          if (msg.resumeSessionId) {
            const savePath = `${SESSION_SAVE_DIR}/${msg.resumeSessionId}.json`;
            if (existsSync(savePath)) {
              try {
                const saved = JSON.parse(readFileSync(savePath, 'utf-8')) as {
                  progressSnapshot: { sequence: Exclude<Lens, 'open'>[]; sequenceIndex: number; progress: Record<string, import('./types.js').LensProgress> };
                  agenticState?: {
                    currentPhase?: string;
                    phaseOrder?: string[];
                    phaseStartTimes?: Record<string, number>;
                    messages?: SessionMessage[];
                  };
                  participantName?: string;
                  participantTitle?: string;
                  lastProbeText?: string;
                };
                lensController = LensController.fromJSON(saved.progressSnapshot);
                if (saved.agenticState) {
                  agenticCurrentPhase = saved.agenticState.currentPhase ?? lensController.currentLens;
                  agenticPhaseOrder = saved.agenticState.phaseOrder ?? agenticPhaseOrder;
                  for (const [phase, ts] of Object.entries(saved.agenticState.phaseStartTimes ?? {})) {
                    agenticPhaseStartTimes.set(phase, ts);
                  }
                  // Restore full message history — the agentic engine uses this to
                  // decide triple-rating status and generate contextual questions.
                  if (saved.agenticState.messages?.length) {
                    agenticSessionMessages = saved.agenticState.messages;
                  }
                }
                participantName = participantName ?? saved.participantName;
                participantTitle = participantTitle ?? saved.participantTitle;
                if (saved.lastProbeText) lastProbeText = saved.lastProbeText;
                state.markOnboardingDone();
                resumed = true;
                console.log(`[session] resumed from ${msg.resumeSessionId}, phase=${agenticCurrentPhase}`);
              } catch (err) {
                console.error('[session] resume failed — starting fresh', err);
              }
            }
          }

          if (!resumed) {
            // Store custom prep questions from DREAM — override PHASE_QUESTIONS per lens.
            // The questions drive the agentic engine but DREAMflow still conducts a
            // natural conversation — it doesn't read them out verbatim.
            if (msg.questions && Object.keys(msg.questions).length > 0) {
              for (const [lens, texts] of Object.entries(msg.questions)) {
                if (Array.isArray(texts) && texts.length > 0) {
                  sessionQuestions[lens] = texts.map((text, i) => ({
                    text,
                    tag: i === 0 ? 'triple_rating' : 'guide',
                  }));
                }
              }
              console.log(`[client] loaded custom prep questions for lenses: [${Object.keys(msg.questions).join(', ')}]`);
            } else if (workshopId) {
              // No questions passed via WS message — try to fetch from DREAM API.
              const dreamQuestions = await fetchDreamPrepQuestions(workshopId);
              if (dreamQuestions && Object.keys(dreamQuestions).length > 0) {
                for (const [lens, texts] of Object.entries(dreamQuestions)) {
                  if (Array.isArray(texts) && texts.length > 0) {
                    sessionQuestions[lens] = texts.map((text, i) => ({
                      text,
                      tag: i === 0 ? 'triple_rating' : 'guide',
                    }));
                  }
                }
                console.log(`[dream] loaded prep questions from DREAM API for workshop=${workshopId}, lenses=[${Object.keys(dreamQuestions).join(', ')}]`);
              }
            }

            if (msg.lenses && msg.lenses.length > 0) {
              lensController = new LensController(msg.lenses as Exclude<Lens, 'open'>[]);
              agenticPhaseOrder = [...msg.lenses, 'summary'];
              agenticIncludeRegulation = msg.lenses.includes('risk_compliance');
              console.log(`[client] start, participant=${participantName ?? '(anon)'}, title=${participantTitle ?? '(unknown)'}, lenses=[${msg.lenses.join(',')}]`);
            } else {
              lensController = new LensController(DEFAULT_LENS_SEQUENCE);
              agenticPhaseOrder = [...DEFAULT_LENS_SEQUENCE, 'summary'];
              agenticIncludeRegulation = false;
              console.log(`[client] start, participant=${participantName ?? '(anon)'}, title=${participantTitle ?? '(unknown)'}, lenses=default`);
            }
          }

          if (deepgramReady) {
            setTimeout(() => fireWelcome(), 400);
          }
          break;
        }
        case 'pause':
          if (!sessionPaused) {
            sessionPaused = true;
            cancelSilenceWatchdog();
            if (activeTts) {
              activeTts.abort();
              activeTts = null;
              finishTtsPlayback(false);
            }
            send({ type: 'session_paused' });
            console.log(`[session] paused`);
          }
          break;
        case 'resume':
          if (sessionPaused) {
            sessionPaused = false;
            send({ type: 'session_resumed' });
            console.log(`[session] resumed`);
            if (lastProbeText) {
              setTimeout(() => {
                if (!sessionPaused && ws.readyState === WebSocket.OPEN) {
                  void safeSpeak(lastProbeText!, lastProbeStrategy, currentEndpointingMode, currentExpectedAnswerType, 'session-control');
                }
              }, 800);
            }
          }
          break;
        case 'playback_done':
          // Client audio has physically finished playing (buffer drained + echo holdoff).
          // Fire any pending chained probe (e.g. Q1 after intro greeting).
          if (pendingAfterTtsCallback) {
            const fn = pendingAfterTtsCallback;
            pendingAfterTtsCallback = null;
            console.log('[chain] playback_done — firing chained probe');
            fn();
          }
          break;
        case 'interrupt':
          if (activeTts) {
            activeTts.abort();
            activeTts = null;
            finishTtsPlayback(false);
            // Cancel any pending chained probe — barge-in overrides the chain.
            pendingAfterTtsCallback = null;
          }
          break;
        case 'end':
          ws.close();
          break;
      }
    } catch (err) {
      console.error('[client msg] parse error', err);
    }
  });

  ws.on('close', async () => {
    console.log(`[conn] closed (${state.sessionId})`);
    clearInterval(tickInterval);
    if (livenessInterval) { clearInterval(livenessInterval); livenessInterval = null; }
    cancelSilenceWatchdog();
    if (activeTts) activeTts.abort();
    dg.close();
    await capture.close();
    saveSessionToDisk();
    console.log(`[session] captured to ${capture.sessionDir}`);
  });
}

httpServer.listen(PORT, () => {
  console.log(`EthentaFlow server listening on :${PORT}`);
  console.log(`WebSocket at ws://localhost:${PORT}/ws`);
});
