export type ConversationPhase = 
  | 'intro' 
  | 'people' 
  | 'corporate' 
  | 'customer' 
  | 'technology' 
  | 'regulation' 
  | 'prioritization' 
  | 'summary';

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
  metadata?: any;
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
  corporate: {
    name: 'corporate',
    displayName: 'Corporate / Organisational',
    objective: 'Understand policies, governance, structure, and decision-making',
    minimumInsights: 3,
    estimatedDuration: '3 min',
  },
  customer: {
    name: 'customer',
    displayName: 'Customer',
    objective: 'Explore customer expectations, needs, and experience',
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
  regulation: {
    name: 'regulation',
    displayName: 'Regulation / Risk',
    objective: 'Understand compliance, regulatory, and risk constraints',
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
