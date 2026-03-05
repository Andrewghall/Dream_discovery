export type SentimentTone = 'positive' | 'neutral' | 'concerned' | 'critical';

export interface AgenticDiscoveryPrediction {
  sentimentTone: string;
  domains: string[];
  themes: string[];
  overallConfidence: number;
}

export interface AgenticDiscoveryGold {
  id: string;
  note?: string;
  expected: {
    sentimentTone: SentimentTone;
    domains: string[];
    themes: string[];
    confidenceRange?: {
      min: number;
      max: number;
    };
  };
}

export interface DiscoveryEvalCase {
  id: string;
  gold: AgenticDiscoveryGold;
  prediction: AgenticDiscoveryPrediction;
}

export interface DiscoveryCaseScore {
  id: string;
  score: number;
  sentimentMatch: boolean;
  domainsJaccard: number;
  themesJaccard: number;
  confidenceInRange: boolean;
  themeRecall: number;
  sentimentPenaltyApplied: boolean;
  themeMissedPenaltyApplied: boolean;
}

export interface DiscoveryEvalReport {
  overallScore: number;
  pass: boolean;
  threshold: number;
  cases: DiscoveryCaseScore[];
}

// ---- Sales eval types ----

export type SalesIntent =
  | 'interested'
  | 'exploring'
  | 'hesitant'
  | 'objecting'
  | 'ready_to_buy'
  | 'neutral';

export type SalesTopicCategory =
  | 'needs'
  | 'budget'
  | 'timeline'
  | 'competition'
  | 'decision_process'
  | 'objection'
  | 'buying_signal'
  | 'other';

export type CoachingPriority = 'high' | 'medium' | 'low';

export type DealHealth = 'Hot' | 'Warm' | 'Cool' | 'Cold';

export interface SalesEvalPrediction {
  customerIntent: string;
  sentimentTone: string;
  topics: string[];
  coachingTriggered: boolean;
  coachingPriority: string | null;
  dealHealth: string;
  overallConfidence: number;
}

export interface SalesEvalGold {
  id: string;
  note?: string;
  expected: {
    customerIntent: SalesIntent;
    sentimentTone: SentimentTone;
    topics: SalesTopicCategory[];
    coachingTriggered: boolean;
    coachingPriority: CoachingPriority | null;
    dealHealth: DealHealth;
    confidenceRange?: {
      min: number;
      max: number;
    };
  };
}

export interface SalesEvalCase {
  id: string;
  gold: SalesEvalGold;
  prediction: SalesEvalPrediction;
}

export interface SalesCaseScore {
  id: string;
  score: number;
  intentMatch: boolean;
  sentimentMatch: boolean;
  topicsJaccard: number;
  topicRecall: number;
  coachingScore: number;
  dealHealthMatch: boolean;
  confidenceInRange: boolean;
  intentPenaltyApplied: boolean;
  topicMissedPenaltyApplied: boolean;
}

export interface SalesEvalReport {
  overallScore: number;
  pass: boolean;
  threshold: number;
  cases: SalesCaseScore[];
}
