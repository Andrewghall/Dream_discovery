/**
 * Sales Analysis — Type Definitions
 *
 * All AI-powered analysis is now handled by the agentic agent:
 * - Real-time call analysis: lib/agents/sales-call-agent.ts → analyzeSalesUtteranceAgentically()
 * - Pre-call strategy: lib/agents/sales-call-agent.ts → generateAgenticStrategy()
 * - Post-call synthesis: lib/agents/sales-call-agent.ts → synthesizeSalesCallAgentically()
 *
 * This file retains only the shared type interfaces used across the sales UI and API routes.
 */

export interface MeetingPlan {
  // The Opportunity
  customerName?: string;
  industry?: string;
  companySize?: string;
  opportunityName?: string;
  estimatedValue?: string;
  dealStage?: string;
  opportunityOrigin?: string;
  crmLink?: string;
  // Why This Meeting
  meetingIntent?: string;
  meetingTrigger?: string;
  salesProcessPosition?: string;
  requiredNextStep?: string;
  // The Goal
  primaryGoal?: string;
  secondaryGoals?: string;
  endInMind?: string;
  minimumOutcome?: string;
  definitionOfFailure?: string;
  // The People
  ourAttendees?: string;
  theirAttendees?: string;
  keyDecisionMaker?: string;
  keyInfluencer?: string;
  champion?: string;
  blocker?: string;
  // The Customer's World
  knownPainPoints?: string;
  currentSolution?: string;
  businessDrivers?: string;
  successCriteria?: string;
  budget?: string;
  timeline?: string;
  internalPolitics?: string;
  // Our Position
  solutionsToDiscuss?: string;
  valueProposition?: string;
  keyDifferentiators?: string;
  proofPoints?: string;
  pricingApproach?: string;
  // The Competition
  knownCompetitors?: string;
  ourStrengths?: string;
  ourWeaknesses?: string;
  customerSaidAboutAlternatives?: string;
  competitiveTraps?: string;
  // Anticipated Objections
  anticipatedObjections?: string;
  commonStalls?: string;
  technicalConcerns?: string;
  pricingObjections?: string;
  // Must-Ask Questions
  discoveryQuestions?: string;
  qualificationQuestions?: string;
  hiddenConcernQuestions?: string;
  dealAdvanceQuestions?: string;
  // Approach & Strategy
  openingApproach?: string;
  agendaSuggestion?: string;
  keyTalkingPoints?: string;
  storiesAnalogies?: string;
  presentVsListen?: string;
  handleSilence?: string;
  closingApproach?: string;
}

export interface SalesIntelligence {
  customerIntent: 'interested' | 'exploring' | 'hesitant' | 'objecting' | 'ready_to_buy' | 'neutral';
  emotionalTone: 'positive' | 'neutral' | 'concerned' | 'critical';
  toneTrend: 'improving' | 'stable' | 'declining';
  topicsDetected: TopicDetection[];
  coachingPrompts: CoachingPrompt[];
  planCoverage: PlanCoverageItem[];
}

export interface TopicDetection {
  topic: string;
  category: 'needs' | 'budget' | 'timeline' | 'competition' | 'decision_process' | 'objection' | 'buying_signal' | 'other';
  evidence: string;
  timestamp?: number;
}

export interface CoachingPrompt {
  id: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  source: 'plan' | 'live' | 'system';
  dismissed?: boolean;
}

export interface PlanCoverageItem {
  item: string;
  category: 'objective' | 'question' | 'talking_point' | 'objection_prep';
  covered: boolean;
  evidence?: string;
}
