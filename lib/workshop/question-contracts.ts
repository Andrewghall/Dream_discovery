/**
 * Contract-driven question generation system for DREAM workshops.
 *
 * Each phase × workshop-type combination has a typed contract that defines:
 *   - What the question at each depth level (Surface → Depth → Edge) must achieve
 *   - What each of the 3 seed prompts must cover (coverage or onion-peel)
 *
 * The contracts drive the LLM generation — the agent fills contract slots with
 * company-specific content rather than free-generating questions.
 *
 * REIMAGINE: 100% vision — no constraint language of any kind.
 * CONSTRAINTS: What stands between today and the vision.
 * DEFINE_APPROACH: Practical path from today to the vision.
 */

import type { CanonicalWorkshopType } from '@/lib/workshop/workshop-definition';

export type DepthLevel = 'surface' | 'depth' | 'edge';

export interface DepthContract {
  depth: DepthLevel;
  /** What the main question must achieve — the purpose this slot serves */
  questionIntent: string;
  /** What each of the 3 seed prompts must target — coverage angle or onion-peel probe */
  promptIntents: [string, string, string];
}

export interface LensSpecificIntent {
  /** What this lens's surface question must force — distinct from every other lens */
  surface: string;
  /** What this lens's depth question must force — distinct from every other lens */
  depth: string;
  /** What this lens's edge question must force — distinct from every other lens */
  edge: string;
}

export interface PhaseQuestionContract {
  phase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';
  workshopType: CanonicalWorkshopType | 'DEFAULT';
  /**
   * Who the primary customer/beneficiary is for this workshop type.
   * Used to anchor questions in the right perspective.
   */
  customerAnchor: string;
  /**
   * How sub-actors (roles in the room, operational roles) should appear in seed prompts.
   * The LLM uses this to personalise prompts to the actual actors in this workshop.
   */
  subActorGuidance: string;
  /** Phase-level framing instruction — what this phase is for */
  phaseFocus: string;
  /** Three depth levels — always [surface, depth, edge] */
  depthLevels: [DepthContract, DepthContract, DepthContract];
  /**
   * Per-lens question intents that OVERRIDE the generic depthLevels.questionIntent.
   * When present for a given lens, these replace the generic intent so each lens
   * forces a genuinely different line of thinking rather than the same template.
   */
  lensSpecificGuidance?: Record<string, LensSpecificIntent>;
}

// ══════════════════════════════════════════════════════════════
// REIMAGINE CONTRACTS
// Pure vision — zero constraint language at any depth level.
// Customer is north star. Sub-actors appear in seed prompts.
// ══════════════════════════════════════════════════════════════

const REIMAGINE_DEFAULT: PhaseQuestionContract = {
  phase: 'REIMAGINE',
  workshopType: 'DEFAULT',
  customerAnchor: 'the people who use, depend on, or are served by this operation',
  subActorGuidance: 'Seed prompts should draw out specific sub-actors (operational roles, frontline teams, partners) whose work shapes the customer experience through this lens.',
  phaseFocus: 'Pure unconstrained vision. If everything that currently prevents this from being great was removed, what would it look like? No mention of barriers, gaps, or what needs to change — only what becomes possible.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Open the unconstrained vision through this lens — if every constraint was removed, what would the customer\'s experience look like for this company?',
      promptIntents: [
        'The specific moment or touchpoint where this vision would feel most different to the customer',
        'What the key people doing this work would do differently — or no longer have to do',
        'What someone external (customer, partner, new joiner) would notice or say about this company if the vision were real',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the vision concrete — what would actually be different day-to-day for the people doing the work and the customers they serve?',
      promptIntents: [
        'What a typical operational role would experience differently in their working day',
        'Where the interaction between operational roles and the customer would change most visibly',
        'What would exist or be routinely available that doesn\'t exist today',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface the most ambitious, unspoken version — what\'s the transformative possibility nobody in the room has fully committed to yet?',
      promptIntents: [
        'The version of this that would make this company genuinely different from every competitor in this space',
        'What participants would say is "too ambitious" but secretly believe is the right direction',
        'What this vision would make completely obsolete or unnecessary',
      ],
    },
  ],
};

const REIMAGINE_GTM: PhaseQuestionContract = {
  phase: 'REIMAGINE',
  workshopType: 'GO_TO_MARKET',
  customerAnchor: 'the buyers this company most wants to win',
  subActorGuidance: 'Seed prompts should reference commercial, presales, and delivery roles — the sub-actors whose positioning and execution determines whether the proposition lands with buyers.',
  phaseFocus: 'Market-level vision — given how fast the market is moving and how buyer needs are changing, what does a genuinely relevant, differentiated proposition look like? Not deal mechanics — the proposition and positioning itself.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Open the market-level vision — given how buyer needs are changing, what does a genuinely relevant and differentiated proposition look like through this lens?',
      promptIntents: [
        'What buyers in this market actually need right now that this company\'s current offer doesn\'t fully deliver',
        'Where the market is moving that current positioning doesn\'t yet speak to',
        'What a proposition through this lens would look like that made this company the obvious choice for the buyers they most want to win',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the proposition concrete — what would this mean for how buyers experience this company, how the commercial team positions, and how value is delivered?',
      promptIntents: [
        'What a buyer would say to a peer the week after signing if this proposition were real',
        'What the commercial and presales team would do differently in how they engage and position',
        'What delivery or fulfilment would need to look like to genuinely match what\'s being promised',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface what people in the room privately doubt or haven\'t committed to — what the proposition would require them to stop doing or what would become unrecognisable.',
      promptIntents: [
        'The version of this that competitors aren\'t doing and couldn\'t quickly copy',
        'What this company would have to fully commit to — and stop hedging on — to make this real',
        'What buyers would say is exactly what they\'ve been looking for if this company offered this',
      ],
    },
  ],
  lensSpecificGuidance: {
    'People': {
      surface: 'Challenge the BEHAVIOUR dimension: if this proposition were real, what would buyers see Capita\'s people doing — or no longer doing — in every commercial conversation? Ask about observable human behaviour, not aspiration.',
      depth: 'Make it concrete: what would a buyer experience differently in a conversation with Capita\'s people versus today? Ground in a specific type of interaction, not a general capability.',
      edge: 'Surface what Capita\'s people privately doubt about their own ability to show up this way — or what they would have to stop doing entirely for this version to be credible.',
    },
    'Commercial': {
      surface: 'Challenge the VALUE dimension: if this proposition existed today, what would a buyer be paying for — and could they explain that value clearly to someone who hadn\'t been in the room? Ask about buyer-side value perception, not internal pricing.',
      depth: 'Make it concrete: how would the commercial relationship itself feel different — the contract, the conversation, the moment a buyer signs? What would a buyer say they got that they couldn\'t get elsewhere?',
      edge: 'Surface the commercial commitment the room privately doubts is achievable — the version of the proposition that would require Capita to walk away from how it currently wins work.',
    },
    'Partners': {
      surface: 'Challenge the ECOSYSTEM dimension: which relationships, partnerships, or third parties would make this proposition more credible than Capita could achieve alone? Ask about who else needs to be part of making this real.',
      depth: 'Make it concrete: what would partners or ecosystem players need to do or commit to for this proposition to be deliverable? Where does Capita currently depend on others in ways buyers don\'t yet see?',
      edge: 'Surface which existing partner relationships would quietly undermine this vision — or what Capita would have to sacrifice in its ecosystem to truly own the proposition rather than share it.',
    },
  },
};

// ══════════════════════════════════════════════════════════════
// REIMAGINE — TRANSFORMATION, OPERATIONS, AI, FINANCE
// ══════════════════════════════════════════════════════════════

const REIMAGINE_TRANSFORMATION: PhaseQuestionContract = {
  phase: 'REIMAGINE',
  workshopType: 'TRANSFORMATION',
  customerAnchor: 'the people who depend on or are served by this organisation',
  subActorGuidance: 'Seed prompts should surface specific roles — frontline teams, operational managers, customers — whose experience would most visibly change if the transformation were real.',
  phaseFocus: 'Pure unconstrained future state. If every structural, behavioural, and technical constraint were removed, what would this organisation genuinely look like — how it operates, how people work, and what customers experience?',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Open the unconstrained future state through this lens — what would be most visibly different about how this organisation operates if the transformation were real?',
      promptIntents: [
        'The specific moment or interaction that would feel most different to a customer or frontline team in the future state',
        'What a role doing this work would no longer have to do or work around',
        'What someone new to the organisation would notice or remark on that is not possible today',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the future state concrete — what would actually change day-to-day for the people in this organisation and those they serve?',
      promptIntents: [
        'What a typical operational or frontline role would experience differently in their working week',
        'Where the interaction between teams, or between teams and customers, would change most visibly',
        'What would routinely exist or be available in the future state that does not exist today',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface the most ambitious, unspoken version of the future state — what nobody in the room has fully committed to yet but privately believes is the right direction.',
      promptIntents: [
        'The version of the future state that would make this organisation genuinely unrecognisable from what it is today',
        'What participants would describe as too ambitious but secretly believe is the correct destination',
        'What the future state would make completely obsolete or unnecessary in the current model',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Challenge the BEHAVIOUR dimension: if the transformation were real, what would people do differently in every working day — not the org chart, but the observable habits, conversations, and decisions that would change?',
      depth: 'Make it concrete: what would a frontline or operational role experience in their working week that they cannot experience today? Not a programme — a real change in how they work and who they work with.',
      edge: 'Surface what the room privately doubts about people\'s willingness to genuinely change — the behaviour or working pattern that has been designed around for years that nobody has named as the thing most needing to stop.',
    },
    Operations: {
      surface: 'Challenge the FLOW dimension: if the operation ran as it should in the future state, what would simply no longer exist — which workarounds, escalations, and delays would disappear?',
      depth: 'Make it concrete: what would a typical end-to-end handoff look like in the future state compared to today? What would move faster, who would be involved differently, and what would no longer require intervention?',
      edge: 'Surface the operating model component the room privately knows needs to go but hasn\'t named — the structural arrangement nobody wants to challenge because changing it would disrupt power or accountability in this room.',
    },
    Technology: {
      surface: 'Challenge the ENABLEMENT dimension: if technology genuinely supported the future state, what would people stop doing manually or working around — what would just work that currently doesn\'t?',
      depth: 'Make it concrete: which system, integration, or data capability would be most different in the future state — and what would that enable for the people depending on it today?',
      edge: 'Surface the technical dependency the room is not questioning — the architecture assumption or platform constraint everyone is building around that would need to be different for the future state to actually work.',
    },
    Commercial: {
      surface: 'Challenge the MARKET EXPECTATION dimension: if the transformation delivered what it promises, what would customers or external stakeholders experience that they cannot experience today?',
      depth: 'Make it concrete: which customer relationship or expectation would change most visibly — and what would that look like in practice for the team managing it?',
      edge: 'Surface the customer promise the transformation would require this company to make that nobody has yet been willing to put in writing — the commitment that the room privately believes is necessary but has avoided stating.',
    },
    'Risk/Compliance': {
      surface: 'Challenge the GOVERNANCE dimension: if controls were designed for the future state rather than the current model, what would move faster — and what would actually be safer than it is today?',
      depth: 'Make it concrete: which approval, assurance step, or governance layer would need to change for the future operating model to run at the speed and scale envisioned?',
      edge: 'Surface the governance constraint the room privately knows is protecting the status quo rather than managing real risk — the control nobody has challenged because challenging it would require someone in this room to own the answer.',
    },
    Partners: {
      surface: 'Challenge the ECOSYSTEM dimension: which external relationships, partners, or capabilities would make the future state more achievable or more credible than this company could deliver alone?',
      depth: 'Make it concrete: what would a key partner or vendor need to do differently — or what would this company need to own rather than outsource — for the future state to be genuinely reliable?',
      edge: 'Surface the external dependency the room knows would block the transformation but hasn\'t named — the third-party constraint the plan assumes will resolve itself that has not yet been tested.',
    },
  },
};

const REIMAGINE_OPERATIONS: PhaseQuestionContract = {
  phase: 'REIMAGINE',
  workshopType: 'OPERATIONS',
  customerAnchor: 'the people who use or depend on this service or operation',
  subActorGuidance: 'Seed prompts should surface specific operational roles — frontline staff, team leads, support functions — whose working experience would most visibly improve if execution were clean.',
  phaseFocus: 'Pure unconstrained operational vision. If today\'s friction, bottlenecks, and workarounds were removed, what would smooth, reliable, high-quality execution actually look like?',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Open the unconstrained operational vision — if the friction were gone, what would most visibly change about how work flows and how customers experience this operation?',
      promptIntents: [
        'The specific service moment or handoff that would feel most different to a customer or frontline team',
        'What a role doing this work would no longer have to deal with or compensate for',
        'What someone observing this operation from outside would notice that cannot be seen today',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the vision concrete — what would a clean end-to-end flow look like for the people doing this work every day?',
      promptIntents: [
        'What a typical operational role would experience differently in their working day if execution were smooth',
        'Where the handoff between teams or systems would change most meaningfully',
        'What would be routinely available or reliable that is currently inconsistent or missing',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface the operational ideal nobody has fully committed to — the version of smooth execution that would require something structural or cultural to be genuinely different.',
      promptIntents: [
        'The version of operational reliability that would require the business to stop doing something it currently treats as unavoidable',
        'What participants would say is unrealistic but privately believe is the right standard to aim for',
        'What clean execution would make obsolete or unnecessary in the current operating model',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Challenge the WORK EXPERIENCE dimension: if operations ran cleanly, what would a frontline role no longer have to deal with — which recurring frustrations, escalations, or compensating behaviours would simply stop?',
      depth: 'Make it concrete: what would a specific operational role spend their time on if the friction were gone? Not a programme — a real change in what fills their day.',
      edge: 'Surface the people toll the room privately knows exists but hasn\'t named — the pressure, quiet disengagement, or workaround behaviour that has become normal because the operation has never been designed to remove it.',
    },
    Operations: {
      surface: 'Challenge the FLOW dimension: if work moved without friction, what would look most different — which queues, rework cycles, and escalation paths would disappear?',
      depth: 'Make it concrete: what would a clean end-to-end handoff look like for the most common work type — what would change, who would be differently involved, and what would no longer need intervention?',
      edge: 'Surface the operational design decision the room privately knows is broken but hasn\'t challenged — the structure or arrangement everyone works around that nobody has named as the thing that most needs to change.',
    },
    Technology: {
      surface: 'Challenge the TOOL SUPPORT dimension: if systems and data worked properly, what would people stop doing manually — what would the tools simply handle that people currently do themselves?',
      depth: 'Make it concrete: which system gap or data quality issue, if fixed, would have the most immediate impact on execution reliability — and what would that look like in practice for the people currently dealing with it?',
      edge: 'Surface the technology dependency the room knows undermines execution but hasn\'t named as the root cause — the system limitation everyone has learned to work around that has never been formally acknowledged as something that could be fixed.',
    },
    Commercial: {
      surface: 'Challenge the CUSTOMER VALUE dimension: if operations were reliable and clean, what would customers experience that they currently don\'t — what would change in how they describe this company?',
      depth: 'Make it concrete: which specific service interaction would look different for a customer if execution were smooth — and what would that mean for trust, loyalty, or referral?',
      edge: 'Surface the customer consequence the room privately knows but hasn\'t named — the service failure or broken promise that keeps recurring and that the business has quietly redefined as acceptable rather than fixed.',
    },
    'Risk/Compliance': {
      surface: 'Challenge the PROPORTIONALITY dimension: if controls were designed for operational flow rather than risk avoidance, what would move faster without becoming less safe?',
      depth: 'Make it concrete: which approval step or compliance requirement, if redesigned, would remove the most operational delay — and what would that look like for the people dealing with it every day?',
      edge: 'Surface the control the room privately knows slows work without proportionate protection — the governance step designed for a different problem that nobody has challenged because challenging it means owning the risk question.',
    },
    Partners: {
      surface: 'Challenge the ECOSYSTEM dimension: if the external relationships that most affect execution were working properly, what would be different about how work flows through this operation?',
      depth: 'Make it concrete: which supplier, vendor, or outsourced handoff, if reliable, would remove the most execution friction — and what would that enable for the teams depending on it?',
      edge: 'Surface the external dependency the room knows is the most significant source of operational instability but hasn\'t named — the partner arrangement the business has been working around without formally resolving.',
    },
  },
};

const REIMAGINE_AI: PhaseQuestionContract = {
  phase: 'REIMAGINE',
  workshopType: 'AI',
  customerAnchor: 'the people who use or are served by this work',
  subActorGuidance: 'Seed prompts should surface specific roles — analysts, operators, service staff — whose working experience would most genuinely change if AI were integrated into their work.',
  phaseFocus: 'Pure unconstrained AI vision. If data, governance, and adoption barriers were removed, where would AI genuinely make work, decisions, and service meaningfully better?',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Open the unconstrained AI vision — if AI genuinely worked here, what would most visibly change about how work gets done and what people spend their time on?',
      promptIntents: [
        'The specific task, decision, or information need that AI would handle differently for people doing this work',
        'What a role doing this work would no longer have to do manually or repeatedly',
        'What someone observing this work from outside would notice as the most obvious improvement',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the AI vision concrete — what would a specific use case actually look like in practice for the people using it every day?',
      promptIntents: [
        'What a typical role would do differently in their working day if AI handled the most repetitive or information-heavy parts',
        'Where the quality, speed, or consistency of decisions or outputs would change most meaningfully',
        'What would become possible or routinely available that is currently too slow, too inconsistent, or too manual',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface the most genuinely transformative AI possibility — the use case that would require something fundamental to change about how this organisation uses data, makes decisions, or structures work.',
      promptIntents: [
        'The AI capability that would make the most significant difference but that the room hasn\'t fully committed to pursuing',
        'What AI would need to be genuinely trusted to do — not just assist with — for this organisation to get the most value from it',
        'What current roles, decisions, or processes AI would make genuinely unnecessary rather than just faster',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Challenge the WORK IMPROVEMENT dimension: if AI handled the most repetitive or information-heavy parts of this work, what would people no longer spend their time on — and what would they do instead?',
      depth: 'Make it concrete: what would a specific role do differently in their working week if AI took on the tasks it is best suited to? Not a strategy — a real change in how their day is structured.',
      edge: 'Surface what the room privately doubts about people\'s readiness — the skill gap, trust concern, or role anxiety that has been left unspoken because naming it feels uncomfortable or politically sensitive.',
    },
    Operations: {
      surface: 'Challenge the WORKFLOW dimension: if AI were genuinely integrated into how work flows, which tasks or decisions would be handled differently — what would the process look like without the current manual steps?',
      depth: 'Make it concrete: what would a specific end-to-end process look like with AI in it — which steps would change, which would disappear, and what would become faster or more consistent?',
      edge: 'Surface the workflow assumption the room hasn\'t questioned — the process design being treated as fixed that would need to change for AI to actually work rather than just be added alongside the existing way of working.',
    },
    Technology: {
      surface: 'Challenge the CAPABILITY dimension: if data quality and system integration were ready for AI, what becomes possible that isn\'t possible today — what would the technical foundation unlock?',
      depth: 'Make it concrete: which AI use case would be most impactful if the data and integration quality were genuinely ready — and what would that use case actually do in practice for the people depending on it?',
      edge: 'Surface the technical assumption the room hasn\'t tested — what is being treated as achievable that depends on data quality, integration, or vendor capability that has not been confirmed as real.',
    },
    Commercial: {
      surface: 'Challenge the VALUE CREATION dimension: if AI improved the customer-facing part of this work, what would customers experience differently — what would be faster, more accurate, or more relevant?',
      depth: 'Make it concrete: which specific customer interaction or service moment would AI change most visibly — and what would that mean for customer confidence in this company?',
      edge: 'Surface the commercial risk the room is not naming — what AI could damage in customer trust or service quality if deployed without the right controls or without genuine readiness.',
    },
    'Risk/Compliance': {
      surface: 'Challenge the GOVERNANCE dimension: if controls were designed to enable safe AI use rather than prevent it, what would be possible that is currently blocked — what would responsible AI actually look like here?',
      depth: 'Make it concrete: which specific use case or data type would be unlocked if governance were designed correctly — and what would that require in terms of oversight, accountability, and audit?',
      edge: 'Surface the governance risk the room is not naming — the accountability gap, data boundary, or audit requirement that would make some AI use genuinely problematic and that hasn\'t been defined clearly enough to be safe.',
    },
    Partners: {
      surface: 'Challenge the ECOSYSTEM dimension: which external AI platforms, tools, or vendor capabilities would make the vision achievable faster than this company could build — and what role would they play?',
      depth: 'Make it concrete: what would a vendor-enabled AI capability look like in practice — what would it do, who would use it, and what would this company still need to own and control?',
      edge: 'Surface the external dependency risk the room is not naming — the reliance on a vendor, platform, or dataset that the vision assumes will be available or controllable but that hasn\'t been confirmed.',
    },
  },
};

const REIMAGINE_FINANCE: PhaseQuestionContract = {
  phase: 'REIMAGINE',
  workshopType: 'FINANCE',
  customerAnchor: 'the clients, customers, or stakeholders whose work this company performs or serves',
  subActorGuidance: 'Seed prompts should surface specific roles — finance leads, operations managers, commercial owners — whose decisions and behaviours most directly affect value conversion and cost-to-serve.',
  phaseFocus: 'Pure unconstrained financial vision. If value leakage, inefficiency, and poor-fit work were removed, what would strong economics actually look like — how effort converts into value, which work the business does, and where margin comes from?',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Open the unconstrained financial vision — if value were converting cleanly, what would most visibly change about how this organisation does its work and what it takes on?',
      promptIntents: [
        'The specific work type, client, or decision that would look most different if economics were strong',
        'What a role managing cost or value would no longer have to deal with or compensate for',
        'What someone looking at this company\'s work from outside would notice as the most obvious improvement in how value is created',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the financial vision concrete — what would strong value conversion look like in practice for the people making decisions and doing the work?',
      promptIntents: [
        'What a role managing cost-to-serve or work quality would do differently in their working week',
        'Where the connection between effort and value would be most visibly different',
        'What would be routinely true about the work mix or economics that is not true today',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface the most honest financial vision — the version that would require the business to stop taking on work it currently takes on or to stop tolerating costs it currently accepts.',
      promptIntents: [
        'The version of the business that would be genuinely more valuable but that would require saying no to things the business currently says yes to',
        'What participants would describe as too disruptive but privately believe is the economically correct direction',
        'What strong economics would make unnecessary or indefensible in the current model',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Challenge the DECISION QUALITY dimension: if people\'s decisions and behaviours translated cleanly into value, what would stop happening — which approvals, rework cycles, and poor-fit choices would simply not occur?',
      depth: 'Make it concrete: what would a specific role do differently in how they prioritise work, make decisions, or handle exceptions if value conversion were the clearest measure of their performance?',
      edge: 'Surface what the room privately knows about where people\'s decisions destroy value but has never been named — the decision pattern, incentive misalignment, or ownership gap that everyone has observed and that has never been formally addressed.',
    },
    Operations: {
      surface: 'Challenge the FLOW EFFICIENCY dimension: if the work moved without unnecessary effort, what would no longer be needed — which rework, duplicate steps, and avoidable complexity would simply stop?',
      depth: 'Make it concrete: what would the most value-generative process look like in terms of how it flows, who handles what, and what it costs compared to today?',
      edge: 'Surface the operational arrangement the room privately knows is consuming value without creating it — the process design or structure that everyone tolerates because changing it would be disruptive, even though the economics are clear.',
    },
    Technology: {
      surface: 'Challenge the AUTOMATION dimension: if technology removed avoidable effort, what would people stop doing manually — which duplications, translations, validations, and rework steps would simply be handled by the system?',
      depth: 'Make it concrete: which specific manual effort or rework type, if automated or data-quality-resolved, would have the most direct impact on cost-to-serve?',
      edge: 'Surface the technology investment the room privately knows is producing less value than it cost — the system or platform that was supposed to improve economics but has instead added complexity, manual overhead, or maintenance burden.',
    },
    Commercial: {
      surface: 'Challenge the ECONOMICS dimension: if the work mix and client relationships were designed around strong-fit economics, what would look most different — which clients, contracts, or services would this company not be running?',
      depth: 'Make it concrete: what would a healthy engagement look like compared to the current average — and what would it mean for how this company selects, scopes, and prices its work?',
      edge: 'Surface the commercial arrangement the room privately knows is destroying value but hasn\'t named — the client relationship or contract structure that has been kept for reasons of history or revenue that has never been held up against the actual economics.',
    },
    'Risk/Compliance': {
      surface: 'Challenge the PROPORTIONALITY dimension: if controls were calibrated to actual risk rather than theoretical risk, what would be faster, cheaper, or lighter — which assurance steps would change or disappear?',
      depth: 'Make it concrete: which approval, audit, or compliance step, if redesigned for proportionality, would have the largest impact on cost-to-serve — and what would that look like for the people currently managing it?',
      edge: 'Surface the governance cost the room privately knows is disproportionate to the risk it manages — the control nobody has challenged because the question of what risk the business is actually prepared to accept has never been formally answered.',
    },
    Partners: {
      surface: 'Challenge the EXTERNAL VALUE dimension: if external relationships were designed to strengthen economics rather than create cost drag, what would look most different — which costs, delays, and quality losses would stop?',
      depth: 'Make it concrete: which external relationship, if renegotiated or replaced, would have the most direct impact on cost-to-serve or value conversion — and what would a better version of that relationship require?',
      edge: 'Surface the external dependency the room privately knows is creating more cost than value — the supplier or outsourced arrangement that has been kept for reasons of history or inertia and that has never been formally reassessed against its actual economics.',
    },
  },
};

// ══════════════════════════════════════════════════════════════
// CONSTRAINTS CONTRACTS
// What stands between today and the vision.
// Works from visible → structural → what it protects.
// ══════════════════════════════════════════════════════════════

const CONSTRAINTS_DEFAULT: PhaseQuestionContract = {
  phase: 'CONSTRAINTS',
  workshopType: 'DEFAULT',
  customerAnchor: 'the people who use, depend on, or are served by this operation',
  subActorGuidance: 'Seed prompts should identify which sub-actors feel the constraint most acutely, who depends on it, and who would be most affected by its removal.',
  phaseFocus: 'Map what stands between today and the reimagined vision through this lens. Work from visible surface constraints to the structural roots that maintain them.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Make the constraint visible and concrete — where does this limitation show up most clearly through this lens today?',
      promptIntents: [
        'The specific moment or situation where this constraint is felt most acutely by people doing the work',
        'Whether the customer or the operational team feels it first — and what that looks like for each',
        'How frequently and how visibly this constraint surfaces, and whether it\'s getting better or worse',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the constraint real and specific — what actually happens when this hits, who deals with it, and why does it keep coming back? Use behavioural or grounding question shapes, not academic language about causes.',
      promptIntents: [
        'What it looks like in practice when this constraint surfaces — who is involved and what they have to do',
        'What other parts of the operation depend on this constraint remaining as it is',
        'Where the constraint has gotten worse or better recently and what drove that change',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface the consequence or the trade-off — what is this actually protecting, or what breaks if it stays in place? Use consequence or pressure question shapes. Do NOT ask "what would removing X require" or "what is the real cost of maintaining".',
      promptIntents: [
        'What the business would have to fundamentally change or stop doing to remove this constraint',
        'Who in the organisation has the most to lose if this constraint is removed',
        'What this constraint is actually protecting — the real reason it persists beyond the obvious one',
      ],
    },
  ],
};

const CONSTRAINTS_TRANSFORMATION: PhaseQuestionContract = {
  phase: 'CONSTRAINTS',
  workshopType: 'TRANSFORMATION',
  customerAnchor: 'the people who depend on or are served by this organisation',
  subActorGuidance: 'Seed prompts should surface which teams, roles, or external stakeholders feel the constraint most acutely and what it prevents them from doing.',
  phaseFocus: 'Map what stands between today and the future state through this lens. Work from where the current model most visibly fails to the structural roots that keep it in place.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Make the transformation constraint visible — where does this limitation most clearly show up in how the organisation operates or changes today?',
      promptIntents: [
        'The specific situation where this constraint is felt most acutely by people trying to make change happen',
        'Whether the customer, frontline team, or leadership feels it first — and what it looks like for each',
        'How frequently and visibly this constraint surfaces, and whether it is getting better or worse',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the constraint real and specific — what actually happens when this hits, who deals with it, and why does it persist? Ask about observable behaviour and evidence, not structural theory.',
      promptIntents: [
        'What it looks like in practice when this constraint surfaces — who is involved and what they must do',
        'What other parts of the organisation depend on this constraint remaining as it is',
        'Where the constraint has got worse or better recently and what drove that change',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface the consequence or the trade-off — what is this actually protecting, or what breaks if it stays in place? Use consequence or pressure question shapes.',
      promptIntents: [
        'What the organisation would have to fundamentally change or stop doing to remove this constraint',
        'Who has the most to lose if this constraint is removed',
        'What this constraint is actually protecting beyond the obvious reason it persists',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Ask where change readiness or leadership credibility is the most visible barrier — the specific team, behaviour, or working pattern that most clearly shows the gap between where people are today and where the future state needs them to be.',
      depth: 'Ask what a specific team or role would need to do differently for the target model to work — and what currently prevents them from doing it in practice, not as a general capability concern but as a specific observable pattern.',
      edge: 'Ask what the transformation has quietly stopped talking about because the people dimension is too hard — the capability, behaviour, or leadership credibility issue that has become the constraint nobody names.',
    },
    Operations: {
      surface: 'Ask where the current operating model most clearly cannot support the future state — the specific handoff, decision point, or delivery pattern that would fail first if the target model were activated today.',
      depth: 'Ask what operational dependency keeps the current model in place — the specific process, reporting structure, or service design that everything else relies on and that would be most disruptive to change.',
      edge: 'Ask which part of the operating model has been quietly preserved even though it prevents the future state — the arrangement that limits what the transformation can achieve but that nobody has been willing to challenge.',
    },
    Technology: {
      surface: 'Ask where the current technology estate most clearly limits what the future state would need — the specific system gap, architecture constraint, or integration dependency that the target model depends on being different.',
      depth: 'Ask what technology commitment hasn\'t been made yet that the transformation depends on — the decision being avoided about platform, architecture, or data that shapes whether the future state is achievable.',
      edge: 'Ask which technical assumption about the transformation path has not been tested — the capability claim or integration complexity being treated as solved that hasn\'t been proven in the real environment.',
    },
    Commercial: {
      surface: 'Ask where customer expectations or market pressure are creating urgency for the transformation — the specific promise being made or demand being placed that the current model cannot sustain.',
      depth: 'Ask what customers currently accept that they would not accept once they have alternatives — the expectation gap that makes this transformation necessary rather than aspirational.',
      edge: 'Ask what this company would lose commercially if the transformation takes longer than planned — the retention, growth, or market risk that is quietly growing and that the transformation is supposed to solve.',
    },
    'Risk/Compliance': {
      surface: 'Ask where governance, approvals, or controls are moving too slowly for the transformation to land at pace — the specific process that would need to change for the target model to be authorised and operational.',
      depth: 'Ask what the organisation would need to stop controlling centrally for the future state to work — the assurance step or approval cycle designed for the old model that would not function in the new one.',
      edge: 'Ask what risk the transformation is privately carrying that has not been formally acknowledged — the governance assumption being maintained to avoid a conversation about what the target state would actually require.',
    },
    Partners: {
      surface: 'Ask where external dependencies are most likely to slow or limit what the transformation can deliver — the specific partner, vendor, or outsourced capability the future state depends on but that this company cannot directly change.',
      depth: 'Ask what would need to change in the relationship, contract, or capability of the most critical external dependency for the future state to work — not the partner strategy, but the specific gap between what is needed and what is currently committed.',
      edge: 'Ask which external dependency is being treated as resolved when it is not — the third-party constraint the transformation plan has assumed will work out that has not yet been tested.',
    },
  },
};

const CONSTRAINTS_OPERATIONS: PhaseQuestionContract = {
  phase: 'CONSTRAINTS',
  workshopType: 'OPERATIONS',
  customerAnchor: 'the people who use or depend on this service or operation',
  subActorGuidance: 'Seed prompts should surface which specific roles or teams feel the bottleneck most acutely and what it forces them to do or not do.',
  phaseFocus: 'Map the bottlenecks, handoff failures, tool issues, and dependencies that break execution today. Work from where work most visibly gets stuck to the structural causes keeping it that way.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Make the operational constraint visible — where does this limitation most clearly show up in how work flows or service is delivered today?',
      promptIntents: [
        'The specific situation where this constraint is felt most acutely by the people doing the work',
        'Whether the customer or the operational team feels it first — and what it looks like for each',
        'How frequently and visibly this constraint surfaces in the day-to-day work',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the constraint real and specific — what actually happens, who deals with it, and what does it force people to do? Use observable behaviour, not process abstraction.',
      promptIntents: [
        'What it looks like in practice when this constraint hits — who is involved and what they must do to manage it',
        'What other parts of the operation depend on this constraint remaining as it is',
        'Where this constraint has got worse or better recently and what caused that',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface what this constraint is actually protecting, or what breaks if it stays — use consequence or pressure question shapes.',
      promptIntents: [
        'What the operation would have to stop doing or fundamentally redesign to remove this constraint',
        'Who has the most to lose if this bottleneck is removed or resolved',
        'What this constraint has been protecting that the operation has avoided naming',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Ask where role clarity, workload, or capability most clearly affects execution reliability — the specific situation where a person or team hits a limit and work stalls, gets handed around, or has to be redone.',
      depth: 'Ask what the practical cause of that limit is — not the general capability concern, but the specific thing that person or team cannot currently do that would need to change for the bottleneck to stop recurring.',
      edge: 'Ask what the operation has quietly built around this people constraint — the workaround or escalation path that has become standard practice because nobody has named the underlying issue or committed to fixing it.',
    },
    Operations: {
      surface: 'Ask where work most visibly gets stuck — the specific bottleneck, queue, or handoff point where delay, rework, or loss of ownership first becomes apparent.',
      depth: 'Ask what keeps that bottleneck in place — not the general process concern, but the specific dependency, decision structure, or arrangement that would need to change for work to move cleanly.',
      edge: 'Ask which operational bottleneck has been raised and not fixed — what the recurring conversation is every time this surfaces, and why the fix that would work has not been made.',
    },
    Technology: {
      surface: 'Ask where a specific system, data issue, or tool limitation is creating the most execution friction — the place where technology forces manual work, rework, or workarounds that the operation has learned to live with.',
      depth: 'Ask what that tool or data gap costs in practice — the specific downstream impact on queue, quality, or service that can be traced to the system problem, not a general efficiency concern.',
      edge: 'Ask which technical workaround has become so embedded that removing it feels risky — the manual step or bypass that everyone relies on and that has never been identified as the symptom of a fixable system problem.',
    },
    Commercial: {
      surface: 'Ask where operational constraints are most clearly affecting what customers experience — the specific service failure, delay, or quality gap customers encounter because operations cannot deliver what is expected.',
      depth: 'Ask what operational failure this company is most at risk of customers stopping tolerating — the service gap that currently sits below the complaint threshold but that is getting worse or that a competitor could exploit.',
      edge: 'Ask what this company has quietly accepted about customer experience because fixing the operational root cause would be too disruptive — the service failure that has been redefined as normal rather than addressed.',
    },
    'Risk/Compliance': {
      surface: 'Ask where approval, control, or compliance requirements are most visibly slowing execution — the specific step where work is held or rerouted because of a control requirement not proportionate to the risk it manages.',
      depth: 'Ask who carries the burden of that control step — the specific role or team whose work is most affected and what they must do because of it that does not improve the quality or safety of the outcome.',
      edge: 'Ask what the operation would do differently if that control step were redesigned — and why the redesign conversation has not happened even though the burden is known to everyone in this room.',
    },
    Partners: {
      surface: 'Ask where an external dependency most visibly degrades execution — the specific supplier handoff, vendor response gap, or outsourced step that regularly creates delay, rework, or quality loss.',
      depth: 'Ask what accountability gap exists when that partner underperforms — the specific point where this company cannot answer for what the partner does, and where that gap creates the most exposure in the service chain.',
      edge: 'Ask which external dependency has been accepted as fixed even though it keeps creating the same problem — the supplier or outsourcer arrangement the business has stopped trying to resolve because the conversation is too difficult to have.',
    },
  },
};

const CONSTRAINTS_AI: PhaseQuestionContract = {
  phase: 'CONSTRAINTS',
  workshopType: 'AI',
  customerAnchor: 'the people who use or depend on this work',
  subActorGuidance: 'Seed prompts should surface which specific roles or teams would most directly feel the impact of this AI constraint — in adoption, in data readiness, or in governance.',
  phaseFocus: 'Map the workflow, data, governance, technical, and behavioural blockers that would stop AI from being useful or safe in this organisation. Work from where AI would fail most visibly to the structural causes.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Make the AI constraint visible — where does this limitation most clearly prevent AI from being feasible, trusted, or useful today?',
      promptIntents: [
        'The specific situation where this constraint would surface if an AI use case were attempted',
        'Whether the technical team, the governance function, or the end users would feel it first',
        'How clearly and frequently this constraint has already surfaced in previous AI or automation attempts',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the constraint real and specific — what actually happens or would happen when this hits, who owns the problem, and why does it persist?',
      promptIntents: [
        'What it looks like in practice when this constraint blocks or undermines an AI use case',
        'What other parts of the AI ambition depend on this constraint being resolved first',
        'Where this constraint has got worse or better recently and what drove that',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface what this constraint is actually protecting, or what breaks if it is ignored — use consequence or pressure question shapes.',
      promptIntents: [
        'What the organisation would have to stop claiming or promising about AI if it took this constraint seriously',
        'Who has the most to lose if this constraint is formally acknowledged and acted on',
        'What this constraint is actually protecting that the organisation has avoided naming',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Ask where capability, trust, or adoption readiness is the most visible barrier — the specific gap between what AI would need people to do and what people can or will do today.',
      depth: 'Ask what the practical barrier to adoption is — not the general change concern, but the specific skill gap, fear, or behaviour that would cause AI to be misused, avoided, or undermined in practice.',
      edge: 'Ask what this organisation has quietly accepted about people\'s readiness because the real barrier is uncomfortable to name — the capability or trust issue the plan has worked around rather than addressed.',
    },
    Operations: {
      surface: 'Ask where the workflow is too exception-heavy, poorly structured, or dependent on human judgement for AI to work reliably — the specific process where AI would break down rather than add value.',
      depth: 'Ask what the practical impact of that workflow constraint is on AI feasibility — the specific use case that looks attractive but that would require so much exception handling that AI creates more work than it replaces.',
      edge: 'Ask which workflow is being treated as AI-ready when it is not — the process the plan has assumed AI can handle that hasn\'t been tested where exceptions are highest and structure is lowest.',
    },
    Technology: {
      surface: 'Ask where data quality, system integration, or platform limitation most clearly blocks AI feasibility — the specific gap between what the use case needs technically and what the current estate can provide.',
      depth: 'Ask what that technical gap costs in terms of what AI can or cannot do — the specific use case or quality level that cannot be achieved until the data, platform, or integration problem is resolved.',
      edge: 'Ask which technical dependency in the AI plan is being treated as solvable when it isn\'t yet — the data source, integration, or model requirement assumed to be available that has not been confirmed.',
    },
    Commercial: {
      surface: 'Ask where AI creates the most significant customer trust or service quality risk — the specific interaction where an AI error or limitation would damage the relationship rather than improve it.',
      depth: 'Ask what a customer would need to be true about AI use before they would trust it — the specific assurance, transparency, or quality standard that determines whether AI strengthens or weakens the commercial relationship.',
      edge: 'Ask what this company is quietly overstating about AI\'s readiness for customer-facing use — the capability claim being made to customers or the market that the current state of data, tooling, or validation cannot yet support.',
    },
    'Risk/Compliance': {
      surface: 'Ask where governance, regulatory requirements, or approval processes are most likely to block or delay AI deployment — the specific policy, control requirement, or approval step that applies to the intended use case.',
      depth: 'Ask what would need to change in the governance framework for AI to be deployable in the planned scope — the assurance requirement, accountability structure, or audit trail that doesn\'t yet exist but that policy or regulation will require.',
      edge: 'Ask what AI risk this company is privately carrying by moving forward without the governance position being clear — the accountability gap or regulatory exposure that exists if something goes wrong with a use case that hasn\'t been formally approved.',
    },
    Partners: {
      surface: 'Ask where vendor dependency, platform lock-in, or third-party data creates the most significant AI feasibility risk — the external dependency that implementation relies on but isn\'t fully within this company\'s control.',
      depth: 'Ask what the practical impact is if that external dependency doesn\'t perform as expected — the specific part of the AI use case that fails if the vendor, platform, or data source is unavailable, changed, or more expensive than planned.',
      edge: 'Ask which external dependency is being treated as lower risk than it is — the vendor commitment or platform capability the AI plan depends on that hasn\'t been tested under real operating conditions.',
    },
  },
};

const CONSTRAINTS_FINANCE: PhaseQuestionContract = {
  phase: 'CONSTRAINTS',
  workshopType: 'FINANCE',
  customerAnchor: 'the clients or stakeholders whose work this company performs or manages',
  subActorGuidance: 'Seed prompts should surface which specific roles — finance leads, commercial owners, operational managers — most directly feel the value leakage and what it forces them to absorb or work around.',
  phaseFocus: 'Map the decisions, workflow waste, weak-fit work, controls, and dependencies that drive value leakage today. Work from where economics are most visibly poor to the structural causes keeping them that way.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Make the value leakage visible — where does this constraint most clearly show up in how effort converts into value or where cost-to-serve is highest?',
      promptIntents: [
        'The specific work type, decision, or process where this constraint most clearly destroys value or inflates cost',
        'Whether the financial impact, the operational burden, or the customer consequence is most visible',
        'How frequently and clearly this constraint surfaces in the numbers or in the day-to-day work',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the constraint real and specific — what actually drives this cost or leakage, who owns it, and why does it persist? Use observable decisions and behaviour, not financial abstraction.',
      promptIntents: [
        'What it looks like in practice when this constraint surfaces — who is involved and what they must do because of it',
        'What other parts of the business depend on this constraint remaining as it is',
        'Where this leakage has got worse or better recently and what caused that',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface what this constraint is actually protecting, or what the business has quietly accepted as unavoidable — use consequence or pressure question shapes.',
      promptIntents: [
        'What the business would have to stop doing or formally reassess to remove this leakage',
        'Who has the most to lose if this cost or inefficiency is formally acknowledged and addressed',
        'What this constraint is actually protecting that has never been named as the real reason it persists',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Ask where decision quality, ownership gaps, or capability limitations are most visibly driving value leakage — the specific type of decision or ownership failure creating avoidable cost or waste.',
      depth: 'Ask what the practical cause of that pattern is — the specific incentive misalignment, capability gap, or clarity failure that would need to change for decisions to be made differently.',
      edge: 'Ask what this company has quietly accepted about how people make value-relevant decisions because the conversation about incentives or ownership would be uncomfortable — the pattern everyone recognises and that has never been formally addressed.',
    },
    Operations: {
      surface: 'Ask where operational flow most clearly drives avoidable cost — the specific rework type, delay category, or complexity source the business can observe consuming effort without creating value.',
      depth: 'Ask what the root cause of that operational cost is — the specific design decision, process step, or handoff structure that would need to change for the effort to stop being wasted.',
      edge: 'Ask which operational cost has been modelled as unavoidable when it is not — the rework, delay, or complexity accepted as the cost of doing business without formally testing whether a different design would remove it.',
    },
    Technology: {
      surface: 'Ask where a specific technology gap, manual workaround, or data problem is creating the most avoidable effort — the system failure, data quality issue, or missing automation consistently forcing people to redo or manually handle work.',
      depth: 'Ask what that technology cost means in terms of FTE effort, error rate, or throughput — the specific downstream value impact traceable to the technology gap, not a general efficiency concern.',
      edge: 'Ask which technology investment supposed to improve economics has instead added cost, complexity, or maintenance burden — the system consuming more than it saves that hasn\'t been formally reassessed.',
    },
    Commercial: {
      surface: 'Ask where the work mix, client portfolio, or commercial commitments most clearly show unattractive economics — the specific work type, client segment, or contract structure where cost-to-serve consistently erodes margin.',
      depth: 'Ask what keeps that weak-fit work in the business — the commercial commitment, relationship pressure, or revenue dependency preventing the business from stopping or repricing work that destroys value.',
      edge: 'Ask which commercial relationship this company has privately acknowledged as economically unattractive but continued anyway — the client or contract structure that has never been challenged because the exit conversation feels too risky.',
    },
    'Risk/Compliance': {
      surface: 'Ask where controls or approvals are most clearly creating cost drag without proportionate protection — the specific governance step whose overhead can be observed but whose risk management value is harder to justify.',
      depth: 'Ask what a proportionate version of that control would cost versus what the current version costs — the specific redesign that would preserve protection while removing avoidable overhead.',
      edge: 'Ask which governance requirement has been accepted as fixed when it isn\'t — the control or approval step that has never been reassessed because the question of proportionality requires someone in this room to own the conversation about acceptable risk.',
    },
    Partners: {
      surface: 'Ask where supplier, vendor, or outsourced relationships are most clearly creating avoidable cost or poor value conversion — the specific third-party arrangement whose economics are visible but haven\'t been formally challenged.',
      depth: 'Ask what keeps that external cost in place — the contractual commitment, capability dependency, or relationship protection preventing renegotiation or insourcing despite the economics being clear.',
      edge: 'Ask which external dependency has been modelled as value-creating when the evidence no longer supports that — the supplier or outsourced arrangement that made sense when established but that hasn\'t been formally reassessed against current cost and quality reality.',
    },
  },
};

const CONSTRAINTS_GTM: PhaseQuestionContract = {
  phase: 'CONSTRAINTS',
  workshopType: 'GO_TO_MARKET',
  customerAnchor: 'the buyers this company most wants to win',
  subActorGuidance: 'Seed prompts should identify which commercial roles (sales, presales, commercial leadership) feel the constraint most and how it shows up in live deals or positioning.',
  phaseFocus: 'Map what stands between this company\'s current proposition and the market-level vision — in live deals, in positioning, in how buyers experience the commercial process.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Make the GTM constraint visible — where does this limitation show up in how buyers experience the proposition or how deals progress?',
      promptIntents: [
        'The specific point in the deal cycle or buyer journey where this constraint surfaces',
        'Whether buyers or the internal team feel it first — and what it looks like for each',
        'How often this constraint forces a reshape, a delay, or a qualification loss',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Make the constraint observable in a live situation — what actually happens, who is involved, and what must be done because of it. Do not ask "what does it look like" generically — name the specific type of failure this lens creates.',
      promptIntents: [
        'What the specific breakdown looks like when this constraint surfaces in a real pursuit or conversation',
        'What internal dependencies keep this constraint in place',
        'Where this constraint has gotten materially worse or better recently',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Force the trade-off or consequence question — what is this protecting, or what does keeping it cost the proposition? Use pressure or consequence shapes. Do NOT reuse "what is it actually protecting" as a template.',
      promptIntents: [
        'What the proposition would have to fundamentally change or stop doing to remove this constraint',
        'Who internally has the most to lose if this constraint is removed',
        'What has stopped this from being resolved every time it has been raised',
      ],
    },
  ],
  lensSpecificGuidance: {
    'Risk/Compliance': {
      surface: 'Ask what gets EXCLUDED from the proposition because of regulatory exposure — not a general compliance challenge, but the specific promise that cannot be made or the specific buyer segment that cannot be pursued.',
      depth: 'Ask what a buyer must accept, qualify, or sign off on because of Capita\'s regulatory position — the specific friction point in the deal, not a generic compliance burden.',
      edge: 'Ask what Capita would have to stop promising entirely if it took this constraint seriously — the specific commitment that\'s being quietly overstated or left ambiguous.',
    },
    'Partners': {
      surface: 'Ask which part of the proposition Capita cannot deliver alone and where that dependency first becomes visible or uncomfortable in a buyer conversation.',
      depth: 'Ask what happens when a partner fails to perform or limits what Capita can guarantee — the specific accountability gap that surfaces in a live deal when Capita cannot answer for a third party.',
      edge: 'Ask what Capita would have to sacrifice in its partner model to truly own the proposition — what is being protected in the ecosystem that limits differentiation.',
    },
    'Technology': {
      surface: 'Ask what Capita can demonstrate versus what it is claiming — where the technology estate limits the credibility of the proposition in front of a buyer, not generically but at a specific moment.',
      depth: 'Ask what a specific technology gap or integration complexity means for what Capita can realistically offer in a live deal — the commitment that becomes harder to honour once the buyer understands the estate.',
      edge: 'Ask what in Capita\'s technology estate would need to be abandoned or replaced before the proposition could scale — what has been left unresolved because the cost of resolving it has been avoided.',
    },
    'Operations': {
      surface: 'Ask where Capita\'s delivery model diverges from the proposition scope — the specific place where what has been sold cannot be operationalised as promised.',
      depth: 'Ask what operational failure or handoff breakdown a buyer eventually discovers — the specific post-sale gap that undermines the proposition and damages renewal or expansion.',
      edge: 'Ask which operational structure is being kept in place even though it limits what can be offered — the model that nobody has publicly challenged because changing it would be disruptive.',
    },
    'Commercial': {
      surface: 'Ask where Capita\'s pricing, packaging, or contract structure makes the proposition harder to position — the specific commercial friction that appears in the GTM motion, not a generic commercial challenge.',
      depth: 'Ask what in the commercial model causes a buyer to question the value claim — the specific point in a live deal where the numbers, terms, or structure create doubt rather than confidence.',
      edge: 'Ask which part of Capita\'s commercial model has become a liability — where the pricing or contract structure actively works against the proposition it is supposed to support.',
    },
    'People': {
      surface: 'Ask where Capita\'s people capability creates a gap between how the proposition is positioned and how buyers actually experience it — the specific conversation that doesn\'t go the way it should.',
      depth: 'Ask what a buyer sees in a live deal when Capita\'s people cannot credibly deliver the proposition — the specific moment that shifts buyer confidence, not a general capability concern.',
      edge: 'Ask what Capita\'s people have privately accepted as their ceiling — the capability limitation that has never been publicly named and that the proposition is quietly written around.',
    },
  },
};

// ══════════════════════════════════════════════════════════════
// DEFINE_APPROACH CONTRACTS
// Practical path from today to the vision.
// Works from concrete first step → conditions for success → failure modes.
// ══════════════════════════════════════════════════════════════

const DEFINE_APPROACH_DEFAULT: PhaseQuestionContract = {
  phase: 'DEFINE_APPROACH',
  workshopType: 'DEFAULT',
  customerAnchor: 'the people who use, depend on, or are served by this operation',
  subActorGuidance: 'Seed prompts should identify which specific sub-actors move first, what they do differently, and where the approach depends on their behaviour changing.',
  phaseFocus: 'Build the practical path from today to the vision through this lens. Start with what exists and what moves first — build outward to conditions for success and honest failure modes.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Identify the first concrete, real-world step — what exists today that gives this approach a foothold?',
      promptIntents: [
        'Where something like this already works, even partially, in this company today',
        'What the smallest viable version of this approach looks like in practice for real people doing the work',
        'Who needs to move first and what they would actually do differently from tomorrow',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Get specific about what needs to already be working — who or what moves first, what the sequence looks like, and what early signal tells us this is working. Avoid "conditions must be true" language. Use grounding or accountability question shapes.',
      promptIntents: [
        'What has to change in how people work together, hand off, or make decisions for this to stick',
        'What the sequence of change looks like — what enables what, and what can\'t happen until something else does',
        'What evidence within the first 90 days would tell us this is working before we\'ve seen the full outcome',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface where this approach will quietly stall — the failure mode nobody is naming. Use consequence or pressure question shapes. Do NOT ask "what potential resistance might arise" or "what conditions must be true".',
      promptIntents: [
        'Where this approach will hit its hardest resistance and what form that resistance will take',
        'What the slow failure mode looks like — the version that fails quietly rather than visibly',
        'What we\'re avoiding saying about this approach that would make it more honest and more likely to succeed',
      ],
    },
  ],
};

const DEFINE_APPROACH_TRANSFORMATION: PhaseQuestionContract = {
  phase: 'DEFINE_APPROACH',
  workshopType: 'TRANSFORMATION',
  customerAnchor: 'the people who depend on or are served by this organisation',
  subActorGuidance: 'Seed prompts should surface which specific roles move first, what they do differently, and where the approach depends on their behaviour and decisions changing.',
  phaseFocus: 'Build the practical transformation path from today toward the future state. Start with what exists and what changes first — build outward to sequencing, dependency logic, and honest failure modes.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Identify the first concrete change — not a programme or workstream, but the specific thing that is different from next week in how this organisation operates.',
      promptIntents: [
        'Where something like this already exists or works, even partially, in this organisation today',
        'What the first visible change looks like for the people doing the work — not the plan, the behaviour',
        'Who moves first and what they do differently — a specific action, not a role',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Force the question of what must be proven, stopped, or decided for this to be executable — not what changes are needed generically, but what specific commitment cannot be avoided.',
      promptIntents: [
        'What must change in how decisions are made, work is handed off, or accountability sits for this to stick',
        'What the sequence of change looks like — what enables what, and what cannot happen until something else does',
        'What early signal within 90 days would tell us this is working before the full outcome is visible',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface where this approach will quietly fail — the failure mode nobody is naming. Do NOT use generic drift or stall language — name the specific failure type for this lens.',
      promptIntents: [
        'Where this approach hits its hardest resistance and what form that resistance takes',
        'What the slow failure mode looks like — the version that fails quietly rather than visibly',
        'What is being avoided in this room that would make the approach more honest and more likely to work',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Ask what the first visible behaviour change looks like — not a training programme or communications plan, but the specific thing a person in the target model does in week one that they are not doing today.',
      depth: 'Ask who must change first for the transformation to be credible — and what that person or team would need to stop doing, not just start doing, for the change to be real.',
      edge: 'Ask where this people approach will quietly fail — who reverts to the old model when pressure increases, and what the organisation quietly tolerates that makes the reversion easier than the change.',
    },
    Operations: {
      surface: 'Ask what operational change must happen first before anything else in the transformation can work — the single step in the operating model that unlocks the rest, not the first item on a workstream plan.',
      depth: 'Ask what breaks in the operation if the transformation launches but the underlying model hasn\'t changed — the specific failure point that emerges when new intent meets an unchanged process.',
      edge: 'Ask which operational structure is being preserved even though it limits what the transformation can achieve — what nobody has named as needing to go because removing it would be disruptive to people in this room.',
    },
    Technology: {
      surface: 'Ask what must be proven technically before the transformation approach can be committed to — the specific capability or integration being treated as given that hasn\'t been demonstrated in the target environment.',
      depth: 'Ask what technical decision has been deferred that the transformation depends on — the platform choice, architecture commitment, or data migration that cannot be avoided indefinitely and that shapes the whole sequencing.',
      edge: 'Ask which technical assumption will not hold at scale — the thing being prototyped at small scope that the plan assumes will work everywhere, but that hasn\'t been tested where the risk is highest.',
    },
    Commercial: {
      surface: 'Ask what the first customer-visible signal of transformation success looks like — the specific thing a customer experiences differently that marks the point where the transformation has started to land.',
      depth: 'Ask which customer relationship or expectation must be managed differently as the transformation progresses — the conversation that hasn\'t happened yet but will need to.',
      edge: 'Ask what the transformation quietly risks commercially if it takes longer than promised — the customer outcome being held together by current effort that would become visible if the change slows.',
    },
    'Risk/Compliance': {
      surface: 'Ask what governance position must be established before the transformation can proceed at pace — the specific approval, sign-off, or assurance step that unlocks the approach rather than gates it indefinitely.',
      depth: 'Ask what the organisation must stop requiring as an assurance condition for the transformation to move — the control or approval step designed for the old model that the new model cannot operate with.',
      edge: 'Ask what risk the transformation is silently accepting by not resolving the governance position now — the exposure growing with each delay that nobody in this room has formally acknowledged.',
    },
    Partners: {
      surface: 'Ask which external dependency must be resolved or renegotiated before the transformation is truly deliverable — the third-party commitment the plan relies on that has not been confirmed.',
      depth: 'Ask what this company gives up control of by depending on partners for this stage of the transformation — the accountability gap that will surface when a partner\'s performance falls short and the business cannot fully answer for it.',
      edge: 'Ask what the transformation quietly concedes by keeping the current partner model in place — what would be genuinely different about the outcome if this company owned this capability rather than sourcing it.',
    },
  },
};

const DEFINE_APPROACH_OPERATIONS: PhaseQuestionContract = {
  phase: 'DEFINE_APPROACH',
  workshopType: 'OPERATIONS',
  customerAnchor: 'the people who use or depend on this service or operation',
  subActorGuidance: 'Seed prompts should surface which specific roles or teams move first, what changes in how they handle work, and where the approach depends on their behaviour changing in practice.',
  phaseFocus: 'Build the practical operational improvement path from today. Start with the specific change that unlocks the most value — build outward to what must change in sequence, what breaks if it doesn\'t, and where this approach quietly stalls.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Identify the single operational change that enables the most — not the whole improvement agenda, but the specific bottleneck or flow failure that, if fixed, releases the most downstream value.',
      promptIntents: [
        'Where a version of this improvement already exists or has been tried, even partially, in this operation today',
        'What the first observable change in how work is done looks like for the people closest to it',
        'Who must act first and what they do differently — a specific action, not a workstream',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Force the question of what must be confirmed, stopped, or restructured for this to be executable — not what changes are needed broadly, but what specific dependency cannot be avoided.',
      promptIntents: [
        'What must change in how people work together, hand off, or make decisions for this to stick in practice',
        'What breaks in the operation if this approach is adopted but the upstream or downstream dependencies haven\'t changed',
        'What early signal within 60-90 days would tell us this is working before the full improvement is visible',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface where this approach will quietly get absorbed back into the old pattern — the failure mode nobody is naming. Name the specific form of failure for this lens.',
      promptIntents: [
        'Where this approach hits its hardest resistance and what form that resistance takes in practice',
        'What the slow failure mode looks like — the version that fails quietly rather than visibly',
        'What the room is avoiding saying about this approach that would make it more honest and more likely to hold',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Ask what the first observable change in how work is done looks like — not a new role or structure, but a specific behaviour or handoff that happens differently from next week, visible to the people doing it.',
      depth: 'Ask who must work differently for this operational approach to stick — and what they would need to stop doing, not just start doing, for the change to be real and not just a redesign on paper.',
      edge: 'Ask where this change will quietly get absorbed back into the old pattern — who reverts when there is pressure, and what the operation allows that makes the reversion easier than the new approach.',
    },
    Operations: {
      surface: 'Ask what the single operational change that enables the most other things is — the one bottleneck that, if fixed, releases the most downstream value before anything else changes.',
      depth: 'Ask what breaks in the operation if this approach is adopted but the upstream or downstream dependencies haven\'t changed — the failure point that emerges when the fixed piece meets an unchanged process on either side.',
      edge: 'Ask which structural arrangement is being preserved even though it limits what this approach can achieve — what the improvement plan quietly works around because removing it requires a conversation nobody in this room wants to have.',
    },
    Technology: {
      surface: 'Ask what must be in place technically before this operational approach is reliable — the specific tool, data feed, or system configuration the improvement depends on that isn\'t yet confirmed as ready.',
      depth: 'Ask what the technology approach must stop relying on manually for this to scale — the specific workaround or manual step acceptable in a pilot that would become the failure point at volume.',
      edge: 'Ask which technology assumption in the improvement plan hasn\'t been tested at the scale where it matters — the capability being treated as given that hasn\'t been stress-tested in the real operational environment.',
    },
    Commercial: {
      surface: 'Ask what the first customer-visible improvement looks like — the specific service moment that changes for a customer because the operation has changed, not a metric that improves in a report.',
      depth: 'Ask which customer expectation the operational improvement must address first — the specific promise or experience that will fail again if this approach doesn\'t hold.',
      edge: 'Ask what the operation quietly risks if this improvement plan runs late or stalls — the customer outcome being held together by current workaround effort that becomes visible the moment focus shifts.',
    },
    'Risk/Compliance': {
      surface: 'Ask what control or compliance position must be confirmed before this approach can be operated at scale — the governance requirement that could stop the improvement if not resolved before rollout.',
      depth: 'Ask what the operation must stop requiring as a control condition for this approach to run at the intended pace — the approval step or oversight requirement designed for the old way of working that would slow the new approach to failure.',
      edge: 'Ask what risk is quietly being accepted by not resolving the governance position before this launches — the exposure growing with each delay that nobody in this room has formally acknowledged as belonging to someone.',
    },
    Partners: {
      surface: 'Ask which external dependency must be confirmed as ready before this operational approach is reliable — the partner or supplier commitment the improvement depends on that hasn\'t yet been tested in practice.',
      depth: 'Ask what accountability gap this approach creates with the most critical external partner — the point where the improved operation will depend on a third party in a way this company cannot currently guarantee.',
      edge: 'Ask what the operation quietly sacrifices in control or quality by relying on the current partner model for this improvement — what would be more reliable or more improvable if this company owned this capability rather than depending on someone else.',
    },
  },
};

const DEFINE_APPROACH_AI: PhaseQuestionContract = {
  phase: 'DEFINE_APPROACH',
  workshopType: 'AI',
  customerAnchor: 'the people who use or are served by this work',
  subActorGuidance: 'Seed prompts should surface which specific roles use the AI capability first, what changes in how they work, and where the approach depends on adoption, data readiness, or governance being in place.',
  phaseFocus: 'Build the practical AI implementation path from today. Start with the right first use case and the first real capability — build outward to what must change for AI to be integrated, not just added, and where this approach quietly fails.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Identify the right starting point — not the most impressive AI use case, but the one where AI makes the clearest practical difference with the fewest dependencies and the least exception handling.',
      promptIntents: [
        'Where a version of AI or automation is already working, even partially, in this organisation today',
        'What the first practical AI capability people would actually use looks like — a real tool, a real task, a real person',
        'Who uses it first and what they do differently — a specific action, not a deployment',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Force the question of what must change in data, workflow, governance, or adoption for AI to be integrated rather than added alongside the existing way of working.',
      promptIntents: [
        'What must change in how work flows, decisions are made, or handoffs happen for AI to function as intended',
        'What the sequence of enablement looks like — what must be in place before the use case can be trusted at volume',
        'What early signal within 60-90 days would tell us AI is being genuinely adopted rather than quietly bypassed',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface where this AI approach will quietly degrade or fail — the exception type, volume spike, or adoption gap nobody is naming. Name the specific failure for this lens.',
      promptIntents: [
        'Where this approach hits its hardest resistance and what form that resistance takes in practice',
        'What the quiet failure mode looks like — the version where AI is bypassed or produces poor output without being caught',
        'What the room is avoiding saying about this approach that would make it more honest and more likely to hold',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Ask what the first practical AI capability people will actually use looks like — not a platform deployment or a training programme, but the specific tool or feature a real person uses in their work.',
      depth: 'Ask what people must stop doing manually for this AI approach to be adopted — the specific habit or workaround that must end for AI to be used as intended rather than alongside the old way of working.',
      edge: 'Ask where this AI adoption will quietly fail — which teams or roles will route around it when it\'s inconvenient, and what the organisation will allow that makes the detour easier than using AI properly.',
    },
    Operations: {
      surface: 'Ask which use case is the right starting point — not the most technically impressive, but the one where AI makes the clearest practical difference with the fewest dependencies and the least exception handling.',
      depth: 'Ask what must change in the workflow for AI to be integrated rather than added on — the specific process redesign or decision structure required for AI to work as intended rather than sit alongside the existing process.',
      edge: 'Ask where this AI workflow approach will quietly degrade — the exception type or volume spike the design hasn\'t accounted for that will cause AI to produce poor output or get bypassed when it matters most.',
    },
    Technology: {
      surface: 'Ask what must be demonstrated in a real environment before this AI approach can be committed to at scale — the specific technical proof point that turns a feasibility assumption into confirmed capability.',
      depth: 'Ask what the technical approach must get right about data quality, model reliability, or integration before the use case can be considered production-ready — the specific standard that must be met for this to be trusted at volume.',
      edge: 'Ask which technical assumption will not hold at the scale or complexity where the use case actually matters — the design choice that works in a controlled pilot but hasn\'t been tested under real conditions.',
    },
    Commercial: {
      surface: 'Ask what the first customer-visible AI improvement looks like — the specific interaction or service moment that a customer experiences differently because AI is now part of the process.',
      depth: 'Ask what assurance or transparency the approach must provide to customers about AI use — the specific commitment that determines whether customers trust the AI-enabled service or remain uncertain.',
      edge: 'Ask what this approach quietly risks commercially if AI fails or underperforms in a customer-facing situation — the trust or service quality consequence that hasn\'t been fully modelled in the implementation plan.',
    },
    'Risk/Compliance': {
      surface: 'Ask what governance position must be established before the first AI use case can be deployed — the specific approval, policy determination, or accountability framework that must be in place before any live deployment.',
      depth: 'Ask what the AI approach must build into its design to be auditable, accountable, and recoverable if it produces a wrong output — the specific control mechanism that makes AI use acceptable to governance.',
      edge: 'Ask what governance risk the AI plan is privately accepting by not resolving this now — the exposure that grows as deployment scope increases and that will be much harder to manage after deployment than before it.',
    },
    Partners: {
      surface: 'Ask which external platform or vendor capability is essential for this approach and what must be confirmed about its performance before commitment — the dependency currently assumed rather than tested.',
      depth: 'Ask what this company gives up by depending on a vendor for the core AI capability — the specific control, adaptability, or accountability that would be stronger if the capability were internally owned.',
      edge: 'Ask which vendor dependency creates the most lock-in or the least flexibility — what this company quietly sacrifices in adaptability or cost control by committing to this external platform at this stage.',
    },
  },
};

const DEFINE_APPROACH_FINANCE: PhaseQuestionContract = {
  phase: 'DEFINE_APPROACH',
  workshopType: 'FINANCE',
  customerAnchor: 'the clients or stakeholders whose work this company performs or manages',
  subActorGuidance: 'Seed prompts should surface which specific roles — commercial owners, operations leads, finance managers — move first, and where the approach depends on their decisions and behaviours changing.',
  phaseFocus: 'Build the practical value improvement path from today. Start with the highest-impact leakage to address first — build outward to sequencing, what breaks if the underlying model doesn\'t change, and where this approach quietly transfers cost rather than removes it.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Identify the highest-impact leakage to address first — the specific cost source, work type, or decision pattern that, if changed, would release the most value before anything else shifts.',
      promptIntents: [
        'Where something like this has already been improved, even partially, in this organisation today',
        'What the first visible change in how value is managed or decisions are made looks like for the people closest to it',
        'Who moves first and what they do differently — a specific decision or action, not a programme',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Force the question of what must change in commercial model, process design, or governance for value improvement to hold — not what needs to be better broadly, but what specific commitment cannot be avoided.',
      promptIntents: [
        'What must change in how work is selected, priced, or handed off for the economics to improve sustainably',
        'What breaks if value improvement is applied without changing the underlying model that creates the leakage',
        'What early signal within 90 days would tell us value is genuinely improving before the full financial outcome is visible',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface where this approach quietly transfers cost rather than removes it — the failure mode nobody is naming. Name the specific failure type for this lens.',
      promptIntents: [
        'Where this approach hits its hardest resistance and what form that resistance takes',
        'What the slow failure mode looks like — the version where cost moves rather than disappears',
        'What the room is avoiding saying about this approach that would make it more honest and more likely to improve economics rather than just shift where the burden sits',
      ],
    },
  ],
  lensSpecificGuidance: {
    People: {
      surface: 'Ask what the first visible change in how people make value-relevant decisions looks like — not a new governance process, but the specific decision that happens differently next week because ownership or incentive has changed.',
      depth: 'Ask who must change how they make decisions for this value improvement approach to hold — and what they would need to stop doing, not just start doing, for the change to be real.',
      edge: 'Ask where this approach to changing decision quality will quietly fail — who reverts to the old pattern under pressure, and what the organisation tolerates that makes the old behaviour easier than the new one.',
    },
    Operations: {
      surface: 'Ask what the single operational change that would have the most immediate impact on cost-to-serve is — the specific process, handoff, or rework type that, if fixed, releases the most value before anything else changes.',
      depth: 'Ask what breaks in the operation if cost-to-serve is reduced without changing the underlying model — the service failure or quality loss that emerges when effort is removed from a process relying on that effort to compensate for a structural flaw.',
      edge: 'Ask which cost reduction plan will quietly transfer the cost rather than remove it — the efficiency move that looks like a saving at the point of measurement but creates effort or failure elsewhere in the system.',
    },
    Technology: {
      surface: 'Ask what must be in place technically before the value improvement plan is reliable — the specific automation, data quality standard, or system fix the approach depends on that isn\'t yet confirmed as delivered.',
      depth: 'Ask what manual effort or workaround the technology approach must eliminate for the improvement to hold at scale — the specific compensating behaviour acceptable in a pilot that would reintroduce cost at volume.',
      edge: 'Ask which technology assumption in the value improvement plan hasn\'t been tested at operating scale — the capability being counted on in the financial model that hasn\'t been confirmed under real conditions.',
    },
    Commercial: {
      surface: 'Ask what the first change to the work mix or commercial model looks like in practice — the specific type of work that stops being accepted, the client conversation that happens differently, or the pricing decision that changes.',
      depth: 'Ask which commercial conversation must happen that hasn\'t happened yet — the client discussion, repricing, or scope renegotiation the improvement depends on but that the business has been avoiding.',
      edge: 'Ask what this company quietly risks commercially by making the first value improvement move — the client relationship or revenue line that could be affected and that hasn\'t been fully modelled as a consequence of the approach.',
    },
    'Risk/Compliance': {
      surface: 'Ask what governance or control change must happen before this approach can be operationalised — the specific approval, policy determination, or accountability structure that must be in place for the approach to run at scale.',
      depth: 'Ask what the organisation must stop requiring as a control condition for this value improvement to work — the approval step or oversight requirement whose removal is necessary for the improvement to run at pace without reverting.',
      edge: 'Ask what financial risk is quietly being accepted by making this change without formally resolving the governance position — the exposure growing as the approach scales that nobody in this room has yet formally acknowledged as belonging to someone.',
    },
    Partners: {
      surface: 'Ask which external relationship must be renegotiated or changed before this value improvement is achievable — the supplier, vendor, or outsourced arrangement the improvement depends on that hasn\'t yet been committed or tested.',
      depth: 'Ask what this company gives up in control or quality by keeping the current external model in place during the improvement — the accountability gap that will emerge when a partner\'s cost or performance falls short of what the plan assumes.',
      edge: 'Ask what the value improvement approach quietly sacrifices by not resolving the most expensive external dependency now — what would be genuinely different about the economics if this company owned or renegotiated this at the start rather than after the first results are in.',
    },
  },
};

const DEFINE_APPROACH_GTM: PhaseQuestionContract = {
  phase: 'DEFINE_APPROACH',
  workshopType: 'GO_TO_MARKET',
  customerAnchor: 'the buyers this company most wants to win',
  subActorGuidance: 'Seed prompts should identify which commercial roles move first, what changes in how they engage buyers, and where the approach depends on internal alignment.',
  phaseFocus: 'Build the practical go-to-market path from today toward the market vision. Start with what exists commercially and what the commercial team does differently first.',
  depthLevels: [
    {
      depth: 'surface',
      questionIntent: 'Identify the first concrete, real-world step — what already exists today that gives this approach a foothold? Do NOT ask "what existing practices" — ask what happens first.',
      promptIntents: [
        'Where a version of this approach is already working, even partially, in a live deal or conversation today',
        'What the smallest viable version looks like in practice for the team doing the work tomorrow',
        'Who moves first and what they do differently — not a programme, a specific action',
      ],
    },
    {
      depth: 'depth',
      questionIntent: 'Force the question of what must be PROVEN or STOPPED for this to be executable — not what changes are needed generically, but what specific decision cannot be avoided.',
      promptIntents: [
        'What must change in how people work together, hand off, or make decisions for this to stick',
        'What the sequence of change looks like — what enables what, and what cannot happen until something else does',
        'What early signal within 60-90 days would tell us this is working before the full outcome is visible',
      ],
    },
    {
      depth: 'edge',
      questionIntent: 'Surface where this approach will quietly fail — the mode nobody is naming. Do NOT ask "where might this drift or stall" generically — name the specific failure type for this lens.',
      promptIntents: [
        'Where this approach hits its hardest resistance and what form that resistance takes',
        'What the slow failure mode looks like — the version that fails quietly rather than visibly',
        'What is being avoided in this room that would make the approach more honest and more likely to work',
      ],
    },
  ],
  lensSpecificGuidance: {
    'People': {
      surface: 'Ask what the first VISIBLE behaviour change looks like — not a plan or initiative, but a specific conversation that happens differently this week. Force the room to name a person and an action, not a programme.',
      depth: 'Ask what people must STOP doing to make space for this approach — not what must change broadly, but what specific habit or practice must end for this to be credible.',
      edge: 'Ask where this people approach will quietly get deprioritised — who reverts first and why the organisation allows it, not where it might stall generically.',
    },
    'Operations': {
      surface: 'Ask what operational change MUST happen first before anything else can work — the single unlocking step in the delivery model, not the first item on a roadmap.',
      depth: 'Ask what breaks in the operation if this approach is adopted but delivery hasn\'t changed — the specific failure point that emerges when a promise meets an unchanged process.',
      edge: 'Ask which operational structure will prevent this approach from scaling — what nobody has been willing to say needs to go because removing it would be disruptive to people in the room.',
    },
    'Technology': {
      surface: 'Ask what must be demonstrated in a live environment before the proposition can be credibly made — the specific technical proof point that turns a claim into evidence.',
      depth: 'Ask what technical commitment Capita must make that it has not yet made — the decision being avoided that the technology approach actually depends on.',
      edge: 'Ask where the technology dependency quietly becomes untenable at scale — what is being assumed about capability or integration that will not hold when deal volume or complexity increases.',
    },
    'Commercial': {
      surface: 'Ask what the first commercial WIN under the new approach looks like — not a deal type, but a specific buyer conversation that goes differently. What does a buyer say or do that doesn\'t happen today?',
      depth: 'Ask what the commercial model must stop doing to support the proposition — which existing commercial habit (pricing method, contract term, incentive structure) undermines the new approach.',
      edge: 'Ask what the buyer doubts about this commercial approach when they try to justify it internally — the specific point where the value claim does not survive scrutiny in the buyer\'s own organisation.',
    },
    'Risk/Compliance': {
      surface: 'Ask what compliance position must be established BEFORE the proposition can be made at scale — the specific regulatory proof point that unlocks the approach rather than blocking it.',
      depth: 'Ask what Capita is privately limiting in the proposition because the compliance position is not resolved — the specific exclusion or caveat that nobody has named but that buyers will eventually find.',
      edge: 'Ask what this compliance approach makes worse for buyers who need certainty — what is being sacrificed in the name of risk management that buyers would trade for a different offer entirely.',
    },
    'Partners': {
      surface: 'Ask which specific partner dependency must be resolved before the proposition is truly ownable — the third-party reliance that limits what can be promised, not partnerships generically.',
      depth: 'Ask what Capita gives up control of when it depends on partners — the specific accountability gap that a buyer will eventually discover and that Capita cannot fully answer for.',
      edge: 'Ask what Capita quietly sacrifices in proposition differentiation by relying on partners — what would be genuinely different if Capita owned this capability rather than sourcing it.',
    },
  },
};

// ══════════════════════════════════════════════════════════════
// CONTRACT REGISTRY
// ══════════════════════════════════════════════════════════════

/**
 * All available phase contracts, indexed by phase + workshop type.
 * Contracts not explicitly defined fall back to DEFAULT.
 */
const CONTRACT_REGISTRY: PhaseQuestionContract[] = [
  // REIMAGINE
  REIMAGINE_DEFAULT,
  REIMAGINE_GTM,
  REIMAGINE_TRANSFORMATION,
  REIMAGINE_OPERATIONS,
  REIMAGINE_AI,
  REIMAGINE_FINANCE,
  // CONSTRAINTS
  CONSTRAINTS_DEFAULT,
  CONSTRAINTS_GTM,
  CONSTRAINTS_TRANSFORMATION,
  CONSTRAINTS_OPERATIONS,
  CONSTRAINTS_AI,
  CONSTRAINTS_FINANCE,
  // DEFINE_APPROACH
  DEFINE_APPROACH_DEFAULT,
  DEFINE_APPROACH_GTM,
  DEFINE_APPROACH_TRANSFORMATION,
  DEFINE_APPROACH_OPERATIONS,
  DEFINE_APPROACH_AI,
  DEFINE_APPROACH_FINANCE,
];

/**
 * Retrieve the contract for a given phase and workshop type.
 * Falls back to DEFAULT if no specific contract exists for the workshop type.
 */
export function getQuestionContract(
  phase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH',
  workshopType: CanonicalWorkshopType | null | undefined,
): PhaseQuestionContract {
  const normalised = workshopType ?? 'DEFAULT';

  // Try exact match first
  const exact = CONTRACT_REGISTRY.find(
    (c) => c.phase === phase && c.workshopType === normalised,
  );
  if (exact) return exact;

  // Fall back to DEFAULT for this phase
  const fallback = CONTRACT_REGISTRY.find(
    (c) => c.phase === phase && c.workshopType === 'DEFAULT',
  );
  if (fallback) return fallback;

  throw new Error(`No question contract found for phase "${phase}" — this should never happen.`);
}

/**
 * Build a formatted contract block for inclusion in the LLM system prompt.
 * Describes exactly what to generate for each depth level for a given lens.
 */
export function buildLensContractBlock(
  contract: PhaseQuestionContract,
  lens: string,
  clientName: string,
  compact = false,
): string {
  function sub(s: string): string {
    return s.replace(/this company/g, clientName).replace(/this lens/g, lens);
  }

  // Use lens-specific intents when available — these override the generic questionIntent
  // and force each lens to introduce a distinct line of thinking.
  const lensGuidance = contract.lensSpecificGuidance?.[lens];

  if (compact) {
    const lines: string[] = [
      `[${lens}] Customer: ${sub(contract.customerAnchor)}`,
      `Sub-actors: ${sub(contract.subActorGuidance)}`,
      '',
    ];
    for (const slot of contract.depthLevels) {
      const intent = lensGuidance
        ? sub(lensGuidance[slot.depth])
        : sub(slot.questionIntent);
      lines.push(`  ${slot.depth.toUpperCase()}: ${intent}`);
      lines.push(`    Seeds: ${slot.promptIntents.map((p, i) => `(${i + 1}) ${sub(p)}`).join(' | ')}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  const lines: string[] = [
    `CONTRACT FOR LENS: ${lens}`,
    `Customer anchor: ${sub(contract.customerAnchor)}`,
    `Sub-actor guidance: ${sub(contract.subActorGuidance)}`,
    '',
    `Generate exactly 3 questions for ${lens} in this order:`,
    '',
  ];

  for (const slot of contract.depthLevels) {
    const intent = lensGuidance
      ? sub(lensGuidance[slot.depth])
      : sub(slot.questionIntent);
    lines.push(`[${slot.depth.toUpperCase()}]`);
    lines.push(`Purpose: ${intent}`);
    if (lensGuidance) {
      lines.push(`NOTE: This intent is specific to the ${lens} lens. Do NOT reuse this question shape for any other lens.`);
    }
    lines.push('Seed prompts must cover:');
    for (const [i, promptIntent] of slot.promptIntents.entries()) {
      lines.push(`  ${i + 1}. ${sub(promptIntent)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check whether a set of questions for a given lens has all three depth levels covered.
 * Returns the missing depth levels, or an empty array if complete.
 */
export function getMissingDepthLevels(
  questions: Array<{ depth?: string }>,
): DepthLevel[] {
  const required: DepthLevel[] = ['surface', 'depth', 'edge'];
  const present = new Set(questions.map((q) => q.depth).filter(Boolean));
  return required.filter((d) => !present.has(d));
}
