import { describe, expect, it } from 'vitest';

import {
  sanitizeDiscoveryQuestionSet,
  buildContextualFinanceDiscoveryQuestionSet,
  buildDiscoverySystemPrompt,
  buildContextualAiDiscoveryQuestionSet,
  buildContextualGtmDiscoveryQuestionSet,
  buildContextualOperationsDiscoveryQuestionSet,
  buildContextualTransformationDiscoveryQuestionSet,
  isAiWorkshopType,
  isFinanceWorkshopType,
  isGoToMarketWorkshopType,
  isOperationsWorkshopType,
  isTransformationWorkshopType,
  validateDiscoveryQuestion,
  type DiscoveryQuestion,
} from '@/lib/cognition/agents/discovery-question-agent';
import { CANONICAL_LENSES } from '@/lib/workshop/canonical-lenses';
import { buildDiscoveryLensContractBlock } from '@/lib/workshop/discovery-stage-contracts';
import { buildLiveWorkshopContractBlock } from '@/lib/workshop/live-stage-contracts';

function makeQuestion(overrides: Partial<DiscoveryQuestion>): DiscoveryQuestion {
  return {
    id: 'q1',
    text: 'Where do you see the strongest win/loss pattern by client type or deal profile?',
    tag: 'gaps',
    purpose: 'Surface who the business wins with and where fit breaks down.',
    isEdited: false,
    ...overrides,
  };
}

describe('discovery question agent GTM handling', () => {
  it('recognizes GTM workshop types including legacy aliases', () => {
    expect(isGoToMarketWorkshopType('GO_TO_MARKET')).toBe(true);
    expect(isGoToMarketWorkshopType('gtm')).toBe(true);
    expect(isGoToMarketWorkshopType('CUSTOMER')).toBe(true);
    expect(isGoToMarketWorkshopType('OPERATIONS')).toBe(false);
    expect(isTransformationWorkshopType('TRANSFORMATION')).toBe(true);
    expect(isTransformationWorkshopType('GO_TO_MARKET')).toBe(false);
    expect(isOperationsWorkshopType('OPERATIONS')).toBe(true);
    expect(isOperationsWorkshopType('TRANSFORMATION')).toBe(false);
    expect(isAiWorkshopType('AI')).toBe(true);
    expect(isAiWorkshopType('OPERATIONS')).toBe(false);
    expect(isFinanceWorkshopType('FINANCE')).toBe(true);
    expect(isFinanceWorkshopType('AI')).toBe(false);
  });

  it('injects GTM-specific commercial truth rules into the prompt', () => {
    const prompt = buildDiscoverySystemPrompt({
      workshopId: 'ws-1',
      workshopType: 'GO_TO_MARKET',
      workshopPurpose: 'Sharpen ICP and proposition',
      desiredOutcomes: 'Understand who we win with and why',
      clientName: 'Capita',
      industry: 'BPO & Outsourcing',
      companyWebsite: null,
      dreamTrack: 'ENTERPRISE',
      targetDomain: null,
      engagementType: null,
      domainPack: null,
      domainPackConfig: null,
      blueprint: null,
      historicalMetrics: null,
    });

    expect(prompt).toContain('GO-TO-MARKET / ICP MODE (MANDATORY)');
    expect(prompt).toContain('How does this area affect how the business wins, loses, and delivers value in the market?');
    expect(prompt).toContain('do NOT revert to generic internal maturity questions');
  });

  it('provides a distinct transformation-mode prompt block for transformation workshops', () => {
    const prompt = buildDiscoverySystemPrompt({
      workshopId: 'ws-2',
      workshopType: 'TRANSFORMATION',
      workshopPurpose: 'Define the future-state operating model',
      desiredOutcomes: 'Surface blockers to change',
      clientName: 'Client',
      industry: 'Services',
      companyWebsite: null,
      dreamTrack: 'ENTERPRISE',
      targetDomain: null,
      engagementType: null,
      domainPack: null,
      domainPackConfig: null,
      blueprint: null,
      historicalMetrics: null,
    });

    expect(prompt).toContain('TRANSFORMATION MODE:');
    expect(prompt).toContain('Interpret every lens through the future-state change agenda.');
    expect(prompt).toContain('RUNTIME GOLD DATASET (BEHAVIOURAL REFERENCE ONLY):');
    expect(prompt).toContain('LENS CONTRACTS (AUTHORITATIVE FOR GENERATION AND VALIDATION):');
    expect(prompt).toContain('Reveal where the current operating model, handoffs, decision flow, or service mechanics will prevent the future state from working.');
  });

  it('provides a distinct operations-mode prompt block for operations workshops', () => {
    const prompt = buildDiscoverySystemPrompt({
      workshopId: 'ws-ops',
      workshopType: 'OPERATIONS',
      workshopPurpose: 'Improve service flow and reduce handoff friction.',
      desiredOutcomes: 'Surface bottlenecks and prioritise operational improvements.',
      clientName: 'Client',
      industry: 'Services',
      companyWebsite: null,
      dreamTrack: 'ENTERPRISE',
      targetDomain: null,
      engagementType: null,
      domainPack: null,
      domainPackConfig: null,
      blueprint: null,
      historicalMetrics: null,
    });

    expect(prompt).toContain('OPERATIONS MODE:');
    expect(prompt).toContain('Interpret every lens through execution quality, bottlenecks, flow, and practical service performance.');
    expect(prompt).toContain('RUNTIME GOLD DATASET (BEHAVIOURAL REFERENCE ONLY):');
    expect(prompt).toContain('LENS CONTRACTS (AUTHORITATIVE FOR GENERATION AND VALIDATION):');
  });

  it('provides a distinct ai-mode prompt block for AI workshops', () => {
    const prompt = buildDiscoverySystemPrompt({
      workshopId: 'ws-ai',
      workshopType: 'AI',
      workshopPurpose: 'Identify the most credible AI use cases and implementation blockers.',
      desiredOutcomes: 'Surface workflow fit, readiness, data constraints, and governance needs.',
      clientName: 'Client',
      industry: 'Services',
      companyWebsite: null,
      dreamTrack: 'ENTERPRISE',
      targetDomain: null,
      engagementType: null,
      domainPack: null,
      domainPackConfig: null,
      blueprint: null,
      historicalMetrics: null,
    });

    expect(prompt).toContain('AI MODE:');
    expect(prompt).toContain('Interpret every lens through practical AI readiness, use-case fit, implementation feasibility, adoption risk, and governance safety.');
    expect(prompt).toContain('RUNTIME GOLD DATASET (BEHAVIOURAL REFERENCE ONLY):');
    expect(prompt).toContain('LENS CONTRACTS (AUTHORITATIVE FOR GENERATION AND VALIDATION):');
  });

  it('provides a distinct finance-mode prompt block for Finance workshops', () => {
    const prompt = buildDiscoverySystemPrompt({
      workshopId: 'ws-finance',
      workshopType: 'FINANCE',
      workshopPurpose: 'Identify value leakage, cost-to-serve pressure, and weak-fit work.',
      desiredOutcomes: 'Surface where effort fails to convert into value and prioritise higher-return changes.',
      clientName: 'Client',
      industry: 'Services',
      companyWebsite: null,
      dreamTrack: 'ENTERPRISE',
      targetDomain: null,
      engagementType: null,
      domainPack: null,
      domainPackConfig: null,
      blueprint: null,
      historicalMetrics: null,
    });

    expect(prompt).toContain('FINANCE / VALUE OPTIMISATION MODE:');
    expect(prompt).toContain('Interpret every lens through value creation, value leakage, cost-to-serve, and margin pressure.');
    expect(prompt).toContain('RUNTIME GOLD DATASET (BEHAVIOURAL REFERENCE ONLY):');
    expect(prompt).toContain('LENS CONTRACTS (AUTHORITATIVE FOR GENERATION AND VALIDATION):');
  });

  it('builds a transformation discovery contract block for all canonical lenses', () => {
    const block = buildDiscoveryLensContractBlock('TRANSFORMATION', CANONICAL_LENSES.map((lens) => lens.name));

    expect(block).toContain('People:');
    expect(block).toContain('Operations:');
    expect(block).toContain('Technology:');
    expect(block).toContain('Commercial:');
    expect(block).toContain('Risk/Compliance:');
    expect(block).toContain('Partners:');
    expect(block).toContain('future state');
    expect(block).toContain('current operating model');
  });

  it('builds a transformation live contract block across all three phases', () => {
    const block = buildLiveWorkshopContractBlock('TRANSFORMATION');

    expect(block).toContain('REIMAGINE:');
    expect(block).toContain('CONSTRAINTS:');
    expect(block).toContain('DEFINE_APPROACH:');
    expect(block).toContain('future state');
    expect(block).toContain('sequenced change path');
  });

  it('builds an operations discovery contract block for all canonical lenses', () => {
    const block = buildDiscoveryLensContractBlock('OPERATIONS', CANONICAL_LENSES.map((lens) => lens.name));

    expect(block).toContain('People:');
    expect(block).toContain('Operations:');
    expect(block).toContain('Technology:');
    expect(block).toContain('Commercial:');
    expect(block).toContain('Risk/Compliance:');
    expect(block).toContain('Partners:');
    expect(block).toContain('bottlenecks');
    expect(block).toContain('day-to-day work');
  });

  it('builds an operations live contract block across all three phases', () => {
    const block = buildLiveWorkshopContractBlock('OPERATIONS');

    expect(block).toContain('REIMAGINE:');
    expect(block).toContain('CONSTRAINTS:');
    expect(block).toContain('DEFINE_APPROACH:');
    expect(block).toContain('smooth, reliable, high-quality execution');
    expect(block).toContain('bottlenecks');
  });

  it('builds an AI discovery contract block for all canonical lenses', () => {
    const block = buildDiscoveryLensContractBlock('AI', CANONICAL_LENSES.map((lens) => lens.name));

    expect(block).toContain('People:');
    expect(block).toContain('Operations:');
    expect(block).toContain('Technology:');
    expect(block).toContain('Commercial:');
    expect(block).toContain('Risk/Compliance:');
    expect(block).toContain('Partners:');
    expect(block).toContain('AI');
    expect(block).toContain('implementation');
  });

  it('builds an AI live contract block across all three phases', () => {
    const block = buildLiveWorkshopContractBlock('AI');

    expect(block).toContain('REIMAGINE:');
    expect(block).toContain('CONSTRAINTS:');
    expect(block).toContain('DEFINE_APPROACH:');
    expect(block).toContain('AI');
    expect(block).toContain('use cases');
  });

  it('builds a Finance discovery contract block for all canonical lenses', () => {
    const block = buildDiscoveryLensContractBlock('FINANCE', CANONICAL_LENSES.map((lens) => lens.name));

    expect(block).toContain('People:');
    expect(block).toContain('Operations:');
    expect(block).toContain('Technology:');
    expect(block).toContain('Commercial:');
    expect(block).toContain('Risk/Compliance:');
    expect(block).toContain('Partners:');
    expect(block).toContain('value leakage');
    expect(block).toContain('cost-to-serve');
  });

  it('builds a Finance live contract block across all three phases', () => {
    const block = buildLiveWorkshopContractBlock('FINANCE');

    expect(block).toContain('REIMAGINE:');
    expect(block).toContain('CONSTRAINTS:');
    expect(block).toContain('DEFINE_APPROACH:');
    expect(block).toContain('value conversion');
    expect(block).toContain('cost-to-serve');
  });

  it('accepts transformation questions that connect current reality to the future state', () => {
    const issues = validateDiscoveryQuestion(
      'Operations',
      makeQuestion({
        text: 'Where do you see the current operating model showing that the business must sequence change differently before the target state can work in practice?',
        tag: 'gaps',
        purpose: 'Surface the current-to-future operating gap.',
      }),
      { workshopType: 'TRANSFORMATION' },
    );

    expect(issues).toEqual([]);
  });

  it('accepts operations questions that stay grounded in observable execution flow', () => {
    const issues = validateDiscoveryQuestion(
      'Operations',
      makeQuestion({
        text: 'Where do you see delivery performance metrics and post-sale reviews showing the business should fix the biggest bottlenecks in the service flow before trying to scale this work?',
        tag: 'gaps',
        purpose: 'Surface the main stall points in the workflow.',
      }),
      { workshopType: 'OPERATIONS' },
    );

    expect(issues).toEqual([]);
  });

  it('accepts AI questions that stay grounded in readiness and implementation reality', () => {
    const issues = validateDiscoveryQuestion(
      'Technology',
      makeQuestion({
        text: 'Where do you see live deals and delivered outcomes showing that the business needs to fix data gaps first because they are stopping AI use from creating credible value?',
        tag: 'gaps',
        purpose: 'Surface AI data-readiness blockers.',
      }),
      { workshopType: 'AI' },
    );

    expect(issues).toEqual([]);
  });

  it('accepts Finance questions that stay grounded in value leakage and avoidable drag', () => {
    const issues = validateDiscoveryQuestion(
      'Operations',
      makeQuestion({
        text: 'Where do you see the business needing to fix delays or rework first because they turn live operational effort into avoidable cost-to-serve?',
        tag: 'gaps',
        purpose: 'Surface where effort is consumed without enough return.',
      }),
      { workshopType: 'FINANCE' },
    );

    expect(issues).toEqual([]);
  });

  it('builds a transformation discovery set from workshop context instead of the generic path', () => {
    const questionSet = buildContextualTransformationDiscoveryQuestionSet(
      CANONICAL_LENSES.map((lens) => lens.name),
      {
        workshopId: 'ws-transformation',
        workshopType: 'TRANSFORMATION',
        workshopPurpose: 'Redesign the operating model so the future-state service can scale without current handoff friction.',
        desiredOutcomes: 'Define the future state, the blockers to change, and the critical dependencies.',
        clientName: 'Northstar',
        industry: 'Business Services',
        companyWebsite: null,
        dreamTrack: 'ENTERPRISE',
        targetDomain: null,
        engagementType: null,
        domainPack: null,
        domainPackConfig: null,
        blueprint: null,
        historicalMetrics: null,
      },
      {
        companyOverview: 'Northstar is attempting to redesign its service model.',
        industryContext: 'The business is under pressure to improve service consistency while changing the operating model.',
        keyPublicChallenges: [],
        recentDevelopments: [],
        competitorLandscape: 'Peers are modernising operating models faster.',
        domainInsights: null,
        researchedAtMs: Date.now(),
        sourceUrls: [],
        keyFacilitatorInsight: 'The future-state ambition is ahead of operating reality.',
        strategicTensions: ['Current delivery model versus target-state service design'],
        workshopBrief: 'The room must surface blockers, dependencies, and what makes the future state credible.',
        workshopHypotheses: ['Current handoffs and decision flow will slow the transformation'],
        expectedRoomTensions: null,
        workshopImplications: null,
        journeyStages: null,
        industryDimensions: null,
        actorTaxonomy: null,
        journeyActors: null,
      },
      'test rationale',
    );

    expect(questionSet.lenses).toHaveLength(6);
    expect(questionSet.lenses.every((lens) => lens.questions.length === 5)).toBe(true);
    expect(questionSet.lenses[0].questions[0].text).toContain('future-state operating model');
  });

  it('builds a transformation discovery set that passes validation end to end', () => {
    const questionSet = buildContextualTransformationDiscoveryQuestionSet(
      CANONICAL_LENSES.map((lens) => lens.name),
      {
        workshopId: 'ws-transformation-validated',
        workshopType: 'TRANSFORMATION',
        workshopPurpose: 'Redesign the operating model so the future-state service can scale without current handoff friction.',
        desiredOutcomes: 'Define the future state, the blockers to change, and the critical dependencies.',
        clientName: 'Northstar',
        industry: 'Business Services',
        companyWebsite: null,
        dreamTrack: 'ENTERPRISE',
        targetDomain: null,
        engagementType: null,
        domainPack: null,
        domainPackConfig: null,
        blueprint: null,
        historicalMetrics: null,
      },
      {
        companyOverview: 'Northstar is attempting to redesign its service model.',
        industryContext: 'The business is under pressure to improve service consistency while changing the operating model.',
        keyPublicChallenges: [],
        recentDevelopments: [],
        competitorLandscape: 'Peers are modernising operating models faster.',
        domainInsights: null,
        researchedAtMs: Date.now(),
        sourceUrls: [],
        keyFacilitatorInsight: 'The future-state ambition is ahead of operating reality.',
        strategicTensions: ['Current delivery model versus target-state service design'],
        workshopBrief: 'The room must surface blockers, dependencies, and what makes the future state credible.',
        workshopHypotheses: ['Current handoffs and decision flow will slow the transformation'],
        expectedRoomTensions: null,
        workshopImplications: null,
        journeyStages: null,
        industryDimensions: null,
        actorTaxonomy: null,
        journeyActors: null,
      },
      'test rationale',
    );

    const issues = questionSet.lenses.flatMap((lens) =>
      lens.questions.flatMap((question) =>
        validateDiscoveryQuestion(lens.key, question, { workshopType: 'TRANSFORMATION' }),
      ),
    );

    expect(issues).toEqual([]);
  });

  it('builds an operations discovery set from workshop context instead of the generic path', () => {
    const questionSet = buildContextualOperationsDiscoveryQuestionSet(
      CANONICAL_LENSES.map((lens) => lens.name),
      {
        workshopId: 'ws-operations',
        workshopType: 'OPERATIONS',
        workshopPurpose: 'Reduce handoff friction and improve service reliability in the contact centre.',
        desiredOutcomes: 'Identify the main bottlenecks, repeat rework, and operational constraints.',
        clientName: 'ServiceCo',
        industry: 'Customer Operations',
        companyWebsite: null,
        dreamTrack: 'ENTERPRISE',
        targetDomain: null,
        engagementType: null,
        domainPack: null,
        domainPackConfig: null,
        blueprint: null,
        historicalMetrics: null,
      },
      {
        companyOverview: 'ServiceCo runs a large customer operation with visible workflow friction.',
        industryContext: 'The operation depends on clean handoffs, stable systems, and reliable queue flow.',
        keyPublicChallenges: [],
        recentDevelopments: [],
        competitorLandscape: 'Peers are reducing service delay and rework.',
        domainInsights: null,
        researchedAtMs: Date.now(),
        sourceUrls: [],
        keyFacilitatorInsight: 'The room needs to isolate where work gets stuck and repeated.',
        strategicTensions: ['Queue stability versus responsiveness'],
        workshopBrief: 'The workshop must surface the biggest bottlenecks, control friction, and system issues.',
        workshopHypotheses: ['Handoffs and rework are weakening execution reliability'],
        expectedRoomTensions: null,
        workshopImplications: null,
        journeyStages: null,
        industryDimensions: null,
        actorTaxonomy: null,
        journeyActors: null,
      },
      'test rationale',
    );

    expect(questionSet.lenses).toHaveLength(6);
    expect(questionSet.lenses.every((lens) => lens.questions.length === 5)).toBe(true);
    expect(questionSet.lenses[1].questions[0].text).toContain('day-to-day work');
  });

  it('builds an operations discovery set that passes validation end to end', () => {
    const questionSet = buildContextualOperationsDiscoveryQuestionSet(
      CANONICAL_LENSES.map((lens) => lens.name),
      {
        workshopId: 'ws-operations-validated',
        workshopType: 'OPERATIONS',
        workshopPurpose: 'Reduce handoff friction and improve service reliability in the contact centre.',
        desiredOutcomes: 'Identify the main bottlenecks, repeat rework, and operational constraints.',
        clientName: 'ServiceCo',
        industry: 'Customer Operations',
        companyWebsite: null,
        dreamTrack: 'ENTERPRISE',
        targetDomain: null,
        engagementType: null,
        domainPack: null,
        domainPackConfig: null,
        blueprint: null,
        historicalMetrics: null,
      },
      {
        companyOverview: 'ServiceCo runs a large customer operation with visible workflow friction.',
        industryContext: 'The operation depends on clean handoffs, stable systems, and reliable queue flow.',
        keyPublicChallenges: [],
        recentDevelopments: [],
        competitorLandscape: 'Peers are reducing service delay and rework.',
        domainInsights: null,
        researchedAtMs: Date.now(),
        sourceUrls: [],
        keyFacilitatorInsight: 'The room needs to isolate where work gets stuck and repeated.',
        strategicTensions: ['Queue stability versus responsiveness'],
        workshopBrief: 'The workshop must surface the biggest bottlenecks, control friction, and system issues.',
        workshopHypotheses: ['Handoffs and rework are weakening execution reliability'],
        expectedRoomTensions: null,
        workshopImplications: null,
        journeyStages: null,
        industryDimensions: null,
        actorTaxonomy: null,
        journeyActors: null,
      },
      'test rationale',
    );

    const issues = questionSet.lenses.flatMap((lens) =>
      lens.questions.flatMap((question) =>
        validateDiscoveryQuestion(lens.key, question, { workshopType: 'OPERATIONS' }),
      ),
    );

    expect(issues).toEqual([]);
  });

  it('builds an AI discovery set from workshop context instead of the generic path', () => {
    const questionSet = buildContextualAiDiscoveryQuestionSet(
      CANONICAL_LENSES.map((lens) => lens.name),
      {
        workshopId: 'ws-ai',
        workshopType: 'AI',
        workshopPurpose: 'Identify where AI can improve service quality without creating governance or trust risk.',
        desiredOutcomes: 'Surface the strongest use cases, implementation blockers, and adoption risks.',
        clientName: 'AssistCo',
        industry: 'Service Operations',
        companyWebsite: null,
        dreamTrack: 'ENTERPRISE',
        targetDomain: null,
        engagementType: null,
        domainPack: null,
        domainPackConfig: null,
        blueprint: null,
        historicalMetrics: null,
      },
      {
        companyOverview: 'AssistCo is exploring AI-assisted workflows.',
        industryContext: 'The business needs to improve service quality while managing governance and trust.',
        keyPublicChallenges: [],
        recentDevelopments: [],
        competitorLandscape: 'Peers are piloting AI copilots and automation.',
        domainInsights: null,
        researchedAtMs: Date.now(),
        sourceUrls: [],
        keyFacilitatorInsight: 'The room needs to distinguish real AI value from hype.',
        strategicTensions: ['Speed of adoption versus control and trust'],
        workshopBrief: 'The workshop must surface use-case fit, readiness, governance, and implementation blockers.',
        workshopHypotheses: ['Data and exception handling will limit several AI ideas'],
        expectedRoomTensions: null,
        workshopImplications: null,
        journeyStages: null,
        industryDimensions: null,
        actorTaxonomy: null,
        journeyActors: null,
      },
      'test rationale',
    );

    expect(questionSet.lenses).toHaveLength(6);
    expect(questionSet.lenses.every((lens) => lens.questions.length === 5)).toBe(true);
    expect(questionSet.lenses[2].questions[0].text).toContain('AI');
  });

  it('builds an AI discovery set that passes validation end to end', () => {
    const questionSet = buildContextualAiDiscoveryQuestionSet(
      CANONICAL_LENSES.map((lens) => lens.name),
      {
        workshopId: 'ws-ai-validated',
        workshopType: 'AI',
        workshopPurpose: 'Identify where AI can improve service quality without creating governance or trust risk.',
        desiredOutcomes: 'Surface the strongest use cases, implementation blockers, and adoption risks.',
        clientName: 'AssistCo',
        industry: 'Service Operations',
        companyWebsite: null,
        dreamTrack: 'ENTERPRISE',
        targetDomain: null,
        engagementType: null,
        domainPack: null,
        domainPackConfig: null,
        blueprint: null,
        historicalMetrics: null,
      },
      {
        companyOverview: 'AssistCo is exploring AI-assisted workflows.',
        industryContext: 'The business needs to improve service quality while managing governance and trust.',
        keyPublicChallenges: [],
        recentDevelopments: [],
        competitorLandscape: 'Peers are piloting AI copilots and automation.',
        domainInsights: null,
        researchedAtMs: Date.now(),
        sourceUrls: [],
        keyFacilitatorInsight: 'The room needs to distinguish real AI value from hype.',
        strategicTensions: ['Speed of adoption versus control and trust'],
        workshopBrief: 'The workshop must surface use-case fit, readiness, governance, and implementation blockers.',
        workshopHypotheses: ['Data and exception handling will limit several AI ideas'],
        expectedRoomTensions: null,
        workshopImplications: null,
        journeyStages: null,
        industryDimensions: null,
        actorTaxonomy: null,
        journeyActors: null,
      },
      'test rationale',
    );

    const issues = questionSet.lenses.flatMap((lens) =>
      lens.questions.flatMap((question) =>
        validateDiscoveryQuestion(lens.key, question, { workshopType: 'AI' }),
      ),
    );

    expect(issues).toEqual([]);
  });

  it('builds a Finance discovery set from workshop context instead of the generic path', () => {
    const questionSet = buildContextualFinanceDiscoveryQuestionSet(
      CANONICAL_LENSES.map((lens) => lens.name),
      {
        workshopId: 'ws-finance',
        workshopType: 'FINANCE',
        workshopPurpose: 'Reduce cost-to-serve, remove value leakage, and stop accepting weak-fit work.',
        desiredOutcomes: 'Identify wasted effort, weak economics, and the highest-return changes.',
        clientName: 'ValueCo',
        industry: 'Business Services',
        companyWebsite: null,
        dreamTrack: 'ENTERPRISE',
        targetDomain: null,
        engagementType: null,
        domainPack: null,
        domainPackConfig: null,
        blueprint: null,
        historicalMetrics: null,
      },
      {
        companyOverview: 'ValueCo is trying to reduce avoidable effort and improve the economics of delivery.',
        industryContext: 'The business needs to reduce rework, control drag, and unattractive work without weakening service.',
        keyPublicChallenges: [],
        recentDevelopments: [],
        competitorLandscape: 'Peers are reducing waste and improving delivery economics faster.',
        domainInsights: null,
        researchedAtMs: Date.now(),
        sourceUrls: [],
        keyFacilitatorInsight: 'The room needs to isolate where value leaks out of the work.',
        strategicTensions: ['Growth versus cost-to-serve discipline'],
        workshopBrief: 'The workshop must surface wasted effort, weak-fit work, and the biggest value-leakage points.',
        workshopHypotheses: ['Rework and weak-fit work are weakening economics'],
        expectedRoomTensions: null,
        workshopImplications: null,
        journeyStages: null,
        industryDimensions: null,
        actorTaxonomy: null,
        journeyActors: null,
      },
      'test rationale',
    );

    expect(questionSet.lenses).toHaveLength(6);
    expect(questionSet.lenses.every((lens) => lens.questions.length === 5)).toBe(true);
    expect(questionSet.lenses[0].questions[0].text).toContain('value leakage');
  });

  it('builds a Finance discovery set that passes validation end to end', () => {
    const questionSet = buildContextualFinanceDiscoveryQuestionSet(
      CANONICAL_LENSES.map((lens) => lens.name),
      {
        workshopId: 'ws-finance-validated',
        workshopType: 'FINANCE',
        workshopPurpose: 'Reduce cost-to-serve, remove value leakage, and stop accepting weak-fit work.',
        desiredOutcomes: 'Identify wasted effort, weak economics, and the highest-return changes.',
        clientName: 'ValueCo',
        industry: 'Business Services',
        companyWebsite: null,
        dreamTrack: 'ENTERPRISE',
        targetDomain: null,
        engagementType: null,
        domainPack: null,
        domainPackConfig: null,
        blueprint: null,
        historicalMetrics: null,
      },
      {
        companyOverview: 'ValueCo is trying to reduce avoidable effort and improve the economics of delivery.',
        industryContext: 'The business needs to reduce rework, control drag, and unattractive work without weakening service.',
        keyPublicChallenges: [],
        recentDevelopments: [],
        competitorLandscape: 'Peers are reducing waste and improving delivery economics faster.',
        domainInsights: null,
        researchedAtMs: Date.now(),
        sourceUrls: [],
        keyFacilitatorInsight: 'The room needs to isolate where value leaks out of the work.',
        strategicTensions: ['Growth versus cost-to-serve discipline'],
        workshopBrief: 'The workshop must surface wasted effort, weak-fit work, and the biggest value-leakage points.',
        workshopHypotheses: ['Rework and weak-fit work are weakening economics'],
        expectedRoomTensions: null,
        workshopImplications: null,
        journeyStages: null,
        industryDimensions: null,
        actorTaxonomy: null,
        journeyActors: null,
      },
      'test rationale',
    );

    const issues = questionSet.lenses.flatMap((lens) =>
      lens.questions.flatMap((question) =>
        validateDiscoveryQuestion(lens.key, question, { workshopType: 'FINANCE' }),
      ),
    );

    expect(issues).toEqual([]);
  });

  it('accepts commercial GTM questions that surface win/loss or buyer value patterns', () => {
    const issues = validateDiscoveryQuestion(
      'Commercial',
      makeQuestion({
        text: 'Who do you win with most often, and what do those buyers seem to value when they choose you?',
        tag: 'gaps',
      }),
      { workshopType: 'GO_TO_MARKET' },
    );

    expect(issues).toEqual([]);
  });

  it('accepts GTM operations questions that connect delivery reality to what was sold', () => {
    const issues = validateDiscoveryQuestion(
      'Operations',
      makeQuestion({
        tag: 'triple_rating',
        text: 'Based on what you see in day-to-day work, where is delivery against what was sold today, where should it be, and where will it end up if nothing changes?',
        purpose: 'Assess how reliably delivery supports what the business is trying to sell.',
        maturityScale: [
          'What gets sold is regularly beyond what delivery can support, creating churn and loss of trust.',
          'Some deals can be delivered well, but commitments are inconsistent and buyer expectations are often reset late.',
          'Most sold work can be delivered, though handoffs and scope realism still weaken some accounts.',
          'Sales and delivery are usually aligned, and most clients get what they expected with limited friction.',
          'The delivery model consistently supports the proposition, reinforcing renewals, references, and commercial credibility.',
        ],
      }),
      { workshopType: 'GO_TO_MARKET' },
    );

    expect(issues).toEqual([]);
  });

  it('rejects generic operational maturity wording in GTM mode', () => {
    const issues = validateDiscoveryQuestion(
      'Operations',
      makeQuestion({
        text: 'How mature are your operational processes?',
        purpose: 'Assess process maturity.',
      }),
      { workshopType: 'GO_TO_MARKET' },
    );

    expect(issues).toContain('uses generic maturity or efficiency language instead of market-facing commercial language');
    expect(issues).toContain('for GTM workshops, Operations must ask how delivery capability shapes what can be sold, or where delivery breaks what was sold');
    expect(issues).toContain('for GTM workshops, question must force evidence from wins, losses, live deals, buyer behaviour, or delivery-against-promise reality');
  });

  it('still rejects revenue/pricing language outside GTM workshops', () => {
    const issues = validateDiscoveryQuestion(
      'Commercial',
      makeQuestion({
        text: 'Where do you see pricing pressure affecting revenue quality the most?',
      }),
      { workshopType: 'OPERATIONS' },
    );

    expect(issues).toContain('contains financial terminology');
  });

  it('builds a valid deterministic GTM question set shape from the gold dataset', () => {
    const questionSet = sanitizeDiscoveryQuestionSet({
      lenses: CANONICAL_LENSES.map((lens) => ({
        key: lens.name,
        label: lens.name,
        questions: [
          makeQuestion({
            tag: 'triple_rating',
            text: `Based on recent wins, losses, and live deals, where is ${lens.name.toLowerCase()} today, where should it be, and where will it end up if nothing changes?`,
            purpose: 'Test triple rating',
            maturityScale: [
              'Commercially weak',
              'Partially improving',
              'Commercially usable',
              'Commercially strong in many deals',
              'Commercially differentiating and consistent',
            ],
          }),
          makeQuestion({ text: 'Across recent wins and losses, what pattern matters most here?', tag: 'gaps' }),
          makeQuestion({ text: 'Where does this lens create a gap between what is sold and what is delivered?', tag: 'constraint' }),
          makeQuestion({ text: 'What pain points show up most clearly in weaker deals?', tag: 'pain_points' }),
          makeQuestion({ text: 'Where do the strongest deals show a stronger pattern than the rest?', tag: 'working' }),
        ],
      })),
      generatedAtMs: Date.now(),
      agentRationale: 'test',
      facilitatorDirection: null,
    }, {
      lenses: CANONICAL_LENSES.map((lens) => ({ name: lens.name })),
    } as any);

    expect(questionSet?.lenses).toHaveLength(6);
    expect(questionSet?.lenses.every((lens) => lens.questions.length === 5)).toBe(true);
  });

  it('builds different GTM wording for different workshop contexts instead of reusing a fixed set', () => {
    const capitaSet = buildContextualGtmDiscoveryQuestionSet(
      CANONICAL_LENSES.map((lens) => lens.name),
      {
        workshopId: 'ws-capita',
        workshopType: 'GO_TO_MARKET',
        workshopPurpose: 'Define a differentiated go-to-market strategy for Capita in BPO and outsourcing.',
        desiredOutcomes: 'Clarify ICP, sharpen the proposition, and identify where delivery limits what can be sold.',
        clientName: 'Capita',
        industry: 'BPO & Outsourcing',
        companyWebsite: null,
        dreamTrack: 'ENTERPRISE',
        targetDomain: null,
        engagementType: null,
        domainPack: null,
        domainPackConfig: null,
        blueprint: null,
        historicalMetrics: null,
      },
      {
        companyOverview: 'Capita is strengthening an AI-led BPO proposition across public-sector service lines.',
        industryContext: 'The BPO market is highly competitive and buyers compare delivery credibility closely.',
        keyPublicChallenges: [],
        recentDevelopments: [],
        competitorLandscape: 'Competitors include Teleperformance, Concentrix, and Genpact.',
        domainInsights: null,
        researchedAtMs: Date.now(),
        sourceUrls: [],
        keyFacilitatorInsight: 'Capita needs to decide which buyers fit its proposition and which deals should be avoided.',
        strategicTensions: ['Public-sector credibility versus delivery flexibility'],
        workshopBrief: 'The workshop must identify who to target, what to package, and where overpromise risk sits.',
        workshopHypotheses: ['Delivery credibility shapes win quality'],
        expectedRoomTensions: null,
        workshopImplications: null,
        journeyStages: null,
        industryDimensions: null,
        actorTaxonomy: null,
        journeyActors: null,
      },
      'test rationale',
    );

    const fintechSet = buildContextualGtmDiscoveryQuestionSet(
      CANONICAL_LENSES.map((lens) => lens.name),
      {
        workshopId: 'ws-fintech',
        workshopType: 'GO_TO_MARKET',
        workshopPurpose: 'Refocus the market strategy for a payments platform selling into mid-market software vendors.',
        desiredOutcomes: 'Define the right segments, reduce deal slippage, and tighten the commercial story around embedded payments.',
        clientName: 'FluxPay',
        industry: 'Embedded Payments',
        companyWebsite: null,
        dreamTrack: 'ENTERPRISE',
        targetDomain: null,
        engagementType: null,
        domainPack: null,
        domainPackConfig: null,
        blueprint: null,
        historicalMetrics: null,
      },
      {
        companyOverview: 'FluxPay sells embedded payments infrastructure to SaaS companies.',
        industryContext: 'Buyers compare platform reliability, partner reach, and speed to launch.',
        keyPublicChallenges: [],
        recentDevelopments: [],
        competitorLandscape: 'Competitors include Stripe, Adyen, and Checkout.com.',
        domainInsights: null,
        researchedAtMs: Date.now(),
        sourceUrls: [],
        keyFacilitatorInsight: 'FluxPay must sharpen which software platforms it can win with credibly.',
        strategicTensions: ['Fast onboarding versus platform control'],
        workshopBrief: 'This workshop should surface ICP boundaries and where partner reliance weakens the offer.',
        workshopHypotheses: ['Technical proof is deciding more deals than price'],
        expectedRoomTensions: null,
        workshopImplications: null,
        journeyStages: null,
        industryDimensions: null,
        actorTaxonomy: null,
        journeyActors: null,
      },
      'test rationale',
    );

    const capitaQuestions = capitaSet.lenses.flatMap((lens) => lens.questions.map((question) => question.text));
    const fintechQuestions = fintechSet.lenses.flatMap((lens) => lens.questions.map((question) => question.text));

    expect(capitaQuestions).not.toEqual(fintechQuestions);
    expect(capitaQuestions.join(' ')).toContain('Capita');
    expect(capitaQuestions.join(' ')).toContain('BPO');
    expect(fintechQuestions.join(' ')).toContain('FluxPay');
    expect(fintechQuestions.join(' ')).toContain('payments');
  });
});
