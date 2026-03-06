/**
 * Seed 30 synthetic discovery respondents for the Jo Air workshop.
 * Creates: workshop_participants, conversation_sessions, data_points, conversation_insights
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';

function cuid(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
function token(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// ─── 30 PARTICIPANTS ────────────────────────────────────────────────────────

const PARTICIPANTS = [
  // EXECUTIVE (5)
  { name: 'Sarah Morrison',    email: 'sarah.morrison@joairways.com',    role: 'Chief Customer Officer',                    department: 'Executive',           seniority: 'executive' },
  { name: 'James Whitfield',   email: 'james.whitfield@joairways.com',   role: 'Chief Operating Officer',                   department: 'Executive',           seniority: 'executive' },
  { name: 'Rachel Hughes',     email: 'rachel.hughes@joairways.com',     role: 'Chief Digital & Technology Officer',         department: 'Executive',           seniority: 'executive' },
  { name: 'David Palmer',      email: 'david.palmer@joairways.com',      role: 'VP Contact Centre & Customer Operations',    department: 'Operations',          seniority: 'executive' },
  { name: 'Fiona Lawson',      email: 'fiona.lawson@joairways.com',      role: 'Director of People & Transformation',        department: 'People',              seniority: 'executive' },
  // SENIOR MANAGERS (8)
  { name: 'Tom Hendricks',     email: 'tom.hendricks@joairways.com',     role: 'Head of Contact Centre Operations',          department: 'Operations',          seniority: 'manager' },
  { name: 'Angela Ward',       email: 'angela.ward@joairways.com',       role: 'Head of Workforce Management',               department: 'Operations',          seniority: 'manager' },
  { name: 'Chris Barker',      email: 'chris.barker@joairways.com',      role: 'Head of Technology & Systems',               department: 'Technology',          seniority: 'manager' },
  { name: 'Priya Sharma',      email: 'priya.sharma@joairways.com',      role: 'Head of Customer Experience',                department: 'Customer Experience', seniority: 'manager' },
  { name: 'Mark O\'Brien',     email: 'mark.obrien@joairways.com',       role: 'Head of BPO Partnerships',                   department: 'Operations',          seniority: 'manager' },
  { name: 'Louise Carter',     email: 'louise.carter@joairways.com',     role: 'Head of Quality & Assurance',                department: 'Quality',             seniority: 'manager' },
  { name: 'Simon Reed',        email: 'simon.reed@joairways.com',        role: 'Head of Learning & Development',             department: 'Learning & Development', seniority: 'manager' },
  { name: 'Katherine James',   email: 'katherine.james@joairways.com',   role: 'Senior Business Analyst',                    department: 'Operations',          seniority: 'manager' },
  // MANAGERS (7)
  { name: 'Daniel Cooper',     email: 'daniel.cooper@joairways.com',     role: 'Operations Manager (UK Hub)',                department: 'Operations',          seniority: 'manager' },
  { name: 'Emma Fitzgerald',   email: 'emma.fitzgerald@joairways.com',   role: 'Operations Manager (BPO Oversight)',         department: 'Operations',          seniority: 'manager' },
  { name: 'Raj Patel',         email: 'raj.patel@joairways.com',         role: 'Technology Platform Manager',                department: 'Technology',          seniority: 'manager' },
  { name: 'Sophie Williams',   email: 'sophie.williams@joairways.com',   role: 'Quality Manager',                            department: 'Quality',             seniority: 'manager' },
  { name: 'Ben Torres',        email: 'ben.torres@joairways.com',        role: 'Workforce Planning Manager',                 department: 'Operations',          seniority: 'manager' },
  { name: 'Claire Donovan',    email: 'claire.donovan@joairways.com',    role: 'Training Manager',                           department: 'Learning & Development', seniority: 'manager' },
  { name: 'Nathan Hughes',     email: 'nathan.hughes@joairways.com',     role: 'Data & Reporting Manager',                   department: 'Analytics',           seniority: 'manager' },
  // TEAM LEADERS (5)
  { name: 'Amy Fletcher',      email: 'amy.fletcher@joairways.com',      role: 'Senior Team Leader (Disruption Desk)',       department: 'Operations',          seniority: 'operational' },
  { name: 'Michael Grant',     email: 'michael.grant@joairways.com',     role: 'Team Leader (Premium Cabin)',                department: 'Operations',          seniority: 'operational' },
  { name: 'Jade Robinson',     email: 'jade.robinson@joairways.com',     role: 'Team Leader (Digital & Social)',             department: 'Customer Experience', seniority: 'operational' },
  { name: 'Liam O\'Connor',    email: 'liam.oconnor@joairways.com',      role: 'Team Leader (BPO Offshore, Manila)',         department: 'Operations',          seniority: 'operational' },
  { name: 'Natalie Price',     email: 'natalie.price@joairways.com',     role: 'Quality Coach',                              department: 'Quality',             seniority: 'operational' },
  // FRONT-LINE AGENTS (5)
  { name: 'Jamie Walsh',       email: 'jamie.walsh@joairways.com',       role: 'Customer Service Agent',                     department: 'Operations',          seniority: 'operational' },
  { name: 'Aisha Okafor',      email: 'aisha.okafor@joairways.com',      role: 'Customer Service Agent (Disruption)',        department: 'Operations',          seniority: 'operational' },
  { name: 'Ryan Mitchell',     email: 'ryan.mitchell@joairways.com',     role: 'Customer Service Agent (Premium)',           department: 'Operations',          seniority: 'operational' },
  { name: 'Charlotte Davies',  email: 'charlotte.davies@joairways.com',  role: 'Customer Service Agent',                     department: 'Operations',          seniority: 'operational' },
  { name: 'Tariq Hassan',      email: 'tariq.hassan@joairways.com',      role: 'Customer Service Agent (Cargo)',             department: 'Cargo Operations',    seniority: 'operational' },
];

// ─── RESPONSES PER PARTICIPANT ───────────────────────────────────────────────
// Each entry: [ questionKey, rawText, insightType, category, severity ]

type Response = [string, string, string, string, number];

const RESPONSES: Record<string, Response[]> = {

  'Sarah Morrison': [
    ['intro:context:0', 'My remit covers the full customer experience lifecycle — from booking through to post-flight service recovery. Contact centre performance sits at the heart of that. When the contact centre fails, it\'s usually the first thing our customers notice and the last thing they forget.', 'ACTUAL_JOB', 'CUSTOMER', 8],
    ['discovery:challenge:0', 'The transformation programme has created genuine momentum at board level, but I\'m not confident that momentum is translating into meaningful change on the floor. We\'ve invested significantly in platform technology and the queue instability hasn\'t improved. There\'s a disconnect between what we\'re building and what the operation actually needs.', 'CHALLENGE', 'BUSINESS', 8],
    ['discovery:challenge:1', 'Customer satisfaction scores have flatlined despite our investment. We\'re measuring the wrong things and rewarding the wrong behaviours. Efficiency metrics dominate and empathy gets lost. A customer who\'s just had a flight cancelled doesn\'t want efficiency — they want someone who actually cares.', 'CHALLENGE', 'CUSTOMER', 7],
    ['discovery:vision:0', 'I want a contact centre where every agent knows the customer in front of them — their history, their tier, their situation. Where routing is intelligent enough to match the right agent to the right contact every time. And where a customer who\'s been let down once becomes more loyal because of how we handled it, not less.', 'VISION', 'CUSTOMER', 9],
    ['discovery:constraint:0', 'The board understands the need to transform but expects returns within a 24-month window. That limits our ability to make the foundational investments — particularly in data and integration — that would unlock everything else. We keep building on top of a fragile foundation.', 'CONSTRAINT', 'BUSINESS', 8],
    ['discovery:what_works:0', 'Our premium cabin service recovery team is genuinely exceptional. When they get it right, customers write in to thank us. That\'s the model. I want to understand what they do differently and replicate it at scale across the whole operation.', 'WHAT_WORKS', 'CUSTOMER', 7],
  ],

  'James Whitfield': [
    ['intro:context:0', 'I oversee the operational backbone of the airline — including all customer-facing operations. Contact centre is one of three major operational transformation programmes I\'m accountable for right now. The others are ground handling and cargo logistics.', 'ACTUAL_JOB', 'BUSINESS', 7],
    ['discovery:challenge:0', 'My biggest concern is that we\'re running three major transformation programmes simultaneously with no shared performance framework. Each has its own KPIs, its own governance, its own steering group. They don\'t talk to each other. And in the contact centre specifically, I can see at least six workstreams that are supposed to be improving performance but have no clear owner and no sequenced delivery plan.', 'CHALLENGE', 'BUSINESS', 9],
    ['discovery:challenge:1', 'The BPO model is fundamentally broken from an oversight perspective. We have four outsourced sites — Manila, Cape Town, Krakow, and Hyderabad — and I genuinely do not know whether they are delivering to our standards. The visibility is inadequate. We get reports, but the reports measure the wrong things.', 'CHALLENGE', 'BUSINESS', 9],
    ['discovery:vision:0', 'One performance framework. One set of KPIs that applies to every site — in-house and outsourced. Real-time visibility into what\'s happening across all contact types. And a clear sequenced investment plan that we can hold people accountable to delivering.', 'VISION', 'BUSINESS', 8],
    ['discovery:constraint:0', 'Legacy contractual structures with our BPO partners are a real constraint. Some of our SLAs were written 12 years ago and don\'t reflect what good looks like today. Renegotiating takes time we don\'t have.', 'CONSTRAINT', 'BUSINESS', 7],
  ],

  'Rachel Hughes': [
    ['intro:context:0', 'I\'m responsible for the technology estate that underpins the contact centre — and it\'s genuinely one of the most complex technology environments I\'ve worked in. We have 11 different systems that agents interact with regularly. Some date back to the early 2000s. None of them talk to each other properly.', 'ACTUAL_JOB', 'TECHNOLOGY', 9],
    ['discovery:challenge:0', 'The core issue is system fragmentation. When a customer calls about a disrupted flight, the agent needs to access the PNR system, the disruption management tool, the loyalty platform, the payment system, and sometimes the cargo system — all in the same conversation. Average handling time is high not because agents are slow, but because the tools are fundamentally disconnected. This is a systemic architectural problem, not a training problem.', 'CHALLENGE', 'TECHNOLOGY', 9],
    ['discovery:challenge:1', 'We\'ve attempted three integration projects in the last five years. All three stalled. The reasons vary — budget, vendor lock-in, data governance issues — but the result is the same. We keep adding systems on top of systems and the complexity compounds.', 'CHALLENGE', 'TECHNOLOGY', 8],
    ['discovery:vision:0', 'A single agent desktop. One interface that surfaces everything the agent needs — customer record, booking history, disruption status, loyalty tier — without them having to navigate between systems. This is technically achievable. We just need the organisational will and the investment sequencing to get there.', 'VISION', 'TECHNOLOGY', 9],
    ['discovery:constraint:0', 'Our core reservations system is deeply embedded and genuinely difficult to replace. Any integration work has to work around it rather than through it, which adds cost and complexity to everything. It\'s the anchor dragging every technology improvement project.', 'CONSTRAINT', 'TECHNOLOGY', 8],
    ['discovery:what_works:0', 'The AI-assisted disruption alerts we piloted last year showed real promise. Agents who had proactive information before the customer called handled those contacts 40% faster and received significantly higher satisfaction scores. That\'s the direction of travel — proactive intelligence rather than reactive lookup.', 'WHAT_WORKS', 'TECHNOLOGY', 8],
  ],

  'David Palmer': [
    ['intro:context:0', 'I run the contact centre and customer operations function end to end — strategy, day-to-day performance, workforce planning, and oversight of our BPO partners. About 4,200 agents across six sites when you include the outsourced operations.', 'ACTUAL_JOB', 'BUSINESS', 8],
    ['discovery:challenge:0', 'Queue instability is my daily reality. We can forecast demand with reasonable accuracy at the macro level but our routing logic can\'t respond to intraday variation fast enough. When there\'s disruption — which in aviation is constant — the queues collapse and we go into recovery mode. We\'ve been in recovery mode more often than not over the past 18 months.', 'CHALLENGE', 'BUSINESS', 9],
    ['discovery:challenge:1', 'The improvement initiatives are a source of real frustration. I have six separate workstreams running — workforce management optimisation, technology consolidation, quality framework review, BPO governance, agent empowerment, and customer routing redesign. None of them are connected to a shared delivery plan. They\'re competing for the same resources and sending conflicting signals to the operation.', 'CHALLENGE', 'BUSINESS', 9],
    ['discovery:vision:0', 'Demand-responsive routing that adjusts in real time. Agents who aren\'t navigating five systems to resolve a single contact. A quality framework that applies equally to every site. And improvement workstreams that are sequenced, funded, and owned by named individuals.', 'VISION', 'BUSINESS', 9],
    ['discovery:constraint:0', 'The honest answer is that we don\'t have a single source of truth for contact centre performance. Different teams pull different data from different systems and arrive at different conclusions. Until we solve the data problem, we can\'t make good decisions about prioritisation or investment.', 'CONSTRAINT', 'BUSINESS', 8],
  ],

  'Fiona Lawson': [
    ['intro:context:0', 'My role sits across the people and transformation agenda. In practical terms, right now that means I\'m deeply focused on attrition in the contact centre, which has become one of our most significant operational risks.', 'ACTUAL_JOB', 'PEOPLE', 8],
    ['discovery:challenge:0', 'Attrition is running at 34% annualised in our front-line agent population. That means we\'re replacing roughly a third of our agent base every year. The cost is enormous — recruitment, training, the productivity dip while new agents find their feet. But more damaging is the institutional knowledge we\'re constantly losing. You can\'t build a high-performing contact centre when a third of your people are new every year.', 'CHALLENGE', 'PEOPLE', 9],
    ['discovery:challenge:1', 'The drivers of attrition are well understood — poor tooling, high stress, lack of career progression, inconsistent management quality. What we haven\'t done is actually fix any of them. We run engagement surveys, we get the same results, and then we run the same surveys again. There\'s a credibility gap between what we say we\'re doing and what agents actually experience.', 'CHALLENGE', 'PEOPLE', 8],
    ['discovery:vision:0', 'I want agents to see the contact centre as the start of a career, not a job they\'re passing through. That means clear progression pathways, investment in skills development, and managers who are trained to coach rather than just monitor. If we get that right, attrition falls, capability builds, and the whole operation stabilises.', 'VISION', 'PEOPLE', 9],
    ['discovery:constraint:0', 'Pay is a real constraint. We\'re not competitive in most of the markets we operate in. We\'ve made the case to the board but contact centre compensation isn\'t a headline investment. Until that changes, we\'re recruiting into a leaking bucket.', 'CONSTRAINT', 'PEOPLE', 7],
    ['discovery:what_works:0', 'The mentoring programme we piloted in the Glasgow site last year reduced six-month attrition by 18 percentage points. New agents who had a dedicated buddy stayed longer and ramped faster. We just haven\'t scaled it yet.', 'WHAT_WORKS', 'PEOPLE', 8],
  ],

  'Tom Hendricks': [
    ['intro:context:0', 'I run day-to-day operations across our three UK contact centre sites — Heathrow, Manchester, and Edinburgh. About 1,800 agents in total, managed through six operational managers who each look after a function or shift pattern.', 'ACTUAL_JOB', 'BUSINESS', 7],
    ['discovery:challenge:0', 'Queue instability is the dominant challenge. The problem isn\'t forecasting — our demand forecasts are actually pretty good. The problem is that when disruption hits, we have no mechanism to dynamically reroute contacts or flex the agent pool. We go to a crisis protocol manually, which is slow and inconsistent.', 'CHALLENGE', 'BUSINESS', 9],
    ['discovery:challenge:1', 'The quality framework is aspirational rather than operational. We have standards documented but they\'re not consistently applied, partly because our monitoring tools are inadequate and partly because our team leaders don\'t have time to do structured coaching alongside managing real-time performance.', 'CHALLENGE', 'BUSINESS', 7],
    ['discovery:vision:0', 'Real-time visibility across all queues with automated rerouting triggers. Quality coaching that\'s built into the workflow, not bolted on. And team leaders who are freed up enough to actually develop their people rather than just firefighting.', 'VISION', 'BUSINESS', 8],
    ['discovery:what_works:0', 'The disruption desk team is the best-performing unit in the operation. They have tighter tooling, more experienced agents, and a culture of ownership. Every other team should look like them.', 'WHAT_WORKS', 'BUSINESS', 7],
  ],

  'Angela Ward': [
    ['intro:context:0', 'Workforce management — forecasting, scheduling, real-time management across our in-house sites. I have a team of twelve. We also attempt to coordinate with the BPO partners but the data exchange is painful.', 'ACTUAL_JOB', 'BUSINESS', 7],
    ['discovery:challenge:0', 'Our WFM platform is fundamentally not fit for purpose. It was built for a simpler contact environment and can\'t handle our volume of contact types, skill groups, and site combinations. When we try to model disruption scenarios, it falls over. We end up doing manual spreadsheet overrides which defeats the entire point of having a system.', 'CHALLENGE', 'TECHNOLOGY', 9],
    ['discovery:challenge:1', 'BPO data latency is a real operational problem. We get performance data from our Manila site with a four-hour lag. By the time I know what\'s happening there, it\'s already history. I can\'t manage in real time without real-time data.', 'CHALLENGE', 'BUSINESS', 8],
    ['discovery:vision:0', 'A WFM platform that covers all sites — in-house and BPO — with real-time data feeds and automated intraday adjustment recommendations. That\'s table stakes. Beyond that, AI-driven demand sensing that can anticipate disruption and pre-position resource before queues build.', 'VISION', 'TECHNOLOGY', 9],
    ['discovery:constraint:0', 'Our BPO contracts don\'t mandate real-time data sharing. We get daily summary reports. To get real-time feeds, we\'d need to renegotiate contracts and potentially fund the technical integration ourselves. That\'s a six to nine month process at minimum.', 'CONSTRAINT', 'BUSINESS', 7],
  ],

  'Chris Barker': [
    ['intro:context:0', 'I own the technology stack for the contact centre — the CCaaS platform, the CRM layer, the telephony infrastructure, and all the integrations in between. There are a lot of integrations. Most of them are fragile.', 'ACTUAL_JOB', 'TECHNOLOGY', 8],
    ['discovery:challenge:0', 'We migrated to a cloud CCaaS platform two years ago and the migration was technically successful. But we lifted and shifted the old processes rather than redesigning them. So we have a modern platform running old logic. The routing rules alone are a 300-page document that nobody fully understands. We have routing rules that contradict each other and we don\'t know it.', 'CHALLENGE', 'TECHNOLOGY', 9],
    ['discovery:challenge:1', 'API stability is a constant issue. Three of our key integrations — to the reservations system, the loyalty platform, and the disruption tool — break on a regular basis. When they break, agents have to work without those data sources and handling times spike. Last month we had four separate integration failures in a two-week window.', 'CHALLENGE', 'TECHNOLOGY', 9],
    ['discovery:vision:0', 'Stable integrations. That should not be a controversial ambition but it is. Beyond stability, I want routing logic that\'s transparent and maintainable — something a business user can understand and modify without needing a developer. And a single agent desktop that surfaces all the data they need without system switching.', 'VISION', 'TECHNOLOGY', 8],
    ['discovery:what_works:0', 'The callback system we deployed 18 months ago has been a genuine win. It\'s reduced inbound pressure, improved customer satisfaction, and given us better control over queue shape. It\'s simple technology but it was the right call.', 'WHAT_WORKS', 'TECHNOLOGY', 7],
  ],

  'Priya Sharma': [
    ['intro:context:0', 'Customer experience strategy across all channels — contact centre, digital self-serve, social, and in-airport. My job is to make sure the experience is consistent and improving. In practice, right now it\'s mostly inconsistent and declining in a few key areas.', 'ACTUAL_JOB', 'CUSTOMER', 8],
    ['discovery:challenge:0', 'The customer journey breaks down at moments of disruption. We have a 2-hour flight delay and suddenly the customer is trying to rebook, claim expenses, and understand their rights — all of which require different systems and different teams. We send them in circles. By the time they get resolution, they\'re furious. The problem isn\'t the disruption — it\'s our inability to support the customer through it seamlessly.', 'CHALLENGE', 'CUSTOMER', 9],
    ['discovery:challenge:1', 'NPS has declined four points in the last 18 months specifically on contact centre interactions. When we dig into the verbatims, the themes are consistent: long waits, agents who don\'t have the information they need, and feeling like they\'re being passed between teams. These are fixable problems. We just haven\'t fixed them.', 'CHALLENGE', 'CUSTOMER', 8],
    ['discovery:vision:0', 'A customer who contacts us during disruption and feels supported, informed, and valued — not transferred, not put on hold, not asked to repeat their story three times. That\'s the experience I want to build. It requires better data, better routing, and agents who have the authority and the tools to resolve things in a single interaction.', 'VISION', 'CUSTOMER', 9],
    ['discovery:constraint:0', 'First contact resolution is our most important metric but our systems don\'t support it. Agents don\'t have access to everything they need in a single interaction. Until the technology is fixed, FCR will remain aspirational.', 'CONSTRAINT', 'CUSTOMER', 8],
  ],

  'Mark O\'Brien': [
    ['intro:context:0', 'I manage our four BPO partnership relationships — Manila, Cape Town, Krakow, and Hyderabad. That\'s about 2,400 agents across partners. My job is to make sure they perform to our standards. The reality is I don\'t always know whether they are.', 'ACTUAL_JOB', 'BUSINESS', 7],
    ['discovery:challenge:0', 'Governance visibility is inadequate. I get weekly performance packs from each partner but they\'re self-reported. I have no independent mechanism to verify quality. When I do spot-check, what I find is often materially different from what the reports suggest. That gap between reported and actual performance is my biggest concern.', 'CHALLENGE', 'BUSINESS', 9],
    ['discovery:challenge:1', 'Consistency of standards is impossible to achieve when each BPO partner has their own training methodology, their own quality framework, and their own understanding of what a good interaction looks like. We\'ve tried to impose our standards but without the ability to monitor compliance, they drift. Cape Town is genuinely excellent. Manila is inconsistent. Krakow is improving. Hyderabad is struggling.', 'CHALLENGE', 'BUSINESS', 9],
    ['discovery:vision:0', 'One quality framework, independently monitored, applied equally to all four sites and to our in-house operation. Real-time performance data from all partners. And clear contractual consequences for non-compliance that we actually enforce.', 'VISION', 'BUSINESS', 8],
    ['discovery:what_works:0', 'Our Cape Town partner has invested in agent development in a way that shows. Their CSAT scores are consistently our highest across any site. They have strong team leadership and a coaching culture. We should understand what they\'re doing and codify it.', 'WHAT_WORKS', 'BUSINESS', 7],
  ],

  'Louise Carter': [
    ['intro:context:0', 'Quality assurance across the in-house operation. My team of 14 quality coaches monitors interactions, provides feedback, and runs calibration sessions. We cover about 2% of total contact volume — which sounds small but is actually within industry norms.', 'ACTUAL_JOB', 'BUSINESS', 7],
    ['discovery:challenge:0', 'The quality framework was designed for a phone-first world. We\'ve added digital channels — web chat, social, messaging — without updating the framework to reflect how quality looks different in those channels. We\'re applying voice quality metrics to text-based channels and it doesn\'t work. Agents are being scored unfairly and the data is meaningless.', 'CHALLENGE', 'BUSINESS', 8],
    ['discovery:challenge:1', 'We have almost no visibility into BPO quality. I have no mandate to evaluate their interactions. I see the numbers they send us but I can\'t assess the underlying quality. Given that BPO represents about 55% of our contact volume, I\'m only measuring quality for 45% of what matters.', 'CHALLENGE', 'BUSINESS', 8],
    ['discovery:vision:0', 'A quality framework that covers all channels and all sites. AI-assisted monitoring that gives us meaningful coverage rather than 2% sampling. And a feedback loop where quality insights actually drive coaching and improvement, rather than sitting in reports nobody reads.', 'VISION', 'BUSINESS', 8],
    ['discovery:what_works:0', 'When our coaches have protected time for structured one-to-ones with agents, quality scores improve measurably. The problem is that protected time gets squeezed whenever there\'s a volume spike. Coaching is treated as discretionary. It shouldn\'t be.', 'WHAT_WORKS', 'PEOPLE', 6],
  ],

  'Simon Reed': [
    ['intro:context:0', 'Learning and development for the contact centre. That covers new hire onboarding, ongoing skills development, product and process training, and leadership development for team leaders.', 'ACTUAL_JOB', 'PEOPLE', 7],
    ['discovery:challenge:0', 'Attrition means we\'re onboarding constantly. Our onboarding programme is 8 weeks and we have cohorts starting every 3 weeks. The operation becomes a training machine at the expense of everything else. We\'re so focused on getting new people to baseline competency that we have no capacity to develop the people who are already here.', 'CHALLENGE', 'PEOPLE', 8],
    ['discovery:challenge:1', 'New system deployments happen without corresponding training. When the technology team rolls out a change, we often get two weeks notice and a brief from someone who\'s never spoken to a customer. The result is agents in the live environment who aren\'t confident and customers who suffer for it.', 'CHALLENGE', 'PEOPLE', 8],
    ['discovery:vision:0', 'A learning infrastructure that doesn\'t depend on classroom time. Digital, modular, role-specific learning that agents can access on demand. And a proper partnership with the technology team so training is designed into every change, not bolted on afterwards.', 'VISION', 'PEOPLE', 8],
    ['discovery:constraint:0', 'The training budget has been flat for three years while headcount has grown 15%. We\'re doing more with less every cycle. The investment case for L&D doesn\'t get the same attention as technology investment, even though the returns are demonstrably there.', 'CONSTRAINT', 'PEOPLE', 7],
  ],

  'Katherine James': [
    ['intro:context:0', 'Business analysis across contact centre operations. I translate operational data into insight and support improvement programmes with requirements, process mapping, and benefits tracking.', 'ACTUAL_JOB', 'BUSINESS', 6],
    ['discovery:challenge:0', 'There is no single source of truth for contact centre data. We have seven different reporting systems and they frequently contradict each other. My first hour every Monday morning is reconciling reports. It\'s not analytical work — it\'s data janitor work. It means real analysis gets squeezed.', 'CHALLENGE', 'TECHNOLOGY', 8],
    ['discovery:challenge:1', 'Improvement initiatives rarely have clearly defined success metrics when they start. We establish them retrospectively, which means we\'re always post-rationalising rather than evaluating. I can\'t tell you whether any of our current improvement programmes are working because we didn\'t define what working looks like.', 'CHALLENGE', 'BUSINESS', 8],
    ['discovery:vision:0', 'One data platform that all reporting draws from. Success metrics defined before programmes start. Benefits tracking that\'s taken seriously rather than treated as a compliance exercise.', 'VISION', 'TECHNOLOGY', 7],
    ['discovery:what_works:0', 'When I\'ve been given space to do root cause analysis before jumping to solutions, the programmes that result are significantly more effective. The disruption routing improvement last year is a good example — proper analysis, clear problem definition, targeted solution. It worked.', 'WHAT_WORKS', 'BUSINESS', 6],
  ],

  'Daniel Cooper': [
    ['intro:context:0', 'I run the Heathrow hub contact centre — about 650 agents across three shifts. We handle the full range of contact types but we specialise in disruption management given our proximity to the airport.', 'ACTUAL_JOB', 'BUSINESS', 7],
    ['discovery:challenge:0', 'During disruption events, we go from normal operations to crisis in under 20 minutes and we have no structured way to handle that transition. The routing system doesn\'t adapt. We have to manually ring around to pull agents from other queues. By the time we\'ve got resource in position, the queue is already at 40 minutes and customers are furious.', 'CHALLENGE', 'BUSINESS', 9],
    ['discovery:challenge:1', 'Agent burnout during disruption periods is serious. We had a major weather event in January and I lost 12% of my workforce to sick absence in the following two weeks. The emotional labour of handling hundreds of angry customers in a compressed period is significant and we don\'t have adequate support structures for agents who deal with it.', 'CHALLENGE', 'PEOPLE', 8],
    ['discovery:vision:0', 'Automated disruption detection that triggers a resource reallocation plan before the queue builds. Agent welfare protocols that activate during high-intensity periods. And post-disruption decompression — structured time for agents to recover before returning to normal operations.', 'VISION', 'PEOPLE', 8],
    ['discovery:what_works:0', 'My disruption specialists — the 40 agents who focus exclusively on disruption management — are excellent. They\'ve developed their own informal playbooks and they support each other well. The problem is they can\'t absorb the full volume when a major event hits. We need their capability distributed across the wider team.', 'WHAT_WORKS', 'BUSINESS', 7],
  ],

  'Emma Fitzgerald': [
    ['intro:context:0', 'I oversee day-to-day BPO operational performance — sitting between the Head of BPO Partnerships and the partners themselves. I\'m on calls with Manila and Cape Town daily.', 'ACTUAL_JOB', 'BUSINESS', 6],
    ['discovery:challenge:0', 'The performance standards we hold BPO partners to are different from the standards we hold our own operation to. That\'s partly legacy contracts and partly inconsistent governance. Manila is measured on AHT and CSAT. Krakow is measured on AHT and compliance. Cape Town is measured on a different scorecard altogether. It\'s impossible to compare performance meaningfully when the measurement frameworks aren\'t aligned.', 'CHALLENGE', 'BUSINESS', 8],
    ['discovery:challenge:1', 'Cultural and language nuance is a real quality issue in some of our offshore sites. Customers calling about complex travel disruption situations need agents who understand not just the words but the emotional context. That\'s hard to train and hard to assess.', 'CHALLENGE', 'CUSTOMER', 7],
    ['discovery:vision:0', 'One scorecard. Applied consistently. With the right to audit. That\'s what any sensible BPO governance model looks like and we\'re a long way from it.', 'VISION', 'BUSINESS', 8],
    ['discovery:constraint:0', 'My mandate doesn\'t extend to changing the contracts. I can escalate but I can\'t unilaterally impose new standards. That creates a frustrating dynamic where I can see the problem clearly but my ability to fix it is limited.', 'CONSTRAINT', 'BUSINESS', 7],
  ],

  'Raj Patel': [
    ['intro:context:0', 'I manage the CCaaS platform and the integrations that sit underneath it. In practical terms, that means I spend a lot of time keeping things running that shouldn\'t need keeping running.', 'ACTUAL_JOB', 'TECHNOLOGY', 7],
    ['discovery:challenge:0', 'The reservations system integration is our biggest technical liability. It was built by a team that no longer exists, using an API that the vendor has deprecated. We\'re running on borrowed time. Every release from the reservations vendor could potentially break our integration and we wouldn\'t know about it until agents started reporting errors.', 'CHALLENGE', 'TECHNOLOGY', 9],
    ['discovery:challenge:1', 'Change management for system updates is non-existent in practice. When we need to push a routing rule change, there\'s no formal process. Changes go in without proper testing and sometimes they break things. I\'ve asked for a proper change control board three times. It hasn\'t happened.', 'CHALLENGE', 'TECHNOLOGY', 8],
    ['discovery:vision:0', 'A properly engineered integration layer — event-driven, resilient, monitored. Not the current web of point-to-point connections that breaks when anyone looks at it funny. And a change management process that treats the contact centre platform with the same rigour we apply to flight operations technology.', 'VISION', 'TECHNOLOGY', 8],
    ['discovery:what_works:0', 'The dashboard we built for real-time queue visibility has been genuinely useful. Team leaders can actually see what\'s happening and make decisions. It\'s not sophisticated but it fills a gap. We built it in three weeks with two developers. The problem is we shouldn\'t have needed to build it ourselves.', 'WHAT_WORKS', 'TECHNOLOGY', 6],
  ],

  'Sophie Williams': [
    ['intro:context:0', 'Quality manager — I lead a team of eight coaches across the Manchester and Edinburgh sites. We do interaction monitoring, calibration, and agent feedback. We also run the complaints analysis process.', 'ACTUAL_JOB', 'BUSINESS', 6],
    ['discovery:challenge:0', 'Calibration is our biggest internal challenge. Different coaches score the same interaction differently. We run monthly calibration sessions but the variance hasn\'t reduced meaningfully. Without consistent scoring, quality data is unreliable and agents don\'t trust the feedback they receive.', 'CHALLENGE', 'BUSINESS', 7],
    ['discovery:challenge:1', 'The volume of complaints routed through the quality process has increased 30% in the last year without a corresponding increase in my team size. We\'re triaging rather than analysing. The root cause work isn\'t getting done because we\'re consumed by processing volume.', 'CHALLENGE', 'BUSINESS', 7],
    ['discovery:vision:0', 'Automated quality scoring for routine interactions — not to replace human judgement but to give us coverage across a meaningful sample rather than the 2% we can currently achieve. AI to do the volume work, humans to do the nuanced analysis and coaching.', 'VISION', 'TECHNOLOGY', 7],
    ['discovery:what_works:0', 'The feedback format we redesigned last year — specific, evidence-based, developmental rather than punitive — has improved how agents receive feedback. Resistance to quality sessions has dropped noticeably. The content of coaching matters as much as the frequency.', 'WHAT_WORKS', 'PEOPLE', 6],
  ],

  'Ben Torres': [
    ['intro:context:0', 'Workforce planning — I build the forecasts, design the schedules, and manage real-time performance with the operations team. I\'m also trying to build the case for a new WFM system.', 'ACTUAL_JOB', 'BUSINESS', 6],
    ['discovery:challenge:0', 'Intraday management is almost entirely manual. When volume spikes unexpectedly, I\'m on the phone to team leaders asking them to pull agents from breaks or cancel coaching sessions. It\'s reactive and it degrades the operation in ways that aren\'t immediately visible — cancelled coaching today is higher attrition six months from now.', 'CHALLENGE', 'BUSINESS', 8],
    ['discovery:challenge:1', 'We can\'t accurately forecast the disruption contact volume because disruption data doesn\'t feed into our WFM tool. We know disruption is happening through the operations channel, not through our planning systems. By the time that information reaches me, I\'m already behind.', 'CHALLENGE', 'TECHNOLOGY', 8],
    ['discovery:vision:0', 'A WFM system that ingests flight operations data in real time and automatically adjusts intraday resource plans when disruption is detected. Proactive rather than reactive. That would fundamentally change how we manage the operation during high-pressure periods.', 'VISION', 'TECHNOLOGY', 9],
    ['discovery:constraint:0', 'The business case for the new WFM system keeps getting deprioritised. There are six technology investments ahead of it in the queue. We\'ve been number seven for 18 months.', 'CONSTRAINT', 'BUSINESS', 7],
  ],

  'Claire Donovan': [
    ['intro:context:0', 'Training manager — I design and deliver onboarding for new agents, run refresher training programmes, and coordinate product and process updates across the agent population.', 'ACTUAL_JOB', 'PEOPLE', 6],
    ['discovery:challenge:0', 'Our onboarding programme is 8 weeks but in reality agents are taking live calls from week 5 with a buddy. The volume pressure means we compress the learning journey. Agents who aren\'t ready go live anyway because we need them on the floor. The quality impact of that is real and measurable — newly trained agents have significantly lower first contact resolution rates.', 'CHALLENGE', 'PEOPLE', 8],
    ['discovery:challenge:1', 'Product and policy changes arrive faster than we can train to them. We get a 5-day notice for a new baggage policy or a rebooking process change and we have to push something out to 1,800 agents in that window. It\'s not possible to do it properly. We end up with agents who know something changed but aren\'t clear on exactly what.', 'CHALLENGE', 'PEOPLE', 7],
    ['discovery:vision:0', 'A digital learning platform where policy updates can be pushed as short, targeted modules that agents complete asynchronously. Training that doesn\'t require pulling agents off the floor for hours at a time. And an onboarding programme that can\'t be compressed — with hard gates before agents take live contacts.', 'VISION', 'PEOPLE', 8],
    ['discovery:what_works:0', 'Peer coaching — pairing experienced agents with newer colleagues during the buddy phase — works well when we have the capacity to do it properly. Those agents ramp faster and their early attrition is lower. We just can\'t always protect the time for the experienced agent to do it.', 'WHAT_WORKS', 'PEOPLE', 6],
  ],

  'Nathan Hughes': [
    ['intro:context:0', 'I run data and reporting for the contact centre. That means building dashboards, producing the weekly and monthly performance packs, and doing ad hoc analysis for the ops team. I also own the data relationship with our WFM vendor.', 'ACTUAL_JOB', 'TECHNOLOGY', 6],
    ['discovery:challenge:0', 'We have contact centre data in seven places and they don\'t agree with each other. The CCaaS platform shows one AHT figure. The CRM shows another. The BPO partners show a third. I spend significant time every week reconciling these figures and I still can\'t always explain the variance. Decisions are being made on data that may not be reliable.', 'CHALLENGE', 'TECHNOLOGY', 9],
    ['discovery:challenge:1', 'We have no single performance definition. AHT means different things to different systems. CSAT is calculated differently by each BPO partner. First contact resolution isn\'t measured consistently across channels. Until we fix the definitions, we can\'t measure improvement meaningfully.', 'CHALLENGE', 'BUSINESS', 8],
    ['discovery:vision:0', 'A single data layer that all reporting tools draw from, with agreed definitions that everyone uses. Not seven systems with seven slightly different views of the same operation. And real-time access for operational managers — not reports that arrive 24 hours after the events they describe.', 'VISION', 'TECHNOLOGY', 8],
    ['discovery:constraint:0', 'The data governance structure doesn\'t exist. There\'s no data owner for contact centre metrics. Everyone owns a piece of it and nobody owns the whole thing. That\'s why the reconciliation problem has persisted for years — there\'s no single person with the mandate to fix it.', 'CONSTRAINT', 'BUSINESS', 7],
  ],

  'Amy Fletcher': [
    ['intro:context:0', 'I\'m a senior team leader on the disruption desk — that\'s the specialist team that handles rebooking, compensation, and customer support during flight disruptions. I manage 18 agents across two shifts.', 'ACTUAL_JOB', 'BUSINESS', 7],
    ['discovery:challenge:0', 'During a major disruption, we go from zero to overwhelming in minutes. I\'ve got 18 agents and suddenly I\'m looking at 600 contacts in queue. We can\'t call on the wider team because they don\'t have the knowledge or system access to handle disruption contacts properly. We sit there knowing the queue is building and knowing we can\'t clear it fast enough.', 'CHALLENGE', 'BUSINESS', 9],
    ['discovery:challenge:1', 'The systems we use during disruption require too many steps to do simple things. Rebooking a customer onto an alternative flight involves six separate screens. We know the steps — we do them every day — but during peak disruption when you\'re trying to help 20 customers in an hour, six screens per customer adds up to a lot of wasted time.', 'CHALLENGE', 'TECHNOLOGY', 8],
    ['discovery:vision:0', 'A disruption management workspace that surfaces everything in one screen — the customer\'s booking, available alternatives, compensation eligibility, communication templates. And the ability to pull in reinforcements from the wider team who are properly trained on disruption contacts rather than just throwing untrained agents at the queue.', 'VISION', 'TECHNOLOGY', 9],
    ['discovery:what_works:0', 'My team knows their stuff. They have informal playbooks they\'ve built themselves for the most common disruption scenarios. When things are manageable, they deliver really well. Customers who reach us rather than the general queue consistently rate the experience higher. The problem is scale.', 'WHAT_WORKS', 'BUSINESS', 7],
  ],

  'Michael Grant': [
    ['intro:context:0', 'Team leader for the premium cabin team — we handle First and Business class contacts. Smaller team, higher expectations, more complex issues. My agents have to know the full product inside out.', 'ACTUAL_JOB', 'CUSTOMER', 6],
    ['discovery:challenge:0', 'Premium customers have very low tolerance for being put on hold or transferred. Our average handling time for premium contacts is 40% longer than the general queue, partly because the issues are more complex and partly because our agents are accessing the same slow systems as everyone else. A customer paying £8,000 for a ticket doesn\'t expect to wait 12 minutes on hold while we look something up.', 'CHALLENGE', 'CUSTOMER', 8],
    ['discovery:challenge:1', 'Product knowledge gaps are a real issue despite our best efforts. The premium product changes frequently — new lounges, new partnerships, new benefits — and agents sometimes give incorrect information. When a premium customer receives wrong information about a benefit they\'ve paid for, the complaint that follows is disproportionately damaging.', 'CHALLENGE', 'PEOPLE', 7],
    ['discovery:vision:0', 'A knowledge management system that keeps agents current in real time. When a product change happens, the relevant information appears in the agent\'s tool before the customer can call about it. Not a PDF buried in an intranet — an integrated, searchable, always-current knowledge base.', 'VISION', 'TECHNOLOGY', 7],
    ['discovery:what_works:0', 'The empowerment we give premium agents to resolve issues without management approval is valuable. They can rebook, upgrade, provide compensation — up to a threshold — without escalating. When that works, customers leave the interaction feeling valued. More of that, and a higher threshold.', 'WHAT_WORKS', 'CUSTOMER', 7],
  ],

  'Jade Robinson': [
    ['intro:context:0', 'I lead the digital and social media team — we handle contacts through web chat, WhatsApp, Twitter and Instagram DMs, and the mobile app messaging function. We\'re the newest contact channel and also the least well-resourced.', 'ACTUAL_JOB', 'CUSTOMER', 6],
    ['discovery:challenge:0', 'Digital contacts are growing at 40% year-on-year but our headcount has grown at 8%. We\'re drowning in volume that we can\'t adequately staff. Response times are suffering and customers who choose digital because they expect a faster response are getting slower responses than the phone channel. That\'s a failure of the channel promise.', 'CHALLENGE', 'CUSTOMER', 8],
    ['discovery:challenge:1', 'The tools we have for managing digital contacts were designed for voice and retrofitted for digital. They\'re not built for asynchronous conversation management, they don\'t handle conversation history well, and they can\'t manage multiple simultaneous conversations effectively. My agents can theoretically handle three chats at once but the tool makes it very difficult in practice.', 'CHALLENGE', 'TECHNOLOGY', 8],
    ['discovery:vision:0', 'Purpose-built digital contact tools that allow agents to manage multiple simultaneous conversations, with full conversation history, suggested responses based on contact type, and seamless escalation to voice when needed. And proper resource allocation that reflects the growth trajectory of the channel.', 'VISION', 'TECHNOLOGY', 8],
    ['discovery:constraint:0', 'Digital doesn\'t have a dedicated budget line. We sit under the general contact centre budget and we compete for everything — headcount, tooling, training — with channels that have been around much longer and have stronger internal advocates.', 'CONSTRAINT', 'BUSINESS', 7],
  ],

  'Liam O\'Connor': [
    ['intro:context:0', 'I\'m a team leader embedded with our Manila BPO partner. I\'m an employed by Jo Airways but based in the Manila office, and I have 45 agents under my oversight across two shifts.', 'ACTUAL_JOB', 'BUSINESS', 6],
    ['discovery:challenge:0', 'The biggest challenge here is that we operate under two sets of expectations — ours from Jo Airways and the BPO partner\'s own internal standards, which don\'t always align. When they conflict, agents get confused about which standard takes priority. In practice they tend to follow the BPO partner\'s processes because that\'s what they\'re directly managed on.', 'CHALLENGE', 'BUSINESS', 8],
    ['discovery:challenge:1', 'Knowledge currency is a constant problem. We receive policy and product updates through the same channels as the UK team — emails and intranet updates — but the timing doesn\'t account for the shift pattern differences and language adaptation time needed for some agents. We often go live with changes that agents haven\'t properly absorbed.', 'CHALLENGE', 'PEOPLE', 7],
    ['discovery:vision:0', 'A proper Jo Airways onboarding and continuous learning curriculum that\'s delivered consistently here in Manila, adapted for local context but aligned to the same standards as the UK. And a governance structure where I have a clear mandate to enforce Jo Airways standards, not just report on them.', 'VISION', 'PEOPLE', 7],
    ['discovery:what_works:0', 'The agents here are genuinely capable and committed. When they\'re given clear standards and proper training, they perform. The performance variance we see is almost entirely a function of inconsistent management and unclear expectations — not capability. Fix the environment and you fix the performance.', 'WHAT_WORKS', 'PEOPLE', 6],
  ],

  'Natalie Price': [
    ['intro:context:0', 'Quality coach — I monitor interactions, provide feedback, and run coaching sessions for a group of 25 agents across the Edinburgh site. I also do complaints analysis for my cohort.', 'ACTUAL_JOB', 'BUSINESS', 6],
    ['discovery:challenge:0', 'The quality scoring framework doesn\'t reflect what actually matters to customers. We score heavily on process compliance — did the agent verify the booking reference, did they offer the callback, did they use the correct closing phrase — and less on whether the customer actually felt helped. An agent can score 92% on the framework and still deliver an awful experience.', 'CHALLENGE', 'CUSTOMER', 8],
    ['discovery:challenge:1', 'Coaching conversations are difficult when agents don\'t trust the scoring. They\'ve seen inconsistent scores from different coaches and they\'ve stopped believing the feedback is objective. When trust breaks down in the coaching relationship, nothing improves.', 'CHALLENGE', 'PEOPLE', 7],
    ['discovery:vision:0', 'A quality framework built around customer outcomes — did the customer get what they needed, did they feel valued, would they contact us again — with process compliance as a secondary measure, not the primary one. That\'s what good quality management actually looks like.', 'VISION', 'CUSTOMER', 7],
    ['discovery:what_works:0', 'When I can do genuine coaching rather than scoring, agents improve. The agents in my cohort who I\'ve had the most coaching time with are consistently the highest performers and have the lowest complaint rates. Time investment in people works. We just need to protect the time for it.', 'WHAT_WORKS', 'PEOPLE', 6],
  ],

  'Jamie Walsh': [
    ['intro:context:0', 'I\'ve been a customer service agent for two and a half years. I work the early shift at the Manchester contact centre — 6am to 2pm. I handle general enquiries, mostly rebooking and baggage claims.', 'ACTUAL_JOB', 'BUSINESS', 5],
    ['discovery:challenge:0', 'The systems are the main thing. To rebook a customer I need to be in the reservations system, then I need to check the disruption tool to see if they qualify for a waiver, then I need to go into the loyalty system if they\'re an Executive Club member to check their tier benefits. That\'s three separate systems for one customer. It takes time and sometimes the systems are slow or they fall over entirely during busy periods.', 'CHALLENGE', 'TECHNOLOGY', 8],
    ['discovery:challenge:1', 'I don\'t always know the answer when a customer asks about a policy. The intranet knowledge base is hard to search and doesn\'t always have current information. I\'ve given customers incorrect information about baggage allowances before because the information I had was out of date. That\'s awful to deal with — the customer comes back angry and it\'s not entirely my fault but I\'m the one on the call.', 'CHALLENGE', 'PEOPLE', 7],
    ['discovery:vision:0', 'One screen. Everything I need in one place so I\'m not switching between systems while a customer is waiting. And a knowledge base that\'s actually up to date so I can give people correct information with confidence.', 'VISION', 'TECHNOLOGY', 7],
    ['discovery:what_works:0', 'My team leader is really good. She gives us useful feedback and she backs us up when customers are unreasonable. The team dynamic on our shift is strong. That makes a big difference on tough days.', 'WHAT_WORKS', 'PEOPLE', 6],
  ],

  'Aisha Okafor': [
    ['intro:context:0', 'I\'m a disruption specialist — I\'ve been doing it for 18 months since I moved across from the general queue. My whole day is managing customers whose flights have been delayed, cancelled, or significantly changed.', 'ACTUAL_JOB', 'BUSINESS', 6],
    ['discovery:challenge:0', 'When there\'s a major disruption event, the calls I take are genuinely very difficult. People are distressed, sometimes they\'ve missed important events, sometimes they\'re stranded somewhere. The emotional weight of those conversations is significant and we have no formal support for that. After a major disruption day I\'m exhausted and there\'s no acknowledgement of that in how we\'re managed.', 'CHALLENGE', 'PEOPLE', 8],
    ['discovery:challenge:1', 'The compensation process is too complicated. I have to calculate eligibility manually based on the delay duration, the route, the customer\'s ticket type, and whether EU261 applies. I get it wrong sometimes because it\'s genuinely complex and there\'s no tool to help me. Customers get incorrect information about what they\'re entitled to and then complain when the actual compensation doesn\'t match what I said.', 'CHALLENGE', 'TECHNOLOGY', 8],
    ['discovery:vision:0', 'A disruption support tool that automatically calculates compensation eligibility and generates the relevant communication. I should not be doing manual calculations on complex regulatory entitlements during a call with a distressed customer. That\'s what technology is for.', 'VISION', 'TECHNOLOGY', 8],
    ['discovery:what_works:0', 'The camaraderie in the disruption team is genuinely brilliant. We look after each other. On tough days we check in, we help each other decompress. That informal support network is what keeps most of us going. It shouldn\'t be informal — it should be structured and supported by the organisation.', 'WHAT_WORKS', 'PEOPLE', 7],
  ],

  'Ryan Mitchell': [
    ['intro:context:0', 'I handle premium and first class contacts — been doing it for three years. It\'s a specialist role and I enjoy it, but the expectations from premium customers are very high.', 'ACTUAL_JOB', 'CUSTOMER', 6],
    ['discovery:challenge:0', 'I sometimes don\'t have up-to-date information about the premium product. Lounge access changes, partner benefits, seat configurations — these change and I don\'t always know about the changes before customers do. I\'ve had customers correct me on my own airline\'s product. That\'s deeply uncomfortable and erodes their confidence in us.', 'CHALLENGE', 'PEOPLE', 7],
    ['discovery:challenge:1', 'Hold times for premium customers are the same as the general queue during busy periods. There\'s supposed to be priority routing but it doesn\'t always work. I\'ve had Executive Club Gold members waiting 25 minutes to reach me. When they get through they\'re already annoyed before I\'ve said a word.', 'CHALLENGE', 'CUSTOMER', 8],
    ['discovery:vision:0', 'Premium routing that actually works — guaranteed callback within 5 minutes for Gold and above. And a product knowledge tool that I can trust completely so I\'m never in the position of not knowing our own product.', 'VISION', 'CUSTOMER', 8],
    ['discovery:what_works:0', 'The empowerment to resolve issues — upgrade, rebook, waive fees — without needing manager sign-off is genuinely valuable. When I can fix something on the spot, the customer\'s mood completely changes. More of that, and confidence that I won\'t be second-guessed afterwards for doing what the customer needed.', 'WHAT_WORKS', 'CUSTOMER', 7],
  ],

  'Charlotte Davies': [
    ['intro:context:0', 'I\'ve been an agent for 11 months. I\'m still in the phase where some contact types make me nervous. Baggage claims I can do fine. Complex rebooking during disruption I still find stressful.', 'ACTUAL_JOB', 'BUSINESS', 5],
    ['discovery:challenge:0', 'The training I received was really good in theory but the live environment is different from what we practised. The systems are the same but real customers are not like the scenarios in training. Some customers are very difficult and I didn\'t feel prepared for that. My confidence in the first three months was low and I nearly left.', 'CHALLENGE', 'PEOPLE', 7],
    ['discovery:challenge:1', 'When I\'m not sure about something I want to check before I tell the customer. But there\'s pressure to keep handling times down and asking my team leader sometimes means putting the customer on hold for a while. I end up making a judgement call when I\'m not sure. Sometimes I get it right, sometimes I don\'t.', 'CHALLENGE', 'PEOPLE', 7],
    ['discovery:vision:0', 'A way to quickly check information without putting the customer on hold — something like a search tool built into the agent screen that gives me the right answer in real time. And more support for newer agents in the first six months — not just the formal buddy system but ongoing check-ins.', 'VISION', 'TECHNOLOGY', 6],
    ['discovery:what_works:0', 'My team leader checks in with us every morning before the shift. It sounds small but it really helps. You know what\'s going on, you feel seen, and it sets the day up well. Not all team leaders do that and you can tell the difference in the teams.', 'WHAT_WORKS', 'PEOPLE', 6],
  ],

  'Tariq Hassan': [
    ['intro:context:0', 'I handle cargo customer service — shippers, freight forwarders, companies sending goods on Jo Airways flights. It\'s quite a different world from the passenger side. The contacts are more technical and the customers expect a higher level of specialist knowledge.', 'ACTUAL_JOB', 'BUSINESS', 6],
    ['discovery:challenge:0', 'Cargo operations data is not connected to the contact centre systems. When a shipper calls to track a consignment, I\'m accessing a completely separate cargo management system that has different credentials, different logic, and a different interface from everything else I use. It slows everything down and the cargo system goes down more often than any other system I use.', 'CHALLENGE', 'TECHNOLOGY', 8],
    ['discovery:challenge:1', 'Cargo customers tend to be sophisticated B2B customers who know exactly what they\'re entitled to. When I don\'t have the right information or the system is slow, they lose patience quickly. The reputational stakes are high — a negative experience with us could mean they route their freight through a competitor. The commercial consequence is significant.', 'CHALLENGE', 'CUSTOMER', 7],
    ['discovery:vision:0', 'Cargo systems integration with the main contact centre platform. I should be able to see consignment status, customs clearance, and flight allocation in the same workspace I use for everything else. It\'s not technically complex — it just hasn\'t been prioritised because cargo is a smaller part of the operation.', 'VISION', 'TECHNOLOGY', 7],
    ['discovery:what_works:0', 'The relationships I\'ve built with regular customers over time are genuinely valuable. Some freight forwarders ask for me by name. That continuity and trust is good for the customer and good for the business. We should think about how we protect and enable that kind of relationship in an operation that often treats contacts as interchangeable.', 'WHAT_WORKS', 'CUSTOMER', 6],
  ],
};

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Jo Air discovery respondents...\n');

  // Clear existing participants for this workshop
  await prisma.workshopParticipant.deleteMany({ where: { workshopId: WORKSHOP_ID } });
  console.log('  🗑  Cleared existing participants\n');

  let totalDataPoints = 0;
  let totalInsights = 0;

  for (const p of PARTICIPANTS) {
    const participantId = cuid();
    const sessionId     = cuid();

    // 1. Create participant
    await prisma.workshopParticipant.create({
      data: {
        id:                    participantId,
        workshopId:            WORKSHOP_ID,
        email:                 p.email,
        name:                  p.name,
        role:                  p.role,
        department:            p.department,
        discoveryToken:        token(),
        attributionPreference: 'NAMED',
        responseCompletedAt:   new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000), // within last 2 weeks
        emailSentAt:           new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      },
    });

    // 2. Create completed conversation session
    await prisma.conversationSession.create({
      data: {
        id:             sessionId,
        workshopId:     WORKSHOP_ID,
        participantId:  participantId,
        status:         'COMPLETED',
        runType:        'BASELINE',
        currentPhase:   'complete',
        phaseProgress:  100,
        startedAt:      new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
        completedAt:    new Date(),
        totalDurationMs: Math.floor(Math.random() * 1200000) + 600000, // 10–30 mins
      },
    });

    // 3. Create data points + insights
    const responses = RESPONSES[p.name] || [];
    for (const [questionKey, rawText, insightType, category, severity] of responses) {
      const dpId = cuid();

      await prisma.dataPoint.create({
        data: {
          id:            dpId,
          workshopId:    WORKSHOP_ID,
          sessionId:     sessionId,
          participantId: participantId,
          rawText:       rawText,
          source:        'SPEECH',
          questionKey:   questionKey,
        },
      });

      await prisma.conversationInsight.create({
        data: {
          id:            cuid(),
          sessionId:     sessionId,
          workshopId:    WORKSHOP_ID,
          participantId: participantId,
          insightType:   insightType as any,
          category:      category as any,
          text:          rawText,
          severity:      severity,
          confidence:    0.85 + Math.random() * 0.1,
          sourceMessageIds: [dpId],
        },
      });

      totalDataPoints++;
      totalInsights++;
    }

    console.log(`  ✅ ${p.name.padEnd(22)} | ${p.role}`);
  }

  console.log(`\n✅ Done.`);
  console.log(`   ${PARTICIPANTS.length} participants`);
  console.log(`   ${PARTICIPANTS.length} sessions (all COMPLETED)`);
  console.log(`   ${totalDataPoints} data points`);
  console.log(`   ${totalInsights} insights`);
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
