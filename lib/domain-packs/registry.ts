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

export interface DiscoveryLens {
  key: string;
  label: string;
  description: string;
  objective: string;
  estimatedDuration: string;
  minimumInsights: number;
}

export interface DiscoveryQuestionTemplate {
  lens: string;        // Maps to discoveryLenses[].key
  text: string;
  tag: string;         // For insight extraction: 'triple_rating', 'strengths', 'gaps', 'friction', 'future', 'working', 'pain_points', 'constraint', 'context', 'support'
  maturityScale?: string[];  // 5-level scale for triple_rating questions
  purpose: string;
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
  discoveryLenses: DiscoveryLens[];
  discoveryQuestionTemplates: DiscoveryQuestionTemplate[];
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
  discoveryLenses: [
    {
      key: 'customer',
      label: 'Customer',
      description: 'Journey, effort, NPS, complaints, vulnerability, channel mix',
      objective: 'Understand the end-to-end customer experience across all contact channels and identify friction, effort, and unmet needs',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'people',
      label: 'People',
      description: 'Advisors, TLs, WFM, QA, engagement, capability',
      objective: 'Assess the capability, engagement, and development needs of front-line advisors, team leaders, and support functions',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'culture',
      label: 'Culture',
      description: 'Ownership, empowerment, fear vs accountability, coaching culture',
      objective: 'Explore the behavioural norms, leadership style, and psychological safety that shape how people perform and develop',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'operations',
      label: 'Operations',
      description: 'Process, SLAs, queues, handoffs, case management, scheduling',
      objective: 'Map the operational mechanics of service delivery, including scheduling, queue management, handoffs, and process efficiency',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'technology',
      label: 'Technology',
      description: 'CCaaS, CRM, knowledge, AI assist, automation, integrations',
      objective: 'Evaluate the contact centre technology stack for fitness, integration maturity, and readiness for AI-assisted operations',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'regulation_risk',
      label: 'Regulation & Risk',
      description: 'Compliance, QA framework, auditability, data protection',
      objective: 'Assess compliance posture, quality assurance rigour, and the impact of regulatory requirements on operational agility',
      estimatedDuration: '15 mins',
      minimumInsights: 3,
    },
    {
      key: 'training_enablement',
      label: 'Training & Enablement',
      description: 'Onboarding, continuous learning, product knowledge, AI literacy',
      objective: 'Evaluate how effectively advisors are onboarded, upskilled, and enabled to handle evolving customer needs and new tools',
      estimatedDuration: '15 mins',
      minimumInsights: 3,
    },
  ],
  discoveryQuestionTemplates: [
    // --- Customer lens ---
    {
      lens: 'customer',
      text: 'When looking specifically at Customer experience, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the contact centre meets customer needs and expectations',
      tag: 'triple_rating',
      maturityScale: [
        'Inconsistent experiences. Long wait times. Complaints pile up. No view of customer history across channels.',
        'Basic systems in place. Some visibility. Service recovery mostly reactive. Channel switching frustrating.',
        'Single view of customer. Consistent across channels. FCR improving. AI helps with routine queries.',
        'Customer needs anticipated. Personalised service. Proactive outreach. AI and humans work seamlessly.',
        'Effortless experience. Issues resolved before noticed. Customers advocate for the brand.',
      ],
      purpose: 'Establish a maturity baseline for customer experience across the contact centre',
    },
    {
      lens: 'customer',
      text: 'What does a great customer interaction look like here? Walk me through a recent example where everything went right.',
      tag: 'working',
      purpose: 'Identify positive patterns and conditions that enable excellent customer outcomes',
    },
    {
      lens: 'customer',
      text: 'Where do customers have to repeat themselves, get transferred, or chase for updates? What causes the most customer effort?',
      tag: 'pain_points',
      purpose: 'Surface high-effort moments in the customer journey that drive dissatisfaction',
    },
    {
      lens: 'customer',
      text: 'How well do you understand why customers contact you vs what they actually need resolved? Where is that gap widest?',
      tag: 'gaps',
      purpose: 'Identify the difference between stated contact reasons and underlying customer needs',
    },
    {
      lens: 'customer',
      text: 'If you could redesign the customer journey from scratch with no constraints, what would you change first and why?',
      tag: 'future',
      purpose: 'Capture aspirational thinking about the ideal customer experience',
    },
    // --- People lens ---
    {
      lens: 'people',
      text: 'When looking specifically at People, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well-equipped advisors and team leaders are to deliver excellent service consistently',
      tag: 'triple_rating',
      maturityScale: [
        'High attrition. Skills gaps across the board. Team leaders firefighting. No structured development. Morale low.',
        'Roles defined but inconsistent support. Some coaching happens. TLs stretched between admin and people. Onboarding slow.',
        'Clear competency frameworks. Regular coaching sessions. TLs have time for development. Advisors feel supported.',
        'Skills planning proactive. AI handles routine queries, freeing advisors for complex work. Career paths visible.',
        'Advisors are specialists and problem-solvers. AI augments every interaction. Continuous learning is embedded. Turnover minimal.',
      ],
      purpose: 'Establish a maturity baseline for people capability and support in the contact centre',
    },
    {
      lens: 'people',
      text: 'What does a team leader actually spend their day doing? How much of that is coaching vs admin vs firefighting?',
      tag: 'gaps',
      purpose: 'Understand TL time allocation and identify barriers to effective people development',
    },
    {
      lens: 'people',
      text: 'What makes a great advisor here? What skills or behaviours separate your top performers from the rest?',
      tag: 'strengths',
      purpose: 'Identify success patterns and capability benchmarks that can be scaled',
    },
    {
      lens: 'people',
      text: 'Where do new starters struggle most in their first 90 days? When do you lose them and why?',
      tag: 'friction',
      purpose: 'Surface onboarding weaknesses and early attrition drivers',
    },
    {
      lens: 'people',
      text: 'If you had to choose between hiring more people or developing the ones you have, which would have more impact and why?',
      tag: 'future',
      purpose: 'Explore the trade-off between capacity and capability investment',
    },
    // --- Culture lens ---
    {
      lens: 'culture',
      text: 'When looking specifically at Culture, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the strength of ownership, empowerment, and coaching culture across the contact centre',
      tag: 'triple_rating',
      maturityScale: [
        'Blame culture. Advisors afraid to make decisions. Targets drive fear not performance. Managers police rather than coach.',
        'Some pockets of good culture. Empowerment inconsistent. Coaching happens but rarely prioritised. Metrics dominate conversations.',
        'Advisors trusted to make judgement calls within guidelines. Coaching structured and regular. Mistakes treated as learning.',
        'Ownership widespread. Leaders coach by default. Psychological safety high. Innovation encouraged from the floor.',
        'Self-managing teams. Continuous improvement driven from front line. Culture is a competitive advantage. People choose to stay.',
      ],
      purpose: 'Establish a maturity baseline for culture, empowerment, and leadership behaviours',
    },
    {
      lens: 'culture',
      text: 'When something goes wrong on a call, what happens next? How is it handled by team leaders and management?',
      tag: 'friction',
      purpose: 'Reveal whether the culture is blame-oriented or learning-oriented when errors occur',
    },
    {
      lens: 'culture',
      text: 'How much freedom do advisors have to resolve issues without escalation? What happens when they use their judgement?',
      tag: 'working',
      purpose: 'Assess empowerment levels and whether advisors feel trusted to make decisions',
    },
    {
      lens: 'culture',
      text: 'What would need to change for people here to genuinely feel ownership of the customer outcome rather than just following a script?',
      tag: 'future',
      purpose: 'Identify cultural barriers to genuine ownership and accountability',
    },
    // --- Operations lens ---
    {
      lens: 'operations',
      text: 'When looking specifically at Operations, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the efficiency and effectiveness of contact centre operations, including scheduling, queues, and case management',
      tag: 'triple_rating',
      maturityScale: [
        'Constant firefighting. SLAs missed regularly. Handoffs lose context. Scheduling reactive. No real-time visibility.',
        'Basic WFM in place. SLAs tracked but hard to maintain. Queues managed manually. Some handoff processes documented.',
        'Forecasting accurate. Skill-based routing working. Handoffs structured. Real-time dashboards inform decisions.',
        'Dynamic scheduling adapts to demand. AI-assisted routing optimises outcomes. Case management seamless across channels.',
        'Operations self-optimising. Predictive models prevent issues. Zero-touch resolution for routine contacts. Continuous improvement embedded.',
      ],
      purpose: 'Establish a maturity baseline for operational efficiency and process effectiveness',
    },
    {
      lens: 'operations',
      text: 'Walk me through what happens when a customer has to be transferred or their case needs to be handed off. Where does context get lost?',
      tag: 'pain_points',
      purpose: 'Map handoff failures and context loss that damage both customer and advisor experience',
    },
    {
      lens: 'operations',
      text: 'How accurate is your forecasting and scheduling? Where do mismatches between supply and demand cause the most pain?',
      tag: 'gaps',
      purpose: 'Identify WFM gaps that create understaffing, overstaffing, or missed service levels',
    },
    {
      lens: 'operations',
      text: 'Which processes or workflows have the most manual steps, workarounds, or exceptions? What drives those?',
      tag: 'friction',
      purpose: 'Surface process inefficiencies and workarounds that indicate broken or outdated processes',
    },
    {
      lens: 'operations',
      text: 'If you could streamline or eliminate one operational process tomorrow, which one would unlock the most capacity?',
      tag: 'future',
      purpose: 'Prioritise operational improvement opportunities by potential impact',
    },
    // --- Technology lens ---
    {
      lens: 'technology',
      text: 'When looking specifically at Technology, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the fitness of the contact centre technology stack, including CCaaS, CRM, knowledge systems, and AI capabilities',
      tag: 'triple_rating',
      maturityScale: [
        'Legacy systems everywhere. Advisors use multiple screens. No single customer view. Knowledge base outdated. AI non-existent.',
        'Core CCaaS functional but limited. CRM holds data but poorly integrated. Knowledge base exists but hard to search. Chatbot basic.',
        'Unified desktop. CRM integrated with telephony. Knowledge base well-maintained. AI assists with routine queries and next-best-action.',
        'Cloud-native platform. Real-time AI co-pilot for advisors. Automated quality monitoring. Predictive analytics driving decisions.',
        'Seamless AI-human collaboration. Self-healing systems. Technology invisible to the advisor. Continuous innovation cycle.',
      ],
      purpose: 'Establish a maturity baseline for contact centre technology capability and AI readiness',
    },
    {
      lens: 'technology',
      text: 'How many different systems does an advisor need open to handle a typical customer interaction? What does that feel like?',
      tag: 'pain_points',
      purpose: 'Quantify desktop complexity and its impact on advisor experience and handle time',
    },
    {
      lens: 'technology',
      text: 'Where is technology genuinely helping advisors do a better job today? What works well that you would protect?',
      tag: 'strengths',
      purpose: 'Identify technology bright spots and capabilities worth preserving or scaling',
    },
    {
      lens: 'technology',
      text: 'What data or information do advisors need during a call that they struggle to access quickly? What is the impact?',
      tag: 'gaps',
      purpose: 'Surface information access gaps that slow resolution and frustrate advisors',
    },
    // --- Regulation & Risk lens ---
    {
      lens: 'regulation_risk',
      text: 'When looking specifically at Regulation and Risk, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the contact centre manages compliance, quality assurance, and regulatory risk',
      tag: 'triple_rating',
      maturityScale: [
        'Compliance reactive. QA sampling random and inconsistent. Audit findings surprise the business. Data protection ad hoc.',
        'QA framework in place but manual. Compliance training annual. Some call recording. Regulatory changes managed case by case.',
        'Automated QA sampling. Compliance embedded in processes. Real-time adherence monitoring. Regulatory change process structured.',
        'AI-powered quality monitoring across all interactions. Compliance by design. Proactive regulatory horizon scanning.',
        'Compliance invisible and embedded. AI monitors every interaction. Zero regulatory surprises. Trusted by regulators as exemplary.',
      ],
      purpose: 'Establish a maturity baseline for compliance, quality assurance, and risk management',
    },
    {
      lens: 'regulation_risk',
      text: 'Where do compliance requirements create the most friction for advisors during live customer interactions?',
      tag: 'constraint',
      purpose: 'Identify where regulatory burden directly impacts service delivery and advisor experience',
    },
    {
      lens: 'regulation_risk',
      text: 'How confident are you that quality assurance captures what actually matters vs just ticking boxes?',
      tag: 'gaps',
      purpose: 'Assess whether QA frameworks measure meaningful quality or just procedural compliance',
    },
    {
      lens: 'regulation_risk',
      text: 'When a new regulation or policy change hits, how quickly does it reach the front line? What breaks in that chain?',
      tag: 'friction',
      purpose: 'Map the speed and reliability of regulatory change implementation to the front line',
    },
    // --- Training & Enablement lens ---
    {
      lens: 'training_enablement',
      text: 'When looking specifically at Training and Enablement, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how effectively advisors are onboarded, developed, and enabled to handle evolving customer needs',
      tag: 'triple_rating',
      maturityScale: [
        'Onboarding too long or too shallow. Product knowledge patchy. Classroom only. No AI literacy. People left to figure things out.',
        'Structured onboarding exists but inconsistent quality. Some digital learning. Product updates slow to reach floor. Nesting support variable.',
        'Blended onboarding with nesting support. Knowledge base current. Regular upskill sessions. Advisors confident with core products.',
        'Personalised learning paths. AI-assisted training. Real-time knowledge delivery. Continuous skill development embedded in workflow.',
        'Learning is continuous and contextual. AI coaches in real time. Advisors self-direct development. Expertise shared organically across teams.',
      ],
      purpose: 'Establish a maturity baseline for training, enablement, and continuous learning capability',
    },
    {
      lens: 'training_enablement',
      text: 'How long does it take a new starter to become genuinely competent? What would accelerate that?',
      tag: 'gaps',
      purpose: 'Identify time-to-competency drivers and opportunities to accelerate advisor readiness',
    },
    {
      lens: 'training_enablement',
      text: 'When a new product, policy, or system change launches, how do advisors learn about it? How well does that work?',
      tag: 'friction',
      purpose: 'Assess the effectiveness of change communication and just-in-time learning delivery',
    },
    {
      lens: 'training_enablement',
      text: 'What role should AI play in helping advisors learn and improve? Where would real-time coaching or guidance help most?',
      tag: 'future',
      purpose: 'Explore appetite and readiness for AI-assisted learning and in-workflow enablement',
    },
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
  discoveryLenses: [
    {
      key: 'customer',
      label: 'Customer',
      description: 'Journey mapping, segmentation, personalisation, lifecycle, advocacy',
      objective: 'Understand the depth of customer knowledge, journey maturity, and how effectively the organisation personalises and adapts engagement across the lifecycle',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'people',
      label: 'People',
      description: 'CX skills, empowerment, cross-functional collaboration',
      objective: 'Assess whether people across the organisation have the skills, authority, and collaborative culture to deliver on the customer engagement vision',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'channels',
      label: 'Channels',
      description: 'Omnichannel consistency, digital vs physical, channel migration',
      objective: 'Evaluate the coherence and effectiveness of engagement across all channels, including the balance between digital and human touchpoints',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'data_insights',
      label: 'Data & Insights',
      description: 'Customer data, analytics, personalisation engine, measurement',
      objective: 'Assess the quality, accessibility, and actionability of customer data and the maturity of analytics driving engagement decisions',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'technology',
      label: 'Technology',
      description: 'MarTech, CRM, CDP, automation, AI capabilities',
      objective: 'Evaluate the fitness and integration of the marketing and engagement technology stack, including AI and automation readiness',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'brand_strategy',
      label: 'Brand & Strategy',
      description: 'Brand alignment, value proposition, competitive positioning',
      objective: 'Explore how well the brand promise translates into lived customer experience and whether strategic positioning is reflected in every engagement',
      estimatedDuration: '15 mins',
      minimumInsights: 3,
    },
  ],
  discoveryQuestionTemplates: [
    // --- Customer lens ---
    {
      lens: 'customer',
      text: 'When looking specifically at Customer understanding, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how deeply the organisation understands and responds to customer needs across the full lifecycle',
      tag: 'triple_rating',
      maturityScale: [
        'Customers treated as transactions. No segmentation. Journey undefined. Feedback ignored or never collected.',
        'Basic segments exist. Some journey mapping done but not acted on. Feedback collected but rarely closes the loop.',
        'Clear segments with differentiated engagement. Journeys mapped and owned. Voice-of-customer programme active and influencing decisions.',
        'Predictive understanding of customer needs. Personalisation at scale. Proactive engagement at key lifecycle moments.',
        'Customers feel individually known. Engagement anticipates needs before they arise. Advocacy is organic and growing.',
      ],
      purpose: 'Establish a maturity baseline for customer understanding and lifecycle engagement',
    },
    {
      lens: 'customer',
      text: 'How well do you really know your customers beyond demographics? What behavioural or attitudinal insights drive your engagement strategy?',
      tag: 'gaps',
      purpose: 'Assess the depth of customer insight beyond basic segmentation',
    },
    {
      lens: 'customer',
      text: 'Where in the customer lifecycle are you strongest? Where do you lose people and why?',
      tag: 'pain_points',
      purpose: 'Identify lifecycle stages with the highest drop-off or weakest engagement',
    },
    {
      lens: 'customer',
      text: 'What does your most loyal customer look like? What made them that way, and can you replicate it?',
      tag: 'strengths',
      purpose: 'Identify advocacy patterns and conditions that create loyal customers',
    },
    {
      lens: 'customer',
      text: 'If your customers described their ideal relationship with your brand, what would they say is missing today?',
      tag: 'future',
      purpose: 'Capture aspirational customer relationship goals from the customer perspective',
    },
    // --- People lens ---
    {
      lens: 'people',
      text: 'When looking specifically at People, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well your people are skilled, empowered, and aligned to deliver outstanding customer engagement',
      tag: 'triple_rating',
      maturityScale: [
        'CX is marketing-only responsibility. No cross-functional buy-in. Front-line staff disconnected from strategy. Skills gaps widespread.',
        'Some CX awareness across teams. Collaboration happens when pushed. Front-line training basic. Empowerment limited.',
        'CX owned cross-functionally. Front-line teams trained and empowered. Collaboration structured. Customer impact understood by all.',
        'CX skills embedded in every role. Teams self-organise around customer outcomes. Cross-functional collaboration is the norm.',
        'Customer obsession is cultural. Every employee sees themselves as a CX professional. Innovation comes from everywhere.',
      ],
      purpose: 'Establish a maturity baseline for CX skills, empowerment, and cross-functional alignment',
    },
    {
      lens: 'people',
      text: 'How well do teams across the business collaborate to deliver a joined-up customer experience? Where do silos cause friction?',
      tag: 'friction',
      purpose: 'Surface cross-functional collaboration barriers that fragment the customer experience',
    },
    {
      lens: 'people',
      text: 'What CX-specific skills are your teams strongest in? Where are the capability gaps that hold you back?',
      tag: 'gaps',
      purpose: 'Identify CX skill strengths and development priorities across the organisation',
    },
    {
      lens: 'people',
      text: 'How empowered are front-line staff to recover a poor experience in the moment? What would need to change?',
      tag: 'support',
      purpose: 'Assess front-line empowerment and the conditions needed to enable real-time service recovery',
    },
    // --- Channels lens ---
    {
      lens: 'channels',
      text: 'When looking specifically at Channels, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the consistency, integration, and effectiveness of customer engagement across all channels',
      tag: 'triple_rating',
      maturityScale: [
        'Channels operate in silos. Inconsistent messaging. Customers restart when switching channels. Digital is an afterthought.',
        'Multiple channels available but poorly integrated. Some consistency in messaging. Digital growing but friction-heavy.',
        'Channels connected. Customer context carries across touchpoints. Digital-first strategy with human support where needed.',
        'Seamless omnichannel experience. Channel switching invisible. AI orchestrates the right channel for each moment.',
        'Channels blend into one fluid experience. Customers never think about channels. Engagement meets them wherever they are.',
      ],
      purpose: 'Establish a maturity baseline for omnichannel engagement consistency and integration',
    },
    {
      lens: 'channels',
      text: 'Where do customers experience the most friction when moving between channels? What context gets lost?',
      tag: 'pain_points',
      purpose: 'Identify channel transition failures that damage the customer experience',
    },
    {
      lens: 'channels',
      text: 'Which channel delivers the best customer experience today? What makes it work and can that be replicated?',
      tag: 'working',
      purpose: 'Identify channel bright spots and transferable success factors',
    },
    {
      lens: 'channels',
      text: 'How are you balancing the shift to digital with customers who prefer human interaction? What is the strategy?',
      tag: 'future',
      purpose: 'Explore the digital-human balance strategy and customer migration approach',
    },
    // --- Data & Insights lens ---
    {
      lens: 'data_insights',
      text: 'When looking specifically at Data and Insights, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the quality, accessibility, and impact of customer data and analytics on engagement decisions',
      tag: 'triple_rating',
      maturityScale: [
        'Data scattered across systems. No single customer view. Reporting manual and lagging. Decisions based on gut feel.',
        'Some data consolidated. Basic reporting in place. Customer view partial. Analytics retrospective, not predictive.',
        'Unified customer data platform. Real-time dashboards. Segmentation drives targeting. Attribution model working.',
        'Predictive analytics driving engagement. Real-time personalisation. AI surfacing insights proactively. Test-and-learn culture.',
        'Data-driven everything. Customer data is a strategic asset. AI optimises engagement continuously. Insights democratised across teams.',
      ],
      purpose: 'Establish a maturity baseline for customer data maturity and analytics capability',
    },
    {
      lens: 'data_insights',
      text: 'What customer data do you have that you are not using effectively? What is stopping you?',
      tag: 'gaps',
      purpose: 'Identify untapped data assets and barriers to data-driven engagement',
    },
    {
      lens: 'data_insights',
      text: 'How do you measure the success of customer engagement today? What metrics matter most and which are missing?',
      tag: 'strengths',
      purpose: 'Assess measurement maturity and identify metric blind spots',
    },
    {
      lens: 'data_insights',
      text: 'Where would real-time customer insight change the way you engage? What decisions would be different?',
      tag: 'future',
      purpose: 'Explore the potential impact of real-time analytics on engagement effectiveness',
    },
    // --- Technology lens ---
    {
      lens: 'technology',
      text: 'When looking specifically at Technology, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the fitness of your marketing and engagement technology stack for delivering modern customer experiences',
      tag: 'triple_rating',
      maturityScale: [
        'Fragmented tools. No CDP. CRM barely used. Email is the only automated channel. MarTech stack cobbled together.',
        'CRM active but underutilised. Some marketing automation. Tools not integrated. Personalisation basic at best.',
        'Integrated MarTech stack. CDP providing unified view. Multi-channel automation working. Personalisation rules-based.',
        'AI-powered engagement engine. Real-time decisioning. Dynamic content personalisation. Tech stack flexible and scalable.',
        'Technology is invisible. AI orchestrates engagement. Continuous optimisation automatic. Innovation speed is a competitive advantage.',
      ],
      purpose: 'Establish a maturity baseline for engagement technology capability and integration',
    },
    {
      lens: 'technology',
      text: 'Which tools in your engagement stack are genuinely earning their keep? Which ones create more friction than value?',
      tag: 'working',
      purpose: 'Separate high-value technology from friction-generating tools in the MarTech stack',
    },
    {
      lens: 'technology',
      text: 'Where is the biggest integration gap between your systems? What customer experience does that break?',
      tag: 'pain_points',
      purpose: 'Identify critical integration failures that directly impact customer engagement quality',
    },
    {
      lens: 'technology',
      text: 'What role do you see AI playing in your engagement strategy over the next 18 months? Where are you ready and where are you not?',
      tag: 'future',
      purpose: 'Assess AI readiness and strategic intent for AI-driven engagement',
    },
    // --- Brand & Strategy lens ---
    {
      lens: 'brand_strategy',
      text: 'When looking specifically at Brand and Strategy, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how consistently the brand promise translates into lived customer experience across all touchpoints',
      tag: 'triple_rating',
      maturityScale: [
        'Brand promise disconnected from delivery. No clear value proposition. Competitor positioning unclear. CX strategy absent.',
        'Brand guidelines exist but inconsistently applied. Value proposition defined but not embedded. Strategy is a document, not lived.',
        'Brand and CX aligned. Value proposition differentiated and understood. Strategy drives prioritisation. Teams reference it daily.',
        'Brand experience distinctive and consistent. Strategic positioning reflected in every touchpoint. Customers feel the brand, not just see it.',
        'Brand is a living system. Strategy and execution indistinguishable. Market position defended by experience, not just marketing.',
      ],
      purpose: 'Establish a maturity baseline for brand-experience alignment and strategic positioning',
    },
    {
      lens: 'brand_strategy',
      text: 'Where is the biggest gap between what the brand promises and what customers actually experience?',
      tag: 'gaps',
      purpose: 'Identify the most significant brand-experience disconnects visible to customers',
    },
    {
      lens: 'brand_strategy',
      text: 'What makes your customer engagement genuinely different from competitors? What would customers say?',
      tag: 'strengths',
      purpose: 'Assess competitive differentiation from the customer perspective',
    },
    {
      lens: 'brand_strategy',
      text: 'If your engagement strategy is successful in three years, what will customers say about you that they do not say today?',
      tag: 'future',
      purpose: 'Define the aspirational brand-experience outcome in customer language',
    },
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
  discoveryLenses: [
    {
      key: 'talent',
      label: 'Talent',
      description: 'Acquisition, retention, succession, workforce planning',
      objective: 'Assess the health and effectiveness of talent acquisition, retention strategies, succession planning, and workforce planning maturity',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'culture',
      label: 'Culture',
      description: 'Values, inclusion, psychological safety, leadership style',
      objective: 'Explore the lived culture, inclusivity, psychological safety, and how leadership behaviours shape the employee experience',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'learning',
      label: 'Learning & Development',
      description: 'Skills, career paths, coaching, digital learning',
      objective: 'Evaluate the maturity of learning and development programmes, career progression frameworks, and capability building approaches',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'employee_experience',
      label: 'Employee Experience',
      description: 'Onboarding, engagement, wellbeing, EVP',
      objective: 'Map the end-to-end employee journey from onboarding to exit, identifying moments that matter and experience gaps',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'technology',
      label: 'Technology',
      description: 'HRIS, self-service, analytics, AI in HR',
      objective: 'Evaluate the fitness of HR technology for enabling self-service, people analytics, and AI-driven decision support',
      estimatedDuration: '15 mins',
      minimumInsights: 3,
    },
    {
      key: 'compliance',
      label: 'Compliance',
      description: 'Employment law, policies, GDPR, employee relations',
      objective: 'Assess the robustness of employment law compliance, policy frameworks, data protection practices, and employee relations capability',
      estimatedDuration: '15 mins',
      minimumInsights: 3,
    },
  ],
  discoveryQuestionTemplates: [
    // --- Talent lens ---
    {
      lens: 'talent',
      text: 'When looking specifically at Talent, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the effectiveness of talent acquisition, retention, and workforce planning',
      tag: 'triple_rating',
      maturityScale: [
        'Reactive hiring. No workforce plan. Key person dependencies everywhere. Succession unknown. Retention not tracked meaningfully.',
        'Recruitment process exists but slow. Some retention data. Succession identified for top roles only. Workforce planning annual at best.',
        'Proactive talent pipeline. Retention strategies differentiated by segment. Succession plans for critical roles. Workforce planning connected to business strategy.',
        'Talent strategy is a competitive advantage. Predictive attrition models. Internal mobility high. Workforce planning dynamic and scenario-based.',
        'Organisation is a talent magnet. People join for growth, stay for culture. AI-assisted workforce optimisation. Succession is a living process.',
      ],
      purpose: 'Establish a maturity baseline for talent management and workforce planning capability',
    },
    {
      lens: 'talent',
      text: 'Where are you losing good people and why? What do exit interviews tell you that you have not acted on?',
      tag: 'pain_points',
      purpose: 'Identify the root causes of regrettable attrition and the action gap on exit data',
    },
    {
      lens: 'talent',
      text: 'How effective is your recruitment process at finding the right people? Where does it break down?',
      tag: 'friction',
      purpose: 'Surface recruitment process inefficiencies and quality-of-hire challenges',
    },
    {
      lens: 'talent',
      text: 'If a key leader left tomorrow, how prepared is the organisation? Where are the biggest succession gaps?',
      tag: 'gaps',
      purpose: 'Assess succession readiness and key person risk across the organisation',
    },
    {
      lens: 'talent',
      text: 'What would make this organisation a place where the best talent actively wants to work? What is missing today?',
      tag: 'future',
      purpose: 'Define the aspirational employer brand and identify gaps to close',
    },
    // --- Culture lens ---
    {
      lens: 'culture',
      text: 'When looking specifically at Culture, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the strength of organisational culture, inclusion, psychological safety, and leadership behaviours',
      tag: 'triple_rating',
      maturityScale: [
        'Values on the wall, not in the halls. Inclusion lip service. Fear of speaking up. Leadership inconsistent. Trust low.',
        'Values defined and some leaders model them. Diversity initiatives exist. Psychological safety patchy. Feedback upward is risky.',
        'Values lived by most leaders. Inclusive behaviours recognised. People feel safe to disagree. Feedback flows both ways.',
        'Culture is distinctive and intentional. Inclusion embedded in systems. Leaders actively develop psychological safety. Values drive decisions.',
        'Culture is the brand. Radical candour normal. Every voice heard. Leaders are coaches first. People bring their whole selves.',
      ],
      purpose: 'Establish a maturity baseline for organisational culture and psychological safety',
    },
    {
      lens: 'culture',
      text: 'What does leadership look like at its best here? And at its worst? What is the gap?',
      tag: 'gaps',
      purpose: 'Assess leadership behaviour consistency and its impact on culture',
    },
    {
      lens: 'culture',
      text: 'How safe do people feel to challenge, disagree, or admit mistakes? What happens when someone speaks up?',
      tag: 'working',
      purpose: 'Evaluate psychological safety through concrete behavioural examples',
    },
    {
      lens: 'culture',
      text: 'Where does the stated culture differ most from the lived experience? What would need to change to close that gap?',
      tag: 'friction',
      purpose: 'Identify the biggest culture-reality gaps and barriers to cultural aspiration',
    },
    // --- Learning & Development lens ---
    {
      lens: 'learning',
      text: 'When looking specifically at Learning and Development, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the maturity and impact of learning, career development, and capability building',
      tag: 'triple_rating',
      maturityScale: [
        'Training reactive and compliance-focused. No career paths. Coaching rare. Learning is a cost centre. Skills gaps widening.',
        'Some development programmes exist. Career paths partially defined. Managers expected to coach but unsupported. Digital learning basic.',
        'Blended learning strategy. Clear career frameworks. Coaching embedded in management practice. Skills aligned to business needs.',
        'Personalised learning paths. AI-assisted skill gap analysis. Coaching culture strong. Career mobility high. Learning in the flow of work.',
        'Continuous learning is the default. Skills are a strategic asset. AI curates learning. Everyone coaches. Development is the reason people stay.',
      ],
      purpose: 'Establish a maturity baseline for learning, development, and capability building',
    },
    {
      lens: 'learning',
      text: 'How clear are career paths for people at different levels? Where do people get stuck or plateau?',
      tag: 'gaps',
      purpose: 'Identify career progression barriers and development dead-ends',
    },
    {
      lens: 'learning',
      text: 'What is the most effective development intervention you have seen work here? What made it successful?',
      tag: 'strengths',
      purpose: 'Identify proven development approaches and conditions for L&D success',
    },
    {
      lens: 'learning',
      text: 'How well are managers equipped to coach their teams? What support do they get and what is missing?',
      tag: 'support',
      purpose: 'Assess manager coaching capability and the support infrastructure around it',
    },
    {
      lens: 'learning',
      text: 'If you could redesign how people learn and grow here, what would be different about the approach?',
      tag: 'future',
      purpose: 'Capture aspirational thinking about the future of L&D and career development',
    },
    // --- Employee Experience lens ---
    {
      lens: 'employee_experience',
      text: 'When looking specifically at Employee Experience, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the quality of the employee experience from onboarding through to engagement, wellbeing, and EVP',
      tag: 'triple_rating',
      maturityScale: [
        'Onboarding chaotic. Engagement surveys happen but nothing changes. Wellbeing not on the agenda. EVP undefined. People feel like a number.',
        'Structured onboarding exists. Engagement measured annually. Wellbeing initiatives ad hoc. EVP partially articulated but not lived.',
        'Onboarding effective and welcoming. Pulse surveys driving action. Wellbeing embedded in policy. EVP clear and communicated.',
        'Employee experience designed as a journey. Real-time feedback loops. Wellbeing proactive and personalised. EVP is a differentiator.',
        'Employees are advocates. Experience is seamless from offer to alumni. Wellbeing is cultural. EVP attracts talent magnetically.',
      ],
      purpose: 'Establish a maturity baseline for the end-to-end employee experience',
    },
    {
      lens: 'employee_experience',
      text: 'Describe the first 30 days for a new joiner. Where does the experience excel and where does it fall apart?',
      tag: 'friction',
      purpose: 'Map onboarding strengths and failure points that shape early impressions',
    },
    {
      lens: 'employee_experience',
      text: 'What moments in the employee journey have the biggest impact on whether someone stays or leaves?',
      tag: 'pain_points',
      purpose: 'Identify critical moments that matter most for retention and engagement',
    },
    {
      lens: 'employee_experience',
      text: 'How well does the organisation support employee wellbeing beyond policy? What actually happens in practice?',
      tag: 'working',
      purpose: 'Assess the gap between wellbeing policy and lived experience',
    },
    {
      lens: 'employee_experience',
      text: 'What would make this the best place someone has ever worked? What one change would have the biggest impact?',
      tag: 'future',
      purpose: 'Capture the highest-impact improvement opportunity for employee experience',
    },
    // --- Technology lens ---
    {
      lens: 'technology',
      text: 'When looking specifically at Technology, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the fitness of HR technology for enabling self-service, analytics, and AI-driven people decisions',
      tag: 'triple_rating',
      maturityScale: [
        'HRIS basic or non-existent. Manual processes everywhere. No self-service. People data in spreadsheets. Analytics non-existent.',
        'Core HRIS in place but underutilised. Some self-service. Reporting manual. Data quality inconsistent. No predictive capability.',
        'HRIS integrated with payroll and learning. Self-service adopted. Dashboards available. People analytics emerging and trusted.',
        'Cloud HRIS with full self-service. Predictive analytics informing workforce decisions. AI-assisted recruitment and development.',
        'Technology is invisible. AI drives proactive people insights. Self-service is the default. HR spends zero time on admin.',
      ],
      purpose: 'Establish a maturity baseline for HR technology and people analytics capability',
    },
    {
      lens: 'technology',
      text: 'Which HR processes are still manual or spreadsheet-based that should be automated? What is the impact?',
      tag: 'pain_points',
      purpose: 'Identify the highest-impact HR automation opportunities',
    },
    {
      lens: 'technology',
      text: 'How useful is your people data for making decisions? Where do you lack the insight you need?',
      tag: 'gaps',
      purpose: 'Assess people analytics maturity and decision-support capability',
    },
    {
      lens: 'technology',
      text: 'Where could AI make the biggest difference in HR? What are you excited about and what concerns you?',
      tag: 'future',
      purpose: 'Explore AI readiness, appetite, and concerns within the HR function',
    },
    // --- Compliance lens ---
    {
      lens: 'compliance',
      text: 'When looking specifically at Compliance, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the robustness of employment law compliance, policy governance, and employee relations capability',
      tag: 'triple_rating',
      maturityScale: [
        'Policies outdated. Employment law knowledge patchy. GDPR compliance uncertain. ER cases handled reactively. Risk not visible.',
        'Policies mostly current. Basic employment law awareness. GDPR processes in place but manual. ER capability developing.',
        'Policy framework robust and reviewed regularly. Employment law embedded in management training. GDPR automated where possible. ER proactive.',
        'Compliance by design in all HR processes. Managers confident in employment law. Data protection exemplary. ER capability a strength.',
        'Compliance invisible and embedded. Zero employment tribunal risk. Data protection is cultural. ER prevents issues before they escalate.',
      ],
      purpose: 'Establish a maturity baseline for HR compliance and employee relations capability',
    },
    {
      lens: 'compliance',
      text: 'Where do employment regulations or internal policies create the most friction for managers and employees?',
      tag: 'constraint',
      purpose: 'Identify compliance burden hotspots that impede operational agility',
    },
    {
      lens: 'compliance',
      text: 'How confident are managers in handling sensitive employee relations situations? What support exists?',
      tag: 'support',
      purpose: 'Assess ER capability and the quality of support available to line managers',
    },
    {
      lens: 'compliance',
      text: 'Where are the biggest data protection or GDPR risks in your current HR processes? What keeps you up at night?',
      tag: 'gaps',
      purpose: 'Surface data protection vulnerabilities in people processes',
    },
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
  discoveryLenses: [
    {
      key: 'pipeline',
      label: 'Pipeline',
      description: 'Lead gen, qualification, velocity, forecasting, deal management',
      objective: 'Assess pipeline health, lead generation effectiveness, deal velocity, and forecasting accuracy across the sales engine',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'people',
      label: 'People',
      description: 'Rep capability, coaching, onboarding, performance distribution',
      objective: 'Evaluate sales talent capability, coaching effectiveness, onboarding speed, and the distribution of performance across the team',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'process',
      label: 'Process',
      description: 'Sales methodology, handoffs, account management, territory design',
      objective: 'Map the effectiveness of sales processes, methodology adoption, territory design, and cross-functional handoffs',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'customer',
      label: 'Customer',
      description: 'Buyer journey, decision makers, competitive landscape, win/loss',
      objective: 'Understand the buyer journey, decision-making dynamics, competitive positioning, and patterns in wins and losses',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'technology',
      label: 'Technology',
      description: 'CRM, enablement tools, analytics, AI assist',
      objective: 'Evaluate the sales technology stack for adoption, integration, analytics capability, and AI readiness',
      estimatedDuration: '15 mins',
      minimumInsights: 3,
    },
    {
      key: 'enablement',
      label: 'Enablement',
      description: 'Content, training, competitive intel, product knowledge',
      objective: 'Assess how effectively reps are enabled with content, training, competitive intelligence, and product knowledge to win deals',
      estimatedDuration: '15 mins',
      minimumInsights: 3,
    },
  ],
  discoveryQuestionTemplates: [
    // --- Pipeline lens ---
    {
      lens: 'pipeline',
      text: 'When looking specifically at Pipeline, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the health and predictability of your sales pipeline, from lead generation through to close',
      tag: 'triple_rating',
      maturityScale: [
        'Pipeline is a guessing game. Lead gen sporadic. No qualification framework. Forecasting unreliable. Deals stall without visibility.',
        'Pipeline stages defined but inconsistently used. Some lead gen working. Qualification criteria exist but loosely applied. Forecast mostly gut feel.',
        'Pipeline well-managed. Lead gen multi-channel and consistent. Qualification rigorous. Forecast within 10% accuracy. Velocity tracked.',
        'Pipeline is a predictive engine. AI scores and prioritises leads. Qualification data-driven. Forecast highly accurate. Bottlenecks identified early.',
        'Pipeline is self-optimising. AI generates and qualifies leads. Revenue predictable. Every deal has a clear path. Zero surprise misses.',
      ],
      purpose: 'Establish a maturity baseline for pipeline health, lead management, and forecast accuracy',
    },
    {
      lens: 'pipeline',
      text: 'Where do deals stall or die in your pipeline? What are the most common reasons deals do not progress?',
      tag: 'pain_points',
      purpose: 'Identify pipeline bottlenecks and the root causes of deal stagnation',
    },
    {
      lens: 'pipeline',
      text: 'How confident are you in your sales forecast right now? Where does accuracy break down and why?',
      tag: 'gaps',
      purpose: 'Assess forecast reliability and identify the drivers of forecast inaccuracy',
    },
    {
      lens: 'pipeline',
      text: 'Which lead sources consistently produce your best deals? Where are you investing effort that does not convert?',
      tag: 'working',
      purpose: 'Identify high-yield and low-yield lead sources to optimise investment',
    },
    {
      lens: 'pipeline',
      text: 'If you could fix one thing about how pipeline is generated and managed, what would unlock the most revenue?',
      tag: 'future',
      purpose: 'Prioritise pipeline improvement opportunities by revenue impact',
    },
    // --- People lens ---
    {
      lens: 'people',
      text: 'When looking specifically at People, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the capability, coaching culture, and performance distribution across your sales team',
      tag: 'triple_rating',
      maturityScale: [
        'Performance concentrated in a few heroes. Coaching non-existent. Onboarding sink-or-swim. High turnover. Skills gaps ignored.',
        'Some coaching happening but unstructured. Onboarding defined but slow to productivity. Performance varies wildly. Training event-based.',
        'Structured coaching programme. Onboarding effective with clear milestones. Performance distribution tightening. Skills development ongoing.',
        'Coaching is the primary management activity. Reps reach productivity fast. AI assists with call coaching. Performance consistently high.',
        'Every rep is a high performer. Coaching is peer-to-peer as well as top-down. AI-powered development personalised. Turnover minimal by choice.',
      ],
      purpose: 'Establish a maturity baseline for sales talent capability and coaching effectiveness',
    },
    {
      lens: 'people',
      text: 'What separates your top 20% of reps from everyone else? Is it skill, process, territory, or something else?',
      tag: 'strengths',
      purpose: 'Diagnose the drivers of top performance to determine what can be replicated',
    },
    {
      lens: 'people',
      text: 'How quickly do new reps become productive? What happens in the first 90 days and where do they struggle?',
      tag: 'friction',
      purpose: 'Assess onboarding effectiveness and time-to-productivity for new sales hires',
    },
    {
      lens: 'people',
      text: 'How much time do sales managers spend coaching vs doing admin, forecasting calls, or firefighting?',
      tag: 'gaps',
      purpose: 'Evaluate whether sales managers are able to prioritise coaching over administration',
    },
    {
      lens: 'people',
      text: 'What kind of coaching or development would make the biggest difference to your middle 60% of performers?',
      tag: 'future',
      purpose: 'Identify the highest-leverage development investment for the moveable middle',
    },
    // --- Process lens ---
    {
      lens: 'process',
      text: 'When looking specifically at Process, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the effectiveness and consistency of your sales methodology, handoffs, and territory design',
      tag: 'triple_rating',
      maturityScale: [
        'No common methodology. Every rep sells differently. Handoffs to CS chaotic. Territory design arbitrary. Account plans non-existent.',
        'Methodology defined but adoption patchy. Handoffs documented but inconsistent. Territory based on geography alone. Key accounts identified.',
        'Methodology adopted and reinforced. Handoffs structured with clear ownership. Territory design considers potential. Account plans for top accounts.',
        'Methodology embedded in tools and coaching. Handoffs seamless with shared context. Territory optimised by data. Account planning strategic.',
        'Process is invisible and enabling. Methodology is how people think, not a checklist. Handoffs delight customers. Territories self-optimising.',
      ],
      purpose: 'Establish a maturity baseline for sales process maturity and methodology adoption',
    },
    {
      lens: 'process',
      text: 'How consistently do reps follow your sales methodology? Where does it help and where does it get in the way?',
      tag: 'working',
      purpose: 'Assess methodology adoption and identify where process helps vs hinders',
    },
    {
      lens: 'process',
      text: 'What happens when a deal closes and moves to delivery or customer success? Where does context get lost?',
      tag: 'pain_points',
      purpose: 'Map the sales-to-delivery handoff and identify customer experience risks',
    },
    {
      lens: 'process',
      text: 'How fair and effective is your territory or account allocation model? Where does it create conflict or missed opportunity?',
      tag: 'friction',
      purpose: 'Evaluate territory design fairness and its impact on motivation and coverage',
    },
    // --- Customer lens ---
    {
      lens: 'customer',
      text: 'When looking specifically at Customer, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how well the sales organisation understands and aligns to the buyer journey and competitive landscape',
      tag: 'triple_rating',
      maturityScale: [
        'Seller-centric process. Buyer journey unknown. Decision makers guessed at. Competitive intel anecdotal. Win/loss analysis absent.',
        'Some buyer journey awareness. Key decision makers identified for large deals. Competitor knowledge informal. Occasional win/loss reviews.',
        'Buyer journey mapped and referenced. Multi-threaded engagement standard. Competitive battlecards available. Win/loss analysis regular.',
        'Sales process mirrors the buyer journey. Stakeholder maps data-driven. Competitive positioning proactive. Win/loss insights drive change.',
        'Buyers feel the process was designed for them. Sales anticipates stakeholder concerns. Competitive advantage is the experience itself.',
      ],
      purpose: 'Establish a maturity baseline for buyer alignment and competitive awareness',
    },
    {
      lens: 'customer',
      text: 'What do your customers say about the buying experience? Where is it smooth and where is it painful?',
      tag: 'pain_points',
      purpose: 'Surface buyer experience friction from the customer perspective',
    },
    {
      lens: 'customer',
      text: 'When you lose deals, what are the real reasons? How systematically do you capture and act on that?',
      tag: 'gaps',
      purpose: 'Assess win/loss analysis maturity and whether loss patterns drive improvement',
    },
    {
      lens: 'customer',
      text: 'How well do you map and engage all stakeholders in a buying decision? Where do you get blindsided?',
      tag: 'friction',
      purpose: 'Evaluate stakeholder mapping and multi-threading maturity in complex sales',
    },
    {
      lens: 'customer',
      text: 'What would your ideal customer say about why they chose you over the competition? How close is that to reality?',
      tag: 'future',
      purpose: 'Define the aspirational competitive differentiation from the buyer perspective',
    },
    // --- Technology lens ---
    {
      lens: 'technology',
      text: 'When looking specifically at Technology, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the effectiveness of your sales technology stack, including CRM, analytics, and AI capabilities',
      tag: 'triple_rating',
      maturityScale: [
        'CRM is a data graveyard. Reps avoid it. No analytics. Tools disconnected. Admin eats selling time. AI non-existent.',
        'CRM used for pipeline tracking but data quality poor. Basic reports. Some tools in place but adoption low. AI experimented with.',
        'CRM adopted and trusted. Analytics inform coaching and forecasting. Tools integrated. AI assists with admin and prioritisation.',
        'CRM is the command centre. AI-powered insights drive actions. Automated admin. Reps spend 80%+ of time selling.',
        'Technology is invisible. AI is a co-pilot for every rep. Insights are proactive. Tools amplify human capability, never hinder it.',
      ],
      purpose: 'Establish a maturity baseline for sales technology adoption and AI readiness',
    },
    {
      lens: 'technology',
      text: 'How much of a rep typical week is spent on admin, data entry, and tool navigation vs actual selling?',
      tag: 'pain_points',
      purpose: 'Quantify the admin burden and non-selling time created by current technology',
    },
    {
      lens: 'technology',
      text: 'What data or insight do sales managers need for coaching or forecasting that they cannot easily access today?',
      tag: 'gaps',
      purpose: 'Identify analytics and data gaps that limit management effectiveness',
    },
    {
      lens: 'technology',
      text: 'Where could AI or automation have the biggest impact on sales productivity right now?',
      tag: 'future',
      purpose: 'Prioritise AI and automation opportunities by potential sales impact',
    },
    // --- Enablement lens ---
    {
      lens: 'enablement',
      text: 'When looking specifically at Enablement, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how effectively reps are enabled with content, training, competitive intelligence, and product knowledge',
      tag: 'triple_rating',
      maturityScale: [
        'Reps create their own materials. No competitive intel. Product knowledge tribal. Training is onboarding only. Enablement is a side job.',
        'Some sales content exists but hard to find. Competitive info shared ad hoc. Product training sporadic. Enablement function emerging.',
        'Content library organised and current. Competitive battlecards maintained. Product training structured. Enablement team driving adoption.',
        'Content personalised to buyer and stage. Competitive intel real-time. Continuous learning embedded. Enablement measures impact on revenue.',
        'Reps always have the right content at the right moment. AI curates and recommends. Knowledge is living and shared. Enablement is a revenue driver.',
      ],
      purpose: 'Establish a maturity baseline for sales enablement effectiveness and content maturity',
    },
    {
      lens: 'enablement',
      text: 'When reps need content for a deal, how easy is it to find the right material? What happens when they cannot find it?',
      tag: 'friction',
      purpose: 'Assess content accessibility and the impact of content gaps on deal outcomes',
    },
    {
      lens: 'enablement',
      text: 'How current and useful is your competitive intelligence? How do reps access it in the moment that matters?',
      tag: 'gaps',
      purpose: 'Evaluate competitive intel quality, currency, and accessibility during active selling',
    },
    {
      lens: 'enablement',
      text: 'What product or industry knowledge do reps most often lack when they are in front of a customer?',
      tag: 'pain_points',
      purpose: 'Identify product knowledge gaps that directly impact deal confidence and credibility',
    },
    {
      lens: 'enablement',
      text: 'What would world-class enablement look like for your sales team? What is the gap to close?',
      tag: 'future',
      purpose: 'Define the enablement vision and prioritise investment areas',
    },
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
  discoveryLenses: [
    {
      key: 'regulatory',
      label: 'Regulatory',
      description: 'Horizon scanning, change management, interpretation, implementation',
      objective: 'Assess how effectively the organisation identifies, interprets, and implements regulatory change across the business',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'governance',
      label: 'Governance',
      description: 'Three lines of defence, reporting, escalation, board oversight',
      objective: 'Evaluate the governance framework, three lines of defence model, reporting quality, and board-level compliance oversight',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'risk',
      label: 'Risk',
      description: 'Assessment, monitoring, mitigation, appetite, emerging risks',
      objective: 'Assess risk management maturity including risk identification, appetite definition, monitoring effectiveness, and emerging risk awareness',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'people',
      label: 'People',
      description: 'Compliance culture, training, awareness, behaviour',
      objective: 'Evaluate the human side of compliance, including cultural embedding, training effectiveness, and behavioural indicators',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'technology',
      label: 'Technology',
      description: 'RegTech, monitoring, reporting, automation, data quality',
      objective: 'Assess the maturity and effectiveness of compliance technology, automated monitoring, reporting tools, and data quality',
      estimatedDuration: '15 mins',
      minimumInsights: 3,
    },
    {
      key: 'audit',
      label: 'Audit & Assurance',
      description: 'Internal audit, external audit, testing, remediation tracking',
      objective: 'Evaluate audit effectiveness, assurance coverage, testing rigour, and the speed and quality of remediation',
      estimatedDuration: '15 mins',
      minimumInsights: 3,
    },
  ],
  discoveryQuestionTemplates: [
    // --- Regulatory lens ---
    {
      lens: 'regulatory',
      text: 'When looking specifically at Regulatory management, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how effectively the organisation scans for, interprets, and implements regulatory change',
      tag: 'triple_rating',
      maturityScale: [
        'Regulatory changes surprise us. No horizon scanning. Interpretation slow and siloed. Implementation rushed and incomplete.',
        'Some horizon scanning happens. Interpretation centralised but slow. Implementation managed but manual. Gaps found after the fact.',
        'Structured horizon scanning process. Regulatory changes assessed for impact systematically. Implementation planned and tracked. Few surprises.',
        'Proactive regulatory intelligence. Early interpretation with business input. Implementation embedded in change management. Organisation shapes the conversation.',
        'Regulatory change is a competitive advantage. Organisation influences policy. Changes implemented seamlessly. Regulators see the firm as exemplary.',
      ],
      purpose: 'Establish a maturity baseline for regulatory change management capability',
    },
    {
      lens: 'regulatory',
      text: 'When a significant regulatory change is announced, walk me through what happens. How does it flow from awareness to implementation?',
      tag: 'friction',
      purpose: 'Map the end-to-end regulatory change implementation process and identify bottlenecks',
    },
    {
      lens: 'regulatory',
      text: 'Which upcoming regulatory changes are you most concerned about? What makes the organisation vulnerable?',
      tag: 'gaps',
      purpose: 'Identify specific regulatory risks on the horizon and preparedness gaps',
    },
    {
      lens: 'regulatory',
      text: 'Where has the organisation handled a regulatory change really well? What made that successful?',
      tag: 'strengths',
      purpose: 'Identify positive patterns in regulatory change management that can be replicated',
    },
    {
      lens: 'regulatory',
      text: 'How involved is the business in interpreting regulatory requirements, or is it purely a compliance function exercise?',
      tag: 'constraint',
      purpose: 'Assess whether regulatory interpretation is collaborative or isolated from the business',
    },
    // --- Governance lens ---
    {
      lens: 'governance',
      text: 'When looking specifically at Governance, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the effectiveness of the governance framework, three lines of defence, and board oversight of compliance',
      tag: 'triple_rating',
      maturityScale: [
        'Three lines blurred. First line unaware of responsibilities. Second line under-resourced. Board receives minimal compliance reporting. Escalation ad hoc.',
        'Three lines defined on paper. First line partially aware. Second line functional but reactive. Board receives quarterly compliance updates. Escalation paths documented.',
        'Three lines operating effectively. First line owns risk. Second line provides challenge and support. Board engaged with compliance. Escalation reliable.',
        'Governance is enabling, not bureaucratic. First line empowered. Second line strategic. Board asks the right questions. Issues surface early.',
        'Governance is invisible and embedded. Three lines collaborate seamlessly. Board challenges constructively. Organisation is self-correcting.',
      ],
      purpose: 'Establish a maturity baseline for governance framework and three lines of defence effectiveness',
    },
    {
      lens: 'governance',
      text: 'How well does the three lines of defence model work in practice? Where do lines blur or gaps appear?',
      tag: 'gaps',
      purpose: 'Assess the practical effectiveness of the three lines model and identify structural weaknesses',
    },
    {
      lens: 'governance',
      text: 'How useful and actionable is the compliance reporting that reaches senior leadership and the board?',
      tag: 'friction',
      purpose: 'Evaluate whether compliance reporting drives informed decisions at the top',
    },
    {
      lens: 'governance',
      text: 'When a compliance issue is identified, how quickly and reliably does it escalate to the right level?',
      tag: 'working',
      purpose: 'Assess escalation pathway reliability and speed for compliance issues',
    },
    {
      lens: 'governance',
      text: 'What would a more effective governance model look like for this organisation? What would you change?',
      tag: 'future',
      purpose: 'Capture aspirational thinking about governance model improvement',
    },
    // --- Risk lens ---
    {
      lens: 'risk',
      text: 'When looking specifically at Risk, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the maturity of risk identification, assessment, monitoring, and mitigation across the organisation',
      tag: 'triple_rating',
      maturityScale: [
        'Risk management reactive. Risk register exists but rarely updated. No emerging risk process. Risk appetite undefined. Incidents surprise the business.',
        'Risk assessments conducted periodically. Risk appetite partially defined. Some monitoring in place. Emerging risks discussed informally.',
        'Risk framework active and maintained. Risk appetite articulated and applied. Continuous monitoring for key risks. Emerging risk process structured.',
        'Predictive risk analytics. Risk appetite dynamically adjusted. Real-time monitoring. Emerging risks identified early. Risk culture strong.',
        'Risk management is a strategic enabler. Organisation is resilient by design. Risk sensing is continuous. Appetite informs strategy, not just compliance.',
      ],
      purpose: 'Establish a maturity baseline for risk management maturity and effectiveness',
    },
    {
      lens: 'risk',
      text: 'What emerging risks keep you awake at night? Where is the organisation least prepared?',
      tag: 'gaps',
      purpose: 'Identify emerging risk blind spots and areas of greatest vulnerability',
    },
    {
      lens: 'risk',
      text: 'How well does the risk appetite statement actually guide decision-making in practice? Where does it fail?',
      tag: 'friction',
      purpose: 'Assess whether risk appetite is a practical tool or a theoretical document',
    },
    {
      lens: 'risk',
      text: 'Where has risk management genuinely prevented a problem or enabled a good decision? What worked?',
      tag: 'working',
      purpose: 'Identify examples where risk management delivered tangible value to the business',
    },
    // --- People lens ---
    {
      lens: 'people',
      text: 'When looking specifically at People and compliance culture, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the strength of compliance culture, awareness, and behavioural embedding across the organisation',
      tag: 'triple_rating',
      maturityScale: [
        'Compliance seen as someone else job. Training tick-box. Awareness low. Non-compliant behaviour not challenged. Culture of workarounds.',
        'Training mandatory but generic. Awareness improving. Some leaders model compliance. Non-compliance occasionally challenged.',
        'Compliance integrated into role expectations. Training relevant and engaging. Leaders visibly accountable. Speak-up culture emerging.',
        'Compliance is everyone responsibility and lived daily. Training personalised. Behavioural indicators tracked. Speak-up culture strong.',
        'Compliance culture is a source of pride. Ethical behaviour is instinctive. Training is continuous and contextual. The organisation self-polices.',
      ],
      purpose: 'Establish a maturity baseline for compliance culture and behavioural embedding',
    },
    {
      lens: 'people',
      text: 'How confident are front-line staff in making compliant decisions without asking for help? Where do they hesitate?',
      tag: 'gaps',
      purpose: 'Assess front-line compliance confidence and identify knowledge or empowerment gaps',
    },
    {
      lens: 'people',
      text: 'How effective is compliance training at actually changing behaviour vs just meeting a requirement?',
      tag: 'friction',
      purpose: 'Evaluate whether training drives behavioural change or merely satisfies regulatory obligation',
    },
    {
      lens: 'people',
      text: 'What happens when someone raises a compliance concern? How safe do people feel to speak up?',
      tag: 'working',
      purpose: 'Assess speak-up culture and the psychological safety around compliance reporting',
    },
    {
      lens: 'people',
      text: 'What would it take for compliance to become something people are proud of rather than something they endure?',
      tag: 'future',
      purpose: 'Explore the vision for transforming compliance culture from burden to strength',
    },
    // --- Technology lens ---
    {
      lens: 'technology',
      text: 'When looking specifically at Technology, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the maturity of compliance technology, automated monitoring, and data quality for regulatory reporting',
      tag: 'triple_rating',
      maturityScale: [
        'Manual processes everywhere. Spreadsheets for monitoring. Reporting painful and error-prone. No RegTech. Data quality unreliable.',
        'Some monitoring tools in place. Reporting partially automated. Data quality improving but patchy. RegTech evaluation stage.',
        'RegTech deployed for key processes. Monitoring automated for major risks. Reporting reliable. Data quality managed and improving.',
        'Integrated compliance technology stack. AI-powered monitoring. Real-time reporting. Data quality high. Automation extensive.',
        'Technology handles routine compliance autonomously. AI provides predictive insights. Reporting is instant and trusted. Innovation continuous.',
      ],
      purpose: 'Establish a maturity baseline for compliance technology and RegTech maturity',
    },
    {
      lens: 'technology',
      text: 'Where are you still relying on manual processes or spreadsheets for compliance monitoring or reporting?',
      tag: 'pain_points',
      purpose: 'Identify the highest-priority compliance automation opportunities',
    },
    {
      lens: 'technology',
      text: 'How trustworthy is the data behind your compliance reporting? Where are the quality gaps?',
      tag: 'gaps',
      purpose: 'Assess data quality risks that could undermine compliance reporting credibility',
    },
    {
      lens: 'technology',
      text: 'Where could AI or automation make the biggest difference in compliance effectiveness right now?',
      tag: 'future',
      purpose: 'Prioritise RegTech and AI opportunities by compliance impact',
    },
    // --- Audit & Assurance lens ---
    {
      lens: 'audit',
      text: 'When looking specifically at Audit and Assurance, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the effectiveness of internal audit, assurance testing, and remediation tracking',
      tag: 'triple_rating',
      maturityScale: [
        'Audit is a tick-box exercise. Findings pile up unremediated. Testing sporadic. No continuous assurance. External audit drives the agenda.',
        'Internal audit plan exists but coverage limited. Some findings tracked. Testing periodic. Remediation slow. External audit findings reducing.',
        'Risk-based audit plan. Findings tracked with clear ownership and deadlines. Continuous monitoring for key controls. Remediation timely.',
        'Audit is a strategic partner. Continuous assurance embedded. Findings resolved quickly. Root cause analysis standard. External audit is clean.',
        'Assurance is built into operations. Issues identified and resolved before audit. Continuous monitoring is the norm. Audit focuses on emerging risks.',
      ],
      purpose: 'Establish a maturity baseline for audit effectiveness and assurance maturity',
    },
    {
      lens: 'audit',
      text: 'How many open audit findings exist right now and what is the average time to close them? What causes delays?',
      tag: 'pain_points',
      purpose: 'Assess remediation velocity and identify systemic barriers to closing audit findings',
    },
    {
      lens: 'audit',
      text: 'How well does internal audit focus on the risks that matter most vs the areas that are easiest to audit?',
      tag: 'gaps',
      purpose: 'Evaluate whether audit coverage is risk-driven or convenience-driven',
    },
    {
      lens: 'audit',
      text: 'Where has an audit finding led to genuine improvement rather than just a fix? What made the difference?',
      tag: 'strengths',
      purpose: 'Identify examples where the audit process drove lasting positive change',
    },
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
  discoveryLenses: [
    {
      key: 'strategy',
      label: 'Strategy & Leadership',
      description: 'Vision, strategic alignment, change readiness, leadership',
      objective: 'Assess strategic clarity, leadership alignment, change readiness, and how effectively strategy translates into execution across the enterprise',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'people',
      label: 'People',
      description: 'Talent, capability, engagement, culture, ways of working',
      objective: 'Evaluate workforce capability, engagement, cultural health, and the effectiveness of ways of working across the organisation',
      estimatedDuration: '25 mins',
      minimumInsights: 5,
    },
    {
      key: 'organisation',
      label: 'Organisation',
      description: 'Structure, processes, governance, decision-making',
      objective: 'Map organisational structure effectiveness, process efficiency, governance quality, and decision-making speed and quality',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'customer',
      label: 'Customer',
      description: 'Customer centricity, experience, value proposition',
      objective: 'Assess how deeply customer needs drive decisions, the quality of customer experience, and the strength of the value proposition',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'technology',
      label: 'Technology',
      description: 'Digital maturity, data, AI readiness, innovation',
      objective: 'Evaluate digital maturity, data capability, AI readiness, and the organisation ability to innovate and adapt through technology',
      estimatedDuration: '20 mins',
      minimumInsights: 4,
    },
    {
      key: 'regulation',
      label: 'Regulation & Risk',
      description: 'Compliance, governance, risk management',
      objective: 'Assess regulatory compliance posture, risk management maturity, and how governance supports rather than constrains the business',
      estimatedDuration: '15 mins',
      minimumInsights: 3,
    },
  ],
  discoveryQuestionTemplates: [
    // --- Strategy & Leadership lens ---
    {
      lens: 'strategy',
      text: 'When looking specifically at Strategy and Leadership, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the clarity of strategic vision, leadership alignment, and the organisation readiness for change',
      tag: 'triple_rating',
      maturityScale: [
        'Strategy unclear or unknown. Leadership misaligned. Change initiatives fail repeatedly. No shared vision. Firefighting dominates.',
        'Strategy defined at the top but poorly cascaded. Leadership alignment partial. Change happens but slowly. Vision understood by some.',
        'Strategy clear and communicated. Leadership aligned on priorities. Change capability improving. Vision referenced in decision-making.',
        'Strategy co-created and owned at all levels. Leadership models change. Organisation adapts quickly. Vision inspires action.',
        'Strategy is a living system. Leadership is visionary and humble. Change is continuous and welcomed. The organisation shapes its market.',
      ],
      purpose: 'Establish a maturity baseline for strategic clarity, leadership alignment, and change readiness',
    },
    {
      lens: 'strategy',
      text: 'How well do people across the organisation understand the strategic direction? Where does the message get lost?',
      tag: 'gaps',
      purpose: 'Assess strategic communication effectiveness and identify cascade failures',
    },
    {
      lens: 'strategy',
      text: 'When the organisation has tried to change something significant before, what happened? What helped and what got in the way?',
      tag: 'friction',
      purpose: 'Understand change history and identify systemic barriers to transformation',
    },
    {
      lens: 'strategy',
      text: 'Where is the biggest disconnect between what leadership says and what actually happens on the ground?',
      tag: 'pain_points',
      purpose: 'Surface the strategy-execution gap visible from different levels of the organisation',
    },
    {
      lens: 'strategy',
      text: 'If this organisation executes its strategy perfectly over the next three years, what will be different?',
      tag: 'future',
      purpose: 'Define the aspirational future state and test strategic ambition across stakeholders',
    },
    // --- People lens ---
    {
      lens: 'people',
      text: 'When looking specifically at People, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the strength of talent capability, engagement, culture, and ways of working across the enterprise',
      tag: 'triple_rating',
      maturityScale: [
        'Skills gaps widespread. Engagement low. Culture toxic or invisible. Ways of working outdated. Good people leave.',
        'Some talent programmes exist. Engagement measured but not acted on. Culture inconsistent. Hybrid working adopted but unmanaged.',
        'Talent strategy connected to business needs. Engagement improving with visible action. Culture intentional. Ways of working flexible and productive.',
        'Talent is a competitive advantage. Engagement high and sustained. Culture distinctive. Ways of working optimised for outcomes.',
        'Organisation is a talent magnet. People are deeply engaged and growing. Culture is the brand. Work happens in the way that creates most value.',
      ],
      purpose: 'Establish a maturity baseline for people capability, engagement, and cultural health',
    },
    {
      lens: 'people',
      text: 'Where is the organisation losing talent it cannot afford to lose? What is driving that and what would reverse it?',
      tag: 'pain_points',
      purpose: 'Identify critical talent retention risks and their root causes',
    },
    {
      lens: 'people',
      text: 'What is working well about how people collaborate and get work done here? What should be protected?',
      tag: 'working',
      purpose: 'Identify effective collaboration patterns and ways of working to preserve',
    },
    {
      lens: 'people',
      text: 'What capability or skill does the organisation most need to build over the next two years? Why?',
      tag: 'gaps',
      purpose: 'Identify the most critical capability gap relative to strategic ambition',
    },
    {
      lens: 'people',
      text: 'How would you describe the culture here to someone joining? What would surprise them, positively or negatively?',
      tag: 'strengths',
      purpose: 'Capture honest cultural assessment through the lens of the newcomer experience',
    },
    // --- Organisation lens ---
    {
      lens: 'organisation',
      text: 'When looking specifically at Organisation, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the effectiveness of organisational structure, processes, governance, and decision-making',
      tag: 'triple_rating',
      maturityScale: [
        'Structure creates silos. Processes heavy and slow. Governance unclear. Decisions take forever. Accountability diffuse.',
        'Structure functional but rigid. Key processes documented. Governance exists but inconsistently applied. Decisions slow at middle layers.',
        'Structure supports collaboration. Processes efficient and reviewed regularly. Governance clear. Decisions made at appropriate levels.',
        'Structure adapts to strategy. Processes continuously improved. Governance enables speed. Decisions data-informed and fast.',
        'Organisation is agile and self-organising. Processes invisible. Governance is trust-based. Decisions happen where the knowledge is.',
      ],
      purpose: 'Establish a maturity baseline for organisational effectiveness and decision quality',
    },
    {
      lens: 'organisation',
      text: 'Which processes or approval chains are the biggest drag on speed and agility? What should be simpler?',
      tag: 'friction',
      purpose: 'Identify the most impactful process and governance bottlenecks',
    },
    {
      lens: 'organisation',
      text: 'Where does work get stuck between teams or functions? What causes the most significant handoff failures?',
      tag: 'pain_points',
      purpose: 'Map cross-functional friction and identify structural barriers to collaboration',
    },
    {
      lens: 'organisation',
      text: 'How clear is accountability across the organisation? Where do things fall between the cracks?',
      tag: 'gaps',
      purpose: 'Assess accountability clarity and identify ownership gaps that cause failure',
    },
    {
      lens: 'organisation',
      text: 'If you could redesign how decisions get made here, what would you change to make the organisation faster and better?',
      tag: 'future',
      purpose: 'Capture aspirational thinking about governance and decision-making improvement',
    },
    // --- Customer lens ---
    {
      lens: 'customer',
      text: 'When looking specifically at Customer, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how deeply customer needs drive decisions and how strong the customer experience is across the enterprise',
      tag: 'triple_rating',
      maturityScale: [
        'Customer is an afterthought. No journey mapping. Feedback ignored. Value proposition unclear. Competitors winning on experience.',
        'Customer awareness growing. Some journey understanding. Feedback collected but rarely acted on. Value proposition partially defined.',
        'Customer centricity embedded in planning. Journey mapped and owned. Feedback drives improvement. Value proposition clear and differentiated.',
        'Customer needs anticipate. Experience personalised. Organisation obsessed with customer outcomes. Brand promise consistently delivered.',
        'Customers are co-creators. Experience is a competitive moat. Organisation exists to solve customer problems. Advocacy is organic.',
      ],
      purpose: 'Establish a maturity baseline for customer centricity and experience quality',
    },
    {
      lens: 'customer',
      text: 'How well does the organisation actually listen to its customers? Where does customer insight influence decisions and where does it not?',
      tag: 'gaps',
      purpose: 'Assess voice-of-customer integration into strategic and operational decision-making',
    },
    {
      lens: 'customer',
      text: 'What do customers love about the experience? What keeps them coming back?',
      tag: 'strengths',
      purpose: 'Identify customer experience strengths and loyalty drivers to protect',
    },
    {
      lens: 'customer',
      text: 'Where is the biggest gap between what customers expect and what the organisation delivers?',
      tag: 'pain_points',
      purpose: 'Surface the most significant customer expectation-delivery gaps',
    },
    {
      lens: 'customer',
      text: 'If your customers could change one thing about their experience with you, what would it be?',
      tag: 'future',
      purpose: 'Identify the single highest-impact customer experience improvement opportunity',
    },
    // --- Technology lens ---
    {
      lens: 'technology',
      text: 'When looking specifically at Technology, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate the digital maturity, data capability, AI readiness, and innovation capacity of the organisation',
      tag: 'triple_rating',
      maturityScale: [
        'Legacy systems dominate. Data unreliable. No AI capability. Innovation ad hoc. Technology holds the business back.',
        'Core systems functional but inflexible. Data improving but siloed. AI experiments starting. Innovation reactive. Digital skills patchy.',
        'Modern systems in key areas. Data accessible and trusted. AI deployed for specific use cases. Innovation structured. Digital skills developing.',
        'Cloud-native architecture. Data is a strategic asset. AI embedded in operations. Innovation continuous. Digital-first mindset.',
        'Technology is invisible and enabling. AI augments every role. Data drives every decision. Innovation is cultural. Organisation shapes its market through technology.',
      ],
      purpose: 'Establish a maturity baseline for digital maturity, data, and AI readiness',
    },
    {
      lens: 'technology',
      text: 'Where is technology genuinely enabling the business today? What works well that should be protected and scaled?',
      tag: 'working',
      purpose: 'Identify technology bright spots and enablement successes to build on',
    },
    {
      lens: 'technology',
      text: 'Where is technology the biggest constraint on business performance? What cannot be done because of current limitations?',
      tag: 'constraint',
      purpose: 'Surface technology constraints that directly limit business capability',
    },
    {
      lens: 'technology',
      text: 'How ready is the organisation to adopt AI at scale? What excites people and what concerns them?',
      tag: 'gaps',
      purpose: 'Assess enterprise AI readiness and the balance of enthusiasm vs concern',
    },
    {
      lens: 'technology',
      text: 'If you could invest in one technology capability that would transform the business, what would it be and why?',
      tag: 'future',
      purpose: 'Identify the highest-impact technology investment opportunity from a business perspective',
    },
    // --- Regulation & Risk lens ---
    {
      lens: 'regulation',
      text: 'When looking specifically at Regulation and Risk, state where you believe the company are today, where you feel they should be and where the company will be if they do nothing differently.\n\nRate how effectively the organisation manages regulatory compliance, governance, and risk',
      tag: 'triple_rating',
      maturityScale: [
        'Compliance reactive. Risk poorly understood. Governance creates friction. Regulatory surprises common. No risk culture.',
        'Framework exists but inconsistently applied. Key regulations tracked. Risk registers maintained but not dynamic. Governance functional.',
        'Compliance embedded in processes. Risk management proactive. Governance enables rather than blocks. Regulatory horizon scanning active.',
        'Compliance by design. Risk appetite drives strategy. Governance is lean and effective. Organisation anticipates regulatory change.',
        'Risk management is a strategic advantage. Compliance is invisible. Governance is trust-based. Organisation shapes the regulatory landscape.',
      ],
      purpose: 'Establish a maturity baseline for regulatory compliance, governance, and risk management',
    },
    {
      lens: 'regulation',
      text: 'Which regulatory or governance requirements create the most friction across the business? What would you simplify?',
      tag: 'constraint',
      purpose: 'Identify compliance burden hotspots that impede operational agility enterprise-wide',
    },
    {
      lens: 'regulation',
      text: 'How well does the organisation balance risk management with the need for speed and innovation?',
      tag: 'friction',
      purpose: 'Assess whether risk management enables or constrains business agility and innovation',
    },
    {
      lens: 'regulation',
      text: 'What regulatory or risk challenges are coming over the horizon that the organisation needs to prepare for?',
      tag: 'gaps',
      purpose: 'Identify emerging regulatory and risk challenges and assess preparation readiness',
    },
    {
      lens: 'regulation',
      text: 'If governance and compliance were working perfectly, what would be different about how the business operates day to day?',
      tag: 'future',
      purpose: 'Define the aspirational state for governance and compliance as business enablers',
    },
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
