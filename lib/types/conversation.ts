import {
  canonicalizeConversationPhase,
  type CanonicalConversationPhase,
} from '@/lib/workshop/canonical-lenses';

export type ConversationPhase =
  | 'intro'
  | CanonicalConversationPhase
  | 'prioritization'
  | 'summary';

export function normalizeConversationPhase(
  phase: unknown,
): ConversationPhase {
  const raw = typeof phase === 'string' ? phase.trim().toLowerCase() : '';
  if (raw === 'intro' || raw === 'prioritization' || raw === 'summary') {
    return raw;
  }
  return canonicalizeConversationPhase(raw) ?? 'intro';
}

export interface ConversationState {
  sessionId: string;
  workshopId: string;
  participantId: string;
  currentPhase: ConversationPhase;
  phaseProgress: number;
  messageHistory: Message[];
  extractedInsights: ExtractedInsight[];
  attributionPreference: 'NAMED' | 'ANONYMOUS';
  startedAt: Date;
  lastMessageAt: Date;
}

export interface Message {
  id: string;
  role: 'AI' | 'PARTICIPANT';
  content: string;
  phase?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ExtractedInsight {
  type: 'ACTUAL_JOB' | 'WHAT_WORKS' | 'CHALLENGE' | 'CONSTRAINT' | 'VISION' | 'BELIEF' | 'RATING';
  category?: 'BUSINESS' | 'TECHNOLOGY' | 'PEOPLE' | 'CUSTOMER' | 'REGULATION';
  text: string;
  severity?: number;
  impact?: string;
  sourceMessageIds: string[];
  confidence: number;
}

export interface DepthAnalysis {
  hasSpecificExample: boolean;
  hasQuantification: boolean;
  hasNamedEntities: boolean;
  wordCount: number;
  depthScore: number;
  needsFollowUp: boolean;
  suggestedFollowUp?: string;
}

export interface PhaseConfig {
  name: ConversationPhase;
  displayName: string;
  objective: string;
  minimumInsights: number;
  estimatedDuration: string;
}

export const PHASE_CONFIGS: Record<ConversationPhase, PhaseConfig> = {
  intro: {
    name: 'intro',
    displayName: 'Introduction',
    objective: 'Understand their role and set context',
    minimumInsights: 0,
    estimatedDuration: '1 min',
  },
  people: {
    name: 'people',
    displayName: 'People',
    objective: 'Explore capacity, skills, roles, culture, and collaboration',
    minimumInsights: 3,
    estimatedDuration: '3 min',
  },
  operations: {
    name: 'operations',
    displayName: 'Operations',
    objective: 'Understand process flow, governance, delivery execution, and operating discipline',
    minimumInsights: 3,
    estimatedDuration: '3 min',
  },
  technology: {
    name: 'technology',
    displayName: 'Technology',
    objective: 'Assess systems, data, tools, and technical capability',
    minimumInsights: 3,
    estimatedDuration: '3 min',
  },
  commercial: {
    name: 'commercial',
    displayName: 'Commercial',
    objective: 'Explore value delivery, market demand, customer outcomes, and growth logic',
    minimumInsights: 3,
    estimatedDuration: '3 min',
  },
  risk_compliance: {
    name: 'risk_compliance',
    displayName: 'Risk / Compliance',
    objective: 'Understand compliance obligations, control requirements, and risk exposure',
    minimumInsights: 3,
    estimatedDuration: '3 min',
  },
  partners: {
    name: 'partners',
    displayName: 'Partners',
    objective: 'Explore external dependencies, partner performance, and ecosystem constraints',
    minimumInsights: 3,
    estimatedDuration: '3 min',
  },
  prioritization: {
    name: 'prioritization',
    displayName: 'Prioritization',
    objective: 'Identify top priorities across all competency areas',
    minimumInsights: 2,
    estimatedDuration: '1 min',
  },
  summary: {
    name: 'summary',
    displayName: 'Summary',
    objective: 'Confirm understanding and thank participant',
    minimumInsights: 0,
    estimatedDuration: '1 min',
  },
};
