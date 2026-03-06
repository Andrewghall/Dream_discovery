/**
 * Seed a LiveWorkshopSnapshot for the Jo Air workshop with synthetic participant responses
 * to all 17 workshop facilitation questions across REIMAGINE, CONSTRAINTS, and DEFINE_APPROACH phases.
 *
 * Run: npx tsx scripts/seed-joair-live-workshop.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const WORKSHOP_ID = 'cmmezcr7r0001jj04vc6fiqdw';

function uid(prefix = 'n'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── NODE DEFINITIONS ─────────────────────────────────────────────────────────
// Each node: { id, speaker, rawText, lens, dialoguePhase, primaryType }

type NodeDef = {
  speaker: string;
  rawText: string;
  lens: string;
  dialoguePhase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';
  primaryType: string;
};

const NODES: NodeDef[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // REIMAGINE — Q1: Customer Experience (personalization, queue instability)
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'Sarah Morrison',
    rawText: 'In an ideal world, the moment a customer contact arrives — whether it\'s a call, a message, or an email — the system already knows who they are, why they\'re likely calling, and what their history looks like. The agent sees that this is a Gold member who\'s had two disruptions in the past six months, and everything about how we handle that contact shifts accordingly. Personalisation at Jo Air should mean treating a loyal, frustrated customer completely differently to a first-time enquiry.',
    lens: 'Customer',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Priya Sharma',
    rawText: 'The ideal contact centre doesn\'t wait for customers to call. In my vision, Jo Air proactively reaches out — the moment a flight is delayed, the customer gets a message with their options already prepared: here\'s your alternative flight, here\'s your compensation entitlement, tap to confirm. The contact never needs to happen. And when it does happen because something is complex, the agent has everything they need in one view.',
    lens: 'Customer',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Michael Grant',
    rawText: 'What we do for premium cabin should be the standard for every customer. Know their name. Know their preference. Know their history. Know whether they\'ve had a bad experience recently. Right now that\'s only possible for our Gold and Platinum customers. In the reimagined future, every customer gets that level of contextual service — not just the highest-value ones.',
    lens: 'Customer',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Daniel Cooper',
    rawText: 'Queue instability disappears when we have real demand intelligence. The reimagined version of Jo Air\'s contact centre doesn\'t manage queues — it predicts them. We know 90 minutes before a disruption peaks that we need 40% more resource on rebooking contacts, and we\'ve already flexed. Customers wait seconds, not hours, because we\'ve anticipated the demand.',
    lens: 'Organisation',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Jade Robinson',
    rawText: 'In the reimagined future, channel doesn\'t matter. Whether you message us on Instagram, send an email, or call — you get the same quality of resolution. Right now social customers get a worse service than phone customers. That\'s not acceptable when 40% of our younger passengers prefer digital channels. The ideal is complete channel parity — same authority, same access, same outcome.',
    lens: 'Customer',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Ryan Mitchell',
    rawText: 'Imagine a world where the system surfaces a personalised offer before the customer has even finished explaining why they called. They\'re calling about a delayed flight, and the agent already knows they\'re a Gold member who\'s had three disruptions this year. The offer — an upgrade on their next flight, a companion voucher — is prepared and waiting. The agent executes it in thirty seconds and the customer hangs up delighted.',
    lens: 'Customer',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Amy Fletcher',
    rawText: 'Disruption handling in the ideal future is calm, controlled, and fast. My team has a full real-time view of the disruption — every affected passenger, their tier, their connecting flight risk, their compensation entitlement — before the first call lands. We work through the most urgent cases proactively. The queue never builds because we\'ve already reached out to the customers who need us most.',
    lens: 'Customer',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REIMAGINE — Q2: Operational Efficiency (single system, streamlined model)
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'Jamie Walsh',
    rawText: 'One screen. That\'s my vision. One screen that has everything I need — the booking, the loyalty record, the interaction history, the compensation calculator, the rebooking options — all in one place. No switching, no copy-pasting reference numbers between systems, no dead air while I navigate. One screen means faster resolution and a better experience for both the agent and the customer.',
    lens: 'Technology',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'David Palmer',
    rawText: 'The ideal operational model has routing intelligence at its core. Every contact — regardless of channel — is scored in real time for complexity, urgency, and customer tier. It goes to the agent best placed to resolve it, with the right authority and the right system access already loaded. First-contact resolution becomes the default because the match between customer need and agent capability is always right.',
    lens: 'Organisation',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Tom Hendricks',
    rawText: 'Agents stop managing the system and start managing the customer. That\'s the operational shift I\'d make. In the reimagined contact centre, the technology does the heavy lifting — it pulls the information, it surfaces the options, it calculates the entitlement. The agent\'s job is empathy, judgement, and resolution. Not data entry.',
    lens: 'People',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Raj Patel',
    rawText: 'An API-first integration layer is what makes everything else possible. In the reimagined future, Salesforce, Genesys, and Amadeus aren\'t three separate systems — they\'re three services behind a single integration platform that presents one coherent experience to the agent. Any new capability — an AI assistant, a new channel, a new compliance requirement — plugs in without rebuilding the whole thing.',
    lens: 'Technology',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Katherine James',
    rawText: 'Operational efficiency in my vision starts with data. One source of truth for every performance metric. Every manager, every team leader, every BPO site sees the same numbers in real time. Decisions are made on shared facts, not competing reports. Arguments about whose data is right stop completely because there\'s only one version.',
    lens: 'Organisation',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: "Mark O'Brien",
    rawText: 'BPO partners in the ideal future are genuinely part of one team. Same systems, same data, same performance framework. I can see exactly what\'s happening in Manila right now — queue depth, adherence, quality scores — in real time. When something goes wrong offshore, I know about it in minutes, not days. And our contracts measure what we actually care about: resolution, not call handling.',
    lens: 'Organisation',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REIMAGINE — Q3: Sustainability Initiatives
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'Fiona Lawson',
    rawText: 'Sustainability in the contact centre starts with our people. Remote and hybrid working reduces our carbon footprint significantly — less commuting, smaller physical estate. The reimagined Jo Air contact centre is predominantly distributed, with a smaller central hub for training and collaboration. We\'re already moving this direction with some BPO arrangements, but we could go much further.',
    lens: 'People',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Rachel Hughes',
    rawText: 'Digital deflection is our biggest sustainability lever. Every contact that doesn\'t happen — because the customer resolved it through the app or a proactive notification — removes energy consumption, hardware use, and human travel from our footprint. Reducing inbound volume by 30% through digital self-service is both our best sustainability initiative and our best efficiency initiative simultaneously.',
    lens: 'Technology',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Simon Reed',
    rawText: 'Paperless training and digital coaching are straightforward sustainability wins. Every training manual, every compliance document, every coaching framework should be digital. No print runs, no physical distribution. And micro-learning delivered digitally means training is accessible wherever the agent is, reducing the need to travel to central training sites.',
    lens: 'People',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Nathan Hughes',
    rawText: 'Cloud-first infrastructure eliminates the need for on-premises servers with high energy consumption. In the reimagined future, everything runs on cloud platforms with green energy commitments. We track and report our digital carbon footprint alongside our operational metrics. Jo Air becomes the first UK airline contact centre to publish a verified digital sustainability report.',
    lens: 'Technology',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REIMAGINE — Q4: Technology Integration (cutting-edge, frictionless)
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'Rachel Hughes',
    rawText: 'The AI co-pilot is the most transformative technology we could deploy. Not a chatbot that replaces agents — an assistant that sits alongside the agent and surfaces exactly what they need before they ask for it. It knows the customer\'s history, calculates the compensation entitlement automatically, suggests the next best action, flags compliance risks in real time. The agent\'s cognitive load drops dramatically and quality goes up.',
    lens: 'Technology',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Chris Barker',
    rawText: 'Real-time speech analytics is the technology that unlocks everything else. If we can understand what\'s being said in every call as it happens — sentiment, intent, compliance risk, knowledge gaps — we can intervene before problems escalate. A team leader sees on their dashboard that three agents are struggling with the same EU261 question right now and can jump in immediately rather than discovering it in a quality review three weeks later.',
    lens: 'Technology',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Angela Ward',
    rawText: 'Predictive workforce management powered by real-time signals is the technology that would transform our operational model. Genesys knows that a weather system is hitting Heathrow at 14:00. It models the contact volume surge, identifies the capacity gap, and automatically triggers BPO flex capacity — all before the disruption peaks. Our WFM moves from reactive scheduling to genuine anticipatory intelligence.',
    lens: 'Technology',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Ben Torres',
    rawText: 'AI-driven disruption forecasting integrated with our ops systems would be a step change. The model doesn\'t just look at historical patterns — it ingests live signals from Eurocontrol, Met Office, and our own flight operations system, and produces a continuously-updated demand forecast. I can see what my staffing situation will look like at 16:00 while I\'m planning at 09:00.',
    lens: 'Technology',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Louise Carter',
    rawText: 'Automated quality monitoring at 100% coverage is the technology I\'d invest in first. AI that listens to every call, scores it against our quality framework, identifies specific knowledge gaps and compliance risks, and generates a coaching recommendation for the team leader — automatically, at scale, without a QA analyst having to listen to three calls a month per agent. Quality becomes a data-driven continuous improvement engine, not a sampling exercise.',
    lens: 'Technology',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Natalie Price',
    rawText: 'AI-assisted coaching tools that personalise the development pathway for each agent. The system knows that Jamie struggles with EU261 compensation calculations and Charlotte tends to over-script complex emotional conversations. Each agent gets a tailored coaching plan, micro-learning modules triggered by specific quality flags, and weekly progress nudges. Team leader coaching time goes to the conversations that matter most, not to catching up on what the system already knows.',
    lens: 'People',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REIMAGINE — Q5: General magic wand (ideal contact centre, unconstrained)
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'James Whitfield',
    rawText: 'A contact centre where I can see everything, in real time, on one screen. Every site — UK, Manila, Krakow, Cape Town, Hyderabad — showing the same metrics. One performance framework, one set of definitions, one governance structure. I can see that Manila\'s quality score has dipped this afternoon and click through to understand why before anyone has filed a report. That\'s the contact centre I want.',
    lens: 'Organisation',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Aisha Okafor',
    rawText: 'I would give every agent the authority to actually fix the problem. No supervisor sign-offs for rebooking. No policy exceptions that require a manager. Trust your agents to use good judgement, give them the tools to see all the options, and let them resolve it on the first call. The customer shouldn\'t have to wait because the system doesn\'t trust the person they\'re speaking to.',
    lens: 'People',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Charlotte Davies',
    rawText: 'I\'d replace the script with a guided framework. Not "say this" — "the goal of this conversation is to resolve X, here are the tools you have, here are the guidelines you must stay within, and here is the information about this customer." Trust me to have the conversation in a way that fits this person, not a template written for the average customer.',
    lens: 'People',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Liam O\'Connor',
    rawText: 'From Manila\'s perspective, the magic wand gives us full access to everything UK has access to — same systems, same data, same policy updates in real time. No information lag, no training drift, no being treated as a second-tier operation. We\'re one team, regardless of geography, and the technology and governance reflect that.',
    lens: 'Organisation',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },
  {
    speaker: 'Tariq Hassan',
    rawText: 'For cargo, the magic wand gives us a purpose-built interface that combines Cargowise with our CRM and the regulatory reference database. One screen that shows the shipment, the customer, the dangerous goods classification, the customs requirements, and the regulatory entitlements — all in one place. And a proper training programme so we stop learning by making mistakes.',
    lens: 'Technology',
    dialoguePhase: 'REIMAGINE',
    primaryType: 'VISION',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONSTRAINTS — Q1: CX constraints (barriers to personalised experience)
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'Sarah Morrison',
    rawText: 'The single biggest barrier to personalised customer experience is the absence of a unified customer record. Every system holds a different slice of the customer\'s story — Salesforce has the case history, Amadeus has the booking, the loyalty platform has the tier and points. There is no mechanism to bring these together in real time at the moment of the interaction. Until that foundation exists, personalisation at scale is impossible.',
    lens: 'Technology',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Priya Sharma',
    rawText: 'Failure demand is a constraint on personalised experience because it dominates the queue. When 40% of contacts are people chasing something that should have already happened — a refund, a booking change, a notification that never arrived — agents are in reactive, transactional mode. There\'s no space to build a personalised, empathetic experience when you\'re processing a backlog.',
    lens: 'Customer',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Ryan Mitchell',
    rawText: 'Customer data access is tiered and that creates a fundamental quality disparity. Premium cabin agents have loyalty profile access. Standard tier agents don\'t. So the customer\'s experience depends on which pool they landed in, not on what they deserve as a Jo Airways customer. Data access policies are a hard constraint on delivering consistent personalisation.',
    lens: 'Customer',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Jade Robinson',
    rawText: 'Channel capability parity is a hard constraint. Our social media agents cannot rebook, cannot issue compensation, cannot access the loyalty profile. A customer who DMs us gets fundamentally inferior resolution capability to one who calls. Until social agents have the same authority and the same data access as voice agents, we cannot deliver a consistent personalised experience across channels.',
    lens: 'Technology',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONSTRAINTS — Q2: Operational Efficiency constraints
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'David Palmer',
    rawText: 'Three-year-old routing logic is the most immediate operational constraint. The routing rules in Genesys were configured in 2021. Contact types have changed, BPO site capabilities have changed, agent skill profiles have changed — and none of that is reflected in how contacts are distributed. We\'re routing 2026 demand through a 2021 model.',
    lens: 'Technology',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Angela Ward',
    rawText: 'Erlang-based workforce modelling is a fundamental constraint. Our Verint system uses Erlang C, which assumes telephony-distributed demand. Airline contact demand is event-driven — it spikes by 300% during disruptions. The model cannot predict this and our staffing is perpetually wrong on the days that matter most.',
    lens: 'Technology',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Tom Hendricks',
    rawText: 'No disruption playbooks means every disruption event is managed differently by every team leader. We have no standard for how to handle a weather delay versus a technical delay versus an ATC restriction. The inconsistency is a direct operational constraint — it means quality and speed of resolution varies depending on who happens to be managing the floor that day.',
    lens: 'Organisation',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Daniel Cooper',
    rawText: 'A 30% escalation rate is both a symptom and a constraint. It means agents don\'t have the authority, the information, or the capability to resolve a third of their contacts. Every escalation is additional handle time, additional agent capacity consumed, and a customer who has had to repeat their story. Until we fix the underlying causes — authority limits, information gaps, capability gaps — this constraint doesn\'t move.',
    lens: 'Organisation',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Jamie Walsh',
    rawText: 'Eight systems is not a productivity constraint — it\'s a productivity disaster. Every contact requires me to open, navigate, and manually copy data between eight separate applications. The cognitive overhead means I\'m spending mental energy on system management rather than on the customer. It extends every call by 60-90 seconds on average and generates copy-paste errors that create follow-up contacts.',
    lens: 'Technology',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONSTRAINTS — Q3: Sustainability constraints (regulatory / compliance)
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'James Whitfield',
    rawText: 'GDPR and data localisation requirements are a genuine constraint on sustainability initiatives. We cannot move all data processing to the most energy-efficient cloud region because customer data for EU passengers must remain within the EU. Regulatory data residency requirements add complexity and cost to green infrastructure decisions.',
    lens: 'Regulation',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Rachel Hughes',
    rawText: 'PCI-DSS compliance requirements constrain how we deploy AI tools in contact centre conversations. Any AI that processes payment data must be certified to PCI-DSS standards. This is a hard regulatory ceiling on how quickly we can deploy AI-assisted payment handling — and it applies even to internal tools used by agents.',
    lens: 'Regulation',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Fiona Lawson',
    rawText: 'Employment legislation is a constraint on the flexibility of hybrid and remote working models that sustainability requires. The legal framework around homeworking — health and safety obligations, data security requirements for home environments, contractual obligations on working location — creates real compliance overhead that limits how quickly we can move to a more distributed, lower-footprint model.',
    lens: 'Regulation',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONSTRAINTS — Q4: Technology Integration constraints
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'Chris Barker',
    rawText: 'Legacy Amadeus architecture is our hardest technology constraint. Amadeus PSS is a mainframe-era system with a proprietary API that was not designed for real-time integration. Any real-time data exchange with Amadeus requires expensive bespoke development and comes with significant stability risk. This is the constraint that blocks unified customer view more than anything else.',
    lens: 'Technology',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Raj Patel',
    rawText: 'The 12-week change management cycle is a technology integration constraint that compounds every other problem. When a new integration requirement is identified, it takes three months minimum before it reaches production. In that time, workarounds proliferate, shadow IT grows, and the business adapts around the gap rather than waiting for the fix. The governance process itself has become a constraint on technology improvement.',
    lens: 'Technology',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Katherine James',
    rawText: 'Data quality is a constraint on everything technology-related. Our systems hold duplicated, inconsistent, and incomplete customer records. The same customer appears in Salesforce with three different contact records, a different loyalty number in the tier platform, and a different name format in Amadeus. Any integration we build on top of this fragmented foundation will inherit and amplify the inconsistency.',
    lens: 'Technology',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Nathan Hughes',
    rawText: 'Fifteen reports with fifteen different metric definitions cannot be reconciled by technology alone. The constraint is definitional, not technical. Until we agree on what AHT means, what FCR means, what quality score means — and enforce those definitions across every system and every team — any integrated analytics platform will produce fifteen different answers to the same question.',
    lens: 'Organisation',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONSTRAINTS — Q5: General cultural / organisational constraints
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'Fiona Lawson',
    rawText: 'The deepest cultural constraint is that we manage compliance rather than performance. The contact centre has been built around measuring what we can count — calls handled, AHT, adherence — because these are easy to report. We\'ve never built a culture of asking whether we resolved the customer\'s problem. That shift — from compliance metrics to outcome metrics — is a cultural transformation, not just a reporting change.',
    lens: 'People',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Louise Carter',
    rawText: 'The cultural constraint I see most clearly from quality is that agents are measured on process compliance, not customer outcome. The quality scorecard rewards following the script, using the required sign-off phrase, completing the security check in the right order. It does not reward resolving the customer\'s problem with empathy and good judgement. The culture reinforces process adherence over outcome delivery.',
    lens: 'People',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Sophie Williams',
    rawText: 'Fear of making mistakes constrains agents from exercising judgement. When an agent deviates from the script — even when the deviation would clearly produce a better customer outcome — and that call gets sampled in quality, they get marked down. The system teaches agents to play safe, not to deliver excellent service. Changing that dynamic requires a cultural shift from the top, not just a policy update.',
    lens: 'People',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: 'Charlotte Davies',
    rawText: 'Agents don\'t feel trusted, and that\'s not an attitude problem — it\'s a design problem. The systems, the scripts, the authority limits, the supervisor approval requirements are all signals that say "we don\'t trust your judgement". When you\'re told consistently that you\'re not trusted, you stop trying to exercise judgement. The cultural constraint is actually an organisational design problem dressed up as a people problem.',
    lens: 'People',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },
  {
    speaker: "Mark O'Brien",
    rawText: 'The cultural constraint between in-house and BPO is one of "us and them". We treat BPO partners as vendors to be managed, not as an extension of our team. This creates information asymmetry — we don\'t share context, they don\'t share problems. Both sides optimise for their own metrics rather than the shared customer outcome. Until we change that cultural dynamic, governance improvements alone won\'t work.',
    lens: 'Organisation',
    dialoguePhase: 'CONSTRAINTS',
    primaryType: 'CONSTRAINT',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DEFINE APPROACH — Q1: People (training, roles, ways of working)
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'Fiona Lawson',
    rawText: 'The first thing people need is a career architecture that gives them a reason to stay. Right now, the path from agent to team leader is unclear and feels gatekept. We need defined capability levels — from associate agent through to senior specialist and team leader — with transparent criteria and active development support at each stage. If people can see where they\'re going and how to get there, attrition drops.',
    lens: 'People',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Simon Reed',
    rawText: 'We need a completely redesigned onboarding programme that is modular, role-specific, and technology-simplified. The current 6-week programme assumes 11 systems and a generic agent role. The new programme should be 3 weeks maximum, system-complexity-adjusted, and differentiated by role — disruption specialists, cargo agents, and premium cabin agents get different pathways from day one.',
    lens: 'People',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Natalie Price',
    rawText: 'Team leaders need to be liberated from admin to do the coaching that drives performance. Concretely, that means eliminating the manual admin work that consumes 60-70% of their time — automated scheduling, AI-generated quality summaries, system-generated performance reports. Free up that time and TLs become genuine coaches. That\'s the role change that makes everything else work.',
    lens: 'People',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Claire Donovan',
    rawText: 'Disruption simulation training needs to be a core part of every agent\'s development from month one. Scenario-based exercises — here\'s a major disruption, here\'s the information you have, handle these three calls — before any agent handles a real disruption live. The absence of this is why first-time disruption handling is so inconsistent and why agents lose confidence under pressure.',
    lens: 'People',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Aisha Okafor',
    rawText: 'Agents need authority to match their responsibility. If I\'m the person the customer speaks to, I should be able to resolve their problem without a supervisor approval chain. The people change needed is to redesign the authority framework — not unlimited authority, but calibrated to contact type, customer tier, and resolution value. Agents who can resolve problems feel better about their jobs and stay longer.',
    lens: 'People',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DEFINE APPROACH — Q2: Organisation (governance, process, measurement)
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'James Whitfield',
    rawText: 'We need a single transformation programme governance structure that replaces the three separate steering groups that currently operate without coordination. One programme board, one set of workstream owners, one sequenced delivery plan. Every initiative — technology, people, process — sits under one accountability framework and is measured against the same outcome KPIs.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'David Palmer',
    rawText: 'First Contact Resolution needs to become the primary operational metric, replacing AHT as the number agents and team leaders are measured on. The process change that follows from that single measurement shift is significant — routing logic changes, authority delegation changes, quality criteria change. Everything else aligns to the metric we choose to put at the centre.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Katherine James',
    rawText: 'A data governance council with agreed metric definitions is the organisational change we need before any technology investment. Convene the heads of Operations, Technology, Quality, and WFM, agree on canonical definitions for every key metric, publish them, and mandate their use across all reporting. This is the structural precondition for a single performance dashboard to work.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: "Mark O'Brien",
    rawText: 'BPO governance needs to be rebuilt from the contract up. New SLAs that measure FCR, customer satisfaction, and complaint escalation rate — not calls handled and AHT. Quarterly business reviews with real-time performance data, not retrospective reports. A joint calibration process that runs monthly across all sites. And a clear escalation pathway when standards are not met.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Emma Fitzgerald',
    rawText: 'A real-time performance visibility platform that covers all sites — in-house and BPO — is the organisational infrastructure we\'re missing. Not a new report — a live dashboard that every operational manager, including in Manila, can see simultaneously. Issues are surfaced in real time, not reported retrospectively. This changes the management dynamic from retrospective review to proactive intervention.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DEFINE APPROACH — Q3: Technology (build, buy, integrate)
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'Rachel Hughes',
    rawText: 'We integrate, not replace. The Salesforce-Genesys-Amadeus core is expensive to replace and carries significant migration risk. The right technology approach is an integration middleware layer — an event-driven API platform that sits between our existing systems and exposes a unified data model to the agent desktop, the AI co-pilot, and the analytics platform. Buy the middleware, configure the integrations, keep the core systems.',
    lens: 'Technology',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Chris Barker',
    rawText: 'Build the AI co-pilot on top of the integration layer, not before it. The sequencing matters enormously. If we deploy AI on top of fragmented, inconsistent data, we get AI-speed rubbish. First: integration middleware. Second: clean customer data record. Third: AI co-pilot built on a reliable data foundation. This is a 12-18 month platform programme before the AI layer can be properly deployed.',
    lens: 'Technology',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Raj Patel',
    rawText: 'We need to buy a workforce management platform upgrade, not build one. Verint has the capability we need — predictive scheduling, real-time intraday management, disruption-aware forecasting — but we\'ve configured it for 20% of its potential. The investment is in configuration and integration, not a new platform. We extend what we have, connect it to real-time operational data feeds, and unlock the capability that\'s already licensed.',
    lens: 'Technology',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Nathan Hughes',
    rawText: 'Buy an analytics and BI platform to replace the fifteen reports. Snowflake or Databricks as the data warehouse, Power BI as the presentation layer, and a clear data governance framework that defines what goes in and how it\'s labelled. This is a buy-and-configure decision, not a build. The investment is in data quality, integration, and the governance process — not in building analytics infrastructure from scratch.',
    lens: 'Technology',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Louise Carter',
    rawText: 'For quality monitoring, we buy an AI quality tool — Tethr, Qualtrics XM, or similar — that integrates with Genesys to review 100% of calls automatically. The tool scores against our quality framework, identifies coaching opportunities, and generates team leader summaries. We configure it to our standards, we don\'t build it. This capability is mature in the market and deployable within six months.',
    lens: 'Technology',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DEFINE APPROACH — Q4: Customer (prove the outcome, journey design)
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'Sarah Morrison',
    rawText: 'The customer outcome we\'re proving is loyalty created through recovery excellence. The metric is: customers who contact us during a disruption and receive excellent service should show higher retention and higher NPS than customers who weren\'t disrupted. If we can demonstrate that a well-handled disruption creates more loyalty than a smooth journey, we\'ve proved the model. We measure this cohort by cohort.',
    lens: 'Customer',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Priya Sharma',
    rawText: 'The customer journey in the new model starts before the contact happens. Step one: proactive notification reaches the customer with their options before they need to call. Step two: the app provides self-service resolution for straightforward cases. Step three: for complex cases, the customer reaches an agent who already has their context and can resolve in the first call. We measure failure demand reduction — the percentage of contacts that are customers chasing something that should have been proactive — as our primary journey health metric.',
    lens: 'Customer',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Michael Grant',
    rawText: 'The proof of customer outcome for premium cabin is straightforward — we already have it. Gold and Platinum customers who receive premium cabin handling have measurably higher retention rates and NPS scores. The design task is to identify which elements of premium handling can be systematically extended to the broader customer base, and what investment is required to deliver them at scale.',
    lens: 'Customer',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Daniel Cooper',
    rawText: 'We need to design the customer journey from the pain point, not from the process. Start with a customer whose flight has been cancelled. Map every touchpoint from the moment they receive notification to the moment they\'re rebooked or refunded. Identify every friction point, every place where the customer is uncertain or frustrated, and design specifically for those moments. Don\'t optimise the existing process — redesign from the customer\'s experience.',
    lens: 'Customer',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DEFINE APPROACH — Q5: Regulation (designing compliance in)
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'James Whitfield',
    rawText: 'EU261 compliance needs to be automated, not agent-dependent. Right now, whether a customer receives their correct EU261 entitlement depends on whether the agent correctly calculates the route distance and delay duration. That is a regulatory risk — if we get it wrong, we face fines, complaints, and reputational damage. The EU261 calculation must be automated in the compensation engine, so the agent is presented with the correct figure and cannot offer less.',
    lens: 'Regulation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Rachel Hughes',
    rawText: 'GDPR compliance in the AI co-pilot requires privacy-by-design from the start. The AI system must be designed to process only the minimum necessary personal data, with clear audit trails for what data was accessed and why. Our Data Protection Officer needs to be involved in the architecture design, not brought in at the end to sign off. Compliance is a design input, not a sign-off gate.',
    lens: 'Regulation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: "Mark O'Brien",
    rawText: 'BPO regulatory requirements need to be written into the new contracts from the start. GDPR data processing agreements with each BPO partner. Security standards that meet our IT security policy. Training obligations that cover regulatory content — EU261, GDPR, vulnerable customer identification — with verification requirements. Regulation isn\'t an afterthought in the new BPO model — it\'s a contractual baseline.',
    lens: 'Regulation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },
  {
    speaker: 'Tariq Hassan',
    rawText: 'For cargo, IATA Dangerous Goods Regulations must be built into the agent workflow, not left to memory or a separate manual. The system should surface the DG classification requirements when an agent is handling a cargo contact with a DG shipment — automatic, contextual, and auditable. This reduces compliance risk and removes the dependency on individual agents knowing the full DG regulatory framework by heart.',
    lens: 'Regulation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ENABLER',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DEFINE APPROACH — Q6: Ownership, next steps, quick wins
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'James Whitfield',
    rawText: 'We need a Programme Director appointed this week — someone with authority to span all three transformation programmes and create the single governance structure. That is the first and most critical ownership decision. Without a single accountable owner at the top, every workstream will continue to optimise locally and the systemic problems will persist.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },
  {
    speaker: 'David Palmer',
    rawText: 'The quick win that demonstrates intent most clearly is fixing the routing logic. It\'s been unchanged for three years and it\'s causing measurable harm every day. Routing can be reconfigured in Genesys within four weeks without a full IT programme. Updated routing logic — matching contact types to agent skills and BPO site capability — will reduce misrouted contacts immediately and demonstrate that the transformation is already delivering.',
    lens: 'Technology',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },
  {
    speaker: 'Fiona Lawson',
    rawText: 'HR owns the attrition workstream and we can start immediately. Exit interview analysis to understand the top three reasons people leave — we think we know but we haven\'t properly structured this data. A retention policy review to ensure salary competitiveness in our key markets. And a career architecture design project to define progression paths. These are People workstream quick wins that don\'t require technology investment.',
    lens: 'People',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },
  {
    speaker: 'Katherine James',
    rawText: 'Data governance is the quick win for Analytics. Convene a metric definition working group — two weeks, five people, one output: a canonical metric dictionary. Publish it. Mandate its use. Stop producing fifteen reports with fifteen different definitions. This takes four weeks and costs nothing except management time. And it unblocks every data-related initiative that follows.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },
  {
    speaker: 'Tom Hendricks',
    rawText: 'Operations owns the disruption playbook and we can write it in six weeks. Bring together the four most experienced disruption desk team leaders, document the current best practice for the twelve most common disruption scenarios, have it reviewed by Policy and Legal, and publish it. No technology required. This is a process quick win that will improve disruption handling quality immediately.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },
  {
    speaker: 'Angela Ward',
    rawText: 'Verint configuration is the WFM quick win. We have the platform, it\'s underutilised. I\'ve already scoped the configuration work needed to switch on real-time adherence and basic intraday management — it\'s eight weeks of configuration with the vendor. No new technology purchase required. This immediately improves our ability to manage same-day staffing and reduces the manual intraday management burden.',
    lens: 'Technology',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DEFINE APPROACH — Q7: 90-day plan, what starts tomorrow
  // ══════════════════════════════════════════════════════════════════════════

  {
    speaker: 'James Whitfield',
    rawText: 'Days 1-30: governance. Appoint Programme Director, establish single programme board, map all six workstreams to owners, freeze new initiatives until sequencing is agreed. Days 30-60: diagnosis validation. Validate the root causes we\'ve identified today with operational data. Days 60-90: quick win delivery. Routing reconfiguration live, Verint modules switched on, disruption playbook published, metric dictionary agreed. That\'s our 90-day plan.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },
  {
    speaker: 'Rachel Hughes',
    rawText: 'Technology\'s 90-day plan starts with the integration architecture design. We commission a 30-day technical architecture assessment — what does the middleware layer look like, which vendors do we evaluate, what does the Amadeus API actually support. Month two: vendor selection and contract negotiation. Month three: integration platform standing up in development environment. The first real integration — Salesforce to Genesys customer context — deployed by day 90.',
    lens: 'Technology',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },
  {
    speaker: 'David Palmer',
    rawText: 'Routing reconfiguration starts tomorrow. I can have the routing logic review scoped by end of week, the reconfiguration designed within two weeks, tested in staging by day 30, and live by day 45. While that happens, we run a parallel disruption staffing model review — scoping what real-time operational data feeds we need from the ops system to make forecasting disruption-aware. That scoping is complete by day 60.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },
  {
    speaker: 'Fiona Lawson',
    rawText: 'People workstream starts with a listening exercise — structured exit interviews and a pulse survey of current agents in the first 30 days. The data informs the retention policy redesign, which is drafted by day 60. By day 90, the new career architecture framework is agreed and communicated to all agents. Simultaneously, the onboarding programme redesign is scoped and the disruption simulation training module is in development.',
    lens: 'People',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },
  {
    speaker: 'Louise Carter',
    rawText: 'Quality workstream 90-day plan: days 1-30 evaluate three AI quality monitoring vendors with a structured RFP. Days 30-60 select vendor, negotiate contract, begin integration with Genesys. Days 60-90 pilot the AI quality tool on a subset of calls — 500 per week — and calibrate the scoring model against our human assessors. By day 90 we have a working pilot and a plan to scale to 100% call coverage.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },
  {
    speaker: "Mark O'Brien",
    rawText: 'BPO 90-day plan: days 1-30 commission a legal review of existing BPO contracts to map renegotiation timelines and opportunities. Days 30-60 draft new SLA framework with outcome-based metrics — FCR, CSAT, escalation rate — and begin informal discussions with BPO partners. Days 60-90 establish a real-time performance visibility pilot with Manila using existing Genesys reporting. By day 90 we have live BPO data for the first time.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },
  {
    speaker: 'Liam O\'Connor',
    rawText: 'From Manila, the 90-day ask is simple: include us in the governance. Give us a seat on the programme board — even as observers — so we know what\'s being decided and can raise the offshore perspective. Set up a monthly call between UK operational leadership and all BPO site leads. And commit to sharing policy updates within the hour they\'re made — not through a chain, directly to all sites simultaneously. These are behaviours, not technology. They start tomorrow.',
    lens: 'Organisation',
    dialoguePhase: 'DEFINE_APPROACH',
    primaryType: 'ACTION',
  },

];

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🗄️  Seeding live workshop snapshot for Jo Air...\n');

  // Build nodesById payload
  const nodesById: Record<string, {
    rawText: string;
    lens: string;
    dialoguePhase: string;
    classification: { primaryType: string };
    speakerId: string;
    createdAtMs: number;
  }> = {};

  const now = Date.now();

  for (let i = 0; i < NODES.length; i++) {
    const n = NODES[i];
    const id = `${uid('node')}_${i}`;
    nodesById[id] = {
      rawText: n.rawText,
      lens: n.lens,
      dialoguePhase: n.dialoguePhase,
      classification: { primaryType: n.primaryType },
      speakerId: n.speaker,
      createdAtMs: now + i * 1000,
    };
  }

  const payload = {
    v: 2,
    savedAtMs: now,
    dialoguePhase: 'DEFINE_APPROACH',
    mainQuestionIndex: 6,
    nodesById,
    cogNodes: [],
    stickyPads: [],
    completedByQuestion: [],
    signals: [],
    liveJourney: { stages: [], actors: [], gaps: [] },
    sessionConfidence: { overall: 0.82, coverage: 0.78, depth: 0.85 },
    themes: [],
    activeThemeId: null,
    lensCoverage: [],
    agentConversation: [],
    journeyCompletionState: null,
  };

  // Delete any existing snapshots for this workshop to avoid stale data
  await (prisma as any).liveWorkshopSnapshot.deleteMany({
    where: { workshopId: WORKSHOP_ID },
  });

  // Create the snapshot
  await (prisma as any).liveWorkshopSnapshot.create({
    data: {
      workshopId: WORKSHOP_ID,
      name: 'Jo Air Workshop — Full Session (Synthetic)',
      dialoguePhase: 'DEFINE_APPROACH',
      payload,
    },
  });

  // Count by phase
  const reimagineCount = NODES.filter(n => n.dialoguePhase === 'REIMAGINE').length;
  const constraintsCount = NODES.filter(n => n.dialoguePhase === 'CONSTRAINTS').length;
  const defineCount = NODES.filter(n => n.dialoguePhase === 'DEFINE_APPROACH').length;

  console.log(`✅ Snapshot created with ${NODES.length} participant responses:`);
  console.log(`   REIMAGINE:       ${reimagineCount} responses`);
  console.log(`   CONSTRAINTS:     ${constraintsCount} responses`);
  console.log(`   DEFINE_APPROACH: ${defineCount} responses`);
  console.log(`\n   Unique speakers: ${new Set(NODES.map(n => n.speaker)).size}`);
  console.log('\n👉 Now run the Output Intelligence pipeline on the Jo Air workshop.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
