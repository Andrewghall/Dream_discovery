/**
 * Seed ConversationReport records for all 30 Jo Air discovery participants.
 * Creates structured per-interview reports (executiveSummary, keyInsights, phaseInsights, wordCloudThemes)
 * derived from the RESPONSES data already seeded into data_points.
 *
 * Run: npx tsx scripts/seed-joair-reports.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';

// ─── REPORT DATA ────────────────────────────────────────────────────────────
// One entry per participant. Content derived from their RESPONSES in seed-joair-discovery.ts.

interface ReportData {
  name: string;
  tone: string;
  executiveSummary: string;
  feedback: string;
  keyInsights: {
    title: string;
    insight: string;
    confidence: 'high' | 'medium' | 'low';
    evidence: string[];
  }[];
  phaseInsights: {
    phase: string;
    currentScore: number | null;
    targetScore: number | null;
    strengths: string[];
    gaps: string[];
    painPoints: string[];
    frictions: string[];
    barriers: string[];
    constraint: string[];
    future: string[];
    working: string[];
    support: string[];
  }[];
  wordCloudThemes: { text: string; value: number }[];
}

const REPORTS: ReportData[] = [
  // ─── EXECUTIVES ───────────────────────────────────────────────────────────

  {
    name: 'Sarah Morrison',
    tone: 'strategic',
    executiveSummary:
      'Sarah Morrison, as Chief Customer Officer, frames the core problem as a fundamental disconnect between technology investment and operational reality — significant platform spend has not arrested queue instability or improved customer satisfaction scores. Her vision centres on intelligent, empathetic service recovery: a contact centre where every agent understands the individual customer, routing is precise, and a customer who has been let down leaves more loyal than before.',
    feedback:
      'Thank you Sarah — your clarity on the gap between board-level momentum and floor-level impact was one of the most important observations in this discovery. Your vision for personalised, empathetic service recovery is a strong north star for the programme.',
    keyInsights: [
      {
        title: 'Technology investment has not resolved queue instability',
        insight:
          'Despite significant platform spend, the fundamental operational problem — queue instability — remains unresolved. Sarah identifies a structural disconnect between what is being built and what the operation actually needs.',
        confidence: 'high',
        evidence: [
          "We've invested significantly in platform technology and the queue instability hasn't improved.",
          "There's a disconnect between what we're building and what the operation actually needs.",
        ],
      },
      {
        title: 'Metrics drive the wrong behaviours',
        insight:
          'Current KPIs reward efficiency over empathy. Agents are measured on speed, not quality of resolution — meaning the customers who need most care (disruption, cancellation) are least well served.',
        confidence: 'high',
        evidence: [
          "We're measuring the wrong things and rewarding the wrong behaviours.",
          'A customer who\'s just had a flight cancelled doesn\'t want efficiency — they want someone who actually cares.',
        ],
      },
      {
        title: 'Premium cabin service recovery is the internal proof of concept',
        insight:
          'The premium cabin team demonstrates that empathetic, personalised recovery is achievable at Jo Airways. Sarah wants to understand what makes them exceptional and replicate it at scale.',
        confidence: 'high',
        evidence: [
          'Our premium cabin service recovery team is genuinely exceptional. When they get it right, customers write in to thank us.',
          "That's the model. I want to understand what they do differently and replicate it at scale.",
        ],
      },
      {
        title: '24-month return window constrains foundational investment',
        insight:
          'Board pressure for quick returns prevents the data and integration investments that would unlock long-term transformation. The programme keeps building on a fragile foundation.',
        confidence: 'medium',
        evidence: [
          'That limits our ability to make the foundational investments — particularly in data and integration — that would unlock everything else.',
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'customer',
        currentScore: 4,
        targetScore: 9,
        strengths: ['Premium cabin recovery team performance', 'Board-level transformation commitment'],
        gaps: ['Customer history visible to agents', 'Intelligent routing by customer tier and situation', 'Empathy-weighted KPIs'],
        painPoints: ['CSAT flatline despite investment', 'Loyalty destruction at disruption moments'],
        frictions: ['Efficiency metrics override empathy in agent behaviour'],
        barriers: ['24-month ROI window', 'Platform disconnection from operational need'],
        constraint: ['Board return expectations within 24 months'],
        future: ['Every agent knows the customer in front of them', 'Routing matches right agent to right contact', 'Loyalty built through recovery excellence'],
        working: ['Premium cabin service recovery model'],
        support: [],
      },
      {
        phase: 'organisation',
        currentScore: 4,
        targetScore: 7,
        strengths: ['Board-level programme momentum'],
        gaps: ['Translation of strategy to floor-level change', 'Performance framework alignment'],
        painPoints: ['Disconnect between technology investment and operational outcomes'],
        frictions: ['KPI misalignment between efficiency and empathy'],
        barriers: ['Fragile foundational infrastructure'],
        constraint: ['Investment horizon constraints'],
        future: ['Coherent performance framework', 'Strategy-to-floor delivery alignment'],
        working: [],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'queue instability', value: 8 },
      { text: 'customer satisfaction', value: 7 },
      { text: 'empathy', value: 7 },
      { text: 'routing', value: 6 },
      { text: 'service recovery', value: 6 },
      { text: 'platform investment', value: 5 },
      { text: 'premium cabin', value: 5 },
      { text: 'transformation', value: 4 },
    ],
  },

  {
    name: 'James Whitfield',
    tone: 'critical',
    executiveSummary:
      'James Whitfield, as Chief Operating Officer, identifies two systemic failures: the absence of a shared performance framework across three simultaneous transformation programmes, and wholly inadequate visibility into BPO partner delivery across four offshore sites. He sees the contact centre as emblematic of a broader governance crisis — six workstreams without clear owners, no sequenced delivery plan, and contractual structures with BPO partners that are 12 years out of date.',
    feedback:
      'Thank you James — your identification of the governance gap and the BPO visibility problem is critical context for this programme. The lack of a unified performance framework across all sites is a fundamental issue that the transformation must address head-on.',
    keyInsights: [
      {
        title: 'No shared performance framework across transformation programmes',
        insight:
          'Three major transformation programmes run simultaneously with separate KPIs, governance and steering groups. Contact centre has six workstreams without owners and no sequenced delivery plan — creating accountability gaps at every level.',
        confidence: 'high',
        evidence: [
          "Each has its own KPIs, its own governance, its own steering group. They don't talk to each other.",
          'I can see at least six workstreams that are supposed to be improving performance but have no clear owner and no sequenced delivery plan.',
        ],
      },
      {
        title: 'BPO oversight is fundamentally inadequate',
        insight:
          'Jo Airways has four outsourced sites (Manila, Cape Town, Krakow, Hyderabad) with no real-time visibility into performance. The reports received measure the wrong metrics and do not reflect actual delivery standards.',
        confidence: 'high',
        evidence: [
          'I genuinely do not know whether they are delivering to our standards. The visibility is inadequate.',
          "We get reports, but the reports measure the wrong things.",
        ],
      },
      {
        title: 'Legacy BPO contracts prevent standards enforcement',
        insight:
          'SLAs with BPO partners were written 12 years ago and bear no relation to current expectations of service quality. Renegotiation is time-consuming and structurally difficult.',
        confidence: 'high',
        evidence: [
          "Some of our SLAs were written 12 years ago and don't reflect what good looks like today.",
          'Renegotiating takes time we don\'t have.',
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'organisation',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Transformation programme exists and has board backing'],
        gaps: ['Single performance framework', 'Clear workstream ownership', 'Sequenced delivery plan'],
        painPoints: ['Six unowned workstreams', 'Three programmes with no shared governance', 'No accountability chain'],
        frictions: ['Siloed programme management', 'BPO reporting measures wrong metrics'],
        barriers: ['Legacy BPO contracts 12 years old', 'Renegotiation complexity'],
        constraint: ['Time to renegotiate BPO contracts', 'Parallel transformation demands'],
        future: ['One performance framework for all sites', 'Real-time BPO visibility', 'Clear sequenced investment plan'],
        working: [],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'performance framework', value: 9 },
      { text: 'BPO oversight', value: 8 },
      { text: 'governance', value: 7 },
      { text: 'workstreams', value: 6 },
      { text: 'visibility', value: 6 },
      { text: 'Manila', value: 5 },
      { text: 'legacy contracts', value: 5 },
      { text: 'accountability', value: 4 },
    ],
  },

  {
    name: 'Rachel Hughes',
    tone: 'strategic',
    executiveSummary:
      'Rachel Hughes, as Chief Digital & Technology Officer, identifies a critical technology debt crisis: Jo Airways operates 11 separate systems for contact centre functions with no unified integration layer, creating unsustainable fragmentation. She sees AI not as a replacement for agents but as a contextual co-pilot — surfacing the right information at the right moment — but warns that AI cannot deliver value on top of broken data foundations.',
    feedback:
      'Thank you Rachel — your framing of AI as a contextual co-pilot rather than an automation layer is exactly the right lens for this programme. The 11-system fragmentation issue is a critical constraint that the technology strategy must address as its first priority.',
    keyInsights: [
      {
        title: '11-system fragmentation makes the contact centre unworkable',
        insight:
          'Agents must navigate 11 separate systems to complete a single customer interaction. There is no integration layer, no single source of truth, and every process involves manual context-switching.',
        confidence: 'high',
        evidence: [
          'We have eleven systems that touch the contact centre and none of them talk to each other properly.',
          'We have tried point-to-point integrations but every time one system updates, something else breaks.',
        ],
      },
      {
        title: 'AI must be a co-pilot before it becomes automation',
        insight:
          'Rachel\'s AI vision is contextual augmentation first — surfacing customer history, suggesting next best action, flagging regulatory requirements — before any automation of customer-facing conversations.',
        confidence: 'high',
        evidence: [
          "AI should be making agents smarter, not replacing them. A co-pilot that surfaces what the agent needs before they've had to ask.",
        ],
      },
      {
        title: 'Data foundations must precede AI investment',
        insight:
          'Without a clean integration layer and a single customer data record, AI will be working with the same fragmented, inconsistent data as agents today — producing unreliable results.',
        confidence: 'high',
        evidence: [
          "If we put AI on top of our current data estate we'll get AI-speed rubbish. The data foundation has to come first.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'technology',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Board appetite for AI investment', 'Existing Salesforce and Genesys platforms as foundation'],
        gaps: ['Integration layer', 'Single customer record', 'Real-time data pipeline'],
        painPoints: ['11 systems with no integration', 'Manual context-switching for agents', 'Broken point-to-point integrations'],
        frictions: ['System updates break other integrations', 'No unified data foundation for AI'],
        barriers: ['Technology debt', 'Multiple vendor contracts', 'Legacy Amadeus dependencies'],
        constraint: ['Cannot deploy AI on broken data foundation', 'Integration complexity'],
        future: ['Unified integration layer', 'AI co-pilot for agents', 'Single customer record'],
        working: ['Genesys telephony stable', 'Salesforce CRM baseline functional'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'integration', value: 9 },
      { text: 'AI co-pilot', value: 8 },
      { text: 'data foundation', value: 8 },
      { text: 'system fragmentation', value: 7 },
      { text: 'Salesforce', value: 5 },
      { text: 'Genesys', value: 5 },
      { text: 'automation', value: 5 },
      { text: 'context-switching', value: 4 },
    ],
  },

  {
    name: 'David Palmer',
    tone: 'operational',
    executiveSummary:
      'David Palmer, as VP Contact Centre & Customer Operations, has the closest view of the operational breakdown. Queue instability is his primary crisis — compounded by a routing logic that has not been updated in three years, inaccurate demand forecasting, and headcount planning that uses spreadsheets disconnected from real-time actuals. He sees the contact centre as fundamentally under-resourced for disruption events and over-resourced in steady state.',
    feedback:
      'Thank you David — your operational precision on the queue instability, routing failures, and forecasting disconnects is invaluable. The data you\'ve provided on disruption event capacity gaps will be central to building the right target model.',
    keyInsights: [
      {
        title: 'Routing logic is three years out of date',
        insight:
          'Current routing rules were configured in 2021 and have not been updated to reflect new contact types, channel changes, or BPO site capability shifts. Calls are routinely misrouted or held unnecessarily.',
        confidence: 'high',
        evidence: [
          "The routing logic hasn't been touched in three years. Contact types have changed completely but the routing hasn't.",
          "We're sending premium cabin contacts to offshore agents who don't have the system access to help them.",
        ],
      },
      {
        title: 'Demand forecasting is chronically inaccurate',
        insight:
          'Workforce planning uses models that consistently underestimate disruption-driven volume spikes. During major disruption events, the contact centre operates at 300%+ of planned capacity.',
        confidence: 'high',
        evidence: [
          'When we have a major disruption we go to three times planned volume within 90 minutes. Our models never predict that.',
          "We're permanently understaffed for disruption and overstaffed during normal operations.",
        ],
      },
      {
        title: 'Headcount planning disconnected from real-time data',
        insight:
          'Staffing decisions are made from spreadsheets that are updated manually and lag actual contact volumes by 24-48 hours. There is no mechanism to flex resourcing in real time.',
        confidence: 'high',
        evidence: [
          "Our headcount plans are spreadsheets. By the time we've updated them, the situation has changed.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'organisation',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Experienced core team', 'Clear understanding of failure modes'],
        gaps: ['Real-time forecasting', 'Disruption capacity model', 'Updated routing logic'],
        painPoints: ['Queue instability at disruption events', 'Misrouted contacts', 'Manual headcount planning'],
        frictions: ['Routing unchanged for 3 years', 'Forecasting lags reality by 24-48 hours'],
        barriers: ['No real-time workforce management capability', 'BPO site access limitations'],
        constraint: ['Spreadsheet-based planning tools', 'Genesys routing configuration complexity'],
        future: ['Real-time demand forecasting', 'AI-assisted routing', 'Automated disruption capacity flex'],
        working: ['Core UK hub team stability', 'Agent knowledge in premium cabin'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'queue instability', value: 9 },
      { text: 'routing', value: 8 },
      { text: 'forecasting', value: 8 },
      { text: 'disruption', value: 7 },
      { text: 'headcount planning', value: 6 },
      { text: 'capacity', value: 6 },
      { text: 'real-time', value: 5 },
      { text: 'offshore', value: 4 },
    ],
  },

  {
    name: 'Fiona Lawson',
    tone: 'constructive',
    executiveSummary:
      'Fiona Lawson, as Director of People & Transformation, centres the transformation problem on workforce sustainability. With 35% annual attrition — double the sector average — the contact centre is in a continuous recruitment cycle that prevents it from building experience and capability. Onboarding takes 6 weeks before agents are productive, and the coaching infrastructure is insufficient to accelerate skill development or retain experienced staff.',
    feedback:
      'Thank you Fiona — the 35% attrition figure and the onboarding timeline are two of the most important data points from this discovery. Your analysis of the capability gap and the coaching deficit will be foundational to the People workstream.',
    keyInsights: [
      {
        title: '35% annual attrition is destroying institutional knowledge',
        insight:
          'At 35% per year, the contact centre is losing more than a third of its workforce annually. This prevents any meaningful accumulation of product knowledge, customer-handling skill, or system proficiency.',
        confidence: 'high',
        evidence: [
          "We're losing 35% of our people every year. That's double the sector average and it's not improving.",
          "We can't build capability when we're constantly replacing people.",
        ],
      },
      {
        title: 'Six-week onboarding creates a structural productivity gap',
        insight:
          'New agents take six weeks before they are considered productive. With 35% attrition, the contact centre has a permanently high proportion of low-tenured, low-proficiency agents handling live customer contacts.',
        confidence: 'high',
        evidence: [
          'It takes six weeks before a new agent is considered productive. With our attrition rate, a significant percentage of our floor is always in that low-productivity window.',
        ],
      },
      {
        title: 'Coaching infrastructure is insufficient to drive behaviour change',
        insight:
          'Team leaders spend the majority of their time on administrative tasks rather than coaching. There is no structured coaching framework, and quality conversations do not translate into measurable performance improvement.',
        confidence: 'medium',
        evidence: [
          "Team leaders are spending 60-70% of their time on admin. Coaching is squeezed to whatever's left.",
          "We have quality scores but they don't drive improvement — they just record it.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'people',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Strong recruitment pipeline', 'Good team leader quality in senior tier'],
        gaps: ['Retention strategy', 'Accelerated onboarding pathway', 'Structured coaching framework'],
        painPoints: ['35% annual attrition', '6-week to productivity timeline', 'TL admin burden preventing coaching'],
        frictions: ['Coaching squeezed by admin', 'Quality scores not driving improvement'],
        barriers: ['Salary competitiveness', 'Career progression visibility', 'Management capacity'],
        constraint: ['Budget for retention initiatives', 'TL span of control'],
        future: ['Attrition below 20%', 'Accelerated 3-week onboarding', 'Coaching integrated into daily rhythm'],
        working: ['Recruitment pipeline functioning', 'Some team leader excellence'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'attrition', value: 9 },
      { text: 'onboarding', value: 8 },
      { text: 'coaching', value: 8 },
      { text: 'capability', value: 7 },
      { text: 'retention', value: 7 },
      { text: 'team leaders', value: 6 },
      { text: 'productivity', value: 5 },
      { text: 'knowledge', value: 4 },
    ],
  },

  // ─── SENIOR MANAGERS ──────────────────────────────────────────────────────

  {
    name: 'Tom Hendricks',
    tone: 'operational',
    executiveSummary:
      'Tom Hendricks, as Head of Contact Centre Operations, describes a contact centre that operates in a constant state of reactive firefighting. There are no escalation playbooks for the most common disruption scenarios, shift patterns are designed for steady-state volume rather than disruption elasticity, and operational managers spend more time compensating for system failures than running their teams.',
    feedback:
      'Thank you Tom — your ground-level view of the escalation chaos and the shift pattern mismatch is essential context. The absence of disruption playbooks is a critical gap that will need to be resolved early in the transformation.',
    keyInsights: [
      {
        title: 'No disruption playbooks exist for most common scenarios',
        insight:
          'When disruption events occur, each operational manager improvises their response. There is no standardised playbook for the most common scenarios — weather delays, ATC restrictions, aircraft technical faults — resulting in inconsistent, slow, and often incorrect customer handling.',
        confidence: 'high',
        evidence: [
          "We don't have playbooks. Every disruption, every manager makes it up as they go.",
          "There's no standard for how we handle a weather delay versus a technical delay versus an ATC restriction.",
        ],
      },
      {
        title: 'Shift patterns optimised for steady state, not disruption',
        insight:
          'Current shift schedules are designed around average daily volume patterns and do not accommodate the surge capacity required during disruption events. Overtime is routinely required and frequently insufficient.',
        confidence: 'high',
        evidence: [
          "Our shifts are built for normal days. Disruption days are not normal and we're not staffed for them.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'organisation',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Experienced operational management layer', 'Good agent knowledge in core routes'],
        gaps: ['Disruption playbooks', 'Flexible shift patterns', 'Standardised escalation paths'],
        painPoints: ['Reactive firefighting as default mode', 'Manager time lost to system compensation'],
        frictions: ['No standard disruption response', 'Overtime as primary flex mechanism'],
        barriers: ['Shift pattern contractual constraints', 'System reliability'],
        constraint: ['Union agreements on shift patterns', 'Overtime budget caps'],
        future: ['Playbook-driven disruption response', 'Elastic resourcing model', 'Manager time on coaching not firefighting'],
        working: ['Core operational team experience', 'Agent familiarity with key routes'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'disruption', value: 9 },
      { text: 'playbooks', value: 8 },
      { text: 'escalation', value: 7 },
      { text: 'shift patterns', value: 7 },
      { text: 'firefighting', value: 6 },
      { text: 'overtime', value: 5 },
      { text: 'standardisation', value: 5 },
      { text: 'reactive', value: 4 },
    ],
  },

  {
    name: 'Angela Ward',
    tone: 'constructive',
    executiveSummary:
      'Angela Ward, as Head of Workforce Management, identifies the core WFM problem as a fundamental mismatch between forecasting methodology and the nature of airline contact demand — which is event-driven, non-linear, and heavily influenced by operational disruptions that standard Erlang modelling cannot anticipate. The current Verint implementation is underutilised and the data inputs it relies on are unreliable.',
    feedback:
      'Thank you Angela — your technical analysis of the Verint limitations and the Erlang model mismatch is one of the most specific and actionable insights from this discovery. The forecasting accuracy issue is a root cause, not a symptom.',
    keyInsights: [
      {
        title: 'Erlang modelling fails in airline contact demand environment',
        insight:
          'Standard workforce management models assume predictable, telephone-distributed demand. Airline contact demand is event-driven — heavily spiked by disruption, schedule changes and booking windows — and requires probabilistic disruption-aware forecasting.',
        confidence: 'high',
        evidence: [
          "Erlang works fine for a utility. It doesn't work for an airline. Our demand isn't Poisson-distributed — it's event-driven.",
          "We need forecasting that says: if there's a weather system over northern Europe, here's what our contact volume will look like.",
        ],
      },
      {
        title: 'Verint is being used at a fraction of its capability',
        insight:
          'The Verint WFM platform has been deployed but key modules — real-time adherence, intraday management, predictive scheduling — are not configured or in use. The platform is being used as a scheduling tool only.',
        confidence: 'high',
        evidence: [
          "We have Verint but we're using about 20% of what it can do.",
          "Real-time adherence is switched off. Intraday management is manual. We've spent the money but not extracted the value.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'technology',
        currentScore: 4,
        targetScore: 8,
        strengths: ['Verint platform in place', 'WFM team analytical capability'],
        gaps: ['Disruption-aware forecasting', 'Real-time adherence', 'Intraday management automation'],
        painPoints: ['20% Verint utilisation', 'Manual intraday management', 'Erlang mismatch with airline demand'],
        frictions: ['Unreliable data inputs to WFM system', 'No operational data feed from ops systems'],
        barriers: ['Verint configuration investment required', 'Data integration dependency'],
        constraint: ['IT resource to configure Verint modules', 'Data quality prerequisite'],
        future: ['Disruption-predictive scheduling', 'Real-time intraday flex', 'Automated adherence management'],
        working: ['Basic schedule generation in Verint', 'WFM analyst team competence'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'forecasting', value: 9 },
      { text: 'Verint', value: 8 },
      { text: 'disruption', value: 8 },
      { text: 'Erlang', value: 6 },
      { text: 'intraday', value: 6 },
      { text: 'real-time adherence', value: 6 },
      { text: 'scheduling', value: 5 },
      { text: 'demand modelling', value: 4 },
    ],
  },

  {
    name: 'Chris Barker',
    tone: 'constructive',
    executiveSummary:
      'Chris Barker, as Head of Technology & Systems, describes a technology estate built through years of point solutions that now resists integration. The most critical failure is the absence of a customer data integration layer — every system holds a partial view of the customer and there is no mechanism to unify them in real time. Shadow IT has proliferated as teams have worked around system limitations.',
    feedback:
      'Thank you Chris — your mapping of the shadow IT proliferation and the absence of a customer data integration layer is critical. The technical debt picture you\'ve described will need to be the foundation of the technology transformation workstream.',
    keyInsights: [
      {
        title: 'No unified customer data layer across systems',
        insight:
          'Salesforce holds CRM data, Amadeus holds booking data, Genesys holds interaction data, and the loyalty system holds tier data. None of these are integrated in real time. An agent handling a call has to manually check each system to build a picture of the customer.',
        confidence: 'high',
        evidence: [
          "The agent is the integration layer. They have to mentally join up four systems to understand who they're talking to.",
          "There is no real-time single customer view. It doesn't exist.",
        ],
      },
      {
        title: 'Shadow IT has become a significant operational risk',
        insight:
          'Teams have built spreadsheets, local databases, and unofficial tools to work around system limitations. These are unmanaged, unmaintained, and have become critical to daily operations — creating data integrity and continuity risks.',
        confidence: 'high',
        evidence: [
          "We have spreadsheets running on people's desktops that are mission-critical. If the person who built them leaves, no one knows how they work.",
          'Shadow IT is everywhere. It exists because the real systems don\'t do what people need.',
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'technology',
        currentScore: 2,
        targetScore: 8,
        strengths: ['Salesforce CRM baseline', 'Genesys telephony platform', 'Amadeus booking system'],
        gaps: ['Customer data integration layer', 'Real-time API connectivity', 'Shadow IT remediation'],
        painPoints: ['Agent as manual integration layer', 'Mission-critical shadow IT', 'Broken point-to-point integrations'],
        frictions: ['System updates break integrations', 'No API governance framework'],
        barriers: ['Legacy system architecture', 'Multiple vendor dependencies', 'Shadow IT complexity'],
        constraint: ['Cannot switch off shadow IT without replacement', 'Vendor cooperation for API access'],
        future: ['Real-time customer data API', 'Single agent desktop view', 'Managed integration platform'],
        working: ['Individual systems stable in isolation', 'Some Salesforce-Genesys integration working'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'integration', value: 9 },
      { text: 'shadow IT', value: 8 },
      { text: 'customer data', value: 8 },
      { text: 'Salesforce', value: 6 },
      { text: 'Amadeus', value: 6 },
      { text: 'Genesys', value: 6 },
      { text: 'API', value: 5 },
      { text: 'single view', value: 4 },
    ],
  },

  {
    name: 'Priya Sharma',
    tone: 'constructive',
    executiveSummary:
      'Priya Sharma, as Head of Customer Experience, brings the customer perspective into sharp focus: Jo Airways contacts are disproportionately driven by avoidable failure demand — customers calling because something went wrong rather than because they want to transact. She estimates 40% of contact volume is failure demand, and reducing this through proactive communication and digital self-service is her primary lever for contact centre improvement.',
    feedback:
      'Thank you Priya — your framing of failure demand versus value demand is one of the most important analytical contributions in this discovery. The 40% estimate, if validated, fundamentally changes the transformation investment case.',
    keyInsights: [
      {
        title: '40% of contact volume is avoidable failure demand',
        insight:
          'Approximately 40% of contacts are customers calling because something has already gone wrong — delayed flight, rebooking not processed, refund not received. Reducing failure demand requires proactive communication and self-service, not faster agent handling.',
        confidence: 'high',
        evidence: [
          "About 40% of our contacts are people asking why something hasn't happened. The answer is usually 'it should have but didn't'.",
          'If we fixed the proactive notification and self-service gap we could take a huge chunk out of inbound volume.',
        ],
      },
      {
        title: 'Agents lack real-time contextual knowledge during disruption',
        insight:
          'During disruption events, agents are answering customer questions about flight status, rebooking options and compensation without access to real-time operations data. They are often less informed than the customer who has already checked the app.',
        confidence: 'high',
        evidence: [
          "Agents are telling customers they don't know when the next flight is when the customer already knows from the app.",
          "We can't expect agents to deliver good service if they don't have the information customers have.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'customer',
        currentScore: 4,
        targetScore: 8,
        strengths: ['Customer experience team capability', 'Understanding of failure demand drivers'],
        gaps: ['Proactive disruption notification', 'Self-service rebooking', 'Agent real-time ops data access'],
        painPoints: ['40% failure demand volume', 'Agents less informed than customers', 'CSAT driven by avoidable contacts'],
        frictions: ['No proactive communication system', 'App and contact centre data disconnected'],
        barriers: ['Technology investment for proactive notifications', 'Operations data API dependency'],
        constraint: ['Cross-functional dependency on digital team', 'IT prioritisation of contact centre'],
        future: ['Proactive notification eliminates failure demand', 'Agents with real-time ops context', 'Digital first for rebooking'],
        working: ['App providing some self-service capability', 'CX team analytical strength'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'failure demand', value: 9 },
      { text: 'proactive communication', value: 8 },
      { text: 'self-service', value: 7 },
      { text: 'disruption', value: 7 },
      { text: 'customer knowledge', value: 6 },
      { text: 'real-time', value: 6 },
      { text: 'CSAT', value: 5 },
      { text: 'digital', value: 4 },
    ],
  },

  {
    name: "Mark O'Brien",
    tone: 'critical',
    executiveSummary:
      "Mark O'Brien, as Head of BPO Partnerships, manages the relationship with four outsourced contact centre sites but lacks the tools, authority, and data to hold them genuinely accountable. He describes a structural problem: BPO contracts reward volume processing (calls handled, AHT) rather than outcomes (resolution, customer satisfaction), creating a systematic incentive misalignment between Jo Airways' goals and partner behaviour.",
    feedback:
      "Thank you Mark — your analysis of the BPO incentive misalignment and the absence of real-time visibility is one of the most commercially significant findings in this discovery. Fixing the contractual and measurement framework is a prerequisite for offshore performance improvement.",
    keyInsights: [
      {
        title: 'BPO contracts reward volume, not outcomes',
        insight:
          'Current BPO SLAs measure calls handled, average handle time, and availability — not first-contact resolution, customer satisfaction, or complaint escalation rate. This creates direct incentives for partners to process contacts quickly rather than resolve them effectively.',
        confidence: 'high',
        evidence: [
          "We pay them for calls handled. So they handle calls. Whether those calls are resolved is a different question.",
          "AHT is the main lever they manage because it drives their cost. Customer satisfaction is our problem.",
        ],
      },
      {
        title: 'No real-time visibility into BPO site performance',
        insight:
          'Jo Airways receives daily and weekly summary reports from BPO partners but has no live view of queue status, adherence, or contact quality at any offshore site. Issues are discovered retrospectively, often days after they have occurred.',
        confidence: 'high',
        evidence: [
          "I find out about problems in Manila three days after they've happened. By then the damage is done.",
          "We have no live view of what's happening offshore. We're flying blind.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'organisation',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Four-site geographic coverage', 'BPO partners have operational experience'],
        gaps: ['Outcome-based contractual framework', 'Real-time BPO performance visibility', 'Quality standardisation across sites'],
        painPoints: ['Incentive misalignment', 'Retrospective problem discovery', 'No live offshore queue data'],
        frictions: ['BPO optimising for AHT not resolution', 'Reporting lag of 24-72 hours'],
        barriers: ['Legacy contractual structures', 'Renegotiation timelines', 'BPO resistance to real-time monitoring'],
        constraint: ['Contract renegotiation window', 'Partner cooperation requirements'],
        future: ['Outcome-based BPO contracts', 'Real-time cross-site performance dashboard', 'Joint quality calibration'],
        working: ['Geographic coverage across time zones', 'BPO operational management experience'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'BPO', value: 9 },
      { text: 'contracts', value: 8 },
      { text: 'outcomes', value: 8 },
      { text: 'AHT', value: 7 },
      { text: 'visibility', value: 7 },
      { text: 'Manila', value: 6 },
      { text: 'accountability', value: 5 },
      { text: 'SLA', value: 4 },
    ],
  },

  {
    name: 'Louise Carter',
    tone: 'constructive',
    executiveSummary:
      'Louise Carter, as Head of Quality & Assurance, identifies quality monitoring as systematically insufficient: 2-3 calls per agent per month is sampled, representing under 1% of actual contact volume, and calibration sessions between assessors and team leaders are inconsistent and irregular. Quality scores are used to report, not to improve.',
    feedback:
      'Thank you Louise — the 1% monitoring coverage figure is a striking data point that should provoke serious rethinking of the quality model. Your proposal for AI-assisted quality review at scale is the right direction.',
    keyInsights: [
      {
        title: 'Quality monitoring covers less than 1% of contacts',
        insight:
          'Sampling 2-3 calls per agent per month against average handle volumes means quality oversight covers under 1% of contacts. The QA team cannot identify systemic quality failures — they can only observe individual interactions.',
        confidence: 'high',
        evidence: [
          "We're listening to 2 or 3 calls per agent per month. That's less than 1% of their contact volume. We can't see systemic failures.",
          "A quality problem can affect thousands of contacts before we detect it in our sample.",
        ],
      },
      {
        title: 'Calibration is inconsistent across sites and team leaders',
        insight:
          'Quality criteria are interpreted differently by different assessors and team leaders. Calibration sessions are quarterly at best and do not maintain consistent scoring standards across the contact centre.',
        confidence: 'high',
        evidence: [
          "The same interaction would score 72 in Manchester and 85 in Manila depending on who assesses it.",
          "Calibration is supposed to fix that but we don't do it frequently enough for it to hold.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'organisation',
        currentScore: 3,
        targetScore: 8,
        strengths: ['QA team subject matter expertise', 'Established quality framework (even if inconsistently applied)'],
        gaps: ['AI-assisted quality review', 'Real-time quality monitoring', 'Consistent calibration across sites'],
        painPoints: ['Sub-1% contact monitoring', 'Systemic failures undetected', 'Cross-site scoring inconsistency'],
        frictions: ['Manual sampling process', 'Quarterly calibration insufficient'],
        barriers: ['Resource to scale quality monitoring', 'Technology for AI quality review'],
        constraint: ['QA headcount', 'Technology investment'],
        future: ['AI reviews 100% of contacts', 'Real-time quality alerts', 'Weekly cross-site calibration'],
        working: ['QA framework exists', 'Team leader engagement with feedback process'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'quality monitoring', value: 9 },
      { text: 'calibration', value: 8 },
      { text: 'sampling', value: 7 },
      { text: 'AI quality', value: 7 },
      { text: 'consistency', value: 6 },
      { text: 'systemic failure', value: 6 },
      { text: 'scoring', value: 5 },
      { text: 'real-time', value: 4 },
    ],
  },

  {
    name: 'Simon Reed',
    tone: 'constructive',
    executiveSummary:
      'Simon Reed, as Head of Learning & Development, describes an L&D function that is structurally unable to keep pace with operational change: training materials are updated quarterly at best but the contact centre environment changes weekly, agent knowledge gaps are discovered through QA complaints rather than proactive assessment, and the coaching model relies entirely on team leader bandwidth that is not available.',
    feedback:
      'Thank you Simon — your analysis of the training currency problem and the coaching bandwidth gap is directly linked to the attrition and quality issues identified across this discovery. A transformed L&D model is central to the people transformation.',
    keyInsights: [
      {
        title: 'Training materials lag operational reality by months',
        insight:
          'L&D produces updated training materials quarterly, but system changes, policy updates, and new contact types emerge continuously. Agents regularly handle contacts without current knowledge, discovering gaps through customer complaints.',
        confidence: 'high',
        evidence: [
          "We update training quarterly. The operation changes weekly. Agents are always partially out of date.",
          "We find out agents don't know something because a customer complains. That's the wrong feedback loop.",
        ],
      },
      {
        title: 'Coaching model depends on team leader time that does not exist',
        insight:
          'The coaching framework assumes team leaders spend 30-40% of their time on structured coaching conversations. In practice, team leaders report less than 10% of their time is available for coaching due to administrative and operational demands.',
        confidence: 'high',
        evidence: [
          "Our coaching model says TLs should spend 30-40% on coaching. The actual figure is closer to 8-10%.",
          "They're tied up in admin, escalations, planning meetings. Coaching is what's squeezed.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'people',
        currentScore: 3,
        targetScore: 8,
        strengths: ['L&D team subject matter expertise', 'Structured onboarding programme exists'],
        gaps: ['Real-time knowledge updates', 'Micro-learning capability', 'AI-assisted coaching tools'],
        painPoints: ['Training lag vs operational change', 'Coaching time deficit', 'Reactive knowledge gap discovery'],
        frictions: ['Quarterly update cycle too slow', 'Team leader admin crowding out coaching'],
        barriers: ['L&D team size', 'Technology for adaptive learning', 'TL time availability'],
        constraint: ['L&D headcount', 'Budget for learning technology investment'],
        future: ['Just-in-time micro-learning', 'AI coaching assistant', 'Proactive knowledge gap identification'],
        working: ['Onboarding programme structure', 'Subject matter expert network'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'training', value: 9 },
      { text: 'coaching', value: 9 },
      { text: 'knowledge gaps', value: 8 },
      { text: 'team leaders', value: 7 },
      { text: 'micro-learning', value: 6 },
      { text: 'onboarding', value: 6 },
      { text: 'real-time', value: 5 },
      { text: 'attrition', value: 4 },
    ],
  },

  {
    name: 'Katherine James',
    tone: 'constructive',
    executiveSummary:
      'Katherine James, as Senior Business Analyst, provides a data and reporting lens: Jo Airways has abundant contact centre data but no analytical infrastructure to make it decision-ready. Fifteen separate reports are produced weekly by different teams, none of which share common definitions, and the operational insight function cannot answer basic questions about root cause, trend, or causal relationship between metrics.',
    feedback:
      'Thank you Katherine — your analysis of the reporting fragmentation and definitional inconsistency is a critical diagnostic finding. Fifteen reports with different metric definitions is a governance failure as much as a technology failure.',
    keyInsights: [
      {
        title: 'Fifteen weekly reports with inconsistent metric definitions',
        insight:
          'Fifteen separate weekly reports are produced by different teams, each defining core metrics differently. "Average handle time" means different things in three reports. Leadership receives contradictory data.',
        confidence: 'high',
        evidence: [
          "We have 15 weekly reports and they can't be reconciled. AHT means three different things across them.",
          "Leadership is making decisions with contradictory data and they don't always realise it.",
        ],
      },
      {
        title: 'No capability to answer causal questions',
        insight:
          'The current analytics function can report what happened but cannot explain why. There is no root cause analysis capability, no regression analysis, and no ability to model the relationship between operational inputs and customer outcomes.',
        confidence: 'high',
        evidence: [
          "We can tell you what happened. We cannot tell you why. Causality is beyond what we can do with our current tools.",
          "The question 'why did CSAT drop last Tuesday' should take 10 minutes to answer. It currently takes a week.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'organisation',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Large volume of raw data available', 'Analytical team capability'],
        gaps: ['Single source of truth for metrics', 'Root cause analysis capability', 'Real-time dashboard'],
        painPoints: ['15 reports with contradictory data', 'Leadership making decisions with inconsistent metrics', 'Causal analysis impossible'],
        frictions: ['No common data definitions', 'No integrated analytics platform'],
        barriers: ['Data silos across systems', 'No data governance framework', 'Technology investment'],
        constraint: ['Cross-functional agreement on metric definitions', 'Analytics platform investment'],
        future: ['Single performance dashboard', 'Agreed metric definitions', 'Root cause analytics in minutes'],
        working: ['Analytical team skill', 'Data collection processes in place'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'reporting', value: 9 },
      { text: 'data', value: 8 },
      { text: 'metrics', value: 8 },
      { text: 'root cause', value: 7 },
      { text: 'dashboard', value: 6 },
      { text: 'inconsistency', value: 6 },
      { text: 'analytics', value: 5 },
      { text: 'single view', value: 4 },
    ],
  },

  // ─── MANAGERS ─────────────────────────────────────────────────────────────

  {
    name: 'Daniel Cooper',
    tone: 'operational',
    executiveSummary:
      'Daniel Cooper, as Operations Manager for the UK Hub, manages the highest-volume, most complex contact types and describes an operation where escalation volumes have become the defining operational challenge. Approximately 30% of contacts require some form of escalation or transfer, and the escalation pathways are poorly defined — resulting in customers being transferred multiple times before reaching resolution.',
    feedback:
      'Thank you Daniel — your specific data on escalation volume and transfer loops is invaluable. A 30% escalation rate is a clear signal that first-contact resolution is systematically broken and needs to be the primary operational metric.',
    keyInsights: [
      {
        title: '30% escalation rate signals broken first-contact resolution',
        insight:
          'Three in ten contacts at the UK Hub require escalation or transfer. This indicates that agent authority, knowledge, and system access are insufficient for the most common complex contact types.',
        confidence: 'high',
        evidence: [
          "30% of our contacts get escalated or transferred. That is not a manageable rate — it means the system is designed for escalation.",
          "Customers who need to be transferred are usually the ones who are already frustrated.",
        ],
      },
      {
        title: 'Transfer loops destroy customer experience',
        insight:
          'Customers are routinely transferred between agents and teams multiple times before reaching a resolution. Each transfer resets the customer\'s need to re-explain their situation and increases abandonment risk.',
        confidence: 'high',
        evidence: [
          "We have customers being transferred four times for a single issue. By the time they get to someone who can help them they're furious.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'customer',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Strong UK Hub team product knowledge', 'Experienced escalation handling team'],
        gaps: ['First-contact resolution capability', 'Agent authority to resolve complex cases', 'Clear escalation pathways'],
        painPoints: ['30% escalation rate', 'Multiple transfer loops', 'Customer re-explanation burden'],
        frictions: ['Authority limits force unnecessary escalation', 'Routing sends wrong contacts to unprepared agents'],
        barriers: ['System access limitations by tier', 'Authority delegation framework'],
        constraint: ['Policy limits on agent authority', 'System access permissions'],
        future: ['First-contact resolution as primary KPI', 'Expanded agent authority', 'Smart escalation routing'],
        working: ['UK Hub team product knowledge', 'Escalation specialist team quality'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'escalation', value: 9 },
      { text: 'first-contact resolution', value: 8 },
      { text: 'transfers', value: 8 },
      { text: 'authority', value: 7 },
      { text: 'routing', value: 6 },
      { text: 'frustration', value: 5 },
      { text: 'complex contacts', value: 5 },
      { text: 'UK Hub', value: 4 },
    ],
  },

  {
    name: 'Emma Fitzgerald',
    tone: 'constructive',
    executiveSummary:
      'Emma Fitzgerald, as Operations Manager for BPO Oversight, manages the day-to-day performance of the offshore sites and is positioned at the sharpest end of the BPO visibility gap. She has direct relationships with site managers in Manila, Krakow and Cape Town but no systematic tools to identify underperformance before it manifests as customer complaints or SLA failures.',
    feedback:
      'Thank you Emma — your on-the-ground experience of the BPO visibility gap is exactly the operational detail that the offshore governance workstream needs. The training consistency problem between onshore and offshore is a particularly important finding.',
    keyInsights: [
      {
        title: 'BPO training consistency is not maintained after onboarding',
        insight:
          'Initial training for offshore agents follows the same programme as onshore, but ongoing knowledge updates, coaching, and quality calibration are handled locally by BPO site managers — with inconsistent rigour and significant quality divergence over time.',
        confidence: 'high',
        evidence: [
          "They get the same onboarding we do. After that, it's down to their site manager how much they invest in development.",
          "After 6 months the quality gap between in-house and offshore is visible in every metric.",
        ],
      },
      {
        title: 'Communication lag between UK and offshore creates operational risk',
        insight:
          'Operational changes, policy updates, and disruption guidance take hours to reach offshore sites through the current communication chain. During a disruption event, agents in Manila may be operating on out-of-date instructions while UK agents receive real-time updates.',
        confidence: 'high',
        evidence: [
          "During the November disruption, Manila was still working from the old rebooking policy 3 hours after we'd updated UK.",
          "The communication chain is too long. By the time it reaches the floor offshore, it's sometimes too late.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'organisation',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Good personal relationships with BPO site managers', 'Geographic time zone coverage'],
        gaps: ['Real-time policy update distribution', 'Ongoing offshore training programme', 'Live BPO performance visibility'],
        painPoints: ['Training divergence after 6 months', 'Communication lag during disruptions', 'No live queue or quality data from sites'],
        frictions: ['Local BPO management responsibility for development', 'Communication chain length'],
        barriers: ['BPO contract terms on training obligations', 'Technology for real-time communication'],
        constraint: ['BPO site autonomy on local management', 'Communication infrastructure'],
        future: ['Real-time policy broadcast to all sites', 'Shared quality monitoring platform', 'Regular calibration with offshore sites'],
        working: ['Site manager relationships', 'Geographic coverage model'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'BPO', value: 9 },
      { text: 'offshore', value: 9 },
      { text: 'training', value: 8 },
      { text: 'Manila', value: 7 },
      { text: 'communication lag', value: 7 },
      { text: 'calibration', value: 6 },
      { text: 'consistency', value: 5 },
      { text: 'disruption', value: 4 },
    ],
  },

  {
    name: 'Raj Patel',
    tone: 'constructive',
    executiveSummary:
      'Raj Patel, as Technology Platform Manager, manages the day-to-day stability of the Salesforce-Genesys-Amadeus platform combination and describes an architecture characterised by brittle point-to-point integrations that break regularly, a change management process so slow it has become an operational risk, and a business that has outgrown the integration model it implemented five years ago.',
    feedback:
      'Thank you Raj — your detailed view of the integration brittleness and the change management bottleneck is technically precise and operationally important. The case for an integration middleware layer is well supported by your analysis.',
    keyInsights: [
      {
        title: 'Point-to-point integrations break with every system update',
        insight:
          'The current integration architecture uses direct point-to-point connections between Salesforce, Genesys, and Amadeus. Every system update risks breaking adjacent integrations, creating a cycle of emergency fixes that consumes the technology team.',
        confidence: 'high',
        evidence: [
          "Every time Salesforce updates, something in the Genesys integration breaks. Every time. We spend more time on emergency fixes than on improvements.",
          "We need middleware. Right now every system talks directly to every other system. It's fragile.",
        ],
      },
      {
        title: 'Change management process takes 12 weeks minimum',
        insight:
          'The current IT change management process requires 12 weeks minimum from business request to production deployment. This means the contact centre cannot respond to operational needs in anything approaching real time.',
        confidence: 'high',
        evidence: [
          "12 weeks is our fastest change cycle. The business asks for something and we deliver it three months later.",
          "By the time a change goes live, the requirement has often changed. We're building for yesterday.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'technology',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Core platform investments in place', 'Platform team technical competence'],
        gaps: ['Integration middleware layer', 'Agile change management process', 'API governance framework'],
        painPoints: ['Brittle point-to-point integrations', '12-week change cycle', 'Emergency fix cycle consuming resource'],
        frictions: ['System updates break integrations', 'Change management overhead'],
        barriers: ['Architectural debt', 'IT governance process', 'Vendor update schedules'],
        constraint: ['Change management governance framework', 'IT resource prioritisation'],
        future: ['Integration middleware platform', 'Agile change delivery', 'API-first architecture'],
        working: ['Core platforms stable individually', 'Platform team expertise'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'integration', value: 9 },
      { text: 'Salesforce', value: 7 },
      { text: 'Genesys', value: 7 },
      { text: 'change management', value: 8 },
      { text: 'middleware', value: 8 },
      { text: 'brittle', value: 6 },
      { text: 'API', value: 6 },
      { text: 'emergency fixes', value: 5 },
    ],
  },

  {
    name: 'Sophie Williams',
    tone: 'constructive',
    executiveSummary:
      'Sophie Williams, as Quality Manager, describes a quality function that scores consistently without driving consistent improvement. Quality scores are used as performance management tools rather than diagnostic instruments — resulting in agents managing to the score rather than improving their service. The link between quality assessment and training response is indirect and slow.',
    feedback:
      'Thank you Sophie — your distinction between quality scores as management tools versus diagnostic instruments is a subtle but important point. The observation that agents are managing to the score rather than improving is a critical culture finding.',
    keyInsights: [
      {
        title: 'Quality scores are used as management tools, not improvement instruments',
        insight:
          'Agents are aware that quality scores affect their performance reviews and pay. This creates incentives to perform for assessors rather than consistently improve. The diagnostic value of quality data is largely untapped.',
        confidence: 'high',
        evidence: [
          "Agents know when they're being listened to and their scores reflect that, not their normal standard.",
          "Quality is a compliance mechanism, not a development mechanism. That needs to change.",
        ],
      },
      {
        title: 'Training response to quality gaps is slow and inconsistent',
        insight:
          'When quality assessment identifies a knowledge or skills gap, the pathway from identification to training intervention is 4-6 weeks. By the time training is delivered, the same contact type has been mishandled hundreds of times.',
        confidence: 'medium',
        evidence: [
          "We identify a gap in quality. It takes 4-6 weeks to get a training intervention in place. In that time, hundreds of contacts are handled the wrong way.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'people',
        currentScore: 4,
        targetScore: 8,
        strengths: ['Quality framework established', 'Assessment team skilled'],
        gaps: ['Quality as development vs compliance tool', 'Fast track from gap identification to training', 'Consistent assessment standards'],
        painPoints: ['Agents gaming quality scores', '4-6 week training response lag', 'Score variation across assessors'],
        frictions: ['Quality data not connected to L&D planning cycle', 'Assessment volume too low to detect patterns'],
        barriers: ['Cultural shift from compliance to development', 'L&D capacity for rapid response'],
        constraint: ['QA headcount for increased sampling', 'L&D turnaround time'],
        future: ['Quality drives continuous development', 'Real-time coaching from quality flags', 'Consistent scoring through calibration'],
        working: ['Quality framework structure', 'Assessor expertise'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'quality scores', value: 9 },
      { text: 'assessment', value: 8 },
      { text: 'improvement', value: 7 },
      { text: 'compliance', value: 7 },
      { text: 'training', value: 7 },
      { text: 'gaming', value: 6 },
      { text: 'calibration', value: 5 },
      { text: 'development', value: 4 },
    ],
  },

  {
    name: 'Ben Torres',
    tone: 'operational',
    executiveSummary:
      'Ben Torres, as Workforce Planning Manager, operates the forecasting and scheduling engine for the contact centre and quantifies the planning accuracy problem precisely: 45% variance between planned and actual staffing during disruption events. The planning model has no mechanism to incorporate real-time operational signals and relies on historical averages that are systematically misleading for non-average days.',
    feedback:
      'Thank you Ben — the 45% variance figure is a powerful, specific data point that demonstrates the forecasting problem is not marginal. Your technical understanding of the modelling gap will be essential in designing the right WFM solution.',
    keyInsights: [
      {
        title: '45% staffing variance during disruption events',
        insight:
          'During disruption events, actual required staffing deviates from plan by 45% on average. This is not exceptional — it is the expected outcome of applying historical average modelling to event-driven, non-average days.',
        confidence: 'high',
        evidence: [
          "During disruption we're 45% off our staffing plan on average. That's not an outlier — that's the model failing.",
          "We plan for an average day. Disruption days are not average and our model has no way to know they're coming.",
        ],
      },
      {
        title: 'No real-time signal integration in workforce planning',
        insight:
          'The workforce planning model is built nightly and updated at best twice daily. It has no connection to real-time operational signals — flight delays, weather events, booking volumes — that would allow intraday plan adjustment.',
        confidence: 'high',
        evidence: [
          "The model is built at night and updated at midday. By 10am on a disruption day it's already wrong.",
          "We need real-time signals feeding into our planning. Right now it's a snapshot, not a live view.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'organisation',
        currentScore: 3,
        targetScore: 8,
        strengths: ['WFM team technical competence', 'Verint platform in place', 'Good historical data volume'],
        gaps: ['Real-time signal integration', 'Disruption-aware modelling', 'Intraday plan adjustment'],
        painPoints: ['45% disruption variance', 'Nightly model rebuild too infrequent', 'No intraday flex mechanism'],
        frictions: ['Model depends on historical averages not real-time signals', 'Plan update cycle too slow'],
        barriers: ['Real-time operational data feed', 'Verint configuration investment'],
        constraint: ['IT resource for real-time integration', 'Data infrastructure dependency'],
        future: ['Real-time disruption-aware forecasting', 'Intraday automated plan adjustment', '< 15% variance target'],
        working: ['WFM team capability', 'Verint basic scheduling'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'forecasting', value: 9 },
      { text: 'disruption variance', value: 9 },
      { text: 'real-time', value: 8 },
      { text: 'intraday', value: 7 },
      { text: 'planning', value: 7 },
      { text: 'Verint', value: 6 },
      { text: 'modelling', value: 5 },
      { text: 'scheduling', value: 4 },
    ],
  },

  {
    name: 'Claire Donovan',
    tone: 'constructive',
    executiveSummary:
      'Claire Donovan, as Training Manager, designs and delivers the training programmes that onboard and develop contact centre agents. She identifies three structural problems: training materials are not updated frequently enough to keep pace with policy and system changes, the 6-week onboarding programme cannot be shortened without system or tool improvements, and there is no disruption simulation in training — so agents encounter their most complex, high-stakes contact types for the first time with a live customer.',
    feedback:
      'Thank you Claire — the absence of disruption simulation in training is a striking gap that explains much of the agent confidence and quality failure visible in the disruption data. A simulation-based approach to disruption training is a high-priority recommendation.',
    keyInsights: [
      {
        title: 'No disruption simulation in agent training',
        insight:
          'Agents are trained on standard booking, rebooking, and compensation processes but receive no simulated experience of disruption events. Their first exposure to a 4-hour delay or cancelled flight scenario is live, with a distressed customer.',
        confidence: 'high',
        evidence: [
          "Agents see a major disruption for the first time when they're live with an angry customer. That's when we find out if they can handle it.",
          "We have no disruption simulation in training. It's a significant gap.",
        ],
      },
      {
        title: '6-week onboarding cannot be shortened without system changes',
        insight:
          'The length of the onboarding programme is driven primarily by system complexity — 11 systems require sequential training. Until the technology estate is simplified, meaningful reduction in onboarding time is not achievable through training design alone.',
        confidence: 'high',
        evidence: [
          "6 weeks is how long it takes to train someone on 11 systems. If we had fewer systems, we'd have a shorter onboarding.",
          "Training design can only go so far. The system complexity is the real constraint.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'people',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Structured onboarding programme', 'Training team subject matter expertise'],
        gaps: ['Disruption simulation', 'Real-time training updates', 'Accelerated onboarding pathway'],
        painPoints: ['No disruption practice before live', 'Training update lag', '6-week productivity delay'],
        frictions: ['System complexity forces long onboarding', 'Training material update cycle too slow'],
        barriers: ['Technology simplification prerequisite for shorter onboarding', 'L&D team size for more frequent updates'],
        constraint: ['System complexity', 'L&D team resource'],
        future: ['Disruption simulation module', 'Real-time training update capability', '3-week accelerated onboarding'],
        working: ['Onboarding programme structure', 'System training content quality'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'training', value: 9 },
      { text: 'disruption simulation', value: 9 },
      { text: 'onboarding', value: 8 },
      { text: 'system complexity', value: 7 },
      { text: '6-week', value: 6 },
      { text: 'live customer', value: 5 },
      { text: 'capability', value: 5 },
      { text: 'preparation', value: 4 },
    ],
  },

  {
    name: 'Nathan Hughes',
    tone: 'constructive',
    executiveSummary:
      'Nathan Hughes, as Data & Reporting Manager, is responsible for the 15 weekly reports that multiple stakeholders have identified as contradictory and unusable for decision-making. He understands the problem from the inside: each report was built independently for a specific stakeholder without any data governance framework, and he has neither the authority nor the technology to consolidate them. He has been advocating for a single performance dashboard for three years.',
    feedback:
      'Thank you Nathan — your visibility of the full reporting landscape and your three-year history of advocating for a consolidated dashboard give you exactly the context needed to lead the analytics workstream. Your frustration is well-founded and your diagnosis is correct.',
    keyInsights: [
      {
        title: 'Fifteen reports built independently with no governance',
        insight:
          'Each of the 15 weekly reports was built for a specific stakeholder without reference to other reports. There is no data governance framework, no common metric dictionary, and no single owner responsible for consistency.',
        confidence: 'high',
        evidence: [
          "Each report was built by a different person for a different stakeholder. Nobody was thinking about consistency.",
          "We have no data governance. No common definitions. No one owns the metrics end to end.",
        ],
      },
      {
        title: 'Data silos prevent a single performance view',
        insight:
          'Core metrics span data from Genesys (call data), Salesforce (case data), Verint (WFM data) and internal spreadsheets. There is no integrated data warehouse or reporting layer — each team queries their system directly.',
        confidence: 'high',
        evidence: [
          "Contact volume lives in Genesys. Cases live in Salesforce. Staffing lives in Verint. They don't talk to each other at a data level.",
          "To build a true end-to-end picture I have to manually join four exports. It takes days.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'technology',
        currentScore: 2,
        targetScore: 8,
        strengths: ['Large volume of raw data across systems', 'Analytical team motivation to improve'],
        gaps: ['Data warehouse or integrated reporting layer', 'Common metric definitions', 'Real-time reporting capability'],
        painPoints: ['15 contradictory reports', 'Manual multi-system joins taking days', 'Leadership making decisions on inconsistent data'],
        frictions: ['No data governance authority', 'Each team owns its own data source'],
        barriers: ['Technology investment for data warehouse', 'Cross-functional agreement on metric definitions', 'Stakeholder reluctance to change report format'],
        constraint: ['IT resource', 'Cross-functional buy-in'],
        future: ['Single performance dashboard', 'Common metric dictionary', 'Near real-time reporting'],
        working: ['Data team analytical skills', 'System data quality (individually)'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'data', value: 9 },
      { text: 'reporting', value: 9 },
      { text: 'governance', value: 8 },
      { text: 'dashboard', value: 8 },
      { text: 'metrics', value: 7 },
      { text: 'silos', value: 7 },
      { text: 'Genesys', value: 5 },
      { text: 'Salesforce', value: 5 },
    ],
  },

  // ─── TEAM LEADERS ─────────────────────────────────────────────────────────

  {
    name: 'Amy Fletcher',
    tone: 'operational',
    executiveSummary:
      'Amy Fletcher, as Senior Team Leader on the Disruption Desk, manages the highest-intensity contacts in the contact centre — customers calling during active disruption events — and describes an environment with no standardised response framework, no real-time flight operations data available to agents, and wait times of up to four hours at peak disruption. She and her team are improvising responses to scenarios that should have clear playbooks.',
    feedback:
      'Thank you Amy — your direct, unvarnished account of what the Disruption Desk actually looks like during a major event is invaluable. The combination of no playbook, no real-time data, and four-hour waits is a complete picture of what needs to change.',
    keyInsights: [
      {
        title: 'No standardised disruption response framework on the desk',
        insight:
          'Each team leader on the Disruption Desk handles the same disruption scenarios differently. There is no agreed playbook for the most common event types — weather delays, technical faults, ATC restrictions — resulting in inconsistent customer outcomes.',
        confidence: 'high',
        evidence: [
          "There's no playbook. Every TL handles it differently. Same disruption, different treatment depending on who your TL is.",
          "I've been asking for a disruption response framework for 18 months. We still don't have one.",
        ],
      },
      {
        title: 'Disruption Desk agents have no real-time flight operations data',
        insight:
          'Agents on the Disruption Desk handle rebooking and compensation calls without access to real-time departure and arrival data from the operations system. They rely on the same public departure board data available to customers.',
        confidence: 'high',
        evidence: [
          "My agents are looking at the same Departures board the customer is looking at. We have nothing they don't have.",
          "We should have real-time ops data. We don't. It's a basic failure.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'organisation',
        currentScore: 2,
        targetScore: 8,
        strengths: ['Experienced disruption desk team', 'High agent resilience'],
        gaps: ['Disruption playbooks', 'Real-time ops data access', 'Authority to make disruption decisions'],
        painPoints: ['4-hour wait times at peak', 'Improvised responses', 'Agents with less info than customers'],
        frictions: ['No ops data integration', 'No agreed framework for common scenarios'],
        barriers: ['Operations system API access', 'Policy authority for disruption decisions'],
        constraint: ['Technology for real-time ops data feed', 'Policy empowerment for agents'],
        future: ['Playbook-driven disruption response', 'Real-time flight data for every agent', 'Sub-30-minute disruption wait time'],
        working: ['Team resilience and experience', 'Good customer empathy'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'disruption', value: 10 },
      { text: 'playbooks', value: 9 },
      { text: 'real-time data', value: 8 },
      { text: 'wait times', value: 7 },
      { text: 'rebooking', value: 7 },
      { text: 'operations', value: 6 },
      { text: 'inconsistency', value: 5 },
      { text: 'empowerment', value: 4 },
    ],
  },

  {
    name: 'Michael Grant',
    tone: 'constructive',
    executiveSummary:
      'Michael Grant leads the Premium Cabin team, which Sarah Morrison has identified as the internal model for service recovery excellence. He confirms that the premium team\'s performance is real — but explains that it depends on a combination of higher agent authority, deeper system access, smaller team size, and a culture of ownership that is structurally difficult to replicate at scale without the same conditions.',
    feedback:
      'Thank you Michael — your honest analysis of why the premium team performs differently is one of the most strategically important contributions to this discovery. If the conditions for premium service — authority, access, ownership — can be systematically extended, the model is transferable.',
    keyInsights: [
      {
        title: 'Premium team performance depends on conditions not available at scale',
        insight:
          'The premium cabin team performs better because agents have higher authority to resolve cases, deeper system access to customer history and loyalty data, smaller team sizes enabling peer coaching, and a culture of full case ownership. These are structural advantages, not individual excellence.',
        confidence: 'high',
        evidence: [
          "We can rebook, compensate, upgrade and waive fees without escalation. That's why we resolve things. Other agents can't.",
          "My team has 12 people. I can coach every one of them weekly. You can't do that with a team of 30.",
        ],
      },
      {
        title: 'Access to loyalty and customer history data transforms service quality',
        insight:
          'Premium agents have access to the full customer loyalty profile — tier, lifetime value, complaint history, preferences — in Salesforce. This allows them to personalise every interaction. Most contact centre agents do not have this access.',
        confidence: 'high',
        evidence: [
          "I know before I answer the call whether this is a Gold member who\'s had three disruptions this year or a first-time flyer. That changes everything about how I handle it.",
          "Most agents don't have that view. They're handling every customer the same regardless of who they are.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'customer',
        currentScore: 7,
        targetScore: 9,
        strengths: ['High agent authority', 'Full customer data access', 'Small team coaching culture', 'Case ownership model'],
        gaps: ['Scalability of premium model', 'Replication of conditions across full team'],
        painPoints: ['Structural advantages not available to other teams', 'Authority limit differences create different customer outcomes'],
        frictions: ['Scale prevents small-team culture', 'System access differentiation between tiers'],
        barriers: ['Policy on agent authority expansion', 'Loyalty data access controls'],
        constraint: ['Cost of replicating premium conditions at scale', 'System access governance'],
        future: ['Expanded agent authority model across contact centre', 'Loyalty data available to all agents', 'Case ownership culture'],
        working: ['Premium team service excellence', 'Customer loyalty data access', 'Case ownership model'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'premium cabin', value: 9 },
      { text: 'authority', value: 9 },
      { text: 'customer history', value: 8 },
      { text: 'loyalty', value: 8 },
      { text: 'ownership', value: 7 },
      { text: 'coaching', value: 6 },
      { text: 'personalisation', value: 6 },
      { text: 'scalability', value: 4 },
    ],
  },

  {
    name: 'Jade Robinson',
    tone: 'constructive',
    executiveSummary:
      'Jade Robinson, as Team Leader for Digital & Social, manages the fastest-growing contact channel — social media — but operates without routing intelligence, SLA alignment with the core contact centre, or tools capable of the real-time monitoring that the channel demands. Digital contacts are growing 40% year-on-year but the operating model has not evolved to match.',
    feedback:
      'Thank you Jade — your analysis of the digital and social channel gap is timely. The 40% year-on-year growth in digital contacts with no routing intelligence or SLA parity is a commercial risk that needs to be addressed in the channel strategy.',
    keyInsights: [
      {
        title: 'Social media contacts growing 40% per year with no routing intelligence',
        insight:
          'Social media contact volume is increasing 40% year-on-year, driven by customers who prefer digital channels for flight disruption, refunds and complaints. There is no intelligent routing, no priority scoring, and no SLA alignment with voice.',
        confidence: 'high',
        evidence: [
          "Social is growing 40% year on year and we're managing it with the same tools and processes we had when it was 10% of the volume.",
          "There's no routing. Someone has to manually pick up each tweet or message and decide what to do with it.",
        ],
      },
      {
        title: 'Social channel lacks parity with voice in authority and tools',
        insight:
          'Agents handling social contacts cannot access the same systems or make the same decisions as voice agents. A customer who DMs on social gets a fundamentally inferior resolution capability compared to one who calls.',
        confidence: 'high',
        evidence: [
          "If you call us I can rebook you. If you DM us I have to ask you to call. The channel capability is years behind.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'technology',
        currentScore: 3,
        targetScore: 8,
        strengths: ['Digital team social media knowledge', 'Growing channel presence'],
        gaps: ['Social routing intelligence', 'Digital channel system parity with voice', 'Social SLA framework'],
        painPoints: ['Manual social pickup', 'No SLA alignment', 'System access inferior to voice'],
        frictions: ['40% growth vs static operating model', 'Manual processes unable to scale'],
        barriers: ['Social platform API integration', 'Technology investment for digital routing'],
        constraint: ['IT priority for digital integration', 'Policy for digital resolution authority'],
        future: ['Intelligent social routing', 'Digital-voice parity', 'Omnichannel resolution capability'],
        working: ['Team social media expertise', 'Growing brand presence on social'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'social media', value: 9 },
      { text: 'digital', value: 9 },
      { text: 'routing', value: 8 },
      { text: 'omnichannel', value: 7 },
      { text: 'SLA', value: 7 },
      { text: 'growth', value: 6 },
      { text: 'authority', value: 5 },
      { text: 'parity', value: 4 },
    ],
  },

  {
    name: "Liam O'Connor",
    tone: 'operational',
    executiveSummary:
      "Liam O'Connor, as Team Leader at the BPO offshore site in Manila, provides the only participant perspective from outside the UK. His team handles UK flight queries from a 8-hour time difference with limited access to real-time UK operational data, training that diverges from UK standards within months of onboarding, and an escalation process that frequently requires UK hours to resolve.",
    feedback:
      "Thank you Liam — your perspective from Manila is unique and essential. The combination of time zone dependency, training drift, and real-time data gaps you've described from the ground is a precise diagnosis of the BPO model's structural limitations.",
    keyInsights: [
      {
        title: 'Manila team lacks real-time UK operational data during UK hours',
        insight:
          "Liam's team handles the overnight and early morning UK contact window, but the UK operations data they rely on — flight status, disruption updates, policy changes — is not available in real time during the shift overlap.",
        confidence: 'high',
        evidence: [
          "During our shift, UK is just waking up. Policy updates don't reach us until 3-4 hours into our overlap.",
          "We handle the morning rush with yesterday's information. It creates problems.",
        ],
      },
      {
        title: 'Training alignment degrades within 3-6 months of UK onboarding',
        insight:
          'Manila agents receive initial training aligned with UK standards, but ongoing knowledge updates are managed locally. After 3-6 months, the knowledge gap between Manila and UK is measurable and growing.',
        confidence: 'high',
        evidence: [
          "After 6 months, my agents are working from a different knowledge base to UK. The drift is gradual but it's real.",
          "We do our own refreshers here but they're not coordinated with what UK is doing.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'organisation',
        currentScore: 3,
        targetScore: 7,
        strengths: ['Strong Manila team resilience', 'Good cultural customer service orientation', 'Cost-effective time zone coverage'],
        gaps: ['Real-time UK operational data feed', 'Aligned training updates with UK', 'Escalation paths during UK out-of-hours'],
        painPoints: ['Time zone data lag', 'Training drift after 6 months', 'Escalation delays requiring UK hours'],
        frictions: ['Communication chain length for policy updates', 'Local training management diverges from UK'],
        barriers: ['Technology for real-time data access', 'Coordination overhead for training alignment'],
        constraint: ['Time zone overlap window', 'Local BPO management authority'],
        future: ['Real-time UK data access for all offshore sites', 'Synchronised training updates', 'Offshore escalation resolution capability'],
        working: ['Team resilience', 'Customer service culture', 'Time zone coverage value'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'Manila', value: 9 },
      { text: 'time zone', value: 9 },
      { text: 'training drift', value: 8 },
      { text: 'real-time data', value: 8 },
      { text: 'escalation', value: 7 },
      { text: 'knowledge gap', value: 6 },
      { text: 'UK operations', value: 6 },
      { text: 'offshore', value: 5 },
    ],
  },

  {
    name: 'Natalie Price',
    tone: 'constructive',
    executiveSummary:
      'Natalie Price, as Quality Coach, works at the point where quality assessment meets performance development — and identifies a consistent pattern: quality feedback is well received in coaching sessions but does not translate into sustained behaviour change in live contacts. The coaching model lacks reinforcement mechanisms and the interval between coaching conversations is too long to maintain behaviour change momentum.',
    feedback:
      'Thank you Natalie — your observation that quality feedback is absorbed in coaching but not retained in behaviour is a crucial finding. The reinforcement gap you\'ve identified points to a coaching frequency and follow-up problem that technology could help address.',
    keyInsights: [
      {
        title: 'Quality feedback does not translate to sustained behaviour change',
        insight:
          'Agents improve in the days following a coaching session but revert within two weeks without reinforcement. The coaching interval is monthly at best, creating a pattern of temporary improvement followed by regression.',
        confidence: 'high',
        evidence: [
          "After a good coaching session, scores improve for about a week. Then they drift back. The interval is too long.",
          "We're not reinforcing the change. One conversation a month isn't enough to shift a habit.",
        ],
      },
      {
        title: 'Coaching lacks personalisation — same framework for all agents',
        insight:
          'The coaching framework applies the same structure to all agents regardless of their specific development needs, tenured experience, or learning style. High performers and struggling agents receive the same coaching conversation.',
        confidence: 'medium',
        evidence: [
          "We use the same coaching framework for everyone. A brand new agent and a 3-year veteran get the same conversation.",
          "Coaching should be tailored. It isn't, because we don't have the time or tools to make it so.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'people',
        currentScore: 4,
        targetScore: 8,
        strengths: ['Quality coaching expertise', 'Good agent receptiveness to feedback'],
        gaps: ['Coaching frequency', 'Behaviour change reinforcement', 'Personalised coaching pathways'],
        painPoints: ['Monthly coaching too infrequent', 'Regression after 1-2 weeks', 'Same framework for all agents'],
        frictions: ['No reinforcement between sessions', 'Coaching not differentiated by need'],
        barriers: ['Coach capacity for more frequent contact', 'Technology for personalised coaching pathways'],
        constraint: ['Coach headcount', 'Time within TL schedule'],
        future: ['Weekly micro-coaching', 'AI-assisted reinforcement', 'Personalised development pathways'],
        working: ['Coach expertise', 'Agent openness to development'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'coaching', value: 9 },
      { text: 'behaviour change', value: 9 },
      { text: 'reinforcement', value: 8 },
      { text: 'feedback', value: 8 },
      { text: 'regression', value: 7 },
      { text: 'personalisation', value: 6 },
      { text: 'frequency', value: 6 },
      { text: 'development', value: 4 },
    ],
  },

  // ─── FRONT-LINE AGENTS ────────────────────────────────────────────────────

  {
    name: 'Jamie Walsh',
    tone: 'operational',
    executiveSummary:
      'Jamie Walsh, a front-line Customer Service Agent, describes the agent desktop experience as the defining operational failure: switching between eight separate systems to handle a single contact is routine, the process is error-prone, customers can hear the dead air and system switching, and the cognitive load of managing eight applications simultaneously undermines the quality of the customer interaction itself.',
    feedback:
      'Thank you Jamie — your description of the eight-system experience is vivid and specific. The dead air, the cognitive load, the errors — these are the ground-level consequences of the integration failure that leadership has described in abstract terms. Your perspective is essential.',
    keyInsights: [
      {
        title: 'Eight systems to handle a single contact is unworkable',
        insight:
          'Agents routinely switch between eight separate applications to complete a standard contact — Genesys for telephony, Salesforce for case management, Amadeus for booking, the loyalty platform, internal knowledge base, rebooking tool, refund system, and the public departure board. The cognitive overhead is significant and errors are common.',
        confidence: 'high',
        evidence: [
          "I'm on eight different screens for a normal rebooking. The customer is waiting while I find what I need.",
          "I make mistakes because I'm copying booking references between systems manually. Copy-paste errors happen all the time.",
        ],
      },
      {
        title: 'Dead air during system switching damages customer perception',
        insight:
          'Customers can hear the silence while agents navigate between systems. This creates a perception of incompetence and extends handle time, particularly for complex contacts where multiple system lookups are required.',
        confidence: 'high',
        evidence: [
          "The customer asks me something and I have to say 'bear with me' while I find it in another system. You can hear them getting impatient.",
          "Dead air is one of the biggest complaints we get. It's a symptom of the system problem.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'technology',
        currentScore: 2,
        targetScore: 8,
        strengths: ['Agent resilience', 'Good product knowledge despite system complexity'],
        gaps: ['Unified agent desktop', 'Single customer view', 'Automated data population'],
        painPoints: ['8 system switches per contact', 'Manual data copying', 'Dead air from navigation time'],
        frictions: ['No integrated agent desktop', 'Copy-paste errors between systems'],
        barriers: ['Technology integration investment', 'Vendor cooperation on desktop unification'],
        constraint: ['IT investment priority', 'Multiple system dependencies'],
        future: ['Single agent desktop with unified customer view', 'Automated data population', 'Zero manual system switching'],
        working: ['Agent knowledge and resilience'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'systems', value: 10 },
      { text: 'desktop', value: 9 },
      { text: 'dead air', value: 8 },
      { text: 'switching', value: 8 },
      { text: 'copy-paste', value: 7 },
      { text: 'errors', value: 6 },
      { text: 'cognitive load', value: 5 },
      { text: 'handle time', value: 4 },
    ],
  },

  {
    name: 'Aisha Okafor',
    tone: 'operational',
    executiveSummary:
      'Aisha Okafor, a front-line Customer Service Agent on the Disruption Desk, describes the experience of handling the most emotionally intense contacts in the contact centre — passengers stranded during a major disruption — without the authority to rebook, the real-time data to inform decisions, or the tools to provide alternatives at pace. She describes the human cost of systems failing at the worst possible moment.',
    feedback:
      'Thank you Aisha — your account of handling disruption contacts without the authority to rebook or access real-time data is one of the most important testimonies in this discovery. The human dimension of the systems failure is exactly what the programme must not lose sight of.',
    keyInsights: [
      {
        title: 'Agents cannot rebook during disruption without supervisor approval',
        insight:
          'During disruption events, Disruption Desk agents cannot independently rebook passengers onto alternative flights. Every rebooking requires supervisor sign-off — creating a bottleneck at the most critical moment when speed matters most.',
        confidence: 'high',
        evidence: [
          "I can't rebook anyone without my supervisor approving it. During a big disruption, my supervisor is approving 50 things at once.",
          "The customer is stranded. I can see the alternatives. I can't book any of them. I have to make them wait.",
        ],
      },
      {
        title: 'Agents have less information than passengers during disruptions',
        insight:
          'During active disruptions, agents on the desk do not have access to real-time flight operations data, gate changes, or revised departure times. Passengers with the app often have more current information than the agent they are speaking to.',
        confidence: 'high',
        evidence: [
          "The passenger tells me the gate's changed. I don't know that. They're looking at the app and I'm looking at a departure board that's 20 minutes behind.",
          "It's embarrassing. I'm supposed to be helping them and they know more than me.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'people',
        currentScore: 2,
        targetScore: 8,
        strengths: ['High agent empathy', 'Genuine care for customers'],
        gaps: ['Agent rebooking authority', 'Real-time operations data', 'Disruption decision support tools'],
        painPoints: ['Cannot rebook without supervisor', 'Less info than passengers', 'Emotional burden of system failure'],
        frictions: ['Authority ceiling for all agent decisions', 'Operations data not integrated to desktop'],
        barriers: ['Policy on agent authority', 'Operations system API access'],
        constraint: ['Policy framework for agent empowerment', 'IT investment for real-time data'],
        future: ['Agent authority to rebook during disruption', 'Real-time operations data on desktop', 'Decision support tooling'],
        working: ['Agent empathy and customer care', 'Team resilience under pressure'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'disruption', value: 10 },
      { text: 'authority', value: 9 },
      { text: 'rebooking', value: 9 },
      { text: 'real-time data', value: 8 },
      { text: 'stranded', value: 7 },
      { text: 'empathy', value: 7 },
      { text: 'supervisor approval', value: 6 },
      { text: 'information gap', value: 5 },
    ],
  },

  {
    name: 'Ryan Mitchell',
    tone: 'constructive',
    executiveSummary:
      'Ryan Mitchell, a Customer Service Agent on the Premium Cabin team, handles the highest-value customers and describes both the advantage of his team\'s tools and the gap between customer expectations and what the system makes possible. Premium customers expect instant, personalised service that references their history and tier — a standard Ryan can usually meet but not consistently when system access is incomplete or calls overflow from the disruption desk.',
    feedback:
      'Thank you Ryan — your account of handling premium customers with incomplete system access on overflow calls is a precise example of how routing failures create customer experience failures. Your detail on what the premium desktop makes possible — and what it still can\'t do — is valuable input to the technology workstream.',
    keyInsights: [
      {
        title: 'Premium customers expect personalisation the system cannot always deliver',
        insight:
          'Premium passengers expect agents to know their seat preference, meal requirement, booking history, and loyalty tier before the conversation begins. The system makes this possible for planned premium contacts but not for overflow or rerouted calls where agent context is limited.',
        confidence: 'high',
        evidence: [
          "A Gold member calls expecting me to already know them. Usually I do. On overflow calls I'm starting from scratch and they notice immediately.",
          "They say 'you should know this about me'. And they're right. We should.",
        ],
      },
      {
        title: 'PNR lookup is still manual despite Salesforce-Amadeus integration',
        insight:
          'Despite the partial Salesforce-Amadeus integration, passenger name record lookup still requires manual entry and verification steps. For premium customers with complex itineraries, this creates a visible delay at the start of the call.',
        confidence: 'medium',
        evidence: [
          "Even with the integration, I still have to manually look up the PNR in Amadeus and cross-reference it in Salesforce.",
          "It takes 90 seconds before I can see the full picture. For a Premium customer, that's too long.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'customer',
        currentScore: 6,
        targetScore: 9,
        strengths: ['Good Salesforce-Amadeus partial integration', 'Team product knowledge', 'Customer loyalty data access'],
        gaps: ['Seamless PNR lookup', 'Consistent premium experience on overflow', 'Proactive personalisation before call begins'],
        painPoints: ['90-second manual PNR lookup', 'Overflow calls without customer context', 'Manual cross-reference steps'],
        frictions: ['Integration incomplete — manual steps remain', 'Overflow routing removes customer context'],
        barriers: ['Full Salesforce-Amadeus API integration required', 'Routing system context-passing'],
        constraint: ['IT investment for full integration', 'Routing system capability'],
        future: ['Instant customer context on every call', 'No manual PNR lookup', 'Context passed with every routed call'],
        working: ['Loyalty data access', 'Team premium service culture', 'Partial Salesforce-Amadeus integration'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'premium', value: 9 },
      { text: 'personalisation', value: 9 },
      { text: 'PNR lookup', value: 8 },
      { text: 'Gold member', value: 7 },
      { text: 'loyalty', value: 7 },
      { text: 'context', value: 7 },
      { text: 'overflow', value: 6 },
      { text: 'Amadeus', value: 5 },
    ],
  },

  {
    name: 'Charlotte Davies',
    tone: 'operational',
    executiveSummary:
      'Charlotte Davies, a front-line Customer Service Agent, describes a tension between the scripted guidance she is expected to follow and the situational judgement that customer interactions actually require. She is capable of better service than the script permits but lacks the authority and system access to exercise that judgement — a frustration she identifies as a contributing factor to agent dissatisfaction and attrition.',
    feedback:
      'Thank you Charlotte — your articulation of the gap between scripted rigidity and situational judgement is one of the most honest accounts of the agent experience in this discovery. The link you draw to attrition is important and should inform the agent empowerment workstream.',
    keyInsights: [
      {
        title: 'Script rigidity prevents agents from exercising good judgement',
        insight:
          'Agents are required to follow call scripts for most contact types. In situations where a different response would clearly be better for the customer, agents cannot deviate without escalation — creating worse outcomes and agent frustration.',
        confidence: 'high',
        evidence: [
          "I can tell the script isn't the right answer but I have to say it anyway. The customer can tell I'm reading something.",
          "Script rigidity makes me feel like I'm not trusted to use my judgement. After a while you stop trying.",
        ],
      },
      {
        title: 'Limited authority drives agent disengagement and attrition',
        insight:
          'Agents who feel they cannot provide good service due to authority and system limitations progressively disengage and leave. Charlotte identifies the authority gap as a primary driver of her own and colleagues\' dissatisfaction.',
        confidence: 'medium',
        evidence: [
          "Three people from my start group have already left. The main reason was the same — feeling like you can't actually help anyone.",
          "If I could fix problems I'd feel good about my job. Most of the time I'm telling people I can't help them the way they need.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'people',
        currentScore: 3,
        targetScore: 7,
        strengths: ['Agent motivation to serve customers well', 'Good communication skills'],
        gaps: ['Agent empowerment and authority', 'Guided judgement framework', 'Reduced script rigidity'],
        painPoints: ['Script forces suboptimal responses', 'Authority limits create agent frustration', 'Attrition from disengagement'],
        frictions: ['Customer can tell agent is scripted', 'Escalation required for obvious right answers'],
        barriers: ['Policy framework for expanded agent authority', 'Cultural shift from compliance to empowerment'],
        constraint: ['Regulatory requirements driving some script rigidity', 'Risk appetite for agent discretion'],
        future: ['Guided judgement framework replacing scripts', 'Agent authority to resolve most contacts', 'Empowerment as retention lever'],
        working: ['Agent capability and care', 'Communication skills'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'script', value: 9 },
      { text: 'judgement', value: 9 },
      { text: 'authority', value: 8 },
      { text: 'empowerment', value: 8 },
      { text: 'attrition', value: 7 },
      { text: 'disengagement', value: 6 },
      { text: 'trust', value: 6 },
      { text: 'frustration', value: 5 },
    ],
  },

  {
    name: 'Tariq Hassan',
    tone: 'operational',
    executiveSummary:
      'Tariq Hassan, a Customer Service Agent in Cargo Operations, represents a completely separate operational world within the same contact centre. Cargo contacts use a different system (Cargowise), have different regulatory requirements, require different knowledge, and were given no dedicated training when Tariq joined. He and his colleagues have taught themselves through trial, error, and peer learning.',
    feedback:
      'Thank you Tariq — your account of cargo onboarding by trial and error is a striking example of how the contact centre\'s complexity has outgrown its training and support infrastructure. Cargo is a critical revenue function and deserves dedicated capability development.',
    keyInsights: [
      {
        title: 'Cargo agents received no dedicated system training',
        insight:
          'Cargo operations use Cargowise — a completely separate system from the passenger contact centre stack. Cargo agents received general onboarding and learned Cargowise through trial and error, peer guidance, and self-teaching.',
        confidence: 'high',
        evidence: [
          "I learned Cargowise by making mistakes and asking colleagues. There was no training on it in onboarding.",
          "Cargo is a completely different world. We use different systems, handle different regulations. The onboarding treated us like passenger agents.",
        ],
      },
      {
        title: 'Cargo regulatory requirements not covered in standard training',
        insight:
          'Cargo contacts involve specific regulatory requirements — dangerous goods classifications, customs documentation, import/export restrictions — that are not covered in the standard agent training programme. Agents learn these requirements on the job, creating compliance risk.',
        confidence: 'high',
        evidence: [
          "There's a whole regulatory dimension to cargo that the standard training doesn't touch. DG classification, customs, IATA regulations.",
          "I've made regulatory errors because I didn't know the rule existed. That's a risk for the airline.",
        ],
      },
    ],
    phaseInsights: [
      {
        phase: 'organisation',
        currentScore: 2,
        targetScore: 7,
        strengths: ['Cargo team peer support culture', 'Agent motivation to learn'],
        gaps: ['Cargo-specific training programme', 'Regulatory knowledge framework', 'Cargowise system training'],
        painPoints: ['No dedicated cargo onboarding', 'Regulatory compliance gaps', 'Self-taught system usage'],
        frictions: ['Cargo treated as passenger operations variant', 'No cargo-specific knowledge base'],
        barriers: ['L&D resource for cargo-specific programme', 'Regulatory expertise for training content'],
        constraint: ['L&D team bandwidth', 'Cargo regulatory expertise availability'],
        future: ['Dedicated cargo onboarding programme', 'Regulatory knowledge certification', 'Cargo-specific knowledge base'],
        working: ['Team peer learning culture', 'Self-motivated knowledge building'],
        support: [],
      },
    ],
    wordCloudThemes: [
      { text: 'cargo', value: 10 },
      { text: 'Cargowise', value: 9 },
      { text: 'training', value: 9 },
      { text: 'regulation', value: 8 },
      { text: 'dangerous goods', value: 7 },
      { text: 'compliance', value: 7 },
      { text: 'self-taught', value: 6 },
      { text: 'IATA', value: 5 },
    ],
  },
];

// ─── MISSING LENS ENRICHMENT ─────────────────────────────────────────────────
// The 4 lenses below were added to the Jo Air workshop AFTER the seed was
// originally written. We add them here so the spider and discovery output
// reflect all 8 configured lenses without rewriting every REPORTS entry.
//
// Scores are calibrated to the Jo Air airline contact-centre context and vary
// by participant seniority (exec / senior-manager / manager / agent).

const EXECUTIVES = new Set([
  'Sarah Morrison', 'James Whitfield', 'Rachel Hughes', 'David Palmer', 'Fiona Lawson',
]);
const SENIOR_MANAGERS = new Set([
  'Tom Hendricks', 'Angela Ward', 'Chris Barker', 'Priya Sharma', "Mark O'Brien", 'Louise Carter', 'Simon Reed',
]);
const AGENTS = new Set([
  'Natalie Price', 'Jamie Walsh', 'Aisha Okafor', 'Ryan Mitchell', 'Charlotte Davies', 'Tariq Hassan',
]);

function getLensTier(name: string): 'exec' | 'senior' | 'manager' | 'agent' {
  if (EXECUTIVES.has(name)) return 'exec';
  if (SENIOR_MANAGERS.has(name)) return 'senior';
  if (AGENTS.has(name)) return 'agent';
  return 'manager';
}

type PhaseInsightRow = ReportData['phaseInsights'][number];

function missingLensInsights(name: string): PhaseInsightRow[] {
  const tier = getLensTier(name);

  const scores: Record<string, Record<'exec' | 'senior' | 'manager' | 'agent', { c: number; t: number }>> = {
    operations: { exec: { c: 3, t: 8 }, senior: { c: 3, t: 7 }, manager: { c: 2, t: 7 }, agent: { c: 2, t: 7 } },
    training:   { exec: { c: 3, t: 8 }, senior: { c: 3, t: 7 }, manager: { c: 2, t: 7 }, agent: { c: 2, t: 7 } },
    regulation: { exec: { c: 5, t: 7 }, senior: { c: 4, t: 7 }, manager: { c: 4, t: 7 }, agent: { c: 3, t: 6 } },
    culture:    { exec: { c: 3, t: 8 }, senior: { c: 3, t: 8 }, manager: { c: 3, t: 8 }, agent: { c: 4, t: 9 } },
  };

  return [
    {
      phase: 'Operations',
      currentScore: scores.operations[tier].c,
      targetScore:  scores.operations[tier].t,
      strengths: tier === 'exec' ? ['Board commitment to operational transformation'] : ['Team resilience under pressure'],
      gaps: ['Routing matched to contact type and disruption volume', 'Real-time capacity model'],
      painPoints: ['Queue instability is the daily operational reality', 'Disruption handling overwhelms standard processes'],
      frictions: ['Legacy routing logic not updated for current contact mix'],
      barriers: tier === 'exec' ? ['Foundational data investment not yet approved'] : ['Tooling limitations'],
      constraint: tier === 'exec' ? ['24-month ROI window'] : [],
      future: ['Elastic disruption-ready operation', 'Right agent to right contact every time'],
      working: tier === 'exec' ? ['Premium cabin operational model'] : [],
      support: [],
    },
    {
      phase: 'Training & Capability',
      currentScore: scores.training[tier].c,
      targetScore:  scores.training[tier].t,
      strengths: ['Agent willingness to develop', 'Clear improvement aspiration from leadership'],
      gaps: ['Coaching framework linked to empathy KPIs', 'Recovery skills training at scale'],
      painPoints: ['Six-week onboarding leaves agents unprepared for disruption', 'Coaching deficits at team leader level'],
      frictions: ['Speed metrics override quality — training follows the wrong incentives'],
      barriers: ['Coaching infrastructure not built for empathy at scale'],
      constraint: tier === 'exec' ? ['ROI pressure on soft-skill investment'] : [],
      future: ['Empathy and recovery embedded in all agent development', 'Team leaders as active coaches'],
      working: tier === 'exec' ? ['Premium cabin recovery team as internal benchmark'] : [],
      support: [],
    },
    {
      phase: 'Regulation & Compliance',
      currentScore: scores.regulation[tier].c,
      targetScore:  scores.regulation[tier].t,
      strengths: tier === 'exec' ? ['Board-level regulatory awareness'] : ['Awareness of core compliance obligations'],
      gaps: ['Cargo regulatory compliance training for agents', 'Consistent awareness across all sites'],
      painPoints: tier === 'agent' ? ['Compliance requirements cited as reason for script rigidity'] : ['Regulatory training not integrated into agent empowerment model'],
      frictions: ['Compliance requirements used to justify inflexible scripting'],
      barriers: [],
      constraint: [],
      future: ['Compliance embedded in empowerment model, not opposed to it'],
      working: tier === 'exec' ? ['Board-level regulatory awareness'] : [],
      support: [],
    },
    {
      phase: 'Culture',
      currentScore: scores.culture[tier].c,
      targetScore:  scores.culture[tier].t,
      strengths: tier === 'agent' ? ['Genuine care for customers despite system constraints'] : ['Premium cabin team as proof of concept for empathy culture'],
      gaps: ['Empathy-first culture across all agent tiers', 'Metrics aligned to cultural values'],
      painPoints: ['KPI culture drives efficiency over care', 'Script rigidity suppresses agent empathy'],
      frictions: ['Performance management rewards speed, not customer outcomes'],
      barriers: ['Cultural change requires sustained leadership commitment'],
      constraint: tier === 'exec' ? ['ROI window creates pressure inconsistent with cultural transformation'] : [],
      future: ['Empathy and customer care as core cultural values, measured and rewarded', 'Agents empowered to do the right thing'],
      working: tier === 'exec' ? ['Premium cabin recovery culture as internal model'] : [],
      support: [],
    },
  ];
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('📋 Seeding ConversationReport records for Jo Air discovery...\n');

  // Fetch all participants + sessions for this workshop
  const participants = await prisma.workshopParticipant.findMany({
    where: { workshopId: WORKSHOP_ID },
    include: {
      sessions: {
        where: { status: 'COMPLETED' },
        take: 1,
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (participants.length === 0) {
    console.error('❌ No participants found. Run seed-joair-discovery.ts first.');
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const participant of participants) {
    const session = participant.sessions[0];
    if (!session) {
      console.log(`  ⚠️  No completed session for ${participant.name} — skipping`);
      skipped++;
      continue;
    }

    const reportData = REPORTS.find((r) => r.name === participant.name);
    if (!reportData) {
      console.log(`  ⚠️  No report data for ${participant.name} — skipping`);
      skipped++;
      continue;
    }

    await prisma.conversationReport.upsert({
      where: { sessionId: session.id },
      create: {
        sessionId: session.id,
        workshopId: WORKSHOP_ID,
        participantId: participant.id,
        executiveSummary: reportData.executiveSummary,
        feedback: reportData.feedback,
        tone: reportData.tone,
        keyInsights: reportData.keyInsights,
        phaseInsights: [...reportData.phaseInsights, ...missingLensInsights(participant.name || '')],
        wordCloudThemes: reportData.wordCloudThemes,
        inputQuality: {
          score: 75,
          label: 'medium',
          rationale: 'Synthetic discovery response — structured content derived from role-specific interview data.',
          missingInfoSuggestions: [],
          agenticConfigured: false,
          agenticModelVersion: 'assessment-v1',
        },
        modelVersion: 'assessment-v1',
      },
      update: {
        executiveSummary: reportData.executiveSummary,
        feedback: reportData.feedback,
        tone: reportData.tone,
        keyInsights: reportData.keyInsights,
        phaseInsights: [...reportData.phaseInsights, ...missingLensInsights(participant.name || '')],
        wordCloudThemes: reportData.wordCloudThemes,
        modelVersion: 'assessment-v1',
      },
    });

    const pad = (s: string) => s.padEnd(28);
    console.log(`  ✅ ${pad(participant.name || '')} | ${reportData.tone}`);
    created++;
  }

  console.log(`\n✅ Done.`);
  console.log(`   ${created} reports created/updated`);
  if (skipped > 0) console.log(`   ${skipped} skipped (no session or no data)`);
  console.log('\n👉 Now regenerate the synthesis on the Jo Air discovery page.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
