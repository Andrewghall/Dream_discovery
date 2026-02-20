/**
 * Seed a realistic LiveWorkshopSnapshot for the retail demo workshop.
 * Creates 1000+ hemisphere nodes for a rich, realistic demo.
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

// ── Domain definitions ─────────────────────────────────────────
const DOMAINS = {
  CX: { domain: 'Customer Experience', relevance: 0.9, reasoning: 'Customer-facing impact' },
  OPS: { domain: 'Operations & Supply Chain', relevance: 0.9, reasoning: 'Operational efficiency' },
  PEOPLE: { domain: 'People & Culture', relevance: 0.9, reasoning: 'Workforce impact' },
  TECH: { domain: 'Technology', relevance: 0.85, reasoning: 'Technology dependency' },
  REG: { domain: 'Regulation & Compliance', relevance: 0.9, reasoning: 'Regulatory consideration' },
};

type DomainKey = keyof typeof DOMAINS;

interface Utterance {
  rawText: string;
  speakerId: string;
  phase: string;
  primaryType: string;
  confidence: number;
  keywords: string[];
  domains: DomainKey[];
  themes: string[];
  sentiment: string;
}

// ── Actor definitions for extraction ──────────────────────────
// These are the business roles referenced in the retail workshop utterances
const ACTOR_DEFS: Array<{
  name: string;
  role: string;
  patterns: RegExp[];
}> = [
  { name: 'Customer', role: 'End consumer', patterns: [/\bcustomer/i, /\bshopper/i, /\bbuyer/i, /\bclient/i, /\bconsumer/i, /\bpeople\s+(buy|shop|browse|return|complain)/i] },
  { name: 'Store associate', role: 'Frontline retail staff', patterns: [/\bassociate/i, /\bstore\s*staff/i, /\bstore\s*team/i, /\bfloor\s*staff/i, /\bsales\s*assistant/i, /\bfront[\s-]?line/i] },
  { name: 'Store manager', role: 'Store operations leader', patterns: [/\bstore\s*manager/i, /\bbranch\s*manager/i, /\bmanager/i] },
  { name: 'Supplier', role: 'External goods supplier', patterns: [/\bsupplier/i, /\bvendor/i, /\bmanufacturer/i, /\btier\s*[123]/i] },
  { name: 'Warehouse team', role: 'Fulfilment and logistics', patterns: [/\bwarehouse/i, /\bpicking/i, /\bfulfilment/i, /\bdistribution/i] },
  { name: 'Delivery driver', role: 'Last-mile logistics', patterns: [/\bdriver/i, /\bdelivery/i, /\blast[\s-]?mile/i, /\bcarrier/i, /\bcourier/i] },
  { name: 'Contact centre agent', role: 'Customer service representative', patterns: [/\bcontact\s*centre/i, /\bcall\s*centre/i, /\bcustomer\s*service/i, /\bagent/i, /\bWISMO/i] },
  { name: 'Head office', role: 'Corporate leadership', patterns: [/\bhead\s*office/i, /\bHQ/i, /\bboard/i, /\bexecutive/i, /\bsteering\s*committee/i] },
  { name: 'IT team', role: 'Technology and infrastructure', patterns: [/\bIT\b/, /\bdeveloper/i, /\btech\s*team/i, /\binfrastructure/i, /\bengineering/i] },
  { name: 'Marketing team', role: 'Brand and campaigns', patterns: [/\bmarketing/i, /\bcampaign/i, /\bCRM/i, /\bcreator/i, /\bcontent\s*team/i] },
  { name: 'Finance team', role: 'Financial planning and control', patterns: [/\bfinance/i, /\bbudget/i, /\bP&L/i, /\bROI/i, /\bcost\s*per/i] },
  { name: 'HR team', role: 'People and culture', patterns: [/\bHR\b/i, /\brecruit/i, /\bonboard/i, /\bretention/i, /\btraining\s*programme/i] },
  { name: 'Merchandising team', role: 'Product range and allocation', patterns: [/\bmerchandis/i, /\ballocation/i, /\brange\s*planning/i, /\bbuying\s*team/i] },
  { name: 'Legal & compliance', role: 'Regulatory oversight', patterns: [/\blegal/i, /\bcompliance/i, /\bGDPR/i, /\bregulat/i, /\baudit/i] },
  { name: 'Third-party partner', role: 'External service provider', patterns: [/\bpartner/i, /\bintegrator/i, /\bconsultancy/i, /\boutsoure?c/i] },
];

// Interaction verbs mapped to sentiments
const INTERACTION_PATTERNS: Array<{
  pattern: RegExp;
  action: string;
  sentiment: string;
}> = [
  { pattern: /\b(complain|frustrat|angry|upset)\b/i, action: 'raises complaint', sentiment: 'negative' },
  { pattern: /\b(return|refund|exchange)\b/i, action: 'processes return', sentiment: 'negative' },
  { pattern: /\b(buy|purchas|order|spend)\b/i, action: 'makes purchase', sentiment: 'positive' },
  { pattern: /\b(recommend|suggest|advis)\b/i, action: 'provides recommendation', sentiment: 'positive' },
  { pattern: /\b(wait|queue|delay)\b/i, action: 'experiences wait', sentiment: 'negative' },
  { pattern: /\b(deliver|ship|dispatch|fulfill)\b/i, action: 'fulfils order', sentiment: 'neutral' },
  { pattern: /\b(search|find|discover|browse|look\s*(it\s+)?up)\b/i, action: 'searches for product', sentiment: 'neutral' },
  { pattern: /\b(train|learn|develop|onboard)\b/i, action: 'undergoes training', sentiment: 'neutral' },
  { pattern: /\b(track|monitor|report|analys)\b/i, action: 'monitors performance', sentiment: 'neutral' },
  { pattern: /\b(integrat|connect|sync|unif)\b/i, action: 'integrates systems', sentiment: 'neutral' },
  { pattern: /\b(personaliz|personalisation|recommend)\b/i, action: 'personalises experience', sentiment: 'positive' },
  { pattern: /\b(leave|quit|churn|switch|walk\s*out)\b/i, action: 'leaves or churns', sentiment: 'negative' },
  { pattern: /\b(engage|loyalt|retain|repeat)\b/i, action: 'engages customer', sentiment: 'positive' },
  { pattern: /\b(pick|pack|process)\b/i, action: 'processes order', sentiment: 'neutral' },
  { pattern: /\b(implement|deploy|roll\s*out|launch)\b/i, action: 'implements initiative', sentiment: 'positive' },
];

/** Extract actors mentioned in an utterance text and build structured actor data */
function extractActorsFromText(
  text: string,
  speakerId: string,
  sentiment: string,
): Array<{ name: string; role: string; interactions: Array<{ withActor: string; action: string; sentiment: string; context: string }> }> {
  // Find which actors are mentioned
  const mentioned: Array<{ name: string; role: string }> = [];
  for (const def of ACTOR_DEFS) {
    for (const pat of def.patterns) {
      if (pat.test(text)) {
        mentioned.push({ name: def.name, role: def.role });
        break;
      }
    }
  }

  // If no actors detected, return the speaker as the sole actor with no interactions
  if (mentioned.length === 0) {
    const speaker = participants.find(p => p.id === speakerId);
    if (speaker) {
      return [{ name: speaker.name, role: speaker.role, interactions: [] }];
    }
    return [];
  }

  // Find relevant interaction verbs
  const matchedInteractions: Array<{ action: string; sentiment: string }> = [];
  for (const ip of INTERACTION_PATTERNS) {
    if (ip.pattern.test(text)) {
      matchedInteractions.push({ action: ip.action, sentiment: ip.sentiment });
    }
  }

  // Build actor entries with cross-references
  const result: Array<{ name: string; role: string; interactions: Array<{ withActor: string; action: string; sentiment: string; context: string }> }> = [];

  for (let i = 0; i < mentioned.length; i++) {
    const actor = mentioned[i];
    const interactions: Array<{ withActor: string; action: string; sentiment: string; context: string }> = [];

    // Link to other mentioned actors
    for (let j = 0; j < mentioned.length; j++) {
      if (i === j) continue;
      const inter = matchedInteractions[0] || { action: 'interacts with', sentiment: 'neutral' };
      interactions.push({
        withActor: mentioned[j].name,
        action: inter.action,
        sentiment: inter.sentiment,
        context: text.substring(0, 100),
      });
    }

    // If only one actor, link to the speaker
    if (mentioned.length === 1 && matchedInteractions.length > 0) {
      const speaker = participants.find(p => p.id === speakerId);
      if (speaker) {
        interactions.push({
          withActor: speaker.name,
          action: matchedInteractions[0].action,
          sentiment: matchedInteractions[0].sentiment,
          context: text.substring(0, 100),
        });
      }
    }

    result.push({
      name: actor.name,
      role: actor.role,
      interactions,
    });
  }

  return result;
}

// ── All utterances (1000+) ─────────────────────────────────────
// Organised by domain then phase for readability

const allUtterances: Utterance[] = [

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMER EXPERIENCE - REIMAGINE (~170 utterances)
  // ═══════════════════════════════════════════════════════════════

  // Omnichannel gaps
  { rawText: "A customer walks in holding their phone showing a product from our website and asks if we have it. Our store team can't even look it up — they have to physically walk around the shop floor. It's embarrassing in 2026.", speakerId: 'sophie', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.92, keywords: ['stock lookup', 'mobile', 'store experience', 'omnichannel'], domains: ['CX', 'TECH'], themes: ['Channel fragmentation'], sentiment: 'frustrated' },
  { rawText: "Our returns process is broken. Online returns to store take 14 days to credit. Customers return in-store, then buy the same item online because the store can't exchange for a different size from another branch.", speakerId: 'claire', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.95, keywords: ['returns', 'refund', 'exchange', 'cross-store'], domains: ['CX', 'OPS'], themes: ['Returns friction'], sentiment: 'concerned' },
  { rawText: "We send 2.8 million people the same email every Tuesday. ASOS knows what I browsed last night and shows me those exact items when I open the app. We're bringing a knife to a gunfight on personalisation.", speakerId: 'fatima', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.91, keywords: ['personalisation', 'email', 'ASOS', 'CRM'], domains: ['CX', 'TECH'], themes: ['Personalisation gap'], sentiment: 'frustrated' },
  { rawText: "The stores running community events — Saturday styling sessions, kids' craft mornings — are seeing footfall up 8% while the rest decline 3%. The store of the future isn't a shop, it's a destination.", speakerId: 'sarah', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.94, keywords: ['community', 'events', 'footfall', 'destination'], domains: ['CX', 'PEOPLE'], themes: ['Store as destination'], sentiment: 'optimistic' },
  { rawText: "34% of our online customers have never set foot in a store. 41% of in-store customers have never opened the app. We're running two separate businesses that happen to share a logo.", speakerId: 'emily', phase: 'REIMAGINE', primaryType: 'INSIGHT', confidence: 0.93, keywords: ['channel separation', 'online', 'in-store', 'segmentation'], domains: ['CX'], themes: ['Two separate businesses'], sentiment: 'analytical' },
  { rawText: "Click-and-collect is supposed to be ready in 2 hours. Our average is 4.5 hours. Argos does it in 60 seconds because they built their entire operation around it. We just bolted it on.", speakerId: 'hannah', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.92, keywords: ['click-and-collect', 'speed', 'Argos', 'fulfilment'], domains: ['CX', 'OPS'], themes: ['Click-and-collect failure'], sentiment: 'frustrated' },
  { rawText: "Our loyalty programme gives 1 point per pound spent. Costa gives you a free coffee after 8 purchases. Tesco Clubcard gives you 3x value on partner offers. We need to rethink the entire value proposition.", speakerId: 'fatima', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.89, keywords: ['loyalty', 'rewards', 'Tesco', 'Costa', 'value proposition'], domains: ['CX'], themes: ['Loyalty redesign'], sentiment: 'analytical' },
  { rawText: "I watched a customer try to use our app in-store to scan a barcode and check stock at other locations. The app crashed three times before she gave up and walked out. That's a lost sale and a lost customer.", speakerId: 'tom', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.93, keywords: ['app', 'barcode scanning', 'crash', 'customer loss'], domains: ['CX', 'TECH'], themes: ['App reliability'], sentiment: 'frustrated' },
  { rawText: "Our NPS score dropped from 42 to 31 in the last 12 months. The biggest driver? 'I couldn't find what I was looking for online or in-store.' Discovery is fundamentally broken.", speakerId: 'emily', phase: 'REIMAGINE', primaryType: 'INSIGHT', confidence: 0.94, keywords: ['NPS', 'product discovery', 'search', 'decline'], domains: ['CX'], themes: ['Discovery breakdown'], sentiment: 'concerned' },
  { rawText: "Social commerce is exploding. TikTok Shop did £1.5 billion in the UK last year. Our social presence is a broadcast channel — we post, people scroll past. We need shoppable content, live shopping events, creator partnerships.", speakerId: 'raj', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.90, keywords: ['social commerce', 'TikTok', 'live shopping', 'creators'], domains: ['CX', 'TECH'], themes: ['Social commerce'], sentiment: 'optimistic' },
  { rawText: "Our website search is embarrassingly bad. Search for 'blue dress' and you get blue accessories, dress shoes, and everything except blue dresses. Customers leave because they literally can't find what we sell.", speakerId: 'hannah', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['search', 'relevance', 'UX', 'product discovery'], domains: ['CX', 'TECH'], themes: ['Search failure'], sentiment: 'frustrated' },
  { rawText: "Customers want to start a purchase on their phone, continue in-store with an associate, and complete at home on their laptop. We make that impossible. Each channel is a fresh start.", speakerId: 'claire', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.93, keywords: ['cross-channel', 'basket persistence', 'journey continuity'], domains: ['CX', 'TECH'], themes: ['Journey fragmentation'], sentiment: 'frustrated' },
  { rawText: "The styling advice our best associates give is incredible — customers spend 40% more when they get personalised recommendations from staff. But it's locked in individual heads, not in our systems.", speakerId: 'sarah', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.91, keywords: ['styling', 'personalisation', 'associate knowledge', 'upsell'], domains: ['CX', 'PEOPLE'], themes: ['Knowledge capture'], sentiment: 'optimistic' },
  { rawText: "We don't know when a loyal customer walks into a store. Sephora recognises their Beauty Insiders via the app and surfaces their purchase history, wish list, and tailored recommendations. That's the standard now.", speakerId: 'fatima', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.90, keywords: ['customer recognition', 'Sephora', 'in-store personalisation'], domains: ['CX', 'TECH'], themes: ['In-store recognition'], sentiment: 'analytical' },
  { rawText: "Our checkout queue at peak times averages 7 minutes. Amazon Go has zero checkout. Self-scan is clunky and breaks constantly. We're losing impulse purchases because people see the queue and walk out.", speakerId: 'sophie', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.92, keywords: ['checkout', 'queue', 'Amazon Go', 'self-scan'], domains: ['CX', 'TECH'], themes: ['Checkout friction'], sentiment: 'frustrated' },
  { rawText: "Post-purchase communication is almost non-existent. Customer buys a coat — we should follow up with matching accessories, care tips, and styling ideas. Instead, we send a generic 'thank you' email and nothing else.", speakerId: 'fatima', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.88, keywords: ['post-purchase', 'cross-sell', 'engagement', 'lifecycle'], domains: ['CX'], themes: ['Post-purchase gap'], sentiment: 'analytical' },
  { rawText: "Our customer service team handles 340,000 calls a month. 62% are 'where is my order' queries that could be handled by a simple tracking page. Each call costs £6.80. Do the maths.", speakerId: 'hannah', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.93, keywords: ['contact centre', 'WISMO', 'cost per call', 'self-service'], domains: ['CX', 'TECH'], themes: ['Contact centre cost'], sentiment: 'pragmatic' },
  { rawText: "We need to think about the fitting room as a technology-enabled experience. Smart mirrors that suggest outfits, real-time stock checks, call-for-size buttons. H&M and Nike are already doing this.", speakerId: 'raj', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.88, keywords: ['fitting room', 'smart mirrors', 'H&M', 'Nike'], domains: ['CX', 'TECH'], themes: ['Smart fitting rooms'], sentiment: 'optimistic' },
  { rawText: "Gift registries, wish lists, wedding collections — these high-AOV, high-loyalty features are completely missing from our platform. John Lewis built an entire business around them.", speakerId: 'claire', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.87, keywords: ['gift registry', 'wish list', 'John Lewis', 'AOV'], domains: ['CX'], themes: ['Gift features'], sentiment: 'analytical' },
  { rawText: "Our mobile conversion rate is 1.2% vs desktop at 3.4%. Industry mobile average is 2.1%. The mobile experience is literally costing us millions in lost revenue every month.", speakerId: 'emily', phase: 'REIMAGINE', primaryType: 'INSIGHT', confidence: 0.94, keywords: ['mobile conversion', 'desktop', 'revenue loss'], domains: ['CX', 'TECH'], themes: ['Mobile gap'], sentiment: 'concerned' },
  { rawText: "Customers are telling us they want sustainability information at the point of purchase — fabric origins, carbon footprint, ethical sourcing. 67% of Gen Z say they'd pay more for transparent brands.", speakerId: 'emily', phase: 'REIMAGINE', primaryType: 'INSIGHT', confidence: 0.90, keywords: ['sustainability', 'transparency', 'Gen Z', 'ethical'], domains: ['CX', 'REG'], themes: ['Sustainability demand'], sentiment: 'analytical' },
  { rawText: "The gap between what customers expect and what we deliver is widening every quarter. Amazon sets the bar for delivery, Apple for experience, ASOS for personalisation. We're not competing with other retailers — we're competing with the best digital experience customers have ever had.", speakerId: 'claire', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.95, keywords: ['expectation gap', 'Amazon', 'Apple', 'ASOS', 'digital experience'], domains: ['CX'], themes: ['Rising expectations'], sentiment: 'concerned' },
  { rawText: "Customer complaints about sizing inconsistency are up 34%. The same 'Medium' is different across three of our brands. A virtual sizing tool with AI body scanning could solve this overnight.", speakerId: 'hannah', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.89, keywords: ['sizing', 'inconsistency', 'AI', 'virtual fitting'], domains: ['CX', 'TECH'], themes: ['Sizing problems'], sentiment: 'pragmatic' },
  { rawText: "We have zero visibility on customer lifetime value by channel. I suspect omnichannel customers are 3-4x more valuable but we can't prove it because our data sits in silos.", speakerId: 'emily', phase: 'REIMAGINE', primaryType: 'INSIGHT', confidence: 0.91, keywords: ['CLV', 'channel value', 'data silos', 'omnichannel'], domains: ['CX', 'TECH'], themes: ['CLV blindness'], sentiment: 'frustrated' },
  { rawText: "International visitors make up 12% of our flagship store revenue but we offer zero multilingual support, no tourist tax reclaim integration, no WeChat or Alipay payment options.", speakerId: 'sophie', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.86, keywords: ['international', 'multilingual', 'WeChat', 'Alipay', 'tourist'], domains: ['CX'], themes: ['International gap'], sentiment: 'analytical' },
  { rawText: "Every major competitor has a 'save for later' feature that works across devices. We don't. A customer told me she screenshots items on her phone because our wish list doesn't sync. That's humiliating.", speakerId: 'hannah', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.90, keywords: ['save for later', 'cross-device', 'wish list', 'sync'], domains: ['CX', 'TECH'], themes: ['Cross-device sync'], sentiment: 'frustrated' },
  { rawText: "We should be using geofencing to send personalised offers when loyal customers are within 500m of a store. Starbucks does this and drives 20% of their mobile orders through location-triggered notifications.", speakerId: 'fatima', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.87, keywords: ['geofencing', 'location', 'Starbucks', 'mobile notifications'], domains: ['CX', 'TECH'], themes: ['Location marketing'], sentiment: 'optimistic' },
  { rawText: "Our product imagery is falling behind. Competitors use 360-degree views, video content, and user-generated photos. We still use flat-lay photography from 2020. Conversion rates directly correlate with visual richness.", speakerId: 'sarah', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.88, keywords: ['product imagery', '360 view', 'video', 'UGC', 'conversion'], domains: ['CX'], themes: ['Visual content gap'], sentiment: 'concerned' },
  { rawText: "Customer reviews are hidden three clicks deep on our product pages. Amazon puts them front and centre because they drive conversion. Products with 10+ reviews convert 2.7x higher than those without.", speakerId: 'hannah', phase: 'REIMAGINE', primaryType: 'INSIGHT', confidence: 0.90, keywords: ['reviews', 'social proof', 'conversion', 'Amazon'], domains: ['CX'], themes: ['Review visibility'], sentiment: 'pragmatic' },
  { rawText: "We should create a VIP tier for our top 5% of customers — they generate 38% of revenue. Private shopping events, early access to sales, dedicated styling consultants. Build real relationships, not transactions.", speakerId: 'claire', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.92, keywords: ['VIP', 'tiered loyalty', 'top customers', 'exclusivity'], domains: ['CX'], themes: ['VIP programme'], sentiment: 'optimistic' },

  // Customer Experience - CONSTRAINTS
  { rawText: "Any personalisation initiative must comply with GDPR. We can't just start tracking customers across channels without explicit, informed consent for each processing purpose.", speakerId: 'emily', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.92, keywords: ['GDPR', 'consent', 'tracking', 'personalisation'], domains: ['CX', 'REG'], themes: ['GDPR consent'], sentiment: 'concerned' },
  { rawText: "Budget constraints mean we can't overhaul everything at once. The board approved £3.2M for digital initiatives this year — that's barely enough for one major platform migration, let alone omnichannel transformation.", speakerId: 'peter', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.93, keywords: ['budget', 'investment', 'constraints', 'phasing'], domains: ['CX', 'TECH'], themes: ['Budget limitation'], sentiment: 'pragmatic' },
  { rawText: "Our current customer data architecture is a nightmare — 14 separate databases with different schemas, no single customer ID. Any personalisation effort without data unification first will fail.", speakerId: 'marcus', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.94, keywords: ['data architecture', 'databases', 'customer ID', 'unification'], domains: ['CX', 'TECH'], themes: ['Data fragmentation'], sentiment: 'frustrated' },
  { rawText: "We have contractual obligations with our current eCommerce vendor until 2028. Early termination would cost £1.4M in penalties. We're locked into a platform that's holding us back.", speakerId: 'marcus', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['contract', 'vendor lock-in', 'penalty', 'migration'], domains: ['CX', 'TECH'], themes: ['Vendor lock-in'], sentiment: 'frustrated' },
  { rawText: "Store managers already complain about too many systems. Adding new customer-facing technology without simplifying the existing stack will create resistance and poor adoption.", speakerId: 'sophie', phase: 'CONSTRAINTS', primaryType: 'RISK', confidence: 0.90, keywords: ['system fatigue', 'adoption', 'complexity', 'store managers'], domains: ['CX', 'PEOPLE'], themes: ['Adoption risk'], sentiment: 'concerned' },
  { rawText: "Customer expectations are evolving faster than we can deliver. By the time we implement today's vision, competitors will have moved to the next generation. We need an architecture that can evolve continuously.", speakerId: 'raj', phase: 'CONSTRAINTS', primaryType: 'INSIGHT', confidence: 0.91, keywords: ['pace of change', 'architecture', 'continuous evolution'], domains: ['CX', 'TECH'], themes: ['Speed vs ambition'], sentiment: 'pragmatic' },

  // Customer Experience - DEFINE_APPROACH
  { rawText: "Omnichannel customers spend 2.1x more than single-channel customers. If we can convert 20% of single-channel to omnichannel through unified experience, that's £47M in incremental revenue.", speakerId: 'fatima', phase: 'DEFINE_APPROACH', primaryType: 'OPPORTUNITY', confidence: 0.93, keywords: ['omnichannel', '2.1x multiplier', '£47M', 'revenue'], domains: ['CX'], themes: ['Omnichannel revenue uplift'], sentiment: 'optimistic' },
  { rawText: "Each call to our contact centre costs £6.80. If we automate simple queries through the app — order tracking, return labels, stock checks — we save £3.2M annually and free up agents for complex issues.", speakerId: 'hannah', phase: 'DEFINE_APPROACH', primaryType: 'OPPORTUNITY', confidence: 0.91, keywords: ['cost per contact', 'automation', 'self-service', '£3.2M'], domains: ['CX', 'TECH'], themes: ['Self-service automation'], sentiment: 'optimistic' },
  { rawText: "Phase 1 should focus on fixing the basics: real-time stock visibility online, accurate delivery estimates, and a returns process that doesn't take 14 days. These are hygiene factors, not innovations.", speakerId: 'claire', phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.94, keywords: ['basics', 'stock visibility', 'delivery', 'returns', 'hygiene'], domains: ['CX', 'OPS'], themes: ['Fix the basics first'], sentiment: 'pragmatic' },
  { rawText: "We should pilot personalised recommendations in 10 stores first, measure the uplift, then roll out. Don't try to boil the ocean — prove value with a controlled experiment.", speakerId: 'peter', phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.90, keywords: ['pilot', 'personalisation', 'controlled experiment', 'measured rollout'], domains: ['CX'], themes: ['Pilot approach'], sentiment: 'pragmatic' },
  { rawText: "A unified customer profile is the foundation everything else depends on. Without it, personalisation, omnichannel journeys, and loyalty all fail. This must be investment priority number one.", speakerId: 'emily', phase: 'DEFINE_APPROACH', primaryType: 'ENABLER', confidence: 0.95, keywords: ['unified profile', 'CDP', 'foundation', 'priority'], domains: ['CX', 'TECH'], themes: ['CDP as foundation'], sentiment: 'confident' },

  // ═══════════════════════════════════════════════════════════════
  // OPERATIONS & SUPPLY CHAIN - REIMAGINE (~140 utterances)
  // ═══════════════════════════════════════════════════════════════

  { rawText: "We have 180 stores acting as 180 separate warehouses with no visibility between them. A customer in Manchester can't buy a jacket that's sitting in 3 Birmingham stores 90 miles away. That's £14M in lost sales annually.", speakerId: 'james', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.96, keywords: ['inventory', 'visibility', 'lost sales', '£14M'], domains: ['OPS', 'CX'], themes: ['Inventory blindness'], sentiment: 'frustrated' },
  { rawText: "Ship-from-store could turn every branch into a mini fulfilment centre. Zara does this brilliantly — 60% of their online orders ship from the nearest store. Our network could offer same-day delivery to 78% of UK postcodes.", speakerId: 'hannah', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.93, keywords: ['ship-from-store', 'fulfilment', 'Zara', 'same-day'], domains: ['OPS'], themes: ['Ship-from-store'], sentiment: 'optimistic' },
  { rawText: "We mark down £42M of stock annually because we can't move it between stores fast enough. AI-powered demand forecasting and automated transfers could cut that by 40%, saving £17M in margin erosion.", speakerId: 'david', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.94, keywords: ['markdown', '£42M', 'demand forecasting', 'AI', '£17M'], domains: ['OPS'], themes: ['Markdown optimisation'], sentiment: 'optimistic' },
  { rawText: "RFID would give us real-time stock accuracy of 98% vs our current 72%. Every major competitor has deployed it. We're making decisions on inventory data that's 3 days old.", speakerId: 'james', phase: 'REIMAGINE', primaryType: 'ENABLER', confidence: 0.92, keywords: ['RFID', 'stock accuracy', '98%', '72%', 'real-time'], domains: ['OPS', 'TECH'], themes: ['RFID deployment'], sentiment: 'concerned' },
  { rawText: "Our warehouse picking accuracy is 94.2%. Amazon's is 99.97%. That 5.8% error rate means 1 in 17 orders has something wrong with it — wrong item, wrong size, missing piece. Each error costs us £12 in handling.", speakerId: 'james', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.93, keywords: ['picking accuracy', 'warehouse', 'errors', 'Amazon'], domains: ['OPS'], themes: ['Warehouse accuracy'], sentiment: 'frustrated' },
  { rawText: "Last-mile delivery costs us £4.80 per parcel. Industry leaders are at £2.90. With 3.2 million parcels annually, that £1.90 gap is £6.1M in excess logistics cost that goes straight off our margin.", speakerId: 'james', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.94, keywords: ['last-mile', 'delivery cost', 'margin', 'logistics'], domains: ['OPS'], themes: ['Delivery cost gap'], sentiment: 'concerned' },
  { rawText: "Our supplier lead times have doubled since COVID. Average is now 14 weeks from order to shelf. Fast fashion competitors like Primark and Zara work on 4-6 week cycles. We're designing for seasons that have already passed.", speakerId: 'david', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.92, keywords: ['lead times', 'COVID', 'Primark', 'Zara', 'speed'], domains: ['OPS'], themes: ['Lead time gap'], sentiment: 'frustrated' },
  { rawText: "Micro-fulfilment centres in our largest stores could reduce last-mile costs by 35% and enable 2-hour delivery windows. Waitrose and Sainsbury's are already piloting this model.", speakerId: 'hannah', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.89, keywords: ['micro-fulfilment', 'rapid delivery', 'Waitrose', 'Sainsbury'], domains: ['OPS'], themes: ['Micro-fulfilment'], sentiment: 'optimistic' },
  { rawText: "Returns logistics are a black hole. We process 2.1 million returns annually. 34% could be resold at full price if processed within 48 hours, but our average processing time is 11 days. That's £8.4M in unnecessary markdowns.", speakerId: 'james', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.94, keywords: ['returns', 'processing time', 'markdown', '£8.4M'], domains: ['OPS'], themes: ['Returns processing'], sentiment: 'pragmatic' },
  { rawText: "We need a control tower — a single dashboard showing real-time inventory across all 180 stores, both warehouses, in-transit stock, and supplier pipeline. Right now, getting a stock position takes a person two days and a spreadsheet.", speakerId: 'james', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.93, keywords: ['control tower', 'dashboard', 'real-time', 'visibility'], domains: ['OPS', 'TECH'], themes: ['Supply chain visibility'], sentiment: 'determined' },
  { rawText: "Our packaging waste is 340 tonnes per year. Customers are posting about excessive packaging on social media. Right-sizing boxes with AI could reduce packaging material by 30% and save £1.2M annually.", speakerId: 'david', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.88, keywords: ['packaging', 'waste', 'sustainability', 'AI', 'right-sizing'], domains: ['OPS', 'REG'], themes: ['Packaging waste'], sentiment: 'pragmatic' },
  { rawText: "We run manual stock counts quarterly. Each one takes 3 days and closes the store to customers. Continuous automated counting with RFID would eliminate stock count closures entirely.", speakerId: 'sophie', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.91, keywords: ['stock counts', 'manual', 'RFID', 'automation', 'store closures'], domains: ['OPS'], themes: ['Stock count automation'], sentiment: 'optimistic' },
  { rawText: "Our allocation algorithm is 8 years old and uses 3 variables. Modern AI-powered allocation considers 40+ variables including local demographics, weather, events, and social trends. We're leaving money on every rail.", speakerId: 'david', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['allocation', 'AI', 'algorithm', 'merchandising'], domains: ['OPS', 'TECH'], themes: ['Allocation intelligence'], sentiment: 'frustrated' },
  { rawText: "Vendor-managed inventory for our top 20 suppliers could reduce stockouts by 45%. They know demand patterns better than we do. Let them manage replenishment directly based on our POS data.", speakerId: 'david', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.87, keywords: ['VMI', 'vendor managed', 'replenishment', 'stockouts'], domains: ['OPS'], themes: ['Vendor collaboration'], sentiment: 'optimistic' },
  { rawText: "Cross-docking at our central warehouse could reduce store delivery times from 72 hours to 24 hours. Product arriving from suppliers goes straight to store-bound pallets without going into racked storage.", speakerId: 'james', phase: 'REIMAGINE', primaryType: 'ENABLER', confidence: 0.90, keywords: ['cross-docking', 'warehouse', 'delivery speed', 'efficiency'], domains: ['OPS'], themes: ['Cross-docking'], sentiment: 'pragmatic' },
  { rawText: "Seasonal inventory buildup ties up £23M in working capital for 3 months. A more agile supply chain with smaller, more frequent orders would free up cash and reduce markdown risk.", speakerId: 'peter', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.92, keywords: ['working capital', 'seasonal', 'agile', 'cash flow'], domains: ['OPS'], themes: ['Working capital'], sentiment: 'pragmatic' },
  { rawText: "We throw away £3.8M of food and perishable goods annually from our home department. Smart expiry tracking and automated markdowns could recover 60% of that loss.", speakerId: 'david', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.88, keywords: ['waste', 'perishables', 'expiry tracking', 'automated markdowns'], domains: ['OPS'], themes: ['Perishable waste'], sentiment: 'pragmatic' },
  { rawText: "Our delivery promise accuracy is 78%. We say 'delivered in 3-5 days' and hit it less than 4 times out of 5. That destroys trust. Every missed promise is a customer who switches to Amazon Prime.", speakerId: 'hannah', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.93, keywords: ['delivery promise', 'accuracy', 'trust', 'Amazon Prime'], domains: ['OPS', 'CX'], themes: ['Delivery reliability'], sentiment: 'frustrated' },

  // Operations - CONSTRAINTS
  { rawText: "The new CSRD sustainability reporting requirements mean we need full supply chain traceability by 2027. Our current systems can't even tell us where 40% of our products are manufactured.", speakerId: 'james', phase: 'CONSTRAINTS', primaryType: 'RISK', confidence: 0.91, keywords: ['CSRD', 'sustainability', 'traceability', '2027'], domains: ['OPS', 'REG'], themes: ['Sustainability compliance'], sentiment: 'concerned' },
  { rawText: "Our warehouse management system is at capacity. Peak season last year caused 3 system crashes resulting in 48 hours of downtime. Any increase in throughput requires platform migration first.", speakerId: 'marcus', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.93, keywords: ['WMS', 'capacity', 'downtime', 'peak season'], domains: ['OPS', 'TECH'], themes: ['WMS capacity'], sentiment: 'concerned' },
  { rawText: "Ship-from-store requires store staff to pick and pack orders, which takes time away from serving customers on the floor. We need dedicated fulfilment capacity if we scale beyond 20 stores.", speakerId: 'sophie', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.90, keywords: ['ship-from-store', 'staffing', 'capacity', 'trade-off'], domains: ['OPS', 'PEOPLE'], themes: ['Fulfilment staffing'], sentiment: 'pragmatic' },
  { rawText: "Our carrier contracts are up for renewal in Q3. This is an opportunity to renegotiate rates and introduce multi-carrier routing, but we need the technology platform to support dynamic carrier selection.", speakerId: 'james', phase: 'CONSTRAINTS', primaryType: 'OPPORTUNITY', confidence: 0.89, keywords: ['carrier contracts', 'multi-carrier', 'renegotiation', 'routing'], domains: ['OPS'], themes: ['Carrier optimisation'], sentiment: 'pragmatic' },
  { rawText: "RFID tagging requires every single item to be tagged at source. That's 45 million items per year. Supplier compliance will be the biggest barrier — our Tier 2 and Tier 3 suppliers lack the capability.", speakerId: 'james', phase: 'CONSTRAINTS', primaryType: 'RISK', confidence: 0.92, keywords: ['RFID', 'supplier compliance', '45 million items', 'tagging'], domains: ['OPS'], themes: ['RFID implementation risk'], sentiment: 'concerned' },
  { rawText: "Cold chain logistics for our food and beauty lines add 40% to delivery costs. We can't just treat all products the same in a ship-from-store model — temperature-controlled products need separate handling.", speakerId: 'james', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.88, keywords: ['cold chain', 'temperature', 'delivery costs', 'food', 'beauty'], domains: ['OPS'], themes: ['Cold chain complexity'], sentiment: 'pragmatic' },

  // Operations - DEFINE_APPROACH
  { rawText: "The board needs to see payback within 18 months. Phase 1 quick wins — RFID in top 40 stores and ship-from-store in 20 locations — can show measurable ROI within 8 months.", speakerId: 'peter', phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.92, keywords: ['payback', '18 months', 'RFID', 'ship-from-store', 'ROI'], domains: ['OPS', 'TECH'], themes: ['Phased ROI approach'], sentiment: 'pragmatic' },
  { rawText: "Start with RFID in the top 40 stores that account for 52% of revenue. Prove the accuracy and loss prevention benefits, then roll out to remaining stores in Phase 2.", speakerId: 'james', phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.93, keywords: ['RFID rollout', 'top 40 stores', 'phased', 'revenue'], domains: ['OPS'], themes: ['Phased RFID rollout'], sentiment: 'confident' },
  { rawText: "We should benchmark our supply chain KPIs against Inditex and H&M quarterly. Not to copy them, but to understand the gap and track whether we're closing it.", speakerId: 'david', phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.87, keywords: ['benchmarking', 'Inditex', 'H&M', 'KPIs'], domains: ['OPS'], themes: ['Competitive benchmarking'], sentiment: 'pragmatic' },

  // ═══════════════════════════════════════════════════════════════
  // PEOPLE & CULTURE - REIMAGINE (~110 utterances)
  // ═══════════════════════════════════════════════════════════════

  { rawText: "I know our products inside out — I can tell you the fabric weight, the fit difference between our slim and regular. But I have zero tools to help me. Give me a tablet with customer history and stock data and I'll double my conversion rate.", speakerId: 'tom', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.93, keywords: ['product knowledge', 'tablet', 'customer history', 'conversion'], domains: ['PEOPLE', 'TECH'], themes: ['Associate empowerment'], sentiment: 'optimistic' },
  { rawText: "We lose our best people to Zara and John Lewis because they offer better tools and training. Our associates feel like checkout operators, not retail professionals.", speakerId: 'sophie', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['retention', 'Zara', 'John Lewis', 'career', 'role evolution'], domains: ['PEOPLE'], themes: ['Talent drain'], sentiment: 'concerned' },
  { rawText: "Store associates earn commission on in-store sales only. If they help a customer who later buys online, they get nothing. The incentive structure actively discourages omnichannel behaviour.", speakerId: 'claire', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.94, keywords: ['commission', 'incentives', 'omnichannel', 'misalignment'], domains: ['PEOPLE', 'CX'], themes: ['Incentive misalignment'], sentiment: 'frustrated' },
  { rawText: "The stores with the best performance are the ones where associates run Instagram content and styling sessions. We should be hiring for personality and product passion.", speakerId: 'sarah', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.90, keywords: ['Instagram', 'social media', 'styling', 'hiring'], domains: ['PEOPLE'], themes: ['Associate as creator'], sentiment: 'optimistic' },
  { rawText: "Our store manager training programme hasn't been updated in 5 years. It teaches how to manage tills and stockrooms. It should teach how to create experiences, manage omnichannel operations, and lead a digitally-enabled team.", speakerId: 'sophie', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['training', 'store managers', 'outdated', 'digital skills'], domains: ['PEOPLE'], themes: ['Training gap'], sentiment: 'frustrated' },
  { rawText: "Average tenure of a store associate is 11 months. Recruitment costs £2,400 per hire. With 40% annual turnover across 2,800 associates, we're spending £2.7M per year just replacing people who leave.", speakerId: 'peter', phase: 'REIMAGINE', primaryType: 'INSIGHT', confidence: 0.93, keywords: ['turnover', 'recruitment cost', 'retention', '£2.7M'], domains: ['PEOPLE'], themes: ['Turnover cost'], sentiment: 'concerned' },
  { rawText: "We need to create a career path that goes from associate to stylist to store experience manager to regional lead. Right now, there's no progression — you're either on the floor or you're a manager. Nothing in between.", speakerId: 'sophie', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.90, keywords: ['career path', 'progression', 'stylist', 'experience manager'], domains: ['PEOPLE'], themes: ['Career pathways'], sentiment: 'optimistic' },
  { rawText: "The gig economy is reshaping retail staffing. We should have a pool of trained flex workers who can be deployed to stores based on demand signals — events, promotions, peak periods. Always the right capacity.", speakerId: 'claire', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.88, keywords: ['gig economy', 'flex workers', 'demand-driven staffing'], domains: ['PEOPLE'], themes: ['Flexible workforce'], sentiment: 'optimistic' },
  { rawText: "Our head office and stores operate as two different cultures. Head office makes decisions without asking stores. Stores implement without understanding the strategy. We need cross-functional squads.", speakerId: 'sophie', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['culture gap', 'head office', 'stores', 'cross-functional'], domains: ['PEOPLE'], themes: ['HQ-store divide'], sentiment: 'frustrated' },
  { rawText: "Digital skills assessment shows 68% of store staff can't use basic data dashboards. Before we roll out any technology, we need a comprehensive digital literacy programme. Technology without capability is waste.", speakerId: 'raj', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.92, keywords: ['digital skills', 'literacy', 'training', 'capability'], domains: ['PEOPLE', 'TECH'], themes: ['Digital literacy gap'], sentiment: 'concerned' },
  { rawText: "Our best associates are local celebrities. Customers ask for them by name. We should be building on that — give them social profiles, let them curate collections, turn them into brand ambassadors.", speakerId: 'sarah', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.89, keywords: ['brand ambassadors', 'local celebrities', 'curated collections'], domains: ['PEOPLE', 'CX'], themes: ['Associate as brand'], sentiment: 'optimistic' },
  { rawText: "We schedule staff based on historical footfall patterns from 2019. The world has changed. We need real-time demand signals — weather, local events, online browsing spikes — feeding into workforce scheduling.", speakerId: 'sophie', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.90, keywords: ['scheduling', 'demand signals', 'real-time', 'workforce'], domains: ['PEOPLE', 'TECH'], themes: ['Smart scheduling'], sentiment: 'pragmatic' },
  { rawText: "Mental health absence in stores has increased 45% since 2022. Associates deal with difficult customers, pressure to hit targets, and uncertainty about the future of retail. We can't transform if our people are burning out.", speakerId: 'claire', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.93, keywords: ['mental health', 'burnout', 'absence', 'wellbeing'], domains: ['PEOPLE'], themes: ['Wellbeing crisis'], sentiment: 'concerned' },
  { rawText: "We need to measure associate success differently. Not just sales per hour, but customer satisfaction, repeat visit rate, social engagement, styling sessions booked. Redefine what 'performance' means.", speakerId: 'claire', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.91, keywords: ['KPIs', 'performance metrics', 'customer satisfaction', 'engagement'], domains: ['PEOPLE'], themes: ['New performance metrics'], sentiment: 'optimistic' },
  { rawText: "Onboarding takes 2 weeks of shadowing with no structured programme. A digital learning platform with gamified modules could get new associates productive in 3 days while maintaining quality.", speakerId: 'sophie', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.89, keywords: ['onboarding', 'digital learning', 'gamification', 'productivity'], domains: ['PEOPLE', 'TECH'], themes: ['Digital onboarding'], sentiment: 'optimistic' },
  { rawText: "Diversity in store management is poor — 82% of store managers are male despite 64% of associates being female. We need targeted development programmes and mentoring to build a diverse pipeline.", speakerId: 'claire', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.90, keywords: ['diversity', 'gender', 'management pipeline', 'mentoring'], domains: ['PEOPLE'], themes: ['Diversity gap'], sentiment: 'concerned' },

  // People - CONSTRAINTS
  { rawText: "Online and store teams have separate P&Ls and compete for the same customer. Store managers see online as cannibalising their sales. We need a unified P&L under one customer officer.", speakerId: 'claire', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.94, keywords: ['P&L', 'channel rivalry', 'unified', 'customer officer'], domains: ['PEOPLE', 'CX'], themes: ['Channel rivalry'], sentiment: 'frustrated' },
  { rawText: "Two previous digital transformation attempts were abandoned mid-implementation. Staff are sceptical. We need to start with visible quick wins that associates experience directly — tablets, not strategy decks.", speakerId: 'sophie', phase: 'CONSTRAINTS', primaryType: 'RISK', confidence: 0.91, keywords: ['change fatigue', 'failed initiatives', 'scepticism', 'quick wins'], domains: ['PEOPLE'], themes: ['Change fatigue'], sentiment: 'cautious' },
  { rawText: "Union negotiations around any change to commission structures will take 6-9 months minimum. We can't just flip to omnichannel incentives overnight. Industrial relations must be handled carefully.", speakerId: 'peter', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.92, keywords: ['union', 'commission', 'negotiations', 'industrial relations'], domains: ['PEOPLE'], themes: ['Union constraints'], sentiment: 'pragmatic' },
  { rawText: "We're competing for tech talent with banks, fintechs, and pure-play tech companies who pay 30-40% more. Our employer brand in technology is weak. Recruitment for digital roles takes 4 months on average.", speakerId: 'marcus', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['tech talent', 'recruitment', 'salary gap', 'employer brand'], domains: ['PEOPLE', 'TECH'], themes: ['Tech talent war'], sentiment: 'concerned' },
  { rawText: "TUPE regulations mean any outsourcing or restructuring of store roles must follow formal consultation processes. This limits how quickly we can reshape the workforce model.", speakerId: 'peter', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.89, keywords: ['TUPE', 'consultation', 'restructuring', 'regulations'], domains: ['PEOPLE', 'REG'], themes: ['TUPE compliance'], sentiment: 'pragmatic' },

  // People - DEFINE_APPROACH
  { rawText: "Launch a 'Digital Champion' programme — select 2 digitally-savvy associates per store to train peers and drive adoption of new tools. Give them a pay supplement and recognition.", speakerId: 'sophie', phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.91, keywords: ['digital champions', 'peer training', 'adoption', 'recognition'], domains: ['PEOPLE'], themes: ['Digital champions'], sentiment: 'optimistic' },
  { rawText: "Pilot the new omnichannel commission model in 10 stores for 6 months. Compare sales, customer satisfaction, and staff retention against control stores before rolling out nationally.", speakerId: 'peter', phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.92, keywords: ['pilot', 'commission model', 'comparison', 'controlled test'], domains: ['PEOPLE'], themes: ['Commission pilot'], sentiment: 'pragmatic' },

  // ═══════════════════════════════════════════════════════════════
  // TECHNOLOGY - REIMAGINE (~130 utterances)
  // ═══════════════════════════════════════════════════════════════

  { rawText: "We run SAP for finance, Magento for eCommerce, a custom POS from 2014, and spreadsheets for stock transfers. Nothing talks to anything else. We need one platform, not four silos glued together with hope.", speakerId: 'marcus', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.95, keywords: ['SAP', 'Magento', 'POS', 'silos', 'integration'], domains: ['TECH'], themes: ['System fragmentation'], sentiment: 'frustrated' },
  { rawText: "A Customer Data Platform would let us finally unify the 2.8M loyalty members with online browsing data and in-store purchase history. Right now, online and offline are different people in our systems.", speakerId: 'emily', phase: 'REIMAGINE', primaryType: 'ENABLER', confidence: 0.92, keywords: ['CDP', 'customer data', 'loyalty', 'unification'], domains: ['TECH', 'CX'], themes: ['Customer Data Platform'], sentiment: 'optimistic' },
  { rawText: "Our tech debt is crippling. Every new feature takes 6 months because we're working around a POS system that hasn't been updated since 2017. Competitors deploy weekly. We deploy quarterly if we're lucky.", speakerId: 'raj', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.93, keywords: ['tech debt', 'POS', 'deployment speed', 'agility'], domains: ['TECH'], themes: ['Tech debt paralysis'], sentiment: 'concerned' },
  { rawText: "Mobile POS would transform the in-store experience. Associates could check out customers anywhere on the floor, check stock at other locations, and pull up purchase history — all from a tablet.", speakerId: 'tom', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.91, keywords: ['mobile POS', 'tablet', 'checkout', 'queue elimination'], domains: ['TECH', 'CX'], themes: ['Mobile-first store'], sentiment: 'optimistic' },
  { rawText: "We spend £3.8M per year on IT maintenance for systems that should be sunset. That's money that could fund innovation. Every pound spent maintaining legacy is a pound not spent on the future.", speakerId: 'marcus', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.93, keywords: ['IT maintenance', 'legacy cost', '£3.8M', 'innovation'], domains: ['TECH'], themes: ['Legacy maintenance cost'], sentiment: 'frustrated' },
  { rawText: "An API-first architecture would let us plug in best-of-breed solutions rather than being locked into monolithic vendors. Headless commerce gives us the flexibility to evolve the frontend without touching the backend.", speakerId: 'raj', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.92, keywords: ['API-first', 'headless', 'composable', 'best-of-breed'], domains: ['TECH'], themes: ['Composable architecture'], sentiment: 'optimistic' },
  { rawText: "Our data warehouse hasn't been refreshed in 18 hours when I check it on Monday morning. Real-time analytics should be the standard. We're making Tuesday's decisions with last week's data.", speakerId: 'emily', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['data warehouse', 'real-time', 'analytics', 'latency'], domains: ['TECH'], themes: ['Data latency'], sentiment: 'frustrated' },
  { rawText: "AI-powered visual search would let customers photograph a product they like — in a magazine, on social media, on a stranger — and find similar items in our catalogue. Pinterest Lens shows it works.", speakerId: 'raj', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.88, keywords: ['visual search', 'AI', 'Pinterest', 'image recognition'], domains: ['TECH', 'CX'], themes: ['Visual search'], sentiment: 'optimistic' },
  { rawText: "We need a single integration layer — an enterprise service bus or event mesh — that all systems publish to and subscribe from. Point-to-point integrations are why every project takes 6 months.", speakerId: 'marcus', phase: 'REIMAGINE', primaryType: 'ENABLER', confidence: 0.93, keywords: ['ESB', 'event mesh', 'integration', 'point-to-point'], domains: ['TECH'], themes: ['Integration layer'], sentiment: 'pragmatic' },
  { rawText: "Cybersecurity is a growing risk. We had 3 attempted breaches last quarter. Moving to cloud-native infrastructure with zero-trust architecture would dramatically improve our security posture.", speakerId: 'marcus', phase: 'REIMAGINE', primaryType: 'RISK', confidence: 0.93, keywords: ['cybersecurity', 'breaches', 'cloud-native', 'zero-trust'], domains: ['TECH', 'REG'], themes: ['Security risk'], sentiment: 'concerned' },
  { rawText: "Generative AI could transform our customer service — intelligent chatbots that understand context, generate personalised product descriptions, create marketing copy. The ROI on GenAI in retail is proven.", speakerId: 'raj', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.90, keywords: ['GenAI', 'chatbot', 'personalisation', 'automation'], domains: ['TECH', 'CX'], themes: ['Generative AI'], sentiment: 'optimistic' },
  { rawText: "Our payment infrastructure doesn't support Apple Pay, Google Pay, or buy-now-pay-later natively. We're forcing customers through a checkout flow designed in 2018. Modern payments should be frictionless.", speakerId: 'raj', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['payments', 'Apple Pay', 'BNPL', 'checkout'], domains: ['TECH', 'CX'], themes: ['Payment modernisation'], sentiment: 'frustrated' },
  { rawText: "Edge computing in stores would enable real-time analytics without latency. Store cameras could track footfall patterns, queue lengths, and dwell times to optimise store layout and staffing in real-time.", speakerId: 'marcus', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.87, keywords: ['edge computing', 'real-time', 'footfall', 'store analytics'], domains: ['TECH'], themes: ['Edge computing'], sentiment: 'optimistic' },
  { rawText: "Our mobile app is built on React Native from 2020. It's slow, crashes frequently, and lacks offline capability. A rebuild using modern frameworks with progressive web app fallback is overdue.", speakerId: 'raj', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['mobile app', 'React Native', 'performance', 'rebuild'], domains: ['TECH', 'CX'], themes: ['App modernisation'], sentiment: 'frustrated' },
  { rawText: "IoT sensors in stores could monitor temperature, humidity, lighting, and footfall automatically. Smart stores that self-optimise their environment based on conditions and occupancy.", speakerId: 'marcus', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.86, keywords: ['IoT', 'sensors', 'smart store', 'environment'], domains: ['TECH'], themes: ['IoT store'], sentiment: 'optimistic' },
  { rawText: "We need to move from annual technology planning to continuous delivery. A product-oriented operating model with dedicated squads for 'search', 'checkout', 'inventory' — each shipping weekly.", speakerId: 'raj', phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.91, keywords: ['continuous delivery', 'product teams', 'agile', 'squads'], domains: ['TECH'], themes: ['Product operating model'], sentiment: 'determined' },

  // Technology - CONSTRAINTS
  { rawText: "Legacy POS migration must avoid November to January peak trading. We need parallel running for 4 weeks with rollback capability. No big-bang cutover — that's what killed the 2019 initiative.", speakerId: 'marcus', phase: 'CONSTRAINTS', primaryType: 'ACTION', confidence: 0.91, keywords: ['POS migration', 'peak trading', 'parallel running', 'rollback'], domains: ['TECH'], themes: ['Safe migration'], sentiment: 'pragmatic' },
  { rawText: "PCI DSS compliance means any system handling payment data needs quarterly security audits. Adding mobile POS means extending our PCI scope significantly — that's £200K in additional compliance costs.", speakerId: 'marcus', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.92, keywords: ['PCI DSS', 'payment', 'compliance', 'audit', 'mobile POS'], domains: ['TECH', 'REG'], themes: ['PCI compliance'], sentiment: 'concerned' },
  { rawText: "Our network bandwidth in 60% of stores can't support real-time cloud applications. Many locations have 20Mbps connections shared across all devices. We need network upgrades before any digital rollout.", speakerId: 'marcus', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.93, keywords: ['network', 'bandwidth', 'infrastructure', 'connectivity'], domains: ['TECH'], themes: ['Network infrastructure'], sentiment: 'concerned' },
  { rawText: "We have 4 developers who understand our legacy POS codebase. Two are approaching retirement. Knowledge transfer is critical and urgent — if they leave, we lose the ability to maintain our core system.", speakerId: 'marcus', phase: 'CONSTRAINTS', primaryType: 'RISK', confidence: 0.94, keywords: ['legacy knowledge', 'developers', 'retirement', 'bus factor'], domains: ['TECH', 'PEOPLE'], themes: ['Knowledge risk'], sentiment: 'concerned' },
  { rawText: "Cloud migration for our on-premise systems requires careful data residency planning. UK customer data must stay in UK data centres under current regulations. Not all cloud providers guarantee this.", speakerId: 'marcus', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.90, keywords: ['cloud migration', 'data residency', 'UK', 'regulations'], domains: ['TECH', 'REG'], themes: ['Data residency'], sentiment: 'pragmatic' },

  // Technology - DEFINE_APPROACH
  { rawText: "Unified commerce platform replaces four siloed systems with one view of inventory, customers, and orders. This is the single biggest enabler — everything else depends on it.", speakerId: 'marcus', phase: 'DEFINE_APPROACH', primaryType: 'ENABLER', confidence: 0.95, keywords: ['unified commerce', 'platform', 'foundation'], domains: ['TECH', 'OPS'], themes: ['Unified commerce platform'], sentiment: 'confident' },
  { rawText: "Adopt a composable commerce architecture — Commercetools or similar — with headless frontend. This gives us the flexibility to swap components without rebuilding the entire stack.", speakerId: 'raj', phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.92, keywords: ['composable', 'Commercetools', 'headless', 'modular'], domains: ['TECH'], themes: ['Composable approach'], sentiment: 'confident' },
  { rawText: "Implement a Customer Data Platform in Phase 1 — this unblocks personalisation, omnichannel analytics, and targeted marketing. Segment or Twilio are strong candidates.", speakerId: 'emily', phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.93, keywords: ['CDP', 'Segment', 'Twilio', 'Phase 1'], domains: ['TECH', 'CX'], themes: ['CDP implementation'], sentiment: 'confident' },

  // ═══════════════════════════════════════════════════════════════
  // REGULATION & COMPLIANCE - REIMAGINE + CONSTRAINTS (~70 utterances)
  // ═══════════════════════════════════════════════════════════════

  { rawText: "Unifying customer data across channels means combining consent from different touchpoints. GDPR requires explicit consent for each purpose. We can't just merge online and in-store profiles without proper legal basis.", speakerId: 'emily', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.92, keywords: ['GDPR', 'consent', 'data unification', 'legal basis'], domains: ['REG'], themes: ['GDPR consent challenge'], sentiment: 'concerned' },
  { rawText: "Consumer Rights Act gives customers 30-day return rights. Our 14-day processing time is a brand disaster waiting to happen. Customers post on social media about waiting 3 weeks for a refund.", speakerId: 'claire', phase: 'CONSTRAINTS', primaryType: 'RISK', confidence: 0.93, keywords: ['Consumer Rights Act', 'returns', '30-day', 'refund'], domains: ['REG', 'CX'], themes: ['Returns compliance'], sentiment: 'concerned' },
  { rawText: "Our website accessibility score is 62/100. The Equality Act requires reasonable adjustments. If we're going digital-first, the digital experience must be accessible to everyone.", speakerId: 'raj', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.90, keywords: ['accessibility', 'Equality Act', 'WCAG'], domains: ['REG', 'TECH'], themes: ['Digital accessibility'], sentiment: 'concerned' },
  { rawText: "The EU Deforestation Regulation affects our supply chain for leather and timber products. We need documented traceability for 15% of our product range by December 2026.", speakerId: 'james', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['deforestation', 'traceability', 'leather', 'timber', 'EU'], domains: ['REG', 'OPS'], themes: ['Deforestation regulation'], sentiment: 'concerned' },
  { rawText: "Modern Slavery Act reporting needs to cover our entire supply chain including sub-contractors. With 340 suppliers across 18 countries, our current audit coverage is only 45%.", speakerId: 'james', phase: 'CONSTRAINTS', primaryType: 'RISK', confidence: 0.91, keywords: ['Modern Slavery Act', 'audit', 'supply chain', 'sub-contractors'], domains: ['REG', 'OPS'], themes: ['Modern slavery compliance'], sentiment: 'concerned' },
  { rawText: "Product safety regulations for children's clothing are becoming stricter. The new UK PSTI Act adds cybersecurity requirements for any connected product we sell — smart watches, fitness trackers.", speakerId: 'emily', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.88, keywords: ['product safety', 'PSTI', 'cybersecurity', 'connected products'], domains: ['REG'], themes: ['Product safety'], sentiment: 'pragmatic' },
  { rawText: "The Digital Markets Act and UK equivalent mean we need to be careful about how we use customer data for our own marketplace listings vs third-party sellers. Self-preferencing is now regulated.", speakerId: 'raj', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.87, keywords: ['Digital Markets Act', 'marketplace', 'self-preferencing', 'regulation'], domains: ['REG', 'TECH'], themes: ['Marketplace regulation'], sentiment: 'pragmatic' },
  { rawText: "Anti-greenwashing regulations mean we can't make sustainability claims without evidence. 'Eco-friendly' and 'sustainable' need quantifiable backing. The CMA has already fined retailers for misleading claims.", speakerId: 'david', phase: 'CONSTRAINTS', primaryType: 'RISK', confidence: 0.92, keywords: ['greenwashing', 'CMA', 'sustainability claims', 'evidence'], domains: ['REG'], themes: ['Anti-greenwashing'], sentiment: 'concerned' },
  { rawText: "Right to repair legislation means we may need to offer repair services or spare parts for certain product categories. This could be an opportunity — repair services drive footfall and loyalty.", speakerId: 'claire', phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.86, keywords: ['right to repair', 'repair services', 'sustainability', 'loyalty'], domains: ['REG', 'CX'], themes: ['Repair opportunity'], sentiment: 'optimistic' },
  { rawText: "Extended Producer Responsibility for packaging means we'll be paying per-tonne fees on all packaging from 2027. Reducing packaging isn't just good sustainability — it's cost avoidance.", speakerId: 'peter', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.89, keywords: ['EPR', 'packaging', 'per-tonne fees', '2027'], domains: ['REG', 'OPS'], themes: ['EPR packaging'], sentiment: 'pragmatic' },
  { rawText: "AI governance frameworks are emerging. The EU AI Act classifies retail recommendation systems as limited risk, but any facial recognition or emotion detection in stores would be high-risk. We need clear AI ethics policies.", speakerId: 'raj', phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.90, keywords: ['AI Act', 'governance', 'ethics', 'facial recognition'], domains: ['REG', 'TECH'], themes: ['AI governance'], sentiment: 'pragmatic' },
  { rawText: "Employment law changes around zero-hours contracts affect our flex workforce model. The Employment Rights Bill gives workers the right to guaranteed hours after 12 weeks. We need to redesign scheduling.", speakerId: 'peter', phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.91, keywords: ['zero-hours', 'Employment Rights Bill', 'guaranteed hours'], domains: ['REG', 'PEOPLE'], themes: ['Employment law changes'], sentiment: 'concerned' },

  // Regulation - DEFINE_APPROACH
  { rawText: "Appoint a Chief Data Officer to own GDPR compliance, data strategy, and AI governance across the business. This role bridges technology, legal, and commercial teams.", speakerId: 'emily', phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.91, keywords: ['CDO', 'GDPR', 'data strategy', 'AI governance'], domains: ['REG', 'TECH'], themes: ['Data governance role'], sentiment: 'pragmatic' },
  { rawText: "Build sustainability traceability into the supply chain platform from day one. Retrofitting compliance is always more expensive than designing it in. Make traceability a core requirement, not a bolt-on.", speakerId: 'james', phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.92, keywords: ['sustainability', 'traceability', 'built-in', 'compliance by design'], domains: ['REG', 'OPS'], themes: ['Compliance by design'], sentiment: 'confident' },
];

// ═══════════════════════════════════════════════════════════════
// Generate additional utterances to reach 1000+ total
// These are programmatic variations that add volume with realistic content
// ═══════════════════════════════════════════════════════════════

const additionalUtteranceTemplates: Array<{
  templates: string[];
  speakerIds: string[];
  phase: string;
  primaryType: string;
  keywords: string[];
  domains: DomainKey[];
  themes: string[];
  sentiments: string[];
}> = [
  // CX additional
  {
    templates: [
      "When I look at our competitor benchmarks for {topic}, we're consistently in the bottom quartile. {competitor} achieves {metric} while we sit at {our_metric}. The gap is widening, not closing.",
      "Customer feedback on {topic} is overwhelmingly negative — {pct}% of complaints in the last quarter mention it specifically. We're bleeding customers because of this.",
      "I spoke to {n} customers last month about {topic}. Every single one said they'd switch to {competitor} if we don't improve within the next {period}.",
      "The data on {topic} is clear — stores that have addressed it see {uplift}% higher footfall and {conversion}% better conversion. The business case writes itself.",
      "Our mystery shopper scores for {topic} dropped {drop} points this quarter. That's the worst decline in any category and it's directly affecting repeat purchase rates.",
      "I've been tracking {topic} metrics for 18 months now. The trend is unmistakable — every month we don't act, we lose another {amount} in potential revenue.",
      "{competitor} launched their {topic} initiative 8 months ago and has already seen {result}. We discussed this in our last strategy session but nothing happened.",
      "The customer panel we ran specifically on {topic} was eye-opening. Customers don't just want improvement — they expect it as table stakes. We're behind the baseline.",
    ],
    speakerIds: ['claire', 'emily', 'fatima', 'hannah', 'sophie', 'tom', 'sarah'],
    phase: 'REIMAGINE',
    primaryType: 'INSIGHT',
    keywords: ['customer insight', 'benchmarking', 'competitor analysis'],
    domains: ['CX'],
    themes: ['Customer insight'],
    sentiments: ['analytical', 'concerned', 'frustrated'],
  },
  // Operations additional
  {
    templates: [
      "The warehouse team processed {n} orders yesterday but {error_pct}% had picking errors. That's {errors} wrong orders going to customers who will then call us, costing £6.80 each.",
      "We've got {amount} worth of dead stock sitting across regional warehouses that hasn't moved in 180 days. Smart liquidation through outlet channels could recover {recovery}% of that value.",
      "Delivery route optimisation could save {pct}% on fuel costs alone — that's {saving} annually. Our drivers currently follow static routes regardless of traffic, weather, or order density.",
      "Inter-store transfer requests take an average of {days} days to fulfill. By the time stock arrives, the demand window has passed. We need automated, overnight transfers.",
      "Supplier quality scores have dropped {pct}% across our Asian manufacturing base. Defect rates on incoming goods are {defect}%, up from {prev}% last year. We're passing the problem to customers.",
      "Our goods-in process takes {hours} hours per delivery. Automated receiving with RFID scanning at the dock doors would cut this to {target} minutes and free up {staff} FTEs.",
      "Peak season capacity planning shows we'll be {pct}% over warehouse capacity by November. Either we secure temporary overflow space now or we'll be turning away orders.",
      "The cost of expedited shipping has increased {pct}% this year. We're spending {amount} on emergency shipments because our regular pipeline can't keep up with demand volatility.",
    ],
    speakerIds: ['james', 'david', 'hannah', 'peter', 'sophie'],
    phase: 'REIMAGINE',
    primaryType: 'CONSTRAINT',
    keywords: ['operations', 'warehouse', 'supply chain', 'efficiency'],
    domains: ['OPS'],
    themes: ['Operational efficiency'],
    sentiments: ['frustrated', 'concerned', 'pragmatic'],
  },
  // People additional
  {
    templates: [
      "Exit interview data shows {pct}% of leavers cite lack of {reason} as their primary motivation for leaving. We're not losing people to competitors — we're pushing them away.",
      "The training budget per associate is £{amount} annually — that's {compare_pct}% below the retail industry average. We're asking people to deliver excellence with minimal investment in their development.",
      "Staff satisfaction surveys show {topic} scoring {score}/10, down from {prev}/10 last year. The correlation between staff satisfaction and customer satisfaction is well documented — this is a revenue problem.",
      "Our top-performing stores share one characteristic — they have managers who invest in their teams. Store {store} has {pct}% lower turnover and {sales_pct}% higher sales because of leadership quality.",
      "We promote people because they're good at selling, not because they're good at managing. {pct}% of new managers receive no management training before their first day leading a team.",
      "The average age of our associates is {age}. Gen Z associates have completely different expectations around purpose, flexibility, and digital tools. Our EVP hasn't evolved to match.",
      "Absenteeism costs us {amount} per store per month. Stores with engaged managers and clear development paths have {pct}% lower absence rates. The solution isn't policy — it's culture.",
      "We ask associates to sell £{target} per hour but give them no real-time visibility on their performance. Gamified dashboards showing individual and team progress would drive a step-change.",
    ],
    speakerIds: ['sophie', 'claire', 'tom', 'sarah', 'peter'],
    phase: 'REIMAGINE',
    primaryType: 'INSIGHT',
    keywords: ['people', 'retention', 'development', 'engagement'],
    domains: ['PEOPLE'],
    themes: ['People insight'],
    sentiments: ['concerned', 'frustrated', 'analytical'],
  },
  // Technology additional
  {
    templates: [
      "System downtime last quarter cost us {hours} hours of trading across {stores} stores. Each hour of downtime costs approximately £{cost_per_hour} in lost sales. That's £{total} directly attributable to infrastructure.",
      "Our API response times average {ms}ms. Best practice for eCommerce is under 200ms. Every 100ms of additional latency reduces conversion by {pct}%. We're literally slow-loading ourselves to death.",
      "The development backlog has {items} items, of which {critical} are marked critical. At our current velocity of {velocity} story points per sprint, the critical items alone would take {months} months.",
      "Integration testing takes {days} days for any cross-system change. Automated testing pipelines could reduce this to {target} hours and enable continuous deployment.",
      "We're paying {amount} annually for software licenses that aren't being fully utilised. A proper software asset management review could save {saving} per year.",
      "Our disaster recovery capability is untested. The last DR drill was {period} ago. If our primary data centre goes down, we estimate {hours} hours to restore operations — that's {cost} in lost revenue.",
      "Technical debt remediation isn't glamorous but it's essential. Every sprint we should allocate {pct}% of capacity to paying down debt. Compound interest works against us in technology too.",
      "The gap between our mobile experience and desktop is growing. Mobile traffic is {mobile_pct}% of total but generates only {revenue_pct}% of revenue. That's a {amount} mobile revenue gap.",
    ],
    speakerIds: ['marcus', 'raj', 'emily', 'hannah'],
    phase: 'REIMAGINE',
    primaryType: 'CONSTRAINT',
    keywords: ['technology', 'infrastructure', 'performance', 'debt'],
    domains: ['TECH'],
    themes: ['Technology constraint'],
    sentiments: ['frustrated', 'concerned', 'pragmatic'],
  },
  // Cross-domain CONSTRAINTS
  {
    templates: [
      "Before we can implement {initiative}, we need to address the dependency on {dependency}. Sequencing matters — getting this wrong means rework and wasted budget.",
      "The timeline for {initiative} assumes {assumption}. If that assumption proves wrong, we're looking at a {delay} delay and £{cost} in additional cost.",
      "Risk assessment for {initiative} shows {count} medium-high risks. The biggest is {top_risk}. Mitigation requires dedicated resource and executive sponsorship.",
      "Stakeholder alignment on {initiative} is only {pct}% based on our latest survey. Without stronger buy-in from {group}, implementation will face resistance at every step.",
      "The regulatory landscape around {topic} is shifting. {body} issued new guidance last month that could affect our approach. Legal review is essential before we proceed.",
      "Change impact assessment shows {initiative} will affect {teams} teams across {locations} locations. The change management effort alone requires {fte} dedicated FTEs.",
    ],
    speakerIds: ['peter', 'claire', 'marcus', 'james', 'raj', 'sophie'],
    phase: 'CONSTRAINTS',
    primaryType: 'RISK',
    keywords: ['risk', 'dependency', 'timeline', 'change management'],
    domains: ['CX', 'OPS', 'TECH', 'PEOPLE'],
    themes: ['Implementation risk'],
    sentiments: ['concerned', 'pragmatic', 'cautious'],
  },
  // Cross-domain DEFINE_APPROACH
  {
    templates: [
      "Success metric for {initiative}: achieve {target} by {timeframe}. Baseline is {baseline}. We measure {frequency} and review with the steering committee monthly.",
      "Quick win for {initiative}: deploy {action} in {scope} within {weeks} weeks. Expected impact: {impact}. Cost: £{cost}. This builds momentum for the larger programme.",
      "Governance for {initiative} needs a dedicated product owner, fortnightly steering committee, and quarterly board update. Without this rigour, it'll drift like the previous two attempts.",
      "We should engage {partner_type} to accelerate {initiative}. Internal capability alone won't deliver at the pace required. Target: shortlist by {date}, decision by {decision_date}.",
    ],
    speakerIds: ['peter', 'claire', 'raj', 'james', 'marcus', 'emily'],
    phase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
    keywords: ['approach', 'governance', 'metrics', 'quick wins'],
    domains: ['CX', 'OPS', 'TECH'],
    themes: ['Approach definition'],
    sentiments: ['confident', 'pragmatic', 'determined'],
  },
];

// Placeholder fill data
const topics = ['omnichannel experience', 'in-store digital tools', 'personalisation', 'product discovery', 'checkout speed', 'delivery reliability', 'returns process', 'loyalty programme', 'mobile experience', 'social commerce', 'sustainability', 'customer service', 'pricing transparency', 'product quality', 'store ambiance'];
const competitors = ['Amazon', 'ASOS', 'Zara', 'John Lewis', 'H&M', 'Next', 'M&S', 'Primark', 'Selfridges', 'Nike'];
const initiatives = ['unified commerce platform', 'RFID rollout', 'ship-from-store', 'CDP implementation', 'mobile POS', 'AI recommendations', 'digital workforce tools', 'supply chain visibility', 'omnichannel loyalty', 'store modernisation'];
const dependencies = ['network infrastructure upgrades', 'data unification', 'POS migration', 'organisational restructure', 'supplier onboarding', 'GDPR consent framework'];
const groups = ['store operations', 'digital team', 'finance', 'supply chain', 'HR', 'merchandising'];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function fillTemplate(template: string, rng: () => number): string {
  return template
    .replace(/\{topic\}/g, topics[Math.floor(rng() * topics.length)])
    .replace(/\{competitor\}/g, competitors[Math.floor(rng() * competitors.length)])
    .replace(/\{initiative\}/g, initiatives[Math.floor(rng() * initiatives.length)])
    .replace(/\{dependency\}/g, dependencies[Math.floor(rng() * dependencies.length)])
    .replace(/\{group\}/g, groups[Math.floor(rng() * groups.length)])
    .replace(/\{metric\}/g, `${Math.floor(rng() * 40 + 60)}%`)
    .replace(/\{our_metric\}/g, `${Math.floor(rng() * 30 + 20)}%`)
    .replace(/\{pct\}/g, `${Math.floor(rng() * 35 + 10)}`)
    .replace(/\{n\}/g, `${Math.floor(rng() * 50 + 10)}`)
    .replace(/\{period\}/g, ['3 months', '6 months', 'a year', 'the next quarter'][Math.floor(rng() * 4)])
    .replace(/\{uplift\}/g, `${Math.floor(rng() * 25 + 8)}`)
    .replace(/\{conversion\}/g, `${Math.floor(rng() * 15 + 5)}`)
    .replace(/\{amount\}/g, `${(rng() * 4 + 0.5).toFixed(1)}M`)
    .replace(/\{drop\}/g, `${Math.floor(rng() * 8 + 3)}`)
    .replace(/\{result\}/g, `${Math.floor(rng() * 30 + 10)}% improvement`)
    .replace(/\{error_pct\}/g, `${(rng() * 5 + 1).toFixed(1)}`)
    .replace(/\{errors\}/g, `${Math.floor(rng() * 200 + 50)}`)
    .replace(/\{recovery\}/g, `${Math.floor(rng() * 40 + 30)}`)
    .replace(/\{saving\}/g, `£${(rng() * 3 + 0.5).toFixed(1)}M`)
    .replace(/\{days\}/g, `${Math.floor(rng() * 10 + 3)}`)
    .replace(/\{hours\}/g, `${Math.floor(rng() * 48 + 4)}`)
    .replace(/\{target\}/g, `${Math.floor(rng() * 30 + 15)}`)
    .replace(/\{staff\}/g, `${Math.floor(rng() * 5 + 2)}`)
    .replace(/\{defect\}/g, `${(rng() * 4 + 1).toFixed(1)}`)
    .replace(/\{prev\}/g, `${(rng() * 2 + 0.5).toFixed(1)}`)
    .replace(/\{reason\}/g, ['career progression', 'digital tools', 'recognition', 'training', 'flexible working'][Math.floor(rng() * 5)])
    .replace(/\{compare_pct\}/g, `${Math.floor(rng() * 30 + 20)}`)
    .replace(/\{score\}/g, `${(rng() * 3 + 4).toFixed(1)}`)
    .replace(/\{store\}/g, `#${Math.floor(rng() * 180 + 1)}`)
    .replace(/\{sales_pct\}/g, `${Math.floor(rng() * 20 + 10)}`)
    .replace(/\{age\}/g, `${Math.floor(rng() * 10 + 22)}`)
    .replace(/\{ms\}/g, `${Math.floor(rng() * 400 + 300)}`)
    .replace(/\{items\}/g, `${Math.floor(rng() * 200 + 80)}`)
    .replace(/\{critical\}/g, `${Math.floor(rng() * 30 + 15)}`)
    .replace(/\{velocity\}/g, `${Math.floor(rng() * 20 + 25)}`)
    .replace(/\{months\}/g, `${Math.floor(rng() * 12 + 6)}`)
    .replace(/\{cost\}/g, `${(rng() * 500 + 100).toFixed(0)}K`)
    .replace(/\{cost_per_hour\}/g, `${Math.floor(rng() * 5000 + 2000)}`)
    .replace(/\{total\}/g, `${(rng() * 2 + 0.3).toFixed(1)}M`)
    .replace(/\{stores\}/g, `${Math.floor(rng() * 40 + 10)}`)
    .replace(/\{mobile_pct\}/g, `${Math.floor(rng() * 15 + 55)}`)
    .replace(/\{revenue_pct\}/g, `${Math.floor(rng() * 10 + 25)}`)
    .replace(/\{teams\}/g, `${Math.floor(rng() * 6 + 3)}`)
    .replace(/\{locations\}/g, `${Math.floor(rng() * 100 + 30)}`)
    .replace(/\{fte\}/g, `${Math.floor(rng() * 3 + 2)}`)
    .replace(/\{count\}/g, `${Math.floor(rng() * 8 + 4)}`)
    .replace(/\{top_risk\}/g, ['integration complexity', 'change resistance', 'vendor delivery', 'budget overrun', 'scope creep'][Math.floor(rng() * 5)])
    .replace(/\{assumption\}/g, ['vendor delivery on time', 'budget approval by Q2', 'network upgrades complete', 'staff training finished'][Math.floor(rng() * 4)])
    .replace(/\{delay\}/g, `${Math.floor(rng() * 4 + 2)}-month`)
    .replace(/\{body\}/g, ['ICO', 'CMA', 'FCA', 'HSE', 'Ofcom'][Math.floor(rng() * 5)])
    .replace(/\{timeframe\}/g, ['Q3 2026', 'Q4 2026', 'H1 2027', 'Year-end 2026'][Math.floor(rng() * 4)])
    .replace(/\{baseline\}/g, ['current state', '2025 benchmark', 'industry average'][Math.floor(rng() * 3)])
    .replace(/\{frequency\}/g, ['weekly', 'fortnightly', 'monthly'][Math.floor(rng() * 3)])
    .replace(/\{action\}/g, ['pilot programme', 'proof of concept', 'MVP', 'trial'][Math.floor(rng() * 4)])
    .replace(/\{scope\}/g, ['10 stores', '5 flagship locations', 'London region', 'top 20 stores'][Math.floor(rng() * 4)])
    .replace(/\{weeks\}/g, `${Math.floor(rng() * 6 + 4)}`)
    .replace(/\{impact\}/g, `${Math.floor(rng() * 20 + 5)}% improvement`)
    .replace(/\{partner_type\}/g, ['a systems integrator', 'a specialist consultancy', 'a technology vendor', 'an implementation partner'][Math.floor(rng() * 4)])
    .replace(/\{date\}/g, 'end of March')
    .replace(/\{decision_date\}/g, 'mid-April')
    .replace(/\{delay\}/g, `${Math.floor(rng() * 4 + 2)}-month`);
}

// Generate additional utterances
const rng = seededRandom(42);
const generated: Utterance[] = [];

for (const tmpl of additionalUtteranceTemplates) {
  // Generate enough from each template group
  const count = Math.floor(rng() * 40 + 130); // 130-170 per group
  for (let i = 0; i < count; i++) {
    const template = tmpl.templates[Math.floor(rng() * tmpl.templates.length)];
    const text = fillTemplate(template, rng);
    const speakerId = tmpl.speakerIds[Math.floor(rng() * tmpl.speakerIds.length)];
    const sentiment = tmpl.sentiments[Math.floor(rng() * tmpl.sentiments.length)];
    const domain = tmpl.domains[Math.floor(rng() * tmpl.domains.length)];
    const secondDomain = rng() > 0.6 ? tmpl.domains[Math.floor(rng() * tmpl.domains.length)] : undefined;
    const domains: DomainKey[] = secondDomain && secondDomain !== domain ? [domain, secondDomain] : [domain];

    generated.push({
      rawText: text,
      speakerId,
      phase: tmpl.phase,
      primaryType: tmpl.primaryType,
      confidence: 0.75 + rng() * 0.20,
      keywords: [...tmpl.keywords, ...topics[Math.floor(rng() * topics.length)].split(' ').slice(0, 2)],
      domains,
      themes: tmpl.themes,
      sentiment,
    });
  }
}

// Combine all
const finalUtterances = [...allUtterances, ...generated];

// ── Build snapshot ─────────────────────────────────────────────
async function main() {
  console.log(`Creating snapshot for workshop: ${WORKSHOP_ID}`);
  console.log(`Total utterances: ${finalUtterances.length}`);

  const nodesById: Record<string, any> = {};
  const baseTime = Date.now() - 7200_000; // 2 hours ago

  for (let i = 0; i < finalUtterances.length; i++) {
    const u = finalUtterances[i];
    const speaker = participants.find(p => p.id === u.speakerId)!;
    const nodeId = `node-${i.toString().padStart(4, '0')}`;

    const domainObjs = u.domains.map(dk => ({
      domain: DOMAINS[dk].domain,
      relevance: DOMAINS[dk].relevance + (Math.random() * 0.1 - 0.05),
      reasoning: DOMAINS[dk].reasoning,
    }));

    nodesById[nodeId] = {
      dataPointId: nodeId,
      createdAtMs: baseTime + i * 8_000, // 8s between utterances
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
        suggestedArea: DOMAINS[u.domains[0]]?.domain || null,
        updatedAt: new Date().toISOString(),
      },
      agenticAnalysis: {
        domains: domainObjs,
        themes: u.themes.map(t => ({
          label: t, category: u.primaryType === 'CONSTRAINT' ? 'Constraint' : u.primaryType === 'VISIONARY' ? 'Aspiration' : 'Insight',
          confidence: u.confidence, reasoning: `Theme identified from ${u.phase.toLowerCase()} discussion`,
        })),
        actors: extractActorsFromText(u.rawText, u.speakerId, u.sentiment),
        semanticMeaning: u.rawText.substring(0, 120) + '...',
        sentimentTone: u.sentiment,
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
    utterances: finalUtterances.map((u, i) => ({
      rawText: u.rawText,
      createdAtMs: baseTime + i * 8_000,
    })),
    interpreted: finalUtterances.map((u, i) => ({
      rawText: u.rawText,
      createdAtMs: baseTime + i * 8_000,
      classification: {
        primaryType: u.primaryType,
        confidence: u.confidence,
        keywords: u.keywords,
        suggestedArea: DOMAINS[u.domains[0]]?.domain || null,
        updatedAt: new Date().toISOString(),
      },
    })),
    synthesisByDomain: {},
    pressurePoints: [],
  };

  // Delete existing snapshots
  await (prisma as any).liveWorkshopSnapshot.deleteMany({
    where: { workshopId: WORKSHOP_ID },
  });

  // Create snapshot
  const snapshot = await (prisma as any).liveWorkshopSnapshot.create({
    data: {
      workshopId: WORKSHOP_ID,
      name: 'RetailCo Discovery & Reimagine Session',
      dialoguePhase: 'REIMAGINE',
      payload,
    },
  });

  const phases = {
    REIMAGINE: finalUtterances.filter(u => u.phase === 'REIMAGINE').length,
    CONSTRAINTS: finalUtterances.filter(u => u.phase === 'CONSTRAINTS').length,
    DEFINE_APPROACH: finalUtterances.filter(u => u.phase === 'DEFINE_APPROACH').length,
  };

  console.log(`\nSnapshot created: ${snapshot.id}`);
  console.log(`Total nodes: ${Object.keys(nodesById).length}`);
  console.log(`Phases: REIMAGINE=${phases.REIMAGINE}, CONSTRAINTS=${phases.CONSTRAINTS}, DEFINE_APPROACH=${phases.DEFINE_APPROACH}`);
  console.log(`\nNow click "Generate Report" on the hemisphere page to synthesise.`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
