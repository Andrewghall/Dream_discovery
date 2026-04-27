// Discovery questions — copied from /lib/conversation/fixed-questions.ts
// (the Dream Discovery canonical question set). Per-lens triple-rating
// prompt text + 5-band maturity scale used as the rating card labels.
//
// Keep in sync with /lib/conversation/fixed-questions.ts.

import type { Lens } from './types.js';

export interface DiscoveryQuestion {
  /** The triple-rating prompt text — natural-language framing, voice-friendly. */
  text: string;
  /** Five maturity-band descriptions, indexed 1–5 (idx 0 = level 1). */
  maturityScale: string[];
  /**
   * The Dream Discovery follow-up questions for this lens, AFTER the rating
   * is captured. These are exploration anchors — the agent paraphrases them
   * conversationally based on what the participant has just said, rather
   * than reading them verbatim. Each item is { topic, prompt }.
   */
  followUps: { topic: string; prompt: string }[];
}

const QUESTIONS: Partial<Record<Lens, DiscoveryQuestion>> = {
  people: {
    text:
      'When looking specifically at People, where do you believe the company is today, where do you feel they should be, and where will they be if they do nothing differently? Rate how well-equipped you and your colleagues are to do your jobs effectively.',
    maturityScale: [
      'Skills gaps everywhere. People leave frequently. Teams don\'t talk to each other.',
      'Roles defined but overlap confusing. Some training exists. Collaboration when pushed.',
      'Clear expectations and development paths. People work across teams. Learning encouraged.',
      'Skills planning proactive. AI helps with routine work. Continuous learning normal.',
      'People and AI work seamlessly. Humans focus on judgement and relationships.',
    ],
    followUps: [
      { topic: 'strengths', prompt: 'What helps you do your best work here? Think of a specific time when everything came together and the job went well.' },
      { topic: 'gaps',      prompt: 'Where do you feel unsupported or under-skilled for what\'s expected of you? What\'s missing?' },
      { topic: 'future',    prompt: 'If you could change one thing about how people work together here, what would it be?' },
      { topic: 'ai_future', prompt: 'How do you think AI and automation will change your work over the next few years? What parts of your job should stay human?' },
    ],
  },
  operations: {
    text:
      'When looking specifically at Operations, where do you believe the company is today, where do you feel they should be, and where will they be if they do nothing differently? Rate how well the organisation\'s operating model, processes, and decision flow help you do your job.',
    maturityScale: [
      'Work is fragmented. Handoffs fail. Ownership unclear. Constant firefighting.',
      'Core processes exist but execution is inconsistent. Bottlenecks are common.',
      'Roles and workflows are clear. Delivery is reasonably reliable and accountable.',
      'Operations adapt quickly. Governance helps decisions move with control.',
      'Execution is seamless. The operating model scales without unnecessary friction.',
    ],
    followUps: [
      { topic: 'friction',  prompt: 'Describe something operational that should be simple but isn\'t. What makes it harder than it needs to be?' },
      { topic: 'handoffs',  prompt: 'Where do handoffs, approvals, or process rules create avoidable friction? What does that tell us?' },
      { topic: 'future',    prompt: 'If you could fix one thing about how work flows or decisions get made, what would it be?' },
    ],
  },
  technology: {
    text:
      'When looking specifically at Technology, where do you believe the company is today, where do you feel they should be, and where will they be if they do nothing differently? Rate the technology, systems, and tools you use in terms of reliability and ease of use.',
    maturityScale: [
      'Old systems everywhere. Manual workarounds constant. Data unreliable.',
      'Core systems work but inflexible. Some automation. Data improving but patchy.',
      'Systems talk to each other. Data trustworthy. AI handles routine tasks.',
      'Modern flexible systems. AI assists decisions. Self-service works.',
      'Technology just works. AI handles complexity. Innovation fast.',
    ],
    followUps: [
      { topic: 'working',   prompt: 'Which system or tool genuinely makes your job easier? What works well?' },
      { topic: 'pain',      prompt: 'What manual task or workaround wastes the most of your time? How often do you have to do it?' },
      { topic: 'gaps',      prompt: 'What information do you need but struggle to get? What suffers as a result?' },
      { topic: 'future',    prompt: 'If you could automate or fix one thing about your tools tomorrow, what would make the biggest difference?' },
    ],
  },
  commercial: {
    text:
      'When looking specifically at Commercial, where do you believe the company is today, where do you feel they should be, and where will they be if they do nothing differently? Rate how well the organisation converts customer need into value, growth, and commercial performance.',
    maturityScale: [
      'Value is leaking. Customer demand is poorly understood. Growth feels reactive.',
      'There is some commercial discipline, but pricing, proposition, and demand signals are inconsistent.',
      'Customer value and commercial outcomes are mostly aligned. Teams can see what drives performance.',
      'The organisation anticipates demand, sharpens value delivery, and makes better commercial decisions quickly.',
      'Commercial strategy is clear, evidence-led, and consistently translated into sustainable growth.',
    ],
    followUps: [
      { topic: 'working',   prompt: 'Where does the organisation create clear value today, and what makes that work commercially?' },
      { topic: 'leakage',   prompt: 'Where is value leaking through pricing, proposition, retention, conversion, or demand? What is driving that?' },
      { topic: 'gaps',      prompt: 'What customer or market signals should influence decisions more strongly than they do today?' },
      { topic: 'future',    prompt: 'If the commercial model was working brilliantly in 18 months, what would be visibly different?' },
    ],
  },
  customer: {
    text:
      'When looking specifically at Customer, where do you believe the company is today, where do you feel they should be, and where will they be if they do nothing differently? Rate how well the organisation understands customer needs, delivers the experience promised, and earns long-term trust.',
    maturityScale: [
      'Customer needs are poorly understood. Experience is inconsistent. Trust is fragile and easily lost.',
      'Some customer insight exists, but journeys break down and service quality varies too much.',
      'The organisation understands core customer needs and usually delivers a dependable experience.',
      'Customer insight shapes decisions quickly. Journeys improve proactively and trust is strengthened deliberately.',
      'The organisation is deeply customer-led. Experience, loyalty, and advocacy reinforce each other consistently.',
    ],
    followUps: [
      { topic: 'working',   prompt: 'Where do customers experience the business at its best today, and what makes that feel different?' },
      { topic: 'breakdown', prompt: 'Where does the customer experience break down, create effort, or damage trust most often?' },
      { topic: 'gaps',      prompt: 'What do customers need or expect that the organisation still does not understand well enough?' },
      { topic: 'future',    prompt: 'If the customer experience was genuinely stronger in 18 months, what would customers notice first?' },
    ],
  },
  risk_compliance: {
    text:
      'When looking specifically at Risk and Compliance, where do you believe the company is today, where do you feel they should be, and where will they be if they do nothing differently? Rate how well the organisation manages compliance obligations, controls, and material risk.',
    maturityScale: [
      'Compliance reactive. Regulatory changes surprise us. Control gaps emerge too late.',
      'A framework exists, but oversight and accountability are inconsistent.',
      'Risks and obligations are tracked systematically. Controls are usually embedded into delivery.',
      'Changes are anticipated. Assurance is timely. Control burden is better targeted.',
      'Risk and compliance are disciplined, transparent, and built into how the organisation operates.',
    ],
    followUps: [
      { topic: 'friction',  prompt: 'Where do risk or compliance requirements create friction, delay, or uncertainty in practice?' },
      { topic: 'incident',  prompt: 'Have you experienced a situation where a control gap, risk event, or compliance issue caught the organisation off-guard? What happened?' },
      { topic: 'future',    prompt: 'What would stronger risk and compliance management look like without creating unnecessary bureaucracy?' },
    ],
  },
  partners: {
    text:
      'When looking specifically at Partners, where do you believe the company is today, where do you feel they should be, and where will they be if they do nothing differently? Rate how well the organisation works with external partners, suppliers, and ecosystem dependencies that materially affect outcomes.',
    maturityScale: [
      'Critical external dependencies are poorly managed. Partner performance creates repeated surprises.',
      'Key partners are known, but accountability, integration, and escalation are inconsistent.',
      'Important partners are managed with reasonable clarity, governance, and visibility.',
      'The organisation works with partners strategically and resolves dependency issues early.',
      'Partner ecosystems operate as an aligned extension of the business with clear value, accountability, and control.',
    ],
    followUps: [
      { topic: 'context',     prompt: 'Which external partners or suppliers materially affect your ability to deliver outcomes today?' },
      { topic: 'constraint',  prompt: 'Where do partner incentives, capability, or dependency risks create friction for the organisation?' },
      { topic: 'future',      prompt: 'What would a stronger partner model or ecosystem relationship look like in practice?' },
    ],
  },
};

export function getDiscoveryQuestion(lens: Lens): DiscoveryQuestion | null {
  return QUESTIONS[lens] ?? null;
}
