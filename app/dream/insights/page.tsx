import type { Metadata } from 'next';
import { PageHero } from '@/components/dream-landing/page-hero';
import { ScrollReveal } from '@/components/dream-landing/scroll-reveal';
import { CTASection } from '@/components/dream-landing/cta-section';

export const metadata: Metadata = {
  title: 'Analytical Intelligence — 7 Views That Reveal the Truth',
};

const PRIMARY_VIEWS = [
  {
    title: '360° Hemisphere',
    description:
      'A living map of your organisation\'s collective psyche. Visions and creativity populate the upper hemisphere. Constraints and friction sit below. The core truth node represents the organisation\'s centre of gravity.',
    details: [
      'Upper hemisphere: creative visions, aspirations, and opportunities',
      'Lower hemisphere: constraints, friction, and barriers',
      'Domain colouring: People (blue), Organisation (green), Customer (purple), Technology (orange), Regulation (red)',
      'Edge relationships show how themes connect across domains',
      'Expansive vs defensive mindset interpretation at a glance',
    ],
  },
  {
    title: 'Sentiment Index',
    description:
      'Measures creative density versus constraint density across every domain. Reveals whether your organisation is expansive, defensive, or fragmented — and where the energy concentrates.',
    details: [
      'Creative density: volume and intensity of forward-looking contributions',
      'Constraint density: volume and intensity of barrier-focused contributions',
      'Per-domain breakdown shows where optimism and resistance live',
      'Five sentiment categories: Expansive, Leaning Forward, Balanced, Cautious, Defensive',
      'Trends visible across organisational layers',
    ],
  },
  {
    title: 'Bias Detection',
    description:
      'Identifies dominant voices, contribution imbalances, and sentiment skew. Ensures no single perspective hijacks the narrative. Uses the Gini coefficient for statistical rigour.',
    details: [
      'Contribution balance: are insights coming from everyone or dominated by a few?',
      'Gini coefficient scoring: 0 = perfectly balanced, 1 = single-voice dominance',
      'Sentiment divergence by hemisphere layer',
      'Domain coverage gaps: which domains have blind spots?',
      'Automatic flagging of over-represented and under-represented perspectives',
    ],
  },
];

const SECONDARY_VIEWS = [
  {
    title: 'Balance Safeguards',
    description: 'Pattern-matched flags for systemic imbalances across the workshop output.',
    details: [
      'Excess imagination without practical grounding',
      'Missing domains: entire organisational areas with no coverage',
      'Single-voice dominance: one participant contributing disproportionately',
      'Constraint overload: too many barriers without corresponding visions',
      'Actionable recommendations for each flagged imbalance',
    ],
  },
  {
    title: 'Multi-Lens Analysis',
    description: 'Scores readiness and impact across six practical dimensions that matter to decision-makers.',
    details: [
      'Cost: financial investment and resource implications',
      'Risk: exposure, uncertainty, and mitigation requirements',
      'Experience: impact on employee and customer experience',
      'Regulatory: compliance, governance, and legal considerations',
      'Workforce: capability gaps, training needs, change management',
      'Operational: process complexity, integration, and execution feasibility',
    ],
  },
  {
    title: 'Narrative Divergence',
    description: 'Compares language and sentiment across organisational layers. Where leadership and frontline perspectives align — and where they diverge.',
    details: [
      'Leadership vs frontline language comparison',
      'Semantic similarity scoring across participant groups',
      'Identification of "translation gaps" between layers',
      'Where the organisation speaks with one voice vs where it fragments',
      'Actionable insight into communication breakdowns',
    ],
  },
  {
    title: 'Confidence Index',
    description: 'Maps certainty, hedging, and uncertainty in participant language. Where the organisation is sure and where it is guessing.',
    details: [
      'Certainty signals: definitive language, strong assertions',
      'Hedging signals: "maybe", "possibly", "I think", conditional language',
      'Uncertainty signals: questions, admissions of not knowing',
      'Per-domain confidence mapping',
      'Where confidence is misplaced and where doubt is justified',
    ],
  },
];

const EXAMPLE_INSIGHTS = [
  {
    insight: '73% of staff rated Technology maturity at 3/10 while leadership projected 7/10',
    interpretation: 'The maturity perception gap. This single finding often reshapes the entire transformation strategy.',
  },
  {
    insight: '12 unresolved tensions surfaced — top 3 between Customer and Organisation domains',
    interpretation: 'Structural friction between what customers need and how the organisation operates.',
  },
  {
    insight: '68% of creative vision came from 2 of 15 participants',
    interpretation: 'Bias detection flag. The reimagined future reflects two perspectives, not fifteen.',
  },
  {
    insight: 'Narrative Divergence: leadership described transformation as "exciting", frontline described it as "exhausting"',
    interpretation: 'The engagement gap. Without addressing this, any initiative will face passive resistance.',
  },
];

export default function InsightsPage() {
  return (
    <>
      <PageHero
        eyebrow="Analytical Intelligence"
        headline="See What Others"
        highlightText="Miss"
        subheadline="Seven distinct analytical views that reveal the true state of your organisation. Not what people present in meetings — what they actually think."
        stats={[
          { target: 7, label: 'Analytical views' },
          { target: 1000, suffix: '+', label: 'Data points per workshop' },
          { target: 100, suffix: '%', label: 'Deterministic scoring' },
        ]}
      />

      {/* ═══ PRIMARY VIEWS ═══ */}
      <section className="bg-slate-950 text-white py-20">
        <div className="max-w-6xl mx-auto px-6 space-y-16">
          {PRIMARY_VIEWS.map((view, i) => (
            <ScrollReveal key={view.title} delay={100}>
              <div className="grid md:grid-cols-2 gap-8 items-start">
                <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                  <h3 className="text-2xl font-bold mb-3">{view.title}</h3>
                  <p className="text-slate-400 leading-relaxed mb-4">{view.description}</p>
                </div>
                <div className={`bg-white/5 rounded-2xl p-6 border border-white/10 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                  <ul className="space-y-3">
                    {view.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#5cf28e] flex-shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ═══ SECONDARY VIEWS ═══ */}
      <section className="bg-[#0a0a1a] text-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <h2 className="text-2xl sm:text-3xl font-bold mb-10 text-center">
              Four More Dimensions of Intelligence
            </h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-6">
            {SECONDARY_VIEWS.map((view, i) => (
              <ScrollReveal key={view.title} delay={100 + i * 80}>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 h-full">
                  <h3 className="text-base font-bold mb-2">{view.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-4">{view.description}</p>
                  <ul className="space-y-2">
                    {view.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2 text-xs text-slate-500">
                        <span className="mt-1 w-1 h-1 rounded-full bg-[#5cf28e]/60 flex-shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ EXAMPLE INSIGHTS ═══ */}
      <section className="bg-gradient-to-b from-[#0d0d0d] to-slate-950 text-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <p className="text-[#5cf28e] text-sm font-semibold tracking-[0.15em] uppercase mb-3 text-center">
              Real Intelligence
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-10 text-center">
              What DREAM Actually Surfaces
            </h2>
          </ScrollReveal>
          <div className="space-y-4">
            {EXAMPLE_INSIGHTS.map((item, i) => (
              <ScrollReveal key={i} delay={100 + i * 80}>
                <div className="bg-white/5 rounded-xl p-6 border border-[#5cf28e]/10">
                  <p className="text-base font-semibold text-white mb-2">
                    &ldquo;{item.insight}&rdquo;
                  </p>
                  <p className="text-sm text-slate-400">{item.interpretation}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        headline="See these insights from your own organisation"
        subheadline="Book a demo to experience the full analytical power of DREAM."
        variant="dark"
      />
    </>
  );
}
