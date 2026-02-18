import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Comprehensive seed: 3-hour Retail CX Transformation Workshop
 *
 * Scenario: A major UK retailer (RetailCo) exploring how to deliver
 * more compelling customer experience, remove downstream demand failure,
 * and implement AI automation, self-service, and agent-assist services.
 *
 * Workshop structure:
 *   Phase 1: REIMAGINE  (0:00-1:00)  — Future vision & aspirations
 *   Phase 2: CONSTRAINTS (1:00-2:00) — Current blockers & friction
 *   Phase 3: DEFINE_APPROACH (2:00-3:00) — Implementation path & priorities
 *
 * Participants (8 stakeholders):
 *   1. Claire Mitchell — Chief Customer Officer
 *   2. James Hartley — Head of Retail Operations
 *   3. Priya Sharma — Digital & AI Director
 *   4. Tom Richardson — Contact Centre Manager
 *   5. Sarah Okonkwo — Head of Customer Insight
 *   6. David Chen — IT Architecture Lead
 *   7. Rebecca Lewis — Compliance & Regulation Manager
 *   8. Mark Donovan — Head of Store Experience
 */

const WORKSHOP_ID = 'retail-cx-workshop';
const ORG_ID = 'demo-org';
const USER_ID = 'demo-user';

// ─── Participants ────────────────────────────────────────────

const PARTICIPANTS = [
  { id: 'p-claire',  name: 'Claire Mitchell',  email: 'claire@retailco.com',  role: 'Chief Customer Officer',       department: 'Executive' },
  { id: 'p-james',   name: 'James Hartley',    email: 'james@retailco.com',   role: 'Head of Retail Operations',    department: 'Operations' },
  { id: 'p-priya',   name: 'Priya Sharma',     email: 'priya@retailco.com',   role: 'Digital & AI Director',        department: 'Technology' },
  { id: 'p-tom',     name: 'Tom Richardson',    email: 'tom@retailco.com',     role: 'Contact Centre Manager',       department: 'Operations' },
  { id: 'p-sarah',   name: 'Sarah Okonkwo',    email: 'sarah.o@retailco.com', role: 'Head of Customer Insight',     department: 'Customer' },
  { id: 'p-david',   name: 'David Chen',       email: 'david.c@retailco.com', role: 'IT Architecture Lead',         department: 'Technology' },
  { id: 'p-rebecca', name: 'Rebecca Lewis',    email: 'rebecca@retailco.com', role: 'Compliance & Regulation Mgr',  department: 'Regulation' },
  { id: 'p-mark',    name: 'Mark Donovan',     email: 'mark@retailco.com',    role: 'Head of Store Experience',     department: 'Retail' },
];

// ─── Utterances (60 realistic workshop statements) ───────────

type Utterance = {
  id: string;
  speakerId: string;
  participantId: string;
  rawText: string;
  phase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';
  primaryType: 'VISIONARY' | 'OPPORTUNITY' | 'CONSTRAINT' | 'RISK' | 'ENABLER' | 'ACTION' | 'QUESTION' | 'INSIGHT';
  confidence: number;
  keywords: string[];
  domains: Array<{ domain: string; relevance: number; reasoning: string }>;
  themes: Array<{ label: string; category: string; confidence: number; reasoning: string }>;
  actors: Array<{
    name: string;
    role: string;
    interactions: Array<{ withActor: string; action: string; sentiment: string; context: string }>;
  }>;
  sentimentTone: string;
  semanticMeaning: string;
  speakerIntent: string;
  temporalFocus: string;
  timeOffsetMs: number; // offset from workshop start
};

const baseTime = new Date('2026-02-10T09:00:00Z').getTime();

// ═══════════════════════════════════════════════════════════════
// UTTERANCE GENERATOR — produces 970 additional data points
// ═══════════════════════════════════════════════════════════════

// Seeded PRNG for reproducibility
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
function pick<T>(arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}
function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ── Topic pools ──────────────────────────────────────────────

const TOPICS_REIMAGINE = {
  customer: [
    'personalised product recommendations based on browsing history',
    'instant in-store returns with QR code scanning',
    'proactive delivery delay notifications with rebooking options',
    'loyalty programme gamification with tiered rewards',
    'voice commerce integration for hands-free ordering',
    'social shopping features allowing friends to co-browse',
    'subscription box service for repeat purchases',
    'augmented reality try-on for clothing and accessories',
    'unified shopping basket across web, app, and store',
    'wishlist sharing with family and gift registries',
    'real-time price match guarantee across competitors',
    'birthday and anniversary personalised offers',
    'live video chat shopping with in-store experts',
    'premium concierge service for high-value customers',
    'hassle-free size exchanges with free returns',
    'guaranteed next-day delivery to any UK address',
    'real-time stock visibility across all stores online',
    'smart locker collection points at transport hubs',
    'gift wrapping and personalised message automation',
    'customer preference memory across all touchpoints',
    'predictive reorder reminders for consumable products',
    'in-app styling advice powered by AI',
    'same-day delivery from local store inventory',
    'post-purchase care guides and product tips',
    'community reviews and user-generated content integration',
    'flexible payment plans with instant credit decisions',
    'carbon-neutral delivery options for eco-conscious shoppers',
    'VIP early access to sales and new collections',
    'seamless gift card and voucher redemption across channels',
    'personalised homepage that adapts to shopping behaviour',
  ],
  operations: [
    'automated stock replenishment triggered by sales velocity',
    'AI-powered shift scheduling based on footfall predictions',
    'predictive maintenance for store equipment and HVAC',
    'robotic picking in distribution centres',
    'dynamic markdown pricing based on sell-through rates',
    'demand forecasting using weather and event data',
    'last-mile delivery route optimisation with real-time traffic',
    'warehouse slotting optimisation for faster picking',
    'automated click-and-collect staging and notification',
    'inventory accuracy improvement through RFID rollout',
    'AI-driven loss prevention using CCTV analytics',
    'queue management with virtual queuing technology',
    'express click-and-collect ready in under 30 minutes',
    'reverse logistics automation for returns processing',
    'peak season capacity planning with scenario modelling',
    'store-to-door delivery using local store fulfilment',
    'automated goods-in receiving with barcode scanning',
    'energy management and sustainability monitoring per store',
    'task allocation app for store colleague productivity',
    'centralised contact centre workforce management',
    'cross-docking facility to reduce warehousing costs',
    'supply chain visibility dashboard with real-time tracking',
    'vendor-managed inventory for key suppliers',
    'packaging optimisation to reduce waste and shipping costs',
    'store capacity management for peak trading periods',
  ],
  technology: [
    'unified API gateway connecting all customer touchpoints',
    'real-time analytics dashboard for store managers',
    'customer data platform consolidating all data sources',
    'edge computing in stores for low-latency AI inference',
    '5G connectivity rollout for bandwidth-intensive services',
    'cloud-native migration of core retail platforms',
    'microservices architecture replacing monolithic systems',
    'event-driven architecture for real-time data streaming',
    'automated ML pipeline for model training and deployment',
    'computer vision for shelf monitoring and stockouts',
    'natural language processing for customer feedback analysis',
    'recommendation engine using collaborative filtering',
    'site search improvement with semantic understanding',
    'mobile-first responsive redesign of e-commerce platform',
    'progressive web app for offline-capable mobile experience',
    'GraphQL API for flexible frontend data fetching',
    'containerised deployment with Kubernetes orchestration',
    'feature flag system for gradual rollouts and A/B testing',
    'real-time personalisation engine with sub-100ms latency',
    'headless commerce platform decoupling frontend and backend',
    'data lake architecture for unified analytics',
    'API-first integration strategy for partner ecosystem',
    'automated testing pipeline for continuous deployment',
    'observability platform with distributed tracing',
    'identity and access management modernisation',
  ],
  people: [
    'digital skills academy for all retail colleagues',
    'career pathway programme from store floor to management',
    'AI literacy training for non-technical stakeholders',
    'change management programme for transformation adoption',
    'leadership coaching for middle management digital confidence',
    'mental health and wellbeing support for frontline staff',
    'flexible working arrangements for contact centre agents',
    'diversity and inclusion initiatives in technology hiring',
    'peer recognition programme with digital badges',
    'colleague mobile app for scheduling and communication',
    'internal knowledge-sharing community platform',
    'onboarding automation reducing time-to-competence',
    'performance analytics dashboards for team leaders',
    'retention bonus programme for high-performing colleagues',
    'cross-functional secondment programme for skill building',
    'apprenticeship scheme for digital and data roles',
    'employee voice survey with real-time sentiment tracking',
    'store manager empowerment with local decision authority',
    'buddy system pairing new hires with experienced colleagues',
    'quarterly innovation hackathons for all departments',
    'wellbeing days and mental health first aiders in every store',
    'exit interview analytics to identify retention drivers',
    'salary benchmarking against retail and tech competitors',
    'learning management system with personalised development plans',
    'graduate programme focused on retail technology',
  ],
  regulation: [
    'AI ethics framework with bias detection and monitoring',
    'GDPR automated data subject access request processing',
    'Consumer Duty compliance monitoring dashboard',
    'accessibility compliance for all digital touchpoints',
    'data sovereignty controls for cross-border operations',
    'PCI DSS scope reduction through tokenisation',
    'environmental sustainability reporting automation',
    'modern slavery supply chain audit automation',
    'advertising standards compliance for AI-generated content',
    'age verification for restricted product categories',
    'product safety recall management system',
    'cross-border e-commerce tax and duty compliance',
    'cookie consent management with granular controls',
    'right to explanation for AI-driven decisions',
    'data retention policy automation and enforcement',
    'anti-money laundering checks for high-value transactions',
    'employee data privacy in workplace monitoring',
    'third-party vendor risk assessment framework',
    'algorithmic impact assessment for pricing AI',
    'regulatory change management tracking system',
  ],
};

const TOPICS_CONSTRAINTS = {
  customer: [
    'customers abandoning baskets due to complex checkout flow',
    'inconsistent pricing between online and in-store channels',
    'loyalty programme perceived as stale with low engagement',
    'poor mobile app ratings dragging down brand perception',
    'delivery tracking information being unreliable and delayed',
    'returns process requiring original receipt and packaging',
    'customer complaints about impersonal email marketing',
    'no ability to check in-store stock availability online',
    'gift card system that does not work across all channels',
    'customer service chat closing after office hours',
    'no customer recognition when moving between channels',
    'long hold times driving customers to social media complaints',
    'out-of-stock items with no notification when available again',
    'inflexible delivery slots frustrating working customers',
    'click-and-collect taking over an hour to be ready',
    'no personalisation for guest checkout customers',
    'product descriptions and images being inconsistent across channels',
    'difficulty reaching a human when AI fails to help',
    'payment options limited compared to competitors',
    'size guide inaccuracy leading to high return rates',
    'no way for customers to provide feedback in the moment',
    'customer journey requiring re-authentication at every step',
    'marketing offers not respecting customer preferences',
    'subscription management being buried in account settings',
    'complaint resolution taking over five working days',
  ],
  operations: [
    'store colleagues spending too much time on administrative tasks',
    'click-and-collect failures due to inventory inaccuracy',
    'contact centre overflow during peak periods with no surge capacity',
    'manual refund approval process creating customer-facing delays',
    'warehouse picking errors leading to wrong item deliveries',
    'shift scheduling not matching actual customer footfall patterns',
    'returns processing backlog creating warehouse congestion',
    'lack of real-time visibility into delivery partner performance',
    'paper-based stock count process taking two days per store',
    'store-to-store transfer process being slow and unreliable',
    'contact centre knowledge base being outdated and hard to search',
    'manager override required for too many routine transactions',
    'peak trading planning starting too late each year',
    'no standard operating procedure for AI-assisted service',
    'goods-in process creating bottleneck during morning deliveries',
    'energy costs increasing with no store-level monitoring',
    'customer complaint escalation process being undefined',
    'multi-channel order modification requiring manual intervention',
    'fulfilment centre capacity maxed out during promotional events',
    'supplier lead times increasing with no visibility into pipeline',
    'cross-dock facility handling only fifty percent of potential volume',
    'agency staff making up thirty percent of contact centre headcount',
    'store security incidents taking manager time away from customers',
    'fleet maintenance costs escalating due to ageing delivery vehicles',
    'seasonal recruitment starting too late losing best candidates',
  ],
  technology: [
    'legacy point-of-sale system running unsupported Windows version',
    'customer data spread across seventeen disconnected databases',
    'mobile app built on deprecated framework requiring complete rewrite',
    'no CI/CD pipeline meaning manual deployments every two weeks',
    'search functionality returning irrelevant results for common queries',
    'payment gateway experiencing intermittent timeout issues',
    'API rate limits blocking real-time personalisation at scale',
    'data warehouse ETL jobs failing silently and producing stale reports',
    'no automated testing meaning regressions discovered in production',
    'single sign-on not implemented across internal tools',
    'website performance degrading under load above ten thousand concurrent users',
    'email marketing platform unable to support real-time triggers',
    'store WiFi infrastructure unable to support customer-facing services',
    'disaster recovery plan untested for eighteen months',
    'security vulnerability scanning backlog of over two hundred items',
    'CRM system licence costs increasing annually by fifteen percent',
    'integration middleware reaching end of vendor support',
    'no feature flagging capability for controlled rollouts',
    'monitoring gaps meaning issues discovered by customers before IT',
    'technical documentation sparse and outdated across all platforms',
    'database connection pooling limits causing intermittent errors',
    'content management system too rigid for marketing team needs',
    'batch processing jobs running overnight preventing real-time analytics',
    'vendor lock-in on key platforms limiting negotiation leverage',
    'no sandbox environment for safe testing of new integrations',
  ],
  people: [
    'store colleague attrition at twenty-eight percent annually',
    'digital skills gap across retail management population',
    'change fatigue from three previous failed transformation programmes',
    'AI team of only three people for enterprise-wide programme',
    'training budget cut by forty percent in last financial year',
    'middle management resistant to empowering frontline colleagues',
    'no clear career progression from store floor to technology roles',
    'contact centre agents measured only on call handling time',
    'poor internal communication about strategic direction',
    'hiring process taking eight weeks from application to start date',
    'diversity targets not being met in technology departments',
    'knowledge hoarding by experienced colleagues nearing retirement',
    'no formal mentoring programme for new joiners',
    'colleague engagement scores declining for third consecutive quarter',
    'performance review process perceived as unfair and subjective',
    'remote working policy unclear creating inconsistency',
    'union concerns about AI replacing contact centre jobs',
    'leadership team lacking retail technology experience',
    'store manager workload leaving no time for people development',
    'induction programme not covering digital tools adequately',
    'high absence rates in contact centre during winter months',
    'talent pipeline for data science roles completely dry',
    'no recognition for colleagues who adopt new technology early',
    'communication gap between head office and store operations',
    'contractor dependency for critical technical skills',
  ],
  regulation: [
    'DPIA approval taking four months per AI use case',
    'GDPR data subject requests handled manually with spreadsheets',
    'Consumer Duty requirements unclear for AI-driven interactions',
    'accessibility audit revealing over two hundred WCAG failures',
    'cross-border data transfer mechanisms post-Brexit uncertain',
    'PCI DSS audit findings requiring infrastructure changes',
    'environmental reporting requirements increasing annually',
    'modern slavery due diligence gaps in tier-two suppliers',
    'advertising standards complaints about personalised pricing',
    'age verification system producing high false-rejection rates',
    'product recall notification system being manual and slow',
    'no automated compliance monitoring for regulatory changes',
    'privacy policy not updated for new data processing activities',
    'cookie consent implementation not meeting latest ICO guidance',
    'information security team of three people covering all compliance',
    'no data lineage tracking for AI model training data',
    'regulatory reporting still dependent on manual data extraction',
    'supplier contracts lacking adequate data processing clauses',
    'whistleblowing hotline not promoted to store colleagues',
    'annual compliance training completion rate below seventy percent',
  ],
};

const TOPICS_APPROACH = {
  customer: [
    'deploy conversational AI chatbot handling top 10 enquiry types',
    'launch personalised product recommendation engine on homepage',
    'implement QR-code based instant returns in flagship stores',
    'build proactive delivery notification system with rebooking',
    'redesign loyalty programme with gamification and tiers',
    'create unified shopping basket syncing across web and app',
    'pilot AR try-on feature for top clothing categories',
    'implement real-time stock availability on product pages',
    'launch live video shopping with in-store stylists',
    'build customer preference centre for communication control',
    'deploy sentiment analysis on customer feedback channels',
    'create VIP concierge experience for top-tier loyalty members',
    'implement one-click reorder for consumable products',
    'build post-purchase care journey with automated touchpoints',
    'launch customer co-creation panel for product development',
    'deploy smart search with visual and voice capabilities',
    'build personalised email journeys based on lifecycle stage',
    'implement flexible delivery slots with evening and weekend options',
    'create in-app appointment booking for personal shopping',
    'deploy customer effort score measurement at every touchpoint',
    'build abandoned basket recovery with personalised incentives',
    'implement social proof features showing real-time purchases',
    'launch carbon-neutral delivery option at checkout',
    'create seamless gift experience with digital wrapping and messages',
    'deploy NPS follow-up automation for detractor recovery',
  ],
  operations: [
    'deploy AI triage routing for contact centre enquiries',
    'implement agent-assist AI copilot for delivery issues',
    'roll out RFID tagging for inventory accuracy improvement',
    'build automated click-and-collect staging system',
    'deploy AI-powered workforce scheduling for all stores',
    'implement real-time delivery partner performance dashboard',
    'create automated returns processing workflow',
    'launch store task management app for colleague productivity',
    'deploy demand forecasting model for stock replenishment',
    'implement express returns kiosk in top 20 stores',
    'build centralised command centre for multi-channel operations',
    'deploy predictive maintenance system for store equipment',
    'implement dynamic pricing engine for markdown optimisation',
    'create store-to-door fulfilment from local inventory',
    'launch virtual queuing system for busy store periods',
    'deploy quality monitoring AI for contact centre calls',
    'implement automated goods-in receiving with scan verification',
    'build cross-dock automation for faster supplier processing',
    'deploy energy monitoring and sustainability dashboards per store',
    'implement peak trading war room with real-time KPIs',
    'create supplier collaboration portal for inventory planning',
    'launch automated escalation workflow for unresolved complaints',
    'deploy robotic process automation for back-office tasks',
    'implement last-mile delivery slot optimisation algorithm',
    'build real-time store capacity monitoring for safety compliance',
  ],
  technology: [
    'deploy event-driven architecture with CDC from legacy OMS',
    'build customer data platform starting with identity resolution',
    'implement API gateway for unified service mesh',
    'migrate e-commerce platform to headless architecture',
    'deploy Azure OpenAI for agent-assist and content generation',
    'build real-time personalisation engine on customer data platform',
    'implement feature flag system for gradual AI rollouts',
    'deploy containerised microservices for new capabilities',
    'build data lake consolidating all analytical data sources',
    'implement observability platform with alerting and tracing',
    'deploy progressive web app for mobile-first experience',
    'build automated ML pipeline for model training and monitoring',
    'implement GraphQL layer for flexible frontend development',
    'deploy store network upgrade to full fibre in all locations',
    'build integration hub connecting all partner systems',
    'implement automated security scanning in CI/CD pipeline',
    'deploy cloud-based contact centre platform replacing on-premise',
    'build A/B testing framework for continuous experimentation',
    'implement data quality monitoring for customer records',
    'deploy edge computing nodes in flagship stores for AI inference',
    'build vendor-agnostic AI orchestration layer',
    'implement zero-trust security architecture',
    'deploy content management system upgrade for marketing agility',
    'build real-time streaming pipeline for event processing',
    'implement disaster recovery automation with regular testing',
  ],
  people: [
    'launch digital skills academy for all 5000 retail colleagues',
    'create AI champion network with representatives in every store',
    'implement structured change management programme for transformation',
    'build career pathway from store floor to digital and data roles',
    'deploy colleague mobile app for scheduling and engagement',
    'launch leadership development programme for store managers',
    'create cross-functional CX transformation team of six',
    'implement peer recognition platform with digital rewards',
    'deploy mental health first aider training across all stores',
    'build internal talent marketplace for project-based assignments',
    'launch apprenticeship scheme for data and AI roles',
    'create colleague innovation fund for grassroots improvements',
    'implement real-time engagement pulse surveys',
    'deploy AI-assisted onboarding reducing time-to-competence by 40%',
    'build knowledge base with AI-powered search for store teams',
    'launch flexible working pilot for contact centre agents',
    'create diversity and inclusion targets for technology hiring',
    'implement exit interview analytics dashboard for HR',
    'deploy automated shift-swap platform for colleague flexibility',
    'build training simulation environment for new AI tools',
    'launch quarterly hackathons for cross-functional innovation',
    'create store colleague advisory panel for technology adoption',
    'implement wellbeing score tracking in colleague app',
    'deploy automated reference and background check processing',
    'build succession planning tool for key retail positions',
  ],
  regulation: [
    'deploy pre-approved AI governance framework for fast-track DPIA',
    'implement automated GDPR data subject request processing',
    'build Consumer Duty compliance monitoring dashboard',
    'deploy accessibility testing automation in CI/CD pipeline',
    'create data sovereignty controls for cross-border transfers',
    'implement PCI DSS scope reduction through tokenisation rollout',
    'build environmental impact reporting automation',
    'deploy modern slavery supply chain monitoring platform',
    'create AI transparency labelling for customer-facing systems',
    'implement cookie consent management with preference centre',
    'build regulatory change monitoring with impact assessment',
    'deploy automated compliance training with progress tracking',
    'create data lineage tracking for AI model governance',
    'implement right-to-explanation capability for AI decisions',
    'build vendor risk assessment automation platform',
    'deploy privacy-by-design review gate in development process',
    'create incident response automation for data breaches',
    'implement algorithmic fairness testing for pricing models',
    'build regulatory reporting automation replacing manual processes',
    'deploy whistleblowing platform with anonymous reporting',
  ],
};

// ── Sentence templates by primaryType ────────────────────────

const TEMPLATES: Record<string, string[]> = {
  VISIONARY: [
    'Imagine if we could achieve {topic}. That would fundamentally change how customers perceive us and drive a step-change in loyalty and lifetime value.',
    'My vision is {topic}. In two years I want a customer to say our experience is the benchmark for retail — not just in the UK but globally.',
    'What if {topic} became our reality? The data shows this would increase customer satisfaction by at least twenty points and reduce churn significantly.',
    'I see a future where {topic}. Every competitor is moving in this direction and we need to lead, not follow.',
    'The north star should be {topic}. Everything else we discuss today should ladder up to this aspiration.',
    'We should aim for {topic}. Our customers are already expecting this from the best digital-native brands they interact with.',
    'Picture this: {topic}. The technology exists today, the question is whether we have the ambition and the governance to make it happen.',
    'I want us to be known for {topic}. That becomes our brand differentiator in a market where product and price are increasingly commoditised.',
    'The ultimate aspiration is {topic}. If we get this right it transforms not just the customer experience but the economics of our entire operation.',
    'In five years, I believe {topic} will be table stakes. The question is whether we get there first or play catch-up with competitors who moved faster.',
  ],
  OPPORTUNITY: [
    'There is a clear opportunity with {topic}. Our competitors have not moved on this yet and we have a twelve-month window to establish leadership.',
    'The business case for {topic} is compelling — our analysis suggests a return within eighteen months based on conservative assumptions.',
    'I see {topic} as a quick win. We could pilot this in six weeks and have results to present to the board by next quarter.',
    'The research shows that {topic} would address one of our biggest customer pain points. Sixty percent of complaints relate to this area.',
    'We should prioritise {topic}. The investment required is modest compared to the potential revenue uplift and cost reduction.',
    'Our data tells us that {topic} would reduce customer effort significantly. And we know effort is the number one driver of churn.',
    'If we execute {topic} well, we differentiate ourselves in a market where most retailers are still stuck in traditional models.',
    'The opportunity with {topic} is time-sensitive. New regulation coming next year makes this both a commercial opportunity and a compliance enabler.',
    'I have seen {topic} work brilliantly at other retailers. The best practice is well established and we can fast-follow rather than invent from scratch.',
    'Investing in {topic} addresses multiple strategic objectives simultaneously — customer satisfaction, operational efficiency, and colleague experience.',
  ],
  CONSTRAINT: [
    'The challenge with {topic} is a significant blocker. We have been dealing with this for over two years and it is getting worse, not better.',
    'We are fundamentally constrained by {topic}. Until we address this, none of the ambitious plans we are discussing will be achievable.',
    'I need to flag that {topic} is a hard constraint. There is no workaround and it requires dedicated investment to resolve.',
    'The reality is that {topic} blocks us at every turn. My team spends thirty percent of their time working around this limitation.',
    'We cannot ignore that {topic} is a critical constraint. Every transformation programme in the last five years has stumbled on this same issue.',
    'Let me be blunt — {topic} is killing our ability to innovate. We are building on quicksand and we need to fix the foundation.',
    'The constraint around {topic} is worse than most people realise. The downstream impact touches every customer touchpoint we have.',
    'From a regulatory perspective, {topic} creates significant risk. We are operating in a grey area that the regulator could challenge at any time.',
    'Our current situation with {topic} means we are burning money. The inefficiency cost is in the millions annually and growing.',
    'The {topic} situation is a ticking time bomb. If we do not address it in the next twelve months, we will face a much larger crisis.',
  ],
  RISK: [
    'I am concerned that {topic} poses a real risk to the programme. We need to plan mitigations before we go further.',
    'There is a significant risk around {topic}. If we do not manage this carefully, it could derail the entire transformation.',
    'We need to acknowledge the risk that {topic} presents. The probability is medium but the impact would be severe.',
    'My worry is that {topic} could undermine everything we are trying to achieve. We have seen this happen at other organisations.',
    'The risk with {topic} is not just operational — it is reputational. One high-profile failure and customer trust is gone.',
    'I want to flag that {topic} is a risk we are not adequately managing. We need dedicated resource and clear accountability.',
    'If {topic} goes wrong, the financial impact could be significant. I estimate exposure in the range of two to five million.',
    'There is a people risk around {topic}. If we do not manage the human side of this change, adoption will fail.',
    'The competitive risk of not addressing {topic} is real. Two of our direct competitors have already moved on this.',
    'We should stress-test our plans against the risk that {topic} materialises. Our current contingency is insufficient.',
  ],
  ENABLER: [
    'What is working well is {topic}. We should build on this strength rather than starting from scratch.',
    'I want to highlight that {topic} is a genuine enabler. It gives us a foundation that most of our competitors lack.',
    'The good news is that {topic} is already in place. We can leverage this to accelerate the other initiatives we are discussing.',
    'Our proof of concept showed that {topic} delivers real results. We saw measurable improvement in the pilot group.',
    'I think {topic} is an underappreciated enabler. If we invest in it properly, it unlocks multiple downstream capabilities.',
    'The team has done excellent work on {topic}. This gives us confidence that we can execute the broader programme.',
    'Building on {topic} is the smart move. The infrastructure is there, the skills exist, and the business case is proven.',
    'We already have {topic} which puts us ahead. The challenge now is scaling it across the organisation consistently.',
    'One positive is {topic}. This means we do not have to start from zero — we can iterate from an existing base.',
    'Let me give credit where it is due — {topic} has been a success. We should use the same approach for the next phase.',
  ],
  ACTION: [
    'I propose we {topic}. This should be our first priority with a target completion of eight to twelve weeks.',
    'My recommendation is to {topic}. We can start immediately with the resources we have and demonstrate value quickly.',
    'Let us commit to {topic} as the next concrete step. I will own the delivery and report progress fortnightly.',
    'We should {topic} as part of Horizon 1. The investment is manageable and the business case is already proven.',
    'I am proposing we {topic}. I have scoped this with the team and we can deliver an MVP in six weeks.',
    'The action I want us to agree today is to {topic}. We have talked about this for too long — we need to execute.',
    'For the next quarter, my priority is to {topic}. I need budget approval of two hundred thousand and two additional headcount.',
    'We need to {topic} before we can tackle any of the larger initiatives. Think of it as laying the plumbing.',
    'I suggest we {topic} in parallel with the technology work. This way we are ready to scale when the platform is in place.',
    'The pilot plan is to {topic} in ten locations. If we see the expected results, we roll out nationally within six months.',
  ],
  INSIGHT: [
    'The data shows that {topic}. This has major implications for how we prioritise our investment.',
    'Our customer research reveals that {topic}. This should be a key input into our strategy.',
    'What I find telling is that {topic}. This pattern has been consistent across the last three quarterly surveys.',
    'An important insight is that {topic}. It challenges some of our assumptions about what customers actually want.',
    'The numbers are clear on {topic}. We cannot argue with the data — it tells a consistent story.',
    'My team discovered that {topic}. This was unexpected and changes our understanding of the problem.',
    'There is a clear trend around {topic}. It is accelerating and will reshape our market within two years.',
    'What the benchmarking shows is that {topic}. We are behind the industry average on this dimension.',
    'The insight I want to share is {topic}. It connects several of the challenges we have been discussing.',
    'Looking at the customer journey data, {topic}. This is where the biggest friction and drop-off occurs.',
  ],
  QUESTION: [
    'I want to ask — how does {topic} fit into our overall prioritisation? Are we aligned on where this sits?',
    'Has anyone considered the implications of {topic}? I think there are dependencies we have not mapped.',
    'What is our timeline for {topic}? I want to understand how it sequences with the other workstreams.',
    'Who owns {topic}? We need clear accountability or it will fall between the cracks like last time.',
    'How do we measure success for {topic}? We need to agree the KPIs upfront before we start.',
    'What is the risk if we delay {topic}? I want to understand the cost of inaction.',
    'Can we afford to do {topic} alongside everything else? I am worried about spreading too thin.',
    'What are the dependencies for {topic}? I want to make sure we are not blocking other teams.',
    'Has the {topic} been validated with customers? We should not assume we know what they want.',
    'What happens to {topic} if the budget is reduced by twenty percent? Do we have a fallback plan?',
  ],
};

// ── Actor pool ───────────────────────────────────────────────

const ACTOR_POOL = [
  { name: 'Customer', role: 'End consumer' },
  { name: 'Contact centre agent', role: 'Customer service representative' },
  { name: 'Store colleague', role: 'Retail floor staff' },
  { name: 'AI assistant', role: 'Automated customer service' },
  { name: 'Store manager', role: 'Store leadership' },
  { name: 'Delivery partner', role: 'Third-party logistics provider' },
  { name: 'AI copilot', role: 'Agent assistance tool' },
  { name: 'Marketing team', role: 'Customer communications' },
  { name: 'Warehouse team', role: 'Fulfilment operations' },
  { name: 'Training team', role: 'Learning and development' },
  { name: 'IT team', role: 'Technology operations' },
  { name: 'CRM system', role: 'Customer relationship platform' },
  { name: 'Loyalty system', role: 'Rewards and retention platform' },
  { name: 'Chatbot', role: 'Digital self-service tool' },
  { name: 'FCA', role: 'Financial conduct regulator' },
  { name: 'Board', role: 'Executive governance' },
  { name: 'CEO', role: 'Chief executive' },
  { name: 'Supplier', role: 'Product supplier' },
  { name: 'Data team', role: 'Data management and analytics' },
  { name: 'Finance team', role: 'Budget and investment governance' },
  { name: 'HR team', role: 'People and talent management' },
  { name: 'Compliance team', role: 'Regulatory compliance' },
  { name: 'Third-party vendor', role: 'Technology partner' },
  { name: 'Customer data platform', role: 'Unified data infrastructure' },
  { name: 'Legacy OMS', role: 'Order management system' },
  { name: 'Recommendation engine', role: 'AI personalisation system' },
  { name: 'Store system', role: 'In-store technology platform' },
  { name: 'Notification system', role: 'Proactive outreach platform' },
  { name: 'Quality assurance team', role: 'Service quality monitoring' },
  { name: 'Product team', role: 'Product development and merchandising' },
];

// ── Interaction action templates by sentiment ────────────────

const INTERACTION_ACTIONS: Record<string, string[]> = {
  positive: [
    'delivers personalised service to', 'empowers with real-time data', 'streamlines workflow for',
    'provides instant resolution to', 'proactively notifies', 'enables self-service for',
    'reduces wait time for', 'improves accuracy for', 'accelerates delivery to',
    'supports decision-making for', 'automates routine tasks for', 'enhances experience of',
  ],
  concerned: [
    'struggles to provide timely service to', 'delays response to', 'lacks context when serving',
    'provides inconsistent information to', 'cannot access full history for', 'over-promises to',
    'creates confusion for', 'adds unnecessary steps for', 'fails to follow up with',
    'misroutes enquiry from', 'sends generic communications to', 'loses data about',
  ],
  critical: [
    'fails to resolve issue for', 'blocks progress of', 'frustrates with repeated requests to',
    'creates service failure for', 'drops the ball on', 'ignores urgent request from',
    'breaks process for', 'escalates without context to', 'causes repeat contact from',
    'delivers wrong information to', 'mishandles complaint from', 'forces manual workaround for',
  ],
  smooth: [
    'seamlessly connects with', 'efficiently processes request from', 'integrates data for',
    'maintains context across interactions with', 'collaborates effectively with',
    'handoffs cleanly to', 'coordinates timing with', 'shares insights with',
    'aligns priorities with', 'complements the work of', 'syncs in real-time with',
    'orchestrates workflow between',
  ],
};

const INTERACTION_CONTEXTS: Record<string, string[]> = {
  positive: [
    'Customer receives immediate resolution without waiting',
    'Agent has full context and resolves first-time',
    'System automates routine task saving significant time',
    'Proactive alert prevents customer from needing to call',
    'AI provides accurate recommendation based on preferences',
    'Colleague empowered with real-time data on shop floor',
    'Self-service option resolves enquiry in under two minutes',
  ],
  concerned: [
    'Information gap causes delay in resolution',
    'Customer has to repeat information already provided',
    'System latency creates frustrating wait for agent',
    'Handoff between channels loses customer context',
    'Outdated data leads to incorrect suggestion',
    'Process requires unnecessary steps adding friction',
    'Communication gap leaves customer uncertain about status',
  ],
  critical: [
    'Customer contacts for third time about same unresolved issue',
    'System outage prevents any resolution during peak trading',
    'Compliance failure puts organisation at regulatory risk',
    'Data breach exposes customer personal information',
    'Complete service failure leading to social media escalation',
    'Agent burnout from impossible workload causing errors',
    'Legacy system blocks implementation of critical improvement',
  ],
  smooth: [
    'Seamless handoff maintains full conversation context',
    'Real-time data synchronisation across all touchpoints',
    'Automated workflow completes without manual intervention',
    'Integrated systems provide unified customer view',
    'Cross-functional team collaborates effectively on resolution',
    'Event-driven architecture enables instant notification',
    'API integration connects partner systems transparently',
  ],
};

// ── Domain and theme labels ──────────────────────────────────

const DOMAIN_NAMES = ['Customer Experience', 'Operations', 'Technology', 'People', 'Regulation'];
const DOMAIN_KEYS = ['customer', 'operations', 'technology', 'people', 'regulation'] as const;

const THEME_LABELS_BY_DOMAIN: Record<string, string[]> = {
  customer: ['Seamless Omnichannel', 'Personalisation', 'Self-Service', 'Proactive Communication', 'Customer Effort Reduction', 'Loyalty & Retention', 'Returns Experience', 'Delivery Excellence', 'Voice of Customer', 'Digital Engagement'],
  operations: ['Contact Centre Efficiency', 'Store Operations', 'Fulfilment Speed', 'Demand Management', 'Workforce Optimisation', 'Supply Chain Visibility', 'Cost Reduction', 'Quality Assurance', 'Peak Management', 'Process Automation'],
  technology: ['Legacy Modernisation', 'Data Platform', 'AI & ML', 'Cloud Infrastructure', 'Integration Architecture', 'Security & Compliance', 'Mobile First', 'Real-Time Analytics', 'API Strategy', 'DevOps Maturity'],
  people: ['Colleague Empowerment', 'Skills Development', 'Change Management', 'Retention & Wellbeing', 'Leadership Development', 'Digital Literacy', 'Culture Change', 'Talent Acquisition', 'Diversity & Inclusion', 'Performance Management'],
  regulation: ['Consumer Duty', 'Data Governance', 'AI Ethics', 'Accessibility', 'Privacy Compliance', 'Cross-Border Compliance', 'Environmental Reporting', 'Vendor Risk', 'Audit & Monitoring', 'Regulatory Change'],
};

const PHASE_SENTIMENTS: Record<string, Record<string, number>> = {
  REIMAGINE: { positive: 40, smooth: 20, concerned: 25, critical: 15 },
  CONSTRAINTS: { critical: 35, concerned: 35, positive: 10, smooth: 20 },
  DEFINE_APPROACH: { positive: 45, smooth: 25, concerned: 20, critical: 10 },
};

const PHASE_TYPES: Record<string, { types: string[]; weights: number[] }> = {
  REIMAGINE: {
    types: ['VISIONARY', 'OPPORTUNITY', 'INSIGHT', 'ENABLER', 'QUESTION', 'ACTION'],
    weights: [30, 25, 20, 15, 7, 3],
  },
  CONSTRAINTS: {
    types: ['CONSTRAINT', 'RISK', 'INSIGHT', 'QUESTION', 'ENABLER', 'OPPORTUNITY'],
    weights: [35, 25, 20, 10, 5, 5],
  },
  DEFINE_APPROACH: {
    types: ['ACTION', 'ENABLER', 'OPPORTUNITY', 'INSIGHT', 'VISIONARY', 'QUESTION'],
    weights: [35, 25, 15, 12, 8, 5],
  },
};

const TEMPORAL_BY_PHASE: Record<string, string[]> = {
  REIMAGINE: ['future', 'future', 'future', 'present', 'timeless'],
  CONSTRAINTS: ['present', 'present', 'present', 'past', 'timeless'],
  DEFINE_APPROACH: ['future', 'future', 'present', 'future', 'timeless'],
};

// ── Time distribution (minutes → cumulative utterance count) ─

function timeOffsetForIndex(idx: number, total: number): number {
  // Non-uniform: clustered in active discussion periods
  // Phase 1 active: 10-55 min, Phase 2 active: 65-115 min, Phase 3 active: 125-175 min
  const phaseIdx = idx < total / 3 ? 0 : idx < (2 * total) / 3 ? 1 : 2;
  const phaseStart = [10, 65, 125][phaseIdx];
  const phaseEnd = [55, 115, 175][phaseIdx];
  const phaseOffset = idx - (phaseIdx * total) / 3;
  const phaseTotal = total / 3;
  const fraction = phaseOffset / phaseTotal;
  // Add jitter
  const baseMin = phaseStart + fraction * (phaseEnd - phaseStart);
  const jitter = (rng() - 0.5) * 3; // +/- 1.5 min
  const clampedMin = Math.max(phaseStart, Math.min(phaseEnd, baseMin + jitter));
  return Math.round(clampedMin * 60 * 1000);
}

// ── Generator function ───────────────────────────────────────

function generateUtterance(index: number): Utterance {
  const totalGenerated = 970;
  const phase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' =
    index < totalGenerated / 3 ? 'REIMAGINE' : index < (2 * totalGenerated) / 3 ? 'CONSTRAINTS' : 'DEFINE_APPROACH';

  // Pick speaker
  const speakerIdx = (index + Math.floor(rng() * 3)) % PARTICIPANTS.length;
  const participant = PARTICIPANTS[speakerIdx];

  // Pick primary type
  const pt = PHASE_TYPES[phase];
  const primaryType = weightedPick(pt.types, pt.weights) as Utterance['primaryType'];

  // Pick domain (weighted towards participant's department)
  const deptToDomain: Record<string, number> = { Executive: 0, Operations: 1, Technology: 2, Customer: 0, Retail: 1, Regulation: 4 };
  const primaryDomainIdx = deptToDomain[participant.department] ?? Math.floor(rng() * 5);
  const domainWeights = DOMAIN_KEYS.map((_, i) => (i === primaryDomainIdx ? 4 : 1));
  const domainKey = weightedPick([...DOMAIN_KEYS], domainWeights);

  // Pick topic
  const topicPool = phase === 'REIMAGINE' ? TOPICS_REIMAGINE : phase === 'CONSTRAINTS' ? TOPICS_CONSTRAINTS : TOPICS_APPROACH;
  const topics = topicPool[domainKey as keyof typeof topicPool];
  const topic = pick(topics);

  // Build raw text from template
  const templates = TEMPLATES[primaryType] || TEMPLATES.INSIGHT;
  const template = pick(templates);
  const rawText = template.replace(/\{topic\}/g, topic);

  // Domains (1-2)
  const secondaryDomainKey = pick(DOMAIN_KEYS.filter((d) => d !== domainKey));
  const domains = [
    { domain: DOMAIN_NAMES[DOMAIN_KEYS.indexOf(domainKey)], relevance: 0.8 + rng() * 0.18, reasoning: `Primary domain for ${topic}` },
    ...(rng() > 0.4 ? [{ domain: DOMAIN_NAMES[DOMAIN_KEYS.indexOf(secondaryDomainKey)], relevance: 0.55 + rng() * 0.25, reasoning: `Secondary domain impact` }] : []),
  ];

  // Themes (1-2)
  const themeLabels = THEME_LABELS_BY_DOMAIN[domainKey];
  const themes = pickN(themeLabels, rng() > 0.5 ? 2 : 1).map((label) => ({
    label,
    category: domainKey === 'regulation' ? 'regulatory' : domainKey === 'people' ? 'people' : rng() > 0.5 ? 'strategic' : 'operational',
    confidence: 0.75 + rng() * 0.2,
    reasoning: `Related to ${topic}`,
  }));

  // Keywords
  const words = topic.split(/\s+/).filter((w) => w.length > 3);
  const keywords = pickN(words, Math.min(words.length, 3 + Math.floor(rng() * 3)));

  // Sentiment
  const sentimentWeights = PHASE_SENTIMENTS[phase];
  const sentimentKeys = Object.keys(sentimentWeights);
  const sentiment = weightedPick(sentimentKeys, sentimentKeys.map((k) => sentimentWeights[k]));

  // Actors (1-3 with interactions)
  const numActors = 1 + Math.floor(rng() * 2);
  const selectedActors = pickN(ACTOR_POOL, numActors);
  const actors = selectedActors.map((actor) => {
    const targetActor = pick(ACTOR_POOL.filter((a) => a.name !== actor.name));
    const numInteractions = 1 + Math.floor(rng() * 2);
    const interactions = Array.from({ length: numInteractions }, () => {
      const ixSentiment = weightedPick(sentimentKeys, sentimentKeys.map((k) => sentimentWeights[k]));
      const actions = INTERACTION_ACTIONS[ixSentiment] || INTERACTION_ACTIONS.smooth;
      const contexts = INTERACTION_CONTEXTS[ixSentiment] || INTERACTION_CONTEXTS.smooth;
      return {
        withActor: targetActor.name,
        action: pick(actions) + ' ' + targetActor.name.toLowerCase(),
        sentiment: ixSentiment,
        context: pick(contexts),
      };
    });
    return { name: actor.name, role: actor.role, interactions };
  });

  const confidence = 0.78 + rng() * 0.18;
  const temporalFocus = pick(TEMPORAL_BY_PHASE[phase]);
  const timeOffsetMs = timeOffsetForIndex(index, totalGenerated);

  const sentimentToneMap: Record<string, string> = { positive: 'positive', smooth: 'positive', concerned: 'concerned', critical: 'critical' };
  const sentimentTone = sentimentToneMap[sentiment] || 'neutral';

  return {
    id: `dp-g${String(index).padStart(4, '0')}`,
    speakerId: `speaker_${speakerIdx}`,
    participantId: participant.id,
    rawText,
    phase,
    primaryType,
    confidence,
    keywords,
    domains,
    themes,
    actors,
    sentimentTone,
    semanticMeaning: `${participant.name} discusses ${topic} in the context of ${DOMAIN_NAMES[DOMAIN_KEYS.indexOf(domainKey)]}`,
    speakerIntent: `Contributing ${primaryType.toLowerCase()} perspective on ${domainKey} domain`,
    temporalFocus,
    timeOffsetMs,
  };
}

// ── Build the full 1000 utterances ───────────────────────────

const HAND_WRITTEN: Utterance[] = [
  // ═══════════════════════════════════════════════════════════
  // PHASE 1: REIMAGINE (0:00 - 1:00) — Future vision
  // ═══════════════════════════════════════════════════════════

  // Opening — CCO sets the vision
  {
    id: 'dp-001', speakerId: 'speaker_0', participantId: 'p-claire',
    rawText: 'We need to reimagine the entire customer journey from the moment they think about us to the moment they receive their product. Today we lose customers at every handoff point — between online and store, between enquiry and resolution, between purchase and delivery. The vision is a seamless, anticipatory experience where the customer never has to repeat themselves and we predict their needs before they articulate them.',
    phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.94,
    keywords: ['customer journey', 'seamless', 'anticipatory', 'handoff', 'predict needs'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.96, reasoning: 'Describes the entire customer journey transformation' },
      { domain: 'Operations', relevance: 0.72, reasoning: 'Addresses handoff failures between channels' },
    ],
    themes: [
      { label: 'Seamless Omnichannel Experience', category: 'strategic', confidence: 0.95, reasoning: 'Core vision statement for channel integration' },
      { label: 'Predictive Customer Service', category: 'innovation', confidence: 0.88, reasoning: 'Anticipatory experience aspiration' },
    ],
    actors: [
      { name: 'Customer', role: 'End consumer', interactions: [
        { withActor: 'Retail system', action: 'experiences handoff failures between channels', sentiment: 'frustrated', context: 'Customers lose context when moving between online and store' },
        { withActor: 'Contact centre', action: 'has to repeat themselves', sentiment: 'frustrated', context: 'No unified customer record across touchpoints' },
      ]},
    ],
    sentimentTone: 'concerned', semanticMeaning: 'The CCO articulates a vision for seamless customer experience that eliminates handoff friction and enables predictive service',
    speakerIntent: 'Setting strategic vision for CX transformation', temporalFocus: 'future', timeOffsetMs: 3 * 60 * 1000,
  },

  {
    id: 'dp-002', speakerId: 'speaker_2', participantId: 'p-priya',
    rawText: 'AI gives us the opportunity to fundamentally change the economics of customer service. Right now every interaction costs us between eight and twelve pounds in agent time. With conversational AI handling the first thirty percent of enquiries — order status, returns, store hours, stock checks — we could redirect those savings into higher-value human interactions where empathy and judgement matter. The technology is ready; GPT-class models can handle these conversations naturally.',
    phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.92,
    keywords: ['AI', 'conversational AI', 'cost reduction', 'GPT', 'agent time', 'self-service'],
    domains: [
      { domain: 'Technology', relevance: 0.95, reasoning: 'Describes AI technology opportunity and readiness' },
      { domain: 'Customer Experience', relevance: 0.82, reasoning: 'Improving service through AI automation' },
      { domain: 'Operations', relevance: 0.78, reasoning: 'Contact centre cost economics' },
    ],
    themes: [
      { label: 'AI-Driven Self-Service', category: 'innovation', confidence: 0.93, reasoning: 'Conversational AI for routine enquiries' },
      { label: 'Cost Optimisation', category: 'operational', confidence: 0.86, reasoning: 'Reducing cost-per-interaction through automation' },
    ],
    actors: [
      { name: 'Customer', role: 'End consumer', interactions: [
        { withActor: 'AI assistant', action: 'gets instant resolution for routine queries', sentiment: 'positive', context: 'Order status, returns, stock checks handled automatically' },
      ]},
      { name: 'Contact centre agent', role: 'Customer service representative', interactions: [
        { withActor: 'Customer', action: 'handles high-value interactions requiring empathy', sentiment: 'positive', context: 'Agents freed from routine queries to focus on complex issues' },
        { withActor: 'AI assistant', action: 'receives handoff for complex cases', sentiment: 'smooth', context: 'AI handles simple queries, agents handle exceptions' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'Digital director identifies AI as transformative opportunity to reduce contact costs while improving service quality',
    speakerIntent: 'Advocating for AI-first customer service strategy', temporalFocus: 'future', timeOffsetMs: 7 * 60 * 1000,
  },

  {
    id: 'dp-003', speakerId: 'speaker_4', participantId: 'p-sarah',
    rawText: 'Our NPS data tells a clear story — the biggest driver of detraction is not product quality, it is the effort required to resolve issues. Customers who have to contact us more than once about the same issue are four times more likely to churn. And our first-contact resolution rate has dropped from seventy-two percent to fifty-eight percent in the last eighteen months. That is the burning platform.',
    phase: 'REIMAGINE', primaryType: 'INSIGHT', confidence: 0.91,
    keywords: ['NPS', 'first-contact resolution', 'customer effort', 'churn', 'detraction'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.97, reasoning: 'Direct customer satisfaction and retention metrics' },
      { domain: 'Operations', relevance: 0.68, reasoning: 'Contact centre performance metrics' },
    ],
    themes: [
      { label: 'Customer Effort Reduction', category: 'strategic', confidence: 0.94, reasoning: 'Effort is the primary churn driver' },
      { label: 'First-Contact Resolution', category: 'operational', confidence: 0.91, reasoning: 'Declining FCR is the core operational failure' },
    ],
    actors: [
      { name: 'Customer', role: 'End consumer', interactions: [
        { withActor: 'Contact centre', action: 'contacts multiple times for same issue', sentiment: 'frustrated', context: 'First-contact resolution dropped from 72% to 58%' },
      ]},
      { name: 'Contact centre', role: 'Service delivery channel', interactions: [
        { withActor: 'Customer', action: 'fails to resolve on first contact', sentiment: 'critical', context: '42% of issues require repeat contact, driving churn' },
      ]},
    ],
    sentimentTone: 'critical', semanticMeaning: 'Customer insight head presents data showing customer effort and repeat contacts as the primary driver of churn',
    speakerIntent: 'Establishing the burning platform with data evidence', temporalFocus: 'present', timeOffsetMs: 12 * 60 * 1000,
  },

  {
    id: 'dp-004', speakerId: 'speaker_1', participantId: 'p-james',
    rawText: 'In stores we see the same pattern. Colleagues spend twenty-five percent of their time on tasks that could be automated — stock checks for customers, processing click-and-collect, handling refunds that need manager approval for no good reason. If we freed that time they could actually engage with customers on the shop floor, which is where the conversion happens. Our mystery shopper scores for proactive engagement are at an all-time low.',
    phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.89,
    keywords: ['store automation', 'colleague time', 'click-and-collect', 'proactive engagement', 'conversion'],
    domains: [
      { domain: 'Operations', relevance: 0.94, reasoning: 'Store operational efficiency and task automation' },
      { domain: 'People', relevance: 0.81, reasoning: 'Colleague time allocation and engagement' },
      { domain: 'Customer Experience', relevance: 0.76, reasoning: 'In-store customer engagement and conversion' },
    ],
    themes: [
      { label: 'Store Task Automation', category: 'operational', confidence: 0.90, reasoning: 'Automating routine store tasks to free colleague time' },
      { label: 'Proactive Customer Engagement', category: 'strategic', confidence: 0.85, reasoning: 'Converting freed time into sales engagement' },
    ],
    actors: [
      { name: 'Store colleague', role: 'Retail floor staff', interactions: [
        { withActor: 'Customer', action: 'spends insufficient time on proactive engagement', sentiment: 'concerned', context: '25% of time consumed by automatable tasks' },
        { withActor: 'Store system', action: 'manually processes stock checks and refunds', sentiment: 'frustrated', context: 'Manager approval needed for routine refunds' },
      ]},
      { name: 'Customer', role: 'In-store shopper', interactions: [
        { withActor: 'Store colleague', action: 'receives limited proactive engagement', sentiment: 'concerned', context: 'Mystery shopper scores at all-time low' },
      ]},
    ],
    sentimentTone: 'concerned', semanticMeaning: 'Operations head identifies 25% of store colleague time wasted on automatable tasks, reducing customer engagement',
    speakerIntent: 'Making the case for store-level automation to drive engagement', temporalFocus: 'present', timeOffsetMs: 17 * 60 * 1000,
  },

  {
    id: 'dp-005', speakerId: 'speaker_7', participantId: 'p-mark',
    rawText: 'I want our stores to become experience destinations, not just fulfilment points. Imagine a customer walks in and their phone connects to our system — we know their online basket, their browsing history, their loyalty tier. The colleague gets a subtle notification: this customer has been looking at winter coats for two weeks. That is a fundamentally different conversation than "can I help you find something?" — it is "I see you have been looking at the Belmont range, we have it in your size, let me show you."',
    phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.93,
    keywords: ['experience destination', 'personalisation', 'connected store', 'loyalty', 'clienteling'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.96, reasoning: 'Personalised in-store experience vision' },
      { domain: 'Technology', relevance: 0.84, reasoning: 'Connected systems enabling real-time personalisation' },
      { domain: 'People', relevance: 0.72, reasoning: 'Colleague-enabled personalised service' },
    ],
    themes: [
      { label: 'Connected Store Experience', category: 'innovation', confidence: 0.94, reasoning: 'Phone-to-store system integration for personalisation' },
      { label: 'Clienteling & Personalisation', category: 'strategic', confidence: 0.91, reasoning: 'Using customer data for in-store personalised service' },
    ],
    actors: [
      { name: 'Customer', role: 'In-store shopper', interactions: [
        { withActor: 'Store system', action: 'phone connects and shares browsing context', sentiment: 'smooth', context: 'Online basket and browsing history available in-store' },
        { withActor: 'Store colleague', action: 'receives personalised product recommendation', sentiment: 'positive', context: 'Colleague knows what customer has been browsing online' },
      ]},
      { name: 'Store colleague', role: 'Retail floor staff', interactions: [
        { withActor: 'Store system', action: 'receives customer context notification', sentiment: 'positive', context: 'Subtle alert with customer preferences and browsing history' },
        { withActor: 'Customer', action: 'delivers personalised recommendation', sentiment: 'positive', context: 'Targeted product suggestion based on online behaviour' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'Store experience head envisions connected stores where colleagues receive real-time customer context for personalised engagement',
    speakerIntent: 'Painting the vision of a connected, personalised store experience', temporalFocus: 'future', timeOffsetMs: 22 * 60 * 1000,
  },

  {
    id: 'dp-006', speakerId: 'speaker_3', participantId: 'p-tom',
    rawText: 'The biggest quick win I see is agent-assist AI. Not replacing agents but giving them superpowers. When a customer calls about a delivery issue the agent currently has to open four different systems — the order management system, the carrier portal, the CRM, and the refund tool. An AI copilot could pull all that context into one view, suggest the right resolution, even pre-draft the response. We tested this with a proof of concept and agent handling time dropped by thirty-five percent.',
    phase: 'REIMAGINE', primaryType: 'ENABLER', confidence: 0.90,
    keywords: ['agent-assist', 'AI copilot', 'handling time', 'context aggregation', 'resolution'],
    domains: [
      { domain: 'Technology', relevance: 0.92, reasoning: 'AI copilot technology for agent assistance' },
      { domain: 'Operations', relevance: 0.88, reasoning: 'Contact centre efficiency and handling time' },
      { domain: 'Customer Experience', relevance: 0.74, reasoning: 'Faster resolution improves customer experience' },
    ],
    themes: [
      { label: 'Agent-Assist AI', category: 'innovation', confidence: 0.93, reasoning: 'AI copilot aggregating context and suggesting resolutions' },
      { label: 'System Consolidation', category: 'operational', confidence: 0.82, reasoning: 'Unifying 4 separate systems into one agent view' },
    ],
    actors: [
      { name: 'Contact centre agent', role: 'Customer service representative', interactions: [
        { withActor: 'AI copilot', action: 'receives aggregated context and resolution suggestions', sentiment: 'positive', context: 'AI pulls data from 4 systems into one view' },
        { withActor: 'Customer', action: 'resolves issue 35% faster with AI assistance', sentiment: 'positive', context: 'POC showed 35% reduction in handling time' },
      ]},
      { name: 'Customer', role: 'End consumer', interactions: [
        { withActor: 'Contact centre agent', action: 'gets faster resolution for delivery issues', sentiment: 'positive', context: 'Agent has full context without asking customer to repeat' },
      ]},
      { name: 'AI copilot', role: 'Agent assistance tool', interactions: [
        { withActor: 'Order management system', action: 'aggregates order and delivery data', sentiment: 'smooth', context: 'Pulls from OMS, carrier portal, CRM, and refund tool' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'Contact centre manager advocates for agent-assist AI that consolidates 4 systems and reduces handling time by 35%',
    speakerIntent: 'Championing agent-assist AI as a proven quick win', temporalFocus: 'future', timeOffsetMs: 27 * 60 * 1000,
  },

  {
    id: 'dp-007', speakerId: 'speaker_5', participantId: 'p-david',
    rawText: 'The technical foundation for all of this is a unified customer data platform. Right now we have customer data fragmented across seventeen different systems. The loyalty database does not talk to the contact centre CRM. The online browsing history is siloed from the store POS data. Until we solve this data unification problem none of these AI use cases will work properly because the models need a complete picture of the customer.',
    phase: 'REIMAGINE', primaryType: 'INSIGHT', confidence: 0.88,
    keywords: ['customer data platform', 'data unification', 'fragmented systems', 'CDP', 'data silos'],
    domains: [
      { domain: 'Technology', relevance: 0.97, reasoning: 'Core technical architecture challenge' },
      { domain: 'Customer Experience', relevance: 0.72, reasoning: 'Data unification enables personalisation' },
    ],
    themes: [
      { label: 'Customer Data Platform', category: 'foundational', confidence: 0.95, reasoning: 'Unified CDP is prerequisite for all AI use cases' },
      { label: 'Data Silos', category: 'constraint', confidence: 0.90, reasoning: '17 fragmented systems blocking progress' },
    ],
    actors: [
      { name: 'IT architecture', role: 'Technology team', interactions: [
        { withActor: 'Data systems', action: 'struggles to unify 17 fragmented customer data sources', sentiment: 'concerned', context: 'Loyalty, CRM, browsing, POS data all siloed' },
      ]},
      { name: 'AI models', role: 'Machine learning systems', interactions: [
        { withActor: 'Data systems', action: 'cannot access complete customer picture', sentiment: 'blocked', context: 'Fragmented data prevents effective personalisation' },
      ]},
    ],
    sentimentTone: 'concerned', semanticMeaning: 'IT architect identifies 17 fragmented data systems as the foundational blocker for all AI initiatives',
    speakerIntent: 'Establishing data unification as the critical enabler', temporalFocus: 'present', timeOffsetMs: 33 * 60 * 1000,
  },

  {
    id: 'dp-008', speakerId: 'speaker_0', participantId: 'p-claire',
    rawText: 'Let me paint the picture of what success looks like. A customer orders online, decides to return in store. They walk in, scan a QR code, the return is processed instantly — no queue, no receipt needed, refund hits their account in seconds. While they are there the system suggests an exchange based on their preferences. The colleague completes it on a tablet right there on the floor. That entire journey today takes forty-five minutes and involves three different people. It should take four minutes.',
    phase: 'REIMAGINE', primaryType: 'VISIONARY', confidence: 0.95,
    keywords: ['seamless returns', 'QR code', 'instant processing', 'omnichannel', 'journey reduction'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.97, reasoning: 'End-to-end customer journey redesign' },
      { domain: 'Operations', relevance: 0.85, reasoning: 'Process efficiency — 45 min to 4 min' },
      { domain: 'Technology', relevance: 0.78, reasoning: 'QR code, instant processing, tablet-based completion' },
    ],
    themes: [
      { label: 'Frictionless Returns', category: 'strategic', confidence: 0.96, reasoning: 'Vision of 4-minute QR-based returns replacing 45-minute process' },
      { label: 'Omnichannel Journey', category: 'strategic', confidence: 0.90, reasoning: 'Online purchase to in-store return with personalised exchange' },
    ],
    actors: [
      { name: 'Customer', role: 'End consumer', interactions: [
        { withActor: 'Store system', action: 'scans QR code for instant return processing', sentiment: 'positive', context: 'No queue, no receipt, refund in seconds' },
        { withActor: 'Recommendation engine', action: 'receives personalised exchange suggestion', sentiment: 'positive', context: 'System suggests alternatives based on preferences' },
        { withActor: 'Store colleague', action: 'completes exchange on shop floor tablet', sentiment: 'smooth', context: 'No need to visit till — completed on mobile device' },
      ]},
      { name: 'Store colleague', role: 'Retail floor staff', interactions: [
        { withActor: 'Customer', action: 'facilitates tablet-based exchange on the floor', sentiment: 'positive', context: 'Colleague empowered with mobile tools' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'CCO describes the target state: a 4-minute seamless return journey replacing the current 45-minute 3-person process',
    speakerIntent: 'Articulating a concrete vision of the future customer journey', temporalFocus: 'future', timeOffsetMs: 38 * 60 * 1000,
  },

  {
    id: 'dp-009', speakerId: 'speaker_2', participantId: 'p-priya',
    rawText: 'Self-service is not just about cost reduction — it is about customer preference. Our research shows sixty-seven percent of under-35s prefer to resolve issues themselves without speaking to anyone. But our self-service options are terrible. The chatbot answers maybe twelve percent of queries successfully. The FAQ is three years old. The mobile app cannot even show real-time delivery tracking. We are forcing customers into expensive channels they do not want to use.',
    phase: 'REIMAGINE', primaryType: 'INSIGHT', confidence: 0.91,
    keywords: ['self-service', 'customer preference', 'chatbot failure', 'mobile app', 'channel shift'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.94, reasoning: 'Customer channel preferences and self-service gaps' },
      { domain: 'Technology', relevance: 0.88, reasoning: 'Failed chatbot and outdated digital tools' },
    ],
    themes: [
      { label: 'Self-Service Transformation', category: 'strategic', confidence: 0.93, reasoning: '67% preference for self-service but 12% chatbot success rate' },
      { label: 'Digital Channel Failure', category: 'constraint', confidence: 0.89, reasoning: 'Current digital tools fundamentally broken' },
    ],
    actors: [
      { name: 'Customer', role: 'End consumer', interactions: [
        { withActor: 'Chatbot', action: 'attempts self-service but fails 88% of the time', sentiment: 'frustrated', context: 'Chatbot only resolves 12% of queries' },
        { withActor: 'Contact centre', action: 'forced into expensive channel they prefer to avoid', sentiment: 'frustrated', context: '67% of under-35s prefer self-service' },
      ]},
      { name: 'Chatbot', role: 'Digital self-service tool', interactions: [
        { withActor: 'Customer', action: 'fails to resolve 88% of enquiries', sentiment: 'critical', context: 'Outdated FAQ, no real-time data access' },
      ]},
    ],
    sentimentTone: 'critical', semanticMeaning: 'Digital director highlights that 67% of young customers prefer self-service but the chatbot only resolves 12% of queries',
    speakerIntent: 'Exposing the gap between customer preference and current capability', temporalFocus: 'present', timeOffsetMs: 43 * 60 * 1000,
  },

  {
    id: 'dp-010', speakerId: 'speaker_6', participantId: 'p-rebecca',
    rawText: 'Whatever we build with AI has to be designed with regulation in mind from day one. The Consumer Duty rules mean we have obligations around vulnerable customer identification, fair treatment, and transparent communication. If an AI chatbot cannot detect that someone is in financial difficulty or emotional distress and route them to a human, we are in regulatory breach. This is not optional — the FCA has been very clear on this.',
    phase: 'REIMAGINE', primaryType: 'CONSTRAINT', confidence: 0.87,
    keywords: ['Consumer Duty', 'FCA', 'vulnerable customers', 'regulation', 'AI governance'],
    domains: [
      { domain: 'Regulation', relevance: 0.97, reasoning: 'FCA Consumer Duty compliance requirements' },
      { domain: 'Technology', relevance: 0.75, reasoning: 'AI systems must incorporate regulatory safeguards' },
      { domain: 'Customer Experience', relevance: 0.71, reasoning: 'Vulnerable customer detection and routing' },
    ],
    themes: [
      { label: 'Consumer Duty Compliance', category: 'regulatory', confidence: 0.95, reasoning: 'FCA requirements for AI in customer service' },
      { label: 'Vulnerable Customer Safeguards', category: 'regulatory', confidence: 0.92, reasoning: 'AI must detect vulnerability and escalate to humans' },
    ],
    actors: [
      { name: 'AI chatbot', role: 'Automated customer service', interactions: [
        { withActor: 'Vulnerable customer', action: 'must detect distress signals and escalate', sentiment: 'concerned', context: 'FCA Consumer Duty requires vulnerability identification' },
        { withActor: 'Human agent', action: 'must hand off when vulnerability detected', sentiment: 'neutral', context: 'Regulatory requirement for human escalation path' },
      ]},
      { name: 'FCA', role: 'Financial regulator', interactions: [
        { withActor: 'Retail organisation', action: 'mandates Consumer Duty compliance for AI', sentiment: 'neutral', context: 'Clear regulatory expectations for AI in customer service' },
      ]},
    ],
    sentimentTone: 'concerned', semanticMeaning: 'Compliance manager warns that AI deployment must comply with FCA Consumer Duty, particularly vulnerable customer detection',
    speakerIntent: 'Establishing regulatory guardrails for AI implementation', temporalFocus: 'present', timeOffsetMs: 48 * 60 * 1000,
  },

  {
    id: 'dp-011', speakerId: 'speaker_4', participantId: 'p-sarah',
    rawText: 'There is a massive opportunity in proactive outreach. We know when a delivery is going to be late before the customer does. We know when a product they bought is being recalled. We know when their loyalty points are about to expire. But we wait for them to contact us. If we flipped that — proactive notifications with resolution options embedded — we could eliminate thirty percent of inbound contact volume and massively improve sentiment.',
    phase: 'REIMAGINE', primaryType: 'OPPORTUNITY', confidence: 0.92,
    keywords: ['proactive outreach', 'notifications', 'contact deflection', 'predictive', 'sentiment'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.95, reasoning: 'Proactive communication transforming customer relationship' },
      { domain: 'Operations', relevance: 0.82, reasoning: '30% inbound contact volume reduction' },
      { domain: 'Technology', relevance: 0.71, reasoning: 'Predictive notification system architecture' },
    ],
    themes: [
      { label: 'Proactive Customer Communication', category: 'strategic', confidence: 0.94, reasoning: 'Flipping from reactive to proactive outreach' },
      { label: 'Contact Deflection', category: 'operational', confidence: 0.88, reasoning: '30% reduction in inbound contact through proactive alerts' },
    ],
    actors: [
      { name: 'Customer', role: 'End consumer', interactions: [
        { withActor: 'Notification system', action: 'receives proactive alerts with embedded resolution options', sentiment: 'positive', context: 'Late delivery, recall, loyalty expiry notifications before customer calls' },
      ]},
      { name: 'Notification system', role: 'Proactive outreach platform', interactions: [
        { withActor: 'Customer', action: 'sends predictive notifications with self-resolution options', sentiment: 'smooth', context: 'Embedded actions in notifications prevent inbound calls' },
        { withActor: 'Contact centre', action: 'deflects 30% of inbound volume through proactive outreach', sentiment: 'positive', context: 'Customers resolve issues before they need to call' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'Customer insight head proposes proactive outreach to eliminate 30% of inbound contacts by notifying customers before they discover issues',
    speakerIntent: 'Advocating for proactive communication strategy', temporalFocus: 'future', timeOffsetMs: 53 * 60 * 1000,
  },

  {
    id: 'dp-012', speakerId: 'speaker_7', participantId: 'p-mark',
    rawText: 'The store colleague experience is just as important as the customer experience. Our staff turnover is twenty-eight percent — double the industry average. Exit interviews consistently cite outdated technology, too many manual processes, and feeling disconnected from the customer. If we give them the right tools — real-time customer insights, mobile POS, AI-assisted product knowledge — they become brand ambassadors instead of checkout operators.',
    phase: 'REIMAGINE', primaryType: 'INSIGHT', confidence: 0.88,
    keywords: ['colleague experience', 'staff turnover', 'mobile POS', 'brand ambassadors', 'retention'],
    domains: [
      { domain: 'People', relevance: 0.96, reasoning: 'Colleague experience, retention, and empowerment' },
      { domain: 'Technology', relevance: 0.78, reasoning: 'Mobile tools and AI-assisted product knowledge' },
      { domain: 'Operations', relevance: 0.72, reasoning: 'Store operational efficiency' },
    ],
    themes: [
      { label: 'Colleague Empowerment', category: 'people', confidence: 0.93, reasoning: 'Transforming colleagues from checkout operators to brand ambassadors' },
      { label: 'Staff Retention Crisis', category: 'people', confidence: 0.89, reasoning: '28% turnover, double industry average' },
    ],
    actors: [
      { name: 'Store colleague', role: 'Retail floor staff', interactions: [
        { withActor: 'Store system', action: 'frustrated by outdated technology and manual processes', sentiment: 'frustrated', context: '28% staff turnover, exit interviews cite technology gaps' },
        { withActor: 'Customer', action: 'cannot deliver personalised service without tools', sentiment: 'concerned', context: 'Disconnected from customer data, feel like checkout operators' },
      ]},
      { name: 'Retail organisation', role: 'Employer', interactions: [
        { withActor: 'Store colleague', action: 'fails to provide adequate technology and tools', sentiment: 'critical', context: 'Double industry average turnover rate' },
      ]},
    ],
    sentimentTone: 'concerned', semanticMeaning: 'Store experience head links 28% staff turnover to outdated technology and proposes colleague empowerment through modern tools',
    speakerIntent: 'Making the case that colleague experience drives customer experience', temporalFocus: 'present', timeOffsetMs: 58 * 60 * 1000,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 2: CONSTRAINTS (1:00 - 2:00) — Blockers & friction
  // ═══════════════════════════════════════════════════════════

  {
    id: 'dp-013', speakerId: 'speaker_5', participantId: 'p-david',
    rawText: 'The biggest technical constraint is our legacy order management system. It is a monolith built in 2011, running on on-premise servers. It processes forty thousand orders a day and it cannot be taken offline. Every integration point is a custom API that was built by a contractor who left seven years ago. To build the unified view we need, we either wrap it with an API layer which takes twelve months, or replace it which takes three years and costs forty million.',
    phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.93,
    keywords: ['legacy OMS', 'monolith', 'technical debt', 'API layer', 'on-premise'],
    domains: [
      { domain: 'Technology', relevance: 0.98, reasoning: 'Core legacy system constraint blocking transformation' },
      { domain: 'Operations', relevance: 0.74, reasoning: 'Order processing dependency on legacy system' },
    ],
    themes: [
      { label: 'Legacy System Constraint', category: 'constraint', confidence: 0.96, reasoning: '2011 monolith blocking all modernisation efforts' },
      { label: 'Technical Debt', category: 'constraint', confidence: 0.90, reasoning: 'Custom APIs built by departed contractors' },
    ],
    actors: [
      { name: 'IT architecture', role: 'Technology team', interactions: [
        { withActor: 'Legacy OMS', action: 'cannot modernise or take offline due to 40K daily orders', sentiment: 'blocked', context: '2011 monolith with custom APIs from departed contractor' },
      ]},
      { name: 'Legacy OMS', role: 'Order management system', interactions: [
        { withActor: 'Modern systems', action: 'blocks integration through proprietary custom APIs', sentiment: 'critical', context: '12-month API wrapper or 3-year £40M replacement' },
      ]},
    ],
    sentimentTone: 'critical', semanticMeaning: 'IT architect describes the 2011 legacy OMS monolith as the primary technical blocker: 12 months for API wrapper or 3 years and £40M for replacement',
    speakerIntent: 'Quantifying the technical constraint and presenting options', temporalFocus: 'present', timeOffsetMs: 63 * 60 * 1000,
  },

  {
    id: 'dp-014', speakerId: 'speaker_3', participantId: 'p-tom',
    rawText: 'My agents are drowning in demand. We handle twelve thousand contacts per day across voice, email, chat, and social. Average wait time on voice is fourteen minutes. Email response time is forty-eight hours. And we have a thirty-percent staff vacancy rate because we cannot recruit fast enough. The training pipeline takes twelve weeks so even when we hire we do not get capacity for three months. We cannot solve this with recruitment alone — we need to fundamentally change the demand equation.',
    phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.91,
    keywords: ['contact volume', 'wait time', 'vacancy rate', 'recruitment', 'demand management'],
    domains: [
      { domain: 'Operations', relevance: 0.96, reasoning: 'Contact centre capacity crisis' },
      { domain: 'People', relevance: 0.88, reasoning: '30% vacancy rate and 12-week training pipeline' },
      { domain: 'Customer Experience', relevance: 0.79, reasoning: '14 min wait time and 48 hour email response' },
    ],
    themes: [
      { label: 'Contact Centre Capacity Crisis', category: 'constraint', confidence: 0.94, reasoning: '12K contacts/day, 30% vacancy, 14-min wait' },
      { label: 'Demand Failure', category: 'operational', confidence: 0.89, reasoning: 'Cannot recruit out of the problem — need demand reduction' },
    ],
    actors: [
      { name: 'Contact centre agent', role: 'Customer service representative', interactions: [
        { withActor: 'Customer', action: 'cannot provide timely service due to overwhelming demand', sentiment: 'frustrated', context: '14-min wait on voice, 48-hour email response' },
      ]},
      { name: 'Contact centre', role: 'Service delivery channel', interactions: [
        { withActor: 'HR', action: 'cannot fill 30% staff vacancies fast enough', sentiment: 'critical', context: '12-week training pipeline means 3-month lag on new hires' },
        { withActor: 'Customer', action: 'delivers poor experience due to capacity constraints', sentiment: 'critical', context: '12K daily contacts across 4 channels' },
      ]},
    ],
    sentimentTone: 'critical', semanticMeaning: 'Contact centre manager describes capacity crisis: 12K daily contacts, 14-min wait, 30% vacancy rate with 12-week training pipeline',
    speakerIntent: 'Demonstrating that the capacity problem cannot be solved by hiring', temporalFocus: 'present', timeOffsetMs: 68 * 60 * 1000,
  },

  {
    id: 'dp-015', speakerId: 'speaker_6', participantId: 'p-rebecca',
    rawText: 'The data governance situation is a significant constraint. We are processing customer data across multiple jurisdictions — UK GDPR applies, but we also sell into the EU and we have a growing online presence in the Middle East. Every AI model we deploy needs a data protection impact assessment. The information security team is three people. At current pace it takes four months to approve a new data processing activity. That bottleneck will kill our AI ambitions.',
    phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.89,
    keywords: ['GDPR', 'data governance', 'DPIA', 'information security', 'compliance bottleneck'],
    domains: [
      { domain: 'Regulation', relevance: 0.97, reasoning: 'Multi-jurisdiction data governance constraints' },
      { domain: 'Technology', relevance: 0.76, reasoning: 'AI deployment requires DPIA approval' },
      { domain: 'People', relevance: 0.68, reasoning: '3-person InfoSec team bottleneck' },
    ],
    themes: [
      { label: 'Data Governance Bottleneck', category: 'regulatory', confidence: 0.94, reasoning: '4-month DPIA approval timeline with 3-person team' },
      { label: 'Multi-Jurisdiction Compliance', category: 'regulatory', confidence: 0.88, reasoning: 'UK GDPR, EU, Middle East data requirements' },
    ],
    actors: [
      { name: 'Information security team', role: 'Data governance gatekeepers', interactions: [
        { withActor: 'AI projects', action: 'takes 4 months to approve each data processing activity', sentiment: 'blocked', context: 'Only 3 people in the team for multi-jurisdiction compliance' },
      ]},
      { name: 'AI projects', role: 'Digital transformation initiatives', interactions: [
        { withActor: 'Information security team', action: 'queues for DPIA approval blocking deployment', sentiment: 'frustrated', context: 'Every AI model requires separate assessment' },
      ]},
    ],
    sentimentTone: 'concerned', semanticMeaning: 'Compliance manager warns that 3-person InfoSec team creates a 4-month bottleneck for AI deployment DPIAs across 3 jurisdictions',
    speakerIntent: 'Flagging governance capacity as a critical blocker', temporalFocus: 'present', timeOffsetMs: 74 * 60 * 1000,
  },

  {
    id: 'dp-016', speakerId: 'speaker_1', participantId: 'p-james',
    rawText: 'Store network connectivity is a fundamental constraint nobody talks about. Forty percent of our stores are on connections that cannot reliably stream video, let alone run real-time AI. The click-and-collect system goes down at least twice a week in those locations. We cannot deliver a connected store experience on infrastructure that was provisioned for processing card payments. The network upgrade programme was deprioritised last year to fund the warehouse automation project.',
    phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.90,
    keywords: ['network connectivity', 'store infrastructure', 'bandwidth', 'click-and-collect', 'deprioritised'],
    domains: [
      { domain: 'Technology', relevance: 0.93, reasoning: 'Store network infrastructure inadequate for modern services' },
      { domain: 'Operations', relevance: 0.85, reasoning: 'Click-and-collect outages affecting store operations' },
    ],
    themes: [
      { label: 'Store Infrastructure Gap', category: 'constraint', confidence: 0.92, reasoning: '40% of stores on inadequate connectivity' },
      { label: 'Investment Prioritisation', category: 'strategic', confidence: 0.82, reasoning: 'Network upgrade deprioritised for warehouse automation' },
    ],
    actors: [
      { name: 'Store systems', role: 'In-store technology', interactions: [
        { withActor: 'Network infrastructure', action: 'experiences regular outages on inadequate connectivity', sentiment: 'critical', context: '40% of stores on connections designed for card payments only' },
      ]},
      { name: 'IT leadership', role: 'Technology decision makers', interactions: [
        { withActor: 'Store systems', action: 'deprioritised network upgrade to fund warehouse automation', sentiment: 'concerned', context: 'Competing investment priorities left stores behind' },
      ]},
    ],
    sentimentTone: 'critical', semanticMeaning: 'Operations head reveals that 40% of stores have inadequate connectivity for modern services, with network upgrade deprioritised',
    speakerIntent: 'Exposing hidden infrastructure constraint', temporalFocus: 'present', timeOffsetMs: 79 * 60 * 1000,
  },

  {
    id: 'dp-017', speakerId: 'speaker_0', participantId: 'p-claire',
    rawText: 'There is an organisational constraint that we need to acknowledge. Customer experience sits across four different P&Ls — online reports to digital, stores report to retail operations, contact centre reports to shared services, and loyalty reports to marketing. Nobody owns the end-to-end journey. When I try to drive cross-channel improvements I have to negotiate with four budget holders who have competing KPIs. The customer does not care about our org chart.',
    phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.92,
    keywords: ['organisational silos', 'P&L ownership', 'competing KPIs', 'cross-channel', 'governance'],
    domains: [
      { domain: 'People', relevance: 0.94, reasoning: 'Organisational structure blocking CX ownership' },
      { domain: 'Customer Experience', relevance: 0.88, reasoning: 'No single owner of end-to-end customer journey' },
      { domain: 'Operations', relevance: 0.72, reasoning: 'Four separate P&Ls with competing objectives' },
    ],
    themes: [
      { label: 'Organisational Silos', category: 'constraint', confidence: 0.95, reasoning: 'CX split across 4 P&Ls with no end-to-end ownership' },
      { label: 'CX Governance Gap', category: 'strategic', confidence: 0.89, reasoning: 'Competing KPIs prevent cross-channel improvement' },
    ],
    actors: [
      { name: 'Chief Customer Officer', role: 'CX leadership', interactions: [
        { withActor: 'Budget holders', action: 'must negotiate with 4 competing P&Ls for CX improvements', sentiment: 'frustrated', context: 'Online, stores, contact centre, loyalty all under different leadership' },
      ]},
      { name: 'Customer', role: 'End consumer', interactions: [
        { withActor: 'Retail organisation', action: 'experiences fragmented journey across siloed channels', sentiment: 'frustrated', context: 'Org structure creates handoff friction customer can feel' },
      ]},
    ],
    sentimentTone: 'critical', semanticMeaning: 'CCO identifies the organisational constraint: CX split across 4 P&Ls with no end-to-end ownership and competing KPIs',
    speakerIntent: 'Naming the governance gap as a transformation blocker', temporalFocus: 'present', timeOffsetMs: 85 * 60 * 1000,
  },

  {
    id: 'dp-018', speakerId: 'speaker_2', participantId: 'p-priya',
    rawText: 'We have an AI skills gap that is acute. My team has two data scientists and one ML engineer. To deliver conversational AI, agent-assist, personalisation, and proactive outreach we need at least eight more people. The market for AI talent is ferocious — we are competing with banks paying fifty percent more. And honestly, even if we hire them, we do not have the MLOps infrastructure to deploy and monitor models at scale. We are running Jupyter notebooks on someone\'s laptop.',
    phase: 'CONSTRAINTS', primaryType: 'CONSTRAINT', confidence: 0.90,
    keywords: ['AI skills gap', 'data scientists', 'MLOps', 'talent competition', 'infrastructure'],
    domains: [
      { domain: 'People', relevance: 0.93, reasoning: 'AI talent shortage and recruitment challenge' },
      { domain: 'Technology', relevance: 0.91, reasoning: 'Missing MLOps infrastructure for model deployment' },
    ],
    themes: [
      { label: 'AI Talent Gap', category: 'people', confidence: 0.94, reasoning: 'Need 8+ AI specialists, competing with banks at 50% premium' },
      { label: 'MLOps Maturity', category: 'foundational', confidence: 0.88, reasoning: 'No production ML infrastructure — running notebooks on laptops' },
    ],
    actors: [
      { name: 'AI team', role: 'Data science and ML engineering', interactions: [
        { withActor: 'AI projects', action: 'cannot deliver 4 workstreams with 3 people', sentiment: 'blocked', context: '2 data scientists and 1 ML engineer for entire AI programme' },
      ]},
      { name: 'Retail organisation', role: 'Employer', interactions: [
        { withActor: 'AI talent market', action: 'cannot compete on salary with banking sector', sentiment: 'concerned', context: 'Banks paying 50% more for same AI skills' },
      ]},
    ],
    sentimentTone: 'critical', semanticMeaning: 'Digital director reveals the AI skills crisis: 3 people for 4 major AI workstreams, competing against banks paying 50% more, with no MLOps infrastructure',
    speakerIntent: 'Quantifying the AI capability gap', temporalFocus: 'present', timeOffsetMs: 91 * 60 * 1000,
  },

  {
    id: 'dp-019', speakerId: 'speaker_4', participantId: 'p-sarah',
    rawText: 'The customer data quality issue is worse than people realise. Our customer matching rate across channels is only forty-three percent. That means for fifty-seven percent of our customers we cannot connect their online activity to their store visits to their contact centre interactions. Every personalisation use case and every single-customer-view initiative depends on this matching rate being at least eighty percent. Without it we are personalising for less than half our customers.',
    phase: 'CONSTRAINTS', primaryType: 'RISK', confidence: 0.89,
    keywords: ['data quality', 'customer matching', 'identity resolution', 'personalisation', 'single customer view'],
    domains: [
      { domain: 'Technology', relevance: 0.90, reasoning: 'Customer identity resolution technology challenge' },
      { domain: 'Customer Experience', relevance: 0.87, reasoning: 'Personalisation dependent on customer matching' },
    ],
    themes: [
      { label: 'Customer Identity Resolution', category: 'foundational', confidence: 0.93, reasoning: '43% matching rate blocks personalisation for majority of customers' },
      { label: 'Data Quality', category: 'constraint', confidence: 0.90, reasoning: '57% of customers cannot be identified across channels' },
    ],
    actors: [
      { name: 'Customer data team', role: 'Data management', interactions: [
        { withActor: 'Customer records', action: 'can only match 43% of customers across channels', sentiment: 'critical', context: 'Need 80% for personalisation use cases to work' },
      ]},
      { name: 'Personalisation engine', role: 'AI recommendation system', interactions: [
        { withActor: 'Customer data', action: 'cannot personalise for 57% of customers', sentiment: 'blocked', context: 'Incomplete customer profiles prevent targeted recommendations' },
      ]},
    ],
    sentimentTone: 'critical', semanticMeaning: 'Customer insight head reveals 43% customer matching rate across channels, making personalisation impossible for the majority',
    speakerIntent: 'Quantifying the data quality blocker for personalisation', temporalFocus: 'present', timeOffsetMs: 97 * 60 * 1000,
  },

  {
    id: 'dp-020', speakerId: 'speaker_3', participantId: 'p-tom',
    rawText: 'There is a cultural constraint in the contact centre that we need to address. Our agents have been trained for years in a script-based model — follow the process, tick the boxes, close the ticket. Moving to an AI-assisted model where they exercise judgement, handle complex emotional situations, and collaborate with AI tools requires a completely different skill set and mindset. Some of our best performers under the old model are our biggest resistors of change.',
    phase: 'CONSTRAINTS', primaryType: 'RISK', confidence: 0.87,
    keywords: ['cultural change', 'script-based model', 'change resistance', 'skill transformation', 'agent mindset'],
    domains: [
      { domain: 'People', relevance: 0.96, reasoning: 'Agent culture change and skill transformation' },
      { domain: 'Operations', relevance: 0.78, reasoning: 'Operating model shift from script-based to judgement-based' },
    ],
    themes: [
      { label: 'Agent Culture Transformation', category: 'people', confidence: 0.91, reasoning: 'Script-based model to AI-assisted judgement model' },
      { label: 'Change Resistance', category: 'people', confidence: 0.88, reasoning: 'Top performers under old model resist the transition' },
    ],
    actors: [
      { name: 'Contact centre agent', role: 'Customer service representative', interactions: [
        { withActor: 'AI copilot', action: 'resists adoption of AI-assisted tools', sentiment: 'concerned', context: 'Years of script-based training creates resistance to new model' },
        { withActor: 'Management', action: 'needs completely different training and mindset shift', sentiment: 'anxious', context: 'Best performers under old model are biggest resistors' },
      ]},
    ],
    sentimentTone: 'concerned', semanticMeaning: 'Contact centre manager identifies cultural barrier: agents trained in script-based model resist transition to AI-assisted judgement model',
    speakerIntent: 'Flagging people/culture risk in the transformation', temporalFocus: 'present', timeOffsetMs: 103 * 60 * 1000,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 3: DEFINE_APPROACH (2:00 - 3:00) — Implementation
  // ═══════════════════════════════════════════════════════════

  {
    id: 'dp-021', speakerId: 'speaker_0', participantId: 'p-claire',
    rawText: 'Based on everything we have discussed, I see three horizons. Horizon one, zero to six months: deploy agent-assist AI and fix the self-service chatbot. These have proven ROI and address the capacity crisis immediately. Horizon two, six to eighteen months: build the customer data platform and launch proactive outreach. Horizon three, eighteen to thirty-six months: connected stores and full AI-driven personalisation. We cannot do everything at once but we must start now.',
    phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.93,
    keywords: ['three horizons', 'roadmap', 'agent-assist', 'CDP', 'connected stores', 'prioritisation'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.90, reasoning: 'End-to-end CX transformation roadmap' },
      { domain: 'Technology', relevance: 0.85, reasoning: 'Technology deployment sequencing' },
      { domain: 'Operations', relevance: 0.78, reasoning: 'Addressing capacity crisis in H1' },
    ],
    themes: [
      { label: 'Three-Horizon Roadmap', category: 'strategic', confidence: 0.95, reasoning: 'Phased approach: quick wins, foundations, transformation' },
      { label: 'Prioritised Investment', category: 'strategic', confidence: 0.90, reasoning: 'Sequencing by proven ROI and dependency chain' },
    ],
    actors: [
      { name: 'Chief Customer Officer', role: 'CX leadership', interactions: [
        { withActor: 'Executive team', action: 'proposes three-horizon implementation roadmap', sentiment: 'positive', context: 'H1: agent-assist/chatbot, H2: CDP/proactive, H3: connected stores' },
      ]},
      { name: 'Retail organisation', role: 'Business', interactions: [
        { withActor: 'AI programme', action: 'commits to phased deployment starting immediately', sentiment: 'positive', context: 'Cannot do everything at once but must start now' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'CCO proposes three-horizon roadmap: H1 (0-6m) agent-assist and chatbot, H2 (6-18m) CDP and proactive outreach, H3 (18-36m) connected stores and personalisation',
    speakerIntent: 'Providing strategic framework for prioritised implementation', temporalFocus: 'future', timeOffsetMs: 123 * 60 * 1000,
  },

  {
    id: 'dp-022', speakerId: 'speaker_2', participantId: 'p-priya',
    rawText: 'For Horizon 1 I recommend we partner with a specialist AI vendor rather than build in-house. We can deploy a production-grade conversational AI platform in eight weeks that handles order tracking, returns initiation, store finder, and delivery rescheduling. Meanwhile we build the agent-assist copilot on Azure OpenAI using our existing Microsoft enterprise agreement. That gives us two major wins in the first quarter without needing to hire the eight AI specialists immediately.',
    phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.91,
    keywords: ['AI vendor', 'conversational AI platform', 'Azure OpenAI', 'quick deployment', 'build vs buy'],
    domains: [
      { domain: 'Technology', relevance: 0.96, reasoning: 'AI platform selection and deployment strategy' },
      { domain: 'Operations', relevance: 0.78, reasoning: 'Contact centre improvement through AI deployment' },
    ],
    themes: [
      { label: 'Build vs Buy Strategy', category: 'strategic', confidence: 0.93, reasoning: 'Vendor partnership for speed, Azure OpenAI for agent-assist' },
      { label: 'Quick Win Deployment', category: 'operational', confidence: 0.90, reasoning: 'Production AI in 8 weeks without full team hire' },
    ],
    actors: [
      { name: 'AI vendor', role: 'Technology partner', interactions: [
        { withActor: 'Retail organisation', action: 'delivers production conversational AI in 8 weeks', sentiment: 'positive', context: 'Handles order tracking, returns, store finder, delivery rescheduling' },
      ]},
      { name: 'AI team', role: 'Internal AI capability', interactions: [
        { withActor: 'Azure OpenAI', action: 'builds agent-assist copilot on existing enterprise agreement', sentiment: 'positive', context: 'Leverages Microsoft relationship to avoid procurement delay' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'Digital director recommends vendor partnership for self-service AI (8 weeks) and Azure OpenAI for agent-assist, avoiding 8-person hiring dependency',
    speakerIntent: 'Proposing practical build vs buy strategy for H1', temporalFocus: 'future', timeOffsetMs: 128 * 60 * 1000,
  },

  {
    id: 'dp-023', speakerId: 'speaker_5', participantId: 'p-david',
    rawText: 'For the API wrapper around the legacy OMS, I propose we use an event-driven architecture with a change data capture pattern. We do not need to replace the monolith yet — we stream events from it into a modern event bus. Every order creation, status change, and delivery update becomes an event that other systems can consume. This decouples the new AI services from the legacy system without touching its core. We can have the first events flowing in ten weeks.',
    phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.90,
    keywords: ['event-driven', 'change data capture', 'event bus', 'decoupling', 'API wrapper'],
    domains: [
      { domain: 'Technology', relevance: 0.98, reasoning: 'Technical architecture solution for legacy integration' },
    ],
    themes: [
      { label: 'Event-Driven Architecture', category: 'foundational', confidence: 0.94, reasoning: 'CDC pattern to stream events from legacy OMS without replacement' },
      { label: 'Incremental Modernisation', category: 'strategic', confidence: 0.89, reasoning: 'Decoupling strategy avoids risky monolith replacement' },
    ],
    actors: [
      { name: 'IT architecture', role: 'Technology team', interactions: [
        { withActor: 'Legacy OMS', action: 'implements change data capture to stream events without touching core', sentiment: 'positive', context: 'First events flowing in 10 weeks, no monolith modification needed' },
      ]},
      { name: 'AI services', role: 'New AI applications', interactions: [
        { withActor: 'Event bus', action: 'consumes real-time order events decoupled from legacy system', sentiment: 'smooth', context: 'Order creation, status changes, delivery updates as events' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'IT architect proposes event-driven CDC pattern to decouple new AI services from legacy OMS without replacement, events flowing in 10 weeks',
    speakerIntent: 'Providing technical solution to the legacy constraint', temporalFocus: 'future', timeOffsetMs: 134 * 60 * 1000,
  },

  {
    id: 'dp-024', speakerId: 'speaker_6', participantId: 'p-rebecca',
    rawText: 'I can accelerate the DPIA process if we create a pre-approved AI framework. Instead of assessing each use case individually, we define categories of AI deployment with standard controls — for example, category A is customer-facing conversational AI with specific guardrails for data retention, escalation, and vulnerability detection. Any deployment that fits the category gets fast-tracked approval in two weeks instead of four months. This requires upfront investment but scales beautifully.',
    phase: 'DEFINE_APPROACH', primaryType: 'ENABLER', confidence: 0.89,
    keywords: ['pre-approved framework', 'DPIA fast-track', 'AI governance', 'category-based approval', 'scalable compliance'],
    domains: [
      { domain: 'Regulation', relevance: 0.96, reasoning: 'Scalable compliance framework for AI deployment' },
      { domain: 'Technology', relevance: 0.74, reasoning: 'AI deployment guardrails and controls' },
    ],
    themes: [
      { label: 'Scalable AI Governance', category: 'regulatory', confidence: 0.93, reasoning: 'Pre-approved categories reduce DPIA from 4 months to 2 weeks' },
      { label: 'Compliance as Enabler', category: 'strategic', confidence: 0.88, reasoning: 'Transforming compliance from blocker to accelerator' },
    ],
    actors: [
      { name: 'Information security team', role: 'Data governance', interactions: [
        { withActor: 'AI projects', action: 'creates pre-approved AI framework for fast-track approval', sentiment: 'positive', context: 'Category-based approach reduces DPIA from 4 months to 2 weeks' },
      ]},
      { name: 'AI projects', role: 'Transformation initiatives', interactions: [
        { withActor: 'Information security team', action: 'gets fast-tracked approval under pre-approved framework', sentiment: 'positive', context: 'Standard controls per AI deployment category' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'Compliance manager proposes pre-approved AI framework that reduces DPIA from 4 months to 2 weeks through category-based standard controls',
    speakerIntent: 'Turning compliance from blocker into enabler', temporalFocus: 'future', timeOffsetMs: 140 * 60 * 1000,
  },

  {
    id: 'dp-025', speakerId: 'speaker_3', participantId: 'p-tom',
    rawText: 'For the contact centre transformation I propose a three-wave approach. Wave one: deploy AI triage that routes enquiries to the right channel — self-service, agent-assist, or direct to specialist. Wave two: launch the agent copilot and retrain agents on the new model. Wave three: introduce proactive outreach to deflect demand before it arrives. Each wave reduces inbound volume by ten to fifteen percent. By wave three we should be handling forty percent less volume through the contact centre.',
    phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.91,
    keywords: ['three waves', 'AI triage', 'agent copilot', 'proactive outreach', 'demand deflection'],
    domains: [
      { domain: 'Operations', relevance: 0.95, reasoning: 'Contact centre transformation roadmap' },
      { domain: 'Technology', relevance: 0.84, reasoning: 'AI triage, copilot, and proactive outreach deployment' },
      { domain: 'Customer Experience', relevance: 0.78, reasoning: 'Improved routing and faster resolution' },
    ],
    themes: [
      { label: 'Contact Centre Transformation', category: 'operational', confidence: 0.94, reasoning: 'Three-wave approach targeting 40% volume reduction' },
      { label: 'Intelligent Routing', category: 'innovation', confidence: 0.87, reasoning: 'AI triage routing to optimal channel' },
    ],
    actors: [
      { name: 'AI triage', role: 'Intelligent routing system', interactions: [
        { withActor: 'Customer', action: 'routes enquiry to optimal channel based on intent', sentiment: 'smooth', context: 'Self-service, agent-assist, or specialist depending on complexity' },
      ]},
      { name: 'Contact centre agent', role: 'Customer service representative', interactions: [
        { withActor: 'AI copilot', action: 'adopts new AI-assisted working model after retraining', sentiment: 'positive', context: 'Wave 2 retrains agents for AI-assisted judgement-based service' },
      ]},
      { name: 'Proactive outreach system', role: 'Demand deflection platform', interactions: [
        { withActor: 'Customer', action: 'resolves issues before they generate inbound contact', sentiment: 'positive', context: 'Wave 3 deflects demand before it arrives at contact centre' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'Contact centre manager proposes three-wave transformation targeting 40% volume reduction through AI triage, agent copilot, and proactive outreach',
    speakerIntent: 'Detailing the contact centre implementation plan', temporalFocus: 'future', timeOffsetMs: 146 * 60 * 1000,
  },

  {
    id: 'dp-026', speakerId: 'speaker_7', participantId: 'p-mark',
    rawText: 'For stores I want to pilot the connected experience in ten flagship locations first. These already have the network bandwidth and the most digitally engaged colleagues. We equip them with tablets, deploy the clienteling app, and integrate real-time customer data. Measure for three months against ten control stores. If we see the conversion lift and NPS improvement we expect, we have the business case to roll out to all two hundred and forty stores over the following twelve months.',
    phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.89,
    keywords: ['pilot', 'flagship stores', 'controlled experiment', 'tablets', 'clienteling app', 'rollout'],
    domains: [
      { domain: 'Operations', relevance: 0.88, reasoning: 'Store pilot programme and rollout strategy' },
      { domain: 'Customer Experience', relevance: 0.85, reasoning: 'Connected store experience pilot' },
      { domain: 'Technology', relevance: 0.79, reasoning: 'Tablet deployment and clienteling app' },
    ],
    themes: [
      { label: 'Pilot-First Strategy', category: 'operational', confidence: 0.92, reasoning: '10 flagship stores with control group before 240-store rollout' },
      { label: 'Connected Store Experience', category: 'innovation', confidence: 0.89, reasoning: 'Tablets, clienteling, real-time customer data integration' },
    ],
    actors: [
      { name: 'Store colleague', role: 'Retail floor staff', interactions: [
        { withActor: 'Clienteling app', action: 'uses tablet with real-time customer data for personalised service', sentiment: 'positive', context: '10 flagship stores piloted first with most engaged colleagues' },
      ]},
      { name: 'Customer', role: 'In-store shopper', interactions: [
        { withActor: 'Store colleague', action: 'receives personalised connected store experience', sentiment: 'positive', context: 'Pilot measuring conversion lift and NPS vs control stores' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'Store experience head proposes 10-store pilot with control group to prove connected experience business case before 240-store rollout',
    speakerIntent: 'Proposing evidence-based pilot approach for store transformation', temporalFocus: 'future', timeOffsetMs: 152 * 60 * 1000,
  },

  {
    id: 'dp-027', speakerId: 'speaker_1', participantId: 'p-james',
    rawText: 'The network upgrade for the remaining stores needs to be on the Horizon 2 plan. I have costed it at two point four million for full fibre rollout to all two hundred and forty locations. That sounds like a lot but when you factor in the click-and-collect reliability improvement alone — we lose an estimated three million in abandoned orders per year due to system outages — it pays for itself in under a year. I need this funded in the next budget cycle.',
    phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.88,
    keywords: ['network upgrade', 'fibre rollout', 'investment case', 'abandoned orders', 'budget'],
    domains: [
      { domain: 'Technology', relevance: 0.90, reasoning: 'Network infrastructure investment' },
      { domain: 'Operations', relevance: 0.86, reasoning: 'Click-and-collect reliability and abandoned orders' },
    ],
    themes: [
      { label: 'Infrastructure Investment Case', category: 'strategic', confidence: 0.91, reasoning: '£2.4M investment vs £3M annual loss from outages' },
      { label: 'Network Modernisation', category: 'foundational', confidence: 0.86, reasoning: 'Full fibre to all 240 stores' },
    ],
    actors: [
      { name: 'Operations leadership', role: 'Budget holder', interactions: [
        { withActor: 'Finance', action: 'requests £2.4M for store network upgrade in next budget cycle', sentiment: 'positive', context: 'ROI: eliminates £3M annual loss from click-and-collect outages' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'Operations head builds investment case for £2.4M network upgrade that eliminates £3M annual loss from click-and-collect outages',
    speakerIntent: 'Securing budget commitment for network infrastructure', temporalFocus: 'future', timeOffsetMs: 157 * 60 * 1000,
  },

  {
    id: 'dp-028', speakerId: 'speaker_4', participantId: 'p-sarah',
    rawText: 'For the customer data platform, I strongly recommend we start with identity resolution as sprint zero. We need to get the matching rate from forty-three to at least seventy-five percent before we build anything on top of it. I have benchmarked three CDP vendors — they all claim they can achieve this within twelve weeks using probabilistic and deterministic matching. Once we have identity resolution we can layer on personalisation, proactive outreach, and the single customer view incrementally.',
    phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.90,
    keywords: ['CDP vendor', 'identity resolution', 'sprint zero', 'matching rate', 'incremental'],
    domains: [
      { domain: 'Technology', relevance: 0.94, reasoning: 'CDP vendor selection and identity resolution' },
      { domain: 'Customer Experience', relevance: 0.82, reasoning: 'Foundation for personalisation and single customer view' },
    ],
    themes: [
      { label: 'Identity Resolution Sprint Zero', category: 'foundational', confidence: 0.93, reasoning: 'Matching rate from 43% to 75% as prerequisite for all personalisation' },
      { label: 'CDP Foundation', category: 'strategic', confidence: 0.89, reasoning: 'Vendor-delivered identity resolution in 12 weeks' },
    ],
    actors: [
      { name: 'Customer data team', role: 'Data management', interactions: [
        { withActor: 'CDP vendor', action: 'implements identity resolution as sprint zero', sentiment: 'positive', context: 'Targeting 43% to 75% matching rate in 12 weeks' },
      ]},
      { name: 'CDP vendor', role: 'Technology partner', interactions: [
        { withActor: 'Customer data', action: 'delivers probabilistic and deterministic matching', sentiment: 'smooth', context: 'Three vendors benchmarked, all claim 12-week delivery' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'Customer insight head proposes identity resolution as sprint zero for CDP, targeting 43% to 75% matching rate in 12 weeks with vendor partner',
    speakerIntent: 'Defining the foundation work for the customer data platform', temporalFocus: 'future', timeOffsetMs: 163 * 60 * 1000,
  },

  {
    id: 'dp-029', speakerId: 'speaker_0', participantId: 'p-claire',
    rawText: 'Let me close with the governance model. I am proposing we create a CX Transformation Office — a small cross-functional team of six people drawn from each of the four P&Ls plus technology and compliance. This team has a dedicated budget, a single set of CX KPIs, and reports directly to the CEO. This is the only way to cut through the organisational silos. I will put the proposal to the board next Thursday.',
    phase: 'DEFINE_APPROACH', primaryType: 'ACTION', confidence: 0.92,
    keywords: ['CX Transformation Office', 'cross-functional', 'governance', 'CEO reporting', 'dedicated budget'],
    domains: [
      { domain: 'People', relevance: 0.95, reasoning: 'New organisational structure for CX transformation' },
      { domain: 'Customer Experience', relevance: 0.88, reasoning: 'Unified CX KPIs and governance' },
    ],
    themes: [
      { label: 'CX Transformation Office', category: 'strategic', confidence: 0.95, reasoning: 'Cross-functional team with CEO reporting line and dedicated budget' },
      { label: 'Organisational Redesign', category: 'strategic', confidence: 0.89, reasoning: 'Cutting through 4-P&L silos with unified governance' },
    ],
    actors: [
      { name: 'Chief Customer Officer', role: 'CX leadership', interactions: [
        { withActor: 'CEO', action: 'proposes CX Transformation Office reporting directly to CEO', sentiment: 'positive', context: '6-person cross-functional team with dedicated budget' },
        { withActor: 'Board', action: 'will present proposal next Thursday', sentiment: 'positive', context: 'Governance model to cut through P&L silos' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'CCO proposes CX Transformation Office: 6-person cross-functional team with dedicated budget, single CX KPIs, reporting to CEO, to cut through organisational silos',
    speakerIntent: 'Defining the governance structure to enable transformation', temporalFocus: 'future', timeOffsetMs: 170 * 60 * 1000,
  },

  {
    id: 'dp-030', speakerId: 'speaker_2', participantId: 'p-priya',
    rawText: 'One final point on AI governance — we need to be transparent with customers about when they are interacting with AI. Our testing shows customers are actually more forgiving of AI mistakes when they know it is AI than when they think it is a human and discover it is not. I propose we adopt a clear "AI-first, human-always-available" positioning. Every AI interaction has a visible one-tap route to a human. This builds trust and satisfies the Consumer Duty transparency requirements simultaneously.',
    phase: 'DEFINE_APPROACH', primaryType: 'ENABLER', confidence: 0.88,
    keywords: ['AI transparency', 'customer trust', 'human escalation', 'AI-first', 'Consumer Duty'],
    domains: [
      { domain: 'Customer Experience', relevance: 0.92, reasoning: 'Building customer trust through AI transparency' },
      { domain: 'Regulation', relevance: 0.86, reasoning: 'Consumer Duty transparency requirements' },
      { domain: 'Technology', relevance: 0.74, reasoning: 'AI interaction design with human escalation' },
    ],
    themes: [
      { label: 'AI Transparency', category: 'strategic', confidence: 0.93, reasoning: 'Customers more forgiving when they know it is AI' },
      { label: 'Human-Available Escalation', category: 'strategic', confidence: 0.89, reasoning: 'One-tap human route builds trust and meets regulation' },
    ],
    actors: [
      { name: 'Customer', role: 'End consumer', interactions: [
        { withActor: 'AI assistant', action: 'informed transparently when interacting with AI', sentiment: 'positive', context: 'Testing shows more forgiveness when AI is disclosed upfront' },
        { withActor: 'Human agent', action: 'can reach human with one tap at any point', sentiment: 'positive', context: 'AI-first but human-always-available positioning' },
      ]},
    ],
    sentimentTone: 'positive', semanticMeaning: 'Digital director advocates for transparent AI-first positioning with one-tap human escalation, noting customers are more forgiving of disclosed AI',
    speakerIntent: 'Proposing AI transparency policy that builds trust and meets regulation', temporalFocus: 'future', timeOffsetMs: 175 * 60 * 1000,
  },
];

// Generate 970 more and merge with hand-written anchors
const GENERATED: Utterance[] = Array.from({ length: 970 }, (_, i) => generateUtterance(i));
const UTTERANCES: Utterance[] = [...HAND_WRITTEN, ...GENERATED].sort((a, b) => a.timeOffsetMs - b.timeOffsetMs);

// ─── Main seed function ──────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Retail CX Workshop...\n');

  // 1. Ensure org & user exist
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: 'Demo Organization' },
  });
  console.log('✓ Organization:', org.name);

  // Find existing user or create
  let user = await prisma.user.findFirst({ where: { id: USER_ID } })
    ?? await prisma.user.findFirst({ where: { organizationId: ORG_ID } })
    ?? await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: { email: 'admin@demo.com', name: 'Demo Admin', password: '$2b$10$placeholder', organizationId: ORG_ID },
    });
  }
  console.log('✓ User:', user.email);

  // 2. Clean up any previous run
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "agentic_analyses" WHERE "dataPointId" IN (SELECT id FROM "data_points" WHERE "workshopId" = '${WORKSHOP_ID}')`);
  } catch { /* table may not exist yet */ }
  await prisma.dataPointAnnotation.deleteMany({ where: { dataPoint: { workshopId: WORKSHOP_ID } } });
  await prisma.dataPointClassification.deleteMany({ where: { dataPoint: { workshopId: WORKSHOP_ID } } });
  await prisma.dataPoint.deleteMany({ where: { workshopId: WORKSHOP_ID } });
  await prisma.conversationInsight.deleteMany({ where: { workshopId: WORKSHOP_ID } });
  await prisma.conversationMessage.deleteMany({ where: { session: { workshopId: WORKSHOP_ID } } });
  try {
    await prisma.conversationReport.deleteMany({ where: { workshopId: WORKSHOP_ID } });
  } catch { /* ignore */ }
  await prisma.conversationSession.deleteMany({ where: { workshopId: WORKSHOP_ID } });
  await prisma.workshopParticipant.deleteMany({ where: { workshopId: WORKSHOP_ID } });
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "live_workshop_snapshots" WHERE "workshopId" = '${WORKSHOP_ID}'`);
  } catch { /* ignore */ }
  try {
    await prisma.workshop.delete({ where: { id: WORKSHOP_ID } });
  } catch { /* ignore */ }
  console.log('✓ Cleaned previous data');

  // 3. Create workshop
  const workshop = await prisma.workshop.create({
    data: {
      id: WORKSHOP_ID,
      name: 'RetailCo — CX Transformation & AI Strategy',
      description: 'A 3-hour strategic workshop exploring how RetailCo can deliver more compelling customer experience, remove downstream demand failure, and implement AI automation, self-service, and agent-assist services across retail, contact centre, and digital channels.',
      businessContext: 'RetailCo is a major UK retailer with 240 stores, 12,000 daily contact centre interactions, and declining NPS scores. First-contact resolution has dropped from 72% to 58%, staff turnover is 28% (double industry average), and the current chatbot resolves only 12% of queries. The leadership team is exploring AI-driven transformation across the customer journey.',
      workshopType: 'CUSTOMER',
      status: 'COMPLETED',
      organizationId: ORG_ID,
      createdById: user.id,
      scheduledDate: new Date('2026-02-10T09:00:00Z'),
    },
  });
  console.log('✓ Workshop:', workshop.name);

  // 4. Create participants
  const participantRecords: Record<string, string> = {};
  for (const p of PARTICIPANTS) {
    const rec = await prisma.workshopParticipant.create({
      data: {
        id: p.id,
        workshopId: WORKSHOP_ID,
        name: p.name,
        email: p.email,
        role: p.role,
        department: p.department,
      },
    });
    participantRecords[p.id] = rec.id;
    console.log(`  ✓ Participant: ${rec.name} (${p.role})`);
  }

  // 5. Create session (one live session)
  const session = await prisma.conversationSession.create({
    data: {
      id: 'session-retail-live',
      workshopId: WORKSHOP_ID,
      participantId: PARTICIPANTS[0].id,
      status: 'COMPLETED',
      runType: 'BASELINE',
      currentPhase: 'approach',
      phaseProgress: 100,
      completedAt: new Date('2026-02-10T12:00:00Z'),
      totalDurationMs: 3 * 60 * 60 * 1000,
    },
  });
  console.log('✓ Session:', session.id);

  // 6. Create data points + classifications + annotations + agentic analyses
  for (const u of UTTERANCES) {
    // DataPoint
    await prisma.dataPoint.create({
      data: {
        id: u.id,
        workshopId: WORKSHOP_ID,
        rawText: u.rawText,
        source: 'SPEECH',
        speakerId: u.speakerId,
        sessionId: session.id,
        participantId: u.participantId,
        createdAt: new Date(baseTime + u.timeOffsetMs),
      },
    });

    // Classification
    await prisma.dataPointClassification.create({
      data: {
        dataPointId: u.id,
        primaryType: u.primaryType,
        confidence: u.confidence,
        keywords: u.keywords,
        suggestedArea: u.domains[0]?.domain ?? null,
      },
    });

    // Annotation
    await prisma.dataPointAnnotation.create({
      data: {
        dataPointId: u.id,
        dialoguePhase: u.phase,
        intent: u.speakerIntent,
      },
    });

    // AgenticAnalysis
    await prisma.$executeRawUnsafe(`
      INSERT INTO "agentic_analyses" ("id", "dataPointId", "semanticMeaning", "speakerIntent", "temporalFocus", "sentimentTone", "domains", "themes", "connections", "actors", "overallConfidence", "uncertainties", "agentModel", "analysisVersion", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15)
    `,
      `aa-${u.id}`, u.id, u.semanticMeaning, u.speakerIntent, u.temporalFocus, u.sentimentTone,
      JSON.stringify(u.domains), JSON.stringify(u.themes), JSON.stringify([]),
      JSON.stringify(u.actors), u.confidence, [],
      'gpt-4o-mini', '1.0', new Date(baseTime + u.timeOffsetMs),
    );

    console.log(`  ✓ ${u.id}: [${u.primaryType}] ${u.rawText.slice(0, 60)}...`);
  }

  // 7. Create conversation insights (aggregated from data points)
  const insights = [
    { type: 'VISION', category: 'CUSTOMER', text: 'Seamless, anticipatory customer experience where customers never repeat themselves and needs are predicted before articulated' },
    { type: 'VISION', category: 'TECHNOLOGY', text: 'AI-first customer service with conversational AI handling 30% of routine enquiries and agent-assist copilot for complex cases' },
    { type: 'VISION', category: 'CUSTOMER', text: 'Connected store experience where colleague gets real-time customer context from online behaviour for personalised recommendations' },
    { type: 'VISION', category: 'CUSTOMER', text: 'Frictionless 4-minute returns journey replacing current 45-minute 3-person process via QR code and instant processing' },
    { type: 'CHALLENGE', category: 'CUSTOMER', text: 'First-contact resolution dropped from 72% to 58% — customers contacting more than once are 4x more likely to churn' },
    { type: 'CHALLENGE', category: 'BUSINESS', text: 'Customer experience split across 4 P&Ls with no single owner of end-to-end journey and competing KPIs' },
    { type: 'CHALLENGE', category: 'TECHNOLOGY', text: 'Current chatbot resolves only 12% of queries despite 67% of under-35s preferring self-service' },
    { type: 'CONSTRAINT', category: 'TECHNOLOGY', text: 'Legacy 2011 OMS monolith: 40K daily orders, cannot go offline, custom APIs from departed contractor. 12-month wrapper or 3-year £40M replacement' },
    { type: 'CONSTRAINT', category: 'BUSINESS', text: 'Contact centre handling 12K contacts/day, 14-min voice wait, 48-hour email response, 30% staff vacancy rate' },
    { type: 'CONSTRAINT', category: 'REGULATION', text: 'Data governance bottleneck: 3-person InfoSec team, 4-month DPIA approval timeline across 3 jurisdictions' },
    { type: 'CONSTRAINT', category: 'TECHNOLOGY', text: '40% of stores on inadequate network connectivity — click-and-collect down twice per week. Network upgrade deprioritised' },
    { type: 'CONSTRAINT', category: 'PEOPLE', text: 'AI skills gap: 3 people (2 data scientists, 1 ML engineer) for 4 major AI workstreams, competing with banks paying 50% more' },
    { type: 'CONSTRAINT', category: 'TECHNOLOGY', text: 'Customer matching rate at 43% across channels — personalisation impossible for 57% of customers' },
    { type: 'WHAT_WORKS', category: 'TECHNOLOGY', text: 'Agent-assist AI POC reduced handling time by 35% by aggregating 4 systems into one view' },
    { type: 'WHAT_WORKS', category: 'CUSTOMER', text: 'Proactive outreach opportunity: company knows about late deliveries, recalls, expiring loyalty before customer contacts' },
    { type: 'ACTUAL_JOB', category: 'BUSINESS', text: 'Store colleagues spend 25% of time on automatable tasks instead of proactive customer engagement' },
    { type: 'ACTUAL_JOB', category: 'PEOPLE', text: '28% store staff turnover (double industry average) driven by outdated technology and manual processes' },
  ];

  for (let i = 0; i < insights.length; i++) {
    const ins = insights[i];
    await prisma.conversationInsight.create({
      data: {
        workshopId: WORKSHOP_ID,
        sessionId: session.id,
        participantId: PARTICIPANTS[0].id,
        insightType: ins.type as 'ACTUAL_JOB' | 'WHAT_WORKS' | 'CHALLENGE' | 'CONSTRAINT' | 'VISION' | 'BELIEF' | 'RATING',
        category: ins.category as 'BUSINESS' | 'TECHNOLOGY' | 'PEOPLE' | 'CUSTOMER' | 'REGULATION',
        text: ins.text,
        severity: ins.type === 'CONSTRAINT' ? 4 : ins.type === 'CHALLENGE' ? 3 : 1,
        confidence: 0.88,
      },
    });
  }
  console.log(`✓ Created ${insights.length} conversation insights`);

  // 8. Create live workshop snapshot (for hemisphere page)
  const snapshotNodes: Record<string, unknown> = {};
  for (const u of UTTERANCES) {
    snapshotNodes[u.id] = {
      dataPointId: u.id,
      createdAtMs: baseTime + u.timeOffsetMs,
      rawText: u.rawText,
      dataPointSource: 'SPEECH',
      speakerId: u.speakerId,
      dialoguePhase: u.phase,
      intent: u.speakerIntent,
      themeId: null,
      themeLabel: u.themes[0]?.label ?? null,
      transcriptChunk: {
        speakerId: u.speakerId,
        startTimeMs: u.timeOffsetMs,
        endTimeMs: u.timeOffsetMs + 30000,
        confidence: u.confidence,
        source: 'DEEPGRAM',
      },
      classification: {
        primaryType: u.primaryType,
        confidence: u.confidence,
        keywords: u.keywords,
        suggestedArea: u.domains[0]?.domain ?? null,
        updatedAt: new Date(baseTime + u.timeOffsetMs).toISOString(),
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

  const snapshotPayload = {
    v: 1,
    dialoguePhase: 'DEFINE_APPROACH',
    nodesById: snapshotNodes,
    selectedNodeId: null,
    themesById: {},
    nodeThemeById: {},
    dependencyEdgesById: {},
    dependencyProcessedIds: [],
    dependencyProcessedCount: 0,
    utterances: UTTERANCES.map((u) => ({ rawText: u.rawText, createdAtMs: baseTime + u.timeOffsetMs })),
    interpreted: UTTERANCES.map((u) => ({ rawText: u.rawText, createdAtMs: baseTime + u.timeOffsetMs, classification: { primaryType: u.primaryType, confidence: u.confidence, keywords: u.keywords, suggestedArea: u.domains[0]?.domain ?? null } })),
    synthesisByDomain: {},
    pressurePoints: [],
  };

  await prisma.$executeRawUnsafe(`
    INSERT INTO "live_workshop_snapshots" ("id", "workshopId", "name", "dialoguePhase", "payload", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
  `,
    'snapshot-retail-final',
    WORKSHOP_ID,
    'RetailCo — CX Transformation & AI Strategy — 10 Feb 2026 12:00',
    'DEFINE_APPROACH',
    JSON.stringify(snapshotPayload),
    new Date('2026-02-10T12:00:00Z'),
    new Date('2026-02-10T12:00:00Z'),
  );
  console.log('✓ Created live snapshot: snapshot-retail-final');

  console.log('\n✅ Retail CX Workshop seed complete!');
  console.log(`\n  Workshop ID: ${WORKSHOP_ID}`);
  console.log(`  Participants: ${PARTICIPANTS.length}`);
  console.log(`  Utterances: ${UTTERANCES.length}`);
  console.log(`  Insights: ${insights.length}`);
  console.log(`  Snapshot: snapshot-retail-final`);
  console.log(`\n  View at: /admin/workshops/${WORKSHOP_ID}/hemisphere`);
  console.log(`  Live view: /admin/workshops/${WORKSHOP_ID}/live`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
