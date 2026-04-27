'use client';

import Link from 'next/link';
import { Brain, ArrowRight, Layers, Eye, Clock, Target } from 'lucide-react';
import { ScrollReveal } from './scroll-reveal';

/* ────────────────────────────────────────────────────────────
   Data  -  each card becomes a collapsible <details> element
   so all content stays in the DOM for SEO crawlers.
   ──────────────────────────────────────────────────────────── */

const DIFFERENTIATORS = [
  {
    icon: Brain,
    title: 'Agentic AI Engine',
    tagline: 'Multiple specialist agents orchestrated together. Not a chatbot wrapper.',
    colour: 'from-[#5cf28e] to-[#50c878]',
    details: [
      'Discovery Agent  -  conducts structured AI conversations across seven organisational domains, adapting questions in real-time',
      'Facilitation Orchestrator  -  coordinates live workshop phases, handing off between specialist agents that generate questions, cluster themes, and synthesise insights',
      'Deterministic analytics  -  sentiment, bias, and balance scores are computed reproducibly alongside the agentic layer, not hallucinated by an LLM',
    ],
    href: '/dream/technology',
    linkLabel: 'Explore EthentaFlow',
  },
  {
    icon: Layers,
    title: 'DREAM Methodology',
    tagline: 'Five phases. From discovery to mobilisation.',
    colour: 'from-purple-500 to-pink-500',
    details: [
      'Discover  -  AI-powered conversations capture every perspective across People, Organisation, Customer, Technology, and Regulation',
      'Reimagine  -  collective vision-building guided by a Facilitation Orchestrator and specialist agents, grounded in real discovery data',
      'Educate, Apply, Mobilise  -  structured phases that turn insight into constraint-aware, board-ready transformation plans',
    ],
    href: '/dream/methodology',
    linkLabel: 'See the methodology',
  },
  {
    icon: Eye,
    title: '7 Analytical Views',
    tagline: 'Hemisphere, sentiment, bias, balance  -  and more.',
    colour: 'from-blue-500 to-cyan-500',
    details: [
      '360° Hemisphere  -  visual map of collective organisational thinking',
      'Sentiment Index + Bias Detection  -  deterministic scoring of confidence, hedging, and group-think',
      'Balance Safeguards, Multi-Lens Analysis, Executive Scratchpad, Psyche Diagnostic  -  seven views that reveal what surveys and workshops miss',
    ],
    href: '/dream/insights',
    linkLabel: 'Explore all 7 views',
  },
  {
    icon: Clock,
    title: 'Before → During → After',
    tagline: 'AI Discovery, live cognitive guidance, instant intelligence.',
    colour: 'from-amber-500 to-orange-500',
    details: [
      'Before  -  each participant has a 15-minute AI-guided conversation; insights, themes, and a facilitator briefing are ready before anyone enters the room',
      'During  -  multiple specialist agents generate live questions and synthesise themes in real-time while the 360° Hemisphere builds on-screen',
      'After  -  the full analytical dashboard with seven deep views is available immediately. No waiting for consultants to write reports.',
    ],
    href: '/dream/how-it-works',
    linkLabel: 'See the full journey',
  },
  {
    icon: Target,
    title: 'COM-B Behavioural Intelligence',
    tagline: 'Not just what\'s broken — why people behave that way, and what will actually change it.',
    colour: 'from-rose-500 to-pink-600',
    details: [
      'Every finding is automatically mapped through the COM-B framework — Capability, Opportunity, Motivation, Behaviour — translating raw data into behavioural root causes',
      'High-priority interventions are ranked by lens and COM-B sub-type, giving facilitators a prioritised change agenda grounded in behavioural science',
      'Bridges the gap between diagnosis and action: most tools tell you what\'s wrong; DREAM tells you why people behave that way and what specific intervention will shift it',
    ],
    href: '/dream/insights',
    linkLabel: 'See the analytical views',
  },
];

/* ────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────── */

export function DifferentiatorsSection() {
  return (
    <section className="bg-white py-20">
      <div className="max-w-5xl mx-auto px-6">
        <ScrollReveal>
          <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3 text-center">
            What Makes DREAM Different
          </p>
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 text-center">
            Not Another AI Tool.{' '}
            <span className="bg-gradient-to-r from-[#5cf28e] to-[#50c878] bg-clip-text text-transparent">
              A New Category.
            </span>
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto text-center mb-12">
            DREAM orchestrates multiple specialist AI agents, small language models, and
            deterministic analytics into something that didn&apos;t exist before.
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-5">
          {DIFFERENTIATORS.map((item, i) => {
            const Icon = item.icon;
            return (
              <ScrollReveal key={item.title} delay={200 + i * 80}>
                <details className="group bg-slate-50 rounded-2xl border border-slate-200 hover:border-[#50c878]/30 transition-all overflow-hidden">
                  <summary className="flex items-start gap-4 p-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.colour} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900 mb-1">{item.title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">{item.tagline}</p>
                    </div>
                    <div className="mt-1 flex-shrink-0 text-slate-400 group-open:rotate-180 transition-transform">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-current">
                        <path d="M4 6l4 4 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </summary>

                  <div className="px-6 pb-6 pt-0">
                    <ul className="space-y-2 mb-4">
                      {item.details.map((d) => (
                        <li key={d} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#5cf28e] flex-shrink-0" />
                          {d}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#33824d] hover:text-[#50c878] transition-colors"
                    >
                      {item.linkLabel} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </details>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
