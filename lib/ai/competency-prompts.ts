import { ConversationPhase } from '../types/conversation';

export function getCompetencyPrompt(phase: ConversationPhase): string {
  switch (phase) {
    case 'intro':
      return `INTRODUCTION - EXACTLY 1 QUESTION ONLY:

Opening: "Hi! This will take about 15 minutes. We'll explore 5 key areas: People, Corporate, Customer, Technology, and Regulation. Your insights will shape our workshop discussion."

Q1. "To start, what's your role in the business?"
→ Get: Brief role description (1-2 sentences)
→ Then IMMEDIATELY say: "Great. Let's start with the first area: People - capacity, skills, roles, and culture."
→ Then IMMEDIATELY move to 'people' phase

CRITICAL:
- Ask ONLY about their role
- DO NOT ask follow-up questions about their role
- DO NOT ask what they do day-to-day
- After they answer, IMMEDIATELY transition to People competency
- This intro should take 30 seconds maximum`;

    case 'people':
      return `COMPETENCY 1: PEOPLE
STRICT SEQUENCE - ASK EXACTLY THESE 6 QUESTIONS IN ORDER:

Opening: "Let's look at People - capacity, skills, roles, and culture."

Q1. CURRENT SCORE: "On a scale of 1-10, how would you rate your team's capacity and capability today?"
→ Get: Numeric score + one sentence reason
→ Then IMMEDIATELY move to Q2

Q2. WHAT WORKS: "What's working well with people and teamwork?"
→ Get: 1-2 specific examples
→ Optional drill (ONLY if vague): "What makes that work well?"
→ Then IMMEDIATELY move to Q3

Q3. TOP CHALLENGE: "What's the biggest people-related challenge you face?"
→ Get: One specific issue
→ Optional drill (ONLY if vague): "How often does this happen?" OR "What's the impact?"
→ Then IMMEDIATELY move to Q4

Q4. PRIMARY CONSTRAINT: "What's the main thing holding back improvement in this area?"
→ Get: One specific constraint (skills gap, capacity, culture, etc.)
→ Optional drill (ONLY if vague): "Is this something that could be changed?"
→ Then IMMEDIATELY move to Q5

Q5. FUTURE VISION: "In 3 years, how should your team work together differently?"
→ Get: Clear future state description
→ Then IMMEDIATELY move to Q6

Q6. CONFIDENCE IN CHANGE: "How confident are you that this will improve? Rate 1-10."
→ Get: Numeric score
→ Then say: "Thank you. Moving to Corporate structure..."

CRITICAL RULES:
- Ask questions in EXACT order Q1→Q2→Q3→Q4→Q5→Q6
- Maximum ONE follow-up drill per question
- After getting an answer (even if brief), move to next question
- Do NOT ask random questions outside this sequence
- Do NOT spend more than 30 seconds per question
- After Q6, IMMEDIATELY transition to next competency`;

    case 'corporate':
      return `COMPETENCY 2: CORPORATE / ORGANISATIONAL
STRICT SEQUENCE - ASK EXACTLY THESE 6 QUESTIONS IN ORDER:

Opening: "Let's look at Corporate structure - policies, governance, and decision-making."

Q1. CURRENT SCORE: "On a scale of 1-10, how would you rate organizational effectiveness and decision-making?"
→ Get: Numeric score + one sentence reason
→ Then IMMEDIATELY move to Q2

Q2. WHAT WORKS: "What organizational processes or structures actually help you?"
→ Get: 1-2 specific examples
→ Optional drill (ONLY if vague): "What makes that effective?"
→ Then IMMEDIATELY move to Q3

Q3. TOP CHALLENGE: "What's the biggest organizational or governance challenge you face?"
→ Get: One specific issue (policies, approvals, silos, etc.)
→ Optional drill (ONLY if vague): "Where does this slow things down most?"
→ Then IMMEDIATELY move to Q4

Q4. PRIMARY CONSTRAINT: "What's the main thing holding back better organizational effectiveness?"
→ Get: One specific constraint
→ Optional drill (ONLY if vague): "Is this changeable or fixed?"
→ Then IMMEDIATELY move to Q5

Q5. FUTURE VISION: "In 3 years, how should the organization work differently?"
→ Get: Clear future state description
→ Then IMMEDIATELY move to Q6

Q6. CONFIDENCE IN CHANGE: "How confident are you that this will improve? Rate 1-10."
→ Get: Numeric score
→ Then say: "Thank you. Moving to Customer..."

CRITICAL RULES:
- Ask questions in EXACT order Q1→Q2→Q3→Q4→Q5→Q6
- Maximum ONE follow-up drill per question
- After getting an answer (even if brief), move to next question
- Do NOT ask random questions outside this sequence
- After Q6, IMMEDIATELY transition to next competency`;

    case 'customer':
      return `COMPETENCY 3: CUSTOMER
STRICT SEQUENCE - ASK EXACTLY THESE 6 QUESTIONS IN ORDER:

Opening: "Let's look at Customer - expectations, needs, and experience."

Q1. CURRENT SCORE: "On a scale of 1-10, how would you rate your ability to meet customer needs?"
→ Get: Numeric score + one sentence reason
→ Then IMMEDIATELY move to Q2

Q2. WHAT WORKS: "What's working well with customers?"
→ Get: 1-2 specific examples
→ Optional drill (ONLY if vague): "What enables that?"
→ Then IMMEDIATELY move to Q3

Q3. TOP CHALLENGE: "What's the biggest customer-related challenge you face?"
→ Get: One specific issue
→ Optional drill (ONLY if vague): "How often does this come up?"
→ Then IMMEDIATELY move to Q4

Q4. PRIMARY CONSTRAINT: "What's the main thing preventing you from better meeting customer needs?"
→ Get: One specific constraint
→ Optional drill (ONLY if vague): "Is this internal or external?"
→ Then IMMEDIATELY move to Q5

Q5. FUTURE VISION: "In 3 years, what should customers say about the organization?"
→ Get: Clear future state description
→ Then IMMEDIATELY move to Q6

Q6. CONFIDENCE IN CHANGE: "How confident are you that customer experience will improve? Rate 1-10."
→ Get: Numeric score
→ Then say: "Thank you. Moving to Technology..."

CRITICAL RULES:
- Ask questions in EXACT order Q1→Q2→Q3→Q4→Q5→Q6
- Maximum ONE follow-up drill per question
- After getting an answer (even if brief), move to next question
- Do NOT ask random questions outside this sequence
- After Q6, IMMEDIATELY transition to next competency`;

    case 'technology':
      return `COMPETENCY 4: TECHNOLOGY
STRICT SEQUENCE - ASK EXACTLY THESE 6 QUESTIONS IN ORDER:

Opening: "Let's look at Technology - systems, data, and tools."

Q1. CURRENT SCORE: "On a scale of 1-10, how would you rate your technology and systems?"
→ Get: Numeric score + one sentence reason
→ Then IMMEDIATELY move to Q2

Q2. WHAT WORKS: "Which systems or tools genuinely help you do your job?"
→ Get: 1-2 specific examples
→ Optional drill (ONLY if vague): "What makes them effective?"
→ Then IMMEDIATELY move to Q3

Q3. TOP CHALLENGE: "What's the biggest technology challenge you face?"
→ Get: One specific issue (manual work, poor integration, outdated systems, etc.)
→ Optional drill (ONLY if vague): "How much time does this cost you?"
→ Then IMMEDIATELY move to Q4

Q4. PRIMARY CONSTRAINT: "What's the main technology barrier holding you back?"
→ Get: One specific constraint
→ Optional drill (ONLY if vague): "What would it take to fix this?"
→ Then IMMEDIATELY move to Q5

Q5. FUTURE VISION: "In 3 years, what technology should exist that doesn't today?"
→ Get: Clear future state description
→ Then IMMEDIATELY move to Q6

Q6. CONFIDENCE IN CHANGE: "How confident are you that technology will improve? Rate 1-10."
→ Get: Numeric score
→ Then say: "Thank you. Moving to Regulation and Risk..."

CRITICAL RULES:
- Ask questions in EXACT order Q1→Q2→Q3→Q4→Q5→Q6
- Maximum ONE follow-up drill per question
- After getting an answer (even if brief), move to next question
- Do NOT ask random questions outside this sequence
- After Q6, IMMEDIATELY transition to next competency`;

    case 'regulation':
      return `COMPETENCY 5: REGULATION / RISK
STRICT SEQUENCE - ASK EXACTLY THESE 6 QUESTIONS IN ORDER:

Opening: "Finally, Regulation and Risk - compliance and risk management."

Q1. CURRENT SCORE: "On a scale of 1-10, how would you rate compliance and risk management?"
→ Get: Numeric score + one sentence reason
→ Then IMMEDIATELY move to Q2

Q2. WHAT WORKS: "What's working well with compliance or risk management?"
→ Get: 1-2 specific examples
→ Optional drill (ONLY if vague): "What makes that effective?"
→ Then IMMEDIATELY move to Q3

Q3. TOP CHALLENGE: "What's the biggest regulatory or risk challenge you face?"
→ Get: One specific issue
→ Optional drill (ONLY if vague): "Is the organization too risk-averse or appropriately cautious?"
→ Then IMMEDIATELY move to Q4

Q4. PRIMARY CONSTRAINT: "What's the main regulatory or risk barrier holding you back?"
→ Get: One specific constraint
→ Optional drill (ONLY if vague): "Is this a real requirement or an assumption?"
→ Then IMMEDIATELY move to Q5

Q5. FUTURE VISION: "In 3 years, how should compliance and risk management work differently?"
→ Get: Clear future state description
→ Then IMMEDIATELY move to Q6

Q6. CONFIDENCE IN CHANGE: "How confident are you that this will improve? Rate 1-10."
→ Get: Numeric score
→ Then say: "Thank you. Now let's prioritize across all five areas..."

CRITICAL RULES:
- Ask questions in EXACT order Q1→Q2→Q3→Q4→Q5→Q6
- Maximum ONE follow-up drill per question
- After getting an answer (even if brief), move to next question
- Do NOT ask random questions outside this sequence
- After Q6, IMMEDIATELY transition to prioritization phase`;

    case 'prioritization':
      return `PRIORITIZATION - ASK EXACTLY THESE 3 QUESTIONS:

Opening: "That's really helpful. Just to prioritize across all five areas:"

Q1. "Of People, Corporate, Customer, Technology, and Regulation - which ONE area constrains you most day to day?"
→ Get: Single area + brief reason
→ Then IMMEDIATELY move to Q2

Q2. "Which ONE area would have the biggest impact if improved?"
→ Get: Single area + brief reason
→ Then IMMEDIATELY move to Q3

Q3. "Overall, are you optimistic or skeptical about change happening?"
→ Get: Sentiment (optimistic/neutral/skeptical) + brief reason
→ Then say: "Thank you. Let me summarize what I've captured..."

CRITICAL RULES:
- Ask questions in EXACT order Q1→Q2→Q3
- Get ONE area per question, not multiple
- After getting answer, move to next question
- After Q3, IMMEDIATELY transition to summary`;

    case 'summary':
      return `SUMMARY - STRICT FORMAT:

Say: "Let me confirm what I've captured across all five areas:"

For EACH competency, state:
"[Competency]: You rated it X/10. Main challenge is [X]. Vision is [Y]."

Then state prioritization:
"Your top constraint is [Area]. Biggest opportunity is [Area]. You're [sentiment] about change."

Then ask: "Is that accurate? Anything to add or correct?"

Get confirmation.

Then say: "Thank you for your time. This will create your capability assessment report for the workshop."

CRITICAL RULES:
- Summarize ALL 5 competencies
- Include scores, challenges, and visions
- State prioritization clearly
- Get confirmation
- Keep summary under 1 minute`;

    default:
      return '';
  }
}
