import type {
  StickyPad,
  StickyPadType,
  DialoguePhase,
  LiveJourneyData,
  LiveJourneyInteraction,
} from '@/lib/cognitive-guidance/pipeline';
import { DEFAULT_JOURNEY_STAGES } from '@/lib/cognitive-guidance/pipeline';
import type { WorkshopPhase, SubQuestion } from '@/lib/cognition/agents/agent-types';
import type { HemisphereNodeDatum, HemispherePrimaryType } from '@/components/live/hemisphere-nodes';

// ── Local type definitions ────────────────────────────────

export type PrepQuestion = {
  id: string;
  phase: string;
  lens: string | null;
  text: string;
  purpose: string;
  grounding: string;
  order: number;
  isEdited: boolean;
  subQuestions?: SubQuestion[];
};

export type PrepPhaseData = {
  label: string;
  description: string;
  lensOrder: string[];
  questions: PrepQuestion[];
};

export type PrepQuestionSet = {
  phases: Record<string, PrepPhaseData>;
  designRationale: string;
  generatedAtMs: number;
};

// ── Constants ─────────────────────────────────────────────

export const COVERAGE_THRESHOLD = 70;

// ── Phase / lens helpers ──────────────────────────────────

export function dialoguePhaseToWorkshopPhase(phase: DialoguePhase): WorkshopPhase | null {
  switch (phase) {
    case 'REIMAGINE': return 'REIMAGINE';
    case 'CONSTRAINTS': return 'CONSTRAINTS';
    case 'DEFINE_APPROACH': return 'DEFINE_APPROACH';
    default: return null;
  }
}

export function lensToStickyPadType(lens: string | null): StickyPadType {
  switch (lens) {
    case 'People': return 'GAP_PROBE';
    case 'Operations': return 'ENABLER_PROBE';
    case 'Technology': return 'RISK_PROBE';
    case 'Commercial': return 'CUSTOMER_IMPACT';
    case 'Risk/Compliance': return 'RISK_PROBE';
    case 'Partners': return 'ENABLER_PROBE';
    case 'General': return 'CLARIFICATION';
    default: return 'CLARIFICATION';
  }
}

/**
 * Convert prep-generated questions into StickyPads for a specific phase.
 * First question is active, rest are queued.
 */
export function buildSessionPadsFromPrep(
  customQuestions: PrepQuestionSet,
  phase: DialoguePhase,
): StickyPad[] {
  const workshopPhase = dialoguePhaseToWorkshopPhase(phase);
  if (!workshopPhase) return [];

  const phaseData = customQuestions.phases?.[workshopPhase];
  if (!phaseData?.questions?.length) return [];

  const now = Date.now();
  return phaseData.questions
    .sort((a, b) => a.order - b.order)
    .map((q, i) => ({
      id: `prep:${q.id}`,
      type: lensToStickyPadType(q.lens),
      prompt: q.text,
      signalStrength: 1.0 - (i * 0.05),
      provenance: {
        triggerType: 'repeated_theme' as const,
        sourceNodeIds: [] as string[],
        description: q.grounding || q.purpose,
      },
      createdAtMs: now,
      status: 'active' as const,
      snoozedUntilMs: null,
      source: 'prep' as const,
      questionId: q.id,
      grounding: q.purpose,
      coveragePercent: 0,
      coverageState: (i === 0 ? 'active' : 'queued') as StickyPad['coverageState'],
      lens: q.lens || null,
      mainQuestionIndex: null,
      journeyGapId: null,
      padLabel: null,
    }));
}

// ── Seed pads ─────────────────────────────────────────────

/** Helper to create a seed pad with default question-driven fields */
export function seedPad(
  id: string, type: StickyPad['type'], prompt: string,
  strength: number, triggerType: StickyPad['provenance']['triggerType'],
  description: string, now: number,
): StickyPad {
  return {
    id, type, prompt, signalStrength: strength,
    provenance: { triggerType, sourceNodeIds: [], description },
    createdAtMs: now, status: 'active', snoozedUntilMs: null,
    source: 'seed', questionId: null, grounding: null,
    coveragePercent: 0, coverageState: 'active',
    lens: null, mainQuestionIndex: null,
    journeyGapId: null, padLabel: null,
  };
}

export function getSeedPadsForPhase(phase: DialoguePhase): StickyPad[] {
  const now = Date.now();

  switch (phase) {
    case 'SYNTHESIS':
      return [
        seedPad('synth-themes', 'CLARIFICATION', 'What were the most common themes across all participant interviews? Where is there strong consensus?', 0.9, 'repeated_theme', 'Identify shared themes from discovery', now),
        seedPad('synth-diverge', 'CONTRADICTION_PROBE', 'Where did participants disagree or have strongly different perspectives? What drove the divergence?', 0.85, 'contradiction', 'Surface divergent views across interviews', now),
        seedPad('synth-gaps', 'GAP_PROBE', 'Which domains or topics were barely discussed in the interviews? Are there blind spots the group should address?', 0.8, 'missing_dimension', 'Identify coverage gaps from interviews', now),
        seedPad('synth-commercial', 'CUSTOMER_IMPACT', 'What did participants say about value delivery, market reality, and commercial outcomes? Was there a shared view of customer and market need?', 0.75, 'repeated_theme', 'Collective commercial perspective', now),
        seedPad('synth-pain', 'CLARIFICATION', 'What were the top pain points and challenges raised across all interviews? Which are most urgent?', 0.7, 'repeated_theme', 'Aggregate pain points from discovery', now),
        seedPad('synth-surprise', 'CLARIFICATION', 'Were there any surprising or unexpected insights from the interviews that the group should discuss?', 0.65, 'repeated_theme', 'Surface unexpected findings', now),
      ];

    case 'REIMAGINE':
      return [
        seedPad('reimag-vision', 'CLARIFICATION', 'What is the ideal future state for this business? Paint the picture of success without constraints.', 0.9, 'repeated_theme', 'Opening prompt — establish aspirational vision', now),
        seedPad('reimag-actors', 'CLARIFICATION', 'Who are the key actors and stakeholders in this vision? What roles do they play?', 0.85, 'repeated_theme', 'Identify actors and their relationships', now),
        seedPad('reimag-commercial', 'CUSTOMER_IMPACT', 'How does value delivery look in this reimagined future? What changes for customers, demand, and commercial performance?', 0.8, 'missing_dimension', 'Commercial perspective in the vision', now),
        seedPad('reimag-people', 'GAP_PROBE', 'How do the people in the organisation fit into this future? What does their experience look like?', 0.75, 'missing_dimension', 'People dimension in the vision', now),
        seedPad('reimag-operations', 'GAP_PROBE', 'What does the operating model look like in this future state? How is work structured differently?', 0.7, 'missing_dimension', 'Operations dimension in the vision', now),
        seedPad('reimag-partners', 'ENABLER_PROBE', 'What would the ideal partner ecosystem look like in this future state?', 0.68, 'missing_dimension', 'Partners dimension in the vision', now),
        seedPad('reimag-goals', 'CLARIFICATION', 'What are the top 3 business outcomes you want from this transformation?', 0.65, 'unanswered_question', 'Define measurable business goals', now),
      ];

    case 'CONSTRAINTS':
      return [
        seedPad('con-risk-compliance', 'RISK_PROBE', 'What regulatory, compliance, legal, or control constraints apply to this vision? What must we comply with?', 0.9, 'missing_dimension', 'Risk / compliance lens — start from hard external constraints', now),
        seedPad('con-commercial', 'CUSTOMER_IMPACT', 'What commercial constraints exist? Demand limits, retention risk, proposition weakness, adoption barriers, or pricing pressure?', 0.85, 'missing_dimension', 'Commercial constraints and realities', now),
        seedPad('con-technology', 'RISK_PROBE', 'What technology constraints are we dealing with? Legacy systems, integration challenges, technical debt?', 0.8, 'high_freq_constraint', 'Technology barriers and limitations', now),
        seedPad('con-operations', 'RISK_PROBE', 'What operational constraints exist? Governance, structure, handoffs, competing priorities, or change fatigue?', 0.75, 'high_freq_constraint', 'Operations barriers', now),
        seedPad('con-people', 'RISK_PROBE', 'What people constraints apply? Skills gaps, capacity, resistance to change, key-person dependencies?', 0.7, 'high_freq_constraint', 'People barriers and limitations', now),
        seedPad('con-partners', 'RISK_PROBE', 'What partner, supplier, or ecosystem constraints apply? External dependency risk, vendor lock-in, or weak partner incentives?', 0.68, 'risk_cluster', 'Partner and ecosystem barriers', now),
        seedPad('con-blockers', 'CONTRADICTION_PROBE', 'Which constraints are absolute blockers vs conditions to manage? Can we rank them by severity?', 0.65, 'risk_cluster', 'Prioritise constraints by impact', now),
      ];

    case 'DEFINE_APPROACH':
      return [
        seedPad('def-people', 'ENABLER_PROBE', 'What do the people need to make this work? Training, new roles, culture change, leadership support?', 0.9, 'weak_enabler', 'People enablers — start from human needs', now),
        seedPad('def-operations', 'ENABLER_PROBE', 'How does the operating model need to change? New processes, governance, reporting lines, and delivery flow?', 0.85, 'weak_enabler', 'Operations design for the solution', now),
        seedPad('def-tech', 'ENABLER_PROBE', 'What technology is needed to enable this? Build, buy, or integrate? What\'s the platform strategy?', 0.8, 'weak_enabler', 'Technology enablers and choices', now),
        seedPad('def-commercial', 'CUSTOMER_IMPACT', 'How do we prove the commercial outcome? What does value delivery look like in the new approach?', 0.75, 'missing_dimension', 'Commercial validation of approach', now),
        seedPad('def-risk-compliance', 'OWNERSHIP_ACTION', 'How do we satisfy the risk and compliance requirements identified? What controls and assurance steps are needed?', 0.7, 'missing_dimension', 'Risk / compliance in the approach', now),
        seedPad('def-partners', 'ENABLER_PROBE', 'What role should partners play in delivery and how do we align them to the outcome?', 0.68, 'weak_enabler', 'Partners in the solution design', now),
        seedPad('def-ownership', 'OWNERSHIP_ACTION', 'Who owns each workstream? What are the immediate next steps and who is accountable?', 0.65, 'unanswered_question', 'Assign ownership and next steps', now),
      ];
  }
}

// ── Demo data — only used for the retail reference workshop ──

// Lazy — only evaluated on first client-side access (avoids SSR hydration mismatch)
let _demoHemisphereNodes: HemisphereNodeDatum[] | null = null;
export function getDemoHemisphereNodes(): HemisphereNodeDatum[] {
  if (_demoHemisphereNodes) return _demoHemisphereNodes;
  const now = Date.now();
  const types: HemispherePrimaryType[] = ['VISIONARY', 'INSIGHT', 'CONSTRAINT', 'RISK', 'ENABLER', 'ACTION', 'QUESTION', 'OPPORTUNITY'];
  const phrases = [
    'We need a unified customer platform that brings everything together',
    'The current onboarding process takes 6 weeks — far too long',
    'Regulatory compliance is non-negotiable for any solution',
    'Our people are our biggest asset but they lack digital skills',
    'The legacy CRM cannot scale to handle our growth targets',
    'AI-driven personalisation could transform customer retention',
    'Who owns the data governance framework going forward?',
    'We should partner with fintech providers rather than build',
    'The customer expects a seamless omnichannel experience',
    'Budget constraints mean we need a phased approach',
    'Employee engagement scores have dropped 15% this year',
    'Cloud migration would unlock agility but needs board approval',
    'Our competitors are already 2 years ahead on digital',
    'The customer journey has 7 handoffs — each is a dropout risk',
    'We need clearer KPIs tied to business outcomes not activity',
  ];
  const domains = ['People', 'Operations', 'Technology', 'Commercial', 'Risk/Compliance', 'Partners'];
  const keywords = [
    ['platform', 'unified', 'customer'], ['onboarding', 'process', 'time'], ['regulation', 'compliance'],
    ['people', 'skills', 'digital'], ['CRM', 'legacy', 'scale'], ['AI', 'personalisation', 'retention'],
    ['data', 'governance'], ['partner', 'fintech', 'build'], ['customer', 'omnichannel', 'seamless'],
    ['budget', 'phased', 'approach'], ['engagement', 'employee', 'scores'], ['cloud', 'migration', 'agility'],
    ['competitors', 'digital', 'ahead'], ['journey', 'handoffs', 'dropout'], ['KPIs', 'outcomes', 'business'],
  ];

  _demoHemisphereNodes = phrases.map((text, i) => ({
    dataPointId: `demo-node-${i}`,
    createdAtMs: now - (phrases.length - i) * 30_000,
    rawText: text,
    dataPointSource: 'live_transcript',
    speakerId: `speaker-${(i % 4) + 1}`,
    dialoguePhase: null,
    intent: null,
    themeId: null,
    themeLabel: null,
    transcriptChunk: {
      speakerId: `speaker-${(i % 4) + 1}`,
      startTimeMs: i * 30_000,
      endTimeMs: (i + 1) * 30_000,
      confidence: 0.85 + Math.random() * 0.15,
      source: 'deepgram',
    },
    classification: {
      primaryType: types[i % types.length],
      confidence: 0.6 + Math.random() * 0.35,
      keywords: keywords[i],
      suggestedArea: domains[i % domains.length],
      updatedAt: new Date().toISOString(),
    },
    agenticAnalysis: {
      domains: [{ domain: domains[i % domains.length], relevance: 0.7 + Math.random() * 0.3, reasoning: 'Primary domain' }],
      themes: [{ label: keywords[i][0], category: 'theme', confidence: 0.8, reasoning: 'Key topic' }],
      actors: [],
      semanticMeaning: text,
      sentimentTone: ['positive', 'neutral', 'concerned'][i % 3],
      overallConfidence: 0.7 + Math.random() * 0.25,
    },
  }));
  return _demoHemisphereNodes;
}

export function getDemoLiveJourney(): LiveJourneyData {
  const now = Date.now();
  const mkI = (
    id: string, actor: string, stage: string, action: string, context: string,
    sentiment: LiveJourneyInteraction['sentiment'],
    bizInt: number, custInt: number,
    aiNow: LiveJourneyInteraction['aiAgencyNow'], aiFuture: LiveJourneyInteraction['aiAgencyFuture'],
    painPoint = false, mot = false,
  ): LiveJourneyInteraction => ({
    id, actor, stage, action, context, sentiment,
    businessIntensity: bizInt, customerIntensity: custInt,
    aiAgencyNow: aiNow, aiAgencyFuture: aiFuture,
    isPainPoint: painPoint, isMomentOfTruth: mot,
    sourceNodeIds: [], addedBy: 'ai', createdAtMs: now,
  });

  return {
    stages: DEFAULT_JOURNEY_STAGES.REIMAGINE,
    actors: [
      { name: 'End Customer', role: 'Primary user of the platform', mentionCount: 12 },
      { name: 'Frontline Staff', role: 'Customer-facing team members', mentionCount: 8 },
      { name: 'Store Manager', role: 'Operations leadership', mentionCount: 5 },
      { name: 'IT Team', role: 'Technology delivery', mentionCount: 6 },
    ],
    interactions: [
      // End Customer journey
      mkI('d1', 'End Customer', 'Discovery', 'Browses online', 'Exploring product options across channels', 'neutral', 0.25, 0.25, 'human', 'autonomous'),
      mkI('d2', 'End Customer', 'Discovery', 'Sees advertisement', 'Notices brand through targeted marketing', 'positive', 0.5, 0.25, 'assisted', 'autonomous'),
      mkI('d3', 'End Customer', 'Engagement', 'Visits store', 'Seeks personalised product advice', 'positive', 0.5, 0.5, 'human', 'assisted', false, true),
      mkI('d4', 'End Customer', 'Commitment', 'Completes purchase', 'Finalises transaction', 'neutral', 0.5, 0.5, 'human', 'autonomous'),
      mkI('d5', 'End Customer', 'Commitment', 'Experiences delay', 'Waits at checkout — friction point', 'critical', 0.75, 0.75, 'human', 'autonomous', true),
      mkI('d6', 'End Customer', 'Fulfilment', 'Receives order', 'Waits for delivery', 'neutral', 0.5, 0.5, 'human', 'assisted'),
      mkI('d7', 'End Customer', 'Support', 'Contacts support', 'Inquires about order status', 'concerned', 0.75, 0.75, 'human', 'autonomous', true),
      mkI('d8', 'End Customer', 'Growth', 'Joins loyalty program', 'Engages with brand long-term', 'positive', 0.25, 0.25, 'assisted', 'autonomous'),
      // Frontline Staff
      mkI('d9', 'Frontline Staff', 'Engagement', 'Provides recommendations', 'Offers personalised advice to customer', 'positive', 0.75, 0.25, 'human', 'assisted', false, true),
      mkI('d10', 'Frontline Staff', 'Engagement', 'Demonstrates product', 'Showcases features in-store', 'positive', 0.75, 0.5, 'human', 'assisted'),
      // Store Manager
      mkI('d11', 'Store Manager', 'Commitment', 'Handles checkout', 'Processes payment and manages queue', 'neutral', 0.75, 0.25, 'human', 'autonomous'),
      mkI('d12', 'Store Manager', 'Support', 'Addresses complaint', 'Resolves customer issue escalation', 'concerned', 0.75, 0.5, 'human', 'assisted'),
      // IT Team
      mkI('d13', 'IT Team', 'Fulfilment', 'Delivers package', 'Last-mile logistics coordination', 'neutral', 0.75, 0.5, 'assisted', 'autonomous'),
      mkI('d14', 'IT Team', 'Growth', 'Sends promotions', 'Automated engagement campaigns', 'positive', 0.5, 0.25, 'assisted', 'autonomous'),
    ],
  };
}
