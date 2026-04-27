import type { CanonicalWorkshopType } from '@/lib/workshop/workshop-definition';
import type { CanonicalLensName } from '@/lib/workshop/canonical-lenses';

export type DiscoveryLensContract = {
  workshopType: CanonicalWorkshopType;
  stage: 'discovery';
  lens: CanonicalLensName;
  objective: string;
  requiredSignals: string[];
  evidenceRequirement: string;
  forbiddenDrift: string[];
  wordingRules: string[];
};

const GTM_DISCOVERY_CONTRACTS: Record<CanonicalLensName, DiscoveryLensContract> = {
  People: {
    workshopType: 'GO_TO_MARKET',
    stage: 'discovery',
    lens: 'People',
    objective: 'Reveal how people strengthen or weaken buyer trust, proposition credibility, and the ability to win the right work.',
    requiredSignals: ['win_pattern', 'loss_pattern', 'constraint', 'misalignment', 'differentiation'],
    evidenceRequirement: 'Force evidence from wins, losses, or live deals. The respondent must refer to real buyer interactions, pursuit behaviour, handoff reality, or deal outcomes.',
    forbiddenDrift: ['generic team capability diagnostics', 'internal HR framing', 'general morale questions without commercial consequence'],
    wordingRules: [
      'Ask about one signal only.',
      'Use market-facing language such as buyers, deals, positioning, proposition, trust, credibility, win, or loss.',
      'Do not ask broad people or culture questions without GTM consequence.',
    ],
  },
  Operations: {
    workshopType: 'GO_TO_MARKET',
    stage: 'discovery',
    lens: 'Operations',
    objective: 'Reveal where delivery capability supports or constrains what can be sold and where sold promises break in execution.',
    requiredSignals: ['constraint', 'misalignment', 'ICP', 'anti-ICP', 'fragility'],
    evidenceRequirement: 'Force evidence from won deals, lost deals, or live deals that show sold-versus-delivered reality.',
    forbiddenDrift: ['generic process maturity', 'internal efficiency-only wording', 'workflow diagnostics without commercial consequence'],
    wordingRules: [
      'Ask about one signal only.',
      'Use delivery-against-promise language, not abstract process language.',
      'Tie the question to deal quality, sellability, or client fit.',
    ],
  },
  Technology: {
    workshopType: 'GO_TO_MARKET',
    stage: 'discovery',
    lens: 'Technology',
    objective: 'Reveal where technology differentiates the proposition, where it is overstated, and where capability gaps weaken deals.',
    requiredSignals: ['differentiation', 'loss_pattern', 'anti-ICP', 'fragility', 'constraint'],
    evidenceRequirement: 'Force evidence from wins, losses, or live deals where technology influenced buyer confidence, proposition strength, or delivery credibility.',
    forbiddenDrift: ['generic system usability diagnostics', 'internal tooling maturity questions without market consequence'],
    wordingRules: [
      'Ask about one signal only.',
      'Use proposition, buyer, capability, weakness, differentiate, or promised capability language.',
      'Do not ask generic IT or platform questions detached from deal outcomes.',
    ],
  },
  Commercial: {
    workshopType: 'GO_TO_MARKET',
    stage: 'discovery',
    lens: 'Commercial',
    objective: 'Reveal ICP, anti-ICP, win/loss patterns, buyer value perception, and where the business wins work it should avoid.',
    requiredSignals: ['ICP', 'anti-ICP', 'win_pattern', 'loss_pattern', 'fragility'],
    evidenceRequirement: 'Force evidence from wins, losses, or live deals that discriminate between strong-fit and weak-fit clients or opportunities.',
    forbiddenDrift: ['generic customer experience questions', 'broad growth questions without deal evidence'],
    wordingRules: [
      'Ask about one signal only.',
      'Use win/loss, ICP, buyers, client patterns, proposition, or deal-quality language.',
      'Do not combine “who to win with” and “who to avoid” in the same question.',
    ],
  },
  Customer: {
    workshopType: 'GO_TO_MARKET',
    stage: 'discovery',
    lens: 'Customer',
    objective: 'Reveal how customers experience the business after the promise is made, where trust is won or lost, and what drives retention, expansion, or churn.',
    requiredSignals: ['retention_driver', 'trust_signal', 'journey_friction', 'expansion_opportunity', 'churn_risk'],
    evidenceRequirement: 'Force evidence from lived customer relationships, onboarding, renewals, service interactions, complaints, or expansion attempts that show what customers actually experience.',
    forbiddenDrift: ['generic brand awareness questions', 'broad market sizing', 'commercial pipeline questions without customer experience evidence'],
    wordingRules: [
      'Ask about one customer truth only.',
      'Use customer experience, trust, retention, onboarding, service reality, expansion, or churn language.',
      'Keep the question anchored in what customers experience after they buy, not just how the business sells.',
    ],
  },
  'Risk/Compliance': {
    workshopType: 'GO_TO_MARKET',
    stage: 'discovery',
    lens: 'Risk/Compliance',
    objective: 'Reveal where risk, compliance, procurement, approvals, or policy requirements change deal viability, speed, or proposition shape.',
    requiredSignals: ['constraint', 'anti-ICP', 'win_pattern', 'fragility'],
    evidenceRequirement: 'Force evidence from wins, losses, or live deals where approvals, procurement, risk, or compliance changed the commercial outcome.',
    forbiddenDrift: ['generic compliance maturity', 'internal policy questions without deal consequence'],
    wordingRules: [
      'Ask about one signal only.',
      'Use deal viability, speed, approval, procurement, tender, or proposition-distortion language.',
      'Do not ask broad control or governance questions without market consequence.',
    ],
  },
  Partners: {
    workshopType: 'GO_TO_MARKET',
    stage: 'discovery',
    lens: 'Partners',
    objective: 'Reveal where partners strengthen win probability or delivery confidence and where dependence on partners introduces fragility or deal risk.',
    requiredSignals: ['differentiation', 'loss_pattern', 'misalignment', 'anti-ICP', 'fragility'],
    evidenceRequirement: 'Force evidence from wins, losses, or live deals where partner capability, alignment, or dependency affected the outcome.',
    forbiddenDrift: ['generic supplier relationship questions', 'ecosystem questions without live deal consequence'],
    wordingRules: [
      'Ask about one signal only.',
      'Use partner capability, dependency, alignment, risk, or deal outcome language.',
      'Do not merge partner strength and partner risk into one question.',
    ],
  },
};

const TRANSFORMATION_DISCOVERY_CONTRACTS: Record<CanonicalLensName, DiscoveryLensContract> = {
  People: {
    workshopType: 'TRANSFORMATION',
    stage: 'discovery',
    lens: 'People',
    objective: 'Reveal where confidence, behaviour, capability, leadership credibility, or change fatigue will strengthen or weaken the move to the future state.',
    requiredSignals: ['change_readiness', 'credibility_gap', 'behavioural_friction', 'capability_gap', 'fatigue_risk'],
    evidenceRequirement: 'Force evidence from real change efforts, day-to-day behaviour, or observable patterns that show whether people will support, resist, or distort the target state.',
    forbiddenDrift: ['generic morale questions', 'broad culture diagnostics without change consequence', 'abstract people strategy questions'],
    wordingRules: [
      'Ask about one future-state blocker or enabler only.',
      'Use change, readiness, trust, behaviour, confidence, fatigue, leadership credibility, or capability language.',
      'Tie the question to whether the future state can land in practice.',
    ],
  },
  Operations: {
    workshopType: 'TRANSFORMATION',
    stage: 'discovery',
    lens: 'Operations',
    objective: 'Reveal where the current operating model, handoffs, decision flow, or service mechanics will prevent the future state from working.',
    requiredSignals: ['operating_model_gap', 'handoff_friction', 'decision_delay', 'execution_dependency', 'scaling_blocker'],
    evidenceRequirement: 'Force evidence from current workflows, operational breakdowns, or delivery patterns that show where the target model would fail or stall.',
    forbiddenDrift: ['generic process maturity', 'efficiency-only wording', 'operations questions detached from future-state consequence'],
    wordingRules: [
      'Ask about one current-to-future operating gap only.',
      'Use target state, handoff, decision flow, service model, operating model, or execution dependency language.',
      'Keep the question tied to what would stop the future state from working.',
    ],
  },
  Technology: {
    workshopType: 'TRANSFORMATION',
    stage: 'discovery',
    lens: 'Technology',
    objective: 'Reveal where current systems, data, architecture, or tooling will enable, delay, constrain, or undermine the target future state.',
    requiredSignals: ['architecture_constraint', 'data_gap', 'integration_dependency', 'technology_enabler', 'change_complexity'],
    evidenceRequirement: 'Force evidence from current platforms, integrations, workarounds, or change dependencies that show what technology will block or accelerate transformation.',
    forbiddenDrift: ['generic IT maturity', 'tool usability questions without future-state consequence'],
    wordingRules: [
      'Ask about one technology dependency or blocker only.',
      'Use platform, architecture, system, data, integration, tooling, or enablement language.',
      'Tie the question to whether the target model can be delivered with the current technology reality.',
    ],
  },
  Commercial: {
    workshopType: 'TRANSFORMATION',
    stage: 'discovery',
    lens: 'Commercial',
    objective: 'Reveal where customer promises, growth pressure, market expectations, or commercial commitments are forcing transformation or making the target state harder to land.',
    requiredSignals: ['market_pressure', 'promise_gap', 'customer_expectation_risk', 'growth_dependency', 'commercial_tradeoff'],
    evidenceRequirement: 'Force evidence from client expectations, promises made, retention or growth pressure, or market demands that shape the transformation case.',
    forbiddenDrift: ['generic customer satisfaction questions', 'broad growth questions with no transformation consequence'],
    wordingRules: [
      'Ask about one market or customer pressure only.',
      'Use promise, expectation, demand, growth pressure, customer reality, or commercial commitment language.',
      'Tie the question to why transformation is necessary or what it must protect.',
    ],
  },
  Customer: {
    workshopType: 'TRANSFORMATION',
    stage: 'discovery',
    lens: 'Customer',
    objective: 'Reveal where current customer journeys, service reality, or trust gaps are forcing transformation and what the future state must improve for customers.',
    requiredSignals: ['journey_breakdown', 'trust_gap', 'customer_effort', 'service_failure', 'experience_expectation_gap'],
    evidenceRequirement: 'Force evidence from customer journeys, complaints, onboarding, retention issues, service failures, or unmet expectations that show why the target state matters.',
    forbiddenDrift: ['generic satisfaction questions', 'broad brand perception without transformation consequence'],
    wordingRules: [
      'Ask about one customer experience pressure only.',
      'Use journey, trust, effort, expectation, service, retention, or experience language.',
      'Tie the question to what customers need to feel or see if the future state is going to work.',
    ],
  },
  'Risk/Compliance': {
    workshopType: 'TRANSFORMATION',
    stage: 'discovery',
    lens: 'Risk/Compliance',
    objective: 'Reveal where governance, controls, approvals, or risk posture will slow, shape, or protect the transformation path.',
    requiredSignals: ['approval_friction', 'governance_drag', 'control_dependency', 'risk_constraint', 'assurance_requirement'],
    evidenceRequirement: 'Force evidence from real approvals, governance steps, control requirements, or assurance processes that affect the pace or shape of change.',
    forbiddenDrift: ['generic compliance maturity', 'broad policy questions with no change consequence'],
    wordingRules: [
      'Ask about one control, approval, or governance dependency only.',
      'Use approval, control, governance, assurance, policy, or risk language.',
      'Tie the question to whether change can move at the required pace without losing control.',
    ],
  },
  Partners: {
    workshopType: 'TRANSFORMATION',
    stage: 'discovery',
    lens: 'Partners',
    objective: 'Reveal where external dependencies, vendors, or delivery partners will accelerate, complicate, or block the transition to the future state.',
    requiredSignals: ['external_dependency', 'partner_constraint', 'delivery_risk', 'alignment_gap', 'acceleration_opportunity'],
    evidenceRequirement: 'Force evidence from real partner dependencies, outsourced capability, vendor commitments, or third-party blockers that affect the target state.',
    forbiddenDrift: ['generic supplier relationship questions', 'partner questions without transformation consequence'],
    wordingRules: [
      'Ask about one external dependency or partner risk only.',
      'Use partner, vendor, third-party, dependency, alignment, or outsourced capability language.',
      'Tie the question to whether the future state depends on external change or support.',
    ],
  },
};

const OPERATIONS_DISCOVERY_CONTRACTS: Record<CanonicalLensName, DiscoveryLensContract> = {
  People: {
    workshopType: 'OPERATIONS',
    stage: 'discovery',
    lens: 'People',
    objective: 'Reveal where role clarity, workload, capability, behaviour, or support affect day-to-day execution reliability.',
    requiredSignals: ['clarity_gap', 'capacity_pressure', 'capability_gap', 'handoff_behaviour', 'support_strength'],
    evidenceRequirement: 'Force evidence from day-to-day work, handoffs, bottlenecks, queue pressure, or execution breakdowns that participants can observe directly.',
    forbiddenDrift: ['generic morale questions', 'broad culture discussions without execution consequence', 'abstract HR framing'],
    wordingRules: [
      'Ask about one operational people signal only.',
      'Use clarity, workload, support, confidence, capability, behaviour, or handoff language.',
      'Tie the question to whether work flows cleanly or breaks down in practice.',
    ],
  },
  Operations: {
    workshopType: 'OPERATIONS',
    stage: 'discovery',
    lens: 'Operations',
    objective: 'Reveal where flow, bottlenecks, handoffs, rework, or decision delays are degrading execution or service performance.',
    requiredSignals: ['bottleneck', 'handoff_friction', 'rework', 'decision_delay', 'flow_reliability'],
    evidenceRequirement: 'Force evidence from workflows, queues, repeat failure modes, handoffs, or real delivery delays that participants see in practice.',
    forbiddenDrift: ['generic process maturity', 'broad strategy questions', 'efficiency wording detached from lived flow'],
    wordingRules: [
      'Ask about one execution signal only.',
      'Use flow, delay, bottleneck, handoff, queue, repeat work, or service impact language.',
      'Keep the question anchored in observable operational reality.',
    ],
  },
  Technology: {
    workshopType: 'OPERATIONS',
    stage: 'discovery',
    lens: 'Technology',
    objective: 'Reveal where systems, tools, data, or workarounds are helping or disrupting execution reliability.',
    requiredSignals: ['tool_friction', 'system_failure', 'data_gap', 'workaround_dependency', 'automation_support'],
    evidenceRequirement: 'Force evidence from system use, outages, manual workarounds, missing data, or tooling friction that affects execution.',
    forbiddenDrift: ['generic IT maturity', 'technology strategy questions without day-to-day consequence'],
    wordingRules: [
      'Ask about one operational technology signal only.',
      'Use system, tool, data, workaround, outage, or automation language.',
      'Tie the question to what it does to execution speed, accuracy, or flow.',
    ],
  },
  Commercial: {
    workshopType: 'OPERATIONS',
    stage: 'discovery',
    lens: 'Commercial',
    objective: 'Reveal where operational reality is affecting customer expectations, service quality, value delivery, or commercial confidence.',
    requiredSignals: ['service_pain', 'expectation_gap', 'value_breakdown', 'customer_delay', 'confidence_signal'],
    evidenceRequirement: 'Force evidence from what customers experience, where service breaks down, or where teams see customer promises being missed.',
    forbiddenDrift: ['generic growth strategy questions', 'abstract customer sentiment without service consequence'],
    wordingRules: [
      'Ask about one customer or service consequence only.',
      'Use customer expectation, value, promise, complaint, delay, or service quality language.',
      'Tie the question to what customers feel or where teams see value being weakened.',
    ],
  },
  Customer: {
    workshopType: 'OPERATIONS',
    stage: 'discovery',
    lens: 'Customer',
    objective: 'Reveal where customers feel operational friction directly and where service reliability, responsiveness, or trust is being damaged in lived experience.',
    requiredSignals: ['customer_effort', 'service_friction', 'trust_erosion', 'responsiveness_gap', 'experience_recovery'],
    evidenceRequirement: 'Force evidence from customer complaints, repeated contacts, service delays, broken expectations, or recovery moments that show how operations land externally.',
    forbiddenDrift: ['generic marketing questions', 'abstract sentiment measures with no service evidence'],
    wordingRules: [
      'Ask about one customer experience consequence only.',
      'Use customer effort, delay, responsiveness, trust, service quality, or complaint language.',
      'Keep the question tied to what customers directly feel when operations work or fail.',
    ],
  },
  'Risk/Compliance': {
    workshopType: 'OPERATIONS',
    stage: 'discovery',
    lens: 'Risk/Compliance',
    objective: 'Reveal where controls, approvals, compliance checks, or policy ambiguity are slowing work or protecting quality in practice.',
    requiredSignals: ['approval_delay', 'control_friction', 'policy_ambiguity', 'compliance_breakdown', 'assurance_strength'],
    evidenceRequirement: 'Force evidence from actual approvals, checks, policy interpretation, auditability needs, or compliance work that participants encounter.',
    forbiddenDrift: ['generic compliance maturity', 'policy questions without operational consequence'],
    wordingRules: [
      'Ask about one operational control signal only.',
      'Use approvals, checks, controls, policy, compliance, auditability, or risk language.',
      'Tie the question to how work flows or stalls in practice.',
    ],
  },
  Partners: {
    workshopType: 'OPERATIONS',
    stage: 'discovery',
    lens: 'Partners',
    objective: 'Reveal where vendors, suppliers, outsourcers, or external dependencies are helping or weakening execution reliability.',
    requiredSignals: ['dependency_delay', 'partner_handoff_gap', 'responsiveness_issue', 'accountability_gap', 'partner_support'],
    evidenceRequirement: 'Force evidence from third-party handoffs, supplier delays, outsourced work, or external dependencies that affect execution.',
    forbiddenDrift: ['generic supplier relationship questions', 'partner questions with no day-to-day delivery consequence'],
    wordingRules: [
      'Ask about one external dependency signal only.',
      'Use partner, supplier, vendor, third-party, dependency, responsiveness, or accountability language.',
      'Tie the question to where external dependencies slow or support delivery in practice.',
    ],
  },
};

const AI_DISCOVERY_CONTRACTS: Record<CanonicalLensName, DiscoveryLensContract> = {
  People: {
    workshopType: 'AI',
    stage: 'discovery',
    lens: 'People',
    objective: 'Reveal where capability, trust, adoption behaviour, change readiness, or role anxiety will help or block practical AI use.',
    requiredSignals: ['adoption_readiness', 'trust_gap', 'capability_gap', 'role_anxiety', 'change_support'],
    evidenceRequirement: 'Force evidence from current work, tool use, confidence levels, training gaps, or observed reactions to automation and AI-like changes.',
    forbiddenDrift: ['generic culture questions', 'broad people strategy without AI consequence', 'abstract morale questions'],
    wordingRules: [
      'Ask about one AI adoption signal only.',
      'Use confidence, trust, readiness, capability, role impact, or behaviour language.',
      'Tie the question to whether people will use, resist, or benefit from AI in practice.',
    ],
  },
  Operations: {
    workshopType: 'AI',
    stage: 'discovery',
    lens: 'Operations',
    objective: 'Reveal where workflow, decision points, repeat work, or handoffs make AI useful, difficult, or risky to implement.',
    requiredSignals: ['automation_fit', 'workflow_breakpoint', 'repeat_work', 'exception_complexity', 'handoff_dependency'],
    evidenceRequirement: 'Force evidence from repeat tasks, workflow friction, decision bottlenecks, exception handling, or handoffs that shape AI use-case fit.',
    forbiddenDrift: ['generic process maturity', 'broad efficiency questions without AI relevance'],
    wordingRules: [
      'Ask about one AI workflow signal only.',
      'Use repeat work, decision point, exception, workflow, handoff, or operational fit language.',
      'Tie the question to whether AI could genuinely help in practice.',
    ],
  },
  Technology: {
    workshopType: 'AI',
    stage: 'discovery',
    lens: 'Technology',
    objective: 'Reveal where systems, data, tooling, integration, or technical constraints will enable, limit, or slow AI implementation.',
    requiredSignals: ['data_readiness', 'integration_constraint', 'tooling_gap', 'platform_fit', 'technical_risk'],
    evidenceRequirement: 'Force evidence from current systems, data quality, platform constraints, integration realities, or technical limitations that affect AI feasibility.',
    forbiddenDrift: ['generic technology maturity', 'broad IT questions without AI implementation consequence'],
    wordingRules: [
      'Ask about one AI technology signal only.',
      'Use data, model, tooling, integration, platform, system, or technical risk language.',
      'Tie the question to whether AI can be implemented credibly.',
    ],
  },
  Commercial: {
    workshopType: 'AI',
    stage: 'discovery',
    lens: 'Commercial',
    objective: 'Reveal where AI could improve customer value, service quality, proposition strength, or commercial confidence and where it could damage trust.',
    requiredSignals: ['customer_value_opportunity', 'promise_risk', 'service_gain', 'trust_risk', 'differentiation_opportunity'],
    evidenceRequirement: 'Force evidence from customer needs, service pain, value breakdowns, or promise risks that show where AI could help or hurt the customer outcome.',
    forbiddenDrift: ['generic growth strategy questions', 'abstract commercial ambition without AI consequence'],
    wordingRules: [
      'Ask about one AI value signal only.',
      'Use customer value, trust, promise, quality, service, or differentiation language.',
      'Tie the question to whether AI would improve or weaken the customer-facing outcome.',
    ],
  },
  Customer: {
    workshopType: 'AI',
    stage: 'discovery',
    lens: 'Customer',
    objective: 'Reveal where AI could improve or damage the lived customer experience, trust, responsiveness, or relationship quality.',
    requiredSignals: ['experience_gain', 'trust_risk', 'customer_effort_reduction', 'service_personalisation', 'adoption_barrier'],
    evidenceRequirement: 'Force evidence from customer journeys, service pain, response expectations, trust concerns, or relationship moments where AI would materially change the experience.',
    forbiddenDrift: ['generic innovation ambition', 'broad marketing claims without customer experience consequence'],
    wordingRules: [
      'Ask about one customer-facing AI effect only.',
      'Use customer experience, trust, response, service quality, effort, or relationship language.',
      'Tie the question to what customers would actually notice or feel if AI were introduced.',
    ],
  },
  'Risk/Compliance': {
    workshopType: 'AI',
    stage: 'discovery',
    lens: 'Risk/Compliance',
    objective: 'Reveal where governance, approvals, compliance, assurance, or risk controls will shape what AI can safely do.',
    requiredSignals: ['governance_requirement', 'approval_barrier', 'compliance_constraint', 'assurance_need', 'risk_exposure'],
    evidenceRequirement: 'Force evidence from current controls, approval requirements, policy obligations, auditability needs, or risk treatment that affects AI feasibility.',
    forbiddenDrift: ['generic compliance maturity', 'broad policy questions without AI implementation consequence'],
    wordingRules: [
      'Ask about one AI governance signal only.',
      'Use approval, policy, auditability, compliance, assurance, or risk language.',
      'Tie the question to what AI can or cannot do safely in practice.',
    ],
  },
  Partners: {
    workshopType: 'AI',
    stage: 'discovery',
    lens: 'Partners',
    objective: 'Reveal where vendors, platforms, external data sources, or partners will accelerate, constrain, or complicate AI implementation.',
    requiredSignals: ['vendor_dependency', 'platform_dependency', 'external_data_risk', 'partner_constraint', 'partner_enablement'],
    evidenceRequirement: 'Force evidence from partner tools, external platforms, vendor lock-in, outsourced capability, or third-party data dependencies that affect AI use.',
    forbiddenDrift: ['generic supplier relationship questions', 'ecosystem questions without AI consequence'],
    wordingRules: [
      'Ask about one external AI dependency signal only.',
      'Use partner, vendor, platform, external data, dependency, or enablement language.',
      'Tie the question to whether AI depends on external capability or creates external risk.',
    ],
  },
};

const FINANCE_DISCOVERY_CONTRACTS: Record<CanonicalLensName, DiscoveryLensContract> = {
  People: {
    workshopType: 'FINANCE',
    stage: 'discovery',
    lens: 'People',
    objective: 'Reveal where decisions, behaviours, capability, incentives, or ownership patterns create or reduce value leakage.',
    requiredSignals: ['decision_quality', 'ownership_gap', 'capability_gap', 'incentive_misalignment', 'cost_awareness'],
    evidenceRequirement: 'Force evidence from day-to-day decisions, handoffs, approvals, prioritisation, or rework that show where effort converts into value or gets wasted.',
    forbiddenDrift: ['generic morale questions', 'broad people strategy with no value consequence', 'abstract culture diagnostics'],
    wordingRules: [
      'Ask about one value-related people signal only.',
      'Use ownership, decision, capability, incentive, awareness, or behaviour language.',
      'Tie the question to whether effort turns into value or gets lost.',
    ],
  },
  Operations: {
    workshopType: 'FINANCE',
    stage: 'discovery',
    lens: 'Operations',
    objective: 'Reveal where workflow, rework, delay, complexity, or poor sequencing are driving cost-to-serve and value leakage.',
    requiredSignals: ['rework_cost', 'delay_cost', 'complexity_drag', 'flow_waste', 'throughput_value'],
    evidenceRequirement: 'Force evidence from repeat work, operational delay, queueing, complexity, or poor flow that consumes effort without creating value.',
    forbiddenDrift: ['generic process maturity', 'operational diagnostics with no value consequence'],
    wordingRules: [
      'Ask about one value-leakage operations signal only.',
      'Use rework, delay, complexity, waste, throughput, or flow language.',
      'Tie the question to where effort is consumed without translating into value.',
    ],
  },
  Technology: {
    workshopType: 'FINANCE',
    stage: 'discovery',
    lens: 'Technology',
    objective: 'Reveal where systems, tooling, data, or manual workaround drive avoidable effort, cost, or weak value conversion.',
    requiredSignals: ['manual_effort', 'tooling_waste', 'data_rework', 'automation_gap', 'system_cost_drag'],
    evidenceRequirement: 'Force evidence from manual work, duplicate entry, poor tooling, missing automation, or system friction that creates avoidable effort.',
    forbiddenDrift: ['generic IT maturity', 'technology questions with no cost or value consequence'],
    wordingRules: [
      'Ask about one technology value signal only.',
      'Use manual effort, duplicate work, data quality, automation, tooling, or system drag language.',
      'Tie the question to where technology is increasing effort without enough return.',
    ],
  },
  Commercial: {
    workshopType: 'FINANCE',
    stage: 'discovery',
    lens: 'Commercial',
    objective: 'Reveal where pricing confidence, weak-fit work, service promises, or customer expectations create unattractive economics or value leakage.',
    requiredSignals: ['weak_fit_work', 'promise_overstretch', 'value_mismatch', 'pricing_pressure', 'commercial_drag'],
    evidenceRequirement: 'Force evidence from client work, scope shape, service expectation, or commercial choices that create weak value or unattractive economics.',
    forbiddenDrift: ['generic growth strategy', 'broad customer questions with no value consequence'],
    wordingRules: [
      'Ask about one commercial value signal only.',
      'Use weak-fit work, scope, expectation, promise, value, or commercial drag language.',
      'Tie the question to where customer work looks attractive but destroys value or increases effort.',
    ],
  },
  Customer: {
    workshopType: 'FINANCE',
    stage: 'discovery',
    lens: 'Customer',
    objective: 'Reveal where customer behaviour, retention, service expectations, or experience failures are creating or protecting value.',
    requiredSignals: ['retention_value', 'churn_cost', 'service_expectation_gap', 'experience_loyalty', 'customer_effort_cost'],
    evidenceRequirement: 'Force evidence from renewals, churn, complaints, service recovery, or account behaviour that shows where customer experience strengthens or weakens economics.',
    forbiddenDrift: ['generic NPS discussion', 'broad growth questions with no evidence of customer value impact'],
    wordingRules: [
      'Ask about one customer value signal only.',
      'Use retention, churn, loyalty, service expectation, complaint, or effort language.',
      'Tie the question to where customer experience protects value or creates avoidable cost.',
    ],
  },
  'Risk/Compliance': {
    workshopType: 'FINANCE',
    stage: 'discovery',
    lens: 'Risk/Compliance',
    objective: 'Reveal where approvals, controls, compliance obligations, or governance are creating necessary protection versus avoidable cost drag.',
    requiredSignals: ['approval_cost', 'control_drag', 'compliance_overhead', 'assurance_value', 'governance_delay'],
    evidenceRequirement: 'Force evidence from approvals, control steps, compliance work, or governance requirements that either protect value or consume effort without enough return.',
    forbiddenDrift: ['generic compliance maturity', 'broad control questions with no value consequence'],
    wordingRules: [
      'Ask about one governance cost signal only.',
      'Use approvals, control, assurance, compliance overhead, governance, or delay language.',
      'Tie the question to where protection adds value versus where it adds avoidable drag.',
    ],
  },
  Partners: {
    workshopType: 'FINANCE',
    stage: 'discovery',
    lens: 'Partners',
    objective: 'Reveal where vendors, suppliers, outsourcers, or external dependencies create avoidable cost, weak value conversion, or stronger economics.',
    requiredSignals: ['supplier_cost_drag', 'dependency_overhead', 'partner_value_gap', 'outsource_efficiency', 'external_rework'],
    evidenceRequirement: 'Force evidence from supplier interaction, partner dependence, outsourced work, or third-party rework that affects value conversion.',
    forbiddenDrift: ['generic supplier relationship questions', 'partner questions with no cost or value consequence'],
    wordingRules: [
      'Ask about one partner value signal only.',
      'Use supplier cost, dependency overhead, outsourced work, rework, or external value language.',
      'Tie the question to where external dependencies improve or weaken value.',
    ],
  },
};

export function getDiscoveryLensContract(
  workshopType: CanonicalWorkshopType,
  lens: CanonicalLensName,
): DiscoveryLensContract | null {
  if (workshopType === 'GO_TO_MARKET') {
    return GTM_DISCOVERY_CONTRACTS[lens];
  }
  if (workshopType === 'TRANSFORMATION') {
    return TRANSFORMATION_DISCOVERY_CONTRACTS[lens];
  }
  if (workshopType === 'OPERATIONS') {
    return OPERATIONS_DISCOVERY_CONTRACTS[lens];
  }
  if (workshopType === 'AI') {
    return AI_DISCOVERY_CONTRACTS[lens];
  }
  if (workshopType === 'FINANCE') {
    return FINANCE_DISCOVERY_CONTRACTS[lens];
  }
  return null;
}

export function buildDiscoveryLensContractBlock(
  workshopType: CanonicalWorkshopType,
  lenses: CanonicalLensName[],
): string {
  const lines = lenses
    .map((lens) => {
      const contract = getDiscoveryLensContract(workshopType, lens);
      if (!contract) return null;
      return [
        `${lens}:`,
        `- Objective: ${contract.objective}`,
        `- Required signals: ${contract.requiredSignals.join(', ')}`,
        `- Evidence: ${contract.evidenceRequirement}`,
        `- Forbidden drift: ${contract.forbiddenDrift.join('; ')}`,
        `- Wording rules: ${contract.wordingRules.join(' ')}`,
      ].join('\n');
    })
    .filter(Boolean);

  return lines.join('\n\n');
}
