import type { CanonicalWorkshopType } from '@/lib/workshop/workshop-definition';

export type LivePhaseContract = {
  workshopType: CanonicalWorkshopType;
  phase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';
  objective: string;
  requiredMoves: string[];
  forbiddenDrift: string[];
};

const GTM_LIVE_CONTRACTS: LivePhaseContract[] = [
  {
    workshopType: 'GO_TO_MARKET',
    phase: 'REIMAGINE',
    objective: 'Get the room to define what strong market position, right-to-win, and credible value would look like if commercial friction and legacy constraints were removed.',
    requiredMoves: [
      'Clarify who the business should most want to win with',
      'Surface what buyers would value most in the future-state proposition',
      'Keep the discussion market-facing, not internally maturity-led',
    ],
    forbiddenDrift: [
      'generic future-state operating model discussion detached from market outcomes',
      'internal process redesign without commercial consequence',
      'technology brainstorming without proposition relevance',
    ],
  },
  {
    workshopType: 'GO_TO_MARKET',
    phase: 'CONSTRAINTS',
    objective: 'Map what stops the business from winning, qualifying, selling, and delivering the right work consistently today.',
    requiredMoves: [
      'Expose sold-versus-delivered tension',
      'Surface ICP and anti-ICP evidence',
      'Identify what weakens buyer trust, proposition credibility, or deal viability',
    ],
    forbiddenDrift: [
      'generic bottleneck mapping with no deal consequence',
      'broad capability debates without win/loss evidence',
      'constraint discussion that ignores buyer, client, or deal reality',
    ],
  },
  {
    workshopType: 'GO_TO_MARKET',
    phase: 'DEFINE_APPROACH',
    objective: 'Build a practical GTM approach that improves targeting, proposition clarity, qualification, delivery credibility, and commercial repeatability.',
    requiredMoves: [
      'Turn constraints into a practical path to win the right work',
      'Prioritise actions that strengthen proposition credibility and deal quality',
      'Sequence moves that improve qualification, delivery confidence, and repeatability',
    ],
    forbiddenDrift: [
      'generic action planning detached from ICP or proposition',
      'ownership discussion with no practical move',
      'solutioning that ignores the evidence surfaced in discovery and constraints',
    ],
  },
];

const TRANSFORMATION_LIVE_CONTRACTS: LivePhaseContract[] = [
  {
    workshopType: 'TRANSFORMATION',
    phase: 'REIMAGINE',
    objective: 'Get the room to define the future state clearly enough that people, operating model, technology, governance, and external dependencies can be designed toward it.',
    requiredMoves: [
      'Describe what the future state must feel like for customers and teams',
      'Clarify what must be fundamentally different from today',
      'Keep the discussion anchored in real transformation outcomes, not generic aspiration',
    ],
    forbiddenDrift: [
      'vague vision statements with no operating consequence',
      'generic innovation language detached from the target model',
      'future-state discussion that ignores how the business actually needs to change',
    ],
  },
  {
    workshopType: 'TRANSFORMATION',
    phase: 'CONSTRAINTS',
    objective: 'Map the structural, behavioural, technical, governance, and dependency blockers that would stop the future state from landing.',
    requiredMoves: [
      'Expose where the current model cannot support the target state',
      'Identify change-readiness and credibility gaps',
      'Surface the dependencies, approvals, and external blockers that will shape transformation pace',
    ],
    forbiddenDrift: [
      'generic bottleneck lists with no future-state consequence',
      'complaint collection that is not tied to transformation risk',
      'constraint mapping that ignores dependency or sequencing risk',
    ],
  },
  {
    workshopType: 'TRANSFORMATION',
    phase: 'DEFINE_APPROACH',
    objective: 'Build a practical transformation path that sequences the right changes, manages dependency risk, and makes the future state achievable.',
    requiredMoves: [
      'Turn the discovered blockers into a sequenced change path',
      'Prioritise moves that unlock the future state fastest without losing control',
      'Define what has to change first, what depends on it, and what makes the change credible',
    ],
    forbiddenDrift: [
      'generic action planning detached from the target state',
      'solutioning that ignores the blocker evidence surfaced earlier',
      'ownership discussion with no sequencing or dependency logic',
    ],
  },
];

const OPERATIONS_LIVE_CONTRACTS: LivePhaseContract[] = [
  {
    workshopType: 'OPERATIONS',
    phase: 'REIMAGINE',
    objective: 'Get the room to describe what smooth, reliable, high-quality execution would look like if day-to-day friction and current bottlenecks were removed.',
    requiredMoves: [
      'Describe what clean service flow should feel like for teams and customers',
      'Clarify what reliable execution would look like end to end',
      'Keep the discussion grounded in operational outcomes rather than abstract aspiration',
    ],
    forbiddenDrift: [
      'generic future-state language detached from service reality',
      'broad strategy discussion with no operational consequence',
      'technology brainstorming that ignores execution flow',
    ],
  },
  {
    workshopType: 'OPERATIONS',
    phase: 'CONSTRAINTS',
    objective: 'Map the bottlenecks, handoff failures, control friction, tool issues, and external dependencies that break execution today.',
    requiredMoves: [
      'Expose where work gets stuck, repeated, delayed, or handed around',
      'Surface the practical causes of service instability and quality loss',
      'Identify which controls, systems, or dependencies most weaken flow',
    ],
    forbiddenDrift: [
      'generic complaints with no observable execution consequence',
      'high-level capability debate detached from lived work',
      'constraint mapping that ignores queues, handoffs, or service flow',
    ],
  },
  {
    workshopType: 'OPERATIONS',
    phase: 'DEFINE_APPROACH',
    objective: 'Build a practical operational improvement path that improves flow, reduces friction, and strengthens day-to-day execution reliability.',
    requiredMoves: [
      'Turn the main bottlenecks into a practical improvement sequence',
      'Prioritise changes that improve flow, handoffs, and service reliability first',
      'Define the first operational moves that make the biggest difference in practice',
    ],
    forbiddenDrift: [
      'generic action plans detached from discovered bottlenecks',
      'ownership talk with no practical change path',
      'solutioning that ignores operational evidence from the room',
    ],
  },
];

const AI_LIVE_CONTRACTS: LivePhaseContract[] = [
  {
    workshopType: 'AI',
    phase: 'REIMAGINE',
    objective: 'Get the room to describe where AI would genuinely make work, service, or decision-making meaningfully better if constraints were removed.',
    requiredMoves: [
      'Describe where AI would improve the work or customer outcome most clearly',
      'Clarify what human work should improve, not just what should be automated',
      'Keep the discussion grounded in practical value rather than hype',
    ],
    forbiddenDrift: [
      'generic innovation aspiration with no use-case consequence',
      'technology wish lists detached from work reality',
      'future-state discussion that treats AI as valuable by default',
    ],
  },
  {
    workshopType: 'AI',
    phase: 'CONSTRAINTS',
    objective: 'Map the workflow, data, governance, technical, behavioural, and external blockers that would stop AI from being useful or safe.',
    requiredMoves: [
      'Expose where data, tooling, controls, or adoption gaps block AI feasibility',
      'Surface where AI would fail because the work is too exception-heavy or poorly structured',
      'Identify trust, governance, and dependency risks that shape what AI can realistically do',
    ],
    forbiddenDrift: [
      'generic technology constraint lists with no AI consequence',
      'broad change debate detached from practical AI use',
      'constraint mapping that ignores data, workflow, or governance reality',
    ],
  },
  {
    workshopType: 'AI',
    phase: 'DEFINE_APPROACH',
    objective: 'Build a practical AI path that prioritises the right use cases, reduces implementation risk, and turns opportunity into an executable sequence.',
    requiredMoves: [
      'Turn the strongest AI opportunities into a practical implementation path',
      'Prioritise what should be piloted, enabled, or avoided first',
      'Sequence the changes in data, tooling, governance, and adoption needed to make AI work',
    ],
    forbiddenDrift: [
      'generic action planning detached from the feasibility evidence',
      'use-case lists with no implementation logic',
      'solutioning that ignores trust, control, or adoption realities',
    ],
  },
];

const FINANCE_LIVE_CONTRACTS: LivePhaseContract[] = [
  {
    workshopType: 'FINANCE',
    phase: 'REIMAGINE',
    objective: 'Get the room to describe what stronger value conversion, lower leakage, and healthier economics would look like if current inefficiencies were removed.',
    requiredMoves: [
      'Describe where effort should convert into stronger value or better economics',
      'Clarify what good work versus weak work should look like',
      'Keep the discussion grounded in value creation rather than abstract finance language',
    ],
    forbiddenDrift: [
      'generic financial aspiration with no operational meaning',
      'broad cost-cutting discussion detached from how value is created',
      'future-state discussion that ignores where effort is currently wasted',
    ],
  },
  {
    workshopType: 'FINANCE',
    phase: 'CONSTRAINTS',
    objective: 'Map the decisions, workflow waste, manual effort, weak-fit work, controls, and dependencies that drive value leakage today.',
    requiredMoves: [
      'Expose where effort, delay, rework, or complexity destroy value',
      'Surface where weak-fit work or poor decisions make economics unattractive',
      'Identify which controls, systems, or dependencies create necessary protection versus avoidable drag',
    ],
    forbiddenDrift: [
      'generic bottleneck mapping with no value consequence',
      'broad finance debate detached from lived work',
      'constraint mapping that ignores waste, rework, or cost-to-serve reality',
    ],
  },
  {
    workshopType: 'FINANCE',
    phase: 'DEFINE_APPROACH',
    objective: 'Build a practical value-improvement path that reduces leakage, improves cost-to-serve, and prioritises the highest-return changes first.',
    requiredMoves: [
      'Turn the main leakage points into a sequenced improvement path',
      'Prioritise changes that improve value conversion and reduce avoidable effort first',
      'Define the first moves that improve economics without weakening service or control',
    ],
    forbiddenDrift: [
      'generic action planning detached from the leakage evidence',
      'cost-cutting ideas with no logic for how value is protected',
      'solutioning that ignores the practical causes of waste and drag',
    ],
  },
];

export function buildLiveWorkshopContractBlock(workshopType: CanonicalWorkshopType): string {
  const contracts = workshopType === 'GO_TO_MARKET'
    ? GTM_LIVE_CONTRACTS
    : workshopType === 'TRANSFORMATION'
      ? TRANSFORMATION_LIVE_CONTRACTS
    : workshopType === 'OPERATIONS'
        ? OPERATIONS_LIVE_CONTRACTS
      : workshopType === 'AI'
        ? AI_LIVE_CONTRACTS
      : workshopType === 'FINANCE'
        ? FINANCE_LIVE_CONTRACTS
      : [];

  if (contracts.length === 0) return '';

  return contracts.map((contract) => [
    `${contract.phase}:`,
    `- Objective: ${contract.objective}`,
    `- Required moves: ${contract.requiredMoves.join('; ')}`,
    `- Forbidden drift: ${contract.forbiddenDrift.join('; ')}`,
  ].join('\n')).join('\n\n');
}
