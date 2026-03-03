/**
 * Domain Pack Registry
 *
 * Data-driven configuration objects per business domain.
 * Each pack defines lenses, actor taxonomy, metric references,
 * question templates, and diagnostic output structure.
 *
 * Domain packs are resolved at workshop creation time and stored
 * as a JSON snapshot on the Workshop model (domainPackConfig).
 */

import type { LensName } from '@/lib/cognition/agents/agent-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActorRole {
  key: string;
  label: string;
  description: string;
}

export interface MetricReference {
  key: string;
  label: string;
  unit: string;
  description: string;
}

export interface QuestionTemplate {
  lens: LensName | 'General';
  text: string;
  purpose: string;
  captureTypes: string[]; // Which capture types this applies to
}

export interface DiagnosticOutputField {
  key: string;
  label: string;
  lens: LensName | 'cross-lens';
  description: string;
}

export interface DomainPack {
  key: string;
  label: string;
  description: string;
  category: 'operational' | 'strategic';
  lenses: LensName[];
  actorTaxonomy: ActorRole[];
  metricReferences: MetricReference[];
  questionTemplates: QuestionTemplate[];
  diagnosticOutputFields: DiagnosticOutputField[];
}

// ---------------------------------------------------------------------------
// Contact Centre (Operational)
// ---------------------------------------------------------------------------

const CONTACT_CENTRE: DomainPack = {
  key: 'contact_centre',
  label: 'Contact Centre',
  description: 'Operational domain pack for contact centre and customer service operations',
  category: 'operational',
  lenses: ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'],
  actorTaxonomy: [
    { key: 'head_of_ops', label: 'Head of Operations', description: 'Senior operational leadership' },
    { key: 'team_leader', label: 'Team Leader', description: 'Front-line management' },
    { key: 'agent', label: 'Agent / Advisor', description: 'Front-line customer-facing staff' },
    { key: 'quality_analyst', label: 'Quality Analyst', description: 'Quality assurance and monitoring' },
    { key: 'workforce_planner', label: 'Workforce Planner', description: 'Scheduling and capacity planning' },
    { key: 'trainer', label: 'Trainer / Coach', description: 'Training and development' },
    { key: 'it_support', label: 'IT / Systems Support', description: 'Technology and infrastructure support' },
    { key: 'customer', label: 'Customer (observed)', description: 'Customer behaviour observed during walkaround' },
  ],
  metricReferences: [
    { key: 'aht', label: 'Average Handle Time', unit: 'seconds', description: 'Mean duration of customer interactions' },
    { key: 'fcr', label: 'First Contact Resolution', unit: '%', description: 'Percentage resolved on first contact' },
    { key: 'csat', label: 'Customer Satisfaction', unit: 'score', description: 'Post-interaction satisfaction rating' },
    { key: 'nps', label: 'Net Promoter Score', unit: 'score', description: 'Customer loyalty metric' },
    { key: 'attrition', label: 'Agent Attrition Rate', unit: '%', description: 'Annual agent turnover rate' },
    { key: 'occupancy', label: 'Occupancy Rate', unit: '%', description: 'Percentage of time agents are handling contacts' },
    { key: 'service_level', label: 'Service Level', unit: '%', description: 'Percentage of calls answered within target time' },
  ],
  questionTemplates: [
    {
      lens: 'People',
      text: 'Walk me through a typical day for someone in your role here.',
      purpose: 'Understand lived experience and daily friction points',
      captureTypes: ['operational_interview', 'walkaround'],
    },
    {
      lens: 'People',
      text: 'What training or support would make the biggest difference to your team?',
      purpose: 'Surface capability gaps and development needs',
      captureTypes: ['manager_interview', 'operational_interview'],
    },
    {
      lens: 'Organisation',
      text: 'How do decisions flow from leadership down to the floor?',
      purpose: 'Map governance and decision-making speed',
      captureTypes: ['executive_interview', 'manager_interview'],
    },
    {
      lens: 'Customer',
      text: 'What are customers actually asking for that you cannot deliver today?',
      purpose: 'Identify unmet customer needs and service gaps',
      captureTypes: ['operational_interview', 'manager_interview'],
    },
    {
      lens: 'Technology',
      text: 'Which systems slow you down or cause workarounds?',
      purpose: 'Identify technology friction and technical debt',
      captureTypes: ['operational_interview', 'walkaround'],
    },
    {
      lens: 'Regulation',
      text: 'Where do compliance requirements conflict with customer experience?',
      purpose: 'Surface regulatory friction and compliance overhead',
      captureTypes: ['manager_interview', 'executive_interview'],
    },
  ],
  diagnosticOutputFields: [
    { key: 'agent_experience', label: 'Agent Experience Assessment', lens: 'People', description: 'Front-line staff satisfaction, capability, and retention risk' },
    { key: 'service_delivery', label: 'Service Delivery Model', lens: 'Organisation', description: 'Operating model effectiveness and process efficiency' },
    { key: 'customer_effort', label: 'Customer Effort Score', lens: 'Customer', description: 'Friction in customer journeys and resolution paths' },
    { key: 'tech_stack_fitness', label: 'Technology Stack Fitness', lens: 'Technology', description: 'Platform capability vs operational needs' },
    { key: 'compliance_burden', label: 'Compliance Burden', lens: 'Regulation', description: 'Regulatory overhead impact on operations' },
    { key: 'structural_gaps', label: 'Structural Gaps', lens: 'cross-lens', description: 'Cross-domain systemic weaknesses' },
  ],
};

// ---------------------------------------------------------------------------
// Customer Engagement (Strategic)
// ---------------------------------------------------------------------------

const CUSTOMER_ENGAGEMENT: DomainPack = {
  key: 'customer_engagement',
  label: 'Customer Engagement',
  description: 'Strategic domain pack for customer engagement and experience transformation',
  category: 'strategic',
  lenses: ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'],
  actorTaxonomy: [
    { key: 'cxo', label: 'CXO / Director', description: 'Executive leadership' },
    { key: 'head_of_cx', label: 'Head of CX', description: 'Customer experience leadership' },
    { key: 'head_of_digital', label: 'Head of Digital', description: 'Digital channels and platforms' },
    { key: 'marketing_lead', label: 'Marketing Lead', description: 'Marketing strategy and campaigns' },
    { key: 'product_owner', label: 'Product Owner', description: 'Product management and roadmap' },
    { key: 'journey_owner', label: 'Journey Owner', description: 'End-to-end customer journey ownership' },
    { key: 'data_analyst', label: 'Data / Insights Analyst', description: 'Customer data and analytics' },
    { key: 'frontline_staff', label: 'Frontline Staff', description: 'Customer-facing team members' },
  ],
  metricReferences: [
    { key: 'nps', label: 'Net Promoter Score', unit: 'score', description: 'Customer loyalty and advocacy' },
    { key: 'ces', label: 'Customer Effort Score', unit: 'score', description: 'Ease of interaction' },
    { key: 'clv', label: 'Customer Lifetime Value', unit: 'currency', description: 'Revenue per customer over time' },
    { key: 'churn_rate', label: 'Churn Rate', unit: '%', description: 'Customer attrition percentage' },
    { key: 'digital_adoption', label: 'Digital Adoption Rate', unit: '%', description: 'Percentage of interactions via digital' },
    { key: 'resolution_time', label: 'Resolution Time', unit: 'hours', description: 'Average time to resolve customer issues' },
  ],
  questionTemplates: [
    {
      lens: 'Customer',
      text: 'What does an ideal customer relationship look like in 3 years?',
      purpose: 'Define the aspirational customer engagement vision',
      captureTypes: ['executive_interview'],
    },
    {
      lens: 'Organisation',
      text: 'How is customer experience owned and measured across departments?',
      purpose: 'Map CX governance and accountability',
      captureTypes: ['executive_interview', 'manager_interview'],
    },
    {
      lens: 'Technology',
      text: 'Where are the gaps between your data and the customer view you need?',
      purpose: 'Identify data and technology enablement needs',
      captureTypes: ['manager_interview', 'operational_interview'],
    },
    {
      lens: 'People',
      text: 'How empowered are your teams to resolve customer issues without escalation?',
      purpose: 'Assess autonomy and decision-making at the frontline',
      captureTypes: ['manager_interview', 'operational_interview'],
    },
  ],
  diagnosticOutputFields: [
    { key: 'cx_maturity', label: 'CX Maturity Assessment', lens: 'Customer', description: 'Current vs target customer experience maturity' },
    { key: 'engagement_model', label: 'Engagement Model Fitness', lens: 'Organisation', description: 'How well the operating model supports customer engagement' },
    { key: 'digital_readiness', label: 'Digital Readiness', lens: 'Technology', description: 'Technology capability to support modern engagement' },
    { key: 'people_enablement', label: 'People Enablement', lens: 'People', description: 'Staff capability and empowerment for CX delivery' },
    { key: 'cross_channel', label: 'Cross-Channel Consistency', lens: 'cross-lens', description: 'Consistency of experience across all touchpoints' },
  ],
};

// ---------------------------------------------------------------------------
// HR / People
// ---------------------------------------------------------------------------

const HR_PEOPLE: DomainPack = {
  key: 'hr_people',
  label: 'HR / People',
  description: 'Domain pack for HR, people operations, and workforce transformation',
  category: 'strategic',
  lenses: ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'],
  actorTaxonomy: [
    { key: 'chro', label: 'CHRO / HR Director', description: 'HR executive leadership' },
    { key: 'hr_bp', label: 'HR Business Partner', description: 'Strategic HR partnering with business units' },
    { key: 'talent_lead', label: 'Talent Acquisition Lead', description: 'Recruitment and talent pipeline' },
    { key: 'l_and_d', label: 'L&D Manager', description: 'Learning and development' },
    { key: 'ops_manager', label: 'Operations Manager', description: 'Line management perspective' },
    { key: 'employee', label: 'Employee', description: 'Front-line employee perspective' },
    { key: 'payroll_admin', label: 'Payroll / Benefits Admin', description: 'Compensation and benefits administration' },
    { key: 'er_specialist', label: 'Employee Relations Specialist', description: 'Employee relations and compliance' },
  ],
  metricReferences: [
    { key: 'engagement_score', label: 'Employee Engagement Score', unit: 'score', description: 'Overall engagement metric' },
    { key: 'attrition', label: 'Attrition Rate', unit: '%', description: 'Annual voluntary turnover' },
    { key: 'time_to_hire', label: 'Time to Hire', unit: 'days', description: 'Average days from requisition to start' },
    { key: 'training_hours', label: 'Training Hours per Employee', unit: 'hours', description: 'Average annual training investment' },
    { key: 'absence_rate', label: 'Absence Rate', unit: '%', description: 'Unplanned absence percentage' },
    { key: 'internal_mobility', label: 'Internal Mobility Rate', unit: '%', description: 'Percentage of roles filled internally' },
  ],
  questionTemplates: [
    {
      lens: 'People',
      text: 'What is the biggest barrier to retaining your best people?',
      purpose: 'Identify retention drivers and risks',
      captureTypes: ['executive_interview', 'manager_interview'],
    },
    {
      lens: 'Organisation',
      text: 'How aligned is HR strategy with the overall business strategy?',
      purpose: 'Assess HR-business alignment',
      captureTypes: ['executive_interview'],
    },
    {
      lens: 'Technology',
      text: 'Which HR processes are still manual that should be automated?',
      purpose: 'Identify automation and digitisation opportunities',
      captureTypes: ['manager_interview', 'operational_interview'],
    },
    {
      lens: 'Regulation',
      text: 'Where do employment regulations create the most friction in daily operations?',
      purpose: 'Surface regulatory compliance burden',
      captureTypes: ['manager_interview', 'operational_interview'],
    },
  ],
  diagnosticOutputFields: [
    { key: 'talent_health', label: 'Talent Pipeline Health', lens: 'People', description: 'Recruitment, retention, and development effectiveness' },
    { key: 'hr_operating_model', label: 'HR Operating Model', lens: 'Organisation', description: 'HR service delivery model fitness' },
    { key: 'employee_experience', label: 'Employee Experience', lens: 'Customer', description: 'Internal customer (employee) journey quality' },
    { key: 'hr_tech_stack', label: 'HR Technology Stack', lens: 'Technology', description: 'HRIS and tooling capability assessment' },
    { key: 'compliance_posture', label: 'Compliance Posture', lens: 'Regulation', description: 'Employment law and regulation readiness' },
  ],
};

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

const SALES: DomainPack = {
  key: 'sales',
  label: 'Sales',
  description: 'Domain pack for sales operations and revenue transformation',
  category: 'operational',
  lenses: ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'],
  actorTaxonomy: [
    { key: 'sales_director', label: 'Sales Director', description: 'Sales leadership' },
    { key: 'sales_manager', label: 'Sales Manager', description: 'Regional or team sales management' },
    { key: 'account_exec', label: 'Account Executive', description: 'Enterprise or mid-market sales' },
    { key: 'bdr', label: 'BDR / SDR', description: 'Business/sales development representative' },
    { key: 'sales_ops', label: 'Sales Operations', description: 'Sales process, tools, and analytics' },
    { key: 'pre_sales', label: 'Pre-Sales / Solutions', description: 'Technical pre-sales and solution design' },
    { key: 'cs_manager', label: 'Customer Success Manager', description: 'Post-sale customer success' },
  ],
  metricReferences: [
    { key: 'pipeline_velocity', label: 'Pipeline Velocity', unit: 'currency/day', description: 'Rate at which pipeline converts to revenue' },
    { key: 'win_rate', label: 'Win Rate', unit: '%', description: 'Percentage of opportunities won' },
    { key: 'deal_cycle', label: 'Average Deal Cycle', unit: 'days', description: 'Mean time from opportunity to close' },
    { key: 'quota_attainment', label: 'Quota Attainment', unit: '%', description: 'Percentage of reps hitting quota' },
    { key: 'arr', label: 'ARR / Revenue', unit: 'currency', description: 'Annual recurring revenue or total revenue' },
    { key: 'churn', label: 'Revenue Churn', unit: '%', description: 'Lost revenue from existing customers' },
  ],
  questionTemplates: [
    {
      lens: 'People',
      text: 'What separates your top performers from the rest?',
      purpose: 'Identify success patterns and capability gaps',
      captureTypes: ['manager_interview', 'executive_interview'],
    },
    {
      lens: 'Organisation',
      text: 'How well does the handoff work between sales and delivery?',
      purpose: 'Assess cross-functional process quality',
      captureTypes: ['manager_interview', 'operational_interview'],
    },
    {
      lens: 'Customer',
      text: 'What are customers telling you about why they buy or do not buy?',
      purpose: 'Surface buying decision drivers and blockers',
      captureTypes: ['operational_interview', 'manager_interview'],
    },
    {
      lens: 'Technology',
      text: 'How much time do reps spend in the CRM vs selling?',
      purpose: 'Measure technology friction and admin overhead',
      captureTypes: ['operational_interview', 'walkaround'],
    },
  ],
  diagnosticOutputFields: [
    { key: 'sales_effectiveness', label: 'Sales Effectiveness', lens: 'People', description: 'Rep capability, coaching, and performance distribution' },
    { key: 'go_to_market', label: 'Go-to-Market Model', lens: 'Organisation', description: 'Sales motion, territory, and coverage model fitness' },
    { key: 'buyer_alignment', label: 'Buyer Alignment', lens: 'Customer', description: 'How well the sales process matches buyer expectations' },
    { key: 'sales_tech', label: 'Sales Technology Stack', lens: 'Technology', description: 'CRM, enablement, and analytics tool effectiveness' },
    { key: 'revenue_risk', label: 'Revenue Risk Factors', lens: 'cross-lens', description: 'Systemic risks to revenue performance' },
  ],
};

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

const COMPLIANCE: DomainPack = {
  key: 'compliance',
  label: 'Compliance',
  description: 'Domain pack for regulatory compliance, risk, and governance',
  category: 'strategic',
  lenses: ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'],
  actorTaxonomy: [
    { key: 'cco', label: 'Chief Compliance Officer', description: 'Compliance executive leadership' },
    { key: 'compliance_manager', label: 'Compliance Manager', description: 'Compliance programme management' },
    { key: 'risk_analyst', label: 'Risk Analyst', description: 'Risk assessment and monitoring' },
    { key: 'legal_counsel', label: 'Legal Counsel', description: 'Legal advisory and interpretation' },
    { key: 'internal_audit', label: 'Internal Auditor', description: 'Audit and assurance' },
    { key: 'ops_lead', label: 'Operations Lead', description: 'Operational compliance implementation' },
    { key: 'data_officer', label: 'Data Protection Officer', description: 'Data privacy and protection' },
  ],
  metricReferences: [
    { key: 'incidents', label: 'Compliance Incidents', unit: 'count', description: 'Number of compliance breaches or near-misses' },
    { key: 'audit_findings', label: 'Open Audit Findings', unit: 'count', description: 'Unresolved audit findings' },
    { key: 'training_completion', label: 'Training Completion', unit: '%', description: 'Mandatory compliance training completion rate' },
    { key: 'risk_score', label: 'Residual Risk Score', unit: 'score', description: 'Aggregate residual risk assessment' },
    { key: 'remediation_time', label: 'Remediation Time', unit: 'days', description: 'Average time to close compliance findings' },
  ],
  questionTemplates: [
    {
      lens: 'Regulation',
      text: 'Which regulatory changes are most likely to disrupt your operations in the next 12 months?',
      purpose: 'Identify emerging regulatory risk',
      captureTypes: ['executive_interview', 'manager_interview'],
    },
    {
      lens: 'Organisation',
      text: 'How does compliance accountability flow through the organisation?',
      purpose: 'Map the three lines of defence effectiveness',
      captureTypes: ['executive_interview', 'manager_interview'],
    },
    {
      lens: 'Technology',
      text: 'Where are you still relying on manual processes for compliance monitoring?',
      purpose: 'Identify automation and RegTech opportunities',
      captureTypes: ['manager_interview', 'operational_interview'],
    },
    {
      lens: 'People',
      text: 'How confident are front-line staff in making compliant decisions independently?',
      purpose: 'Assess compliance culture and capability',
      captureTypes: ['operational_interview', 'walkaround'],
    },
  ],
  diagnosticOutputFields: [
    { key: 'compliance_culture', label: 'Compliance Culture', lens: 'People', description: 'Staff awareness, capability, and behaviour' },
    { key: 'governance_model', label: 'Governance Model', lens: 'Organisation', description: 'Three lines of defence effectiveness' },
    { key: 'customer_impact', label: 'Customer Impact', lens: 'Customer', description: 'How compliance affects customer experience' },
    { key: 'regtech_maturity', label: 'RegTech Maturity', lens: 'Technology', description: 'Compliance technology and automation capability' },
    { key: 'regulatory_readiness', label: 'Regulatory Readiness', lens: 'Regulation', description: 'Preparedness for upcoming regulatory changes' },
    { key: 'systemic_risk', label: 'Systemic Risk Factors', lens: 'cross-lens', description: 'Cross-domain compliance risk patterns' },
  ],
};

// ---------------------------------------------------------------------------
// Enterprise
// ---------------------------------------------------------------------------

const ENTERPRISE: DomainPack = {
  key: 'enterprise',
  label: 'Enterprise',
  description: 'Full enterprise-wide domain pack covering all business functions',
  category: 'strategic',
  lenses: ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'],
  actorTaxonomy: [
    { key: 'ceo', label: 'CEO / MD', description: 'Chief executive leadership' },
    { key: 'cfo', label: 'CFO / Finance Director', description: 'Financial leadership' },
    { key: 'coo', label: 'COO / Operations Director', description: 'Operational leadership' },
    { key: 'cto', label: 'CTO / CIO', description: 'Technology leadership' },
    { key: 'chro', label: 'CHRO / People Director', description: 'People leadership' },
    { key: 'dept_head', label: 'Department Head', description: 'Business unit leadership' },
    { key: 'middle_mgmt', label: 'Middle Management', description: 'Team and project leadership' },
    { key: 'frontline', label: 'Frontline Staff', description: 'Operational and customer-facing staff' },
  ],
  metricReferences: [
    { key: 'revenue', label: 'Revenue', unit: 'currency', description: 'Total revenue' },
    { key: 'margin', label: 'Operating Margin', unit: '%', description: 'Operating profit margin' },
    { key: 'engagement', label: 'Employee Engagement', unit: 'score', description: 'Staff engagement survey score' },
    { key: 'nps', label: 'Net Promoter Score', unit: 'score', description: 'Customer loyalty metric' },
    { key: 'digital_maturity', label: 'Digital Maturity', unit: 'score', description: 'Organisation-wide digital capability' },
    { key: 'innovation_pipeline', label: 'Innovation Pipeline', unit: 'count', description: 'Number of active innovation initiatives' },
  ],
  questionTemplates: [
    {
      lens: 'General',
      text: 'What is the single biggest strategic challenge facing the organisation right now?',
      purpose: 'Anchor the diagnostic around the core strategic tension',
      captureTypes: ['executive_interview'],
    },
    {
      lens: 'People',
      text: 'Where is the organisation losing talent it cannot afford to lose?',
      purpose: 'Identify critical talent retention risks',
      captureTypes: ['executive_interview', 'manager_interview'],
    },
    {
      lens: 'Organisation',
      text: 'Which processes are the biggest drag on speed and agility?',
      purpose: 'Surface structural and process bottlenecks',
      captureTypes: ['manager_interview', 'operational_interview'],
    },
    {
      lens: 'Customer',
      text: 'How well does the organisation actually listen to its customers?',
      purpose: 'Assess voice-of-customer integration',
      captureTypes: ['executive_interview', 'manager_interview'],
    },
    {
      lens: 'Technology',
      text: 'Where is technology enabling the business vs holding it back?',
      purpose: 'Map technology as enabler vs constraint',
      captureTypes: ['executive_interview', 'manager_interview'],
    },
    {
      lens: 'Regulation',
      text: 'Which regulatory or governance requirements create the most friction?',
      purpose: 'Identify compliance burden and regulatory risk',
      captureTypes: ['executive_interview', 'manager_interview'],
    },
  ],
  diagnosticOutputFields: [
    { key: 'strategic_alignment', label: 'Strategic Alignment', lens: 'Organisation', description: 'How well strategy cascades through the organisation' },
    { key: 'talent_capability', label: 'Talent & Capability', lens: 'People', description: 'Workforce capability, engagement, and readiness' },
    { key: 'customer_centricity', label: 'Customer Centricity', lens: 'Customer', description: 'How deeply customer needs drive decisions' },
    { key: 'tech_enablement', label: 'Technology Enablement', lens: 'Technology', description: 'Technology as a business enabler' },
    { key: 'regulatory_fitness', label: 'Regulatory Fitness', lens: 'Regulation', description: 'Regulatory and compliance posture' },
    { key: 'transformation_readiness', label: 'Transformation Readiness', lens: 'cross-lens', description: 'Organisational readiness for change' },
  ],
};

// ---------------------------------------------------------------------------
// Registry map + lookup
// ---------------------------------------------------------------------------

export const DOMAIN_PACKS: Record<string, DomainPack> = {
  contact_centre: CONTACT_CENTRE,
  customer_engagement: CUSTOMER_ENGAGEMENT,
  hr_people: HR_PEOPLE,
  sales: SALES,
  compliance: COMPLIANCE,
  enterprise: ENTERPRISE,
};

/**
 * Get a domain pack by key. Returns null if the key is unknown.
 */
export function getDomainPack(key: string): DomainPack | null {
  return DOMAIN_PACKS[key] ?? null;
}

/**
 * List all available domain pack keys with labels.
 */
export function listDomainPacks(): Array<{ key: string; label: string; category: string }> {
  return Object.values(DOMAIN_PACKS).map((pack) => ({
    key: pack.key,
    label: pack.label,
    category: pack.category,
  }));
}
