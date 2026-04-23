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
  type ActorEntry,
  type QuestionConstraints,
} from '@/lib/workshop/blueprint';
import { getDomainPack } from '@/lib/domain-packs/registry';
import { resolveIndustryPack } from '@/lib/domain-packs/resolution';
import { getIndustryActors } from '@/lib/cognition/industry-actor-model';
import type {
  JourneyStageResearch,
  IndustryDimension,
  ActorResearch,
} from '@/lib/cognition/agents/agent-types';
import { inferCanonicalEngagementType } from '@/lib/workshop/workshop-definition';

// ================================================================
// Re-export input type for consumers
// ================================================================

export type GeneratorInput = ComposeInput & {
  /** Research-derived journey stages (overridden by curated industry templates when available) */
  researchJourneyStages?: JourneyStageResearch[] | null;
  /** Research-derived industry dimensions (overridden by curated industry lenses when available) */
  researchDimensions?: IndustryDimension[] | null;
  /** Research-derived actor taxonomy (overridden by curated industry actors when available) */
  researchActors?: ActorResearch[] | null;
  /** Current blueprint version to increment (omit or -1 for first generation) */
  previousVersion?: number;
  /** Client name -- used for industry context detection (e.g. "Aer Lingus" => airline) */
  clientName?: string | null;
  /** Target domain for DOMAIN-track workshops (e.g. "Contact Centre") */
  targetDomain?: string | null;
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


const CONTACT_CENTRE_AIRLINE_JOURNEY_TEMPLATE: JourneyStageEntry[] = [
  { name: 'Inspiration & Planning', description: 'Customer searches destinations, compares prices, explores schedules' },
  { name: 'Booking', description: 'Flight selection, payment, seat choice, add-ons (bags, insurance)' },
  { name: 'Pre-Travel Preparation', description: 'Manage booking, changes, upgrades, special assistance, passport/visa checks' },
  { name: 'Check-in', description: 'Online check-in, seat confirmation, boarding pass issuance' },
  { name: 'Airport Journey', description: 'Bag drop, security, boarding gate updates, delays' },
  { name: 'Boarding', description: 'Gate operations, final documentation checks' },
  { name: 'In-Flight Experience', description: 'Cabin service, customer assistance, disruption handling' },
  { name: 'Arrival & Baggage', description: 'Baggage collection, immigration, transfers' },
  { name: 'Post-Journey Support', description: 'Lost baggage, compensation, complaints, loyalty updates' },
  { name: 'Loyalty & Future Engagement', description: 'Frequent flyer programmes, promotions, repeat booking' },
];

const CONTACT_CENTRE_AIRLINE_ACTORS: ActorEntry[] = [
  // Customer actors
  { key: 'passenger', label: 'Passenger / Traveller', description: 'Primary customer interacting with the airline' },
  { key: 'corporate_booker', label: 'Corporate Travel Booker', description: 'Travel manager or company admin booking on behalf of travellers' },
  { key: 'travel_agent', label: 'Travel Agent / OTA', description: 'Third-party booking intermediaries' },
  { key: 'ff_member', label: 'Frequent Flyer Member', description: 'Loyalty programme participant with tiered service' },
  // Contact centre actors
  { key: 'cs_agent', label: 'Customer Service Agent', description: 'Handles calls, chats, emails, social queries' },
  { key: 'specialist_agent', label: 'Specialist Agent', description: 'Baggage, refunds, loyalty, disruptions' },
  { key: 'team_leader', label: 'Team Leader / Supervisor', description: 'Operational oversight, escalations, agent support' },
  { key: 'wfm', label: 'Workforce Management (WFM)', description: 'Forecasting, scheduling, staffing' },
  { key: 'qa', label: 'Quality Assurance (QA)', description: 'Performance evaluation and coaching' },
  { key: 'training', label: 'Training & Enablement', description: 'Agent capability development' },
  { key: 'ops_manager', label: 'Operations Manager', description: 'Contact centre operational leadership' },
  // Wider operational actors
  { key: 'airport_ops', label: 'Airport Operations', description: 'Gate teams, ground services' },
  { key: 'cabin_crew', label: 'Cabin Crew', description: 'In-flight service and incident reporting' },
  { key: 'revenue_mgmt', label: 'Revenue Management', description: 'Pricing, availability, upgrades' },
  { key: 'cx_leadership', label: 'CX Leadership', description: 'Strategic ownership of customer journey' },
  { key: 'it_digital', label: 'IT & Digital Platforms', description: 'Booking systems, CRM, customer data platforms' },
  { key: 'regulators', label: 'Regulators', description: 'CAA, EU261 compliance' },
];

/**
 * Returns true when the user explicitly selected the airline contact centre pack.
 * Detection is based solely on the domain pack key — never on company name or context text.
 */
function isAirlineContactCentreContext(input: GeneratorInput): boolean {
  return (input.domainPack ?? '').toLowerCase() === 'contact_centre_airline';
}

/**
 * Resolve industry-specific lens overrides.
 * Universal 7-lens system — always returns null so all workshops use
 * DEFAULT_DIMENSIONS (People, Operations, Technology, Customer,
 * Commercial, Risk/Compliance, Partners) from the blueprint composition layer.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function resolveIndustryLenses(_input: GeneratorInput): LensPolicyEntry[] | null {
  return null;
}

function resolveJourneyTemplate(input: GeneratorInput): JourneyStageEntry[] | null {
  // Legacy curated override — airline contact centre
  if (isAirlineContactCentreContext(input)) return CONTACT_CENTRE_AIRLINE_JOURNEY_TEMPLATE;
  // Explicit legacy pack key wins when it has a matching journey template
  const packKey = (input.domainPack ?? '').toLowerCase();
  if (packKey && DOMAIN_JOURNEY_TEMPLATES[packKey]) return DOMAIN_JOURNEY_TEMPLATES[packKey];
  // Industry auto-resolve — only when no legacy pack key is set
  if (!input.domainPack) {
    const industryPack = resolveIndustryPack(input.industry, input.engagementType, input.dreamTrack);
    if (industryPack?.journeyStages?.length) {
      return industryPack.journeyStages.map((s) => ({
        name: s.label,
        description: s.description,
      }));
    }
  }
  return null;
}

function normalizeDomainHint(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function resolveTargetDomainActorTaxonomy(input: GeneratorInput): ActorEntry[] | null {
  const targetDomain = normalizeDomainHint(input.targetDomain);

  // When the workshop is structurally focused on a contact-centre domain,
  // prefer the curated contact-centre actor model over generic industry actors.
  if (targetDomain.includes('contact centre') || targetDomain.includes('contact center')) {
    const pack = getDomainPack('contact_centre');
    return pack?.actorTaxonomy.map((actor) => ({
      key: actor.key,
      label: actor.label,
      description: actor.description,
    })) ?? null;
  }

  return null;
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
  DIAGNOSTIC_BASELINE: {
    additionalRequired: [
      'Current state maturity per dimension',
      'Evidence-based severity scoring',
    ],
    additionalFocus: [
      'Baseline measurement and benchmarking',
      'Quick win identification with low effort',
    ],
  },
  DEEP_DIVE: {
    additionalRequired: [
      'Root cause analysis of key pain points',
      'Process friction mapping across workflows',
    ],
    additionalFocus: [
      'Workaround inventory and shadow processes',
      'Impact quantification and cost of inaction',
    ],
  },
  SPRINT: {
    additionalRequired: [
      '30/60/90 day priority identification',
      'Stakeholder alignment and sponsorship',
    ],
    additionalFocus: [
      'Critical path dependencies and sequencing',
      'Risk mitigation and contingency planning',
    ],
  },
  ALIGNMENT: {
    additionalRequired: [
      'Stakeholder alignment and interpretation gaps',
      'Decision-right clarity across the operating model',
    ],
    additionalFocus: [
      'Leadership-frontline perception gaps',
      'Commitment and ownership ambiguity',
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
 *   2. Domain journey templates (generic domain baseline)
 *   3. Research overrides -- only when no curated industry override exists
 *   4. Industry-specific overrides (lenses, journey, actors) -- highest priority
 *   5. Question constraints -- domain + engagement merge
 *   6. Version stamp
 *
 * When a curated industry override exists (e.g. airline contact centre),
 * research is skipped entirely because curated data is higher quality.
 * For generic domains, research overrides the domain-pack defaults.
 *
 * Pure and deterministic: no LLM calls, no network, no side effects.
 */
export function generateBlueprint(input: GeneratorInput): WorkshopBlueprint {
  // Start with the base composition
  const bp = composeBlueprint(input);

  // Detect whether we have a curated industry-specific override (e.g. airline).
  // Industry-specific data is higher confidence than research output and wins.
  // domainPack is null for all industry-pack workshops, so !input.domainPack is a
  // clean discriminator — no heuristics needed.
  const hasIndustryOverride = isAirlineContactCentreContext(input);

  // Layer 2: Domain-specific journey stages (baseline for the domain pack)
  const journeyTemplate = resolveJourneyTemplate(input);
  if (journeyTemplate) {
    bp.journeyStages = journeyTemplate.map((s) => ({ ...s }));
  }

  // Layer 3: Research overrides domain-pack defaults (for generic domains).
  // When a curated industry-specific override exists, research is skipped
  // because the curated data is higher quality and more specific.
  if (!hasIndustryOverride) {
    if (input.researchJourneyStages && input.researchJourneyStages.length > 0) {
      bp.journeyStages = input.researchJourneyStages.map((s) => ({
        name: s.name,
        description: s.description,
      }));
    }

    // Only apply research actors when no domain pack is set.
    // Domain pack actorTaxonomy (set in Layer 1) is authoritative and must not
    // be overwritten by GPT research output.
    if (input.researchActors && input.researchActors.length > 0 && !input.domainPack) {
      bp.actorTaxonomy = input.researchActors.map((a): ActorEntry => ({
        key: a.role.toLowerCase().replace(/[\s\/]+/g, '_').replace(/[^a-z0-9_]/g, ''),
        label: a.role,
        description: a.description,
      }));
    }
  }

  // Layer 4: Industry-specific lens overrides (highest priority)
  const industryLenses = resolveIndustryLenses(input);
  if (industryLenses) {
    bp.lenses = industryLenses.map((l) => ({ ...l, keywords: [...l.keywords] }));
  }

  // Layer 4b: Industry-specific actor taxonomy override
  // Priority: airline contact centre (curated) → target-domain actor model → industry actor model (no domain pack only) → GPT fallback (Layer 3)
  // Domain-pack actors (set in Layer 1 via composeBlueprint) are authoritative — never overwrite them here.
  if (isAirlineContactCentreContext(input)) {
    bp.actorTaxonomy = CONTACT_CENTRE_AIRLINE_ACTORS.map((a) => ({ ...a }));
  } else if (!input.domainPack) {
    const targetDomainActors = resolveTargetDomainActorTaxonomy(input);
    if (targetDomainActors?.length) {
      bp.actorTaxonomy = targetDomainActors.map((actor) => ({ ...actor }));
    } else {
    // Only apply industry model when no domain pack is configured.
    // If a domain pack is set, its actorTaxonomy is already applied in composeBlueprint (Layer 1).
      const industryActorSet = getIndustryActors(input.industry ?? '');
      if (industryActorSet) {
        bp.actorTaxonomy = industryActorSet.actors.map((a) => ({
          key: a.name.toLowerCase().replace(/[\s/]+/g, '_').replace(/[^a-z0-9_]/g, ''),
          label: a.name,
          description: a.tier,
        }));
      }
    }
  }

  // Layer 4: Question constraints from domain + engagement type
  // Only use domainPack when explicitly provided — no implicit fallback for ENTERPRISE track
  const domainKey = input.domainPack?.toLowerCase() ?? '';
  const etKey = inferCanonicalEngagementType({ engagementType: input.engagementType });

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
