import { ConversationPhase, PHASE_CONFIGS } from '../types/conversation';
import { getCompetencyPrompt } from './competency-prompts';

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    nl: 'Dutch',
    pl: 'Polish',
    ru: 'Russian',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    hi: 'Hindi',
  };
  return languages[code] || 'English';
}

interface SystemPromptParams {
  workshopName: string;
  workshopType: string;
  businessContext?: string;
  participantName: string;
  participantRole?: string;
  participantDepartment?: string;
  currentPhase: ConversationPhase;
  messageHistory: Array<{ role: string; content: string }>;
  currentInsightCount: number;
  language?: string;
}

export function generateSystemPrompt(params: SystemPromptParams): string {
  const {
    workshopName,
    workshopType,
    businessContext,
    participantName,
    participantRole,
    participantDepartment,
    currentPhase,
    currentInsightCount,
    language = 'en',
  } = params;

  const phaseConfig = PHASE_CONFIGS[currentPhase];
  const minimumInsights = phaseConfig.minimumInsights;

  const languageInstruction = language !== 'en'
    ? `\n\nIMPORTANT: Conduct this entire conversation in ${getLanguageName(language)}. All your questions and responses must be in ${getLanguageName(language)}.`
    : '';

  return `You are conducting a STRUCTURED DISCOVERY INTERVIEW for ${participantName}.${languageInstruction}

Your role:
- Capture the interviewee's view of the organisation and operating environment
- Do NOT judge the individual
- Collect three 1–10 scores when asked (current capability, desired future ambition, confidence)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES - FOLLOW EXACTLY OR THE INTERVIEW WILL FAIL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. You MUST ask questions in the EXACT order specified below
2. You MUST ask ONE question at a time
3. After getting an answer, you MUST move to the NEXT question in the sequence
4. You MAY ask ONE clarifying question if the answer is vague (ONLY ONE)
5. You MUST NOT ask random questions outside the sequence
6. You MUST NOT engage in conversation beyond the structured questions

CURRENT PHASE: ${currentPhase}
PROGRESS: ${currentInsightCount} of ${minimumInsights} required data points collected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXACT QUESTION SEQUENCE FOR THIS PHASE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${getPhaseSpecificGuidance(currentPhase)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSE FORMAT:
- Acknowledge their answer briefly (1 sentence max)
- Ask the NEXT question in the sequence
- DO NOT add extra commentary
- DO NOT ask follow-up questions unless answer is vague

IF PARTICIPANT ASKS FOR CLARIFICATION:
- Explain what you're asking for in different words
- Give a brief example if helpful
- Then ask the same question again
- DO NOT move to the next question until they answer

EXAMPLE - PARTICIPANT ASKS FOR CLARITY:
Participant: "What do you mean by capacity?"
You: "By capacity, I mean whether you have enough people to handle the workload - are you fully staffed, stretched thin, or have gaps? For example, do you often have work that can't get done because there aren't enough people? On a scale of 1-10, how would you rate your team's capacity and capability today?"

EXAMPLE GOOD RESPONSE (normal flow):
"Thank you. [Next question from sequence]"

EXAMPLE BAD RESPONSE:
"That's interesting. Can you tell me more about that? What else happens?"

YOU MUST FOLLOW THE QUESTION SEQUENCE EXACTLY.
NO EXCEPTIONS.
NO DEVIATIONS.
NO RANDOM QUESTIONS.`;
}

function getPhaseSpecificGuidance(phase: ConversationPhase): string {
  return getCompetencyPrompt(phase);
}

export function generateFirstMessage(workshopName: string, participantName: string): string {
  return `Hi ${participantName}! I'm here to help gather your thoughts before our "${workshopName}" workshop.

This conversation will take about 15 minutes, and your insights will help shape our discussion. There are no wrong answers - I'm genuinely interested in understanding your perspective.

To start, could you briefly describe your role, how long you've been in the organisation, and what drives your work?`;
}
