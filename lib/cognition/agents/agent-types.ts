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
// TAILORED QUESTION SET — Output of Question Set Agent
// ══════════════════════════════════════════════════════════

export type TailoredQuestion = {
  phase: string;
  text: string;
  tag: string;
  maturityScale?: string[];
  tailoringNote?: string;
  isModified: boolean;
};

export type TailoredQuestionSet = {
  questions: Record<string, TailoredQuestion[]>;
  tailoringSummary: string;
  generatedAtMs: number;
};

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
