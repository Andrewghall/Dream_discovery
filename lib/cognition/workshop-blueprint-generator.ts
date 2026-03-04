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
  type JourneyStageEntry,
  type QuestionConstraints,
} from '@/lib/workshop/blueprint';
import { getDomainPack } from '@/lib/domain-packs/registry';

// ================================================================
// Re-export input type for consumers
// ================================================================

export type GeneratorInput = ComposeInput;

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
 * Builds on composeBlueprint() (which handles lenses, actors, data
 * requirements, pacing, agent chain, signals, findings) and enriches
 * with domain-specific journey stages, question constraints, and
 * engagement type modifiers.
 *
 * Pure and deterministic: no LLM calls, no network, no side effects.
 */
export function generateBlueprint(input: GeneratorInput): WorkshopBlueprint {
  // Start with the base composition
  const bp = composeBlueprint(input);

  // Layer: Domain-specific journey stages
  if (input.domainPack) {
    const domainKey = input.domainPack.toLowerCase();
    const journeyTemplate = DOMAIN_JOURNEY_TEMPLATES[domainKey];
    if (journeyTemplate) {
      bp.journeyStages = journeyTemplate.map((s) => ({ ...s }));
    }
  }

  // Layer: Question constraints from domain + engagement type
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
