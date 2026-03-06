/**
 * Template journey data for the four DREAM phases.
 *
 * Shown in the Output > Journey Maps tabs when no real session data is
 * available for that phase yet. Uses a generic customer service / CX
 * improvement scenario so the structure is meaningful for any workshop.
 *
 * Replace with actual LiveJourneyData once the live session runs.
 */

import type { LiveJourneyData } from '@/lib/cognitive-guidance/pipeline';

const STAGES = ['Awareness', 'Engagement', 'Commitment', 'Delivery', 'Resolution', 'Advocacy'];

const ACTORS = [
  { name: 'Customer',          role: 'End user / service recipient',   mentionCount: 18 },
  { name: 'Frontline Agent',   role: 'First point of contact',          mentionCount: 14 },
  { name: 'Operations Manager',role: 'Oversees service performance',     mentionCount: 9  },
  { name: 'Digital Team',      role: 'Technology and channel owner',     mentionCount: 7  },
];

// ── Phase 1: Discovery (Shell) ────────────────────────────────────────────────
// Current-state baseline. Human-heavy, friction visible, pain points flagged.

export const TEMPLATE_DISCOVERY: LiveJourneyData = {
  stages: STAGES,
  actors: ACTORS,
  interactions: [
    // Customer
    {
      id: 'disc-1', actor: 'Customer', stage: 'Awareness',
      action: 'Searches for service information across multiple channels',
      context: 'Website, social media, word of mouth — inconsistent messaging',
      sentiment: 'neutral', businessIntensity: 0.3, customerIntensity: 0.4,
      aiAgencyNow: 'human', aiAgencyFuture: 'human',
      isPainPoint: false, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0,
    },
    {
      id: 'disc-2', actor: 'Customer', stage: 'Engagement',
      action: 'Contacts support team to ask pre-purchase questions',
      context: 'Phone or email; average wait time 12 minutes',
      sentiment: 'concerned', businessIntensity: 0.5, customerIntensity: 0.7,
      aiAgencyNow: 'human', aiAgencyFuture: 'human',
      isPainPoint: true, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0,
    },
    {
      id: 'disc-3', actor: 'Customer', stage: 'Commitment',
      action: 'Completes onboarding or sign-up process',
      context: 'Paper forms or fragmented digital forms; re-entry of data common',
      sentiment: 'concerned', businessIntensity: 0.6, customerIntensity: 0.8,
      aiAgencyNow: 'human', aiAgencyFuture: 'human',
      isPainPoint: true, isMomentOfTruth: true,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0,
    },
    {
      id: 'disc-4', actor: 'Customer', stage: 'Delivery',
      action: 'Receives core service or product',
      context: 'Variable quality; outcome depends on individual agent skill',
      sentiment: 'neutral', businessIntensity: 0.7, customerIntensity: 0.5,
      aiAgencyNow: 'human', aiAgencyFuture: 'human',
      isPainPoint: false, isMomentOfTruth: true,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0,
    },
    {
      id: 'disc-5', actor: 'Customer', stage: 'Resolution',
      action: 'Raises issue or complaint when service falls short',
      context: 'Re-explains problem multiple times across channels; no single view',
      sentiment: 'critical', businessIntensity: 0.8, customerIntensity: 0.9,
      aiAgencyNow: 'human', aiAgencyFuture: 'human',
      isPainPoint: true, isMomentOfTruth: true,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0,
    },
    {
      id: 'disc-6', actor: 'Customer', stage: 'Advocacy',
      action: 'Decides whether to renew or recommend',
      context: 'Driven by resolution quality; no proactive loyalty touchpoints',
      sentiment: 'neutral', businessIntensity: 0.2, customerIntensity: 0.4,
      aiAgencyNow: 'human', aiAgencyFuture: 'human',
      isPainPoint: false, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0,
    },
    // Frontline Agent
    {
      id: 'disc-7', actor: 'Frontline Agent', stage: 'Engagement',
      action: 'Handles inbound query manually using multiple legacy systems',
      context: '3–4 separate screens; average handle time elevated due to swivel-chair data entry',
      sentiment: 'concerned', businessIntensity: 0.8, customerIntensity: 0.6,
      aiAgencyNow: 'human', aiAgencyFuture: 'human',
      isPainPoint: true, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0,
    },
    {
      id: 'disc-8', actor: 'Frontline Agent', stage: 'Delivery',
      action: 'Delivers service and logs outcome notes',
      context: 'Manual note-taking post-call; inconsistent tagging reduces MI quality',
      sentiment: 'neutral', businessIntensity: 0.7, customerIntensity: 0.5,
      aiAgencyNow: 'human', aiAgencyFuture: 'human',
      isPainPoint: false, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0,
    },
    {
      id: 'disc-9', actor: 'Frontline Agent', stage: 'Resolution',
      action: 'Escalates complex cases to specialist team',
      context: 'No structured escalation path; customer must repeat information',
      sentiment: 'critical', businessIntensity: 0.9, customerIntensity: 0.8,
      aiAgencyNow: 'human', aiAgencyFuture: 'human',
      isPainPoint: true, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0,
    },
    // Operations Manager
    {
      id: 'disc-10', actor: 'Operations Manager', stage: 'Delivery',
      action: 'Reviews daily performance dashboards and SLA adherence',
      context: 'Reporting is T+1; no real-time visibility into live queue pressure',
      sentiment: 'concerned', businessIntensity: 0.6, customerIntensity: 0.3,
      aiAgencyNow: 'human', aiAgencyFuture: 'human',
      isPainPoint: true, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0,
    },
    // Digital Team
    {
      id: 'disc-11', actor: 'Digital Team', stage: 'Commitment',
      action: 'Maintains onboarding digital forms and integrations',
      context: 'Legacy form builder; changes take 6–8 weeks to deploy',
      sentiment: 'concerned', businessIntensity: 0.7, customerIntensity: 0.2,
      aiAgencyNow: 'human', aiAgencyFuture: 'human',
      isPainPoint: true, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0,
    },
  ],
};

// ── Phase 2: Reimagined (Pure) ────────────────────────────────────────────────
// Ideal future state. No constraints applied. Positive sentiment, AI-forward,
// frictionless moments of truth.

export const TEMPLATE_REIMAGINED: LiveJourneyData = {
  stages: STAGES,
  actors: ACTORS,
  interactions: [
    {
      id: 'reim-1', actor: 'Customer', stage: 'Awareness',
      action: 'Discovers personalised service recommendations through AI-curated content',
      context: 'Omnichannel: app, web, SMS — single consistent voice and brand experience',
      sentiment: 'positive', businessIntensity: 0.3, customerIntensity: 0.2,
      aiAgencyNow: 'human', aiAgencyFuture: 'autonomous',
      isPainPoint: false, isMomentOfTruth: false,
      idealBusinessIntensity: 0.2, idealCustomerIntensity: 0.1,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'REIMAGINE',
    },
    {
      id: 'reim-2', actor: 'Customer', stage: 'Engagement',
      action: 'Speaks to an AI assistant that fully resolves query first time',
      context: 'Conversational AI with full context; seamless human handover when needed',
      sentiment: 'positive', businessIntensity: 0.2, customerIntensity: 0.1,
      aiAgencyNow: 'human', aiAgencyFuture: 'autonomous',
      isPainPoint: false, isMomentOfTruth: true,
      idealBusinessIntensity: 0.1, idealCustomerIntensity: 0.1,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'REIMAGINE',
    },
    {
      id: 'reim-3', actor: 'Customer', stage: 'Commitment',
      action: 'Completes fully digital onboarding in under 3 minutes',
      context: 'Pre-filled from verified identity; single sign-on; e-signature',
      sentiment: 'positive', businessIntensity: 0.2, customerIntensity: 0.1,
      aiAgencyNow: 'human', aiAgencyFuture: 'autonomous',
      isPainPoint: false, isMomentOfTruth: true,
      idealBusinessIntensity: 0.2, idealCustomerIntensity: 0.1,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'REIMAGINE',
    },
    {
      id: 'reim-4', actor: 'Customer', stage: 'Delivery',
      action: 'Receives proactively personalised service with no need to chase',
      context: 'AI predicts needs and triggers actions before customer is aware of a gap',
      sentiment: 'positive', businessIntensity: 0.4, customerIntensity: 0.1,
      aiAgencyNow: 'human', aiAgencyFuture: 'autonomous',
      isPainPoint: false, isMomentOfTruth: true,
      idealBusinessIntensity: 0.3, idealCustomerIntensity: 0.1,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'REIMAGINE',
    },
    {
      id: 'reim-5', actor: 'Customer', stage: 'Resolution',
      action: 'Complaint resolved proactively before formal raise',
      context: 'Sentiment detection flags dissatisfaction; agent pre-empts with resolution offer',
      sentiment: 'positive', businessIntensity: 0.5, customerIntensity: 0.2,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: true,
      idealBusinessIntensity: 0.4, idealCustomerIntensity: 0.1,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'REIMAGINE',
    },
    {
      id: 'reim-6', actor: 'Customer', stage: 'Advocacy',
      action: 'Proactively shares positive experience; accepts personalised loyalty offer',
      context: 'NPS trigger sends reward at emotional high-point; referral mechanism built in',
      sentiment: 'positive', businessIntensity: 0.2, customerIntensity: 0.1,
      aiAgencyNow: 'human', aiAgencyFuture: 'autonomous',
      isPainPoint: false, isMomentOfTruth: false,
      idealBusinessIntensity: 0.1, idealCustomerIntensity: 0.1,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'REIMAGINE',
    },
    {
      id: 'reim-7', actor: 'Frontline Agent', stage: 'Engagement',
      action: 'Focuses only on high-empathy, complex cases — AI handles routine',
      context: 'Single unified agent desktop; real-time AI-generated response suggestions',
      sentiment: 'positive', businessIntensity: 0.5, customerIntensity: 0.3,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      idealBusinessIntensity: 0.4, idealCustomerIntensity: 0.2,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'REIMAGINE',
    },
    {
      id: 'reim-8', actor: 'Frontline Agent', stage: 'Resolution',
      action: 'Receives AI-generated resolution package before customer even calls',
      context: 'Predictive case management surfaces probable issues 48h in advance',
      sentiment: 'positive', businessIntensity: 0.4, customerIntensity: 0.2,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      idealBusinessIntensity: 0.3, idealCustomerIntensity: 0.1,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'REIMAGINE',
    },
    {
      id: 'reim-9', actor: 'Operations Manager', stage: 'Delivery',
      action: 'Monitors live AI-generated SLA dashboard with predictive alerts',
      context: 'Real-time MI; AI recommends staffing adjustments before SLA breach',
      sentiment: 'positive', businessIntensity: 0.3, customerIntensity: 0.1,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      idealBusinessIntensity: 0.2, idealCustomerIntensity: 0.1,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'REIMAGINE',
    },
    {
      id: 'reim-10', actor: 'Digital Team', stage: 'Commitment',
      action: 'Deploys onboarding changes via low-code platform in hours not weeks',
      context: 'API-first architecture; composable components; A/B testing built in',
      sentiment: 'positive', businessIntensity: 0.4, customerIntensity: 0.1,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      idealBusinessIntensity: 0.3, idealCustomerIntensity: 0.1,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'REIMAGINE',
    },
  ],
};

// ── Phase 3: Constrained ──────────────────────────────────────────────────────
// Reimagined journey overlaid with real-world constraints.
// Blocking and significant constraints downgrade some interactions.

export const TEMPLATE_CONSTRAINED: LiveJourneyData = {
  stages: STAGES,
  actors: ACTORS,
  interactions: [
    {
      id: 'con-1', actor: 'Customer', stage: 'Awareness',
      action: 'Discovers personalised service recommendations',
      context: 'Omnichannel ambition limited by fragmented data estate — no single customer ID yet',
      sentiment: 'neutral', businessIntensity: 0.4, customerIntensity: 0.3,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      idealBusinessIntensity: 0.2, idealCustomerIntensity: 0.1,
      constraintFlags: [
        { id: 'cf-1', type: 'technical', label: 'No unified customer data platform in place', severity: 'significant', sourceNodeIds: [], addedBy: 'ai' },
      ],
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'CONSTRAINTS',
    },
    {
      id: 'con-2', actor: 'Customer', stage: 'Engagement',
      action: 'Interacts with AI assistant for first-line support',
      context: 'Regulatory requirement for human availability limits full automation; AI must offer transfer within 2 minutes',
      sentiment: 'neutral', businessIntensity: 0.4, customerIntensity: 0.3,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: true,
      idealBusinessIntensity: 0.1, idealCustomerIntensity: 0.1,
      constraintFlags: [
        { id: 'cf-2', type: 'regulatory', label: 'FCA CONC rules require human agent access within defined SLA', severity: 'blocking', sourceNodeIds: [], addedBy: 'ai' },
      ],
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'CONSTRAINTS',
    },
    {
      id: 'con-3', actor: 'Customer', stage: 'Commitment',
      action: 'Completes partially digitised onboarding process',
      context: 'Full digital onboarding blocked by wet-signature requirement for regulated products',
      sentiment: 'concerned', businessIntensity: 0.6, customerIntensity: 0.5,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: true, isMomentOfTruth: true,
      idealBusinessIntensity: 0.2, idealCustomerIntensity: 0.1,
      constraintFlags: [
        { id: 'cf-3', type: 'regulatory', label: 'Wet signature required for regulated product agreements', severity: 'blocking', sourceNodeIds: [], addedBy: 'ai' },
        { id: 'cf-4', type: 'technical', label: 'Legacy CRM cannot accept e-sign outputs without manual re-keying', severity: 'significant', sourceNodeIds: [], addedBy: 'ai' },
      ],
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'CONSTRAINTS',
    },
    {
      id: 'con-4', actor: 'Customer', stage: 'Delivery',
      action: 'Receives service with some proactive personalisation',
      context: 'Predictive engine delayed 18 months — interim: rules-based triggers only',
      sentiment: 'neutral', businessIntensity: 0.6, customerIntensity: 0.4,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: true,
      idealBusinessIntensity: 0.3, idealCustomerIntensity: 0.1,
      constraintFlags: [
        { id: 'cf-5', type: 'technical', label: 'Predictive ML model not available until Phase 2 budget cycle', severity: 'significant', sourceNodeIds: [], addedBy: 'ai' },
        { id: 'cf-6', type: 'budget', label: 'Personalisation engine deferred to Year 2 investment case', severity: 'significant', sourceNodeIds: [], addedBy: 'ai' },
      ],
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'CONSTRAINTS',
    },
    {
      id: 'con-5', actor: 'Customer', stage: 'Resolution',
      action: 'Complaint handled with AI-assisted triage but human resolution',
      context: 'Sentiment detection available but automated resolution blocked by complaints-handling policy',
      sentiment: 'concerned', businessIntensity: 0.7, customerIntensity: 0.6,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: true, isMomentOfTruth: true,
      idealBusinessIntensity: 0.4, idealCustomerIntensity: 0.1,
      constraintFlags: [
        { id: 'cf-7', type: 'regulatory', label: 'FOS complaints-handling rules require human decision on outcomes', severity: 'blocking', sourceNodeIds: [], addedBy: 'ai' },
        { id: 'cf-8', type: 'organisational', label: 'Complaints team not yet trained on AI-assist tooling', severity: 'manageable', sourceNodeIds: [], addedBy: 'ai' },
      ],
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'CONSTRAINTS',
    },
    {
      id: 'con-6', actor: 'Customer', stage: 'Advocacy',
      action: 'Accepts loyalty offer at renewal; referral mechanism is manual',
      context: 'Automated referral platform not in budget; handled via agent script',
      sentiment: 'neutral', businessIntensity: 0.3, customerIntensity: 0.3,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      idealBusinessIntensity: 0.1, idealCustomerIntensity: 0.1,
      constraintFlags: [
        { id: 'cf-9', type: 'budget', label: 'Referral platform not funded in current cycle', severity: 'manageable', sourceNodeIds: [], addedBy: 'ai' },
      ],
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'CONSTRAINTS',
    },
    {
      id: 'con-7', actor: 'Frontline Agent', stage: 'Engagement',
      action: 'Uses AI-assisted desktop but still manages 3 legacy systems',
      context: 'Full system consolidation is 2-year programme; interim overlay tool bridges gap',
      sentiment: 'neutral', businessIntensity: 0.7, customerIntensity: 0.4,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      constraintFlags: [
        { id: 'cf-10', type: 'technical', label: 'Legacy systems decommission not achievable within project timeline', severity: 'significant', sourceNodeIds: [], addedBy: 'ai' },
      ],
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'CONSTRAINTS',
    },
    {
      id: 'con-8', actor: 'Operations Manager', stage: 'Delivery',
      action: 'Uses near-real-time MI dashboard (30-minute lag)',
      context: 'Real-time data pipeline not yet available; warehouse refresh cycle limits insight timeliness',
      sentiment: 'neutral', businessIntensity: 0.5, customerIntensity: 0.2,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      constraintFlags: [
        { id: 'cf-11', type: 'technical', label: 'Data warehouse 30-min refresh cycle; real-time streaming deferred', severity: 'manageable', sourceNodeIds: [], addedBy: 'ai' },
      ],
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'CONSTRAINTS',
    },
  ],
};

// ── Phase 4: Defined Approach ─────────────────────────────────────────────────
// The agreed implementation plan. Pragmatic, sequenced, delivery-ready.
// AI agency reflects what's actually achievable in the first release.

export const TEMPLATE_DEFINED: LiveJourneyData = {
  stages: STAGES,
  actors: ACTORS,
  interactions: [
    {
      id: 'def-1', actor: 'Customer', stage: 'Awareness',
      action: 'Finds service through unified digital presence with consistent messaging',
      context: 'Phase 1: single brand voice across web + app. Personalisation in Phase 2.',
      sentiment: 'positive', businessIntensity: 0.3, customerIntensity: 0.2,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'DEFINE_APPROACH',
    },
    {
      id: 'def-2', actor: 'Customer', stage: 'Engagement',
      action: 'Interacts with AI chatbot for tier-1 queries; transfers to agent for complex',
      context: 'Chatbot handles 60% of inbound; human transfer with full context passed through',
      sentiment: 'positive', businessIntensity: 0.3, customerIntensity: 0.2,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: true,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'DEFINE_APPROACH',
    },
    {
      id: 'def-3', actor: 'Customer', stage: 'Commitment',
      action: 'Completes digital onboarding with e-signature for standard products; paper for regulated',
      context: 'Two-track onboarding: digital-first where permitted; hybrid where regulatory requirement exists',
      sentiment: 'neutral', businessIntensity: 0.5, customerIntensity: 0.4,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: true,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'DEFINE_APPROACH',
    },
    {
      id: 'def-4', actor: 'Customer', stage: 'Delivery',
      action: 'Receives service with rules-based proactive alerts and milestone check-ins',
      context: 'Rules engine triggers proactive outreach at key moments; full ML model in Year 2',
      sentiment: 'positive', businessIntensity: 0.5, customerIntensity: 0.3,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: true,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'DEFINE_APPROACH',
    },
    {
      id: 'def-5', actor: 'Customer', stage: 'Resolution',
      action: 'AI-triaged complaint routed to specialist with full case history',
      context: 'Sentiment detection flags risk cases; human agent makes final determination (FOS compliant)',
      sentiment: 'neutral', businessIntensity: 0.6, customerIntensity: 0.4,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: true,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'DEFINE_APPROACH',
    },
    {
      id: 'def-6', actor: 'Customer', stage: 'Advocacy',
      action: 'Receives personalised renewal offer via preferred channel at right moment',
      context: 'Propensity model identifies at-risk customers 30 days before renewal; agent script used',
      sentiment: 'positive', businessIntensity: 0.3, customerIntensity: 0.2,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'DEFINE_APPROACH',
    },
    {
      id: 'def-7', actor: 'Frontline Agent', stage: 'Engagement',
      action: 'Uses unified agent desktop with AI-generated next-best-action suggestions',
      context: 'Overlay tool on existing systems; full consolidation in Year 2 programme',
      sentiment: 'positive', businessIntensity: 0.6, customerIntensity: 0.3,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'DEFINE_APPROACH',
    },
    {
      id: 'def-8', actor: 'Frontline Agent', stage: 'Resolution',
      action: 'Receives AI-generated resolution options; selects and applies with one click',
      context: 'Case management system updated with resolution outcome; automated quality-check sampling',
      sentiment: 'positive', businessIntensity: 0.5, customerIntensity: 0.2,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'DEFINE_APPROACH',
    },
    {
      id: 'def-9', actor: 'Operations Manager', stage: 'Delivery',
      action: 'Reviews near-real-time SLA dashboard; receives predictive staffing alerts',
      context: '30-minute MI lag; rules-based alerts flag SLA risk 2 hours ahead of breach',
      sentiment: 'positive', businessIntensity: 0.4, customerIntensity: 0.2,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'DEFINE_APPROACH',
    },
    {
      id: 'def-10', actor: 'Digital Team', stage: 'Commitment',
      action: 'Deploys low-code onboarding form changes within 2-week sprint',
      context: 'New platform in place for standard products; legacy system maintained for regulated flows',
      sentiment: 'positive', businessIntensity: 0.4, customerIntensity: 0.1,
      aiAgencyNow: 'human', aiAgencyFuture: 'assisted',
      isPainPoint: false, isMomentOfTruth: false,
      sourceNodeIds: [], addedBy: 'ai', createdAtMs: 0, phaseAdded: 'DEFINE_APPROACH',
    },
  ],
};

/** Map from phase key to its template data */
export const PHASE_TEMPLATES: Record<string, LiveJourneyData> = {
  discovery:   TEMPLATE_DISCOVERY,
  reimagined:  TEMPLATE_REIMAGINED,
  constrained: TEMPLATE_CONSTRAINED,
  defined:     TEMPLATE_DEFINED,
};
