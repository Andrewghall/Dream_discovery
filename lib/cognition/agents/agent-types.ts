/**
 * Shared types for the DREAM agentic system.
 *
 * Used by both pre-workshop agents (Research, Question Set, Discovery Intelligence)
 * and live workshop agents (Theme, Facilitation, Constraint, Guardian).
 */

import type { AgentConversationEntry } from '@/components/cognitive-guidance/agent-orchestration-panel';

// ══════════════════════════════════════════════════════════
// RE-EXPORT UI TYPE
// ══════════════════════════════════════════════════════════

export type { AgentConversationEntry };

// ══════════════════════════════════════════════════════════
// WORKSHOP PREP RESEARCH — Output of Research Agent
// ══════════════════════════════════════════════════════════

export type WorkshopPrepResearch = {
  companyOverview: string;
  industryContext: string;
  keyPublicChallenges: string[];
  recentDevelopments: string[];
  competitorLandscape: string;
  domainInsights: string | null;
  researchedAtMs: number;
  sourceUrls: string[];
};

// ══════════════════════════════════════════════════════════
// WORKSHOP FACILITATION QUESTIONS — Output of Question Set Agent
// ══════════════════════════════════════════════════════════

export type WorkshopPhase = 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH';

export const WORKSHOP_PHASES: WorkshopPhase[] = ['REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH'];

export const WORKSHOP_PHASE_LABELS: Record<WorkshopPhase, string> = {
  REIMAGINE: 'Reimagine',
  CONSTRAINTS: 'Constraints',
  DEFINE_APPROACH: 'Define Approach',
};

export const WORKSHOP_PHASE_DESCRIPTIONS: Record<WorkshopPhase, string> = {
  REIMAGINE: 'Pure vision without constraints. Get participants to dream big about the ideal future state. Focus on People → Customer → Organisation only. No technology, no regulation — just the art of the possible.',
  CONSTRAINTS: 'Map limitations systematically, working right-to-left: Regulation → Customer → Technology → Organisation → People. Identify what stands in the way of the reimagined vision.',
  DEFINE_APPROACH: 'Build the practical solution left-to-right: People → Organisation → Technology → Customer → Regulation. Design the approach that bridges today to the reimagined future while respecting constraints.',
};

export type FacilitationQuestion = {
  id: string;
  phase: WorkshopPhase;
  lens: LensName | 'General' | null;
  text: string;
  purpose: string;            // Why this question matters — what it aims to surface
  grounding: string;          // How this connects to research/Discovery data
  order: number;
  isEdited: boolean;          // Has the facilitator edited this?
};

export type WorkshopQuestionSet = {
  phases: Record<WorkshopPhase, {
    label: string;
    description: string;
    lensOrder: string[];
    questions: FacilitationQuestion[];
  }>;
  designRationale: string;    // Agent's explanation of the overall question strategy
  generatedAtMs: number;
};

// Legacy alias for backward compatibility with existing stored data
export type TailoredQuestion = FacilitationQuestion;
export type TailoredQuestionSet = WorkshopQuestionSet;

// ══════════════════════════════════════════════════════════
// WORKSHOP INTELLIGENCE — Output of Discovery Intelligence Agent
// ══════════════════════════════════════════════════════════

export type LensName = 'People' | 'Organisation' | 'Customer' | 'Technology' | 'Regulation';

export type MaturitySnapshot = {
  domain: LensName;
  todayMedian: number;
  targetMedian: number;
  projectedMedian: number;
  spread: number;
  narrative: string;
};

export type DiscoveryThemeEntry = {
  title: string;
  domain: LensName | null;
  frequency: number;
  sentiment: 'positive' | 'negative' | 'mixed';
  keyQuotes: string[];
};

export type PainPoint = {
  description: string;
  domain: LensName;
  frequency: number;
  severity: 'critical' | 'significant' | 'moderate';
};

export type DivergenceArea = {
  topic: string;
  perspectives: string[];
};

export type WorkshopIntelligence = {
  maturitySnapshot: MaturitySnapshot[];
  discoveryThemes: DiscoveryThemeEntry[];
  consensusAreas: string[];
  divergenceAreas: DivergenceArea[];
  painPoints: PainPoint[];
  aspirations: string[];
  watchPoints: string[];
  participantCount: number;
  synthesizedAtMs: number;
  briefingSummary: string;
};

// ══════════════════════════════════════════════════════════
// AGENT CALLBACK — for emitting conversation entries
// ══════════════════════════════════════════════════════════

export type AgentConversationCallback = (entry: AgentConversationEntry) => void;

// ══════════════════════════════════════════════════════════
// PREP CONTEXT — shared context passed to all agents
// ══════════════════════════════════════════════════════════

export type PrepContext = {
  workshopId: string;
  clientName: string | null;
  industry: string | null;
  companyWebsite: string | null;
  dreamTrack: 'ENTERPRISE' | 'DOMAIN' | null;
  targetDomain: string | null;
};
