/**
 * Workshop Blueprint Generator Service
 *
 * Deterministic, pure-function service that produces domain-aware blueprints.
 * Builds on composeBlueprint() (thin layering) and adds:
 *   - Domain-specific journey stage templates
 *   - Question constraints (required/forbidden topics, focus areas, domain metrics)
 *   - Engagement type question modifiers
 *
 * No LLM calls, no network, no side effects.
 */

import {
  composeBlueprint,
  WorkshopBlueprintSchema,
  DEFAULT_BLUEPRINT,
  type ComposeInput,
  type WorkshopBlueprint,
  type LensPolicyEntry,
  type JourneyStageEntry,
  type QuestionConstraints,
} from '@/lib/workshop/blueprint';
import { getDomainPack } from '@/lib/domain-packs/registry';
import type {
  JourneyStageResearch,
  IndustryDimension,
} from '@/lib/cognition/agents/agent-types';

// ================================================================
// Re-export input type for consumers
// ================================================================

export type GeneratorInput = ComposeInput & {
  /** Research-derived journey stages (highest priority override for journeyStages) */
  researchJourneyStages?: JourneyStageResearch[] | null;
  /** Research-derived industry dimensions (highest priority override for lenses) */
  researchDimensions?: IndustryDimension[] | null;
  /** Current blueprint version to increment (omit or -1 for first generation) */
  previousVersion?: number;
  /** Client name -- used for industry context detection (e.g. "Aer Lingus" => airline) */
  clientName?: string | null;
};

// ================================================================
// Domain Journey Stage Templates
// ================================================================

const DOMAIN_JOURNEY_TEMPLATES: Record<string, JourneyStageEntry[]> = {
  contact_centre: [
    { name: 'Contact Initiation', description: 'Customer reaches out through any available channel' },
    { name: 'Identification & Authentication', description: 'Verify customer identity and locate account context' },
    { name: 'Needs Assessment', description: 'Understand the reason for contact and determine urgency' },
    { name: 'Resolution Delivery', description: 'Resolve the issue, fulfil the request, or escalate appropriately' },
    { name: 'Wrap-up & Documentation', description: 'Record outcomes, update records, and flag follow-up actions' },
    { name: 'Follow-up & Feedback', description: 'Post-interaction quality check and customer satisfaction capture' },
  ],
  customer_engagement: [
    { name: 'Awareness', description: 'Customer discovers the brand, product, or service' },
    { name: 'Consideration', description: 'Customer evaluates options and compares alternatives' },
    { name: 'Acquisition', description: 'Customer makes the decision and converts' },
    { name: 'Onboarding', description: 'Customer starts using the product or service for the first time' },
    { name: 'Engagement', description: 'Ongoing interaction, value delivery, and relationship building' },
    { name: 'Advocacy', description: 'Customer recommends, refers, and expands the relationship' },
  ],
  hr_people: [
    { name: 'Attract', description: 'Employer branding, talent pipeline development, and market positioning' },
    { name: 'Recruit', description: 'Selection, assessment, offer management, and hiring decisions' },
    { name: 'Onboard', description: 'New starter induction, integration, and early-stage enablement' },
    { name: 'Develop', description: 'Learning pathways, skill building, and career progression' },
    { name: 'Engage & Retain', description: 'Recognition, engagement programmes, and retention initiatives' },
    { name: 'Transition', description: 'Internal mobility, succession planning, or managed exit' },
  ],
  sales: [
    { name: 'Prospecting', description: 'Identify, research, and qualify potential opportunities' },
    { name: 'Discovery', description: 'Understand buyer needs, stakeholders, and decision criteria' },
    { name: 'Solution Design', description: 'Configure, propose, and present the tailored solution' },
    { name: 'Negotiation', description: 'Align on terms, pricing, commercial conditions, and approvals' },
    { name: 'Close', description: 'Finalise the deal, secure commitment, and hand off to delivery' },
    { name: 'Expand', description: 'Grow the account through upsell, cross-sell, and renewals' },
  ],
  compliance: [
    { name: 'Regulatory Identification', description: 'Track applicable regulations, standards, and upcoming changes' },
    { name: 'Risk Assessment', description: 'Evaluate risk exposure, control gaps, and inherent vulnerabilities' },
    { name: 'Policy Implementation', description: 'Design, deploy, and communicate compliance controls and policies' },
    { name: 'Monitoring', description: 'Ongoing surveillance, testing, and effectiveness review of controls' },
    { name: 'Reporting', description: 'Internal dashboards and external regulatory reporting obligations' },
    { name: 'Remediation', description: 'Address findings, breaches, and drive continuous improvement' },
  ],
  // enterprise: intentionally omitted -- falls through to default journey stages
};

// ================================================================
// Industry-aware Lens Overrides
//
// When the context signals a specific industry (e.g. airline + contact_centre),
// replace the generic domain pack lenses with industry-tuned ones.
// Research-derived lenses still take highest priority.
// ================================================================

const CONTACT_CENTRE_AIRLINE_LENSES: LensPolicyEntry[] = [
  { name: 'Customer Experience', description: 'Passenger journey quality, effort, and satisfaction across all touchpoints', color: '#ddd6fe', keywords: ['customer', 'passenger', 'experience', 'satisfaction', 'effort', 'journey', 'NPS', 'CSAT'] },
  { name: 'People & Workforce', description: 'Agent capability, wellbeing, attrition, scheduling, and career paths', color: '#bfdbfe', keywords: ['people', 'agent', 'staff', 'team', 'attrition', 'recruit', 'wellbeing', 'morale', 'burnout', 'roster'] },
  { name: 'Operations', description: 'Queue management, routing, handle time, SLA delivery, and BPO coordination', color: '#a7f3d0', keywords: ['operation', 'process', 'queue', 'routing', 'handle time', 'SLA', 'BPO', 'workflow', 'efficiency'] },
  { name: 'Technology', description: 'Contact platform, IVR, CRM, automation, and digital channel enablement', color: '#fed7aa', keywords: ['technology', 'system', 'platform', 'IVR', 'CRM', 'digital', 'automation', 'AI', 'chatbot', 'self-service'] },
  { name: 'Training & Capability', description: 'Onboarding, upskilling, knowledge management, and coaching effectiveness', color: '#fef08a', keywords: ['training', 'coach', 'onboard', 'knowledge', 'capability', 'skill', 'development', 'QA'] },
  { name: 'Regulation & Compliance', description: 'Aviation consumer rights (EU261), data protection, accessibility, and complaint obligations', color: '#fecaca', keywords: ['regulation', 'compliance', 'EU261', 'GDPR', 'accessibility', 'complaint', 'legal', 'audit'] },
  { name: 'Organisation & Leadership', description: 'Governance, decision speed, cross-site alignment, and strategic direction', color: '#c4b5fd', keywords: ['organisation', 'leadership', 'governance', 'decision', 'strategy', 'alignment', 'structure'] },
  { name: 'Culture', description: 'Values in practice, psychological safety, service ethic, and continuous improvement mindset', color: '#fbcfe8', keywords: ['culture', 'values', 'mindset', 'safety', 'improvement', 'innovation', 'engagement'] },
];

const CONTACT_CENTRE_AIRLINE_JOURNEY_TEMPLATE: JourneyStageEntry[] = [
  { name: 'Trip Planning & Booking Support', description: 'Customer seeks fare, route, schedule, and booking assistance' },
  { name: 'Pre-Travel Changes & Preparation', description: 'Support for seat, baggage, check-in, special assistance, and itinerary changes' },
  { name: 'Day-of-Travel Support', description: 'Real-time support for check-in, boarding, and airport-side issues' },
  { name: 'Disruption & Recovery', description: 'Handle delays, cancellations, missed connections, and re-accommodation' },
  { name: 'Post-Travel Resolution', description: 'Resolve baggage issues, refunds, compensation, and complaint handling' },
  { name: 'Loyalty & Retention Follow-up', description: 'Recover trust, improve satisfaction, and support loyalty programme interactions' },
];

function normalizeContextText(input: GeneratorInput): string {
  return [
    input.industry ?? '',
    input.clientName ?? '',
    input.domainPack ?? '',
    input.purpose ?? '',
    input.outcomes ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

function isAirlineContactCentreContext(input: GeneratorInput): boolean {
  if ((input.domainPack ?? '').toLowerCase() !== 'contact_centre') return false;
  const text = normalizeContextText(input);
  const airlineSignals = [
    'airline',
    'aviation',
    'airport',
    'flight',
    'passenger',
    'boarding',
    'baggage',
    'check-in',
    'check in',
    'cancellation',
    'delay',
    'rebooking',
    're-accommodation',
    // Client name patterns that strongly signal airline context
    'aer ', 'air ', 'airways', 'jet ', 'ryanair', 'easyjet',
    'vueling', 'wizz', 'flybe', 'loganair', 'lufthansa', 'klm',
    'british airways', 'virgin atlantic', 'delta', 'emirates',
    'qatar', 'etihad', 'singapore airlines', 'cathay',
  ];
  return airlineSignals.some((signal) => text.includes(signal));
}

/**
 * Resolve industry-specific lens overrides.
 * Returns null when no industry-specific override applies (domain pack default is kept).
 */
function resolveIndustryLenses(input: GeneratorInput): LensPolicyEntry[] | null {
  if (isAirlineContactCentreContext(input)) {
    return CONTACT_CENTRE_AIRLINE_LENSES;
  }
  return null;
}

function resolveJourneyTemplate(input: GeneratorInput): JourneyStageEntry[] | null {
  const packKey = (input.domainPack ?? '').toLowerCase();
  if (!packKey) return null;
  if (isAirlineContactCentreContext(input)) {
    return CONTACT_CENTRE_AIRLINE_JOURNEY_TEMPLATE;
  }
  return DOMAIN_JOURNEY_TEMPLATES[packKey] ?? null;
}

// ================================================================
// Domain Question Constraints
// ================================================================

const DOMAIN_QUESTION_CONSTRAINTS: Record<string, QuestionConstraints> = {
  contact_centre: {
    requiredTopics: [
      'Agent day-to-day experience and workload',
      'Handle time drivers and efficiency barriers',
      'First contact resolution success factors',
      'Customer satisfaction and effort drivers',
      'Quality assurance and coaching effectiveness',
      'Workforce planning and scheduling challenges',
    ],
    forbiddenTopics: [
      'Corporate M&A strategy',
      'Product development roadmap details',
      'Investment portfolio management',
    ],
    focusAreas: [
      'Operational efficiency vs customer experience balance',
      'Agent empowerment and decision-making authority',
      'Channel strategy and digital self-service adoption',
      'Technology friction and workaround prevalence',
    ],
    domainMetrics: ['AHT', 'FCR', 'CSAT', 'NPS', 'Attrition', 'Occupancy', 'Service Level'],
  },
  customer_engagement: {
    requiredTopics: [
      'Customer journey pain points and friction',
      'Channel consistency and omnichannel experience',
      'Customer lifetime value drivers',
      'Digital adoption and self-service maturity',
      'Voice of customer feedback loops',
      'Customer data and personalisation capability',
    ],
    forbiddenTopics: [
      'Internal HR policy specifics',
      'Manufacturing process details',
      'Financial instrument structuring',
    ],
    focusAreas: [
      'End-to-end journey orchestration',
      'Data-driven personalisation maturity',
      'Cross-departmental CX ownership',
      'Customer retention and loyalty mechanics',
    ],
    domainMetrics: ['NPS', 'CES', 'CLV', 'Churn Rate', 'Digital Adoption', 'Resolution Time'],
  },
  hr_people: {
    requiredTopics: [
      'Talent pipeline health and hiring challenges',
      'Employee engagement and satisfaction levels',
      'Learning and development programme maturity',
      'Onboarding effectiveness and time-to-productivity',
      'Retention drivers and attrition root causes',
      'HR technology stack and process automation',
    ],
    forbiddenTopics: [
      'Direct revenue and sales targets',
      'Product feature specifications',
      'Customer acquisition cost optimisation',
    ],
    focusAreas: [
      'Employee experience across the full lifecycle',
      'Leadership capability and succession readiness',
      'Culture alignment with stated organisational values',
      'HR operating model effectiveness and agility',
    ],
    domainMetrics: ['Engagement Score', 'Attrition', 'Time to Hire', 'Training Hours', 'Absence Rate', 'Internal Mobility'],
  },
  sales: {
    requiredTopics: [
      'Pipeline health and velocity patterns',
      'Win rate drivers and loss reasons',
      'Sales process adherence and effectiveness',
      'Buyer alignment and decision-maker access',
      'Sales enablement and tool adoption',
      'Quota attainment distribution and forecasting accuracy',
    ],
    forbiddenTopics: [
      'HR internal policy specifics',
      'Manufacturing or supply chain operations',
      'Regulatory compliance frameworks',
    ],
    focusAreas: [
      'Deal progression bottlenecks and stall patterns',
      'Sales and marketing alignment',
      'Rep capability development and coaching',
      'Customer success handoff and expansion motions',
    ],
    domainMetrics: ['Pipeline Velocity', 'Win Rate', 'Deal Cycle', 'Quota Attainment', 'Revenue', 'Churn'],
  },
  compliance: {
    requiredTopics: [
      'Regulatory change tracking and horizon scanning',
      'Risk assessment methodology and coverage',
      'Control effectiveness and testing cadence',
      'Compliance culture and tone from the top',
      'Incident management and breach response',
      'RegTech maturity and automation potential',
    ],
    forbiddenTopics: [
      'Product feature development priorities',
      'Sales pipeline management',
      'Marketing campaign strategy',
    ],
    focusAreas: [
      'Proactive vs reactive compliance posture',
      'Three lines of defence model effectiveness',
      'Data governance and privacy compliance',
      'Regulatory relationship management',
    ],
    domainMetrics: ['Incidents', 'Audit Findings', 'Training Completion', 'Risk Score', 'Remediation Time'],
  },
  enterprise: {
    requiredTopics: [
      'Strategic alignment clarity across functions',
      'Leadership capability and decision-making speed',
      'Customer centricity maturity and evidence',
      'Technology enablement and digital readiness',
      'Transformation readiness and change capacity',
    ],
    forbiddenTopics: [],
    focusAreas: [
      'Cross-functional alignment and collaboration',
      'Strategy-to-execution translation gaps',
      'Innovation capacity and experimentation culture',
      'Organisational agility and responsiveness',
    ],
    domainMetrics: ['Revenue', 'Margin', 'Engagement', 'NPS', 'Digital Maturity', 'Innovation Pipeline'],
  },
};

// ================================================================
// Engagement Type Question Modifiers
// ================================================================

type EngagementModifier = {
  additionalRequired: string[];
  additionalFocus: string[];
};

const ENGAGEMENT_QUESTION_MODIFIERS: Record<string, EngagementModifier> = {
  diagnostic_baseline: {
    additionalRequired: [
      'Current state maturity per dimension',
      'Evidence-based severity scoring',
    ],
    additionalFocus: [
      'Baseline measurement and benchmarking',
      'Quick win identification with low effort',
    ],
  },
  operational_deep_dive: {
    additionalRequired: [
      'Root cause analysis of key pain points',
      'Process friction mapping across workflows',
    ],
    additionalFocus: [
      'Workaround inventory and shadow processes',
      'Impact quantification and cost of inaction',
    ],
  },
  ai_enablement: {
    additionalRequired: [
      'AI readiness per function and team',
      'Data quality and availability assessment',
    ],
    additionalFocus: [
      'Use case identification with feasibility scoring',
      'Change readiness and cultural barriers to AI adoption',
    ],
  },
  transformation_sprint: {
    additionalRequired: [
      '30/60/90 day priority identification',
      'Stakeholder alignment and sponsorship',
    ],
    additionalFocus: [
      'Critical path dependencies and sequencing',
      'Risk mitigation and contingency planning',
    ],
  },
  cultural_alignment: {
    additionalRequired: [
      'Values-in-practice assessment across levels',
      'Psychological safety and speak-up culture',
    ],
    additionalFocus: [
      'Leadership-frontline perception gaps',
      'Cultural enablers and systemic blockers',
    ],
  },
};

// ================================================================
// Generator Function
// ================================================================

/**
 * Generate a domain-aware WorkshopBlueprint.
 *
 * Layering order (later layers win):
 *   1. composeBlueprint() -- defaults < engagement < domain pack < scalars
 *   2. Domain journey templates (from DOMAIN_JOURNEY_TEMPLATES)
 *   2b. Industry-specific lens overrides (e.g. airline contact centre)
 *   3. Research overrides -- research journey stages and industry dimensions
 *   4. Question constraints -- domain + engagement merge
 *   5. Version stamp
 *
 * Pure and deterministic: no LLM calls, no network, no side effects.
 */
export function generateBlueprint(input: GeneratorInput): WorkshopBlueprint {
  // Start with the base composition
  const bp = composeBlueprint(input);

  // Layer 2: Domain-specific journey stages
  const journeyTemplate = resolveJourneyTemplate(input);
  if (journeyTemplate) {
    bp.journeyStages = journeyTemplate.map((s) => ({ ...s }));
  }

  // Layer 2b: Industry-specific lens overrides
  const industryLenses = resolveIndustryLenses(input);
  if (industryLenses) {
    bp.lenses = industryLenses.map((l) => ({ ...l, keywords: [...l.keywords] }));
    // Rebuild phase lens policy for the industry-specific set
    const lensNames = bp.lenses.map((l) => l.name);
    const reimagineTerms = ['people', 'customer', 'experience', 'culture', 'workforce'];
    bp.phaseLensPolicy = {
      REIMAGINE: lensNames.filter((n) => {
        const lower = n.toLowerCase();
        return reimagineTerms.some((term) => lower.includes(term));
      }),
      CONSTRAINTS: [...lensNames],
      DEFINE_APPROACH: [...lensNames],
    };
    if (bp.phaseLensPolicy.REIMAGINE.length === 0) {
      bp.phaseLensPolicy.REIMAGINE = lensNames.slice(0, Math.min(3, lensNames.length));
    }
  }

  // Layer 3: Research overrides (highest priority for journey stages and lenses)
  if (input.researchJourneyStages && input.researchJourneyStages.length > 0) {
    bp.journeyStages = input.researchJourneyStages.map((s) => ({
      name: s.name,
      description: s.description,
    }));
  }

  if (input.researchDimensions && input.researchDimensions.length > 0) {
    bp.lenses = input.researchDimensions.map((d): LensPolicyEntry => ({
      name: d.name,
      description: d.description,
      keywords: [...d.keywords],
      color: d.color,
    }));

    // Rebuild phase lens policy for research-derived lenses
    const lensNames = bp.lenses.map((l) => l.name);
    // REIMAGINE restricts to people/customer/organisation-like dimensions.
    // For research-derived lenses we include all that contain relevant keywords.
    const reimagineTerms = ['people', 'customer', 'organisation', 'organization', 'human', 'employee', 'user', 'client', 'experience'];
    bp.phaseLensPolicy = {
      REIMAGINE: lensNames.filter((n) => {
        const lower = n.toLowerCase();
        return reimagineTerms.some((term) => lower.includes(term));
      }),
      CONSTRAINTS: [...lensNames],
      DEFINE_APPROACH: [...lensNames],
    };
    // Ensure REIMAGINE has at least the first 3 lenses if keyword matching yielded nothing
    if (bp.phaseLensPolicy.REIMAGINE.length === 0) {
      bp.phaseLensPolicy.REIMAGINE = lensNames.slice(0, Math.min(3, lensNames.length));
    }
  }

  // Layer 4: Question constraints from domain + engagement type
  const domainKey = input.domainPack?.toLowerCase() ?? '';
  const etKey = input.engagementType?.toLowerCase() ?? '';

  const domainConstraints = DOMAIN_QUESTION_CONSTRAINTS[domainKey];
  const engagementModifier = ENGAGEMENT_QUESTION_MODIFIERS[etKey];

  if (domainConstraints || engagementModifier) {
    const required = [...(domainConstraints?.requiredTopics ?? [])];
    const forbidden = [...(domainConstraints?.forbiddenTopics ?? [])];
    const focus = [...(domainConstraints?.focusAreas ?? [])];
    const metrics = [...(domainConstraints?.domainMetrics ?? [])];

    // Merge engagement type modifiers
    if (engagementModifier) {
      for (const topic of engagementModifier.additionalRequired) {
        if (!required.includes(topic)) required.push(topic);
      }
      for (const area of engagementModifier.additionalFocus) {
        if (!focus.includes(area)) focus.push(area);
      }
    }

    // If no domain pack but engagement type exists, pull metrics from
    // the engagement type's output emphasis as proxy KPIs
    if (!domainConstraints && engagementModifier && metrics.length === 0) {
      // No domain metrics available without a domain pack
    }

    bp.questionConstraints = {
      requiredTopics: required,
      forbiddenTopics: forbidden,
      focusAreas: focus,
      domainMetrics: metrics,
    };
  }

  // Layer 5: Version stamp
  bp.blueprintVersion = (input.previousVersion ?? -1) + 1;

  // Re-validate the enriched blueprint
  const result = WorkshopBlueprintSchema.safeParse(bp);
  if (!result.success) {
    console.error(
      '[blueprint-generator] Validation failed, falling back to base composition',
      result.error.issues,
    );
    return composeBlueprint(input);
  }

  return result.data as WorkshopBlueprint;
}
