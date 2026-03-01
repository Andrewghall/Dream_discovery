import type { Metadata } from 'next';
import { MessageSquare, Users, BarChart3, Clock, UserCheck, FileText } from 'lucide-react';
import { PageHero } from '@/components/dream-landing/page-hero';
import { ScrollReveal, AnimatedCounter } from '@/components/dream-landing/scroll-reveal';
import { CTASection } from '@/components/dream-landing/cta-section';
import { BreadcrumbJsonLd, FaqJsonLd } from '@/lib/dream-landing/seo';

export const metadata: Metadata = {
  title: 'How It Works — From Conversation to Action',
  description:
    'Three stages: AI Discovery before the workshop, live cognitive guidance during, and a full analytical intelligence dashboard after. Here is the complete DREAM journey.',
  alternates: { canonical: '/dream/how-it-works' },
  openGraph: {
    title: 'How DREAM Works — From Conversation to Action',
    description: 'The complete DREAM journey: AI Discovery, live workshop guidance, and post-workshop intelligence.',
    url: '/dream/how-it-works',
  },
};

const STAGES = [
  {
    number: 1,
    icon: MessageSquare,
    title: 'Before the Workshop',
    subtitle: 'AI-Powered Discovery',
    colour: 'from-blue-500 to-cyan-500',
    timeline: '1–2 weeks before',
    paragraphs: [
      'Every participant receives a link to a private, AI-guided conversation. In just 15 minutes, the AI explores their perspective across five organisational domains: People, Organisation, Customer, Technology, and Regulation.',
      'This isn\'t a survey. It\'s a genuine dialogue where participants share insights, rate maturity, identify constraints, and describe their vision for the future. The AI adapts its questions based on responses, going deeper where it matters.',
      'By the time the workshop begins, EthentaFlow has already extracted hundreds of insights, detected themes, scored confidence levels, and prepared a Discovery Intelligence briefing for the facilitator. The workshop starts with data, not blank whiteboards.',
    ],
    capabilities: [
      '15-minute structured AI conversations with each participant',
      'Five organisational domains explored in depth',
      'Maturity ratings: current state, target state, projected trajectory',
      'Confidence scoring — certainty vs hedging detected automatically',
      'Automatic insight extraction and theme clustering',
      'Discovery Intelligence briefing prepared for facilitators',
    ],
  },
  {
    number: 2,
    icon: Users,
    title: 'During the Workshop',
    subtitle: 'Live Cognitive Guidance',
    colour: 'from-purple-500 to-pink-500',
    timeline: '4–8 hours',
    paragraphs: [
      'The facilitator guides participants through three live phases: Reimagine (envision the ideal future), Constraints (identify what blocks the path), and Apply (design the transformation plan). AI cognitive guidance runs throughout.',
      'Agentic AI generates questions grounded in Discovery data — not generic prompts, but specific questions driven by what participants actually said. The 360° Hemisphere builds live on-screen, giving everyone a visual map of the organisation\'s collective thinking.',
      'Real-time synthesis means insights compound as the workshop progresses. By the time you reach the Apply phase, the AI has already mapped every constraint to the vision it blocks and can suggest where to focus transformation energy.',
    ],
    capabilities: [
      'Three live phases: Reimagine, Constraints, Apply',
      'AI cognitive guidance with dynamically generated questions',
      'Questions grounded in real Discovery data — not generic templates',
      'Live 360° Hemisphere builds on-screen in real-time',
      'Real-time synthesis using Agentic AI facilitation',
      'Facilitator augmented, not replaced — AI handles analysis, humans lead the room',
    ],
  },
  {
    number: 3,
    icon: BarChart3,
    title: 'After the Workshop',
    subtitle: 'Decision Intelligence',
    colour: 'from-[#5cf28e] to-[#50c878]',
    timeline: 'Immediate',
    paragraphs: [
      'The moment the workshop ends, the full analytical dashboard is available. Seven distinct views transform raw dialogue into structured, board-ready intelligence. No waiting for consultants to write reports — the intelligence is computed in real-time.',
      'The Hemisphere Psyche Diagnostic compares the organisation\'s state before the workshop (from Discovery) with its state after (from the live session). Where have minds shifted? Where does resistance persist? This before-and-after comparison is unique to DREAM.',
      'The executive scratchpad provides editable strategic deliverables that can be taken directly into steering committees and board presentations. Everything is exportable, shareable, and grounded in data — not facilitator interpretation.',
    ],
    capabilities: [
      'Post-live analytical dashboard with 7 deep views',
      'Hemisphere Psyche Diagnostic: before vs after comparison',
      'Executive scratchpad with editable strategic deliverables',
      'Sentiment Index, Bias Detection, Balance Safeguards',
      'Multi-Lens Analysis across 6 practical dimensions',
      'Exportable reports for board-level presentation',
    ],
  },
];

const WORKSHOP_STATS = [
  { target: 8, suffix: '–25', label: 'Participants' },
  { target: 15, suffix: ' min', label: 'Per conversation' },
  { target: 1000, suffix: '+', label: 'Data points captured' },
  { target: 7, label: 'Analytical views' },
];

export default function HowItWorksPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'DREAM', href: '/dream' },
          { name: 'How It Works', href: '/dream/how-it-works' },
        ]}
      />
      <FaqJsonLd
        faqs={[
          { question: 'How long does a DREAM workshop take?', answer: 'The live workshop runs for 4–8 hours. Before the workshop, each participant completes a 15-minute AI Discovery conversation over 1–2 weeks. Results are available immediately after.' },
          { question: 'How many participants can a DREAM workshop support?', answer: 'Typically 8–25 participants each have a 15-minute AI-guided Discovery conversation. The live workshop works best with 10–20 people in the room.' },
          { question: 'What technology do participants need?', answer: 'No special software required. Everything is browser-based. Participants receive a link and complete their Discovery conversation on any device.' },
          { question: 'How quickly are results available?', answer: 'The full analytical dashboard with 7 views is available immediately after the workshop ends. No waiting for consultants to compile reports.' },
          { question: 'Does DREAM replace the facilitator?', answer: 'No. DREAM augments the facilitator with AI-powered cognitive guidance, real-time analysis, and structured insight. Humans lead the room; the AI handles the analysis.' },
        ]}
      />
      <PageHero
        eyebrow="The Journey"
        headline="From Conversation to"
        highlightText="Action"
        subheadline="Three stages. One continuous intelligence pipeline. From AI-powered Discovery conversations to real-time workshop synthesis to immediate analytical output."
      />

      {/* ═══ STAGE DEEP-DIVES ═══ */}
      {STAGES.map((stage, i) => {
        const Icon = stage.icon;
        const bgClass = i % 2 === 0 ? 'bg-white' : 'bg-gradient-to-b from-slate-50 to-white';
        return (
          <section key={stage.number} className={`${bgClass} py-20`}>
            <div className="max-w-5xl mx-auto px-6">
              <ScrollReveal>
                <div className="flex items-center gap-4 mb-8">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stage.colour} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{stage.title}</h2>
                      <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                        {stage.timeline}
                      </span>
                    </div>
                    <p className={`text-sm font-medium bg-gradient-to-r ${stage.colour} bg-clip-text text-transparent`}>
                      {stage.subtitle}
                    </p>
                  </div>
                </div>
              </ScrollReveal>

              <div className="grid md:grid-cols-2 gap-10">
                <div>
                  {stage.paragraphs.map((para, pi) => (
                    <ScrollReveal key={pi} delay={100 + pi * 80}>
                      <p className="text-slate-600 leading-relaxed mb-4">{para}</p>
                    </ScrollReveal>
                  ))}
                </div>
                <ScrollReveal delay={200}>
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Capabilities</h3>
                    <ul className="space-y-3">
                      {stage.capabilities.map((cap) => (
                        <li key={cap} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${stage.colour} flex-shrink-0`} />
                          {cap}
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </section>
        );
      })}

      {/* ═══ WORKSHOP PARAMETERS ═══ */}
      <section className="bg-gradient-to-r from-[#0d0d0d] via-[#1a1a2e] to-[#0d0d0d] py-16">
        <div className="max-w-4xl mx-auto px-6">
          <ScrollReveal>
            <h2 className="text-xl font-bold text-white text-center mb-8">
              Typical Workshop Parameters
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              {WORKSHOP_STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-[#5cf28e]">
                    <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                  </div>
                  <div className="text-xs sm:text-sm text-white/40 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <CTASection
        headline="Ready to experience the journey?"
        subheadline="See how DREAM transforms a single workshop into lasting organisational intelligence."
      />
    </>
  );
}
