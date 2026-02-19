/**
 * Seed a realistic LiveWorkshopSnapshot for the retail demo workshop.
 *
 * This creates hemisphere node data that the hemisphere/synthesise endpoint
 * can process through GPT-4o to generate scratchpad content.
 *
 * Usage: npx tsx scripts/seed-retail-snapshot.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WORKSHOP_ID = 'retail-cx-workshop';

// ── Participants ───────────────────────────────────────────────

const participants = [
  { id: 'claire', name: 'Claire Hawkins', role: 'Chief Customer Officer' },
  { id: 'raj', name: 'Raj Mehta', role: 'Head of Digital' },
  { id: 'sophie', name: 'Sophie Turner', role: 'Regional Store Manager' },
  { id: 'james', name: 'James O\'Brien', role: 'Supply Chain Director' },
  { id: 'fatima', name: 'Fatima Al-Said', role: 'Loyalty & CRM Manager' },
  { id: 'tom', name: 'Tom Whitfield', role: 'Store Associate (Top Performer)' },
  { id: 'hannah', name: 'Hannah Price', role: 'eCommerce Manager' },
  { id: 'david', name: 'David Okafor', role: 'Head of Merchandising' },
  { id: 'emily', name: 'Emily Chen', role: 'Customer Insights Analyst' },
  { id: 'marcus', name: 'Marcus Williams', role: 'IT Infrastructure Lead' },
  { id: 'sarah', name: 'Sarah Blackwood', role: 'Visual Merchandising Lead' },
  { id: 'peter', name: 'Peter Donaldson', role: 'Finance Director' },
];

// ── Utterances with full agentic metadata ──────────────────────

interface NodeDef {
  rawText: string;
  speakerId: string;
  phase: string;
  primaryType: string;
  confidence: number;
  keywords: string[];
  domains: Array<{ domain: string; relevance: number; reasoning: string }>;
  themes: Array<{ label: string; category: string; confidence: number; reasoning: string }>;
  actors: Array<{
    name: string;
    role: string;
    interactions: Array<{ withActor: string; action: string; sentiment: string; context: string }>;
  }>;
  semanticMeaning: string;
  sentimentTone: string;
}

const utterances: NodeDef[] = [
  // ── CUSTOMER EXPERIENCE domain ──────────────────────────────
  {
    rawText: "A customer walks in holding their phone showing a product from our website and asks if we have it. Our store team can't even look it up — they have to physically walk around the shop floor. It's embarrassing in 2026.",
    speakerId: 'sophie',
    phase: 'REIMAGINE',
    primaryType: 'CONSTRAINT',
    confidence: 0.92,
    keywords: ['stock lookup', 'mobile', 'store experience', 'omnichannel'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.95, reasoning: 'Describes a broken in-store customer interaction' },
      { domain: 'Technology', relevance: 0.7, reasoning: 'Lack of digital tools for store associates' },
    ],
    themes: [{ label: 'Channel fragmentation', category: 'Constraint', confidence: 0.9, reasoning: 'Online and offline disconnected' }],
    actors: [
      { name: 'Store Associate', role: 'Front-line staff', interactions: [{ withActor: 'Customer', action: 'Cannot look up online stock', sentiment: 'frustrated', context: 'No digital tools available on shop floor' }] },
    ],
    semanticMeaning: 'Store associates lack the digital tools to bridge online and in-store customer expectations, creating embarrassing service gaps.',
    sentimentTone: 'frustrated',
  },
  {
    rawText: "Our returns process is broken. Online returns to store take 14 days to credit. Customers return in-store, then buy the same item online because the store can't exchange for a different size from another branch. We're literally pushing people to competitors.",
    speakerId: 'claire',
    phase: 'REIMAGINE',
    primaryType: 'CONSTRAINT',
    confidence: 0.95,
    keywords: ['returns', 'refund', 'exchange', 'cross-store', 'competitor'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.95, reasoning: 'Returns process directly impacts customer satisfaction' },
      { domain: 'Operations & Supply Chain', relevance: 0.8, reasoning: 'Stock visibility and logistics failure' },
    ],
    themes: [{ label: 'Returns friction', category: 'Constraint', confidence: 0.93, reasoning: '14-day refund cycle is uncompetitive' }],
    actors: [
      { name: 'Customer', role: 'Buyer', interactions: [{ withActor: 'Store Associate', action: 'Returns online purchase in store', sentiment: 'frustrated', context: '14-day wait for credit, no cross-store exchange' }] },
    ],
    semanticMeaning: 'The disconnected returns process forces customers into competitor channels and creates brand damage.',
    sentimentTone: 'concerned',
  },
  {
    rawText: "We send 2.8 million people the same email every Tuesday. ASOS knows what I browsed last night and shows me those exact items when I open the app. We're bringing a knife to a gunfight on personalisation.",
    speakerId: 'fatima',
    phase: 'REIMAGINE',
    primaryType: 'OPPORTUNITY',
    confidence: 0.91,
    keywords: ['personalisation', 'email', 'ASOS', 'browsing data', 'CRM'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.9, reasoning: 'Personalisation gap vs competitors' },
      { domain: 'Technology', relevance: 0.75, reasoning: 'Requires Customer Data Platform' },
    ],
    themes: [{ label: 'Personalisation gap', category: 'Opportunity', confidence: 0.92, reasoning: 'Massive competitive disadvantage in targeted marketing' }],
    actors: [
      { name: 'Loyalty Member', role: 'Customer', interactions: [{ withActor: 'Marketing System', action: 'Receives generic untargeted emails', sentiment: 'disengaged', context: '12% open rate vs industry 22%' }] },
    ],
    semanticMeaning: 'RetailCo is losing customer engagement to digitally-native competitors who deliver hyper-personalised experiences.',
    sentimentTone: 'frustrated',
  },
  {
    rawText: "The stores running community events — Saturday styling sessions, kids' craft mornings, seasonal workshops — are seeing footfall up 8% while the rest decline 3%. The store of the future isn't a shop, it's a destination.",
    speakerId: 'sarah',
    phase: 'REIMAGINE',
    primaryType: 'VISIONARY',
    confidence: 0.94,
    keywords: ['community', 'events', 'footfall', 'experience', 'destination'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.9, reasoning: 'Redefining the store as experience hub' },
      { domain: 'People & Culture', relevance: 0.6, reasoning: 'New role for associates as community leaders' },
    ],
    themes: [{ label: 'Store as destination', category: 'Aspiration', confidence: 0.95, reasoning: 'Evidence-backed vision for store transformation' }],
    actors: [
      { name: 'Store Team', role: 'Event organisers', interactions: [{ withActor: 'Community', action: 'Hosts styling sessions and workshops', sentiment: 'positive', context: '8% footfall growth in event-running stores' }] },
    ],
    semanticMeaning: 'Stores that function as community destinations outperform traditional retail formats, pointing to the future model.',
    sentimentTone: 'optimistic',
  },
  {
    rawText: "34% of our online customers have never set foot in a store. 41% of in-store customers have never opened the app. We're running two separate businesses that happen to share a logo.",
    speakerId: 'emily',
    phase: 'REIMAGINE',
    primaryType: 'INSIGHT',
    confidence: 0.93,
    keywords: ['channel separation', 'online', 'in-store', 'segmentation'],
    domains: [{ domain: 'Customer Experience', relevance: 0.95, reasoning: 'Quantifies the channel fragmentation problem' }],
    themes: [{ label: 'Two separate businesses', category: 'Constraint', confidence: 0.94, reasoning: 'Data shows customers exist in silos' }],
    actors: [],
    semanticMeaning: 'The customer base is bifurcated along channel lines, preventing omnichannel value creation.',
    sentimentTone: 'analytical',
  },

  // ── OPERATIONS & SUPPLY CHAIN domain ────────────────────────
  {
    rawText: "We have 180 stores acting as 180 separate warehouses with no visibility between them. A customer in Manchester can't buy a jacket that's sitting in 3 Birmingham stores 90 miles away. That's £14M in lost sales annually.",
    speakerId: 'james',
    phase: 'REIMAGINE',
    primaryType: 'CONSTRAINT',
    confidence: 0.96,
    keywords: ['inventory', 'visibility', 'lost sales', '£14M', 'cross-store'],
    domains: [
      { domain: 'Operations & Supply Chain', relevance: 0.95, reasoning: 'Core inventory visibility failure' },
      { domain: 'Customer Experience', relevance: 0.7, reasoning: 'Customers see out-of-stock when items exist nearby' },
    ],
    themes: [{ label: 'Inventory blindness', category: 'Constraint', confidence: 0.96, reasoning: 'Quantified £14M annual impact' }],
    actors: [
      { name: 'Supply Chain', role: 'Operations', interactions: [{ withActor: 'Stores', action: 'Cannot share stock visibility', sentiment: 'frustrated', context: '180 stores with separate inventory systems' }] },
    ],
    semanticMeaning: 'Lack of unified inventory across the store network creates massive lost sales and customer frustration.',
    sentimentTone: 'frustrated',
  },
  {
    rawText: "Ship-from-store could turn every branch into a mini fulfilment centre. Zara does this brilliantly — 60% of their online orders ship from the nearest store. Our network could offer same-day delivery to 78% of UK postcodes.",
    speakerId: 'hannah',
    phase: 'REIMAGINE',
    primaryType: 'VISIONARY',
    confidence: 0.93,
    keywords: ['ship-from-store', 'fulfilment', 'Zara', 'same-day delivery', 'network'],
    domains: [{ domain: 'Operations & Supply Chain', relevance: 0.95, reasoning: 'Store network as fulfilment advantage' }],
    themes: [{ label: 'Ship-from-store', category: 'Aspiration', confidence: 0.93, reasoning: 'Leveraging physical network for last-mile delivery' }],
    actors: [
      { name: 'Store Network', role: 'Fulfilment', interactions: [{ withActor: 'Online Customer', action: 'Ships orders from nearest store', sentiment: 'positive', context: 'Same-day delivery covering 78% of UK postcodes' }] },
    ],
    semanticMeaning: 'The physical store network is an untapped fulfilment asset that could enable competitive same-day delivery.',
    sentimentTone: 'optimistic',
  },
  {
    rawText: "We mark down £42M of stock annually because we can't move it between stores fast enough. AI-powered demand forecasting and automated transfers could cut that by 40%, saving £17M in margin erosion.",
    speakerId: 'david',
    phase: 'REIMAGINE',
    primaryType: 'OPPORTUNITY',
    confidence: 0.94,
    keywords: ['markdown', '£42M', 'demand forecasting', 'AI', 'automated transfers', '£17M saving'],
    domains: [{ domain: 'Operations & Supply Chain', relevance: 0.95, reasoning: 'Markdown reduction through AI and logistics' }],
    themes: [{ label: 'Markdown optimisation', category: 'Opportunity', confidence: 0.94, reasoning: '£17M saving opportunity quantified' }],
    actors: [],
    semanticMeaning: 'AI demand forecasting and automated inter-store transfers could recover £17M in currently lost margin.',
    sentimentTone: 'optimistic',
  },
  {
    rawText: "RFID would give us real-time stock accuracy of 98% vs our current 72%. Every major competitor has deployed it. We're making decisions on inventory data that's 3 days old.",
    speakerId: 'james',
    phase: 'REIMAGINE',
    primaryType: 'ENABLER',
    confidence: 0.92,
    keywords: ['RFID', 'stock accuracy', '98%', '72%', 'real-time', 'competitor'],
    domains: [
      { domain: 'Operations & Supply Chain', relevance: 0.9, reasoning: 'RFID as stock accuracy enabler' },
      { domain: 'Technology', relevance: 0.75, reasoning: 'Technology investment required' },
    ],
    themes: [{ label: 'RFID deployment', category: 'Enabler', confidence: 0.92, reasoning: 'Critical infrastructure for unified inventory' }],
    actors: [],
    semanticMeaning: 'RFID is table-stakes technology that competitors have deployed, enabling real-time inventory decisions.',
    sentimentTone: 'concerned',
  },

  // ── PEOPLE & CULTURE domain ─────────────────────────────────
  {
    rawText: "I know our products inside out — I can tell you the fabric weight, the fit difference between our slim and regular, which colours sell best. But I have zero tools to help me. Give me a tablet with customer history and stock data and I'll double my conversion rate.",
    speakerId: 'tom',
    phase: 'REIMAGINE',
    primaryType: 'OPPORTUNITY',
    confidence: 0.93,
    keywords: ['product knowledge', 'tablet', 'customer history', 'stock data', 'conversion'],
    domains: [
      { domain: 'People & Culture', relevance: 0.9, reasoning: 'Associate empowerment through digital tools' },
      { domain: 'Technology', relevance: 0.75, reasoning: 'Mobile POS requirement' },
    ],
    themes: [{ label: 'Associate empowerment', category: 'Opportunity', confidence: 0.93, reasoning: 'Deep expertise amplified by technology' }],
    actors: [
      { name: 'Store Associate', role: 'Product expert', interactions: [{ withActor: 'Customer', action: 'Provides expert product advice without data support', sentiment: 'frustrated', context: 'Has knowledge but no digital tools' }] },
    ],
    semanticMeaning: 'Store associates have deep product expertise that is underutilised without digital tools to amplify their effectiveness.',
    sentimentTone: 'optimistic',
  },
  {
    rawText: "We lose our best people to Zara and John Lewis because they offer better tools and training. Our associates feel like checkout operators, not retail professionals. The role needs to evolve from 'till monkey' to 'customer advisor'.",
    speakerId: 'sophie',
    phase: 'REIMAGINE',
    primaryType: 'CONSTRAINT',
    confidence: 0.91,
    keywords: ['retention', 'Zara', 'John Lewis', 'career', 'role evolution'],
    domains: [{ domain: 'People & Culture', relevance: 0.95, reasoning: 'Talent retention and role definition' }],
    themes: [{ label: 'Talent drain', category: 'Constraint', confidence: 0.91, reasoning: 'Losing best people to competitors with better tools' }],
    actors: [
      { name: 'Store Associate', role: 'Employee', interactions: [{ withActor: 'Competitor', action: 'Leaves for better-equipped retailers', sentiment: 'frustrated', context: 'No career progression or modern tools' }] },
    ],
    semanticMeaning: 'Competitor advantage in tools and training is creating a talent drain that undermines service quality.',
    sentimentTone: 'concerned',
  },
  {
    rawText: "Store associates earn commission on in-store sales only. If they help a customer who later buys online, they get nothing. The incentive structure actively discourages omnichannel behaviour.",
    speakerId: 'claire',
    phase: 'REIMAGINE',
    primaryType: 'CONSTRAINT',
    confidence: 0.94,
    keywords: ['commission', 'incentives', 'omnichannel', 'misalignment'],
    domains: [
      { domain: 'People & Culture', relevance: 0.9, reasoning: 'Broken incentive structure' },
      { domain: 'Customer Experience', relevance: 0.7, reasoning: 'Incentives create anti-customer behaviour' },
    ],
    themes: [{ label: 'Incentive misalignment', category: 'Constraint', confidence: 0.94, reasoning: 'Commission structure opposes strategic objectives' }],
    actors: [
      { name: 'Store Associate', role: 'Sales', interactions: [{ withActor: 'Online Channel', action: 'Gets zero credit for influenced online sales', sentiment: 'frustrated', context: 'Commission only on till transactions' }] },
    ],
    semanticMeaning: 'The commission structure creates perverse incentives that actively work against the omnichannel strategy.',
    sentimentTone: 'frustrated',
  },
  {
    rawText: "The stores with the best performance are the ones where associates run Instagram content and styling sessions. We should be hiring for personality and product passion, then giving them the tech to amplify it.",
    speakerId: 'sarah',
    phase: 'REIMAGINE',
    primaryType: 'VISIONARY',
    confidence: 0.9,
    keywords: ['Instagram', 'social media', 'styling', 'personality', 'hiring'],
    domains: [{ domain: 'People & Culture', relevance: 0.9, reasoning: 'New model for store associate role and hiring' }],
    themes: [{ label: 'Associate as content creator', category: 'Aspiration', confidence: 0.9, reasoning: 'Social-media-savvy associates drive performance' }],
    actors: [
      { name: 'Store Associate', role: 'Content creator', interactions: [{ withActor: 'Social Media Audience', action: 'Creates engaging product content', sentiment: 'positive', context: 'Best-performing stores have socially active associates' }] },
    ],
    semanticMeaning: 'The highest performing stores leverage associates as micro-influencers, pointing to a new model for the role.',
    sentimentTone: 'optimistic',
  },

  // ── TECHNOLOGY domain ──────────────────────────────────────
  {
    rawText: "We run SAP for finance, Magento for eCommerce, a custom POS from 2014, and spreadsheets for stock transfers. Nothing talks to anything else. We need one platform, not four silos glued together with hope.",
    speakerId: 'marcus',
    phase: 'REIMAGINE',
    primaryType: 'CONSTRAINT',
    confidence: 0.95,
    keywords: ['SAP', 'Magento', 'POS', 'integration', 'silos', 'legacy'],
    domains: [{ domain: 'Technology', relevance: 0.95, reasoning: 'Core platform fragmentation' }],
    themes: [{ label: 'System fragmentation', category: 'Constraint', confidence: 0.95, reasoning: 'Four disconnected platforms with no integration' }],
    actors: [],
    semanticMeaning: 'The technology estate is a patchwork of disconnected systems that prevents unified commerce.',
    sentimentTone: 'frustrated',
  },
  {
    rawText: "A Customer Data Platform would let us finally unify the 2.8M loyalty members with online browsing data and in-store purchase history. Right now, online and offline are different people in our systems.",
    speakerId: 'emily',
    phase: 'REIMAGINE',
    primaryType: 'ENABLER',
    confidence: 0.92,
    keywords: ['CDP', 'customer data', 'loyalty', 'unification', 'browsing data'],
    domains: [
      { domain: 'Technology', relevance: 0.9, reasoning: 'CDP as foundational data platform' },
      { domain: 'Customer Experience', relevance: 0.75, reasoning: 'Enables personalisation' },
    ],
    themes: [{ label: 'Customer Data Platform', category: 'Enabler', confidence: 0.92, reasoning: 'Foundation for customer unification' }],
    actors: [
      { name: 'Loyalty Member', role: 'Customer', interactions: [{ withActor: 'Data Systems', action: 'Exists as two separate identities online vs in-store', sentiment: 'neutral', context: '2.8M profiles that could be unified' }] },
    ],
    semanticMeaning: 'A CDP is the foundational enabler for unifying customer identity and enabling personalisation.',
    sentimentTone: 'optimistic',
  },
  {
    rawText: "Our tech debt is crippling. Every new feature takes 6 months because we're working around a POS system that hasn't been updated since 2017. Competitors deploy weekly. We deploy quarterly if we're lucky.",
    speakerId: 'raj',
    phase: 'REIMAGINE',
    primaryType: 'CONSTRAINT',
    confidence: 0.93,
    keywords: ['tech debt', 'POS', 'deployment speed', 'competitors', 'agility'],
    domains: [{ domain: 'Technology', relevance: 0.95, reasoning: 'Tech debt impacting delivery speed' }],
    themes: [{ label: 'Tech debt paralysis', category: 'Constraint', confidence: 0.93, reasoning: '6-month feature cycle vs competitors weekly' }],
    actors: [],
    semanticMeaning: 'Legacy tech debt creates a massive agility gap versus digitally-native competitors.',
    sentimentTone: 'concerned',
  },
  {
    rawText: "Mobile POS would transform the in-store experience. Associates could check out customers anywhere on the floor, check stock at other locations, and pull up purchase history — all from a tablet. No more queuing at tills.",
    speakerId: 'tom',
    phase: 'REIMAGINE',
    primaryType: 'VISIONARY',
    confidence: 0.91,
    keywords: ['mobile POS', 'tablet', 'checkout', 'queue elimination', 'stock lookup'],
    domains: [
      { domain: 'Technology', relevance: 0.85, reasoning: 'Mobile POS technology' },
      { domain: 'Customer Experience', relevance: 0.8, reasoning: 'Transforms in-store experience' },
    ],
    themes: [{ label: 'Mobile-first store', category: 'Aspiration', confidence: 0.91, reasoning: 'Mobile POS eliminates fixed tills and queues' }],
    actors: [
      { name: 'Store Associate', role: 'Advisor', interactions: [{ withActor: 'Customer', action: 'Completes transaction anywhere on floor', sentiment: 'positive', context: 'No fixed till dependency, seamless checkout' }] },
    ],
    semanticMeaning: 'Mobile POS technology would fundamentally transform the in-store experience from queue-based to floor-based service.',
    sentimentTone: 'optimistic',
  },

  // ── REGULATION & COMPLIANCE domain ─────────────────────────
  {
    rawText: "Unifying customer data across channels means combining consent from different touchpoints. GDPR requires explicit consent for each purpose. We can't just merge online and in-store profiles without proper legal basis.",
    speakerId: 'emily',
    phase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
    confidence: 0.92,
    keywords: ['GDPR', 'consent', 'data unification', 'legal basis', 'privacy'],
    domains: [{ domain: 'Regulation & Compliance', relevance: 0.95, reasoning: 'GDPR compliance for data unification' }],
    themes: [{ label: 'GDPR consent challenge', category: 'Constraint', confidence: 0.92, reasoning: 'Legal barrier to customer profile merging' }],
    actors: [],
    semanticMeaning: 'GDPR creates a legal barrier to the customer data unification that personalisation depends on.',
    sentimentTone: 'concerned',
  },
  {
    rawText: "The new CSRD sustainability reporting requirements mean we need full supply chain traceability by 2027. Our current systems can't even tell us where 40% of our products are manufactured.",
    speakerId: 'james',
    phase: 'CONSTRAINTS',
    primaryType: 'RISK',
    confidence: 0.91,
    keywords: ['CSRD', 'sustainability', 'traceability', 'supply chain', '2027 deadline'],
    domains: [
      { domain: 'Regulation & Compliance', relevance: 0.95, reasoning: 'CSRD compliance deadline' },
      { domain: 'Operations & Supply Chain', relevance: 0.7, reasoning: 'Supply chain transparency required' },
    ],
    themes: [{ label: 'Sustainability compliance', category: 'Constraint', confidence: 0.91, reasoning: '2027 CSRD deadline with 40% traceability gap' }],
    actors: [],
    semanticMeaning: 'A hard regulatory deadline requires supply chain traceability that current systems cannot provide.',
    sentimentTone: 'concerned',
  },
  {
    rawText: "Consumer Rights Act gives customers 30-day return rights. Our 14-day processing time is a brand disaster waiting to happen. Customers post on social media about waiting 3 weeks for a refund.",
    speakerId: 'claire',
    phase: 'CONSTRAINTS',
    primaryType: 'RISK',
    confidence: 0.93,
    keywords: ['Consumer Rights Act', 'returns', '30-day', 'refund', 'social media', 'brand risk'],
    domains: [
      { domain: 'Regulation & Compliance', relevance: 0.85, reasoning: 'Consumer Rights Act compliance risk' },
      { domain: 'Customer Experience', relevance: 0.8, reasoning: 'Returns experience creating brand damage' },
    ],
    themes: [{ label: 'Returns compliance risk', category: 'Constraint', confidence: 0.93, reasoning: '14-day processing vs 30-day statutory right' }],
    actors: [
      { name: 'Customer', role: 'Returning buyer', interactions: [{ withActor: 'RetailCo', action: 'Posts social media complaints about refund delays', sentiment: 'critical', context: '14-day refund processing time' }] },
    ],
    semanticMeaning: 'The gap between statutory return rights and actual processing time is creating regulatory and reputational risk.',
    sentimentTone: 'concerned',
  },
  {
    rawText: "Our website accessibility score is 62/100. The Equality Act requires reasonable adjustments. If we're going digital-first, the digital experience must be accessible to everyone — that's not optional.",
    speakerId: 'raj',
    phase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
    confidence: 0.9,
    keywords: ['accessibility', 'Equality Act', 'digital-first', 'WCAG', 'inclusive'],
    domains: [
      { domain: 'Regulation & Compliance', relevance: 0.9, reasoning: 'Equality Act accessibility requirements' },
      { domain: 'Technology', relevance: 0.7, reasoning: 'Website accessibility score' },
    ],
    themes: [{ label: 'Digital accessibility gap', category: 'Constraint', confidence: 0.9, reasoning: '62/100 accessibility score is non-compliant' }],
    actors: [],
    semanticMeaning: 'A digital-first strategy must be inclusive, and the current accessibility gap is both a legal and ethical failure.',
    sentimentTone: 'concerned',
  },

  // ── ADDITIONAL CROSS-DOMAIN INSIGHTS ───────────────────────
  {
    rawText: "Unified commerce platform replaces four siloed systems with one view of inventory, customers, and orders. This is the single biggest enabler — everything else depends on it.",
    speakerId: 'marcus',
    phase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
    confidence: 0.95,
    keywords: ['unified commerce', 'platform', 'single view', 'foundation'],
    domains: [
      { domain: 'Technology', relevance: 0.95, reasoning: 'Core platform architecture' },
      { domain: 'Operations & Supply Chain', relevance: 0.8, reasoning: 'Enables unified inventory' },
    ],
    themes: [{ label: 'Unified commerce platform', category: 'Enabler', confidence: 0.95, reasoning: 'Foundational technology for all other initiatives' }],
    actors: [],
    semanticMeaning: 'A unified commerce platform is the prerequisite for every other transformation initiative.',
    sentimentTone: 'confident',
  },
  {
    rawText: "The board needs to see payback within 18 months. Phase 1 quick wins — RFID in top 40 stores and ship-from-store in 20 locations — can show measurable ROI within 8 months.",
    speakerId: 'peter',
    phase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
    confidence: 0.92,
    keywords: ['payback', '18 months', 'quick wins', 'RFID', 'ship-from-store', 'ROI'],
    domains: [
      { domain: 'Operations & Supply Chain', relevance: 0.8, reasoning: 'Phased deployment approach' },
      { domain: 'Technology', relevance: 0.6, reasoning: 'Investment justification' },
    ],
    themes: [{ label: 'Phased ROI approach', category: 'Enabler', confidence: 0.92, reasoning: 'Quick wins build board confidence for full investment' }],
    actors: [
      { name: 'Board', role: 'Decision makers', interactions: [{ withActor: 'Programme Team', action: 'Requires 18-month payback proof', sentiment: 'neutral', context: 'Capital constrained after declining margins' }] },
    ],
    semanticMeaning: 'A phased approach with early measurable wins is critical to securing board support for the full programme.',
    sentimentTone: 'pragmatic',
  },
  {
    rawText: "Online and store teams have separate P&Ls and compete for the same customer. Store managers see online as cannibalising their sales. We need a unified P&L under one customer officer.",
    speakerId: 'claire',
    phase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
    confidence: 0.94,
    keywords: ['P&L', 'channel rivalry', 'unified', 'customer officer', 'internal competition'],
    domains: [
      { domain: 'People & Culture', relevance: 0.9, reasoning: 'Organisational structure barrier' },
      { domain: 'Customer Experience', relevance: 0.7, reasoning: 'Internal rivalry impacts customer experience' },
    ],
    themes: [{ label: 'Channel rivalry', category: 'Constraint', confidence: 0.94, reasoning: 'Separate P&Ls create internal competition' }],
    actors: [
      { name: 'Store Manager', role: 'P&L owner', interactions: [{ withActor: 'eCommerce Team', action: 'Perceives online as cannibalisation threat', sentiment: 'hostile', context: 'Separate P&L creates zero-sum competition' }] },
    ],
    semanticMeaning: 'Separate channel P&Ls create structural barriers to omnichannel collaboration.',
    sentimentTone: 'frustrated',
  },
  {
    rawText: "Two previous digital transformation attempts were abandoned mid-implementation. Staff are sceptical. We need to start with visible quick wins that associates experience directly — tablets, not strategy decks.",
    speakerId: 'sophie',
    phase: 'CONSTRAINTS',
    primaryType: 'RISK',
    confidence: 0.91,
    keywords: ['change fatigue', 'failed initiatives', 'scepticism', 'quick wins', 'tangible'],
    domains: [{ domain: 'People & Culture', relevance: 0.95, reasoning: 'Change management challenge' }],
    themes: [{ label: 'Change fatigue', category: 'Constraint', confidence: 0.91, reasoning: 'Two failed transformations create deep scepticism' }],
    actors: [
      { name: 'Store Associates', role: 'Change recipients', interactions: [{ withActor: 'Management', action: 'Sceptical of another transformation programme', sentiment: 'resistant', context: 'Two previous failures abandoned mid-implementation' }] },
    ],
    semanticMeaning: 'Historical transformation failures have created deep organisational scepticism that must be addressed through tangible early delivery.',
    sentimentTone: 'cautious',
  },
  {
    rawText: "Each call to our contact centre costs £6.80. If we automate simple queries through the app — order tracking, return labels, stock checks — we save £3.2M annually and free up agents for complex issues.",
    speakerId: 'hannah',
    phase: 'DEFINE_APPROACH',
    primaryType: 'OPPORTUNITY',
    confidence: 0.91,
    keywords: ['cost per contact', 'automation', 'app', 'self-service', '£3.2M saving'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.8, reasoning: 'Self-service reduces friction' },
      { domain: 'Technology', relevance: 0.7, reasoning: 'App capabilities required' },
    ],
    themes: [{ label: 'Self-service automation', category: 'Opportunity', confidence: 0.91, reasoning: 'Quantified £3.2M saving from app self-service' }],
    actors: [],
    semanticMeaning: 'Automating simple customer queries through digital self-service delivers significant cost savings.',
    sentimentTone: 'optimistic',
  },
  {
    rawText: "Omnichannel customers spend 2.1x more than single-channel customers. If we can convert 20% of single-channel to omnichannel through unified experience, that's £47M in incremental revenue.",
    speakerId: 'fatima',
    phase: 'DEFINE_APPROACH',
    primaryType: 'OPPORTUNITY',
    confidence: 0.93,
    keywords: ['omnichannel', '2.1x multiplier', 'conversion', '£47M', 'revenue'],
    domains: [{ domain: 'Customer Experience', relevance: 0.9, reasoning: 'Omnichannel value proposition' }],
    themes: [{ label: 'Omnichannel revenue uplift', category: 'Opportunity', confidence: 0.93, reasoning: 'Quantified revenue opportunity from channel unification' }],
    actors: [
      { name: 'Omnichannel Customer', role: 'High-value segment', interactions: [{ withActor: 'RetailCo', action: 'Spends 2.1x more across channels', sentiment: 'positive', context: '£47M revenue opportunity from conversion' }] },
    ],
    semanticMeaning: 'The economic case for omnichannel is clear: multi-channel customers are dramatically more valuable.',
    sentimentTone: 'optimistic',
  },
  {
    rawText: "Legacy POS migration must avoid November to January peak trading. We need parallel running for 4 weeks with rollback capability. No big-bang cutover — that's what killed the 2019 initiative.",
    speakerId: 'marcus',
    phase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
    confidence: 0.91,
    keywords: ['POS migration', 'peak trading', 'parallel running', 'rollback', 'phased'],
    domains: [{ domain: 'Technology', relevance: 0.9, reasoning: 'Migration risk management' }],
    themes: [{ label: 'Safe migration approach', category: 'Enabler', confidence: 0.91, reasoning: 'Lessons learned from failed 2019 big-bang cutover' }],
    actors: [],
    semanticMeaning: 'Technical migration must be phased to avoid peak trading disruption and the mistakes of previous attempts.',
    sentimentTone: 'pragmatic',
  },
];

// ── Build snapshot ─────────────────────────────────────────────

async function main() {
  console.log(`Creating snapshot for workshop: ${WORKSHOP_ID}`);

  // Build nodesById
  const nodesById: Record<string, any> = {};
  const baseTime = Date.now() - 3600_000; // 1 hour ago

  for (let i = 0; i < utterances.length; i++) {
    const u = utterances[i];
    const speaker = participants.find(p => p.id === u.speakerId)!;
    const nodeId = `node-${i.toString().padStart(3, '0')}`;

    nodesById[nodeId] = {
      dataPointId: nodeId,
      createdAtMs: baseTime + i * 15_000, // 15s between utterances
      rawText: u.rawText,
      dataPointSource: 'SPEECH',
      speakerId: speaker.id,
      speakerName: speaker.name,
      dialoguePhase: u.phase,
      intent: u.primaryType.toLowerCase(),
      classification: {
        primaryType: u.primaryType,
        confidence: u.confidence,
        keywords: u.keywords,
        suggestedArea: u.domains[0]?.domain || null,
        updatedAt: new Date().toISOString(),
      },
      agenticAnalysis: {
        domains: u.domains,
        themes: u.themes,
        actors: u.actors,
        semanticMeaning: u.semanticMeaning,
        sentimentTone: u.sentimentTone,
        overallConfidence: u.confidence,
      },
    };
  }

  const payload = {
    v: 1,
    dialoguePhase: 'REIMAGINE',
    nodesById,
    selectedNodeId: null,
    themesById: {},
    nodeThemeById: {},
    dependencyEdgesById: {},
    dependencyProcessedIds: [],
    dependencyProcessedCount: 0,
    utterances: utterances.map((u, i) => ({
      rawText: u.rawText,
      createdAtMs: baseTime + i * 15_000,
    })),
    interpreted: utterances.map((u, i) => ({
      rawText: u.rawText,
      createdAtMs: baseTime + i * 15_000,
      classification: {
        primaryType: u.primaryType,
        confidence: u.confidence,
        keywords: u.keywords,
        suggestedArea: u.domains[0]?.domain || null,
        updatedAt: new Date().toISOString(),
      },
    })),
    synthesisByDomain: {},
    pressurePoints: [],
  };

  // Delete any existing snapshots for this workshop
  await (prisma as any).liveWorkshopSnapshot.deleteMany({
    where: { workshopId: WORKSHOP_ID },
  });

  // Create the snapshot
  const snapshot = await (prisma as any).liveWorkshopSnapshot.create({
    data: {
      workshopId: WORKSHOP_ID,
      name: 'RetailCo Discovery & Reimagine Session',
      dialoguePhase: 'REIMAGINE',
      payload,
    },
  });

  console.log(`Snapshot created: ${snapshot.id}`);
  console.log(`Nodes: ${Object.keys(nodesById).length}`);
  console.log(`Phases: REIMAGINE=${utterances.filter(u => u.phase === 'REIMAGINE').length}, CONSTRAINTS=${utterances.filter(u => u.phase === 'CONSTRAINTS').length}, DEFINE_APPROACH=${utterances.filter(u => u.phase === 'DEFINE_APPROACH').length}`);
  console.log(`\nNow click "Generate Report" on the hemisphere page to synthesise the scratchpad.`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
