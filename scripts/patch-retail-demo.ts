/**
 * Patch Retail Demo Workshop
 *
 * Populates ALL missing fields on the 'retail-cx-workshop' demo record
 * so the demo is complete from Prep → Discovery → Live Session → Output.
 *
 * SAFE: Does NOT touch the snapshot data (nodesById / liveSnapshots).
 * Run: npx tsx scripts/patch-retail-demo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WORKSHOP_ID = 'retail-cx-workshop';

// ── Prep Research ─────────────────────────────────────────────────────────────

const PREP_RESEARCH = {
  companyOverview:
    'RetailCo UK is a mid-market high-street retailer with 180 stores across England, Scotland, and Wales and a growing eCommerce presence. Founded in 1987, the company employs 9,400 people and generates £640M in annual revenue. It serves 2.8M loyalty members and processes 12,000 daily contact centre interactions across phone, chat, and email. After a decade of strong growth, the business is facing structural pressure from digital-native competitors and shifting consumer expectations.',
  industryContext:
    'UK retail is undergoing its most significant transformation since the introduction of online shopping. Physical store footfall has declined 22% since 2019. Consumers expect seamless omnichannel experiences — browse online, buy in-store, return anywhere. AI-powered personalisation, same-day delivery, and frictionless payments have become table-stakes. Pure-play online retailers (ASOS, Boohoo) and marketplace giants (Amazon) are capturing market share at pace, while legacy retailers face cost-inflation, staff shortages, and legacy technology debt.',
  keyPublicChallenges: [
    'Declining footfall: -18% in-store visits over 3 years despite flat online growth',
    'Staff retention crisis: 28% annual turnover vs 14% industry average, costing £8.4M/yr in recruitment and training',
    'Contact centre pressure: first-contact resolution dropped from 72% to 58% in 18 months',
    'Inventory fragmentation: no unified stock view across 180 stores and 2 distribution centres',
    'Loyalty programme underperformance: email open rate of 12% vs 22% industry average, 1.2M members inactive for 12+ months',
    'Technology legacy: 14 disconnected systems across POS, WMS, CRM, and eCommerce with no single customer view',
  ],
  recentDevelopments: [
    'Appointed new Chief Digital Officer in Q3 2025 with mandate to "digitise the store experience"',
    'Failed £4.2M chatbot implementation in 2024 — resolved only 12% of contact centre queries before being scaled back',
    'Competitor John Lewis launched AI-powered in-store associate tablets delivering real-time stock and customer data',
    'Board approved £8M digital transformation budget for FY2026, pending business case approval',
    'ASOS and Next gaining 3-4% market share in RetailCo\'s core demographics annually',
  ],
  competitorLandscape:
    'John Lewis: Premium benchmark — associate tablet tech, seamless click-and-collect, 4.8★ customer satisfaction. Next: Omnichannel leader — 65% of online orders fulfilled from stores, same-day delivery, NEXTUNLIMITED subscription growing. ASOS: Digital-native threat — AI-powered personalisation drives 35% of revenue, 98% returns satisfaction. M&S: Transformation benchmark — Sparks loyalty AI uplift of 23% incremental spend, strong app engagement. Primark: Volume competitor — zero eCommerce but dominant footfall through entertainment retail experience.',
  domainInsights:
    'Contact centre volume is 71% driven by 5 root causes: order tracking (31%), returns/refunds (19%), stock enquiries (12%), click-and-collect issues (5%), and loyalty queries (4%). High repeat-contact rate (2.8x per customer) suggests systemic resolution failures. Live-chat satisfaction (3.2★) significantly lags phone (4.1★), pointing to agent training and tooling gaps. AI implementation readiness is low — agents lack structured data access, and customer history is siloed across 4 systems.',
  researchedAtMs: Date.now(),
  sourceUrls: [
    'https://www.retailgazette.co.uk',
    'https://www.thisismoney.co.uk',
    'https://www.statista.com/uk-retail',
  ],
  journeyStages: [
    { name: 'Awareness & Discovery', description: 'Customer becomes aware of RetailCo through social, search, word-of-mouth, or physical store presence. Digital and physical awareness are siloed.', typicalTouchpoints: ['Social media ads', 'Google search', 'Store window/signage', 'Word of mouth'] },
    { name: 'Browse & Research', description: 'Customer explores product range online or in-store. Key pain point: stock availability information is unreliable across channels.', typicalTouchpoints: ['Website/app', 'In-store browsing', 'Product comparison', 'Review sites'] },
    { name: 'Purchase Decision', description: 'Conversion moment — impacted by price, availability, trust, and convenience. Basket abandonment rate online is 73%.', typicalTouchpoints: ['POS/checkout', 'Online cart', 'Associate recommendation', 'Promotions/offers'] },
    { name: 'Fulfilment & Delivery', description: 'Order processing and delivery. 23% of click-and-collect orders have an issue at collection point. Returns take 14 days to process.', typicalTouchpoints: ['Click-and-collect desk', 'Home delivery', 'Order tracking', 'Email notifications'] },
    { name: 'Post-Purchase & Service', description: 'Returns, complaints, and loyalty engagement. Contact centre pressure peaks here. First-contact resolution has declined from 72% to 58%.', typicalTouchpoints: ['Contact centre (phone/chat)', 'Returns desk', 'Email support', 'Loyalty app'] },
    { name: 'Retention & Loyalty', description: 'Repeat purchase and advocacy. Loyalty programme under-performs — 1.2M of 2.8M members inactive. Personalisation is batch-and-blast.', typicalTouchpoints: ['Loyalty programme', 'Email/push notifications', 'In-store events', 'App engagement'] },
  ],
  industryDimensions: [
    { name: 'Customer Experience', description: 'End-to-end customer journey across physical and digital touchpoints', keywords: ['customer', 'experience', 'journey', 'satisfaction', 'NPS', 'loyalty', 'omnichannel'], color: '#3b82f6' },
    { name: 'People & Culture', description: 'Workforce capability, retention, associate experience, and cultural readiness for transformation', keywords: ['staff', 'people', 'culture', 'training', 'retention', 'associate', 'turnover', 'engagement'], color: '#8b5cf6' },
    { name: 'Technology & Data', description: 'Digital infrastructure, data architecture, AI readiness, and systems integration', keywords: ['technology', 'data', 'AI', 'system', 'platform', 'integration', 'digital', 'automation'], color: '#10b981' },
    { name: 'Operations', description: 'Supply chain, inventory management, fulfilment, and contact centre operations', keywords: ['operations', 'inventory', 'supply chain', 'fulfilment', 'process', 'efficiency', 'contact centre'], color: '#f59e0b' },
    { name: 'Commercial', description: 'Revenue growth, margin, competitive positioning, and commercial model', keywords: ['revenue', 'margin', 'commercial', 'profit', 'investment', 'cost', 'ROI', 'growth'], color: '#ef4444' },
  ],
  actorTaxonomy: [
    { role: 'Chief Customer Officer', description: 'Senior executive responsible for the end-to-end customer experience strategy and NPS improvement agenda', seniority: 'executive', department: 'Strategy' },
    { role: 'Head of Digital', description: 'Leads eCommerce, app, and digital channel strategy; responsible for online revenue growth', seniority: 'executive', department: 'Digital' },
    { role: 'Contact Centre Manager', description: 'Manages 240 agents across phone, chat, and email; focused on resolution rates and agent productivity', seniority: 'manager', department: 'Operations' },
    { role: 'Regional Store Manager', description: 'Oversees 12-15 stores; focused on footfall, conversion, stock availability, and staff performance', seniority: 'manager', department: 'Retail Operations' },
    { role: 'Store Associate', description: 'Front-line team member handling customer queries, stock checks, click-and-collect, and returns', seniority: 'operational', department: 'Retail Operations' },
    { role: 'IT Infrastructure Lead', description: 'Responsible for core retail systems (POS, WMS, CRM), integration architecture, and technical debt', seniority: 'manager', department: 'Technology' },
    { role: 'Loyalty & CRM Manager', description: 'Manages the 2.8M member loyalty programme; owns personalisation, email, and push notification strategy', seniority: 'manager', department: 'Marketing' },
    { role: 'Customer', description: 'End consumer interacting across in-store, online, app, and contact centre channels', seniority: 'external', department: 'External' },
  ],
};

// ── Discovery Questions (per-lens) ────────────────────────────────────────────

const DISCOVERY_QUESTIONS = [
  { lens: 'Customer Experience', questions: [
    'Walk me through the last time a customer had a genuinely great experience with RetailCo. What made it work?',
    'Where do you see customers most frustrated in their journey with us today?',
    'If customers could change one thing about how we serve them, what do you think they would say?',
    'How consistent is the experience we deliver across physical stores, online, and the contact centre?',
    'What does a "loyal" RetailCo customer look like — and are we doing enough to earn that loyalty?',
  ]},
  { lens: 'People & Culture', questions: [
    'How would you describe the energy and morale of store associates right now?',
    'What are the biggest barriers stopping your team from delivering the service they want to deliver?',
    'How well-equipped are your people with the tools, training, and information they need to do their jobs?',
    'What would make RetailCo a place where the best retail talent wants to build a career?',
    'Where do you see cultural resistance to change — and why do you think that is?',
  ]},
  { lens: 'Technology & Data', questions: [
    'How confident are you in the accuracy and completeness of the data you have about your customers?',
    'Where do disconnected systems cause the most friction for your team and customers today?',
    'If you could give store associates one piece of technology tomorrow, what would have the biggest impact?',
    'How ready is RetailCo to leverage AI — in terms of data quality, skills, and appetite?',
    'What\'s holding back the technology transformation — investment, skills, or something else?',
  ]},
  { lens: 'Operations', questions: [
    'Walk me through what happens when a customer tries to collect an online order in-store. Where does it break down?',
    'How visible is your stock position across stores and warehouses in real time?',
    'Where is the contact centre spending the most time — and how much of that could be eliminated?',
    'What are the biggest operational bottlenecks that your customers feel the impact of directly?',
    'If you could automate one operational process tomorrow, what would it be and why?',
  ]},
  { lens: 'Commercial', questions: [
    'Where is RetailCo leaving commercial opportunity on the table because of operational constraints?',
    'How well are we converting footfall and site traffic into actual sales — and where are we losing people?',
    'What commercial levers do you think we\'ve underutilised that competitors are benefiting from?',
    'How do you think about the return on the digital transformation investment we\'re about to make?',
    'If you had to pick the one capability that would most improve our commercial performance, what would it be?',
  ]},
];

// ── Blueprint ─────────────────────────────────────────────────────────────────

const BLUEPRINT = {
  version: 1,
  blueprintVersion: 1,
  industry: 'Retail',
  dreamTrack: 'ENTERPRISE',
  engagementType: null,
  domainPack: null,
  purpose: 'Transform RetailCo into a digitally-enabled omnichannel retailer that unifies in-store and online experience through AI, delivering measurable improvements in customer satisfaction, associate productivity, and commercial performance.',
  outcomes: 'A validated transformation roadmap with phased AI enablement, a unified customer data strategy, and a workforce model that empowers store associates with real-time digital tools.',
  lenses: [
    { name: 'Customer Experience', description: 'End-to-end customer journey across physical and digital touchpoints', color: '#3b82f6', keywords: ['customer', 'experience', 'journey', 'satisfaction', 'NPS', 'loyalty', 'omnichannel'] },
    { name: 'People & Culture', description: 'Workforce capability, retention, associate experience, and cultural readiness', color: '#8b5cf6', keywords: ['staff', 'people', 'culture', 'training', 'retention', 'associate', 'turnover'] },
    { name: 'Technology & Data', description: 'Digital infrastructure, data architecture, AI readiness, and systems integration', color: '#10b981', keywords: ['technology', 'data', 'AI', 'system', 'platform', 'integration', 'digital', 'automation'] },
    { name: 'Operations', description: 'Supply chain, inventory management, fulfilment, and contact centre operations', color: '#f59e0b', keywords: ['operations', 'inventory', 'supply chain', 'fulfilment', 'process', 'efficiency'] },
    { name: 'Commercial', description: 'Revenue growth, margin, competitive positioning, and commercial model', color: '#ef4444', keywords: ['revenue', 'margin', 'commercial', 'profit', 'investment', 'cost', 'ROI', 'growth'] },
  ],
  phaseLensPolicy: {
    REIMAGINE: ['Customer Experience', 'People & Culture', 'Technology & Data', 'Operations', 'Commercial'],
    CONSTRAINTS: ['Technology & Data', 'Commercial', 'Operations', 'People & Culture'],
    DEFINE_APPROACH: ['Customer Experience', 'Technology & Data', 'Operations', 'People & Culture', 'Commercial'],
  },
  journeyStages: [
    { name: 'Awareness & Discovery', description: 'How customers first encounter RetailCo across channels' },
    { name: 'Browse & Research', description: 'Product exploration in-store and online' },
    { name: 'Purchase Decision', description: 'Conversion moment across physical and digital' },
    { name: 'Fulfilment & Delivery', description: 'Order processing, click-and-collect, and delivery' },
    { name: 'Post-Purchase & Service', description: 'Returns, complaints, and contact centre' },
    { name: 'Retention & Loyalty', description: 'Repeat purchase and loyalty engagement' },
  ],
  actorTaxonomy: [
    { key: 'customer', label: 'Customer', description: 'End consumer across all channels' },
    { key: 'store_associate', label: 'Store Associate', description: 'Front-line team member' },
    { key: 'store_manager', label: 'Store Manager', description: 'Store and regional management' },
    { key: 'contact_agent', label: 'Contact Centre Agent', description: 'Phone and chat support agent' },
    { key: 'digital_team', label: 'Digital Team', description: 'eCommerce, app, and digital channel owners' },
    { key: 'operations', label: 'Operations', description: 'Supply chain, fulfilment, and inventory' },
  ],
  questionPolicy: { questionsPerPhase: 8, subQuestionsPerMain: 3, coverageThresholdPercent: 70 },
  questionConstraints: {
    requiredTopics: ['omnichannel integration', 'AI readiness', 'associate tooling', 'inventory visibility', 'loyalty programme'],
    forbiddenTopics: [],
    focusAreas: ['customer journey unification', 'store of the future', 'AI-powered personalisation', 'contact centre transformation'],
    domainMetrics: ['NPS', 'first-contact resolution', 'staff turnover', 'email open rate', 'basket abandonment', 'inventory accuracy'],
  },
  dataRequirements: {
    typicalDurationDays: 14,
    typicalInterviewCount: '12-20',
    sessionMix: [
      { type: 'Executive interviews', count: 3, duration: '60 min' },
      { type: 'Operations deep-dives', count: 4, duration: '45 min' },
      { type: 'Frontline associate sessions', count: 5, duration: '30 min' },
    ],
  },
  confidenceRules: { minimumParticipants: 8, minimumUtterancesPerLens: 15, minimumPhasesCovered: 2 },
  pacing: { defaultPhaseDurationMins: 45, breakDurationMins: 5, warmUpDurationMins: 10 },
  agentChain: ['research-agent', 'discovery-intelligence-agent', 'question-set-agent', 'facilitation-orchestrator'],
  signalPolicy: { captureThreshold: 0.6, mergeThreshold: 0.85, maxSignalsPerPhase: 200 },
  findingPolicy: { minSeverityToSurface: 'moderate', maxFindingsPerLens: 8, requiresEvidence: true },
  diagnosticFocus: 'Customer & Operations Transformation',
  outputEmphasis: ['customer-journey-redesign', 'ai-enablement', 'workforce-transformation', 'commercial-impact'],
  composedAtMs: Date.now(),
};

// ── Custom Questions (facilitation) ───────────────────────────────────────────

const CUSTOM_QUESTIONS = {
  phases: {
    REIMAGINE: {
      label: 'Reimagine',
      description: 'Explore what RetailCo could become if constraints were removed',
      lensOrder: ['Customer Experience', 'People & Culture', 'Technology & Data', 'Operations', 'Commercial'],
      questions: [
        { id: 'r1', phase: 'REIMAGINE', lens: 'Customer Experience', order: 1, isEdited: false, subQuestions: [],
          text: 'If a customer could experience RetailCo at its absolute best — from discovery to loyalty — what would that look like?',
          purpose: 'Surface the aspirational customer experience vision the group holds',
          grounding: 'Research shows NPS at critical lows and channel fragmentation destroying loyalty — this question unlocks the antidote' },
        { id: 'r2', phase: 'REIMAGINE', lens: 'Customer Experience', order: 2, isEdited: false, subQuestions: [],
          text: 'What would it mean for our brand if every touchpoint — store, app, contact centre — felt like one seamless retailer?',
          purpose: 'Explore omnichannel unification from a brand and customer lens',
          grounding: 'Current state: 14 disconnected systems; customer sees 3 different "RetailCos" across channels' },
        { id: 'r3', phase: 'REIMAGINE', lens: 'People & Culture', order: 3, isEdited: false, subQuestions: [],
          text: 'Imagine a store associate armed with the right tools and data. How would their relationship with the customer change?',
          purpose: 'Unlock the "associate as differentiator" narrative — competing with Amazon on human connection',
          grounding: 'Associates currently have zero digital tools; competitors like John Lewis have fully equipped their teams' },
        { id: 'r4', phase: 'REIMAGINE', lens: 'Technology & Data', order: 4, isEdited: false, subQuestions: [],
          text: 'If AI knew every customer as well as your best store associate does — how would you use that intelligence?',
          purpose: 'Explore AI-powered personalisation ambition across the journey',
          grounding: 'ASOS drives 35% of revenue through AI personalisation; RetailCo sends same promotions to all 2.8M members' },
        { id: 'r5', phase: 'REIMAGINE', lens: 'Operations', order: 5, isEdited: false, subQuestions: [],
          text: 'What would a contact centre look like where agents resolved every query first time — every time?',
          purpose: 'Reset the ambition for contact centre performance beyond the current 58% FCR',
          grounding: 'FCR has declined 14 points; 71% of volume driven by 5 fixable root causes' },
        { id: 'r6', phase: 'REIMAGINE', lens: 'Commercial', order: 6, isEdited: false, subQuestions: [],
          text: 'If the store became a showroom, fulfilment hub, and community space — what new commercial models would that unlock?',
          purpose: 'Challenge the assumption that physical stores are in decline',
          grounding: 'Stores running community events show +8% footfall growth; store-as-hub can drive 3x revenue per sq ft' },
      ],
    },
    CONSTRAINTS: {
      label: 'Constraints',
      description: 'Identify what is holding RetailCo back from transformation',
      lensOrder: ['Technology & Data', 'Commercial', 'Operations', 'People & Culture'],
      questions: [
        { id: 'c1', phase: 'CONSTRAINTS', lens: 'Technology & Data', order: 1, isEdited: false, subQuestions: [],
          text: 'What technical debt or system limitations will be hardest to move around on this transformation?',
          purpose: 'Surface legacy technology as a real constraint, not just a cliché',
          grounding: '14 disconnected systems identified in research; previous chatbot failed partly due to integration barriers' },
        { id: 'c2', phase: 'CONSTRAINTS', lens: 'Commercial', order: 2, isEdited: false, subQuestions: [],
          text: 'What does a "good" business case look like to the board — and what would make them say no to this transformation?',
          purpose: 'Understand the financial gatekeeping constraints',
          grounding: '£8M budget approved pending business case; this question surfaces what the board really needs to see' },
        { id: 'c3', phase: 'CONSTRAINTS', lens: 'Operations', order: 3, isEdited: false, subQuestions: [],
          text: 'What would break operationally if we tried to change the contact centre or store model too fast?',
          purpose: 'Identify sequencing and change management constraints',
          grounding: 'High staff turnover (28%) suggests change fatigue; pace of transformation must be realistic' },
        { id: 'c4', phase: 'CONSTRAINTS', lens: 'People & Culture', order: 4, isEdited: false, subQuestions: [],
          text: 'Who in the organisation would resist this change — and what are they protecting?',
          purpose: 'Name the cultural and political constraints without judgement',
          grounding: 'Previous chatbot failure created internal scepticism; this question surfaces hidden resistance' },
      ],
    },
    DEFINE_APPROACH: {
      label: 'Define Approach',
      description: 'Build consensus on how RetailCo should move forward',
      lensOrder: ['Customer Experience', 'Technology & Data', 'Operations', 'People & Culture', 'Commercial'],
      questions: [
        { id: 'd1', phase: 'DEFINE_APPROACH', lens: 'Technology & Data', order: 1, isEdited: false, subQuestions: [],
          text: 'If we had to prove value in 90 days — what would be the one thing we would build or fix first?',
          purpose: 'Force prioritisation of the most impactful near-term move',
          grounding: 'Board expects business case with phased delivery; this surfaces what the group believes is the highest-ROI starting point' },
        { id: 'd2', phase: 'DEFINE_APPROACH', lens: 'Operations', order: 2, isEdited: false, subQuestions: [],
          text: 'Where would you put AI to work first — and how would you know it was working?',
          purpose: 'Ground AI ambition in measurable outcomes and specific use cases',
          grounding: 'Previous chatbot failed due to lack of clear metrics and integration; this question builds in accountability' },
        { id: 'd3', phase: 'DEFINE_APPROACH', lens: 'Customer Experience', order: 3, isEdited: false, subQuestions: [],
          text: 'What is the one change that would most improve the customer experience in the next 6 months?',
          purpose: 'Build consensus on the customer-facing priority',
          grounding: 'Multiple lens signals converging on click-and-collect and returns as highest friction points' },
        { id: 'd4', phase: 'DEFINE_APPROACH', lens: 'People & Culture', order: 4, isEdited: false, subQuestions: [],
          text: 'How do we take store associates and contact centre agents with us — not just build technology over them?',
          purpose: 'Ensure the transformation is human-first and builds associate buy-in',
          grounding: 'Staff turnover is 28%; a transformation that increases associate anxiety will accelerate attrition' },
        { id: 'd5', phase: 'DEFINE_APPROACH', lens: 'Commercial', order: 5, isEdited: false, subQuestions: [],
          text: 'What does success look like in 12 months — and how will we know if this transformation is working?',
          purpose: 'Define clear success metrics to hold the transformation accountable',
          grounding: 'Discovery surfaced NPS, FCR, and staff turnover as key metrics; this question locks in what we\'ll measure' },
      ],
    },
  },
  designRationale: 'Questions designed around RetailCo\'s specific pain profile: channel fragmentation, associate capability gap, contact centre FCR decline, and loyalty underperformance. Each phase builds on the last — Reimagine surfaces the aspiration, Constraints names the reality, Define Approach builds consensus on the path. Questions are deliberately provocative enough to challenge assumptions but grounded in the research data to feel credible.',
  generatedAtMs: Date.now(),
  dataConfidence: 'high',
  dataSufficiencyNotes: [
    'Strong research signal from multiple public sources and internal metrics',
    'Contact centre performance data provides excellent grounding for Operations questions',
    'Staff turnover data (28% vs 14% industry) creates a compelling People & Culture narrative',
  ],
};

// ── Discover Analysis ─────────────────────────────────────────────────────────

const DISCOVER_ANALYSIS = {
  workshopId: WORKSHOP_ID,
  generatedAt: new Date().toISOString(),
  participantCount: 20,
  alignment: {
    score: 52,
    themes: ['Omnichannel Integration', 'Staff Retention Crisis', 'AI Opportunity', 'Inventory Blindness', 'Contact Centre Pressure', 'Loyalty Underperformance'],
    actors: ['Executive Layer', 'Operations Layer', 'Frontline Layer'],
    cells: [
      { theme: 'Omnichannel Integration', actor: 'Executive Layer', alignmentScore: 0.7, sentimentBalance: { positive: 40, negative: 30, neutral: 30 }, utteranceCount: 18, sampleQuotes: ['We need to become one retailer across all channels', 'The customer doesn\'t see a digital business and a physical business — we do, and that\'s our problem'] },
      { theme: 'Omnichannel Integration', actor: 'Operations Layer', alignmentScore: 0.2, sentimentBalance: { positive: 20, negative: 55, neutral: 25 }, utteranceCount: 24, sampleQuotes: ['Our systems don\'t talk to each other — it\'s chaos at click-and-collect', 'I can\'t see what\'s in the store down the road let alone online'] },
      { theme: 'Omnichannel Integration', actor: 'Frontline Layer', alignmentScore: -0.3, sentimentBalance: { positive: 10, negative: 65, neutral: 25 }, utteranceCount: 31, sampleQuotes: ['Customers ask me about their online order and I have no idea', 'We tell customers we\'ll check and then we call the warehouse — it takes 20 minutes'] },
      { theme: 'Staff Retention Crisis', actor: 'Executive Layer', alignmentScore: 0.5, sentimentBalance: { positive: 30, negative: 40, neutral: 30 }, utteranceCount: 12, sampleQuotes: ['Turnover is a cost problem but also a capability problem', 'We\'re losing institutional knowledge every month'] },
      { theme: 'Staff Retention Crisis', actor: 'Operations Layer', alignmentScore: 0.1, sentimentBalance: { positive: 15, negative: 60, neutral: 25 }, utteranceCount: 19, sampleQuotes: ['I\'m managing a team of new starters most of the time', 'By the time we train someone they\'re looking for their next job'] },
      { theme: 'Staff Retention Crisis', actor: 'Frontline Layer', alignmentScore: -0.6, sentimentBalance: { positive: 5, negative: 75, neutral: 20 }, utteranceCount: 28, sampleQuotes: ['The pay isn\'t enough for what we deal with', 'Nobody gives us the tools to do a good job and then gets surprised when we leave'] },
      { theme: 'AI Opportunity', actor: 'Executive Layer', alignmentScore: 0.8, sentimentBalance: { positive: 65, negative: 15, neutral: 20 }, utteranceCount: 15, sampleQuotes: ['AI could transform our personalisation capability', 'The board has approved budget — we need to move fast'] },
      { theme: 'AI Opportunity', actor: 'Operations Layer', alignmentScore: 0.3, sentimentBalance: { positive: 35, negative: 35, neutral: 30 }, utteranceCount: 11, sampleQuotes: ['AI in the contact centre would free us up for complex queries', 'We tried a chatbot before and it didn\'t work — so there\'s scepticism'] },
      { theme: 'AI Opportunity', actor: 'Frontline Layer', alignmentScore: -0.1, sentimentBalance: { positive: 25, negative: 40, neutral: 35 }, utteranceCount: 9, sampleQuotes: ['Would AI replace us?', 'If AI could answer the basic questions that\'d actually help us focus on proper customers'] },
    ],
  },
  tensions: {
    tensions: [
      {
        id: 't1', topic: 'Speed vs Stability', rank: 1, tensionIndex: 0.87, severity: 'critical',
        viewpoints: [
          { actor: 'Executive Layer', stance: 'We need to move fast — competitors are pulling ahead and we have board approval for £8M', sentiment: 'urgent' },
          { actor: 'Operations Layer', stance: 'We failed with the chatbot because we moved too fast without proper integration planning', sentiment: 'cautious' },
          { actor: 'Frontline Layer', stance: 'Every big change project disrupts our day-to-day and then gets abandoned', sentiment: 'sceptical' },
        ],
        affectedActors: ['Executive Layer', 'Operations Layer', 'Frontline Layer'],
        relatedConstraints: ['legacy system integration', 'staff change fatigue'],
        domain: 'Operations',
      },
      {
        id: 't2', topic: 'Technology vs Human Service', rank: 2, tensionIndex: 0.79, severity: 'critical',
        viewpoints: [
          { actor: 'Executive Layer', stance: 'AI and automation are the only way to scale quality service at our volume', sentiment: 'optimistic' },
          { actor: 'Frontline Layer', stance: 'Human connection is what makes retail special — you can\'t automate that', sentiment: 'resistant' },
          { actor: 'Operations Layer', stance: 'We need AI to handle the easy stuff so people can focus on hard problems', sentiment: 'pragmatic' },
        ],
        affectedActors: ['Executive Layer', 'Operations Layer', 'Frontline Layer'],
        relatedConstraints: ['AI readiness', 'staff buy-in', 'change management'],
        domain: 'People & Culture',
      },
      {
        id: 't3', topic: 'Investment Priority: Store vs Digital', rank: 3, tensionIndex: 0.71, severity: 'significant',
        viewpoints: [
          { actor: 'Executive Layer', stance: 'Digital investment has the clearest ROI pathway and scale potential', sentiment: 'aligned' },
          { actor: 'Operations Layer', stance: 'Stores generate 68% of revenue — we can\'t neglect physical infrastructure', sentiment: 'protective' },
        ],
        affectedActors: ['Executive Layer', 'Operations Layer'],
        relatedConstraints: ['budget allocation', 'competing priorities'],
        domain: 'Commercial',
      },
    ],
  },
  narrative: {
    layerAssignments: [
      { participantId: 'exec-1', layer: 'executive', justification: 'C-suite level' },
      { participantId: 'exec-2', layer: 'executive', justification: 'C-suite level' },
      { participantId: 'exec-3', layer: 'executive', justification: 'C-suite level' },
      { participantId: 'ops-1', layer: 'operational', justification: 'Mid-management' },
      { participantId: 'ops-2', layer: 'operational', justification: 'Mid-management' },
      { participantId: 'front-1', layer: 'frontline', justification: 'Front-line role' },
    ],
    layers: [
      {
        layer: 'executive',
        dominantThemes: ['AI opportunity', 'commercial transformation', 'speed to market'],
        sentiment: 0.6,
        confidence: 0.78,
        narrativeSummary: 'Executives see AI and digital as existential imperatives. The urgency is genuine — competitor encroachment is measurable. However, there is a tendency to underestimate the integration complexity and change management burden of transformation at RetailCo\'s scale.',
      },
      {
        layer: 'operational',
        dominantThemes: ['system integration', 'process change', 'resource constraints'],
        sentiment: 0.2,
        confidence: 0.71,
        narrativeSummary: 'Operations managers are the pragmatists. They have lived the consequences of rushed implementation (the failed chatbot) and carry justified scepticism. They support transformation in principle but need proof that this time the planning is rigorous.',
      },
      {
        layer: 'frontline',
        dominantThemes: ['job security', 'better tools', 'customer frustration'],
        sentiment: -0.2,
        confidence: 0.65,
        narrativeSummary: 'Frontline associates are the most affected and least consulted. Their frustration is real — poor tooling, high turnover, and customer queries they cannot answer. They are open to tools that make their jobs easier but deeply sceptical of transformation that arrives top-down without involving them.',
      },
    ],
    divergencePoints: [
      { topic: 'AI as threat vs opportunity', executiveView: 'AI enables scale and personalisation', frontlineView: 'AI might replace us or make customers feel less valued', severityScore: 0.75 },
      { topic: 'Pace of change', executiveView: 'Board has approved £8M — we need to show value in 90 days', operationalView: 'Previous failed implementation was caused by speed, not lack of will', severityScore: 0.82 },
    ],
  },
  constraints: {
    constraints: [
      { id: 'cs1', description: 'Legacy POS and inventory systems (14 disconnected platforms) require complex integration before any unified data layer is possible', domain: 'Technology & Data', frequency: 8, severity: 'critical', weight: 0.91, dependsOn: [], blocks: ['cs3', 'cs4'] },
      { id: 'cs2', description: 'Staff change fatigue — 28% annual turnover means transformation projects land on an ever-changing workforce, compounding training costs', domain: 'People & Culture', frequency: 6, severity: 'critical', weight: 0.84, dependsOn: [], blocks: ['cs5'] },
      { id: 'cs3', description: 'No single customer data record across loyalty, eCommerce, POS, and contact centre — personalisation is structurally impossible without this', domain: 'Technology & Data', frequency: 7, severity: 'critical', weight: 0.88, dependsOn: ['cs1'], blocks: [] },
      { id: 'cs4', description: 'Contact centre tooling does not surface customer history or order data — agents resolve blind, driving repeat contacts', domain: 'Operations', frequency: 5, severity: 'significant', weight: 0.72, dependsOn: ['cs1', 'cs3'], blocks: [] },
      { id: 'cs5', description: 'Institutional scepticism from the failed 2024 chatbot implementation — AI initiatives require proof-of-concept before broader rollout will get buy-in', domain: 'People & Culture', frequency: 4, severity: 'significant', weight: 0.68, dependsOn: ['cs2'], blocks: [] },
    ],
    relationships: [
      { fromId: 'cs1', toId: 'cs3', type: 'blocks', strength: 0.9, description: 'Legacy systems block single customer data record creation' },
      { fromId: 'cs1', toId: 'cs4', type: 'blocks', strength: 0.8, description: 'System fragmentation prevents contact centre data access' },
      { fromId: 'cs2', toId: 'cs5', type: 'amplifies', strength: 0.7, description: 'High turnover amplifies scepticism as institutional memory is lost' },
    ],
  },
  confidence: {
    overall: { certain: 42, hedging: 38, uncertain: 20 },
    byDomain: [
      { domain: 'Customer Experience', certain: 38, hedging: 40, uncertain: 22 },
      { domain: 'People & Culture', certain: 45, hedging: 35, uncertain: 20 },
      { domain: 'Technology & Data', certain: 40, hedging: 42, uncertain: 18 },
      { domain: 'Operations', certain: 50, hedging: 32, uncertain: 18 },
      { domain: 'Commercial', certain: 35, hedging: 40, uncertain: 25 },
    ],
    byLayer: [
      { layer: 'executive', certain: 48, hedging: 35, uncertain: 17 },
      { layer: 'operational', certain: 44, hedging: 38, uncertain: 18 },
      { layer: 'frontline', certain: 35, hedging: 42, uncertain: 23 },
    ],
  },
};

// ── Scratchpad ─────────────────────────────────────────────────────────────────

const SCRATCHPAD_EXEC_SUMMARY = {
  overview: 'A strategic workshop exploring how RetailCo can evolve from a legacy high-street retailer struggling with declining footfall into a digitally-enabled omnichannel brand. The workshop engaged 12 stakeholders who identified critical fractures between physical and digital channels and envisioned a unified commerce platform where the store becomes a showroom, fulfilment hub, and community space.',
  keyFindings: [
    { title: 'Channel Fragmentation is Destroying Loyalty', description: 'Online and in-store operate as separate businesses with different inventory, pricing, and loyalty systems. 34% of customers who buy online never visit stores, and 41% of in-store customers have never used the app.', impact: 'Critical' },
    { title: 'Store Associates Are the Untapped Advantage', description: 'Store staff have deep product knowledge and customer relationships but zero digital tools. They cannot check online stock, access customer purchase history, or process click-and-collect efficiently.', impact: 'High' },
    { title: 'Inventory Blindness Costs £14M Annually', description: 'No single view of stock across 180 stores and 2 warehouses. 23% of online orders show "out of stock" when the item exists in a nearby store. Returns processing takes 14 days vs 3-day industry best practice.', impact: 'Critical' },
    { title: 'Personalisation Gap vs Digital-Native Competitors', description: 'RetailCo sends the same promotions to all 2.8M loyalty members. ASOS and Amazon deliver hyper-personalised recommendations driving 35% of their revenue. RetailCo\'s email open rate is 12% vs 22% industry average.', impact: 'Transformational' },
    { title: 'Store-as-Experience Hub Opportunity', description: 'Stores generating the highest footfall growth (+8%) are those running community events, styling sessions, and click-and-collect. The future store is showroom, fulfilment centre, and community hub — driving 3x the revenue per sq ft.', impact: 'Transformational' },
  ],
  metrics: { participantsEngaged: 12, domainsExplored: 5, insightsGenerated: 156, transformationalIdeas: 24 },
};

const SCRATCHPAD_DISCOVERY_OUTPUT = {
  _aiSummary: 'The discovery data reveals a business at a critical inflection point — caught between the legacy operating model that built RetailCo and the digital-first model its customers increasingly expect. The most striking finding is not the technology gap, but the human one: store associates, the company\'s greatest competitive differentiator, are operating blind while digital-native competitors equip their equivalents with real-time data and AI assistance. Three structural fractures define the challenge: channel fragmentation (online and in-store compete rather than complement), inventory blindness (£14M annual cost of stock misalignment), and loyalty underperformance (1.2M inactive members in a 2.8M base). Each is solvable — but only if RetailCo treats them as symptoms of a single root cause: the absence of a unified data layer.',
  participants: ['Claire Hawkins', 'Raj Mehta', 'Sophie Turner', 'James O\'Brien', 'Fatima Al-Said', 'Tom Whitfield', 'Hannah Price', 'David Okafor'],
  totalUtterances: 1019,
  sections: [
    {
      domain: 'Customer Experience', icon: '🛍️', color: 'blue', utteranceCount: 234,
      topThemes: ['Omnichannel Unification', 'Personalisation Gap', 'Click & Collect Friction', 'Loyalty Programme Failure', 'Returns Experience'],
      wordCloud: [{ word: 'omnichannel', size: 4 }, { word: 'personalisation', size: 4 }, { word: 'loyalty', size: 3 }, { word: 'friction', size: 3 }, { word: 'returns', size: 2 }, { word: 'click-and-collect', size: 3 }, { word: 'NPS', size: 2 }, { word: 'satisfaction', size: 2 }, { word: 'experience', size: 4 }, { word: 'seamless', size: 2 }],
      quotes: [{ text: 'The customer doesn\'t see two businesses — they see one RetailCo. We\'re the only ones confused about which channel they\'re in.', author: 'Chief Customer Officer', sentiment: 'critical' }, { text: 'Our best stores feel like a community — events, styling, conversation. Those are the ones with footfall growth.', author: 'Regional Store Manager', sentiment: 'positive' }],
      sentiment: { optimistic: 35, neutral: 28, concerned: 37 },
      consensusLevel: 78,
    },
    {
      domain: 'People & Culture', icon: '👥', color: 'purple', utteranceCount: 198,
      topThemes: ['Staff Retention Crisis', 'Associate Digital Tooling', 'Change Fatigue', 'Training Investment', 'AI Anxiety'],
      wordCloud: [{ word: 'turnover', size: 4 }, { word: 'training', size: 3 }, { word: 'tools', size: 4 }, { word: 'retention', size: 3 }, { word: 'burnout', size: 2 }, { word: 'culture', size: 2 }, { word: 'empowerment', size: 3 }, { word: 'associates', size: 4 }, { word: 'AI', size: 2 }, { word: 'knowledge', size: 2 }],
      quotes: [{ text: 'Nobody gives us the tools to do a good job and then gets surprised when we leave.', author: 'Store Associate', sentiment: 'critical' }, { text: 'By the time we\'ve trained someone properly, they\'re already looking at their next job.', author: 'Store Manager', sentiment: 'concerned' }],
      sentiment: { optimistic: 20, neutral: 30, concerned: 50 },
      consensusLevel: 85,
    },
    {
      domain: 'Technology & Data', icon: '💻', color: 'green', utteranceCount: 187,
      topThemes: ['Legacy System Fragmentation', 'Single Customer View', 'AI Readiness', 'Integration Complexity', 'Data Quality'],
      wordCloud: [{ word: 'integration', size: 4 }, { word: 'data', size: 4 }, { word: 'legacy', size: 3 }, { word: 'AI', size: 4 }, { word: 'platform', size: 3 }, { word: 'API', size: 2 }, { word: 'real-time', size: 3 }, { word: 'systems', size: 3 }, { word: 'unified', size: 2 }, { word: 'automation', size: 2 }],
      quotes: [{ text: 'We have 14 systems and none of them talk to each other properly. Every integration is a bespoke nightmare.', author: 'IT Infrastructure Lead', sentiment: 'critical' }, { text: 'The data exists — we just can\'t access it in the moment we need it, which makes it useless.', author: 'Head of Digital', sentiment: 'concerned' }],
      sentiment: { optimistic: 30, neutral: 32, concerned: 38 },
      consensusLevel: 72,
    },
    {
      domain: 'Operations', icon: '⚙️', color: 'orange', utteranceCount: 221,
      topThemes: ['Inventory Visibility', 'Contact Centre FCR', 'Returns Processing', 'Click & Collect Process', 'Queue Management'],
      wordCloud: [{ word: 'inventory', size: 4 }, { word: 'stock', size: 4 }, { word: 'resolution', size: 3 }, { word: 'returns', size: 3 }, { word: 'queue', size: 2 }, { word: 'process', size: 3 }, { word: 'efficiency', size: 2 }, { word: 'visibility', size: 4 }, { word: 'automation', size: 2 }, { word: 'fulfilment', size: 3 }],
      quotes: [{ text: 'I can\'t see what\'s in the store down the road, let alone online. We tell customers we\'ll check and they wait 20 minutes.', author: 'Store Associate', sentiment: 'critical' }, { text: 'Seventy percent of our contact volume is driven by five things. Five. And we can fix all of them.', author: 'Contact Centre Manager', sentiment: 'optimistic' }],
      sentiment: { optimistic: 28, neutral: 25, concerned: 47 },
      consensusLevel: 80,
    },
    {
      domain: 'Commercial', icon: '📈', color: 'indigo', utteranceCount: 179,
      topThemes: ['Basket Abandonment', 'Loyalty ROI', 'Competitor Threat', 'Revenue Per Sq Ft', 'Digital Margin'],
      wordCloud: [{ word: 'revenue', size: 4 }, { word: 'loyalty', size: 3 }, { word: 'conversion', size: 3 }, { word: 'margin', size: 3 }, { word: 'competitor', size: 2 }, { word: 'ROI', size: 3 }, { word: 'investment', size: 2 }, { word: 'growth', size: 3 }, { word: 'basket', size: 2 }, { word: 'personalisation', size: 4 }],
      quotes: [{ text: 'ASOS drives 35% of revenue through AI personalisation. We\'re sending the same email to 2.8 million people.', author: 'Loyalty & CRM Manager', sentiment: 'critical' }, { text: 'The stores running events are generating three times the revenue per square foot of our average. That\'s the model.', author: 'Chief Customer Officer', sentiment: 'optimistic' }],
      sentiment: { optimistic: 40, neutral: 30, concerned: 30 },
      consensusLevel: 65,
    },
  ],
};

const SCRATCHPAD_REIMAGINE = {
  _aiSummary: 'The reimagine phase surfaced a compelling and surprisingly coherent vision: RetailCo as a unified intelligent retailer where every touchpoint knows the customer, every associate is empowered, and every store serves as a hub of commerce, community, and fulfilment. The group aligned around three transformational shifts: from channel silos to unified commerce, from mass marketing to AI-powered personalisation, and from reactive contact centre to proactive self-service. The ambition is high — but critically, it is grounded in existing competitive evidence.',
  reimagineContent: {
    title: 'RetailCo Reimagined: The Unified Intelligent Retailer',
    description: 'A vision where physical and digital become one RetailCo — powered by AI, driven by data, and centred on the human moments that retail uniquely delivers.',
    subtitle: 'Where every store associate is a personal shopper and every touchpoint knows who you are',
    supportingSection: {
      title: 'The Three Transformational Shifts',
      description: 'The workshop converged on three shifts that define the journey from today\'s fragmented retailer to tomorrow\'s unified intelligent brand.',
      points: [
        'From channel silos to unified commerce — one inventory, one customer record, one brand experience',
        'From mass marketing to AI-powered personalisation — 2.8M individual relationships, not one broadcast',
        'From reactive contact centre to proactive self-service — resolve issues before they become contacts',
        'From store as point-of-sale to store as community hub — events, styling, and fulfilment in one space',
        'From associate as cashier to associate as personal shopper — equipped with data, empowered to advise',
      ],
    },
    primaryThemes: [
      { title: 'Omnichannel Unification', weighting: 'Raised by 89% of participants', badge: 'CRITICAL', description: 'The most urgent and most agreed-upon priority. Every participant touched on the fragmentation between online and in-store. The vision: one customer record, one inventory view, one seamless journey regardless of channel.', details: ['Unified stock visibility across 180 stores and 2 warehouses', 'Click-and-collect that works first time, every time', 'Returns processed in hours, not 14 days', 'App that connects in-store and online in real time'] },
      { title: 'AI-Powered Personalisation', weighting: 'Named as top commercial priority by 71% of participants', badge: 'CRITICAL', description: 'The loyalty programme has 2.8M members but sends the same message to all of them. The reimagined RetailCo uses purchase history, browsing behaviour, and location data to deliver genuinely personalised offers, recommendations, and experiences.', details: ['AI-driven segmentation replacing batch-and-blast email', 'In-store push notifications based on proximity and purchase history', 'Associate-facing customer history for personalised service', 'Predictive reordering and size recommendations online'] },
      { title: 'Empowered Associates', weighting: 'Cited as most impactful people investment by 65% of participants', badge: 'PRIMARY', description: 'Store associates are RetailCo\'s greatest competitive advantage over digital-native retailers — but they\'re operating blind. Give them a tablet with customer history, real-time stock, and AI-assisted recommendations and they become personal shoppers, not cashiers.', details: ['Associate tablet with real-time stock across all stores and online', 'Customer purchase history at the point of interaction', 'AI-suggested upsell and cross-sell prompts', 'Mobile payment processing to end queue formation'] },
    ],
  },
};

const SCRATCHPAD_CONSTRAINTS = {
  _aiSummary: 'The constraints phase revealed that the biggest barriers to transformation are not technological but organisational: the institutional scepticism from the failed chatbot, staff change fatigue, and the political tension between digital and physical investment priorities. The technology constraints (14 legacy systems, no single customer data record) are real but solvable — they require sequencing and investment, not innovation. The organisational constraints require leadership courage, communication, and genuine co-design with frontline associates.',
  regulatory: [
    { title: 'GDPR Data Architecture Requirements', description: 'Any unified customer data layer must be architected with privacy-by-design. Consent management across loyalty, eCommerce, and in-store systems is complex given the current fragmented data landscape.', impact: 'High', mitigation: 'Engage DPO at architecture stage; implement consent management platform before data layer unification.' },
    { title: 'Payment Card Industry (PCI-DSS) Compliance', description: 'Unified commerce and mobile payment expansion increases PCI-DSS scope. Associate mobile payment devices require compliance certification.', impact: 'Medium', mitigation: 'Use certified payment tokenisation vendors; exclude cardholder data from the customer data layer.' },
  ],
  technical: [
    { title: 'Legacy POS and ERP Integration Complexity', description: '14 disconnected systems require a phased integration strategy. A "big bang" replacement is high risk and high cost. Any AI or personalisation capability requires data from these systems.', impact: 'Critical', mitigation: 'Implement a middleware integration layer (API gateway) as Phase 1 foundation before building consumer-facing capability on top.' },
    { title: 'Data Quality and Completeness', description: 'Customer data across systems is inconsistent — duplicate records, missing email addresses, inconsistent product taxonomies. Personalisation algorithms require clean, unified data to function.', impact: 'High', mitigation: 'Data cleansing and deduplication programme to run in parallel with integration architecture. Start with loyalty data as the highest-value dataset.' },
  ],
  commercial: [
    { title: 'ROI Proof Requirement Before Full Investment', description: 'The board has approved £8M with a requirement for phased business case validation. Full deployment depends on Phase 1 demonstrating measurable ROI within 6 months.', impact: 'High', mitigation: 'Design Phase 1 with clear, measurable metrics (FCR, NPS, basket size) and instrument everything for rapid reporting.' },
    { title: 'Competing Internal Investment Priorities', description: 'Store estate refurbishment, supply chain optimisation, and digital transformation are competing for the same budget envelope. Prioritisation will be politically contested.', impact: 'Medium', mitigation: 'Frame digital transformation as enabling all other investment priorities — better data enables better property decisions, better supply chain, better operations.' },
  ],
  organizational: [
    { title: 'Institutional Scepticism from Failed Chatbot', description: 'The 2024 chatbot implementation failed publicly, investing £4.2M before being scaled back. This has created legitimate scepticism in Operations and among frontline staff that AI projects can deliver.', impact: 'Critical', mitigation: 'Launch with a proof-of-concept approach in 2-3 stores. Share results transparently before expanding. Involve Operations team in design, not just delivery.' },
    { title: 'Staff Change Fatigue', description: '28% annual turnover means transformation projects land on an ever-changing workforce. Change fatigue is real — associates are sceptical of initiatives that disrupt without improving their daily reality.', impact: 'High', mitigation: 'Co-design with frontline associates from the start. Make associate benefit the primary narrative — "this makes your job easier" before "this improves our metrics".' },
  ],
};

const SCRATCHPAD_POTENTIAL_SOLUTION = {
  _aiSummary: 'The solution architecture that emerged from the workshop centres on a three-layer transformation: a unified data foundation (the intelligence layer), an empowered workforce layer (associates and agents as the service differentiator), and an AI-powered personalisation layer (the commercial engine). The sequencing is critical — you cannot personalise without unified data, and you cannot empower associates without the right data layer underneath them. Phase 1 must be the data and integration foundation, not the AI features.',
  overview: 'A phased transformation that builds from the inside out: starting with the unified data layer that makes everything else possible, then empowering the workforce with tools and AI assistance, and finally deploying consumer-facing AI personalisation and self-service at scale. The approach is proof-of-concept first, scale second — learning from the chatbot failure.',
  enablers: [
    { title: 'Unified Customer Data Platform', domain: 'Technology & Data', priority: 'HIGH', description: 'A single customer record linking loyalty, eCommerce, POS, and contact centre data. The foundation for every other capability.', dependencies: ['Legacy system API layer', 'Consent management platform', 'Data cleansing programme'] },
    { title: 'Associate Intelligence Tablet', domain: 'People & Culture', priority: 'HIGH', description: 'Mobile device giving store associates real-time stock visibility, customer history, AI-assisted recommendations, and mobile payment capability.', dependencies: ['Unified Customer Data Platform', 'Real-time inventory API', 'Associate training programme'] },
    { title: 'Contact Centre AI Co-Pilot', domain: 'Operations', priority: 'HIGH', description: 'AI assistant surfacing customer history, order data, and suggested resolutions for contact centre agents in real time — without replacing them.', dependencies: ['Unified Customer Data Platform', 'CRM integration', 'Agent training'] },
    { title: 'AI Personalisation Engine', domain: 'Customer Experience', priority: 'MEDIUM', description: 'Machine learning models driving personalised offers, recommendations, and communications across email, app, and in-store push notifications.', dependencies: ['Unified Customer Data Platform', '12 months of clean unified data', 'A/B testing infrastructure'] },
    { title: 'Proactive Self-Service Portal', domain: 'Operations', priority: 'MEDIUM', description: 'Customer-facing self-service for order tracking, returns initiation, and contact deflection — eliminating the 5 root causes driving 71% of contact volume.', dependencies: ['Order management API', 'Returns automation system', 'Contact centre integration'] },
  ],
  implementationPath: [
    { phase: 'Phase 1: Foundation (0-6 months)', timeframe: '6 months', actions: ['Deploy API integration layer connecting POS, eCommerce, and loyalty', 'Implement consent management platform', 'Launch associate tablet pilot in 8 stores with stock visibility and customer history', 'Instrument all channels for data capture'], outcomes: ['Single inventory view across pilot stores', 'Associate NPS uplift in pilot stores', 'Baseline data quality metrics established', 'Contact centre pilot with customer data surfacing'] },
    { phase: 'Phase 2: Scale (6-12 months)', timeframe: '6 months', actions: ['Roll out associate tablet to all 180 stores', 'Launch contact centre AI co-pilot to all agents', 'Deploy self-service portal for order tracking and returns', 'Begin AI personalisation with loyalty segment targeting'], outcomes: ['FCR improvement from 58% to 72%+', 'Staff turnover reduction in associate roles', '40% contact deflection via self-service', 'Email open rate improvement from 12% to 18%+'] },
    { phase: 'Phase 3: Intelligence (12-24 months)', timeframe: '12 months', actions: ['Launch full AI personalisation engine across all 2.8M loyalty members', 'Expand AI-assisted contact handling to complex query types', 'Implement predictive inventory management', 'Roll out community events programme across 50 pilot stores'], outcomes: ['35%+ of loyalty revenue driven by AI personalisation', 'NPS improvement of 12+ points', 'Inventory accuracy of 97%+', 'Store footfall growth of 8%+ in community hub pilot stores'] },
  ],
};

const SCRATCHPAD_CUSTOMER_JOURNEY = {
  _aiSummary: 'The customer journey map reveals that RetailCo\'s pain points are concentrated in two critical moments: the Fulfilment & Service zone (click-and-collect failures, 14-day returns, 58% FCR) and the Loyalty & Retention zone (batch marketing, inactive members, no personalisation). These are also the zones where competitor advantage is most acute. The journey redesign focuses on transforming these two zones first, as they have the highest friction, the clearest fix, and the most measurable impact on NPS and retention.',
  stages: ['Awareness & Discovery', 'Browse & Research', 'Purchase Decision', 'Fulfilment & Service', 'Post-Purchase Contact', 'Retention & Loyalty'],
  actors: [
    { name: 'Customer', role: 'End consumer across all channels' },
    { name: 'Store Associate', role: 'Front-line team member' },
    { name: 'Contact Centre Agent', role: 'Phone and chat support' },
    { name: 'Digital Platform', role: 'Website, app, and eCommerce systems' },
    { name: 'Operations', role: 'Fulfilment, inventory, and logistics' },
  ],
  interactions: [
    { actor: 'Customer', stage: 'Awareness & Discovery', action: 'Searches for product online or discovers via social media', sentiment: 'neutral', context: 'Customer enters via Google, social ad, or word of mouth. RetailCo\'s SEO and social presence is inconsistent.', isPainPoint: false, isMomentOfTruth: false },
    { actor: 'Digital Platform', stage: 'Browse & Research', action: 'Shows product availability — often inaccurate between online and in-store', sentiment: 'concerned', context: '23% of products show "out of stock" online when they exist in a nearby store. Basket abandonment at 73%.', isPainPoint: true, isMomentOfTruth: true },
    { actor: 'Store Associate', stage: 'Browse & Research', action: 'Attempts to check stock or answer product question without system access', sentiment: 'concerned', context: 'Associate cannot check online stock or other stores. Calls warehouse. Customer waits 20 minutes.', isPainPoint: true, isMomentOfTruth: false },
    { actor: 'Customer', stage: 'Purchase Decision', action: 'Chooses between in-store purchase, online checkout, or click-and-collect', sentiment: 'neutral', context: 'Checkout conversion is reasonable but basket abandonment online is 73% — primarily due to uncertainty about stock and delivery.', isPainPoint: false, isMomentOfTruth: false },
    { actor: 'Operations', stage: 'Fulfilment & Service', action: 'Processes click-and-collect order — 23% have a problem at collection', sentiment: 'critical', context: 'Collection desk cannot see order status or inventory. 1 in 4 customers has a problem when they arrive to collect.', isPainPoint: true, isMomentOfTruth: true },
    { actor: 'Contact Centre Agent', stage: 'Post-Purchase Contact', action: 'Handles customer query without visibility of order history or CRM data', sentiment: 'critical', context: 'Agent cannot see customer\'s previous orders, purchase history, or prior contact history. 42% of contacts require a callback. FCR is 58%.', isPainPoint: true, isMomentOfTruth: false },
    { actor: 'Operations', stage: 'Post-Purchase Contact', action: 'Processes return — currently takes 14 days vs 3-day industry standard', sentiment: 'critical', context: '£14M in working capital locked up in slow returns processing. Customer dissatisfaction peaks here.', isPainPoint: true, isMomentOfTruth: false },
    { actor: 'Digital Platform', stage: 'Retention & Loyalty', action: 'Sends same promotional email to all 2.8M loyalty members', sentiment: 'concerned', context: 'Batch-and-blast email at 12% open rate vs 22% industry average. 1.2M members have not engaged in 12+ months.', isPainPoint: true, isMomentOfTruth: false },
    { actor: 'Customer', stage: 'Retention & Loyalty', action: 'Decides whether to return based on their total experience', sentiment: 'neutral', context: 'Loyalty is earned at the moments that mattered — primarily Fulfilment and Post-Purchase. Fixing those two zones is the fastest path to retention improvement.', isPainPoint: false, isMomentOfTruth: true },
  ],
  painPointSummary: 'Five critical pain points dominate the RetailCo customer journey: stock information unreliability, click-and-collect failure rate (1 in 4 orders), 14-day returns processing, contact centre blind resolution (58% FCR), and personalisation failure in the loyalty programme. All five are linked by a single root cause — the absence of a unified data layer.',
  momentOfTruthSummary: 'Two moments define customer loyalty at RetailCo: the Browse & Research moment (when stock information is unavailable or inaccurate) and the Fulfilment moment (when click-and-collect fails). Fix these two moments and NPS recovery follows.',
};

const SCRATCHPAD_SUMMARY = {
  _aiSummary: 'RetailCo is at a decisive moment. The transformation from fragmented legacy retailer to unified intelligent brand is not only possible — it is necessary. The competitive window is 18-24 months before the gap with digital-native competitors becomes structurally irreversible. The path is clear, the investment is approved, and the organisation has the talent to deliver it. The only question is sequencing and courage.',
  keyFindings: [
    { category: 'Strategic Imperative', findings: ['Omnichannel unification is not optional — it is the foundation for every other capability', 'The associate is RetailCo\'s greatest competitive differentiator over digital-native rivals', 'AI personalisation is proven at scale by competitors — RetailCo has the data, it needs the architecture'] },
    { category: 'Root Causes', findings: ['14 disconnected legacy systems create the inventory blindness, loyalty failure, and contact centre frustration simultaneously', 'Staff turnover at 28% is a symptom of poor tooling and lack of empowerment, not just pay', 'The failed chatbot created institutional scepticism that must be managed explicitly in the transformation approach'] },
    { category: 'Transformation Priorities', findings: ['Phase 1: Unified data layer and associate tablet — the foundation and the quick win', 'Phase 2: Contact centre AI co-pilot and self-service portal — the efficiency gains', 'Phase 3: AI personalisation at scale — the commercial engine'] },
  ],
  recommendedNextSteps: [
    { step: 'Approve Phase 1 Architecture and Budget', timeframe: '2 weeks', owner: 'CCO + CDO', actions: ['Present Phase 1 business case to board', 'Approve middleware integration layer investment', 'Confirm associate tablet vendor selection'] },
    { step: 'Launch Associate Tablet Pilot', timeframe: '8 weeks', owner: 'Head of Digital + Regional Operations', actions: ['Select 8 pilot stores across 3 regions', 'Deploy real-time stock and customer history module', 'Train associates and capture NPS and satisfaction data'] },
    { step: 'Begin Data Unification Programme', timeframe: '12 weeks', owner: 'IT Infrastructure Lead + CDO', actions: ['Appoint systems integrator for API layer', 'Initiate GDPR-compliant data cleansing programme', 'Deploy consent management platform across all touchpoints'] },
  ],
  successMetrics: [
    { metric: 'First Contact Resolution', baseline: '58%', target: '72%', measurement: 'Contact centre system — monthly reporting' },
    { metric: 'Staff Turnover (Associates)', baseline: '28%', target: '20%', measurement: 'HR system — quarterly reporting' },
    { metric: 'Loyalty Email Open Rate', baseline: '12%', target: '20%', measurement: 'CRM platform — campaign-level reporting' },
    { metric: 'Click & Collect Issue Rate', baseline: '23%', target: '5%', measurement: 'Operations dashboard — weekly reporting' },
    { metric: 'Customer NPS', baseline: '31', target: '45', measurement: 'Monthly customer survey panel' },
  ],
};

const SCRATCHPAD_COMMERCIAL = {
  _aiSummary: 'The commercial case for RetailCo\'s transformation is compelling and defensible. With a £8M investment over 24 months, the modelled ROI across FCR improvement, loyalty revenue uplift, inventory working capital release, and staff turnover reduction delivers a payback period of 14 months and a 5-year NPV of £24M. The downside risk is managed through the phased approach — Phase 1 must demonstrate FCR improvement and associate NPS uplift before Phase 2 investment is triggered.',
  investmentSummary: { totalInvestment: '£8M', fiveYearROI: '300%', paybackPeriod: '14 months', annualSavings: '£5.2M by Year 2' },
  deliveryPhases: [
    { phase: 'Phase 1: Foundation (0-6 months)', duration: '6 months', investment: '£2.5M', scope: ['API integration layer', 'Associate tablet pilot (8 stores)', 'Consent management platform', 'Data cleansing programme'], outcomes: ['Single inventory view', 'Associate NPS uplift', 'FCR baseline improvement'] },
    { phase: 'Phase 2: Scale (6-12 months)', duration: '6 months', investment: '£3.5M', scope: ['Associate tablet rollout (180 stores)', 'Contact centre AI co-pilot', 'Customer self-service portal', 'AI personalisation pilot'], outcomes: ['FCR: 58% → 72%', '40% contact deflection', 'Email open rate: 12% → 18%'] },
    { phase: 'Phase 3: Intelligence (12-24 months)', duration: '12 months', investment: '£2M', scope: ['Full AI personalisation engine', 'Predictive inventory management', 'Community hub store pilot (50 stores)', 'Advanced analytics platform'], outcomes: ['NPS: 31 → 45', 'Loyalty revenue uplift £8.4M', 'Footfall growth 8% in hub stores'] },
  ],
  riskAssessment: [
    { risk: 'Phase 1 integration underestimated', probability: 'Medium', impact: 'High', mitigation: 'Appoint experienced systems integrator; build 25% contingency into integration timeline' },
    { risk: 'Associate adoption resistance', probability: 'Medium', impact: 'Critical', mitigation: 'Co-design tablet UX with associates; make associate benefit the primary narrative' },
    { risk: 'Board loses confidence before Phase 2', probability: 'Low', impact: 'Critical', mitigation: 'Instrument Phase 1 for rapid reporting; present progress monthly at board level' },
  ],
};

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔧 Patching retail demo workshop...\n');

  // 1. Patch workshop fields
  console.log('1️⃣  Updating workshop record (clientName, industry, prepResearch, etc.)...');
  await prisma.workshop.update({
    where: { id: WORKSHOP_ID },
    data: {
      clientName: 'RetailCo UK',
      industry: 'Retail',
      companyWebsite: 'https://www.retailco.co.uk',
      dreamTrack: 'ENTERPRISE',
      prepResearch: PREP_RESEARCH as any,
      customQuestions: CUSTOM_QUESTIONS as any,
      discoveryQuestions: DISCOVERY_QUESTIONS as any,
      blueprint: BLUEPRINT as any,
      discoverAnalysis: DISCOVER_ANALYSIS as any,
    },
  });
  console.log('   ✅ Workshop fields updated\n');

  // 2. Upsert scratchpad (using raw SQL to avoid Prisma column-sync issues)
  console.log('2️⃣  Upserting scratchpad with full RetailCo content...');
  const cuid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  await prisma.$executeRaw`
    INSERT INTO workshop_scratchpads (
      id, "workshopId", version,
      "execSummary", "discoveryOutput", "reimagineContent", "constraintsContent",
      "potentialSolution", "customerJourney", "summaryContent", "commercialContent",
      status, "createdAt", "updatedAt"
    ) VALUES (
      ${cuid()}, ${WORKSHOP_ID}, 1,
      ${JSON.stringify(SCRATCHPAD_EXEC_SUMMARY)}::jsonb,
      ${JSON.stringify(SCRATCHPAD_DISCOVERY_OUTPUT)}::jsonb,
      ${JSON.stringify(SCRATCHPAD_REIMAGINE)}::jsonb,
      ${JSON.stringify(SCRATCHPAD_CONSTRAINTS)}::jsonb,
      ${JSON.stringify(SCRATCHPAD_POTENTIAL_SOLUTION)}::jsonb,
      ${JSON.stringify(SCRATCHPAD_CUSTOMER_JOURNEY)}::jsonb,
      ${JSON.stringify(SCRATCHPAD_SUMMARY)}::jsonb,
      ${JSON.stringify(SCRATCHPAD_COMMERCIAL)}::jsonb,
      'PUBLISHED', now(), now()
    )
    ON CONFLICT ("workshopId") DO UPDATE SET
      "execSummary"        = EXCLUDED."execSummary",
      "discoveryOutput"    = EXCLUDED."discoveryOutput",
      "reimagineContent"   = EXCLUDED."reimagineContent",
      "constraintsContent" = EXCLUDED."constraintsContent",
      "potentialSolution"  = EXCLUDED."potentialSolution",
      "customerJourney"    = EXCLUDED."customerJourney",
      "summaryContent"     = EXCLUDED."summaryContent",
      "commercialContent"  = EXCLUDED."commercialContent",
      status               = 'PUBLISHED',
      "updatedAt"          = now()
  `;
  console.log('   ✅ Scratchpad upserted\n');

  console.log('✅ Retail demo patch complete!\n');
  console.log('Pages now populated:');
  console.log('  → /prep          — Client Context, Research, Questions all filled');
  console.log('  → /invite        — Discovery questions populated');
  console.log('  → /discovery     — Discover Analysis (alignment, tensions, constraints)');
  console.log('  → /scratchpad    — All 7 tabs populated with RetailCo content');
  console.log('  → /hemisphere    — Snapshot already seeded ✓');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
