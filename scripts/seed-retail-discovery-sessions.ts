/**
 * Seed 20 Discovery interview sessions for the retail demo workshop.
 * Creates WorkshopParticipants, ConversationSessions, DataPoints,
 * AgenticAnalysis, DataPointClassification, and ConversationInsights.
 *
 * These sessions feed into the Discover Analysis dashboard, allowing
 * the organisational analysis to be generated from real data.
 *
 * IMPORTANT: This script does NOT modify existing retail snapshot data.
 * It only ADDS new discovery session records.
 *
 * Usage: npx tsx scripts/seed-retail-discovery-sessions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WORKSHOP_ID = 'retail-cx-workshop';

// ══════════════════════════════════════════════════════════
// 20 PARTICIPANTS — diverse roles across 3 organisational layers
// ══════════════════════════════════════════════════════════

const PARTICIPANTS = [
  // EXECUTIVE LAYER (5)
  { id: 'disc-p01', name: 'Sarah Chen', email: 'sarah.chen@retailco.demo', role: 'Chief Customer Officer', department: 'Executive Leadership' },
  { id: 'disc-p02', name: 'James Wright', email: 'james.wright@retailco.demo', role: 'VP Technology', department: 'IT & Digital' },
  { id: 'disc-p03', name: 'Maria Lopez', email: 'maria.lopez@retailco.demo', role: 'Head of Stores', department: 'Retail Operations' },
  { id: 'disc-p04', name: 'Andrew Thornton', email: 'andrew.thornton@retailco.demo', role: 'Finance Director', department: 'Finance' },
  { id: 'disc-p05', name: 'Natasha Ivanova', email: 'natasha.ivanova@retailco.demo', role: 'Chief People Officer', department: 'Human Resources' },

  // OPERATIONAL LAYER (8)
  { id: 'disc-p06', name: 'David Kim', email: 'david.kim@retailco.demo', role: 'Operations Manager', department: 'Supply Chain' },
  { id: 'disc-p07', name: 'Emma Taylor', email: 'emma.taylor@retailco.demo', role: 'Marketing Lead', department: 'Marketing & Brand' },
  { id: 'disc-p08', name: 'Tom Richards', email: 'tom.richards@retailco.demo', role: 'Digital Analyst', department: 'E-commerce' },
  { id: 'disc-p09', name: 'Lisa Patel', email: 'lisa.patel@retailco.demo', role: 'Compliance Coordinator', department: 'Legal & Compliance' },
  { id: 'disc-p10', name: 'Ben Morrison', email: 'ben.morrison@retailco.demo', role: 'IT Project Manager', department: 'IT & Digital' },
  { id: 'disc-p11', name: 'Olivia Hart', email: 'olivia.hart@retailco.demo', role: 'CRM Manager', department: 'Marketing & Brand' },
  { id: 'disc-p12', name: 'Daniel Osei', email: 'daniel.osei@retailco.demo', role: 'Inventory Planner', department: 'Supply Chain' },
  { id: 'disc-p13', name: 'Rachel Green', email: 'rachel.green@retailco.demo', role: 'Training Coordinator', department: 'Human Resources' },

  // FRONTLINE LAYER (7)
  { id: 'disc-p14', name: "Ryan O'Brien", email: 'ryan.obrien@retailco.demo', role: 'Store Team Leader', department: 'Retail - Flagship' },
  { id: 'disc-p15', name: 'Amy Zhang', email: 'amy.zhang@retailco.demo', role: 'Customer Service Rep', department: 'Contact Centre' },
  { id: 'disc-p16', name: 'Chris Murphy', email: 'chris.murphy@retailco.demo', role: 'Stock Associate', department: 'Warehouse' },
  { id: 'disc-p17', name: 'Priya Sharma', email: 'priya.sharma@retailco.demo', role: 'Visual Merchandiser', department: 'Retail - Regional' },
  { id: 'disc-p18', name: 'Alex Turner', email: 'alex.turner@retailco.demo', role: 'Delivery Driver', department: 'Logistics' },
  { id: 'disc-p19', name: 'Jade Williams', email: 'jade.williams@retailco.demo', role: 'Sales Associate', department: 'Retail - High Street' },
  { id: 'disc-p20', name: 'Sam Fletcher', email: 'sam.fletcher@retailco.demo', role: 'Click & Collect Coordinator', department: 'Retail - Flagship' },
];

// ══════════════════════════════════════════════════════════
// DISCOVERY INTERVIEW RESPONSES — each participant has 8-12 data points
// ══════════════════════════════════════════════════════════

interface ResponseData {
  participantId: string;
  responses: Array<{
    questionKey: string;
    rawText: string;
    primaryType: string;
    sentiment: string;
    temporalFocus: string;
    confidence: number;
    domains: Array<{ domain: string; relevance: number; reasoning: string }>;
    themes: Array<{ label: string; category: string; confidence: number; reasoning: string }>;
    actors: Array<{ name: string; role: string; interactions: Array<{ withActor: string; action: string; sentiment: string; context: string }> }>;
    uncertainties: string[];
    speakerIntent: string;
    semanticMeaning: string;
    keywords: string[];
    insightType?: string;
    insightSeverity?: number;
  }>;
}

const INTERVIEW_DATA: ResponseData[] = [
  // ── P01: Sarah Chen (CCO) ──────────────────────────────
  {
    participantId: 'disc-p01',
    responses: [
      {
        questionKey: 'intro:context:0',
        rawText: 'We are fundamentally a customer-first organisation, but our systems and processes have not kept pace with customer expectations. The gap between what our customers experience with digital-native brands and what we deliver is widening every quarter.',
        primaryType: 'INSIGHT', sentiment: 'concerned', temporalFocus: 'present', confidence: 0.92,
        domains: [{ domain: 'Customer Experience', relevance: 0.95, reasoning: 'Core CX gap analysis' }],
        themes: [{ label: 'Customer Experience Gap', category: 'Constraint', confidence: 0.9, reasoning: 'Gap between expectation and delivery' }],
        actors: [{ name: 'Customer', role: 'End consumer', interactions: [{ withActor: 'Organisation', action: 'experiencing gap', sentiment: 'negative', context: 'Expectations vs delivery' }] }],
        uncertainties: [], speakerIntent: 'Diagnosing the core strategic challenge', semanticMeaning: 'Customer expectations outpacing organisational delivery capability',
        keywords: ['customer-first', 'digital-native', 'gap', 'expectations'],
      },
      {
        questionKey: 'customer:triple_rating:0',
        rawText: 'I would rate our current customer experience at about a 5 out of 10. We have pockets of excellence in flagship stores, but the online-to-store handoff is broken. Customers tell us they feel like they are dealing with two different companies.',
        primaryType: 'INSIGHT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.88,
        domains: [{ domain: 'Customer Experience', relevance: 0.95, reasoning: 'CX rating and pain points' }, { domain: 'Technology', relevance: 0.7, reasoning: 'Channel integration failure' }],
        themes: [{ label: 'Omnichannel Fragmentation', category: 'Constraint', confidence: 0.92, reasoning: 'Broken handoff between channels' }, { label: 'Customer Experience', category: 'Insight', confidence: 0.85, reasoning: 'Direct CX assessment' }],
        actors: [{ name: 'Customer', role: 'End consumer', interactions: [{ withActor: 'Store associate', action: 'feeling disconnected', sentiment: 'negative', context: 'Two-company experience' }] }],
        uncertainties: [], speakerIntent: 'Rating and diagnosing CX quality', semanticMeaning: 'CX is fragmented across channels, creating a disjointed customer experience',
        keywords: ['rating', 'omnichannel', 'broken', 'flagship', 'handoff'],
      },
      {
        questionKey: 'customer:target_score:0',
        rawText: 'Our target should be an 8.5. That means real-time personalisation, seamless channel transitions, and anticipatory service. I want customers to feel known, not surveilled. That is the critical distinction for us.',
        primaryType: 'VISIONARY', sentiment: 'positive', temporalFocus: 'future', confidence: 0.90,
        domains: [{ domain: 'Customer Experience', relevance: 0.95, reasoning: 'Target CX vision' }],
        themes: [{ label: 'Personalisation', category: 'Aspiration', confidence: 0.93, reasoning: 'Personalised but not intrusive' }, { label: 'Customer Trust', category: 'Aspiration', confidence: 0.8, reasoning: 'Known vs surveilled distinction' }],
        actors: [{ name: 'Customer', role: 'End consumer', interactions: [{ withActor: 'Organisation', action: 'feeling known', sentiment: 'positive', context: 'Aspirational CX' }] }],
        uncertainties: ['Whether real-time personalisation is technically achievable within 18 months'], speakerIntent: 'Articulating CX vision', semanticMeaning: 'Target is personalised, seamless CX that builds trust rather than surveillance',
        keywords: ['personalisation', 'seamless', 'anticipatory', 'known', 'trust'],
      },
      {
        questionKey: 'people:gaps:0',
        rawText: 'Our biggest people gap is in middle management. They are caught between our ambitious digital transformation agenda and the day-to-day reality of running stores. They need significantly more support and upskilling to bridge this gap effectively.',
        primaryType: 'CONSTRAINT', sentiment: 'concerned', temporalFocus: 'present', confidence: 0.91,
        domains: [{ domain: 'People & Culture', relevance: 0.95, reasoning: 'Workforce skill gap' }],
        themes: [{ label: 'Workforce Readiness', category: 'Constraint', confidence: 0.92, reasoning: 'Middle management skills gap' }, { label: 'Digital Transformation', category: 'Insight', confidence: 0.78, reasoning: 'Transformation creating pressure' }],
        actors: [{ name: 'Store manager', role: 'Store operations leader', interactions: [{ withActor: 'Head office', action: 'feeling unsupported', sentiment: 'negative', context: 'Gap between strategy and execution' }] }],
        uncertainties: [], speakerIntent: 'Identifying the workforce bottleneck', semanticMeaning: 'Middle management is the critical gap in digital transformation execution',
        keywords: ['middle-management', 'upskilling', 'digital-transformation', 'gap'], insightType: 'CONSTRAINT', insightSeverity: 8,
      },
      {
        questionKey: 'technology:gaps:0',
        rawText: 'We need a unified customer data platform urgently. Right now, marketing, stores, and e-commerce all have separate views of the customer. We cannot personalise effectively when we do not even have a single customer record.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.95,
        domains: [{ domain: 'Technology', relevance: 0.95, reasoning: 'Data platform gap' }, { domain: 'Customer Experience', relevance: 0.8, reasoning: 'Personalisation dependency' }],
        themes: [{ label: 'Data Strategy', category: 'Constraint', confidence: 0.95, reasoning: 'No unified customer view' }, { label: 'Legacy Systems', category: 'Constraint', confidence: 0.82, reasoning: 'Siloed data architecture' }],
        actors: [{ name: 'IT team', role: 'Technology and infrastructure', interactions: [{ withActor: 'Marketing team', action: 'unable to provide unified view', sentiment: 'negative', context: 'Data silos' }] }],
        uncertainties: [], speakerIntent: 'Identifying critical technology constraint', semanticMeaning: 'Siloed customer data prevents personalisation and cross-channel consistency',
        keywords: ['unified', 'customer-data-platform', 'siloed', 'personalisation'], insightType: 'CONSTRAINT', insightSeverity: 9,
      },
      {
        questionKey: 'prioritization:high_impact:0',
        rawText: 'If I had to pick one thing, it would be building that unified customer data foundation. Everything else — personalisation, omnichannel, loyalty evolution — is built on top of knowing our customer. Without that foundation, we are decorating a house with no floor.',
        primaryType: 'ACTION', sentiment: 'positive', temporalFocus: 'future', confidence: 0.93,
        domains: [{ domain: 'Technology', relevance: 0.9, reasoning: 'Data infrastructure priority' }, { domain: 'Customer Experience', relevance: 0.85, reasoning: 'CX transformation foundation' }],
        themes: [{ label: 'Data Strategy', category: 'Aspiration', confidence: 0.95, reasoning: 'Foundation for everything else' }],
        actors: [{ name: 'Customer', role: 'End consumer', interactions: [{ withActor: 'Organisation', action: 'needing to be known', sentiment: 'neutral', context: 'Data foundation' }] }],
        uncertainties: ['Budget approval timeline', 'Whether board will prioritise this over quick wins'], speakerIntent: 'Setting strategic priority', semanticMeaning: 'Unified customer data platform is the foundational priority for all CX improvements',
        keywords: ['priority', 'foundation', 'customer-data', 'unified'],
      },
    ],
  },

  // ── P02: James Wright (VP Tech) ────────────────────────
  {
    participantId: 'disc-p02',
    responses: [
      {
        questionKey: 'intro:context:0',
        rawText: 'Our technology landscape is honestly a mess. We have a 15-year-old POS system, a bolt-on e-commerce platform from 2018, and a CRM that nobody trusts. These systems do not talk to each other properly, and every integration is held together with custom middleware that only two people understand.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.95,
        domains: [{ domain: 'Technology', relevance: 0.98, reasoning: 'Legacy technology assessment' }],
        themes: [{ label: 'Legacy Systems', category: 'Constraint', confidence: 0.96, reasoning: 'Critical technical debt' }, { label: 'Integration Complexity', category: 'Constraint', confidence: 0.88, reasoning: 'Fragile middleware dependencies' }],
        actors: [{ name: 'IT team', role: 'Technology and infrastructure', interactions: [{ withActor: 'Head office', action: 'maintaining fragile systems', sentiment: 'negative', context: 'Technical debt burden' }] }],
        uncertainties: [], speakerIntent: 'Exposing technical reality', semanticMeaning: 'Technology estate is fragmented, outdated, and fragile — held together by tacit knowledge',
        keywords: ['legacy', 'POS', 'middleware', 'integration', 'technical-debt'], insightType: 'CONSTRAINT', insightSeverity: 9,
      },
      {
        questionKey: 'technology:triple_rating:0',
        rawText: 'Technology today is a 3 out of 10. The POS cannot even do real-time stock checks. Store colleagues have to phone the warehouse to confirm availability. Target should be an 8 — composable architecture, real-time data mesh, AI at the edge for personalisation.',
        primaryType: 'INSIGHT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.93,
        domains: [{ domain: 'Technology', relevance: 0.98, reasoning: 'Technology rating' }],
        themes: [{ label: 'Legacy Systems', category: 'Constraint', confidence: 0.95, reasoning: 'POS cannot do basic functions' }, { label: 'AI Adoption', category: 'Aspiration', confidence: 0.78, reasoning: 'AI at the edge vision' }],
        actors: [{ name: 'Store associate', role: 'Frontline retail staff', interactions: [{ withActor: 'Warehouse team', action: 'phoning to check stock', sentiment: 'negative', context: 'Systems inadequacy' }] }],
        uncertainties: ['Whether composable migration can be done incrementally'], speakerIntent: 'Rating technology and articulating target', semanticMeaning: 'Current technology is fundamentally inadequate, requiring architectural transformation',
        keywords: ['composable', 'data-mesh', 'POS', 'real-time', 'AI'],
      },
      {
        questionKey: 'technology:future:0',
        rawText: 'We should start with demand forecasting and inventory optimisation — high impact, lower risk, clear ROI. Then build toward customer-facing personalisation. Trying to do everything at once is how modernisation programmes fail. I have seen it three times.',
        primaryType: 'ACTION', sentiment: 'positive', temporalFocus: 'future', confidence: 0.90,
        domains: [{ domain: 'Technology', relevance: 0.9, reasoning: 'AI implementation strategy' }, { domain: 'Operations & Supply Chain', relevance: 0.75, reasoning: 'Demand forecasting use case' }],
        themes: [{ label: 'AI Adoption', category: 'Aspiration', confidence: 0.88, reasoning: 'Phased AI adoption approach' }],
        actors: [{ name: 'IT team', role: 'Technology and infrastructure', interactions: [{ withActor: 'Head office', action: 'recommending phased approach', sentiment: 'positive', context: 'Risk management' }] }],
        uncertainties: ['Whether leadership patience will hold for phased approach'], speakerIntent: 'Proposing phased technology strategy', semanticMeaning: 'AI adoption should follow a phased approach starting with back-office optimisation',
        keywords: ['phased', 'demand-forecasting', 'risk', 'ROI', 'incremental'],
      },
      {
        questionKey: 'corporate:barrier:0',
        rawText: 'The biggest barrier is that we have channel-siloed teams. Online and stores literally compete for the same customer. Their KPIs conflict. Until we restructure around customer journeys instead of channels, technology alone will not fix this.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.92,
        domains: [{ domain: 'Technology', relevance: 0.6, reasoning: 'Technology alone insufficient' }, { domain: 'Customer Experience', relevance: 0.85, reasoning: 'Customer journey fragmentation' }],
        themes: [{ label: 'Omnichannel Fragmentation', category: 'Constraint', confidence: 0.92, reasoning: 'Competing channel teams' }, { label: 'Organisational Structure', category: 'Constraint', confidence: 0.90, reasoning: 'Siloed org design' }],
        actors: [{ name: 'Head office', role: 'Corporate leadership', interactions: [{ withActor: 'Store manager', action: 'setting conflicting KPIs', sentiment: 'negative', context: 'Channel silos' }] }],
        uncertainties: [], speakerIntent: 'Identifying structural root cause', semanticMeaning: 'Organisational structure with competing channel silos is the root barrier, not technology',
        keywords: ['channel-silos', 'KPIs', 'restructure', 'customer-journey'], insightType: 'CONSTRAINT', insightSeverity: 8,
      },
    ],
  },

  // ── P03: Maria Lopez (Head of Stores) ──────────────────
  {
    participantId: 'disc-p03',
    responses: [
      {
        questionKey: 'intro:context:0',
        rawText: 'Stores are still our biggest asset. Seventy percent of revenue comes through physical retail. But my store managers are drowning in admin, and the systems we give them are embarrassingly slow. They spend more time fighting technology than serving customers.',
        primaryType: 'INSIGHT', sentiment: 'concerned', temporalFocus: 'present', confidence: 0.91,
        domains: [{ domain: 'People & Culture', relevance: 0.85, reasoning: 'Store manager burden' }, { domain: 'Technology', relevance: 0.8, reasoning: 'Systems slowing stores down' }],
        themes: [{ label: 'Workforce Readiness', category: 'Constraint', confidence: 0.85, reasoning: 'Admin burden on store managers' }, { label: 'Legacy Systems', category: 'Constraint', confidence: 0.82, reasoning: 'Slow systems impact on stores' }],
        actors: [{ name: 'Store manager', role: 'Store operations leader', interactions: [{ withActor: 'IT team', action: 'fighting technology', sentiment: 'negative', context: 'Systems inadequacy' }] }],
        uncertainties: [], speakerIntent: 'Advocating for store investment', semanticMeaning: 'Stores generate most revenue but are hampered by admin and slow technology',
        keywords: ['stores', 'admin', 'slow-systems', 'revenue', 'physical-retail'],
      },
      {
        questionKey: 'people:strengths:0',
        rawText: 'Our store teams are incredibly loyal and knowledgeable. Some of our longest-serving colleagues know customers by name. That human connection is something no algorithm can replicate. We need to free them from admin so they can do what they do best.',
        primaryType: 'ENABLER', sentiment: 'positive', temporalFocus: 'present', confidence: 0.88,
        domains: [{ domain: 'People & Culture', relevance: 0.95, reasoning: 'Workforce strengths' }, { domain: 'Customer Experience', relevance: 0.8, reasoning: 'Human connection value' }],
        themes: [{ label: 'Workforce Readiness', category: 'Insight', confidence: 0.82, reasoning: 'Experienced workforce is an asset' }, { label: 'Customer Experience', category: 'Insight', confidence: 0.78, reasoning: 'Human connection matters' }],
        actors: [{ name: 'Store associate', role: 'Frontline retail staff', interactions: [{ withActor: 'Customer', action: 'building personal relationships', sentiment: 'positive', context: 'Knowledge and loyalty' }] }],
        uncertainties: [], speakerIntent: 'Highlighting workforce value', semanticMeaning: 'Long-serving store colleagues have irreplaceable customer knowledge and should be freed from admin',
        keywords: ['loyal', 'knowledgeable', 'human-connection', 'admin-burden'],
      },
      {
        questionKey: 'people:gaps:0',
        rawText: 'I worry about retention. Experienced staff feel that technology is being imposed on them rather than designed with them. If we lose them, we lose decades of customer knowledge. Any transformation must bring them along, not push them aside.',
        primaryType: 'RISK', sentiment: 'concerned', temporalFocus: 'future', confidence: 0.87,
        domains: [{ domain: 'People & Culture', relevance: 0.95, reasoning: 'Retention risk' }],
        themes: [{ label: 'Workforce Readiness', category: 'Constraint', confidence: 0.90, reasoning: 'Technology imposition risk' }, { label: 'Cultural Resistance', category: 'Constraint', confidence: 0.82, reasoning: 'Staff feeling excluded from design' }],
        actors: [{ name: 'Store associate', role: 'Frontline retail staff', interactions: [{ withActor: 'Head office', action: 'feeling excluded from technology decisions', sentiment: 'negative', context: 'Transformation anxiety' }] }],
        uncertainties: ['How many experienced staff might leave in next 12 months'], speakerIntent: 'Flagging retention risk', semanticMeaning: 'Technology imposition without co-design risks losing experienced staff and their customer knowledge',
        keywords: ['retention', 'imposed', 'co-design', 'customer-knowledge'], insightType: 'CHALLENGE', insightSeverity: 7,
      },
    ],
  },

  // ── P04: Andrew Thornton (Finance Director) ────────────
  {
    participantId: 'disc-p04',
    responses: [
      {
        questionKey: 'intro:context:0',
        rawText: 'From a financial perspective, we need to see returns within 18 months for any major investment. The board is supportive of transformation but not of open-ended budgets. Every pound spent on technology modernisation is a pound not spent on store refurbishment or marketing.',
        primaryType: 'CONSTRAINT', sentiment: 'neutral', temporalFocus: 'present', confidence: 0.90,
        domains: [{ domain: 'Customer Experience', relevance: 0.5, reasoning: 'Competing investment priorities' }, { domain: 'Technology', relevance: 0.7, reasoning: 'Budget constraint on tech investment' }],
        themes: [{ label: 'Budget Constraints', category: 'Constraint', confidence: 0.95, reasoning: 'ROI timeline pressure' }],
        actors: [{ name: 'Head office', role: 'Corporate leadership', interactions: [{ withActor: 'Finance team', action: 'demanding ROI', sentiment: 'neutral', context: 'Board expectations' }] }],
        uncertainties: ['Whether 18-month ROI is realistic for platform migration'], speakerIntent: 'Setting financial boundaries', semanticMeaning: 'Board demands clear ROI within 18 months, creating tension with transformation timelines',
        keywords: ['ROI', '18-months', 'budget', 'investment', 'board'], insightType: 'CONSTRAINT', insightSeverity: 7,
      },
      {
        questionKey: 'corporate:barrier:0',
        rawText: 'Decision-making speed is a real problem. A proposal goes through four layers of approval before it can be actioned. By the time we approve a promotional campaign response, the competitor has already won the customer. Our governance model was built for a different era.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.88,
        domains: [{ domain: 'Customer Experience', relevance: 0.65, reasoning: 'Speed-to-market impact' }],
        themes: [{ label: 'Decision Speed', category: 'Constraint', confidence: 0.90, reasoning: 'Approval layers slow everything' }, { label: 'Organisational Structure', category: 'Constraint', confidence: 0.82, reasoning: 'Governance model outdated' }],
        actors: [{ name: 'Head office', role: 'Corporate leadership', interactions: [{ withActor: 'Marketing team', action: 'delaying campaign approvals', sentiment: 'negative', context: 'Governance bottleneck' }] }],
        uncertainties: [], speakerIntent: 'Exposing governance inefficiency', semanticMeaning: 'Multi-layer governance model slows decision-making to the point of competitive disadvantage',
        keywords: ['decision-speed', 'approval-layers', 'governance', 'slow'], insightType: 'CONSTRAINT', insightSeverity: 7,
      },
    ],
  },

  // ── P05: Natasha Ivanova (CPO) ─────────────────────────
  {
    participantId: 'disc-p05',
    responses: [
      {
        questionKey: 'people:triple_rating:0',
        rawText: 'People readiness is about a 4 out of 10 for digital transformation. We have great people, but the skills mix is wrong. We are heavily weighted toward traditional retail skills and light on data literacy, digital tools, and change management. The gap is widest in middle management.',
        primaryType: 'INSIGHT', sentiment: 'concerned', temporalFocus: 'present', confidence: 0.90,
        domains: [{ domain: 'People & Culture', relevance: 0.98, reasoning: 'Workforce readiness assessment' }],
        themes: [{ label: 'Workforce Readiness', category: 'Constraint', confidence: 0.94, reasoning: 'Skills mix misalignment' }, { label: 'Digital Transformation', category: 'Insight', confidence: 0.80, reasoning: 'Transformation readiness' }],
        actors: [{ name: 'HR team', role: 'People and culture', interactions: [{ withActor: 'Store manager', action: 'assessing skills gap', sentiment: 'neutral', context: 'Skills audit findings' }] }],
        uncertainties: ['Whether external hiring or internal upskilling is more viable'], speakerIntent: 'Diagnosing workforce readiness', semanticMeaning: 'Workforce is strong in traditional retail but critically lacking in digital and data skills, especially at middle management',
        keywords: ['skills-gap', 'data-literacy', 'middle-management', 'readiness'], insightType: 'CHALLENGE', insightSeverity: 8,
      },
      {
        questionKey: 'people:future:0',
        rawText: 'We need a structured upskilling programme that runs in parallel with the technology transformation. Not a one-off training day — a 12-month journey with coaching, peer support, and real project exposure. And it must start with middle managers because they are the transformation multipliers.',
        primaryType: 'ACTION', sentiment: 'positive', temporalFocus: 'future', confidence: 0.88,
        domains: [{ domain: 'People & Culture', relevance: 0.95, reasoning: 'Upskilling programme design' }],
        themes: [{ label: 'Workforce Readiness', category: 'Aspiration', confidence: 0.90, reasoning: 'Structured development programme' }],
        actors: [{ name: 'HR team', role: 'People and culture', interactions: [{ withActor: 'Store manager', action: 'designing upskilling programme', sentiment: 'positive', context: 'Transformation enablement' }] }],
        uncertainties: ['Budget allocation for 12-month programme', 'Whether middle managers have capacity for training alongside operational duties'], speakerIntent: 'Proposing people development strategy', semanticMeaning: 'Sustained 12-month upskilling programme focused on middle management as transformation multipliers',
        keywords: ['upskilling', 'coaching', '12-month', 'middle-managers'],
      },
    ],
  },

  // ── P06: David Kim (Operations Manager) ────────────────
  {
    participantId: 'disc-p06',
    responses: [
      {
        questionKey: 'intro:context:0',
        rawText: 'Supply chain visibility is our Achilles heel. We have reasonable forecast accuracy at a national level but terrible store-level accuracy. Stock is often in the wrong place at the wrong time. Customers see items online but they are not available in their nearest store.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.91,
        domains: [{ domain: 'Operations & Supply Chain', relevance: 0.95, reasoning: 'Supply chain visibility gap' }, { domain: 'Customer Experience', relevance: 0.75, reasoning: 'Stock availability impacts CX' }],
        themes: [{ label: 'Omnichannel Fragmentation', category: 'Constraint', confidence: 0.88, reasoning: 'Stock availability mismatch across channels' }, { label: 'Data Strategy', category: 'Constraint', confidence: 0.72, reasoning: 'Store-level forecast inaccuracy' }],
        actors: [{ name: 'Warehouse team', role: 'Fulfilment and logistics', interactions: [{ withActor: 'Store associate', action: 'sending wrong stock allocation', sentiment: 'negative', context: 'Forecast inaccuracy' }] }],
        uncertainties: [], speakerIntent: 'Diagnosing supply chain weakness', semanticMeaning: 'Store-level inventory forecasting is poor, causing stock availability mismatches across channels',
        keywords: ['supply-chain', 'visibility', 'stock', 'forecast', 'store-level'], insightType: 'CONSTRAINT', insightSeverity: 8,
      },
      {
        questionKey: 'corporate:working:0',
        rawText: 'The approval chain kills us. Getting a promotional display change approved takes three weeks. In fast fashion, that is an eternity. Our competitors respond in days. We need to decentralise decision-making for operational matters while keeping strategic governance.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.89,
        domains: [{ domain: 'Operations & Supply Chain', relevance: 0.85, reasoning: 'Operational agility constraint' }],
        themes: [{ label: 'Decision Speed', category: 'Constraint', confidence: 0.92, reasoning: 'Approval chain too slow' }, { label: 'Organisational Structure', category: 'Insight', confidence: 0.78, reasoning: 'Need to decentralise' }],
        actors: [{ name: 'Store manager', role: 'Store operations leader', interactions: [{ withActor: 'Head office', action: 'waiting for approval', sentiment: 'negative', context: 'Promotional decisions' }] }],
        uncertainties: [], speakerIntent: 'Advocating for operational empowerment', semanticMeaning: 'Centralised approval processes are too slow for operational responsiveness — need selective decentralisation',
        keywords: ['approval-chain', 'decentralise', 'agility', 'governance'], insightType: 'CONSTRAINT', insightSeverity: 7,
      },
    ],
  },

  // ── P07: Emma Taylor (Marketing Lead) ──────────────────
  {
    participantId: 'disc-p07',
    responses: [
      {
        questionKey: 'customer:gaps:0',
        rawText: 'We are still doing batch segmentation from last month\'s data. Our competitors are doing real-time personalisation. A customer browses winter coats online at 9am, and we send them a summer dress email at noon. It is embarrassing. We need predictive engagement, not reactive campaigns.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.92,
        domains: [{ domain: 'Customer Experience', relevance: 0.9, reasoning: 'Personalisation gap' }, { domain: 'Technology', relevance: 0.85, reasoning: 'Data latency issue' }],
        themes: [{ label: 'Personalisation', category: 'Constraint', confidence: 0.94, reasoning: 'Batch vs real-time gap' }, { label: 'Data Strategy', category: 'Constraint', confidence: 0.85, reasoning: 'Data freshness inadequate' }],
        actors: [{ name: 'Marketing team', role: 'Brand and campaigns', interactions: [{ withActor: 'Customer', action: 'sending irrelevant communications', sentiment: 'negative', context: 'Stale data' }] }],
        uncertainties: [], speakerIntent: 'Exposing personalisation inadequacy', semanticMeaning: 'Marketing operates on stale batch data, creating embarrassingly irrelevant customer communications',
        keywords: ['personalisation', 'real-time', 'batch', 'segmentation', 'predictive'],
      },
      {
        questionKey: 'customer:future:0',
        rawText: 'The loyalty programme needs to evolve beyond points. Customers want recognition, early access, personalised recommendations. They want to feel valued as individuals, not as transaction records. We need to move from rewards to relationships.',
        primaryType: 'VISIONARY', sentiment: 'positive', temporalFocus: 'future', confidence: 0.87,
        domains: [{ domain: 'Customer Experience', relevance: 0.95, reasoning: 'Loyalty evolution vision' }],
        themes: [{ label: 'Customer Trust', category: 'Aspiration', confidence: 0.85, reasoning: 'Relationship over transaction' }, { label: 'Personalisation', category: 'Aspiration', confidence: 0.82, reasoning: 'Individual recognition' }],
        actors: [{ name: 'Customer', role: 'End consumer', interactions: [{ withActor: 'Marketing team', action: 'wanting individual recognition', sentiment: 'positive', context: 'Loyalty evolution' }] }],
        uncertainties: ['Whether customers will share enough data for true personalisation'], speakerIntent: 'Articulating loyalty vision', semanticMeaning: 'Loyalty must evolve from transactional points to genuine relationship-based recognition and personalisation',
        keywords: ['loyalty', 'recognition', 'relationships', 'personalisation'],
      },
    ],
  },

  // ── P08: Tom Richards (Digital Analyst) ─────────────────
  {
    participantId: 'disc-p08',
    responses: [
      {
        questionKey: 'technology:gaps:0',
        rawText: 'Our analytics capability is surprisingly good in e-commerce but almost non-existent in stores. We have detailed click-stream data online but cannot even tell you foot traffic patterns by department in physical stores. This blind spot makes omnichannel attribution impossible.',
        primaryType: 'INSIGHT', sentiment: 'neutral', temporalFocus: 'present', confidence: 0.88,
        domains: [{ domain: 'Technology', relevance: 0.9, reasoning: 'Analytics gap between channels' }, { domain: 'Customer Experience', relevance: 0.7, reasoning: 'Attribution impossible' }],
        themes: [{ label: 'Data Strategy', category: 'Constraint', confidence: 0.88, reasoning: 'Store analytics blind spot' }, { label: 'Omnichannel Fragmentation', category: 'Constraint', confidence: 0.80, reasoning: 'Cannot attribute across channels' }],
        actors: [{ name: 'IT team', role: 'Technology and infrastructure', interactions: [{ withActor: 'Store manager', action: 'lacking in-store analytics tools', sentiment: 'negative', context: 'Data blind spot' }] }],
        uncertainties: ['Cost of in-store analytics infrastructure'], speakerIntent: 'Identifying data gap', semanticMeaning: 'Strong online analytics but zero in-store analytics creates an omnichannel blind spot',
        keywords: ['analytics', 'click-stream', 'foot-traffic', 'attribution', 'blind-spot'],
      },
      {
        questionKey: 'technology:future:0',
        rawText: 'We should be using AI for demand sensing, not just forecasting. Combine weather data, social signals, local events, and real-time basket analysis to predict what each store needs. The technology exists. We just need the data infrastructure and the organisational will to use it.',
        primaryType: 'VISIONARY', sentiment: 'positive', temporalFocus: 'future', confidence: 0.85,
        domains: [{ domain: 'Technology', relevance: 0.95, reasoning: 'AI demand sensing vision' }, { domain: 'Operations & Supply Chain', relevance: 0.8, reasoning: 'Inventory optimisation' }],
        themes: [{ label: 'AI Adoption', category: 'Aspiration', confidence: 0.90, reasoning: 'AI-driven demand sensing' }, { label: 'Data Strategy', category: 'Aspiration', confidence: 0.82, reasoning: 'Multi-source data integration' }],
        actors: [{ name: 'IT team', role: 'Technology and infrastructure', interactions: [{ withActor: 'Head office', action: 'proposing AI investment', sentiment: 'positive', context: 'Demand sensing capability' }] }],
        uncertainties: ['Whether organisational will exists to invest', 'Data quality across sources'], speakerIntent: 'Painting AI-driven future', semanticMeaning: 'AI demand sensing combining multiple data sources could revolutionise store-level inventory',
        keywords: ['AI', 'demand-sensing', 'weather', 'social', 'real-time'],
      },
    ],
  },

  // ── P09: Lisa Patel (Compliance Coordinator) ───────────
  {
    participantId: 'disc-p09',
    responses: [
      {
        questionKey: 'regulation:constraint:0',
        rawText: 'We have significant GDPR compliance gaps in our marketing automation. The opt-in mechanisms are not transparent enough, and I am concerned that our data sharing between loyalty, marketing, and the CRM may not have proper consent chains. A regulator audit would be uncomfortable.',
        primaryType: 'CONSTRAINT', sentiment: 'concerned', temporalFocus: 'present', confidence: 0.92,
        domains: [{ domain: 'Regulation & Compliance', relevance: 0.98, reasoning: 'GDPR compliance gap' }, { domain: 'Customer Experience', relevance: 0.6, reasoning: 'Consent impacts personalisation' }],
        themes: [{ label: 'Compliance', category: 'Constraint', confidence: 0.95, reasoning: 'GDPR gaps in marketing automation' }, { label: 'Data Strategy', category: 'Constraint', confidence: 0.78, reasoning: 'Consent chain unclear' }],
        actors: [{ name: 'Legal & compliance', role: 'Regulatory oversight', interactions: [{ withActor: 'Marketing team', action: 'flagging consent gaps', sentiment: 'negative', context: 'GDPR non-compliance risk' }] }],
        uncertainties: [], speakerIntent: 'Flagging compliance risk', semanticMeaning: 'Marketing automation has GDPR gaps in opt-in transparency and cross-system consent chains',
        keywords: ['GDPR', 'consent', 'opt-in', 'compliance', 'audit'], insightType: 'CONSTRAINT', insightSeverity: 8,
      },
      {
        questionKey: 'regulation:future:0',
        rawText: 'Any move to AI-driven personalisation must be privacy-by-design from day one. We cannot retrofit compliance. If we build the customer data platform right, with proper consent management and data governance, then personalisation and compliance coexist. If we rush it, we risk massive fines.',
        primaryType: 'ENABLER', sentiment: 'neutral', temporalFocus: 'future', confidence: 0.90,
        domains: [{ domain: 'Regulation & Compliance', relevance: 0.95, reasoning: 'Privacy-by-design principle' }, { domain: 'Technology', relevance: 0.75, reasoning: 'CDP compliance architecture' }],
        themes: [{ label: 'Compliance', category: 'Aspiration', confidence: 0.88, reasoning: 'Privacy-by-design approach' }, { label: 'Data Strategy', category: 'Aspiration', confidence: 0.80, reasoning: 'Consent management foundation' }],
        actors: [{ name: 'Legal & compliance', role: 'Regulatory oversight', interactions: [{ withActor: 'IT team', action: 'advising on privacy architecture', sentiment: 'positive', context: 'Privacy-by-design' }] }],
        uncertainties: ['Whether AI Act regulations will add further constraints'], speakerIntent: 'Setting compliance requirements for technology', semanticMeaning: 'AI personalisation must be built with privacy-by-design from inception, not retrofitted',
        keywords: ['privacy-by-design', 'consent-management', 'governance', 'fines'],
      },
    ],
  },

  // ── P10: Ben Morrison (IT PM) ──────────────────────────
  {
    participantId: 'disc-p10',
    responses: [
      {
        questionKey: 'technology:barrier:0',
        rawText: 'Every integration project takes three times longer than planned because nobody has documented how the existing systems actually connect. We discovered middleware components last year that were written by a contractor who left five years ago. The institutional knowledge loss is severe.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.89,
        domains: [{ domain: 'Technology', relevance: 0.95, reasoning: 'Integration complexity and knowledge gaps' }],
        themes: [{ label: 'Legacy Systems', category: 'Constraint', confidence: 0.92, reasoning: 'Undocumented integrations' }, { label: 'Integration Complexity', category: 'Constraint', confidence: 0.88, reasoning: 'Hidden dependencies' }],
        actors: [{ name: 'IT team', role: 'Technology and infrastructure', interactions: [{ withActor: 'Third-party partner', action: 'lost knowledge from departed contractor', sentiment: 'negative', context: 'Documentation gaps' }] }],
        uncertainties: [], speakerIntent: 'Exposing hidden technical risk', semanticMeaning: 'Integration projects are severely impacted by undocumented legacy connections and knowledge loss',
        keywords: ['integration', 'documentation', 'middleware', 'knowledge-loss', 'contractor'],
      },
    ],
  },

  // ── P11: Olivia Hart (CRM Manager) ─────────────────────
  {
    participantId: 'disc-p11',
    responses: [
      {
        questionKey: 'customer:pain_points:0',
        rawText: 'Our CRM has 2.3 million records but we estimate at least 30 percent are duplicates or stale. Marketing sends emails to addresses that bounced six months ago. Loyalty members have multiple accounts because systems could not match them. The data quality problem is massive.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.91,
        domains: [{ domain: 'Technology', relevance: 0.85, reasoning: 'CRM data quality' }, { domain: 'Customer Experience', relevance: 0.8, reasoning: 'Customer identity fragmentation' }],
        themes: [{ label: 'Data Strategy', category: 'Constraint', confidence: 0.95, reasoning: 'Data quality crisis' }, { label: 'Legacy Systems', category: 'Constraint', confidence: 0.78, reasoning: 'CRM matching failures' }],
        actors: [{ name: 'Marketing team', role: 'Brand and campaigns', interactions: [{ withActor: 'Customer', action: 'sending to stale addresses', sentiment: 'negative', context: 'Data quality failure' }] }],
        uncertainties: ['True deduplication cost and timeline'], speakerIntent: 'Quantifying data quality problem', semanticMeaning: 'CRM data has massive quality issues with ~30% duplicates/stale records undermining all customer efforts',
        keywords: ['CRM', 'duplicates', 'data-quality', 'stale', 'matching'], insightType: 'CONSTRAINT', insightSeverity: 8,
      },
    ],
  },

  // ── P12: Daniel Osei (Inventory Planner) ───────────────
  {
    participantId: 'disc-p12',
    responses: [
      {
        questionKey: 'corporate:working:0',
        rawText: 'We do not have real-time inventory visibility. The stock system updates overnight. So when a customer checks availability online at 2pm, they are looking at stock levels from midnight. By the time they arrive at the store, the item might be sold. This generates huge numbers of complaints.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.93,
        domains: [{ domain: 'Operations & Supply Chain', relevance: 0.95, reasoning: 'Inventory visibility gap' }, { domain: 'Customer Experience', relevance: 0.85, reasoning: 'False availability driving complaints' }],
        themes: [{ label: 'Omnichannel Fragmentation', category: 'Constraint', confidence: 0.92, reasoning: 'Non-real-time stock updates' }, { label: 'Legacy Systems', category: 'Constraint', confidence: 0.85, reasoning: 'Overnight batch system' }],
        actors: [{ name: 'Customer', role: 'End consumer', interactions: [{ withActor: 'Store associate', action: 'complaining about false availability', sentiment: 'negative', context: 'Stock data latency' }] }],
        uncertainties: [], speakerIntent: 'Exposing inventory visibility failure', semanticMeaning: 'Overnight batch stock updates create false availability information that drives customer complaints',
        keywords: ['inventory', 'real-time', 'overnight', 'availability', 'complaints'], insightType: 'CONSTRAINT', insightSeverity: 8,
      },
    ],
  },

  // ── P13: Rachel Green (Training Coordinator) ───────────
  {
    participantId: 'disc-p13',
    responses: [
      {
        questionKey: 'people:support:0',
        rawText: 'Training budgets have been cut three years running. We are now down to one day of digital skills training per colleague per year. That is simply not enough for the scale of transformation being discussed. And most of that training is generic videos, not hands-on learning.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.90,
        domains: [{ domain: 'People & Culture', relevance: 0.95, reasoning: 'Training budget inadequacy' }],
        themes: [{ label: 'Workforce Readiness', category: 'Constraint', confidence: 0.92, reasoning: 'Training investment insufficient' }, { label: 'Budget Constraints', category: 'Constraint', confidence: 0.82, reasoning: 'Three years of budget cuts' }],
        actors: [{ name: 'HR team', role: 'People and culture', interactions: [{ withActor: 'Finance team', action: 'having budget cut', sentiment: 'negative', context: 'Training deprioritised' }] }],
        uncertainties: [], speakerIntent: 'Flagging training investment gap', semanticMeaning: 'Training investment has been slashed to inadequate levels for the transformation ambition',
        keywords: ['training', 'budget-cuts', 'digital-skills', 'generic', 'insufficient'], insightType: 'CONSTRAINT', insightSeverity: 7,
      },
    ],
  },

  // ── P14: Ryan O'Brien (Store Team Leader) ──────────────
  {
    participantId: 'disc-p14',
    responses: [
      {
        questionKey: 'intro:context:0',
        rawText: 'Customers come in expecting us to know their online browsing history, their past purchases, what is in their basket. We have none of that information. I just smile and try to help. It makes us look incompetent when actually the systems are the problem, not the people.',
        primaryType: 'INSIGHT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.88,
        domains: [{ domain: 'Customer Experience', relevance: 0.95, reasoning: 'Store-online disconnect from frontline perspective' }, { domain: 'Technology', relevance: 0.8, reasoning: 'Systems not providing needed data' }],
        themes: [{ label: 'Omnichannel Fragmentation', category: 'Constraint', confidence: 0.92, reasoning: 'Store staff have no customer context' }, { label: 'Customer Experience', category: 'Insight', confidence: 0.85, reasoning: 'Systems failure looks like people failure' }],
        actors: [{ name: 'Store associate', role: 'Frontline retail staff', interactions: [{ withActor: 'Customer', action: 'appearing incompetent due to system gaps', sentiment: 'negative', context: 'No access to customer data' }] }],
        uncertainties: [], speakerIntent: 'Expressing frontline frustration', semanticMeaning: 'Store staff are embarrassed by their inability to access customer data that customers assume they have',
        keywords: ['browsing-history', 'incompetent', 'systems-problem', 'expectations'],
      },
      {
        questionKey: 'people:friction:0',
        rawText: 'Nobody asks the people who actually serve customers what tools we need. Decisions get made in head office and we get told to adopt them. Half the time the tools slow us down or do not match how customers actually shop. We need to be part of the design process.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.90,
        domains: [{ domain: 'People & Culture', relevance: 0.90, reasoning: 'Frontline exclusion from design' }],
        themes: [{ label: 'Cultural Resistance', category: 'Constraint', confidence: 0.90, reasoning: 'Top-down tool imposition' }, { label: 'Workforce Readiness', category: 'Constraint', confidence: 0.80, reasoning: 'Tools not fit for purpose' }],
        actors: [{ name: 'Store associate', role: 'Frontline retail staff', interactions: [{ withActor: 'Head office', action: 'feeling excluded from decisions', sentiment: 'negative', context: 'Top-down imposition' }] }],
        uncertainties: [], speakerIntent: 'Demanding frontline inclusion', semanticMeaning: 'Frontline staff are excluded from technology design decisions, leading to tools that do not match real customer interaction patterns',
        keywords: ['co-design', 'head-office', 'impose', 'frontline', 'adopt'], insightType: 'CHALLENGE', insightSeverity: 7,
      },
    ],
  },

  // ── P15: Amy Zhang (Customer Service Rep) ──────────────
  {
    participantId: 'disc-p15',
    responses: [
      {
        questionKey: 'customer:pain_points:0',
        rawText: 'The number one complaint we get is about inconsistent pricing between online and in-store. Customers screenshot online prices and demand the same in store. Sometimes the store price is actually higher. It destroys trust instantly.',
        primaryType: 'INSIGHT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.92,
        domains: [{ domain: 'Customer Experience', relevance: 0.95, reasoning: 'Pricing inconsistency pain point' }],
        themes: [{ label: 'Omnichannel Fragmentation', category: 'Constraint', confidence: 0.90, reasoning: 'Channel pricing inconsistency' }, { label: 'Customer Trust', category: 'Constraint', confidence: 0.85, reasoning: 'Trust destruction' }],
        actors: [{ name: 'Customer', role: 'End consumer', interactions: [{ withActor: 'Store associate', action: 'demanding price matching', sentiment: 'negative', context: 'Pricing inconsistency' }] }],
        uncertainties: [], speakerIntent: 'Reporting top customer complaint', semanticMeaning: 'Pricing inconsistency between channels is the number one customer complaint and actively destroys trust',
        keywords: ['pricing', 'inconsistent', 'screenshot', 'trust', 'complaint'],
      },
      {
        questionKey: 'customer:friction:0',
        rawText: 'Returns are a nightmare. If a customer bought something online, they cannot easily return it in store because the systems do not connect. We have to call a separate team, wait on hold, and manually process it. The customer stands there for 15 minutes getting increasingly angry.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.91,
        domains: [{ domain: 'Customer Experience', relevance: 0.95, reasoning: 'Cross-channel returns failure' }, { domain: 'Technology', relevance: 0.8, reasoning: 'Systems disconnect' }],
        themes: [{ label: 'Omnichannel Fragmentation', category: 'Constraint', confidence: 0.95, reasoning: 'Returns not connected across channels' }],
        actors: [{ name: 'Contact centre agent', role: 'Customer service representative', interactions: [{ withActor: 'Store associate', action: 'manual processing delay', sentiment: 'negative', context: 'Cross-channel returns' }] }],
        uncertainties: [], speakerIntent: 'Describing broken returns process', semanticMeaning: 'Cross-channel returns require manual workarounds due to disconnected systems, creating terrible customer experience',
        keywords: ['returns', 'manual', 'disconnected', 'angry', '15-minutes'],
      },
    ],
  },

  // ── P16: Chris Murphy (Stock Associate) ────────────────
  {
    participantId: 'disc-p16',
    responses: [
      {
        questionKey: 'corporate:working:0',
        rawText: 'Click and collect is supposed to be ready in two hours. In reality, we struggle with four. The picking system sends us on a treasure hunt around the warehouse because the location data is wrong half the time. Then we have to recount because the system count never matches reality.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.90,
        domains: [{ domain: 'Operations & Supply Chain', relevance: 0.95, reasoning: 'Fulfilment process failure' }, { domain: 'Technology', relevance: 0.8, reasoning: 'Location data inaccuracy' }],
        themes: [{ label: 'Legacy Systems', category: 'Constraint', confidence: 0.88, reasoning: 'Inaccurate location data' }, { label: 'Omnichannel Fragmentation', category: 'Constraint', confidence: 0.80, reasoning: 'Click-collect promise gap' }],
        actors: [{ name: 'Warehouse team', role: 'Fulfilment and logistics', interactions: [{ withActor: 'Customer', action: 'failing SLA promise', sentiment: 'negative', context: 'Click and collect delay' }] }],
        uncertainties: [], speakerIntent: 'Exposing fulfilment reality', semanticMeaning: 'Click-and-collect consistently fails its SLA due to inaccurate warehouse location data and system-reality mismatches',
        keywords: ['click-collect', 'picking', 'location-data', 'SLA', 'recount'],
      },
    ],
  },

  // ── P17: Priya Sharma (Visual Merchandiser) ────────────
  {
    participantId: 'disc-p17',
    responses: [
      {
        questionKey: 'people:friction:0',
        rawText: 'I spend more time filling out compliance forms and health-and-safety checklists than actually merchandising. The paperwork has doubled in three years. If they gave us a simple app instead of these paper forms, I could reclaim two hours a day for customer-facing work.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.87,
        domains: [{ domain: 'People & Culture', relevance: 0.85, reasoning: 'Admin burden on frontline' }, { domain: 'Technology', relevance: 0.7, reasoning: 'Paper-based processes' }],
        themes: [{ label: 'Workforce Readiness', category: 'Constraint', confidence: 0.82, reasoning: 'Admin burden stealing productive time' }, { label: 'Legacy Systems', category: 'Constraint', confidence: 0.75, reasoning: 'Paper-based instead of digital' }],
        actors: [{ name: 'Store associate', role: 'Frontline retail staff', interactions: [{ withActor: 'Head office', action: 'burdened with compliance paperwork', sentiment: 'negative', context: 'Admin overload' }] }],
        uncertainties: [], speakerIntent: 'Quantifying admin burden', semanticMeaning: 'Paper-based compliance processes consume two hours daily that could be spent on customer-facing merchandising work',
        keywords: ['compliance-forms', 'paperwork', 'app', 'admin-burden', 'reclaim'],
      },
    ],
  },

  // ── P18: Alex Turner (Delivery Driver) ─────────────────
  {
    participantId: 'disc-p18',
    responses: [
      {
        questionKey: 'customer:friction:0',
        rawText: 'The delivery routing system is from the dark ages. It does not factor in real-time traffic, road works, or customer preferred time slots properly. I sometimes arrive at a customer\'s address outside their slot and they have gone to work. Then I get blamed for a failed delivery.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.88,
        domains: [{ domain: 'Operations & Supply Chain', relevance: 0.9, reasoning: 'Delivery routing inadequacy' }, { domain: 'Customer Experience', relevance: 0.85, reasoning: 'Failed deliveries' }, { domain: 'Technology', relevance: 0.75, reasoning: 'Legacy routing system' }],
        themes: [{ label: 'Legacy Systems', category: 'Constraint', confidence: 0.85, reasoning: 'Routing system outdated' }, { label: 'Customer Experience', category: 'Constraint', confidence: 0.80, reasoning: 'Failed deliveries' }],
        actors: [{ name: 'Delivery driver', role: 'Last-mile logistics', interactions: [{ withActor: 'Customer', action: 'arriving outside slot', sentiment: 'negative', context: 'Routing failure' }] }],
        uncertainties: [], speakerIntent: 'Describing delivery system inadequacy', semanticMeaning: 'Legacy delivery routing fails to factor real-time conditions, causing failed deliveries and driver blame',
        keywords: ['routing', 'traffic', 'time-slots', 'failed-delivery', 'blamed'],
      },
    ],
  },

  // ── P19: Jade Williams (Sales Associate) ───────────────
  {
    participantId: 'disc-p19',
    responses: [
      {
        questionKey: 'people:support:0',
        rawText: 'I am actually quite excited about the idea of AI tools. If it can tell me what a customer might be looking for based on their history, that would be amazing. But please make it simple. The last three apps they gave us were so complicated that nobody uses them. They just sit on the tablet collecting dust.',
        primaryType: 'ENABLER', sentiment: 'positive', temporalFocus: 'future', confidence: 0.85,
        domains: [{ domain: 'Technology', relevance: 0.8, reasoning: 'AI tool adoption potential' }, { domain: 'People & Culture', relevance: 0.75, reasoning: 'Tool usability requirement' }],
        themes: [{ label: 'AI Adoption', category: 'Aspiration', confidence: 0.85, reasoning: 'Frontline enthusiasm for useful AI' }, { label: 'Workforce Readiness', category: 'Insight', confidence: 0.78, reasoning: 'Simplicity requirement for adoption' }],
        actors: [{ name: 'Store associate', role: 'Frontline retail staff', interactions: [{ withActor: 'IT team', action: 'wanting simple AI tools', sentiment: 'positive', context: 'AI enthusiasm with usability caveat' }] }],
        uncertainties: ['Whether AI tools will actually be simple enough'], speakerIntent: 'Expressing conditional enthusiasm for AI', semanticMeaning: 'Frontline staff are open to AI-powered customer tools but only if they are dramatically simpler than previous technology rollouts',
        keywords: ['AI', 'simple', 'history', 'complicated', 'tablet'],
      },
    ],
  },

  // ── P20: Sam Fletcher (Click & Collect Coordinator) ────
  {
    participantId: 'disc-p20',
    responses: [
      {
        questionKey: 'corporate:barrier:0',
        rawText: 'Click and collect was supposed to be our omnichannel showpiece, but it has become a pain point. The online team sets the SLA, the store team has to deliver it, and nobody talked to each other when designing the process. Now customers are angry and the store team feels set up to fail.',
        primaryType: 'CONSTRAINT', sentiment: 'critical', temporalFocus: 'present', confidence: 0.91,
        domains: [{ domain: 'Customer Experience', relevance: 0.9, reasoning: 'CX promise gap' }, { domain: 'Operations & Supply Chain', relevance: 0.85, reasoning: 'Process design failure' }],
        themes: [{ label: 'Omnichannel Fragmentation', category: 'Constraint', confidence: 0.94, reasoning: 'Cross-team process failure' }, { label: 'Organisational Structure', category: 'Constraint', confidence: 0.85, reasoning: 'Silos in process design' }],
        actors: [{ name: 'Store associate', role: 'Frontline retail staff', interactions: [{ withActor: 'Head office', action: 'set up to fail on SLAs', sentiment: 'negative', context: 'Click-collect process design failure' }] }],
        uncertainties: [], speakerIntent: 'Diagnosing cross-functional failure', semanticMeaning: 'Click-and-collect failed because online and store teams designed the process in isolation, creating undeliverable SLAs',
        keywords: ['click-collect', 'SLA', 'silos', 'pain-point', 'set-up-to-fail'], insightType: 'CHALLENGE', insightSeverity: 7,
      },
    ],
  },
];


// ══════════════════════════════════════════════════════════
// SEED FUNCTION
// ══════════════════════════════════════════════════════════

async function seed() {
  console.log('Seeding 20 Discovery interview sessions for retail demo...\n');

  // 1. Verify workshop exists
  const workshop = await prisma.workshop.findUnique({ where: { id: WORKSHOP_ID } });
  if (!workshop) {
    console.error(`Workshop ${WORKSHOP_ID} not found. Run the main seed first.`);
    process.exit(1);
  }

  // 2. Clean existing discovery sessions (only our disc-* prefixed ones)
  const existingParticipants = await prisma.workshopParticipant.findMany({
    where: { workshopId: WORKSHOP_ID, id: { startsWith: 'disc-p' } },
    select: { id: true },
  });

  if (existingParticipants.length > 0) {
    const participantIds = existingParticipants.map((p) => p.id);
    console.log(`Cleaning ${participantIds.length} existing discovery participants...`);

    // Delete in dependency order
    await prisma.conversationInsight.deleteMany({
      where: { workshopId: WORKSHOP_ID, participantId: { in: participantIds } },
    });
    // Delete agentic analyses via data points
    const existingDataPoints = await prisma.dataPoint.findMany({
      where: { workshopId: WORKSHOP_ID, participantId: { in: participantIds } },
      select: { id: true },
    });
    const dpIds = existingDataPoints.map((dp) => dp.id);
    if (dpIds.length > 0) {
      await prisma.agenticAnalysis.deleteMany({ where: { dataPointId: { in: dpIds } } });
      await prisma.dataPointClassification.deleteMany({ where: { dataPointId: { in: dpIds } } });
    }
    await prisma.dataPoint.deleteMany({
      where: { workshopId: WORKSHOP_ID, participantId: { in: participantIds } },
    });
    await prisma.conversationSession.deleteMany({
      where: { workshopId: WORKSHOP_ID, participantId: { in: participantIds } },
    });
    await prisma.workshopParticipant.deleteMany({
      where: { workshopId: WORKSHOP_ID, id: { startsWith: 'disc-p' } },
    });
    console.log('Cleaned existing discovery data.\n');
  }

  let totalDataPoints = 0;
  let totalInsights = 0;

  // 3. Create participants, sessions, data points, analyses, and insights
  for (const p of PARTICIPANTS) {
    // Create participant
    const baseDate = new Date('2025-02-15T09:00:00Z');
    const participantIdx = PARTICIPANTS.indexOf(p);
    const sessionStart = new Date(baseDate.getTime() + participantIdx * 45 * 60 * 1000); // 45min apart
    const sessionEnd = new Date(sessionStart.getTime() + 25 * 60 * 1000); // 25min sessions

    await prisma.workshopParticipant.create({
      data: {
        id: p.id,
        workshopId: WORKSHOP_ID,
        email: p.email,
        name: p.name,
        role: p.role,
        department: p.department,
        discoveryToken: `disc-token-${p.id}-${Date.now()}`,
        attributionPreference: 'NAMED',
        responseStartedAt: sessionStart,
        responseCompletedAt: sessionEnd,
      },
    });

    // Create session
    const sessionId = `disc-session-${p.id}`;
    await prisma.conversationSession.create({
      data: {
        id: sessionId,
        workshopId: WORKSHOP_ID,
        participantId: p.id,
        status: 'COMPLETED',
        runType: 'BASELINE',
        questionSetVersion: 'v1',
        currentPhase: 'summary',
        phaseProgress: 100,
        startedAt: sessionStart,
        completedAt: sessionEnd,
        totalDurationMs: 25 * 60 * 1000,
        language: 'en',
        voiceEnabled: false,
        includeRegulation: true,
      },
    });

    // Create data points + analyses for each response
    const interview = INTERVIEW_DATA.find((d) => d.participantId === p.id);
    if (!interview) continue;

    for (let ri = 0; ri < interview.responses.length; ri++) {
      const r = interview.responses[ri];
      const dpId = `disc-dp-${p.id}-${ri}`;
      const dpTimestamp = new Date(sessionStart.getTime() + (ri + 1) * 2 * 60 * 1000); // 2min apart

      // Create data point
      await prisma.dataPoint.create({
        data: {
          id: dpId,
          workshopId: WORKSHOP_ID,
          sessionId,
          participantId: p.id,
          rawText: r.rawText,
          source: 'SPEECH',
          speakerId: p.id,
          questionKey: r.questionKey,
          createdAt: dpTimestamp,
        },
      });

      // Create classification
      await prisma.dataPointClassification.create({
        data: {
          dataPointId: dpId,
          primaryType: r.primaryType as any,
          confidence: r.confidence,
          keywords: r.keywords,
          suggestedArea: r.domains[0]?.domain || null,
        },
      });

      // Create agentic analysis
      await prisma.agenticAnalysis.create({
        data: {
          dataPointId: dpId,
          semanticMeaning: r.semanticMeaning,
          speakerIntent: r.speakerIntent,
          temporalFocus: r.temporalFocus,
          sentimentTone: r.sentiment,
          domains: r.domains,
          themes: r.themes,
          connections: [],
          actors: r.actors,
          overallConfidence: r.confidence,
          uncertainties: r.uncertainties,
          agentModel: 'gpt-4o',
          analysisVersion: '1.0',
        },
      });

      totalDataPoints++;

      // Create conversation insight (if applicable)
      if (r.insightType) {
        await prisma.conversationInsight.create({
          data: {
            sessionId,
            workshopId: WORKSHOP_ID,
            participantId: p.id,
            insightType: r.insightType as any,
            text: r.rawText.slice(0, 300),
            severity: r.insightSeverity || null,
            confidence: r.confidence,
            sourceMessageIds: [dpId],
          },
        });
        totalInsights++;
      }
    }

    console.log(`  ${p.name} (${p.role}) — ${interview.responses.length} responses`);
  }

  console.log(`\nSeed complete!`);
  console.log(`  Participants: ${PARTICIPANTS.length}`);
  console.log(`  Sessions: ${PARTICIPANTS.length}`);
  console.log(`  Data points: ${totalDataPoints}`);
  console.log(`  Insights: ${totalInsights}`);
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
