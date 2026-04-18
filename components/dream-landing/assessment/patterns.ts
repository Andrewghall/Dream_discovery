export interface Pattern {
  key: string
  name: string
  headline: string
  insight: string
  dreamFocus: string
  signals: [string, string, string]
}

export const PATTERNS: Record<string, Pattern> = {
  capable_but_constrained: {
    key: 'capable_but_constrained',
    name: 'The Capable But Constrained',
    headline: 'Your ambition is running ahead of your infrastructure.',
    insight: "You have strong intent and capable people, but the systems and structures needed to translate that into consistent action are lagging behind. This is one of the most common patterns we work with — and one of the most fixable.",
    dreamFocus: "A DREAM session would surface exactly where the gap sits between your people's capability and your technology's readiness — and what needs to change first.",
    signals: [
      "Leadership intent and operational delivery are having two different conversations at different speeds.",
      "Technology decisions are being made without full visibility of who will actually use the systems.",
      "There's a capability gap that won't close through training alone — it needs structural change."
    ]
  },
  strategically_misaligned: {
    key: 'strategically_misaligned',
    name: 'The Strategically Misaligned',
    headline: "Everyone is working hard. Not everyone is working on the same thing.",
    insight: "The challenge isn't effort — it's direction. Governance and collaboration patterns aren't yet creating the alignment your organisation needs to move fast together. The energy is there; the connective tissue isn't.",
    dreamFocus: "A DREAM session would map exactly where strategic intent breaks down into operational reality — and find the conversations that haven't happened yet.",
    signals: [
      "There are multiple interpretations of what success looks like across leadership teams.",
      "Cross-functional decisions take longer than they should — not because of politics, but because ownership isn't clear.",
      "Partners and internal teams are operating to different standards without realising it."
    ]
  },
  customer_blind_operator: {
    key: 'customer_blind_operator',
    name: 'The Capable Operator',
    headline: "You run a tight operation. The customer's voice needs a seat at the table.",
    insight: "Operational capability is strong, but strategic decisions aren't yet consistently grounded in deep customer insight. The risk is building things efficiently — for customers whose needs have quietly moved on.",
    dreamFocus: "A DREAM session would reveal the gap between what your organisation believes customers experience and what they actually do.",
    signals: [
      "Customer feedback is collected but doesn't consistently reach the people making decisions.",
      "Internal priorities and customer priorities are slowly drifting apart.",
      "The organisation is optimising for what it measures, not necessarily for what customers value most."
    ]
  },
  compliance_locked: {
    key: 'compliance_locked',
    name: 'The Compliance-Locked Innovator',
    headline: "Regulation is protecting you and slowing you down at the same time.",
    insight: "Compliance is being treated as a constraint rather than a framework for confident innovation. Organisations that solve this pattern use regulatory depth as a competitive advantage — you're closer than you think.",
    dreamFocus: "A DREAM session would identify where compliance has become a cultural reflex rather than a thoughtful guardrail — and what it would take to shift that.",
    signals: [
      "Teams are self-censoring innovation for fear of regulatory exposure, even when the risk is manageable.",
      "Regulatory change is creating reactive scrambles rather than planned responses.",
      "The compliance team and the innovation team are solving different problems with no shared language."
    ]
  },
  technically_advanced: {
    key: 'technically_advanced',
    name: 'The Technically Advanced',
    headline: "Your technology is ready. Your organisation may not be.",
    insight: "Investment in technology and data has been significant, but the human and structural side of transformation hasn't kept pace. Technology without adoption is infrastructure without purpose.",
    dreamFocus: "A DREAM session would surface the adoption gap — where technology capability exists but the organisational readiness to use it hasn't yet caught up.",
    signals: [
      "Systems have been built. Behaviours haven't changed to match them.",
      "Data is available. Decision-making culture hasn't yet become genuinely data-driven.",
      "Technology investment is ahead of the change management investment needed to realise its value."
    ]
  },
  steady_plateau: {
    key: 'steady_plateau',
    name: 'The Steady Plateau',
    headline: "You're performing consistently. The question is what's next.",
    insight: "Across all dimensions, your organisation is doing the basics well. The opportunity isn't fixing obvious gaps — it's finding the specific constraint that's quietly capping your performance.",
    dreamFocus: "A DREAM session would look for the hidden constraint — the structural pattern that's limiting the next step of performance that existing data hasn't yet named.",
    signals: [
      "Progress has been consistent but has slowed — not from failure, but because the next step requires a different kind of investment.",
      "There are constraints that have become invisible because they've been normalised.",
      "The organisation is ready for a different quality of strategic conversation."
    ]
  },
  early_foundations: {
    key: 'early_foundations',
    name: 'The Foundation Builder',
    headline: "You're earlier in the journey than you might think — and that's an advantage.",
    insight: "There's real opportunity across every dimension, which means the decisions made now will compound. Organisations that build on honest foundations transform faster than those that paper over gaps.",
    dreamFocus: "A DREAM session would help you understand what to build first — and in what order — so every investment compounds rather than competes.",
    signals: [
      "Multiple dimensions need attention simultaneously — the sequencing of that investment is critical.",
      "There's more informal capability in the organisation than the formal structures currently capture.",
      "The most important conversations about direction haven't happened yet."
    ]
  },
  transformation_ready: {
    key: 'transformation_ready',
    name: 'The Transformation-Ready',
    headline: "You've built strong foundations. Now it's about finding the next edge.",
    insight: "Your organisation is genuinely performing across most dimensions. The opportunity at this stage is precision — identifying the specific constraints and opportunities that will drive the next level of impact.",
    dreamFocus: "A DREAM session would focus on nuance — the signals within strong performance that point to where targeted investment would create disproportionate return.",
    signals: [
      "At this level, the biggest gains come from alignment optimisation rather than capability building.",
      "There are likely adjacent capabilities that would create significant leverage — they're just not visible yet.",
      "The difference between good and exceptional often lies in a single structural constraint."
    ]
  },
}

interface DomainScore { name: string; score: number }

export function detectPattern(domainScores: DomainScore[]): Pattern {
  if (domainScores.length === 0) return PATTERNS.steady_plateau

  const avg = domainScores.reduce((s, d) => s + d.score, 0) / domainScores.length
  const sorted = [...domainScores].sort((a, b) => a.score - b.score)
  const lowest = sorted[0]
  const highest = sorted[sorted.length - 1]
  const spread = highest.score - lowest.score

  if (avg >= 4.0) return PATTERNS.transformation_ready
  if (avg < 2.0) return PATTERNS.early_foundations
  if (spread < 0.8) return PATTERNS.steady_plateau

  // Specific patterns based on lowest domain
  if (lowest.name === 'Technology' || lowest.name === 'Technology & Data') return PATTERNS.capable_but_constrained
  if (lowest.name === 'Organisation & Partners') return PATTERNS.strategically_misaligned
  if (lowest.name === 'Customer') return PATTERNS.customer_blind_operator
  if (lowest.name === 'Risk/Compliance') return PATTERNS.compliance_locked

  // High tech, low everything else
  if (highest.name === 'Technology' && avg < 3.0) return PATTERNS.technically_advanced

  return PATTERNS.steady_plateau
}
