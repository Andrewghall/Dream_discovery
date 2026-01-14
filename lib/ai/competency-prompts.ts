import { ConversationPhase } from '../types/conversation';

import { FIXED_QUESTIONS, getFixedQuestion } from '../conversation/fixed-questions';

function formatQuestionSequence(phase: ConversationPhase): string {
  // Prompts are informational; runtime sequencing is handled by fixed questions.
  // Use includeRegulation=true to show the complete flow; runtime may omit regulation.
  const includeRegulation = true;
  const qs = FIXED_QUESTIONS[phase] || [];
  if (!qs.length) return '';

  return qs
    .map((_, idx) => {
      const text = getFixedQuestion(phase, idx, includeRegulation);
      return `Q${idx + 1}. ${text}`;
    })
    .join('\n\n');
}

export function getCompetencyPrompt(phase: ConversationPhase): string {
  const sequence = formatQuestionSequence(phase);

  if (phase === 'summary') {
    return `CLOSING:

Use the following closing line exactly:

${sequence}`;
  }

  return `STRUCTURED DISCOVERY QUESTION SEQUENCE:

Rules:
- Ask ONE question at a time
- Ask questions in the exact order below
- You may ask ONE clarifying question if the participant's answer is vague
- Keep tone neutral and focused on the organisation and operating environment (not judging the individual)

${sequence}`;
}
