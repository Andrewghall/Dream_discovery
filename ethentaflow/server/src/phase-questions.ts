// Phase questions for the agentic interview engine.
//
// Each phase starts with a triple_rating opener (Q1) tuned for voice delivery,
// followed by exploration guide questions used by the LLM as thematic cues.
//
// These are derived from:
//   - Q1 text: interview-controller.ts Q1_QUESTIONS (natural, voice-optimised)
//   - Guide questions: fixed-questions.ts FIXED_QUESTIONS (tested workshop probes)

export interface FixedQuestion {
  text: string;
  tag: string;
  maturityScale?: string[];
}

export const PHASE_QUESTIONS: Record<string, FixedQuestion[]> = {

  // ── PEOPLE ──────────────────────────────────────────────────────────────────
  people: [
    {
      tag: 'triple_rating',
      text:
        "Let's move into the people side of the business. On a scale of 1 to 5 — where 1 is poor and 5 is excellent — where would you rate the capability and effectiveness of your people today? Where do you need to be? And if you do nothing over the next 18 months, where do you realistically end up?",
      maturityScale: [
        "Skills gaps everywhere. People leave frequently. Teams don't talk to each other.",
        'Roles defined but overlap confusing. Some training exists. Collaboration when pushed.',
        'Clear expectations and development paths. People work across teams. Learning encouraged.',
        'Skills planning proactive. AI helps with routine work. Continuous learning normal.',
        'People and AI work seamlessly. Humans focus on judgement and relationships.',
      ],
    },
    {
      tag: 'strengths',
      text: 'What helps you do your best work here? Think of a specific time when everything came together and the job went well.',
    },
    {
      tag: 'gaps',
      text: "Where do you feel unsupported or under-skilled for what's expected of you? What's missing?",
    },
    {
      tag: 'future',
      text: 'If you could change one thing about how people work together here, what would it be?',
    },
    {
      tag: 'future',
      text: 'How do you think AI and automation will change your work over the next few years? What parts of your job should stay human?',
    },
  ],

  // ── OPERATIONS ──────────────────────────────────────────────────────────────
  operations: [
    {
      tag: 'triple_rating',
      text:
        "Let's move into operations and delivery. On a scale of 1 to 5, where would you rate how well your operations actually support what you're selling and delivering today? Where does it need to be? And if nothing changes over the next 18 months, where do you land?",
      maturityScale: [
        'Work is fragmented. Handoffs fail. Ownership unclear. Constant firefighting.',
        'Core processes exist but execution is inconsistent. Bottlenecks are common.',
        'Roles and workflows are clear. Delivery is reasonably reliable and accountable.',
        'Operations adapt quickly. Governance helps decisions move with control.',
        'Execution is seamless. The operating model scales without unnecessary friction.',
      ],
    },
    {
      tag: 'friction',
      text: "Describe something operational that should be simple but isn't. What makes it harder than it needs to be?",
    },
    {
      tag: 'friction',
      text: 'Where do handoffs, approvals, or process rules create avoidable friction? What does that tell us?',
    },
    {
      tag: 'future',
      text: 'If you could fix one thing about how work flows or decisions get made, what would it be?',
    },
  ],

  // ── TECHNOLOGY ──────────────────────────────────────────────────────────────
  technology: [
    {
      tag: 'triple_rating',
      text:
        "Let's move into the technology side of the business. On a scale of 1 to 5, where would you rate your technology — in terms of what you can credibly demonstrate to buyers today? Where does it need to be? And if nothing changes in the next 18 months, where do you end up?",
      maturityScale: [
        'Old systems everywhere. Manual workarounds constant. Data unreliable.',
        'Core systems work but inflexible. Some automation. Data improving but patchy.',
        'Systems talk to each other. Data trustworthy. AI handles routine tasks.',
        'Modern flexible systems. AI assists decisions. Self-service works.',
        'Technology just works. AI handles complexity. Innovation fast.',
      ],
    },
    {
      tag: 'working',
      text: 'Which system or tool genuinely makes your job easier? What works well?',
    },
    {
      tag: 'pain_points',
      text: 'What manual task or workaround wastes the most of your time? How often do you have to do it?',
    },
    {
      tag: 'gaps',
      text: 'What information do you need but struggle to get? What suffers as a result?',
    },
    {
      tag: 'future',
      text: 'If you could automate or fix one thing about your tools tomorrow, what would make the biggest difference?',
    },
  ],

  // ── COMMERCIAL ──────────────────────────────────────────────────────────────
  commercial: [
    {
      tag: 'triple_rating',
      text:
        "Let's move into the commercial picture. On a scale of 1 to 5, where would you rate your commercial positioning — your ability to win the right deals, at the right price, with the right buyers, today? Where does it need to be? And if nothing changes over the next 18 months, where are you?",
      maturityScale: [
        'Value is leaking. Customer demand is poorly understood. Growth feels reactive.',
        'There is some commercial discipline, but pricing, proposition, and demand signals are inconsistent.',
        'Customer value and commercial outcomes are mostly aligned. Teams can see what drives performance.',
        'The organisation anticipates demand, sharpens value delivery, and makes better commercial decisions quickly.',
        'Commercial strategy is clear, evidence-led, and consistently translated into sustainable growth.',
      ],
    },
    {
      tag: 'working',
      text: 'Where does the organisation create clear value today, and what makes that work commercially?',
    },
    {
      tag: 'pain_points',
      text: 'Where is value leaking through pricing, proposition, retention, conversion, or demand? What is driving that?',
    },
    {
      tag: 'gaps',
      text: 'What customer or market signals should influence decisions more strongly than they do today?',
    },
    {
      tag: 'future',
      text: 'If the commercial model was working brilliantly in 18 months, what would be visibly different?',
    },
  ],

  // ── RISK / COMPLIANCE ───────────────────────────────────────────────────────
  risk_compliance: [
    {
      tag: 'triple_rating',
      text:
        "Let's move into risk and compliance. On a scale of 1 to 5, where would you rate your ability to navigate risk and compliance through a deal today — without it killing the timeline or the outcome? Where does it need to be? And if nothing changes in the next 18 months, where do you end up?",
      maturityScale: [
        'Compliance reactive. Regulatory changes surprise us. Control gaps emerge too late.',
        'A framework exists, but oversight and accountability are inconsistent.',
        'Risks and obligations are tracked systematically. Controls are usually embedded into delivery.',
        'Changes are anticipated. Assurance is timely. Control burden is better targeted.',
        'Risk and compliance are disciplined, transparent, and built into how the organisation operates.',
      ],
    },
    {
      tag: 'constraint',
      text: 'Where do risk or compliance requirements create friction, delay, or uncertainty in practice?',
    },
    {
      tag: 'friction',
      text: 'Have you experienced a situation where a control gap, risk event, or compliance issue caught the organisation off-guard? What happened?',
    },
    {
      tag: 'future',
      text: 'What would stronger risk and compliance management look like without creating unnecessary bureaucracy?',
    },
  ],

  // ── PARTNERS ────────────────────────────────────────────────────────────────
  partners: [
    {
      tag: 'triple_rating',
      text:
        "Let's move into the partner side of the business. On a scale of 1 to 5, where would you rate the strength and effectiveness of your partner relationships today — in terms of what they actually deliver in deals? Where does it need to be? And if nothing changes over the next 18 months, where do you end up?",
      maturityScale: [
        'Critical external dependencies are poorly managed. Partner performance creates repeated surprises.',
        'Key partners are known, but accountability, integration, and escalation are inconsistent.',
        'Important partners are managed with reasonable clarity, governance, and visibility.',
        'The organisation works with partners strategically and resolves dependency issues early.',
        'Partner ecosystems operate as an aligned extension of the business with clear value, accountability, and control.',
      ],
    },
    {
      tag: 'context',
      text: 'Which external partners or suppliers materially affect your ability to deliver outcomes today?',
    },
    {
      tag: 'constraint',
      text: 'Where do partner incentives, capability, or dependency risks create friction for the organisation?',
    },
    {
      tag: 'future',
      text: 'What would a stronger partner model or ecosystem relationship look like in practice?',
    },
  ],

  // ── CUSTOMER ────────────────────────────────────────────────────────────────
  customer: [
    {
      tag: 'triple_rating',
      text:
        "Let's move into the customer side of the business. On a scale of 1 to 5 — where 1 is poor and 5 is excellent — where would you rate how well you understand, retain, and grow your customers today? Where do you need to be? And if nothing changes over the next 18 months, where do you end up?",
      maturityScale: [
        'Little visibility into why customers buy, stay, or leave. Relationships are reactive.',
        'Some customer data exists but insight is patchy. Retention and growth are inconsistent.',
        'Customer needs are reasonably well understood. Retention is managed. Growth is deliberate.',
        'Customer signals drive decisions. Lifetime value is actively managed. Advocacy is cultivated.',
        'Customers are a strategic asset. Insight, retention, and growth compound systematically.',
      ],
    },
    {
      tag: 'understanding',
      text: 'How do you currently find out what customers actually value, and where that changes? What surprises you most when you do find out?',
    },
    {
      tag: 'retention',
      text: 'Walk me through the last customer you lost. What actually caused it, and what did it tell you?',
    },
    {
      tag: 'growth',
      text: 'Where are your best opportunities to grow within existing customers? What is getting in the way of that?',
    },
    {
      tag: 'future',
      text: 'If your customer relationships were genuinely strong in 18 months, what would be visibly different from today?',
    },
  ],

  // ── SUMMARY (terminal phase) ─────────────────────────────────────────────────
  summary: [
    {
      tag: 'closing',
      text: 'Thank you for your time and for being so candid. Your input will help shape the next steps.',
    },
  ],
};
