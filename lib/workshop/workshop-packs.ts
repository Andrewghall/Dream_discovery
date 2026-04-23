import {
  inferCanonicalWorkshopType,
  type CanonicalWorkshopType,
} from '@/lib/workshop/workshop-definition';

export type WorkshopPack = {
  key: CanonicalWorkshopType;
  label: string;
  referenceModel: 'baseline' | 'specialized';
  structuralFocus: string;
  researchDirective: string;
  discoveryDirective: string;
  validationDirective: string;
};

export const WORKSHOP_PACKS: Record<CanonicalWorkshopType, WorkshopPack> = {
  TRANSFORMATION: {
    key: 'TRANSFORMATION',
    label: 'Transformation',
    referenceModel: 'baseline',
    structuralFocus: 'Transformation structure: future-state definition, operating model shifts, strategic dependencies, and change sequencing.',
    researchDirective:
      'Research through the transformation contract. Surface the future-state pressure, the structural blockers to change, the contradictions between ambition and operating reality, and the dependencies that will determine whether change sticks.',
    discoveryDirective:
      'Discovery for Transformation must surface what blocks, slows, or distorts the move from current state to future state. Each lens should reveal change-readiness, dependency risk, credibility gaps, and where the current model cannot support the target model.',
    validationDirective:
      'Transformation questions must expose blockers, future-state gaps, dependency tensions, change friction, or credibility risks. Reject generic maturity wording that is disconnected from change or future-state consequence.',
  },
  OPERATIONS: {
    key: 'OPERATIONS',
    label: 'Operations',
    referenceModel: 'specialized',
    structuralFocus: 'Operations structure: current execution issues, bottlenecks, root causes, and practical service improvement.',
    researchDirective:
      'Research through the operations contract. Surface bottlenecks, repeat failure modes, execution friction, service-quality constraints, and the operational trade-offs that most affect performance.',
    discoveryDirective:
      'Discovery for Operations must reveal where work gets stuck, repeated, delayed, or handed around. Each lens should explain execution reliability, service impact, and what constrains improvement in practice.',
    validationDirective:
      'Operations questions must stay tied to flow, bottlenecks, handoffs, rework, service performance, and execution consequences. Reject vague strategy or generic maturity language.',
  },
  AI: {
    key: 'AI',
    label: 'AI',
    referenceModel: 'specialized',
    structuralFocus: 'AI structure: readiness, use-case identification, enablement gaps, and implementation direction.',
    researchDirective:
      'Research through the AI contract. Surface real AI readiness, candidate use cases, adoption blockers, data and platform constraints, governance risk, and where expectations are ahead of reality.',
    discoveryDirective:
      'Discovery for AI must reveal where AI could genuinely improve work, where the operating environment is not ready, and where data, tooling, governance, or capability gaps would block implementation.',
    validationDirective:
      'AI questions must link the lens to readiness, use-case fit, implementation feasibility, or adoption risk. Reject generic technology maturity questions that do not explain AI consequence.',
  },
  GO_TO_MARKET: {
    key: 'GO_TO_MARKET',
    label: 'Go-To-Market / ICP',
    referenceModel: 'specialized',
    structuralFocus: 'Go-to-market structure: ICP clarity, proposition, market positioning, revenue motions, and growth priorities.',
    researchDirective:
      'Research through the GTM/ICP contract. Surface who this business wins with, who it loses with, where the proposition is credible or weak, where delivery constrains selling, and which segments represent right-to-win versus anti-ICP.',
    discoveryDirective:
      'Discovery for GTM/ICP must reveal commercial truth, not operational maturity. Each lens must answer how this area affects who the business should target, who it should avoid, why deals are won or lost, where the proposition breaks, and where scale or delivery constraints distort GTM.',
    validationDirective:
      'GTM/ICP questions must expose win/loss patterns, buyer value, ICP fit, anti-ICP signals, overpromise risk, delivery-against-sale tension, or scale constraints. Reject generic process, capability, support, or day-to-day maturity phrasing unless directly tied to commercial consequence.',
  },
  FINANCE: {
    key: 'FINANCE',
    label: 'Finance / Value Optimisation',
    referenceModel: 'specialized',
    structuralFocus: 'Finance structure: value leakage, financial performance, cost-to-serve, and prioritised value improvement.',
    researchDirective:
      'Research through the finance/value contract. Surface value leakage, cost-to-serve pressure, margin erosion, economically weak work types, and where financial reality diverges from perceived performance.',
    discoveryDirective:
      'Discovery for Finance must reveal where effort fails to convert into value, which clients or work types are economically unattractive, and where waste, rework, or decision patterns erode margin and value realisation.',
    validationDirective:
      'Finance questions must expose value leakage, cost-to-serve, unattractive work, waste, rework, or financial trade-off signals. Reject generic operational maturity questions that do not connect to value consequence.',
  },
};

export function getWorkshopPack(workshopType: string | null | undefined): WorkshopPack {
  const key = inferCanonicalWorkshopType({ workshopType });
  return WORKSHOP_PACKS[key];
}
