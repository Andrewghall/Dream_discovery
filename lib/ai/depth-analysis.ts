import { DepthAnalysis } from '../types/conversation';

export function analyzeResponseDepth(
  participantMessage: string,
  conversationContext: {
    currentPhase: string;
    messageCount: number;
  }
): DepthAnalysis {
  // Check for specific examples
  const hasSpecificExample = /for example|last time|when I|recently|yesterday|last week|last month|specific case|instance where/i.test(participantMessage);
  
  // Check for quantification
  const hasQuantification = /\d+|hours?|days?|weeks?|months?|years?|percent|times?|approximately|roughly|about \d/i.test(participantMessage);
  
  // Check for named entities (simple heuristic)
  const hasNamedEntities = /[A-Z][a-z]+\s[A-Z][a-z]+|system|department|team|process|tool|platform|software|manager|director|VP|CEO/i.test(participantMessage);
  
  const wordCount = participantMessage.split(/\s+/).length;
  
  // Calculate depth score
  let depthScore = 0;
  if (hasSpecificExample) depthScore += 30;
  if (hasQuantification) depthScore += 25;
  if (hasNamedEntities) depthScore += 20;
  if (wordCount > 50) depthScore += 25;
  else if (wordCount > 30) depthScore += 15;
  
  const needsFollowUp = depthScore < 60 || wordCount < 30;
  
  let suggestedFollowUp: string | undefined;
  if (needsFollowUp) {
    suggestedFollowUp = generateFollowUp(participantMessage, conversationContext);
  }
  
  return {
    hasSpecificExample,
    hasQuantification,
    hasNamedEntities,
    wordCount,
    depthScore,
    needsFollowUp,
    suggestedFollowUp,
  };
}

function generateFollowUp(message: string, context: { currentPhase: string }): string {
  // If no example, ask for one
  if (!/for example|last time|when I|recently/i.test(message)) {
    return "Can you give me a specific example of when that happened?";
  }
  
  // If no quantification, ask for it
  if (!/\d+|hours|days|weeks|percent/i.test(message)) {
    return "How often does this happen? And roughly how much time or resources does it cost?";
  }
  
  // If vague language, ask for specifics
  if (/things|stuff|issues|problems|some|various/i.test(message) && message.split(/\s+/).length < 40) {
    return "Can you be more specific about what you mean by that?";
  }
  
  // If no named entities, ask for them
  if (!/system|department|team|process|tool|[A-Z][a-z]+\s[A-Z]/i.test(message)) {
    return "Which specific system, team, or process are you referring to?";
  }
  
  // Default: ask for impact
  return "What's the impact of that on your work or your team?";
}

export function extractInsightFromMessage(
  message: string,
  phase: string
): Array<{
  type: 'ACTUAL_JOB' | 'WHAT_WORKS' | 'CHALLENGE' | 'CONSTRAINT' | 'VISION' | 'BELIEF' | 'RATING';
  text: string;
  category?: 'BUSINESS' | 'TECHNOLOGY' | 'PEOPLE' | 'CUSTOMER' | 'REGULATION';
}> {
  const insights: Array<{
    type: 'ACTUAL_JOB' | 'WHAT_WORKS' | 'CHALLENGE' | 'CONSTRAINT' | 'VISION' | 'BELIEF' | 'RATING';
    text: string;
    category?: 'BUSINESS' | 'TECHNOLOGY' | 'PEOPLE' | 'CUSTOMER' | 'REGULATION';
  }> = [];

  // Simple keyword-based extraction (will be enhanced with LLM later)
  const lowerMessage = message.toLowerCase();

  // Detect actual job insights
  if (phase === 'actual_job' && (
    lowerMessage.includes('responsible') ||
    lowerMessage.includes('accountable') ||
    lowerMessage.includes('time') ||
    lowerMessage.includes('day-to-day') ||
    lowerMessage.includes('work')
  )) {
    insights.push({
      type: 'ACTUAL_JOB',
      text: message,
      category: categorizeInsight(message),
    });
  }

  // Detect what works well
  if (phase === 'what_works' && (
    lowerMessage.includes('works') ||
    lowerMessage.includes('effective') ||
    lowerMessage.includes('good') ||
    lowerMessage.includes('well') ||
    lowerMessage.includes('success')
  )) {
    insights.push({
      type: 'WHAT_WORKS',
      text: message,
      category: categorizeInsight(message),
    });
  }

  // Detect challenges
  if (phase === 'challenges' && (
    lowerMessage.includes('problem') ||
    lowerMessage.includes('challenge') ||
    lowerMessage.includes('difficult') ||
    lowerMessage.includes('slow') ||
    lowerMessage.includes('frustrat')
  )) {
    insights.push({
      type: 'CHALLENGE',
      text: message,
      category: categorizeInsight(message),
    });
  }

  // Detect constraints
  if (phase === 'constraints' && (
    lowerMessage.includes('prevent') ||
    lowerMessage.includes('block') ||
    lowerMessage.includes('can\'t') ||
    lowerMessage.includes('unable') ||
    lowerMessage.includes('limitation')
  )) {
    insights.push({
      type: 'CONSTRAINT',
      text: message,
      category: categorizeInsight(message),
    });
  }

  // Detect visions
  if (phase === 'vision' && (
    lowerMessage.includes('would') ||
    lowerMessage.includes('could') ||
    lowerMessage.includes('ideal') ||
    lowerMessage.includes('want') ||
    lowerMessage.includes('hope')
  )) {
    insights.push({
      type: 'VISION',
      text: message,
      category: categorizeInsight(message),
    });
  }

  // Detect beliefs
  if (phase === 'belief_check' && (
    lowerMessage.includes('believe') ||
    lowerMessage.includes('think') ||
    lowerMessage.includes('feel') ||
    lowerMessage.includes('optimistic') ||
    lowerMessage.includes('sceptical')
  )) {
    insights.push({
      type: 'BELIEF',
      text: message,
    });
  }

  // Detect ratings
  if (phase === 'confidence_rating' && (
    lowerMessage.match(/\b([0-9]|10)\b/) ||
    lowerMessage.includes('rate') ||
    lowerMessage.includes('score')
  )) {
    insights.push({
      type: 'RATING',
      text: message,
    });
  }

  return insights;
}

function categorizeInsight(text: string): 'BUSINESS' | 'TECHNOLOGY' | 'PEOPLE' | undefined {
  const lowerText = text.toLowerCase();

  // Technology indicators
  if (
    lowerText.includes('system') ||
    lowerText.includes('software') ||
    lowerText.includes('tool') ||
    lowerText.includes('platform') ||
    lowerText.includes('technical') ||
    lowerText.includes('integration') ||
    lowerText.includes('api') ||
    lowerText.includes('database')
  ) {
    return 'TECHNOLOGY';
  }

  // People indicators
  if (
    lowerText.includes('team') ||
    lowerText.includes('people') ||
    lowerText.includes('communication') ||
    lowerText.includes('collaboration') ||
    lowerText.includes('culture') ||
    lowerText.includes('skill') ||
    lowerText.includes('training') ||
    lowerText.includes('manager')
  ) {
    return 'PEOPLE';
  }

  // Business indicators
  if (
    lowerText.includes('process') ||
    lowerText.includes('workflow') ||
    lowerText.includes('revenue') ||
    lowerText.includes('customer') ||
    lowerText.includes('strategy') ||
    lowerText.includes('market') ||
    lowerText.includes('business') ||
    lowerText.includes('approval')
  ) {
    return 'BUSINESS';
  }

  return undefined;
}
